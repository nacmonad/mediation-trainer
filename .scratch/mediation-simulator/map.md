# Wayfinder Map: Mediation Simulator — MVP Spec

Label: `wayfinder:map`
Status: `active`

## Destination

A buildable MVP spec for a **mediator-training simulator**: a human practices as the Mediator (Z) between two LLM agent Parties (A and B) in the browser, then reviews the full transcript themselves — **no evaluator LLM at MVP**. Every decision needed to start Phase 0/1 implementation is locked; the spec is ready for `/to-spec` → `/to-tickets` → `/implement`.

## Notes

- Solo dev side project (software engineer, LLM-agent experience); the practice user is a lawyer friend who will train and give feedback. No deadline.
- Source architecture document: `PLAN.md` at repo root. Where this map's decisions contradict PLAN.md, this map wins and PLAN.md should be amended.
- Glossary lives in `CONTEXT.md`; consult it before coining terms. ADRs go in `docs/adr/` when a decision qualifies.
- Per-seat participant model: every seat (A, B, Z, evaluator) is configurable as `human | agent`; MVP configuration is A+B agents, Z human. This keeps war-gaming mode reachable later without redesign.
- Library selections (from OUTLINE.md, restated): **XState v5** owns session orchestration as a session actor with child actors; behavioral/negotiation state stays in plain TypeScript domain objects (never FSM states). **Vercel AI SDK** sits underneath the thin `ModelRuntime` interface (replaceable, never leaked into domain types); `@statelyai/agent` excluded as alpha. **Zod** for schemas/structured output. No LangChain/LangGraph.
- Issue tracker: local markdown (`.scratch/mediation-simulator/`).

## Decisions so far

- [MVP mode is mediator training](./issues/00-mode.md): human plays Z; A and B are agents; war-gaming is a later mode. (charting session, 2026-08-27)
- [Participant seats toggle human/agent](./issues/01-participant-interfaces.md): interface design is the gating decision for everything else. (charting session)
- [Core participant & runtime primitives validated](./issues/01-participant-interfaces.md): config-driven seats discriminated human|agent (ModelConfig only on agent seats); opaque seat ids with generic-typed audiences; single append-only event log with per-event audience → projections; reaction reducer on mutable dimensions only (no delta channel to settlement economics); thin `ModelRuntime` boundary. Prototype merged to main via PR #1 (`prototypes/participant-interfaces/`); UI will be Next.js; engine stays pure TS. (2026-08-27)
- [Browser-direct provider transport works for all three providers](./issues/04-provider-transport.md): OpenAI needs nothing special; Anthropic requires `anthropic-dangerous-direct-browser-access: true`; Ollama needs `OLLAMA_ORIGINS` — no proxy shim needed; BYOK XSS mitigated via scoped spend-capped keys + memory-only default `KeyStore`. Layered with the OUTLINE decision: use Vercel AI SDK's provider abstraction beneath our own `ModelRuntime` interface rather than hand-rolling adapters.
- [Turn model is a deterministic app-driven beat loop](./issues/02-turn-orchestration.md): triggers derive purely from event structure (audience = addressing); model-decided volunteering with one round-trip cap; sequential calls in seat order; transactional failure handling; offers as structured events; seven collapsed phases with human-issued transitions (XState transition events are the seam for a future LLM proposer). (2026-08-27)
- **No evaluator at MVP** (charting session, revised): the human reviews the transcript. The evaluator LLM entity, its output contract, and the ABA rubric are end-product scope — see Out of scope. Tickets [05](./issues/05-evaluator-contract.md) and [03](./issues/03-aba-rubric-research.md) closed accordingly.
- Providers at MVP: OpenAI + Anthropic + Ollama, browser-direct with per-seat model config; XSS/key-handling risk explicitly accepted and to be engineered around. (charting session, Round 3 Q3 / Round 2 Q5)
- Scenarios are hand-written JSON fixtures with a Zod schema; PLAN §15's three scenarios (commercial-basic, employment-intermediate, commercial-advanced) ship at MVP. (charting session, Round 2 Q6 / Round 3 Q4)
- Persistence is local-only (IndexedDB + OPFS), no accounts, with manual export/import; privacy layer (presidio-web, identity vault, private inference) is **post-MVP**; synthetic scenario documents for MVP. (charting session, Round 3 Q5 / Round 2 Q4)

## Not yet specified

<!-- fog: suspected questions not yet sharp enough to ticket -->

- Prompt compiler structure: what the compiled prompt for each seat contains and how it's versioned — interfaces (01) and turn model (02) are settled; unblocked.
- Reaction reducer design: how `Reaction` metadata maps to deterministic changes in `NegotiationState` — depends on scenario schema (06). Plus an explicit revisit: OUTLINE's signal-space `Reaction` (`perceivedRespect`/`perceivedPressure`/`topicTriggers`) vs MVP state-unit deltas — settle during prompt-compiler work.
- XState session machine shape: seven phases decided in [02](./issues/02-turn-orchestration.md); remaining work is guards/actors wiring (PLAN §4) at implementation time.
- Audit record schema per model call (PLAN §10) — depends on 01; `InvocationRecord` sketched in the prototype, retry/attempt semantics decided in [02](./issues/02-turn-orchestration.md).
- Phase 0 vertical-slice test strategy: which automated tests prove caucus visibility + reducer determinism — depends on 01, 02; both settled, unblocked.
- Session UX flow (the actual screens a mediator sees during a run, including transcript review at session end) — unblocked by 02: the driver's mediator actions (send/address, open/close caucus, declare phase) are the UI's action surface.

## Out of scope

- **Evaluator LLM entity & ABA rubric** — the end product judges the Mediator per ABA Formal Opinion 518 + Model Standards, but not in this MVP: a human reviews the transcript. Ticket [05](./issues/05-evaluator-contract.md) closed out of scope; its design constraints move to the end-product backlog. Research asset [research/aba-rubric.md](./research/aba-rubric.md) (draft 8-Standard rubric skeleton, ⚠ items unverified) is parked for that future effort.
- **War-gaming mode** — a later mode on the same engine; explicitly not part of this MVP spec.
- **Privacy/confidentiality layer** (presidio-web, identity vault, OPFS encryption, private inference) — post-MVP per charting decision; revisit when war-gaming mode with real documents is designed.
- **Voice/speech, interruption, timing features** — PLAN Phase 6.
- **Scenario author UI, org/matter boundaries, SSO, enterprise provider config** — PLAN Phase 5.
- **Multi-party scenarios beyond A/B** — PLAN Phase 6.
