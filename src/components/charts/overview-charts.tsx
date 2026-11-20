"use client";

import { motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const tick = { fontSize: 11, fill: "var(--foreground)" };
const tooltipStyle = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  color: "var(--foreground)",
  fontSize: 12,
};

export function KpiGrid({ cards }: { cards: { id: string; label: string; value: string; hint: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => (
        <motion.article
          key={card.id}
          initial={false}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="panel px-4 py-3.5"
        >
          <p className="text-[12px] text-muted">{card.label}</p>
          <p className="mt-2 text-[1.7rem] font-semibold tracking-[-0.04em]">{card.value}</p>
          <p className="mt-1 text-[12px] text-muted">{card.hint}</p>
        </motion.article>
      ))}
    </div>
  );
}

export function CirculationChart({ data }: { data: { month: string; issues: number; returns: number }[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey="month" tick={tick} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} width={28} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--foreground)" }} itemStyle={{ color: "var(--foreground)" }} />
          <Line type="monotone" dataKey="issues" name="Issued" stroke="#5145cd" strokeWidth={1.75} dot={false} />
          <Line type="monotone" dataKey="returns" name="Returned" stroke="#98a2b3" strokeWidth={1.75} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryChart({ data }: { data: { category: string; count: number }[] }) {
  const height = Math.max(240, data.length * 32);
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ left: 4, right: 16, top: 4, bottom: 4 }}>
          <CartesianGrid stroke="var(--border)" horizontal={false} />
          <XAxis type="number" allowDecimals={false} tick={tick} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="category" width={210} tick={{ ...tick, fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--foreground)" }} itemStyle={{ color: "var(--foreground)" }} />
          <Bar dataKey="count" name="Titles" fill="var(--primary)" radius={[0, 4, 4, 0]} barSize={14} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SimpleBar({ data, xKey, yKey }: { data: object[]; xKey: string; yKey: string }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis dataKey={xKey} tick={tick} interval={0} angle={-18} height={64} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} width={28} />
          <Tooltip contentStyle={tooltipStyle} labelStyle={{ color: "var(--foreground)" }} itemStyle={{ color: "var(--foreground)" }} />
          <Bar dataKey={yKey} fill="var(--accent)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
