import Link from "next/link";
import { notFound } from "next/navigation";

import { PartySetup } from "./party-setup";
import { getMediatorResources, getScenario, scenarios } from "@/src/scenarios/catalog";

export function generateStaticParams() {
  return scenarios.map((scenario) => ({ slug: scenario.slug }));
}

export default async function ScenarioSetupPage({ params }: PageProps<"/scenarios/[slug]">) {
  const { slug } = await params;
  const scenario = getScenario(slug);
  if (!scenario) notFound();
  const resources = getMediatorResources(scenario);

  return (
    <main className="min-h-[100dvh] bg-[var(--surface)] px-5 py-7 text-[var(--ink)] sm:px-8 lg:px-12">
      <div className="mx-auto max-w-7xl">
        <nav className="flex items-center justify-between border-b border-[var(--line)] pb-5" aria-label="Scenario setup">
          <Link className="text-sm font-semibold text-[var(--accent)] hover:underline" href="/">← Scenario library</Link>
          <p className="text-sm text-[var(--muted)]">Session setup</p>
        </nav>

        <div className="grid gap-10 py-9 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,.9fr)] lg:gap-16">
          <section>
            <p className="text-sm font-semibold capitalize text-[var(--accent)]">{scenario.difficulty} · {scenario.tags.join(" · ")}</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">{scenario.title}</h1>
            <div className="mt-8 border-t border-[var(--line)] pt-6">
              <h2 className="text-lg font-semibold">Shared Scenario brief</h2>
              <ul className="mt-4 space-y-3 text-[var(--muted)]">
                {scenario.sharedFacts.map((fact) => <li className="flex gap-3 leading-7" key={fact}><span aria-hidden="true" className="text-[var(--accent)]">—</span>{fact}</li>)}
              </ul>
            </div>

            <div className="mt-8 border-t border-[var(--line)] pt-6">
              <h2 className="text-lg font-semibold">Case resources available to the Mediator</h2>
              {resources.length ? (
                <div className="mt-4 divide-y divide-[var(--line)] border-y border-[var(--line)]">
                  {resources.map((resource) => (
                    <article className="py-4" key={resource.id}>
                      <h3 className="font-semibold">{resource.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{resource.body}</p>
                    </article>
                  ))}
                </div>
              ) : <p className="mt-3 text-sm text-[var(--muted)]">No Case resources are available at setup.</p>}
            </div>
          </section>

          <PartySetup scenarioSlug={scenario.slug} />
        </div>
      </div>
    </main>
  );
}
