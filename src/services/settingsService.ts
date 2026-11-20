import { eq } from "drizzle-orm";
import { getDb } from "@/db";
import { librarySettings } from "@/db/schema";
import type { LibrarySettings } from "@/types";

export interface RuntimeSettings extends LibrarySettings {
  blockBorrowWhenFinesDue: boolean;
  similarityThreshold: number;
  policySimilarityThreshold: number;
  semanticResultLimit: number;
}

const DEFAULTS: RuntimeSettings = {
  maxLoansPerStudent: 3,
  loanDurationDays: 14,
  finePerDay: 5,
  renewalLimit: 1,
  renewalDurationDays: 14,
  blockBorrowWhenFinesDue: true,
  similarityThreshold: Number(process.env.SIMILARITY_THRESHOLD ?? 0.55),
  policySimilarityThreshold: Number(process.env.POLICY_SIMILARITY_THRESHOLD ?? 0.4),
  semanticResultLimit: Number(process.env.SEMANTIC_RESULT_LIMIT ?? 5),
};

const KEYS: Record<keyof RuntimeSettings, string> = {
  maxLoansPerStudent: "max_loans_per_student",
  loanDurationDays: "loan_duration_days",
  finePerDay: "fine_per_day",
  renewalLimit: "max_renewals",
  renewalDurationDays: "renewal_duration_days",
  blockBorrowWhenFinesDue: "block_borrow_when_fines_due",
  similarityThreshold: "similarity_threshold",
  policySimilarityThreshold: "policy_similarity_threshold",
  semanticResultLimit: "semantic_result_limit",
};

export async function getLibrarySettings(): Promise<RuntimeSettings> {
  const db = getDb();
  const rows = await db.select().from(librarySettings);
  const map = new Map(rows.map((row) => [row.settingKey, row.settingValue]));
  const next = { ...DEFAULTS };
  (Object.keys(KEYS) as (keyof RuntimeSettings)[]).forEach((key) => {
    const raw = map.get(KEYS[key]);
    if (raw === undefined) return;
    if (key === "blockBorrowWhenFinesDue") {
      next[key] = raw === "true";
      return;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) next[key] = parsed;
  });
  return next;
}

export async function saveLibrarySettings(values: RuntimeSettings, userId: string) {
  const db = getDb();
  for (const key of Object.keys(KEYS) as (keyof RuntimeSettings)[]) {
    const settingKey = KEYS[key];
    const settingValue = String(values[key]);
    const [existing] = await db
      .select()
      .from(librarySettings)
      .where(eq(librarySettings.settingKey, settingKey))
      .limit(1);
    if (existing) {
      await db
        .update(librarySettings)
        .set({ settingValue, updatedAt: new Date() })
        .where(eq(librarySettings.settingKey, settingKey));
    } else {
      await db.insert(librarySettings).values({
        settingKey,
        settingValue,
        description: settingKey.replaceAll("_", " "),
      });
    }
  }
  const { recordAudit } = await import("@/services/auditService");
  await recordAudit({
    userId,
    action: "SETTINGS_UPDATED",
    entityType: "library_settings",
    details: "Library circulation settings updated",
  });
}

export const defaultSettings = DEFAULTS;
export const settingKeys = KEYS;
