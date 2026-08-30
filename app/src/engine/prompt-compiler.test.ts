import assert from "node:assert/strict";
import test from "node:test";

import { initialNegotiationState, type MediationEvent, type PartyRuntime } from "./domain";
import { PROMPT_VERSION, compilePartyPrompt, renderPartyOutputContract, renderQualitativeState, type PartyPromptInput, type ScenarioPromptView } from "./prompt-compiler";

const runtime: PartyRuntime = {
  seatId: "A",
  persona: { displayName: "Supplier", brief: "Direct, commercial, and concerned about cash flow." },
  negotiation: initialNegotiationState({ reservationValue: 100 }),
  knowledge: { disclosedFacts: [], privateFacts: ["Needs payment this month"], documentIds: [] },
  memory: { notes: [] },
};

const scenario: ScenarioPromptView = {
  sharedFacts: ["The invoice totals 180 and is 60 days overdue."],
  resources: [
    { id: "r1", title: "Invoice ledger", body: "Line items for the disputed invoice.", audience: ["A", "B", "Z"] },
    { id: "r2", title: "Party B performance review", body: "Confidential to B and the mediator.", audience: ["B", "Z"] },
  ],
};

const projection = [
  { id: "e0001", seq: 1, timestamp: 1, sender: "Z", audience: ["A", "Z"], kind: "message", payload: { text: "Private caucus prompt" } },
] satisfies PartyPromptInput["projection"];

test("party prompt includes private runtime context and only the supplied Projection", () => {
  const prompt = compilePartyPrompt({ runtime, scenario, mandatory: true, projection });
  assert.match(prompt.system, /must provide a non-empty utterance/);
  assert.match(prompt.user, /Needs payment this month/);
  assert.match(prompt.user, /Private caucus prompt/);
  assert.doesNotMatch(prompt.user, /Party B secret/);
});

test("behavioral state renders qualitatively and never as raw numbers", () => {
  const angry: PartyRuntime = {
    ...runtime,
    negotiation: initialNegotiationState({ reservationValue: 100, position: 180, anger: 82, trustMediator: 10, fatigue: 60 }),
  };
  const prompt = compilePartyPrompt({ runtime: angry, scenario, mandatory: true, projection: [] });
  assert.match(prompt.user, /furious/);
  assert.match(prompt.user, /distrust the mediator/);
  assert.match(prompt.user, /tired of the process/);
  assert.match(prompt.user, /openly stated position is 180/);
  assert.match(prompt.user, /private walk-away point is 100/);
  assert.doesNotMatch(prompt.user, /"anger"/);
  assert.doesNotMatch(prompt.user, /"trustMediator"/);
});

test("case documents respect per-audience visibility and shared facts are included", () => {
  const prompt = compilePartyPrompt({ runtime, scenario, mandatory: true, projection: [] });
  assert.match(prompt.user, /Facts known to everyone/);
  assert.match(prompt.user, /Invoice ledger/);
  assert.doesNotMatch(prompt.user, /performance review/);
});

test("the mandatory-speak rule follows the mandatory flag", () => {
  const forced = compilePartyPrompt({ runtime, scenario, mandatory: true, projection: [] });
  const optional = compilePartyPrompt({ runtime, scenario, mandatory: false, projection: [] });
  assert.match(forced.system, /must provide a non-empty utterance/);
  assert.doesNotMatch(forced.system, /may decline to speak/);
  assert.match(optional.system, /may decline to speak/);
  assert.doesNotMatch(optional.system, /must provide a non-empty utterance/);
});

test("compiled prompts are deterministic and carry the compiler version", () => {
  const a = compilePartyPrompt({ runtime, scenario, mandatory: true, projection });
  const b = compilePartyPrompt({ runtime, scenario, mandatory: true, projection });
  assert.deepEqual(a, b);
  assert.equal(a.version, PROMPT_VERSION);
});

test("the output-contract fragment names the exact Reaction keys and bounds", () => {
  const contract = renderPartyOutputContract(true);
  assert.match(contract, /angerDelta/);
  assert.match(contract, /-12 and 12/);
  assert.match(contract, /"amount": number/);
});
