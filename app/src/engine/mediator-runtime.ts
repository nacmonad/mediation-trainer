import { z } from "zod";

import type { MediationEvent, ModelConfig } from "./domain";
import { TurnError, type RuntimeCallAudit } from "./driver";
import { compileMediatorPrompt, type ScenarioPromptView } from "./prompt-compiler";
import { mediatorResponseSchema, type MediatorResponse } from "./mediator-response";

const apiResponseSchema = z.object({
  response: mediatorResponseSchema,
  audit: z.object({
    requestId: z.string().optional(),
    latencyMs: z.number().nonnegative(),
    tokenUsage: z.object({ prompt: z.number().int().nonnegative().optional(), completion: z.number().int().nonnegative().optional(), total: z.number().int().nonnegative().optional() }).optional(),
    request: z.unknown(),
    response: z.unknown(),
  }),
});

/**
 * Agent Mediator runtime (ticket 13). Provider-agnostic at the contract level:
 * it reuses the existing gateways with `contract: "mediator"`, so transport,
 * credential vault, and audit sanitation stay exactly the Party story. The
 * mediator prompt is compiled per call from Z's projection — caucus content
 * included, since Z was present — and never touches negotiation state.
 */
export class MediatorRuntime {
  lastCall?: RuntimeCallAudit;

  constructor(
    readonly config: ModelConfig,
    private readonly sessionId: string,
    private readonly scenario: ScenarioPromptView,
  ) {}

  async respond(input: { projection: readonly MediationEvent[]; phase: string; caucusWith: string | null }): Promise<MediatorResponse> {
    this.lastCall = undefined;
    const prompt = compileMediatorPrompt({ ...input, scenario: this.scenario });
    const route = this.config.provider === "anthropic" ? "/api/models/anthropic" : "/api/models/openai-compatible";
    let response: Response;
    try {
      response = await fetch(route, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ config: this.config, sessionId: this.sessionId, partyId: "Z", prompt, contract: "mediator" }),
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
