# Mediation Simulator

A browser-based rehearsal environment that trains mediators: a human practices as the mediator between simulated parties, then receives evidence-backed feedback from an evaluator.

## Language

### Modes

**Mediator training**:
The MVP mode. A human user plays the Mediator between two simulated Parties and is evaluated on their mediation conduct.
_Avoid_: "training mode"

**War-gaming**:
A later mode in which a lawyer rehearses as advocate against simulated opposing parties. Not part of the MVP; enabled by the same participant model.
_Avoid_: "pre-mediation prep"

### People & seats

**Participant**:
A role-holder in a Session: a Party, the Mediator, or the Evaluator. Each seat is filled by a human or an agent; the kind is a per-seat configuration.
_Avoid_: player, user, actor

**Party**:
A disputant in the mediation (seat A or seat B). May be played by an agent or a human.
_Avoid_: player, disputant, agent (when referring to the seat)

**Mediator (Z)**:
The neutral who runs the mediation. The human user's seat in mediator training.
_Avoid_: facilitator, judge, referee

**Evaluator**:
A separate LLM entity that reviews the session afterward and produces findings about the Mediator's performance. Never a participant in the live session.
_Avoid_: scorer, grader, judge

**Agent**:
An LLM-driven occupant of a seat, configured per-seat with provider, model, persona, and behavioral profile.
_Avoid_: bot, AI, model (when referring to the seat)

### Session mechanics

**Session**:
One run of a Scenario from opening to agreement, impasse, or walkout.
_Avoid_: game, match, run

**Session phase**:
Where the mediation process stands: setup, opening, joint session, caucus, negotiation, agreement, impasse, review.
_Avoid_: state, step, stage

**Caucus**:
A private phase in which the Mediator meets one Party alone; its events are visible only to that Party and the Mediator.
_Avoid_: private chat, breakout

**Event log**:
The single append-only record of everything that happened in a Session; every Event declares its Audience.
_Avoid_: chat history, transcript (when referring to the store)

**Event audience**:
The set of participants permitted to observe an Event; the basis of every projection of the log.
_Avoid_: permissions, visibility (for events)

**Projection**:
The filtered view of the event log a given participant is allowed to see; the raw material of every prompt.
_Avoid_: context, chat

### Negotiation substance

**Position**:
What a Party has openly stated they want (e.g. the stated demand).
_Avoid_: demand (unqualified)

**Interest**:
The underlying need or concern behind a Party's Position; may be hidden or disclosed.
_Avoid_: motivation

**Reservation value**:
A Party's private walk-away point, known to the app and never revealed to other participants.
_Avoid_: bottom line, minimum

**BATNA / WATNA**:
A Party's best/ worst alternative to a negotiated agreement; part of their private scenario state.
_Avoid_: fallback plan

**Walkout**:
A Party's threat or act of leaving the mediation, gated by scenario thresholds.
_Avoid_: quit, rage-quit

### Materials

**Scenario**:
A declarative, versioned definition of a mediation exercise: facts, parties, positions, hidden state, and rules. No code changes needed to add one.
_Avoid_: case, template (for the authored artifact)

**Case resource**:
A document or artifact attached to a Scenario with an explicit visibility scope.
_Avoid_: file, attachment (when referring to in-simulation material)

**Reaction**:
Constrained metadata a Party's model returns describing how it perceived the last interaction; input to deterministic state changes, never authoritative.
_Avoid_: emotion, sentiment
