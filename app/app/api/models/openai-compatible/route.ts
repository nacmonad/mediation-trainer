import { z } from "zod";

import { readCredential } from "@/src/server-credential-vault";

export const runtime = "nodejs";

const requestSchema = z.object({
  config: z.object({
    provider: z.enum(["openai-compatible", "openai", "venice", "ollama"]),
    model: z.string().min(1),
    endpoint: z.string().url(),
    temperature: z.number().min(0).max(2).optional(),
    seed: z.number().int().optional(),
  }).strict(),
  sessionId: z.string().uuid(),
  partyId: z.enum(["A", "B"]),
  prompt: z.object({ system: z.string().min(1), user: z.string().min(1) }).strict(),
}).strict();

const upstreamSchema = z.object({
  id: z.string().optional(),
  choices: z.array(z.object({ message: z.object({ content: z.string().nullable() }).passthrough() }).passthrough()).min(1),
  usage: z.object({ prompt_tokens: z.number().int().nonnegative().optional(), completion_tokens: z.number().int().nonnegative().optional(), total_tokens: z.number().int().nonnegative().optional() }).optional(),
}).passthrough();

const reactionSchema = z.preprocess((value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const reaction = { ...value } as Record<string, unknown>;
  const aliases = {
    anger: "angerDelta",
    trustMediator: "trustMediatorDelta",
    trustOtherParty: "trustOtherPartyDelta",
    willingnessToSettle: "willingnessToSettleDelta",
    rigidity: "rigidityDelta",
    fatigue: "fatigueDelta",
  } as const;
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (!(alias in reaction) || canonical in reaction) continue;
    reaction[canonical] = reaction[alias];
    delete reaction[alias];
  }
  return reaction;
}, z.object({
    angerDelta: z.number().finite().min(-12).max(12).optional(),
    trustMediatorDelta: z.number().finite().min(-12).max(12).optional(),
    trustOtherPartyDelta: z.number().finite().min(-12).max(12).optional(),
    willingnessToSettleDelta: z.number().finite().min(-12).max(12).optional(),
    rigidityDelta: z.number().finite().min(-12).max(12).optional(),
    fatigueDelta: z.number().finite().min(-12).max(12).optional(),
  }).strict());

const agentResponseSchema = z.object({
  utterance: z.string(),
  reaction: reactionSchema,
  offer: z.object({ amount: z.number().finite().nonnegative(), terms: z.string().optional() }).strict().optional(),
}).strict();

function completionUrl(endpoint: string): string {
  const base = endpoint.endsWith("/") ? endpoint : `${endpoint}/`;
  return new URL("chat/completions", base).toString();
}

function parseJsonContent(content: string): unknown {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const candidate = fenced ?? content;
  try {
    return JSON.parse(candidate.trim());
  } catch {
    const start = candidate.indexOf("{");
    const end = candidate.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(candidate.slice(start, end + 1));
    throw new Error("model did not return a JSON object");
  }
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

  const { config, sessionId, partyId, prompt } = input.data;
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
      response_format: { type: "json_schema", json_schema: partyResponseJsonSchema },
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

  let agentResponse: z.infer<typeof agentResponseSchema>;
  try {
    agentResponse = agentResponseSchema.parse(parseJsonContent(content));
  } catch (cause) {
    return Response.json({ error: `invalid structured Party response: ${cause instanceof Error ? cause.message : String(cause)}` }, { status: 422 });
  }

  return Response.json({
    response: agentResponse,
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
