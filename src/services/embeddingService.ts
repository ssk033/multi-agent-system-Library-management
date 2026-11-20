import { createHash } from "node:crypto";
import { eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { books, libraryPolicies } from "@/db/schema";
import { DomainError } from "@/lib/errors";
import { embeddingDimensions, embedWithGemini, geminiConfigured } from "@/lib/gemini";

export function contentHash(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

export function toVectorLiteral(values: number[]): string {
  if (values.length === 0 || values.some((value) => !Number.isFinite(value))) {
    throw new DomainError("Embedding values are invalid");
  }
  return `[${values.join(",")}]`;
}

export function bookEmbeddingSource(book: {
  title: string;
  author: string;
  category: string;
  description?: string | null;
}): string {
  return `${book.title}. Author: ${book.author}. Category: ${book.category}. ${book.description ?? ""}`.trim();
}

export function policyEmbeddingSource(policy: { policyName: string; policyContent: string }): string {
  return `${policy.policyName}. ${policy.policyContent}`;
}

export async function embedText(text: string): Promise<number[]> {
  if (!geminiConfigured()) {
    throw new DomainError("GEMINI_API_KEY is not configured, so embeddings cannot be generated", 503);
  }
  const [vector] = await embedWithGemini([text]);
  const expected = embeddingDimensions();
  if (vector.length !== expected) {
    throw new DomainError(
      `The embedding model returned ${vector.length} dimensions, but the database expects ${expected}. Set GEMINI_EMBEDDING_MODEL to a ${expected}-dimensional model.`,
    );
  }
  return vector;
}

export async function embedDocuments(texts: string[]): Promise<number[][]> {
  if (!geminiConfigured()) {
    throw new DomainError("GEMINI_API_KEY is not configured, so embeddings cannot be generated", 503);
  }
  const vectors = await embedWithGemini(texts);
  const expected = embeddingDimensions();
  for (const vector of vectors) {
    if (vector.length !== expected) {
      throw new DomainError(
        `The embedding model returned ${vector.length} dimensions, but the database expects ${expected}.`,
      );
    }
  }
  return vectors;
}

export async function rebuildMissingEmbeddings() {
  if (!geminiConfigured()) {
    throw new DomainError("GEMINI_API_KEY is not configured", 503);
  }
  const db = getDb();
  const bookRows = await db
    .select()
    .from(books)
    .where(isNull(books.contentHash));
  let booksUpdated = 0;
  for (const book of bookRows) {
    const source = bookEmbeddingSource(book);
    const hash = contentHash(source);
    const embedding = await embedText(source);
    await db
      .update(books)
      .set({ embedding, contentHash: hash, updatedAt: new Date() })
      .where(eq(books.id, book.id));
    booksUpdated += 1;
  }

  const policyRows = await db.select().from(libraryPolicies).where(isNull(libraryPolicies.contentHash));
  let policiesUpdated = 0;
  for (const policy of policyRows) {
    const source = policyEmbeddingSource(policy);
    const hash = contentHash(source);
    const embedding = await embedText(source);
    await db
      .update(libraryPolicies)
      .set({ embedding, contentHash: hash, updatedAt: new Date() })
      .where(eq(libraryPolicies.id, policy.id));
    policiesUpdated += 1;
  }
  return { booksUpdated, policiesUpdated };
}
