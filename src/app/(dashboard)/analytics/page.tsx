import { CategoryChart, CirculationChart, SimpleBar } from "@/components/charts/overview-charts";
import { PageHeader } from "@/components/ui/page-header";
import { getAnalytics } from "@/services/analyticsService";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  let data: Awaited<ReturnType<typeof getAnalytics>> | null = null;
  let message = "Analytics are unavailable.";
  try {
    data = await getAnalytics();
  } catch (error) {
    message = error instanceof Error ? error.message : message;
  }
  if (!data) {
    return <p className="text-sm text-rose-600">{message}</p>;
  }
  return (
    <div>
      <PageHeader eyebrow="Reports" title="Analytics" description="Circulation, categories, borrowers, and acquisition volume from recorded transactions." />
      <div className="grid gap-3 xl:grid-cols-2">
        <section className="panel p-4"><h2 className="mb-3 text-sm font-semibold">Circulation</h2><CirculationChart data={data.monthly} /></section>
        <section className="panel p-4"><h2 className="mb-3 text-sm font-semibold">Categories</h2><CategoryChart data={data.categories} /></section>
        <section className="panel p-4"><h2 className="mb-3 text-sm font-semibold">Student borrowing</h2><SimpleBar data={data.borrowers} xKey="name" yKey="loans" /></section>
        <section className="panel p-4"><h2 className="mb-3 text-sm font-semibold">Acquisition requests</h2><SimpleBar data={data.acquisitions} xKey="month" yKey="count" /></section>
      </div>
    </div>
  );
}
