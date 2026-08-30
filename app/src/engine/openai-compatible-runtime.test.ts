import assert from "node:assert/strict";
import test from "node:test";

import { initialNegotiationState, type PartyRuntime } from "./domain";
import { compilePartyPrompt } from "./openai-compatible-runtime";

const runtime: PartyRuntime = {
  seatId: "A",
  persona: { displayName: "Supplier", brief: "Direct, commercial, and concerned about cash flow." },
  negotiation: initialNegotiationState({ reservationValue: 100 }),
  knowledge: { disclosedFacts: [], privateFacts: ["Needs payment this month"], documentIds: [] },
  memory: { notes: [] },
};

test("party prompt includes private runtime context and only the supplied Projection", () => {
  const prompt = compilePartyPrompt({
    runtime,
    mandatory: true,
    projection: [{ id: "e0001", seq: 1, timestamp: 1, sender: "Z", audience: ["A", "Z"], kind: "message", payload: { text: "Private caucus prompt" } }],
  });
  assert.match(prompt.system, /must provide a non-empty utterance/);
  assert.match(prompt.user, /Needs payment this month/);
  assert.match(prompt.user, /Private caucus prompt/);
  assert.doesNotMatch(prompt.user, /Party B secret/);
});
