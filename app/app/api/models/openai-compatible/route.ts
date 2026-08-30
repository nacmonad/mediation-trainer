import { z } from "zod";

import { readCredential } from "@/src/server-credential-vault";
import { agentResponseSchema, parseJsonContent } from "@/src/engine/party-response";
import { mediatorResponseSchema } from "@/src/engine/mediator-response";

export const runtime = "nodejs";

const requestSchema = z.object({
  config: z.object({
    provider: z.enum(["openai-compatible", "openai", "venice"]),
    model: z.string().min(1),
    endpoint: z.string().url(),
    temperature: z.number().min(0).max(2).optional(),
    seed: z.number().int().optional(),
  }).strict(),
  sessionId: z.string().uuid(),
  partyId: z.enum(["A", "B", "Z"]),
  contract: z.enum(["party", "mediator"]).optional(),
  prompt: z.object({ system: z.string().min(1), user: z.string().min(1) }).strict(),
}).strict();

const upstreamSchema = z.object({
  id: z.string().optional(),
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }).passthrough() }).passthrough()).min(1),
  usage: z.object({ prompt_tokens: z.number().int().nonnegative().optional(), completion_tokens: z.number().int().nonnegative().optional(), total_tokens: z.number().int().nonnegative().optional() }).optional(),
}).passthrough();

function completionUrl(endpoint: string): string {
  const base = endpoint.endsWith("/") ? endpoint : `${endpoint}/`;
  return new URL("chat/completions", base).toString();
}

const partyResponseJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["utterance", "reaction"],
  properties: {
    utterance: { type: "string" },
    reaction: {
      type: "object",
      additionalProperties: false,
      properties: {
        angerDelta: { type: "number", minimum: -12, maximum: 12 },
        trustMediatorDelta: { type: "number", minimum: -12, maximum: 12 },
        trustOtherPartyDelta: { type: "number", minimum: -12, maximum: 12 },
        willingnessToSettleDelta: { type: "number", minimum: -12, maximum: 12 },
        rigidityDelta: { type: "number", minimum: -12, maximum: 12 },
        fatigueDelta: { type: "number", minimum: -12, maximum: 12 },
      },
    },
    offer: {
      type: "object",
      additionalProperties: false,
      required: ["amount"],
      properties: {
        amount: { type: "number", minimum: 0 },
        terms: { type: "string" },
      },
    },
  },
} as const;

const venicePartyParameters = {
  // The simulator supplies the complete Party persona and closed case record.
  include_venice_system_prompt: false,
  enable_web_search: "off",
  enable_web_scraping: false,
  enable_web_citations: false,
  enable_x_search: false,
  // Party turns need only the contract response, never model reasoning text.
  disable_thinking: true,
  strip_thinking_response: true,
  // Ask Venice to keep inference within its end-to-end encrypted path.
  enable_e2ee: true,
} as const;

export async function POST(request: Request) {
  const input = requestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: `invalid request: ${input.error.message}` }, { status: 400 });

  const { config, sessionId, partyId, contract = "party", prompt } = input.data;
  const apiKey = readCredential(sessionId, partyId);
  if (apiKey === undefined) {
    return Response.json({ error: "Provider credential is unavailable. Return to Scenario setup and begin a new Session." }, { status: 401 });
  }
  const upstreamRequest = {
    model: config.model,
    messages: [
      { role: "system", content: prompt.system },
      { role: "user", content: prompt.user },
    ],
    ...(config.temperature === undefined ? {} : { temperature: config.temperature }),
    ...(config.seed === undefined ? {} : { seed: config.seed }),
    ...(config.provider === "venice" ? {
      venice_parameters: venicePartyParameters,
      // Structured output is only wired for the Party contract; the mediator
      // contract is validated locally after parsing.
      ...(contract === "party" ? {
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "party_response",
            strict: true,
            schema: partyResponseJsonSchema,
          },
        },
      } : {}),
    } : {}),
  };
  const started = performance.now();
  let upstream: Response;
  try {
    upstream = await fetch(completionUrl(config.endpoint), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify(upstreamRequest),
      signal: AbortSignal.timeout(90_000),
      cache: "no-store",
    });
  } catch (cause) {
    return Response.json({ error: `provider transport error: ${cause instanceof Error ? cause.message : String(cause)}` }, { status: 502 });
  }

  const raw: unknown = await upstream.json().catch(async () => ({ error: await upstream.text().catch(() => "non-JSON response") }));
  if (!upstream.ok) {
    const detail = z.object({ error: z.union([z.string(), z.object({ message: z.string() }).passthrough()]) }).safeParse(raw);
    const message = detail.success ? (typeof detail.data.error === "string" ? detail.data.error : detail.data.error.message) : `HTTP ${upstream.status}`;
    return Response.json({ error: `provider rejected request: ${message}` }, { status: upstream.status });
  }

  const parsedUpstream = upstreamSchema.safeParse(raw);
  if (!parsedUpstream.success) return Response.json({ error: `invalid provider response: ${parsedUpstream.error.message}` }, { status: 502 });
  const content = parsedUpstream.data.choices[0].message.content;
  if (!content) return Response.json({ error: "provider returned an empty assistant message" }, { status: 502 });

  let structuredResponse: z.infer<typeof agentResponseSchema> | z.infer<typeof mediatorResponseSchema>;
  try {
    structuredResponse = contract === "mediator"
      ? mediatorResponseSchema.parse(parseJsonContent(content))
      : agentResponseSchema.parse(parseJsonContent(content));
  } catch (cause) {
    return Response.json({ error: contract === "mediator"
      ? `invalid structured Mediator response: ${cause instanceof Error ? cause.message : String(cause)}`
      : `invalid structured Party response: ${cause instanceof Error ? cause.message : String(cause)}` }, { status: 422 });
  }

  return Response.json({
    response: structuredResponse,
    audit: {
      requestId: parsedUpstream.data.id,
      latencyMs: Math.round(performance.now() - started),
      tokenUsage: parsedUpstream.data.usage ? {
        prompt: parsedUpstream.data.usage.prompt_tokens,
        completion: parsedUpstream.data.usage.completion_tokens,
        total: parsedUpstream.data.usage.total_tokens,
      } : undefined,
      request: { endpoint: config.endpoint, ...upstreamRequest },
      response: raw,
    },
  });
}
