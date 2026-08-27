# 07 — XState session actor & engine lift into app/

Type: implementation
Status: open
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
