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

Deliverable framing: document the exercise and provide analytics — the harness emits machine-readable run artifacts plus a human-readable summary (settle-rate table, surplus-split distribution, per-model comparison), not just a dashboard-aspirational feature.

Design caveats to sharpen when implemented:

- **Shape — CLI, decided (2026-08-30)**: a headless runner (`tsx scripts/benchmark.ts --scenario <slug> --runs N --mediator <policy>`). No UI dependency, runs unattended, and the engine work (mediator-policy seam, metrics extraction, aggregation) is identical if a UI wraps it later. The credential path needs a CLI story (env-var key feeding the existing vault/gateway, one security story), and mid-run schema failures need a no-human retry/skip policy.
- **Persistence — eventual**: benchmark results should outlive the process as append-only artifacts (e.g. JSONL runs + an aggregated report per cell), fitting the local-only persistence posture; analytics live on top of the artifact store, not in it. Exact format not yet designed.
- **Model-comparison axis**: per-seat model configuration (§13) turns the harness into a model × scenario matrix — outcome differences across party/mediator models surface performance and behavioral biases (e.g. does provider X's model concede earlier? does a scenario only produce its intended difficulty under one provider?). §13's stated goal, "collect scenario-level statistics by model to detect whether a scenario is accidentally tuned to one provider's behavior," is this harness's statistics deliverable.
- **Cost/rate limits**: a run ≈ beats × 2 party calls + Z calls. 20 runs × ~15 beats × 3 calls ≈ 900 LLM calls per scenario-policy cell. Default N small; include a cheap/random mediator baseline; respect the spend-cap posture from ticket 04.
- **Variance**: LLM output is not seed-deterministic in practice — report distributions, never point estimates, and pin party configs per cell.
- **Default mediator policy** for scenario-benchmark cells (where Z must not be the variable) — still open; candidates: fixed scripted playbook (deterministic, free, maximally visible scenario differences), random policy (unbiased sanity floor), or a cheap pinned local model (realistic behavior, zero API cost). Lean: scripted playbook default, cheap local model secondary.
