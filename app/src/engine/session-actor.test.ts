import assert from "node:assert/strict";
import test from "node:test";

import { createSession, type AgentSeat, type SeatConfig } from "./domain";
import { TurnDriver, TurnError, type DriverRuntime, type ScenarioRule } from "./driver";
import { ScriptedRuntime } from "./scripted-runtime";
import { SessionActor, sessionInputSchema } from "./session-actor";

type Id = "A" | "B" | "Z";
const party = (id: "A" | "B"): AgentSeat => ({
  id,
  role: "party",
  kind: "agent",
  model: { provider: "openai-compatible", model: "scripted" },
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

test("restored phase rehydrates XState without duplicating committed Events", async () => {
  const original = makeActor();
  await original.dispatch({ type: "OPEN_SESSION" });
  await original.dispatch({ type: "DECLARE_IMPASS" });
  const committedCount = original.session.log.length;
  const restoredDriver = new TurnDriver(original.session, {});
  const restored = new SessionActor(restoredDriver, "impasse");

  assert.equal(restored.phase, "impasse");
  assert.equal(restored.session.log.length, committedCount);
  await restored.dispatch({ type: "ENTER_REVIEW" });
  assert.equal(restored.phase, "review");
  assert.equal(restored.session.log.length, committedCount);
});

test("manual retry resumes the failed Party call without duplicating the Mediator Event", async () => {
  let calls = 0;
  const flaky: DriverRuntime = {
    config: { provider: "openai-compatible", model: "flaky" },
    async respond() {
      calls += 1;
      if (calls <= 2) throw new TurnError("transport", "temporary outage");
      return { utterance: "A recovered.", reaction: {} };
    },
  };
  const session = createSession<Id>(seats);
  const actor = new SessionActor(new TurnDriver(session, {
    A: flaky,
    B: new ScriptedRuntime([{ utterance: "", reaction: {} }]),
  }));
  await actor.dispatch({ type: "OPEN_SESSION" });
  await assert.rejects(actor.dispatch({ type: "SEND", audience: ["A"], text: "One committed message." }));
  assert.equal(actor.session.log.filter((event) => event.sender === "Z").length, 1);

  await actor.dispatch({ type: "RETRY_BEAT" });
  assert.equal(actor.session.log.filter((event) => event.sender === "Z").length, 1);
  assert.equal(actor.session.log.filter((event) => event.sender === "A").length, 1);
  assert.equal(actor.driver.hasPendingBeat, false);
});

test("addressing both Parties considers each Party only once in the beat", async () => {
  const calls = { A: 0, B: 0 };
  const runtime = (partyId: "A" | "B"): DriverRuntime => ({
    config: { provider: "openai-compatible", model: `party-${partyId}` },
    async respond() {
      calls[partyId] += 1;
      return { utterance: `${partyId} responds.`, reaction: {} };
    },
  });
  const actor = new SessionActor(new TurnDriver(createSession<Id>(seats), {
    A: runtime("A"),
    B: runtime("B"),
  }));

  await actor.dispatch({ type: "OPEN_SESSION" });
  await actor.dispatch({ type: "SEND", audience: ["A", "B"], text: "Opening question." });

  assert.deepEqual(calls, { A: 1, B: 1 });
  assert.deepEqual(
    actor.session.log.filter((event) => event.sender === "A" || event.sender === "B").map((event) => event.sender),
    ["A", "B"],
  );
});

test("the agent Mediator speaks through the dispatch seam and runs the Party beat", async () => {
  const mediator = {
    config: { provider: "openai-compatible" as const, model: "mediator-z" },
    async respond() {
      return { utterance: "What would a fair split look like?", audience: "both" as const };
    },
  };
  const session = createSession<Id>([party("A"), party("B"), { id: "Z", role: "mediator", kind: "agent", model: mediator.config }]);
  const driver = new TurnDriver(session, {
    A: new ScriptedRuntime([{ utterance: "Half.", reaction: {} }]),
    B: new ScriptedRuntime([{ utterance: "", reaction: {} }]),
  });
  driver.mediatorRuntime = mediator;
  const actor = new SessionActor(driver);
  await actor.dispatch({ type: "OPEN_SESSION" });
  await actor.dispatch({ type: "AGENT_MEDIATOR_TURN" });

  const zSpeech = actor.session.log.filter((event) => event.sender === "Z");
  assert.equal(zSpeech.length, 1);
  assert.equal(actor.session.log.some((event) => event.sender === "A"), true);
  assert.equal(actor.phase, "joint_session");
  const zCall = actor.driver.invocations.filter((call) => call.seatId === "Z").at(-1);
  assert.equal(zCall?.seatId, "Z");
  assert.equal(zCall?.ok, true);
  assert.deepEqual(zCall?.mediatorResponse, { utterance: "What would a fair split look like?", audience: "both" });
});

test("agent Mediator silence is legal and runs no Party beat", async () => {
  let partyCalls = 0;
  const mediator = {
    config: { provider: "openai-compatible" as const, model: "mediator-z" },
    async respond() {
      return { utterance: "", audience: "both" as const };
    },
  };
  const session = createSession<Id>([party("A"), party("B"), { id: "Z", role: "mediator", kind: "agent", model: mediator.config }]);
  const driver = new TurnDriver(session, {
    A: { config: { provider: "openai-compatible", model: "a" }, async respond() { partyCalls += 1; return { utterance: "", reaction: {} }; } },
  });
  driver.mediatorRuntime = mediator;
  const actor = new SessionActor(driver);
  await actor.dispatch({ type: "OPEN_SESSION" });
  await actor.dispatch({ type: "AGENT_MEDIATOR_TURN" });

  assert.equal(actor.session.log.filter((event) => event.sender === "Z").length, 0);
  assert.equal(partyCalls, 0);
  assert.equal(actor.driver.invocations.at(-1)?.ok, true);
});

test("AGENT_MEDIATOR_TURN is schema-valid and caucus is rejected for the agent seat", async () => {
  assert.equal(sessionInputSchema.safeParse({ type: "AGENT_MEDIATOR_TURN" }).success, true);
  const mediator = {
    config: { provider: "openai-compatible" as const, model: "mediator-z" },
    async respond() {
      return { utterance: "We should talk.", audience: "both" as const };
    },
  };
  const session = createSession<Id>([party("A"), party("B"), { id: "Z", role: "mediator", kind: "agent", model: mediator.config }]);
  const driver = new TurnDriver(session, {});
  driver.mediatorRuntime = mediator;
  const actor = new SessionActor(driver);
  await actor.dispatch({ type: "OPEN_SESSION" });
  await actor.dispatch({ type: "OPEN_CAUCUS", partyId: "A" });
  await assert.rejects(actor.dispatch({ type: "AGENT_MEDIATOR_TURN" }), /agentMediatorStep/);
});
