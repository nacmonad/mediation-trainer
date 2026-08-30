export default function LoadingSession() {
  return (
    <main className="min-h-[100dvh] bg-[var(--surface)] p-5" aria-label="Loading Session">
      <div className="mx-auto grid max-w-7xl animate-pulse gap-4 lg:grid-cols-[14rem_minmax(0,1fr)_17rem]">
        <div className="h-40 rounded-2xl bg-[var(--line)]" />
        <div className="h-[70dvh] rounded-2xl bg-[var(--line)]" />
        <div className="h-56 rounded-2xl bg-[var(--line)]" />
      </div>
    </main>
  );
}
