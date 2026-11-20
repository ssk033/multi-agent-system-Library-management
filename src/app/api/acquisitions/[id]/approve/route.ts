import { api, ok, parseBody, readJson, requirePermission } from "@/lib/api";
import { decisionSchema } from "@/lib/validations";
import { approveAcquisition } from "@/services/acquisitionService";

export const dynamic = "force-dynamic";

export const POST = api(async (request, context) => {
  const user = await requirePermission("acquisitions.decide");
  const { id } = await context.params;
  const body = parseBody(decisionSchema, await readJson(request));
  return ok(await approveAcquisition(id, user, body.comment ?? ""));
});
