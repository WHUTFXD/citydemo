"use client";

import { useMemo, useState } from "react";
import { Button, Popover, Tag } from "antd";
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  DownOutlined,
  ExclamationCircleFilled,
  SafetyCertificateOutlined,
  UpOutlined,
} from "@ant-design/icons";
import { recommendationModuleLabels } from "@/lib/aiRecommendationRisk";
import type {
  RecommendationModule,
  RecommendationOperationRecord,
  RecommendationValidationItem,
} from "@/types/ai-recommendation";

interface DispatchRiskPopoverProps {
  open: boolean;
  items: RecommendationValidationItem[];
  records: RecommendationOperationRecord[];
  showTrigger?: boolean;
  onOpenChange: (open: boolean) => void;
  onFocusModule: (module: RecommendationModule) => void;
  onReviewModule: (module: RecommendationModule) => void;
}

const severityOrder = { blocking: 0, review: 1, pass: 2 } as const;

export default function DispatchRiskPopover({
  open,
  items,
  records,
  showTrigger = true,
  onOpenChange,
  onFocusModule,
  onReviewModule,
}: DispatchRiskPopoverProps) {
  const [recordsOpen, setRecordsOpen] = useState(false);
  const sortedItems = useMemo(
    () => [...items].sort((left, right) => severityOrder[left.severity] - severityOrder[right.severity]),
    [items],
  );
  const riskCount = items.filter((item) => item.severity !== "pass").length;
  const blockingCount = items.filter((item) => item.severity === "blocking").length;

  const content = (
    <div className="dispatch-risk-panel">
      <div className="dispatch-risk-heading">
        <span className={`dispatch-risk-icon ${riskCount ? "has-risk" : "is-pass"}`}><SafetyCertificateOutlined /></span>
        <div>
          <div className="dispatch-risk-title">派单前智能校验</div>
          <div className="dispatch-risk-description">
            {riskCount ? `发现 ${riskCount} 项需要处理，点击可定位到对应字段。` : "7 个派单要素均已检查，可以提交。"}
          </div>
        </div>
        <Tag color={blockingCount ? "error" : riskCount ? "warning" : "success"}>
          {blockingCount ? `${blockingCount}项阻断` : riskCount ? `${riskCount}项复核` : "校验通过"}
        </Tag>
      </div>

      <div className="dispatch-risk-list">
        {sortedItems.map((item) => (
          <div className={`dispatch-risk-row is-${item.severity}`} key={item.module}>
            <button type="button" className="dispatch-risk-jump" onClick={() => onFocusModule(item.module)}>
              <span className="dispatch-risk-state-icon">
                {item.severity === "pass" ? <CheckCircleFilled /> : <ExclamationCircleFilled />}
              </span>
              <span className="dispatch-risk-copy">
                <strong>{item.label}</strong>
                <span>{item.message}</span>
              </span>
              {item.confidence !== undefined && <em>{item.confidence}%</em>}
            </button>
            {item.reviewable && item.severity !== "pass" && (
              <Button size="small" onClick={() => onReviewModule(item.module)}>
                {item.severity === "blocking" ? "确认人工核验" : "确认已复核"}
              </Button>
            )}
          </div>
        ))}
      </div>

      <div className="dispatch-risk-records">
        <button type="button" className="dispatch-risk-records-toggle" onClick={() => setRecordsOpen((value) => !value)}>
          <span><ClockCircleOutlined /> 操作记录（{records.length}）</span>
          {recordsOpen ? <UpOutlined /> : <DownOutlined />}
        </button>
        {recordsOpen && (
          <div className="dispatch-risk-record-list">
            {records.length ? records.slice().reverse().map((record) => (
              <div className="dispatch-risk-record" key={record.id}>
                <span>{record.at}</span>
                <strong>{recommendationModuleLabels[record.module]}</strong>
                <em>{record.action === "adopt" ? "采用AI推荐" : record.action === "undo" ? "撤销采用" : record.action === "invalidate" ? "推荐失效" : record.action === "review" ? "人工复核" : "人工调整"}</em>
                <p>{record.nextValue || "—"}</p>
              </div>
            )) : <div className="dispatch-risk-record-empty">本轮尚无 AI 操作记录</div>}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={onOpenChange}
      trigger={showTrigger ? "click" : []}
      placement={showTrigger ? "bottomLeft" : "topLeft"}
      content={content}
      overlayClassName="dispatch-risk-popover-overlay"
      arrow
    >
      {showTrigger ? (
        <Button
          className={`dispatch-risk-trigger ${riskCount ? "has-risk" : "is-pass"}`}
          size="small"
          icon={riskCount ? <ExclamationCircleFilled /> : <CheckCircleFilled />}
          aria-label={`派单校验，${riskCount ? `${riskCount}项需复核` : "已通过"}`}
        >
          派单校验 · {riskCount ? `${riskCount}项需复核` : "已通过"}
        </Button>
      ) : <span className="dispatch-risk-passive-anchor" aria-hidden="true" />}
    </Popover>
  );
}
