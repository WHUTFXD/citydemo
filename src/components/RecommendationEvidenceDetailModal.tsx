"use client";

import { Button, Modal, Tag } from "antd";
import {
  ApartmentOutlined,
  BookOutlined,
  EnvironmentOutlined,
  FieldTimeOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  FormOutlined,
  ProfileOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import type { AIRecommendationEvidenceDetail } from "@/types/ai-recommendation";

const evidencePresentation: Record<AIRecommendationEvidenceDetail["type"], { label: string; heading: string; color: string; icon: typeof FileTextOutlined }> = {
  "work-order": { label: "历史工单", heading: "案件与处置摘要", color: "blue", icon: FileSearchOutlined },
  "classification-table": { label: "分类对照表", heading: "分类对照内容", color: "cyan", icon: TagsOutlined },
  "address-record": { label: "标准地址库", heading: "地址记录内容", color: "geekblue", icon: EnvironmentOutlined },
  "dispatch-rule": { label: "分派规则", heading: "规则内容", color: "gold", icon: FileTextOutlined },
  "policy-list": { label: "政策清单", heading: "政策依据", color: "purple", icon: ProfileOutlined },
  "responsibility-ledger": { label: "权责台账", heading: "权责记录", color: "volcano", icon: BookOutlined },
  "road-ledger": { label: "道路台账", heading: "道路权属记录", color: "lime", icon: EnvironmentOutlined },
  "grid-roster": { label: "网格清单", heading: "网格映射记录", color: "green", icon: ApartmentOutlined },
  "sla-rule": { label: "时限规则", heading: "时限标准", color: "orange", icon: FieldTimeOutlined },
  "opinion-template": { label: "意见模板", heading: "模板内容", color: "magenta", icon: FormOutlined },
  "case-corpus": { label: "案例语料", heading: "语料与生成依据", color: "blue", icon: FileSearchOutlined },
};

export function RecommendationEvidenceIcon({ type }: { type: AIRecommendationEvidenceDetail["type"] }) {
  const Icon = evidencePresentation[type].icon;
  return <Icon />;
}

export default function RecommendationEvidenceDetailModal({
  detail,
  onClose,
}: {
  detail?: AIRecommendationEvidenceDetail;
  onClose: () => void;
}) {
  const presentation = detail ? evidencePresentation[detail.type] : evidencePresentation["dispatch-rule"];
  const Icon = presentation.icon;
  return (
    <Modal
      className="evidence-detail-modal"
      zIndex={1200}
      open={Boolean(detail)}
      title={<span><Icon /> {presentation.label}详情</span>}
      width={620}
      footer={<Button type="primary" onClick={onClose}>关闭</Button>}
      onCancel={onClose}
    >
      {detail && (
        <div className="evidence-detail-content">
          <div className="evidence-detail-heading">
            <div>
              <strong>{detail.title}</strong>
              <span>{detail.summary}</span>
            </div>
            <Tag color={presentation.color}>{presentation.label}</Tag>
          </div>
          <div className="evidence-detail-source">数据来源：{detail.source}</div>
          <div className="evidence-detail-metadata">
            {detail.metadata.map((value) => <span key={value}>{value}</span>)}
          </div>
          <div className="evidence-detail-body">
            <strong>{presentation.heading}</strong>
            <p>{detail.content}</p>
          </div>
        </div>
      )}
    </Modal>
  );
}
