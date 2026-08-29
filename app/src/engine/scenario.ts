import { z } from "zod";
import type { Reaction } from "./domain.ts";
import type { Phase } from "./driver.ts";

const seats = ["A", "B", "Z"] as const;
const dimensions = ["anger", "trustMediator", "trustOtherParty", "willingnessToSettle", "rigidity", "fatigue"] as const;
const phases = ["setup", "joint_session", "caucus", "agreement", "impasse", "walkout", "review"] as const;
type Seat = (typeof seats)[number];
type Party = "A" | "B";
type Dimension = (typeof dimensions)[number];

const audienceSchema = z.array(z.enum(seats)).min(1).refine((xs) => new Set(xs).size === xs.length, "audience contains duplicates");
const dimensionRecord = z.object(Object.fromEntries(dimensions.map((key) => [key, z.number().min(0).max(100)])) as Record<Dimension, z.ZodNumber>).strict();
const stateSchema = dimensionRecord.extend({
  position: z.number().nonnegative(), reservationValue: z.number().nonnegative(),
  interests: z.array(z.string().min(1)), walkoutStatus: z.enum(["active", "walked_out"]),
}).strict();
const reducerSchema = z.object({ sensitivity: dimensionRecord, caps: dimensionRecord }).strict();
const partySchema = z.object({
  bargainingRole: z.enum(["claimant", "respondent"]),
  persona: z.object({ role: z.string(), goals: z.array(z.string()), speakingStyle: z.string(), behavioralInstructions: z.array(z.string()), emotionalTriggers: z.array(z.string()), permittedMisleadingClaims: z.array(z.string()) }).strict(),
  authorityLimit: z.number().nonnegative(),
  alternatives: z.object({ batna: z.string(), watna: z.string() }).strict(),
  privateFacts: z.array(z.string()), initialState: stateSchema, reducer: reducerSchema,
}).strict();
const resourceSchema = z.object({ id: z.string().min(1), title: z.string().min(1), body: z.string(), audience: audienceSchema }).strict();
const ruleSchema = z.object({
  id: z.string(), partyId: z.enum(["A", "B"]), dimension: z.enum(dimensions), comparison: z.enum([">=", "<="]),
  threshold: z.number().min(0).max(100), effect: z.enum(["force_speak", "walkout"]), repeatable: z.boolean(), phases: z.array(z.enum(phases)).min(1), message: z.string(),
}).strict();

export const scenarioSchema = z.object({
  schemaVersion: z.literal(1), scenarioId: z.string().min(1), scenarioVersion: z.number().int().positive(),
  slug: z.string().min(1), title: z.string().min(1), difficulty: z.enum(["basic", "intermediate", "advanced"]),
  tags: z.array(z.string()), currency: z.literal("USD"),
  resources: z.array(resourceSchema), sharedFacts: z.array(z.string()), groundTruth: z.array(z.string()),
  parties: z.object({ A: partySchema, B: partySchema }).strict(),
  disclosureRules: z.array(z.object({ id: z.string(), partyId: z.enum(["A", "B"]), factId: z.string(), phases: z.array(z.enum(phases)).min(1), audience: audienceSchema, prerequisites: z.array(z.string()) }).strict()),
  rules: z.array(ruleSchema), targetRange: z.object({ minimum: z.number(), maximum: z.number(), qualitativeTerms: z.array(z.string()) }).strict(),
  evaluatorBrief: z.object({ groundTruth: z.array(z.string()), teachingPrompts: z.array(z.string()) }).strict(),
}).strict().superRefine((value, ctx) => {
  if (value.parties.A.bargainingRole === value.parties.B.bargainingRole) ctx.addIssue({ code: "custom", path: ["parties"], message: "exactly one claimant and one respondent are required" });
  if (value.targetRange.minimum > value.targetRange.maximum) ctx.addIssue({ code: "custom", path: ["targetRange"], message: "minimum must not exceed maximum" });
  for (const partyId of ["A", "B"] as const) {
    const party = value.parties[partyId];
    const authorityIsCoherent = party.bargainingRole === "claimant"
      ? party.authorityLimit >= party.initialState.reservationValue
      : party.authorityLimit <= party.initialState.reservationValue;
    if (!authorityIsCoherent) ctx.addIssue({ code: "custom", path: ["parties", partyId, "authorityLimit"], message: "authority must narrow, not expand, the Reservation value" });
  }
  for (const [index, rule] of value.disclosureRules.entries()) {
    if (!value.parties[rule.partyId].privateFacts.includes(rule.factId)) ctx.addIssue({ code: "custom", path: ["disclosureRules", index, "factId"], message: "disclosure fact must belong to the acting Party" });
    if (!rule.audience.includes(rule.partyId) || !rule.audience.includes("Z")) ctx.addIssue({ code: "custom", path: ["disclosureRules", index, "audience"], message: "disclosure audience must include the Party and Mediator" });
  }
});

export type Scenario = z.infer<typeof scenarioSchema>;
export type ScenarioState = z.infer<typeof stateSchema>;
export type ScenarioEvent = { id: string; audience: Seat[]; payload: unknown };
export type RuleEffect = Scenario["rules"][number];

export function parseScenario(input: unknown): Scenario { return scenarioSchema.parse(input); }

export function projectScenarioFor(scenario: Scenario, seatId: Seat, events: readonly ScenarioEvent[]) {
  return { resources: scenario.resources.filter((r) => r.audience.includes(seatId)), events: events.filter((e) => e.audience.includes(seatId)) };
}

export type DisclosureDecision = { allowed: true; factId: string; audience: Seat[] } | { allowed: false; factId: string; reason: "unknown_rule" | "wrong_party" | "wrong_phase" | "prerequisite_missing" | "already_disclosed" | "terminal_walkout" };
export function decideDisclosure(scenario: Scenario, partyId: Party, factId: string, phase: Phase, disclosed: readonly string[], state: ScenarioState = scenario.parties[partyId].initialState): DisclosureDecision {
  if (state.walkoutStatus === "walked_out") return { allowed: false, factId, reason: "terminal_walkout" };
  const rule = scenario.disclosureRules.find((candidate) => candidate.factId === factId);
  if (!rule) return { allowed: false, factId, reason: "unknown_rule" };
  if (rule.partyId !== partyId) return { allowed: false, factId, reason: "wrong_party" };
  if (disclosed.includes(factId)) return { allowed: false, factId, reason: "already_disclosed" };
  if (!rule.phases.includes(phase)) return { allowed: false, factId, reason: "wrong_phase" };
  if (!rule.prerequisites.every((id) => disclosed.includes(id))) return { allowed: false, factId, reason: "prerequisite_missing" };
  return { allowed: true, factId, audience: [...rule.audience] };
}
export function applyDisclosure(disclosed: readonly string[], decision: DisclosureDecision): string[] {
  return decision.allowed ? [...disclosed, decision.factId] : [...disclosed];
}

export function decideOfferAcceptance(scenario: Scenario, partyId: Party, amount: number, state: ScenarioState = scenario.parties[partyId].initialState) {
  const party = scenario.parties[partyId];
  if (state.walkoutStatus === "walked_out") return { accepted: false as const, reason: "terminal_walkout" as const };
  if (party.bargainingRole === "claimant") {
    if (amount < party.authorityLimit) return { accepted: false as const, reason: "below_authority" as const };
    if (amount < party.initialState.reservationValue) return { accepted: false as const, reason: "below_reservation" as const };
  } else {
    if (amount > party.authorityLimit) return { accepted: false as const, reason: "above_authority" as const };
    if (amount > party.initialState.reservationValue) return { accepted: false as const, reason: "above_reservation" as const };
  }
  return { accepted: true as const, reason: "acceptable" as const };
}

const reactionKey: Record<Dimension, keyof Reaction> = { anger: "angerDelta", trustMediator: "trustMediatorDelta", trustOtherParty: "trustOtherPartyDelta", willingnessToSettle: "willingnessToSettleDelta", rigidity: "rigidityDelta", fatigue: "fatigueDelta" };
export function applyScenarioReaction(scenario: Scenario, partyId: Party, state: ScenarioState, reaction: Reaction, phase: Phase, firedRuleIds: readonly string[]) {
  if (state.walkoutStatus === "walked_out") throw new Error("Walkout is terminal; no later Reaction is permitted");
  const config = scenario.parties[partyId].reducer;
  const next = { ...state };
  for (const dimension of dimensions) {
    const raw = reaction[reactionKey[dimension]] ?? 0;
    const scaled = raw * config.sensitivity[dimension] / 100;
    const capped = Math.max(-config.caps[dimension], Math.min(config.caps[dimension], scaled));
    next[dimension] = Math.max(0, Math.min(100, state[dimension] + capped));
  }
  const eligible = scenario.rules.filter((rule) => {
    if (rule.partyId !== partyId || !rule.phases.includes(phase) || (!rule.repeatable && firedRuleIds.includes(rule.id))) return false;
    const before = state[rule.dimension];
    const after = next[rule.dimension];
    return rule.comparison === ">="
      ? before < rule.threshold && after >= rule.threshold
      : before > rule.threshold && after <= rule.threshold;
  });
  const walkouts = eligible.filter((rule) => rule.effect === "walkout");
  const effects = walkouts.length ? walkouts : eligible.filter((rule) => rule.effect === "force_speak");
  if (walkouts.length) next.walkoutStatus = "walked_out";
  return { state: next, effects, firedRuleIds: [...firedRuleIds, ...effects.filter((rule) => !rule.repeatable).map((rule) => rule.id)] };
}
