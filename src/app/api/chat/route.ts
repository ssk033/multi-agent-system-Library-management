import { runTurn } from "@/agents/run";
import { api, parseBody, readJson, requirePermission } from "@/lib/api";
import { accountStillExists } from "@/lib/auth";
import { DomainError } from "@/lib/errors";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { chatSchema } from "@/lib/validations";
import { getSessionMessages, listChatSessions } from "@/services/chatService";

export const dynamic = "force-dynamic";

export const GET = api(async (request) => {
  const user = await requirePermission("assistant");
  const sessionId = new URL(request.url).searchParams.get("sessionId");
  if (sessionId) return Response.json({ ok: true, data: await getSessionMessages(sessionId, user.id) });
  return Response.json({ ok: true, data: await listChatSessions(user.id) });
});

export const POST = api(async (request) => {
  const user = await requirePermission("assistant");
  if (!(await accountStillExists(user.id))) {
    throw new DomainError("Your sign-in no longer matches the library database. Sign in again.", 401);
  }
  const limit = rateLimit(`chat:${user.id}:${clientIp(request)}`, 30, 60_000);
  if (!limit.ok) {
    return Response.json({ ok: false, error: "Too many assistant requests. Please wait a minute." }, { status: 429 });
  }
  const body = parseBody(chatSchema, await readJson(request));
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        for await (const event of runTurn({
          user,
          message: body.message,
          sessionId: body.sessionId,
          bookId: body.bookId,
          turnId: body.turnId,
          resume: body.resume,
          confirmation: body.confirmation,
        })) {
          send(event);
        }
      } catch (error) {
        console.error("Chat stream failed", error instanceof Error ? error.message : "unknown");
        send({ type: "error", message: "The library assistant could not complete that request." });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
