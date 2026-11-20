import { and, asc, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { chatMessages, chatSessions } from "@/db/schema";
import { DomainError } from "@/lib/errors";
import type { AgentTraceEvent, BookCard, ConfirmationRequest } from "@/types";

export async function listChatSessions(userId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(chatSessions)
    .where(eq(chatSessions.userId, userId))
    .orderBy(desc(chatSessions.updatedAt))
    .limit(30);
  return rows.map((row) => ({
    id: row.id,
    title: row.title ?? "New conversation",
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function createChatSession(userId: string, title: string) {
  const db = getDb();
  const [session] = await db
    .insert(chatSessions)
    .values({ userId, title: title.slice(0, 80) })
    .returning();
  return session;
}

export async function getOwnedSession(sessionId: string, userId: string) {
  const db = getDb();
  const [session] = await db
    .select()
    .from(chatSessions)
    .where(and(eq(chatSessions.id, sessionId), eq(chatSessions.userId, userId)))
    .limit(1);
  if (!session) throw new DomainError("Conversation not found", 404);
  return session;
}

export async function touchSession(sessionId: string) {
  const db = getDb();
  await db.update(chatSessions).set({ updatedAt: new Date() }).where(eq(chatSessions.id, sessionId));
}

export async function addChatMessage(input: {
  sessionId: string;
  role: "user" | "assistant";
  content: string;
  traceEvents?: AgentTraceEvent[];
  metadata?: { books?: BookCard[]; confirmation?: ConfirmationRequest | null };
}) {
  const db = getDb();
  const [message] = await db
    .insert(chatMessages)
    .values({
      sessionId: input.sessionId,
      role: input.role,
      content: input.content,
      traceEvents: input.traceEvents ? JSON.stringify(input.traceEvents) : null,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    })
    .returning();
  return message;
}

export async function getSessionMessages(sessionId: string, userId: string) {
  await getOwnedSession(sessionId, userId);
  const db = getDb();
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(asc(chatMessages.createdAt));
  return rows.map((row) => ({
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content,
    createdAt: row.createdAt.toISOString(),
    traceEvents: row.traceEvents ? (JSON.parse(row.traceEvents) as AgentTraceEvent[]) : [],
    metadata: row.metadata
      ? (JSON.parse(row.metadata) as { books?: BookCard[]; confirmation?: ConfirmationRequest | null })
      : null,
  }));
}

export async function recentDialogue(sessionId: string) {
  const db = getDb();
  const rows = await db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.sessionId, sessionId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(8);
  return rows.reverse().map((row) => ({ role: row.role, content: row.content }));
}
