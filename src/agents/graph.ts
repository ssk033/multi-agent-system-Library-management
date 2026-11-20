import { AIMessage, HumanMessage, SystemMessage } from "@langchain/core/messages";
import { END, interrupt, MemorySaver, START, StateGraph, type LangGraphRunnableConfig } from "@langchain/langgraph";
import { z } from "zod";
import type { AgentContext } from "@/agents/context";
import { FINAL_PROMPT, SUPERVISOR_PROMPT } from "@/agents/prompts";
import { runSpecialist } from "@/agents/runner";
import { LibraryAnnotation, type LibraryState } from "@/agents/state";
import { makeTrace } from "@/agents/trace";
import { geminiConfigured, getChatModel, messageText } from "@/lib/gemini";
import { errorMessage } from "@/lib/errors";
import { composeFallbackAnswer } from "@/lib/response";
import { planRoute, resolveRoute, type AgentName } from "@/lib/routing";
import type { SessionUser } from "@/types";
import { createAcquisitionRequest } from "@/services/acquisitionService";
import { issueBook, renewBook, returnBook } from "@/services/loanService";

const checkpointer = new MemorySaver();
type LibraryGraph = ReturnType<ReturnType<typeof buildLibraryGraph>["compile"]>;
let compiled: LibraryGraph | null = null;

function readContext(config: LangGraphRunnableConfig): AgentContext {
  const value = config.configurable?.agentContext;
  if (!value || typeof value !== "object") throw new Error("Missing agent context");
  return value as AgentContext;
}

function actorOf(ctx: AgentContext): SessionUser {
  return { id: ctx.userId, role: ctx.role, studentId: ctx.studentId, name: ctx.name, email: ctx.email };
}

async function supervisorNode(state: LibraryState, config: LangGraphRunnableConfig) {
  const iteration = state.iteration + 1;
  const plan = planRoute(state.userText);
  let llmChoice: AgentName | "FINISH" | null = null;
  let reason = "Routing from the supervisor plan.";

  if (geminiConfigured() && !(state.confirmation && !state.confirmation.confirmed)) {
    try {
      const model = getChatModel(0).withStructuredOutput(
        z.object({
          next: z.enum(["discovery", "circulation", "acquisition", "FINISH"]),
          reason: z.string(),
        }),
      );
      const decision = (await model.invoke([
        new SystemMessage(SUPERVISOR_PROMPT),
        new HumanMessage(
          [
            `User request: ${state.userText}`,
            `Plan: ${plan.join(" -> ") || "discovery"}`,
            `Completed agents: ${state.completed.join(", ") || "none"}`,
            `Observations: ${state.observations.slice(-6).join(" | ") || "none"}`,
          ].join("\n"),
        ),
      ])) as { next?: AgentName | "FINISH"; reason?: string };
      llmChoice = decision.next ?? null;
      reason = (decision.reason ?? reason).slice(0, 240);
    } catch (error) {
      reason = `The supervisor used its deterministic plan after the model request failed. ${error instanceof Error ? error.message : ""}`.slice(0, 240);
    }
  } else if (!geminiConfigured()) {
    reason = "The supervisor is using deterministic routing because GEMINI_API_KEY is not configured.";
  } else {
    reason = "A confirmation is pending, so no further specialist will run until the user decides.";
  }

  const next = resolveRoute({
    llmChoice,
    plan,
    completed: state.completed,
    iteration,
    needsConfirmation: Boolean(state.confirmation && !state.confirmation.confirmed),
  });
  const trace = makeTrace(
    "supervisor",
    iteration === 1 ? "agent_start" : "handoff",
    next === "FINISH" ? "Preparing the final response." : next === "confirm_gate" ? reason : `Delegating to ${next}. ${reason}`,
    { channel: "agent" },
  );
  config.writer?.({ type: "trace", trace });
  return { next, iteration, traces: [trace] };
}

function specialist(agent: Exclude<AgentName, "supervisor">) {
  return async (state: LibraryState, config: LangGraphRunnableConfig) => {
    const result = await runSpecialist(agent, state, config);
    return {
      messages: result.messages,
      traces: result.traces,
      observations: result.observations,
      completed: [agent],
      ...(result.bookCards ? { bookCards: result.bookCards } : {}),
      ...(result.confirmation ? { confirmation: result.confirmation } : {}),
    };
  };
}

async function confirmGate(state: LibraryState) {
  if (!state.confirmation || state.confirmation.confirmed) return { next: "finalize" };
  const answer = interrupt({ confirmation: state.confirmation }) as { confirmed?: boolean };
  if (answer?.confirmed) {
    const trace = makeTrace("system", "approval_required", "The user confirmed the transaction.", { channel: "human" });
    return {
      next: "commit",
      confirmation: { ...state.confirmation, confirmed: true },
      traces: [trace],
    };
  }
  return {
    next: "finalize",
    confirmation: null,
    observations: ["The transaction was cancelled. No database change was made."],
    traces: [makeTrace("system", "approval_required", "The user cancelled the transaction.", { channel: "human" })],
  };
}

async function commitNode(state: LibraryState, config: LangGraphRunnableConfig) {
  const confirmation = state.confirmation;
  if (!confirmation?.confirmed) {
    return { observations: ["No confirmed library transaction was available."] };
  }
  const ctx = readContext(config);
  const actor = actorOf(ctx);
  const started = Date.now();
  try {
    if (confirmation.action === "issue_book") {
      const result = await issueBook({
        actor,
        bookId: String(confirmation.data.bookId ?? ""),
        rollNo: typeof confirmation.data.rollNo === "string" ? confirmation.data.rollNo : undefined,
      });
      return committed("circulation", "issueBook", `Issued "${result.title}" to ${result.rollNo}. Due on ${new Date(result.dueDate).toLocaleDateString("en-IN")}.`, started, config);
    }
    if (confirmation.action === "return_book") {
      const result = await returnBook({ actor, loanId: String(confirmation.data.loanId ?? "") });
      return committed("circulation", "returnBook", `Returned "${result.title}". Fine recorded: ₹${result.fine.toFixed(2)}.`, started, config);
    }
    if (confirmation.action === "renew_book") {
      const result = await renewBook({ actor, loanId: String(confirmation.data.loanId ?? "") });
      return committed("circulation", "renewBook", `Renewed "${result.title}". New due date: ${new Date(result.dueDate).toLocaleDateString("en-IN")}.`, started, config);
    }
    const result = await createAcquisitionRequest({
      actor,
      bookTitle: String(confirmation.data.bookTitle ?? ""),
      author: confirmation.data.author ? String(confirmation.data.author) : null,
      reason: String(confirmation.data.reason ?? ""),
      requestedByAgent: "acquisition",
      suggestedCategory: confirmation.data.suggestedCategory ? String(confirmation.data.suggestedCategory) : null,
      suggestedDeweyDecimal: confirmation.data.suggestedDeweyDecimal ? String(confirmation.data.suggestedDeweyDecimal) : null,
    });
    return committed("acquisition", "createAcquisitionRequest", result.message, started, config);
  } catch (error) {
    const message = errorMessage(error);
    const trace = makeTrace("system", "error", message, { channel: "database" });
    config.writer?.({ type: "trace", trace });
    return { traces: [trace], observations: [message], confirmation: null };
  }
}

function committed(
  agent: "circulation" | "acquisition",
  toolName: string,
  summary: string,
  started: number,
  config: LangGraphRunnableConfig,
) {
  const traces = [
    makeTrace(agent, "tool_call", `${toolName} started`, { channel: "tool", data: { tool: toolName } }),
    makeTrace(agent, "tool_result", `${toolName} completed`, {
      channel: "tool",
      data: { tool: toolName },
      duration: Date.now() - started,
    }),
    makeTrace(agent, "tool_result", "Database transaction committed.", { channel: "database", data: { tool: toolName } }),
  ];
  traces.forEach((trace) => config.writer?.({ type: "trace", trace }));
  return { traces, observations: [summary], confirmation: null };
}

async function finalizeNode(state: LibraryState, config: LangGraphRunnableConfig) {
  const pending = state.confirmation && !state.confirmation.confirmed ? state.confirmation.message : null;
  const draft = composeFallbackAnswer(state.observations, pending);
  const trace = makeTrace("supervisor", "final_response", "Preparing the final response.", { channel: "agent" });
  config.writer?.({ type: "trace", trace });

  if (!geminiConfigured()) {
    config.writer?.({ type: "token", text: draft });
    return { finalText: draft, messages: [new AIMessage(draft)], traces: [trace] };
  }

  try {
    let full = "";
    const stream = await getChatModel(0.3).stream([
      new SystemMessage(FINAL_PROMPT),
      new HumanMessage(draft),
    ]);
    for await (const chunk of stream) {
      const text = messageText(chunk.content);
      if (!text) continue;
      full += text;
      config.writer?.({ type: "token", text });
    }
    const answer = full.trim() || draft;
    if (!full.trim()) config.writer?.({ type: "token", text: answer });
    return { finalText: answer, messages: [new AIMessage(answer)], traces: [trace] };
  } catch {
    config.writer?.({ type: "token", text: draft });
    return { finalText: draft, messages: [new AIMessage(draft)], traces: [trace] };
  }
}

function buildLibraryGraph() {
  return new StateGraph(LibraryAnnotation)
    .addNode("supervisor", supervisorNode)
    .addNode("discovery", specialist("discovery"))
    .addNode("circulation", specialist("circulation"))
    .addNode("acquisition", specialist("acquisition"))
    .addNode("confirm_gate", confirmGate)
    .addNode("commit", commitNode)
    .addNode("finalize", finalizeNode)
    .addConditionalEdges(START, (state) => (state.confirmation?.confirmed ? "commit" : "supervisor"))
    .addConditionalEdges("supervisor", (state) => {
      if (state.next === "discovery" || state.next === "circulation" || state.next === "acquisition" || state.next === "confirm_gate") {
        return state.next;
      }
      return "finalize";
    })
    .addEdge("discovery", "supervisor")
    .addEdge("circulation", "supervisor")
    .addEdge("acquisition", "supervisor")
    .addConditionalEdges("confirm_gate", (state) => (state.next === "commit" ? "commit" : "finalize"))
    .addEdge("commit", "finalize")
    .addEdge("finalize", END);
}

export function getLibraryGraph() {
  if (!compiled) {
    compiled = buildLibraryGraph().compile({ checkpointer });
  }
  return compiled;
}

export function graphConfig(turnId: string, agentContext: AgentContext) {
  return { configurable: { thread_id: turnId, agentContext } };
}
