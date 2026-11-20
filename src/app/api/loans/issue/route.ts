import { api, ok, parseBody, readJson, requireUser } from "@/lib/api";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { clientIp } from "@/lib/rate-limit";
import { loanIssueSchema } from "@/lib/validations";
import { issueBook } from "@/services/loanService";

export const dynamic = "force-dynamic";

export const POST = api(async (request) => {
  const user = await requireUser();
  const allowed = user.role === "STUDENT" ? can(user.role, "loans.read.own") : can(user.role, "loans.manage");
  if (!allowed) throw new DomainError("Forbidden", 403);
  const body = parseBody(loanIssueSchema, await readJson(request));
  return ok(
    await issueBook({
      actor: user,
      bookId: body.bookId,
      rollNo: user.role === "STUDENT" ? undefined : body.rollNo,
      ipAddress: clientIp(request),
    }),
    201,
  );
});
