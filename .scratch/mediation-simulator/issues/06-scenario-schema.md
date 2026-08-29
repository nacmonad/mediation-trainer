# 06 — Scenario schema & MVP fixtures

Type: prototype
Status: resolved
Blocked by: 01, 02

## Question

Design the declarative scenario schema (Zod-validated JSON fixture, PLAN §12 field list) and author the three MVP scenarios from PLAN §15 as fixtures:

1. commercial dispute — basic (obvious settlement zone, low volatility);
2. employment dispute — intermediate (emotional conflict, hidden non-monetary interests, caucus opportunities);
3. commercial dispute — advanced (asymmetric information, narrow zone, walkout threat, difficult party).

Must cover: shared/private facts and resources, positions, hidden interests, reservation values, BATNA/WATNA, authority limits, emotional triggers, disclosure rules, walkout thresholds, and how a scenario configures reaction reducers (see `Reaction` in CONTEXT.md). Versioned and authorable without code changes.

## Confirmed design

Scott confirmed this shared design on 2026-08-29. The prototype remains the work required to resolve the ticket.

Prototype primary source: branch `prototype/scenario-schema`, file `prototypes/scenario-schema/index.html`. Open the single HTML file directly and use its free-play controls or six guided walkthroughs. The branch stays out of `main`; after live validation, only the settled contract and verdict should be lifted into the specification/production work.

### Scenario contract

- Strict Zod-validated JSON with unknown keys rejected and exactly two keyed Parties at MVP.
- Stable `scenarioId`, integer `scenarioVersion`, and `schemaVersion`; unsupported schema versions fail loudly. Also require slug, title, difficulty, tags, currency, and synthetic Case resources.
- One monetary settlement axis. Qualitative terms remain Interests, priorities, and Offer terms.
- Each Party declares a claimant/respondent bargaining role, which defines the direction of its Reservation value.

### Truth and event audience

- Keep shared facts, each Party's private facts, and app-only ground truth separate.
- Every Case resource and disclosure Event declares an exact participant Audience; never infer Event audience from prose nesting.
- Disclosure rules grant permission by Session phase, Audience, and prerequisites. They do not reveal information automatically; disclosure is a structured Party action appended to the event log.

### Party configuration

- Separate persona prose from numeric initial Negotiation state.
- Persona owns role, goals, speaking style, emotional triggers and guidance, and permitted misleading claims.
- Initial state owns the six mutable dimensions, Position, Reservation value, Interests, and walkout status.
- Private BATNA and WATNA each contain narrative, estimated value, confidence, and risks.
- Authority is distinct from preference and is enforced when accepting an Offer.

### Reactions and rules

- The Party LLM interprets authored emotional triggers and returns constrained Reaction deltas.
- A fixed deterministic reducer applies Scenario-authored sensitivity multipliers and per-Reaction caps, then clamps dimensions to 0–100. Reaction cannot alter Position, Reservation value, authority, or Interests.
- Threshold rules are declarative, phase-scoped, edge-triggered, and once-only unless explicitly repeatable. Evaluate after Reaction; Walkout outranks force-speak.
- Walkout is terminal at MVP.
- A Scenario may configure Caucus permission, disclosure recipients, thresholds, starting phase, and an optional turn maximum, but cannot redefine Session phases.

### Human-evaluator packet

- After the Session, reveal a human-evaluator-only packet containing full ground truth, economics, authority, BATNA/WATNA, hidden facts and Interests, target range, intended disclosure opportunities, emotional/Walkout rules, and teaching prompts.
- Hide it from both Parties and the practicing Mediator during the Session. Keep it descriptive rather than an automated numeric score; its purpose is improving Mediator performance.

### MVP fixture briefs

1. Supplier invoice/basic: feasible zone $105k–$125k, target $112k–$120k, low volatility, no automatic Walkout.
2. Terminated sales director/intermediate: feasible zone $125k–$180k, target $140k–$165k plus neutral-reference, acknowledgment, and confidentiality terms; Caucus-gated disclosures; force-speak above anger 70.
3. Failed software implementation/advanced: preference overlap $455k–$490k but authority compresses the actionable zone to $470k–$475k; asymmetric confidential facts, permitted misleading framing, force-speak above anger 65, terminal Walkout above anger 85 or below 15 trust in Mediator.

### Prototype proof obligations

Exercise exact Event-audience projection, gated disclosure, authority versus Reservation value, reducer sensitivity and caps, threshold precedence, once-only/repeatable firing, and terminal Walkout before lifting the model into production.

## Answer

Validated live by Scott on 2026-08-29. The single-file prototype on branch `prototype/scenario-schema` demonstrated that one strict declarative Scenario contract can represent all three MVP exercises and the awkward runtime cases without embedding executable formulas in authored JSON.

The validated semantics are:

- exact participant Audiences determine Case-resource access and Event-log Projections;
- disclosure rules grant phase- and prerequisite-scoped permission, while an explicit Party action creates the disclosure Event;
- bargaining roles define Reservation-value direction, and authority remains a separate acceptance constraint;
- the Party LLM interprets authored emotional triggers, but one deterministic reducer scales, caps, and clamps constrained Reaction deltas;
- rules evaluate after Reaction, fire on threshold edges, and are once-only unless explicitly repeatable;
- Walkout outranks force-speak when both become eligible and is terminal for the Session; and
- the post-Session human-evaluator packet is descriptive, hidden during practice, and exists to improve Mediator performance.

The three fixture briefs and economics under `## Confirmed design` are final. The prototype HTML remains primary-source evidence on its throwaway branch and must not ship as production code.
