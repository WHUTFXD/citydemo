'use client';

import { useMemo, useState } from 'react';
import { Alert, App, Breadcrumb, Button, Drawer, Empty, Input, Radio, Space, Table, Tabs, Tag } from 'antd';
import { DownloadOutlined, SearchOutlined } from '@ant-design/icons';
import { reviewedRows, reviewThemeOrders, themeResult, topicChildren } from '@/lib/briefingAnalysis';
import { registerMetric, type Analysis, type Order } from '@/lib/weeklyReport';
import type { ReportTheme } from '@/lib/reportTemplates';
import { themeRuleDescription } from '@/lib/themeMatching';
import { useWeeklyWorkspace } from './WeeklyWorkspaceProvider';

export default function ThemeExplorerDrawer({ analysis, theme, onClose, onChoose }: { analysis: Analysis; theme: ReportTheme; onClose: () => void; onChoose?: (theme: ReportTheme) => void }) {
  const { message } = App.useApp();
  const { customThemes, setCustomThemes } = useWeeklyWorkspace();
  const [stack, setStack] = useState([theme]), [mode, setMode] = useState<'classification' | 'semantic'>('classification');
  const [period, setPeriod] = useState<'current' | 'previous'>('current'), [search, setSearch] = useState(''), [onlyPending, setOnlyPending] = useState(false), [page, setPage] = useState(1), [exporting, setExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const selected = stack.at(-1)!;
  const saved = customThemes.find(t => t.id === selected.id) || customThemes.find(t => t.filter.semantic && t.filter.semantic.topic === selected.filter.semantic?.topic);
  const current: ReportTheme = { ...selected, filter: { ...selected.filter, reviewOverrides: saved?.filter.reviewOverrides || selected.filter.reviewOverrides } };
  const key = JSON.stringify(current.filter);
  const result = useMemo(() => themeResult(analysis, current), [analysis, key]); // eslint-disable-line react-hooks/exhaustive-deps
  const children = useMemo(() => topicChildren(analysis, current, mode), [analysis, key, mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const rows = useMemo(() => reviewedRows(period === 'current' ? analysis.current : analysis.previous, current.filter), [analysis, key, period]); // eslint-disable-line react-hooks/exhaustive-deps
  const pending = rows.filter(o => o.assessment.state === 'pending').length;
  const filtered = rows.filter(o => (!onlyPending || o.assessment.state === 'pending') && (!search.trim() || [o.id, o.description, o.point].some(v => v.includes(search.trim()))));
  const pendingIds = filtered.filter(o => o.assessment.state === 'pending').map(o => o.id);
  const pendingSet = new Set(pendingIds);
  const checkedIds = selectedIds.filter(id => pendingSet.has(id));
  const pageRows = filtered.slice((page - 1) * 20, page * 20);
  const pagePendingIds = pageRows.filter(o => o.assessment.state === 'pending').map(o => o.id);
  function review(order: Order, decision: 'include' | 'exclude') {
    setCustomThemes(items => reviewThemeOrders(items, current, [order.id], decision));
    setSelectedIds(ids => ids.filter(id => id !== order.id));
    setPage(1); message.success(decision === 'include' ? '已确认计入当前主题，已有报告请重新生成' : '已排除该工单，已有报告请重新生成');
  }
  function reviewSelected(decision: 'include' | 'exclude') {
    if (!checkedIds.length) return;
    setCustomThemes(items => reviewThemeOrders(items, current, checkedIds, decision));
    setSelectedIds([]); setPage(1);
    message.success(`已批量${decision === 'include' ? '计入' : '排除'}${checkedIds.length}条待核对工单，已有报告请重新生成`);
  }
  async function exportRows() {
    if (exporting) return; setExporting(true);
    try {
      const token = registerMetric(analysis, 'count', current.filter) as { metricId: string };
      const worker = new Worker(new URL('../workers/weeklyReportExport.worker.ts', import.meta.url));
      const blob = await new Promise<Blob>((resolve, reject) => {
        worker.onmessage = (e: MessageEvent<{ blob?: Blob; error?: string }>) => { worker.terminate(); if (e.data.blob) resolve(e.data.blob); else reject(new Error(e.data.error)); };
        worker.onerror = () => { worker.terminate(); reject(new Error('导出失败')); };
        worker.postMessage({ analysis, metric: analysis.metrics[token.metricId] });
      });
      const { downloadBlob } = await import('@/lib/weeklyReportExport'); downloadBlob(blob, `${current.name.slice(0, 35)}_工单核验.xlsx`);
    } catch (e) { message.error((e as Error).message); } finally { setExporting(false); }
  }
  return <Drawer open onClose={onClose} title="主题下钻与工单核对" size={1100} extra={<Space><Button icon={<DownloadOutlined />} loading={exporting} disabled={exporting} onClick={exportRows}>导出核验 Excel</Button>{onChoose && <Button type="primary" onClick={() => onChoose(current)}>选入本次报告</Button>}</Space>}>
    <Breadcrumb items={stack.map((item, i) => ({ title: <button style={{ border: 0, background: 'transparent', cursor: 'pointer', color: '#527da9' }} onClick={() => { setStack(items => items.slice(0, i + 1)); setPage(1); setSelectedIds([]); }}>{item.name}</button> }))} />
    <div className="theme-explorer-heading"><h2>{current.name}</h2><p>{current.path || '自定义主题'} · {analysis.scope.start} 至 {analysis.scope.end}</p></div><div className="theme-explorer-stats"><span><strong>{result.count.toLocaleString()}</strong>本期已计入</span><span><strong>{result.previous.toLocaleString()}</strong>上期同口径</span><span className="briefing-pending-badge">当前周期待核对 {pending.toLocaleString()} 条</span></div>
    {current.filter.semantic && <Alert type="info" showIcon title="待核对暂不计入主题统计" description="核对后请重新生成报告；刷新页面将清空核对结果。" />}
    <Tabs activeKey={mode} onChange={value => setMode(value as typeof mode)} items={[{ key: 'classification', label: '按下级分类细分' }, { key: 'semantic', label: '按工单描述细分' }]} />
    {children.length ? <div className="theme-child-grid">{children.map(child => <button className="theme-child" key={child.id} onClick={() => { setStack(items => [...items, child]); setPage(1); setSelectedIds([]); setSearch(''); }}><strong>{child.name}</strong><small>本期 {child.count.toLocaleString()} 件</small></button>)}</div> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={mode === 'classification' ? <span>无下级分类。<Button type="link" onClick={() => setMode('semantic')}>继续按工单描述细分</Button></span> : '暂无细分结果'} />}
    {mode === 'semantic' && <p className="briefing-subtle">分组可能交叉，数量不可相加。</p>}
    <div className="theme-evidence-toolbar"><h3 style={{ margin: 0 }}>相关工单 <Tag color={pending ? 'orange' : 'default'}>待核对 {pending}</Tag></h3><Radio.Group value={period} onChange={e => { setPeriod(e.target.value); setPage(1); setSelectedIds([]); }} options={[{ value: 'current', label: '本期' }, { value: 'previous', label: '上期' }]} optionType="button" /><Input allowClear prefix={<SearchOutlined />} value={search} onChange={e => { setSearch(e.target.value); setPage(1); setSelectedIds([]); }} placeholder="搜索工单编号、点位或描述" /></div>
    <Space style={{ marginBottom: 12 }}><Button size="small" type={onlyPending ? 'primary' : 'default'} onClick={() => { setOnlyPending(!onlyPending); setPage(1); setSelectedIds([]); }}>{onlyPending ? '显示全部相关工单' : '只看待核对'}</Button></Space>
    {current.filter.semantic && <div className="theme-bulk-review" role="region" aria-label="待核对批量操作"><div className="theme-bulk-selection"><strong aria-live="polite">已选择 {checkedIds.length} 条待核对</strong><Space wrap><Button size="small" disabled={!pagePendingIds.length} onClick={() => setSelectedIds(ids => [...new Set([...ids, ...pagePendingIds])])}>全选本页待核对</Button><Button size="small" disabled={!pendingIds.length} onClick={() => setSelectedIds(pendingIds)}>{search.trim() ? '全选筛选结果中的待核对' : '全选全部待核对'}（{pendingIds.length}）</Button><Button size="small" type="text" disabled={!checkedIds.length} onClick={() => setSelectedIds([])}>清空选择</Button></Space></div><Space wrap><Button type="primary" disabled={!checkedIds.length} onClick={() => reviewSelected('include')}>批量计入</Button><Button disabled={!checkedIds.length} onClick={() => reviewSelected('exclude')}>批量排除</Button></Space><p>全选范围：{period === 'current' ? '本期' : '上期'} · 当前搜索结果 · 所有分页。切换范围将清空选择。</p></div>}
    <Table rowKey="id" size="small" scroll={{ x: 1200 }} dataSource={pageRows} rowSelection={current.filter.semantic ? {
      selectedRowKeys: checkedIds, preserveSelectedRowKeys: true, columnWidth: 48, fixed: true,
      onChange: keys => setSelectedIds(keys.map(String).filter(id => pendingSet.has(id))),
      getCheckboxProps: row => ({ disabled: row.assessment.state !== 'pending', 'aria-label': `选择待核对工单${row.id}` }),
      getTitleCheckboxProps: () => ({ 'aria-label': '全选本页待核对工单' }),
    } : undefined} rowClassName={o => o.assessment.state === 'pending' ? 'theme-pending-row' : ''} pagination={{ current: page, pageSize: 20, total: filtered.length, onChange: setPage, showSizeChanger: false, showTotal: count => `${count}条相关工单` }} columns={[
      { title: '归属状态', width: 135, render: (_, o) => <Tag color={o.assessment.state === 'pending' ? 'orange' : 'green'}>{o.assessment.state === 'pending' ? '待核对 · 暂未计入' : '已计入'}</Tag> },
      { title: '工单编号 / 时间', width: 215, render: (_, o) => <span>{o.id}<small style={{ display: 'block', color: '#9aa8b9' }}>{o.receivedAt}</small></span> },
      { title: '诉求描述', dataIndex: 'description', width: 360 }, { title: '点位', dataIndex: 'point', width: 180 },
      { title: '归属依据', width: 180, render: (_, o) => o.assessment.reason },
      { title: '人工核对', fixed: 'right', width: 170, render: (_, o) => current.filter.semantic ? <div className="theme-review-actions"><Button size="small" type={current.filter.reviewOverrides?.[o.id] === 'include' ? 'primary' : 'default'} onClick={() => review(o, 'include')}>计入</Button><Button size="small" onClick={() => review(o, 'exclude')}>排除</Button></div> : <span className="briefing-subtle">按分类直接匹配</span> },
    ]} />
    {current.filter.semantic && <details style={{ marginTop: 20, color: '#8b9bb1', fontSize: 11 }}><summary>查看主题识别口径</summary><p>{themeRuleDescription(current.filter.semantic)}</p></details>}
  </Drawer>;
}
