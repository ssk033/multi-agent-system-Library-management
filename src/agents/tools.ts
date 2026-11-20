import { DynamicStructuredTool, type StructuredToolInterface } from "@langchain/core/tools";
import { z } from "zod";
import type { AgentContext } from "@/agents/context";
import { confirmationMatches } from "@/lib/confirmation";
import { DomainError, errorMessage } from "@/lib/errors";
import { geminiConfigured, getChatModel } from "@/lib/gemini";
import { assertAgentMayApprove, can } from "@/lib/permissions";
import type { BookCard, ConfirmationRequest, SessionUser } from "@/types";
import { getOverview } from "@/services/analyticsService";
import { listAudit } from "@/services/agentLogService";
import {
  approveAcquisition,
  createAcquisitionRequest,
  listAcquisitions,
  rejectAcquisition,
} from "@/services/acquisitionService";
import {
  findBooksByTitle,
  getBook,
  recommendSimilarBooks,
  searchBooksSemantic,
  searchCatalog,
} from "@/services/bookService";
import { calculateFine, getOverdueLoans, issueBook, listLoans, previewIssue, renewBook, returnBook } from "@/services/loanService";
import { searchLibraryPolicies } from "@/services/policyService";
import { getLibrarySettings } from "@/services/settingsService";

const DISCLAIMER = "This Dewey Decimal number is an AI suggestion and must be verified by a librarian.";

function actorFrom(ctx: AgentContext): SessionUser {
  return {
    id: ctx.userId,
    role: ctx.role,
    studentId: ctx.studentId,
    name: ctx.name,
    email: ctx.email,
  };
}

function json(value: unknown): string {
  return JSON.stringify(value);
}

function agentTool<S extends z.ZodType>(
  name: string,
  description: string,
  schema: S,
  run: (input: z.infer<S>) => Promise<unknown>,
): StructuredToolInterface {
  return new DynamicStructuredTool({
    name,
    description,
    schema: schema as never,
    func: async (input: unknown) => {
      const parsed = schema.parse(input) as z.infer<S>;
      const result = await run(parsed);
      return typeof result === "string" ? result : json(result);
    },
  }) as StructuredToolInterface;
}

function confirmationFor(
  action: ConfirmationRequest["action"],
  message: string,
  data: Record<string, unknown>,
): ConfirmationRequest {
  return { id: crypto.randomUUID(), action, message, data, confirmed: false };
}

async function safe<T>(work: () => Promise<T>) {
  try {
    return await work();
  } catch (error) {
    const status = error instanceof DomainError ? error.status : 500;
    return { ok: false, error: errorMessage(error), status };
  }
}

export function booksToCards(books: Array<{
  id: string;
  title: string;
  author: string;
  isbn: string;
  category: string;
  availableCopies: number;
  totalCopies: number;
  description?: string | null;
  similarity?: number;
}>): BookCard[] {
  return books.map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author,
    isbn: book.isbn,
    category: book.category,
    availableCopies: book.availableCopies,
    totalCopies: book.totalCopies,
    description: book.description ?? undefined,
    similarityScore: book.similarity,
  }));
}

const HEURISTICS: { test: RegExp; category: string; dewey: string }[] = [
  { test: /generat|transformer|language model/i, category: "Generative AI", dewey: "006.35" },
  { test: /deep learning|neural/i, category: "Deep Learning", dewey: "006.32" },
  { test: /machine learning/i, category: "Machine Learning", dewey: "006.31" },
  { test: /artificial intelligence/i, category: "Artificial Intelligence", dewey: "006.3" },
  { test: /database|sql/i, category: "Database Management Systems", dewey: "005.74" },
  { test: /operating system/i, category: "Operating Systems", dewey: "005.43" },
  { test: /network/i, category: "Computer Networks", dewey: "004.6" },
  { test: /security|cyber/i, category: "Cybersecurity", dewey: "005.8" },
  { test: /cloud/i, category: "Cloud Computing", dewey: "004.678" },
  { test: /algorithm|data structure/i, category: "Data Structures and Algorithms", dewey: "005.13" },
  { test: /software/i, category: "Software Engineering", dewey: "005.1" },
  { test: /math|algebra|discrete/i, category: "Mathematics", dewey: "510" },
];

async function suggestClassification(title: string, description: string) {
  const fallback = HEURISTICS.find((item) => item.test.test(`${title} ${description}`)) ?? {
    category: "Computer Science",
    dewey: "004",
  };
  if (!geminiConfigured()) {
    return {
      category: fallback.category,
      deweyDecimal: fallback.dewey,
      rationale: "Suggested from catalog keywords because Gemini is not configured.",
      disclaimer: DISCLAIMER,
      source: "heuristic",
    };
  }
  try {
    const model = getChatModel(0).withStructuredOutput(
      z.object({
        category: z.string(),
        deweyDecimal: z.string(),
        rationale: z.string(),
      }),
    );
    const result = await model.invoke(
      `Suggest a library category and a Dewey Decimal number for this book. The number is only a suggestion.\nTitle: ${title}\nDescription: ${description}`,
    );
    return { ...result, disclaimer: DISCLAIMER, source: "gemini" };
  } catch {
    return {
      category: fallback.category,
      deweyDecimal: fallback.dewey,
      rationale: "The model request failed, so a keyword suggestion was used.",
      disclaimer: DISCLAIMER,
      source: "heuristic",
    };
  }
}

export function createDiscoveryTools(ctx: AgentContext) {
  const tools: StructuredToolInterface[] = [
    agentTool("searchBooksSemantic", "Embed the query and retrieve books by pgvector cosine similarity.", z.object({ query: z.string().min(2) }), async ({ query }) =>
      safe(async () => {
        const books = await searchBooksSemantic(query);
        return { ok: true, books, cards: booksToCards(books) };
      }),
    ),
    agentTool("searchCatalog", "Keyword search across title, author, ISBN, and description.", z.object({ query: z.string().min(2) }), async ({ query }) =>
      safe(async () => {
        const books = await searchCatalog({ query, limit: 8 });
        return { ok: true, books, cards: booksToCards(books), matchType: "keyword" };
      }),
    ),
    agentTool("searchBooksByCategory", "List books in an exact catalog category.", z.object({ category: z.string().min(2) }), async ({ category }) =>
      safe(async () => {
        const books = await searchCatalog({ category, limit: 12 });
        return { ok: true, books, cards: booksToCards(books) };
      }),
    ),
    agentTool("getBookDetails", "Get one catalog record by its UUID.", z.object({ bookId: z.string().uuid() }), async ({ bookId }) =>
      safe(async () => ({ ok: true, book: await getBook(bookId) })),
    ),
    agentTool("checkBookAvailability", "Check how many copies of a book can be issued.", z.object({ bookId: z.string().uuid() }), async ({ bookId }) =>
      safe(async () => {
        const book = await getBook(bookId);
        return {
          ok: true,
          bookId,
          title: book.title,
          availableCopies: book.availableCopies,
          totalCopies: book.totalCopies,
          available: book.availableCopies > 0,
        };
      }),
    ),
    agentTool("recommendSimilarBooks", "Recommend related books for a known book id.", z.object({ bookId: z.string().uuid() }), async ({ bookId }) =>
      safe(async () => {
        const books = await recommendSimilarBooks(bookId);
        return { ok: true, books, cards: booksToCards(books) };
      }),
    ),
    agentTool(
      "searchLibraryPolicies",
      "Retrieve library policy passages and the live circulation settings.",
      z.object({ query: z.string().min(2) }),
      async ({ query }) =>
        safe(async () => {
          const policies = await searchLibraryPolicies(query);
          const currentSettings = await getLibrarySettings();
          return {
            ok: true,
            policies,
            currentSettings,
            note: "Numeric limits in currentSettings are enforced by the circulation service. Do not invent a rule that is absent from policies and currentSettings.",
          };
        }),
    ),
  ];

  if (can(ctx.role, "analytics")) {
    tools.push(
      agentTool("getLibraryStatistics", "Read dashboard statistics from the database.", z.object({}), async () =>
        safe(async () => ({
          ok: true,
          overview: await getOverview(actorFrom(ctx)),
        })),
      ),
    );
  }
  if (can(ctx.role, "audit")) {
    tools.push(
      agentTool("getAuditLogs", "Read recent audit log entries. Administrators only.", z.object({}), async () =>
        safe(async () => ({ ok: true, logs: await listAudit(20) })),
      ),
    );
  }
  return tools;
}

export function createCirculationTools(ctx: AgentContext): StructuredToolInterface[] {
  return [
    agentTool(
      "issueBook",
      "Validate eligibility and issue a book. Writes only when the server confirmation matches this book.",
      z.object({
        bookId: z.string().uuid(),
        rollNo: z.string().optional().describe("Librarians only. Ignored for students."),
      }),
      async ({ bookId, rollNo }) =>
        safe(async () => {
          const preview = await previewIssue(actorFrom(ctx), bookId, rollNo);
          if (!preview.ok) return { ok: false, error: preview.error, preview };
          if (!confirmationMatches(ctx.confirmation, "issue_book", { bookId })) {
            return {
              ok: false,
              confirmationRequired: confirmationFor(
                "issue_book",
                `Issue "${preview.title}" to ${preview.studentName} (${preview.rollNo})? It will be due on ${new Date(preview.dueDate).toLocaleDateString("en-IN")}.`,
                { bookId, rollNo: preview.rollNo, title: preview.title },
              ),
            };
          }
          const result = await issueBook({ actor: actorFrom(ctx), bookId, rollNo });
          return { ok: true, database: "committed", result };
        }),
    ),
    agentTool("returnBook", "Return a loan. Writes only after a matching confirmation.", z.object({ loanId: z.string().uuid() }), async ({ loanId }) =>
      safe(async () => {
        const loans = await listLoans(actorFrom(ctx));
        const loan = loans.find((item) => item.id === loanId);
        if (!loan) return { ok: false, error: "Loan not found" };
        if (!confirmationMatches(ctx.confirmation, "return_book", { loanId })) {
          return {
            ok: false,
            confirmationRequired: confirmationFor(
              "return_book",
              `Return "${loan.bookTitle}"? The projected fine is ₹${loan.projectedFine.toFixed(2)}.`,
              { loanId, title: loan.bookTitle },
            ),
          };
        }
        const result = await returnBook({ actor: actorFrom(ctx), loanId });
        return { ok: true, database: "committed", result };
      }),
    ),
    agentTool("renewBook", "Renew an eligible loan after confirmation.", z.object({ loanId: z.string().uuid() }), async ({ loanId }) =>
      safe(async () => {
        const loans = await listLoans(actorFrom(ctx));
        const loan = loans.find((item) => item.id === loanId);
        if (!loan) return { ok: false, error: "Loan not found" };
        if (!confirmationMatches(ctx.confirmation, "renew_book", { loanId })) {
          return {
            ok: false,
            confirmationRequired: confirmationFor(
              "renew_book",
              `Renew "${loan.bookTitle}"? This extends the current due date when the loan is eligible.`,
              { loanId, title: loan.bookTitle },
            ),
          };
        }
        const result = await renewBook({ actor: actorFrom(ctx), loanId });
        return { ok: true, database: "committed", result };
      }),
    ),
    agentTool("getStudentLoans", "List loans for the authenticated student, or all loans for library staff.", z.object({}), async () =>
      safe(async () => ({ ok: true, loans: await listLoans(actorFrom(ctx)) })),
    ),
    agentTool("getOverdueLoans", "List overdue loans visible to the authenticated user.", z.object({}), async () =>
      safe(async () => ({ ok: true, loans: await getOverdueLoans(actorFrom(ctx)) })),
    ),
    agentTool("calculateFine", "Calculate the fine for a loan without changing it.", z.object({ loanId: z.string().uuid() }), async ({ loanId }) =>
      safe(async () => ({ ok: true, fine: await calculateFine(loanId, actorFrom(ctx)) })),
    ),
  ];
}

export function createAcquisitionTools(ctx: AgentContext): StructuredToolInterface[] {
  const tools: StructuredToolInterface[] = [
    agentTool(
      "createAcquisitionRequest",
      "Create a PENDING acquisition request after the user confirms. Never approves a purchase.",
      z.object({
        bookTitle: z.string().min(2),
        author: z.string().optional(),
        reason: z.string().min(10),
      }),
      async ({ bookTitle, author, reason }) =>
        safe(async () => {
          const suggestion = await suggestClassification(bookTitle, reason);
          if (!confirmationMatches(ctx.confirmation, "create_acquisition", { bookTitle })) {
            return {
              ok: false,
              confirmationRequired: confirmationFor(
                "create_acquisition",
                `Submit an acquisition request for "${bookTitle}"? It stays pending until a librarian approves it. No purchase will be made automatically.`,
                {
                  bookTitle,
                  author: author ?? null,
                  reason,
                  suggestedCategory: suggestion.category,
                  suggestedDeweyDecimal: suggestion.deweyDecimal,
                },
              ),
              suggestion,
            };
          }
          const result = await createAcquisitionRequest({
            actor: actorFrom(ctx),
            bookTitle,
            author,
            reason,
            requestedByAgent: "acquisition",
            suggestedCategory: suggestion.category,
            suggestedDeweyDecimal: suggestion.deweyDecimal,
          });
          return { ok: true, database: "committed", result, suggestion };
        }),
    ),
    agentTool(
      "suggestBookClassification",
      "Suggest a category and Dewey Decimal number for librarian verification.",
      z.object({ title: z.string().min(2), description: z.string().min(2) }),
      async ({ title, description }) => safe(async () => ({ ok: true, suggestion: await suggestClassification(title, description) })),
    ),
    agentTool(
      "prepareBookCatalogEntry",
      "Prepare a catalog draft. This does not insert a book.",
      z.object({
        title: z.string().min(2),
        author: z.string().min(2),
        category: z.string().min(2),
        description: z.string().min(2),
        deweyDecimal: z.string().min(1),
      }),
      async ({ title, author, category, description, deweyDecimal }) => ({
        ok: true,
        draft: { title, author, category, description, deweyDecimal },
        disclaimer: DISCLAIMER,
        stored: false,
      }),
    ),
  ];

  if (ctx.role === "LIBRARIAN" || ctx.role === "ADMIN") {
    tools.push(
      agentTool(
        "approveAcquisition",
        "Disabled in chat. Approval is only accepted from the librarian dashboard.",
        z.object({ requestId: z.string().uuid(), comment: z.string().optional() }),
        async ({ requestId, comment }) =>
          safe(async () => {
            assertAgentMayApprove({ role: ctx.role, explicitLibrarianAction: ctx.explicitLibrarianAction });
            const updated = await approveAcquisition(requestId, actorFrom(ctx), comment ?? "");
            return { ok: true, updated };
          }),
      ),
      agentTool(
        "rejectAcquisition",
        "Disabled in chat. Rejection is only accepted from the librarian dashboard.",
        z.object({ requestId: z.string().uuid(), comment: z.string().min(3) }),
        async ({ requestId, comment }) =>
          safe(async () => {
            assertAgentMayApprove({ role: ctx.role, explicitLibrarianAction: ctx.explicitLibrarianAction });
            const updated = await rejectAcquisition(requestId, actorFrom(ctx), comment);
            return { ok: true, updated };
          }),
      ),
    );
  }

  if (can(ctx.role, "acquisitions.read")) {
    tools.splice(
      1,
      0,
      agentTool("getPendingAcquisitions", "List acquisition requests waiting for a librarian.", z.object({}), async () =>
        safe(async () => ({ ok: true, requests: await listAcquisitions("PENDING") })),
      ),
    );
  }
  return tools;
}

export function createAllTools(ctx: AgentContext) {
  return {
    discovery: createDiscoveryTools(ctx),
    circulation: createCirculationTools(ctx),
    acquisition: createAcquisitionTools(ctx),
  };
}

export async function lookupTitle(query: string) {
  return findBooksByTitle(query, 5);
}
