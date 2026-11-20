"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";

interface StudentRow {
  id: string;
  name: string;
  email: string;
  rollNo: string;
  department: string | null;
  semester: number | null;
  activeLoansCount: number;
  finesDue: number;
  status: "ACTIVE" | "INACTIVE";
}

export function StudentManager() {
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", rollNo: "", department: "", semester: "1" });

  async function load() {
    const response = await fetch("/api/students");
    const body = await response.json();
    if (!body.ok) setError(body.error);
    else setRows(body.data);
  }

  useEffect(() => {
    void fetch("/api/students").then(async (response) => {
      const body = await response.json();
      if (!body.ok) setError(body.error);
      else setRows(body.data);
    });
  }, []);

  async function createStudent() {
    const response = await fetch("/api/students", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, semester: Number(form.semester), department: form.department || null }),
    });
    const body = await response.json();
    if (!body.ok) setError(body.error);
    else {
      setForm({ name: "", email: "", password: "", rollNo: "", department: "", semester: "1" });
      await load();
    }
  }

  async function setStatus(id: string, status: "ACTIVE" | "INACTIVE") {
    const response = await fetch(`/api/students/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    const body = await response.json();
    if (!body.ok) setError(body.error);
    else await load();
  }

  return (
    <div>
      <div className="mb-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Directory</p>
        <h1 className="mt-1 text-[1.55rem] font-semibold tracking-[-0.035em]">Students</h1>
      </div>
      <div className="panel mb-3 grid gap-3 p-3 md:grid-cols-3">
        <Label>Name<Input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Label>
        <Label>Email<Input value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Label>
        <Label>Password<Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /></Label>
        <Label>Roll number<Input value={form.rollNo} onChange={(event) => setForm({ ...form, rollNo: event.target.value })} /></Label>
        <Label>Department<Input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></Label>
        <Label>Semester<Input value={form.semester} onChange={(event) => setForm({ ...form, semester: event.target.value })} /></Label>
        <Button onClick={() => void createStudent()}>Register student</Button>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="panel overflow-x-auto">
        <table className="data-table min-w-[760px]">
          <thead>
            <tr>
              <th>Student</th>
              <th>Loans</th>
              <th>Fines</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((student) => (
              <tr key={student.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <Link className="font-medium hover:underline" href={`/students/${student.id}`}>{student.name}</Link>
                  <p className="text-xs text-muted">{student.rollNo} · {student.email}</p>
                </td>
                <td className="px-4 py-3">{student.activeLoansCount}</td>
                <td className="px-4 py-3">{formatCurrency(student.finesDue)}</td>
                <td className="px-4 py-3">
                  <Badge tone={student.status === "ACTIVE" ? "emerald" : "rose"}>{student.status}</Badge>
                  <Select className="mt-2" value={student.status} onChange={(event) => void setStatus(student.id, event.target.value as "ACTIVE" | "INACTIVE")}>
                    <option value="ACTIVE">ACTIVE</option>
                    <option value="INACTIVE">INACTIVE</option>
                  </Select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
