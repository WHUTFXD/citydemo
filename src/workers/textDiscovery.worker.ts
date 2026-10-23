import type { Analysis } from '../lib/weeklyReport';
import { semanticDiscoveries, wordFrequencies } from '../lib/textDiscovery';

self.onmessage = (event: MessageEvent<Analysis>) => {
  try {
    const words = wordFrequencies(event.data);
    self.postMessage({ words, semantics: semanticDiscoveries(event.data, words) });
  } catch {
    self.postMessage({ error: '文本分析失败，请重新分析本期工单' });
  }
};
