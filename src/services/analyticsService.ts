import { sql } from "drizzle-orm";
import { format, subMonths } from "date-fns";
import { getDb, resultRows } from "@/db";
import { num } from "@/lib/utils";
import type { SessionUser } from "@/types";
import { getLibrarySettings } from "@/services/settingsService";
import { listLoans, syncOverdue } from "@/services/loanService";

export interface OverviewPayload {
  cards: { id: string; label: string; value: string; hint: string }[];
  monthly: { month: string; issues: number; returns: number }[];
  categories: { category: string; count: number }[];
  popular: { title: string; author: string; borrowCount: number }[];
  acquisitions: { month: string; count: number }[];
  recentLoans: { id: string; title: string; borrower: string; status: string; dueDate: string }[];
  recentBooks: { id: string; title: string; author: string }[];
  dueSoon: { id: string; title: string; borrower: string; dueDate: string; status: string }[];
  agentEvents: { id: string; agent: string; message: string }[];
}

async function scalar(query: ReturnType<typeof sql>) {
  const db = getDb();
  const rows = resultRows<Record<string, unknown>>(await db.execute(query));
  const first = rows[0];
  if (!first) return 0;
  const value = Object.values(first)[0];
  return num(value as string | number | null);
}

function monthKeys() {
  return Array.from({ length: 6 }, (_, index) => format(subMonths(new Date(), 5 - index), "yyyy-MM"));
}

export async function getOverview(actor: SessionUser): Promise<OverviewPayload> {
  await syncOverdue();
  const settings = await getLibrarySettings();
  const months = monthKeys();
  const db = getDb();

  const monthlyRows = resultRows<{ month: string; issues: number; returns: number }>(
    await db.execute(sql`
      SELECT to_char(date_trunc('month', issued_at), 'YYYY-MM') AS month,
             count(*)::int AS issues,
             count(returned_at)::int AS returns
      FROM loans
      WHERE issued_at >= date_trunc('month', now()) - interval '5 months'
      GROUP BY 1
      ORDER BY 1
    `),
  );
  const monthly = months.map((month) => {
    const row = monthlyRows.find((item) => item.month === month);
    return { month, issues: num(row?.issues), returns: num(row?.returns) };
  });

  const categories = resultRows<{ category: string; count: number }>(
    await db.execute(sql`
      SELECT category, count(*)::int AS count
      FROM books
      GROUP BY category
      ORDER BY count DESC
    `),
  ).map((row) => ({ category: row.category, count: num(row.count) }));

  const popular = resultRows<{ title: string; author: string; borrow_count: number }>(
    await db.execute(sql`
      SELECT b.title, b.author, count(l.id)::int AS borrow_count
      FROM loans l
      JOIN books b ON b.id = l.book_id
      GROUP BY b.id, b.title, b.author
      ORDER BY borrow_count DESC
      LIMIT 6
    `),
  ).map((row) => ({ title: row.title, author: row.author, borrowCount: num(row.borrow_count) }));

  const acquisitionRows = resultRows<{ month: string; count: number }>(
    await db.execute(sql`
      SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, count(*)::int AS count
      FROM acquisition_requests
      GROUP BY 1
      ORDER BY 1
    `),
  );
  const acquisitions = months.map((month) => ({
    month,
    count: num(acquisitionRows.find((item) => item.month === month)?.count),
  }));

  const scope = actor.role === "STUDENT" ? sql`AND l.student_id = ${actor.studentId}::uuid` : sql``;
  const agentScope = actor.role === "STUDENT" ? sql`WHERE user_id = ${actor.id}::uuid` : sql``;
  const recentLoans = resultRows<{ id: string; title: string; borrower: string; status: string; due_date: string }>(
    await db.execute(sql`
      SELECT l.id, b.title, s.name AS borrower, l.status, l.due_date
      FROM loans l
      JOIN books b ON b.id = l.book_id
      JOIN students s ON s.id = l.student_id
      WHERE 1 = 1 ${scope}
      ORDER BY l.issued_at DESC
      LIMIT 6
    `),
  ).map((row) => ({ id: row.id, title: row.title, borrower: row.borrower, status: row.status, dueDate: new Date(row.due_date).toISOString() }));
  const recentBooks = resultRows<{ id: string; title: string; author: string }>(
    await db.execute(sql`SELECT id, title, author FROM books ORDER BY created_at DESC LIMIT 5`),
  );
  const dueSoon = resultRows<{ id: string; title: string; borrower: string; status: string; due_date: string }>(
    await db.execute(sql`
      SELECT l.id, b.title, s.name AS borrower, l.status, l.due_date
      FROM loans l
      JOIN books b ON b.id = l.book_id
      JOIN students s ON s.id = l.student_id
      WHERE l.status IN ('ACTIVE', 'OVERDUE') ${scope}
      ORDER BY l.due_date ASC
      LIMIT 6
    `),
  ).map((row) => ({ id: row.id, title: row.title, borrower: row.borrower, status: row.status, dueDate: new Date(row.due_date).toISOString() }));
  const agentEvents = resultRows<{ id: string; agent: string; message: string | null }>(
    await db.execute(sql`
      SELECT id, agent_name AS agent, output AS message
      FROM agent_execution_logs
      ${agentScope}
      ORDER BY created_at DESC
      LIMIT 5
    `),
  ).map((row) => ({ id: row.id, agent: row.agent, message: row.message || "Recorded" }));

  if (actor.role === "STUDENT") {
    const mine = await listLoans(actor);
    const held = mine.filter((loan) => loan.status !== "RETURNED");
    const overdue = held.filter((loan) => loan.status === "OVERDUE").length;
    const fines = scalar(sql`SELECT fines_due FROM students WHERE id = ${actor.studentId}::uuid`);
    return {
      cards: [
        { id: "mine", label: "Active loans", value: String(held.length), hint: "Currently on your account" },
        { id: "overdue", label: "Overdue loans", value: String(overdue), hint: "Return these to stop fines" },
        { id: "fines", label: "Outstanding fines", value: `₹${num(await fines).toFixed(2)}`, hint: `₹${settings.finePerDay} per overdue day` },
        { id: "books", label: "Total books", value: String(await scalar(sql`SELECT count(*) FROM books`)), hint: "Titles in the catalog" },
        { id: "copies", label: "Available copies", value: String(await scalar(sql`SELECT coalesce(sum(available_copies), 0) FROM books`)), hint: "Ready to issue" },
      ],
      monthly: [],
      categories,
      popular: [],
      acquisitions: [],
      recentLoans,
      recentBooks,
      dueSoon,
      agentEvents,
    };
  }

  const cards = [
    { id: "books", label: "Total books", value: String(await scalar(sql`SELECT count(*) FROM books`)), hint: "Distinct titles" },
    { id: "copies", label: "Available copies", value: String(await scalar(sql`SELECT coalesce(sum(available_copies), 0) FROM books`)), hint: "Ready to issue" },
    { id: "issued", label: "Active loans", value: String(await scalar(sql`SELECT count(*) FROM loans WHERE status IN ('ACTIVE', 'OVERDUE')`)), hint: "Active and overdue loans" },
    { id: "overdue", label: "Overdue loans", value: String(await scalar(sql`SELECT count(*) FROM loans WHERE status = 'OVERDUE'`)), hint: "Needs follow-up" },
    { id: "fines", label: "Outstanding fines", value: `₹${num(await scalar(sql`SELECT coalesce(sum(fines_due), 0) FROM students`)).toFixed(2)}`, hint: "Unpaid student balances" },
    { id: "acquisitions", label: "Pending acquisitions", value: String(await scalar(sql`SELECT count(*) FROM acquisition_requests WHERE status = 'PENDING'`)), hint: "Awaiting librarian review" },
    { id: "students", label: "Registered students", value: String(await scalar(sql`SELECT count(*) FROM students`)), hint: "Student profiles" },
  ];

  return { cards, monthly, categories, popular, acquisitions, recentLoans, recentBooks, dueSoon, agentEvents };
}

export async function getAnalytics() {
  const overview = await getOverview({
    id: "system",
    role: "ADMIN",
    studentId: null,
  });
  const db = getDb();
  const borrowers = resultRows<{ name: string; roll_no: string; loans: number }>(
    await db.execute(sql`
      SELECT s.name, s.roll_no, count(l.id)::int AS loans
      FROM students s
      LEFT JOIN loans l ON l.student_id = s.id
      GROUP BY s.id, s.name, s.roll_no
      ORDER BY loans DESC
      LIMIT 8
    `),
  ).map((row) => ({ name: row.name, rollNo: row.roll_no, loans: num(row.loans) }));

  const overdueTrend = resultRows<{ month: string; count: number }>(
    await db.execute(sql`
      SELECT to_char(date_trunc('month', due_date), 'YYYY-MM') AS month, count(*)::int AS count
      FROM loans
      WHERE status = 'OVERDUE' OR (returned_at IS NOT NULL AND returned_at > due_date)
      GROUP BY 1
      ORDER BY 1
    `),
  ).map((row) => ({ month: row.month, count: num(row.count) }));

  return { ...overview, borrowers, overdueTrend };
}
