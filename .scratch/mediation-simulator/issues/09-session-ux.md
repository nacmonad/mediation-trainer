# 09 — Mediator Session UX

Type: implementation
Status: resolved
Blocked by: 07 (resolved), 08 (resolved)

## Question

Connect the production Scenario boundary and XState Session actor to the mediator-facing MVP flow. Ship four route-level views — Scenario library, Session setup, live Session, and post-Session review — with a durable Session id in the URL and a calm, chat-like working surface.

### Scenario library and setup

- Scenario cards show title, difficulty, tags, shared premise, estimated complexity, and the count of Case resources available to the Mediator. They never reveal Party-private facts, behavioral triggers, Reservation values, authority limits, target ranges, or other hidden economics.
- Selecting a Scenario opens setup rather than immediately beginning a Session.
- Setup shows the shared Scenario brief and Case resources authorized for the Mediator, plus Party A/B provider and model configuration with credential status. Credentials default to memory-only.
- `Begin Session` remains disabled until both Party configurations validate. Persona and authored hidden economics remain concealed.

### Live Session workspace

- Use one chronological Projection of the append-only event log. Render Party A on the left, Mediator (Z) in the center, and Party B on the right; system Events are quiet full-width separators. On narrow screens this becomes one column without losing speaker identity.
- Every rendered Event carries a persistent event-audience label (`Both`, `Party A only`, or `Party B only`). Position and color never substitute for the label.
- The composer has an explicit event-audience selector and is the only surface locked while a beat is pending. Show per-Party pending placeholders, land completed Party responses independently, and allow retry of a failed Party call without replaying completed responses.
- Desktop uses a compact Session-phase/Party rail, central conversation surface, and contextual Case-resource/action rail. Tablet collapses the contextual rail into a sheet; mobile is Projection-first with phase/status in the header and audience/resources/actions in bottom sheets.
- Caucus is an explicit Session mode with visible open/close actions and clear bookend Events. A side panel or floating treatment is a later enhancement, not required for MVP.
- `Declare agreement` and `Declare impasse` live in a restrained Session-actions menu and require confirmation. Scenario-triggered Walkout bypasses confirmation. Each terminal outcome leads to a short summary and then review.

### Recovery, debug, and review

- Persist every committed Event and recover the Session after refresh with an explicit `Recovered` indicator. Provider failures appear at the failed beat with Retry and End Session actions; never discard or silently regenerate the event log.
- Debug mode is opt-in. Party response borders encode internal state with both color and text: teal regulated/engaged, amber pressured/guarded, red escalation/Walkout risk, gray unavailable/pending.
- Debug mode exposes sanitized provider/model request and response data, request ids, latency, retry attempts, token usage, errors, tool calls/results when available, and engine state before/after. It may display provider-returned reasoning or an explicitly generated concise rationale, but never claims access to provider-hidden chain-of-thought.
- A separate developer-only full-engine control may reveal authored triggers, thresholds, and hidden values. Learner debug overlays do not reveal those values and no debug-only data enters ordinary review or export.
- Review is its own route with outcome summary, chronological Event-log Projection, event-audience filters, human rubric inputs, optional coaching/engine comparison, and export. No evaluator LLM is introduced at MVP.

### Visual and implementation constraints

- Calm, serious, tactile, light-first UI with system dark mode, Geist, one deep-teal accent, consistent medium radii, strong focus states, restrained motion, and WCAG-AA color/label treatment. Design dials: variance 4, motion 2, density 6.
- Preserve established layering: React renders and dispatches typed mediator actions; XState owns Session phase; plain TypeScript owns the event log, Projections, Scenario data, Negotiation state, and beat loop. UI components must not duplicate engine truth.
- Read `app/AGENTS.md` and the required local Next.js 16 docs before app edits.

## Acceptance checks

- A Mediator can select each production Scenario, configure both Party seats, begin a Session, address both Parties or one Party, enter/leave Caucus, observe pending/failure states, reach every terminal outcome, and enter review.
- Event-audience labels and Projections prevent Caucus content from appearing to an unauthorized participant at every responsive layout.
- Refresh recovery retains committed Events and Session phase; retry never duplicates an already committed response.
- Debug mode is accessible, opt-in, and excluded from ordinary review/export; no UI claims to expose hidden chain-of-thought.
- Focused UI/engine integration tests cover the critical flow and privacy boundary. Existing participant smoke test, 26-check turn-model smoke test, engine/session tests, app lint, TypeScript, and production build pass.

## Answer

Resolved 2026-08-30. The app now ships the complete four-route Mediator flow: Scenario library, Scenario/setup view, live Session workspace with a durable URL id, and post-Session review. The library and setup project only shared facts and Case resources authorized for the Mediator; selected per-Party provider/model configuration stays memory-only and follows the Session into its debug trace.

The live workspace dispatches exclusively through the typed `SessionActor` seam. XState remains the owner of Session phase while the plain-TypeScript driver owns the Event log, Projections, Negotiation state, audited provider attempts, and retry frontier. Party A, Mediator, and Party B have distinct left/center/right positions with persistent event-audience labels; Caucus is explicit and audience-gated; terminal declarations require confirmation; responsive layouts collapse to a single Projection without losing speaker or audience identity.

Committed Session state is saved locally after every action and failure. Refresh rehydrates the XState phase without duplicating Events and labels the Session `Recovered`. `RETRY_BEAT` resumes only the failed/not-yet-run Party considerations, never re-appending the Mediator Event or replaying completed Party output. Review provides outcome, event-audience filters, local Mediator reflection, and a JSON export with debug invocation records stripped.

Debug mode is opt-in and shows accessible Party-state borders plus audited provider/model configuration, attempts, visible Event ids, structured response/error data, and Negotiation state before/after. It never claims access to provider-hidden chain-of-thought.

Verification passed: browser screenshot pre-flight of library/setup/live routes; participant-interface smoke test; turn-model smoke test (26 checks); all 11 engine/session tests; ESLint; TypeScript and Next.js 16 production build.
