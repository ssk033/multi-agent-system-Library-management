import { api, ok, parseBody, readJson, requirePermission } from "@/lib/api";
import { catalogFromAcquisitionSchema } from "@/lib/validations";
import { catalogApprovedRequest } from "@/services/acquisitionService";

export const dynamic = "force-dynamic";

export const POST = api(async (request, context) => {
  const user = await requirePermission("catalog.write");
  const { id } = await context.params;
  const body = parseBody(catalogFromAcquisitionSchema, await readJson(request));
  return ok(await catalogApprovedRequest(id, user, body), 201);
});
