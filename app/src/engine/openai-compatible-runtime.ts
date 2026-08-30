import { z } from "zod";

import type { MediationEvent, ModelConfig, PartyRuntime } from "./domain";
import { TurnError, type AgentResponse, type DriverRuntime, type RuntimeCallAudit } from "./driver";

const apiResponseSchema = z.object({
  response: z.object({
    utterance: z.string(),
    reaction: z.object({
      angerDelta: z.number().finite().optional(),
      trustMediatorDelta: z.number().finite().optional(),
      trustOtherPartyDelta: z.number().finite().optional(),
      willingnessToSettleDelta: z.number().finite().optional(),
      rigidityDelta: z.number().finite().optional(),
      fatigueDelta: z.number().finite().optional(),
    }),
    offer: z.object({ amount: z.number().finite().nonnegative(), terms: z.string().optional() }).optional(),
  }),
  audit: z.object({
    requestId: z.string().optional(),
    latencyMs: z.number().nonnegative(),
    tokenUsage: z.object({ prompt: z.number().int().nonnegative().optional(), completion: z.number().int().nonnegative().optional(), total: z.number().int().nonnegative().optional() }).optional(),
    request: z.unknown(),
    response: z.unknown(),
  }),
});

function eventText(event: MediationEvent): string {
  const payload = event.payload as Record<string, unknown>;
  if (typeof payload.text === "string") return payload.text;
  if (event.kind === "offer" && typeof payload.amount === "number") return `Offer amount: ${payload.amount}; terms: ${String(payload.terms ?? "none")}`;
  return JSON.stringify(payload);
}

export function compilePartyPrompt(input: {
  projection: readonly MediationEvent[];
  runtime: PartyRuntime;
  mandatory: boolean;
}): { system: string; user: string } {
  const { runtime } = input;
  const system = [
    `You are ${runtime.persona.displayName}, a party in a mediator-led negotiation.`,
    runtime.persona.brief,
    "Stay in character. Respond only from the information visible to you.",
    "Return exactly one JSON object with keys: utterance, reaction, and optional offer.",
    "reaction may contain only numeric deltas for anger, trustMediator, trustOtherParty, willingnessToSettle, rigidity, and fatigue. Keep each delta between -12 and 12.",
    "offer, when present, must be {\"amount\": number, \"terms\": string?}. Do not put an offer in prose without also structuring it.",
    input.mandatory ? "You must provide a non-empty utterance." : "You may decline to speak by returning an empty utterance.",
  ].filter(Boolean).join("\n\n");
  const user = [
    "Your private negotiation context:",
    JSON.stringify({
      state: runtime.negotiation,
      privateFacts: runtime.knowledge.privateFacts,
      disclosedFacts: runtime.knowledge.disclosedFacts,
      notes: runtime.memory.notes,
    }, null, 2),
    "Visible mediation transcript:",
    input.projection.length
      ? input.projection.map((event) => `${event.seq}. ${event.sender}: ${eventText(event)}`).join("\n")
      : "(No visible events yet.)",
    "Decide what this party does next and return JSON only.",
  ].join("\n\n");
  return { system, user };
}

export class OpenAICompatibleRuntime implements DriverRuntime {
  lastCall?: RuntimeCallAudit;

  constructor(
    readonly config: ModelConfig,
    private readonly apiKey: string,
  ) {}

  async respond(input: { projection: readonly MediationEvent[]; runtime: PartyRuntime; mandatory: boolean }): Promise<AgentResponse> {
    this.lastCall = undefined;
    const prompt = compilePartyPrompt(input);
    let response: Response;
    try {
      response = await fetch("/api/models/openai-compatible", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: this.config, apiKey: this.apiKey, prompt }),
      });
    } catch (cause) {
      throw new TurnError("transport", cause instanceof Error ? cause.message : String(cause));
    }
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      const message = z.object({ error: z.string() }).safeParse(body);
      throw new TurnError(response.status >= 500 || response.status === 429 ? "transport" : "structural", message.success ? message.data.error : `model gateway returned ${response.status}`);
    }
    const parsed = apiResponseSchema.safeParse(body);
    if (!parsed.success) throw new TurnError("structural", `invalid model gateway response: ${parsed.error.message}`);
    this.lastCall = parsed.data.audit;
    return parsed.data.response;
  }
}
