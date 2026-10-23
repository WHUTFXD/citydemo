"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  AppstoreOutlined,
  BellOutlined,
  CalendarOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  DownOutlined,
  PhoneOutlined,
  QuestionCircleOutlined,
} from "@ant-design/icons";

const fixedItems = [
  "语音信箱", "事件上报", "受理派单", "事件处置", "核验结案", "区多条件查询(热线)",
  "区多条件查询(网格)", "12345附属", "次紧急工单管理", "重复案件批量管理", "多人同诉事项管理",
  "导出下载", "案件信息修改", "市级督办",
];

export default function PlatformShell({ children, detail = false }: { children: React.ReactNode; detail?: boolean }) {
  const pathname = usePathname();
  const [casesOpen, setCasesOpen] = useState(true);
  const [queryOpen, setQueryOpen] = useState(true);

  return (
    <div className="platform-shell">
      <header className="platform-header">
        <div className="brand-mark" role="img" aria-label="平台标识" />
        <div className="brand-title">闵行区城市运行业务协同平台</div>
        <div className="brand-subtitle">区域运中心</div>
        <div className="header-tools" aria-label="系统工具">
          <CalendarOutlined className="header-icon" />
          <PhoneOutlined className="header-icon" />
          <BellOutlined className="header-icon" />
          <AppstoreOutlined className="header-icon" />
          <QuestionCircleOutlined className="header-icon" />
          <div className="header-user">
            <div className="user-avatar" />
            <div className="user-copy">李倩荣<span>区域运中心 <DownOutlined /></span></div>
          </div>
        </div>
      </header>
      <div className="shell-body">
        <aside className="sidebar">
          <div className="sidebar-heading"><AppstoreOutlined style={{ color: "#357bd1" }} /> 案件操作 <CaretDownOutlined style={{ marginLeft: "auto" }} /></div>
          <div className="menu-section-title" onClick={() => setCasesOpen(!casesOpen)}><span>案件流转</span>{casesOpen ? <CaretDownOutlined /> : <CaretRightOutlined />}</div>
          {casesOpen && fixedItems.slice(0, 5).map((item) => (
            <Link key={item} href={item === "受理派单" ? "/" : "#"} className={`menu-item ${item === "受理派单" && pathname === "/" ? "active" : ""}`}>
              {item}{item === "受理派单" && <span className="menu-badge">1941</span>}{item === "核验结案" && <span className="menu-badge">2164</span>}
            </Link>
          ))}
          <div className="menu-section-title" onClick={() => setQueryOpen(!queryOpen)}><span>多条件查询</span>{queryOpen ? <CaretDownOutlined /> : <CaretRightOutlined />}</div>
          {queryOpen && fixedItems.slice(5).map((item) => <div key={item} className="menu-item">{item}</div>)}
          <div className="sidebar-heading" style={{ height: 48, marginTop: 4 }}><AppstoreOutlined style={{ color: "#357bd1" }} /> 评价中心(验收)<CaretDownOutlined style={{ marginLeft: "auto" }} /></div>
          <Link href="/briefing" className={`menu-item ${pathname === '/weekly-report' ? 'active' : ''}`}><CalendarOutlined style={{ marginRight: 9 }} />智能简报 · 独立试用<TagLabel /></Link>
          <Link href="/templates" className={`menu-item ${pathname === '/templates' ? 'active' : ''}`}><AppstoreOutlined style={{ marginRight: 9 }} />模板管理</Link>
          <Link href="/indicators" className={`menu-item ${pathname === '/indicators' ? 'active' : ''}`}><AppstoreOutlined style={{ marginRight: 9 }} />指标台</Link>
        </aside>
        <section className="workspace">
          <nav className="workspace-tabs">
            <Link href="/" className="workspace-tab home">主页</Link>
            <div className="workspace-tab active">{pathname === '/weekly-report' ? '智能报告' : pathname === '/templates' ? '模板管理' : pathname === '/indicators' ? '指标台' : detail ? "核验派单" : "受理派单"}　×</div>
          </nav>
          <main className="page-content">{children}</main>
        </section>
      </div>
    </div>
  );
}

function TagLabel() { return <span style={{ marginLeft: 8, fontSize: 10, color: '#2370bd', background: '#e1edff', padding: '0 4px' }}>AI</span>; }
