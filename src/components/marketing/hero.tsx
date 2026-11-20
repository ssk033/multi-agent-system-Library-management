"use client";

import { ArrowRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { ArchitectureVisual } from "@/components/marketing/architecture-visual";

function openPage(path: string) {
  return (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    window.location.assign(path);
  };
}

export function Hero() {
  const reduce = useReducedMotion();

  return (
    <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-24">
      <motion.div initial={false} animate={{ opacity: 1, y: 0 }} transition={{ duration: reduce ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] }}>
        <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
          Autonomous Library · AI-powered knowledge system
        </p>
        <h1 className="mt-4 max-w-xl text-[2.7rem] font-semibold leading-[0.98] tracking-[-0.048em] sm:text-6xl lg:text-[4.15rem]">
          Your library.
          <br />
          Reimagined with AI.
        </h1>
        <p className="mt-6 max-w-md text-[15.5px] leading-7 text-muted">
          An intelligent multi-agent library platform that understands natural-language requests, discovers knowledge, automates circulation and coordinates acquisitions.
        </p>
        <div className="mt-8 flex flex-wrap gap-2.5">
          <a
            href="/overview"
            onClick={openPage("/overview")}
            className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-[13.5px] font-medium text-white transition-colors hover:bg-[#4539b8]"
          >
            Explore Dashboard
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
          <a
            href="#architecture"
            className="inline-flex h-10 items-center rounded-md border border-border bg-card px-4 text-[13.5px] font-medium transition-colors hover:border-primary/40"
          >
            Discover the AI Architecture
          </a>
        </div>
        <p className="mt-6 text-[12px] tracking-[-0.01em] text-muted">Powered by LangGraph · Gemini · PostgreSQL</p>
      </motion.div>
      <motion.div
        initial={false}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: reduce ? 0 : 0.6, delay: reduce ? 0 : 0.08, ease: [0.22, 1, 0.36, 1] }}
      >
        <ArchitectureVisual />
      </motion.div>
    </section>
  );
}
