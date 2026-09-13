"use client";

import { useState } from "react";
import { Button, Popover, Progress, Tabs, Tag } from "antd";
import { CheckCircleFilled, RobotOutlined, ThunderboltFilled } from "@ant-design/icons";
import type {
  AIRecommendationItem,
  AssistingDepartmentRecommendation,
  DepartmentRecommendation,
  DispatchOpinionRecommendation,
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
}

function RecommendationList<T extends AIRecommendationItem>({
  group,
  items,
  appliedId,
  onApply,
}: {
  group: RecommendationGroup;
  items: T[];
  appliedId?: string;
  onApply: (item: T) => void;
}) {
  return (
    <div className="dispatch-ai-list" data-recommendation-group={group}>
      {items.slice(0, 3).map((item, index) => {
        const applied = appliedId === item.id;
        return (
          <article className={`dispatch-ai-card ${index === 0 ? "is-best" : ""} ${applied ? "is-applied" : ""}`} key={item.id}>
            <div className="dispatch-ai-rank">{index + 1}</div>
            <div className="dispatch-ai-card-main">
              <div className="dispatch-ai-card-title">
                <div>
                  <strong>{item.title}</strong>
                  {item.subtitle && <span>{item.subtitle}</span>}
                </div>
                {index === 0 && <Tag color="blue">优先</Tag>}
              </div>
              <div className="dispatch-ai-confidence">
                <span>置信度</span>
                <Progress percent={item.confidence} size="small" showInfo={false} strokeColor="#2f78d3" />
                <b>{item.confidence}%</b>
              </div>
              <div className="dispatch-ai-reason"><ThunderboltFilled />{item.reason}</div>
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
}: DispatchAIRecommendationPopoverProps) {
  const [open, setOpen] = useState(false);
  const [activeGroup, setActiveGroup] = useState<RecommendationGroup>("time");
  const [applied, setApplied] = useState<Partial<Record<RecommendationGroup, string>>>({});

  const groupOrder: RecommendationGroup[] = ["time", "primary", "assist", "opinion"];

  const applyAndAdvance = <T extends AIRecommendationItem>(group: RecommendationGroup, item: T, callback: (value: T) => void) => {
    callback(item);
    setApplied((current) => {
      if (group === "primary") return { ...current, primary: item.id, assist: undefined, opinion: undefined };
      if (group === "assist") return { ...current, assist: item.id, opinion: undefined };
      return { ...current, [group]: item.id };
    });
    const nextGroup = groupOrder[groupOrder.indexOf(group) + 1];
    if (nextGroup) setActiveGroup(nextGroup);
  };

  const tabLabel = (group: RecommendationGroup, label: string, count: number) => (
    <span className={`dispatch-ai-tab-label ${applied[group] ? "is-complete" : ""}`}>
      {label}<em>{count}</em>{applied[group] && <CheckCircleFilled />}
    </span>
  );

  const content = (
    <div className="dispatch-ai-panel">
      <div className="dispatch-ai-heading">
        <span className="dispatch-ai-icon"><RobotOutlined /></span>
        <div>
          <div className="dispatch-ai-title">事件派单智能组合</div>
          <div className="dispatch-ai-description">时限独立推荐；主责、协办和意见按组合路径依次选择。</div>
        </div>
        <Tag color="processing">3×3×3 组合</Tag>
      </div>
      <Tabs
        className="dispatch-ai-tabs"
        activeKey={activeGroup}
        onChange={(key) => setActiveGroup(key as RecommendationGroup)}
        items={[
          {
            key: "time",
            label: tabLabel("time", "时限推荐", times.length),
            children: <RecommendationList group="time" items={times} appliedId={applied.time} onApply={(item) => applyAndAdvance("time", item, onApplyTime)} />,
          },
          {
            key: "primary",
            label: tabLabel("primary", "主责单位", departments.length),
            children: <RecommendationList group="primary" items={departments} appliedId={applied.primary} onApply={(item) => applyAndAdvance("primary", item, onApplyDepartment)} />,
          },
          {
            key: "assist",
            label: tabLabel("assist", "协办单位", assistingDepartments.length),
            children: <RecommendationList group="assist" items={assistingDepartments} appliedId={applied.assist} onApply={(item) => applyAndAdvance("assist", item, onApplyAssistingDepartment)} />,
          },
          {
            key: "opinion",
            label: tabLabel("opinion", "派遣意见", opinions.length),
            children: <RecommendationList group="opinion" items={opinions} appliedId={applied.opinion} onApply={(item) => applyAndAdvance("opinion", item, onApplyOpinion)} />,
          },
        ]}
      />
      <div className="dispatch-ai-footer">
        <span><CheckCircleFilled /> 已完成 {Object.values(applied).filter(Boolean).length}/4，协办可选择“无需协办”</span>
        <Button size="small" onClick={() => setOpen(false)}>完成</Button>
      </div>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      trigger="click"
      placement="bottomLeft"
      content={content}
      overlayClassName="dispatch-ai-popover-overlay"
      arrow
    >
      <Button className="ai-trigger-button dispatch-ai-trigger" size="small" icon={<RobotOutlined />} aria-label="事件派单AI综合推荐">
        AI推荐
      </Button>
    </Popover>
  );
}
