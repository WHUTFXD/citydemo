import { inferScene } from './workOrderTaxonomy';
import { topicChildren } from './briefingAnalysis';
import { matches, registerMetric, textOf, type MetricFilter, type Report, type Token } from './weeklyReport';

export type InsightContext = { id: string; section: string; version: number; paragraph: number; text: string; filter?: MetricFilter; ambiguous: boolean };
export type InsightIntent = 'growth' | 'points' | 'structure' | 'checks' | 'scenes';
export type InsightAnswer = { intent?: InsightIntent; blocks: { title: string; tokens: Token[] }[] };
export function insightContexts(report: Report): InsightContext[] {
  return report.sections.flatMap(section => {
    const version = section.versions[section.active];
    const sectionTokens = version.paragraphs.find(tokens => tokens.some(t => typeof t !== 'string')) || version.table?.rows.flat(2) || [];
    return version.paragraphs.map((tokens, index) => {
      const own = tokens.filter(t => typeof t !== 'string');
      const source = own.length ? own : sectionTokens.filter(t => typeof t !== 'string');
      const filters = [...new Map(source.flatMap(token => {
        const metric = typeof token !== 'string' ? report.analysis.metrics[token.metricId] : undefined;
        return metric ? [[JSON.stringify(metric.filter), metric.filter] as const] : [];
      })).values()];
      return { id: `${section.id}/v${version.number}/p${index}`, section: section.title, version: version.number, paragraph: index + 1, text: textOf(tokens, report.analysis), filter: filters.length === 1 ? structuredClone(filters[0]) : undefined, ambiguous: filters.length !== 1 };
    });
  });
}
function resolveIntent(prompt: string, previous?: InsightIntent): InsightIntent | undefined {
  if (/核实|核查|验证|建议|怎么办|下一步|排查/.test(prompt)) return 'checks';
  if (/场景|餐厅|电梯|楼道|具体诉求|什么诉求/.test(prompt)) return 'scenes';
  if (/哪里|点位|地区|街镇|集中|地点/.test(prompt)) return 'points';
  if (/结构|业务|类型|构成|分类|诉求内容/.test(prompt)) return 'structure';
  if (/为什么|原因|增长|上涨|下降|变化|增幅|环比|洞察|分析|研判/.test(prompt)) return 'growth';
  if (/继续|展开|详细|进一步/.test(prompt)) return previous || 'growth';
}
export function buildInsight(report: Report, context: InsightContext, prompt: string, previous?: InsightIntent): InsightAnswer {
  const currentContext = insightContexts(report).find(c => c.id === context.id);
  if (!currentContext || currentContext.text !== context.text) throw new Error('报告段落已变化，请重新选择上下文');
  const intent = resolveIntent(prompt, previous);
  if (!intent) return { blocks: [{ title: '请选择研判方向', tokens: ['本地模拟支持：分析增长或下降、定位集中点位、查看具体场景与诉求构成、给出核查建议。可尝试“为什么增长这么多？”或“主要集中在哪里？”。'] }] };
  if (currentContext.ambiguous || !currentContext.filter) return { intent, blocks: [{ title: '需要明确统计口径', tokens: ['这个段落没有单一可关联的统计口径。请选择包含同一主题数量或环比的段落，再发起研判。'] }] };
  const a = report.analysis, filter = currentContext.filter;
  const now = a.current.filter(o => matches(o, filter)), old = a.previous.filter(o => matches(o, filter));
  const metric = (kind: 'count' | 'change', extra: MetricFilter = {}, period: 'current' | 'previous' = 'current') => registerMetric(a, kind, { ...filter, ...extra }, period);
  const blocks: InsightAnswer['blocks'] = [];
  blocks.push({ title: '先核对变化', tokens: [`本期（${a.scope.start}至${a.scope.end}）同口径工单`, metric('count'), '件；上期（' + a.previousScope.start + '至' + a.previousScope.end + '）', metric('count', {}, 'previous'), '件。', ...(a.comparisonComplete && old.length ? ['环比', metric('change'), '。'] : [a.comparisonComplete ? '上期为零，不能计算增长率；可比较两期绝对数量。' : '比较期覆盖不完整，不能据此判断增长率。']), old.length > 0 && old.length < 10 ? '上期不足10件，属于小基数，增长率容易放大。' : ''] });
  if (intent === 'growth' || intent === 'points') {
    const pointMap = new Map<string, { now: number; old: number }>();
    now.forEach(o => { const row = pointMap.get(o.point) || { now: 0, old: 0 }; row.now++; pointMap.set(o.point, row); });
    old.forEach(o => { const row = pointMap.get(o.point) || { now: 0, old: 0 }; row.old++; pointMap.set(o.point, row); });
    const increase = now.length >= old.length;
    const ranked = [...pointMap].sort((x, y) => intent === 'points' ? y[1].now - x[1].now || x[0].localeCompare(y[0]) : (increase ? 1 : -1) * ((y[1].now - y[1].old) - (x[1].now - x[1].old)) || x[0].localeCompare(y[0]));
    const relevant = intent === 'points' || !a.comparisonComplete ? ranked : ranked.filter(([, n]) => increase ? n.now > n.old : n.now < n.old);
    if (!now.length && !old.length) blocks.push({ title: '暂无可归因的工单', tokens: ['两期均无匹配记录，请核对主题和统计日期。'] });
    else {
      blocks.push({ title: intent === 'points' ? '本期集中点位' : a.comparisonComplete ? increase ? '增量主要来自哪些点位' : '减少主要发生在哪些点位' : '当前已覆盖的点位分布', tokens: [a.comparisonComplete ? '以下按实际工单比较定位变化来源，点击数字可查看对应两期依据。' : '以下仅供查看分布，比较期缺失会影响排序，不能据此归因。'] });
      relevant.slice(0, 3).forEach(([point]) => blocks.push({ title: point, tokens: ['上期', metric('count', { point }, 'previous'), '件 → 本期', metric('count', { point }), '件。'] }));
      if (a.comparisonComplete && now.length === old.length) blocks.push({ title: '总量持平', tokens: ['两期总量相同；局部点位仍可能一增一减，不能据局部变化认定整体增长。'] });
    }
  }
  if (intent === 'growth' || intent === 'structure' || intent === 'scenes') {
    const scenes = [...new Set([...now, ...old].map(o => o.scene || inferScene(o)))].map(scene => ({ scene, now: now.filter(o => (o.scene || inferScene(o)) === scene).length, old: old.filter(o => (o.scene || inferScene(o)) === scene).length })).sort((x, y) => y.now - x.now);
    blocks.push({ title: '投诉发生在哪些具体场景', tokens: ['根据点位及工单描述识别场景，比较同一主题在不同场景中的构成变化。'] });
    scenes.slice(0, 3).forEach(({ scene }) => blocks.push({ title: scene, tokens: ['上期', metric('count', { scene }, 'previous'), '件 → 本期', metric('count', { scene }), '件。'] }));
    const issues = topicChildren(a, { id: 'insight', name: context.section, group: '热点事件', filter }, 'semantic').slice(0, 3);
    blocks.push({ title: '进一步看具体诉求', tokens: [issues.length ? '以下为从工单描述中识别的诉求表达，可能交叉，不可相加。可逐项打开相关工单核对。' : '当前描述未形成更多可识别的诉求分组，需要抽查工单原文补充判断。'] });
    issues.forEach(issue => blocks.push({ title: issue.name, tokens: ['上期', metric('count', issue.filter, 'previous'), '件 → 本期', metric('count', issue.filter), '件。'] }));
  }
  blocks.push({ title: '研判边界与下一步', tokens: [
    '上述结果解释“哪些工单和点位带来了数量变化”，无法单凭工单数量确定现实原因。',
    /树|枝叶|采光/.test([filter.category, filter.cityCategory4, filter.districtCategory, filter.semantic?.topic, context.section].join(' ')) ? '建议抽查新增点位的工单原文及养护记录，核实是否集中反映枝叶遮挡、树木倾斜或养护响应；天气与季节因素需要另行核实。' : '建议抽查变化较大的点位工单原文，与办理记录及现场核查结果交叉验证。',
    '同时检查同一事项是否多次来电、受理渠道或分类规则是否调整；当前仅按唯一工单编号去重，不等于按同一事件去重。',
    '本回答为本地规则模拟，不引入未经提供的天气、政策或现场事实，也不会自动改写报告。',
  ] });
  return { intent, blocks };
}
