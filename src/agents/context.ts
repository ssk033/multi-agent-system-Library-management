import type { UserRole, ConfirmationRequest } from "@/types";

export interface AgentContext {
  userId: string;
  role: UserRole;
  studentId: string | null;
  name: string;
  email: string;
  confirmation: ConfirmationRequest | null;
  explicitLibrarianAction: boolean;
}
