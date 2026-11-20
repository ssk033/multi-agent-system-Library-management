import { api, ok, parseBody, readJson, requirePermission } from "@/lib/api";
import { settingsSchema } from "@/lib/validations";
import { getLibrarySettings, saveLibrarySettings } from "@/services/settingsService";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  await requirePermission("settings");
  return ok(await getLibrarySettings());
});

export const PUT = api(async (request) => {
  const user = await requirePermission("settings");
  const body = parseBody(settingsSchema, await readJson(request));
  const current = await getLibrarySettings();
  await saveLibrarySettings({ ...current, ...body }, user.id);
  return ok(await getLibrarySettings());
});
