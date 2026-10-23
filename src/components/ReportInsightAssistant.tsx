'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Button, Empty, Input, Select, Tag } from 'antd';
import { CloseOutlined, PlusOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';
import { buildInsight, insightContexts, type InsightAnswer, type InsightIntent } from '@/lib/reportInsight';
import { metricText, type Metric, type Report } from '@/lib/weeklyReport';

type Turn = { id: string; prompt: string; context: string; excerpt: string; scope: string; answer: InsightAnswer };
export default function ReportInsightAssistant({ report, visible, disabled, open, onOpenChange, contextId, onContextChange, onMetric }: {
  report: Report; visible: boolean; disabled: boolean; open: boolean; onOpenChange: (open: boolean) => void;
  contextId?: string; onContextChange: (id: string) => void; onMetric: (metric: Metric) => void;
}) {
  const contexts = useMemo(() => insightContexts(report), [report]);
  const context = contexts.find(c => c.id === contextId) || contexts[0];
  const [prompt, setPrompt] = useState(''), [turns, setTurns] = useState<Turn[]>([]), [thinking, setThinking] = useState(false), [error, setError] = useState('');
  const input = useRef<import('antd').InputRef>(null), messages = useRef<HTMLDivElement>(null), timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const sending = useRef(false);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => { if (visible && open) input.current?.focus(); }, [visible, open]);
  useEffect(() => { if (messages.current) messages.current.scrollTop = messages.current.scrollHeight; }, [turns, thinking]);
  function send(value = prompt) {
    if (disabled || sending.current || !value.trim() || !context) return;
    const question = value.trim(), selected = structuredClone(context);
    const previous: InsightIntent | undefined = [...turns].reverse().find(t => t.context === selected.id)?.answer.intent;
    sending.current = true; setThinking(true); setError(''); setPrompt('');
    timer.current = setTimeout(() => {
      try {
        const answer = buildInsight(report, selected, question, previous);
        setTurns(items => [...items, { id: crypto.randomUUID(), prompt: question, context: selected.id, excerpt: selected.text, scope: `${selected.section} · 第${selected.paragraph}段 · v${selected.version} · ${report.analysis.scope.start}至${report.analysis.scope.end}`, answer }]);
      } catch (e) { setError((e as Error).message); setPrompt(question); }
      finally { setThinking(false); sending.current = false; }
    }, 450);
  }
  if (!visible) return null;
  return <>
    {!open && <Button className="report-insight-launcher" type="primary" size="large" icon={<RobotOutlined />} aria-expanded={false} aria-controls="report-insight-panel" onClick={() => onOpenChange(true)}>AI辅助研判</Button>}
    {open && <aside id="report-insight-panel" className="report-insight-panel" aria-label="AI辅助研判聊天窗口" onKeyDown={e => { if (e.key === 'Escape' && !e.nativeEvent.isComposing) { e.stopPropagation(); onOpenChange(false); } }}>
      <header className="report-insight-header"><div><RobotOutlined /><strong>AI辅助研判</strong><Tag color="blue">本地模拟</Tag></div><div><Button type="text" size="small" icon={<PlusOutlined />} disabled={thinking} aria-label="开始新研判对话" onClick={() => { setTurns([]); setPrompt(''); setError(''); input.current?.focus(); }}>新对话</Button><Button type="text" size="small" icon={<CloseOutlined />} aria-label="收起AI辅助研判" onClick={() => onOpenChange(false)} /></div></header>
      <div className="report-insight-context"><label htmlFor="insight-context">选择报告段落作为上下文</label><Select id="insight-context" aria-label="研判上下文段落" showSearch optionFilterProp="label" value={context?.id} disabled={thinking || disabled} onChange={id => { onContextChange(id); setError(''); }} options={contexts.map(c => ({ value: c.id, label: `${c.section} · 第${c.paragraph}段 · ${c.text.slice(0, 40)}` }))} /><blockquote>{context?.text || '当前报告暂无可选段落'}</blockquote><span>基于当前报告快照及对应两期工单，收起后保留对话。</span></div>
      {disabled && <Alert type="warning" title="报告或设置已变化，请完成更新后再研判" showIcon />}
      <div className="report-insight-messages" ref={messages} aria-live="polite" aria-busy={thinking}>
        {!turns.length && !thinking && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={<span>选择段落，提出你关心的问题<br />例如：为什么本期增长这么多？</span>} />}
        {turns.map(turn => <div className="report-insight-turn" key={turn.id}><div className="report-insight-question"><span>我 · {turn.scope}</span><p>{turn.prompt}</p></div><div className="report-insight-answer"><details><summary>本轮引用的报告原文</summary><p>{turn.excerpt}</p></details>{turn.answer.blocks.map((block, i) => <section key={i}><h4>{block.title}</h4><p>{block.tokens.map((token, j) => typeof token === 'string' ? <span key={j}>{token}</span> : <button className="weekly-number" key={j} onClick={() => onMetric(report.analysis.metrics[token.metricId])} aria-label={`${report.analysis.metrics[token.metricId].label}，查看研判依据`}>{metricText(report.analysis.metrics[token.metricId])}</button>)}</p></section>)}</div></div>)}
        {thinking && <p className="report-insight-thinking"><RobotOutlined /> 正在对照段落口径，比较两期工单…</p>}
        {error && <Alert type="error" title={error} />}
      </div>
      <div className="report-insight-composer"><div className="report-insight-shortcuts">{['为什么增长这么多？', '集中于哪些场景和诉求？', '下一步如何核查？'].map(text => <Button key={text} size="small" disabled={disabled || thinking || !context} onClick={() => send(text)}>{text}</Button>)}</div><Input.TextArea ref={input} aria-label="辅助研判提示词" value={prompt} onChange={e => setPrompt(e.target.value)} disabled={disabled || thinking} maxLength={1000} autoSize={{ minRows: 2, maxRows: 4 }} placeholder="结合选中段落，描述你希望分析的问题" onPressEnter={e => { if (!e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); } }} /><div className="report-insight-send"><small>规则模拟 · 不自动改写报告 · Shift+Enter换行</small><Button type="primary" icon={<SendOutlined />} loading={thinking} disabled={disabled || thinking || !prompt.trim() || !context} onClick={() => send()}>发送</Button></div></div>
    </aside>}
  </>;
}
