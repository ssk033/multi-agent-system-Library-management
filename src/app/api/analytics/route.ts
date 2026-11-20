import { api, ok, requirePermission } from "@/lib/api";
import { getAnalytics, getOverview } from "@/services/analyticsService";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const user = await requirePermission("analytics");
  const view = new URL(request.url).searchParams.get("view");
  if (view === "full") return ok(await getAnalytics());
  return ok(await getOverview(user));
});
