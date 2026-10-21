'use client';

import { useMemo, useRef, useState } from 'react';
import { App, Button, Descriptions, Drawer, Empty, Input, Modal, Radio, Select, Space, Table, Tag, Upload, Alert } from 'antd';
import { DownloadOutlined, SearchOutlined, UploadOutlined } from '@ant-design/icons';
import { matches, metricText, type Analysis, type Metric, type Order } from '@/lib/weeklyReport';
import { themeMatchReason, themeRuleDescription } from '@/lib/themeMatching';
import { DISPUTE_STATUS, disputesFor, isOpenDispute } from '@/lib/metricDisputes';
import { useWeeklyWorkspace } from './WeeklyWorkspaceProvider';

export default function WeeklyEvidenceDrawer({ analysis: a, metric, onClose }: { analysis: Analysis; metric: Metric; onClose: () => void }) {
  const { message } = App.useApp();
  const { disputes, submitDispute, storageReady, importOrders } = useWeeklyWorkspace();
  const records = disputesFor(disputes, a, metric);
  const activeDispute = records.find(isOpenDispute);
  const [reason, setReason] = useState('');
  const [period, setPeriod] = useState<'current' | 'previous'>(metric.period);
  const [basis, setBasis] = useState('numerator');
  const [search, setSearch] = useState('');
  const [street, setStreet] = useState<string>();
  const [category, setCategory] = useState<string>();
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(20);
  const [busy, setBusy] = useState('');
  const importLock = useRef(false);
  const [detail, setDetail] = useState<Order>();
  const source = period === 'current' ? a.current : a.previous;
  const evidence = useMemo(() => source.filter(o => basis === 'denominator' ? !metric.filter.channel || o.channel === metric.filter.channel : matches(o, metric.filter)), [source, basis, metric]);
  const filtered = useMemo(() => evidence.filter(o => (!street || o.street === street) && (!category || o.category === category) && (!search.trim() || [o.id, o.description, o.point, o.department].some(v => v.includes(search.trim())))), [evidence, street, category, search]);
  const range = period === 'current' ? a.scope : a.previousScope;
  async function exportExcel(full: boolean) {
    if (busy) return;
    setBusy(full ? 'full' : 'filtered');
    try {
      await new Promise(resolve => setTimeout(resolve, 40));
      const { downloadBlob } = await import('@/lib/weeklyReportExport');
      const worker = new Worker(new URL('../workers/weeklyReportExport.worker.ts', import.meta.url));
      const blob = await new Promise<Blob>((resolve, reject) => {
        worker.onmessage = (event: MessageEvent<{ blob?: Blob; error?: string }>) => {
          worker.terminate();
          if (event.data.blob) resolve(event.data.blob); else reject(new Error(event.data.error));
        };
        worker.onerror = () => { worker.terminate(); reject(new Error('导出任务未完成')); };
        worker.postMessage({ analysis: a, metric, filtered: full ? undefined : { rows: filtered, period, description: `${period === 'current' ? '本期' : '上期'}；${basis === 'denominator' ? '占比分母' : '指标匹配记录'}；街镇：${street || '全部'}；分类：${category || '全部'}；搜索：${search || '无'}` } });
      });
      downloadBlob(blob, `${full ? '完整指标依据' : '当前筛选结果'}_${a.scope.start}_${metric.kind}.xlsx`);
      message.success(`已导出${full ? '完整指标依据（含两期明细与复算公式）' : `全部${filtered.length}条筛选结果`}`);
    } catch { message.error('Excel 导出失败，请重试'); } finally { setBusy(''); }
  }
  async function upload(file: File) {
    if (importLock.current || busy) return Upload.LIST_IGNORE;
    if (!file.name.toLowerCase().endsWith('.xlsx') || file.size > 15 * 1024 * 1024) { message.warning('请选择15MB以内的.xlsx文件'); return Upload.LIST_IGNORE; }
    importLock.current = true; setBusy('upload');
    try {
      const buffer = await file.arrayBuffer();
      const worker = new Worker(new URL('../workers/reportDataImport.worker.ts', import.meta.url));
      const rows = await new Promise<Order[]>((resolve, reject) => {
        const timeout = setTimeout(() => { worker.terminate(); reject(new Error('文件解析超时，请减少明细后重试')); }, 60000);
        worker.onmessage = (event: MessageEvent<{ rows?: Order[]; error?: string }>) => { clearTimeout(timeout); worker.terminate(); if (event.data.rows) resolve(event.data.rows); else reject(new Error(event.data.error)); };
        worker.onerror = () => { clearTimeout(timeout); worker.terminate(); reject(new Error('Excel解析失败')); };
        worker.postMessage(buffer, [buffer]);
      });
      const result = importOrders(rows);
      message.success(`更新${result.updated}条、新增${result.added}条，分析与报告已自动重算`); onClose();
    } catch (error) { message.error((error as Error).message); }
    finally { importLock.current = false; setBusy(''); }
    return Upload.LIST_IGNORE;
  }
  async function downloadTemplate() {
    if (busy) return; setBusy('template');
    try { const { createImportTemplate } = await import('@/lib/reportDataImport'); const { downloadBlob } = await import('@/lib/weeklyReportExport'); downloadBlob(await createImportTemplate(), '城运工单导入模板.xlsx'); }
    catch { message.error('导入模板下载失败，请重试'); }
    finally { setBusy(''); }
  }
  return <Drawer title={<span>数据核验 <Tag color="blue">明细依据 · 本地演示</Tag></span>} open onClose={onClose} size={Math.min(1040, typeof window === 'undefined' ? 1040 : window.innerWidth - 24)} className="weekly-evidence" extra={<Button icon={<DownloadOutlined />} loading={busy === 'full'} disabled={!!busy} onClick={() => exportExcel(true)}>{busy === 'full' ? '正在生成 Excel…' : '导出完整指标依据'}</Button>}>
    <div className="evidence-metric"><div><span>{metric.label}</span><strong>{metricText(metric)}<small>{metric.kind === 'count' ? '件' : metric.kind === 'daily' ? '件/天' : ''}</small></strong></div><div>{activeDispute && <Tag color="orange">异议{DISPUTE_STATUS[activeDispute.status]}</Tag>}<Tag color={a.comparisonComplete ? 'green' : 'orange'}>{a.comparisonComplete ? '比较期完整' : '比较期不完整'}</Tag></div></div>
    <Descriptions size="small" bordered column={2} items={[
      { key: 'scope', label: '本期范围', children: `${a.scope.start} 至 ${a.scope.end}` },
      { key: 'previous', label: '对比范围', children: `${a.previousScope.start} 至 ${a.previousScope.end}` },
      { key: 'channel', label: '统计渠道', children: a.scope.channel },
      { key: 'filter', label: '指标筛选', children: [metric.filter.category, metric.filter.point, metric.filter.business, metric.filter.channel, metric.filter.keyword ? `关键词：${metric.filter.keyword}` : ''].filter(Boolean).join(' / ') || '全部工单' },
      ...(metric.filter.semantic ? [{ key: 'theme', label: '自定义主题识别', children: themeRuleDescription(metric.filter.semantic), span: 2 }] : []),
      ...(metric.definitionId ? [{ key: 'binding', label: '绑定指标', children: `${metric.definitionCode} · v${metric.definitionVersion}；${metric.definitionDescription}`, span: 2 }] : []),
      { key: 'formula', label: '计算公式', children: metric.formula, span: 2 },
      { key: 'round', label: '统计口径', children: '按上海时间完整自然日、唯一工单编号去重。日均及百分比保留1位小数，计算使用原始精度。', span: 2 },
    ]} />
    <div className="metric-review-form"><div className="metric-review-heading"><strong>对这个数字有异议？</strong><span>无异议无需填报</span></div>
      <p className="weekly-muted">填写原因后提交给管理员，申报会保留当前数值、日期范围和统计口径。</p>
      {activeDispute ? <p><Tag color="orange">{DISPUTE_STATUS[activeDispute.status]}</Tag>已有申报正在处理，无需重复提交。</p> : <>
        <Input.TextArea aria-label="异议原因" value={reason} onChange={e => setReason(e.target.value)} maxLength={500} showCount autoSize={{ minRows: 2, maxRows: 4 }} placeholder="例如：部分工单可能重复计入，请核查去重规则。" />
        <div className="metric-review-bottom"><span>仅本次会话有效，F5 刷新后申报及回复自动清空</span><Button type="primary" disabled={!storageReady} onClick={() => {
          try { submitDispute(a, metric, reason); setReason(''); message.success('已提交至指标台管理员待办（本地演示）'); }
          catch (error) { message.warning((error as Error).message); }
        }}>提交异议</Button></div>
      </>}
      {records.map(record => <div key={record.id} style={{ borderTop: '1px solid #e5eaf2', marginTop: 16, paddingTop: 12 }}><p><Tag color={isOpenDispute(record) ? 'orange' : 'default'}>{DISPUTE_STATUS[record.status]}</Tag>{new Date(record.submittedAt).toLocaleString('zh-CN')} · {record.reason}</p>{record.history.filter(h => h.response).map((h, i) => <p className="weekly-muted" key={i}>管理员 · {DISPUTE_STATUS[h.status]}：{h.response}</p>)}</div>)}
    </div>
    <div className="report-import-box"><Alert type="info" showIcon title="上传Excel，自动更新数据" description="按工单编号更新同号记录，新编号补入；不删除未上传记录。校验通过后自动重算全部指标、热点和报告，并重置改写版本。仅本次会话有效，刷新恢复模拟数据。" /><Space wrap style={{ marginTop: 12 }}><Upload accept=".xlsx" showUploadList={false} beforeUpload={upload} disabled={!!busy}><Button type="primary" icon={<UploadOutlined />} loading={busy === 'upload'} disabled={!!busy}>{busy === 'upload' ? '正在校验并重算…' : '上传 Excel 更新数据'}</Button></Upload><Button loading={busy === 'template'} disabled={!!busy} onClick={downloadTemplate}>下载导入模板</Button></Space></div>
    <div className="evidence-controls">
      <Radio.Group value={period} onChange={e => { setPeriod(e.target.value); setPage(1); }} optionType="button" options={[{ label: `本期明细（${a.current.filter(o => matches(o, metric.filter)).length}）`, value: 'current' }, { label: `对比期明细（${a.previous.filter(o => matches(o, metric.filter)).length}）`, value: 'previous' }]} />
      {metric.kind === 'share' && <Radio.Group value={basis} onChange={e => { setBasis(e.target.value); setPage(1); }} options={[{ label: '分子：匹配指标', value: 'numerator' }, { label: '分母：口径总量', value: 'denominator' }]} />}
    </div>
    {period === 'previous' && !a.comparisonComplete && <div className="weekly-warning">比较期覆盖不完整，下表仅列已覆盖的工单，不能将缺失数据按零计算。</div>}
    <div className="evidence-search">
      <Input aria-label="搜索工单" prefix={<SearchOutlined />} placeholder="工单编号、点位或诉求关键词" value={search} allowClear onChange={e => { setSearch(e.target.value); setPage(1); }} />
      <Select aria-label="筛选街镇" placeholder="全部街镇" allowClear value={street} options={[...new Set(evidence.map(o => o.street))].sort().map(value => ({ value, label: value }))} onChange={v => { setStreet(v); setPage(1); }} />
      <Select aria-label="筛选分类" placeholder="全部分类" allowClear value={category} options={[...new Set(evidence.map(o => o.category))].map(value => ({ value, label: value }))} onChange={v => { setCategory(v); setPage(1); }} />
    </div>
    <div className="evidence-count"><span>{range.start} 至 {range.end} · 共 <b>{filtered.length}</b> 条匹配记录</span><Button size="small" icon={<DownloadOutlined />} loading={busy === 'filtered'} disabled={!!busy} onClick={() => exportExcel(false)}>导出当前筛选结果</Button></div>
    <Table<Order> rowKey="id" size="small" dataSource={filtered.slice((page - 1) * size, page * size)} scroll={{ x: 980 }} pagination={{ current: page, pageSize: size, total: filtered.length, showSizeChanger: true, pageSizeOptions: [20, 50, 100], showTotal: total => `共 ${total} 条`, onChange: (p, s) => { setPage(p); setSize(s); } }} locale={{ emptyText: <Empty description="当前条件下无工单" /> }} columns={[
      ...(metric.filter.semantic ? [{ title: '主题命中依据', key: 'themeReason', width: 220, render: (_: unknown, order: Order) => themeMatchReason(metric.filter.semantic!, order) }] : []),
      { title: '工单编号', dataIndex: 'id', width: 220, render: (v, o) => <Button type="link" size="small" onClick={() => setDetail(o)}>{v}</Button> },
      { title: '受理时间', dataIndex: 'receivedAt', width: 170 }, { title: '渠道', dataIndex: 'channel', width: 110 },
      { title: '分类', dataIndex: 'category', width: 120 }, { title: '街镇', dataIndex: 'street', width: 110 },
      { title: '点位', dataIndex: 'point', width: 240 }, { title: '诉求摘要', dataIndex: 'description', width: 300 },
    ]} />
    <p className="weekly-muted">Excel 导出不受当前页码限制。完整指标依据包含两期口径明细及可复算公式；筛选导出仅包含当前筛选记录。</p>
    <Modal open={!!detail} title="模拟工单详情" onCancel={() => setDetail(undefined)} footer={<Space><Button onClick={() => setDetail(undefined)}>关闭</Button></Space>} width={650}>
      {detail && <Descriptions bordered column={1} size="small" items={[
        { key: 'id', label: '唯一工单编号', children: detail.id }, { key: 'date', label: '受理时间', children: detail.receivedAt },
        { key: 'channel', label: '渠道 / 类型', children: `${detail.channel} / ${detail.business}` }, { key: 'category', label: '诉求分类', children: detail.category },
        { key: 'point', label: '街镇 / 标准点位', children: `${detail.street} / ${detail.point}` }, { key: 'department', label: '承办单位', children: detail.department },
        { key: 'description', label: '脱敏摘要', children: detail.description },
      ]} />}
    </Modal>
  </Drawer>;
}
