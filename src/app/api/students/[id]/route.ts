import { api, ok, parseBody, readJson, requirePermission } from "@/lib/api";
import { studentStatusSchema, uuidSchema } from "@/lib/validations";
import { listLoans } from "@/services/loanService";
import { getStudentById, serializeStudent, updateStudentStatus } from "@/services/studentService";

export const dynamic = "force-dynamic";

export const GET = api(async (_request, context) => {
  const user = await requirePermission("students.read");
  const { id } = await context.params;
  uuidSchema.parse(id);
  const student = serializeStudent(await getStudentById(id));
  const loans = await listLoans({ ...user, role: "LIBRARIAN", studentId: student.id });
  return ok({ student, loans: loans.filter((loan) => loan.studentId === student.id) });
});

export const PATCH = api(async (request, context) => {
  const user = await requirePermission("students.write");
  const { id } = await context.params;
  const body = parseBody(studentStatusSchema, await readJson(request));
  return ok(await updateStudentStatus(id, body.status, user.id));
});
