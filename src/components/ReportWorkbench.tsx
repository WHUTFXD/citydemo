'use client';

import { getTrialSampleOrders } from '@/lib/trialData';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import { Alert, App, Button, Checkbox, DatePicker, Empty, Input, Progress, Segmented, Select, Space, Steps, Tabs, Tag } from 'antd';
import { CheckCircleOutlined, CopyOutlined, DownloadOutlined, EyeOutlined, FileTextOutlined, MessageOutlined, ThunderboltOutlined } from '@ant-design/icons';
import BriefingShell from './BriefingShell';
import ReportDocumentHeader from './ReportDocumentHeader';
import ReportTemplatePreview from './ReportTemplatePreview';
import ReportInsightAssistant from './ReportInsightAssistant';
import WeeklyEvidenceDrawer from './WeeklyEvidenceDrawer';
import ThemeExplorerDrawer from './ThemeExplorerDrawer';
import WordCloudAnalysis from './WordCloudAnalysis';
import { useWeeklyWorkspace } from './WeeklyWorkspaceProvider';
import { analyze, dayCount, metricText, registerMetric, shiftDate, textOf, validateScope, type Analysis, type Metric, type Token } from '@/lib/weeklyReport';
import { configurationKey, generateTemplateReport, registerDefinitionMetric, REPORT_TYPES, validateTemplate, type ReportTemplate, type ReportTheme, type ThemeResult } from '@/lib/reportTemplates';
import { classificationThemes, customTheme, resolveQuestionScope, reviewedRows, themeResult } from '@/lib/briefingAnalysis';
import { reportDocumentStyle } from '@/lib/reportDocumentStyle';
import type { WordFrequency } from '@/lib/textDiscovery';

const stages = ['读取本期与比较期全部工单', '对照市级与区级分类', '归集语义线索与统计词频', '整理五类分析结果'];
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export default function ReportWorkbench({ mode = 'weekly' }: { mode?: 'weekly' | 'topic' }) {
  const { message } = App.useApp();
  const w = useWeeklyWorkspace();
  const { scope, setScope, analysis, setAnalysis, report, setReport, definitions, templates, templateId, setTemplateId, customThemes, setCustomThemes, selectedThemeIds, setSelectedThemeIds, sourceOrders, dataRevision, coverage, datasetName, dataKind, topicSource, setTopicSource, taxonomy, setTaxonomy, storageReady } = w;
  const reportType = mode === 'topic' ? 'topic' : w.reportType === 'daily' ? 'daily' : 'weekly';
  const [view, setView] = useState<'analysis' | 'report'>('analysis'), [busy, setBusy] = useState(''), [phase, setPhase] = useState(0);
  const [preview, setPreview] = useState<ReportTemplate>(), [metric, setMetric] = useState<Metric>(), [explore, setExplore] = useState<ReportTheme>();
  const [frequency, setFrequency] = useState<'on-demand' | 'daily'>('on-demand');
  const [panel, setPanel] = useState<'city' | 'district' | 'custom' | 'semantic' | 'words'>(topicSource === 'custom' ? 'custom' : taxonomy);
  const [wordContext, setWordContext] = useState<WordFrequency>();
  const [textAnalysis, setTextAnalysis] = useState<{ analysis: Analysis; words: WordFrequency[]; semantics: ThemeResult[]; error?: string }>();
  const [topicText, setTopicText] = useState(''), [category, setCategory] = useState<string>();
  const [insightOpen, setInsightOpen] = useState(false), [insightContext, setInsightContext] = useState<string>();
  const lock = useRef(false);
  const orders = useMemo(() => sourceOrders || getTrialSampleOrders(), [sourceOrders]);
  const available = templates.filter(t => t.type === reportType), template = available.find(t => t.id === templateId) || available[0];
  const city = useMemo(() => analysis ? classificationThemes(analysis, 'city') : [], [analysis]);
  const district = useMemo(() => analysis ? classificationThemes(analysis, 'district') : [], [analysis]);
  useEffect(() => {
    if (!analysis) return;
    const worker = new Worker(new URL('../workers/textDiscovery.worker.ts', import.meta.url));
    worker.onmessage = (e: MessageEvent<{ words?: WordFrequency[]; semantics?: ThemeResult[]; error?: string }>) => {
      setTextAnalysis({ analysis, words: e.data.words || [], semantics: e.data.semantics || [], error: e.data.error }); worker.terminate();
    };
    worker.onerror = () => { setTextAnalysis({ analysis, words: [], semantics: [], error: '文本分析失败，请重新分析本期工单' }); worker.terminate(); };
    worker.postMessage(analysis);
    return () => worker.terminate();
  }, [analysis]);
  const textReady = textAnalysis?.analysis === analysis;
  const words = useMemo(() => textReady ? textAnalysis?.words || [] : [], [textReady, textAnalysis]);
  const semantics = useMemo(() => textReady ? textAnalysis?.semantics || [] : [], [textReady, textAnalysis]);
  const pool = useMemo(() => [...new Map([...city, ...district, ...semantics, ...(report?.themes || []), ...customThemes].map(t => [t.id, t])).values()], [city, district, semantics, report?.themes, customThemes]);
  const chosen = selectedThemeIds.flatMap(id => pool.find(t => t.id === id) || []);
  const selectedThemes: ReportTheme[] = chosen.map(t => { const { id, name, group, filter, source, custom, note, taxonomy, path, parentId } = t; return { id, name, group, filter, source, custom, note, taxonomy, path, parentId }; });
  const dirty = !!analysis && (analysis.key !== `${scope.start}/${scope.end}/${scope.channel}` || (analysis.dataRevision || 0) !== dataRevision);
  let settingDirty = false;
  try { settingDirty = !!report && ((report.cadence || 'on-demand') !== (mode === 'topic' ? frequency : 'on-demand') || !template || report.configurationKey !== configurationKey(template, definitions, selectedThemes)); } catch { settingDirty = true; }
  const invalid = dirty || settingDirty || !template, disabled = !!busy;
  const style = report ? reportDocumentStyle(report) : undefined;
  const pending = analysis ? new Set(chosen.flatMap(t => t.filter.semantic ? reviewedRows(analysis.current, t.filter).filter(o => o.assessment.state === 'pending').map(o => o.id) : [])).size : 0;
  const selectedSet = new Set(selectedThemeIds);
  function selectTheme(theme: ReportTheme) {
    if (selectedSet.has(theme.id)) { setSelectedThemeIds(ids => ids.filter(id => id !== theme.id)); return; }
    let ids = selectedThemeIds.filter(id => !!pool.find(t => t.id === id)?.custom === !!theme.custom);
    if (theme.parentId) ids = ids.filter(id => !theme.id.startsWith(id + '/'));
    ids = ids.filter(id => !id.startsWith(theme.id + '/'));
    if (theme.custom) ids = ids.filter(id => !pool.find(t => t.id === id)?.custom || id === theme.parentId);
    if (ids.length >= 6) { message.warning('本次最多选择6个主题'); return; }
    setTopicSource(theme.custom ? 'custom' : 'recommended');
    setCustomThemes(items => [...items.filter(t => t.id !== theme.id), theme]); setSelectedThemeIds([...ids, theme.id]);
  }
  function switchPanel(value: string) {
    setPanel(value as typeof panel);
    if (value === 'city' || value === 'district') setTaxonomy(value);
  }
  function inspectWord(word: WordFrequency) {
    if (!analysis) return;
    const token = registerMetric(analysis, 'count', { textGroups: [[word.word]] }) as { metricId: string };
    setWordContext(word); setMetric({ ...analysis.metrics[token.metricId], label: `词云 · ${word.word} · 去重工单量` });
  }
  async function runAnalysis() {
    if (lock.current) return;
    try { validateScope(scope, coverage); } catch (e) { message.warning((e as Error).message); return; }
    lock.current = true; setBusy('analysis'); setView('analysis');
    try {
      for (let i = 0; i < stages.length; i++) { setPhase(i); await pause(210); }
      const result = analyze(scope, orders, coverage); result.dataRevision = dataRevision; result.dataLabel = datasetName; result.dataKind = dataKind;
      setAnalysis(result); setReport(undefined);
      setSelectedThemeIds(topicSource === 'custom' ? customThemes.filter(t => t.custom && !t.parentId).slice(-1).map(t => t.id) : classificationThemes(result, taxonomy).slice(0, 2).map(t => t.id));
    } finally { lock.current = false; setBusy(''); }
  }
  async function identify() {
    if (!analysis || lock.current) return;
    try {
      const nextScope = resolveQuestionScope(topicText, scope, coverage), theme = customTheme(topicText, crypto.randomUUID(), category);
      lock.current = true; setBusy('theme'); await pause(250);
      if (JSON.stringify(nextScope) !== JSON.stringify(analysis.scope) || dirty) {
        const next = analyze(nextScope, orders, coverage); next.dataRevision = dataRevision; next.dataLabel = datasetName; next.dataKind = dataKind;
        setScope(nextScope); setAnalysis(next); setReport(undefined);
      }
      setTopicSource('custom'); setCustomThemes(items => [...items.filter(t => !t.custom), theme]); setSelectedThemeIds([theme.id]);
      message.success('主题已识别，可查看具体诉求并核对不确定工单');
    } catch (e) { message.warning((e as Error).message); } finally { lock.current = false; setBusy(''); }
  }
  async function createReport() {
    if (!analysis || dirty || lock.current || !template) return;
    try { validateTemplate(template, definitions); if (analysis.current.length && template.blocks.some(b => b.kind === 'topics') && !chosen.length) throw new Error('请先选择本次报告主题'); if (chosen.some(t => !t.name.trim())) throw new Error('请填写报告中的主题标题'); }
    catch (e) { message.warning((e as Error).message); return; }
    lock.current = true; setBusy('generate');
    try { await pause(250); setReport({ ...generateTemplateReport(analysis, template, definitions, selectedThemes, dataRevision), cadence: mode === 'topic' ? frequency : 'on-demand' }); w.setReportType(reportType); setTemplateId(template.id); setView('report'); }
    catch (e) { message.error((e as Error).message); } finally { lock.current = false; setBusy(''); }
  }
  async function exportWord() {
    if (!report || invalid || lock.current) return;
    lock.current = true; setBusy('word');
    try { const { createWord, downloadBlob } = await import('@/lib/weeklyReportExport'); downloadBlob(await createWord(report), `${report.title}_${report.analysis.scope.start}.docx`); }
    catch { message.error('导出失败，请重试'); } finally { lock.current = false; setBusy(''); }
  }
  async function copyReport() {
    if (!report || invalid) return;
    try { await navigator.clipboard.writeText([report.title, `${report.analysis.scope.start}至${report.analysis.scope.end}`, ...report.sections.flatMap(s => { const v = s.versions[s.active]; return [s.title, ...v.paragraphs.map(p => textOf(p, report.analysis)), ...(v.table ? [v.table.headers.join('\t'), ...v.table.rows.map(row => row.map(cell => textOf(cell, report.analysis)).join('\t'))] : [])]; })].join('\n\n')); message.success('已复制报告正文，可粘贴后人工编辑'); } catch { message.warning('当前浏览器未允许复制，请使用导出报告'); }
  }
  function preset(days: number) { const start = shiftDate(scope.end, 1 - days); setScope({ ...scope, start: start < coverage.start ? coverage.start : start }); }
  const tokens = (values: Token[], a: Analysis) => values.map((token, i) => typeof token === 'string' ? <span key={i}>{token}</span> : <button className="weekly-number" key={i} onClick={() => { setWordContext(undefined); setMetric(a.metrics[token.metricId]); }} aria-label={`${a.metrics[token.metricId].label}，查看数据依据`}>{metricText(a.metrics[token.metricId])}</button>);
  const number = (a: Analysis, kind: Metric['kind'], filter = {}, period: Metric['period'] = 'current') => {
    const id = period === 'previous' ? 'builtin-8' : { count: 'builtin-1', daily: 'builtin-2', share: 'system-share', change: 'system-change' }[kind];
    const d = definitions.find(d => d.id === id && d.enabled && !d.category && !d.point && !d.business && d.channel === 'report');
    return tokens([d ? registerDefinitionMetric(a, d, filter) : registerMetric(a, kind, filter, period)], a);
  };
  function selectionSummary() { return <>
    {chosen.length > 0 && <div className="briefing-selected-topics"><h3>本次报告主题 · 标题可按当期内容拟定</h3>{chosen.map(theme => <div key={theme.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><CheckCircleOutlined style={{ color: '#67a88f' }} /><Input aria-label={`${theme.name}报告标题`} value={theme.name} maxLength={60} disabled={disabled} onChange={e => setCustomThemes(items => [...items.filter(t => t.id !== theme.id), { ...theme, name: e.target.value }])} /><Button size="small" type="text" disabled={disabled} onClick={() => setExplore(theme)}>下钻</Button><Button size="small" type="text" disabled={disabled} onClick={() => setSelectedThemeIds(ids => ids.filter(id => id !== theme.id))}>移除</Button></div>)}<p className="briefing-subtle">主题间可能交叉，工单数量不可直接相加。下钻选取细分主题时，将替换已选的直接上级主题。</p></div>}
    {pending > 0 && <Alert type="warning" showIcon title={`所选主题还有${pending}条工单待人工核对`} description="点击主题的“查看细分与相关工单”核对，待核对记录统一置顶。也可先基于已确认匹配记录生成报告。" />}
  </>; }
  function cards(items: ThemeResult[]) { return <div className="briefing-topics-grid">{items.map(t => { const count = t.filter.semantic && analysis ? reviewedRows(analysis.current, t.filter).filter(o => o.assessment.state === 'pending').length : 0; return <article className={`briefing-topic ${selectedSet.has(t.id) ? 'selected' : ''}`} key={t.id}><div className="briefing-topic-top"><Checkbox checked={selectedSet.has(t.id)} disabled={disabled || dirty} onChange={() => selectTheme(t)}>{t.name}</Checkbox>{t.custom ? <Tag color="purple">自定义</Tag> : t.source === 'semantic' ? <Tag color="cyan">语义聚合</Tag> : <Tag>{t.taxonomy === 'city' ? '市级四级' : '区级小类'}</Tag>}</div><p className="briefing-topic-path">{t.source === 'semantic' ? '跨分类 · 按工单文本中的共同对象、场景和具体诉求聚合' : t.path || '按主题表达匹配，不以原分类替代主题'}</p><div className="briefing-topic-numbers"><span>工单 {number(analysis!, 'count', t.filter)} 件</span><span>占比 {number(analysis!, 'share', t.filter)}</span><span>环比 {number(analysis!, 'change', t.filter)}</span></div><div className="briefing-topic-bottom"><Button type="link" size="small" disabled={dirty || disabled} onClick={() => setExplore(t)}>查看细分与相关工单 →</Button>{count > 0 && <span className="briefing-pending-badge">待核对 {count}</span>}</div></article>; })}</div>; }
  return <BriefingShell workspace><div className="briefing-page-heading"><div><span className="briefing-kicker">{mode === 'topic' ? 'TOPIC REPORT' : 'WEEKLY REPORT'}</span><h1>{mode === 'topic' ? '围绕一个具体问题，做深入分析' : '用本期工单，写一份有依据的周报'}</h1><p>{mode === 'topic' ? '报告可以每日制作，数据可以覆盖近一周、近一月或自定义起始日期。' : '市级分类优先选题，深入具体诉求，核对后形成报告。'}</p></div><Link href="/ask-data"><Button icon={<MessageOutlined />}>先问一个问题</Button></Link></div>
    <div className="briefing-flow"><Steps size="small" current={!analysis || dirty ? 0 : !report || settingDirty ? 1 : 2} items={[{ title: '确定统计范围' }, { title: '选题与工单核对' }, { title: '生成与辅助研判' }]} /></div>
    <div className="briefing-main-grid"><aside className="briefing-settings"><h2>生成设置</h2><div className="briefing-settings-scroll" tabIndex={0} role="region" aria-label="生成参数"><div><label>报告类型</label>{mode === 'topic' ? <><Tag color="blue">专题报</Tag><label>制作方式</label><Select aria-label="专题报告制作方式" value={frequency} disabled={disabled} onChange={setFrequency} options={[{ value: 'on-demand', label: '按需制作' }, { value: 'daily', label: '每日制作' }]} /><p className="briefing-subtle">手动生成，可每日更新；制作方式不改变下方统计周期。</p></> : <Select value={reportType} disabled={disabled} options={[{ value: 'weekly', label: '周报' }, { value: 'daily', label: '日报' }]} onChange={value => { w.setReportType(value as 'weekly' | 'daily'); setTemplateId(templates.find(t => t.type === value)?.id || ''); if (value === 'daily') setScope({ ...scope, start: scope.end }); }} />}
    <label>统计周期</label>{reportType === 'daily' ? <DatePicker aria-label="日报统计日期" value={dayjs(scope.end)} allowClear={false} disabled={disabled} disabledDate={d => d.format('YYYY-MM-DD') < coverage.start || d.format('YYYY-MM-DD') > coverage.end} onChange={d => { if (d) setScope({ ...scope, start: d.format('YYYY-MM-DD'), end: d.format('YYYY-MM-DD') }); }} /> : <DatePicker.RangePicker aria-label="报告统计周期" value={[dayjs(scope.start), dayjs(scope.end)]} allowClear={false} disabled={disabled} disabledDate={d => d.format('YYYY-MM-DD') < coverage.start || d.format('YYYY-MM-DD') > coverage.end} onChange={dates => { if (dates?.[0] && dates[1]) setScope({ ...scope, start: dates[0].format('YYYY-MM-DD'), end: dates[1].format('YYYY-MM-DD') }); }} />}{reportType !== 'daily' && <div className="briefing-period-presets">{[7, 30].map(n => <Button size="small" key={n} disabled={disabled} onClick={() => preset(n)}>近{n}天</Button>)}<Button size="small" disabled={disabled} onClick={() => setScope({ ...scope, start: coverage.start, end: coverage.end })}>全部数据</Button></div>}<p className="briefing-subtle">本期{dayCount(scope.start, scope.end)}天 · 对比前一等长周期</p></div>
    <div><label>报告模板</label><div className="briefing-template-choice">{available.map(t => <div key={t.id} className={template?.id === t.id ? 'active' : ''}><button disabled={disabled} onClick={() => setTemplateId(t.id)}>{t.name}</button><Button size="small" type="text" icon={<EyeOutlined />} aria-label={`预览${t.name}`} onClick={() => setPreview(t)} /></div>)}</div></div><div className="briefing-settings-note"><Tag>{dataKind === 'sample' ? '样例数据' : '试用数据'}</Tag><p className="briefing-subtle">{datasetName}<br />{coverage.start} — {coverage.end}</p><Link href="/data-trial">导入试用工单 / 查看数据范围 →</Link><p className="briefing-subtle">一期聚焦统计、下钻与内容核验。报告生成后可复制或导出，再人工编辑。</p></div></div><div className="briefing-settings-action"><Button block type="primary" size="large" icon={<ThunderboltOutlined />} disabled={!storageReady || disabled} loading={busy === 'analysis'} onClick={runAnalysis}>分析本期工单</Button></div></aside>
    <main className="briefing-workspace"><div className="briefing-workspace-toolbar"><Segmented value={view} onChange={setView} options={[{ value: 'analysis', label: '选题与核对' }, { value: 'report', label: '报告预览', disabled: !report }]} /><Space><Button icon={<CopyOutlined />} disabled={!report || invalid || disabled} onClick={copyReport}>复制正文</Button><Button type="primary" icon={<DownloadOutlined />} loading={busy === 'word'} disabled={!report || invalid || disabled} onClick={exportWord}>导出报告</Button></Space></div>
    {dirty && <Alert type="warning" showIcon title="统计范围或数据已改变，请重新分析" />}{!dirty && settingDirty && <Alert type="warning" showIcon title="选题、人工核对或模板已更新，请重新生成报告" />}
    {busy === 'analysis' ? <div className="weekly-analyzing"><h2>正在分析本期工单</h2><Steps direction="vertical" current={phase} items={stages.map(title => ({ title }))} /><Progress percent={(phase + 1) * 25} /></div> : !analysis ? <div className="briefing-empty"><FileTextOutlined /><h2>{mode === 'topic' ? '先选数据周期，再聚焦具体问题' : '从本期工单开始选题'}</h2><p>分析后会推荐热点主题，支持下钻到具体诉求和相关工单。<br />你也可以导入试用数据，与实际周报对照。</p><Button type="primary" onClick={runAnalysis} disabled={!storageReady}>分析当前数据</Button></div> : view === 'analysis' ? <><div className="briefing-analysis"><div className="briefing-analysis-heading"><div><h2>本期热点选题</h2><p className="briefing-subtle">{analysis.scope.start} 至 {analysis.scope.end} · {analysis.dataLabel}</p></div><Tag color="blue">本地规则模拟</Tag></div><div className="briefing-stats"><div><span>本期受理工单</span><strong>{number(analysis, 'count')}</strong></div><div><span>本期日均</span><strong>{number(analysis, 'daily')}</strong></div><div><span>本期环比</span><strong>{number(analysis, 'change')}</strong></div><div><span>上期受理工单</span><strong>{number(analysis, 'count', {}, 'previous')}</strong></div></div>
    {!analysis.comparisonComplete && <Alert showIcon type="warning" title="比较期超出数据边界，环比暂不可计算" />}
    <div className="briefing-source-toggle"><span>五个分析板块 · 切换查看不会清空已选主题</span><span>自定义主题与推荐主题互斥，选择时切换；词云用于发现线索</span></div>
    {!textReady && <Alert type="info" showIcon title="正在后台遍历全量工单，整理语义线索与词频，可先查看分类结果" />}
    {textReady && textAnalysis?.error && <Alert type="error" showIcon title={textAnalysis.error} />}
    <Tabs className="briefing-analysis-tabs" activeKey={panel} onChange={switchPanel} items={[
      ...(['city', 'district'] as const).map(value => ({ key: value, label: value === 'city' ? '市级分类（四级）' : '区级分类（案件小类）', children: <><p className="briefing-subtle">{value === 'city' ? '沿用市级四级分类，展示本期候选主题，支持继续按工单描述细分。' : '沿用区级案件小类，支持下钻案件子类，再细分具体诉求。'}</p>{(value === 'city' ? city : district).length ? cards((value === 'city' ? city : district).slice(0, 5).map(t => themeResult(analysis, pool.find(p => p.id === t.id) || t))) : <Empty description="当前数据未提供该分类口径，可补充分类字段或使用自定义主题" />}</> })),
      { key: 'custom', label: '自定义主题', children: <><div className="briefing-custom-box"><h3>多个关键词，或直接描述你想分析的问题</h3><Input.TextArea aria-label="自定义主题描述" value={topicText} maxLength={300} rows={3} disabled={disabled || dirty} onChange={e => setTopicText(e.target.value)} placeholder="例如：分析公建配套中，老年人、社区食堂相关的诉求" /><div className="briefing-custom-options"><Select allowClear placeholder="可选：限定原始分类" aria-label="自定义主题限定分类" value={category} onChange={setCategory} disabled={disabled || dirty} options={[...new Set(orders.map(o => o.category))].map(value => ({ value, label: value }))} /><Button type="primary" loading={busy === 'theme'} disabled={disabled || dirty || !topicText.trim()} onClick={identify}>识别相关工单</Button></div><p className="briefing-subtle">多个主题要素默认同时涉及；不能确认的记录进入待核对队列。支持“9月份以来”“近一月”等时间表达。识别自定义主题后，替换已选推荐主题。</p></div>{cards(customThemes.filter(t => t.custom && !t.parentId).slice(-1).map(t => themeResult(analysis, t)))}</> },
      { key: 'semantic', label: '模型语义识别', children: <><div className="briefing-semantic-intro"><Tag color="cyan">全量文本 · 分类外发现</Tag><h3>从共同场景和诉求中，发现新的热点</h3><p>正式接入后，由大模型读取本期全量工单，提炼现有分类之外的共同问题，再关联两期明细核验。当前原型遍历全部文本，以主题表达和共现规则模拟聚合，未调用真实大模型，识别口径独立于市、区分类。</p></div>{!textReady ? <p className="briefing-subtle">正在聚合全部工单中的文本线索…</p> : semantics.length ? cards(semantics.map(t => themeResult(analysis, pool.find(p => p.id === t.id) || t))) : <Empty description="本期文本中没有可聚合的热点线索，可使用自定义主题探索" />}<p className="briefing-subtle">每项候选可下钻、人工核对、选入报告；候选允许跨原有分类，也可能涉及同类工单。主题可能交叉，不能相加。</p></> },
      { key: 'words', label: '词云分析', children: <>{!textReady ? <p className="briefing-subtle">正在分词并统计本期词频…</p> : <WordCloudAnalysis words={words} disabled={disabled || dirty} onWord={inspectWord} />}</> },
    ].map(item => ({ ...item, children: <div className="briefing-analysis-scroll" role="region" aria-label="分析结果" tabIndex={0}>{item.children}{selectionSummary()}</div> }))} />
</div><div className="briefing-selection-footer"><span>已选 {chosen.length}/6 个主题 · 待核对 {pending} 条</span><Button type="primary" disabled={!template || dirty || disabled} loading={busy === 'generate'} onClick={createReport}>生成{REPORT_TYPES[reportType]}</Button></div></> : report && <div className="briefing-report-preview" role="region" aria-label="报告正文" tabIndex={0}><div className="weekly-preview-hint"><span>{report.templateSnapshot?.name} · 一期以整体内容核验为主</span><Tag>{report.analysis.dataKind === 'imported' ? '试用数据' : '模拟数据'}</Tag></div><article className="weekly-paper"><ReportDocumentHeader masthead={style!.masthead} issue={style!.issue} cutoff={style!.cutoff} /><h2>{report.title}</h2><div className="weekly-paper-period">{style!.period}</div>{report.sections.map(section => { const v = section.versions[section.active]; return <section key={section.id} className="weekly-report-section"><div className="weekly-section-heading"><h3>{section.title}</h3></div>{v.paragraphs.map((p, i) => <p key={i}>{tokens(p, report.analysis)}</p>)}{v.table && !!v.table.rows.length && <div className="weekly-table-scroll"><table><thead><tr>{v.table.headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{v.table.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{tokens(cell, report.analysis)}</td>)}</tr>)}</tbody></table></div>}</section>; })}<p className="report-scope-note">{style!.scopeNote}</p><footer className="weekly-paper-footer">{style!.disclaimer}</footer></article></div>}
    </main></div>
    {explore && analysis && <ThemeExplorerDrawer key={explore.id} analysis={analysis} theme={explore} onClose={() => setExplore(undefined)} onChoose={theme => { if (!selectedSet.has(theme.id)) selectTheme(theme); else setCustomThemes(items => [...items.filter(t => t.id !== theme.id), theme]); message.success('已更新本次报告主题'); }} />}
    {metric && analysis && <WeeklyEvidenceDrawer key={`${metric.id}/${dataRevision}`} metric={metric} theme={pool.find(t => !!metric.filter.semantic && t.filter.semantic?.topic === metric.filter.semantic.topic)} contextNote={wordContext ? `“${wordContext.word}”分词出现${wordContext.frequency}次，原词涉及${wordContext.orders}条去重工单。下方及Excel展示包含原词的工单集合，分词次数不等于工单数量。` : undefined} analysis={view === 'report' && report ? report.analysis : analysis} onClose={() => { setMetric(undefined); setWordContext(undefined); }} />}
    {preview && <ReportTemplatePreview template={preview} definitions={definitions} onClose={() => setPreview(undefined)} />}
    {report && <ReportInsightAssistant key={`${report.createdAt}/${report.dataRevision}`} report={report} visible={view === 'report'} disabled={disabled || invalid} open={insightOpen} onOpenChange={setInsightOpen} contextId={insightContext} onContextChange={setInsightContext} onMetric={setMetric} />}
  </BriefingShell>;
}
