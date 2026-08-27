# 02 — Turn orchestration & session driver

Type: grilling
Status: resolved
Blocked by:

## Question

How does a turn actually happen? PLAN §4 defines session phases but never defines who speaks when. Decide the conversation driver such that:

- the human mediator's utterances always enter the event log as their own events;
- parties respond when addressed, on offers, and on state changes — with scenario-configured assertiveness controlling volunteering;
- the design is expressible in the Phase-0 vertical slice with a mock model runtime, and extensible to war-gaming (a human in a party seat) later.

Sub-questions to resolve: what ends a party's turn; whether parties may react unprompted after another party's message; how the mediator opens a caucus mechanically; what happens when a model call fails mid-turn.

## Answer

**Verdict (2026-08-27):** two grilling rounds, all decisions locked. The turn model is a **deterministic, app-driven beat loop**: the driver never invents speech obligations — every trigger derives from event structure, and every phase transition is human-issued (except threshold-gated walkout). XState transition *events* are the single integration point, so a future LLM "transition proposer" can emit the same events (with human confirmation) without redesign — the user's stated end goal of tying an LLM into state transitions stays reachable while MVP stays deterministic.

Decisions:

1. **Trigger taxonomy (zero NLP)** — an event's `audience` array *is* the addressing. Exactly four triggers: (a) a message whose audience includes party P addresses P; (b) an `offer` event → parties in its audience respond; (c) a Reaction crossing a scenario threshold forces the owning party to respond; (d) volunteering (model-decided, below). A party's question to the mediator creates no machine obligation — the human sees it and answers.
2. **Volunteering is model-decided**: after any joint-session party utterance, the *other* party always gets a consideration call that must return a Reaction and *may* return an utterance. Scenario assertiveness steers via the prompt (prompt-compiler input), not driver logic. Every beat yields reaction state; every call is audited.
3. **Turn unit**: one model call = at most one utterance event + one Reaction, applied atomically. No chaining; the turn is over when the event lands.
4. **Sequencing**: model calls are strictly sequential in fixed seat order; log order = speaking order. A later speaker's call sees earlier speakers' landed utterances in its projection. No parallel calls at MVP.
5. **Volunteering cascade**: one round-trip cap per original stimulus — a volunteering utterance earns the other party exactly one consideration call, then the driver idles. Deterministic cost, no loop risk.
6. **Caucus mechanics**: explicit mediator open/close actions; the bookend `session_event`s ("caucus with A begins/ends") are joint-visible (everyone sees the fact of the caucus); content events stay gated by `caucusAudience`; `session.caucusWith` remains the single source of truth for *who*.
7. **Threshold-forced response is mandatory-speak**: the model is prompted that it must produce an utterance; an empty return is a failure surfaced to the mediator. Thresholds fire on moments the character can't stay silent — a silent "forced" response would mean the rule didn't fire, which must be loud.
8. **Failure handling is transactional**: validate response → apply reducer → append event; any failure lands nothing (no partial events, no half-applied state). One bounded automatic retry for transport-class errors (both attempts audited as `InvocationRecord`s); structural failures (bad payload) surface to the mediator with no auto-retry.
9. **Offers**: agent response schema gains an optional Zod-validated structured `offer`. Offers are events (`kind: "offer"`); the party's `position` updates as an app-side effect of appending the offer event — never through the Reaction channel, preserving ticket 01's no-delta-channel rule for substance.
10. **Phase machine collapses to seven phases**: `setup → joint_session ⇄ caucus → (agreement | impasse | walkout) → review`. `opening`/`negotiation` fold into `joint_session`; `caucus_a`/`caucus_b` collapse into one `caucus` state (machine owns *whether*, `caucusWith` owns *who*).
11. **Phase transitions are human-issued** at MVP, except scenario-threshold-gated walkout (`PARTY_WALKS_OUT` is the one system-forced event). The turn driver never changes phase on its own.
12. **Evaluator-in-caucus deferred** to evaluator implementation: the audience mechanism already permits both options (an evaluator in a caucus audience is just an audience member), so `caucusAudience` is unchanged and the question moves to the evaluator ticket.
13. **Reaction stays state-unit deltas** for MVP; OUTLINE's signal-space alternative (`perceivedRespect`/`perceivedPressure`/`topicTriggers`) is logged as an explicit revisit in the map's fog, to be settled during prompt-compiler work where that vocabulary would earn its keep.
