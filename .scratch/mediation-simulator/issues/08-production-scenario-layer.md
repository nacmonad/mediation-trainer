# 08 — Production Scenario layer

Type: implementation
Status: open
Blocked by: 06 (resolved), 07 (resolved)

## Question

Lift the validated Ticket 06 Scenario contract into `app/` without shipping the throwaway prototype:

1. implement a strict, versioned Zod Scenario schema that rejects unknown keys and unsupported schema versions;
2. author the three validated MVP Scenario fixtures as JSON;
3. expose deterministic plain-TypeScript operations for participant projection, disclosure eligibility/action, Offer acceptance under Reservation value plus authority, Reaction reduction, threshold-rule precedence, and terminal Walkout; and
4. verify the public Scenario-module seams with focused tests plus the existing participant, turn-model, lint, type/build, and session-actor checks.

Preserve the established layering: XState owns Session phase; plain TypeScript owns Scenario data and Negotiation state; authored JSON contains no executable formulas. Production code absorbs validated decisions only. The prototype remains primary-source evidence on `prototype/scenario-schema`.

## Confirmed test seams

- `parseScenario(input)` validates and returns one supported authored Scenario or a useful validation failure.
- participant projection returns only Case resources and Events permitted by exact participant Audience.
- disclosure and Offer decisions are returned as data through public functions, without hidden mutation.
- applying a constrained Reaction returns the next Negotiation state and ordered rule effects, with Walkout precedence and terminality.
