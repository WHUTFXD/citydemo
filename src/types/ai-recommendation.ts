export interface AIRecommendationEvidenceDetail {
  id: string;
  type: "work-order" | "rule";
  title: string;
  summary: string;
  source: string;
  metadata: string[];
  content: string;
}

export interface AIRecommendationItem {
  id: string;
  title: string;
  subtitle?: string;
  confidence: number;
  reason: string;
  evidence?: Array<string | AIRecommendationEvidenceDetail>;
  tag?: string;
}

export interface CaseTypeRecommendation extends AIRecommendationItem {
  value: string;
}

export interface MapAddressRecommendation extends AIRecommendationItem {
  detail: string;
  position: [number, number];
}

export interface ResponsibilityRecommendation extends AIRecommendationItem {
  town: string;
  grid: string;
  gridType: string;
  responsibilityBlock: string;
  disposalGrid: string;
  department: string;
}

export interface TimeRecommendation extends AIRecommendationItem {
  arrival: [number, number, number];
  processing: [number, number, number];
}

export interface DepartmentRecommendation extends AIRecommendationItem {
  town: string;
  department: string;
  opinion?: string;
}

export interface AssistingDepartmentRecommendation extends AIRecommendationItem {
  town: string;
  department: string;
}

export interface DispatchOpinionRecommendation extends AIRecommendationItem {
  value: string;
}

export interface AIRecommendationSet {
  orderId: string;
  generatedAt: string;
  caseTypes: CaseTypeRecommendation[];
  addresses: MapAddressRecommendation[];
  responsibilities: ResponsibilityRecommendation[];
  times: TimeRecommendation[];
  departments: DepartmentRecommendation[];
  assistingDepartments: AssistingDepartmentRecommendation[];
  dispatchOpinions: DispatchOpinionRecommendation[];
}
