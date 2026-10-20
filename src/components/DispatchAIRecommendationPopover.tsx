"use client";

import { useState } from "react";
import { Button, Popover, Tabs } from "antd";
import {
  CheckCircleFilled,
  DownOutlined,
  RobotOutlined,
  UpOutlined,
} from "@ant-design/icons";
import RecommendationEvidenceDetailModal, { RecommendationEvidenceIcon } from "./RecommendationEvidenceDetailModal";
import { getAIConfidenceLevel, getConfidenceCopy } from "@/lib/aiRecommendationRisk";
import type {
  AIRecommendationItem,
  AIRecommendationEvidenceDetail,
  AssistingDepartmentRecommendation,
  DepartmentRecommendation,
  DispatchOpinionRecommendation,
  RecommendationModuleStatus,
  TimeRecommendation,
} from "@/types/ai-recommendation";

type RecommendationGroup = "time" | "primary" | "assist" | "opinion";

interface DispatchAIRecommendationPopoverProps {
  times: TimeRecommendation[];
  departments: DepartmentRecommendation[];
  assistingDepartments: AssistingDepartmentRecommendation[];
  opinions: DispatchOpinionRecommendation[];
  onApplyTime: (item: TimeRecommendation) => void;
  onApplyDepartment: (item: DepartmentRecommendation) => void;
  onApplyAssistingDepartment: (item: AssistingDepartmentRecommendation) => void;
  onApplyOpinion: (item: DispatchOpinionRecommendation) => void;
  appliedIds: Partial<Record<RecommendationGroup, string>>;
  moduleStates: Partial<Record<RecommendationGroup, RecommendationModuleStatus>>;
  onUndo: (group: RecommendationGroup) => void;
}

function RecommendationList<T extends AIRecommendationItem>({
  group,
  items,
  appliedId,
  status,
  onApply,
  onOpenEvidence,
}: {
  group: RecommendationGroup;
  items: T[];
  appliedId?: string;
  status?: RecommendationModuleStatus;
  onApply: (item: T) => void;
  onOpenEvidence: (detail: AIRecommendationEvidenceDetail) => void;
}) {
  const [expandedId, setExpandedId] = useState<string>();
  return (
    <div className="dispatch-ai-list" data-recommendation-group={group}>
      {items.slice(0, 3).map((item, index) => {
        const applied = appliedId === item.id && status !== "stale";
        const expanded = expandedId === item.id;
        const confidenceLevel = getAIConfidenceLevel(item.confidence);
        const itemDepartment = "department" in item && typeof item.department === "string" ? item.department : "";
        const itemTown = "town" in item && typeof item.town === "string" ? item.town : "";
        const itemOpinion = "value" in item && typeof item.value === "string" ? item.value : undefined;
        const directAnswer = group === "primary"
          ? itemDepartment
          : group === "assist"
            ? itemDepartment || "无需协办单位"
            : item.title;
        const answerContext = group === "primary"
          ? itemTown
          : group === "assist"
            ? itemTown || "主责单位独立处置"
            : item.subtitle;
        const opinionPreview = group === "opinion" ? itemOpinion : undefined;
        return (
          <article className={`dispatch-ai-card ${index === 0 ? "is-best" : ""} ${applied ? "is-applied" : ""}`} key={item.id}>
            <div className="dispatch-ai-card-main">
              <div className="dispatch-ai-answer-row">
                <div>
                  <span className="dispatch-ai-option-label">{index === 0 ? "首选方案" : `备选方案 ${index + 1}`}</span>
                  <strong>{directAnswer}</strong>
                  {answerContext && <span>{answerContext}</span>}
                </div>
                <span className={`dispatch-ai-confidence-copy is-${confidenceLevel}`}>{getConfidenceCopy(item.confidence)} · {item.confidence}%</span>
              </div>
              {opinionPreview && <div className="dispatch-ai-opinion-preview"><span>将回填：</span>{opinionPreview}</div>}
              <div className="dispatch-ai-reason"><span>推荐理由：</span>{item.reason}</div>
              {expanded && (
                <div className="ai-evidence-panel dispatch-ai-evidence-panel">
                  <div className="ai-evidence-title">推荐依据</div>
                  {(item.evidence ?? []).map((line, evidenceIndex) => typeof line === "string" ? (
                    <div className="ai-evidence-line" key={`${item.id}-${evidenceIndex}`}>
                      <CheckCircleFilled />
                      <span>{line}</span>
                    </div>
                  ) : (
                    <button type="button" className="ai-evidence-line ai-evidence-detail-button" key={line.id} onClick={() => onOpenEvidence(line)}>
                      <RecommendationEvidenceIcon type={line.type} />
                      <span><strong>{line.title}</strong>{line.summary}</span>
                      <em>查看详情</em>
                    </button>
                  ))}
                </div>
              )}
              <Button
                className="dispatch-ai-evidence-toggle"
                type="link"
                size="small"
                icon={expanded ? <UpOutlined /> : <DownOutlined />}
                onClick={() => setExpandedId(expanded ? undefined : item.id)}
              >
                {expanded ? "收起依据" : "查看依据"}
              </Button>
            </div>
            <Button
              size="small"
              type={applied ? "default" : "primary"}
              icon={applied ? <CheckCircleFilled /> : undefined}
              onClick={() => onApply(item)}
            >
              {applied ? "已采用" : "采用"}
            </Button>
          </article>
        );
      })}
    </div>
  );
}

export default function DispatchAIRecommendationPopover({
  times,
  departments,
  assistingDepartments,
  opinions,
  onApplyTime,
  onApplyDepartment,
  onApplyAssistingDepartment,
  onApplyOpinion,
  appliedIds,
  moduleStates,
  onUndo,
}: DispatchAIRecommendationPopoverProps) {
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<RecommendationGroup>("time");
  const [evidenceDetail, setEvidenceDetail] = useState<AIRecommendationEvidenceDetail>();

  const groupOrder: RecommendationGroup[] = ["time", "primary", "assist", "opinion"];

  const applyAndAdvance = <T extends AIRecommendationItem>(group: RecommendationGroup, item: T, callback: (value: T) => void) => {
    callback(item);
    const nextGroup = groupOrder[groupOrder.indexOf(group) + 1];
    if (nextGroup) setActiveGroup(nextGroup);
  };

  const tabLabel = (group: RecommendationGroup, label: string, count: number) => (
    <span className={`dispatch-ai-tab-label ${moduleStates[group] === "adopted" || moduleStates[group] === "reviewed" ? "is-complete" : ""} ${moduleStates[group] === "stale" ? "is-stale" : ""}`}>
      {label}<em>（{count}）</em>{(moduleStates[group] === "adopted" || moduleStates[group] === "reviewed") && <CheckCircleFilled />}
    </span>
  );

  const completedCount = groupOrder.filter((group) => ["adopted", "reviewed", "manuallyEdited"].includes(moduleStates[group] ?? "")).length;
  const triggerStatus = groupOrder.some((group) => moduleStates[group] === "stale")
    ? "stale"
    : completedCount === groupOrder.length
      ? "adopted"
      : "idle";

  const content = (
    <div className="dispatch-ai-panel">
      <div className="dispatch-ai-heading">
        <span className="dispatch-ai-icon"><RobotOutlined /></span>
        <div>
          <div className="dispatch-ai-title">事件派单智能组合</div>
          <div className="dispatch-ai-description">直接选择结果；采用后自动进入下一项。</div>
        </div>
        <span className="dispatch-ai-step-hint">每项 3 个方案</span>
      </div>
      <Tabs
        className="dispatch-ai-tabs"
        activeKey={activeGroup}
        onChange={(key) => setActiveGroup(key as RecommendationGroup)}
        items={[
          {
            key: "time",
            label: tabLabel("time", "时限", times.length),
            children: <RecommendationList group="time" items={times} appliedId={appliedIds.time} status={moduleStates.time} onOpenEvidence={setEvidenceDetail} onApply={(item) => applyAndAdvance("time", item, onApplyTime)} />,
          },
          {
            key: "primary",
            label: tabLabel("primary", "主责", departments.length),
            children: <RecommendationList group="primary" items={departments} appliedId={appliedIds.primary} status={moduleStates.primary} onOpenEvidence={setEvidenceDetail} onApply={(item) => applyAndAdvance("primary", item, onApplyDepartment)} />,
          },
          {
            key: "assist",
            label: tabLabel("assist", "协办", assistingDepartments.length),
            children: <RecommendationList group="assist" items={assistingDepartments} appliedId={appliedIds.assist} status={moduleStates.assist} onOpenEvidence={setEvidenceDetail} onApply={(item) => applyAndAdvance("assist", item, onApplyAssistingDepartment)} />,
          },
          {
            key: "opinion",
            label: tabLabel("opinion", "意见", opinions.length),
            children: <RecommendationList group="opinion" items={opinions} appliedId={appliedIds.opinion} status={moduleStates.opinion} onOpenEvidence={setEvidenceDetail} onApply={(item) => applyAndAdvance("opinion", item, onApplyOpinion)} />,
          },
        ]}
      />
      <div className="dispatch-ai-footer">
        <span><CheckCircleFilled /> 已完成 {completedCount}/4，协办可选择“无需协办”</span>
        <div>
          {appliedIds[activeGroup] && <Button type="link" size="small" onClick={() => onUndo(activeGroup)}>撤销当前模块</Button>}
          <Button size="small" onClick={() => setOpen(false)}>完成</Button>
        </div>
      </div>
    </div>
  );

  return (
    <>
    <Popover
      open={open && !evidenceDetail}
      onOpenChange={setOpen}
      trigger="click"
      placement="right"
      content={content}
      overlayClassName="dispatch-ai-popover-overlay"
      arrow
    >
      <Button className={`ai-trigger-button dispatch-ai-trigger is-${triggerStatus}`} size="small" icon={<RobotOutlined />} aria-label="事件派单AI综合推荐">
        {triggerStatus === "adopted" ? "AI已采用" : triggerStatus === "stale" ? "需复核" : "AI推荐"}
      </Button>
    </Popover>
    <RecommendationEvidenceDetailModal detail={evidenceDetail} onClose={() => setEvidenceDetail(undefined)} />
    </>
  );
}
