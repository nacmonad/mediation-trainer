"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { createSession, type AgentSeat, type MediationEvent, type SeatConfig } from "@/src/engine/domain";
import { TurnDriver } from "@/src/engine/driver";
import { ScriptedRuntime } from "@/src/engine/scripted-runtime";
import { SessionActor } from "@/src/engine/session-actor";
import type { Scenario } from "@/src/engine/scenario";
import { loadSessionSnapshot, saveSessionSnapshot, type SessionSnapshot } from "@/src/session-storage";

type Id = "A" | "B" | "Z";
type Resource = Scenario["resources"][number];
type AudienceChoice = "both" | "A" | "B";

const party = (id: "A" | "B"): AgentSeat => ({ id, role: "party", kind: "agent", model: { provider: "ollama", model: "scripted" } });

function makeActor(snapshot?: SessionSnapshot<Id> | null) {
  const seats: readonly SeatConfig[] = [party("A"), party("B"), { id: "Z", role: "mediator", kind: "human" }];
  const session = snapshot?.session ?? createSession<Id>(seats);
  const driver = new TurnDriver(session, {
    A: new ScriptedRuntime([
      { utterance: "We want a practical resolution, but the underlying harm must be acknowledged.", reaction: { trustMediatorDelta: 4 } },
      { utterance: "Privately, certainty matters more than holding every part of our Position.", reaction: { rigidityDelta: -7 } },
      { utterance: "That proposal moves the conversation, though important terms remain open.", reaction: { willingnessToSettleDelta: 5 } },
    ]),
    B: new ScriptedRuntime([
      { utterance: "We are prepared to listen, but we see the facts differently.", reaction: { trustMediatorDelta: 3 } },
      { utterance: "A durable agreement would need to address more than the headline number.", reaction: { rigidityDelta: -5 } },
      { utterance: "We can continue working from there.", reaction: { willingnessToSettleDelta: 6 } },
    ]),
  });
  if (snapshot) driver.invocations.push(...snapshot.invocations);
  return new SessionActor(driver, snapshot?.phase);
}

function eventText(event: MediationEvent<Id>): string {
  const payload = event.payload as Record<string, unknown>;
  if (typeof payload.text === "string") return payload.text;
  if (payload.type === "session_opened") return "The joint Session has opened.";
  if (payload.type === "caucus_begin") return `Caucus with Party ${String(payload.party)} begins.`;
  if (payload.type === "caucus_end") return `Caucus with Party ${String(payload.party)} ends.`;
  if (payload.type === "session_ended") return `Session ended: ${String(payload.outcome)}.`;
  if (event.kind === "offer" && typeof payload.amount === "number") return `Offer: $${payload.amount.toLocaleString()}`;
  return event.kind.replace("_", " ");
}

function audienceLabel(event: MediationEvent<Id>): string {
  const parties = event.audience.filter((id) => id === "A" || id === "B");
  if (parties.length === 2) return "Both Parties";
  if (parties[0] === "A") return "Party A only";
  if (parties[0] === "B") return "Party B only";
  return "Mediator only";
}

function toneFor(value: number): { label: string; tone: string } {
  if (value >= 75) return { label: "Escalation risk", tone: "danger" };
  if (value >= 45) return { label: "Pressured", tone: "warning" };
  return { label: "Engaged", tone: "steady" };
}

export function SessionWorkspace({ sessionId, scenario, resources }: { sessionId: string; scenario: Scenario; resources: Resource[] }) {
  const router = useRouter();
  const [actor, setActor] = useState(() => makeActor());
  const [phase, setPhase] = useState(actor.phase);
  const [revision, setRevision] = useState(0);
  const [text, setText] = useState("Thank you both for being here. What would make this conversation useful today?");
  const [audience, setAudience] = useState<AudienceChoice>("both");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [debug, setDebug] = useState(false);
  const [confirm, setConfirm] = useState<"agreement" | "impasse" | null>(null);
  const [recovered, setRecovered] = useState(false);
  void revision;

  useEffect(() => {
    const snapshot = loadSessionSnapshot<Id>(sessionId);
    if (!snapshot || snapshot.scenarioSlug !== scenario.slug) return;
    const timer = window.setTimeout(() => {
      const restored = makeActor(snapshot);
      setActor(restored);
      setPhase(restored.phase);
      setRecovered(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [scenario.slug, sessionId]);

  function persist() {
    saveSessionSnapshot({ version: 1, sessionId, scenarioSlug: scenario.slug, phase: actor.phase, savedAt: new Date().toISOString(), session: actor.session, invocations: [...actor.driver.invocations] });
  }

  async function act(event: unknown) {
    setError("");
    setPending(true);
    try {
      await actor.dispatch(event);
      persist();
      setPhase(actor.phase);
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPending(false);
    }
  }

  async function send() {
    const selected = phase === "caucus" && actor.session.caucusWith
      ? [actor.session.caucusWith]
      : audience === "both" ? ["A", "B"] : [audience];
    await act({ type: "SEND", audience: selected, text: text.trim() });
    setText("");
  }

  async function enterReview() {
    await actor.dispatch({ type: "ENTER_REVIEW" });
    persist();
    router.push(`/sessions/${sessionId}/review?scenario=${scenario.slug}`);
  }

  const active = phase === "joint_session" || phase === "caucus";
  const events = actor.session.log;
  const stateA = actor.session.runtimes.A?.negotiation;
  const stateB = actor.session.runtimes.B?.negotiation;

  return (
    <main className="min-h-[100dvh] bg-[var(--surface)] text-[var(--ink)]">
      <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[color-mix(in_srgb,var(--surface)_92%,transparent)] px-4 py-3 backdrop-blur sm:px-6">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{scenario.title}</p>
            <p className="truncate font-mono text-xs text-[var(--muted)]">Session {sessionId.slice(0, 8)} · {phase.replace("_", " ")}{recovered ? " · Recovered" : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="debug-toggle"><input type="checkbox" checked={debug} onChange={(event) => setDebug(event.target.checked)} /> Debug</label>
            <Link className="button-secondary hidden sm:inline-flex" href="/">Exit</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-[1500px] gap-4 p-4 lg:grid-cols-[14rem_minmax(0,1fr)_17rem] lg:p-6">
        <aside className="order-2 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 lg:order-1 lg:self-start" aria-label="Session status">
          <h2 className="font-semibold">Session phase</h2>
          <p className="mt-1 capitalize text-[var(--accent)]">{phase.replace("_", " ")}</p>
          <div className="mt-5 space-y-3">
            {(["A", "B"] as const).map((id) => {
              const state = id === "A" ? stateA : stateB;
              const status = toneFor(state?.anger ?? 0);
              return <div className={`party-status ${debug ? `debug-${status.tone}` : ""}`} key={id}>
                <p className="font-semibold">Party {id}</p>
                <p className="text-xs text-[var(--muted)]">{debug ? status.label : "Present"}</p>
              </div>;
            })}
          </div>
          {phase === "joint_session" && <div className="mt-5 grid gap-2">
            <button className="button-secondary" onClick={() => act({ type: "OPEN_CAUCUS", partyId: "A" })}>Caucus with A</button>
            <button className="button-secondary" onClick={() => act({ type: "OPEN_CAUCUS", partyId: "B" })}>Caucus with B</button>
          </div>}
          {phase === "caucus" && <button className="button-secondary mt-5 w-full" onClick={() => act({ type: "CLOSE_CAUCUS" })}>Close Caucus</button>}
        </aside>

        <section className="order-1 flex min-h-[72dvh] flex-col overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)] lg:order-2" aria-label="Mediator Projection">
          <div className="session-log flex-1 space-y-3 overflow-y-auto p-4 sm:p-6" aria-live="polite">
            {!events.length && <div className="mx-auto max-w-md py-16 text-center">
              <h2 className="text-xl font-semibold">The room is ready.</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Open the Session, then address one Party or both.</p>
              <button className="button-primary mt-5" onClick={() => act({ type: "OPEN_SESSION" })}>Open Session</button>
            </div>}
            {events.map((event) => <article className={`event event-${event.sender === "SYSTEM" ? "system" : event.sender.toLowerCase()}`} key={event.id}>
              <div className="event-bubble">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <strong>{event.sender === "Z" ? "Mediator" : event.sender === "SYSTEM" ? "Session" : `Party ${event.sender}`}</strong>
                  <span className="audience-label">{audienceLabel(event)}</span>
                </div>
                <p className="mt-2 whitespace-pre-wrap leading-6">{eventText(event)}</p>
              </div>
            </article>)}
            {pending && <div className="pending-beat"><span /> Parties are considering the Mediator&apos;s message…</div>}
          </div>

          {active && <div className="border-t border-[var(--line)] bg-[var(--surface)] p-3 sm:p-4">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-sm font-semibold">Audience
                <select className="audience-select" value={phase === "caucus" ? actor.session.caucusWith ?? "A" : audience} disabled={phase === "caucus"} onChange={(event) => setAudience(event.target.value as AudienceChoice)}>
                  {phase !== "caucus" && <option value="both">Both Parties</option>}
                  <option value="A">Party A only</option><option value="B">Party B only</option>
                </select>
              </label>
              <span className="text-xs text-[var(--muted)]">{phase === "caucus" ? "Caucus audience is enforced" : "Audience is recorded on every Event"}</span>
            </div>
            <div className="flex gap-2">
              <label className="sr-only" htmlFor="mediator-message">Mediator message</label>
              <textarea id="mediator-message" className="composer" value={text} onChange={(event) => setText(event.target.value)} disabled={pending} rows={2} />
              <button className="button-primary self-stretch" disabled={pending || !text.trim()} onClick={send}>Send</button>
            </div>
            {error && <div className="error-panel mt-3" role="alert"><p>{error}</p><button onClick={send}>Retry beat</button></div>}
          </div>}
        </section>

        <aside className="order-3 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 lg:self-start" aria-label="Case resources and Session actions">
          <h2 className="font-semibold">Case resources</h2>
          <div className="mt-3 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {resources.map((resource) => <details className="py-3" key={resource.id}><summary className="cursor-pointer text-sm font-semibold">{resource.title}</summary><p className="mt-2 text-sm leading-6 text-[var(--muted)]">{resource.body}</p></details>)}
          </div>
          {phase === "joint_session" && <div className="mt-6">
            <h2 className="font-semibold">Session actions</h2>
            <div className="mt-3 grid gap-2">
              <button className="button-secondary" onClick={() => setConfirm("agreement")}>Declare agreement</button>
              <button className="button-secondary" onClick={() => setConfirm("impasse")}>Declare impasse</button>
            </div>
          </div>}
          {(["agreement", "impasse", "walkout"] as string[]).includes(phase) && <button className="button-primary mt-5 w-full" onClick={() => void enterReview()}>Enter review</button>}
          {debug && <div className="debug-panel mt-6">
            <h2 className="font-semibold">Provider trace</h2>
            <p className="mt-1 text-xs leading-5 text-[var(--muted)]">Scripted provider · {actor.driver.invocations.length} calls · prompt version proto-02</p>
            <ol className="mt-3 space-y-2 text-xs">{actor.driver.invocations.map((call, index) => <li className="rounded-lg border border-[var(--line)] p-2" key={`${call.seatId}-${index}`}>Party {call.seatId} · attempt {call.attempt} · {call.ok ? "complete" : "failed"}<br />{call.visibleEventIds.length} visible Events</li>)}</ol>
          </div>}
        </aside>
      </div>

      {confirm && <div className="dialog-backdrop" role="presentation" onMouseDown={() => setConfirm(null)}>
        <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-title" onMouseDown={(event) => event.stopPropagation()}>
          <h2 id="confirm-title" className="text-xl font-semibold">Declare {confirm}?</h2>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">This ends the live Session. You can review the Event log afterward.</p>
          <div className="mt-5 flex justify-end gap-2"><button className="button-secondary" onClick={() => setConfirm(null)}>Cancel</button><button className="button-primary" onClick={() => { void act({ type: confirm === "agreement" ? "DECLARE_AGREEMENT" : "DECLARE_IMPASS" }); setConfirm(null); }}>Confirm</button></div>
        </section>
      </div>}
    </main>
  );
}
