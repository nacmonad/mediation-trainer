import { z } from "zod";

/**
 * The provider-agnostic structured Party response contract, shared by every
 * model gateway route. Upstream providers differ in transport; this shape does
 * not (driver.ts `agentResponseSchema` is the authoritative mirror).
 */

export const reactionSchema = z.preprocess((value) => {
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

export const agentResponseSchema = z.object({
  utterance: z.string(),
  reaction: reactionSchema,
  offer: z.object({ amount: z.number().finite().nonnegative(), terms: z.string().optional() }).strict().optional(),
}).strict();

/** Extract a JSON object from model prose: fenced blocks, bare JSON, or brace spans. */
export function parseJsonContent(content: string): unknown {
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
