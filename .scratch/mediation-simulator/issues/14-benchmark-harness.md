# 14 — Session benchmark harness

Type: implementation
Status: open
Blocked by: 13 (open)

## Question

With an agent Mediator seat (13), sessions become headless-runnable. Can we batch-run a scenario N times and aggregate outcomes — agreement/impasse/walkout rates, mean/median settlement, surplus split, session length — to (a) validate scenario difficulty and (b) compare mediator policies? PLAN §16 Phase 3's exit condition ("simulated parties remain behaviorally consistent over long sessions") and the scenario editor's need for difficulty validation both want this.

## Answer

Two distinct benchmark axes, enabled by the same harness:

1. **Scenario benchmarking** — fix the mediator policy, vary runs. Produces a difficulty fingerprint per scenario (settle rate, beats-to-terminal, walkout rate, caucus usage). Becomes the validation harness for the scenario editor fog item: authors get distributions instead of vibes.
2. **Mediator benchmarking** — fix the scenario + party models/seeds, vary the mediator (scripted policy / random / agent-Z with different prompts or models). Because the engine is deterministic given seeds, outcome differences are attributable to mediator behavior. This is also the bridge to PLAN §11's calibration corpus: outcome metrics correlated against rubric scores across runs.

**Benchmark ≠ evaluation**: the harness measures *outcomes*; the ABA-rubric evaluator (out of MVP scope per 00/05) judges *process* from transcripts (see `research/aba-rubric.md` — note its ⚠ items still need primary-source verification). They are complementary: a mediator that squeezes a great settlement while violating self-determination should score differently on each. The harness deliberately does **not** wait for the evaluator — but its per-run snapshots (event log, terminal phase, final NegotiationState) are exactly the corpus format §11's calibration work would consume.

What the engine already provides: pure-TS headless driving (ScriptedRuntime proves keyless runs), `ModelConfig.temperature`/`seed`, per-invocation audit (`promptVersion`, state before/after, token usage), structured walkout/offer events, and both parties' `reservationValue` in state (surplus and its split are computable, not just raw settlement).

Design caveats to sharpen when implemented:

- **Cost/rate limits**: a run ≈ beats × 2 party calls + Z calls. 20 runs × ~15 beats × 3 calls ≈ 900 LLM calls per scenario-policy cell. Default N small; include a cheap/random mediator baseline; respect the spend-cap posture from ticket 04.
- **Variance**: LLM output is not seed-deterministic in practice — report distributions, never point estimates, and pin party configs per cell.
- **Shape**: headless CLI runner vs in-app batch mode — not yet decided.
- **Default mediator policy** for scenario-benchmark cells (where Z must not be the variable) — not yet decided; candidates: fixed scripted playbook, random policy, or a cheap pinned model.
