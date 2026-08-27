# 07 — XState session actor & engine lift into app/

Type: implementation
Status: resolved
Blocked by: 01 (resolved), 02 (resolved); assumes `prototypes/turn-model/` merged to main

## Question

Lift the validated engine into the Next.js app and wrap the beat loop in an XState v5 session actor — the map's "guards/actors wiring at implementation time" fog item. Scope:

- **Lift, don't rewrite**: `prototypes/participant-interfaces/engine.ts` and `prototypes/turn-model/driver.ts` move into the app's engine layer (pure TS, no React, no Next imports). Known prototype simplifications to resolve during the lift: prototype runtimes are sync-scripted with `mandatory` passed through (the real `ModelRuntime` is async); `InvocationAttempt.stateAfter` is captured before the reducer applies (prototype-only).
- **XState v5 session actor**: states are the seven phases from ticket 02 (`setup → joint_session ⇄ caucus → (agreement | impasse | walkout) → review`). Mediator UI actions become typed machine events (`OPEN_SESSION`, `SEND`, `OPEN_CAUCUS`, `CLOSE_CAUCUS`, `DECLARE_AGREEMENT`, `DECLARE_IMPASS`, `ENTER_REVIEW`); `PARTY_WALKS_OUT` is the one system-raised event (driver-raised, per decision 11). Guards delegate to the driver's phase/caucus gates — no duplicated truth between machine state and `session.caucusWith` (machine owns *whether*, `caucusWith` owns *who*).
- **Layering rule (OUTLINE)**: XState controls *what is happening*; behavioral/negotiation state stays plain TS domain objects, never FSM states.
- **LLM transition-proposer seam**: transition events are the single integration point — design input schemas so a future LLM proposer can emit the same events with human confirmation, with no MVP code for it.
- **Runs without provider keys**: wire a mock/scripted `DriverRuntime` so the app is clickable pre-BYOK (BYOK key handling is a later ticket).
- **Next 16 caveat**: `app/AGENTS.md` warns this Next version has breaking changes; read `app/node_modules/next/dist/docs/` before writing app-side code.

Working decisions to respect: XState v5 session actor + child actors (party runtimes are NOT FSMs); Vercel AI SDK beneath the thin `ModelRuntime` (post-wiring ticket); Zod for the scenario schema (06) and for validating agent responses (`utterance`/`reaction`/optional `offer`).

## Answer

**Resolved (2026-08-27).** The validated participant primitives and deterministic turn driver now live in `app/src/engine/`. An XState v5 `SessionActor` owns the seven Session phases and exposes one Zod-validated transition-event seam for both mediator UI actions and a future confirmed LLM proposer. The plain-TypeScript driver remains responsible for the event log, projections, behavioral state, caucus participant identity, and sequential beat loop; when wrapped, it reads the XState-owned phase rather than maintaining a second source of truth. `PARTY_WALKS_OUT` remains system-only.

Agent responses are asynchronously validated with Zod, and successful audit attempts now capture the reducer-derived `stateAfter`. A scripted `DriverRuntime` and clickable Next.js vertical slice exercise joint Session messages, caucuses, terminal declarations, and review without provider keys. Focused actor tests cover the transition seam, caucus invariant, system walkout, and proposer-schema boundary.

Verification: participant-interface smoke test passed; turn-model smoke test passed all 26 checks; 3 focused session-actor tests passed; app lint passed; Next.js 16 production build and TypeScript checks passed.
