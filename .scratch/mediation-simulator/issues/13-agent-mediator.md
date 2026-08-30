# 13 — Agent Mediator seat (demo/debug)

Type: implementation
Status: resolved
Blocked by: 12 (prompt compiler — the mediator contract consumes the seat-role slot)

## Question

The Mediator seat is currently human-only. For demo and debug purposes the Mediator should also be runnable as an LLM agent: the human observes, drives the phase actions (open/close caucus, declare agreement/impasse), and can ask the agent Z to speak. What is the contract, and where do the prompt, transport, and addressing live?

## Answer

Design locked (wayfinder session, 2026-08-30). The agent Mediator is a **speaker only**: one model call produces `{utterance, audience}` and the utterance enters the log through the same `send()` seam a human Z uses. Addressing is the model's choice (`both` / `A` / `B`, and audience IS addressing — decision 1); every phase transition stays human-issued; silence is a legal choice. No Reaction channel exists for Z: the mediator has no negotiation state, so nothing to react with.

Structure:

- **Contract** (`src/engine/mediator-response.ts`): strict `{utterance: string, audience: "both" | "A" | "B"}` — no offer, no deltas, no phase transitions.
- **Compiler** (`prompt-compiler.ts`): `compileMediatorPrompt({projection, scenario, phase, caucusWith})` renders mediator identity + impartiality + self-determination + caucus confidentiality + the mediator output contract as system text; user text is Z's projection (shared facts, Z-visible resources, phase/caucus context, transcript). No negotiation-state block is ever rendered.
- **Runtime** (`src/engine/mediator-runtime.ts`): `MediatorRuntime` reuses the existing gateways with `contract: "mediator"` and `partyId: "Z"` — transport, credential vault, and audit sanitation are exactly the Party story. Separate from `DriverRuntime` by design: no reaction/offer channel.
- **Driver** (`driver.ts`): `TurnDriver.mediatorRuntime?` plus `agentMediatorStep()` — one model call for Z, invocation recorded (party-state fields omitted), then the utterance enters via `send()`, which runs the normal party beats. Single attempt, no auto-retry: the human simply asks again. Silence = legal, no beat. Restricted to `joint_session` in v1; the existing caucus leak checks in `send()` still apply to anything Z says while in caucus (v1 keeps the agent out of caucus entirely).
- **Session seam**: `AGENT_MEDIATOR_TURN` joins the discriminated input schema and the XState joint_session handler; dispatch mirrors `SEND`'s walkout-consumption pattern (a party Reaction to Z's speech can force a walkout, which is the sole system transition).

Implementation notes (ticket/13-agent-mediator, 2026-08-30):

- Gateways: `partyId` enums extend to `"Z"`; optional `contract: "party" | "mediator"` discriminates response parsing on both `openai-compatible` and `anthropic` routes (default `"party"`). Venice keeps `venice_parameters` for mediator calls but skips `response_format` — structured output is only wired for the Party contract; the mediator shape is validated locally.
- Credentials: the vault and `/api/session-credentials` accept an optional `Z` key; `SessionSetupConfig` gains `Z?: ModelConfig` (legacy provider migration preserves it). `party-setup.tsx` gains a mediator human/agent toggle; agent mode reveals the same seat/provider fields as the parties.
- `session-workspace.tsx`: agent Z configures the mediator seat as `kind: "agent"`, attaches `driver.mediatorRuntime`, and shows a "Let the agent Mediator speak" action in joint session. The human composer stays (the human may still speak as Z, or observe); debug panel now handles stateless mediator invocations (`stateBefore`/`stateAfter` are optional, mediator calls render `mediatorResponse` and label "Mediator").
- Verification: `npx tsc --noEmit`, 37/37 engine tests (3 new gateway tests for the mediator contract incl. Venice parameter behavior, 3 new compiler tests for the mediator prompt/contract, 3 new session-actor tests driving the agent step through the dispatch seam), ESLint, and the Next.js production build.

Seams this opens:

- Benchmark harness (ticket 14) can run whole sessions with agent Z + agent A/B — the outcome-vs-rubric analytics from PLAN §13 need no new engine surface.
- Caucus participation (agent Z speaking inside an open caucus, e.g. relaying) is the natural v2; it is deliberately excluded here because the addressing/caucus confidentiality rules need their own pass.
