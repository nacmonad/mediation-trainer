import { notFound } from "next/navigation";

import { SessionWorkspace } from "./session-workspace";
import { getMediatorResources, getScenario } from "@/src/scenarios/catalog";

export default async function LiveSessionPage({ params, searchParams }: PageProps<"/sessions/[id]">) {
  const { id } = await params;
  const query = await searchParams;
  const scenarioSlug = typeof query.scenario === "string" ? query.scenario : "";
  const scenario = getScenario(scenarioSlug);
  if (!scenario) notFound();

  return (
    <SessionWorkspace
      sessionId={id}
      scenario={scenario}
      resources={getMediatorResources(scenario)}
    />
  );
}
