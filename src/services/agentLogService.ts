import { desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { agentExecutionLogs } from "@/db/schema";
import type { AgentTraceEvent } from "@/types";

export async function saveAgentTraces(input: {
  sessionId: string;
  userId: string;
  traces: AgentTraceEvent[];
  userText: string;
}) {
  if (input.traces.length === 0) return;
  const db = getDb();
  await db.insert(agentExecutionLogs).values(
    input.traces.map((trace) => ({
      sessionId: input.sessionId,
      agentName: trace.agent === "system" ? "supervisor" : trace.agent,
      action: trace.type,
      input: input.userText.slice(0, 500),
      output: trace.message.slice(0, 1000),
      toolsUsed: trace.data?.tool ? JSON.stringify([trace.data.tool]) : null,
      durationMs: trace.duration ?? null,
      status: trace.type === "error" ? "error" : "success",
      errorMessage: trace.type === "error" ? trace.message : null,
      userId: input.userId,
    })),
  );
}

export async function getAgentActivity() {
  const db = getDb();
  const recent = await db
    .select()
    .from(agentExecutionLogs)
    .orderBy(desc(agentExecutionLogs.createdAt))
    .limit(80);

  const counts = new Map<string, { total: number; success: number; failed: number; duration: number; durationCount: number }>();
  for (const row of recent) {
    const current = counts.get(row.agentName) ?? { total: 0, success: 0, failed: 0, duration: 0, durationCount: 0 };
    current.total += 1;
    if (row.status === "error") current.failed += 1;
    else current.success += 1;
    if (row.durationMs) {
      current.duration += row.durationMs;
      current.durationCount += 1;
    }
    counts.set(row.agentName, current);
  }

  const all = await db.select().from(agentExecutionLogs);
  const total = all.length;
  const successful = all.filter((row) => row.status !== "error").length;
  const failed = total - successful;
  const durations = all.map((row) => row.durationMs).filter((value): value is number => typeof value === "number");
  const average = durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0;

  return {
    total,
    successful,
    failed,
    averageDurationMs: average,
    byAgent: Array.from(counts.entries()).map(([agent, stats]) => ({
      agent,
      ...stats,
      averageDurationMs: stats.durationCount ? Math.round(stats.duration / stats.durationCount) : 0,
    })),
    recent: recent.map((row) => ({
      id: row.id,
      sessionId: row.sessionId,
      agentName: row.agentName,
      action: row.action,
      output: row.output,
      toolsUsed: row.toolsUsed ? (JSON.parse(row.toolsUsed) as string[]) : [],
      durationMs: row.durationMs,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    })),
  };
}

export async function listAudit(limit = 50) {
  const { auditLogs, users } = await import("@/db/schema");
  const db = getDb();
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      entityType: auditLogs.entityType,
      details: auditLogs.details,
      createdAt: auditLogs.createdAt,
      userName: users.name,
      email: users.email,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.userId, users.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}
