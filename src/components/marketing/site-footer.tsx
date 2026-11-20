"use client";

import { BrandLockup } from "@/components/brand/logo";

export function SiteFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 py-10 sm:px-6 md:flex-row md:items-end md:justify-between">
        <div className="max-w-sm">
          <BrandLockup />
          <p className="mt-3 text-[13px] leading-6 text-muted">
            A multi-agent library desk. The supervisor delegates. Specialists call fixed tools. Purchases wait for a librarian.
          </p>
        </div>
        <div className="text-[12px] leading-6 text-muted">
          <p>LangGraph · Gemini · PostgreSQL · pgvector</p>
          <p className="mt-1 flex gap-4">
            <a
              href="/login"
              onClick={(event) => {
                event.preventDefault();
                window.location.assign("/login");
              }}
              className="text-foreground"
            >
              Sign in
            </a>
            <a href="#architecture" className="text-foreground">
              Architecture
            </a>
          </p>
          <p className="mt-4">© {new Date().getFullYear()} Autonomous Library</p>
        </div>
      </div>
    </footer>
  );
}
