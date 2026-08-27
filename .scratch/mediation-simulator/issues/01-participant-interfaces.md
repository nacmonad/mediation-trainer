# 01 — Core participant & runtime interfaces

Type: prototype
Status: open
Blocked by:

## Question

What are the core TypeScript interfaces that everything else builds on? Draft them as code to react to, covering at least:

- `Participant` / seat model: role (`party` | `mediator` | `evaluator`), `kind: human | agent`, and where per-seat `ModelConfig` lives (PLAN §5 `PartyRuntime` needs rework: Z is human at MVP, and the human/agent toggle must not leak provider details into human seats).
- `PartyRuntime`, `KnowledgeScope`, `NegotiationState`, `AgentMemory` (PLAN §21 names these as the four foundational models).
- How `ParticipantId` survives a generalized seat model (PLAN's `"A" | "B" | "Z" | "EVALUATOR"` literal union vs. a config-driven id) while keeping event-log audience filters type-safe.
- Where the `human | agent` toggle sits in the types so a later war-gaming mode (human as counsel/party) needs no redesign.

Constraint: Z is human and A/B are agents at MVP, but nothing in the type design may assume that. There is **no evaluator at MVP** — a human reviews the transcript — but the participant/event types must still allow an evaluator seat and audience scope later. Working decisions to respect: XState v5 session actor + plain-TS behavioral state; Vercel AI SDK beneath a thin `ModelRuntime`; OpenAI + Anthropic + Ollama (see 04); JSON scenarios (06).
