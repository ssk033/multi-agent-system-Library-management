export default function DashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-24 rounded bg-border" />
      <div className="mt-3 h-8 w-64 rounded bg-border" />
      <div className="mt-3 h-4 w-80 rounded bg-border" />
      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="panel h-24" />
        ))}
      </div>
    </div>
  );
}
