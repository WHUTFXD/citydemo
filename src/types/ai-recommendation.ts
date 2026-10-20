export interface AIRecommendationEvidenceDetail {
  id: string;
  type:
    | "work-order"
    | "classification-table"
    | "address-record"
    | "dispatch-rule"
    | "policy-list"
    | "responsibility-ledger"
    | "road-ledger"
    | "grid-roster"
    | "sla-rule"
    | "opinion-template"
    | "case-corpus";
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

export type AIConfidenceLevel = "trusted" | "review" | "manualRequired";

export type RecommendationModule =
  | "caseType"
  | "address"
  | "responsibility"
  | "time"
  | "primary"
  | "assist"
  | "opinion";

export type RecommendationModuleStatus = "idle" | "adopted" | "stale" | "manuallyEdited" | "reviewed";

export type RecommendationOperationAction = "adopt" | "undo" | "manualEdit" | "invalidate" | "review";

export interface RecommendationModuleRuntime {
  status: RecommendationModuleStatus;
  appliedId?: string;
  confidence?: number;
  confidenceLevel?: AIConfidenceLevel;
}

export interface RecommendationOperationRecord {
  id: string;
  module: RecommendationModule;
  action: RecommendationOperationAction;
  candidateId?: string;
  confidence?: number;
  previousValue: string;
  nextValue: string;
  operator: string;
  at: string;
}

export type RecommendationValidationSeverity = "pass" | "review" | "blocking";

export interface RecommendationValidationItem {
  module: RecommendationModule;
  label: string;
  severity: RecommendationValidationSeverity;
  message: string;
  anchorId: string;
  confidence?: number;
  reviewable?: boolean;
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
