import { Pool as NeonPool, neonConfig } from "@neondatabase/serverless";
import { Pool as PgPool } from "pg";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

async function withPool<T>(fn: (pool: { query: (sql: string) => Promise<unknown>; end: () => Promise<void> }) => Promise<T>) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set.");
  const pool = /neon\.tech/i.test(url) ? new NeonPool({ connectionString: url }) : new PgPool({ connectionString: url });
  try {
    return await fn(pool);
  } finally {
    await pool.end();
  }
}

export async function enableVector() {
  await withPool(async (pool) => {
    await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
  });
}

export async function createVectorIndexes() {
  await withPool(async (pool) => {
    await pool.query("CREATE EXTENSION IF NOT EXISTS vector");
    await pool.query(
      "CREATE INDEX IF NOT EXISTS books_embedding_hnsw ON books USING hnsw (embedding vector_cosine_ops)",
    );
    await pool.query(
      "CREATE INDEX IF NOT EXISTS policies_embedding_hnsw ON library_policies USING hnsw (embedding vector_cosine_ops)",
    );
  });
}

const indexesOnly = process.argv.includes("--indexes");

if (process.argv[1] && process.argv[1].includes("setup.ts")) {
  const run = indexesOnly ? createVectorIndexes() : enableVector();
  run
    .then(() => {
      console.log(indexesOnly ? "Vector indexes are ready." : "pgvector extension is ready.");
    })
    .catch((error: unknown) => {
      console.error(error instanceof Error ? error.message : error);
      process.exit(1);
    });
}
