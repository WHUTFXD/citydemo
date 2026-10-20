"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  App,
  Button,
  Checkbox,
  Dropdown,
  Input,
  InputNumber,
  Radio,
  Select,
  Upload,
} from "antd";
import {
  CalendarOutlined,
  CaretDownOutlined,
  CaretUpOutlined,
  EnvironmentOutlined,
  ExclamationCircleFilled,
  LockOutlined,
  PaperClipOutlined,
  PhoneOutlined,
  RobotOutlined,
} from "@ant-design/icons";
import AIRecommendationPopover from "./AIRecommendationPopover";
import AmapRecommendationMap from "./AmapRecommendationMap";
import DispatchAIRecommendationPopover from "./DispatchAIRecommendationPopover";
import DispatchRiskPopover from "./DispatchRiskPopover";
import { useAutoDispatch } from "./AutoDispatchProvider";
import PlatformShell from "./PlatformShell";
import { getAIConfidenceLevel, recommendationModuleLabels } from "@/lib/aiRecommendationRisk";
import type {
  AIRecommendationItem,
  AIRecommendationSet,
  MapAddressRecommendation,
  RecommendationModule,
  RecommendationModuleRuntime,
  RecommendationOperationAction,
  RecommendationOperationRecord,
  RecommendationValidationItem,
} from "@/types/ai-recommendation";
import type { WorkOrderDetail } from "@/types/order";

const townOptions = ["吴泾镇", "莘庄镇", "浦江镇", "颛桥镇", "梅陇镇", "江川路街道", "区级部门"].map((value) => ({ value, label: value }));
const departmentOptions = [
  "江川路街道城运中心",
  "闵行区交通委员会",
  "闵行区城市管理行政执法局",
  "城市建设管理事务中心",
  "综合行政执法队",
  "社区事务受理服务中心",
].map((value) => ({ value, label: value }));
const gridOptions = ["剑川路网格", "紫竹网格", "永南网格", "塘湾网格"].map((value) => ({ value, label: value }));

type RecommendationSnapshot =
  | { module: "caseType"; caseType: string }
  | { module: "address"; standardAddress: string; selectedMapAddressId: string; addressConfirmed: boolean }
  | { module: "responsibility"; town: string; grid: string; responsible: string }
  | { module: "time"; arrivalTime: [number, number, number]; processingTime: [number, number, number] }
  | { module: "primary"; town: string; responsible: string; assistTown?: string; assistDepartment?: string; dispatchOpinion: string }
  | { module: "assist"; assistTown?: string; assistDepartment?: string; dispatchOpinion: string }
  | { module: "opinion"; dispatchOpinion: string };

const moduleAnchors: Record<RecommendationModule, string> = {
  caseType: "field-case-type",
  address: "field-standard-address",
  responsibility: "field-responsibility",
  time: "field-dispatch-time",
  primary: "field-primary",
  assist: "field-assist",
  opinion: "field-opinion",
};

function initialModuleStates(autoDispatchIntervention: boolean): Record<RecommendationModule, RecommendationModuleRuntime> {
  return {
    caseType: { status: "idle" },
    address: { status: autoDispatchIntervention ? "stale" : "idle" },
    responsibility: { status: "idle" },
    time: { status: "idle" },
    primary: { status: "idle" },
    assist: { status: "idle" },
    opinion: { status: "idle" },
  };
}

function DetailSection({ title, children, action, defaultOpen = true }: { title: string; children: React.ReactNode; action?: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="detail-section dispatch-section">
      <div className="section-title-row">
        <button type="button" className="section-title" onClick={() => setOpen(!open)} aria-expanded={open}>
          <span className="section-title-left">{title === "基本信息" && <LockOutlined className="basic-lock" />}{title}</span>
        </button>
        {action && <div className="section-title-action">{action}</div>}
        <button type="button" className="section-collapse-button" onClick={() => setOpen(!open)} aria-label={`${open ? "收起" : "展开"}${title}`}>
          {open ? <CaretUpOutlined className="collapse-icon" /> : <CaretDownOutlined className="collapse-icon" />}
        </button>
      </div>
      {open && <div className="section-body dispatch-section-body">{children}</div>}
    </section>
  );
}

function RequiredLabel({ children }: { children: React.ReactNode }) {
  return <span className="form-label"><span className="required-star">*</span>{children}</span>;
}

export default function OrderDetailPage({
  order,
  recommendations,
  mapConfig,
  autoDispatchIntervention = false,
  initialAddressRecommendationOpen = false,
}: {
  order: WorkOrderDetail;
  recommendations: AIRecommendationSet;
  mapConfig: { key: string; securityCode: string };
  autoDispatchIntervention?: boolean;
  initialAddressRecommendationOpen?: boolean;
}) {
  const router = useRouter();
  const { message } = App.useApp();
  const { resolveManual } = useAutoDispatch();
  const {
    caseTypes: caseTypeRecommendations,
    addresses: addressRecommendations,
    responsibilities: responsibilityRecommendations,
    times: timeRecommendations,
    departments: departmentRecommendations,
    assistingDepartments: assistingDepartmentRecommendations,
    dispatchOpinions: dispatchOpinionRecommendations,
  } = recommendations;
  const [caseType, setCaseType] = useState(order.eventCategory);
  const [urgency, setUrgency] = useState(order.urgency);
  const [address, setAddress] = useState(order.address);
  const [standardAddress, setStandardAddress] = useState(order.standardAddress);
  const [town, setTown] = useState(order.street);
  const [grid, setGrid] = useState("剑川路网格");
  const [responsible, setResponsible] = useState(order.responsibleDepartment);
  const [assistTown, setAssistTown] = useState<string>();
  const [assistDepartment, setAssistDepartment] = useState<string>();
  const [dispatchOpinion, setDispatchOpinion] = useState(autoDispatchIntervention ? order.quickReplies[0] ?? "" : "");
  const [arrivalTime, setArrivalTime] = useState<[number, number, number]>([0, 2, 0]);
  const [processingTime, setProcessingTime] = useState<[number, number, number]>([1, 0, 0]);
  const [uploadedNames, setUploadedNames] = useState<string[]>([]);
  const [mapOpen, setMapOpen] = useState(false);
  const [selectedMapAddressId, setSelectedMapAddressId] = useState(addressRecommendations[0].id);
  const [addressConfirmed, setAddressConfirmed] = useState(!autoDispatchIntervention);
  const [moduleStates, setModuleStates] = useState<Record<RecommendationModule, RecommendationModuleRuntime>>(
    () => initialModuleStates(autoDispatchIntervention),
  );
  const [operationRecords, setOperationRecords] = useState<RecommendationOperationRecord[]>([]);
  const [riskOpen, setRiskOpen] = useState(false);
  const recommendationSnapshots = useRef<Partial<Record<RecommendationModule, RecommendationSnapshot>>>({});
  const lastRecordedAddress = useRef(address);
  const lastRecordedOpinion = useRef(dispatchOpinion);

  const eligibleAssistingRecommendations = [
    ...assistingDepartmentRecommendations.filter((item) => item.department && item.department !== responsible).slice(0, 2),
    ...assistingDepartmentRecommendations.filter((item) => !item.department),
  ].slice(0, 3);

  const appendOperation = (
    module: RecommendationModule,
    action: RecommendationOperationAction,
    previousValue: string,
    nextValue: string,
    item?: AIRecommendationItem,
  ) => {
    const now = new Date();
    setOperationRecords((current) => [...current, {
      id: `${now.getTime()}-${module}-${current.length}`,
      module,
      action,
      candidateId: item?.id,
      confidence: item?.confidence,
      previousValue,
      nextValue,
      operator: "李倩荣",
      at: now.toLocaleTimeString("zh-CN", { hour12: false }),
    }]);
  };

  const invalidateModules = (modules: RecommendationModule[], cause: string) => {
    const targets = modules.filter((module) => !(module === "assist" && !assistDepartment && !moduleStates.assist.appliedId));
    if (!targets.length) return;
    setModuleStates((current) => {
      const next = { ...current };
      targets.forEach((module) => {
        next[module] = { ...current[module], status: "stale" };
      });
      return next;
    });
    targets.forEach((module) => appendOperation(module, "invalidate", recommendationModuleLabels[module], cause));
  };

  const adoptRecommendation = (
    module: RecommendationModule,
    item: AIRecommendationItem,
    snapshot: RecommendationSnapshot,
    previousValue: string,
    nextValue: string,
    invalidates: RecommendationModule[] = [],
  ) => {
    if (!recommendationSnapshots.current[module]) recommendationSnapshots.current[module] = snapshot;
    setModuleStates((current) => ({
      ...current,
      [module]: {
        status: "adopted",
        appliedId: item.id,
        confidence: item.confidence,
        confidenceLevel: getAIConfidenceLevel(item.confidence),
      },
    }));
    appendOperation(module, "adopt", previousValue, nextValue, item);
    invalidateModules(invalidates, `${recommendationModuleLabels[module]}已变化，需重新研判`);
  };

  const markManualChange = (
    module: RecommendationModule,
    previousValue: string,
    nextValue: string,
    invalidates: RecommendationModule[] = [],
  ) => {
    setModuleStates((current) => ({
      ...current,
      [module]: { ...current[module], status: "manuallyEdited", confidence: undefined, confidenceLevel: undefined },
    }));
    appendOperation(module, "manualEdit", previousValue, nextValue);
    invalidateModules(invalidates, `${recommendationModuleLabels[module]}已人工调整，需重新研判`);
  };

  const getCurrentModuleValue = (module: RecommendationModule) => {
    if (module === "caseType") return caseType;
    if (module === "address") return standardAddress;
    if (module === "responsibility") return `${town} / ${grid} / ${responsible}`;
    if (module === "time") return `到场${arrivalTime.join("-")} / 处理${processingTime.join("-")}`;
    if (module === "primary") return `${town} / ${responsible}`;
    if (module === "assist") return assistDepartment ? `${assistTown ?? ""} / ${assistDepartment}` : "无需协办";
    return dispatchOpinion;
  };

  const undoModule = (module: RecommendationModule) => {
    const snapshot = recommendationSnapshots.current[module];
    if (!snapshot) return;
    const previousValue = getCurrentModuleValue(module);
    if (snapshot.module === "caseType") setCaseType(snapshot.caseType);
    if (snapshot.module === "address") {
      setStandardAddress(snapshot.standardAddress);
      setSelectedMapAddressId(snapshot.selectedMapAddressId);
      setAddressConfirmed(snapshot.addressConfirmed);
    }
    if (snapshot.module === "responsibility") {
      setTown(snapshot.town);
      setGrid(snapshot.grid);
      setResponsible(snapshot.responsible);
    }
    if (snapshot.module === "time") {
      setArrivalTime(snapshot.arrivalTime);
      setProcessingTime(snapshot.processingTime);
    }
    if (snapshot.module === "primary") {
      setTown(snapshot.town);
      setResponsible(snapshot.responsible);
      setAssistTown(snapshot.assistTown);
      setAssistDepartment(snapshot.assistDepartment);
      setDispatchOpinion(snapshot.dispatchOpinion);
    }
    if (snapshot.module === "assist") {
      setAssistTown(snapshot.assistTown);
      setAssistDepartment(snapshot.assistDepartment);
      setDispatchOpinion(snapshot.dispatchOpinion);
    }
    if (snapshot.module === "opinion") setDispatchOpinion(snapshot.dispatchOpinion);

    setModuleStates((current) => ({ ...current, [module]: { status: "idle" } }));
    delete recommendationSnapshots.current[module];
    appendOperation(module, "undo", previousValue, "已恢复采用前内容");
    const downstream: Partial<Record<RecommendationModule, RecommendationModule[]>> = {
      caseType: ["responsibility", "primary", "assist", "opinion"],
      address: ["responsibility", "primary", "assist", "opinion"],
      responsibility: ["primary", "assist", "opinion"],
      primary: ["assist", "opinion"],
      assist: ["opinion"],
    };
    invalidateModules(downstream[module] ?? [], `${recommendationModuleLabels[module]}已撤销，需重新研判`);
    message.success(`已撤销${recommendationModuleLabels[module]}的AI采用结果`);
  };

  const validationItems = useMemo<RecommendationValidationItem[]>(() => {
    const evaluate = (module: RecommendationModule, filled: boolean, emptyMessage: string): RecommendationValidationItem => {
      const runtime = moduleStates[module];
      if (!filled) return { module, label: recommendationModuleLabels[module], severity: "blocking", message: emptyMessage, anchorId: moduleAnchors[module] };
      if (runtime.status === "stale") return { module, label: recommendationModuleLabels[module], severity: "blocking", message: "上游信息已变化，请重新推荐或人工确认", anchorId: moduleAnchors[module] };
      if (runtime.status === "adopted" && runtime.confidence !== undefined) {
        const level = getAIConfidenceLevel(runtime.confidence);
        if (level === "manualRequired") return { module, label: recommendationModuleLabels[module], severity: "blocking", message: "置信度不足，必须完成人工核验", anchorId: moduleAnchors[module], confidence: runtime.confidence, reviewable: true };
        if (level === "review") return { module, label: recommendationModuleLabels[module], severity: "review", message: "已采用中等置信度结果，请确认复核", anchorId: moduleAnchors[module], confidence: runtime.confidence, reviewable: true };
        return { module, label: recommendationModuleLabels[module], severity: "pass", message: "高置信度AI推荐已采用", anchorId: moduleAnchors[module], confidence: runtime.confidence };
      }
      if (runtime.status === "reviewed") return { module, label: recommendationModuleLabels[module], severity: "pass", message: "已完成人工复核", anchorId: moduleAnchors[module], confidence: runtime.confidence };
      if (runtime.status === "manuallyEdited") return { module, label: recommendationModuleLabels[module], severity: "pass", message: "已由人工调整确认", anchorId: moduleAnchors[module] };
      return { module, label: recommendationModuleLabels[module], severity: "pass", message: "当前工单值完整", anchorId: moduleAnchors[module] };
    };

    const items = [
      evaluate("caseType", Boolean(caseType), "请选择案件类型"),
      evaluate("address", Boolean(standardAddress) && (!autoDispatchIntervention || addressConfirmed), autoDispatchIntervention ? "请人工确认标准地址" : "请完善标准地址"),
      evaluate("responsibility", Boolean(town && grid), "请完善权责网格"),
      evaluate("time", arrivalTime.some(Boolean) && processingTime.some(Boolean), "请设置有效的到场和处理时限"),
      evaluate("primary", Boolean(responsible), "请选择主责单位"),
      !assistDepartment && !moduleStates.assist.appliedId
        ? { module: "assist" as const, label: recommendationModuleLabels.assist, severity: "pass" as const, message: "未设置协办单位，符合可选规则", anchorId: moduleAnchors.assist }
        : evaluate("assist", assistDepartment !== responsible, "协办单位不能与主责单位相同"),
      evaluate("opinion", Boolean(dispatchOpinion.trim()), "请填写派遣意见"),
    ];
    if (assistDepartment && assistDepartment === responsible) {
      items[5] = { module: "assist", label: recommendationModuleLabels.assist, severity: "blocking", message: "协办单位不能与主责单位相同", anchorId: moduleAnchors.assist };
    }
    return items;
  }, [addressConfirmed, arrivalTime, assistDepartment, autoDispatchIntervention, caseType, dispatchOpinion, grid, moduleStates, processingTime, responsible, standardAddress, town]);

  const focusModule = (module: RecommendationModule, closePopover = true) => {
    if (closePopover) setRiskOpen(false);
    window.setTimeout(() => {
      const anchor = document.getElementById(moduleAnchors[module]);
      anchor?.scrollIntoView({ behavior: "smooth", block: "center" });
      const control = anchor?.querySelector<HTMLElement>("button, input, textarea, [role='combobox']");
      control?.focus({ preventScroll: true });
    }, 30);
  };

  const reviewModule = (module: RecommendationModule) => {
    setModuleStates((current) => ({ ...current, [module]: { ...current[module], status: "reviewed" } }));
    appendOperation(module, "review", getCurrentModuleValue(module), "已确认人工复核");
    message.success(`${recommendationModuleLabels[module]}已完成人工复核`);
  };

  const changeResponsibleDepartment = (value: string) => {
    const previous = responsible;
    setResponsible(value);
    markManualChange("primary", previous, value, ["assist", "opinion"]);
    if (assistDepartment === value) message.warning("协办单位不能与主责单位相同，请重新选择协办单位");
  };

  const confirmDispatch = () => {
    const firstRisk = validationItems.find((item) => item.severity !== "pass");
    if (firstRisk) {
      setRiskOpen(true);
      focusModule(firstRisk.module, false);
      message.warning(`派单校验发现问题：${firstRisk.message}`);
      return;
    }
    if (autoDispatchIntervention) {
      resolveManual(order.id);
      message.success("地址已人工确认，工单完成派单");
      router.push("/");
      return;
    }
    message.success("工单已通过校验并完成派单（演示）");
  };

  const applyAddress = (item: MapAddressRecommendation) => {
    const manualPoint = item.id.startsWith("manual-");
    const snapshot: RecommendationSnapshot = { module: "address", standardAddress, selectedMapAddressId, addressConfirmed };
    setStandardAddress(item.title);
    setSelectedMapAddressId(item.id);
    setAddressConfirmed(true);
    setMapOpen(false);
    if (manualPoint) {
      markManualChange("address", standardAddress, item.title, ["responsibility", "primary", "assist", "opinion"]);
    } else {
      adoptRecommendation("address", item, snapshot, standardAddress, item.title, ["responsibility", "primary", "assist", "opinion"]);
    }
    message.success(manualPoint ? "已采用人工新增点位" : "已采用AI推荐标准地址");
  };

  const quickReplies = [
    "请单位尽快核实处理，并及时反馈办理情况。",
    "请单位针对市民诉求尽快核实处理，并及时将办理情况答复告知市民，同时请做好地址定位及网格选定工作。",
  ];

  return (
    <PlatformShell detail>
      <div className="detail-wrap true-detail-page">
        <div className="detail-tabs">
          <span className="active">核验派单</span>
          <button type="button" onClick={() => setMapOpen(true)}>GIS地图</button>
          <a className="open-ai-workbench" href="/ai-workbench" target="_blank" rel="noopener noreferrer" title="在新窗口打开预设示例工单的 AI 辅助派单页面"><RobotOutlined /> 打开 AI 辅助派单演示</a>
        </div>

        {autoDispatchIntervention && (
          <div className="manual-intervention-notice" role="status">
            <ExclamationCircleFilled />
            <strong>自动派单已暂停此工单</strong>
            <span>标准地址最高置信度仅 {addressRecommendations[0].confidence}%，请人工确认候选地址；其他工单仍在自动流转。</span>
          </div>
        )}

        <DetailSection title="基本信息">
          <div className="dispatch-meta-grid">
            <div className="meta-stack">
              <div><span className="detail-label">任务编号：</span><strong>{order.taskId}</strong></div>
              <div><span className="detail-label">关联编号：</span><strong>{order.linkedId}</strong></div>
            </div>
            <div className="meta-stack">
              <div><span className="detail-label">事件来源：</span><strong>{order.source}</strong></div>
              <div><span className="detail-label">业务类型：</span><strong>{order.businessType}</strong></div>
            </div>
            <div className="meta-stack">
              <div><span className="detail-label">投诉人：</span><strong>{order.complainant}</strong></div>
              <div><span className="detail-label">市级分类：</span><strong>{order.caseCategory}</strong></div>
            </div>
            <div className="meta-stack phone-meta">
              <div><span className="detail-label">联系电话：</span><strong>{order.phone}</strong> <Button size="small" icon={<PhoneOutlined />} onClick={() => message.info("已模拟发起外拨")} /></div>
            </div>
            <div className="received-meta">
              <div><span className="detail-label">接报时间：</span><strong>{order.receivedAt}</strong></div>
              <div className="detail-service-stamp" aria-label="12345 热线标识" />
            </div>
          </div>

          <div className="detail-form-stack">
            <div className="wide-field">
              <span className="form-label">问题描述：</span>
              <Input.TextArea value={order.description} readOnly autoSize={{ minRows: 2, maxRows: 2 }} />
            </div>

            <div className="field-line ai-field-line" id={moduleAnchors.caseType}>
              <div className="ai-label-control">
                <RequiredLabel>案件类型：</RequiredLabel>
                <AIRecommendationPopover
                  attention
                  label="案件类型"
                  title="案件类型推荐"
                  description="根据问题描述匹配三级分类，按可信度排序。"
                  items={caseTypeRecommendations}
                  status={moduleStates.caseType.status}
                  appliedId={moduleStates.caseType.appliedId}
                  onUndo={() => undoModule("caseType")}
                  onApply={(item) => {
                    const recommendation = caseTypeRecommendations.find((candidate) => candidate.id === item.id);
                    if (!recommendation) return;
                    const snapshot: RecommendationSnapshot = { module: "caseType", caseType };
                    setCaseType(recommendation.value);
                    adoptRecommendation("caseType", recommendation, snapshot, caseType, recommendation.value, ["responsibility", "primary", "assist", "opinion"]);
                    message.success("已采用AI推荐案件类型");
                  }}
                />
              </div>
              <Select
                value={caseType}
                onChange={(value) => {
                  const previous = caseType;
                  setCaseType(value);
                  markManualChange("caseType", previous, value, ["responsibility", "primary", "assist", "opinion"]);
                }}
                options={caseTypeRecommendations.map((item) => ({ value: item.value, label: item.title }))}
              />
            </div>

            <div className="field-line urgency-line">
              <span className="form-label">紧急程度：</span>
              <Radio.Group value={urgency} onChange={(event) => setUrgency(event.target.value)}>
                <Radio value="次紧急">次紧急</Radio>
                <Radio value="一般">一般</Radio>
                <Radio value="紧急">紧急</Radio>
              </Radio.Group>
            </div>

            <div className="wide-field">
              <RequiredLabel>发生地址：</RequiredLabel>
              <Input
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                onBlur={() => {
                  if (address === lastRecordedAddress.current) return;
                  const previous = lastRecordedAddress.current;
                  lastRecordedAddress.current = address;
                  appendOperation("address", "manualEdit", previous, address);
                  invalidateModules(["address", "responsibility", "primary", "assist", "opinion"], "发生地址已修改，需重新研判");
                }}
                maxLength={50}
                suffix={`${address.length}/50`}
              />
            </div>

            <div className="address-field ai-address-field" id={moduleAnchors.address}>
              <div className="ai-label-control">
                <RequiredLabel>标准地址：</RequiredLabel>
                <AIRecommendationPopover
                  label="标准地址"
                  title="标准地址推荐"
                  description="融合文本地址、POI与历史定位结果，推荐3个候选点。"
                  items={addressRecommendations}
                  defaultOpen={initialAddressRecommendationOpen}
                  status={moduleStates.address.status}
                  appliedId={moduleStates.address.appliedId}
                  onUndo={() => undoModule("address")}
                  onApply={(item) => {
                    const addressItem = addressRecommendations.find((candidate) => candidate.id === item.id);
                    if (addressItem) applyAddress(addressItem);
                  }}
                  onSecondary={(item) => {
                    setSelectedMapAddressId(item.id);
                    setMapOpen(true);
                  }}
                />
              </div>
              <div className="address-primary">
                <Input value={standardAddress} readOnly />
                <Button icon={<EnvironmentOutlined />} onClick={() => setMapOpen(true)}>地图定位</Button>
              </div>
              <div className="address-segments">
                <Input defaultValue="闵行区" maxLength={20} suffix="0/20" />
                <Select value={town} onChange={(value) => { const previous = town; setTown(value); markManualChange("responsibility", previous, value, ["primary", "assist", "opinion"]); }} options={townOptions} />
                <Input defaultValue="剑川路" maxLength={20} suffix="0/20" />
                <Select value={grid} onChange={(value) => { const previous = grid; setGrid(value); markManualChange("responsibility", previous, value, ["primary", "assist", "opinion"]); }} options={gridOptions} />
                <Input defaultValue="沿线公共区域" maxLength={20} suffix="0/20" />
                <Select defaultValue="道路" options={[{ value: "道路", label: "道路" }, { value: "小区", label: "小区" }, { value: "园区", label: "园区" }]} />
              </div>
            </div>

            <div className="responsibility-field" id={moduleAnchors.responsibility}>
              <div className="responsibility-heading">
                <RequiredLabel>所属街镇/网格类型/自治网格/责任块/处置网格：</RequiredLabel>
                <AIRecommendationPopover
                  label="权责网格"
                  title="权责部门与网格推荐"
                  description="基于标准地址、事项分类和历史派单链路综合研判。"
                  items={responsibilityRecommendations}
                  status={moduleStates.responsibility.status}
                  appliedId={moduleStates.responsibility.appliedId}
                  onUndo={() => undoModule("responsibility")}
                  onApply={(item) => {
                    const recommendation = responsibilityRecommendations.find((candidate) => candidate.id === item.id);
                    if (!recommendation) return;
                    const snapshot: RecommendationSnapshot = { module: "responsibility", town, grid, responsible };
                    setTown(recommendation.town);
                    setGrid(recommendation.grid);
                    setResponsible(recommendation.department);
                    adoptRecommendation("responsibility", recommendation, snapshot, `${town} / ${grid} / ${responsible}`, `${recommendation.town} / ${recommendation.grid} / ${recommendation.department}`, ["primary", "assist", "opinion"]);
                    message.success("已采用AI推荐权责网格");
                  }}
                />
              </div>
              <div className="responsibility-selects">
                <Select value={town} onChange={(value) => { const previous = town; setTown(value); markManualChange("responsibility", previous, value, ["primary", "assist", "opinion"]); }} options={townOptions} />
                <Select defaultValue="综合网格" options={[{ value: "综合网格", label: "综合网格" }, { value: "专业网格", label: "专业网格" }]} />
                <Select value={grid} onChange={(value) => { const previous = grid; setGrid(value); markManualChange("responsibility", previous, value, ["primary", "assist", "opinion"]); }} options={gridOptions} />
                <Select defaultValue="剑川路责任块" options={[{ value: "剑川路责任块", label: "剑川路责任块" }, { value: "紫竹责任块", label: "紫竹责任块" }]} />
                <Select defaultValue="吴泾处置网格" options={[{ value: "吴泾处置网格", label: "吴泾处置网格" }, { value: "区域处置网格", label: "区域处置网格" }]} />
              </div>
            </div>
          </div>
        </DetailSection>

        <DetailSection title="附件">
          <div className="attachment-upload-line">
            <span className="upload-hint">单个文件大小≤5M</span>
            <Upload
              showUploadList={false}
              beforeUpload={(file) => {
                setUploadedNames((current) => [...current, file.name]);
                message.success("附件已加入演示列表");
                return false;
              }}
            >
              <Button type="primary" icon={<PaperClipOutlined />}>点击上传</Button>
            </Upload>
            <Button onClick={() => message.info("已进入多媒体对比（演示）")}>多媒体对比</Button>
          </div>
          {uploadedNames.length > 0 && <div className="uploaded-file-line">{uploadedNames.map((name) => <span key={name}><PaperClipOutlined /> {name}</span>)}</div>}
        </DetailSection>

        <DetailSection
          title="事件派单"
          action={(
            <div className="dispatch-section-ai-actions">
              <DispatchAIRecommendationPopover
                times={timeRecommendations}
                departments={departmentRecommendations}
                assistingDepartments={eligibleAssistingRecommendations}
                opinions={dispatchOpinionRecommendations}
                appliedIds={{
                  time: moduleStates.time.appliedId,
                  primary: moduleStates.primary.appliedId,
                  assist: moduleStates.assist.appliedId,
                  opinion: moduleStates.opinion.appliedId,
                }}
                moduleStates={{
                  time: moduleStates.time.status,
                  primary: moduleStates.primary.status,
                  assist: moduleStates.assist.status,
                  opinion: moduleStates.opinion.status,
                }}
                onUndo={(group) => undoModule(group)}
                onApplyTime={(recommendation) => {
                  const snapshot: RecommendationSnapshot = { module: "time", arrivalTime, processingTime };
                  setArrivalTime(recommendation.arrival);
                  setProcessingTime(recommendation.processing);
                  adoptRecommendation("time", recommendation, snapshot, `到场${arrivalTime.join("-")} / 处理${processingTime.join("-")}`, recommendation.title);
                  message.success("已单独回填时限推荐");
                }}
                onApplyDepartment={(recommendation) => {
                  const snapshot: RecommendationSnapshot = { module: "primary", town, responsible, assistTown, assistDepartment, dispatchOpinion };
                  setTown(recommendation.town);
                  setResponsible(recommendation.department);
                  setAssistTown(undefined);
                  setAssistDepartment(undefined);
                  setDispatchOpinion("");
                  adoptRecommendation("primary", recommendation, snapshot, `${town} / ${responsible}`, `${recommendation.town} / ${recommendation.department}`, ["assist", "opinion"]);
                  message.success("已选择主责单位，请继续选择协办单位");
                }}
                onApplyAssistingDepartment={(recommendation) => {
                  if (recommendation.department === responsible) {
                    message.warning("协办单位不能与主责单位相同");
                    return;
                  }
                  const snapshot: RecommendationSnapshot = { module: "assist", assistTown, assistDepartment, dispatchOpinion };
                  setAssistTown(recommendation.town || undefined);
                  setAssistDepartment(recommendation.department || undefined);
                  setDispatchOpinion("");
                  adoptRecommendation("assist", recommendation, snapshot, assistDepartment || "无需协办", recommendation.department || "无需协办", ["opinion"]);
                  message.success(recommendation.department ? "已选择协办单位，请继续选择派遣意见" : "已选择无需协办，请继续选择派遣意见");
                }}
                onApplyOpinion={(recommendation) => {
                  const snapshot: RecommendationSnapshot = { module: "opinion", dispatchOpinion };
                  setDispatchOpinion(recommendation.value);
                  lastRecordedOpinion.current = recommendation.value;
                  adoptRecommendation("opinion", recommendation, snapshot, dispatchOpinion, recommendation.value);
                  message.success("已回填派遣意见");
                }}
              />
            </div>
          )}
        >
          <div className="dispatch-fields">
            <div className="time-row" id={moduleAnchors.time}>
              <RequiredLabel>到场时限：</RequiredLabel>
              <InputNumber min={0} value={arrivalTime[0]} onChange={(value) => { const next: [number, number, number] = [value ?? 0, arrivalTime[1], arrivalTime[2]]; setArrivalTime(next); markManualChange("time", arrivalTime.join("-"), next.join("-")); }} /> <span>天</span>
              <InputNumber min={0} max={23} value={arrivalTime[1]} onChange={(value) => { const next: [number, number, number] = [arrivalTime[0], value ?? 0, arrivalTime[2]]; setArrivalTime(next); markManualChange("time", arrivalTime.join("-"), next.join("-")); }} /> <span>时</span>
              <InputNumber min={0} max={59} value={arrivalTime[2]} onChange={(value) => { const next: [number, number, number] = [arrivalTime[0], arrivalTime[1], value ?? 0]; setArrivalTime(next); markManualChange("time", arrivalTime.join("-"), next.join("-")); }} /> <span>分</span>
              <span className="time-gap" />
              <RequiredLabel>处理时限：</RequiredLabel>
              <InputNumber min={0} value={processingTime[0]} onChange={(value) => { const next: [number, number, number] = [value ?? 0, processingTime[1], processingTime[2]]; setProcessingTime(next); markManualChange("time", processingTime.join("-"), next.join("-")); }} /> <span>天</span>
              <InputNumber min={0} max={23} value={processingTime[1]} onChange={(value) => { const next: [number, number, number] = [processingTime[0], value ?? 0, processingTime[2]]; setProcessingTime(next); markManualChange("time", processingTime.join("-"), next.join("-")); }} /> <span>时</span>
              <InputNumber min={0} max={59} value={processingTime[2]} onChange={(value) => { const next: [number, number, number] = [processingTime[0], processingTime[1], value ?? 0]; setProcessingTime(next); markManualChange("time", processingTime.join("-"), next.join("-")); }} /> <span>分</span>
              <Button type="primary" shape="circle" icon={<CalendarOutlined />} aria-label="选择时限" />
            </div>

            <div className="department-line">
              <div className="department-group" id={moduleAnchors.primary}>
                <RequiredLabel>主责部门：</RequiredLabel>
                <Select value={town} onChange={(value) => { const previous = town; setTown(value); markManualChange("primary", previous, value, ["assist", "opinion"]); }} options={townOptions} />
                <Select value={responsible} onChange={changeResponsibleDepartment} options={departmentOptions.concat([{ value: order.responsibleDepartment, label: order.responsibleDepartment }])} />
              </div>
              <div className="department-group assist-group" id={moduleAnchors.assist}>
                <span className="form-label assist-label">协办部门：</span>
                <Select allowClear placeholder="可不选" value={assistTown} onChange={(value) => { const previous = assistTown ?? ""; setAssistTown(value); markManualChange("assist", previous, value ?? "无需协办", ["opinion"]); }} options={townOptions} />
                <Select
                  allowClear
                  placeholder="可不选"
                  value={assistDepartment}
                  onChange={(value) => {
                    const previous = assistDepartment ?? "无需协办";
                    setAssistDepartment(value);
                    if (!value) setAssistTown(undefined);
                    markManualChange("assist", previous, value ?? "无需协办", ["opinion"]);
                  }}
                  options={departmentOptions.filter((item) => item.value !== responsible)}
                />
              </div>
            </div>

            <div className="dispatch-opinion-field" id={moduleAnchors.opinion}>
              <RequiredLabel>派遣意见：</RequiredLabel>
              <Input.TextArea
                value={dispatchOpinion}
                onChange={(event) => {
                  setDispatchOpinion(event.target.value);
                  setModuleStates((current) => ({ ...current, opinion: { ...current.opinion, status: "manuallyEdited", confidence: undefined, confidenceLevel: undefined } }));
                }}
                onBlur={() => {
                  if (dispatchOpinion === lastRecordedOpinion.current) return;
                  appendOperation("opinion", "manualEdit", lastRecordedOpinion.current, dispatchOpinion);
                  lastRecordedOpinion.current = dispatchOpinion;
                }}
                maxLength={500}
                showCount
                rows={4}
              />
            </div>
            <div className="dispatch-quick-replies">
              {quickReplies.map((text) => <button key={text} type="button" onClick={() => { const previous = dispatchOpinion; setDispatchOpinion(text); lastRecordedOpinion.current = text; markManualChange("opinion", previous, text); }}>{text}</button>)}
            </div>
            <Checkbox>转交多发事件</Checkbox>
          </div>
        </DetailSection>

        <div className="detail-actions">
          <DispatchRiskPopover
            open={riskOpen}
            items={validationItems}
            records={operationRecords}
            showTrigger={false}
            onOpenChange={setRiskOpen}
            onFocusModule={focusModule}
            onReviewModule={reviewModule}
          />
          <Button type="primary" onClick={confirmDispatch}>确认</Button>
          <Button onClick={() => router.back()}>返回</Button>
          <Button type="primary" icon={<PhoneOutlined />} onClick={() => message.info("已模拟发起外拨")}>外拨</Button>
          <Button type="primary" onClick={() => message.info("已进入双方联络演示状态")}>双方联</Button>
          <div className="right">
            <Dropdown menu={{ items: [{ key: "forward", label: "转派其他部门" }, { key: "return", label: "退回上一步" }], onClick: ({ key }) => message.info(key === "forward" ? "已选择转派其他部门" : "已选择退回上一步") }}>
              <Button type="primary">切换操作 <CaretDownOutlined /></Button>
            </Dropdown>
          </div>
        </div>

        <AmapRecommendationMap
          open={mapOpen}
          mapConfig={mapConfig}
          addresses={addressRecommendations}
          selectedId={selectedMapAddressId}
          onSelect={setSelectedMapAddressId}
          onApply={applyAddress}
          onClose={() => setMapOpen(false)}
        />
      </div>
    </PlatformShell>
  );
}
