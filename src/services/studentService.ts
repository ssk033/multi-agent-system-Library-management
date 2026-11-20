import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { students, users } from "@/db/schema";
import { DomainError } from "@/lib/errors";
import { isUniqueViolation, num } from "@/lib/utils";
import { recordAudit } from "@/services/auditService";

export async function listStudents() {
  const db = getDb();
  const rows = await db.select().from(students).orderBy(students.rollNo);
  return rows.map(serializeStudent);
}

export async function getStudentById(id: string) {
  const db = getDb();
  const [row] = await db.select().from(students).where(eq(students.id, id)).limit(1);
  if (!row) throw new DomainError("Student not found", 404);
  return row;
}

export async function getStudentByUserId(userId: string) {
  const db = getDb();
  const [row] = await db.select().from(students).where(eq(students.userId, userId)).limit(1);
  return row ?? null;
}

export async function getStudentByRoll(rollNo: string) {
  const db = getDb();
  const [row] = await db.select().from(students).where(eq(students.rollNo, rollNo.trim().toUpperCase())).limit(1);
  if (!row) throw new DomainError("No student was found for that roll number", 404);
  return row;
}

export function serializeStudent(row: typeof students.$inferSelect) {
  return {
    id: row.id,
    userId: row.userId,
    rollNo: row.rollNo,
    name: row.name,
    email: row.email,
    department: row.department,
    semester: row.semester,
    activeLoansCount: row.activeLoansCount,
    finesDue: num(row.finesDue),
    status: row.status,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function registerStudent(
  input: {
    name: string;
    email: string;
    password: string;
    rollNo: string;
    department?: string | null;
    semester?: number | null;
  },
  actorUserId: string | null,
) {
  const db = getDb();
  const email = input.email.toLowerCase();
  const rollNo = input.rollNo.trim().toUpperCase();
  const passwordHash = await bcrypt.hash(input.password, 10);
  try {
    return await db.transaction(async (tx) => {
      const [user] = await tx
        .insert(users)
        .values({ name: input.name, email, passwordHash, role: "STUDENT" })
        .returning();
      const [student] = await tx
        .insert(students)
        .values({
          userId: user.id,
          rollNo,
          name: input.name,
          email,
          department: input.department ?? null,
          semester: input.semester ?? null,
        })
        .returning();
      await recordAudit(
        {
          userId: actorUserId,
          action: "STUDENT_REGISTERED",
          entityType: "student",
          entityId: student.id,
          details: `${student.rollNo} ${student.name}`,
        },
        tx,
      );
      return serializeStudent(student);
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new DomainError("A student with this email or roll number already exists", 409);
    }
    throw error;
  }
}

export async function updateStudentStatus(id: string, status: "ACTIVE" | "INACTIVE", actorUserId: string) {
  const db = getDb();
  const [updated] = await db.update(students).set({ status }).where(eq(students.id, id)).returning();
  if (!updated) throw new DomainError("Student not found", 404);
  await recordAudit({
    userId: actorUserId,
    action: "STUDENT_UPDATED",
    entityType: "student",
    entityId: id,
    details: `Status set to ${status}`,
  });
  return serializeStudent(updated);
}

export async function listStaffUsers() {
  const db = getDb();
  return db.select({
    id: users.id,
    name: users.name,
    email: users.email,
    role: users.role,
    createdAt: users.createdAt,
  }).from(users).orderBy(users.createdAt);
}

export async function createStaffUser(
  input: { name: string; email: string; password: string; role: "LIBRARIAN" | "ADMIN" },
  actorUserId: string,
) {
  const db = getDb();
  const passwordHash = await bcrypt.hash(input.password, 10);
  try {
    const [user] = await db
      .insert(users)
      .values({
        name: input.name,
        email: input.email.toLowerCase(),
        passwordHash,
        role: input.role,
      })
      .returning();
    await recordAudit({
      userId: actorUserId,
      action: "STUDENT_UPDATED",
      entityType: "user",
      entityId: user.id,
      details: `Created ${user.role} account ${user.email}`,
    });
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  } catch (error) {
    if (isUniqueViolation(error)) throw new DomainError("That email is already registered", 409);
    throw error;
  }
}

export async function updateUserRole(userId: string, role: "LIBRARIAN" | "ADMIN", actorUserId: string) {
  const db = getDb();
  const [current] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!current) throw new DomainError("User not found", 404);
  if (current.role === "STUDENT") {
    throw new DomainError("Student accounts keep the student role. Change their library status instead.");
  }
  if (current.role === "ADMIN" && role !== "ADMIN") {
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "ADMIN"));
    if (admins.length <= 1) throw new DomainError("The last administrator cannot be demoted");
  }
  const [updated] = await db.update(users).set({ role, updatedAt: new Date() }).where(eq(users.id, userId)).returning();
  await recordAudit({
    userId: actorUserId,
    action: "STUDENT_UPDATED",
    entityType: "user",
    entityId: userId,
    details: `Role changed to ${role}`,
  });
  return { id: updated.id, name: updated.name, email: updated.email, role: updated.role };
}
