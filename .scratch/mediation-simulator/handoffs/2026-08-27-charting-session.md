# Handoff — Wayfinder charting session (2026-08-27)

You are taking over from a session that **charted the wayfinder map** for this repo. Charting is done. Your job, most likely: **work ticket 01** (the user was about to approve this). Read the map first: `.scratch/mediation-simulator/map.md`.

## State of the effort

- **Effort**: Mediation Simulator MVP spec — see the map: `.scratch/mediation-simulator/map.md`. It is the canonical state; this handoff only orients you.
- **Destination**: a buildable MVP spec for a **mediator-training simulator** (human plays Mediator Z between two LLM agent parties A/B, in-browser, then reviews the transcript themselves — no evaluator LLM at MVP). Hand-off target after the map clears: `/to-spec` → `/to-tickets` → `/implement`.
- **Charting is complete.** Research tickets resolved or closed. The frontier is two open tickets.

## Read first (in this order)

1. `.scratch/mediation-simulator/map.md` — destination, decisions-so-far, fog, out-of-scope
2. `.scratch/mediation-simulator/issues/01-participant-interfaces.md` — the ticket to work (prototype type)
3. `CONTEXT.md` — project glossary; use its terms exactly
4. `PLAN.md` — source architecture doc (map wins where they conflict)
5. `OUTLINE.md` — the original design conversation; contains concrete type sketches (`PartyRuntime`, `ModelConfig`, `NegotiationState`, `MediationEvent`, `applyPartyReaction`, `ModelInvocation`), the stack recommendation, and the XState actor layout. It's the starting point for ticket 01's typedefs.

## Working agreements

- Issue tracker: **local markdown** (`.scratch/mediation-simulator/`). Claim a ticket by setting `Status: claimed` before working; resolve by appending `## Answer`, setting `Status: resolved`, and adding one line to the map's Decisions-so-far. (Conventions: `.agents/skills/setup-matt-pocock-skills/issue-tracker-local.md`.)
- Repo is git (`main`, remote `github.com:nacmonad/mediation-trainer` over SSH). Branch-per-ticket; prototypes go on a throwaway branch (`prototype/...`) per the prototype skill — never into main. Pushes/commits touching git metadata need unsandboxed approval; SSH remote may force that too (HTTPS alternative not yet set up).
- Wayfinder rule: **at most one ticket resolved per session** (research tickets excepted). Skills to call when working a ticket: `grilling` + `domain-modeling` (decision tickets), `prototype` (ticket 01).
- User: solo SWE, LLM-agent experience, no mediation domain expertise; lawyer friend is the practice user. Decisions are the user's — grill, recommend, wait.

## Next action

Claim [01 — Core participant & runtime interfaces](../issues/01-participant-interfaces.md) (set `Status: claimed`), branch `prototype/participant-interfaces`, then follow the `prototype` skill **LOGIC branch**: a single double-clickable HTML file that exercises the seat model (human/agent toggle per seat, caucus audience/projection rules, reaction → `applyPartyReaction` reducer) with state surfaced after every action. Verdict + prototype pointer go back on the ticket; only validated decisions reach main.
