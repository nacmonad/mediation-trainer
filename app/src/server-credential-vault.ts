export type PartyId = "A" | "B" | "Z";

type Entry = { credentials: Partial<Record<PartyId, string>>; expiresAt: number };
type VaultState = Map<string, Entry>;

const globalVault = globalThis as typeof globalThis & { __mediationCredentialVault?: VaultState };
const vault = globalVault.__mediationCredentialVault ??= new Map();
const EIGHT_HOURS_MS = 8 * 60 * 60 * 1000;

export function registerCredentials(sessionId: string, credentials: Partial<Record<PartyId, string>>): void {
  vault.set(sessionId, { credentials: { ...credentials }, expiresAt: Date.now() + EIGHT_HOURS_MS });
}

export function readCredential(sessionId: string, partyId: PartyId): string | undefined {
  const entry = vault.get(sessionId);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    vault.delete(sessionId);
    return undefined;
  }
  return entry.credentials[partyId];
}

export function forgetCredentials(sessionId: string): void {
  vault.delete(sessionId);
}
