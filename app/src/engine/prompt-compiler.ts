/**
 * Engine-owned prompt compiler (ticket 12). Pure: no provider, no DOM, no
 * scenario-schema dependency (a structural view suffices). Prompt text and
 * PROMPT_VERSION live together so they cannot drift — the driver consumes the
 * exported version as its audit default, and any fragment change bumps it.
 */
import type { MediationEvent, NegotiationState, PartyRuntime } from "./domain";

export const PROMPT_VERSION = "proto-03";

/** The slice of a parsed Scenario the compiler reads; the full Scenario type satisfies this. */
export interface ScenarioPromptView {
  sharedFacts: readonly string[];
  resources: readonly { id: string; title: string; body: string; audience: readonly string[] }[];
}

export interface PartyPromptInput {
  projection: readonly MediationEvent[];
  runtime: PartyRuntime;
  scenario: ScenarioPromptView;
  mandatory: boolean;
}

export interface CompiledPrompt {
  system: string;
  user: string;
  version: string;
}

// ---------------------------------------------------------------------------
// Output-contract fragment (the seat-role slot: ticket 13 swaps in a mediator
// contract here without forking the compiler).
// ---------------------------------------------------------------------------

export function renderPartyOutputContract(mandatory: boolean): string {
  return [
    "Return exactly one JSON object with keys: utterance, reaction, and optional offer.",
    "reaction may contain only numeric deltas for anger, trustMediator, trustOtherParty, willingnessToSettle, rigidity, and fatigue. Keep each delta between -12 and 12.",
    'Use these exact Reaction keys: {"angerDelta":0,"trustMediatorDelta":0,"trustOtherPartyDelta":0,"willingnessToSettleDelta":0,"rigidityDelta":0,"fatigueDelta":0}. Omit unchanged keys.',
    "offer, when present, must be {\"amount\": number, \"terms\": string?}. Do not put an offer in prose without also structuring it.",
    mandatory
      ? "You must provide a non-empty utterance."
      : "You may decline to speak by returning an empty utterance.",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Behavioral state, rendered qualitatively. Models anchor on raw numbers, so
// the six mutable dimensions never appear as figures; the bands are
// deterministic (0–19 / 20–44 / 45–74 / 75–100).
// ---------------------------------------------------------------------------

type Band = 0 | 1 | 2 | 3;

function band(value: number): Band {
  return value >= 75 ? 3 : value >= 45 ? 2 : value >= 20 ? 1 : 0;
}

const FEELINGS: Record<keyof Pick<NegotiationState, "anger" | "trustMediator" | "trustOtherParty" | "willingnessToSettle" | "rigidity" | "fatigue">, readonly [string, string, string, string]> = {
  anger: [
    "You are calm.",
    "You are irritated.",
    "You are angry about how this mediation is going.",
    "You are furious; staying measured takes real effort.",
  ],
  trustMediator: [
    "You distrust the mediator.",
    "You are unsure whether the mediator is on your side.",
    "You trust the mediator.",
    "You trust the mediator strongly.",
  ],
  trustOtherParty: [
    "You distrust the other party.",
    "You are wary of the other party.",
    "You trust the other party.",
    "You trust the other party strongly.",
  ],
  willingnessToSettle: [
    "You are resolved not to settle today.",
    "You are hesitant about settling.",
    "You are open to settling on acceptable terms.",
    "You are eager to settle.",
  ],
  rigidity: [
    "You are flexible on the positions you have taken.",
    "You retain some flexibility.",
    "You are mostly rigid.",
    "You are completely rigid; only something major could move you.",
  ],
  fatigue: [
    "You feel fresh.",
    "You are slightly worn down.",
    "You are tired of the process.",
    "You are exhausted.",
  ],
};

export function renderQualitativeState(state: NegotiationState): string {
  return (Object.keys(FEELINGS) as (keyof typeof FEELINGS)[])
    .map((dimension) => FEELINGS[dimension][band(state[dimension])])
    .join(" ");
}

function renderPrivateContext(runtime: PartyRuntime): string {
  const state = runtime.negotiation;
  const economics = [
    state.position != null ? `Your openly stated position is ${state.position}.` : undefined,
    state.reservationValue != null
      ? `Your private walk-away point is ${state.reservationValue}; never reveal or hint at it.`
      : undefined,
    state.threatenedWalkout ? "You have already threatened to walk out." : undefined,
  ].filter(Boolean) as string[];

  const disclosed = [...state.disclosedInterests, ...runtime.knowledge.disclosedFacts];
  const hidden = [...runtime.knowledge.privateFacts, ...state.hiddenInterests];
  const facts = [
    disclosed.length ? `You have disclosed: ${disclosed.join("; ")}` : undefined,
    hidden.length ? `You have kept private: ${hidden.join("; ")} — reveal one only when you deliberately choose to.` : undefined,
    runtime.memory.notes.length ? `Your private notes: ${runtime.memory.notes.join(";")}` : undefined,
  ].filter(Boolean) as string[];

  return [
    "How you are feeling right now:",
    renderQualitativeState(state),
    "",
    "Your private negotiation context:",
    ...economics.map((line) => `- ${line}`),
    ...facts.map((line) => `- ${line}`),
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Transcript rendering
// ---------------------------------------------------------------------------

export function eventText(event: MediationEvent): string {
  const payload = event.payload as Record<string, unknown>;
  if (typeof payload.text === "string") return payload.text;
  if (event.kind === "offer" && typeof payload.amount === "number") return `Offer amount: ${payload.amount}; terms: ${String(payload.terms ?? "none")}`;
  return JSON.stringify(payload);
}

function renderTranscript(projection: readonly MediationEvent[]): string {
  if (!projection.length) return "(No visible events yet.)";
  return projection.map((event) => `${event.seq}. ${event.sender}: ${eventText(event)}`).join("\n");
}

// ---------------------------------------------------------------------------
// Mediator seat (ticket 13): the seat-role slot made real. No negotiation
// state, no Reaction channel; addressing is the model's job, transitions are not.
// ---------------------------------------------------------------------------

export function renderMediatorOutputContract(): string {
  return [
    'Return exactly one JSON object: {"utterance": "...", "audience": "both" | "A" | "B"}.',
    'audience "both" addresses the joint session; "A" or "B" addresses that one party directly. You cannot caucus, offer, or end the session.',
    'Use these exact keys: {"utterance":"","audience":"both"}.',
    "You may stay silent by returning an empty utterance.",
  ].join("\n");
}

export interface MediatorPromptInput {
  projection: readonly MediationEvent[];
  scenario: ScenarioPromptView;
  phase: string;
  caucusWith: string | null;
}

export function compileMediatorPrompt(input: MediatorPromptInput): CompiledPrompt {
  const system = [
    "You are the Mediator, facilitating a negotiation between Party A and Party B.",
    "Remain impartial in word and action; do not favor either party.",
    "Support the parties' self-determination: elicit interests and options rather than prescribing or endorsing a specific settlement.",
    [
      "Confidentiality in this mediation:",
      "- Anything a party tells you in a private caucus is confidential: never disclose it to the other party, directly or by hint.",
      "- The parties' private facts are theirs to reveal; never pretend to know what you have not been told.",
    ].join("\n"),
    renderMediatorOutputContract(),
  ].join("\n\n");

  const process = input.phase === "caucus"
    ? `You are in a private caucus with Party ${input.caucusWith}. Only the two of you can see this conversation.`
    : "The joint session is in progress with both parties present.";
  const visibleResources = input.scenario.resources.filter((resource) => resource.audience.includes("Z"));
  const user = [
    input.scenario.sharedFacts.length
      ? ["Facts known to everyone in this mediation:", ...input.scenario.sharedFacts.map((fact) => `- ${fact}`)].join("\n")
      : undefined,
    visibleResources.length
      ? ["Case documents in the file:", ...visibleResources.map((resource) => `- ${resource.title}: ${resource.body}`)].join("\n")
      : undefined,
    process,
    "Visible mediation transcript:",
    renderTranscript(input.projection),
    "Decide what the Mediator says next and return JSON only.",
  ].filter(Boolean).join("\n\n");
  return { system, user, version: PROMPT_VERSION };
}

// ---------------------------------------------------------------------------
// Compiler
// ---------------------------------------------------------------------------

export function compilePartyPrompt(input: PartyPromptInput): CompiledPrompt {
  const { runtime, scenario, mandatory } = input;
  const system = [
    `You are ${runtime.persona.displayName}, a party in a mediator-led negotiation.`,
    runtime.persona.brief,
    "Stay in character. Respond only from the information visible to you.",
    [
      "Confidentiality in this mediation:",
      "- Statements made in a private caucus between the mediator and the other party are confidential: you have not seen them and must not act as if you know them.",
      "- Your own private facts are yours to protect; disclose one only when you deliberately choose to, and only to those you intend to reach.",
    ].join("\n"),
    renderPartyOutputContract(mandatory),
  ].join("\n\n");

  const visibleResources = scenario.resources.filter((resource) => resource.audience.includes(runtime.seatId));
  const user = [
    renderPrivateContext(runtime),
    scenario.sharedFacts.length
      ? ["Facts known to everyone in this mediation:", ...scenario.sharedFacts.map((fact) => `- ${fact}`)].join("\n")
      : undefined,
    visibleResources.length
      ? ["Case documents you may rely on:", ...visibleResources.map((resource) => `- ${resource.title}: ${resource.body}`)].join("\n")
      : undefined,
    "Visible mediation transcript:",
    renderTranscript(input.projection),
    "Decide what this party does next and return JSON only.",
  ].filter(Boolean).join("\n\n");

  return { system, user, version: PROMPT_VERSION };
}
