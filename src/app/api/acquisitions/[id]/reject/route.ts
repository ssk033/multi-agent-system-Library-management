import { api, ok, parseBody, readJson, requirePermission } from "@/lib/api";
import { decisionSchema } from "@/lib/validations";
import { rejectAcquisition } from "@/services/acquisitionService";

export const dynamic = "force-dynamic";

export const POST = api(async (request, context) => {
  const user = await requirePermission("acquisitions.decide");
  const { id } = await context.params;
  const body = parseBody(decisionSchema, await readJson(request));
  return ok(await rejectAcquisition(id, user, body.comment ?? ""));
});
