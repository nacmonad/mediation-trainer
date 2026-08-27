Yes — but I would separate **the mediation state machine** from **the agents' psychological/negotiation state**.

I would not make each party a giant LangGraph-style agent graph. For this product, I think **native TypeScript + XState v5 + a thin model-provider abstraction** is cleaner.

XState is browser-native, TypeScript-first, and its actor model maps unusually well to your setup: actors have isolated internal state, receive events sequentially, can spawn child actors, and communicate through messages. ([prod.stately.ai][1])

## The important architectural distinction

I'd have four different kinds of state:

```text
┌─────────────────────────────────────────────┐
│              SESSION ORCHESTRATOR           │
│                 XState v5                   │
│                                             │
│ setup → joint → caucus → joint → end → eval│
└─────────────────────────────────────────────┘
                     │
       ┌─────────────┼─────────────┐
       ▼             ▼             ▼
   Party A        Party B       Evaluator
   Runtime        Runtime        Runtime
       │             │
       ▼             ▼
  behavioral     behavioral
     state          state
```

### 1. Session state machine

This is genuinely finite-state-machine territory:

```ts
type SessionPhase =
  | "setup"
  | "opening"
  | "joint_session"
  | "caucus_a"
  | "caucus_b"
  | "negotiation"
  | "agreement"
  | "impasse"
  | "review";
```

XState is excellent here.

Things like:

```text
START_SESSION
ENTER_CAUCUS
RETURN_TO_JOINT
PARTY_WALKS_OUT
PROPOSE_SETTLEMENT
END_MEDIATION
START_EVALUATION
```

are explicit events.

That gives you deterministic process control rather than having an LLM decide what application state you're in.

---

# 2. Each party gets a runtime, not necessarily its own FSM

Something approximately:

```ts
interface PartyRuntime {
  id: string;

  model: ModelConfig;

  persona: PersonaConfig;

  negotiation: NegotiationState;

  privateKnowledge: KnowledgeScope;

  memory: AgentMemory;
}
```

Where:

```ts
interface ModelConfig {
  provider: "openai" | "anthropic" | "ollama" | "other";
  model: string;
  endpoint?: string;

  temperature?: number;
  seed?: number;

  capabilities: {
    tools: boolean;
    structuredOutput: boolean;
    reasoning: boolean;
    vision: boolean;
  };
}
```

And then:

```ts
interface NegotiationState {
  anger: number;
  trustMediator: number;
  trustOtherParty: number;

  willingnessToSettle: number;
  rigidity: number;
  fatigue: number;

  statedDemand?: number;
  targetValue?: number;
  reservationValue?: number;

  knownInterests: string[];
  hiddenInterests: string[];

  disclosedFacts: string[];
  undisclosedFacts: string[];

  threatenedWalkout: boolean;
}
```

I would **not** turn `anger = 67` into an XState state.

That's just domain state.

So:

> XState controls **what is happening**.

Plain typed objects control **what the parties currently believe/feel/want**.

---

# One thing I'd change from "separate chat contexts"

I agree completely that A and B must have separate effective contexts.

But I **wouldn't actually make independent message arrays the canonical record**.

Instead create **one event-sourced mediation transcript** with visibility attached to every event.

For example:

```ts
interface MediationEvent {
  id: string;
  timestamp: number;

  sender: "A" | "B" | "Z" | "SYSTEM";

  audience: Array<"A" | "B" | "Z" | "EVALUATOR">;

  kind:
    | "message"
    | "document"
    | "offer"
    | "state_change"
    | "session_event";

  payload: unknown;
}
```

Joint session:

```ts
{
  sender: "Z",
  audience: ["A", "B", "Z", "EVALUATOR"],
  kind: "message",
  ...
}
```

A caucus:

```ts
{
  sender: "A",
  audience: ["A", "Z", "EVALUATOR"],
  kind: "message",
  ...
}
```

Then when A needs a completion:

```ts
const contextA = transcript.filter(
  event => event.audience.includes("A")
);
```

B:

```ts
const contextB = transcript.filter(
  event => event.audience.includes("B")
);
```

This is substantially safer than keeping:

```text
chatA[]
chatB[]
chatZ[]
```

and synchronizing them.

The source of truth becomes:

> **What happened, and who was permitted to observe it?**

That's *exactly* the question mediation software needs to answer.

It also makes confidentiality auditing enormously easier.

---

# Documents should work identically

Same idea.

```ts
interface CaseResource {
  id: string;

  visibility:
    | ["A", "B", "Z"]
    | ["A", "Z"]
    | ["B", "Z"]
    | ["Z"];

  contentRef: string;
}
```

Then your retrieval layer enforces it.

Not:

> "Dear LLM B, please don't mention document A-37."

B should literally be incapable of retrieving A-37.

That's a meaningful security boundary.

---

# Your Presidio work fits this extremely well

Your demo already does basically the primitive I would want:

```text
source document
      ↓
browser Worker
      ↓
Presidio + GLiNER
      ↓
identity index
      ↓
{{sv_pn_<uuid>}}
      ↓
redacted/tokenized document
```

and your current demo explicitly has stable opaque IDs for normalized values and reversible token output while keeping the analysis client-side.

That's much more interesting here than generic "PII redaction."

Suppose an uploaded document says:

```text
Susan Hendricks met Dr. Patel at
St. Mary's Hospital on January 5.
```

The cloud agent gets:

```text
{{person_2831}} met {{person_9921}} at
{{org_7713}} on {{date_6621}}.
```

Crucially, repeated entities remain consistent:

```text
Susan Hendricks → {{person_2831}}
Susan            → {{person_2831}}
Ms. Hendricks    → {{person_2831}}
```

Now the model can reason coherently about the case **without receiving the identifying plaintext**.

That's potentially a major part of Product B.

Your library already structurally keeps PII analysis in the calling process with no network activity, rather than relying on a hosted redaction API.

---

# I would support two privacy modes

This becomes a nice product feature.

### Cloud-protected mode

```text
RAW CASE
   │
   ▼
browser
Presidio Web
   │
   ▼
tokenized case
   │
   ▼
OpenAI / Anthropic / etc
   │
   ▼
tokenized response
   │
   ▼
browser rehydration
   │
   ▼
lawyer sees normal text
```

Provider never receives the identity mapping.

### Private inference mode

```text
RAW CASE
   │
   ├──────────────────► private Ollama
   │
   └─ optional tokenization anyway
```

A firm might decide:

> Our self-hosted model is inside our trusted processing boundary.

So they could send either plaintext or still use pseudonymization as defense-in-depth.

That is a very attractive enterprise story.

---

# Provider abstraction: I wouldn't build much of this yourself

I would seriously consider the current **Vercel AI SDK** for only this layer.

It has an OpenAI-compatible provider abstraction where you supply:

```ts
createOpenAICompatible({
  name: "ollama",
  baseURL: "https://llm.example-lawfirm.com/v1",
  apiKey: ...
});
```

and then choose arbitrary model IDs. ([AI SDK][2])

Ollama itself supports OpenAI-compatible endpoints including `/v1/chat/completions`, so that fits your desired abstraction directly. ([Ollama][3])

Your runtime can therefore resolve:

```ts
resolveModel({
  provider: "ollama",
  endpoint: "https://llm.firm.internal/v1",
  model: "qwen3:32b"
});
```

or:

```ts
resolveModel({
  provider: "openai",
  model: "..."
});
```

without your simulation engine caring.

I'd wrap AI SDK behind **your own tiny interface**, though:

```ts
interface ModelRuntime {
  generate(request: ModelRequest): Promise<ModelResponse>;
  stream(request: ModelRequest): AsyncIterable<ModelDelta>;
}
```

Then AI SDK is replaceable.

Don't allow the simulation domain model to become coupled to Vercel's types.

---

# LangGraph specifically

LangGraph.js can now be used in web environments; there is a browser-safe:

```ts
@langchain/langgraph/web
```

entry point. ([GitHub][4])

So technically: **yes, you could use LangGraph.**

I wouldn't.

Its abstraction is better for something like:

```text
research
  ↓
decide tool
  ↓
call tool
  ↓
inspect
  ↓
loop
  ↓
respond
```

Your application is much closer to:

```text
known legal process
+
explicit actors
+
strict information boundaries
+
deterministic permissions
+
external probabilistic language generators
```

That's more naturally an application state machine.

And LangGraph's browser story has had some churn around v1/browser compatibility even though browser-specific entrypoints exist today. ([GitHub][5])

I wouldn't put such a central part of the application's security/process model behind it.

---

# XState, however, is almost suspiciously appropriate

Consider their actor model:

```text
Session actor
├── Party A actor
├── Party B actor
├── Mediator-interface actor
└── Evaluator actor
```

XState actors explicitly:

* maintain isolated internal state,
* receive events,
* process messages sequentially,
* send events,
* spawn actors,
* expose snapshots. ([prod.stately.ai][6])

That's basically what you just described.

And it runs frontend or backend because it is normal JS/TS. ([prod.stately.ai][1])

Interestingly, Stately has now started building an `@statelyai/agent` package that puts LLM requests around typed XState machines. But it's currently **alpha**, so I would not make your architecture depend on it yet. ([stately.ai][7])

Use boring XState v5.

---

# The LLM should not own its state

This is one of the architectural rules I'd enforce from day one.

Don't do:

```text
SYSTEM:
You're currently angry 72/100.
Adjust your anger based on the conversation and
remember your new anger level.
```

That gives you:

```text
turn 1 anger = 72
turn 5 anger = ??
turn 15 anger = whatever the LLM hallucinated
```

Instead:

```text
Application State
       ↓
prompt compiler
       ↓
LLM
       ↓
utterance
```

And separately:

```text
Mediator action
      ↓
state transition engine
      ↓
new application state
```

For example:

```ts
function applyPartyReaction(
  state: NegotiationState,
  reaction: Reaction
): NegotiationState {
  return {
    ...state,

    anger: clamp(
      state.anger + reaction.angerDelta,
      0,
      100
    ),

    trustMediator: clamp(
      state.trustMediator + reaction.trustDelta,
      0,
      100
    )
  };
}
```

The LLM gets:

```text
You currently:
- distrust the mediator moderately
- remain very angry
- are unwilling to disclose your liquidity problem
- would settle above €225k
- publicly maintain a €450k demand
```

It **renders the character**.

It doesn't define the character.

---

# I'd actually have the model return two things

Something like structured output:

```ts
{
  utterance:
    "I'm not interested in another token offer.",

  reaction: {
    perceivedRespect: -0.2,
    perceivedPressure: 0.6,
    feelsUnderstood: 0.1,
    topicTriggers: ["financial_loss"]
  }
}
```

Then your deterministic state reducer can translate those signals.

Not:

```ts
{
  newAnger: 97,
  newReservationValue: 125000
}
```

The model shouldn't be allowed to casually rewrite the settlement economics.

Some things are mutable:

```text
anger
trust
fatigue
perceived fairness
willingness to disclose
```

Some things should be very hard or impossible to mutate:

```text
historical facts
actual BATNA
authority ceiling
reservation value
confidential documents
```

Unless the scenario explicitly defines rules for them.

---

# I also wouldn't make it "in-memory only"

**Runtime:** yes.

**Source of truth:** no.

For an active browser session:

```text
XState snapshot
PartyRuntime A
PartyRuntime B
retrieval cache
model streams
```

can all be memory-resident.

But persist the canonical event log.

Something like:

```text
IndexedDB
├── session metadata
├── mediation event log
├── model invocation records
├── state checkpoints
└── evaluation data

OPFS
├── original documents
├── extracted documents
├── local models
└── encrypted identity vault
```

You're already using OPFS for browser-local model storage in the demo.

I would probably use IndexedDB for structured session events and OPFS for heavier blobs.

---

# This also gives you deterministic replay

This is going to become very valuable.

Every LLM invocation should record something like:

```ts
interface ModelInvocation {
  party: "A" | "B";

  provider: string;
  endpointId: string;
  model: string;

  temperature?: number;
  seed?: number;

  promptVersion: string;

  visibleEventIds: string[];
  documentIds: string[];

  stateBefore: NegotiationState;

  requestHash: string;

  response: string;

  stateAfter: NegotiationState;
}
```

Later you'll be able to reproduce:

> Why did Party B suddenly become cooperative?

And inspect exactly:

```text
model
prompt version
knowledge presented
session history presented
hidden state
model response
state transition
```

That's enormously useful for both debugging and a defensible training product.

---

# And here's an interesting consequence of per-agent model selection

You can make **model heterogeneity a testing feature**.

For example:

```text
A:
  Claude model
  accommodating
  sophisticated counsel

B:
  private Qwen model
  hostile
  unsophisticated principal

Evaluator:
  GPT model
```

Or intentionally:

```text
A = same scenario, GPT
B = same scenario, Claude
```

and replay it.

Eventually you could have a scenario certification test:

```text
Scenario: Anderson Employment Dispute

                GPT    Claude   Qwen   Llama

difficulty       7.2      7.5    7.1     6.8
settlement %      64       61     68      71
walkout %         11       13      9       8
```

That would reveal when your simulation's behavior is dependent on a particular model.

That's a really good property for something sold as professional training.

---

# My stack recommendation

I'd keep it surprisingly boring:

```text
React / Next
     │
     ├── presidio-web
     │      └── Web Worker / ONNX / WebGPU
     │
     ├── XState v5
     │      └── session orchestration
     │
     ├── plain TypeScript domain models
     │      ├── PartyRuntime
     │      ├── NegotiationState
     │      ├── KnowledgeScope
     │      └── MediationEvent
     │
     ├── Zod
     │      └── schemas / structured model output
     │
     ├── ModelRuntime abstraction
     │      └── Vercel AI SDK underneath
     │             ├── OpenAI
     │             ├── Anthropic
     │             ├── Ollama
     │             └── OpenAI-compatible
     │
     ├── IndexedDB
     │      └── event log/checkpoints
     │
     └── OPFS
            ├── case files
            ├── ML models
            └── encrypted identity vault
```

**No LangChain required.
No LangGraph required.
No heavyweight "multi-agent framework" required.**

And that's a positive.

The valuable complexity in this product is **your mediation semantics, confidentiality boundaries, state evolution and evaluation model**. I wouldn't hand those over to a generic agent framework.

The piece I'd design next is the `MediationEvent + KnowledgeScope + PartyRuntime + NegotiationState` schema, because if we get those four types right, the rest of the application architecture falls out surprisingly cleanly.

[1]: https://prod.stately.ai/docs/xstate?utm_source=chatgpt.com "XState"
[2]: https://ai-sdk.dev/providers/openai-compatible-providers?utm_source=chatgpt.com "OpenAI Compatible Providers"
[3]: https://docs.ollama.com/api/openai-compatibility?utm_source=chatgpt.com "OpenAI compatibility - Ollama"
[4]: https://github.com/langchain-ai/langgraphjs/issues/2502?utm_source=chatgpt.com "CDN support for LangGraph.js and LangChain.js browser entrypoints · Issue #2502 · langchain-ai/langgraphjs · GitHub"
[5]: https://github.com/langchain-ai/docs/issues/1177?utm_source=chatgpt.com "[langchain]: Browser Support Status for LangGraph.js v1.0+ · Issue #1177 · langchain-ai/docs · GitHub"
[6]: https://prod.stately.ai/docs/actors?utm_source=chatgpt.com "Actors"
[7]: https://stately.ai/docs/packages/agent/machines?utm_source=chatgpt.com "Agent machines"
