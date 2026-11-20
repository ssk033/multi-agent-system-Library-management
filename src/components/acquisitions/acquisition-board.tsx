"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label, Textarea } from "@/components/ui/input";
import { formatDate } from "@/lib/utils";

interface RequestRow {
  id: string;
  bookTitle: string;
  author: string | null;
  reason: string;
  studentName: string | null;
  rollNo: string | null;
  suggestedCategory: string | null;
  suggestedDeweyDecimal: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  librarianComment: string | null;
  createdAt: string;
}

export function AcquisitionBoard() {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RequestRow | null>(null);
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [comment, setComment] = useState("");
  const [isbn, setIsbn] = useState("");
  const [copies, setCopies] = useState("1");
  const [category, setCategory] = useState("");

  async function load() {
    const response = await fetch("/api/acquisitions");
    const body = await response.json();
    if (!body.ok) setError(body.error);
    else setRows(body.data);
  }

  useEffect(() => {
    void fetch("/api/acquisitions").then(async (response) => {
      const body = await response.json();
      if (!body.ok) setError(body.error);
      else setRows(body.data);
    });
  }, []);

  async function submitDecision() {
    if (!selected) return;
    const response = await fetch(`/api/acquisitions/${selected.id}/${decision}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comment }),
    });
    const body = await response.json();
    if (!body.ok) setError(body.error);
    setSelected(null);
    setComment("");
    await load();
  }

  async function catalog(row: RequestRow) {
    const response = await fetch(`/api/acquisitions/${row.id}/catalog`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isbn, totalCopies: Number(copies), category: category || row.suggestedCategory || "Computer Science", description: row.reason }),
    });
    const body = await response.json();
    if (!body.ok) setError(body.error);
    else {
      setIsbn("");
      await load();
    }
  }

  return (
    <div>
      <div className="mb-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Human in the loop</p>
        <h1 className="mt-1 text-[1.55rem] font-semibold tracking-[-0.035em]">Acquisitions</h1>
        <p className="mt-1.5 max-w-2xl text-[13px] text-muted">The assistant can open a request. It stays pending until a librarian approves or rejects it.</p>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="grid gap-4">
        {rows.map((row) => (
          <article key={row.id} className="panel p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">{row.bookTitle}</h2>
                <p className="text-sm text-muted">{row.author ?? "Author not supplied"} · {row.studentName ?? "No student"} {row.rollNo ? `(${row.rollNo})` : ""}</p>
              </div>
              <Badge tone={row.status === "APPROVED" ? "emerald" : row.status === "REJECTED" ? "rose" : "amber"}>{row.status}</Badge>
            </div>
            <p className="mt-3 text-sm">{row.reason}</p>
            <p className="mt-2 text-xs text-muted">Suggested category: {row.suggestedCategory ?? "n/a"} · Dewey suggestion: {row.suggestedDeweyDecimal ?? "n/a"} · {formatDate(row.createdAt)}</p>
            {row.librarianComment && <p className="mt-2 text-sm">Librarian note: {row.librarianComment}</p>}
            {row.status === "PENDING" && (
              <div className="mt-4 flex gap-2">
                <Button onClick={() => { setSelected(row); setDecision("approve"); }}>Approve</Button>
                <Button variant="danger" onClick={() => { setSelected(row); setDecision("reject"); }}>Reject</Button>
              </div>
            )}
            {row.status === "APPROVED" && (
              <div className="mt-4 grid gap-2 md:grid-cols-[1fr_120px_1fr_auto]">
                <Input placeholder="ISBN to catalog" value={isbn} onChange={(event) => setIsbn(event.target.value)} />
                <Input placeholder="Copies" value={copies} onChange={(event) => setCopies(event.target.value)} />
                <Input placeholder="Category" value={category} onChange={(event) => setCategory(event.target.value)} />
                <Button variant="secondary" onClick={() => void catalog(row)}>Add to catalog</Button>
              </div>
            )}
          </article>
        ))}
      </div>
      <Dialog open={Boolean(selected)} title={decision === "approve" ? "Approve request" : "Reject request"} onClose={() => setSelected(null)}>
        <Label>Comment<Textarea value={comment} onChange={(event) => setComment(event.target.value)} /></Label>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setSelected(null)}>Cancel</Button>
          <Button onClick={() => void submitDecision()}>Confirm {decision}</Button>
        </div>
      </Dialog>
    </div>
  );
}
