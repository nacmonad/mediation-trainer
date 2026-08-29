import assert from "node:assert/strict";
import test from "node:test";

import {
  applyDisclosure,
  applyScenarioReaction,
  decideDisclosure,
  decideOfferAcceptance,
  parseScenario,
  projectScenarioFor,
} from "./scenario.ts";
import supplier from "../scenarios/supplier-invoice.json";
import employment from "../scenarios/employment.json";
import software from "../scenarios/software-implementation.json";

test("parseScenario accepts all fixtures and rejects unknown or unsupported fields", () => {
  for (const fixture of [supplier, employment, software]) {
    assert.equal(parseScenario(fixture).schemaVersion, 1);
  }
  assert.throws(() => parseScenario({ ...supplier, surprise: true }), /unrecognized|unknown/i);
  assert.throws(() => parseScenario({ ...supplier, schemaVersion: 2 }), /schemaVersion|invalid/i);
});

test("participant projection filters resources and disclosed events by exact audience", () => {
  const scenario = parseScenario(employment);
  const projection = projectScenarioFor(scenario, "A", [
    { id: "public", audience: ["A", "B", "Z"], payload: "joint" },
    { id: "private-a", audience: ["A", "Z"], payload: "caucus" },
    { id: "private-b", audience: ["B", "Z"], payload: "hidden" },
  ]);
  assert.deepEqual(projection.events.map((event) => event.id), ["public", "private-a"]);
  assert.ok(projection.resources.every((resource) => resource.audience.includes("A")));
  assert.ok(projection.resources.some((resource) => resource.audience.includes("A")));
});

test("disclosure is phase-gated and returns a new disclosed-id collection", () => {
  const scenario = parseScenario(employment);
  const rule = scenario.disclosureRules[0];
  assert.equal(decideDisclosure(scenario, rule.partyId, rule.factId, "joint_session", []).allowed, false);
  const decision = decideDisclosure(scenario, rule.partyId, rule.factId, "caucus", []);
  assert.equal(decision.allowed, true);
  assert.deepEqual(applyDisclosure([], decision), [rule.factId]);
});

test("Offer acceptance observes Reservation value and authority", () => {
  const scenario = parseScenario(software);
  assert.deepEqual(decideOfferAcceptance(scenario, "A", 460_000), {
    accepted: false,
    reason: "below_authority",
  });
  assert.deepEqual(decideOfferAcceptance(scenario, "A", 472_000), {
    accepted: true,
    reason: "acceptable",
  });
  assert.deepEqual(decideOfferAcceptance(scenario, "B", 480_000), {
    accepted: false,
    reason: "above_authority",
  });
});

test("Reaction is scaled and capped; Walkout precedes force-speak and is terminal", () => {
  const scenario = parseScenario(software);
  const initial = scenario.parties.A.initialState;
  const result = applyScenarioReaction(scenario, "A", initial, { angerDelta: 100 }, "joint_session", []);
  assert.equal(result.state.anger, initial.anger + scenario.parties.A.reducer.caps.anger);

  const precedence = applyScenarioReaction(
    scenario,
    "A",
    { ...initial, anger: 84 },
    { angerDelta: 10 },
    "joint_session",
    []
  );
  assert.deepEqual(precedence.effects.map((effect) => effect.effect), ["walkout"]);
  assert.equal(precedence.state.walkoutStatus, "walked_out");
  assert.throws(
    () => applyScenarioReaction(scenario, "A", precedence.state, { angerDelta: -10 }, "joint_session", precedence.firedRuleIds),
    /terminal/i
  );
  assert.equal(decideOfferAcceptance(scenario, "A", 472_000, precedence.state).reason, "terminal_walkout");
  const terminalDisclosure = decideDisclosure(
    scenario, "A", "fact-margin-pressure", "caucus", [], precedence.state
  );
  assert.equal(terminalDisclosure.allowed, false);
  if (!terminalDisclosure.allowed) assert.equal(terminalDisclosure.reason, "terminal_walkout");
});

test("threshold rules are phase-scoped and edge-triggered", () => {
  const scenario = parseScenario(employment);
  const state = { ...scenario.parties.A.initialState, anger: 69 };
  const wrongPhase = applyScenarioReaction(scenario, "A", state, { angerDelta: 2 }, "setup", []);
  assert.deepEqual(wrongPhase.effects, []);
  const crossed = applyScenarioReaction(scenario, "A", state, { angerDelta: 2 }, "joint_session", []);
  assert.deepEqual(crossed.effects.map((effect) => effect.id), ["employee-force-speak"]);
  const alreadyAbove = applyScenarioReaction(scenario, "A", { ...state, anger: 71 }, { angerDelta: 2 }, "joint_session", []);
  assert.deepEqual(alreadyAbove.effects, []);
});
