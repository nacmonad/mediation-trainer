import { z } from "zod";

import type { MediationEvent, ModelConfig, PartyRuntime } from "./domain";
import { TurnError, type AgentResponse, type DriverRuntime, type RuntimeCallAudit } from "./driver";
import { compilePartyPrompt, type ScenarioPromptView } from "./prompt-compiler";

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

/**
 * Anthropic Party runtime. The Party prompt contract is provider-agnostic, so
 * it reuses the shared compiler; only transport differs (server gateway route,
 * Messages API semantics handled there).
 */
export class AnthropicRuntime implements DriverRuntime {
  lastCall?: RuntimeCallAudit;

  constructor(
    readonly config: ModelConfig,
    private readonly sessionId: string,
    private readonly partyId: "A" | "B",
    private readonly scenario: ScenarioPromptView,
  ) {}

  async respond(input: { projection: readonly MediationEvent[]; runtime: PartyRuntime; mandatory: boolean }): Promise<AgentResponse> {
    this.lastCall = undefined;
    const prompt = compilePartyPrompt({ ...input, scenario: this.scenario });
    let response: Response;
    try {
      response = await fetch("/api/models/anthropic", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: this.config, sessionId: this.sessionId, partyId: this.partyId, prompt }),
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
