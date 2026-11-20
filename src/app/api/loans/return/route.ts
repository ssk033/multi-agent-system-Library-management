import { api, ok, parseBody, readJson, requireUser } from "@/lib/api";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { clientIp } from "@/lib/rate-limit";
import { loanActionSchema } from "@/lib/validations";
import { returnBook } from "@/services/loanService";

export const dynamic = "force-dynamic";

export const POST = api(async (request) => {
  const user = await requireUser();
  const allowed = user.role === "STUDENT" ? can(user.role, "loans.read.own") : can(user.role, "loans.manage");
  if (!allowed) throw new DomainError("Forbidden", 403);
  const body = parseBody(loanActionSchema, await readJson(request));
  return ok(await returnBook({ actor: user, loanId: body.loanId, ipAddress: clientIp(request) }));
});
