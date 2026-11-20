"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatDate } from "@/lib/utils";

export function BorrowButton({
  bookId,
  title,
  available,
  onBorrowed,
}: {
  bookId: string;
  title: string;
  available: boolean;
  onBorrowed?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/loans/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId }),
    });
    const body = await response.json();
    setBusy(false);
    if (!body.ok) {
      setError(body.error ?? "This book could not be borrowed.");
      return;
    }
    setOpen(false);
    setNotice(`On your account until ${formatDate(body.data.dueDate)}.`);
    onBorrowed?.();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button size="sm" disabled={!available || busy} onClick={() => { setError(null); setOpen(true); }}>
        {available ? "Borrow" : "Unavailable"}
      </Button>
      {notice && <p className="max-w-40 text-right text-[11px] text-success">{notice}</p>}
      <Dialog open={open} title="Confirm borrow" onClose={() => { if (!busy) setOpen(false); }}>
        <p className="text-sm leading-6">Borrow <span className="font-medium">{title}</span>? One copy is reserved for 14 days, or for the duration set by the library. Outstanding fines and the three-book limit still apply.</p>
        {error && <p className="mt-3 text-sm text-danger">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" type="button" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button>
          <Button type="button" disabled={busy} onClick={() => void confirm()}>{busy ? "Borrowing..." : "Confirm borrow"}</Button>
        </div>
      </Dialog>
    </div>
  );
}
