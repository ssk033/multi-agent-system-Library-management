"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input, Label, Textarea } from "@/components/ui/input";
import type { UserRole } from "@/types";

interface Policy {
  id: string;
  policyName: string;
  policyContent: string;
  category: string | null;
}

export function PolicyManager({ role }: { role: UserRole }) {
  const [rows, setRows] = useState<Policy[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ id: "", policyName: "", policyContent: "", category: "" });

  async function load(search?: string) {
    const response = await fetch(search ? `/api/policies?q=${encodeURIComponent(search)}` : "/api/policies");
    const body = await response.json();
    if (!body.ok) setError(body.error);
    else setRows(body.data);
  }

  useEffect(() => {
    void fetch("/api/policies").then(async (response) => {
      const body = await response.json();
      if (!body.ok) setError(body.error);
      else setRows(body.data);
    });
  }, []);

  async function save() {
    const response = await fetch("/api/policies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: draft.id || undefined,
        policyName: draft.policyName,
        policyContent: draft.policyContent,
        category: draft.category || null,
      }),
    });
    const body = await response.json();
    if (!body.ok) setError(body.error);
    else {
      setDraft({ id: "", policyName: "", policyContent: "", category: "" });
      await load();
    }
  }

  return (
    <div>
      <div className="mb-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Knowledge base</p>
        <h1 className="mt-1 text-[1.55rem] font-semibold tracking-[-0.035em]">Policies</h1>
        <p className="mt-1.5 text-[13px] text-muted">Discovery retrieves these passages before answering a policy question.</p>
      </div>
      <div className="flex gap-2">
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search policy text" />
        <Button variant="secondary" onClick={() => void load(query)}>Search</Button>
      </div>
      {error && <p className="text-sm text-rose-600">{error}</p>}
      <div className="grid gap-3">
        {rows.map((policy) => (
          <article key={policy.id} className="panel p-4">
            <h2 className="font-semibold">{policy.policyName}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">{policy.policyContent}</p>
            {role === "ADMIN" && <Button className="mt-3" size="sm" variant="secondary" onClick={() => setDraft({ id: policy.id, policyName: policy.policyName, policyContent: policy.policyContent, category: policy.category ?? "" })}>Edit</Button>}
          </article>
        ))}
      </div>
      {role === "ADMIN" && (
        <div className="panel grid gap-3 p-4">
          <Label>Policy name<Input value={draft.policyName} onChange={(event) => setDraft({ ...draft, policyName: event.target.value })} /></Label>
          <Label>Category<Input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} /></Label>
          <Label>Content<Textarea value={draft.policyContent} onChange={(event) => setDraft({ ...draft, policyContent: event.target.value })} /></Label>
          <Button onClick={() => void save()}>Save policy</Button>
        </div>
      )}
    </div>
  );
}
