# 02 — Turn orchestration & session driver

Type: grilling
Status: open
Blocked by:

## Question

How does a turn actually happen? PLAN §4 defines session phases but never defines who speaks when. Decide the conversation driver such that:

- the human mediator's utterances always enter the event log as their own events;
- parties respond when addressed, on offers, and on state changes — with scenario-configured assertiveness controlling volunteering;
- the design is expressible in the Phase-0 vertical slice with a mock model runtime, and extensible to war-gaming (a human in a party seat) later.

Sub-questions to resolve: what ends a party's turn; whether parties may react unprompted after another party's message; how the mediator opens a caucus mechanically; what happens when a model call fails mid-turn.
