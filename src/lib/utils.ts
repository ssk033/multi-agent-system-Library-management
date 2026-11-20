import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { computeFineAmount, daysUntilDue } from "@/lib/library-rules";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: Date | string): string {
  const d = new Date(date);
  return d.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toFixed(2)}`;
}

export { daysUntilDue };

export function calculateFine(dueDate: Date | string, finePerDay: number, now = new Date()): number {
  return computeFineAmount(new Date(dueDate), finePerDay, now);
}

export function dueLabel(dueDate: Date | string, now = new Date()): string {
  const days = daysUntilDue(dueDate, now);
  if (days < 0) {
    const count = Math.abs(days);
    return `${count} day${count === 1 ? "" : "s"} overdue`;
  }
  if (days === 0) return "Due today";
  return `${days} day${days === 1 ? "" : "s"} remaining`;
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function num(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isUniqueViolation(error: unknown, depth = 0): boolean {
  if (!error || depth > 3) return false;
  if (typeof error === "object" && "code" in error && (error as { code?: string }).code === "23505") {
    return true;
  }
  const cause =
    typeof error === "object" && "cause" in error ? (error as { cause?: unknown }).cause : undefined;
  if (cause && cause !== error && isUniqueViolation(cause, depth + 1)) return true;
  return error instanceof Error && /duplicate key|unique constraint/i.test(error.message);
}
