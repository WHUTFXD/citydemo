import { metricText, type Analysis, type Metric, type Scope } from './weeklyReport';
import { metricFingerprint } from './metricPlatform';

export const DISPUTE_STATUS = { pending: '待处理', processing: '处理中', resolved: '已处理', rejected: '不予采纳' } as const;
export type DisputeStatus = keyof typeof DISPUTE_STATUS;
export type DisputeAction = { status: DisputeStatus; response: string; at: string };
export type MetricDispute = {
  id: string; fingerprint: string; metric: Metric; valueText: string; scope: Scope; previousScope: Scope;
  comparisonComplete: boolean; reason: string; submittedAt: string; status: DisputeStatus; history: DisputeAction[];
};
export function isOpenDispute(d: MetricDispute) { return d.status === 'pending' || d.status === 'processing'; }
export function disputesFor(items: MetricDispute[], a: Analysis, m: Metric) {
  return items.filter(d => d.fingerprint === metricFingerprint(a, m));
}
export function submitMetricDispute(items: MetricDispute[], a: Analysis, m: Metric, reason: string, id: string, at = new Date().toISOString()): MetricDispute[] {
  const text = reason.trim();
  if (!text || text.length > 500) throw new Error('请填写异议原因（1—500字）');
  if (disputesFor(items, a, m).some(isOpenDispute)) throw new Error('该指标已有待处理申报，请等待管理员回复');
  if (items.some(d => d.id === id)) throw new Error('申报编号重复，请重试');
  const item: MetricDispute = { id, fingerprint: metricFingerprint(a, m), metric: { ...m, filter: { ...m.filter } }, valueText: metricText(m), scope: { ...a.scope }, previousScope: { ...a.previousScope }, comparisonComplete: a.comparisonComplete, reason: text, submittedAt: at, status: 'pending', history: [{ status: 'pending', response: '', at }] };
  return [item, ...items];
}
export function handleMetricDispute(items: MetricDispute[], id: string, status: DisputeStatus, response: string, at = new Date().toISOString()): MetricDispute[] {
  if (!['processing', 'resolved', 'rejected'].includes(status)) throw new Error('请选择有效的处理结果');
  if (!response.trim() || response.trim().length > 500) throw new Error('请填写处理说明（1—500字）');
  const found = items.find(d => d.id === id);
  if (!found) throw new Error('申报记录不存在');
  if (!isOpenDispute(found)) throw new Error('该申报已结束处理');
  return items.map(d => d.id === id ? { ...d, status, history: [...d.history, { status, response: response.trim(), at }] } : d);
}
