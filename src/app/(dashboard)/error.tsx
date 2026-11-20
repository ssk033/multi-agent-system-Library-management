"use client";

export default function DashboardError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="panel border-rose-200 p-5">
      <h2 className="text-sm font-semibold text-rose-800">This page could not be loaded</h2>
      <p className="mt-2 text-[13px] text-rose-700">{error.message}</p>
      <button className="mt-4 h-9 rounded-lg bg-[#b42318] px-3 text-[13px] text-white" onClick={reset}>Try again</button>
    </div>
  );
}
