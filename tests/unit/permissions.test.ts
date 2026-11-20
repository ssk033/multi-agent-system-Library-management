import { describe, expect, it } from "vitest";
import { assertAgentMayApprove, can, canAccessPath } from "@/lib/permissions";
import { confirmationMatches } from "@/lib/confirmation";

describe("role permissions", () => {
  it("lets students use the assistant and their own loans only", () => {
    expect(can("STUDENT", "assistant")).toBe(true);
    expect(can("STUDENT", "loans.read.own")).toBe(true);
    expect(can("STUDENT", "loans.manage")).toBe(false);
    expect(can("STUDENT", "acquisitions.decide")).toBe(false);
    expect(can("STUDENT", "agents")).toBe(false);
    expect(canAccessPath("STUDENT", "/settings")).toBe(false);
    expect(canAccessPath("STUDENT", "/assistant")).toBe(true);
  });

  it("lets librarians review acquisitions but not agent monitoring", () => {
    expect(can("LIBRARIAN", "acquisitions.decide")).toBe(true);
    expect(can("LIBRARIAN", "catalog.write")).toBe(true);
    expect(can("LIBRARIAN", "agents")).toBe(false);
    expect(canAccessPath("LIBRARIAN", "/agents")).toBe(false);
  });

  it("gives administrators settings, audit, and agent monitoring", () => {
    expect(can("ADMIN", "settings")).toBe(true);
    expect(can("ADMIN", "audit")).toBe(true);
    expect(canAccessPath("ADMIN", "/api/agent-logs")).toBe(true);
  });

  it("refuses assistant approval unless a librarian explicitly acts", () => {
    expect(() => assertAgentMayApprove({ role: "ADMIN", explicitLibrarianAction: false })).toThrow(/dashboard/i);
    expect(() => assertAgentMayApprove({ role: "STUDENT", explicitLibrarianAction: true })).toThrow(/dashboard/i);
    expect(() => assertAgentMayApprove({ role: "LIBRARIAN", explicitLibrarianAction: true })).not.toThrow();
  });
});

describe("confirmation matching", () => {
  const confirmation = {
    id: "1",
    action: "issue_book" as const,
    message: "Issue it?",
    confirmed: true,
    data: { bookId: "book-1" },
  };

  it("accepts only a confirmed action for the same book", () => {
    expect(confirmationMatches(confirmation, "issue_book", { bookId: "book-1" })).toBe(true);
    expect(confirmationMatches(confirmation, "issue_book", { bookId: "book-2" })).toBe(false);
    expect(confirmationMatches({ ...confirmation, confirmed: false }, "issue_book", { bookId: "book-1" })).toBe(false);
  });
});
