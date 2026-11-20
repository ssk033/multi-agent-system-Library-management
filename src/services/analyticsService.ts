import { sql } from "drizzle-orm";
import { format, subMonths } from "date-fns";
import { getDb, resultRows } from "@/db";
import { DomainError } from "@/lib/errors";
import { num } from "@/lib/utils";
import type { SessionUser } from "@/types";
import { cachedOverview } from "@/services/overviewCache";

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

function monthKeys() {
  return Array.from({ length: 6 }, (_, index) => format(subMonths(new Date(), 5 - index), "yyyy-MM"));
}

function asList<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  if (typeof value === "string" && value.trim()) {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  }
  return [];
}

function stamp(value: string) {
  return new Date(value).toISOString();
}

export async function getOverview(actor: SessionUser): Promise<OverviewPayload> {
  const key = `${actor.role}:${actor.id}:${actor.studentId ?? ""}`;
  return cachedOverview(key, 12_000, () => loadOverview(actor));
}

async function loadOverview(actor: SessionUser): Promise<OverviewPayload> {
  const student = actor.role === "STUDENT";
  if (student && !actor.studentId) throw new DomainError("This account has no student profile", 403);
  const db = getDb();
  const months = monthKeys();
  const rows = resultRows<Record<string, unknown>>(await db.execute(student ? studentOverviewSql(actor.studentId!, actor.id) : staffOverviewSql()));
  const row = rows[0] ?? {};
  const finePerDay = num(row.fine_per_day as string | number | null) || 5;
  const categories = asList<{ category: string; count: number }>(row.categories).map((item) => ({
    category: item.category,
    count: num(item.count),
  }));
  const recentLoans = asList<{ id: string; title: string; borrower: string; status: string; dueDate: string }>(row.recent_loans).map((item) => ({
    ...item,
    dueDate: stamp(item.dueDate),
  }));
  const dueSoon = asList<{ id: string; title: string; borrower: string; status: string; dueDate: string }>(row.due_soon).map((item) => ({
    ...item,
    dueDate: stamp(item.dueDate),
  }));
  const recentBooks = asList<{ id: string; title: string; author: string }>(row.recent_books);
  const agentEvents = asList<{ id: string; agent: string; message: string | null }>(row.agent_events).map((item) => ({
    id: item.id,
    agent: item.agent,
    message: item.message || "Recorded",
  }));

  if (student) {
    return {
      cards: [
        { id: "mine", label: "Active loans", value: String(num(row.held as string | number | null)), hint: "Currently on your account" },
        { id: "overdue", label: "Overdue loans", value: String(num(row.overdue as string | number | null)), hint: "Return these to stop fines" },
        { id: "fines", label: "Outstanding fines", value: `₹${num(row.fines as string | number | null).toFixed(2)}`, hint: `₹${finePerDay} per overdue day` },
        { id: "books", label: "Total books", value: String(num(row.books as string | number | null)), hint: "Titles in the catalog" },
        { id: "copies", label: "Available copies", value: String(num(row.copies as string | number | null)), hint: "Ready to issue" },
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

  const monthlyRows = asList<{ month: string; issues: number; returns: number }>(row.monthly);
  const acquisitionRows = asList<{ month: string; count: number }>(row.acquisitions);
  return {
    cards: [
      { id: "books", label: "Total books", value: String(num(row.books as string | number | null)), hint: "Distinct titles" },
      { id: "copies", label: "Available copies", value: String(num(row.copies as string | number | null)), hint: "Ready to issue" },
      { id: "issued", label: "Active loans", value: String(num(row.issued as string | number | null)), hint: "Active and overdue loans" },
      { id: "overdue", label: "Overdue loans", value: String(num(row.overdue as string | number | null)), hint: "Needs follow-up" },
      { id: "fines", label: "Outstanding fines", value: `₹${num(row.fines as string | number | null).toFixed(2)}`, hint: "Unpaid student balances" },
      { id: "acquisitions", label: "Pending acquisitions", value: String(num(row.pending as string | number | null)), hint: "Awaiting librarian review" },
      { id: "students", label: "Registered students", value: String(num(row.students as string | number | null)), hint: "Student profiles" },
    ],
    monthly: months.map((month) => {
      const item = monthlyRows.find((entry) => entry.month === month);
      return { month, issues: num(item?.issues), returns: num(item?.returns) };
    }),
    categories,
    popular: asList<{ title: string; author: string; borrowCount: number }>(row.popular).map((item) => ({
      title: item.title,
      author: item.author,
      borrowCount: num(item.borrowCount),
    })),
    acquisitions: months.map((month) => ({
      month,
      count: num(acquisitionRows.find((item) => item.month === month)?.count),
    })),
    recentLoans,
    recentBooks,
    dueSoon,
    agentEvents,
  };
}

function studentOverviewSql(studentId: string, userId: string) {
  return sql`
    WITH flipped AS (
      UPDATE loans SET status = 'OVERDUE'
      WHERE status = 'ACTIVE' AND due_date < now()
      RETURNING id
    )
    SELECT
      (SELECT count(*) FROM flipped) AS flipped_count,
      (SELECT coalesce(max(setting_value), '5') FROM library_settings WHERE setting_key = 'fine_per_day') AS fine_per_day,
      (SELECT count(*) FROM loans WHERE student_id = ${studentId}::uuid AND status IN ('ACTIVE', 'OVERDUE')) AS held,
      (SELECT count(*) FROM loans WHERE student_id = ${studentId}::uuid AND status = 'OVERDUE') AS overdue,
      (SELECT fines_due FROM students WHERE id = ${studentId}::uuid) AS fines,
      (SELECT count(*) FROM books) AS books,
      (SELECT coalesce(sum(available_copies), 0) FROM books) AS copies,
      (SELECT coalesce(json_agg(json_build_object('category', category, 'count', title_count) ORDER BY title_count DESC), '[]'::json)
       FROM (SELECT category, count(*)::int AS title_count FROM books GROUP BY category) categories) AS categories,
      (SELECT coalesce(json_agg(json_build_object('id', id, 'title', title, 'borrower', borrower, 'status', status, 'dueDate', due_date)), '[]'::json)
       FROM (
         SELECT l.id, b.title, s.name AS borrower, l.status, l.due_date
         FROM loans l
         JOIN books b ON b.id = l.book_id
         JOIN students s ON s.id = l.student_id
         WHERE l.student_id = ${studentId}::uuid
         ORDER BY l.issued_at DESC
         LIMIT 6
       ) recent) AS recent_loans,
      (SELECT coalesce(json_agg(json_build_object('id', id, 'title', title, 'author', author)), '[]'::json)
       FROM (SELECT id, title, author FROM books ORDER BY created_at DESC LIMIT 5) added) AS recent_books,
      (SELECT coalesce(json_agg(json_build_object('id', id, 'title', title, 'borrower', borrower, 'status', status, 'dueDate', due_date)), '[]'::json)
       FROM (
         SELECT l.id, b.title, s.name AS borrower, l.status, l.due_date
         FROM loans l
         JOIN books b ON b.id = l.book_id
         JOIN students s ON s.id = l.student_id
         WHERE l.student_id = ${studentId}::uuid AND l.status IN ('ACTIVE', 'OVERDUE')
         ORDER BY l.due_date ASC
         LIMIT 6
       ) due) AS due_soon,
      (SELECT coalesce(json_agg(json_build_object('id', id, 'agent', agent, 'message', message)), '[]'::json)
       FROM (
         SELECT id, agent_name AS agent, left(coalesce(output, 'Recorded'), 180) AS message
         FROM agent_execution_logs
         WHERE user_id = ${userId}::uuid
         ORDER BY created_at DESC
         LIMIT 5
       ) agents) AS agent_events
  `;
}

function staffOverviewSql() {
  return sql`
    WITH flipped AS (
      UPDATE loans SET status = 'OVERDUE'
      WHERE status = 'ACTIVE' AND due_date < now()
      RETURNING id
    )
    SELECT
      (SELECT count(*) FROM flipped) AS flipped_count,
      (SELECT coalesce(max(setting_value), '5') FROM library_settings WHERE setting_key = 'fine_per_day') AS fine_per_day,
      (SELECT count(*) FROM books) AS books,
      (SELECT coalesce(sum(available_copies), 0) FROM books) AS copies,
      (SELECT count(*) FROM loans WHERE status IN ('ACTIVE', 'OVERDUE')) AS issued,
      (SELECT count(*) FROM loans WHERE status = 'OVERDUE') AS overdue,
      (SELECT coalesce(sum(fines_due), 0) FROM students) AS fines,
      (SELECT count(*) FROM acquisition_requests WHERE status = 'PENDING') AS pending,
      (SELECT count(*) FROM students) AS students,
      (SELECT coalesce(json_agg(json_build_object('category', category, 'count', title_count) ORDER BY title_count DESC), '[]'::json)
       FROM (SELECT category, count(*)::int AS title_count FROM books GROUP BY category) categories) AS categories,
      (SELECT coalesce(json_agg(json_build_object('month', month, 'issues', issues, 'returns', returns) ORDER BY month), '[]'::json)
       FROM (
         SELECT to_char(date_trunc('month', issued_at), 'YYYY-MM') AS month,
                count(*)::int AS issues,
                count(returned_at)::int AS returns
         FROM loans
         WHERE issued_at >= date_trunc('month', now()) - interval '5 months'
         GROUP BY 1
       ) months) AS monthly,
      (SELECT coalesce(json_agg(json_build_object('title', title, 'author', author, 'borrowCount', borrow_count)), '[]'::json)
       FROM (
         SELECT b.title, b.author, count(l.id)::int AS borrow_count
         FROM loans l
         JOIN books b ON b.id = l.book_id
         GROUP BY b.id, b.title, b.author
         ORDER BY borrow_count DESC
         LIMIT 6
       ) popular) AS popular,
      (SELECT coalesce(json_agg(json_build_object('month', month, 'count', count) ORDER BY month), '[]'::json)
       FROM (
         SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS month, count(*)::int AS count
         FROM acquisition_requests
         GROUP BY 1
       ) acquired) AS acquisitions,
      (SELECT coalesce(json_agg(json_build_object('id', id, 'title', title, 'borrower', borrower, 'status', status, 'dueDate', due_date)), '[]'::json)
       FROM (
         SELECT l.id, b.title, s.name AS borrower, l.status, l.due_date
         FROM loans l
         JOIN books b ON b.id = l.book_id
         JOIN students s ON s.id = l.student_id
         ORDER BY l.issued_at DESC
         LIMIT 6
       ) recent) AS recent_loans,
      (SELECT coalesce(json_agg(json_build_object('id', id, 'title', title, 'author', author)), '[]'::json)
       FROM (SELECT id, title, author FROM books ORDER BY created_at DESC LIMIT 5) added) AS recent_books,
      (SELECT coalesce(json_agg(json_build_object('id', id, 'title', title, 'borrower', borrower, 'status', status, 'dueDate', due_date)), '[]'::json)
       FROM (
         SELECT l.id, b.title, s.name AS borrower, l.status, l.due_date
         FROM loans l
         JOIN books b ON b.id = l.book_id
         JOIN students s ON s.id = l.student_id
         WHERE l.status IN ('ACTIVE', 'OVERDUE')
         ORDER BY l.due_date ASC
         LIMIT 6
       ) due) AS due_soon,
      (SELECT coalesce(json_agg(json_build_object('id', id, 'agent', agent, 'message', message)), '[]'::json)
       FROM (
         SELECT id, agent_name AS agent, left(coalesce(output, 'Recorded'), 180) AS message
         FROM agent_execution_logs
         ORDER BY created_at DESC
         LIMIT 5
       ) agents) AS agent_events
  `;
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
