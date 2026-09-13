"use client";

import { useState } from "react";
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
} from "@ant-design/icons";
import AIRecommendationPopover from "./AIRecommendationPopover";
import AmapRecommendationMap from "./AmapRecommendationMap";
import DispatchAIRecommendationPopover from "./DispatchAIRecommendationPopover";
import { useAutoDispatch } from "./AutoDispatchProvider";
import PlatformShell from "./PlatformShell";
import type { AIRecommendationSet, MapAddressRecommendation } from "@/types/ai-recommendation";
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

  const eligibleAssistingRecommendations = [
    ...assistingDepartmentRecommendations.filter((item) => item.department && item.department !== responsible).slice(0, 2),
    ...assistingDepartmentRecommendations.filter((item) => !item.department),
  ].slice(0, 3);

  const changeResponsibleDepartment = (value: string) => {
    setResponsible(value);
    if (assistDepartment === value) {
      setAssistTown(undefined);
      setAssistDepartment(undefined);
      message.info("协办单位不能与主责单位相同，已清空协办单位");
    }
  };

  const confirmDispatch = () => {
    if (autoDispatchIntervention && !addressConfirmed) {
      message.warning("请先人工确认一个标准地址");
      return;
    }
    if (!responsible || !dispatchOpinion.trim()) {
      message.warning("请完善主责部门和派遣意见");
      return;
    }
    if (autoDispatchIntervention) {
      resolveManual(order.id);
      message.success("地址已人工确认，工单完成派单");
      router.push("/");
      return;
    }
    message.success("工单已核验并完成派单（演示）");
  };

  const applyAddress = (item: MapAddressRecommendation) => {
    setStandardAddress(item.title);
    setSelectedMapAddressId(item.id);
    setAddressConfirmed(true);
    setMapOpen(false);
    message.success(item.id.startsWith("manual-") ? "已采用人工新增点位" : "已采用AI推荐标准地址");
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

            <div className="field-line ai-field-line">
              <div className="ai-label-control">
                <RequiredLabel>案件类型：</RequiredLabel>
                <AIRecommendationPopover
                  attention
                  label="案件类型"
                  title="案件类型推荐"
                  description="根据问题描述匹配三级分类，按可信度排序。"
                  items={caseTypeRecommendations}
                  onApply={(item) => {
                    const recommendation = caseTypeRecommendations.find((candidate) => candidate.id === item.id);
                    if (!recommendation) return;
                    setCaseType(recommendation.value);
                    message.success("已采用AI推荐案件类型");
                  }}
                />
              </div>
              <Select value={caseType} onChange={setCaseType} options={caseTypeRecommendations.map((item) => ({ value: item.value, label: item.title }))} />
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
              <Input value={address} onChange={(event) => setAddress(event.target.value)} maxLength={50} suffix={`${address.length}/50`} />
            </div>

            <div className="address-field ai-address-field">
              <div className="ai-label-control">
                <RequiredLabel>标准地址：</RequiredLabel>
                <AIRecommendationPopover
                  label="标准地址"
                  title="标准地址推荐"
                  description="融合文本地址、POI与历史定位结果，推荐3个候选点。"
                  items={addressRecommendations}
                  defaultOpen={initialAddressRecommendationOpen}
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
                <Select value={town} onChange={setTown} options={townOptions} />
                <Input defaultValue="剑川路" maxLength={20} suffix="0/20" />
                <Select value={grid} onChange={setGrid} options={gridOptions} />
                <Input defaultValue="沿线公共区域" maxLength={20} suffix="0/20" />
                <Select defaultValue="道路" options={[{ value: "道路", label: "道路" }, { value: "小区", label: "小区" }, { value: "园区", label: "园区" }]} />
              </div>
            </div>

            <div className="responsibility-field">
              <div className="responsibility-heading">
                <RequiredLabel>所属街镇/网格类型/自治网格/责任块/处置网格：</RequiredLabel>
                <AIRecommendationPopover
                  label="权责网格"
                  title="权责部门与网格推荐"
                  description="基于标准地址、事项分类和历史派单链路综合研判。"
                  items={responsibilityRecommendations}
                  onApply={(item) => {
                    const recommendation = responsibilityRecommendations.find((candidate) => candidate.id === item.id);
                    if (!recommendation) return;
                    setTown(recommendation.town);
                    setGrid(recommendation.grid);
                    setResponsible(recommendation.department);
                    message.success("已采用AI推荐权责网格");
                  }}
                />
              </div>
              <div className="responsibility-selects">
                <Select value={town} onChange={setTown} options={townOptions} />
                <Select defaultValue="综合网格" options={[{ value: "综合网格", label: "综合网格" }, { value: "专业网格", label: "专业网格" }]} />
                <Select value={grid} onChange={setGrid} options={gridOptions} />
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
            <DispatchAIRecommendationPopover
              times={timeRecommendations}
              departments={departmentRecommendations}
              assistingDepartments={eligibleAssistingRecommendations}
              opinions={dispatchOpinionRecommendations}
              onApplyTime={(recommendation) => {
                setArrivalTime(recommendation.arrival);
                setProcessingTime(recommendation.processing);
                message.success("已单独回填时限推荐");
              }}
              onApplyDepartment={(recommendation) => {
                setTown(recommendation.town);
                setResponsible(recommendation.department);
                setAssistTown(undefined);
                setAssistDepartment(undefined);
                setDispatchOpinion("");
                message.success("已选择主责单位，请继续选择协办单位");
              }}
              onApplyAssistingDepartment={(recommendation) => {
                if (recommendation.department === responsible) {
                  message.warning("协办单位不能与主责单位相同");
                  return;
                }
                setAssistTown(recommendation.town || undefined);
                setAssistDepartment(recommendation.department || undefined);
                setDispatchOpinion("");
                message.success(recommendation.department ? "已选择协办单位，请继续选择派遣意见" : "已选择无需协办，请继续选择派遣意见");
              }}
              onApplyOpinion={(recommendation) => {
                setDispatchOpinion(recommendation.value);
                message.success("已回填派遣意见");
              }}
            />
          )}
        >
          <div className="dispatch-fields">
            <div className="time-row">
              <RequiredLabel>到场时限：</RequiredLabel>
              <InputNumber min={0} value={arrivalTime[0]} onChange={(value) => setArrivalTime([value ?? 0, arrivalTime[1], arrivalTime[2]])} /> <span>天</span>
              <InputNumber min={0} max={23} value={arrivalTime[1]} onChange={(value) => setArrivalTime([arrivalTime[0], value ?? 0, arrivalTime[2]])} /> <span>时</span>
              <InputNumber min={0} max={59} value={arrivalTime[2]} onChange={(value) => setArrivalTime([arrivalTime[0], arrivalTime[1], value ?? 0])} /> <span>分</span>
              <span className="time-gap" />
              <RequiredLabel>处理时限：</RequiredLabel>
              <InputNumber min={0} value={processingTime[0]} onChange={(value) => setProcessingTime([value ?? 0, processingTime[1], processingTime[2]])} /> <span>天</span>
              <InputNumber min={0} max={23} value={processingTime[1]} onChange={(value) => setProcessingTime([processingTime[0], value ?? 0, processingTime[2]])} /> <span>时</span>
              <InputNumber min={0} max={59} value={processingTime[2]} onChange={(value) => setProcessingTime([processingTime[0], processingTime[1], value ?? 0])} /> <span>分</span>
              <Button type="primary" shape="circle" icon={<CalendarOutlined />} aria-label="选择时限" />
            </div>

            <div className="department-line">
              <RequiredLabel>主责部门：</RequiredLabel>
              <Select value={town} onChange={setTown} options={townOptions} />
              <Select value={responsible} onChange={changeResponsibleDepartment} options={departmentOptions.concat([{ value: order.responsibleDepartment, label: order.responsibleDepartment }])} />
              <span className="form-label assist-label">协办部门：</span>
              <Select allowClear placeholder="可不选" value={assistTown} onChange={setAssistTown} options={townOptions} />
              <Select
                allowClear
                placeholder="可不选"
                value={assistDepartment}
                onChange={(value) => {
                  setAssistDepartment(value);
                  if (!value) setAssistTown(undefined);
                }}
                options={departmentOptions.filter((item) => item.value !== responsible)}
              />
            </div>

            <div className="dispatch-opinion-field">
              <RequiredLabel>派遣意见：</RequiredLabel>
              <Input.TextArea value={dispatchOpinion} onChange={(event) => setDispatchOpinion(event.target.value)} maxLength={500} showCount rows={4} />
            </div>
            <div className="dispatch-quick-replies">
              {quickReplies.map((text) => <button key={text} type="button" onClick={() => setDispatchOpinion(text)}>{text}</button>)}
            </div>
            <Checkbox>转交多发事件</Checkbox>
          </div>
        </DetailSection>

        <div className="detail-actions">
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
