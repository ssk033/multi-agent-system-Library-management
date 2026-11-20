"use client";

import { motion } from "framer-motion";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const grid = "#e6e9f0";
const tick = { fontSize: 11, fill: "#667085" };

export function KpiGrid({ cards }: { cards: { id: string; label: string; value: string; hint: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card, index) => (
        <motion.article
          key={card.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.03, duration: 0.25 }}
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
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="month" tick={tick} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} width={28} />
          <Tooltip />
          <Line type="monotone" dataKey="issues" name="Issued" stroke="#5145cd" strokeWidth={1.75} dot={false} />
          <Line type="monotone" dataKey="returns" name="Returned" stroke="#98a2b3" strokeWidth={1.75} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryChart({ data }: { data: { category: string; count: number }[] }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey="category" hide />
          <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} width={28} />
          <Tooltip />
          <Bar dataKey="count" name="Titles" fill="#5145cd" radius={[4, 4, 0, 0]} />
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
          <CartesianGrid stroke={grid} vertical={false} />
          <XAxis dataKey={xKey} tick={tick} interval={0} angle={-18} height={64} axisLine={false} tickLine={false} />
          <YAxis allowDecimals={false} tick={tick} axisLine={false} tickLine={false} width={28} />
          <Tooltip />
          <Bar dataKey={yKey} fill="#7565e8" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
