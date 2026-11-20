import { and, eq, ilike, or, sql } from "drizzle-orm";
import { getDb, resultRows } from "@/db";
import { books } from "@/db/schema";
import { DomainError } from "@/lib/errors";
import type { BookDTO } from "@/types";
import { recordAudit } from "@/services/auditService";
import {
  bookEmbeddingSource,
  contentHash,
  embedText,
  toVectorLiteral,
} from "@/services/embeddingService";
import { getLibrarySettings } from "@/services/settingsService";
import { geminiConfigured } from "@/lib/gemini";

const bookColumns = {
  id: books.id,
  isbn: books.isbn,
  title: books.title,
  author: books.author,
  publisher: books.publisher,
  publicationYear: books.publicationYear,
  category: books.category,
  description: books.description,
  deweyDecimal: books.deweyDecimal,
  totalCopies: books.totalCopies,
  availableCopies: books.availableCopies,
};

function toBook(row: {
  id: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string | null;
  publicationYear: number | null;
  category: string;
  description: string | null;
  deweyDecimal: string | null;
  totalCopies: number;
  availableCopies: number;
}, similarity?: number): BookDTO {
  return {
    id: row.id,
    isbn: row.isbn,
    title: row.title,
    author: row.author,
    publisher: row.publisher,
    publicationYear: row.publicationYear,
    category: row.category,
    description: row.description,
    deweyDecimal: row.deweyDecimal,
    totalCopies: row.totalCopies,
    availableCopies: row.availableCopies,
    similarity,
  };
}

export async function searchCatalog(filters: {
  query?: string;
  author?: string;
  isbn?: string;
  category?: string;
  availability?: "all" | "available" | "unavailable";
  limit?: number;
}): Promise<BookDTO[]> {
  const db = getDb();
  const conditions = [];
  if (filters.query) {
    const words = filters.query
      .split(/\s+/)
      .map((word) => word.replace(/[%_\\]/g, "").trim())
      .filter((word) => word.length >= 2);
    const terms = words.length > 0 ? words : [filters.query.replace(/[%_\\]/g, "").trim()];
    for (const word of terms) {
      const pattern = `%${word}%`;
      conditions.push(or(ilike(books.title, pattern), ilike(books.author, pattern), ilike(books.isbn, pattern), ilike(books.description, pattern)));
    }
  }
  if (filters.author) conditions.push(ilike(books.author, `%${filters.author}%`));
  if (filters.isbn) conditions.push(ilike(books.isbn, `%${filters.isbn}%`));
  if (filters.category) conditions.push(eq(books.category, filters.category));
  if (filters.availability === "available") conditions.push(sql`${books.availableCopies} > 0`);
  if (filters.availability === "unavailable") conditions.push(eq(books.availableCopies, 0));

  const rows = await db
    .select(bookColumns)
    .from(books)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(books.title)
    .limit(filters.limit ?? 100);
  return rows.map((row) => toBook(row));
}

export async function listCategories(): Promise<string[]> {
  const db = getDb();
  const rows = await db.selectDistinct({ category: books.category }).from(books).orderBy(books.category);
  return rows.map((row) => row.category);
}

export async function getBook(id: string): Promise<BookDTO> {
  const db = getDb();
  const [row] = await db.select(bookColumns).from(books).where(eq(books.id, id)).limit(1);
  if (!row) throw new DomainError("Book not found", 404);
  return toBook(row);
}

export async function getBookRow(id: string) {
  const db = getDb();
  const [row] = await db.select().from(books).where(eq(books.id, id)).limit(1);
  if (!row) throw new DomainError("Book not found", 404);
  return row;
}

export async function searchBooksSemantic(query: string, limit?: number): Promise<BookDTO[]> {
  if (!geminiConfigured()) {
    throw new DomainError("Semantic search requires GEMINI_API_KEY", 503);
  }
  const settings = await getLibrarySettings();
  const embedding = await embedText(query);
  const literal = toVectorLiteral(embedding);
  const resultLimit = limit ?? settings.semanticResultLimit;
  const db = getDb();
  const result = await db.execute(sql`
    SELECT id, isbn, title, author, publisher, publication_year, category, description,
           dewey_decimal, total_copies, available_copies,
           1 - (embedding <=> ${literal}::vector) AS similarity
    FROM books
    WHERE embedding IS NOT NULL
    ORDER BY embedding <=> ${literal}::vector
    LIMIT ${resultLimit}
  `);
  const rows = resultRows<{
    id: string;
    isbn: string;
    title: string;
    author: string;
    publisher: string | null;
    publication_year: number | null;
    category: string;
    description: string | null;
    dewey_decimal: string | null;
    total_copies: number;
    available_copies: number;
    similarity: number | string;
  }>(result);

  return rows
    .map((row) => ({
      id: row.id,
      isbn: row.isbn,
      title: row.title,
      author: row.author,
      publisher: row.publisher,
      publicationYear: row.publication_year,
      category: row.category,
      description: row.description,
      deweyDecimal: row.dewey_decimal,
      totalCopies: row.total_copies,
      availableCopies: row.available_copies,
      similarity: Number(row.similarity),
    }))
    .filter((row) => row.similarity >= settings.similarityThreshold);
}

export async function recommendSimilarBooks(bookId: string): Promise<BookDTO[]> {
  const book = await getBook(bookId);
  if (geminiConfigured() && book.description) {
    try {
      const matches = await searchBooksSemantic(`${book.title}. ${book.description}`, 6);
      const others = matches.filter((item) => item.id !== bookId);
      if (others.length > 0) return others.slice(0, 4);
    } catch (error) {
      console.error("Similar-book vector search failed", error instanceof Error ? error.message : "unknown");
    }
  }
  const related = await searchCatalog({ category: book.category, limit: 5 });
  return related.filter((item) => item.id !== bookId).slice(0, 4);
}

async function maybeEmbed(input: {
  title: string;
  author: string;
  category: string;
  description?: string | null;
  previousHash?: string | null;
}) {
  const source = bookEmbeddingSource(input);
  const hash = contentHash(source);
  if (input.previousHash && input.previousHash === hash) {
    return { embedding: undefined, contentHash: hash, skipped: true };
  }
  if (!geminiConfigured()) return { embedding: null, contentHash: null, skipped: false };
  try {
    const embedding = await embedText(source);
    return { embedding, contentHash: hash, skipped: false };
  } catch (error) {
    console.error("Book embedding failed", error instanceof Error ? error.message : "unknown");
    return { embedding: null, contentHash: null, skipped: false };
  }
}

export async function createBook(
  input: {
    isbn: string;
    title: string;
    author: string;
    publisher?: string | null;
    publicationYear?: number | null;
    category: string;
    description?: string | null;
    deweyDecimal?: string | null;
    totalCopies: number;
    availableCopies?: number;
  },
  userId: string,
) {
  const available = input.availableCopies ?? input.totalCopies;
  if (available > input.totalCopies) {
    throw new DomainError("Available copies cannot exceed total copies");
  }
  const embedded = await maybeEmbed(input);
  const db = getDb();
  try {
    const [created] = await db
      .insert(books)
      .values({
        isbn: input.isbn,
        title: input.title,
        author: input.author,
        publisher: input.publisher ?? null,
        publicationYear: input.publicationYear ?? null,
        category: input.category,
        description: input.description ?? null,
        deweyDecimal: input.deweyDecimal ?? null,
        totalCopies: input.totalCopies,
        availableCopies: available,
        embedding: embedded.embedding ?? null,
        contentHash: embedded.contentHash,
      })
      .returning();
    await recordAudit({
      userId,
      action: "BOOK_ADDED",
      entityType: "book",
      entityId: created.id,
      details: created.title,
    });
    return toBook(created);
  } catch (error) {
    if (error instanceof Error && /books_isbn_idx|duplicate key/i.test(error.message)) {
      throw new DomainError("A book with this ISBN already exists", 409);
    }
    throw error;
  }
}

export async function updateBook(
  id: string,
  input: Partial<{
    isbn: string;
    title: string;
    author: string;
    publisher: string | null;
    publicationYear: number | null;
    category: string;
    description: string | null;
    deweyDecimal: string | null;
    totalCopies: number;
    availableCopies: number;
  }>,
  userId: string,
) {
  const current = await getBookRow(id);
  const next = {
    isbn: input.isbn ?? current.isbn,
    title: input.title ?? current.title,
    author: input.author ?? current.author,
    publisher: input.publisher === undefined ? current.publisher : input.publisher,
    publicationYear: input.publicationYear === undefined ? current.publicationYear : input.publicationYear,
    category: input.category ?? current.category,
    description: input.description === undefined ? current.description : input.description,
    deweyDecimal: input.deweyDecimal === undefined ? current.deweyDecimal : input.deweyDecimal,
    totalCopies: input.totalCopies ?? current.totalCopies,
    availableCopies: input.availableCopies ?? current.availableCopies,
  };
  if (next.availableCopies > next.totalCopies || next.availableCopies < 0 || next.totalCopies < 0) {
    throw new DomainError("Copy counts are inconsistent");
  }
  const textChanged =
    next.title !== current.title ||
    next.author !== current.author ||
    next.category !== current.category ||
    next.description !== current.description;
  const embedded = textChanged
    ? await maybeEmbed({ ...next, previousHash: current.contentHash })
    : { embedding: undefined, contentHash: current.contentHash, skipped: true };

  const db = getDb();
  const [updated] = await db
    .update(books)
    .set({
      ...next,
      embedding: embedded.skipped ? current.embedding : embedded.embedding,
      contentHash: embedded.contentHash,
      updatedAt: new Date(),
    })
    .where(eq(books.id, id))
    .returning();
  await recordAudit({
    userId,
    action: "BOOK_UPDATED",
    entityType: "book",
    entityId: id,
    details: updated.title,
  });
  return toBook(updated);
}

export async function deleteBook(id: string, userId: string) {
  const db = getDb();
  const book = await getBookRow(id);
  try {
    await db.delete(books).where(eq(books.id, id));
  } catch (error) {
    if (error instanceof Error && /foreign key|violates/i.test(error.message)) {
      throw new DomainError("This book has loan history and cannot be deleted", 409);
    }
    throw error;
  }
  await recordAudit({
    userId,
    action: "BOOK_DELETED",
    entityType: "book",
    entityId: id,
    details: book.title,
  });
}

export async function findBooksByTitle(query: string, limit = 5): Promise<BookDTO[]> {
  return searchCatalog({ query, limit });
}

