'use client';

import ReportDocumentHeader from './ReportDocumentHeader';
import { Modal, Tag } from 'antd';
import { BLOCK_SLOTS, SLOT_LABELS, REPORT_TYPES, usedDefinitions, type ReportTemplate } from '@/lib/reportTemplates';
import { definitionFormula, type IndicatorDefinition } from '@/lib/indicatorDefinitions';
export default function ReportTemplatePreview({ template, definitions, onClose }: { template: ReportTemplate; definitions: IndicatorDefinition[]; onClose: () => void }) {
  return <Modal open title={`模板预览 · ${template.name}`} onCancel={onClose} footer={null} width={850}>
    <div className="template-preview-paper"><ReportDocumentHeader masthead="闵行区城运工单分析" issue={`${REPORT_TYPES[template.type]}（模板预览）`} cutoff="统计日期由生成设置确定" /><h2>城运{REPORT_TYPES[template.type]}</h2><p className="weekly-muted">模拟数据 · 模板 v{template.version}</p>
      {template.blocks.map((block, i) => <section key={block.id}><h3>{i + 1}、{block.title}</h3>{block.kind === 'topics' && <p className="weekly-muted">按已选主题逐项展开。</p>}<p style={{ whiteSpace: 'pre-wrap' }}>{block.body || '正文根据所绑定指标及所选主题生成。'}</p>{BLOCK_SLOTS[block.kind].map(slot => {
        const d = definitions.find(d => d.id === block.bindings[slot]);
        return <div className="template-binding-row" key={slot}><span>{SLOT_LABELS[slot]}</span><Tag color={d?.enabled ? 'blue' : 'red'}>{d ? `${d.name} · ${d.code} · v${d.version}${d.enabled ? '' : '（已停用）'}` : '指标缺失'}</Tag><small>{d ? definitionFormula(d) : '请重新绑定'}</small></div>;
      })}{block.kind === 'custom' && (() => { try { return usedDefinitions(block, definitions).map(d => <Tag key={d.id} color={d.enabled ? 'blue' : 'red'}>{d.code} · {d.name}{d.enabled ? '' : '（已停用）'}</Tag>); } catch { return <Tag color="red">存在未关联的指标，请编辑模板</Tag>; } })()}</section>)}
    </div>
  </Modal>;
}
