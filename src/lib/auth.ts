import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { students, users } from "@/db/schema";
import { authConfig } from "@/lib/auth.config";
import { DomainError } from "@/lib/errors";
import { loginSchema } from "@/lib/validations";
import { recordAudit } from "@/services/auditService";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const db = getDb();
        const email = parsed.data.email.toLowerCase();
        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user) return null;

        const matches = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!matches) return null;

        let studentId: string | null = null;
        if (user.role === "STUDENT") {
          const [student] = await db.select().from(students).where(eq(students.userId, user.id)).limit(1);
          if (!student || student.status !== "ACTIVE") return null;
          studentId = student.id;
        }

        try {
          await recordAudit({
            userId: user.id,
            action: "USER_LOGIN",
            entityType: "user",
            entityId: user.id,
            details: "Successful sign-in",
          });
        } catch (error) {
          console.error("Failed to write login audit", error instanceof Error ? error.message : "unknown");
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          studentId,
        };
      },
    }),
  ],
});

const knownAccounts = new Map<string, number>();

export async function accountStillExists(userId: string) {
  const seen = knownAccounts.get(userId);
  if (seen && Date.now() - seen < 60_000) return true;
  const db = getDb();
  const [row] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1);
  if (!row) return false;
  knownAccounts.set(userId, Date.now());
  return true;
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) {
    throw new DomainError("Unauthorized", 401);
  }
  return session.user;
}
