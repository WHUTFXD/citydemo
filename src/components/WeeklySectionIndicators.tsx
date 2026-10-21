'use client';

import Link from 'next/link';
import { Tag } from 'antd';
import { metricText, type Analysis, type Metric, type SectionVersion } from '@/lib/weeklyReport';
import { versionMetricIds } from '@/lib/metricPlatform';
import { disputesFor, isOpenDispute } from '@/lib/metricDisputes';
import { useWeeklyWorkspace } from './WeeklyWorkspaceProvider';

export default function WeeklySectionIndicators({ analysis, version, onMetric }: { analysis: Analysis; version: SectionVersion; onMetric: (m: Metric) => void }) {
  const { disputes } = useWeeklyWorkspace();
  const metrics = versionMetricIds(version).map(id => analysis.metrics[id]);
  if (!metrics.length) return null;
  const questions = metrics.filter(m => disputesFor(disputes, analysis, m).some(isOpenDispute)).length;
  return <details className="weekly-section-metrics"><summary>指标依据：{metrics.length} 项{questions ? <span className="metric-question-count"> · {questions} 项异议处理中</span> : null}<span className="weekly-muted"> · 展开查看</span></summary><div className="weekly-section-metric-list">{metrics.map(m => {
    const hasDispute = disputesFor(disputes, analysis, m).some(isOpenDispute);
    return <button key={m.id} onClick={() => onMetric(m)}><span>{m.label}</span><strong>{metricText(m)}</strong>{hasDispute && <Tag color="orange">异议处理中</Tag>}</button>;
  })}<Link href="/indicators">维护指标定义与统计口径 →</Link></div></details>;
}
