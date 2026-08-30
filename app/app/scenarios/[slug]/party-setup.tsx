"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ModelConfig } from "@/src/engine/domain";
import { registerSessionCredentials } from "@/src/model-credentials";
import { saveSessionSetup } from "@/src/session-storage";

type ProviderPreset = { id: string; provider: ModelConfig["provider"]; label: string; endpoint: string; model: string };

const presets: readonly ProviderPreset[] = [
  { id: "openai", provider: "openai", label: "OpenAI", endpoint: "https://api.openai.com/v1/", model: "gpt-5.6-luna" },
  { id: "anthropic", provider: "anthropic", label: "Anthropic", endpoint: "https://api.anthropic.com/v1/", model: "claude-sonnet-4-5" },
  { id: "venice", provider: "venice", label: "Venice AI", endpoint: "https://api.venice.ai/api/v1", model: "" },
  { id: "openai-compatible", provider: "openai-compatible", label: "Other OpenAI-compatible", endpoint: "https://openrouter.ai/api/v1/", model: "" },
  // Ollama speaks the OpenAI chat-completions API, so it is a preset, not a provider.
  { id: "ollama", provider: "openai-compatible", label: "Ollama (local)", endpoint: "http://localhost:11434/v1/", model: "llama3.2" },
];

function presetFor(config: ModelConfig): ProviderPreset {
  return presets.find((item) => item.provider === config.provider && item.endpoint === config.endpoint)
    ?? presets.find((item) => item.provider === config.provider)
    ?? presets[0];
}

function presetConfig(preset: ProviderPreset): ModelConfig {
  return { provider: preset.provider, endpoint: preset.endpoint, model: preset.model };
}

function SeatFields({ party, config, apiKey, setApiKey, setConfig }: { party: "A" | "B"; config: ModelConfig; apiKey: string; setApiKey: (value: string) => void; setConfig: (value: ModelConfig) => void }) {
  const providerLabel = presetFor(config).label;
  return (
    <fieldset className="border-t border-[var(--line)] pt-5">
      <legend className="text-lg font-semibold">Party {party}</legend>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <label className="field">
          <span>Provider</span>
          <select value={presetFor(config).id} onChange={(event) => {
            const preset = presets.find((item) => item.id === event.target.value);
            if (preset) setConfig({ ...config, provider: preset.provider, endpoint: preset.endpoint, model: preset.model });
          }}>
            {presets.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Model</span>
          <input value={config.model} onChange={(event) => setConfig({ ...config, model: event.target.value })} aria-describedby={`party-${party}-model-help`} />
          <small id={`party-${party}-model-help`}>Use a model available from {providerLabel}.</small>
        </label>
        <label className="field sm:col-span-2 lg:col-span-1 xl:col-span-2">
          <span>{config.provider === "anthropic" ? "API base URL" : "OpenAI-compatible base URL"}</span>
          <input type="url" value={config.endpoint ?? ""} onChange={(event) => setConfig({ ...config, endpoint: event.target.value })} placeholder="https://provider.example/v1/" />
          <small>{config.provider === "anthropic" ? <>The adapter appends <code>messages</code>.</> : <>The adapter appends <code>chat/completions</code>.</>}</small>
        </label>
        <label className="field sm:col-span-2 lg:col-span-1 xl:col-span-2">
          <span>API key <small>(optional for local models)</small></span>
          <input type="password" autoComplete="off" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Not saved or exported" />
        </label>
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-[var(--muted)]"><span className="status-dot" aria-hidden="true" /> Credential: {apiKey ? "loaded in memory" : "none (local/no-auth mode)"}</p>
    </fieldset>
  );
}

export function PartySetup({ scenarioSlug }: { scenarioSlug: string }) {
  const router = useRouter();
  const [configA, setConfigA] = useState<ModelConfig>(presetConfig(presets[0]));
  const [configB, setConfigB] = useState<ModelConfig>(presetConfig(presets[0]));
  const [apiKeyA, setApiKeyA] = useState("");
  const [apiKeyB, setApiKeyB] = useState("");
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);
  const valid = Boolean(configA.model.trim() && configA.endpoint?.trim() && configB.model.trim() && configB.endpoint?.trim());

  async function beginSession() {
    setError("");
    setStarting(true);
    const sessionId = crypto.randomUUID();
    try {
      await registerSessionCredentials(sessionId, { A: apiKeyA, B: apiKeyB });
      saveSessionSetup(sessionId, { A: configA, B: configB });
      router.push(`/sessions/${sessionId}?scenario=${scenarioSlug}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStarting(false);
    }
  }

  return (
    <aside className="self-start rounded-2xl border border-[var(--line-strong)] bg-[var(--panel)] p-6 shadow-[0_18px_50px_rgba(15,45,42,.08)] lg:sticky lg:top-7">
      <h2 className="text-2xl font-semibold tracking-tight">Configure Parties</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Provider credentials are sent to this server and held temporarily in process memory. They are not saved with the Session or included in exports.</p>
      <div className="mt-6 space-y-6">
        <SeatFields party="A" config={configA} apiKey={apiKeyA} setApiKey={setApiKeyA} setConfig={setConfigA} />
        <SeatFields party="B" config={configB} apiKey={apiKeyB} setApiKey={setApiKeyB} setConfig={setConfigB} />
      </div>
      <button
        className="button-primary mt-7 w-full"
        disabled={!valid || starting}
        onClick={() => void beginSession()}
      >
        {starting ? "Preparing Session…" : "Begin Session"}
      </button>
      {error && <p className="error-panel mt-3" role="alert">{error}</p>}
    </aside>
  );
}
