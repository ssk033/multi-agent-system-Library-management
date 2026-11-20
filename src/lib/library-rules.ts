export const MS_PER_DAY = 86_400_000;

export type HeldLoanStatus = "ACTIVE" | "OVERDUE";

export function overdueDays(dueDate: Date, now = new Date()): number {
  const diff = now.getTime() - dueDate.getTime();
  if (diff <= 0) return 0;
  return Math.ceil(diff / MS_PER_DAY);
}

export function daysUntilDue(dueDate: Date | string, now = new Date()): number {
  const due = new Date(dueDate);
  const diff = due.getTime() - now.getTime();
  if (diff >= 0) return Math.ceil(diff / MS_PER_DAY);
  return -Math.ceil(-diff / MS_PER_DAY);
}

export function computeFineAmount(dueDate: Date, finePerDay: number, now = new Date()): number {
  if (!Number.isFinite(finePerDay) || finePerDay < 0) {
    throw new Error("Fine per day must be a non-negative number");
  }
  return overdueDays(dueDate, now) * finePerDay;
}

export interface BorrowCheckInput {
  studentStatus: "ACTIVE" | "INACTIVE";
  heldLoans: number;
  maxLoans: number;
  availableCopies: number;
  alreadyHoldsTitle: boolean;
  finesDue: number;
  blockOnFines: boolean;
}

export function borrowDenialReason(input: BorrowCheckInput): string | null {
  if (input.studentStatus !== "ACTIVE") {
    return "This student account is inactive and cannot borrow books.";
  }
  if (input.blockOnFines && input.finesDue > 0) {
    return `Outstanding fines of ₹${input.finesDue.toFixed(2)} must be cleared before borrowing.`;
  }
  if (input.alreadyHoldsTitle) {
    return "This student already has this book on loan.";
  }
  if (input.heldLoans >= input.maxLoans) {
    return `The borrowing limit of ${input.maxLoans} books has been reached.`;
  }
  if (input.availableCopies <= 0) {
    return "No copies are available.";
  }
  return null;
}

export function renewDenialReason(input: {
  status: "ACTIVE" | "RETURNED" | "OVERDUE";
  dueDate: Date;
  renewalCount: number;
  renewalLimit: number;
  finesDue: number;
  now?: Date;
}): string | null {
  const now = input.now ?? new Date();
  if (input.status === "RETURNED") return "A returned loan cannot be renewed.";
  if (input.status === "OVERDUE" || input.dueDate.getTime() < now.getTime()) {
    return "Overdue books cannot be renewed. Return the book instead.";
  }
  if (input.finesDue > 0) return "Clear outstanding fines before renewing a loan.";
  if (input.renewalCount >= input.renewalLimit) {
    return `The renewal limit of ${input.renewalLimit} has been reached.`;
  }
  return null;
}

export function takeCopy(
  availableCopies: number,
): { ok: true; availableCopies: number } | { ok: false; reason: string } {
  if (availableCopies <= 0) return { ok: false, reason: "No copies are available." };
  return { ok: true, availableCopies: availableCopies - 1 };
}

export function restoreCopy(availableCopies: number, totalCopies: number): number {
  if (availableCopies >= totalCopies) {
    throw new Error("Available copies already match the catalog total.");
  }
  return availableCopies + 1;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
