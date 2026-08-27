# 05 — Evaluator output contract & session-end flow

Type: grilling
Status: closed (out of scope)
Blocked by: 01, 03

## Question

Design the MVP evaluator: its output contract (qualitative findings — no scores — each naming an ABA Model Standard category, explaining the Mediator's conduct, and citing `eventId`s as evidence per PLAN §11's `EvaluationFinding` shape, minus scoring), when it runs (session end vs. mid-session markers), what input it receives (which audience scopes of the event log — PLAN §18's evaluator boundary), and how the report is presented/replayed. Data model must leave room for numeric scores and calibration later.

## Answer

**Ruled out of scope** (charting session, revised): the MVP has no evaluator LLM — a human reviews the transcript. The evaluator entity, output contract, and ABA rubric belong to the end product (see map's Out of scope). Research asset [research/aba-rubric.md](../research/aba-rubric.md) is parked for that future effort.
