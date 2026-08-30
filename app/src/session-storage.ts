import type { InvocationAttempt, Phase } from "@/src/engine/driver";
import type { Session } from "@/src/engine/domain";
import type { ModelConfig } from "@/src/engine/domain";

export type SessionSetupConfig = { A: ModelConfig; B: ModelConfig };

export type SessionSnapshot<T extends string = string> = {
  version: 1;
  sessionId: string;
  scenarioSlug: string;
  phase: Phase;
  savedAt: string;
  session: Session<T>;
  invocations: InvocationAttempt<T>[];
};

const key = (sessionId: string) => `mediation-trainer:session:${sessionId}`;
const configKey = (sessionId: string) => `mediation-trainer:config:${sessionId}`;

export function saveSessionSetup(sessionId: string, config: SessionSetupConfig): void {
  sessionStorage.setItem(configKey(sessionId), JSON.stringify(config));
}

export function loadSessionSetup(sessionId: string): SessionSetupConfig | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(configKey(sessionId)) ?? "null") as SessionSetupConfig | null;
    return value?.A?.provider && value?.B?.provider ? value : null;
  } catch {
    return null;
  }
}

export function loadSessionSnapshot<T extends string>(sessionId: string): SessionSnapshot<T> | null {
  try {
    const raw = localStorage.getItem(key(sessionId));
    if (!raw) return null;
    const value = JSON.parse(raw) as SessionSnapshot<T>;
    return value.version === 1 && value.sessionId === sessionId ? value : null;
  } catch {
    return null;
  }
}

export function saveSessionSnapshot<T extends string>(snapshot: SessionSnapshot<T>): void {
  localStorage.setItem(key(snapshot.sessionId), JSON.stringify(snapshot));
}

export function exportSessionSnapshot(snapshot: SessionSnapshot): void {
  const safe = { ...snapshot, invocations: undefined };
  const url = URL.createObjectURL(new Blob([JSON.stringify(safe, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `mediation-session-${snapshot.sessionId.slice(0, 8)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
