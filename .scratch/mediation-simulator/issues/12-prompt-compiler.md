# 12 — Prompt compiler structure

Type: implementation
Status: resolved
Blocked by: none (interfaces 01 and turn model 02 are settled)

## Question

What does the compiled prompt for each seat contain, where does compilation live, and how is it versioned? PLAN §8 lists the intended inventory (persona, immutable scenario facts, qualitative behavioral state, visible events, retrievable documents, positions, confidentiality obligations, output schema) — the current `compilePartyPrompt` (inline in `openai-compatible-runtime.ts`, reused by the Anthropic runtime) covers roughly half of it, and the driver's `promptVersion = "proto-02"` default is disconnected from the text it claims to describe.

## Answer

Design locked (wayfinder session, 2026-08-30). Extract a pure, engine-owned `src/engine/prompt-compiler.ts`; both provider runtimes consume it and the provider layer stops owning prompt text.

Structure:

- `compileSeatPrompt(input: { seat, projection, runtime?, scenario, mandatory }) → { system, user, version }`.
- Sectioned fragments, each a small named function: identity/persona, private state, visible transcript, output contract. The output-contract fragment is slot-shaped so a seat role can swap it (Party Reaction contract vs a future mediator contract) without forking the compiler.
- Party prompts gain the two missing PLAN §8 sections: (1) case resources the seat may legitimately see, pulled through the Scenario layer's per-audience visibility (ticket 08), and (2) confidentiality obligations where applicable.
- Behavioral state renders **qualitatively** ("you are visibly frustrated"), not as raw JSON numbers — models anchor on numbers, and qualitative rendering is a Phase 3 realism requirement. Mapping thresholds live in the compiler and are deterministic.

Versioning:

- The compiler exports `PROMPT_VERSION`; the driver consumes it instead of a constructor-default string, so text and version cannot drift. One global version, bumped when any fragment changes; per-fragment versions are overkill at this scale.
- `InvocationAttempt` continues to carry `promptVersion` + `visibleEventIds`; the full compiled text is deliberately **not** persisted (privacy + storage) — the debug panel's sanitized request view covers debugging.

Boundaries:

- The compiler stays engine-owned with scenario data injected; the Scenario schema gains **no** prompt-level authoring fields (tone directives etc.), protecting versioning integrity.

Seams this opens:

- The versioned output-contract fragment is the seam for the Reaction reducer revisit (signal-space `Reaction` vs MVP deltas): changing the contract shape later means changing one fragment and bumping `PROMPT_VERSION`.
- Ticket 13 (agent Mediator seat for demo/debug) consumes the seat-role seam: mediator output contract `{utterance, audience, kind}`, no negotiation-state block, mediator private context = caucus knowledge Z has seen.

Implementation notes (ticket/12-prompt-compiler, 2026-08-30):

- Landed as `src/engine/prompt-compiler.ts` with `compilePartyPrompt` returning `{system, user, version}`; `PROMPT_VERSION = "proto-03"` replaces the driver's disconnected `"proto-02"` constructor default, and the session debug panel now shows the live value instead of a hardcoded string.
- The scenario dependency is a structural `ScenarioPromptView` (`sharedFacts` + per-audience `resources`) passed to runtime constructors — the compiler imports no scenario-schema code, keeping the layering clean. A side benefit: the persona brief no longer crams shared facts and resources into prose (the old workaround in `makeActor`); the compiler renders them as proper sections.
- Qualitative bands are deterministic quartiles (0–19 / 20–44 / 45–74 / 75–100) per dimension; economics (position, reservation value, disclosed/hidden facts, notes) stay explicit and labeled. The compiler never emits the raw state JSON.
- One deviation from the sketch: the entry point is named `compilePartyPrompt` (party seats only for now) rather than a fully generic `compileSeatPrompt` — the mediator contract slot exists as `renderPartyOutputContract(mandatory)`, and ticket 13 will introduce the seat-role dispatch when a second seat kind actually needs it (rule of three).
- Verification: `npx tsc --noEmit`, 28/28 engine tests (6 new in `prompt-compiler.test.ts`: projection secrecy, qualitative-only state, resource audience visibility, mandatory flag, determinism + version carry, contract fragment), ESLint, and the Next.js production build.
