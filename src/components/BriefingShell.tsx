'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button, Input, Select, Tag } from 'antd';
import { AppstoreOutlined, ArrowLeftOutlined, DatabaseOutlined, FileTextOutlined, MessageOutlined, ReadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useWeeklyWorkspace } from './WeeklyWorkspaceProvider';
import './briefing.css';

const navigation = [
  { href: '/briefing', label: '周报工作台', icon: FileTextOutlined, detail: '选题 · 核对 · 成稿' },
  { href: '/ask-data', label: '智能问数', icon: MessageOutlined, detail: '自由提问 · 连续追问' },
  { href: '/briefing/topic', label: '专题报', icon: ReadOutlined, detail: '自定义主题 · 灵活周期' },
  { href: '/data-trial', label: '数据试用', icon: DatabaseOutlined },
  { href: '/templates', label: '模板管理', icon: AppstoreOutlined },
  { href: '/indicators', label: '指标台', icon: DatabaseOutlined },
];
export default function BriefingShell({ children, workspace = false }: { children: ReactNode; workspace?: boolean }) {
  const pathname = usePathname();
  const { identity, setIdentity, datasetName, dataKind } = useWeeklyWorkspace();
  const [name, setName] = useState('业务试用人员'), [role, setRole] = useState('报表编制');
  if (!identity) return <div className="briefing-login"><div className="briefing-login-intro"><div className="briefing-product-mark"><FileTextOutlined /> 闵行城运 · 智能简报</div><span className="briefing-kicker">业务试用工作台</span><h1>从工单出发，<br />让每一份简报有据可查。</h1><p>周报制作、开放问数与专题研判，<br />在同一套工单数据中完成选题、下钻与核对。</p><div className="briefing-login-features"><span><FileTextOutlined /> 优先跑通周报</span><span><MessageOutlined /> 连续追问工单</span><span><SafetyCertificateOutlined /> 人工核对不确定项</span></div><Link href="/">← 返回业务协同平台</Link></div><div className="briefing-login-card"><Tag color="blue">独立访问入口</Tag><h2>进入试用原型</h2><p>选择一个演示身份，体验本轮业务调整。</p><label htmlFor="trial-name">演示姓名</label><Input id="trial-name" value={name} maxLength={30} onChange={e => setName(e.target.value)} /><label htmlFor="trial-role">演示角色</label><Select id="trial-role" value={role} onChange={setRole} options={['报表编制', '业务核验', '指标管理员'].map(value => ({ value, label: value }))} /><Button block type="primary" size="large" disabled={!name.trim()} onClick={() => setIdentity({ name: name.trim(), role })}>演示登录</Button><div className="briefing-auth-note"><SafetyCertificateOutlined /><p>当前为身份流程演示，不提供真实鉴权。正式独立试用须接入登录与权限校验；平台入口可衔接现有账号体系。</p></div></div></div>;
  return <div className={`briefing-shell${workspace ? " briefing-shell-workspace" : ""}`}><aside className="briefing-sidebar"><Link className="briefing-brand" href="/briefing"><span><FileTextOutlined /></span><div>智能简报<small>闵行区城市运行管理</small></div></Link><div className="briefing-nav-label">业务工作台</div><nav>{navigation.map(item => <Link key={item.href} href={item.href} className={pathname === item.href || (pathname === '/weekly-report' && item.href === '/briefing') ? 'active' : ''}><item.icon /><div>{item.label}{item.detail && <small>{item.detail}</small>}</div></Link>)}</nav><div className="briefing-sidebar-bottom"><Tag color="blue">首轮试用原型</Tag><p>周报 → 问数 → 专题报<br />数据、选题与核验贯通</p><Link href="/"><ArrowLeftOutlined /> 业务协同平台</Link></div></aside><div className="briefing-content"><header className="briefing-topbar"><div><span className="briefing-status-dot" />独立工作台 <Tag>{dataKind === 'sample' ? '样例数据' : dataKind === 'imported' ? '导入数据' : '混合数据'}</Tag><Link href="/data-trial" className="briefing-dataset-link">{datasetName}</Link></div><div><SafetyCertificateOutlined /><span>{identity.name}<small>{identity.role} · 演示身份</small></span><Button size="small" type="text" onClick={() => setIdentity(undefined)}>退出</Button></div></header><main className="briefing-page">{children}</main></div></div>;
}
