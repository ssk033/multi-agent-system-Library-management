import Link from "next/link";
import { CategoryChart, CirculationChart, KpiGrid } from "@/components/charts/overview-charts";
import { PageHeader } from "@/components/ui/page-header";
import { auth } from "@/lib/auth";
import { formatDate } from "@/lib/utils";
import { getOverview } from "@/services/analyticsService";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const session = await auth();
  if (!session?.user) return null;
  let data: Awaited<ReturnType<typeof getOverview>> | null = null;
  let message = "The database is not ready.";
  try {
    data = await getOverview(session.user);
  } catch (error) {
    message = error instanceof Error ? error.message : message;
  }
  if (!data) {
    return <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{message}</p>;
  }
  const staff = session.user.role !== "STUDENT";
  return (
    <div>
      <PageHeader
        eyebrow={session.user.role}
        title={staff ? "Library overview" : `Hello, ${session.user.name ?? "there"}`}
        description={staff ? "Live counts from the library database for the signed-in role." : "Your loans, fines, and the catalog you can search."}
        actions={
          <Link href="/assistant" className="inline-flex h-9 items-center rounded-lg bg-primary px-3 text-[13px] font-medium text-primary-foreground">
            Ask the assistant
          </Link>
        }
      />
      <KpiGrid cards={data.cards} />
      <div className={`mt-4 grid gap-3 ${staff ? "xl:grid-cols-2" : ""}`}>
        {staff && (
          <section className="panel p-4">
            <h2 className="mb-3 text-sm font-semibold">Borrowing activity</h2>
            <CirculationChart data={data.monthly} />
          </section>
        )}
        <section className="panel p-4">
          <h2 className="mb-3 text-sm font-semibold">Book categories</h2>
          <CategoryChart data={data.categories} />
        </section>
      </div>
      <div className="mt-8 grid gap-8 border-t border-border pt-6 lg:grid-cols-2">
        <RecordList title={staff ? "Recent transactions" : "Your loans"} empty="No loans recorded yet." rows={data.recentLoans.map((row) => ({ id: row.id, primary: row.title, secondary: `${staff ? row.borrower + " · " : ""}${row.status} · due ${formatDate(row.dueDate)}` }))} />
        <RecordList title="Due dates" empty="Nothing is due." rows={data.dueSoon.map((row) => ({ id: row.id, primary: row.title, secondary: `${staff ? row.borrower + " · " : ""}${row.status} · ${formatDate(row.dueDate)}` }))} />
        <RecordList title="Recently added books" empty="The catalog is empty." rows={data.recentBooks.map((row) => ({ id: row.id, primary: row.title, secondary: row.author }))} />
        <RecordList title="Recent agent activity" empty="No assistant runs have been recorded yet." rows={data.agentEvents.map((row) => ({ id: row.id, primary: row.agent, secondary: row.message }))} />
      </div>
      {data.popular.length > 0 && (
        <section className="mt-8 border-t border-border pt-6">
          <h2 className="text-sm font-semibold">Most borrowed</h2>
          <ul className="mt-3 divide-y divide-border text-[13px]">
            {data.popular.map((book) => (
              <li key={book.title} className="flex items-center justify-between gap-3 py-2.5">
                <span>{book.title}<span className="text-muted"> · {book.author}</span></span>
                <span className="font-medium tabular-nums">{book.borrowCount}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function RecordList({ title, empty, rows }: { title: string; empty: string; rows: { id: string; primary: string; secondary: string }[] }) {
  return (
    <section>
      <h2 className="text-sm font-semibold tracking-[-0.02em]">{title}</h2>
      {rows.length === 0 ? <p className="mt-3 text-[13px] text-muted">{empty}</p> : (
        <ul className="mt-2 divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="py-2.5">
              <p className="text-[13px] font-medium">{row.primary}</p>
              <p className="truncate text-[12px] text-muted">{row.secondary}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
