import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "@/db";
import { books, loans, students } from "@/db/schema";
import { DomainError } from "@/lib/errors";
import {
  addDays,
  borrowDenialReason,
  computeFineAmount,
  daysUntilDue,
  renewDenialReason,
  restoreCopy,
  takeCopy,
} from "@/lib/library-rules";
import { isUniqueViolation, num } from "@/lib/utils";
import type { LoanDTO, SessionUser } from "@/types";
import { recordAudit } from "@/services/auditService";
import { clearOverviewCache } from "@/services/overviewCache";
import { getLibrarySettings } from "@/services/settingsService";
import { getStudentById, getStudentByRoll } from "@/services/studentService";

const HELD = ["ACTIVE", "OVERDUE"] as const;

export async function syncOverdue(tx: Pick<ReturnType<typeof getDb>, "update"> = getDb()) {
  await tx
    .update(loans)
    .set({ status: "OVERDUE" })
    .where(and(eq(loans.status, "ACTIVE"), sql`${loans.dueDate} < now()`));
}

function toLoan(row: {
  id: string;
  bookId: string;
  studentId: string;
  bookTitle: string;
  isbn: string;
  studentName: string;
  rollNo: string;
  issuedAt: Date;
  dueDate: Date;
  returnedAt: Date | null;
  fineAmount: string;
  renewalCount: number;
  status: "ACTIVE" | "RETURNED" | "OVERDUE";
}, finePerDay: number): LoanDTO {
  const projected = row.status === "RETURNED" ? num(row.fineAmount) : computeFineAmount(row.dueDate, finePerDay);
  return {
    id: row.id,
    bookId: row.bookId,
    studentId: row.studentId,
    bookTitle: row.bookTitle,
    isbn: row.isbn,
    studentName: row.studentName,
    rollNo: row.rollNo,
    issuedAt: row.issuedAt.toISOString(),
    dueDate: row.dueDate.toISOString(),
    returnedAt: row.returnedAt ? row.returnedAt.toISOString() : null,
    fineAmount: num(row.fineAmount),
    projectedFine: projected,
    renewalCount: row.renewalCount,
    status: row.status,
    daysRemaining: daysUntilDue(row.dueDate),
  };
}

export async function resolveBorrower(actor: SessionUser, input?: { studentId?: string; rollNo?: string }) {
  if (actor.role === "STUDENT") {
    if (!actor.studentId) throw new DomainError("This account has no student profile", 403);
    return getStudentById(actor.studentId);
  }
  if (input?.studentId) return getStudentById(input.studentId);
  if (input?.rollNo) return getStudentByRoll(input.rollNo);
  throw new DomainError("Provide the student roll number");
}

export async function listLoans(actor: SessionUser, filters?: { status?: "ACTIVE" | "RETURNED" | "OVERDUE" | "HELD" }) {
  await syncOverdue();
  const settings = await getLibrarySettings();
  const db = getDb();
  const conditions = [];
  if (actor.role === "STUDENT") {
    if (!actor.studentId) return [];
    conditions.push(eq(loans.studentId, actor.studentId));
  }
  if (filters?.status === "HELD") conditions.push(inArray(loans.status, [...HELD]));
  else if (filters?.status) conditions.push(eq(loans.status, filters.status));

  const rows = await db
    .select({
      id: loans.id,
      bookId: loans.bookId,
      studentId: loans.studentId,
      bookTitle: books.title,
      isbn: books.isbn,
      studentName: students.name,
      rollNo: students.rollNo,
      issuedAt: loans.issuedAt,
      dueDate: loans.dueDate,
      returnedAt: loans.returnedAt,
      fineAmount: loans.fineAmount,
      renewalCount: loans.renewalCount,
      status: loans.status,
    })
    .from(loans)
    .innerJoin(books, eq(loans.bookId, books.id))
    .innerJoin(students, eq(loans.studentId, students.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(loans.issuedAt);

  return rows.map((row) => toLoan(row, settings.finePerDay));
}

export async function getOverdueLoans(actor: SessionUser) {
  return listLoans(actor, { status: "OVERDUE" });
}

export async function calculateFine(loanId: string, actor: SessionUser) {
  const settings = await getLibrarySettings();
  const loan = (await listLoans(actor)).find((item) => item.id === loanId);
  if (!loan) throw new DomainError("Loan not found", 404);
  return {
    loanId,
    overdueDays: Math.max(0, -daysUntilDue(loan.dueDate)),
    finePerDay: settings.finePerDay,
    amount: loan.status === "RETURNED" ? loan.fineAmount : loan.projectedFine,
  };
}

async function heldLoansForStudent(tx: Pick<ReturnType<typeof getDb>, "select">, studentId: string) {
  return tx
    .select()
    .from(loans)
    .where(and(eq(loans.studentId, studentId), inArray(loans.status, [...HELD])));
}

export async function previewIssue(actor: SessionUser, bookId: string, rollNo?: string) {
  await syncOverdue();
  const settings = await getLibrarySettings();
  const student = await resolveBorrower(actor, { rollNo });
  const db = getDb();
  const [book] = await db.select().from(books).where(eq(books.id, bookId)).limit(1);
  if (!book) throw new DomainError("Book not found", 404);
  const held = await heldLoansForStudent(db, student.id);
  const reason = borrowDenialReason({
    studentStatus: student.status,
    heldLoans: held.length,
    maxLoans: settings.maxLoansPerStudent,
    availableCopies: book.availableCopies,
    alreadyHoldsTitle: held.some((loan) => loan.bookId === book.id),
    finesDue: num(student.finesDue),
    blockOnFines: settings.blockBorrowWhenFinesDue,
  });
  const due = addDays(new Date(), settings.loanDurationDays);
  return {
    ok: !reason,
    error: reason,
    bookId: book.id,
    title: book.title,
    author: book.author,
    studentId: student.id,
    studentName: student.name,
    rollNo: student.rollNo,
    dueDate: due.toISOString(),
    availableCopies: book.availableCopies,
  };
}

export async function issueBook(input: {
  actor: SessionUser;
  bookId: string;
  rollNo?: string;
  ipAddress?: string | null;
}) {
  const settings = await getLibrarySettings();
  const borrower = await resolveBorrower(input.actor, { rollNo: input.rollNo });
  const db = getDb();

  try {
    const issued = await db.transaction(async (tx) => {
      await tx
        .update(loans)
        .set({ status: "OVERDUE" })
        .where(and(eq(loans.studentId, borrower.id), eq(loans.status, "ACTIVE"), sql`${loans.dueDate} < now()`));

      const [student] = await tx.select().from(students).where(eq(students.id, borrower.id)).for("update").limit(1);
      const [book] = await tx.select().from(books).where(eq(books.id, input.bookId)).for("update").limit(1);
      if (!student || !book) throw new DomainError("Student or book not found", 404);

      const held = await heldLoansForStudent(tx, student.id);
      const reason = borrowDenialReason({
        studentStatus: student.status,
        heldLoans: held.length,
        maxLoans: settings.maxLoansPerStudent,
        availableCopies: book.availableCopies,
        alreadyHoldsTitle: held.some((loan) => loan.bookId === book.id),
        finesDue: num(student.finesDue),
        blockOnFines: settings.blockBorrowWhenFinesDue,
      });
      if (reason) throw new DomainError(reason, 409);

      const claimed = takeCopy(book.availableCopies);
      if (!claimed.ok) throw new DomainError(claimed.reason, 409);

      const dueDate = addDays(new Date(), settings.loanDurationDays);
      const [loan] = await tx
        .insert(loans)
        .values({
          bookId: book.id,
          studentId: student.id,
          dueDate,
          status: "ACTIVE",
        })
        .returning();

      await tx
        .update(books)
        .set({ availableCopies: claimed.availableCopies, updatedAt: new Date() })
        .where(eq(books.id, book.id));
      await tx
        .update(students)
        .set({ activeLoansCount: held.length + 1 })
        .where(eq(students.id, student.id));
      await recordAudit(
        {
          userId: input.actor.id,
          action: "BOOK_ISSUED",
          entityType: "loan",
          entityId: loan.id,
          details: `${book.title} issued to ${student.rollNo}`,
          ipAddress: input.ipAddress,
        },
        tx,
      );

      return {
        loanId: loan.id,
        bookId: book.id,
        title: book.title,
        studentName: student.name,
        rollNo: student.rollNo,
        dueDate: dueDate.toISOString(),
        availableCopies: claimed.availableCopies,
      };
    });
    clearOverviewCache();
    return issued;
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError("This student already has an active loan for this book", 409);
    }
    throw error;
  }
}

export async function returnBook(input: { actor: SessionUser; loanId: string; ipAddress?: string | null }) {
  const settings = await getLibrarySettings();
  const db = getDb();
  const returned = await db.transaction(async (tx) => {
    const [loan] = await tx.select().from(loans).where(eq(loans.id, input.loanId)).for("update").limit(1);
    if (!loan) throw new DomainError("Loan not found", 404);
    if (input.actor.role === "STUDENT" && loan.studentId !== input.actor.studentId) {
      throw new DomainError("You can only return your own loans", 403);
    }
    if (loan.status === "RETURNED") throw new DomainError("This loan is already closed", 409);

    const [student] = await tx.select().from(students).where(eq(students.id, loan.studentId)).for("update").limit(1);
    const [book] = await tx.select().from(books).where(eq(books.id, loan.bookId)).for("update").limit(1);
    if (!student || !book) throw new DomainError("Loan references missing records", 404);

    const fine = computeFineAmount(loan.dueDate, settings.finePerDay);
    const returnedAt = new Date();
    await tx
      .update(loans)
      .set({ status: "RETURNED", returnedAt, fineAmount: fine.toFixed(2) })
      .where(eq(loans.id, loan.id));

    const availableCopies = restoreCopy(book.availableCopies, book.totalCopies);
    await tx.update(books).set({ availableCopies, updatedAt: new Date() }).where(eq(books.id, book.id));
    const held = await heldLoansForStudent(tx, student.id);
    await tx
      .update(students)
      .set({
        activeLoansCount: held.filter((item) => item.id !== loan.id).length,
        finesDue: (num(student.finesDue) + fine).toFixed(2),
      })
      .where(eq(students.id, student.id));
    await recordAudit(
      {
        userId: input.actor.id,
        action: "BOOK_RETURNED",
        entityType: "loan",
        entityId: loan.id,
        details: `${book.title} returned. Fine ₹${fine.toFixed(2)}`,
        ipAddress: input.ipAddress,
      },
      tx,
    );
    return {
      loanId: loan.id,
      title: book.title,
      fine,
      returnedAt: returnedAt.toISOString(),
      availableCopies,
    };
  });
  clearOverviewCache();
  return returned;
}

export async function renewBook(input: { actor: SessionUser; loanId: string; ipAddress?: string | null }) {
  const settings = await getLibrarySettings();
  const db = getDb();
  const renewed = await db.transaction(async (tx) => {
    await tx
      .update(loans)
      .set({ status: "OVERDUE" })
      .where(and(eq(loans.status, "ACTIVE"), sql`${loans.dueDate} < now()`));
    const [loan] = await tx.select().from(loans).where(eq(loans.id, input.loanId)).for("update").limit(1);
    if (!loan) throw new DomainError("Loan not found", 404);
    if (input.actor.role === "STUDENT" && loan.studentId !== input.actor.studentId) {
      throw new DomainError("You can only renew your own loans", 403);
    }
    const [student] = await tx.select().from(students).where(eq(students.id, loan.studentId)).limit(1);
    const [book] = await tx.select().from(books).where(eq(books.id, loan.bookId)).limit(1);
    if (!student || !book) throw new DomainError("Loan references missing records", 404);
    const reason = renewDenialReason({
      status: loan.status,
      dueDate: loan.dueDate,
      renewalCount: loan.renewalCount,
      renewalLimit: settings.renewalLimit,
      finesDue: num(student.finesDue),
    });
    if (reason) throw new DomainError(reason, 409);
    const dueDate = addDays(loan.dueDate, settings.renewalDurationDays);
    await tx
      .update(loans)
      .set({ dueDate, renewalCount: loan.renewalCount + 1, status: "ACTIVE" })
      .where(eq(loans.id, loan.id));
    await recordAudit(
      {
        userId: input.actor.id,
        action: "BOOK_RENEWED",
        entityType: "loan",
        entityId: loan.id,
        details: `${book.title} renewed until ${dueDate.toISOString()}`,
        ipAddress: input.ipAddress,
      },
      tx,
    );
    return {
      loanId: loan.id,
      title: book.title,
      dueDate: dueDate.toISOString(),
      renewalCount: loan.renewalCount + 1,
    };
  });
  clearOverviewCache();
  return renewed;
}
