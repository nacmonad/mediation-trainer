# 01 — Core participant & runtime interfaces

Type: prototype
Status: resolved
Blocked by:

## Question

What are the core TypeScript interfaces that everything else builds on? Draft them as code to react to, covering at least:

- `Participant` / seat model: role (`party` | `mediator` | `evaluator`), `kind: human | agent`, and where per-seat `ModelConfig` lives (PLAN §5 `PartyRuntime` needs rework: Z is human at MVP, and the human/agent toggle must not leak provider details into human seats).
- `PartyRuntime`, `KnowledgeScope`, `NegotiationState`, `AgentMemory` (PLAN §21 names these as the four foundational models).
- How `ParticipantId` survives a generalized seat model (PLAN's `"A" | "B" | "Z" | "EVALUATOR"` literal union vs. a config-driven id) while keeping event-log audience filters type-safe.
- Where the `human | agent` toggle sits in the types so a later war-gaming mode (human as counsel/party) needs no redesign.

Constraint: Z is human and A/B are agents at MVP, but nothing in the type design may assume that. There is **no evaluator at MVP** — a human reviews the transcript — but the participant/event types must still allow an evaluator seat and audience scope later. Working decisions to respect: XState v5 session actor + plain-TS behavioral state; Vercel AI SDK beneath a thin `ModelRuntime`; OpenAI + Anthropic + Ollama (see 04); JSON scenarios (06).

## Answer

**Verdict (2026-08-27): the primitives held up.** User click-tested the demo (seat toggles, caucus isolation, audience buttons, reaction reducer, evaluator seat) and confirmed. One real bug surfaced during play — `Z → only A` produced audience `[Z, Z]` because the shell computed a "caucus with the sender" — fixed by targeting the other seat in the shell and by hardening `caucusAudience` to refuse any non-party seat. A useful validation from the same session: the split of "audience = who may see" vs "caucus gate = who may act" held up everywhere else.

Prototype (primary source) lives on branch `prototype/participant-interfaces`, `prototypes/participant-interfaces/`: `engine.ts` (the artifact — pure, dependency-free primitives; lifts into the Next.js engine layer), `smoke.ts` (run: `node smoke.ts`), `index.html` (double-clickable demo, inline mirror of the same logic). Branch is throwaway and stays out of main; the validated decisions below reach main via the spec.

Decisions, each expressed as code in `engine.ts`:

1. **Seat model** — `SeatConfig = HumanSeat | AgentSeat`, discriminated by `kind`. `ModelConfig` exists only on `AgentSeat`, so provider details structurally cannot leak into human seats, and a war-gaming flip (A or Z as human/agent) is a config swap (`toggleSeatKind`), not a redesign.
2. **ParticipantId** — config-driven, not a literal union: the engine treats seat ids as opaque `string`s; the well-known `A | B | Z` trio becomes a *scenario-schema* convention (Zod, ticket 06). Type safety is kept via generics: `Session<T>` / `MediationEvent<T>` only accept ids of that session's seat union in `audience` arrays — config-driven AND type-safe.
3. **Event log & projection** — one append-only `MediationEvent` log; every event declares `audience: T[]`; `projectFor(session, viewer)` is the Projection that feeds every prompt. `appendEvent` validates: known sender, non-empty audience of configured seats, sender ∈ own audience, and the caucus gate (`canAct`: during a caucus only the caucus party + mediator may act). Note the validated split: **audience = who may see; the caucus gate = who may act**.
4. **Reaction reducer** — `Reaction` is per-dimension deltas on the six mutable dimensions only; `applyPartyReaction` clamps 0–100. There is **no delta channel** for position/reservationValue/interests: the model structurally cannot rewrite settlement economics. Rule-gated substance changes would be separate scenario-rules operations, never a Reaction.
5. **PartyRuntime / KnowledgeScope / AgentMemory** — runtime per party seat: persona + `NegotiationState` + knowledge (disclosed/private facts, visible documents) + memory scratchpad (never enters another seat's prompt). Hidden → disclosed interests move via `discloseInterest` (the core MVP substance move).
6. **Model boundary** — thin `ModelRuntime` interface + `InvocationRecord` audit type (PLAN §10), generalized to any seat id; Vercel AI SDK lives beneath it, provider details never leak past it.

Open questions surfaced (for follow-up tickets, not blockers):
- Does a future evaluator seat sit in caucus audiences, or review the transcript only? Prototype includes it in caucus audiences; flagging as a decision.
- Reaction as raw state-unit deltas (current) vs signal-space metadata (OUTLINE's `perceivedRespect`/`perceivedPressure`) — matters for the prompt compiler; current choice keeps the reducer trivially deterministic.
- Sender-must-be-in-own-audience rule: keeps projections honest for MVP; revisit if SYSTEM-seen-only events are ever needed.

Stack note: UI will be a Next.js app; engine logic stays pure TS (this module lifts into the Next.js app's engine layer unchanged).
