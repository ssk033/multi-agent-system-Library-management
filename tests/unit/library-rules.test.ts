import { describe, expect, it } from "vitest";
import { borrowDenialReason, computeFineAmount, overdueDays, renewDenialReason, restoreCopy, takeCopy } from "@/lib/library-rules";

const day = 86_400_000;

describe("fine calculation", () => {
  const due = new Date("2026-01-10T00:00:00.000Z");

  it("charges nothing before the due timestamp", () => {
    expect(computeFineAmount(due, 5, new Date(due.getTime() - 60_000))).toBe(0);
  });

  it("counts a partial overdue day as one day", () => {
    expect(overdueDays(due, new Date(due.getTime() + 60 * 60 * 1000))).toBe(1);
    expect(computeFineAmount(due, 5, new Date(due.getTime() + 60 * 60 * 1000))).toBe(5);
  });

  it("charges five rupees for each overdue day", () => {
    expect(computeFineAmount(due, 5, new Date(due.getTime() + 4 * day))).toBe(20);
  });
});

describe("borrowing limits and availability", () => {
  const base = {
    studentStatus: "ACTIVE" as const,
    heldLoans: 1,
    maxLoans: 3,
    availableCopies: 2,
    alreadyHoldsTitle: false,
    finesDue: 0,
    blockOnFines: true,
  };

  it("allows an eligible student", () => {
    expect(borrowDenialReason(base)).toBeNull();
  });

  it("blocks inactive accounts, fines, duplicates, the limit, and empty stock", () => {
    expect(borrowDenialReason({ ...base, studentStatus: "INACTIVE" })).toMatch(/inactive/i);
    expect(borrowDenialReason({ ...base, finesDue: 20 })).toMatch(/fines/i);
    expect(borrowDenialReason({ ...base, alreadyHoldsTitle: true })).toMatch(/already/i);
    expect(borrowDenialReason({ ...base, heldLoans: 3 })).toMatch(/limit/i);
    expect(borrowDenialReason({ ...base, availableCopies: 0 })).toMatch(/no copies/i);
  });

  it("removes one copy and refuses the last copy", () => {
    expect(takeCopy(1)).toEqual({ ok: true, availableCopies: 0 });
    expect(takeCopy(0)).toEqual({ ok: false, reason: "No copies are available." });
  });

  it("restores a returned copy without exceeding the total", () => {
    expect(restoreCopy(1, 2)).toBe(2);
    expect(() => restoreCopy(2, 2)).toThrow(/total/i);
  });
});

describe("renewal rules", () => {
  const due = new Date("2026-02-01T00:00:00.000Z");
  const now = new Date("2026-01-20T00:00:00.000Z");

  it("allows one renewal before the due date when there is no fine", () => {
    expect(renewDenialReason({ status: "ACTIVE", dueDate: due, renewalCount: 0, renewalLimit: 1, finesDue: 0, now })).toBeNull();
  });

  it("rejects overdue, exhausted, and fined renewals", () => {
    expect(renewDenialReason({ status: "OVERDUE", dueDate: due, renewalCount: 0, renewalLimit: 1, finesDue: 0, now })).toMatch(/overdue/i);
    expect(renewDenialReason({ status: "ACTIVE", dueDate: due, renewalCount: 1, renewalLimit: 1, finesDue: 0, now })).toMatch(/limit/i);
    expect(renewDenialReason({ status: "ACTIVE", dueDate: due, renewalCount: 0, renewalLimit: 1, finesDue: 10, now })).toMatch(/fine/i);
  });
});
