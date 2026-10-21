import { themeMatch, type ThemeRule } from './themeMatching';
export const DATA_START = '2026-03-01';
export const DATA_END = '2026-05-31';
export const CATEGORIES = ['教育', '市容市貌', '行道树', '公共区域吸烟', '物业管理', '噪声扰民', '交通出行', '公共设施'] as const;
export type Category = typeof CATEGORIES[number];
export type Channel = '12345热线' | '全渠道';
export type Order = { id: string; receivedAt: string; channel: string; business: string; category: Category; street: string; point: string; department: string; description: string };
export type Scope = { start: string; end: string; channel: Channel };
export type MetricFilter = { category?: Category; point?: string; business?: string; channel?: string; keyword?: string; semantic?: ThemeRule };
export type Metric = { id: string; label: string; kind: 'count' | 'daily' | 'share' | 'change'; period: 'current' | 'previous'; filter: MetricFilter; value: number | null; numerator: number; denominator: number; formula: string; definitionId?: string; definitionCode?: string; definitionVersion?: number; definitionDescription?: string };
export type Topic = { category: Category; count: number; previous: number; growth: number | null; share: number; concentration: number; points: { point: string; street: string; count: number }[]; score: number; reasons: string[] };
export type Analysis = { scope: Scope; previousScope: Scope; days: number; comparisonComplete: boolean; current: Order[]; previous: Order[]; topics: Topic[]; previousTopics: Topic[]; metrics: Record<string, Metric>; key: string; dataRevision?: number };
export type Token = string | { metricId: string };
export type RewriteMode = '精简表达' | '突出环比' | '强调点位' | '加强建议';
export const REWRITE_MODES: RewriteMode[] = ['精简表达', '突出环比', '强调点位', '加强建议'];
export type SectionVersion = { number: number; paragraphs: Token[][]; table?: { headers: string[]; rows: Token[][][] }; verified: boolean; modes: RewriteMode[] };
export type ReportSection = { id: string; title: string; category?: Category; versions: SectionVersion[]; active: number; recipe?: import('./reportTemplates').SectionRecipe };
export type Report = { analysis: Analysis; sections: ReportSection[]; title: string; createdAt: string; templateSnapshot?: import('./reportTemplates').ReportTemplate; definitionSnapshot?: import('./indicatorDefinitions').IndicatorDefinition[]; themes?: import('./reportTemplates').ReportTheme[]; configurationKey?: string; dataRevision?: number };
export const shiftDate = (date: string, days: number) => new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
export const dayCount = (start: string, end: string) => Math.round((Date.parse(end) - Date.parse(start)) / 86400000) + 1;
export function validateScope(scope: Scope) {
  const days = dayCount(scope.start, scope.end);
  if (!Number.isFinite(days) || days < 1 || days > 31) throw new Error('请选择连续 1–31 天的日期范围');
  if (scope.start < DATA_START || scope.end > DATA_END) throw new Error('模拟数据覆盖 2026 年 3 月 1 日至 5 月 31 日');
  return days;
}
const STREETS = ['七宝镇', '莘庄镇', '浦江镇', '浦锦街道', '梅陇镇', '颛桥镇', '虹桥镇', '吴泾镇'];
const POINTS: Record<Category, string[]> = {
  教育: ['尚德坤庭幼儿园周边', '明强小学周边', '某招生服务窗口', '社区教育服务点'],
  市容市貌: ['鲁宁路沿线', '黎安路沿线', '沈杜公路地铁站周边', '沿街商铺集中区'],
  行道树: ['静安新城片区道路', '莘松路沿线', '社区主干道', '居民区周边道路'],
  公共区域吸烟: ['小区楼道', '居民楼电梯厅', '小区入户厅', '公共服务场所入口'],
  物业管理: ['某住宅小区公共区域', '社区停车场', '居民楼公共设施', '小区物业服务点'],
  噪声扰民: ['沿街商业区域', '住宅小区北门', '社区活动场地', '道路施工区域'],
  交通出行: ['地铁站出入口', '公交站点', '学校周边道路', '社区出入口'],
  公共设施: ['社区公共活动区', '人行道沿线', '公共厕所周边', '健身设施区域'],
};
const FIXED_POINT_STREETS: Record<string, string> = {
  '尚德坤庭幼儿园周边': '浦锦街道', '明强小学周边': '七宝镇',
  '鲁宁路沿线': '浦江镇', '黎安路沿线': '莘庄镇', '沈杜公路地铁站周边': '浦江镇',
  '静安新城片区道路': '七宝镇', '莘松路沿线': '莘庄镇',
};
export const TOPIC_COPY: Record<Category, { issues: string[]; advice: string }> = {
  教育: { issues: ['招生政策咨询', '入学信息登记', '学区划分咨询'], advice: '加强招生政策解读，对咨询集中的点位做好分类答复，明确办理路径，及时回应家长关切。' },
  市容市貌: { issues: ['无序设摊', '跨门经营', '公共区域堆物'], advice: '加强重点路段和重点时段巡查，推动属地与执法力量协同，及时清理占道问题并做好回访。' },
  行道树: { issues: ['枝叶遮挡采光及设施', '树木倾斜与枯死', '落叶与飘絮扰民'], advice: '对道路及居民区周边树木开展排查，及时修剪遮挡枝叶，扶正加固倾斜树木，做好养护作业告知。' },
  公共区域吸烟: { issues: ['楼道吸烟', '电梯厅吸烟', '公共场所入口吸烟'], advice: '完善禁烟提示标识，推动物业加强公共区域巡查和劝阻，做好宣传引导及处置反馈。' },
  物业管理: { issues: ['公共设施维修', '停车管理', '物业服务响应'], advice: '督促物业建立维修与诉求处理台账，明确响应时限，对重复反映的问题开展联合会商。' },
  噪声扰民: { issues: ['商业经营噪声', '施工噪声', '社会生活噪声'], advice: '加强重点时段巡查，核实噪声来源，落实分类处置与沟通反馈，减少对居民休息的影响。' },
  交通出行: { issues: ['非机动车无序停放', '道路通行受阻', '站点秩序问题'], advice: '加强交通节点与社区出入口秩序维护，完善停放引导，对集中点位持续跟踪。' },
  公共设施: { issues: ['设施损坏', '照明故障', '公共设施养护'], advice: '开展公共设施安全排查，落实报修、维修、回访闭环，优先处理影响通行与使用安全的问题。' },
};
let cachedOrders: Order[] | undefined;
export function getMockOrders(): Order[] {
  if (cachedOrders) return cachedOrders;
  const orders: Order[] = [];
  let seed = 20260420;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let date = DATA_START, day = 0; date <= DATA_END; date = shiftDate(date, 1), day++) {
    const volume = 1220 + Math.floor(random() * 161), hotline = 365 + Math.floor(random() * 81);
    const weights = [date >= '2026-04-13' && date <= '2026-04-19' ? 32 : 12, 17, date >= '2026-04-20' && date <= '2026-04-26' ? 31 : 5, date >= '2026-04-20' && date <= '2026-04-26' ? 17 : 2, 18, 12 + Math.floor(day / 14) % 3 * 5, 10, 12];
    const sum = weights.reduce((a, b) => a + b, 0);
    for (let i = 0; i < volume; i++) {
      let pick = random() * sum, index = 0;
      while (index < weights.length - 1 && (pick -= weights[index]) >= 0) index++;
      const category = CATEGORIES[index];
      const streetIndex = random() < .45 ? index % STREETS.length : Math.floor(random() * STREETS.length);
      const pointIndex = random() < .5 ? 0 : Math.floor(random() * 4);
      const street = FIXED_POINT_STREETS[POINTS[category][pointIndex]] || STREETS[streetIndex];
      const sampledIssue = TOPIC_COPY[category].issues[Math.floor(random() * 3)];
      const crossCategorySmoking = ['物业管理', '公共设施', '交通出行'].includes(category) && i % 17 === 0;
      const issue = crossCategorySmoking ? ['公共大厅有人抽烟，二手烟影响通行', '公共区域有明显烟味，希望加强控烟劝阻'][i % 2] : category === '公共区域吸烟' ? `${POINTS[category][pointIndex]}存在吸烟现象` : sampledIssue;
      const praise = random() < .005;
      orders.push({ id: `MOCK-${date.replaceAll('-', '')}-${String(i + 1).padStart(4, '0')}`, receivedAt: `${date} ${String(Math.floor(random() * 24)).padStart(2, '0')}:${String(Math.floor(random() * 60)).padStart(2, '0')}:00`, channel: i < hotline ? '12345热线' : i % 5 ? '网格巡查' : '其他渠道', business: praise ? '表扬感谢' : i % 9 === 0 ? '咨询' : '投诉求助', category, street, point: `${street}·${POINTS[category][pointIndex]}`, department: `${street}城运中心`, description: praise ? `模拟市民感谢${street}工作人员及时回应${category}相关诉求，沟通耐心、处置及时。` : `模拟市民反映${issue}，点位位于${POINTS[category][pointIndex]}，希望相关单位核实处理。` });
    }
  }
  cachedOrders = orders;
  return orders;
}
export function matches(order: Order, filter: MetricFilter) { return (!filter.semantic || themeMatch(filter.semantic, order)) && (!filter.category || order.category === filter.category) && (!filter.point || order.point === filter.point) && (!filter.business || order.business === filter.business) && (!filter.channel || order.channel === filter.channel) && (!filter.keyword || [order.description, order.point, order.category].some(value => value.toLowerCase().includes(filter.keyword!.toLowerCase()))); }
function rankTopics(current: Order[], previous: Order[], complete: boolean): Topic[] {
  const topics = CATEGORIES.map(category => {
    const records = current.filter(o => o.category === category), old = previous.filter(o => o.category === category).length;
    const points = new Map<string, { point: string; street: string; count: number }>();
    records.forEach(o => { const value = points.get(o.point) || { point: o.point, street: o.street, count: 0 }; value.count++; points.set(o.point, value); });
    const top = [...points.values()].sort((a, b) => b.count - a.count).slice(0, 3);
    return { category, count: records.length, previous: old, growth: complete && old > 0 ? (records.length - old) / old : null, share: current.length ? records.length / current.length : 0, concentration: records.length ? top.reduce((s, p) => s + p.count, 0) / records.length : 0, points: top, score: 0, reasons: [] as string[] };
  }).filter(t => t.count > 0);
  const maxCount = Math.max(1, ...topics.map(t => t.count));
  const growthEligible = (t: Topic) => t.previous >= 10 ? Math.max(0, t.growth || 0) : 0;
  const maxGrowth = Math.max(.000001, ...topics.map(growthEligible)), maxConcentration = Math.max(.000001, ...topics.map(t => t.concentration));
  topics.forEach(t => {
    t.score = (t.count / maxCount * .5 + growthEligible(t) / maxGrowth * .3 + t.concentration / maxConcentration * .2) * 100;
    t.reasons = [`本期${t.count}件，占本期工单${(t.share * 100).toFixed(1)}%`, complete ? t.previous < 10 ? `上期${t.previous}件，属小基数，不以增长率加分` : `较上期${t.previous}件${t.growth! >= 0 ? '增长' : '下降'}${(Math.abs(t.growth!) * 100).toFixed(1)}%` : '比较期覆盖不完整，不计算环比及增长得分', `前三点位集中了${(t.concentration * 100).toFixed(1)}%的该类诉求`];
  });
  return topics.sort((a, b) => b.score - a.score || b.count - a.count);
}
export function analyze(scope: Scope, source = getMockOrders()): Analysis {
  const days = validateScope(scope), previousScope = { ...scope, start: shiftDate(scope.start, -days), end: shiftDate(scope.start, -1) };
  const unique = [...new Map(source.map(o => [o.id, o])).values()];
  const select = (s: Scope) => unique.filter(o => o.receivedAt.slice(0, 10) >= s.start && o.receivedAt.slice(0, 10) <= s.end && (s.channel === '全渠道' || o.channel === s.channel));
  const current = select(scope), previous = select(previousScope), comparisonComplete = previousScope.start >= DATA_START;
  const preceding = select({ ...scope, start: shiftDate(previousScope.start, -days), end: shiftDate(previousScope.start, -1) });
  return { scope: { ...scope }, previousScope, days, comparisonComplete, current, previous, topics: rankTopics(current, previous, comparisonComplete), previousTopics: rankTopics(previous, preceding, shiftDate(previousScope.start, -days) >= DATA_START), metrics: {}, key: `${scope.start}/${scope.end}/${scope.channel}` };
}
export function registerMetric(a: Analysis, kind: Metric['kind'], filter: MetricFilter = {}, period: Metric['period'] = 'current'): Token {
  const id = `${a.key}/${kind}/${period}/${filter.category || '*'}/${filter.point || '*'}/${filter.business || '*'}/${filter.channel || '*'}/${filter.keyword || '*'}/${filter.semantic ? JSON.stringify(filter.semantic) : '*'}`;
  const base = period === 'current' ? a.current : a.previous;
  const n = base.filter(o => matches(o, filter)).length, old = a.previous.filter(o => matches(o, filter)).length;
  const d = kind === 'change' ? old : kind === 'share' ? base.filter(o => !filter.channel || o.channel === filter.channel).length : kind === 'daily' ? a.days : 1;
  const value = kind === 'change' ? a.comparisonComplete && old > 0 ? (n - old) / old : null : kind === 'count' ? n : d ? n / d : 0;
  const label = `${filter.category || filter.business || '全部工单'}${filter.point ? ' · ' + filter.point : ''} · ${{ count: '工单量', daily: '日均量', share: '占比', change: '环比' }[kind]}${period === 'previous' ? '（上期）' : ''}`;
  const formula = kind === 'count' ? `按唯一工单编号去重计数 = ${n}件` : kind === 'daily' ? `${n}件 ÷ ${a.days}天 = ${(n / a.days).toFixed(1)}件/天` : kind === 'share' ? `${n}件 ÷ ${d}件 × 100%` : !a.comparisonComplete ? '比较期覆盖不完整，环比不计算' : old === 0 ? '上期为0，环比不计算' : `(${n} − ${old}) ÷ ${old} × 100%`;
  a.metrics[id] = { id, label, kind, period, filter, value, numerator: n, denominator: d, formula };
  return { metricId: id };
}
export function metricText(m: Metric) {
  if (m.value === null) return '—';
  if (m.kind === 'count') return String(m.value);
  if (m.kind === 'daily') return m.value.toFixed(1);
  return `${m.kind === 'change' && m.value > 0 ? '+' : ''}${(m.value * 100).toFixed(1)}%`;
}
export function textOf(tokens: Token[], a: Analysis) { return tokens.map(t => typeof t === 'string' ? t : metricText(a.metrics[t.metricId])).join(''); }
export function buildVersion(a: Analysis, id: string, category: Category | undefined, number: number, modes: RewriteMode[] = []): SectionVersion {
  const m = (kind: Metric['kind'], filter: MetricFilter = {}, period: Metric['period'] = 'current') => registerMetric(a, kind, filter, period);
  const paragraphs: Token[][] = [];
  let table: SectionVersion['table'];
  const brief = modes.includes('精简表达');
  if (id === 'overview') {
    paragraphs.push([`本期（${a.scope.start}至${a.scope.end}），我区共受理${a.scope.channel === '全渠道' ? '城运' : '12345热线'}工单`, m('count'), '件，日均', m('daily'), '件。']);
    if (!brief || modes.includes('突出环比')) paragraphs.push(a.comparisonComplete ? ['上一等长周期共受理', m('count', {}, 'previous'), '件，本期环比', m('change'), '。'] : ['比较期覆盖不完整，本期不进行环比比较。']);
    if (number % 2 === 0 && !brief) paragraphs.push(['统计范围与受理口径保持一致，以下结合类型变化及集中点位开展分析。']);
    const top = a.topics[0];
    if (modes.includes('强调点位') && top?.points[0]) paragraphs.push([`优先推荐类型${top.category}的集中点位为${top.points[0].point}，涉及`, m('count', { category: top.category, point: top.points[0].point }), '件。']);
    if (modes.includes('加强建议') && top) paragraphs.push([`建议优先关注${top.category}诉求。${TOPIC_COPY[top.category].advice}`]);
  } else if (category) {
    const t = a.topics.find(t => t.category === category)!;
    const filter = { category };
    paragraphs.push([`本期全区共受理${category}相关工单`, m('count', filter), '件，占本期总量', m('share', filter), '，日均', m('daily', filter), '件。']);
    if (!brief || modes.includes('突出环比')) paragraphs.push(a.comparisonComplete ? ['上期同类工单', m('count', filter, 'previous'), '件，本期环比', m('change', filter), t.previous === 0 ? '（上期为零，无法计算）。' : t.previous < 10 ? '（上期基数较小，需审慎判断）。' : '。'] : ['比较期覆盖不完整，不计算同类诉求环比。']);
    if (!brief) paragraphs.push([`市民主要反映${TOPIC_COPY[category].issues.join('、')}等问题。${number % 2 === 0 ? '应结合高发点位持续关注诉求变化。' : '相关诉求需加强分类研判和跟踪处置。'}`]);
    if (modes.includes('强调点位') && t.points[0]) paragraphs.push([`诉求集中点位为${t.points[0].point}，涉及`, m('count', { category, point: t.points[0].point }), '件，建议优先核查该点位。']);
    paragraphs.push([`建议相关单位：${TOPIC_COPY[category].advice}${modes.includes('加强建议') ? '建立重点点位清单，明确牵头单位和办理时限，通过回访核查处置成效。' : number % 2 === 0 ? '同步完善诉求反馈和回访记录。' : ''}`]);
    table = { headers: ['街镇', '高发点位（模拟）', '工单量（件）'], rows: t.points.map(p => [[p.street], [p.point], [m('count', { category, point: p.point })]]) };
  } else if (id === 'tracking') {
    paragraphs.push([a.comparisonComplete ? '按上期推荐规则识别热点，跟踪其在本期的数量及点位变化。' : '上期数据覆盖不完整，以下仅展示已覆盖明细，不进行环比判断。']);
    table = { headers: ['上期热点', '本期（件）', '上期（件）', '环比', '本期集中点位'], rows: a.previousTopics.slice(0, 2).map(t => [[t.category], [m('count', { category: t.category })], [m('count', { category: t.category }, 'previous')], [m('change', { category: t.category })], [a.topics.find(c => c.category === t.category)?.points[0]?.point || '无']]) };
    if (!table.rows.length) paragraphs.push(['比较期内无工单，暂无可跟踪的上期热点。']);
    if (number % 2 === 0) paragraphs.push(['对持续集中的点位建议做好处置反馈与回访记录。']);
    if (modes.includes('加强建议')) paragraphs.push(['建议对上期热点建立跟踪台账，核查反复出现的点位，明确处置责任与回访要求。']);
    if (modes.includes('突出环比')) paragraphs.unshift(['优先对照表内本期与上期数量，结合基数判断变化幅度；缺少完整比较期时不作增长判断。']);
  } else if (id === 'praise') {
    paragraphs.push(['本期共受理表扬感谢类工单', m('count', { business: '表扬感谢' }), '件。']);
    const allCases = a.current.filter(o => o.business === '表扬感谢');
    const offset = allCases.length ? (number - 1) % allCases.length : 0;
    const cases = [...allCases.slice(offset), ...allCases.slice(0, offset)].slice(0, brief ? 1 : 2);
    cases.forEach(o => paragraphs.push([`${o.description}（模拟任务号：${o.id}）`]));
    if (!cases.length) paragraphs.push(['本期暂无表扬感谢类工单。']);
    if (modes.includes('强调点位') && cases[0]) paragraphs.push([`上述首个案例关联点位：${cases[0].point}，可通过表扬感谢指标查询该工单。`]);
    if (modes.includes('突出环比')) paragraphs.push(a.comparisonComplete ? ['上期表扬感谢工单', m('count', { business: '表扬感谢' }, 'previous'), '件，本期环比', m('change', { business: '表扬感谢' }), '。'] : ['比较期不完整，表扬感谢工单暂不作环比判断。']);
    if (modes.includes('加强建议')) paragraphs.push(['建议及时反馈表扬事项，总结受理与处置经验，持续改进服务。']);
  } else paragraphs.push([number % 2 ? '本期暂未录入经核实的领导批示。正式报送前请补充批示原文、批示人及来源；无批示时可移除此板块。' : '领导批示尚待核实补充，不能由本地规则自动编写。请提供原文、批示人及来源，或取消该板块。']);
  return { number, paragraphs, table, modes, verified: false };
}
export function generateReport(a: Analysis, selected: Category[], leadership: boolean): Report {
  const names = ['一', '二', '三', '四', '五', '六', '七', '八'];
  const definitions: { id: string; title: string; category?: Category }[] = [{ id: 'overview', title: '工单情况' }, ...selected.map(category => ({ id: `topic-${category}`, title: `${category}相关诉求分析`, category })), { id: 'tracking', title: '上期热点问题跟踪' }, { id: 'praise', title: '表扬感谢' }];
  if (leadership) definitions.unshift({ id: 'leadership', title: '领导批示' });
  return { analysis: a, title: a.scope.channel === '全渠道' ? '闵行区城运工单热点问题周报' : '闵行区12345热线诉求热点问题周报', createdAt: new Date().toISOString(), sections: definitions.map((d, i) => ({ ...d, title: `${names[i]}、${d.title}`, active: 0, versions: [buildVersion(a, d.id, d.category, 1)] })) };
}
export function parseModes(input: string): RewriteMode[] {
  return REWRITE_MODES.filter((mode, i) => [/(精简|简洁|简短|压缩)/, /(环比|增幅|增长|变化)/, /(点位|地点|集中)/, /(建议|措施|整改|责任)/][i].test(input));
}
