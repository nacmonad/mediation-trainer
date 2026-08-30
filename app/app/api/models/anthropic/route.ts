import { z } from "zod";

import { readCredential } from "@/src/server-credential-vault";
import { agentResponseSchema, parseJsonContent } from "@/src/engine/party-response";
import { mediatorResponseSchema } from "@/src/engine/mediator-response";

export const runtime = "nodejs";

const requestSchema = z.object({
  config: z.object({
    provider: z.literal("anthropic"),
    model: z.string().min(1),
    endpoint: z.string().url(),
    // Anthropic caps temperature at 1; seed is not supported on Messages.
    temperature: z.number().min(0).max(1).optional(),
  }).strict(),
  sessionId: z.string().uuid(),
  partyId: z.enum(["A", "B", "Z"]),
  contract: z.enum(["party", "mediator"]).optional(),
  prompt: z.object({ system: z.string().min(1), user: z.string().min(1) }).strict(),
}).strict();

const upstreamSchema = z.object({
  id: z.string().optional(),
  content: z.array(z.object({ type: z.string(), text: z.string().optional() }).passthrough()).min(1),
  usage: z.object({
    input_tokens: z.number().int().nonnegative().optional(),
    output_tokens: z.number().int().nonnegative().optional(),
  }).optional(),
}).passthrough();

/** Anthropic Messages requires an explicit output budget; Party turns are short. */
const MAX_OUTPUT_TOKENS = 1024;

const ANTHROPIC_VERSION = "2023-06-01";

function messagesUrl(endpoint: string): string {
  const base = endpoint.endsWith("/") ? endpoint : `${endpoint}/`;
  return new URL("messages", base).toString();
}

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
    max_tokens: MAX_OUTPUT_TOKENS,
    system: prompt.system,
    messages: [{ role: "user", content: prompt.user }],
    ...(config.temperature === undefined ? {} : { temperature: config.temperature }),
  };
  const started = performance.now();
  let upstream: Response;
  try {
    upstream = await fetch(messagesUrl(config.endpoint), {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
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
  const content = parsedUpstream.data.content
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text as string)
    .join("");
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
        prompt: parsedUpstream.data.usage.input_tokens,
        completion: parsedUpstream.data.usage.output_tokens,
        total: (parsedUpstream.data.usage.input_tokens ?? 0) + (parsedUpstream.data.usage.output_tokens ?? 0),
      } : undefined,
      request: { endpoint: config.endpoint, ...upstreamRequest },
      response: raw,
    },
  });
}
