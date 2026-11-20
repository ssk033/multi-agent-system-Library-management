import bcrypt from "bcryptjs";
import { sql } from "drizzle-orm";
import { getDb, closeDb } from "@/db";
import {
  acquisitionRequests,
  auditLogs,
  books,
  libraryPolicies,
  librarySettings,
  loans,
  notifications,
  students,
  users,
} from "@/db/schema";
import { BOOKS, POLICIES, STUDENTS } from "@/db/seed-data";
import { createVectorIndexes, enableVector } from "@/db/setup";
import { bookEmbeddingSource, contentHash, embedText, policyEmbeddingSource } from "@/services/embeddingService";
import { geminiConfigured } from "@/lib/gemini";
import { settingKeys, defaultSettings } from "@/services/settingsService";

function daysFromNow(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.SEED_ALLOW_PRODUCTION !== "true") {
    throw new Error("Refusing to seed while NODE_ENV=production. Set SEED_ALLOW_PRODUCTION=true to override.");
  }
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");

  await enableVector();
  const db = getDb();
  const ready = await db.execute(sql`select to_regclass('public.books') as name`);
  const rows = Array.isArray(ready) ? ready : "rows" in ready ? ready.rows : [];
  const exists = rows[0] && typeof rows[0] === "object" && "name" in rows[0] && rows[0].name;
  if (!exists) {
    throw new Error("Tables are missing. Run npm run db:push before npm run db:seed.");
  }

  await db.execute(sql`
    TRUNCATE TABLE
      chat_messages,
      chat_sessions,
      agent_execution_logs,
      notifications,
      audit_logs,
      acquisition_requests,
      loans,
      library_policies,
      library_settings,
      books,
      students,
      users
    RESTART IDENTITY CASCADE
  `);

  const studentPassword = await bcrypt.hash("Student@123", 10);
  const librarianPassword = await bcrypt.hash("Librarian@123", 10);
  const adminPassword = await bcrypt.hash("Admin@123", 10);

  const [librarian] = await db.insert(users).values({
    name: "Priya Menon",
    email: "librarian@library.edu",
    passwordHash: librarianPassword,
    role: "LIBRARIAN",
  }).returning();
  const [admin] = await db.insert(users).values({
    name: "Neel Kapoor",
    email: "admin@library.edu",
    passwordHash: adminPassword,
    role: "ADMIN",
  }).returning();

  const studentIds = new Map<string, string>();
  for (const student of STUDENTS) {
    const [user] = await db.insert(users).values({
      name: student.name,
      email: student.email,
      passwordHash: studentPassword,
      role: "STUDENT",
    }).returning();
    const [row] = await db.insert(students).values({
      userId: user.id,
      rollNo: student.rollNo,
      name: student.name,
      email: student.email,
      department: student.department,
      semester: student.semester,
      status: "status" in student ? student.status : "ACTIVE",
      activeLoansCount: 0,
      finesDue: "0.00",
    }).returning();
    studentIds.set(student.email, row.id);
  }

  const bookIds = new Map<string, string>();
  for (const book of BOOKS) {
    const [row] = await db.insert(books).values({ ...book }).returning();
    bookIds.set(book.isbn, row.id);
  }

  for (const key of Object.keys(settingKeys) as (keyof typeof settingKeys)[]) {
    await db.insert(librarySettings).values({
      settingKey: settingKeys[key],
      settingValue: String(defaultSettings[key]),
      description: key,
    });
  }

  for (const policy of POLICIES) {
    await db.insert(libraryPolicies).values(policy);
  }

  const loanPlan = [
    { email: "student@library.edu", isbn: "9781119800361", issuedDaysAgo: 3, dueInDays: 11, status: "ACTIVE" as const },
    { email: "student03@library.edu", isbn: "9780262035613", issuedDaysAgo: 4, dueInDays: 10, status: "ACTIVE" as const },
    { email: "student03@library.edu", isbn: "9780078022159", issuedDaysAgo: 6, dueInDays: 8, status: "ACTIVE" as const },
    { email: "student03@library.edu", isbn: "9780262046305", issuedDaysAgo: 2, dueInDays: 12, status: "ACTIVE" as const },
    { email: "student02@library.edu", isbn: "9780136681557", issuedDaysAgo: 5, dueInDays: 9, status: "ACTIVE" as const },
    { email: "student05@library.edu", isbn: "9780136681557", issuedDaysAgo: 20, dueInDays: -6, status: "OVERDUE" as const },
    { email: "student06@library.edu", isbn: "9780132126953", issuedDaysAgo: 18, dueInDays: -4, status: "OVERDUE" as const },
    { email: "student07@library.edu", isbn: "9780134794105", issuedDaysAgo: 1, dueInDays: 13, status: "ACTIVE" as const },
    { email: "student16@library.edu", isbn: "9780262510875", issuedDaysAgo: 2, dueInDays: 12, status: "ACTIVE" as const },
    { email: "student17@library.edu", isbn: "9781492040347", issuedDaysAgo: 8, dueInDays: 6, status: "ACTIVE" as const },
  ];

  for (const loan of loanPlan) {
    await db.insert(loans).values({
      bookId: bookIds.get(loan.isbn)!,
      studentId: studentIds.get(loan.email)!,
      issuedAt: daysFromNow(-loan.issuedDaysAgo),
      dueDate: daysFromNow(loan.dueInDays),
      status: loan.status,
      fineAmount: "0.00",
    });
  }

  await db.insert(loans).values({
    bookId: bookIds.get("9781449373320")!,
    studentId: studentIds.get("student04@library.edu")!,
    issuedAt: daysFromNow(-30),
    dueDate: daysFromNow(-16),
    returnedAt: daysFromNow(-12),
    status: "RETURNED",
    fineAmount: "20.00",
  });
  await db.insert(loans).values({
    bookId: bookIds.get("9780133943030")!,
    studentId: studentIds.get("student08@library.edu")!,
    issuedAt: daysFromNow(-21),
    dueDate: daysFromNow(-7),
    returnedAt: daysFromNow(-10),
    status: "RETURNED",
    fineAmount: "0.00",
  });

  const heldCounts = new Map<string, number>();
  for (const loan of loanPlan) heldCounts.set(loan.email, (heldCounts.get(loan.email) ?? 0) + 1);
  for (const [email, count] of heldCounts) {
    await db.execute(sql`update students set active_loans_count = ${count} where email = ${email}`);
  }
  await db.execute(sql`update students set fines_due = 20.00 where email = 'student04@library.edu'`);

  await db.insert(acquisitionRequests).values([
    {
      bookTitle: "Reinforcement Learning: An Introduction",
      author: "Richard S. Sutton, Andrew G. Barto",
      reason: "Students asked for a foundational reinforcement-learning text that is not in the catalog.",
      requestedByAgent: "acquisition",
      requestedByStudentId: studentIds.get("student@library.edu"),
      suggestedCategory: "Machine Learning",
      suggestedDeweyDecimal: "006.31",
      status: "PENDING",
    },
    {
      bookTitle: "Computer Networking: A Top-Down Approach",
      author: "James F. Kurose, Keith W. Ross",
      reason: "Both catalog copies are on loan. Additional copies are needed for the networks course.",
      requestedByAgent: "acquisition",
      requestedByStudentId: studentIds.get("student08@library.edu"),
      suggestedCategory: "Computer Networks",
      suggestedDeweyDecimal: "004.6",
      status: "PENDING",
    },
    {
      bookTitle: "Designing Machine Learning Systems",
      author: "Chip Huyen",
      reason: "Approved for the next purchase cycle after repeated student requests.",
      requestedByAgent: "acquisition",
      requestedByStudentId: studentIds.get("student09@library.edu"),
      suggestedCategory: "Machine Learning",
      suggestedDeweyDecimal: "006.31",
      status: "APPROVED",
      librarianComment: "Approved. Add the book to the catalog after the invoice is received.",
      reviewedBy: librarian.id,
      reviewedAt: daysFromNow(-2),
    },
    {
      bookTitle: "Cryptocurrency Trading Secrets",
      author: "Unknown",
      reason: "Requested as a general-interest purchase.",
      requestedByAgent: "acquisition",
      requestedByStudentId: studentIds.get("student03@library.edu"),
      status: "REJECTED",
      librarianComment: "Outside the engineering collection scope.",
      reviewedBy: librarian.id,
      reviewedAt: daysFromNow(-5),
    },
  ]);

  await db.insert(notifications).values([
    {
      userId: librarian.id,
      title: "Acquisition approval needed",
      message: "Reinforcement Learning: An Introduction is waiting for review.",
      type: "INFO",
      link: "/acquisitions",
    },
    {
      userId: admin.id,
      title: "Acquisition approval needed",
      message: "Additional copies of Computer Networking: A Top-Down Approach were requested.",
      type: "INFO",
      link: "/acquisitions",
    },
  ]);

  await db.insert(auditLogs).values({
    userId: admin.id,
    action: "SETTINGS_UPDATED",
    entityType: "library_settings",
    details: "Development seed loaded default circulation settings.",
  });

  let embeddedBooks = 0;
  let embeddedPolicies = 0;
  if (geminiConfigured()) {
    const bookRows = await db.select().from(books);
    for (const book of bookRows) {
      const source = bookEmbeddingSource(book);
      const embedding = await embedText(source);
      await db.update(books).set({ embedding, contentHash: contentHash(source) }).where(sql`${books.id} = ${book.id}`);
      embeddedBooks += 1;
    }
    const policyRows = await db.select().from(libraryPolicies);
    for (const policy of policyRows) {
      const source = policyEmbeddingSource(policy);
      const embedding = await embedText(source);
      await db.update(libraryPolicies).set({ embedding, contentHash: contentHash(source) }).where(sql`${libraryPolicies.id} = ${policy.id}`);
      embeddedPolicies += 1;
    }
  } else {
    console.log("GEMINI_API_KEY is not set. Seed data was inserted without embeddings.");
  }

  try {
    await createVectorIndexes();
  } catch (error) {
    console.log("Vector indexes were not created yet:", error instanceof Error ? error.message : error);
  }

  console.log(`Seed complete. Books embedded: ${embeddedBooks}. Policies embedded: ${embeddedPolicies}.`);
  console.log("Student: student@library.edu / Student@123");
  console.log("Librarian: librarian@library.edu / Librarian@123");
  console.log("Admin: admin@library.edu / Admin@123");
  await closeDb();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : error);
  await closeDb();
  process.exit(1);
});
