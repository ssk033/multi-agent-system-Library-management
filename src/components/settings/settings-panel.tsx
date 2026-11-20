"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { formatDateTime } from "@/lib/utils";

interface Settings {
  maxLoansPerStudent: number;
  loanDurationDays: number;
  finePerDay: number;
  renewalLimit: number;
  renewalDurationDays: number;
  blockBorrowWhenFinesDue: boolean;
}

interface StaffUser {
  id: string;
  name: string;
  email: string;
  role: "STUDENT" | "LIBRARIAN" | "ADMIN";
}

interface AuditRow {
  id: string;
  action: string;
  details: string | null;
  userName: string | null;
  createdAt: string;
}

export function SettingsPanel() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [staff, setStaff] = useState({ name: "", email: "", password: "", role: "LIBRARIAN" });

  async function load() {
    const [settingsResponse, usersResponse, auditResponse] = await Promise.all([
      fetch("/api/settings"),
      fetch("/api/users"),
      fetch("/api/audit"),
    ]);
    const settingsBody = await settingsResponse.json();
    const usersBody = await usersResponse.json();
    const auditBody = await auditResponse.json();
    if (!settingsBody.ok) setError(settingsBody.error);
    else setSettings(settingsBody.data);
    if (usersBody.ok) setUsers(usersBody.data);
    if (auditBody.ok) setAudit(auditBody.data);
  }

  useEffect(() => {
    void Promise.all([fetch("/api/settings"), fetch("/api/users"), fetch("/api/audit")]).then(async ([settingsResponse, usersResponse, auditResponse]) => {
      const settingsBody = await settingsResponse.json();
      const usersBody = await usersResponse.json();
      const auditBody = await auditResponse.json();
      if (!settingsBody.ok) setError(settingsBody.error);
      else setSettings(settingsBody.data);
      if (usersBody.ok) setUsers(usersBody.data);
      if (auditBody.ok) setAudit(auditBody.data);
    });
  }, []);

  async function save() {
    if (!settings) return;
    const response = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    const body = await response.json();
    if (!body.ok) setError(body.error);
    else setSettings(body.data);
  }

  async function createStaff() {
    const response = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(staff),
    });
    const body = await response.json();
    if (!body.ok) setError(body.error);
    else await load();
  }

  async function changeRole(userId: string, role: "LIBRARIAN" | "ADMIN") {
    const response = await fetch("/api/users", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, role }),
    });
    const body = await response.json();
    if (!body.ok) setError(body.error);
    else await load();
  }

  async function rebuild() {
    const response = await fetch("/api/books/embeddings", { method: "POST" });
    const body = await response.json();
    if (!body.ok) setError(body.error);
    else setError(`Embeddings updated. Books: ${body.data.booksUpdated}, policies: ${body.data.policiesUpdated}.`);
  }

  if (!settings) return <p className="text-sm text-muted">Loading settings...</p>;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Administration</p>
        <h1 className="mt-1 text-[1.55rem] font-semibold tracking-[-0.035em]">Settings</h1>
        <p className="mt-1.5 text-[13px] text-muted">Circulation numbers are enforced from the database, not from the model.</p>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="panel grid gap-3 p-4 md:grid-cols-3">
        <Label>Max loans<Input type="number" value={settings.maxLoansPerStudent} onChange={(event) => setSettings({ ...settings, maxLoansPerStudent: Number(event.target.value) })} /></Label>
        <Label>Loan days<Input type="number" value={settings.loanDurationDays} onChange={(event) => setSettings({ ...settings, loanDurationDays: Number(event.target.value) })} /></Label>
        <Label>Fine per day (₹)<Input type="number" value={settings.finePerDay} onChange={(event) => setSettings({ ...settings, finePerDay: Number(event.target.value) })} /></Label>
        <Label>Renewal limit<Input type="number" value={settings.renewalLimit} onChange={(event) => setSettings({ ...settings, renewalLimit: Number(event.target.value) })} /></Label>
        <Label>Renewal days<Input type="number" value={settings.renewalDurationDays} onChange={(event) => setSettings({ ...settings, renewalDurationDays: Number(event.target.value) })} /></Label>
        <Label className="flex items-center gap-2">Block borrowing when fines are due
          <input type="checkbox" checked={settings.blockBorrowWhenFinesDue} onChange={(event) => setSettings({ ...settings, blockBorrowWhenFinesDue: event.target.checked })} />
        </Label>
        <Button onClick={() => void save()}>Save settings</Button>
        <Button variant="secondary" onClick={() => void rebuild()}>Generate missing embeddings</Button>
      </div>
      <div className="panel grid gap-3 p-4 md:grid-cols-4">
        <Label>Name<Input value={staff.name} onChange={(event) => setStaff({ ...staff, name: event.target.value })} /></Label>
        <Label>Email<Input value={staff.email} onChange={(event) => setStaff({ ...staff, email: event.target.value })} /></Label>
        <Label>Password<Input type="password" value={staff.password} onChange={(event) => setStaff({ ...staff, password: event.target.value })} /></Label>
        <Label>Role
          <Select value={staff.role} onChange={(event) => setStaff({ ...staff, role: event.target.value })}>
            <option value="LIBRARIAN">LIBRARIAN</option>
            <option value="ADMIN">ADMIN</option>
          </Select>
        </Label>
        <Button onClick={() => void createStaff()}>Create staff account</Button>
      </div>
      <div className="panel overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>User</th><th>Role</th></tr></thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">{user.name}<p className="text-xs text-muted">{user.email}</p></td>
                <td className="px-4 py-3">
                  {user.role === "STUDENT" ? "STUDENT" : (
                    <Select value={user.role} onChange={(event) => void changeRole(user.id, event.target.value as "LIBRARIAN" | "ADMIN")}>
                      <option value="LIBRARIAN">LIBRARIAN</option>
                      <option value="ADMIN">ADMIN</option>
                    </Select>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="panel p-4">
        <h2 className="font-semibold">Audit log</h2>
        <div className="mt-3 space-y-2">
          {audit.slice(0, 20).map((row) => (
            <p key={row.id} className="text-sm"><span className="font-medium">{row.action}</span> · {row.userName ?? "system"} · {row.details} · <span className="text-muted">{formatDateTime(row.createdAt)}</span></p>
          ))}
        </div>
      </div>
    </div>
  );
}
