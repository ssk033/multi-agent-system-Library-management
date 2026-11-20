import { accountStillExists, requireUser } from "@/lib/auth";
import { api, ok } from "@/lib/api";
import { DomainError } from "@/lib/errors";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  const user = await requireUser();
  if (!(await accountStillExists(user.id))) {
    throw new DomainError("Your sign-in no longer matches the library database. Sign in again.", 401);
  }
  return ok({ id: user.id, role: user.role });
});
