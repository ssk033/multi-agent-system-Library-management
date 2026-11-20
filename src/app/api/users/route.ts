import { z } from "zod";
import { api, ok, parseBody, readJson, requirePermission } from "@/lib/api";
import { staffUserSchema, uuidSchema } from "@/lib/validations";
import { createStaffUser, listStaffUsers, updateUserRole } from "@/services/studentService";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  await requirePermission("users.manage");
  return ok(await listStaffUsers());
});

export const POST = api(async (request) => {
  const user = await requirePermission("users.manage");
  const body = parseBody(staffUserSchema, await readJson(request));
  return ok(await createStaffUser(body, user.id), 201);
});

export const PATCH = api(async (request) => {
  const actor = await requirePermission("users.manage");
  const body = parseBody(
    z.object({ userId: uuidSchema, role: z.enum(["LIBRARIAN", "ADMIN"]) }),
    await readJson(request),
  );
  return ok(await updateUserRole(body.userId, body.role, actor.id));
});
