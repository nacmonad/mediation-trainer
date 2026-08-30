"use client";

import { useState } from "react";
import Link from "next/link";

const providers = ["Ollama", "OpenAI", "Anthropic"] as const;

function SeatFields({ party, model, setModel }: { party: "A" | "B"; model: string; setModel: (value: string) => void }) {
  const [provider, setProvider] = useState<(typeof providers)[number]>("Ollama");
  return (
    <fieldset className="border-t border-[var(--line)] pt-5">
      <legend className="text-lg font-semibold">Party {party}</legend>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <label className="field">
          <span>Provider</span>
          <select value={provider} onChange={(event) => setProvider(event.target.value as (typeof providers)[number])}>
            {providers.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Model</span>
          <input value={model} onChange={(event) => setModel(event.target.value)} aria-describedby={`party-${party}-model-help`} />
          <small id={`party-${party}-model-help`}>Use a model available from {provider}.</small>
        </label>
      </div>
      <p className="mt-3 flex items-center gap-2 text-sm text-[var(--muted)]"><span className="status-dot" aria-hidden="true" /> Credential status: memory-only</p>
    </fieldset>
  );
}

export function PartySetup({ scenarioSlug }: { scenarioSlug: string }) {
  const [modelA, setModelA] = useState("scripted");
  const [modelB, setModelB] = useState("scripted");
  const valid = Boolean(modelA.trim() && modelB.trim());

  return (
    <aside className="self-start rounded-2xl border border-[var(--line-strong)] bg-[var(--panel)] p-6 shadow-[0_18px_50px_rgba(15,45,42,.08)] lg:sticky lg:top-7">
      <h2 className="text-2xl font-semibold tracking-tight">Configure Parties</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">Provider credentials stay in browser memory by default.</p>
      <div className="mt-6 space-y-6">
        <SeatFields party="A" model={modelA} setModel={setModelA} />
        <SeatFields party="B" model={modelB} setModel={setModelB} />
      </div>
      <LinkButton disabled={!valid} href={`/sessions/new?scenario=${scenarioSlug}`} />
    </aside>
  );
}

function LinkButton({ disabled, href }: { disabled: boolean; href: string }) {
  if (disabled) return <button className="button-primary mt-7 w-full" disabled>Begin Session</button>;
  return <Link className="button-primary mt-7 w-full" href={href}>Begin Session</Link>;
}
