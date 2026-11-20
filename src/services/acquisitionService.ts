import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { acquisitionRequests, notifications, students, users } from "@/db/schema";
import { DomainError } from "@/lib/errors";
import type { SessionUser } from "@/types";
import { recordAudit } from "@/services/auditService";
import { createBook } from "@/services/bookService";

export async function listAcquisitions(status?: "PENDING" | "APPROVED" | "REJECTED") {
  const db = getDb();
  const rows = await db
    .select({
      id: acquisitionRequests.id,
      bookTitle: acquisitionRequests.bookTitle,
      author: acquisitionRequests.author,
      isbn: acquisitionRequests.isbn,
      reason: acquisitionRequests.reason,
      requestedByAgent: acquisitionRequests.requestedByAgent,
      requestedByStudentId: acquisitionRequests.requestedByStudentId,
      studentName: students.name,
      rollNo: students.rollNo,
      suggestedCategory: acquisitionRequests.suggestedCategory,
      suggestedDeweyDecimal: acquisitionRequests.suggestedDeweyDecimal,
      status: acquisitionRequests.status,
      librarianComment: acquisitionRequests.librarianComment,
      createdAt: acquisitionRequests.createdAt,
      reviewedAt: acquisitionRequests.reviewedAt,
    })
    .from(acquisitionRequests)
    .leftJoin(students, eq(acquisitionRequests.requestedByStudentId, students.id))
    .where(status ? eq(acquisitionRequests.status, status) : undefined)
    .orderBy(acquisitionRequests.createdAt);
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
  }));
}

export async function findPendingByTitle(title: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(acquisitionRequests)
    .where(
      and(
        eq(acquisitionRequests.status, "PENDING"),
        sql`lower(${acquisitionRequests.bookTitle}) = ${title.trim().toLowerCase()}`,
      ),
    )
    .limit(1);
  return row ?? null;
}

async function notifyRole(role: "LIBRARIAN" | "ADMIN", title: string, message: string, link: string) {
  const db = getDb();
  const recipients = await db.select({ id: users.id }).from(users).where(eq(users.role, role));
  if (recipients.length === 0) return;
  await db.insert(notifications).values(
    recipients.map((recipient) => ({
      userId: recipient.id,
      title,
      message,
      type: "INFO" as const,
      link,
    })),
  );
}

export async function createAcquisitionRequest(input: {
  actor: SessionUser;
  bookTitle: string;
  author?: string | null;
  reason: string;
  requestedByAgent: string;
  suggestedCategory?: string | null;
  suggestedDeweyDecimal?: string | null;
}) {
  const existing = await findPendingByTitle(input.bookTitle);
  if (existing) {
    return {
      created: false,
      requestId: existing.id,
      status: existing.status,
      message: "A pending acquisition request already exists for this title.",
    };
  }
  const db = getDb();
  const [created] = await db
    .insert(acquisitionRequests)
    .values({
      bookTitle: input.bookTitle.trim(),
      author: input.author ?? null,
      reason: input.reason,
      requestedByAgent: input.requestedByAgent,
      requestedByStudentId: input.actor.studentId,
      suggestedCategory: input.suggestedCategory ?? null,
      suggestedDeweyDecimal: input.suggestedDeweyDecimal ?? null,
      status: "PENDING",
    })
    .returning();
  await recordAudit({
    userId: input.actor.id,
    action: "ACQUISITION_REQUESTED",
    entityType: "acquisition_request",
    entityId: created.id,
    details: created.bookTitle,
  });
  await notifyRole(
    "LIBRARIAN",
    "Acquisition approval needed",
    `${created.bookTitle} was requested and is waiting for a librarian decision.`,
    "/acquisitions",
  );
  await notifyRole(
    "ADMIN",
    "Acquisition approval needed",
    `${created.bookTitle} was requested and is waiting for a librarian decision.`,
    "/acquisitions",
  );
  return {
    created: true,
    requestId: created.id,
    status: created.status,
    message: "The acquisition request is pending librarian approval. The assistant cannot approve purchases.",
  };
}

async function decide(
  requestId: string,
  actor: SessionUser,
  status: "APPROVED" | "REJECTED",
  comment: string,
) {
  if (actor.role === "STUDENT") throw new DomainError("Forbidden", 403);
  const db = getDb();
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(acquisitionRequests)
      .where(eq(acquisitionRequests.id, requestId))
      .for("update")
      .limit(1);
    if (!current) throw new DomainError("Acquisition request not found", 404);
    if (current.status !== "PENDING") throw new DomainError("This request has already been reviewed", 409);
    const [updated] = await tx
      .update(acquisitionRequests)
      .set({
        status,
        librarianComment: comment,
        reviewedBy: actor.id,
        reviewedAt: new Date(),
      })
      .where(eq(acquisitionRequests.id, requestId))
      .returning();
    await recordAudit(
      {
        userId: actor.id,
        action: status === "APPROVED" ? "ACQUISITION_APPROVED" : "ACQUISITION_REJECTED",
        entityType: "acquisition_request",
        entityId: requestId,
        details: comment || status,
      },
      tx,
    );
    if (current.requestedByStudentId) {
      const [student] = await tx
        .select()
        .from(students)
        .where(eq(students.id, current.requestedByStudentId))
        .limit(1);
      if (student) {
        await tx.insert(notifications).values({
          userId: student.userId,
          title: `Acquisition ${status.toLowerCase()}`,
          message: `${current.bookTitle} was ${status.toLowerCase()}.${comment ? ` ${comment}` : ""}`,
          type: status === "APPROVED" ? "SUCCESS" : "WARNING",
          link: "/assistant",
        });
      }
    }
    return updated;
  });
}

export function approveAcquisition(requestId: string, actor: SessionUser, comment: string) {
  return decide(requestId, actor, "APPROVED", comment);
}

export function rejectAcquisition(requestId: string, actor: SessionUser, comment: string) {
  if (!comment.trim()) throw new DomainError("A comment is required when rejecting a request");
  return decide(requestId, actor, "REJECTED", comment);
}

export async function catalogApprovedRequest(
  requestId: string,
  actor: SessionUser,
  input: { isbn: string; totalCopies: number; category: string; description?: string | null },
) {
  const db = getDb();
  const [request] = await db.select().from(acquisitionRequests).where(eq(acquisitionRequests.id, requestId)).limit(1);
  if (!request) throw new DomainError("Acquisition request not found", 404);
  if (request.status !== "APPROVED") {
    throw new DomainError("Only an approved request can be added to the catalog");
  }
  const book = await createBook(
    {
      isbn: input.isbn,
      title: request.bookTitle,
      author: request.author || "Unknown",
      category: input.category,
      description: input.description ?? request.reason,
      deweyDecimal: request.suggestedDeweyDecimal,
      totalCopies: input.totalCopies,
      availableCopies: input.totalCopies,
    },
    actor.id,
  );
  return book;
}
