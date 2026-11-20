import type { UserRole } from "@/types";

export type Permission =
  | "assistant"
  | "catalog.read"
  | "catalog.write"
  | "students.read"
  | "students.write"
  | "loans.read.all"
  | "loans.read.own"
  | "loans.manage"
  | "acquisitions.read"
  | "acquisitions.decide"
  | "analytics"
  | "agents"
  | "policies.read"
  | "policies.write"
  | "settings"
  | "audit"
  | "users.manage";

const MATRIX: Record<UserRole, Permission[]> = {
  STUDENT: ["assistant", "catalog.read", "loans.read.own", "policies.read"],
  LIBRARIAN: [
    "assistant",
    "catalog.read",
    "catalog.write",
    "students.read",
    "students.write",
    "loans.read.all",
    "loans.manage",
    "acquisitions.read",
    "acquisitions.decide",
    "analytics",
    "policies.read",
  ],
  ADMIN: [
    "assistant",
    "catalog.read",
    "catalog.write",
    "students.read",
    "students.write",
    "loans.read.all",
    "loans.manage",
    "acquisitions.read",
    "acquisitions.decide",
    "analytics",
    "agents",
    "policies.read",
    "policies.write",
    "settings",
    "audit",
    "users.manage",
  ],
};

export function can(role: UserRole, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export function canAccessPath(role: UserRole, pathname: string): boolean {
  if (pathname.startsWith("/settings") || pathname.startsWith("/api/settings") || pathname.startsWith("/api/audit")) {
    return can(role, "settings") || can(role, "audit");
  }
  if (pathname.startsWith("/agents") || pathname.startsWith("/api/agent-logs")) {
    return can(role, "agents");
  }
  if (pathname.startsWith("/students") || pathname.startsWith("/api/students")) {
    return can(role, "students.read");
  }
  if (pathname.startsWith("/returns")) return can(role, "loans.manage");
  if (pathname.startsWith("/acquisitions") || pathname.startsWith("/api/acquisitions")) {
    return can(role, "acquisitions.read");
  }
  if (pathname.startsWith("/analytics") || pathname.startsWith("/api/analytics")) {
    return can(role, "analytics");
  }
  if (pathname.startsWith("/api/policies")) return can(role, "policies.read");
  return true;
}

export function assertAgentMayApprove(input: {
  role: UserRole;
  explicitLibrarianAction: boolean;
}): void {
  if (!input.explicitLibrarianAction || (input.role !== "LIBRARIAN" && input.role !== "ADMIN")) {
    throw new Error(
      "Acquisition approval requires an authenticated librarian action in the dashboard. The assistant cannot approve purchases.",
    );
  }
}
