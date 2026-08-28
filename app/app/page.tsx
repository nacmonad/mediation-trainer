"use client";

import { useMemo, useState } from "react";

import { createSession, type AgentSeat, type SeatConfig } from "@/src/engine/domain";
import { TurnDriver } from "@/src/engine/driver";
import { ScriptedRuntime } from "@/src/engine/scripted-runtime";
import { SessionActor } from "@/src/engine/session-actor";

type Id = "A" | "B" | "Z";
const party = (id: "A" | "B"): AgentSeat => ({ id, role: "party", kind: "agent", model: { provider: "ollama", model: "scripted" } });

function makeActor() {
  const seats: readonly SeatConfig[] = [party("A"), party("B"), { id: "Z", role: "mediator", kind: "human" }];
  const session = createSession<Id>(seats);
  return new SessionActor(new TurnDriver(session, {
    A: new ScriptedRuntime([
      { utterance: "Our Position is that the outstanding invoices should be paid.", reaction: { trustMediatorDelta: 3 } },
      { utterance: "Privately, timing matters more than the entire amount.", reaction: { rigidityDelta: -8 } },
    ]),
    B: new ScriptedRuntime([
      { utterance: "We can discuss a schedule, but not the full stated Position.", reaction: { willingnessToSettleDelta: 6 } },
      { utterance: "A clean end to the dispute has value to us.", reaction: { rigidityDelta: -5 } },
    ]),
  }));
}

export default function Home() {
  const actor = useMemo(() => makeActor(), []);
  const [phase, setPhase] = useState(actor.phase);
  const [text, setText] = useState("Please explain what brought you both here.");
  const [error, setError] = useState("");

  async function act(event: unknown) {
    setError("");
    try {
      await actor.dispatch(event);
      setPhase(actor.phase);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  const active = phase === "joint_session" || phase === "caucus";
  const audience = phase === "caucus" && actor.session.caucusWith ? [actor.session.caucusWith] : ["A", "B"];

  return <main className="mx-auto min-h-screen max-w-4xl space-y-6 px-6 py-12">
    <header>
      <p className="text-sm font-semibold uppercase tracking-[.2em] text-emerald-700">Mediator training</p>
      <h1 className="mt-2 text-4xl font-semibold">Session actor vertical slice</h1>
      <p className="mt-2 text-zinc-600">Session phase: <strong>{phase}</strong> · scripted Parties · no provider keys</p>
    </header>

    <section className="rounded-2xl border bg-white p-5 shadow-sm">
      <div className="flex flex-wrap gap-2">
        {phase === "setup" && <button onClick={() => act({ type: "OPEN_SESSION" })}>Open Session</button>}
        {phase === "joint_session" && <>
          <button onClick={() => act({ type: "OPEN_CAUCUS", partyId: "A" })}>Caucus with A</button>
          <button onClick={() => act({ type: "OPEN_CAUCUS", partyId: "B" })}>Caucus with B</button>
          <button onClick={() => act({ type: "DECLARE_AGREEMENT" })}>Declare agreement</button>
          <button onClick={() => act({ type: "DECLARE_IMPASS" })}>Declare impasse</button>
        </>}
        {phase === "caucus" && <button onClick={() => act({ type: "CLOSE_CAUCUS" })}>Close caucus</button>}
        {(["agreement", "impasse", "walkout"] as string[]).includes(phase) && <button onClick={() => act({ type: "ENTER_REVIEW" })}>Enter review</button>}
      </div>
      {active && <div className="mt-5 flex gap-2">
        <input className="min-w-0 flex-1 rounded-lg border px-3 py-2" value={text} onChange={(event) => setText(event.target.value)} />
        <button disabled={!text.trim()} onClick={() => act({ type: "SEND", audience, text })}>Send</button>
      </div>}
      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}
    </section>

    <section className="space-y-3" aria-live="polite">
      {actor.session.log.map((event) => <article className="rounded-xl border bg-white p-4" key={event.id}>
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{event.sender} · {event.kind} · audience {event.audience.join(", ")}</p>
        <p className="mt-2 text-sm">{JSON.stringify(event.payload)}</p>
      </article>)}
    </section>
  </main>;
}
