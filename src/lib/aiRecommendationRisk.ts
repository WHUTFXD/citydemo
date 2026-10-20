import type { AIConfidenceLevel, RecommendationModule } from "@/types/ai-recommendation";

export const recommendationModuleLabels: Record<RecommendationModule, string> = {
  caseType: "案件类型",
  address: "标准地址",
  responsibility: "权责网格",
  time: "办理时限",
  primary: "主责单位",
  assist: "协办单位",
  opinion: "派遣意见",
};

export function getAIConfidenceLevel(confidence: number): AIConfidenceLevel {
  if (confidence >= 85) return "trusted";
  if (confidence >= 70) return "review";
  return "manualRequired";
}

export function getConfidenceCopy(confidence: number) {
  const level = getAIConfidenceLevel(confidence);
  if (level === "trusted") return "可信";
  if (level === "review") return "建议复核";
  return "必须人工确认";
}
