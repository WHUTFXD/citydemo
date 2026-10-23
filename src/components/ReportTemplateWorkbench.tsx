'use client';

import { useState } from 'react';
import Link from 'next/link';
import { App, Button, Card, Drawer, Empty, Input, Popconfirm, Select, Space, Tag } from 'antd';
import { DeleteOutlined, DownOutlined, EyeOutlined, PlusOutlined, UpOutlined } from '@ant-design/icons';
import BriefingShell from './BriefingShell';
import { useWeeklyWorkspace } from './WeeklyWorkspaceProvider';
import ReportTemplatePreview from './ReportTemplatePreview';
import { BLOCK_LABELS, BLOCK_SLOTS, newBlock, REPORT_TYPES, SLOT_LABELS, type ReportTemplate, type ReportType, type TemplateBlock } from '@/lib/reportTemplates';

export default function ReportTemplateWorkbench() {
  const { templates, definitions, saveTemplate, deleteTemplate, storageReady, storageAvailable } = useWeeklyWorkspace();
  const { message } = App.useApp();
  const [search, setSearch] = useState(''), [type, setType] = useState<ReportType>();
  const [editor, setEditor] = useState<ReportTemplate>(), [preview, setPreview] = useState<ReportTemplate>();
  const filtered = templates.filter(t => (!type || t.type === type) && `${t.name}${t.description}`.includes(search.trim()));
  function editBlock(index: number, patch: Partial<TemplateBlock>) { setEditor(t => t && ({ ...t, blocks: t.blocks.map((b, i) => i === index ? { ...b, ...patch } : b) })); }
  function move(index: number, offset: number) {
    setEditor(t => { if (!t) return t; const blocks = [...t.blocks]; [blocks[index], blocks[index + offset]] = [blocks[index + offset], blocks[index]]; return { ...t, blocks }; });
  }
  return <BriefingShell><div className="weekly-workbench"><header className="weekly-heading"><div><h1>模板管理</h1><p>配置报告结构与取数指标，日报、周报和专题报各有模板。</p></div><Space><Link href="/indicators">指标台</Link><Link href="/briefing">返回报告</Link><Button disabled={!storageReady} type="primary" icon={<PlusOutlined />} onClick={() => setEditor({ id: crypto.randomUUID(), name: '', description: '', type: type || 'weekly', version: 0, updatedAt: '', blocks: [newBlock('overview', crypto.randomUUID())] })}>新增模板</Button></Space></header>
    <div className="template-manager-content"><div className="template-manager-search"><Input aria-label="搜索模板" placeholder="搜索名称或用途" value={search} onChange={e => setSearch(e.target.value)} allowClear /><Select aria-label="筛选报表类型" value={type} onChange={setType} allowClear placeholder="全部报表类型" options={Object.entries(REPORT_TYPES).map(([value, label]) => ({ value, label }))} /></div>
      {!storageAvailable && <p className="weekly-warning">浏览器存储不可用，模板仅在本次会话保留。</p>}
      <div className="template-card-grid">{filtered.map(t => <Card key={t.id} title={t.name} extra={<Tag color="blue">{REPORT_TYPES[t.type]} · v{t.version}</Tag>}><p>{t.description || '暂无用途说明'}</p><div className="template-structure">{t.blocks.map(b => <Tag key={b.id}>{b.title}</Tag>)}</div><Space wrap><Button icon={<EyeOutlined />} onClick={() => setPreview(t)}>预览</Button><Button onClick={() => setEditor(structuredClone(t))}>编辑</Button><Button onClick={() => setEditor({ ...structuredClone(t), id: crypto.randomUUID(), name: `${t.name}副本`, version: 0 })}>复制</Button><Popconfirm title="删除这个模板？" description="已生成的报告保留原模板快照。" okText="删除" cancelText="取消" onConfirm={() => { deleteTemplate(t.id); message.success('模板已删除'); }}><Button danger icon={<DeleteOutlined />}>删除</Button></Popconfirm></Space></Card>)}</div>{!filtered.length && <Empty description="暂无模板，可新增后用于报告生成" />}
    </div>
    <Drawer open={!!editor} onClose={() => setEditor(undefined)} title={editor?.version ? '编辑模板' : '新增模板'} size={850} footer={<Space><Button onClick={() => setEditor(undefined)}>取消</Button><Button onClick={() => editor && setPreview(editor)}>预览结构</Button><Button type="primary" onClick={() => { if (!editor) return; try { saveTemplate(editor); setEditor(undefined); message.success('模板已保存，取数指标已绑定'); } catch (error) { message.warning((error as Error).message); } }}>保存模板</Button></Space>}>
      {editor && <div className="template-editor"><label>模板名称</label><Input aria-label="模板名称" value={editor.name} maxLength={60} onChange={e => setEditor({ ...editor, name: e.target.value })} /><label>报表类型</label><Select aria-label="模板报表类型" value={editor.type} options={Object.entries(REPORT_TYPES).map(([value, label]) => ({ value, label }))} onChange={type => setEditor({ ...editor, type })} /><label>用途说明</label><Input aria-label="模板用途" value={editor.description} maxLength={200} onChange={e => setEditor({ ...editor, description: e.target.value })} />
        <p className="weekly-muted">系统板块配置相应取数槽位；自定义板块可插入指标编号占位符。所有取数指标均来自指标台，停用或缺失的指标不能生成报告。</p>
        {editor.blocks.map((block, index) => <Card key={block.id} size="small" className="template-editor-block" title={`板块 ${index + 1}`} extra={<Space><Button aria-label={`上移板块${index + 1}`} size="small" disabled={!index} icon={<UpOutlined />} onClick={() => move(index, -1)} /><Button aria-label={`下移板块${index + 1}`} size="small" disabled={index === editor.blocks.length - 1} icon={<DownOutlined />} onClick={() => move(index, 1)} /><Button danger size="small" aria-label={`删除板块${index + 1}`} icon={<DeleteOutlined />} onClick={() => setEditor({ ...editor, blocks: editor.blocks.filter(b => b.id !== block.id) })} /></Space>}>
          <label>板块类型</label><Select aria-label={`板块${index + 1}类型`} value={block.kind} options={Object.entries(BLOCK_LABELS).map(([value, label]) => ({ value, label }))} onChange={kind => editBlock(index, { ...newBlock(kind, block.id) })} /><label>板块标题</label><Input aria-label={`板块${index + 1}标题`} value={block.title} maxLength={60} onChange={e => editBlock(index, { title: e.target.value })} />
          {BLOCK_SLOTS[block.kind].map(slot => <div key={slot}><label>{SLOT_LABELS[slot]} · 绑定指标</label><Select aria-label={`板块${index + 1}${SLOT_LABELS[slot]}`} value={block.bindings[slot]} showSearch optionFilterProp="label" options={definitions.filter(d => d.enabled && (block.kind !== 'praise' || d.business === '表扬感谢') && d.kind === (slot === 'previous' ? 'count' : slot) && d.period === (slot === 'previous' ? 'previous' : 'current') && (!['topics', 'tracking'].includes(block.kind) || (!d.category && !d.point))).map(d => ({ value: d.id, label: `${d.name} · ${d.code} · v${d.version}` }))} onChange={id => editBlock(index, { bindings: { ...block.bindings, [slot]: id } })} /></div>)}
          <label>{block.kind === 'custom' ? '正文与指标占位符' : '补充说明（纯文字）'}</label><Input.TextArea aria-label={`板块${index + 1}正文`} rows={3} maxLength={3000} value={block.body} onChange={e => editBlock(index, { body: e.target.value })} />
          {block.kind === 'custom' && <Select aria-label={`板块${index + 1}插入指标`} placeholder="选择指标并插入正文" value={null} showSearch optionFilterProp="label" options={definitions.filter(d => d.enabled).map(d => ({ value: d.code, label: `${d.name} · ${d.code}` }))} onChange={code => editBlock(index, { body: block.body + `{{${code}}}` })} />}
        </Card>)}<Button block disabled={editor.blocks.length >= 12} icon={<PlusOutlined />} onClick={() => setEditor({ ...editor, blocks: [...editor.blocks, newBlock('custom', crypto.randomUUID())] })}>新增板块</Button>
      </div>}
    </Drawer>{preview && <ReportTemplatePreview template={preview} definitions={definitions} onClose={() => setPreview(undefined)} />}
  </div></BriefingShell>;
}
