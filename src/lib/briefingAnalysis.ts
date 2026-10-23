import { analyze, matches, shiftDate, validateScope, type Analysis, type DataCoverage, type MetricFilter, type Order, type Scope } from './weeklyReport';
import { compileThemeRule, themeMatch, themeRuleDescription } from './themeMatching';
import { inferScene, type TaxonomyMode } from './workOrderTaxonomy';
import type { ReportTheme, ThemeResult } from './reportTemplates';

export type ReviewState = 'confirmed' | 'pending' | 'excluded';
export function reviewThemeOrders(themes: ReportTheme[], theme: ReportTheme, ids: string[], decision: 'include' | 'exclude'): ReportTheme[] {
  const latest = themes.find(t => t.id === theme.id) || themes.find(t => !!theme.filter.semantic && t.filter.semantic?.topic === theme.filter.semantic.topic);
  const overrides = { ...theme.filter.reviewOverrides, ...latest?.filter.reviewOverrides };
  for (const id of new Set(ids)) overrides[id] = decision;
  const updated = { ...theme, filter: { ...theme.filter, reviewOverrides: overrides } };
  const next = themes.map(t => t.id === theme.id ? updated : theme.filter.semantic && t.filter.semantic?.topic === theme.filter.semantic.topic ? { ...t, filter: { ...t.filter, reviewOverrides: overrides } } : t);
  return next.some(t => t.id === theme.id) ? next : [...next, updated];
}
export function assessOrder(order: Order, filter: MetricFilter): { state: ReviewState; reason: string } {
  const base = { ...filter, semantic: undefined, reviewOverrides: undefined };
  if (!matches(order, base)) return { state: 'excluded', reason: '不符合当前分类或细分条件' };
  const decision = filter.reviewOverrides?.[order.id];
  if (decision) return { state: decision === 'include' ? 'confirmed' : 'excluded', reason: decision === 'include' ? '人工确认计入' : '人工确认不属于本主题' };
  if (!filter.semantic) return { state: 'confirmed', reason: '符合所选分类与筛选条件' };
  const rule = filter.semantic, text = (order.description + ' ' + order.point).toLowerCase();
  if (themeMatch(rule, order)) return { state: 'confirmed', reason: '符合主题表达组合' };
  if (rule.excluded.some(term => text.includes(term.toLowerCase()))) return { state: 'excluded', reason: '命中主题排除表达' };
  const hit = rule.groups.filter(words => words.some(word => text.includes(word.toLowerCase()))).length;
  return hit > 0 ? { state: 'pending', reason: `命中${hit}/${rule.groups.length}组表达，归属需要人工核对` } : { state: 'excluded', reason: '未命中相关主题表达' };
}
export function reviewedRows(orders: Order[], filter: MetricFilter) {
  return orders.map(order => ({ ...order, assessment: assessOrder(order, filter) })).filter(row => row.assessment.state !== 'excluded')
    .sort((a, b) => Number(b.assessment.state === 'pending') - Number(a.assessment.state === 'pending') || a.id.localeCompare(b.id));
}
export function themeResult(a: Analysis, theme: ReportTheme): ThemeResult {
  const now = a.current.filter(o => matches(o, theme.filter)), old = a.previous.filter(o => matches(o, theme.filter));
  const counts = new Map<string, number>(); now.forEach(o => counts.set(o.point, (counts.get(o.point) || 0) + 1));
  const points = [...counts].map(([point, count]) => ({ point, count })).sort((x, y) => y.count - x.count).slice(0, 3);
  return { ...theme, count: now.length, previous: old.length, growth: a.comparisonComplete && old.length ? (now.length - old.length) / old.length : null, share: a.current.length ? now.length / a.current.length : 0, points, concentration: now.length ? points.reduce((n, p) => n + p.count, 0) / now.length : 0, score: 0 };
}
export function classificationThemes(a: Analysis, mode: TaxonomyMode): ThemeResult[] {
  const field = mode === 'city' ? 'cityCategory4' : 'districtCategory';
  const values = [...new Set(a.current.map(o => o[field]).filter((v): v is string => !!v))];
  const results = values.map(value => themeResult(a, { id: `${mode}:${value}`, name: value.split(' / ').at(-1)!, group: '热点事件', taxonomy: mode, path: value, filter: { [field]: value } }));
  const maxCount = Math.max(1, ...results.map(t => t.count)), maxGrowth = Math.max(.001, ...results.map(t => t.previous >= 10 ? Math.max(0, t.growth || 0) : 0));
  results.forEach(t => { t.score = 100 * (.7 * t.count / maxCount + .3 * (t.previous >= 10 ? Math.max(0, t.growth || 0) : 0) / maxGrowth); });
  return results.sort((x, y) => y.score - x.score || y.count - x.count);
}
export const SEMANTIC_ISSUES: { name: string; words: string[] }[] = [
  { name: '枝叶遮挡与采光', words: ['遮挡', '采光', '挡光'] }, { name: '树木倾斜与枯死', words: ['倾斜', '枯死', '倒伏'] }, { name: '落叶与飘絮', words: ['落叶', '飘絮'] },
  { name: '学区划分', words: ['学区', '对口学校'] }, { name: '入学信息登记', words: ['信息登记', '入学登记'] }, { name: '招生政策咨询', words: ['招生政策'] },
  { name: '餐饮场所吸烟', words: ['餐厅', '餐馆', '餐饮'] }, { name: '电梯及电梯厅吸烟', words: ['电梯'] }, { name: '楼道及入户厅吸烟', words: ['楼道', '入户厅'] },
  { name: '餐品质量', words: ['餐品质量', '饭菜', '食品质量', '菜品质量'] }, { name: '餐费与优惠', words: ['价格', '餐费', '优惠'] }, { name: '助餐开放与服务时间', words: ['开放', '营业', '关门', '配餐'] },
  { name: '占道与设摊', words: ['设摊', '跨门经营', '占道'] }, { name: '设施维修响应', words: ['维修', '设施损坏', '照明故障'] },
];
export function topicChildren(a: Analysis, theme: ReportTheme, mode: 'classification' | 'semantic'): ThemeResult[] {
  const rows = a.current.filter(o => matches(o, theme.filter));
  if (mode === 'classification') {
    if (theme.filter.cityCategory4 || theme.filter.districtSubcategory) return [];
    const values = [...new Set(rows.map(o => o.districtSubcategory).filter((v): v is string => !!v))];
    return values.map(value => themeResult(a, { ...theme, id: `${theme.id}/class:${value}`, name: value, parentId: theme.id, filter: { ...theme.filter, districtSubcategory: value } })).sort((x, y) => y.count - x.count);
  }
  return SEMANTIC_ISSUES.filter(issue => !theme.filter.textGroups?.some(words => JSON.stringify(words) === JSON.stringify(issue.words))).map(issue => themeResult(a, { ...theme, id: `${theme.id}/semantic:${issue.name}`, name: issue.name, parentId: theme.id, filter: { ...theme.filter, textGroups: [...(theme.filter.textGroups || []), issue.words] } })).filter(t => t.count > 0).sort((x, y) => y.count - x.count);
}
export function resolveQuestionScope(input: string, scope: Scope, coverage: DataCoverage): Scope {
  const since = input.match(/(?:(\d{4})年)?(\d{1,2})月(?:份)?(?:以来|起|至今)/);
  const recent = input.match(/近(?:一个月|一月|30天|一周|7天)/);
  const next = since ? { ...scope, start: `${since[1] || scope.end.slice(0, 4)}-${since[2].padStart(2, '0')}-01` } : recent ? { ...scope, start: shiftDate(scope.end, /周|7天/.test(recent[0]) ? -6 : -29) } : scope;
  validateScope(next, coverage); return next;
}
export function customTheme(input: string, id: string, category?: string): ReportTheme {
  const scopeCategory = category || (input.includes('公建配套') ? '公建配套' : undefined);
  const matchingInput = scopeCategory ? input.replaceAll(scopeCategory + '中', '').replaceAll(scopeCategory, '') : input;
  const semantic = { ...compileThemeRule(matchingInput), topic: input.trim() };
  return { id, name: input.trim().slice(0, 60), group: '热点事件', custom: true, filter: { semantic, ...(scopeCategory ? { category: scopeCategory } : {}) }, note: themeRuleDescription(semantic) };
}
export type QuestionResult = { analysis: Analysis; theme: ReportTheme; reply: string; pending: number; intent: 'count' | 'scenes' | 'issues' | 'growth'; };
export function askOrders(input: string, scope: Scope, orders: Order[], coverage: DataCoverage, previous?: QuestionResult): QuestionResult {
  const nextScope = resolveQuestionScope(input, scope, coverage), a = analyze(nextScope, orders, coverage);
  const followup = !!previous && /其中|这些|再|具体|继续|主要|哪里|为什么|哪些|餐厅|电梯|楼道/.test(input) && !/社区食堂|行道树|教育|公建配套|公共场所吸烟/.test(input);
  const theme = followup ? structuredClone(previous!.theme) : customTheme(input, `question:${input}`, /公建配套/.test(input) ? '公建配套' : undefined);
  const classification = input.match(/(?:市级|区级)(?:分类)?[：:]\s*(.+?)(?:有多少|多少|工单|？|$)/);
  if (classification) { const field = /市级/.test(input) ? 'cityCategory4' : 'districtCategory'; const label = classification[1].trim(); const options = [...new Set(orders.map(o => o[field]).filter((v): v is string => !!v))].filter(v => v === label || v.split(' / ').at(-1) === label); theme.filter = { [field]: options.length === 1 ? options[0] : label }; }
  if (/全部工单|所有工单|总量/.test(input)) { theme.filter = {}; theme.name = '全部工单'; }
  if (followup) {
    const scene = ['餐厅', '电梯', '楼道'].find(word => input.includes(word));
    if (scene) { theme.filter.textGroups = [...(theme.filter.textGroups || []), [scene]]; theme.name = `${previous!.theme.name} · ${scene}`; }
  }
  const result = themeResult(a, theme), pending = reviewedRows(a.current, theme.filter).filter(o => o.assessment.state === 'pending').length;
  const intent = /为什么|增长|环比|原因/.test(input) ? 'growth' : /场景|哪里|餐厅|电梯|楼道/.test(input) ? 'scenes' : /具体|哪些|诉求构成|细分/.test(input) ? 'issues' : 'count';
  const scenes = new Map<string, number>(); a.current.filter(o => matches(o, theme.filter)).forEach(o => { const scene = o.scene || inferScene(o); scenes.set(scene, (scenes.get(scene) || 0) + 1); });
  const top = [...scenes].sort((x, y) => y[1] - x[1]).slice(0, 3);
  return { analysis: a, theme, pending, intent, reply: intent === 'scenes' || intent === 'growth' ? `已按当前主题比较具体发生场景，主要涉及${top.map(([name]) => name).join('、') || '暂无可识别场景'}。这反映工单投诉构成，不能据此认定现实原因。` : intent === 'issues' ? '可以继续按工单描述细分诉求，也可以打开相关工单核对主题归属。' : result.count ? '已找到符合当前主题口径的工单，可继续追问场景、具体诉求或变化来源。' : '当前口径没有已确认匹配的工单。请检查时间、分类和主题表述；未覆盖的自然语言按关键词规则匹配。' };
}
