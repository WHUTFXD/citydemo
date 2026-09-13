"use client";

import { useState } from "react";
import { Button, Modal, Popover, Progress, Tag } from "antd";
import {
  CheckCircleFilled,
  DownOutlined,
  EnvironmentOutlined,
  FileSearchOutlined,
  FileTextOutlined,
  RobotOutlined,
  ThunderboltFilled,
  UpOutlined,
} from "@ant-design/icons";
import type { AIRecommendationEvidenceDetail, AIRecommendationItem } from "@/types/ai-recommendation";

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
        <Tag color="processing" className="ai-model-tag">AI研判</Tag>
      </div>

      <div className="ai-recommendation-list">
        {items.map((item, index) => {
          const expanded = expandedId === item.id;
          return (
            <article key={item.id} className={`ai-recommendation-card ${index === 0 ? "is-best" : ""}`}>
              <div className="ai-rank">{index + 1}</div>
              <div className="ai-card-content">
                <div className="ai-card-title-row">
                  <div>
                    <strong>{item.title}</strong>
                    {item.subtitle && <span>{item.subtitle}</span>}
                  </div>
                  {index === 0 && <Tag color="blue">优先推荐</Tag>}
                  {item.tag && <Tag>{item.tag}</Tag>}
                </div>
                <div className="ai-confidence-row">
                  <span>置信度</span>
                  <Progress percent={item.confidence} size="small" showInfo={false} strokeColor="#2f78d3" />
                  <strong>{item.confidence}%</strong>
                </div>
                <div className="ai-reason"><ThunderboltFilled /> {item.reason}</div>

                {expanded && (
                  <div className="ai-evidence-panel">
                    <div className="ai-evidence-title">判断依据与相似案例</div>
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
                          {line.type === "work-order" ? <FileSearchOutlined /> : <FileTextOutlined />}
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
                    type="primary"
                    size="small"
                    onClick={() => {
                      onApply(item);
                      setOpen(false);
                    }}
                  >
                    采用推荐
                  </Button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <div className="ai-panel-footer">推荐结果仅作辅助，请结合现场情况核验后派单</div>
    </div>
  );

  return (
    <>
      <span className="ai-trigger-wrap">
      {attention && <span className="ai-attention-dot" title="AI发现可能需要调整" />}
      <Popover
        open={open}
        onOpenChange={setOpen}
        trigger="click"
        placement={placement}
        content={content}
        overlayClassName="ai-popover-overlay"
        arrow
      >
        <Button className="ai-trigger-button" size="small" icon={<RobotOutlined />} aria-label={`${label}AI推荐`}>
          AI推荐
        </Button>
      </Popover>
      </span>
      <Modal
        className="evidence-detail-modal"
        open={Boolean(evidenceDetail)}
        title={<span>{evidenceDetail?.type === "work-order" ? <FileSearchOutlined /> : <FileTextOutlined />} {evidenceDetail?.type === "work-order" ? "历史工单详情" : "规则文件详情"}</span>}
        width={620}
        footer={<Button type="primary" onClick={() => setEvidenceDetail(undefined)}>关闭</Button>}
        onCancel={() => setEvidenceDetail(undefined)}
      >
        {evidenceDetail && (
          <div className="evidence-detail-content">
            <div className="evidence-detail-heading">
              <div>
                <strong>{evidenceDetail.title}</strong>
                <span>{evidenceDetail.summary}</span>
              </div>
              <Tag color={evidenceDetail.type === "work-order" ? "blue" : "gold"}>{evidenceDetail.type === "work-order" ? "历史工单" : "规则文件"}</Tag>
            </div>
            <div className="evidence-detail-source">数据来源：{evidenceDetail.source}</div>
            <div className="evidence-detail-metadata">
              {evidenceDetail.metadata.map((value) => <span key={value}>{value}</span>)}
            </div>
            <div className="evidence-detail-body">
              <strong>{evidenceDetail.type === "work-order" ? "案件与处置摘要" : "规则内容"}</strong>
              <p>{evidenceDetail.content}</p>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
