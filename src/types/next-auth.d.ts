import type { DefaultSession } from "next-auth";
import type { UserRole } from "@/types";

declare module "next-auth" {
  interface User {
    role: UserRole;
    studentId: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: UserRole;
      studentId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: UserRole;
    studentId?: string | null;
  }
}
