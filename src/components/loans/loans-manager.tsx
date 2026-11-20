"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { dueLabel, formatDate } from "@/lib/utils";
import type { LoanDTO, UserRole } from "@/types";

export function LoansManager({ role, mode }: { role: UserRole; mode: "loans" | "returns" }) {
  const [loans, setLoans] = useState<LoanDTO[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [bookId, setBookId] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [pending, setPending] = useState<LoanDTO | null>(null);
  const [action, setAction] = useState<"return" | "renew">("return");

  async function load() {
    const response = await fetch(mode === "returns" ? "/api/loans?status=HELD" : "/api/loans");
    const body = await response.json();
    if (!body.ok) setError(body.error);
    else {
      setError(null);
      setLoans(mode === "loans" && role !== "STUDENT" ? body.data.filter((loan: LoanDTO) => loan.status !== "RETURNED") : body.data);
    }
  }

  useEffect(() => {
    const url = mode === "returns" ? "/api/loans?status=HELD" : "/api/loans";
    void fetch(url).then(async (response) => {
      const body = await response.json();
      if (!body.ok) setError(body.error);
      else {
        setError(null);
        setLoans(mode === "loans" && role !== "STUDENT" ? body.data.filter((loan: LoanDTO) => loan.status !== "RETURNED") : body.data);
      }
    });
  }, [mode, role]);

  async function issue() {
    const response = await fetch("/api/loans/issue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId, rollNo }),
    });
    const body = await response.json();
    if (!body.ok) setError(body.error);
    else {
      setBookId("");
      setRollNo("");
      await load();
    }
  }

  async function confirm() {
    if (!pending) return;
    const response = await fetch(action === "return" ? "/api/loans/return" : "/api/loans/renew", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loanId: pending.id }),
    });
    const body = await response.json();
    if (!body.ok) setError(body.error);
    setPending(null);
    await load();
  }

  return (
    <div>
      <div className="mb-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Circulation</p>
        <h1 className="mt-1 text-[1.55rem] font-semibold tracking-[-0.035em]">{mode === "returns" ? "Returns" : "Loans"}</h1>
        <p className="mt-1.5 text-[13px] text-muted">
          {role === "STUDENT"
            ? "Borrow a book from the catalogue. Return or renew the copies already on your account here."
            : "Each issue, return, and renewal commits copies, status, and fines together."}
        </p>
      </div>
      {role !== "STUDENT" && mode === "loans" && (
        <div className="panel mb-3 grid gap-3 p-3 md:grid-cols-[1fr_1fr_auto]">
          <Label>Book id<Input value={bookId} onChange={(event) => setBookId(event.target.value)} placeholder="UUID from the catalog" /></Label>
          <Label>Roll number<Input value={rollNo} onChange={(event) => setRollNo(event.target.value)} placeholder="CS2021001" /></Label>
          <Button className="self-end" onClick={() => void issue()}>Issue book</Button>
        </div>
      )}
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="panel overflow-x-auto">
        <table className="data-table min-w-[760px]">
          <thead>
            <tr>
              <th>Borrower</th>
              <th>Book</th>
              <th>Issued</th>
              <th>Due</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loans.map((loan) => (
              <tr key={loan.id} className="border-b border-border last:border-0">
                <td>{loan.studentName}<p className="text-[12px] text-muted">{loan.rollNo}</p></td>
                <td className="font-medium">{loan.bookTitle}</td>
                <td>{formatDate(loan.issuedAt)}</td>
                <td>{formatDate(loan.dueDate)}<p className="text-[12px] text-muted">{dueLabel(loan.dueDate)}</p></td>
                <td><Badge tone={loan.status === "OVERDUE" ? "rose" : loan.status === "RETURNED" ? "slate" : "emerald"}>{loan.status}</Badge><p className="mt-1 text-[12px] text-muted">₹{loan.projectedFine.toFixed(2)}</p></td>
                <td className="text-right">
                  {loan.status !== "RETURNED" && (
                    <div className="flex justify-end gap-2">
                      <Button size="sm" variant="secondary" onClick={() => { setAction("renew"); setPending(loan); }}>Renew</Button>
                      <Button size="sm" onClick={() => { setAction("return"); setPending(loan); }}>Return</Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={Boolean(pending)} title={action === "return" ? "Confirm return" : "Confirm renewal"} onClose={() => setPending(null)}>
        <p className="text-sm">{action === "return" ? `Return ${pending?.bookTitle}? A fine is stored if the loan is overdue.` : `Renew ${pending?.bookTitle}? Overdue loans and accounts with fines are rejected.`}</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setPending(null)}>Cancel</Button>
          <Button onClick={() => void confirm()}>Confirm</Button>
        </div>
      </Dialog>
    </div>
  );
}
