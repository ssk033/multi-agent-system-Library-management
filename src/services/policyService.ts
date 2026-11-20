import { and, eq, sql } from "drizzle-orm";
import { getDb, resultRows } from "@/db";
import { libraryPolicies } from "@/db/schema";
import { geminiConfigured } from "@/lib/gemini";
import { contentHash, embedText, policyEmbeddingSource, toVectorLiteral } from "@/services/embeddingService";
import { getLibrarySettings } from "@/services/settingsService";
import { recordAudit } from "@/services/auditService";

export interface PolicyHit {
  id: string;
  policyName: string;
  policyContent: string;
  category: string | null;
  similarity?: number;
  matchType: "vector" | "keyword";
}

export async function listPolicies() {
  const db = getDb();
  return db
    .select({
      id: libraryPolicies.id,
      policyName: libraryPolicies.policyName,
      policyContent: libraryPolicies.policyContent,
      category: libraryPolicies.category,
      isActive: libraryPolicies.isActive,
      updatedAt: libraryPolicies.updatedAt,
    })
    .from(libraryPolicies)
    .where(eq(libraryPolicies.isActive, true))
    .orderBy(libraryPolicies.policyName);
}

export async function searchLibraryPolicies(query: string): Promise<PolicyHit[]> {
  const settings = await getLibrarySettings();
  if (geminiConfigured()) {
    try {
      const embedding = await embedText(query);
      const literal = toVectorLiteral(embedding);
      const db = getDb();
      const result = await db.execute(sql`
        SELECT id, policy_name, policy_content, category,
               1 - (embedding <=> ${literal}::vector) AS similarity
        FROM library_policies
        WHERE embedding IS NOT NULL AND is_active = true
        ORDER BY embedding <=> ${literal}::vector
        LIMIT 3
      `);
      const rows = resultRows<{
        id: string;
        policy_name: string;
        policy_content: string;
        category: string | null;
        similarity: number | string;
      }>(result)
        .map((row) => ({
          id: row.id,
          policyName: row.policy_name,
          policyContent: row.policy_content,
          category: row.category,
          similarity: Number(row.similarity),
          matchType: "vector" as const,
        }))
        .filter((row) => row.similarity >= settings.policySimilarityThreshold);
      if (rows.length > 0) return rows;
    } catch (error) {
      console.error("Policy vector search failed", error instanceof Error ? error.message : "unknown");
    }
  }

  const db = getDb();
  const safe = query.replace(/[%_]/g, " ").trim();
  const pattern = `%${safe.split(/\s+/).slice(0, 4).join("%")}%`;
  const rows = await db
    .select()
    .from(libraryPolicies)
    .where(and(eq(libraryPolicies.isActive, true), sql`${libraryPolicies.policyContent} ILIKE ${pattern} OR ${libraryPolicies.policyName} ILIKE ${pattern}`))
    .limit(3);
  return rows.map((row) => ({
    id: row.id,
    policyName: row.policyName,
    policyContent: row.policyContent,
    category: row.category,
    matchType: "keyword" as const,
  }));
}

export async function upsertPolicy(
  input: { id?: string; policyName: string; policyContent: string; category?: string | null },
  userId: string,
) {
  const db = getDb();
  const source = policyEmbeddingSource(input);
  const hash = contentHash(source);
  let embedding: number[] | null = null;
  let storedHash: string | null = null;
  if (geminiConfigured()) {
    try {
      embedding = await embedText(source);
      storedHash = hash;
    } catch (error) {
      console.error("Policy embedding failed", error instanceof Error ? error.message : "unknown");
    }
  }
  if (input.id) {
    const [updated] = await db
      .update(libraryPolicies)
      .set({
        policyName: input.policyName,
        policyContent: input.policyContent,
        category: input.category ?? null,
        embedding,
        contentHash: storedHash,
        updatedAt: new Date(),
      })
      .where(eq(libraryPolicies.id, input.id))
      .returning();
    await recordAudit({
      userId,
      action: "POLICY_UPDATED",
      entityType: "library_policy",
      entityId: updated.id,
      details: updated.policyName,
    });
    return updated;
  }
  const [created] = await db
    .insert(libraryPolicies)
    .values({
      policyName: input.policyName,
      policyContent: input.policyContent,
      category: input.category ?? null,
      embedding,
      contentHash: storedHash,
    })
    .returning();
  await recordAudit({
    userId,
    action: "POLICY_UPDATED",
    entityType: "library_policy",
    entityId: created.id,
    details: created.policyName,
  });
  return created;
}
