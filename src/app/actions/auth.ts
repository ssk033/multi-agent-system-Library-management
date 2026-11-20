"use server";

import { AuthError } from "next-auth";
import { signIn, signOut } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";

function errorText(error: unknown): string {
  const parts: string[] = [];
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const record = current as { message?: unknown; code?: unknown; cause?: unknown };
    if (typeof record.message === "string") parts.push(record.message);
    if (typeof record.code === "string") parts.push(record.code);
    current = record.cause;
  }
  return parts.join(" ");
}

function isRedirect(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    String((error as { digest?: unknown }).digest).startsWith("NEXT_REDIRECT")
  );
}

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const limit = rateLimit(`login:${email}`, 8, 10 * 60 * 1000);
  if (!limit.ok) return { error: "Too many sign-in attempts. Wait a few minutes and try again." };
  if (!process.env.DATABASE_URL) {
    return {
      error: "The database is not connected. Seeded accounts do not exist until DATABASE_URL is set and npm run db:seed has been run.",
    };
  }
  try {
    await signIn("credentials", { email, password, redirectTo: "/overview" });
  } catch (error) {
    if (isRedirect(error)) throw error;
    const text = errorText(error);
    if (/DATABASE_URL|ECONNREFUSED|connect/i.test(text)) {
      return { error: "The database is unreachable, so the seeded accounts cannot be checked." };
    }
    if (error instanceof AuthError) return { error: "Invalid email or password. Load the seed with npm run db:seed, then use one of the accounts below." };
    return { error: "Sign-in could not reach the account store." };
  }
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}
