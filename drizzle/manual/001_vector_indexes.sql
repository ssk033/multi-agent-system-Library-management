-- Run after Drizzle has created the tables.
CREATE EXTENSION IF NOT EXISTS vector;

CREATE INDEX IF NOT EXISTS books_embedding_hnsw
  ON books USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS policies_embedding_hnsw
  ON library_policies USING hnsw (embedding vector_cosine_ops);
