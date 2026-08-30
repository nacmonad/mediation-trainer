export type PartyId = "A" | "B";

const credentials = new Map<string, Partial<Record<PartyId, string>>>();

export function saveSessionCredentials(
  sessionId: string,
  values: Partial<Record<PartyId, string>>,
): void {
  credentials.set(sessionId, { ...values });
}

export function loadSessionCredential(sessionId: string, partyId: PartyId): string {
  return credentials.get(sessionId)?.[partyId] ?? "";
}
