export type WorkOrderStatus = "待核验" | "待上报核实";

export interface Attachment {
  id: string;
  name: string;
  stage: string;
  department: string;
  user: string;
  uploadedAt: string;
  onSite: boolean;
}

export interface WorkOrderSummary {
  id: string;
  taskId: string;
  linkedId: string;
  status: WorkOrderStatus;
  source: string;
  receivedAt: string;
  pushDepartment: string;
  caseCategory: string;
  businessType: string;
  street: string;
  address: string;
  responsibleDepartment: string;
  contact: string;
  description: string;
}

export interface WorkOrderDetail extends WorkOrderSummary {
  complainant: string;
  phone: string;
  eventCategory: string;
  standardAddress: string;
  urgency: string;
  previousStep: string;
  previousAt: string;
  previousNote: string;
  attachments: Attachment[];
  quickReplies: string[];
}
