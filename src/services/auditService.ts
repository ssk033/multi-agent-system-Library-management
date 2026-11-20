import { auditActionEnum, auditLogs } from "@/db/schema";
import { getDb, type LibraryTx } from "@/db";

type AuditAction = (typeof auditActionEnum.enumValues)[number];

export async function recordAudit(
  entry: {
    userId?: string | null;
    action: AuditAction;
    entityType: string;
    entityId?: string | null;
    details?: string | null;
    ipAddress?: string | null;
  },
  tx?: Pick<LibraryTx, "insert">,
) {
  const executor = tx ?? getDb();
  await executor.insert(auditLogs).values({
    userId: entry.userId ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    details: entry.details ?? null,
    ipAddress: entry.ipAddress ?? null,
  });
}
