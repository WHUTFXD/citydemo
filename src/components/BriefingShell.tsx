'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { Button, Input, Select, Tag } from 'antd';
import { AppstoreOutlined, ArrowLeftOutlined, DatabaseOutlined, FileTextOutlined, MessageOutlined, ReadOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import { useWeeklyWorkspace } from './WeeklyWorkspaceProvider';
import './briefing.css';

const navigation = [
  { href: '/briefing', label: '周报工作台', icon: FileTextOutlined },
  { href: '/ask-data', label: '智能问数', icon: MessageOutlined },
  { href: '/briefing/topic', label: '专题报', icon: ReadOutlined },
  { href: '/data-trial', label: '数据试用', icon: DatabaseOutlined },
  { href: '/templates', label: '模板管理', icon: AppstoreOutlined },
  { href: '/indicators', label: '指标台', icon: DatabaseOutlined },
];
export default function BriefingShell({ children, workspace = false }: { children: ReactNode; workspace?: boolean }) {
  const pathname = usePathname();
  const { identity, setIdentity, datasetName, dataKind } = useWeeklyWorkspace();
  const [name, setName] = useState('业务试用人员'), [role, setRole] = useState('报表编制');
  if (!identity) return <div className="briefing-login"><div className="briefing-login-intro"><div className="briefing-product-mark"><FileTextOutlined /> 闵行城运 · 智能简报</div><h1>闵行城运<br />智能简报</h1><Link href="/">← 返回业务协同平台</Link></div><div className="briefing-login-card"><Tag color="blue">演示环境</Tag><h2>登录</h2><label htmlFor="trial-name">演示姓名</label><Input id="trial-name" value={name} maxLength={30} onChange={e => setName(e.target.value)} /><label htmlFor="trial-role">演示角色</label><Select id="trial-role" value={role} onChange={setRole} options={['报表编制', '业务核验', '指标管理员'].map(value => ({ value, label: value }))} /><Button block type="primary" size="large" disabled={!name.trim()} onClick={() => setIdentity({ name: name.trim(), role })}>演示登录</Button><div className="briefing-auth-note"><SafetyCertificateOutlined /><p>演示身份不校验真实权限。</p></div></div></div>;
  return <div className={`briefing-shell${workspace ? " briefing-shell-workspace" : ""}`}><aside className="briefing-sidebar"><Link className="briefing-brand" href="/briefing"><span><FileTextOutlined /></span><div>智能简报<small>闵行区城市运行管理</small></div></Link><div className="briefing-nav-label">业务工作台</div><nav>{navigation.map(item => <Link key={item.href} href={item.href} className={pathname === item.href || (pathname === '/weekly-report' && item.href === '/briefing') ? 'active' : ''}><item.icon /><div>{item.label}</div></Link>)}</nav><div className="briefing-sidebar-bottom"><Link href="/"><ArrowLeftOutlined /> 业务协同平台</Link></div></aside><div className="briefing-content"><header className="briefing-topbar"><div><span className="briefing-status-dot" />演示环境 <Tag>{dataKind === 'sample' ? '样例数据' : dataKind === 'imported' ? '导入数据' : '混合数据'}</Tag><Link href="/data-trial" className="briefing-dataset-link">{datasetName}</Link></div><div><SafetyCertificateOutlined /><span>{identity.name}<small>{identity.role}</small></span><Button size="small" type="text" onClick={() => setIdentity(undefined)}>退出</Button></div></header><main className="briefing-page">{children}</main></div></div>;
}
