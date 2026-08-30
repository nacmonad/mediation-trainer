import { z } from "zod";

/**
 * The provider-agnostic structured Mediator response contract (ticket 13).
 * Unlike the Party contract there is no Reaction: the agent Mediator speaks
 * and chooses its audience. It cannot emit offers, state deltas, or any
 * phase transition — those stay human-issued (decision 11).
 */

export const mediatorResponseSchema = z.object({
  utterance: z.string(),
  audience: z.enum(["both", "A", "B"]),
}).strict();

export type MediatorResponse = z.infer<typeof mediatorResponseSchema>;
