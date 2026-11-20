import { api, ok, requirePermission } from "@/lib/api";
import { getAgentActivity } from "@/services/agentLogService";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  await requirePermission("agents");
  return ok(await getAgentActivity());
});
