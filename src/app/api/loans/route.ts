import { api, ok, requireUser } from "@/lib/api";
import { DomainError } from "@/lib/errors";
import { can } from "@/lib/permissions";
import { listLoans } from "@/services/loanService";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const user = await requireUser();
  if (!can(user.role, "loans.read.all") && !can(user.role, "loans.read.own")) {
    throw new DomainError("Forbidden", 403);
  }
  const status = new URL(request.url).searchParams.get("status");
  const allowed = status === "ACTIVE" || status === "RETURNED" || status === "OVERDUE" || status === "HELD" ? status : undefined;
  return ok(await listLoans(user, allowed ? { status: allowed } : undefined));
});
