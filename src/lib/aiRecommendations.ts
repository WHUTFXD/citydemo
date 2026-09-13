import recommendationData from "@/data/ai-recommendations.json";
import { getAutoDispatchScenarioOrder } from "@/lib/autoDispatchScenario";
import type { AIRecommendationSet } from "@/types/ai-recommendation";

const typedRecommendations = recommendationData as AIRecommendationSet[];

export function getAIRecommendationsByOrderId(orderId: string): AIRecommendationSet | undefined {
  const exactMatch = typedRecommendations.find((item) => item.orderId === orderId);
  if (exactMatch) return exactMatch;

  const demoPreset = typedRecommendations[0];
  if (!demoPreset) return undefined;
  const scenarioItem = getAutoDispatchScenarioOrder(orderId);
  return {
    ...demoPreset,
    orderId,
    generatedAt: "2026-09-13 09:30:16",
    addresses: scenarioItem?.addressRecommendations ?? demoPreset.addresses,
  };
}
