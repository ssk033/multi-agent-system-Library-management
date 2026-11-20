"use client";

import { Button } from "@/components/ui/button";

export function Dialog({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#101626]/55 p-4 backdrop-blur-[2px] sm:items-center" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-5 shadow-[0_24px_80px_-32px_rgba(16,22,38,0.45)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted">Confirmation</p>
            <h2 className="mt-1 text-base font-semibold tracking-[-0.02em]">{title}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} type="button">Close</Button>
        </div>
        {children}
      </div>
    </div>
  );
}
