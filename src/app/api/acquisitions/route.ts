import { api, ok, parseBody, readJson, requirePermission, requireUser } from "@/lib/api";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { acquisitionCreateSchema } from "@/lib/validations";
import { createAcquisitionRequest, listAcquisitions } from "@/services/acquisitionService";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  await requirePermission("acquisitions.read");
  const status = new URL(request.url).searchParams.get("status");
  const allowed = status === "PENDING" || status === "APPROVED" || status === "REJECTED" ? status : undefined;
  return ok(await listAcquisitions(allowed));
});

export const POST = api(async (request) => {
  const user = await requireUser();
  if (!can(user.role, "assistant") && !can(user.role, "acquisitions.read")) {
    throw new DomainError("Forbidden", 403);
  }
  const body = parseBody(acquisitionCreateSchema, await readJson(request));
  return ok(
    await createAcquisitionRequest({
      actor: user,
      bookTitle: body.bookTitle,
      author: body.author,
      reason: body.reason,
      requestedByAgent: "user",
    }),
    201,
  );
});
