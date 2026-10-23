'use client';

import { getTrialSampleOrders } from '@/lib/trialData';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Alert, App, Button, Card, Descriptions, Modal, Table, Tag, Upload } from 'antd';
import { DatabaseOutlined, DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import BriefingShell from './BriefingShell';
import { useWeeklyWorkspace } from './WeeklyWorkspaceProvider';
import { type Order } from '@/lib/weeklyReport';

export default function DataTrialWorkbench() {
  const { message } = App.useApp();
  const { sourceOrders, coverage, datasetName, dataKind, replaceOrders, resetSample } = useWeeklyWorkspace();
  const [busy, setBusy] = useState(false), [pending, setPending] = useState<{ rows: Order[]; name: string }>();
  const rows = useMemo(() => sourceOrders || getTrialSampleOrders(), [sourceOrders]);
  const missing = useMemo(() => ({ city: rows.filter(o => !o.cityCategory4).length, district: rows.filter(o => !o.districtCategory).length }), [rows]);
  async function read(file: File) {
    if (busy) return Upload.LIST_IGNORE;
    if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 15 * 1024 * 1024) { message.warning('请选择15MB以内的.xlsx文件'); return Upload.LIST_IGNORE; }
    setBusy(true);
    try {
      const worker = new Worker(new URL('../workers/reportDataImport.worker.ts', import.meta.url));
      const buffer = await file.arrayBuffer();
      const orders = await new Promise<Order[]>((resolve, reject) => {
        const timer = setTimeout(() => { worker.terminate(); reject(new Error('解析超时，请缩小文件后重试')); }, 60000);
        worker.onmessage = (event: MessageEvent<{ rows?: Order[]; error?: string }>) => { clearTimeout(timer); worker.terminate(); if (event.data.rows) resolve(event.data.rows); else reject(new Error(event.data.error)); };
        worker.onerror = () => { clearTimeout(timer); worker.terminate(); reject(new Error('文件解析失败')); };
        worker.postMessage(buffer, [buffer]);
      });
      setPending({ rows: orders, name: file.name.replace(/\.xlsx$/i, '') });
    } catch (e) { message.error((e as Error).message); } finally { setBusy(false); }
    return Upload.LIST_IGNORE;
  }
  async function template() { const { createImportTemplate } = await import('@/lib/reportDataImport'); const { downloadBlob } = await import('@/lib/weeklyReportExport'); downloadBlob(await createImportTemplate(), '城运试用工单导入模板.xlsx'); }
  return <BriefingShell><div className="briefing-page-heading"><div><span className="briefing-kicker">DATA TRIAL</span><h1>先用一段数据，验证一份周报</h1><p>导入工单后，按实际分类选题、下钻核对，再与业务周报对照。</p></div><Button icon={<DownloadOutlined />} onClick={template}>下载导入模板</Button></div><div className="trial-data-grid"><Card title={<span><DatabaseOutlined /> 当前数据集</span>} extra={<Tag color={dataKind === 'sample' ? 'blue' : 'green'}>{dataKind === 'sample' ? '模拟样例' : '当前会话导入'}</Tag>}><h2>{datasetName}</h2><Descriptions column={1} items={[{ key: 'count', label: '去重工单', children: `${rows.length.toLocaleString()}条` }, { key: 'range', label: '日期边界', children: `${coverage.start} — ${coverage.end}` }, { key: 'city', label: '市级四级分类', children: missing.city ? `${missing.city.toLocaleString()}条未提供` : '全部已提供' }, { key: 'district', label: '区级案件小类', children: missing.district ? `${missing.district.toLocaleString()}条未提供` : '全部已提供' }]} /><p className="briefing-subtle">日期边界来自记录的受理时间，不代表已经证明中间每日数据完整。样例分类仅为演示口径。</p><Link href="/briefing"><Button type="primary">进入周报工作台</Button></Link></Card><Card title="建立独立的试用数据集"><Upload.Dragger accept=".xlsx" showUploadList={false} beforeUpload={read} disabled={busy}><UploadOutlined style={{ fontSize: 32, color: '#377ccd' }} /><h3>{busy ? '正在校验工单数据…' : '选择或拖入 Excel 工单明细'}</h3><p>校验后预览，再替换当前数据集；不与模拟工单混算。</p></Upload.Dragger><p className="briefing-subtle">9项必需字段 + 5项可选分类与场景字段。支持任意有效日期、原始业务分类与渠道。导入记录只在当前会话使用，刷新后清空。</p><Button type="text" onClick={() => { resetSample(); message.success('已切回样例数据'); }}>切回样例数据</Button></Card></div><Alert type="info" showIcon title="首轮业务验证重点" description="请用同一时间范围的工单与业务周报，逐项核对选题、分类、待核对记录和统计结果。当前主题识别与研判仍为本地规则模拟；真实模型、统一身份认证和正式权限待接入。" /><Modal open={!!pending} title="确认试用数据范围" okText="使用该数据集" cancelText="取消" onCancel={() => setPending(undefined)} onOk={() => { if (pending) { replaceOrders(pending.rows, pending.name); setPending(undefined); message.success('试用数据已切换，请重新分析选题'); } }} width={900}><p>将使用 {pending?.name} 中的 {pending?.rows.length.toLocaleString()} 条有效工单，清空当前报告与选题，原样例不会混入新统计。</p><Table rowKey="id" size="small" scroll={{ x: 850 }} pagination={false} dataSource={pending?.rows.slice(0, 5)} columns={[{ title: '工单编号', dataIndex: 'id' }, { title: '受理时间', dataIndex: 'receivedAt' }, { title: '原分类', dataIndex: 'category' }, { title: '市级四级分类', dataIndex: 'cityCategory4' }, { title: '诉求摘要', dataIndex: 'description', ellipsis: true }]} /></Modal></BriefingShell>;
}
