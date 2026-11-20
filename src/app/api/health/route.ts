import { ok, fail } from "@/lib/api";
import { geminiConfigured } from "@/lib/gemini";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    let database = false;
    if (process.env.DATABASE_URL) {
      const { getDb } = await import("@/db");
      const { sql } = await import("drizzle-orm");
      await getDb().execute(sql`select 1 as ok`);
      database = true;
    }
    return ok({ database, gemini: geminiConfigured() });
  } catch (error) {
    return fail(error);
  }
}
