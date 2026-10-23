'use client';

import { Empty, Table, Tooltip } from 'antd';
import type { WordFrequency } from '@/lib/textDiscovery';

export default function WordCloudAnalysis({ words, disabled, onWord }: { words: WordFrequency[]; disabled: boolean; onWord: (word: WordFrequency) => void }) {
  if (!words.length) return <Empty description="当前周期没有可展示的有效词语" />;
  const max = words[0].frequency, min = words.at(-1)!.frequency;
  return <section className="briefing-word-analysis"><h3>本期工单高频词</h3><p className="briefing-subtle">字号表示词频，包含同一工单中的重复出现；点击词语查看相关工单。</p><div className="briefing-word-cloud" aria-label="本期工单词云">{words.slice(0, 45).map((item, i) => <Tooltip key={item.word} title={`分词出现${item.frequency}次，原词涉及${item.orders}条工单；点击核验`}><button disabled={disabled} style={{ fontSize: 14 + 24 * Math.sqrt((item.frequency - min) / Math.max(1, max - min)), color: ['#2165ae', '#558c91', '#6773a7', '#3f87b2', '#876d9b'][i % 5] }} onClick={() => onWord(item)}>{item.word}</button></Tooltip>)}</div><Table size="small" rowKey="word" dataSource={words} pagination={{ pageSize: 10, showSizeChanger: false }} columns={[
    { title: '词语', dataIndex: 'word', render: (word: string, item: WordFrequency) => <button className="weekly-number" disabled={disabled} onClick={() => onWord(item)}>{word}</button> },
    { title: '分词出现次数', dataIndex: 'frequency', render: (value: number) => value.toLocaleString() },
    { title: '包含原词的去重工单', dataIndex: 'orders', render: (value: number, item: WordFrequency) => <button className="weekly-number" disabled={disabled} onClick={() => onWord(item)}>{value.toLocaleString()} 件</button> },
  ]} /></section>;
}
