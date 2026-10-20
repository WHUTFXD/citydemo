"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { App, Button, Form, Input, Modal, Select, Switch, Tag } from "antd";
import {
  BulbOutlined,
  CheckCircleFilled,
  ClockCircleOutlined,
  ExclamationCircleFilled,
  LoadingOutlined,
  MailOutlined,
  PushpinFilled,
  RedoOutlined,
  RobotOutlined,
  SearchOutlined,
  SoundOutlined,
} from "@ant-design/icons";
import PlatformShell from "./PlatformShell";
import { useAutoDispatch } from "./AutoDispatchProvider";
import { autoDispatchScenario } from "@/lib/autoDispatchScenario";
import type { AutoDispatchRuntimeItem } from "@/types/auto-dispatch";
import type { WorkOrderSummary } from "@/types/order";

function matchesFilters(order: WorkOrderSummary, keyword: string, source?: string) {
  const hitKeyword = !keyword || [order.taskId, order.linkedId, order.address, order.description].some((value) => value.includes(keyword));
  return hitKeyword && (!source || order.source === source);
}

function sourcePresentation(source: string) {
  if (source === "网格上报") return { label: "主", className: "grid" };
  if (source === "智能设备识别") return { label: "智", className: "intelligent" };
  return { label: "被", className: "" };
}

function formatWaitingTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function OrderCard({
  order,
  automation,
  currentTime,
  onOpen,
}: {
  order: WorkOrderSummary;
  automation?: AutoDispatchRuntimeItem;
  currentTime?: number;
  onOpen: () => void;
}) {
  const source = sourcePresentation(order.source);
  const scenarioItem = automation ? autoDispatchScenario.items[automation.scenarioIndex] : undefined;
  const state = automation?.state;
  const action = state === "analyzing"
    ? <Button type="primary" disabled icon={<LoadingOutlined spin />}>AI研判中</Button>
    : state === "needsManual"
      ? <Button type="primary" danger icon={<ExclamationCircleFilled />} onClick={onOpen}>人工干预</Button>
      : state === "autoDispatched"
        ? <Button onClick={onOpen}>查看详情</Button>
        : state === "manuallyResolved"
          ? <Button onClick={onOpen}>查看详情</Button>
          : <Button type="primary" onClick={onOpen}>核验派单　⌄</Button>;

  return (
    <article
      className={`order-card ${automation ? `auto-order-card is-${state}` : ""}`}
      data-auto-state={state}
      data-order-id={order.id}
    >
      <div className={`source-chip ${source.className}`}>{source.label}</div>
      <div className="order-card-head">
        <div className="order-task-line">
          <strong>任务号</strong>{order.taskId}　<BulbOutlined style={{ color: "#ff9c28", background: "#fff0cb", padding: 3 }} />
          {state === "analyzing" && <Tag className="auto-status-tag analyzing" icon={<LoadingOutlined spin />}>AI研判中</Tag>}
          {state === "autoDispatched" && <Tag className="auto-status-tag success" icon={<RobotOutlined />}>AI自动派单</Tag>}
          {state === "needsManual" && <Tag className="auto-status-tag manual" icon={<PushpinFilled />}>需人工干预</Tag>}
          {state === "manuallyResolved" && <Tag className="auto-status-tag resolved" icon={<CheckCircleFilled />}>人工已确认</Tag>}
          {state === "needsManual" && <Tag className="address-confidence-tag">标准地址置信度 {scenarioItem?.addressConfidence}%</Tag>}
          {state === "needsManual" && currentTime && <Tag className="manual-waiting-tag" icon={<ClockCircleOutlined />}>已等待 {formatWaitingTime(currentTime - (automation?.enteredAt ?? currentTime))}</Tag>}
        </div>
        <div><strong>关联单号</strong>{order.linkedId}</div>
      </div>
      <div className={`report-ribbon ${source.className}`}>{order.source}</div>
      <div className="order-card-body">
        <div className="order-field"><strong>接报时间:</strong>{order.receivedAt}</div>
        <div className="order-field"><strong>推送部门:</strong>{order.pushDepartment}</div>
        <div className="order-field"><strong>案件类别:</strong>{order.caseCategory}</div>
        <div className="order-field"><strong>业务类型:</strong>{order.businessType}</div>
        <div className="order-field"><strong>所属街道:</strong>{order.street}</div>
        <div className="order-field"><strong>发生地址:</strong>{order.address}</div>
        <div className="order-field"><strong>主责单位:</strong>{order.responsibleDepartment || "—"}</div>
        <div className="order-field"><strong>联系人:</strong>{order.contact}</div>
        <div className="order-description"><strong>问题描述:</strong>{order.description}</div>
        <div className="order-channel-icons"><SoundOutlined />　<MailOutlined /></div>
        <div className="contact-mask" />
        <div className="order-card-actions">
          <div className="service-stamp" aria-label="12345 热线标识" />
          {action}
        </div>
        {state === "analyzing" && <div className="auto-analysis-sweep" aria-hidden="true" />}
      </div>
    </article>
  );
}

export default function OrderListPage({ initialOrders }: { initialOrders: WorkOrderSummary[] }) {
  const router = useRouter();
  const { message } = App.useApp();
  const [tab, setTab] = useState<"pending" | "reported">("pending");
  const [keyword, setKeyword] = useState("");
  const [source, setSource] = useState<string>();
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [manualOnly, setManualOnly] = useState(false);
  const autoDispatch = useAutoDispatch();

  const orders = useMemo(() => initialOrders.filter((item) => {
    return matchesFilters(item, keyword, source) && (tab === "pending" ? item.status === "待核验" : item.status === "待上报核实");
  }), [initialOrders, keyword, source, tab]);

  const automatedOrders = useMemo(() => {
    if (tab !== "pending") return [];
    return [...autoDispatch.items]
      .filter((runtime) => !manualOnly || runtime.state === "needsManual")
      .filter((runtime) => matchesFilters(autoDispatchScenario.items[runtime.scenarioIndex].order, keyword, source))
      .sort((left, right) => {
        const leftPinned = left.state === "needsManual" ? 1 : 0;
        const rightPinned = right.state === "needsManual" ? 1 : 0;
        return rightPinned - leftPinned || right.scenarioIndex - left.scenarioIndex;
      });
  }, [autoDispatch.items, keyword, manualOnly, source, tab]);

  const analyzing = autoDispatch.items.some((item) => item.state === "analyzing");
  const phaseCopy = autoDispatch.phase === "idle"
    ? "未开启"
    : autoDispatch.phase === "paused"
      ? "已暂停"
      : autoDispatch.phase === "completed"
        ? autoDispatch.manuallyResolvedCount
          ? `本轮完成：自动派单 ${autoDispatch.autoDispatchedCount} 条，人工确认 ${autoDispatch.manuallyResolvedCount} 条`
          : `本轮完成：自动派单 ${autoDispatch.autoDispatchedCount} 条，待人工处理 ${autoDispatch.needsManualCount} 条`
        : analyzing ? "AI研判中" : "监听中";

  return (
    <PlatformShell>
      <div className="summary-tabs">
        <div className={`summary-tab ${tab === "pending" ? "active" : ""}`} onClick={() => setTab("pending")}>待核验<span className="count-pill">1937</span></div>
        <div className={`summary-tab ${tab === "reported" ? "active" : ""}`} onClick={() => setTab("reported")}>待上报核实<span className="count-pill">4</span></div>
        <div className={`auto-dispatch-control is-${autoDispatch.phase}`}>
          <span className="auto-control-title"><RobotOutlined /> 自动派单</span>
          <Switch size="small" checked={autoDispatch.phase === "running"} onChange={autoDispatch.toggle} aria-label="自动派单开关" />
          <span className="auto-phase-copy">{phaseCopy}</span>
          {autoDispatch.phase !== "idle" && <span className="auto-progress-copy">{autoDispatch.nextIndex}/{autoDispatch.total}</span>}
          {autoDispatch.phase === "running" && autoDispatch.nextIndex < autoDispatch.total && (
            <span className="auto-countdown">下一单 {autoDispatch.countdownSeconds}s</span>
          )}
          <Button
            size="small"
            className={`manual-queue-filter ${manualOnly ? "is-active" : ""}`}
            icon={<ExclamationCircleFilled />}
            disabled={!autoDispatch.needsManualCount && !manualOnly}
            onClick={() => { setTab("pending"); setManualOnly((value) => !value); }}
          >
            待人工干预 {autoDispatch.needsManualCount}
          </Button>
          <Button size="small" type="link" icon={<RedoOutlined />} disabled={autoDispatch.phase === "idle"} onClick={autoDispatch.replay}>重播</Button>
        </div>
      </div>
      <div className="list-toolbar">
        <Link className="open-ai-workbench-list" href="/ai-workbench" target="_blank" rel="noopener noreferrer" title="在新窗口打开预设示例工单的 AI 辅助派单页面">
          <RobotOutlined /> 打开 AI 辅助派单演示
        </Link>
        <div className="source-legend">
          <span className="legend-item"><span className="legend-box">主</span>网格员上报</span>
          <span className="legend-item"><span className="legend-box orange">被</span>公众上报</span>
          <span className="legend-item"><span className="legend-box green">智</span>智能设备识别</span>
        </div>
        <Select
          allowClear
          placeholder="来源"
          value={source}
          onChange={setSource}
          style={{ width: 112 }}
          options={[
            { value: "12345上报", label: "12345上报" },
            { value: "网格上报", label: "网格上报" },
            { value: "智能设备识别", label: "智能设备识别" },
          ]}
        />
        <Input allowClear prefix={<SearchOutlined />} placeholder="任务号、地址、描述" value={keyword} onChange={(event) => setKeyword(event.target.value)} style={{ width: 250 }} />
        <Button onClick={() => setAdvancedOpen(true)}>高级搜索</Button>
        <Button onClick={() => message.success("已生成脱敏演示导出文件")}>案件导出</Button>
      </div>

      {automatedOrders.map((runtime) => {
        const order = autoDispatchScenario.items[runtime.scenarioIndex].order;
        const manual = runtime.state === "needsManual";
        return (
          <OrderCard
            key={order.id}
            order={order}
            automation={runtime}
            currentTime={autoDispatch.now}
            onOpen={() => router.push(manual ? `/orders/${order.id}?focus=address&source=auto-dispatch` : `/orders/${order.id}`)}
          />
        );
      })}
      {!manualOnly && orders.map((order) => <OrderCard key={order.id} order={order} onOpen={() => router.push(`/orders/${order.id}`)} />)}
      {!automatedOrders.length && !orders.length && <div className="empty-state">当前条件下暂无待处理工单</div>}

      <Modal title="高级搜索" open={advancedOpen} onCancel={() => setAdvancedOpen(false)} onOk={() => { setAdvancedOpen(false); message.success("筛选条件已应用"); }} okText="查询" cancelText="取消">
        <Form layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item label="工单时间"><Input placeholder="请选择接报时间范围" /></Form.Item>
          <Form.Item label="所属街镇"><Select placeholder="请选择所属街镇" options={[{ value: "吴泾镇", label: "吴泾镇" }, { value: "莘庄镇", label: "莘庄镇" }]} /></Form.Item>
          <Form.Item label="案件类别"><Input placeholder="请输入案件类别" /></Form.Item>
        </Form>
      </Modal>
    </PlatformShell>
  );
}
