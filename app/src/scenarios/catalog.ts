import employmentInput from "./employment.json";
import supplierInvoiceInput from "./supplier-invoice.json";
import softwareImplementationInput from "./software-implementation.json";

import { parseScenario, projectScenarioFor, type Scenario } from "@/src/engine/scenario";

const inputs: readonly unknown[] = [supplierInvoiceInput, employmentInput, softwareImplementationInput];

export const scenarios: readonly Scenario[] = inputs.map(parseScenario);

export function getScenario(slug: string): Scenario | undefined {
  return scenarios.find((scenario) => scenario.slug === slug);
}

export function getMediatorResources(scenario: Scenario) {
  return projectScenarioFor(scenario, "Z", []).resources;
}

export function getSharedPremise(scenario: Scenario): string {
  return scenario.sharedFacts[0] ?? "A structured mediation exercise.";
}

export function getComplexity(scenario: Scenario): string {
  const pressure = scenario.rules.length + scenario.disclosureRules.length;
  if (pressure >= 5) return "High complexity";
  if (pressure >= 2) return "Moderate complexity";
  return "Focused exercise";
}
