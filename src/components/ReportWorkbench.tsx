'use client';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import { Alert, App, Button, Checkbox, DatePicker, Empty, Input, Modal, Progress, Segmented, Select, Space, Steps, Tabs, Tag } from 'antd';
import { BarChartOutlined, DownloadOutlined, EyeOutlined, FileTextOutlined, HistoryOutlined, ReloadOutlined, RobotOutlined, SendOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { compileThemeRule, themeRuleDescription } from '@/lib/themeMatching';
import PlatformShell from './PlatformShell';
import WeeklyEvidenceDrawer from './WeeklyEvidenceDrawer';
import WeeklyRewriteComparison from './WeeklyRewriteComparison';
import WeeklySectionIndicators from './WeeklySectionIndicators';
import ReportDocumentHeader from './ReportDocumentHeader';
import { reportDocumentStyle } from '@/lib/reportDocumentStyle';
import ReportInsightAssistant from './ReportInsightAssistant';
import ReportTemplatePreview from './ReportTemplatePreview';
import { useWeeklyWorkspace } from './WeeklyWorkspaceProvider';
import { analyze, DATA_END, DATA_START, dayCount, metricText, parseModes, registerMetric, REWRITE_MODES, shiftDate, validateScope, type Analysis, type Metric, type RewriteMode, type SectionVersion, type Token } from '@/lib/weeklyReport';
import { buildRecipeVersion, configurationKey, generateTemplateReport, recommendThemes, registerDefinitionMetric, REPORT_TYPES, selectThemeMode, validateTemplate, validateTheme, type ReportTemplate, type ReportTheme, type ReportType, type ThemeGroup } from '@/lib/reportTemplates';

const stages = ['统计本期与上期工单', '比较类型数量变化', '归集集中事件与共同诉求', '整理推荐主题与依据'];
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export default function ReportWorkbench() {
  const { message } = App.useApp();
  const { scope, setScope, analysis, setAnalysis, report, setReport, definitions, templates, reportType, setReportType, templateId, setTemplateId, customThemes, setCustomThemes, themeModes, setThemeModes, selectedThemeIds, setSelectedThemeIds, sourceOrders, dataRevision, storageReady } = useWeeklyWorkspace();
  const [view, setView] = useState(report ? 'report' : 'analysis'), [busy, setBusy] = useState(''), [phase, setPhase] = useState(0);
  const lock = useRef(false);
  const [metric, setMetric] = useState<Metric>(), [preview, setPreview] = useState<ReportTemplate>();
  const [comparison, setComparison] = useState<{ sectionId: string; candidate?: SectionVersion }>();
  const [rewriteId, setRewriteId] = useState<string>(), [modes, setModes] = useState<RewriteMode[]>([]), [rewriteText, setRewriteText] = useState('');
  const [chat, setChat] = useState([{ role: 'assistant', text: '选择报表类型、模板和日期，再分析本期热点。蓝色数字可查看依据、上传明细并申报异议。' }]);
  const [question, setQuestion] = useState(''), [target, setTarget] = useState<string>();
  const [themeInputs, setThemeInputs] = useState<Record<ThemeGroup, string>>({ '热点事件': '', '群众热议': '' });
  const [insightOpen, setInsightOpen] = useState(false), [insightContext, setInsightContext] = useState<string>();
  const [activeThemeGroup, setActiveThemeGroup] = useState<ThemeGroup>('热点事件');
  const available = templates.filter(t => t.type === reportType), template = available.find(t => t.id === templateId);
  const themes = useMemo(() => analysis ? recommendThemes(analysis, [...customThemes, ...(report?.themes || []).filter(t => !t.custom && !customThemes.some(c => c.id === t.id))]) : [], [analysis, customThemes, report?.themes]);
  const chosen = selectedThemeIds.flatMap(id => themes.find(t => t.id === id) || []);
  const selectedThemes: ReportTheme[] = chosen.map(({ id, name, group, filter, custom, note }) => ({ id, name, group, filter, custom, note }));
  const dirty = !!analysis && (analysis.key !== `${scope.start}/${scope.end}/${scope.channel}` || (analysis.dataRevision || 0) !== dataRevision);
  let settingDirty = false;
  try { settingDirty = !!report && (!template || report.configurationKey !== configurationKey(template, definitions, selectedThemes)); } catch { settingDirty = true; }
  const documentStyle = report ? reportDocumentStyle(report) : undefined;
  const invalid = dirty || settingDirty || !template, disabled = !!busy;
  const say = (text: string) => setChat(items => [...items, { role: 'assistant', text }]);
  function switchType(type: ReportType) {
    setReportType(type); setTemplateId(templates.find(t => t.type === type)?.id || '');
    if (type === 'daily') setScope({ ...scope, start: scope.end });
    else if (scope.start === scope.end) setScope({ ...scope, start: shiftDate(scope.end, -6) < DATA_START ? DATA_START : shiftDate(scope.end, -6) });
  }
  async function runAnalysis() {
    if (lock.current) return;
    try { validateScope(scope); } catch (e) { message.warning((e as Error).message); return; }
    lock.current = true; setBusy('analysis'); setView('analysis'); setMetric(undefined);
    try {
      for (let i = 0; i < stages.length; i++) { setPhase(i); await pause(280); }
      const result = analyze({ ...scope, channel: '全渠道' }, sourceOrders); result.dataRevision = dataRevision;
      const recommended = recommendThemes(result, customThemes);
      setAnalysis(result); setReport(undefined); setSelectedThemeIds((['热点事件', '群众热议'] as const).flatMap(group => recommended.find(t => t.group === group && (themeModes[group] === 'custom' ? t.custom : !t.custom) && (t.custom || t.count > 0))?.id || []));
      say(`已完成全渠道分析，共${result.current.length}件。热点事件与群众热议均按主题归集，不限定地区或点位；两类可能交叉，不宜相加。`);
    } finally { lock.current = false; setBusy(''); }
  }
  function choose(ids: string[]) { if (ids.length > 6) { message.warning('最多选择6个主题'); return; } setSelectedThemeIds(ids); }
  async function createReport() {
    if (!analysis || dirty || lock.current || !template) return;
    try { validateTemplate(template, definitions); if (analysis.current.length > 0 && template.blocks.some(b => b.kind === 'topics') && !selectedThemes.length) throw new Error('请至少选择一个主题'); }
    catch (e) { message.warning((e as Error).message); return; }
    lock.current = true; setBusy('generate');
    try { await pause(300); const next = generateTemplateReport(analysis, template, definitions, selectedThemes, dataRevision); setReport(next); setTarget(next.sections[0]?.id); setView('report'); say(`已按“${template.name}”生成报告。可独立改写板块、对照版本，导出报告。`); }
    catch (e) { message.error((e as Error).message); } finally { lock.current = false; setBusy(''); }
  }
  async function rewrite(id: string, requested: RewriteMode[]) {
    if (!report || invalid || lock.current) return;
    const section = report.sections.find(s => s.id === id); if (!section?.recipe) return;
    lock.current = true; setBusy(`rewrite-${id}`);
    try { await pause(220); setComparison({ sectionId: id, candidate: buildRecipeVersion(report.analysis, section.recipe, Math.max(...section.versions.map(v => v.number)) + 1, requested) }); setRewriteId(undefined); }
    finally { lock.current = false; setBusy(''); }
  }
  function adoptVersion(version: SectionVersion) {
    if (!comparison) return;
    setReport(r => r && ({ ...r, sections: r.sections.map(s => { if (s.id !== comparison.sectionId) return s; const index = s.versions.findIndex(v => v.number === version.number); return index >= 0 ? { ...s, active: index } : { ...s, versions: [...s.versions, version], active: s.versions.length }; }) })); setComparison(undefined);
  }
  async function exportWord() {
    if (!report || invalid || lock.current) return;
    lock.current = true; setBusy('word');
    try { const { createWord, downloadBlob } = await import('@/lib/weeklyReportExport'); downloadBlob(await createWord(report), `${report.title}_${scope.start}.docx`); message.success('已导出当前版本报告'); }
    catch { message.error('导出失败，请重试'); } finally { lock.current = false; setBusy(''); }
  }
  async function send(input = question) {
    const value = input.trim(); if (!value || disabled) return;
    setQuestion(''); setChat(items => [...items, { role: 'user', text: value }]);
    if (!analysis || dirty) { say('请先分析本期工单。'); return; }
    if (/为什么|推荐|解释/.test(value)) { say(chosen.map(t => `${t.name}：${t.count}件，占比${(t.share * 100).toFixed(1)}%，前三点位集中度${(t.concentration * 100).toFixed(1)}%；${t.previous < 10 ? '上期小基数，不按增长率加分' : '综合数量、正向增长与点位集中度排序'}。`).join('\n') || '请先选择主题。'); return; }
    if (/加入|添加|移除|取消/.test(value)) {
      const found = themes.filter(t => (themeModes[t.group] === 'custom' ? t.custom : !t.custom) && (value.includes(t.name) || (t.filter.category && value.includes(t.filter.category) && t.group === '群众热议')));
      if (!found.length) { say('可在右侧选择主题，或切换到“自定义主题”输入具体主题。'); return; }
      choose(/移除|取消/.test(value) ? selectedThemeIds.filter(id => !found.some(t => t.id === id)) : [...new Set([...selectedThemeIds, ...found.map(t => t.id)])]); setView('analysis'); return;
    }
    const requested = parseModes(value), section = report?.sections.find(s => s.id === (target || report.sections[0]?.id));
    if (requested.length && section && !invalid) { await rewrite(section.id, requested); return; }
    say('支持解释推荐、加入或移除主题，以及精简表达、突出环比、强调点位、加强建议。自定义主题只需输入具体诉求，系统用本地规则模拟逐条识别。');
  }
  function switchThemeMode(group: ThemeGroup, mode: 'recommended' | 'custom') {
    setThemeModes(items => ({ ...items, [group]: mode }));
    setSelectedThemeIds(selectThemeMode(selectedThemeIds, themes, group, mode));
  }
  async function identifyTheme(group: ThemeGroup) {
    if (lock.current || !analysis || dirty) return;
    try {
      const rule = compileThemeRule(themeInputs[group]);
      const theme: ReportTheme = { id: crypto.randomUUID(), name: rule.topic, group, custom: true, filter: { semantic: rule }, note: themeRuleDescription(rule) };
      validateTheme(theme, themes.filter(t => !(t.custom && t.group === group)));
      const other = selectedThemeIds.filter(id => themes.find(t => t.id === id)?.group !== group);
      if (other.length >= 6) throw new Error('最多选择6个主题，请先取消其他主题');
      lock.current = true; setBusy('theme'); await pause(320);
      setCustomThemes(items => [...items.filter(t => t.group !== group), theme]);
      setSelectedThemeIds([...other, theme.id]);
      message.success('已逐条匹配本期及比较期工单，可点击蓝色数字查看命中依据');
    } catch (e) { message.warning((e as Error).message); }
    finally { lock.current = false; setBusy(''); }
  }
  const renderTokens = (tokens: Token[], a: Analysis) => tokens.map((t, i) => typeof t === 'string' ? <span key={i}>{t}</span> : <button key={i} className="weekly-number" onClick={() => setMetric(a.metrics[t.metricId])} aria-label={`${a.metrics[t.metricId].label} ${metricText(a.metrics[t.metricId])}，查看依据`}>{metricText(a.metrics[t.metricId])}</button>);
  const number = (a: Analysis, kind: Metric['kind'], filter = {}, period: Metric['period'] = 'current') => {
    const id = period === 'previous' ? 'builtin-8' : ({ count: 'builtin-1', daily: 'builtin-2', share: 'system-share', change: 'system-change' })[kind];
    const d = definitions.find(d => d.id === id && d.enabled);
    return renderTokens([d ? registerDefinitionMetric(a, d, filter) : registerMetric(a, kind, filter, period)], a);
  };
  return <PlatformShell><div className="weekly-workbench">
    <header className="weekly-heading"><div className="flex items-center gap-3"><div className="weekly-heading-icon"><FileTextOutlined /></div><div><h1>智能报告</h1><p>选择模板，研判热点，生成有据可查的城运报告</p></div><Tag color="blue">本地演示</Tag></div><Space><Link href="/templates">模板管理</Link><Link href="/indicators">指标台</Link></Space></header>
    <div className="weekly-stepbar"><Steps size="small" current={!analysis || dirty ? 0 : !report || settingDirty ? 1 : 2} items={[{ title: '类型与模板' }, { title: '分析与选题' }, { title: '报告与下载' }]} /></div>
    <div className="weekly-columns"><aside className="weekly-assistant"><div className="weekly-settings"><h2><BarChartOutlined /> 生成设置</h2><label>报表类型</label><Segmented block aria-label="报表类型" value={reportType} disabled={disabled} options={Object.entries(REPORT_TYPES).map(([value, label]) => ({ value, label }))} onChange={v => switchType(v as ReportType)} />
      <div className="report-template-label"><label>报告模板</label><Link href="/templates">管理</Link></div><div className="report-template-options">{available.map(t => <div key={t.id} className={templateId === t.id ? 'active' : ''}><button disabled={disabled} onClick={() => setTemplateId(t.id)}><strong>{t.name}</strong><small>{t.description}</small></button><Button aria-label={`预览${t.name}`} size="small" type="text" icon={<EyeOutlined />} onClick={() => setPreview(t)} /></div>)}</div>{!available.length && <Alert type="warning" title="暂无模板，请先到模板管理新增" />}
      <label>统计日期</label>{reportType === 'daily' ? <DatePicker aria-label="日报统计日期" allowClear={false} value={dayjs(scope.end)} disabled={disabled} disabledDate={d => d.format('YYYY-MM-DD') < DATA_START || d.format('YYYY-MM-DD') > DATA_END} onChange={d => { if (d) setScope({ ...scope, start: d.format('YYYY-MM-DD'), end: d.format('YYYY-MM-DD') }); }} /> : <DatePicker.RangePicker aria-label="统计日期范围" allowClear={false} value={[dayjs(scope.start), dayjs(scope.end)]} disabled={disabled} disabledDate={d => d.format('YYYY-MM-DD') < DATA_START || d.format('YYYY-MM-DD') > DATA_END} onChange={dates => { if (dates?.[0] && dates[1]) setScope({ ...scope, start: dates[0].format('YYYY-MM-DD'), end: dates[1].format('YYYY-MM-DD') }); }} />}
      <p className="weekly-range-hint">共{dayCount(scope.start, scope.end)}天 · 对比前一等长周期 · 全渠道</p><Button block type="primary" size="large" icon={<ThunderboltOutlined />} disabled={!storageReady || disabled} onClick={runAnalysis}>分析本期热点</Button><p className="weekly-data-note">每日约1,300条全渠道模拟工单 · 2026年3—5月。上传数据与异议仅当前会话有效。</p></div>
      <div className="weekly-chat-heading"><RobotOutlined /> 报告助手 <span>规则模拟</span></div><div className="weekly-chat-messages" aria-live="polite">{chat.map((c, i) => <div key={i} className={`weekly-chat-item ${c.role}`}><span className="weekly-chat-role">{c.role === 'assistant' ? '报告助手' : '我'}</span><div>{c.text}</div></div>)}</div><div className="weekly-composer"><div className="weekly-shortcuts"><button disabled={disabled} onClick={() => send('解释推荐依据')}>解释推荐依据</button><button disabled={disabled} onClick={() => send('加入教育')}>加入教育主题</button></div>{report && <Select aria-label="问答调整目标板块" value={target || report.sections[0]?.id} onChange={setTarget} disabled={disabled || invalid} options={report.sections.map(s => ({ value: s.id, label: s.title }))} />}<Input.TextArea aria-label="报告调整要求" value={question} disabled={disabled} onChange={e => setQuestion(e.target.value)} rows={2} placeholder="例如：突出环比，加强建议" onPressEnter={e => { if (!e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} /><div className="weekly-composer-footer"><span>支持四类改写 · Shift+Enter换行</span><Button aria-label="发送调整要求" type="primary" disabled={!question.trim() || disabled} icon={<SendOutlined />} onClick={() => send()} /></div></div>
    </aside><main className="weekly-main"><div className="weekly-main-toolbar"><Segmented value={view} onChange={setView} options={[{ value: 'analysis', label: '本期热点' }, { value: 'report', label: '报告预览', disabled: !report }]} /><Button icon={<DownloadOutlined />} type="primary" disabled={!report || invalid || disabled} loading={busy === 'word'} onClick={exportWord}>导出报告</Button></div>
      {dirty && <Alert type="warning" showIcon title="统计日期已改变，请重新分析" />}{!dirty && settingDirty && <Alert type="warning" showIcon title="模板、指标口径或主题已变化，请重新生成报告" />}
      {busy === 'analysis' ? <div className="weekly-analyzing"><h2>正在分析本期热点</h2><Steps direction="vertical" current={phase} items={stages.map(title => ({ title }))} /><Progress percent={(phase + 1) * 25} /></div> : !analysis ? <div className="weekly-welcome"><FileTextOutlined style={{ fontSize: 58, color: '#4e85c7' }} /><h2>从一份模板开始</h2><p>选择日报、周报或专题报，预览模板后分析本期热点。</p><p>数字直达明细 · Excel更新数据 · 报告导出</p><Button type="primary" onClick={runAnalysis} disabled={!storageReady}>分析默认示例</Button></div> : view === 'analysis' ? <div className="weekly-analysis-content">
        <div className="weekly-analysis-intro"><div><h2>分析本期热点</h2><span>{analysis.scope.start} 至 {analysis.scope.end} · 全渠道 · {dataRevision ? '已合并上传明细' : '模拟明细'}</span></div></div><div className="weekly-stats"><div><span>本期工单总量</span><strong>{number(analysis, 'count')}<small>件</small></strong></div><div><span>日均受理</span><strong>{number(analysis, 'daily')}</strong></div><div><span>本期环比</span><strong>{number(analysis, 'change')}</strong></div><div><span>上期总量</span><strong>{number(analysis, 'count', {}, 'previous')}</strong></div></div><div className="weekly-scoring">每个Tab独立选择推荐或自定义主题，两种方式互斥。两类主题可能交叉，数量不相加。最多选6项。</div>
        <Tabs className="report-theme-tabs" activeKey={activeThemeGroup} onChange={key => setActiveThemeGroup(key as ThemeGroup)} items={(['热点事件', '群众热议'] as const).map(group => {
          const custom = themeModes[group] === 'custom';
          const visible = themes.filter(t => t.group === group && (custom ? t.custom : !t.custom && t.count > 0)).slice(0, custom ? 1 : 5);
          return { key: group, label: group + ' · 已选' + chosen.filter(t => t.group === group).length, children: <section className="report-theme-group">
            <div className="weekly-topic-heading"><p>{group === '热点事件' ? '研判集中发生的事件与问题。' : '归纳群众共同关切，不代表互联网舆情。'}</p><Segmented aria-label={`${group}主题来源`} value={themeModes[group]} disabled={disabled || dirty} options={[{ value: 'recommended', label: 'AI推荐主题' }, { value: 'custom', label: '自定义主题' }]} onChange={mode => switchThemeMode(group, mode as 'recommended' | 'custom')} /></div>
            {custom ? <div className="report-custom-theme"><label htmlFor={`theme-${group}`}>输入你关注的具体主题</label><Input.TextArea id={`theme-${group}`} rows={2} maxLength={60} value={themeInputs[group]} disabled={disabled || dirty} onChange={e => setThemeInputs(items => ({ ...items, [group]: e.target.value }))} placeholder="例如：公共场所吸烟" /><p className="weekly-muted">不限定原有分类，逐条检索摘要和点位，通过同义表达识别相关工单。本地规则模拟；未覆盖的主题按原文短语匹配。</p><Button type="primary" loading={busy === 'theme'} disabled={disabled || dirty || !themeInputs[group].trim()} onClick={() => identifyTheme(group)}>{busy === 'theme' ? '正在逐条识别工单…' : '识别相关工单'}</Button></div> : <p className="weekly-muted">本地规则模拟分析，提供最多5个候选主题。切换到自定义后，本组推荐选题将被替换。</p>}
            <div className="weekly-topic-list">{visible.map(t => <article className={`weekly-topic-card ${selectedThemeIds.includes(t.id) ? 'selected' : ''}`} key={t.id}><div className="weekly-topic-card-top"><Checkbox disabled={disabled || dirty} checked={selectedThemeIds.includes(t.id)} onChange={e => choose(e.target.checked ? [...selectedThemeIds, t.id] : selectedThemeIds.filter(id => id !== t.id))}><strong>{t.name}</strong></Checkbox><Tag color={t.custom ? 'purple' : 'blue'}>{t.custom ? '自定义' : `推荐分 ${t.score.toFixed(1)}`}</Tag></div><div className="weekly-topic-numbers"><span>工单{number(analysis, 'count', t.filter)}件</span><span>占比{number(analysis, 'share', t.filter)}</span><span>环比{number(analysis, 'change', t.filter)}</span></div>{t.filter.semantic && <p className="weekly-muted">{themeRuleDescription(t.filter.semantic)}</p>}{t.custom && <Button type="text" size="small" danger disabled={disabled || dirty} onClick={() => { setCustomThemes(items => items.filter(item => item.id !== t.id)); choose(selectedThemeIds.filter(id => id !== t.id)); }}>移除自定义主题</Button>}</article>)}</div>{!visible.length && <Empty description={custom ? '输入具体主题，识别相关工单' : '本期暂无候选主题'} />}
          </section> };
        })} />
        <div className="weekly-selection-footer"><span>已选{chosen.length}/6项 · {REPORT_TYPES[reportType]}<small>比较期：{analysis.previousScope.start} 至 {analysis.previousScope.end}</small></span><Button type="primary" disabled={!template || dirty || disabled} loading={busy === 'generate'} onClick={createReport}>生成{REPORT_TYPES[reportType]}</Button></div>
      </div> : report && <div className="weekly-report-area"><div className="weekly-preview-hint"><span>{report.templateSnapshot?.name} · 模板v{report.templateSnapshot?.version}</span><Tag color="gold">模拟数据</Tag></div><article className="weekly-paper"><ReportDocumentHeader masthead={documentStyle!.masthead} issue={documentStyle!.issue} cutoff={documentStyle!.cutoff} /><h2>{report.title}</h2><div className="weekly-paper-period">{documentStyle!.period}</div>
        {report.sections.map(section => { const v = section.versions[section.active]; return <section key={section.id} className="weekly-report-section"><div className="weekly-section-heading"><h3>{section.title}</h3><Tag>v{v.number}</Tag></div><div className="weekly-section-actions"><Button size="small" disabled={disabled || invalid} onClick={() => rewrite(section.id, v.modes)} icon={<ReloadOutlined />}>重新生成</Button><Button size="small" disabled={disabled || invalid} onClick={() => { setRewriteId(section.id); setModes(v.modes); setRewriteText(''); }}>补充要求</Button><Button size="small" disabled={disabled || section.versions.length < 2} onClick={() => setComparison({ sectionId: section.id })}>版本对照</Button><Select aria-label={`${section.title}历史版本`} size="small" disabled={disabled || invalid} suffixIcon={<HistoryOutlined />} value={section.active} options={section.versions.map((v, i) => ({ value: i, label: `v${v.number}` }))} onChange={active => setReport(r => r && ({ ...r, sections: r.sections.map(s => s.id === section.id ? { ...s, active } : s) }))} /></div><WeeklySectionIndicators analysis={report.analysis} version={v} onMetric={setMetric} />{v.paragraphs.map((tokens, i) => <p key={i}>{renderTokens(tokens, report.analysis)}</p>)}{v.table && v.table.rows.length > 0 && <div className="weekly-table-scroll"><table><thead><tr>{v.table.headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{v.table.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{renderTokens(cell, report.analysis)}</td>)}</tr>)}</tbody></table></div>}</section>; })}<p className="report-scope-note">{documentStyle!.scopeNote}</p><footer className="weekly-paper-footer">{documentStyle!.disclaimer}</footer></article></div>}
    </main></div>
    {report && <ReportInsightAssistant key={`${report.createdAt}/${report.dataRevision || 0}/${report.sections.map(s => `${s.id}:${s.versions[s.active].number}`).join('|')}`} report={report} visible={view === 'report'} disabled={disabled || invalid} open={insightOpen} onOpenChange={setInsightOpen} contextId={insightContext} onContextChange={setInsightContext} onMetric={setMetric} />}
    {metric && analysis && <WeeklyEvidenceDrawer key={`${metric.id}/${dataRevision}`} metric={metric} analysis={view === 'report' && report ? report.analysis : analysis} onClose={() => setMetric(undefined)} />}{preview && <ReportTemplatePreview template={preview} definitions={definitions} onClose={() => setPreview(undefined)} />}
    {comparison && report && report.sections.some(s => s.id === comparison.sectionId) && <WeeklyRewriteComparison section={report.sections.find(s => s.id === comparison.sectionId)!} analysis={report.analysis} candidate={comparison.candidate} onClose={() => setComparison(undefined)} onAdopt={adoptVersion} />}
    <Modal open={!!rewriteId} title="补充要求并重新生成" okText="生成候选版本" cancelText="取消" onCancel={() => setRewriteId(undefined)} onOk={() => { const parsed = parseModes(rewriteText); if (rewriteText.trim() && !parsed.length) { message.warning('请选择受支持的写作方向'); return; } if (rewriteId) void rewrite(rewriteId, [...new Set([...modes, ...parsed])]); }}><Checkbox.Group value={modes} options={REWRITE_MODES} onChange={v => setModes(v as RewriteMode[])} /><Input.TextArea rows={3} style={{ marginTop: 16 }} value={rewriteText} onChange={e => setRewriteText(e.target.value)} placeholder="精简表达、突出环比、强调点位、加强建议" /></Modal>

  </div></PlatformShell>;
}
