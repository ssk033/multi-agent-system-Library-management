import { describe, expect, it } from "vitest";

const hasDatabase = Boolean(process.env.DATABASE_URL);

describe.skipIf(!hasDatabase)("database integration", () => {
  it("connects and reads the book catalog", async () => {
    const { getDb, closeDb } = await import("@/db");
    const { sql } = await import("drizzle-orm");
    const db = getDb();
    const result = await db.execute(sql`select count(*)::int as count from books`);
    const rows = Array.isArray(result) ? result : result.rows;
    expect(Number(rows[0]?.count ?? 0)).toBeGreaterThan(0);
    await closeDb();
  });
});
