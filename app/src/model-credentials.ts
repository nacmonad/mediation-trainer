export type PartyId = "A" | "B";

export async function registerSessionCredentials(
  sessionId: string,
  values: Record<PartyId, string>,
): Promise<void> {
  const response = await fetch("/api/session-credentials", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ sessionId, credentials: values }),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new Error(body?.error ?? "Could not register memory-only provider credentials.");
  }
}
