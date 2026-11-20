import { api, ok, requirePermission } from "@/lib/api";
import { rebuildMissingEmbeddings } from "@/services/embeddingService";

export const dynamic = "force-dynamic";

export const POST = api(async () => {
  await requirePermission("settings");
  return ok(await rebuildMissingEmbeddings());
});
