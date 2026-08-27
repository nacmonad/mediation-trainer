import assert from "node:assert/strict";
import test from "node:test";

import { createSession, type AgentSeat, type SeatConfig } from "./domain";
import { TurnDriver, type ScenarioRule } from "./driver";
import { ScriptedRuntime } from "./scripted-runtime";
import { SessionActor, sessionInputSchema } from "./session-actor";

type Id = "A" | "B" | "Z";
const party = (id: "A" | "B"): AgentSeat => ({
  id,
  role: "party",
  kind: "agent",
  model: { provider: "ollama", model: "scripted" },
});
const seats: readonly SeatConfig[] = [party("A"), party("B"), { id: "Z", role: "mediator", kind: "human" }];

function makeActor(rules: readonly ScenarioRule<Id>[] = []) {
  const session = createSession<Id>(seats, { A: { anger: 20 }, B: { anger: 20 } });
  const driver = new TurnDriver(session, {
    A: new ScriptedRuntime([{ utterance: "A responds.", reaction: { angerDelta: 5 } }]),
    B: new ScriptedRuntime([{ utterance: "", reaction: {} }]),
  }, rules);
  return new SessionActor(driver);
}

test("typed transition seam drives all seven phases while domain state stays plain TS", async () => {
  const actor = makeActor();
  assert.equal(actor.phase, "setup");
  await actor.dispatch({ type: "OPEN_SESSION" });
  await actor.dispatch({ type: "SEND", audience: ["A"], text: "Welcome." });
  assert.equal(actor.session.log.some((event) => event.sender === "A"), true);
  await actor.dispatch({ type: "OPEN_CAUCUS", partyId: "A" });
  assert.equal(actor.phase, "caucus");
  assert.equal(actor.session.caucusWith, "A");
  await actor.dispatch({ type: "CLOSE_CAUCUS" });
  assert.equal(actor.session.caucusWith, null);
  await actor.dispatch({ type: "DECLARE_AGREEMENT" });
  assert.equal(actor.phase, "agreement");
  await actor.dispatch({ type: "ENTER_REVIEW" });
  assert.equal(actor.phase, "review");
});

test("walkout is raised by the driver and reflected as the sole system transition", async () => {
  const actor = makeActor([{ partyId: "A", dimension: "anger", op: ">", threshold: 22, effect: "walkout" }]);
  await actor.dispatch({ type: "OPEN_SESSION" });
  await actor.dispatch({ type: "SEND", audience: ["A"], text: "State your Position." });
  assert.equal(actor.phase, "walkout");
  assert.equal(actor.session.log.at(-1)?.kind, "session_event");
});

test("future proposer inputs are schema-validated", () => {
  assert.equal(sessionInputSchema.safeParse({ type: "OPEN_CAUCUS", partyId: "A" }).success, true);
  assert.equal(sessionInputSchema.safeParse({ type: "PARTY_WALKS_OUT", partyId: "A" }).success, false);
  assert.equal(sessionInputSchema.safeParse({ type: "SEND", audience: [], text: "" }).success, false);
});
