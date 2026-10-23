import { matches, type Analysis } from './weeklyReport';
import { themeResult } from './briefingAnalysis';
import type { ReportTheme, ThemeResult } from './reportTemplates';

export type WordFrequency = { word: string; frequency: number; orders: number };
const stopWords = new Set(['模拟', '市民', '反映', '希望', '相关', '单位', '核实', '处理', '诉求', '工单', '点位', '位于', '存在', '现象', '问题', '工作人员', '及时', '回应', '感谢', '沟通', '耐心', '处置', '附近', '属于', '是否', '有待', '核实处理', '可以', '需要', '这个', '一个', '进行', '情况', '目前', '要求', '建议', '表示', '服务', '加强', '影响', '明显', '有人']);
const dictionary = ['社区食堂', '社区助餐', '长者食堂', '老年人', '二手烟', '电梯厅', '入户厅', '公共大厅', '餐饮场所', '餐厅', '学区划分', '招生政策', '入学登记', '信息登记', '枝叶遮挡', '采光', '树木倾斜', '落叶', '飘絮', '无序设摊', '跨门经营', '公共区域', '公共设施', '设施损坏', '照明故障', '物业服务', '响应', '充电设施', '飞线充电', '非机动车', '无序停放', '通行受阻', '道路通行', '餐品质量', '开放时间', '价格', '优惠', '噪声', '施工', '商业经营', '吸烟', '抽烟', '烟味', '控烟', '劝阻', '楼道', '遮挡', '维修', '停车管理'];
const segmenter = new Intl.Segmenter('zh-CN', { granularity: 'word' });
const domainWords = new RegExp(`(${dictionary.sort((a, b) => b.length - a.length).join('|')})`, 'g');
export function segmentOrderText(text: string): string[] {
  return text.toLowerCase().split(domainWords).flatMap(part => dictionary.includes(part) ? [part] : [...segmenter.segment(part)].filter(s => s.isWordLike).map(s => s.segment))
    .filter(word => word.length >= 2 && word.length <= 12 && !stopWords.has(word) && /^[\p{Script=Han}a-z]+$/u.test(word));
}

/** Count real token occurrences; order count uses the shared literal evidence filter. */
export function wordFrequencies(a: Analysis, limit = 60): WordFrequency[] {
  const counts = new Map<string, number>(), cache = new Map<string, string[]>();
  for (const order of a.current) {
    const text = `${order.description} ${order.point}`;
    let words = cache.get(text);
    if (!words) { words = segmentOrderText(text); cache.set(text, words); }
    for (const word of words) counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0], 'zh-CN')).slice(0, limit)
    .map(([word, frequency]) => ({ word, frequency, orders: a.current.filter(o => matches(o, { textGroups: [[word]] })).length }));
}

const motifs = [
  { name: '居民采光与枝叶遮挡', groups: [['树木', '树枝', '枝叶', '行道树'], ['采光', '挡光', '遮挡']] },
  { name: '公共空间二手烟暴露', groups: [['抽烟', '吸烟', '二手烟', '烟味'], ['公共', '楼道', '电梯', '餐厅', '大厅']], excluded: ['没有吸烟', '未发现吸烟', '不涉及吸烟', '无人吸烟'] },
  { name: '老年群体助餐体验', groups: [['老年人', '老人', '长者', '高龄'], ['社区食堂', '社区助餐', '助餐点', '长者食堂']] },
  { name: '出入口与道路通行障碍', groups: [['通行', '出入口', '道路'], ['受阻', '占道', '堆物', '无序停放', '设摊']] },
  { name: '公共设施报修与响应', groups: [['设施', '照明', '物业'], ['维修', '损坏', '故障', '响应']] },
  { name: '居住环境安静需求', groups: [['噪声', '噪音', '扰民'], ['生活', '商业', '施工', '休息', '夜间']] },
];

/** Local stand-in for full-corpus LLM discovery, independent of classification fields. */
export function semanticDiscoveries(a: Analysis, words = wordFrequencies(a)): ThemeResult[] {
  const proposals = [...motifs.map(m => ({ ...m, excluded: 'excluded' in m ? m.excluded : [] }))];
  const genericContexts = new Set(['周边', '社区', '幼儿', '小区', '公共区域', '住宅', '街道', '公共', '区域', '七宝', '浦江', '莘庄', '咨询', '沿街', '活动', '道路', '地铁', '出入口', '商业', '中心', '广场', '片区', '新城', '沿线']);
  const terms = words.filter(w => !genericContexts.has(w.word)).slice(0, 10).map(w => w.word);
  const issuePattern = /遮挡|采光|倾斜|落叶|飘絮|设摊|经营|损坏|故障|维修|响应|充电|停放|受阻|质量|开放|价格|优惠|噪声|吸烟|抽烟|烟味|二手烟|收费|安全|延迟|不足|失效|投诉/;
  // Co-occurrence supplies data-driven topics for imported vocabulary beyond the demo motifs.
  for (let i = 0; i < terms.length; i++) for (let j = i + 1; j < terms.length; j++) {
    if (terms[i].includes(terms[j]) || terms[j].includes(terms[i])) continue;
    if (!issuePattern.test(terms[i]) && !issuePattern.test(terms[j])) continue;
    proposals.push({ name: `${terms[i]}与${terms[j]}相关诉求`, groups: [[terms[i]], [terms[j]]], excluded: [] });
  }
  const candidates: (ThemeResult & { ids: Set<string> })[] = [];
  for (const p of proposals) {
    const theme: ReportTheme = { id: `semantic:${p.groups.map(g => g.join('|')).join('&')}`, group: '热点事件', source: 'semantic', name: p.name,
      filter: { semantic: { topic: p.name, version: 1, groups: p.groups, excluded: p.excluded || [], expanded: true, reviewTerms: ['有待核实', '是否属于', '无法确认'] } },
      note: '遍历本期全部工单文本，按共同对象、场景与诉求组合聚合；不使用市、区分类字段。本地规则模拟，非真实大模型输出。' };
    const result = themeResult(a, theme);
    if (!result.count) continue;
    const ids = new Set(a.current.filter(o => matches(o, theme.filter)).map(o => o.id));
    // Avoid presenting the same set repeatedly under different wording.
    if (candidates.some(t => [...ids].filter(id => t.ids.has(id)).length / Math.max(ids.size, t.ids.size) > .8)) continue;
    candidates.push({ ...result, ids });
  }
  return candidates.sort((x, y) => y.count - x.count || x.id.localeCompare(y.id)).slice(0, 5).map(candidate => {
    const { ids, ...result } = candidate;
    void ids;
    return result;
  });
}
