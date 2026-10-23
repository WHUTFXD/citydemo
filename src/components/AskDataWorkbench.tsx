'use client';

import { getTrialSampleOrders } from '@/lib/trialData';

import { useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dayjs from 'dayjs';
import { Alert, App, Button, DatePicker, Input, Space, Tag } from 'antd';
import { MessageOutlined, PlusOutlined, SendOutlined } from '@ant-design/icons';
import BriefingShell from './BriefingShell';
import ThemeExplorerDrawer from './ThemeExplorerDrawer';
import WeeklyEvidenceDrawer from './WeeklyEvidenceDrawer';
import { useWeeklyWorkspace } from './WeeklyWorkspaceProvider';
import { askOrders, topicChildren, type QuestionResult } from '@/lib/briefingAnalysis';
import { matches, metricText, registerMetric, type Analysis, type Metric, type MetricFilter } from '@/lib/weeklyReport';
import { inferScene } from '@/lib/workOrderTaxonomy';

const examples = ['行道树有哪些具体诉求？', '公共场所吸烟主要集中在哪些场景？', '公建配套中老年人、社区食堂有多少工单？', '区级分类：教育有多少工单？'];
export default function AskDataWorkbench() {
  const { dataRevision } = useWeeklyWorkspace();
  return <BriefingShell><AskDataChat key={dataRevision} /></BriefingShell>;
}
function AskDataChat() {
  const { message } = App.useApp();
  const w = useWeeklyWorkspace();
  const { scope, setScope, sourceOrders, coverage, datasetName, dataKind, dataRevision } = w;
  const orders = useMemo(() => sourceOrders || getTrialSampleOrders(), [sourceOrders]);
  const [input, setInput] = useState(''), [thinking, setThinking] = useState(false), [turns, setTurns] = useState<{ question: string; result: QuestionResult }[]>([]);
  const [metric, setMetric] = useState<{ metric: Metric; analysis: Analysis }>(), [explorer, setExplorer] = useState<QuestionResult>();
  const sending = useRef(false);
  async function send(text = input) {
    if (!text.trim() || sending.current) return;
    sending.current = true; setThinking(true); setInput('');
    try {
      await new Promise(resolve => setTimeout(resolve, 250));
      const previous = turns.at(-1)?.result;
      const saved = previous && w.customThemes.find(t => t.id === previous.theme.id);
      const result = askOrders(text.trim(), scope, orders, coverage, previous ? { ...previous, theme: saved || previous.theme } : undefined);
      result.analysis.dataRevision = dataRevision; result.analysis.dataLabel = datasetName; result.analysis.dataKind = dataKind;
      setScope(result.analysis.scope);
      setTurns(items => [...items, { question: text.trim(), result }]);
    } catch (e) { message.warning((e as Error).message); setInput(text); } finally { sending.current = false; setThinking(false); }
  }
  function number(result: QuestionResult, kind: Metric['kind'], extra: MetricFilter = {}, period: Metric['period'] = 'current') {
    const token = registerMetric(result.analysis, kind, { ...result.theme.filter, ...extra }, period) as { metricId: string };
    const metric = result.analysis.metrics[token.metricId];
    return <button className="weekly-number" onClick={() => setMetric({ metric, analysis: result.analysis })} aria-label={`${metric.label}，查看相关工单`}>{metricText(metric)}</button>;
  }
  return <><div className="briefing-page-heading"><div><h1>智能问数</h1></div><Tag color="blue">规则模拟</Tag></div><div className="ask-layout"><aside className="ask-context-panel"><h3>统计范围</h3><Tag>{dataKind === 'sample' ? '样例数据' : '试用数据'}</Tag><p className="briefing-subtle">{datasetName}<br />{coverage.start} 至 {coverage.end}</p><DatePicker.RangePicker aria-label="问数统计周期" allowClear={false} disabled={thinking} value={[dayjs(scope.start), dayjs(scope.end)]} disabledDate={d => d.format('YYYY-MM-DD') < coverage.start || d.format('YYYY-MM-DD') > coverage.end} onChange={dates => { if (dates?.[0] && dates[1]) setScope({ ...scope, start: dates[0].format('YYYY-MM-DD'), end: dates[1].format('YYYY-MM-DD') }); }} /><h3 style={{ marginTop: 28 }}>常用问题</h3>{examples.map(example => <button className="ask-example" key={example} disabled={thinking} onClick={() => send(example)}>{example}</button>)}<Link href="/data-trial">导入业务数据 →</Link></aside><section className="ask-chat"><header className="ask-chat-header"><span><MessageOutlined /> 工单问数助手</span><Button size="small" icon={<PlusOutlined />} disabled={thinking} onClick={() => { setTurns([]); setInput(''); }}>新对话</Button></header><div className="ask-turns" aria-live="polite">{!turns.length && <div className="briefing-empty"><MessageOutlined /><h2>请输入问题</h2></div>}{turns.map(({ question, result }, index) => {
    const rows = result.analysis.current.filter(o => matches(o, result.theme.filter));
    const scenes = [...new Set(rows.map(o => o.scene || inferScene(o)))].map(scene => ({ scene, count: rows.filter(o => (o.scene || inferScene(o)) === scene).length })).sort((x, y) => y.count - x.count).slice(0, 3);
    const issues = topicChildren(result.analysis, result.theme, 'semantic').slice(0, 3);
    return <div key={index}><div className="ask-user">{question}</div><div className="ask-answer"><h3>{result.theme.name}</h3><span className="briefing-subtle">当轮数据快照 · {result.analysis.scope.start} 至 {result.analysis.scope.end}</span><p>{result.reply}</p><div className="briefing-stats"><div><span>本期已计入</span><strong>{number(result, 'count')}</strong></div><div><span>上期同口径</span><strong>{number(result, 'count', {}, 'previous')}</strong></div><div><span>占本期总量</span><strong>{number(result, 'share')}</strong></div><div><span>环比</span><strong>{number(result, 'change')}</strong></div></div>{(result.intent === 'growth' || result.intent === 'scenes') && !!scenes.length && <><h3>具体发生场景</h3>{scenes.map(item => <p key={item.scene}>{item.scene}：{number(result, 'count', { scene: item.scene })} 件</p>)}</>}{result.intent === 'issues' && issues.map(issue => <p key={issue.id}>{issue.name}：{number({ ...result, theme: issue }, 'count')} 件</p>)}{result.pending > 0 && <Alert type="warning" title={`${result.pending}条相关记录待人工核对，暂未计入`} showIcon />}<Space style={{ marginTop: 15 }} wrap><Button size="small" onClick={() => setExplorer(result)}>查看细分与相关工单</Button><Button size="small" type="link" onClick={() => send('其中主要集中在哪里？')} disabled={thinking || index !== turns.length - 1}>继续追问场景</Button></Space></div></div>;
  })}{thinking && <p className="briefing-subtle">正在分析…</p>}</div><div className="ask-composer"><Input.TextArea aria-label="问数问题" value={input} maxLength={300} rows={3} disabled={thinking} onChange={e => setInput(e.target.value)} placeholder="输入主题、多个关键词或一个业务问题…" onPressEnter={e => { if (!e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} /><div><span className="briefing-subtle">追问沿用当前主题 · Shift+Enter换行</span><Button type="primary" icon={<SendOutlined />} disabled={!input.trim() || thinking} loading={thinking} onClick={() => send()}>发送</Button></div></div></section></div>{metric && <WeeklyEvidenceDrawer metric={metric.metric} analysis={metric.analysis} onClose={() => setMetric(undefined)} />}{explorer && <ThemeExplorerDrawer analysis={explorer.analysis} theme={explorer.theme} onClose={() => setExplorer(undefined)} />}</>;
}
