'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Modal, Select, Tag } from 'antd';
import { diffText, versionMetricIds, versionText } from '@/lib/metricPlatform';
import type { Analysis, ReportSection, SectionVersion } from '@/lib/weeklyReport';

export default function WeeklyRewriteComparison({ section, analysis, candidate, onClose, onAdopt }: { section: ReportSection; analysis: Analysis; candidate?: SectionVersion; onClose: () => void; onAdopt: (version: SectionVersion) => void }) {
  const [leftIndex, setLeftIndex] = useState(candidate ? section.active : Math.max(0, section.active - 1));
  const [rightIndex, setRightIndex] = useState(section.active || section.versions.length - 1);
  const left = section.versions[leftIndex], right = candidate || section.versions[rightIndex];
  const before = versionText(left, analysis), after = versionText(right, analysis);
  const diff = useMemo(() => diffText(before, after), [before, after]);
  const oldIds = versionMetricIds(left), newIds = versionMetricIds(right);
  const added = newIds.filter(id => !oldIds.includes(id)).length, removed = oldIds.filter(id => !newIds.includes(id)).length;
  const options = section.versions.map((v, i) => ({ value: i, label: `v${v.number}${i === section.active ? ' · 当前采用' : ''}` }));
  const changed = before !== after;
  return <Modal open style={{ top: 24 }} title={`${candidate ? '重写前后对照' : '历史版本对照'} · ${section.title}`} onCancel={onClose} width={1100} className="weekly-diff-modal" footer={<div className="weekly-diff-footer"><span>{candidate ? '采用后新增版本，原版本保留。' : '选择历史版本后恢复其正文，指标仍引用当前报告快照。'}</span><Button onClick={onClose}>{candidate ? '放弃本次重写' : '关闭'}</Button><Button type="primary" disabled={!candidate && rightIndex === section.active} onClick={() => onAdopt(right)}>{candidate ? '采用新版本' : '采用右侧版本'}</Button></div>}>
    <Alert showIcon type="info" title="统计指标仍引用同一份数据快照，文字调整不会重新计算或修改原始数值。" description={`指标引用：原版本 ${oldIds.length} 项，新版本 ${newIds.length} 项；新增引用 ${added} 项，移除引用 ${removed} 项。同一指标的异议申报仍可查看。`} />
    {!changed && <Alert type="warning" showIcon title="两个版本的文字相同，可调整写作要求后重试。" style={{ marginTop: 12 }} />}
    <div className="weekly-diff-legend"><span><i className="removed" />删除文字</span><span><i className="added" />新增文字</span><span>未高亮部分保持不变</span>{right.modes.map(mode => <Tag key={mode}>{mode}</Tag>)}</div>
    <div className="weekly-diff-columns"><div><header><strong>原版本</strong><Select aria-label="对照左侧版本" value={leftIndex} onChange={setLeftIndex} options={options} disabled={!!candidate} /></header><div className="weekly-diff-text">{diff.filter(p => p.kind !== 'added').map((p, i) => <span key={i} className={p.kind}>{p.text}</span>)}</div></div><div><header><strong>{candidate ? '待采用的新版本' : '对照版本'}</strong>{candidate ? <Tag color="blue">v{candidate.number} · 候选</Tag> : <Select aria-label="对照右侧版本" value={rightIndex} onChange={setRightIndex} options={options} />}</header><div className="weekly-diff-text">{diff.filter(p => p.kind !== 'removed').map((p, i) => <span key={i} className={p.kind}>{p.text}</span>)}</div></div></div>
  </Modal>;
}
