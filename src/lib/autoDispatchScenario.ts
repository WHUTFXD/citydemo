import scenarioData from "@/data/auto-dispatch-scenario.json";
import type { AutoDispatchScenario } from "@/types/auto-dispatch";

export const autoDispatchScenario = scenarioData as AutoDispatchScenario;

export function getAutoDispatchScenarioOrder(orderId: string) {
  return autoDispatchScenario.items.find((item) => item.order.id === orderId);
}
