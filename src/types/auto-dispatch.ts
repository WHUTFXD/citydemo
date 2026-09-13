import type { MapAddressRecommendation } from "@/types/ai-recommendation";
import type { WorkOrderDetail } from "@/types/order";

export type AutoDispatchPhase = "idle" | "running" | "paused" | "completed";
export type AutoDispatchOutcome = "auto-dispatched" | "needs-manual";
export type AutoDispatchItemState = "analyzing" | "autoDispatched" | "needsManual" | "manuallyResolved";

export interface AutoDispatchScenarioItem {
  arrivalOffsetMs: number;
  analysisDurationMs: number;
  outcome: AutoDispatchOutcome;
  classificationConfidence: number;
  addressConfidence: number;
  targetDepartment: string;
  dispatchOpinion: string;
  order: WorkOrderDetail;
  addressRecommendations?: MapAddressRecommendation[];
}

export interface AutoDispatchScenario {
  id: string;
  name: string;
  intervalMs: number;
  items: AutoDispatchScenarioItem[];
}

export interface AutoDispatchRuntimeItem {
  scenarioIndex: number;
  state: AutoDispatchItemState;
  enteredAt: number;
}
