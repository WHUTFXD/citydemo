"use client";

import { useEffect, useState } from "react";
import type { MapAddressRecommendation } from "@/types/ai-recommendation";

interface InlineAddressMapProps {
  addresses: MapAddressRecommendation[];
  selectedId: string;
  mapConfig: { key: string; securityCode: string };
}

const scriptId = "amap-js-api";

export default function InlineAddressMap({ addresses, selectedId, mapConfig }: InlineAddressMapProps) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">(
    mapConfig.key && mapConfig.securityCode ? "loading" : "missing",
  );
  const selected = addresses.find((item) => item.id === selectedId) ?? addresses[0];

  useEffect(() => {
    if (!container || !mapConfig.key || !mapConfig.securityCode || !addresses.length) return;
    let cancelled = false;
    let mountedMap: InstanceType<NonNullable<typeof window.AMap>["Map"]> | null = null;
    window._AMapSecurityConfig = { securityJsCode: mapConfig.securityCode };

    const mount = () => {
      if (cancelled || !window.AMap) return;
      mountedMap = new window.AMap.Map(container, {
        center: selected.position,
        zoom: 16,
        viewMode: "2D",
      });
      mountedMap.add([new window.AMap.Marker({
        position: selected.position,
        title: selected.title,
        label: { content: '<div class="amap-ai-label"><b>●</b>当前定位</div>', direction: "top" },
      })]);
      setStatus("ready");
    };
    const onError = () => { if (!cancelled) setStatus("error"); };
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (window.AMap) {
      mount();
    } else if (existing) {
      if ((existing as HTMLScriptElement & { readyState?: string }).readyState === "complete") onError();
      else {
        existing.addEventListener("load", mount, { once: true });
        existing.addEventListener("error", onError, { once: true });
      }
    } else {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(mapConfig.key)}`;
      script.async = true;
      script.addEventListener("load", mount, { once: true });
      script.addEventListener("error", onError, { once: true });
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      existing?.removeEventListener("load", mount);
      existing?.removeEventListener("error", onError);
      mountedMap?.destroy();
    };
  }, [addresses, container, mapConfig.key, mapConfig.securityCode, selected]);

  return <div className="workbench-inline-map" aria-label="推荐标准地址地图">
    <div ref={setContainer} className="workbench-inline-map-canvas" />
    <div className="workbench-inline-map-click-target" aria-hidden="true" />
    {status !== "ready" && <div className="workbench-inline-map-status">
      {status === "loading" ? "正在加载高德地图…" : status === "missing" ? "地图服务待配置，地址候选仍可查看" : "地图暂时无法加载，请查看地址候选"}
    </div>}
  </div>;
}
