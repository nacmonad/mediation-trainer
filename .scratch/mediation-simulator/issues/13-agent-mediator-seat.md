# 13 — Agent Mediator seat (demo/debug)

Type: implementation
Status: open
Blocked by: 12 (open)

## Question

For demo/debug purposes, can the Mediator seat (Z) run as an agent — provider-configurable, with its own system/user prompts — while MVP mode stays "human plays Z"? The per-seat participant model (01) already allows `role: "mediator"` agent seats and `toggleSeatKind` supports flipping at runtime; only the UI and prompt/output contract are missing.

## Answer

Framed as a debug/demo seat toggle (in the spirit of ticket 09's opt-in debug panel), **not** an MVP product feature: MVP mode remains human-as-Z (00), and this keeps war-gaming mode reachable without redesign.

Design sketch, pending sharpening after 12 lands:

- **Provider + config**: Z gets a `ModelConfig` on the setup view, reusing the per-seat machinery from 10/11 (gateways are stateless; a third seat is mostly wiring).
- **Prompt**: the seat-role seam from 12 — mediator system prompt = scenario facts + mediator persona + standards-of-conduct framing; user prompt = Z's projection (joint transcript + caucus disclosures Z has seen). No negotiation-state block.
- **Output contract**: a second versioned fragment `{utterance, audience, kind}` with strict Zod validation — crucially, **addressing becomes the model's job** (audience IS addressing, decision 1 of 02). v1 restricts the agent-Z to messages: it cannot issue caucus/terminal transitions, which stay human-issued (decision 11) — the agent proposes text, the human still presses the phase buttons.
- **Debug value**: an agent-Z lets a single person dry-run scenarios end-to-end (and exercises the confidentiality projections from the other side: the mediator projection must include caucus content that party projections must not see).
