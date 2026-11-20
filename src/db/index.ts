import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { drizzle as drizzleNode, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool as PgPool } from "pg";
import ws from "ws";
import * as relations from "./relations";
import * as schema from "./schema";

const fullSchema = { ...schema, ...relations };

neonConfig.webSocketConstructor = ws;

let pool: { end: () => Promise<void> } | null = null;
let database: NodePgDatabase<typeof fullSchema> | null = null;

function isNeonUrl(url: string) {
  return /neon\.tech/i.test(url);
}

export function getDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Add your Neon connection string to .env.local.",
    );
  }
  if (!database) {
    if (isNeonUrl(url)) {
      const neonPool = new NeonPool({ connectionString: url });
      pool = neonPool;
      database = drizzleNeon(neonPool, { schema: fullSchema }) as NodePgDatabase<typeof fullSchema>;
    } else {
      const nodePool = new PgPool({ connectionString: url });
      pool = nodePool;
      database = drizzleNode(nodePool, { schema: fullSchema });
    }
  }
  return database;
}

export async function closeDb() {
  await pool?.end();
  pool = null;
  database = null;
}

export function resultRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray((result as { rows: unknown[] }).rows)
  ) {
    return (result as { rows: T[] }).rows;
  }
  return [];
}

export type Database = NodePgDatabase<typeof fullSchema>;
export type LibraryTx = Parameters<Parameters<Database["transaction"]>[0]>[0];
export { schema };
