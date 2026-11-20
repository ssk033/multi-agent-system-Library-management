import { api, ok, parseBody, readJson, requirePermission } from "@/lib/api";
import { studentCreateSchema } from "@/lib/validations";
import { listStudents, registerStudent } from "@/services/studentService";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  await requirePermission("students.read");
  return ok(await listStudents());
});

export const POST = api(async (request) => {
  const user = await requirePermission("students.write");
  const body = parseBody(studentCreateSchema, await readJson(request));
  return ok(await registerStudent(body, user.id), 201);
});
