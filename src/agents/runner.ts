import { AIMessage, HumanMessage, SystemMessage, ToolMessage, type BaseMessage } from "@langchain/core/messages";
import type { StructuredToolInterface } from "@langchain/core/tools";
import type { LangGraphRunnableConfig } from "@langchain/langgraph";
import { createAllTools } from "@/agents/tools";
import type { AgentContext } from "@/agents/context";
import { ACQUISITION_PROMPT, CIRCULATION_PROMPT, DISCOVERY_PROMPT } from "@/agents/prompts";
import type { LibraryState } from "@/agents/state";
import { AGENT_LABEL, makeTrace } from "@/agents/trace";
import { geminiConfigured, getChatModel, messageText } from "@/lib/gemini";
import type { AgentName, AgentTraceEvent, BookCard, ConfirmationRequest } from "@/types";

const PROMPTS: Record<AgentName, string> = {
  supervisor: "",
  discovery: DISCOVERY_PROMPT,
  circulation: CIRCULATION_PROMPT,
  acquisition: ACQUISITION_PROMPT,
};

interface SpecialistResult {
  messages: BaseMessage[];
  traces: AgentTraceEvent[];
  observations: string[];
  bookCards?: BookCard[];
  confirmation?: ConfirmationRequest | null;
}

function readContext(config: LangGraphRunnableConfig): AgentContext {
  const value = config.configurable?.agentContext;
  if (!value || typeof value !== "object") {
    throw new Error("The agent run is missing its authenticated context");
  }
  return value as AgentContext;
}

function emitTrace(config: LangGraphRunnableConfig, trace: AgentTraceEvent) {
  config.writer?.({ type: "trace", trace });
  return trace;
}

function absorb(output: string, bucket: { bookCards?: BookCard[]; confirmation?: ConfirmationRequest | null; observations: string[] }) {
  try {
    const parsed = JSON.parse(output) as Record<string, unknown>;
    const cards = Array.isArray(parsed.cards) ? parsed.cards : Array.isArray(parsed.books) ? parsed.books : null;
    if (cards && cards.length > 0 && typeof cards[0] === "object" && cards[0] && "title" in cards[0]) {
      bucket.bookCards = cards as BookCard[];
      const titles = (cards as { title?: string }[]).map((book) => book.title).filter(Boolean).slice(0, 5);
      if (titles.length > 0) bucket.observations.push(`Found ${titles.length} relevant title${titles.length === 1 ? "" : "s"}: ${titles.join(", ")}.`);
    }
    if (parsed.confirmationRequired && typeof parsed.confirmationRequired === "object") {
      bucket.confirmation = parsed.confirmationRequired as ConfirmationRequest;
    }
    if (parsed.database === "committed") {
      bucket.observations.push(`Database transaction committed. ${JSON.stringify(parsed.result ?? parsed).slice(0, 500)}`);
    } else if (parsed.ok === false && typeof parsed.error === "string" && !parsed.confirmationRequired) {
      bucket.observations.push(parsed.error);
    }
    if (Array.isArray(parsed.loans)) {
      bucket.observations.push(`Retrieved ${parsed.loans.length} loan record${parsed.loans.length === 1 ? "" : "s"}.`);
    }
    if (Array.isArray(parsed.policies)) {
      const names = (parsed.policies as { policyName?: string }[]).map((policy) => policy.policyName).filter(Boolean);
      bucket.observations.push(names.length ? `Retrieved policies: ${names.join(", ")}.` : "No matching library policy was found.");
    }
    if (parsed.fine && typeof parsed.fine === "object") {
      bucket.observations.push(`Fine calculation: ${JSON.stringify(parsed.fine)}.`);
    }
  } catch {
    bucket.observations.push(output.slice(0, 400));
  }
}

async function invokeTool(tools: StructuredToolInterface[], name: string, args: Record<string, unknown>) {
  const found = tools.find((item) => item.name === name);
  if (!found) return JSON.stringify({ ok: false, error: `Tool ${name} is not available to this agent` });
  const output = await found.invoke(args);
  return typeof output === "string" ? output : JSON.stringify(output);
}

function extractBookId(text: string): string | null {
  const match = text.match(/Selected book id \(chosen in the interface\): ([0-9a-fA-F-]{36})/);
  return match?.[1] ?? null;
}

async function runDeterministic(
  agent: Exclude<AgentName, "supervisor">,
  state: LibraryState,
  tools: StructuredToolInterface[],
  traces: AgentTraceEvent[],
  config: LangGraphRunnableConfig,
): Promise<SpecialistResult> {
  const bucket: SpecialistResult = { messages: [], traces, observations: [] };
  const text = state.userText;
  const call = async (name: string, args: Record<string, unknown>) => {
    const started = Date.now();
    traces.push(emitTrace(config, makeTrace(agent, "tool_call", `${name} started`, { channel: "tool", data: { tool: name } })));
    const output = await invokeTool(tools, name, args);
    traces.push(
      emitTrace(
        config,
        makeTrace(agent, "tool_result", `${name} completed`, {
          channel: "tool",
          data: { tool: name },
          duration: Date.now() - started,
        }),
      ),
    );
    absorb(output, bucket);
    if (output.includes('"database":"committed"')) {
      traces.push(emitTrace(config, makeTrace(agent, "tool_result", "Database transaction committed.", { channel: "database", data: { tool: name } })));
    }
    bucket.messages.push(new AIMessage({ content: `Called ${name}`, tool_calls: [{ id: name, name, args, type: "tool_call" }] }));
    bucket.messages.push(new ToolMessage({ content: output.slice(0, 8000), tool_call_id: name, name }));
    return output;
  };

  if (agent === "discovery") {
    const policy = /\b(policy|policies|rule|eligible|eligibility|duration|how many books|how long)\b/i.test(text);
    if (policy) await call("searchLibraryPolicies", { query: text });
    const bookId = extractBookId(text);
    if (bookId) {
      await call("getBookDetails", { bookId });
      await call("checkBookAvailability", { bookId });
    } else if (!policy || /\b(book|recommend|find|suggest)\b/i.test(text)) {
      try {
        await call("searchBooksSemantic", { query: text });
      } catch {
        await call("searchCatalog", { query: text });
      }
      const outputFailed = bucket.observations.some((item) => /GEMINI_API_KEY|Semantic search requires/i.test(item));
      if (outputFailed) await call("searchCatalog", { query: text });
    }
  }

  if (agent === "circulation") {
    const borrow = /\b(borrow|issue|check out|take out)\b/i.test(text);
    const returning = /\b(return|give back)\b/i.test(text);
    const renew = /\brenew/i.test(text);
    if (/\boverdue\b/i.test(text)) await call("getOverdueLoans", {});
    else if (/\b(my loans|my books|issued|fine)\b/i.test(text) && !borrow) await call("getStudentLoans", {});
    const bookId = extractBookId(text) ?? bucket.bookCards?.find((book) => book.availableCopies > 0)?.id ?? state.bookCards.find((book) => book.availableCopies > 0)?.id;
    if (borrow && bookId) await call("issueBook", { bookId });
    if (returning || renew) {
      const loansOutput = await call("getStudentLoans", {});
      const parsed = JSON.parse(loansOutput) as { loans?: { id: string; bookTitle: string; status: string }[] };
      const held = (parsed.loans ?? []).filter((loan) => loan.status !== "RETURNED");
      const words = text.toLowerCase().split(/\W+/).filter((word) => word.length > 3);
      const ranked = held
        .map((loan) => ({ loan, score: words.filter((word) => loan.bookTitle.toLowerCase().includes(word)).length }))
        .sort((a, b) => b.score - a.score);
      const chosen = ranked[0]?.score ? ranked[0].loan : held.length === 1 ? held[0] : undefined;
      if (!chosen) bucket.observations.push("I need the book title of the loan you want to update.");
      else if (returning) await call("returnBook", { loanId: chosen.id });
      else if (renew) await call("renewBook", { loanId: chosen.id });
    }
  }

  if (agent === "acquisition") {
    const unavailable = state.bookCards.find((book) => book.availableCopies === 0) ?? bucket.bookCards?.find((book) => book.availableCopies === 0);
    const asks = /\b(purchase|buy|acquire|acquisition|order)\b|unavailable|out of stock/i.test(text);
    if (!unavailable && !asks) {
      bucket.observations.push("The catalog search did not require a new acquisition request.");
    } else {
      const titleMatch = text.match(/"([^"]{2,120})"/);
      const title = unavailable?.title ?? titleMatch?.[1] ?? "Requested library title";
      const author = unavailable?.author;
      const reason = `A student asked for this title and the catalog could not supply an available copy. Request: ${text}`.slice(0, 1000);
      await call("suggestBookClassification", { title, description: reason });
      await call("createAcquisitionRequest", { bookTitle: title, author, reason });
    }
  }

  traces.push(emitTrace(config, makeTrace(agent, "agent_end", `${AGENT_LABEL[agent]} finished.`, { channel: "agent" })));
  return bucket;
}

export async function runSpecialist(
  agent: Exclude<AgentName, "supervisor">,
  state: LibraryState,
  config: LangGraphRunnableConfig,
): Promise<SpecialistResult> {
  const ctx = readContext(config);
  const started = Date.now();
  const traces: AgentTraceEvent[] = [
    emitTrace(config, makeTrace(agent, "agent_start", `${AGENT_LABEL[agent]} started.`, { channel: "agent" })),
  ];
  const tools = createAllTools(ctx)[agent] as StructuredToolInterface[];
  const confirmationNote = ctx.confirmation?.confirmed
    ? `The user already confirmed ${ctx.confirmation.action}. Execute that exact action with tools.`
    : "Do not claim a write succeeded unless the tool result says the database committed.";

  if (!geminiConfigured()) {
    traces.push(
      emitTrace(
        config,
        makeTrace(agent, "handoff", `${AGENT_LABEL[agent]} is using database tools directly because GEMINI_API_KEY is not configured.`, { channel: "agent" }),
      ),
    );
    const result = await runDeterministic(agent, state, tools, traces, config);
    result.traces = traces;
    return result;
  }

  try {
    const model = getChatModel(0.1).bindTools(tools);
    const messages: BaseMessage[] = [
      new SystemMessage(`${PROMPTS[agent]}\n${confirmationNote}`),
      ...state.messages.slice(-8),
    ];
    const produced: BaseMessage[] = [];
    const bucket: SpecialistResult = { messages: produced, traces, observations: [] };
    let calledTool = false;

    for (let step = 0; step < 4; step += 1) {
      const ai = await model.invoke(messages);
      produced.push(ai);
      messages.push(ai);
      const calls = ai.tool_calls ?? [];
      if (calls.length === 0) break;
      calledTool = true;
      for (const call of calls) {
        const name = call.name;
        const args = (call.args ?? {}) as Record<string, unknown>;
        const toolStarted = Date.now();
        traces.push(emitTrace(config, makeTrace(agent, "tool_call", `${name} started`, { channel: "tool", data: { tool: name } })));
        const output = await invokeTool(tools, name, args);
        absorb(output, bucket);
        traces.push(
          emitTrace(
            config,
            makeTrace(agent, "tool_result", `${name} completed`, {
              channel: "tool",
              data: { tool: name },
              duration: Date.now() - toolStarted,
            }),
          ),
        );
        if (output.includes('"database":"committed"')) {
          traces.push(emitTrace(config, makeTrace(agent, "tool_result", "Database transaction committed.", { channel: "database", data: { tool: name } })));
        }
        const toolMessage = new ToolMessage({
          content: output.slice(0, 8000),
          tool_call_id: call.id ?? `${name}-${step}`,
          name,
        });
        messages.push(toolMessage);
        produced.push(toolMessage);
      }
    }

    if (!calledTool) {
      const fallback = await runDeterministic(agent, state, tools, traces, config);
      fallback.traces = traces;
      return fallback;
    }

    const last = produced.at(-1);
    if (last && last.getType() === "ai") {
      const text = messageText(last.content).trim();
      if (text) bucket.observations.push(text);
    }
    traces.push(
      emitTrace(
        config,
        makeTrace(agent, "agent_end", `${AGENT_LABEL[agent]} finished.`, {
          channel: "agent",
          duration: Date.now() - started,
        }),
      ),
    );
    return bucket;
  } catch (error) {
    traces.push(
      emitTrace(
        config,
        makeTrace(agent, "handoff", "The model was unavailable, so this agent used the catalog tools directly.", { channel: "agent" }),
      ),
    );
    const fallback = await runDeterministic(agent, state, tools, traces, config);
    fallback.traces = traces;
    return fallback;
  }
}

export { HumanMessage };
