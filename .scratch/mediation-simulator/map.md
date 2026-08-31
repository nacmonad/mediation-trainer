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
- Current production lift: [09 — Mediator Session UX](./issues/09-session-ux.md) is complete; the Scenario boundary and Session actor now drive the four-view mediator flow.
- Current provider integration: [10 — OpenAI-compatible Party runtime](./issues/10-openai-compatible-runtime.md) is live-validated and complete, including the Venice AI preset and provider-specific structured-output controls. [11 — Anthropic Party runtime](./issues/11-anthropic-adapter.md) is implemented (live API smoke test still pending); the `ollama` provider value collapsed into `openai-compatible` — Ollama is a local endpoint preset, not a provider.

## Decisions so far

- [MVP mode is mediator training](./issues/00-mode.md): human plays Z; A and B are agents; war-gaming is a later mode. (charting session, 2026-08-27)
- [Participant seats toggle human/agent](./issues/01-participant-interfaces.md): interface design is the gating decision for everything else. (charting session)
- [Core participant & runtime primitives validated](./issues/01-participant-interfaces.md): config-driven seats discriminated human|agent (ModelConfig only on agent seats); opaque seat ids with generic-typed audiences; single append-only event log with per-event audience → projections; reaction reducer on mutable dimensions only (no delta channel to settlement economics); thin `ModelRuntime` boundary. Prototype merged to main via PR #1 (`prototypes/participant-interfaces/`); UI will be Next.js; engine stays pure TS. (2026-08-27)
- [Browser-direct provider transport works for all three providers](./issues/04-provider-transport.md): OpenAI needs nothing special; Anthropic requires `anthropic-dangerous-direct-browser-access: true`; Ollama needs `OLLAMA_ORIGINS` — no proxy shim needed; BYOK XSS mitigated via scoped spend-capped keys + memory-only default `KeyStore`. Layered with the OUTLINE decision: use Vercel AI SDK's provider abstraction beneath our own `ModelRuntime` interface rather than hand-rolling adapters.
- [Turn model is a deterministic app-driven beat loop](./issues/02-turn-orchestration.md): triggers derive purely from event structure (audience = addressing); model-decided volunteering with one round-trip cap; sequential calls in seat order; transactional failure handling; offers as structured events; seven collapsed phases with human-issued transitions (XState transition events are the seam for a future LLM proposer). (2026-08-27)
- [XState session actor owns Session phase](./issues/07-xstate-session-actor.md): validated engine lifted into `app/src/engine/`; XState owns the seven phases while plain TypeScript owns the event log, projections, caucus party identity, behavioral state, and beat loop; Zod-validated transition inputs form the future confirmed-LLM-proposer seam; scripted runtimes keep the vertical slice keyless. (2026-08-27)
- **No evaluator at MVP** (charting session, revised): the human reviews the transcript. The evaluator LLM entity, its output contract, and the ABA rubric are end-product scope — see Out of scope. Tickets [05](./issues/05-evaluator-contract.md) and [03](./issues/03-aba-rubric-research.md) closed accordingly.
- Providers at MVP: OpenAI + Anthropic + Ollama, browser-direct with per-seat model config; XSS/key-handling risk explicitly accepted and to be engineered around. (charting session, Round 3 Q3 / Round 2 Q5)
- Scenarios are hand-written JSON fixtures with a Zod schema; PLAN §15's three scenarios (commercial-basic, employment-intermediate, commercial-advanced) ship at MVP. (charting session, Round 2 Q6 / Round 3 Q4)
- [Scenario contract and MVP fixture semantics validated](./issues/06-scenario-schema.md): strict versioned two-Party Scenario JSON; exact participant Audiences; action-based gated disclosure; separate Reservation value and authority; deterministic Scenario-tuned Reaction reduction; edge-triggered rules with Walkout precedence and terminality; descriptive post-Session human-evaluator packet; three fixed fixture briefs. Prototype primary source remains on `prototype/scenario-schema` and does not ship. (2026-08-29)
- [Production Scenario layer implemented](./issues/08-production-scenario-layer.md): the app now parses the strict versioned contract and three MVP JSON fixtures through one deep plain-TypeScript module; participant projection, disclosure, Offer acceptance, tuned Reaction reduction, threshold precedence, and terminal Walkout are deterministic data-returning operations beneath the XState-owned Session phase. (2026-08-29)
- [Mediator Session UX implemented](./issues/09-session-ux.md): four route-level views; a responsive chat-like Projection with Party A left, Mediator centered, Party B right, and persistent event-audience labels; typed Caucus/terminal/retry actions; duplicate-safe refresh recovery; accessible opt-in state/provider debugging without claimed hidden chain-of-thought; separate human review and debug-free export. (2026-08-30)
- [OpenAI-compatible Party runtime live-validated](./issues/10-openai-compatible-runtime.md): independent per-Party providers run through a stateless server gateway with short-lived RAM credentials, exact-audience prompt recompilation, strict structured responses, sanitized audit data, and retry semantics; Venice AI's extra control plane is supported without leaking into the domain model. (2026-08-30)
- [Anthropic Party runtime implemented](./issues/11-anthropic-adapter.md): Anthropic joins the per-Party provider set via a dedicated Messages-API gateway route and `AnthropicRuntime`; the structured Party response contract is shared across gateways in `party-response.ts`. Completes the PLAN Phase 1 provider-set exit condition (A and B on different providers in one Session). Live Anthropic validation pending first real session. (2026-08-30)
- [Prompt compiler structure locked](./issues/12-prompt-compiler.md): pure engine-owned module with sectioned fragments (persona / private state / transcript / output contract); party prompts gain visible-resources + confidentiality sections and qualitative state rendering; compiler exports `PROMPT_VERSION` so text and version cannot drift; no scenario-authored prompt fields; full compiled text not persisted. The versioned output-contract fragment is the seam for the Reaction revisit and for the [13 — Agent Mediator seat](./issues/13-agent-mediator-seat.md) demo/debug contract. (2026-08-30)
- [Benchmark harness scoped](./issues/14-benchmark-harness.md): with the agent Mediator seat (13), sessions run headless; the harness serves two axes — scenario benchmarking (difficulty fingerprints for the scenario editor) and mediator benchmarking (attributable outcome deltas, since the engine is deterministic given seeds). Benchmark = outcomes, ABA-rubric evaluator (PLAN §11) = process; ticket 14's per-run snapshots are the corpus format §11's calibration work would consume, so the harness does not wait for the evaluator. (2026-08-30)
- Persistence is local-only (IndexedDB + OPFS), no accounts, with manual export/import; privacy layer (presidio-web, identity vault, private inference) is **post-MVP**; synthetic scenario documents for MVP. (charting session, Round 3 Q5 / Round 2 Q4)

## Not yet specified

<!-- fog: suspected questions not yet sharp enough to ticket -->

- Benchmark harness: headless CLI decided; still open — the default mediator policy for scenario-benchmark cells (fixed scripted playbook / random / cheap pinned model) and the run-artifact format — filed as [14](./issues/14-benchmark-harness.md), blocked by 13.
- Reaction reducer design: how `Reaction` metadata maps to deterministic changes in `NegotiationState` — depends on scenario schema (06). Plus an explicit revisit: OUTLINE's signal-space `Reaction` (`perceivedRespect`/`perceivedPressure`/`topicTriggers`) vs MVP state-unit deltas — ticket 12's versioned output-contract fragment is the seam; a change there bumps `PROMPT_VERSION`.
- XState session machine shape: seven phases decided in [02](./issues/02-turn-orchestration.md); guards/actors wiring + engine lift into the app ticketed as [07](./issues/07-xstate-session-actor.md).
- Audit record schema per model call (PLAN §10) — depends on 01; `InvocationRecord` sketched in the prototype, retry/attempt semantics decided in [02](./issues/02-turn-orchestration.md).
- Phase 0 vertical-slice test strategy: which automated tests prove caucus visibility + reducer determinism — depends on 01, 02; both settled, unblocked.
- Scenario editor UI: in-app Scenario authoring (parties/personas, case resources with per-audience visibility, disclosure and threshold rules) per PLAN §12 "Scenario editor (planned feature)". Schema (06) and the production Scenario layer (08) are settled, so the engine contract is ready; editor UX, resource upload/derivation, authoring guidance, and sharing are not. Needs a wayfinder session before implementation.

## Out of scope

- **Evaluator LLM entity & ABA rubric** — the end product judges the Mediator per ABA Formal Opinion 518 + Model Standards, but not in this MVP: a human reviews the transcript. Ticket [05](./issues/05-evaluator-contract.md) closed out of scope; its design constraints move to the end-product backlog. Research asset [research/aba-rubric.md](./research/aba-rubric.md) (draft 8-Standard rubric skeleton, ⚠ items unverified) is parked for that future effort.
- **War-gaming mode** — a later mode on the same engine; explicitly not part of this MVP spec.
- **Privacy/confidentiality layer** (presidio-web, identity vault, OPFS encryption, private inference) — post-MVP per charting decision; revisit when war-gaming mode with real documents is designed.
- **Voice/speech, interruption, timing features** — PLAN Phase 6.
- **Scenario author UI, org/matter boundaries, SSO, enterprise provider config** — PLAN Phase 5.
- **Multi-party scenarios beyond A/B** — PLAN Phase 6.
