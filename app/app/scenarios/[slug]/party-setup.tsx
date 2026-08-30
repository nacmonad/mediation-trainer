"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ModelConfig } from "@/src/engine/domain";
import { saveSessionSetup } from "@/src/session-storage";

const providers: readonly { value: ModelConfig["provider"]; label: string }[] = [
  { value: "ollama", label: "Ollama" },
  { value: "openai", label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
];

function SeatFields({ party, config, setConfig }: { party: "A" | "B"; config: ModelConfig; setConfig: (value: ModelConfig) => void }) {
  const providerLabel = providers.find((item) => item.value === config.provider)?.label ?? config.provider;
  return (
    <fieldset className="border-t border-[var(--line)] pt-5">
      <legend className="text-lg font-semibold">Party {party}</legend>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <label className="field">
          <span>Provider</span>
          <select value={config.provider} onChange={(event) => setConfig({ ...config, provider: event.target.value as ModelConfig["provider"] })}>
            {providers.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Model</span>
          <input value={config.model} onChange={(event) => setConfig({ ...config, model: event.target.value })} aria-describedby={`party-${party}-model-help`} />
          <small id={`party-${party}-model-help`}>Use a model available from {providerLabel}.</small>
        </label>
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-[var(--muted)]"><span className="status-dot" aria-hidden="true" /> Credential status: memory-only</p>
    </fieldset>
  );
}

export function PartySetup({ scenarioSlug }: { scenarioSlug: string }) {
  const router = useRouter();
  const [configA, setConfigA] = useState<ModelConfig>({ provider: "ollama", model: "scripted" });
  const [configB, setConfigB] = useState<ModelConfig>({ provider: "ollama", model: "scripted" });
  const valid = Boolean(configA.model.trim() && configB.model.trim());

  function beginSession() {
    const sessionId = crypto.randomUUID();
    saveSessionSetup(sessionId, { A: configA, B: configB });
    router.push(`/sessions/${sessionId}?scenario=${scenarioSlug}`);
  }

  return (
    <aside className="self-start rounded-2xl border border-[var(--line-strong)] bg-[var(--panel)] p-6 shadow-[0_18px_50px_rgba(15,45,42,.08)] lg:sticky lg:top-7">
      <h2 className="text-2xl font-semibold tracking-tight">Configure Parties</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Provider credentials stay in browser memory by default.</p>
      <div className="mt-6 space-y-6">
        <SeatFields party="A" config={configA} setConfig={setConfigA} />
        <SeatFields party="B" config={configB} setConfig={setConfigB} />
      </div>
      <button
        className="button-primary mt-7 w-full"
        disabled={!valid}
        onClick={beginSession}
      >
        Begin Session
      </button>
    </aside>
  );
}
