import { api, ok, requireUser } from "@/lib/api";
import { listNotifications, markNotificationRead } from "@/services/notificationService";

export const dynamic = "force-dynamic";

export const GET = api(async () => {
  const user = await requireUser();
  return ok(await listNotifications(user.id));
});

export const POST = api(async (request) => {
  const user = await requireUser();
  const body = (await request.json()) as { id?: string };
  if (!body.id) return ok(await listNotifications(user.id));
  return ok(await markNotificationRead(body.id, user.id));
});
