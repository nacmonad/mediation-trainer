import { z } from "zod";

import { registerCredentials } from "@/src/server-credential-vault";

export const runtime = "nodejs";

const requestSchema = z.object({
  sessionId: z.string().uuid(),
  credentials: z.object({ A: z.string(), B: z.string(), Z: z.string().optional() }).strict(),
}).strict();

export async function POST(request: Request) {
  const input = requestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: `invalid credential registration: ${input.error.message}` }, { status: 400 });
  registerCredentials(input.data.sessionId, input.data.credentials);
  return new Response(null, { status: 204 });
}
