export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#f7f8fc] text-[#151b2b]">
      <div className="text-center">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#667085]">404</p>
        <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em]">Page not found</h1>
        <a className="mt-4 inline-block text-sm text-[#5145cd]" href="/overview">Return to overview</a>
      </div>
    </main>
  );
}
