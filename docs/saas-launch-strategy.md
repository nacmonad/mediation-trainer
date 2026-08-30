# Paid SaaS launch strategy

Status: proposed

This document turns the live-validated mediator-training MVP into a narrowly scoped paid founding beta. It is a product and engineering plan, not legal advice.

## Executive decision

Launch a managed-inference beta for individual mediators and mediation trainers. The first paid version should remove API-key setup, preserve the existing Session experience, and provide a small private Scenario library.

Do not accept confidential client documents in the first release. Launch with synthetic or manually de-identified material while the redaction, retention, access-control, and provider-contract layers are designed and tested.

The product promise is:

> Rehearse a difficult mediation with realistic independent Parties before entering the room.

The hosted product sells convenience, privacy operations, reliable inference, and reusable private Scenarios. The open project supplies trust, self-hosting, extensibility, and a community Scenario ecosystem.

## Licensing recommendation

Use `AGPL-3.0-only` for the application code.

Why:

- It is an [OSI-listed open-source license](https://opensource.org/license?ls=agpl) designed to require source availability when modified software is offered over a network.
- It permits local use, study, modification, redistribution, and self-hosting.
- It discourages a competitor from making a closed hosted fork without contributing its modifications.
- The copyright owner can still operate the official hosted service and may later offer a separate commercial license.

The GNU project explains that AGPLv3 requires a program to offer corresponding source to users who interact with it remotely over a network: <https://www.gnu.org/licenses/gpl-faq.html#UnreleasedModsAGPL>.

Do not use a custom source-available license while describing the project as open source. Apache-2.0 would maximize adoption and includes an explicit patent grant, but would also allow closed hosted forks: <https://www.apache.org/licenses/LICENSE-2.0>.

Before accepting outside code contributions, choose one of these contribution models:

1. Keep the hosted product AGPL-compatible and accept contributions under the inbound license. This is simplest and most contributor-friendly.
2. Require a narrowly written contributor agreement that grants commercial relicensing rights. This preserves a future dual-license business but adds contributor friction and requires legal review.

Scenario content needs separate contribution terms before opening a public directory. Software licenses are a poor fit for authored exercises. A later policy should define attribution, permitted reuse, synthetic-data requirements, warranties, and removal procedures.

Do not add the `LICENSE` file until the repository owner explicitly approves this recommendation.

## Initial customer and wedge

Primary customer:

- Solo mediator or mediation trainer
- Practices or teaches regularly enough to repeat exercises
- Wants realistic opposing behavior without coordinating role players
- Values confidentiality, preparation speed, and post-Session review

Secondary customer:

- Small law or dispute-resolution team
- Needs shared private Scenarios and predictable billing
- Will pay for administration, retention controls, and support

Do not start with enterprise procurement. SSO, data-processing agreements, custom retention, security questionnaires, and organizational controls would consume the launch window.

## Founding-beta offer

Ship one paid plan and one non-paid path:

- **Self-hosted:** free under the open-source license; users supply infrastructure and provider access.
- **Founding beta:** `$49/month` per individual, including 20 completed Sessions per month, a private Scenario library, managed inference, export, and email support.

Use a visible Session allowance instead of “unlimited.” Model cost varies by provider, model, prompt growth, and retries. Block or require a top-up at the allowance rather than allowing an unbounded bill.

Treat `$49` and 20 Sessions as a testable hypothesis. Interview the first ten users and measure activation, Session completion, repeat use, support load, and inference margin before introducing annual or team plans.

## Product boundary for week one

Include:

- Email magic-link authentication
- Managed Party inference with no user API keys
- The three synthetic Scenarios
- Private user-owned Scenario JSON import
- Server-persisted Session summaries and exports
- Stripe Checkout and customer portal
- A usage ledger, monthly Session allowance, and hard provider-spend ceiling
- Account deletion and Scenario/Session deletion
- Basic operational audit events that never contain prompts, credentials, or confidential content
- Terms, privacy notice, acceptable-use boundary, and prominent “no confidential client documents during beta” copy

Exclude:

- Raw confidential document upload
- Presidio-based redaction claims
- Community publishing or moderation
- Organization workspaces, roles, SSO, or matter-level access
- Venice Character selection
- Evaluator scoring
- White-labeling and commercial licenses
- Unlimited usage

## Architecture transition

Keep the current domain boundary: XState owns Session phase; plain TypeScript owns the Event log, audience Projections, negotiation state, Offers, and Scenario rules.

Add hosted services around it:

```text
Browser
  -> authenticated Next.js application
      -> account and entitlement service
      -> Session and private Scenario repository
      -> managed inference gateway
          -> provider project credentials
      -> usage ledger and spend guard
      -> Stripe webhook handler
```

Recommended one-week stack:

- Existing Next.js application
- Managed PostgreSQL with row-level tenant ownership
- Passwordless authentication backed by secure, HttpOnly cookies
- Stripe Checkout, subscriptions, customer portal, and signed webhooks
- One managed inference provider initially; preserve the provider interface internally
- Structured logs with content redaction and error tracking

Provider credentials belong in the deployment platform's encrypted secret store, not in browser storage, application tables, or the current RAM vault. Each paid request must be tied to an authenticated account, entitlement, idempotency key, usage reservation, and hard budget check before contacting the provider.

The current session-id-addressed RAM credential vault is acceptable only for local/self-hosted demonstration. Remove it from the hosted path.

## Security and privacy launch gates

These are release blockers:

- TLS-only production deployment
- Authenticated authorization checks on every private Scenario and Session operation
- HttpOnly, Secure, SameSite cookies and CSRF protection where applicable
- Provider keys restricted by project, budget, and environment
- Hard per-account and global spend caps
- No secrets or prompt bodies in logs, traces, analytics, error reports, or support tooling
- Explicit data inventory and deletion path
- Database backups with documented retention
- Dependency and secret scanning on the default branch
- Abuse throttling and request-size limits
- A tested account deletion flow
- Public copy that accurately describes data handling

Do not claim that hosted inference is end-to-end encrypted merely because a provider offers a private-inference flag. The application server compiles and sends Party prompts and therefore handles their plaintext.

## Seven-day execution sequence

### Day 1: commercial skeleton

- Add the approved `AGPL-3.0-only` license to the repository
- Lock the founding-beta offer and usage allowance
- Add authentication, account records, and production environments
- Publish terms, privacy boundary, and beta disclaimer drafts

### Day 2: hosted persistence

- Persist private Scenarios, Session metadata, and ownership
- Keep exact Event audiences intact
- Add deletion and export paths

### Day 3: managed inference

- Replace the hosted credential-registration path with server-owned provider credentials
- Add authenticated metering, idempotency, retries, and spend guards
- Keep provider diagnostics content-free in production

### Day 4: billing

- Add Stripe Checkout and customer portal
- Verify signed webhooks and entitlement transitions
- Test failed payment, cancellation, and allowance exhaustion

### Day 5: product hardening

- Add rate and payload limits
- Exercise cross-account authorization tests
- Test recovery, deletion, billing, provider failure, and spend-cap behavior
- Add operational alerts and a support runbook

### Day 6: private beta

- Deploy behind a beta flag
- Invite three to five known practitioners
- Observe first-Session activation and failure points
- Fix onboarding and reliability defects only

### Day 7: paid opening

- Enable Checkout for a capped founding cohort
- Publish the landing-page paid CTA and honest privacy boundary
- Review usage and provider spend daily
- Schedule ten customer interviews

## Success measures for the first 30 days

- At least 50% of invited users begin a Session
- At least 60% of begun Sessions reach a terminal phase
- At least 30% of activated users complete a second Session within seven days
- Fewer than 5% of Party calls require manual retry
- Managed inference cost stays below 20% of collected revenue
- No cross-account access, secret exposure, or unexpected provider-spend incident
- At least five users ask to create or reuse a custom Scenario

## Next product sequence

1. Separate Evaluator with evidence-backed Session findings and clear professional-standard provenance
2. Research workflow for developing credible synthetic Scenarios from available cases and authoritative source material
3. Visual Scenario builder with validation, preview, and private drafts
4. `presidio-web` preparation pipeline for local redaction before upload
5. Private user Scenario library and ownership controls
6. Curated public Scenario publishing with attribution, practitioner feedback, reviews, ratings, curation, and moderation
7. Optional Venice Character personas for stable Party voice
8. Team workspaces, retention policies, and administrative controls

The confidential-document release needs its own threat model. Local redaction reduces exposure but does not prove that a document is safe, and the hosted system must still address originals, derived text, model-provider retention, backups, support access, and deletion.

## Decisions required

- Decide whether future outside contributions need a contributor agreement for commercial relicensing
- Approve the `$49/month`, 20-Session founding-beta hypothesis
- Choose the initial managed inference provider and default Party model
- Choose the hosting, database, authentication, and billing vendors
- Decide whether imported private Scenario JSON is included in week one or deferred to the visual builder
