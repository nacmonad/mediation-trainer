# AI Mediation Simulator — Product & Architecture Plan

## 1. Product direction

Build a browser-first mediation and negotiation rehearsal environment in which each simulated party is an independently configured LLM agent with its own provider, model, context, private knowledge, behavioral state, and permissions.

The product should support two related modes:

1. **Mediator training** — the human user acts as neutral mediator between simulated parties and receives evidence-backed competency feedback.
2. **Pre-mediation war-gaming** — a lawyer rehearses an actual or synthetic matter against simulated opposing parties/counsel/mediators, including controlled information asymmetry and case-specific documents.

The differentiator should not be “multiple LLMs in a chat.” The defensible core is:

- strict information boundaries between parties,
- configurable provider/model per agent,
- deterministic simulation state outside the LLM,
- private/confidential case ingestion with browser-side pseudonymization,
- realistic hidden negotiation state,
- auditable event history,
- professionally calibrated evaluation tied to transcript evidence.

---

## 2. Architectural principles

### 2.1 Application state is authoritative

LLMs render behavior; they do not own the simulation state.

The application owns:

- session phase,
- participant permissions,
- document visibility,
- hidden negotiation variables,
- confidentiality boundaries,
- settlement constraints,
- event history,
- evaluator rubric data.

LLMs receive a compiled view of state and return utterances plus constrained reaction metadata.

### 2.2 One canonical event log

Do not maintain separate canonical `chatA[]`, `chatB[]`, `chatZ[]` arrays and try to keep them synchronized.

Instead store one append-only mediation event stream. Every event declares who may observe it.

```ts
export type ParticipantId = "A" | "B" | "Z" | "EVALUATOR";

export interface MediationEvent {
  id: string;
  sessionId: string;
  timestamp: number;

  sender: ParticipantId | "SYSTEM";
  audience: ParticipantId[];

  kind:
    | "message"
    | "document"
    | "offer"
    | "state_change"
    | "session_event"
    | "evaluation_marker";

  payload: unknown;
}
```

A party's effective context is a projection of the event stream:

```ts
const visibleToA = events.filter((event) => event.audience.includes("A"));
```

This makes caucuses, confidential disclosures, evaluator access, and auditability explicit.

### 2.3 Retrieval enforces confidentiality

Information boundaries must be enforced before prompting.

Do not rely on prompts such as “Party B must not reveal document A-37.” Party B must not be able to retrieve A-37 at all.

Each case resource should carry an explicit visibility scope.

```ts
export interface CaseResource {
  id: string;
  matterId: string;
  title: string;
  visibility: ParticipantId[];
  contentRef: string;
  metadata?: Record<string, unknown>;
}
```

### 2.4 Provider independence

Every simulated agent can use a different provider/model pair.

Examples:

- Party A → OpenAI
- Party B → Anthropic
- Evaluator → private Ollama
- Party A and B → same provider/model but isolated contexts

The simulation layer must not depend on provider-specific SDK types.

---

## 3. Core stack recommendation

### Browser/UI

- React / Next.js
- TypeScript
- Zod for runtime validation and structured model output

### Orchestration

- **XState v5** for mediation/session process state
- plain TypeScript reducers/domain objects for negotiation and behavioral state
- no LangGraph dependency in the core architecture

### Model abstraction

Define an internal provider-independent API:

```ts
export interface ModelRuntime {
  generate(request: ModelRequest): Promise<ModelResponse>;
  stream(request: ModelRequest): AsyncIterable<ModelDelta>;
}
```

An adapter layer can use the Vercel AI SDK or direct provider clients underneath.

Support:

- OpenAI
- Anthropic
- OpenAI-compatible APIs
- Ollama/private self-hosted endpoints
- future providers without modifying simulation logic

### Browser persistence

Use:

- **IndexedDB** for structured session state, event logs, checkpoints, model-call metadata, and evaluation records
- **OPFS** for case documents, local ML assets, extracted text blobs, and encrypted identity-vault material

---

## 4. Session state machine

Use XState for the legal/process flow — i.e. “what is happening now?”

Initial states:

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

Representative events:

```text
START_SESSION
ENTER_CAUCUS_A
ENTER_CAUCUS_B
RETURN_TO_JOINT
SUBMIT_OFFER
ACCEPT_OFFER
REJECT_OFFER
PARTY_THREATENS_WALKOUT
PARTY_WALKS_OUT
END_MEDIATION
START_EVALUATION
```

XState should own state transitions and process guards. It should not be used as a bucket for every numerical behavioral variable.

---

## 5. Party runtime

Each party gets an isolated runtime object.

```ts
export interface PartyRuntime {
  id: ParticipantId;
  model: ModelConfig;
  persona: PersonaConfig;
  negotiation: NegotiationState;
  knowledgeScope: KnowledgeScope;
  memory: AgentMemory;
}
```

### Model configuration

```ts
export interface ModelConfig {
  provider: "openai" | "anthropic" | "ollama" | "openai-compatible" | "other";
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

Same model/provider is allowed across multiple parties, but message/context projections remain isolated by participant permissions.

---

## 6. Negotiation and behavioral state

The LLM should not invent its own durable hidden state.

Keep explicit domain state outside the model.

```ts
export interface NegotiationState {
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

### Mutable versus immutable state

Generally mutable:

- anger
- trust
- perceived fairness
- fatigue
- willingness to disclose
- willingness to settle
- confidence in BATNA

Generally immutable or tightly constrained:

- historical facts
- case documents
- actual authority limits
- true reservation value
- objective deadlines
- legal/economic constraints

The scenario definition may explicitly allow some of these to change.

---

## 7. Model output contract

The agent model should return:

1. what the participant says;
2. limited reaction signals describing how the last interaction was perceived.

Example:

```ts
export interface PartyModelOutput {
  utterance: string;
  reaction: {
    perceivedRespect: number;
    perceivedPressure: number;
    feelsUnderstood: number;
    perceivedFairness: number;
    topicTriggers: string[];
    disclosureIntent?: "none" | "hint" | "disclose";
  };
}
```

Do **not** allow the model to authoritatively output values such as:

```ts
{
  newReservationValue: 125000,
  newAnger: 97,
}
```

Reaction metadata should be fed through deterministic or scenario-configured reducers.

---

## 8. Prompt compiler

Prompts should be generated from authoritative application state rather than maintained as ad hoc strings.

For each turn compile:

- role/persona instructions,
- immutable scenario facts,
- current behavioral state expressed qualitatively,
- visible mediation events,
- retrievable documents allowed for this participant,
- current public/private positions,
- confidentiality obligations,
- output schema.

Prompt versions must be explicitly versioned for replay/debugging.

---

## 9. Privacy architecture using presidio-web

The existing browser-local Presidio/GLiNER pipeline is a strong basis for a client-confidentiality layer.

Target pipeline:

```text
raw case document
      │
      ▼
browser worker
      │
      ├── Presidio patterns/checksums
      └── optional GLiNER ONNX inference
      │
      ▼
identity vault + deterministic token mapping
      │
      ▼
pseudonymized case representation
      │
      ├── cloud provider
      └── private provider / Ollama
```

### Requirements

- repeated identities must receive stable opaque IDs within a matter;
- mapping must remain client-side unless explicitly configured otherwise;
- model responses containing opaque tokens should be rehydrated locally before display;
- raw source documents should never be sent to cloud providers in privacy mode;
- browser storage for the identity vault must be encrypted before production use;
- document and participant visibility must be independent from PII redaction.

### Privacy modes

#### Cloud-protected

```text
raw case
  ↓
browser-local Presidio/GLiNER
  ↓
pseudonymized case
  ↓
OpenAI / Anthropic / compatible provider
  ↓
pseudonymized response
  ↓
local rehydration
```

#### Private inference

```text
raw case
  ↓
private OpenAI-compatible/Ollama endpoint
```

Optionally retain pseudonymization even for private inference as defense-in-depth.

---

## 10. Model invocation audit records

Every model call should be auditable.

Record:

- session and party,
- provider/model,
- endpoint ID (never secrets),
- temperature/seed if applicable,
- prompt version,
- visible event IDs,
- allowed document IDs,
- state before/after,
- request hash,
- response/structured output,
- timestamps.

Purpose:

- debugging unexpected behavior,
- replaying sessions,
- comparing model/provider behavior,
- evaluator auditability,
- regression testing scenarios.

---

## 11. Evaluator architecture

The evaluator is a separate model/runtime and should receive the complete authorized session history plus explicit evaluation criteria.

Do not use a single unconstrained “score this mediation” prompt.

Create a rubric with discrete competencies such as:

- opening / role definition,
- neutrality and impartiality,
- information gathering,
- active listening,
- reframing,
- interest identification,
- confidentiality,
- caucus management,
- option generation,
- reality testing,
- BATNA/WATNA exploration,
- management of power imbalance,
- management of escalation,
- self-determination,
- agreement quality / clarity.

Each finding should include transcript evidence.

```ts
export interface EvaluationFinding {
  competency: string;
  score: number;
  maxScore: number;
  explanation: string;
  evidenceEventIds: string[];
  missedOpportunity?: string;
}
```

### Long-term evaluator validation

Build a calibration corpus:

1. experienced mediators independently score recorded simulations;
2. compare human-human agreement;
3. compare evaluator-human agreement;
4. version rubric and evaluator prompts;
5. run regression tests when models/prompts change.

Human-calibrated evaluation can become a significant product moat.

---

## 12. Scenario model

A scenario should be declarative and authorable without changing application code.

Each scenario should define:

- shared facts,
- common/private resources,
- party public positions,
- target outcomes,
- reservation points,
- BATNA/WATNA,
- hidden interests,
- non-monetary priorities,
- authority limits,
- emotional triggers,
- disclosure rules,
- behavioral/personality profiles,
- walkout thresholds,
- process rules,
- evaluation rubric,
- difficulty/version.

---

## 13. Model heterogeneity as a product feature

Per-agent model configuration allows the same scenario to be stress-tested across models/providers.

Example:

```text
Party A: OpenAI model
Party B: Claude
Evaluator: private Qwen/Ollama
```

Eventually collect scenario-level statistics by model to detect whether a scenario is accidentally tuned to one provider's behavior.

---

## 14. Replay strategy

Exact generative replay cannot always be guaranteed across external providers, even with seeds.

Support two replay modes:

### Recorded replay

Reconsume saved model outputs and state transitions. Deterministic and suitable for UI/debugging regression tests.

### Live replay

Reissue equivalent prompts to the configured models and compare behavioral/evaluation deltas.

Recorded replay is authoritative for reproducing a prior session.

---

## 15. MVP scope

### MVP scenario set

1. **Commercial dispute — basic**
   - obvious settlement zone
   - low emotional volatility
   - tests opening, information gathering, basic negotiation

2. **Employment dispute — intermediate**
   - emotional conflict
   - hidden non-monetary interests
   - reputational concerns
   - caucus opportunities

3. **Commercial dispute — advanced**
   - asymmetric information
   - narrow settlement zone
   - confidential caucus disclosure
   - misleading statements / difficult party
   - credible walkout possibility

### MVP user flow

```text
create/select case
      ↓
configure A model/provider
      ↓
configure B model/provider
      ↓
configure evaluator model/provider
      ↓
assign shared/private documents
      ↓
optional local pseudonymization
      ↓
run joint session / caucuses
      ↓
end session
      ↓
evidence-backed evaluator report
      ↓
replay at same or higher difficulty
```

Initially text only. Add voice after the state/evaluation model proves useful.

---

## 16. Suggested implementation phases

### Phase 0 — domain spike

- define core TypeScript schemas;
- implement one event-log projection per participant;
- implement one XState mediation machine;
- create a mock `ModelRuntime`;
- prove caucus visibility rules with automated tests;
- prove deterministic state reducer behavior.

Exit condition: one scripted session can run entirely without a real LLM.

### Phase 1 — multi-provider agent runtime

- implement provider registry;
- add OpenAI adapter;
- add Anthropic adapter;
- add OpenAI-compatible adapter;
- test against Ollama;
- stream independent party responses;
- validate structured outputs with Zod.

Exit condition: A and B can run different models/providers in one session.

### Phase 2 — case/document layer

- add `CaseResource` and visibility scopes;
- integrate document extraction;
- integrate `presidio-web` browser worker;
- extend identity vault beyond demo-only in-memory state;
- add encrypted persistence/export envelope;
- implement local rehydration.

Exit condition: cloud model can reason over a pseudonymized case without receiving raw identifying values.

### Phase 3 — behavioral engine

- create immutable scenario facts;
- create mutable negotiation state;
- define reaction schema;
- implement deterministic/scenario-configured reducers;
- add walkout, disclosure, concession, trust, anger, fatigue mechanics;
- ensure agent output cannot rewrite protected state.

Exit condition: simulated parties remain behaviorally consistent over long sessions.

### Phase 4 — evaluator

- define versioned rubric;
- implement evidence-event references;
- create post-session report;
- create missed-opportunity analysis;
- store evaluator model/version metadata;
- begin expert mediator calibration dataset.

Exit condition: every meaningful evaluator criticism is tied to evidence.

### Phase 5 — productization

- instructor/scenario-author UI;
- case import/export;
- session resume;
- replay;
- progress-over-time scoring;
- organization/matter boundaries;
- audit logs;
- enterprise provider configuration;
- SSO/access-control work if targeting firms.

### Phase 6 — richer interaction

- speech-to-text / text-to-speech;
- interruption handling;
- timing/silence features;
- optional voice sentiment/prosody features;
- multi-party scenarios beyond A/B;
- simulated opposing counsel + client as separate actors.

---

## 17. Core tests to write early

### Confidentiality tests

- B can never retrieve A-private resources;
- A can never see B caucus messages;
- joint messages are visible to both parties;
- evaluator sees only the scope intentionally granted;
- prompt compiler never leaks hidden resources;
- cloud-provider payloads contain no raw vault values in protected mode.

### State-machine tests

- cannot enter invalid caucus state;
- cannot accept offer after terminal walkout unless scenario allows re-entry;
- ending mediation is idempotent;
- review can only start after the mediation phase ends.

### Behavioral tests

- forbidden immutable fields cannot be changed by model output;
- numeric state remains within bounds;
- reaction reducer is deterministic;
- identical event/state input produces identical compiled prompt structure.

### Provider tests

- provider failures do not corrupt session state;
- model timeout/cancel is recoverable;
- one failed party provider does not leak another party's context;
- model capability mismatch is detected before the session starts.

### Privacy tests

- token identity remains stable within a matter;
- plaintext never appears in logged cloud request bodies under protected mode;
- rehydration occurs only in trusted browser context;
- vault deletion makes protected text irrecoverable unless an explicit export/recovery mechanism exists.

---

## 18. Security boundaries

Explicitly distinguish:

1. **trusted browser boundary** — raw case material and identity mapping may exist here;
2. **private inference boundary** — optionally trusted by the organization;
3. **external model-provider boundary** — receives only allowed/pseudonymized material;
4. **party knowledge boundary** — independent from provider trust;
5. **evaluator boundary** — potentially broader transcript access, but explicitly configured.

These are separate concerns. PII detection alone is not a confidentiality policy, and self-hosted inference alone does not solve party-to-party access control.

---

## 19. Product risks to validate early

### Simulation realism

LLMs tend to be cooperative and may concede too readily. Hidden state plus deterministic constraints must prevent implausible settlements.

### Evaluation validity

A fluent evaluator can still give unreliable scores. Human calibration is necessary before making strong competency claims.

### Scenario IP/licensing

Do not assume law-school mediation exercises or transcripts can be copied into the product. Prefer original scenarios, licensed material, or scenario-author tooling.

### Confidentiality claims

Do not market `presidio-web` integration as establishing legal/regulatory compliance by itself.

### Browser threat model

Browser-local does not mean automatically safe. XSS, extensions, compromised dependencies, unencrypted IndexedDB/OPFS data, clipboard behavior, logs, crash reports, and telemetry must all be considered.

---

## 20. Decisions made

Current recommendations:

- **Use native TypeScript domain models.**
- **Use XState v5 for session/process orchestration.**
- **Do not use LangGraph as the core runtime.**
- **Use a thin internal `ModelRuntime` abstraction.**
- **Treat OpenAI-compatible/Ollama as a first-class provider.**
- **Maintain a single canonical event log with audience scopes.**
- **Enforce document confidentiality in retrieval, not prompts.**
- **Keep behavioral/negotiation state outside the LLM.**
- **Persist the canonical log; keep runtime actors/state in memory while active.**
- **Use IndexedDB for structured records and OPFS for larger/local-sensitive assets.**
- **Integrate `presidio-web` before any external-provider boundary.**
- **Make evaluator findings evidence-backed and versioned.**
- **Start with text; add voice after the state/evaluation model proves useful.**

---

## 21. Immediate next implementation task

Before building UI, define and test these four foundational models:

1. `MediationEvent`
2. `KnowledgeScope`
3. `PartyRuntime`
4. `NegotiationState`

Then implement:

```text
scenario fixture
    ↓
XState session actor
    ↓
event log
    ↓
participant-specific context projection
    ↓
mock model runtime
    ↓
reaction reducer
    ↓
new event/state checkpoint
```

The first vertical slice should prove that a caucus disclosure from A is visible to A, Z, and the evaluator, is unavailable to B at both transcript and retrieval layers, influences A's later behavior, and can be cited correctly in the final evaluator report.

That vertical slice tests the central product idea before investing heavily in UI or agent-framework complexity.


# Evaluation standards / source material 

ABA Formal Opinion 518 (2025)
ABA / AAA / ACR Model Standards of Conduct for Mediators
