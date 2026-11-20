import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { Command } from "@langchain/langgraph";
import type { AgentContext } from "@/agents/context";
import { getLibraryGraph, graphConfig } from "@/agents/graph";
import { fenceUserText } from "@/lib/response";
import type { AgentTraceEvent, BookCard, ConfirmationRequest, SessionUser, StreamEvent } from "@/types";
import { saveAgentTraces } from "@/services/agentLogService";
import { addChatMessage, createChatSession, getOwnedSession, recentDialogue, touchSession } from "@/services/chatService";

export interface TurnInput {
  user: SessionUser;
  message: string;
  sessionId?: string;
  bookId?: string;
  turnId?: string;
  resume?: { confirmed: boolean };
  confirmation?: {
    action: ConfirmationRequest["action"];
    data: Record<string, unknown>;
    message?: string;
  };
}

function contextFor(user: SessionUser, confirmation: ConfirmationRequest | null): AgentContext {
  return {
    userId: user.id,
    role: user.role,
    studentId: user.studentId,
    name: user.name ?? "Library user",
    email: user.email ?? "",
    confirmation,
    explicitLibrarianAction: false,
  };
}

const EXPIRED = "Your sign-in no longer matches the library database. Sign in again.";

function expiredSession(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  return /foreign key|chat_sessions_user_id|violates/i.test(message);
}

export async function* runTurn(input: TurnInput): AsyncGenerator<StreamEvent> {
  let session: Awaited<ReturnType<typeof createChatSession>>;
  try {
    session = input.sessionId
      ? await getOwnedSession(input.sessionId, input.user.id)
      : await createChatSession(input.user.id, input.message);
  } catch (error) {
    if (expiredSession(error)) {
      yield { type: "error", message: EXPIRED };
      return;
    }
    throw error;
  }
  const sessionId = session.id;
  const turnId = input.turnId ?? crypto.randomUUID();
  const text = fenceUserText(
    input.bookId ? `${input.message}\n\nSelected book id (chosen in the interface): ${input.bookId}` : input.message,
  );
  const confirmed: ConfirmationRequest | null = input.confirmation
    ? {
        id: crypto.randomUUID(),
        action: input.confirmation.action,
        data: input.confirmation.data,
        message: input.confirmation.message ?? "Confirmed.",
        confirmed: true,
      }
    : null;

  const graph = getLibraryGraph();
  const config = graphConfig(turnId, contextFor(input.user, confirmed));
  let mode: "resume" | "commit" | "fresh" = confirmed ? "commit" : "fresh";
  if (input.resume && input.turnId) {
    try {
      const snapshot = await graph.getState(config);
      const values = snapshot.values as { userText?: string };
      mode = values?.userText ? "resume" : confirmed ? "commit" : "fresh";
    } catch {
      mode = confirmed ? "commit" : "fresh";
    }
  }

  if (mode !== "resume") await addChatMessage({ sessionId, role: "user", content: text });
  const history =
    mode === "resume"
      ? []
      : (await recentDialogue(sessionId)).map((row) =>
          row.role === "assistant" ? new AIMessage(row.content) : new HumanMessage(row.content),
        );

  const collected: AgentTraceEvent[] = [];
  const seen = new Set<string>();
  let finalText = "";
  let cards: BookCard[] = [];
  let confirmation: ConfirmationRequest | null = null;

  const pushTrace = (trace: AgentTraceEvent) => {
    if (seen.has(trace.id)) return false;
    seen.add(trace.id);
    collected.push(trace);
    return true;
  };

  try {
    const streamInput =
      mode === "resume"
        ? new Command({ resume: { confirmed: input.resume?.confirmed === true } })
        : { userText: text, messages: history, confirmation: mode === "commit" ? confirmed : null };

    const stream = await graph.stream(streamInput, { ...config, streamMode: ["updates", "custom"] });
    for await (const chunk of stream) {
      const tuple = chunk as unknown;
      const modeName = Array.isArray(tuple) ? String(tuple[0]) : "updates";
      const data = Array.isArray(tuple) ? tuple[1] : tuple;

      if (modeName === "custom" && data && typeof data === "object") {
        const custom = data as { type?: string; trace?: AgentTraceEvent; text?: string };
        if (custom.type === "trace" && custom.trace && pushTrace(custom.trace)) {
          yield { type: "trace", trace: custom.trace };
        }
        if (custom.type === "token" && custom.text) {
          finalText += custom.text;
          yield { type: "token", text: custom.text };
        }
      }

      if (modeName === "updates" && data && typeof data === "object") {
        for (const update of Object.values(data as Record<string, { traces?: AgentTraceEvent[]; bookCards?: BookCard[]; confirmation?: ConfirmationRequest | null }>)) {
          for (const trace of update?.traces ?? []) {
            if (pushTrace(trace)) yield { type: "trace", trace };
          }
          if (update?.bookCards && update.bookCards.length > 0) {
            cards = update.bookCards;
            yield { type: "books", books: cards };
          }
          if (update?.confirmation && !update.confirmation.confirmed) {
            confirmation = update.confirmation;
            yield { type: "confirmation", confirmation };
          }
        }
      }
    }

    const snapshot = await graph.getState(config);
    const pending = snapshot.tasks.flatMap((task) => task.interrupts ?? []);
    if (pending.length > 0) {
      const value = pending[0]?.value as { confirmation?: ConfirmationRequest } | undefined;
      const interruptConfirmation = value?.confirmation ?? confirmation;
      if (interruptConfirmation) {
        await addChatMessage({
          sessionId,
          role: "assistant",
          content: interruptConfirmation.message,
          traceEvents: collected,
          metadata: { books: cards, confirmation: interruptConfirmation },
        });
        await saveAgentTraces({ sessionId, userId: input.user.id, traces: collected, userText: text });
        await touchSession(sessionId);
        yield { type: "interrupt", confirmation: interruptConfirmation, turnId, sessionId };
        yield { type: "done", message: interruptConfirmation.message, sessionId };
        return;
      }
    }

    const values = snapshot.values as { finalText?: string; bookCards?: BookCard[] };
    if (!finalText && values.finalText) {
      finalText = values.finalText;
      yield { type: "token", text: finalText };
    }
    if (values.bookCards && values.bookCards.length > 0) cards = values.bookCards;
    const message = finalText || "I could not complete that request.";
    await addChatMessage({
      sessionId,
      role: "assistant",
      content: message,
      traceEvents: collected,
      metadata: { books: cards, confirmation },
    });
    await saveAgentTraces({ sessionId, userId: input.user.id, traces: collected, userText: text });
    await touchSession(sessionId);
    yield { type: "done", message, sessionId };
  } catch (error) {
    console.error("Agent run failed", error instanceof Error ? error.message : "unknown");
    yield { type: "error", message: "The library assistant could not complete that request." };
  }
}
