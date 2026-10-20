'use client';

import { useRef, useState } from 'react';
import { App, Alert, Button, Checkbox, DatePicker, Empty, Input, Modal, Progress, Segmented, Select, Steps, Tag, Tooltip } from 'antd';
import { BarChartOutlined, CheckCircleOutlined, DownloadOutlined, FileSearchOutlined, FileTextOutlined, HistoryOutlined, ReloadOutlined, RobotOutlined, SendOutlined, ThunderboltOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import PlatformShell from './PlatformShell';
import WeeklyEvidenceDrawer from './WeeklyEvidenceDrawer';
import { analyze, buildVersion, CATEGORIES, DATA_END, DATA_START, dayCount, generateReport, metricText, parseModes, registerMetric, REWRITE_MODES, validateScope, type Analysis, type Category, type Channel, type Metric, type Report, type RewriteMode, type Scope, type Token } from '@/lib/weeklyReport';

const initialScope: Scope = { start: '2026-04-20', end: '2026-04-26', channel: '12345热线' };
const analysisSteps = ['统计本期与上期工单', '比较类型数量变化', '识别高发集中点位', '整理推荐选题与依据'];
type Chat = { role: 'assistant' | 'user'; text: string };
const pause = (ms = 300) => new Promise(resolve => setTimeout(resolve, ms));

export default function WeeklyReportWorkbench() {
  const { message, modal } = App.useApp();
  const [scope, setScope] = useState<Scope>(initialScope);
  const [analysis, setAnalysis] = useState<Analysis>();
  const [selected, setSelected] = useState<Category[]>([]);
  const [leadership, setLeadership] = useState(false);
  const [report, setReport] = useState<Report>();
  const [view, setView] = useState('analysis');
  const [busy, setBusy] = useState('');
  const lock = useRef(false);
  const [phase, setPhase] = useState(0);
  const [metric, setMetric] = useState<Metric>();
  const [chat, setChat] = useState<Chat[]>([{ role: 'assistant', text: '你好，我是周报助手。先选择日期和渠道，我会分析诉求变化并推荐热点。确认选题后再生成周报，每个蓝色统计值都能查看依据。' }]);
  const [question, setQuestion] = useState('');
  const [target, setTarget] = useState('overview');
  const [rewriteId, setRewriteId] = useState<string>();
  const [rewriteModes, setRewriteModes] = useState<RewriteMode[]>([]);
  const [rewriteText, setRewriteText] = useState('');
  const dirty = !!analysis && analysis.key !== `${scope.start}/${scope.end}/${scope.channel}`;
  const selectionDirty = !!report && (report.sections.filter(s => s.category).map(s => s.category).join('|') !== selected.join('|') || report.sections.some(s => s.id === 'leadership') !== leadership);
  const invalidReport = dirty || selectionDirty;
  const verified = report?.sections.filter(s => s.versions[s.active].verified).length || 0;
  const say = (text: string) => setChat(c => [...c, { role: 'assistant', text }]);

  async function runAnalysis() {
    if (lock.current) return;
    try { validateScope(scope); } catch (error) { message.warning((error as Error).message); return; }
    lock.current = true; setBusy('analysis'); setView('analysis'); setMetric(undefined);
    try {
      const capturedScope = { ...scope };
      for (let i = 0; i < analysisSteps.length; i++) { setPhase(i); await pause(330); }
      const result = analyze(capturedScope);
      setAnalysis(result); setSelected(result.topics.slice(0, 2).map(t => t.category)); setReport(undefined);
      say(`已分析${capturedScope.start}至${capturedScope.end}的${capturedScope.channel}工单，共${result.current.length}件。${result.topics.length ? `优先推荐${result.topics.slice(0, 2).map(t => t.category).join('、')}。请在右侧查看依据并确认选题。` : '本期暂无工单，可生成空数据说明周报。'}`);
    } catch { message.error('分析失败，请重试'); } finally { lock.current = false; setBusy(''); }
  }
  function choose(values: Category[]) {
    if (values.length > 4) { message.warning('最多选择四项本期热点'); return; }
    setSelected(values);
  }
  async function createReport() {
    if (!analysis || dirty || lock.current) return;
    if (analysis.topics.length && !selected.length) { message.warning('请至少确认一项热点'); return; }
    lock.current = true; setBusy('generate');
    try {
      await pause(450);
      setReport(generateReport(analysis, selected, leadership)); setView('report');
      say('周报已生成。蓝色数字可点击核验；你可以逐板块重写、恢复历史版本，核验后导出 Word。');
    } finally { lock.current = false; setBusy(''); }
  }
  async function rewrite(id: string, modes: RewriteMode[] = []) {
    if (!report || invalidReport || lock.current) return;
    lock.current = true; setBusy(`rewrite-${id}`);
    try {
      await pause(350);
      setReport(current => {
        if (!current) return current;
        return { ...current, sections: current.sections.map(s => {
          if (s.id !== id) return s;
          const number = Math.max(...s.versions.map(v => v.number)) + 1;
          const next = buildVersion(current.analysis, s.id, s.category, number, modes);
          return { ...s, versions: [...s.versions, next], active: s.versions.length };
        }) };
      });
      setRewriteId(undefined); message.success('该板块已更新，核验状态已恢复为待核验');
    } finally { lock.current = false; setBusy(''); }
  }
  function toggleVerified(id: string) {
    setReport(current => current && ({ ...current, sections: current.sections.map(s => s.id !== id ? s : { ...s, versions: s.versions.map((v, i) => i === s.active ? { ...v, verified: !v.verified } : v) }) }));
  }
  async function exportWord() {
    if (!report || invalidReport || lock.current) return;
    lock.current = true; setBusy('word');
    try {
      await pause(40);
      const { createWord, downloadBlob } = await import('@/lib/weeklyReportExport');
      downloadBlob(await createWord(report), `${report.title}_${report.analysis.scope.start}.docx`);
      message.success('已导出当前预览版本');
    } catch { message.error('Word 导出失败，请重试'); } finally { lock.current = false; setBusy(''); }
  }
  function confirmExport() {
    if (!report) return;
    const remaining = report.sections.length - verified;
    if (remaining) modal.confirm({ title: `还有 ${remaining} 个板块待核验`, content: '导出文件将包含当前预览内容与模拟数据标识。你也可以先点击蓝色数字检查明细。', okText: '仍然导出', cancelText: '继续核验', onOk: exportWord });
    else void exportWord();
  }
  async function send(input = question) {
    const value = input.trim();
    if (!value || busy) return;
    setQuestion(''); setChat(c => [...c, { role: 'user', text: value }]);
    if (!analysis || dirty) { say('请先点击“分析本期数据”，建立当前日期与渠道的统计依据。'); return; }
    if (/为什么|推荐原因|推荐依据|解释/.test(value)) {
      say(analysis.topics.filter(t => selected.includes(t.category)).map(t => `${t.category}：${t.reasons.join('；')}。`).join('\n') || '暂无已选热点，请在右侧选择。'); return;
    }
    if (/加入|添加|移除|取消/.test(value)) {
      const names = CATEGORIES.filter(c => value.includes(c));
      if (!names.length) { say(`可选类型：${CATEGORIES.join('、')}。例如“加入教育”。`); return; }
      const remove = /移除|取消/.test(value);
      const next = remove ? selected.filter(c => !names.includes(c)) : [...new Set([...selected, ...names.filter(c => analysis.topics.some(t => t.category === c))])];
      if (next.length > 4) { say('最多选择四项热点，请先移除已有选题。'); return; }
      choose(next); setView('analysis'); say(`选题已调整为：${next.join('、') || '暂无'}。确认后点击“生成周报”，已有成稿需重新生成。`); return;
    }
    const modes = parseModes(value);
    if (modes.length && report && !invalidReport) {
      const section = report.sections.find(s => s.id === target);
      if (!section) { say('请先选择要调整的板块。'); return; }
      await rewrite(target, modes); say(`已对“${section.title}”应用：${modes.join('、')}。统计值保持不变，请重新核验本版本。`); setView('report'); return;
    }
    say('本地演示支持：解释推荐依据、加入或移除指定选题，以及对已生成板块进行“精简表达、突出环比、强调点位、加强建议”。暂不支持任意开放式问答，请选择快捷指令或明确一个受支持的调整方向。');
  }
  function showMetric(token: Token, a: Analysis) {
    if (typeof token === 'string') return;
    setMetric(a.metrics[token.metricId]);
  }
  const renderTokens = (tokens: Token[], a: Analysis) => tokens.map((t, i) => typeof t === 'string' ? <span key={i}>{t}</span> : <button key={i} className="weekly-number" onClick={() => showMetric(t, a)} title={`${a.metrics[t.metricId].label} · 点击核验`} aria-label={`${a.metrics[t.metricId].label} ${metricText(a.metrics[t.metricId])}，查看依据`}>{metricText(a.metrics[t.metricId])}</button>);
  const metricButton = (a: Analysis, kind: Metric['kind'], filter = {}, period: Metric['period'] = 'current') => renderTokens([registerMetric(a, kind, filter, period)], a);
  const disabled = !!busy;

  return <PlatformShell><div className="weekly-workbench">
    <header className="weekly-heading"><div className="flex items-center gap-3"><div className="weekly-heading-icon"><FileTextOutlined /></div><div><h1>智能周报</h1><p>从诉求变化到热点研判，让每一份周报有据可查</p></div><Tag color="blue">本地规则演示</Tag></div><div className="weekly-heading-note">模拟数据覆盖 2026.03—2026.05</div></header>
    <div className="weekly-stepbar"><Steps size="small" current={!analysis || dirty ? 0 : !report || selectionDirty ? 1 : verified === report.sections.length ? 3 : 2} items={[{ title: '选择范围' }, { title: '分析与选题' }, { title: '生成与核验' }, { title: '导出周报' }]} /></div>
    <div className="weekly-columns">
      <aside className="weekly-assistant">
        <div className="weekly-settings"><h2><CalendarIcon /> 生成设置</h2><label>统计日期</label><DatePicker.RangePicker aria-label="统计日期范围" allowClear={false} value={[dayjs(scope.start), dayjs(scope.end)]} disabled={disabled} format="YYYY-MM-DD" disabledDate={d => d.format('YYYY-MM-DD') < DATA_START || d.format('YYYY-MM-DD') > DATA_END} onChange={dates => { if (dates?.[0] && dates[1]) setScope({ ...scope, start: dates[0].format('YYYY-MM-DD'), end: dates[1].format('YYYY-MM-DD') }); }} />
          <div className="weekly-range-hint">共 {dayCount(scope.start, scope.end)} 天 · 对比前一等长周期</div>
          <label>统计渠道</label><Segmented block value={scope.channel} disabled={disabled} options={['12345热线', '全渠道']} onChange={value => setScope({ ...scope, channel: value as Channel })} />
          <div className="weekly-range-hint">{scope.channel === '12345热线' ? '仅统计热线受理工单，与现有周报口径一致' : '包含12345热线、网格巡查及其他渠道'}</div>
          <Checkbox checked={leadership} disabled={disabled} onChange={e => setLeadership(e.target.checked)}>包含领导批示板块</Checkbox>
          <Button block type="primary" size="large" icon={<ThunderboltOutlined />} loading={busy === 'analysis'} disabled={disabled && busy !== 'analysis'} onClick={runAnalysis}>{analysis ? '重新分析本期数据' : '分析本期数据'}</Button>
          <p className="weekly-data-note">全渠道每日约1,300条，热线每日约400条。全部为可核验的模拟明细。</p>
        </div>
        <div className="weekly-chat-heading"><RobotOutlined /> 周报助手 <span>规则模拟</span></div>
        <div className="weekly-chat-messages" aria-live="polite">{chat.map((item, i) => <div key={i} className={`weekly-chat-item ${item.role}`}><span className="weekly-chat-role">{item.role === 'assistant' ? '周报助手' : '我'}</span><div>{item.text}</div></div>)}</div>
        <div className="weekly-composer"><div className="weekly-shortcuts"><button disabled={disabled} onClick={() => send('为什么推荐这些热点')}>解释推荐依据</button><button disabled={disabled} onClick={() => send('加入教育')}>加入教育选题</button></div>
          {report && <Select aria-label="问答调整目标板块" value={target} onChange={setTarget} options={report.sections.map(s => ({ value: s.id, label: `调整：${s.title}` }))} disabled={disabled || invalidReport} />}
          <Input.TextArea aria-label="周报调整要求" value={question} onChange={e => setQuestion(e.target.value)} placeholder="例如：精简表达，并加强建议" autoSize={{ minRows: 2, maxRows: 4 }} disabled={disabled} onPressEnter={e => { if (!e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
          <div className="weekly-composer-footer"><span>支持四类改写指令 · Shift+Enter 换行</span><Button type="primary" icon={<SendOutlined />} disabled={disabled || !question.trim()} onClick={() => send()} aria-label="发送调整要求" /></div>
        </div>
      </aside>
      <section className="weekly-main">
        <div className="weekly-main-toolbar"><Segmented value={view} onChange={v => setView(v)} options={[{ label: <span><BarChartOutlined /> 分析与选题</span>, value: 'analysis' }, { label: <span><FileTextOutlined /> 周报预览</span>, value: 'report', disabled: !report }]} /><div className="flex items-center gap-3">{report && <span className="weekly-muted">已核验 {verified}/{report.sections.length} 个板块</span>}<Button icon={<DownloadOutlined />} type="primary" disabled={!report || invalidReport || disabled} loading={busy === 'word'} onClick={confirmExport}>导出 Word</Button></div></div>
        {dirty && <Alert type="warning" showIcon title="统计范围已改变，待重新分析" description="下方保留上次结果供参考。请重新分析后再生成与导出。" />}
        {!dirty && selectionDirty && <Alert type="warning" showIcon title="选题或板块设置已改变，请重新生成周报" />}
        {busy === 'analysis' ? <div className="weekly-analyzing"><div className="weekly-pulse"><BarChartOutlined /></div><h2>正在分析本期诉求</h2><p>从逐条工单中识别值得关注的变化</p><Steps direction="vertical" size="small" current={phase} items={analysisSteps.map(title => ({ title }))} /><Progress percent={(phase + 1) * 25} showInfo={false} /><span className="weekly-muted">本地规则分析 · 统计完成后请人工确认选题</span></div> : !analysis ? <div className="weekly-welcome"><div className="weekly-welcome-graphic"><FileSearchOutlined /><span><CheckCircleOutlined /></span></div><h2>一份有依据的周报，从分析开始</h2><p>选择日期和统计渠道，先看热点推荐，再确认本期选题。</p><div className="weekly-feature-grid"><div><b>01</b><strong>看清推荐依据</strong><span>数量、环比、点位集中度</span></div><div><b>02</b><strong>逐项核验数据</strong><span>蓝色数字直达工单明细</span></div><div><b>03</b><strong>灵活调整成稿</strong><span>板块重写、版本恢复与导出</span></div></div><Button type="primary" size="large" icon={<ThunderboltOutlined />} onClick={runAnalysis}>分析默认示例</Button><p className="weekly-muted">默认示例：2026.04.20—04.26 · 12345热线</p></div> : view === 'analysis' ? <div className="weekly-analysis-content">
          <div className="weekly-analysis-intro"><div><h2>本期诉求分析</h2><span>{analysis.scope.start} 至 {analysis.scope.end} · {analysis.scope.channel} · 上海时间</span></div><Tag color="green">明细统计完成</Tag></div>
          <div className="weekly-stats"><div><span>本期受理总量</span><strong>{metricButton(analysis, 'count')}<small>件</small></strong></div><div><span>日均受理</span><strong>{metricButton(analysis, 'daily')}<small>件/天</small></strong></div><div><span>较上期变化</span><strong>{metricButton(analysis, 'change')}</strong></div><div><span>上期受理总量</span><strong>{metricButton(analysis, 'count', {}, 'previous')}<small>件</small></strong></div></div>
          {!analysis.comparisonComplete && <Alert type="warning" showIcon title="比较期数据覆盖不完整，本期不计算环比及增长得分" />}
          <div className="weekly-topic-heading"><div><h3>推荐热点选题</h3><p>综合工单量、正向增长与前三点位集中度，推荐优先关注以下类型。</p></div><Tag>{selected.length}/4 项已选</Tag></div>
          <div className="weekly-scoring">推荐规则：工单量 50% + 正向增长 30% + 点位集中度 20%，分别按本期类型最大值归一化；上期不足10件不以增长率加分。<Tooltip title="综合得分用于辅助选题，不代表问题严重程度；未选推荐也可以生成其他类型。"><span>了解口径 ⓘ</span></Tooltip></div>
          {!analysis.topics.length && <Empty description="本期暂无工单，无可推荐热点；可生成空数据说明周报" />}
          <div className="weekly-topic-list">{analysis.topics.slice(0, 5).map((topic, index) => <article key={topic.category} className={`weekly-topic-card ${selected.includes(topic.category) ? 'selected' : ''}`}><div className="weekly-topic-card-top"><Checkbox disabled={disabled || dirty} checked={selected.includes(topic.category)} onChange={e => choose(e.target.checked ? [...selected, topic.category] : selected.filter(c => c !== topic.category))}><strong>{topic.category}</strong></Checkbox><span className="weekly-topic-rank">{index < 2 ? '优先推荐' : `候选 ${index + 1}`} · 综合分 {topic.score.toFixed(1)}</span></div><div className="weekly-topic-numbers"><span>本期 {metricButton(analysis, 'count', { category: topic.category })} 件</span><span>占比 {metricButton(analysis, 'share', { category: topic.category })}</span><span>环比 {metricButton(analysis, 'change', { category: topic.category })}</span>{topic.previous < 10 && <Tag color="orange">小基数</Tag>}</div><div className="weekly-topic-reasons">{topic.reasons.map((reason, i) => <span key={i}>{reason}</span>)}</div><div className="weekly-topic-point">高发点位：{topic.points[0]?.point || '无'}{topic.points[0] && <> · {metricButton(analysis, 'count', { category: topic.category, point: topic.points[0].point })} 件</>}</div></article>)}</div>
          <div className="weekly-other-topics"><label>其他类型 / 调整选题</label><Select mode="multiple" aria-label="选择周报热点" value={selected} disabled={disabled || dirty} options={analysis.topics.map(t => ({ value: t.category, label: t.category }))} onChange={choose} placeholder="最多选择四项" /></div>
          <div className="weekly-selection-footer"><span>已选：{selected.join('、') || '暂无'}<small>比较期：{analysis.previousScope.start} 至 {analysis.previousScope.end}</small></span><Button type="primary" size="large" icon={<FileTextOutlined />} loading={busy === 'generate'} disabled={dirty || disabled} onClick={createReport}>{report ? '按当前选题重新生成' : '确认选题，生成周报'}</Button></div>
        </div> : report ? <div className={`weekly-report-area ${invalidReport ? 'stale' : ''}`}><div className="weekly-preview-hint"><FileSearchOutlined /> 蓝色统计值可点击核验；单个板块可独立重写。<Tag color="gold">模拟数据</Tag></div><article className="weekly-paper"><div className="weekly-paper-header"><span>闵行区城市运行管理中心</span><span>诉求热点分析 · 演示稿</span></div><h2>{report.title}</h2><div className="weekly-paper-period">（{report.analysis.scope.start} — {report.analysis.scope.end}）</div><p className="weekly-paper-disclaimer">本地模拟数据演示 · 按受理时间统计 · 唯一工单编号去重</p>
          {report.sections.map(section => { const version = section.versions[section.active]; return <section key={section.id} className="weekly-report-section" id={`weekly-${section.id}`}><div className="weekly-section-heading"><h3>{section.title}</h3><Tag color={version.verified ? 'green' : 'default'}>{version.verified ? '已核验' : '待核验'} · v{version.number}</Tag></div><div className="weekly-section-actions"><Button size="small" icon={<ReloadOutlined />} disabled={disabled || invalidReport} loading={busy === `rewrite-${section.id}`} onClick={() => rewrite(section.id, version.modes)}>重新生成</Button><Button size="small" disabled={disabled || invalidReport} onClick={() => { setRewriteId(section.id); setRewriteModes(version.modes); setRewriteText(''); }}>补充要求</Button><Select aria-label={`${section.title}历史版本`} size="small" value={section.active} disabled={disabled || invalidReport} suffixIcon={<HistoryOutlined />} onChange={active => setReport(r => r && ({ ...r, sections: r.sections.map(s => s.id === section.id ? { ...s, active } : s) }))} options={section.versions.map((v, i) => ({ value: i, label: `v${v.number}${v.verified ? ' · 已核验' : ''}` }))} /><Button size="small" type={version.verified ? 'default' : 'link'} icon={<CheckCircleOutlined />} disabled={disabled || invalidReport} onClick={() => toggleVerified(section.id)}>{version.verified ? '取消核验' : '标记已核验'}</Button></div>
            {version.modes.length > 0 && <div className="weekly-rewrite-note">本版本写作要求：{version.modes.join('、')}</div>}{version.paragraphs.map((tokens, i) => <p key={i}>{renderTokens(tokens, report.analysis)}</p>)}{version.table && version.table.rows.length > 0 && <div className="weekly-table-scroll"><table><thead><tr>{version.table.headers.map(h => <th key={h}>{h}</th>)}</tr></thead><tbody>{version.table.rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{renderTokens(cell, report.analysis)}</td>)}</tr>)}</tbody></table></div>}</section>; })}
          <footer className="weekly-paper-footer">本报告数据与案例均为模拟内容，仅用于产品功能演示。</footer></article></div> : null}
      </section>
    </div>
    {metric && analysis && <WeeklyEvidenceDrawer key={metric.id} metric={metric} analysis={report && view === 'report' ? report.analysis : analysis} onClose={() => setMetric(undefined)} />}
    <Modal open={!!rewriteId} title="补充要求并重新生成" okText="应用要求并重写" cancelText="取消" confirmLoading={busy.startsWith('rewrite-')} onCancel={() => { if (!busy) setRewriteId(undefined); }} onOk={() => {
      const parsed = parseModes(rewriteText), modes = [...new Set([...rewriteModes, ...parsed])];
      if (rewriteText.trim() && !parsed.length) { message.warning('本地规则暂不支持此要求，请使用下方四类写作方向'); return; }
      if (rewriteId) void rewrite(rewriteId, modes);
    }}><p>支持以下写作方向及其组合，统计结果和数据依据保持不变。</p><Checkbox.Group value={rewriteModes} options={REWRITE_MODES} onChange={values => setRewriteModes(values as RewriteMode[])} /><Input.TextArea className="weekly-rewrite-input" value={rewriteText} onChange={e => setRewriteText(e.target.value)} rows={3} placeholder="例如：突出环比变化，强调集中点位，并加强工作建议" /><Alert type="info" showIcon title="仅识别上述四类方向；其他开放式要求不在本地演示支持范围内。" /></Modal>
  </div></PlatformShell>;
}
function CalendarIcon() { return <BarChartOutlined />; }
