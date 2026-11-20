"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const AGENTS = [
  {
    id: "supervisor",
    label: "Supervisor",
    detail: "Reads the request and chooses the next specialist. One handoff at a time.",
    className: "left-1/2 top-[18%]",
  },
  {
    id: "discovery",
    label: "Discovery",
    detail: "Searches the catalog and stored policies. Keyword search remains available without embeddings.",
    className: "left-[20%] top-[62%]",
  },
  {
    id: "circulation",
    label: "Circulation",
    detail: "Prepares issue, return, and renewal. The write waits for confirmation, then commits in one transaction.",
    className: "left-1/2 top-[76%]",
  },
  {
    id: "acquisition",
    label: "Acquisition",
    detail: "Opens a pending purchase. A librarian approves or rejects it. The model cannot approve.",
    className: "left-[80%] top-[62%]",
  },
] as const;

export function ArchitectureVisual() {
  const [active, setActive] = useState<string>("supervisor");
  const current = AGENTS.find((agent) => agent.id === active) ?? AGENTS[0];

  return (
    <div id="architecture" className="scroll-mt-24">
      <div className="relative">
        <div className="pointer-events-none absolute -inset-8 -z-10 rounded-full bg-[radial-gradient(circle,rgba(81,69,205,0.16),transparent_68%)] dark:bg-[radial-gradient(circle,rgba(117,101,232,0.2),transparent_68%)]" />
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card/90 shadow-[0_24px_60px_-36px_rgba(16,20,38,0.55)]">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-[12px] font-medium tracking-[-0.02em]">Orchestration</p>
            <p className="text-[11px] text-muted">Sequential delegation</p>
          </div>
          <div className="relative hidden h-[440px] sm:block" data-hover={active} onMouseLeave={() => setActive("supervisor")}>
            <svg viewBox="0 0 640 440" className="absolute inset-0 h-full w-full" aria-hidden="true">
              <circle cx="320" cy="78" r="46" fill="none" stroke="rgba(81,69,205,0.18)" strokeWidth="1" />
              <path className="orch-path orch-discovery" d="M320 112 C320 176 150 176 128 248" fill="none" />
              <path className="orch-path orch-circulation" d="M320 124 C320 200 320 230 320 300" fill="none" />
              <path className="orch-path orch-acquisition" d="M320 112 C320 176 490 176 512 248" fill="none" />
            </svg>
            {AGENTS.map((agent) => (
              <button
                key={agent.id}
                type="button"
                onMouseEnter={() => setActive(agent.id)}
                onFocus={() => setActive(agent.id)}
                className={cn("absolute z-10 -translate-x-1/2 -translate-y-1/2 outline-none", agent.className)}
              >
                <Node label={agent.label} lead={agent.id === "supervisor"} on={active === agent.id} />
              </button>
            ))}
          </div>
          <ol className="space-y-3 p-4 sm:hidden">
            {AGENTS.map((agent) => (
              <li key={agent.id}>
                <button
                  type="button"
                  onClick={() => setActive(agent.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left",
                    active === agent.id ? "border-primary/40 bg-primary/5" : "border-border",
                  )}
                >
                  <span className={cn("h-2 w-2 rounded-full", agent.id === "supervisor" ? "bg-[#7565E8]" : "bg-primary")} />
                  <span className="text-[13px] font-medium">{agent.label}</span>
                </button>
              </li>
            ))}
          </ol>
          <p className="border-t border-border px-4 py-3 text-[13px] leading-5 text-muted">
            <span className="font-medium text-foreground">{current.label}. </span>
            {current.detail}
          </p>
        </div>
      </div>
    </div>
  );
}

function Node({ label, lead, on }: { label: string; lead?: boolean; on: boolean }) {
  return (
    <span className="relative grid place-items-center">
      <span
        className={cn(
          "grid place-items-center rounded-full border",
          lead ? "h-14 w-14 border-white/10 bg-[#101426]" : "h-11 w-11 border-border bg-card",
          on && "node-live",
        )}
      >
        <span className={cn("rounded-full", lead ? "h-2 w-2 bg-[#7565E8]" : "h-1.5 w-1.5 bg-primary")} />
      </span>
      <span className={cn("absolute w-28 text-center text-[12px] font-medium tracking-[-0.02em] text-foreground", lead ? "top-[calc(100%+16px)]" : "top-[calc(100%+12px)]")}>{label}</span>
    </span>
  );
}
