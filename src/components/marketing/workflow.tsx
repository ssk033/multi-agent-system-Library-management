"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const STEPS = [
  {
    id: "request",
    title: "User request",
    body: "A member asks in ordinary language. The model never receives a database connection and cannot invent a SQL statement.",
  },
  {
    id: "supervisor",
    title: "Supervisor agent",
    body: "The supervisor classifies the request and selects the next specialist. It delegates once, then waits. Specialists are not launched together.",
  },
  {
    id: "discovery",
    title: "Discovery agent",
    body: "When the plan needs the catalog or a policy, discovery runs first. It returns titles, availability, or a stored passage. A borrow plan continues only after this step.",
  },
  {
    id: "branch",
    title: "Circulation or acquisition",
    body: "The supervisor picks one. Circulation prepares an issue, return, or renewal. Acquisition opens a pending purchase. A return never calls acquisition, and a purchase is not issued as a loan.",
  },
  {
    id: "confirm",
    title: "Confirmation",
    body: "Writes stop here until the signed-in member confirms. Cancelling leaves the catalog unchanged.",
  },
  {
    id: "commit",
    title: "PostgreSQL transaction",
    body: "The confirmed action locks the book and student rows, then commits copies, loan status, and fines together.",
  },
  {
    id: "done",
    title: "Completed result",
    body: "The assistant answers from the tool result. The trace records the handoff, the tool, and the database event. Hidden model reasoning is not shown.",
  },
];

export function WorkflowSection() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];

  return (
    <section id="workflow" className="scroll-mt-24 border-t border-border">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-20 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">LangGraph</p>
          <h2 className="mt-3 max-w-xl text-3xl font-semibold tracking-[-0.04em] sm:text-[2.4rem] sm:leading-[1.15]">
            One request. Multiple agents. One coordinated result.
          </h2>
          <ol className="relative mt-10 space-y-1 border-l border-border pl-6">
            {STEPS.map((item, index) => (
              <li key={item.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(index)}
                  onFocus={() => setActive(index)}
                  className="group relative w-full py-2.5 text-left"
                >
                  <span
                    className={cn(
                      "absolute -left-[29px] top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full border bg-background transition-colors",
                      active === index ? "border-primary bg-primary" : "border-border group-hover:border-primary/50",
                    )}
                  />
                  <span className={cn("text-sm tracking-[-0.02em]", active === index ? "font-medium text-foreground" : "text-muted")}>
                    {item.title}
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </div>
        <aside className="lg:sticky lg:top-24">
          <div className="rounded-2xl border border-border bg-card p-6">
            <p className="font-mono text-[11px] text-primary">{String(active + 1).padStart(2, "0")}</p>
            <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em]">{step.title}</h3>
            <p className="mt-3 text-[14px] leading-7 text-muted">{step.body}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
