"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/input";
import type { AgentTraceEvent, BookCard, ConfirmationRequest } from "@/types";

interface ChatItem {
  id: string;
  role: "user" | "assistant";
  content: string;
  traces: AgentTraceEvent[];
  books: BookCard[];
  confirmation?: ConfirmationRequest | null;
}

const SUGGESTIONS = [
  "Find me three books on artificial intelligence and machine learning.",
  "Can I borrow Operating System Concepts?",
  "Show me all the books I currently have issued.",
  "Which books are overdue?",
  "What is the overdue fine policy?",
  "The networking book I want is unavailable. Can the library purchase it?",
];

const PIPELINE = [
  { id: "supervisor", label: "Supervisor" },
  { id: "discovery", label: "Discovery" },
  { id: "circulation", label: "Circulation" },
  { id: "acquisition", label: "Acquisition" },
] as const;

const NODE: Record<string, string> = {
  Waiting: "border-border bg-transparent",
  Running: "node-live border-primary bg-primary",
  Completed: "border-[#159b72] bg-[#159b72]",
  Failed: "border-[#d94b61] bg-[#d94b61]",
  "Awaiting confirmation": "border-[#d99a35] bg-[#d99a35]",
};

const TONE: Record<string, "indigo" | "violet" | "blue" | "amber" | "emerald" | "rose" | "slate"> = {
  supervisor: "indigo",
  discovery: "violet",
  circulation: "blue",
  acquisition: "amber",
  system: "emerald",
};

export function AssistantPanel() {
  const [sessions, setSessions] = useState<{ id: string; title: string }[]>([]);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [messages, setMessages] = useState<ChatItem[]>([]);
  const [traces, setTraces] = useState<AgentTraceEvent[]>([]);
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [confirmation, setConfirmation] = useState<ConfirmationRequest | null>(null);
  const [turnId, setTurnId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void fetch("/api/chat").then(async (response) => {
      const body = await response.json();
      if (body.ok) setSessions(body.data);
    });
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  async function openSession(id: string) {
    setSessionId(id);
    const response = await fetch(`/api/chat?sessionId=${id}`);
    const body = await response.json();
    if (!body.ok) return;
    setMessages(
      body.data.map((item: { id: string; role: "user" | "assistant"; content: string; traceEvents?: AgentTraceEvent[]; metadata?: { books?: BookCard[]; confirmation?: ConfirmationRequest } }) => ({
        id: item.id,
        role: item.role,
        content: item.content,
        traces: item.traceEvents ?? [],
        books: item.metadata?.books ?? [],
        confirmation: item.metadata?.confirmation,
      })),
    );
    const last = body.data.at(-1);
    setTraces(last?.traceEvents ?? []);
  }

  async function send(text: string, extra?: Record<string, unknown>) {
    const content = text.trim();
    if (!content || pending) return;
    setPending(true);
    setError(null);
    setInput("");
    const localId = crypto.randomUUID();
    if (!extra?.resume) {
      setMessages((current) => [...current, { id: localId, role: "user", content, traces: [], books: [] }]);
    }
    const assistantId = crypto.randomUUID();
    setMessages((current) => [...current, { id: assistantId, role: "assistant", content: "", traces: [], books: [] }]);
    setTraces([]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, sessionId, turnId: extra?.turnId, bookId: extra?.bookId, resume: extra?.resume, confirmation: extra?.confirmation }),
      });
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({ error: "The assistant request failed." }));
        throw new Error(body.error ?? "The assistant request failed.");
      }
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assembled = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() ?? "";
        for (const part of parts) {
          const line = part.split("\n").find((item) => item.startsWith("data:"));
          if (!line) continue;
          const event = JSON.parse(line.slice(5).trim()) as {
            type: string;
            text?: string;
            message?: string;
            sessionId?: string;
            turnId?: string;
            trace?: AgentTraceEvent;
            books?: BookCard[];
            confirmation?: ConfirmationRequest;
          };
          if (event.sessionId) setSessionId(event.sessionId);
          if (event.type === "token" && event.text) {
            assembled += event.text;
            const snapshot = assembled;
            setMessages((current) => current.map((item) => (item.id === assistantId ? { ...item, content: snapshot } : item)));
          }
          if (event.type === "trace" && event.trace) {
            setTraces((current) => [...current, event.trace!]);
          }
          if (event.type === "books" && event.books) {
            setMessages((current) => current.map((item) => (item.id === assistantId ? { ...item, books: event.books ?? [] } : item)));
          }
          if (event.type === "interrupt" && event.confirmation) {
            setConfirmation(event.confirmation);
            setTurnId(event.turnId);
            setMessages((current) => current.map((item) => (item.id === assistantId ? { ...item, content: event.confirmation?.message ?? item.content, confirmation: event.confirmation } : item)));
          }
          if (event.type === "done" && event.message) {
            setMessages((current) => current.map((item) => (item.id === assistantId ? { ...item, content: event.message ?? item.content } : item)));
          }
          if (event.type === "error") {
            if (expiredSignIn(event.message)) {
              window.location.assign("/session-expired");
              return;
            }
            setError(event.message ?? "The assistant failed.");
          }
        }
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "The assistant failed.";
      if (expiredSignIn(message)) {
        window.location.assign("/session-expired");
        return;
      }
      setError(message);
    } finally {
      setPending(false);
      const refreshed = await fetch("/api/chat");
      const body = await refreshed.json();
      if (body.ok) setSessions(body.data);
    }
  }

  const traceView = useMemo(() => traces, [traces]);
  const nodes = useMemo(
    () => PIPELINE.map((node) => ({ ...node, state: nodeState(node.id, traces, pending, confirmation) })),
    [traces, pending, confirmation],
  );

  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="panel flex min-h-[72vh] flex-col">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Multi-agent desk</p>
            <h1 className="text-base font-semibold tracking-[-0.03em]">AI Library Assistant</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" className="lg:hidden" onClick={() => setMonitorOpen((open) => !open)}>{monitorOpen ? "Hide monitor" : "Execution"}</Button>
            <Button variant="secondary" size="sm" onClick={() => { setSessionId(undefined); setMessages([]); setTraces([]); }}>New conversation</Button>
          </div>
        </div>
        <div className="flex gap-1.5 overflow-x-auto border-b border-border px-3 py-2">
          {sessions.slice(0, 6).map((session) => (
            <button key={session.id} className="shrink-0 rounded-md border border-border px-2.5 py-1 text-[12px] text-muted hover:text-foreground" onClick={() => void openSession(session.id)}>
              {session.title}
            </button>
          ))}
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto px-4 py-5">
          {messages.length === 0 && (
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((prompt) => (
                <button key={prompt} className="rounded-lg border border-[#b7c0d4] bg-card px-3 py-3 text-left text-[13px] leading-5 text-foreground shadow-[inset_0_0_0_1px_rgba(23,27,43,0.03)] hover:border-primary dark:border-[#46506c] dark:shadow-none" onClick={() => void send(prompt)}>
                  {prompt}
                </button>
              ))}
            </div>
          )}
          {messages.map((message) => (
            <article key={message.id} className={message.role === "user" ? "ml-auto max-w-[78%] rounded-lg border border-[#b7c0d4] bg-[#eef1f8] px-3.5 py-2.5 text-[13px] leading-6 text-foreground dark:border-[#46506c] dark:bg-[#242c40]" : "max-w-[92%] rounded-lg border border-[#b7c0d4] bg-card px-3.5 py-2.5 text-[13px] leading-6 dark:border-[#46506c]"}>
              <p className="whitespace-pre-wrap">{message.content || (pending ? "Consulting the catalog..." : "")}</p>
              {message.books.length > 0 && (
                <div className="mt-3 grid gap-2">
                  {message.books.map((book) => (
                    <div key={book.id} className="rounded-lg border border-[#b7c0d4] bg-background p-3 text-foreground dark:border-[#46506c]">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium tracking-[-0.02em]">{book.title}</p>
                          <p className="text-[12px] text-muted">{book.author}</p>
                        </div>
                        <Badge tone={book.availableCopies > 0 ? "emerald" : "rose"}>{book.availableCopies}/{book.totalCopies}</Badge>
                      </div>
                      <p className="mt-1 text-[12px] text-muted">{book.category}{book.similarityScore ? ` · ${book.similarityScore.toFixed(2)}` : ""}</p>
                      <Button className="mt-3" size="sm" onClick={() => void send(`I want to borrow this book.`, { bookId: book.id })}>Request this book</Button>
                    </div>
                  ))}
                </div>
              )}
            </article>
          ))}
          {pending && <p className="text-[12px] text-muted">Agents are working. The trace updates from the live run.</p>}
          <div ref={bottom} />
        </div>
        {error && <p className="px-4 pb-2 text-[13px] text-rose-600">{error}</p>}
        <form
          className="flex items-end gap-2 border-t border-border p-3"
          onSubmit={(event) => {
            event.preventDefault();
            void send(input);
          }}
        >
          <Textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about books, loans, fines, or acquisitions" className="min-h-11" />
          <Button type="submit" disabled={pending}>Send</Button>
        </form>
      </section>
      <aside className={`${monitorOpen ? "block" : "hidden"} panel h-fit p-4 lg:sticky lg:top-20 lg:block`}>
        <h2 className="text-sm font-semibold tracking-[-0.02em]">Live execution</h2>
        <p className="mb-4 text-[12px] leading-5 text-muted">States come from this LangGraph trace. Model reasoning is not shown.</p>
        <ol className="mb-5">
          {nodes.map((node, index) => (
            <li key={node.id} className="relative pb-3 pl-6">
              {index < nodes.length - 1 && <span className="absolute left-[7px] top-4 h-[calc(100%-6px)] w-px bg-border" />}
              <span className={`absolute left-0 top-0.5 h-4 w-4 rounded-full border ${NODE[node.state]}`} />
              <div className="flex items-baseline justify-between gap-2">
                <p className="text-[13px] font-medium">{node.label}</p>
                <p className="text-[10px] uppercase tracking-[0.08em] text-muted">{node.state}</p>
              </div>
            </li>
          ))}
        </ol>
        <h3 className="mb-3 text-[12px] font-medium uppercase tracking-[0.08em] text-muted">Trace</h3>
        <div className="relative space-y-0 border-l border-border pl-4">
          {traceView.length === 0 && <p className="text-[13px] text-muted">{pending ? "Waiting for the first event." : "Traces appear when a request starts."}</p>}
          {traceView.map((trace, index) => {
            const last = index === traceView.length - 1;
            const state = trace.message.toLowerCase().includes("fail") || trace.message.toLowerCase().includes("error")
              ? "Failed"
              : confirmation && last
                ? "Awaiting confirmation"
                : pending && last
                  ? "Running"
                  : "Completed";
            return (
              <div key={trace.id} className="relative pb-4">
                <span className={`absolute -left-[21px] top-1 h-2 w-2 rounded-full ${state === "Running" ? "bg-primary" : state === "Failed" ? "bg-rose-600" : state === "Awaiting confirmation" ? "bg-amber-500" : "bg-[#98a2b3]"}`} />
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={trace.channel === "database" ? "emerald" : trace.channel === "human" ? "rose" : trace.channel === "tool" ? "slate" : TONE[trace.agent] ?? "slate"}>
                    {trace.channel === "database" ? "Database" : trace.channel === "tool" ? "Tool" : trace.channel === "human" ? "Human approval" : trace.agent}
                  </Badge>
                  <span className="text-[11px] uppercase tracking-[0.08em] text-muted">{state}</span>
                </div>
                <p className="mt-1 text-[13px] leading-5">{trace.message}</p>
              </div>
            );
          })}
        </div>
      </aside>
      <Dialog open={Boolean(confirmation)} title="Confirm library transaction" onClose={() => setConfirmation(null)}>
        <p className="text-sm">{confirmation?.message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmation(null)}>Cancel</Button>
          <Button
            onClick={() => {
              const current = confirmation;
              setConfirmation(null);
              if (!current) return;
              void send("I confirm this request.", { resume: { confirmed: true }, turnId, confirmation: current });
            }}
          >
            Confirm
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function expiredSignIn(message?: string) {
  return /sign in again/i.test(message ?? "");
}

function nodeState(
  id: string,
  traces: AgentTraceEvent[],
  pending: boolean,
  confirmation: ConfirmationRequest | null,
): "Waiting" | "Running" | "Completed" | "Failed" | "Awaiting confirmation" {
  const own = traces.filter((trace) => trace.agent === id);
  if (own.some((trace) => trace.type === "error")) return "Failed";
  if (confirmation) {
    const circulation = confirmation.action === "issue_book" || confirmation.action === "return_book" || confirmation.action === "renew_book";
    if ((id === "circulation" && circulation) || (id === "acquisition" && confirmation.action === "create_acquisition")) {
      return "Awaiting confirmation";
    }
  }
  if (own.length === 0) return "Waiting";
  const last = traces[traces.length - 1];
  const ended = own.some((trace) => trace.type === "agent_end" || trace.type === "final_response");
  if (pending && last?.agent === id && !ended) return "Running";
  return "Completed";
}
