const STACK = ["Next.js", "LangGraph", "Gemini", "PostgreSQL", "pgvector", "Drizzle ORM", "TypeScript"];

export function StackSection() {
  return (
    <section id="platform" className="scroll-mt-24 border-t border-border">
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Platform</p>
        <p className="mt-6 flex flex-wrap items-center text-[15px] tracking-[-0.03em]">
          {STACK.map((name, index) => (
            <span key={name} className="inline-flex items-center">
              {index > 0 && <span className="mx-3 text-border sm:mx-4" aria-hidden="true">/</span>}
              {name}
            </span>
          ))}
        </p>
      </div>
    </section>
  );
}