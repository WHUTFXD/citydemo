"use client";

import { useState } from "react";
import { Button, Modal } from "antd";
import { ArrowRightOutlined, EnvironmentOutlined, FileSearchOutlined, RobotOutlined } from "@ant-design/icons";
import Link from "next/link";
import orders from "@/data/work-orders.json";
import recommendationsData from "@/data/ai-recommendations.json";
import AmapRecommendationMap from "./AmapRecommendationMap";
import InlineAddressMap from "./InlineAddressMap";
import RecommendationEvidenceDetailModal, { RecommendationEvidenceIcon } from "./RecommendationEvidenceDetailModal";
import { getConfidenceCopy } from "@/lib/aiRecommendationRisk";
import type { AIRecommendationEvidenceDetail, AIRecommendationItem, AIRecommendationSet, MapAddressRecommendation, RecommendationModule } from "@/types/ai-recommendation";
import type { WorkOrderDetail } from "@/types/order";

const order = (orders as WorkOrderDetail[]).find((item) => item.id === "mh-006")!;
const recommendations = (recommendationsData as AIRecommendationSet[]).find((item) => item.orderId === "mh-006")!;
const modules: { key: RecommendationModule; label: string; hint: string; items: AIRecommendationItem[] }[] = [
  { key: "caseType", label: "案件类型", hint: "事项分类", items: recommendations.caseTypes },
  { key: "address", label: "标准地址", hint: "位置标准化", items: recommendations.addresses },
  { key: "responsibility", label: "权责网格", hint: "属地和网格", items: recommendations.responsibilities },
  { key: "time", label: "办理时限", hint: "到场和处理", items: recommendations.times },
  { key: "primary", label: "主责单位", hint: "牵头部门", items: recommendations.departments },
  { key: "assist", label: "协办单位", hint: "可无需协办", items: recommendations.assistingDepartments },
  { key: "opinion", label: "派遣意见", hint: "完整回填内容", items: recommendations.dispatchOpinions },
];

function answerFor(module: RecommendationModule, item: AIRecommendationItem) {
  if (module === "time" && "arrival" in item && "processing" in item) {
    const a = item.arrival as number[];
    const p = item.processing as number[];
    return `到场 ${a[0]} 天 ${a[1]} 时 ${a[2]} 分 / 处理 ${p[0]} 天 ${p[1]} 时 ${p[2]} 分`;
  }
  if (module === "primary" || module === "assist") {
    return "department" in item && item.department ? String(item.department) : "无需协办单位";
  }
  if (module === "responsibility" && "grid" in item) {
    return `${String("town" in item ? item.town : "")} · ${String("gridType" in item ? item.gridType : "")} · ${String(item.grid)}`;
  }
  return item.title;
}

function secondaryFor(module: RecommendationModule, item: AIRecommendationItem) {
  if (module === "opinion" && "value" in item) return String(item.value);
  if (module === "responsibility" && "responsibilityBlock" in item) {
    return `责任块：${String(item.responsibilityBlock)}；处置网格：${String("disposalGrid" in item ? item.disposalGrid : "")}`;
  }
  if (module === "address" && "position" in item) {
    const [lng, lat] = item.position as number[];
    return `经度 ${lng.toFixed(6)}，纬度 ${lat.toFixed(6)}`;
  }
  return item.subtitle ?? "";
}

export default function AIWorkbench({ mapConfig }: { mapConfig: { key: string; securityCode: string } }) {
  const [module, setModule] = useState<RecommendationModule>("caseType");
  const [selectedIds, setSelectedIds] = useState<Partial<Record<RecommendationModule, string>>>({});
  const [actionStatus, setActionStatus] = useState("");
  const [evidenceItem, setEvidenceItem] = useState<AIRecommendationItem>();
  const [evidence, setEvidence] = useState<AIRecommendationEvidenceDetail>();
  const [mapOpen, setMapOpen] = useState(false);
  const [mapSelectedId, setMapSelectedId] = useState(recommendations.addresses[0].id);
  const current = modules.find((entry) => entry.key === module)!;
  const selectedCount = modules.filter((entry) => selectedIds[entry.key]).length;
  const selectedAddress = recommendations.addresses.find((item) => item.id === selectedIds.address) ?? recommendations.addresses[0];

  const fillOne = (key: RecommendationModule, item: AIRecommendationItem) => {
    setSelectedIds((previous) => ({ ...previous, [key]: item.id }));
    setActionStatus(`已选用${modules.find((entry) => entry.key === key)?.label}结果；左侧系统回填暂未接入。`);
  };

  const fillAll = () => {
    setSelectedIds((previous) => Object.fromEntries(modules.map((entry) => [
      entry.key,
      previous[entry.key] ?? entry.items[0].id,
    ])) as Record<RecommendationModule, string>);
    setActionStatus("七项结果已一键选用；左侧系统回填暂未接入。");
  };

  return <div className="ai-workbench">
    <header className="workbench-header">
      <div className="workbench-brand"><span className="workbench-brand-icon"><RobotOutlined /></span><div><strong>AI 辅助派单</strong><small>当前工单的独立辅助视图</small></div></div>
      <div className="workbench-header-right"><span className="workbench-live-dot" />本地预设结果 <span className="workbench-header-divider" />任务编号 {order.taskId}<Link href={`/orders/${order.id}`} className="workbench-return">返回原系统</Link></div>
    </header>
    <main className="workbench-single">
      <section className="workbench-context" aria-label="当前工单">
        <div className="workbench-context-name"><span>当前工单</span><strong>{order.taskId}</strong><em>{order.source}</em></div>
        <p>{order.description}</p>
        <div className="workbench-context-address">发生地址：{order.address}</div>
      </section>

      <section className="workbench-overview" aria-labelledby="overview-title">
        <div className="workbench-section-head"><div><h1 id="overview-title"><span className="workbench-step">01</span> AI 推荐总览</h1><p>先核对七项答案；点击任意模块可查看候选、依据并单独调整。</p></div><div className="workbench-overview-actions"><span>已选用 {selectedCount}/7</span><Button type="primary" onClick={fillAll} disabled={selectedCount === modules.length}>{selectedCount === modules.length ? "已全部选用" : "一键填入 7 项"}</Button></div></div>
        <div className="workbench-overview-grid">
          {modules.map((entry) => {
            const choice = entry.items.find((item) => item.id === selectedIds[entry.key]) ?? entry.items[0];
            if (entry.key === "address") return <div key={entry.key} className={`workbench-overview-map-card ${module === "address" ? "active" : ""}`} role="button" tabIndex={0} aria-label="查看标准地址候选" onClick={() => setModule("address")} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setModule("address"); } }}>
              <div className="workbench-map-head"><div><b>标准地址</b><small>地图定位</small></div><em>{selectedAddress.confidence}%</em></div>
              <InlineAddressMap addresses={recommendations.addresses} selectedId={selectedAddress.id} mapConfig={mapConfig} />
              <div className="workbench-map-foot"><span>{selectedAddress.title}</span></div>
            </div>;
            return <button key={entry.key} className={`workbench-overview-item ${module === entry.key ? "active" : ""}`} onClick={() => setModule(entry.key)} aria-label={`查看${entry.label}候选`}>
              <span className="workbench-overview-top"><b>{entry.label}</b><em className={choice.confidence < 70 ? "low" : choice.confidence < 85 ? "medium" : ""}>{choice.confidence}%</em></span>
              <strong>{answerFor(entry.key, choice)}</strong>
              {entry.key === "opinion" && <small>{secondaryFor(entry.key, choice)}</small>}
            </button>;
          })}
        </div>
        <div className="workbench-action-status" role="status">{actionStatus || "演示说明：选择结果仅在本页记录，暂不改动左侧业务系统。"}</div>
      </section>

      <section className="workbench-detail" aria-labelledby="detail-title">
        <div className="workbench-detail-body">
          <div className="workbench-detail-head"><div><span><span className="workbench-step">02</span> 单项调整 · {current.hint}</span><h2 id="detail-title">{current.label} · 三个候选</h2></div>{module === "address" && <Button icon={<EnvironmentOutlined />} onClick={() => setMapOpen(true)}>地图选点</Button>}</div>
          <div className="workbench-candidate-grid">
            {current.items.slice(0, 3).map((item, index) => <article className={`workbench-candidate ${index === 0 ? "preferred" : ""}`} key={item.id}>
              <div className="workbench-candidate-top"><span>{index === 0 ? "首选" : `备选 ${index + 1}`}</span><em className={item.confidence < 70 ? "low" : item.confidence < 85 ? "medium" : ""}>{getConfidenceCopy(item.confidence)} · {item.confidence}%</em></div>
              <h3>{answerFor(module, item)}</h3>
              {secondaryFor(module, item) && <div className={module === "opinion" ? "workbench-candidate-opinion" : "workbench-candidate-secondary"}>{module === "opinion" && <b>将填入：</b>}{secondaryFor(module, item)}</div>}
              <p><b>推荐理由：</b>{item.reason}</p>
              <div className="workbench-candidate-actions"><button type="button" onClick={() => setEvidenceItem(item)}><FileSearchOutlined /> 查看依据</button><Button type="primary" className="workbench-fill" onClick={() => fillOne(module, item)}>填入此项 <ArrowRightOutlined /></Button></div>
            </article>)}
          </div>
        </div>
      </section>
    </main>
    <Modal title="推荐依据" open={Boolean(evidenceItem)} onCancel={() => setEvidenceItem(undefined)} footer={null} width={620} className="workbench-evidence-modal">
      <p className="workbench-evidence-intro">{evidenceItem?.title} · 可逐条查看参考内容。</p>
      <div className="workbench-evidence-list">{evidenceItem?.evidence?.map((entry, index) => typeof entry === "string" ? <p key={index}>{entry}</p> : <button key={entry.id} onClick={() => { setEvidence(entry); setEvidenceItem(undefined); }}><RecommendationEvidenceIcon type={entry.type} /><span><strong>{entry.title}</strong><small>{entry.summary}</small></span><em>查看详情</em></button>)}</div>
    </Modal>
    <AmapRecommendationMap open={mapOpen} mapConfig={mapConfig} addresses={recommendations.addresses as MapAddressRecommendation[]} selectedId={mapSelectedId} onSelect={setMapSelectedId} onApply={() => setMapOpen(false)} onClose={() => setMapOpen(false)} />
    <RecommendationEvidenceDetailModal detail={evidence} onClose={() => setEvidence(undefined)} />
  </div>;
}
