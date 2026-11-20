"use client";

import Link from "next/link";
import { ArrowRight, Bot, Library, ShieldCheck, Sparkles } from "lucide-react";

const AGENTS = [
  { id: "supervisor", label: "Supervisor Agent", y: 16, copy: "Classifies intent and chooses the next specialist." },
  { id: "discovery", label: "Discovery Agent", y: 92, copy: "Embeds the question and searches the catalog and policies." },
  { id: "circulation", label: "Circulation Agent", y: 168, copy: "Issues, returns, and renews inside a locked transaction." },
  { id: "acquisition", label: "Acquisition Agent", y: 244, copy: "Opens a pending request. A librarian must approve it." },
];

export function Landing() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <div className="grid h-7 w-7 place-items-center rounded-md bg-[#5145cd] text-[11px] font-semibold text-white">AL</div>
            <span className="text-sm font-semibold tracking-[-0.02em]">Autonomous Library</span>
          </div>
          <Link href="/login" className="inline-flex h-8 items-center rounded-lg bg-foreground px-3 text-[13px] font-medium text-background">
            Sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#5145cd]">Generative AI powered library</p>
          <h1 className="mt-3 max-w-xl text-5xl font-semibold leading-[1.05] tracking-[-0.045em]">
            A smarter library, powered by autonomous AI agents.
          </h1>
          <p className="mt-5 max-w-lg text-[15px] leading-7 text-muted">
            A supervisor reads each request and hands it to Discovery, Circulation, or Acquisition. Those agents call fixed tools. Purchases stay pending until a librarian approves them.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            <Link href="/login" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#5145cd] px-4 text-sm font-medium text-white">
              Explore dashboard <ArrowRight className="h-4 w-4" />
            </Link>
            <a href="#architecture" className="inline-flex h-10 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium">
              Explore AI architecture
            </a>
          </div>
        </div>
        <div id="architecture"><AgentDiagram /></div>
      </section>

      <section className="mx-auto max-w-6xl px-6">
        <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
        {[
          [Library, "Intelligent book discovery", "Semantic and keyword search over the live catalog and stored policies."],
          [ShieldCheck, "Automated circulation", "Issue, return, and renewal run as one locked database transaction."],
          [Sparkles, "AI-powered assistance", "A supervisor delegates the request and the trace shows each handoff."],
          [Bot, "Human-in-the-loop acquisition", "Purchase requests stay pending until a librarian decides."],
        ].map(([Icon, title, copy]) => {
          const Glyph = Icon as typeof Sparkles;
          return (
            <article key={String(title)} className="bg-card p-5">
              <Glyph className="h-4 w-4 text-[#5145cd]" />
              <h2 className="mt-4 text-sm font-semibold tracking-[-0.02em]">{String(title)}</h2>
              <p className="mt-1.5 text-[13px] leading-6 text-muted">{String(copy)}</p>
            </article>
          );
        })}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-8 px-6 py-20 lg:grid-cols-2">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Workflow</p>
          <h2 className="mt-2 text-3xl font-semibold tracking-[-0.04em]">One request, several agents, one committed result.</h2>
        </div>
        <ol className="space-y-4">
          {[
            ["01", "The supervisor reads the request and selects the next specialist."],
            ["02", "Discovery returns titles, availability, or a stored policy passage."],
            ["03", "Circulation or Acquisition prepares a confirmation. Nothing is written yet."],
            ["04", "After confirmation, one database transaction commits the change."],
          ].map(([step, copy]) => (
            <li key={step} className="grid grid-cols-[auto_1fr] gap-4 border-t border-border pt-4">
              <span className="font-mono text-xs text-primary">{step}</span>
              <p className="text-sm leading-6 text-foreground">{copy}</p>
            </li>
          ))}
        </ol>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-[12px] text-muted">
          <p>Autonomous Library · LangGraph supervisor · PostgreSQL</p>
          <Link href="/login" className="text-foreground">Sign in</Link>
        </div>
      </footer>
    </main>
  );
}

function AgentDiagram() {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[12px] font-medium">Live delegation</p>
        <span className="text-[11px] text-muted">Supervisor graph</span>
      </div>
      <svg viewBox="0 0 420 320" className="h-auto w-full" role="img" aria-label="Supervisor connected to Discovery, Circulation, and Acquisition">
        <line className="agent-line" x1="28" y1="42" x2="28" y2="270" stroke="#c9c4fb" strokeWidth="1.5" />
        {AGENTS.map((agent) => (
          <g key={agent.id}>
            {agent.id !== "supervisor" && <line className="agent-line" x1="28" y1={agent.y + 22} x2="72" y2={agent.y + 22} stroke="#c9c4fb" strokeWidth="1.5" />}
            <g transform={`translate(${agent.id === "supervisor" ? 8 : 72} ${agent.y})`}>
              <rect width={agent.id === "supervisor" ? 210 : 230} height="44" rx="8" fill={agent.id === "supervisor" ? "#101626" : "var(--card)"} stroke="var(--border)" />
              <circle cx="18" cy="22" r="4" fill={agent.id === "supervisor" ? "#7565e8" : "#5145cd"} />
              <text x="32" y="27" fill={agent.id === "supervisor" ? "#ffffff" : "var(--foreground)"} fontSize="13" fontFamily="inherit">
                {agent.label}
              </text>
            </g>
          </g>
        ))}
      </svg>
      <div className="grid gap-3 border-t border-border pt-3 sm:grid-cols-2">
        {AGENTS.map((agent) => (
          <div key={agent.id}>
            <p className="text-[12px] font-medium">{agent.label}</p>
            <p className="text-[12px] leading-5 text-muted">{agent.copy}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
