"use client";

import { useState } from "react";
import { Button, Popover } from "antd";
import {
  CheckCircleFilled,
  DownOutlined,
  EnvironmentOutlined,
  RobotOutlined,
  UpOutlined,
} from "@ant-design/icons";
import RecommendationEvidenceDetailModal, { RecommendationEvidenceIcon } from "./RecommendationEvidenceDetailModal";
import { getAIConfidenceLevel, getConfidenceCopy } from "@/lib/aiRecommendationRisk";
import type {
  AIRecommendationEvidenceDetail,
  AIRecommendationItem,
  RecommendationModuleStatus,
} from "@/types/ai-recommendation";

interface AIRecommendationPopoverProps {
  label: string;
  title: string;
  description: string;
  items: AIRecommendationItem[];
  onApply: (item: AIRecommendationItem) => void;
  onSecondary?: (item: AIRecommendationItem) => void;
  secondaryLabel?: string;
  placement?: "bottomLeft" | "bottomRight" | "rightTop" | "leftTop";
  attention?: boolean;
  defaultOpen?: boolean;
  status?: RecommendationModuleStatus;
  appliedId?: string;
  onUndo?: () => void;
}

export default function AIRecommendationPopover({
  label,
  title,
  description,
  items,
  onApply,
  onSecondary,
  secondaryLabel = "地图查看",
  placement = "bottomLeft",
  attention = false,
  defaultOpen = false,
  status = "idle",
  appliedId,
  onUndo,
}: AIRecommendationPopoverProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [expandedId, setExpandedId] = useState<string>();
  const [evidenceDetail, setEvidenceDetail] = useState<AIRecommendationEvidenceDetail>();

  const content = (
    <div className="ai-recommendation-panel">
      <div className="ai-panel-heading">
        <div className="ai-panel-icon"><RobotOutlined /></div>
        <div>
          <div className="ai-panel-title">{title}</div>
          <div className="ai-panel-description">{description}</div>
        </div>
        <div className="ai-model-actions">
          {appliedId && onUndo && <Button type="link" size="small" onClick={() => { onUndo(); setOpen(false); }}>撤销</Button>}
        </div>
      </div>

      <div className="ai-recommendation-list">
        {items.map((item, index) => {
          const expanded = expandedId === item.id;
          const applied = appliedId === item.id && status !== "stale";
          const confidenceLevel = getAIConfidenceLevel(item.confidence);
          return (
            <article key={item.id} className={`ai-recommendation-card ${index === 0 ? "is-best" : ""} ${applied ? "is-applied" : ""}`}>
              <div className="ai-card-content">
                <div className="ai-card-title-row">
                  <div>
                    <small className="ai-option-label">{index === 0 ? "首选方案" : `备选方案 ${index + 1}`}</small>
                    <strong>{item.title}</strong>
                    {item.subtitle && <span>{item.subtitle}</span>}
                  </div>
                  <small className={`dispatch-ai-confidence-copy is-${confidenceLevel}`}>{getConfidenceCopy(item.confidence)} · {item.confidence}%</small>
                </div>
                <div className="ai-reason">推荐理由：{item.reason}</div>

                {expanded && (
                  <div className="ai-evidence-panel">
                    <div className="ai-evidence-title">推荐依据</div>
                    {(item.evidence ?? []).map((line, evidenceIndex) => {
                      if (typeof line === "string") {
                        return (
                          <div className="ai-evidence-line" key={`${item.id}-${evidenceIndex}`}>
                            <CheckCircleFilled />
                            <span>{line}</span>
                          </div>
                        );
                      }
                      return (
                        <button type="button" className="ai-evidence-line ai-evidence-detail-button" key={line.id} onClick={() => setEvidenceDetail(line)}>
                          <RecommendationEvidenceIcon type={line.type} />
                          <span><strong>{line.title}</strong>{line.summary}</span>
                          <em>查看详情</em>
                        </button>
                      );
                    })}
                  </div>
                )}

                <div className="ai-card-actions">
                  <Button
                    type="link"
                    size="small"
                    icon={expanded ? <UpOutlined /> : <DownOutlined />}
                    onClick={() => setExpandedId(expanded ? undefined : item.id)}
                  >
                    {expanded ? "收起依据" : "查看依据"}
                  </Button>
                  {onSecondary && (
                    <Button
                      size="small"
                      icon={<EnvironmentOutlined />}
                      onClick={() => {
                        onSecondary(item);
                        setOpen(false);
                      }}
                    >
                      {secondaryLabel}
                    </Button>
                  )}
                  <Button
                    type={applied ? "default" : "primary"}
                    size="small"
                    icon={applied ? <CheckCircleFilled /> : undefined}
                    disabled={applied}
                    onClick={() => {
                      onApply(item);
                      setOpen(false);
                    }}
                  >
                    {applied ? "已采用" : "采用推荐"}
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="ai-panel-footer">
        <span>推荐结果仅作辅助，请结合现场情况核验后派单</span>
      </div>
    </div>
  );

  return (
    <>
      <span className="ai-trigger-wrap">
      {attention && <span className="ai-attention-dot" title="AI发现可能需要调整" />}
      <Popover
        open={open && !evidenceDetail}
        onOpenChange={setOpen}
        trigger="click"
        placement={placement}
        content={content}
        overlayClassName="ai-popover-overlay"
        arrow
      >
        <Button className={`ai-trigger-button is-${status}`} size="small" icon={<RobotOutlined />} aria-label={`${label}${status === "stale" ? "需复核" : "AI推荐"}`}>
          {status === "adopted" || status === "reviewed" ? "AI已采用" : status === "stale" ? "需复核" : status === "manuallyEdited" ? "人工调整" : "AI推荐"}
        </Button>
      </Popover>
      </span>
      <RecommendationEvidenceDetailModal detail={evidenceDetail} onClose={() => setEvidenceDetail(undefined)} />
    </>
  );
}
