"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { CategoryChart } from "@/components/charts/overview-charts";
import { formatDateTime } from "@/lib/utils";

interface Activity {
  total: number;
  successful: number;
  failed: number;
  averageDurationMs: number;
  byAgent: { agent: string; total: number; success: number; failed: number; averageDurationMs: number }[];
  recent: { id: string; agentName: string; action: string; output: string | null; toolsUsed: string[]; status: string; createdAt: string; durationMs: number | null }[];
}

export function AgentMonitor() {
  const [data, setData] = useState<Activity | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/agent-logs").then(async (response) => {
      const body = await response.json();
      if (!body.ok) setError(body.error);
      else setData(body.data);
    });
  }, []);

  if (error) return <p className="text-sm text-rose-600">{error}</p>;
  if (!data) return <p className="text-sm text-muted">Loading agent activity...</p>;

  return (
    <div>
      <div className="mb-5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted">Operations</p>
        <h1 className="mt-1 text-[1.55rem] font-semibold tracking-[-0.035em]">Agent activity</h1>
        <p className="mt-1.5 text-[13px] text-muted">Counts come from execution rows written after each assistant turn.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        {[
          ["Executions", data.total],
          ["Successful", data.successful],
          ["Failed", data.failed],
          ["Avg ms", data.averageDurationMs],
        ].map(([label, value]) => (
          <article key={String(label)} className="panel p-4">
            <p className="text-sm text-muted">{label}</p>
            <p className="text-2xl font-semibold">{value}</p>
          </article>
        ))}
      </div>
      <div className="panel mt-3 p-4">
        <h2 className="mb-3 font-semibold">Agent usage in the recent window</h2>
        <CategoryChart data={data.byAgent.map((item) => ({ category: item.agent, count: item.total }))} />
      </div>
      <div className="space-y-2">
        {data.recent.length === 0 && <p className="text-sm text-muted">No agent runs have been recorded yet. Use the assistant to create some.</p>}
        {data.recent.map((row) => (
          <article key={row.id} className="panel px-4 py-3 text-[13px]">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={row.status === "error" ? "rose" : "indigo"}>{row.agentName}</Badge>
              <Badge>{row.action}</Badge>
              {row.toolsUsed.map((tool) => <Badge key={tool} tone="slate">{tool}</Badge>)}
              <span className="text-xs text-muted">{formatDateTime(row.createdAt)}{row.durationMs ? ` · ${row.durationMs} ms` : ""}</span>
            </div>
            <p className="mt-1">{row.output}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
