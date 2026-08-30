"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { MediationEvent } from "@/src/engine/domain";
import { exportSessionSnapshot, loadSessionSnapshot, type SessionSnapshot } from "@/src/session-storage";

type Filter = "all" | "both" | "A" | "B";

function label(event: MediationEvent<string>) {
  const parties = event.audience.filter((id) => id === "A" || id === "B");
  return parties.length === 2 ? "Both Parties" : parties[0] ? `Party ${parties[0]} only` : "Mediator only";
}

function text(event: MediationEvent<string>) {
  const payload = event.payload as Record<string, unknown>;
  if (typeof payload.text === "string") return payload.text;
  if (payload.type === "session_opened") return "The joint Session opened.";
  if (payload.type === "caucus_begin") return `Caucus with Party ${String(payload.party)} began.`;
  if (payload.type === "caucus_end") return `Caucus with Party ${String(payload.party)} ended.`;
  if (payload.type === "session_ended") return `Session ended: ${String(payload.outcome)}.`;
  return event.kind.replace("_", " ");
}

export function ReviewWorkspace({ sessionId, scenarioTitle }: { sessionId: string; scenarioTitle: string }) {
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSnapshot(loadSessionSnapshot(sessionId)), 0);
    return () => window.clearTimeout(timer);
  }, [sessionId]);
  const events = useMemo(() => snapshot?.session.log.filter((event) => {
    if (filter === "all") return true;
    const hasA = event.audience.includes("A");
    const hasB = event.audience.includes("B");
    if (filter === "both") return hasA && hasB;
    return event.audience.includes(filter) && !(hasA && hasB);
  }) ?? [], [filter, snapshot]);

  if (!snapshot) return <main className="grid min-h-[100dvh] place-items-center bg-[var(--surface)] p-6"><div className="max-w-md text-center"><h1 className="text-2xl font-semibold">No saved Session found</h1><p className="mt-2 text-[var(--muted)]">Return to the Scenario library and begin a new Session.</p><Link className="button-primary mt-5" href="/">Scenario library</Link></div></main>;

  const outcomeEvent = [...snapshot.session.log].reverse().find((event) => (event.payload as { type?: string }).type === "session_ended");
  const outcome = (outcomeEvent?.payload as { outcome?: string } | undefined)?.outcome ?? "complete";

  return <main className="min-h-[100dvh] bg-[var(--surface)] px-5 py-7 text-[var(--ink)] sm:px-8">
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--line)] pb-6">
        <div><p className="text-sm font-semibold text-[var(--accent)]">Post-Session review</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">{scenarioTitle}</h1><p className="mt-2 font-mono text-xs text-[var(--muted)]">Session {sessionId.slice(0, 8)} · {outcome}</p></div>
        <div className="flex gap-2"><button className="button-secondary" onClick={() => exportSessionSnapshot(snapshot)}>Export</button><Link className="button-primary" href="/">New Session</Link></div>
      </header>

      <div className="grid gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <section>
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Event log</h2><label className="flex items-center gap-2 text-sm font-semibold">Audience <select className="audience-select" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}><option value="all">All Events</option><option value="both">Both Parties</option><option value="A">Party A only</option><option value="B">Party B only</option></select></label></div>
          <ol className="mt-5 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {events.map((event) => <li className="grid gap-2 py-4 sm:grid-cols-[8rem_minmax(0,1fr)]" key={event.id}><div><p className="font-semibold">{event.sender === "Z" ? "Mediator" : event.sender === "SYSTEM" ? "Session" : `Party ${event.sender}`}</p><p className="mt-1 text-xs text-[var(--muted)]">{label(event)}</p></div><p className="leading-7">{text(event)}</p></li>)}
          </ol>
        </section>

        <aside className="self-start rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-5 lg:sticky lg:top-6">
          <h2 className="text-lg font-semibold">Mediator reflection</h2>
          <label className="field mt-4"><span>What worked?</span><textarea className="review-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={6} /></label>
          <p className="mt-3 text-xs leading-5 text-[var(--muted)]">Reflection stays local and is not included in the Event log.</p>
        </aside>
      </div>
    </div>
  </main>;
}
