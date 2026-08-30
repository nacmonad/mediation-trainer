import { notFound } from "next/navigation";

import { ReviewWorkspace } from "./review-workspace";
import { getScenario } from "@/src/scenarios/catalog";

export default async function ReviewPage({ params, searchParams }: PageProps<"/sessions/[id]/review">) {
  const { id } = await params;
  const query = await searchParams;
  const scenarioSlug = typeof query.scenario === "string" ? query.scenario : "";
  const scenario = getScenario(scenarioSlug);
  if (!scenario) notFound();
  return <ReviewWorkspace sessionId={id} scenarioTitle={scenario.title} />;
}
