import { api, ok, parseBody, readJson, requirePermission } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { policySchema } from "@/lib/validations";
import { listPolicies, searchLibraryPolicies, upsertPolicy } from "@/services/policyService";
import { z } from "zod";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const user = await requireUser();
  if (!can(user.role, "policies.read")) throw new DomainError("Forbidden", 403);
  const query = new URL(request.url).searchParams.get("q");
  if (query) return ok(await searchLibraryPolicies(query));
  return ok(await listPolicies());
});

export const POST = api(async (request) => {
  const user = await requirePermission("policies.write");
  const body = parseBody(policySchema.extend({ id: z.string().uuid().optional() }), await readJson(request));
  return ok(await upsertPolicy(body, user.id));
});
