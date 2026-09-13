"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Alert, Button, Input, Modal, Spin, Tag } from "antd";
import { AimOutlined, CheckCircleFilled, EnvironmentFilled, ExclamationCircleOutlined, PlusOutlined } from "@ant-design/icons";
import type { MapAddressRecommendation } from "@/types/ai-recommendation";

interface AMapLngLat { getLng(): number; getLat(): number; }
interface AMapEvent { lnglat?: AMapLngLat; target?: { getPosition?: () => AMapLngLat }; }
interface AMapMarker {
  setMap(map: AMapMap | null): void;
  on(event: string, handler: (event: AMapEvent) => void): void;
}
interface AMapMap {
  add(markers: AMapMarker[]): void;
  destroy(): void;
  setCenter(position: [number, number]): void;
  setZoom(zoom: number): void;
  on(event: string, handler: (event: AMapEvent) => void): void;
  off(event: string, handler: (event: AMapEvent) => void): void;
}
interface AMapReGeocodeResult {
  info?: string;
  regeocode?: { formattedAddress?: string };
}
interface AMapGeocoder {
  getAddress(position: [number, number], callback: (status: string, result: AMapReGeocodeResult) => void): void;
}
interface AMapNamespace {
  Map: new (container: HTMLElement, options: { center: [number, number]; zoom: number; viewMode: "2D" }) => AMapMap;
  Marker: new (options: {
    position: [number, number];
    title: string;
    label: { content: string; direction: "top" };
    draggable?: boolean;
  }) => AMapMarker;
  Geocoder: new (options?: { city?: string; radius?: number }) => AMapGeocoder;
  plugin(plugin: string | string[], callback: () => void): void;
}

declare global {
  interface Window {
    AMap?: AMapNamespace;
    _AMapSecurityConfig?: { securityJsCode: string };
  }
}

interface AmapRecommendationMapProps {
  open: boolean;
  mapConfig: { key: string; securityCode: string };
  addresses: MapAddressRecommendation[];
  selectedId: string;
  onSelect: (id: string) => void;
  onApply: (address: MapAddressRecommendation) => void;
  onClose: () => void;
}

const scriptId = "amap-js-api";

function toPosition(event: AMapEvent): [number, number] | undefined {
  const point = event.lnglat ?? event.target?.getPosition?.();
  if (!point) return undefined;
  return [Number(point.getLng().toFixed(6)), Number(point.getLat().toFixed(6))];
}

export default function AmapRecommendationMap({ open, mapConfig, addresses, selectedId, onSelect, onApply, onClose }: AmapRecommendationMapProps) {
  const mapRef = useRef<AMapMap | null>(null);
  const markersRef = useRef<AMapMarker[]>([]);
  const manualMarkerRef = useRef<AMapMarker | null>(null);
  const geocodeRequestRef = useRef(0);
  const [mapContainer, setMapContainer] = useState<HTMLDivElement | null>(null);
  const mapConfigured = Boolean(mapConfig.key && mapConfig.securityCode);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">(mapConfigured ? "loading" : "missing");
  const [manualMode, setManualMode] = useState(false);
  const [manualPosition, setManualPosition] = useState<[number, number]>();
  const [manualTitle, setManualTitle] = useState("");
  const [geocodeStatus, setGeocodeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const selected = addresses.find((item) => item.id === selectedId) ?? addresses[0];

  const reverseGeocode = useCallback((position: [number, number]) => {
    if (!window.AMap) return;
    const requestId = ++geocodeRequestRef.current;
    setManualTitle("");
    setGeocodeStatus("loading");
    window.AMap.plugin("AMap.Geocoder", () => {
      if (!window.AMap || requestId !== geocodeRequestRef.current) return;
      const geocoder = new window.AMap.Geocoder({ city: "上海市", radius: 200 });
      geocoder.getAddress(position, (geocodeState, result) => {
        if (requestId !== geocodeRequestRef.current) return;
        const formattedAddress = result.regeocode?.formattedAddress?.trim();
        if (geocodeState === "complete" && result.info === "OK" && formattedAddress) {
          setManualTitle(formattedAddress);
          setGeocodeStatus("success");
          return;
        }
        setGeocodeStatus("error");
      });
    });
  }, []);

  useEffect(() => {
    if (!open || !mapContainer) return;
    const { key, securityCode } = mapConfig;
    if (!key || !securityCode) return;

    let cancelled = false;
    window._AMapSecurityConfig = { securityJsCode: securityCode };
    const mountMap = () => {
      if (cancelled || !window.AMap) return;
      mapRef.current?.destroy();
      const map = new window.AMap.Map(mapContainer, { center: addresses[0].position, zoom: 16, viewMode: "2D" });
      const markers = addresses.map((item, index) => new window.AMap!.Marker({
        position: item.position,
        title: item.title,
        label: { content: `<div class="amap-ai-label"><b>${index + 1}</b>${item.confidence}%</div>`, direction: "top" },
      }));
      map.add(markers);
      mapRef.current = map;
      markersRef.current = markers;
      setStatus("ready");
    };

    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (window.AMap) {
      mountMap();
    } else if (existingScript) {
      existingScript.addEventListener("load", mountMap, { once: true });
      existingScript.addEventListener("error", () => setStatus("error"), { once: true });
    } else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(key)}`;
      script.async = true;
      script.addEventListener("load", mountMap, { once: true });
      script.addEventListener("error", () => setStatus("error"), { once: true });
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      manualMarkerRef.current?.setMap(null);
      manualMarkerRef.current = null;
      markersRef.current.forEach((marker) => marker.setMap(null));
      markersRef.current = [];
      mapRef.current?.destroy();
      mapRef.current = null;
    };
  }, [addresses, mapConfig, mapContainer, open]);

  useEffect(() => {
    if (status !== "ready" || manualMode || !selected) return;
    mapRef.current?.setCenter(selected.position);
    mapRef.current?.setZoom(17);
  }, [manualMode, selected, status]);

  useEffect(() => {
    const map = mapRef.current;
    if (status !== "ready" || !manualMode || !map || !window.AMap) return;

    const placeManualPoint = (position: [number, number]) => {
      setManualPosition(position);
      reverseGeocode(position);
      manualMarkerRef.current?.setMap(null);
      const marker = new window.AMap!.Marker({
        position,
        title: "人工新增点位",
        draggable: true,
        label: { content: '<div class="amap-manual-label">人工点位 · 可拖动</div>', direction: "top" },
      });
      marker.on("dragend", (event) => {
        const dragged = toPosition(event);
        if (dragged) {
          setManualPosition(dragged);
          reverseGeocode(dragged);
        }
      });
      map.add([marker]);
      manualMarkerRef.current = marker;
      map.setCenter(position);
      map.setZoom(18);
    };
    const onMapClick = (event: AMapEvent) => {
      const position = toPosition(event);
      if (position) placeManualPoint(position);
    };
    map.on("click", onMapClick);
    return () => map.off("click", onMapClick);
  }, [manualMode, reverseGeocode, status]);

  const clearManualPoint = () => {
    geocodeRequestRef.current += 1;
    setManualMode(false);
    setManualPosition(undefined);
    setManualTitle("");
    setGeocodeStatus("idle");
    manualMarkerRef.current?.setMap(null);
    manualMarkerRef.current = null;
  };

  const applyManualPoint = () => {
    if (!manualPosition || !manualTitle.trim()) return;
    onApply({
      id: `manual-${Date.now()}`,
      title: manualTitle.trim(),
      detail: `人工地图选点：经度 ${manualPosition[0]}，纬度 ${manualPosition[1]}`,
      subtitle: "由派单人员手动新增",
      confidence: 100,
      position: manualPosition,
      reason: "人工核验并在地图中新增的点位。",
      tag: "人工新增",
    });
  };

  const chooseCandidate = (id: string) => {
    clearManualPoint();
    onSelect(id);
  };

  return (
    <Modal
      className="ai-map-modal"
      open={open}
      width={980}
      title={<span><EnvironmentFilled /> GIS标准地址定位</span>}
      onCancel={onClose}
      afterOpenChange={(visible) => {
        if (!visible) clearManualPoint();
      }}
      footer={null}
      destroyOnHidden
    >
      <div className={`ai-map-layout ${manualMode ? "is-manual-mode" : ""}`}>
        <aside className="ai-map-addresses">
          <div className="ai-map-aside-title">AI推荐标准地址</div>
          <div className="ai-map-aside-copy">先核对候选点；若都不准确，可在地图上新增点位。</div>
          {addresses.map((item, index) => (
            <button key={item.id} type="button" className={`ai-map-address-card ${!manualMode && item.id === selected.id ? "is-selected" : ""}`} onClick={() => chooseCandidate(item.id)}>
              <span className="ai-map-index">{index + 1}</span>
              <span className="ai-map-address-copy"><strong>{item.title}</strong><small>{item.detail}</small></span>
              <Tag color={index === 0 ? "blue" : "default"}>{item.confidence}%</Tag>
            </button>
          ))}

          <div className={`manual-point-panel ${manualMode ? "is-active" : ""}`}>
            <div className="manual-point-heading">
              <span><AimOutlined /> 候选点都不合适？</span>
              {!manualMode && <Button size="small" icon={<PlusOutlined />} disabled={status !== "ready"} onClick={() => setManualMode(true)}>手动新增点位</Button>}
            </div>
            {manualMode && (
              <div className="manual-point-fields">
                <div className="manual-point-help">点击右侧地图落点，高德将自动解析标准地址；拖动标记后会重新解析。</div>
                <div className="manual-point-coordinate">
                  {manualPosition ? <><span>经度 {manualPosition[0]}</span><span>纬度 {manualPosition[1]}</span></> : "尚未选择坐标"}
                </div>
                <div className="manual-standard-address-label">
                  <strong>标准地址</strong>
                  {geocodeStatus === "loading" && <span><Spin size="small" /> 正在解析</span>}
                  {geocodeStatus === "success" && <span className="is-success"><CheckCircleFilled /> 已由高德解析</span>}
                  {geocodeStatus === "error" && <span className="is-error"><ExclamationCircleOutlined /> 解析失败，请人工补充</span>}
                </div>
                <Input.TextArea
                  className="manual-standard-address-input"
                  value={manualTitle}
                  onChange={(event) => setManualTitle(event.target.value)}
                  placeholder={geocodeStatus === "error" ? "请输入标准地址" : "选点后自动生成标准地址"}
                  maxLength={100}
                  autoSize={{ minRows: 2, maxRows: 2 }}
                />
                <Button size="small" onClick={clearManualPoint}>取消新增</Button>
              </div>
            )}
          </div>

          <Button type="primary" block disabled={manualMode ? !manualPosition || !manualTitle.trim() || geocodeStatus === "loading" : false} onClick={manualMode ? applyManualPoint : () => onApply(selected)}>
            {manualMode ? "采用此标准地址" : "采用当前地址"}
          </Button>
        </aside>

        <div className="ai-map-stage">
          <div ref={setMapContainer} className="amap-container" aria-label="高德地图地址定位区域" />
          {status === "loading" && <div className="ai-map-status"><Spin size="large" /><span>正在加载高德地图</span></div>}
          {status === "missing" && <div className="ai-map-status"><Alert type="info" showIcon message="地图服务待配置" description="推荐地址仍可正常切换和采用；配置高德地图环境变量后即可显示地图底图并手动选点。" /></div>}
          {status === "error" && <div className="ai-map-status"><Alert type="warning" showIcon message="地图暂时无法加载" description="请检查网络或高德地图安全配置，地址推荐不受影响。" /></div>}
          {manualMode && status === "ready" && <div className="manual-map-instruction"><AimOutlined /> 点击地图选点，将自动转换为标准地址</div>}
          <div className="ai-map-legend"><EnvironmentFilled /> {manualMode ? (manualPosition ? `选点坐标：${manualPosition[0]}, ${manualPosition[1]}` : "人工选点模式") : `当前定位：${selected.title}`}</div>
        </div>
      </div>
    </Modal>
  );
}
