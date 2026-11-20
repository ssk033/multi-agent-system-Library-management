import { api, ok, requirePermission } from "@/lib/api";
import { listAudit } from "@/services/agentLogService";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  await requirePermission("audit");
  return ok(await listAudit(80));
});
