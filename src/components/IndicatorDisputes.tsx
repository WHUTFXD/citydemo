'use client';

import { useState } from 'react';
import { Alert, App, Button, Descriptions, Drawer, Empty, Input, Select, Space, Table, Tag, Timeline } from 'antd';
import { useWeeklyWorkspace } from './WeeklyWorkspaceProvider';
import { DISPUTE_STATUS, isOpenDispute, type DisputeStatus, type MetricDispute } from '@/lib/metricDisputes';

const time = (value: string) => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
export default function IndicatorDisputes() {
  const { disputes, handleDispute, storageReady } = useWeeklyWorkspace();
  const { message } = App.useApp();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const [selectedId, setSelectedId] = useState<string>();
  const [nextStatus, setNextStatus] = useState<DisputeStatus>('processing');
  const [response, setResponse] = useState('');
  const selected = disputes.find(d => d.id === selectedId);
  const rows = disputes.filter(d => (status === 'all' || d.status === status) && (!search.trim() || `${d.metric.label} ${d.reason} ${d.scope.channel}`.includes(search.trim())));
  function open(record: MetricDispute) { setSelectedId(record.id); setResponse(''); setNextStatus('processing'); }
  function save() {
    if (!selected) return;
    try { handleDispute(selected.id, nextStatus, response); setResponse(''); message.success('处理记录已保存，周报中的申报状态同步更新'); }
    catch (error) { message.warning((error as Error).message); }
  }
  return <section className="indicator-panel">
    <div className="indicator-panel-heading"><div><h2>异议申报记录</h2></div><Tag color="orange">待处理 {disputes.filter(isOpenDispute).length} 项</Tag></div>
    <Alert type="info" showIcon title="刷新后清空申报及回复；处理结果不改变指标值。" style={{ marginBottom: 18 }} />
    <div className="indicator-search"><Input aria-label="搜索异议申报" value={search} onChange={e => setSearch(e.target.value)} allowClear placeholder="搜索指标名称、原因或渠道" /><Select aria-label="申报处理状态" value={status} onChange={setStatus} options={[{ value: 'all', label: '全部状态' }, ...Object.entries(DISPUTE_STATUS).map(([value, label]) => ({ value, label }))]} /></div>
    <Table<MetricDispute> rowKey="id" dataSource={rows} loading={!storageReady} scroll={{ x: 1080 }} pagination={{ pageSize: 10, showTotal: n => `共 ${n} 项申报` }} locale={{ emptyText: <Empty description="暂无异议申报" /> }} columns={[
      { title: '指标 / 申报时数值', width: 180, render: (_, d) => <div><strong>{d.metric.label}</strong><div className="weekly-muted">{d.valueText}{d.metric.kind === 'count' ? ' 件' : d.metric.kind === 'daily' ? ' 件/天' : ''}</div></div> },
      { title: '统计范围', width: 210, render: (_, d) => <div>{d.scope.start} — {d.scope.end}<div className="weekly-muted">{d.scope.channel}</div></div> },
      { title: '异议原因', dataIndex: 'reason', width: 260 },
      { title: '状态', width: 100, render: (_, d) => <Tag color={isOpenDispute(d) ? 'orange' : d.status === 'resolved' ? 'green' : 'default'}>{DISPUTE_STATUS[d.status]}</Tag> },
      { title: '提交时间', width: 180, render: (_, d) => time(d.submittedAt) },
      { title: '操作', width: 90, fixed: 'right', render: (_, d) => <Button type="link" onClick={() => open(d)}>{isOpenDispute(d) ? '查看处理' : '查看记录'}</Button> },
    ]} />
    <Drawer open={!!selected} title="异议申报详情" onClose={() => setSelectedId(undefined)} size={720}>
      {selected && <><Descriptions bordered column={1} size="small" items={[
        { key: 'id', label: '申报编号', children: selected.id },
        { key: 'metric', label: '指标名称', children: selected.metric.label },
        { key: 'value', label: '申报时数值', children: `${selected.valueText}${selected.metric.kind === 'count' ? ' 件' : selected.metric.kind === 'daily' ? ' 件/天' : ''}` },
        { key: 'scope', label: '本期范围', children: `${selected.scope.start} 至 ${selected.scope.end} · ${selected.scope.channel}` },
        { key: 'previous', label: '比较期', children: `${selected.previousScope.start} 至 ${selected.previousScope.end}（${selected.comparisonComplete ? '完整' : '不完整'}）` },
        { key: 'period', label: '指标所属周期', children: selected.metric.period === 'current' ? '本期' : '比较期' },
        { key: 'filter', label: '筛选条件', children: Object.values(selected.metric.filter).filter(Boolean).join(' / ') || '全部工单' },
        { key: 'formula', label: '计算公式', children: selected.metric.formula },
        { key: 'rule', label: '统计规则', children: '上海时间完整自然日，唯一工单编号去重；日均和百分比保留一位小数。' },
        { key: 'reason', label: '异议原因', children: selected.reason },
      ]} />
      <h3 style={{ margin: '24px 0 18px' }}>处理记录</h3><Timeline items={selected.history.map(h => ({ color: h.status === 'resolved' ? 'green' : 'blue', content: <div><strong>{DISPUTE_STATUS[h.status]}</strong><p>{h.response || '用户提交异议，进入管理员待办。'}</p><small className="weekly-muted">{time(h.at)}</small></div> }))} />
      {isOpenDispute(selected) && <div className="metric-review-form"><h3>管理员回复</h3><Space orientation="vertical" style={{ width: '100%' }}><Select aria-label="管理员处理结果" value={nextStatus} onChange={setNextStatus} style={{ width: 180 }} options={(['processing', 'resolved', 'rejected'] as const).map(value => ({ value, label: DISPUTE_STATUS[value] }))} /><Input.TextArea aria-label="管理员处理说明" value={response} onChange={e => setResponse(e.target.value)} maxLength={500} showCount rows={4} placeholder="填写核查进展或处理结论。若需修正数据，请说明后续修正措施。" /><Button type="primary" disabled={!storageReady} onClick={save}>保存处理结果</Button><p className="weekly-muted">回复和状态不会改变指标值。</p></Space></div>}
      </>}
    </Drawer>
  </section>;
}
