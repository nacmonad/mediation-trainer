import Link from "next/link";

import {
  getComplexity,
  getMediatorResources,
  getSharedPremise,
  scenarios,
} from "@/src/scenarios/catalog";

export default function Home() {
  return (
    <main className="min-h-[100dvh] bg-[var(--surface)] px-5 py-8 text-[var(--ink)] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <header className="flex items-center justify-between border-b border-[var(--line)] pb-5">
          <div>
            <p className="text-sm font-semibold text-[var(--accent)]">Mediator training</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Choose a Scenario</h1>
          </div>
          <p className="hidden max-w-xs text-right text-sm leading-6 text-[var(--muted)] sm:block">
            Practice the conversation. Review your own work.
          </p>
        </header>

        <section className="py-10" aria-labelledby="scenario-heading">
          <div className="max-w-2xl">
            <h2 id="scenario-heading" className="text-3xl font-semibold tracking-[-0.035em] sm:text-5xl">
              Start with the dispute, not the dashboard.
            </h2>
            <p className="mt-4 max-w-[62ch] text-base leading-7 text-[var(--muted)]">
              Each Scenario contains synthetic materials and two simulated Parties. Private Party facts remain concealed.
            </p>
          </div>

          <div className="mt-10 divide-y divide-[var(--line)] border-y border-[var(--line)]">
            {scenarios.map((scenario, index) => {
              const resources = getMediatorResources(scenario);
              return (
                <article className="group grid gap-5 py-7 md:grid-cols-[3rem_minmax(0,1fr)_auto] md:items-center" key={scenario.scenarioId}>
                  <p className="font-mono text-sm text-[var(--muted)]">0{index + 1}</p>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-semibold tracking-tight sm:text-2xl">{scenario.title}</h3>
                      <span className="rounded-full border border-[var(--line-strong)] px-2.5 py-1 text-xs font-medium capitalize text-[var(--muted)]">
                        {scenario.difficulty}
                      </span>
                    </div>
                    <p className="mt-2 max-w-[65ch] leading-7 text-[var(--muted)]">{getSharedPremise(scenario)}</p>
                    <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[var(--muted)]" aria-label="Scenario details">
                      <li>{getComplexity(scenario)}</li>
                      <li>{resources.length} Case {resources.length === 1 ? "resource" : "resources"}</li>
                      {scenario.tags.map((tag) => <li key={tag}>{tag}</li>)}
                    </ul>
                  </div>
                  <Link className="button-secondary md:justify-self-end" href={`/scenarios/${scenario.slug}`}>
                    Review Scenario <span aria-hidden="true">→</span>
                  </Link>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
