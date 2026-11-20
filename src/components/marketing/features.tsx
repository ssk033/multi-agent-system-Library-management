"use client";

import { motion, useReducedMotion } from "framer-motion";

const ITEMS = [
  {
    index: "01",
    title: "Intelligent discovery",
    copy: "Semantic and keyword search across the live catalog and stored policies. Without an embedding key, keyword search stays available and is labeled as such.",
    span: "lg:col-span-7",
    visual: <DiscoverySketch />,
  },
  {
    index: "02",
    title: "Autonomous circulation",
    copy: "Issue, return, and renewal change copies, status, and fines together. The write is a single locked transaction, and it does not start until the member confirms.",
    span: "lg:col-span-5",
    visual: <CirculationSketch />,
  },
  {
    index: "03",
    title: "Multi-agent intelligence",
    copy: "The supervisor reads the request and hands it to the next specialist. Discovery, circulation, and acquisition do not run in the same turn.",
    span: "lg:col-span-5",
    visual: <HandoffSketch />,
  },
  {
    index: "04",
    title: "Human-controlled acquisition",
    copy: "A purchase stays pending. Only an authorised librarian can approve or reject it. The model has no approval tool in the conversation.",
    span: "lg:col-span-7",
    visual: <GateSketch />,
  },
];

export function FeatureSection() {
  const reduce = useReducedMotion();

  return (
    <section id="capabilities" className="scroll-mt-24 mx-auto max-w-6xl px-5 py-20 sm:px-6">
      <div className="max-w-2xl">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-primary">Capabilities</p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">Four responsibilities. One desk.</h2>
      </div>
      <div className="mt-10 grid gap-4 lg:grid-cols-12">
        {ITEMS.map((item, index) => (
          <motion.article
            key={item.index}
            className={`group flex flex-col justify-between overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-primary/30 ${item.span}`}
            initial={false}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ duration: 0.45, delay: reduce ? 0 : index * 0.05, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="px-5 pt-5 sm:px-6 sm:pt-6">
              <p className="font-mono text-[11px] text-primary">{item.index}</p>
              <h3 className="mt-3 text-lg font-semibold tracking-[-0.03em]">{item.title}</h3>
              <p className="mt-2 max-w-xl text-[13.5px] leading-6 text-muted">{item.copy}</p>
            </div>
            <div className="mt-6 border-t border-border bg-background/60 px-5 py-4 sm:px-6">{item.visual}</div>
          </motion.article>
        ))}
      </div>
    </section>
  );
}

function DiscoverySketch() {
  return (
    <div className="grid gap-2 sm:grid-cols-[180px_1fr] sm:items-center">
      <p className="rounded-md border border-border bg-card px-3 py-2 font-mono text-[11px] text-muted">find distributed systems</p>
      <ul className="space-y-1.5 text-[12px]">
        <li className="flex items-center justify-between gap-3">
          <span>Catalog passage</span>
          <span className="text-primary">semantic</span>
        </li>
        <li className="flex items-center justify-between gap-3 text-muted">
          <span>Stored policy</span>
          <span>keyword</span>
        </li>
      </ul>
    </div>
  );
}

function CirculationSketch() {
  return (
    <ol className="space-y-2 text-[12px]">
      {["Issue", "Return", "Renew"].map((step) => (
        <li key={step} className="flex items-center justify-between border-b border-border pb-2 last:border-0 last:pb-0">
          <span>{step}</span>
          <span className="text-muted">locked row</span>
        </li>
      ))}
    </ol>
  );
}

function HandoffSketch() {
  return (
    <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.12em]">
      <span className="rounded-full bg-[#101426] px-2.5 py-1 text-white dark:bg-foreground dark:text-background">Supervisor</span>
      <span className="text-primary">→</span>
      <span className="rounded-full border border-border px-2.5 py-1 text-foreground">Next specialist</span>
    </div>
  );
}

function GateSketch() {
  return (
    <div className="grid gap-2 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
      <p className="rounded-md border border-dashed border-border px-3 py-2 text-[12px]">Pending request</p>
      <p className="text-center text-[11px] uppercase tracking-[0.14em] text-[#D99A35]">Librarian</p>
      <p className="rounded-md border border-border px-3 py-2 text-[12px] text-muted">Approve or reject</p>
    </div>
  );
}
