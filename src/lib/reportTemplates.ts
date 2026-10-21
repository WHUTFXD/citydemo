import { chineseSectionNumber } from './reportDocumentStyle';
import { matches, registerMetric, TOPIC_COPY, type Analysis, type Metric, type MetricFilter, type Report, type ReportSection, type RewriteMode, type SectionVersion, type Token } from './weeklyReport';
import type { IndicatorDefinition } from './indicatorDefinitions';

export const REPORT_TYPES = { daily: '日报', weekly: '周报', topic: '专题报' } as const;
export type ReportType = keyof typeof REPORT_TYPES;
export type ThemeGroup = '热点事件' | '群众热议';
export type ReportTheme = { id: string; name: string; group: ThemeGroup; filter: MetricFilter; custom?: boolean; note?: string };
export type ThemeResult = ReportTheme & { count: number; previous: number; share: number; growth: number | null; concentration: number; points: { point: string; count: number }[]; score: number };
export function selectThemeMode(ids: string[], themes: ReportTheme[], group: ThemeGroup, mode: 'recommended' | 'custom'): string[] {
  const other = ids.filter(id => themes.find(t => t.id === id)?.group !== group);
  const defaults = themes.filter(t => t.group === group && (mode === 'custom' ? t.custom : !t.custom)).slice(0, 1).map(t => t.id);
  return [...other, ...defaults].slice(0, 6);
}
export const BLOCK_LABELS = { overview: '工单概况', topics: '已选主题（自动展开）', tracking: '上期热点跟踪', praise: '表扬感谢', custom: '自定义板块' } as const;
export type TemplateBlock = { id: string; title: string; kind: keyof typeof BLOCK_LABELS; body: string; bindings: Record<string, string> };
export type ReportTemplate = { id: string; name: string; type: ReportType; description: string; version: number; updatedAt: string; blocks: TemplateBlock[] };
export type SectionRecipe = { block: TemplateBlock; theme?: ReportTheme; definitions: IndicatorDefinition[] };
export const SLOT_LABELS: Record<string, string> = { count: '本期工单量', daily: '本期日均量', share: '本期占比', previous: '上期工单量', change: '本期环比' };
export const BLOCK_SLOTS: Record<TemplateBlock['kind'], string[]> = { overview: ['count', 'daily', 'previous', 'change'], topics: ['count', 'daily', 'share', 'previous', 'change'], tracking: ['count', 'previous', 'change'], praise: ['count'], custom: [] };
const baseBindings = { count: 'builtin-1', daily: 'builtin-2', share: 'system-share', previous: 'builtin-8', change: 'system-change' };
export function newBlock(kind: TemplateBlock['kind'], id: string): TemplateBlock {
  return { id, kind, title: BLOCK_LABELS[kind], body: kind === 'custom' ? '本期受理工单共{{MH-001}}件。' : '', bindings: Object.fromEntries(BLOCK_SLOTS[kind].map(slot => [slot, kind === 'praise' ? 'builtin-7' : baseBindings[slot as keyof typeof baseBindings]])) };
}
export function defaultReportTemplates(): ReportTemplate[] {
  return (Object.keys(REPORT_TYPES) as ReportType[]).flatMap(type => [false, true].map(concise => ({
    id: `${type}-${concise ? 'concise' : 'standard'}`, type, name: `城运${REPORT_TYPES[type]}·${concise ? '精简版' : '标准版'}`, description: concise ? '概况与重点主题，适合快速阅览。' : '概况、主题分析与跟踪，适合正式报送。', version: 1, updatedAt: '',
    blocks: (concise ? ['overview', 'topics'] : type === 'daily' ? ['overview', 'topics', 'praise'] : ['overview', 'topics', 'tracking', 'praise']).map((kind, i) => newBlock(kind as TemplateBlock['kind'], `${type}-${concise}-${i}`)),
  })));
}
export function usedDefinitions(block: TemplateBlock, definitions: IndicatorDefinition[]): IndicatorDefinition[] {
  if (block.kind !== 'custom') return Object.values(block.bindings).map(id => {
    const d = definitions.find(d => d.id === id); if (!d) throw new Error(`“${block.title}”绑定的指标已不存在`); return d;
  });
  const codes = [...block.body.matchAll(/\{\{([^{}]+)\}\}/g)].map(m => m[1].trim());
  return [...new Set(codes)].map(code => { const d = definitions.find(d => d.code === code); if (!d) throw new Error(`“${block.title}”引用的指标 ${code} 不存在`); return d; });
}
export function validateTemplate(template: ReportTemplate, definitions: IndicatorDefinition[]) {
  if (!template.name.trim() || template.name.length > 60 || !Object.hasOwn(REPORT_TYPES, template.type)) throw new Error('请输入60字以内的模板名称，并选择报表类型');
  if (!template.id || typeof template.description !== 'string' || template.description.length > 200) throw new Error('请填写有效模板及200字以内的用途说明');
  if (!template.blocks.length || template.blocks.length > 12) throw new Error('模板需包含1—12个板块');
  if (new Set(template.blocks.map(b => b.id)).size !== template.blocks.length) throw new Error('模板板块编号重复');
  for (const block of template.blocks) {
    if (!Object.hasOwn(BLOCK_LABELS, block.kind) || !block.title.trim() || block.title.length > 60 || block.body.length > 3000) throw new Error('请填写有效的板块名称及正文（不超过3000字）');
    for (const slot of BLOCK_SLOTS[block.kind]) {
      const d = definitions.find(d => d.id === block.bindings[slot]);
      const expected = slot === 'previous' ? 'count' : slot;
      if (!d || !d.enabled || d.kind !== expected || d.period !== (slot === 'previous' ? 'previous' : 'current')) throw new Error(`“${block.title}”的“${SLOT_LABELS[slot]}”需绑定已启用的同类型、同周期指标`);
      if (['topics', 'tracking'].includes(block.kind) && (d.category || d.point)) throw new Error('主题及跟踪板块需绑定不限定分类或点位的指标，由所选主题传入条件');
    }
    if (block.kind !== 'custom') {
      const list = BLOCK_SLOTS[block.kind].map(slot => definitions.find(d => d.id === block.bindings[slot])!);
      const rule = (d: IndicatorDefinition) => JSON.stringify([d.category || '', d.point || '', d.business || '', d.channel]);
      if (new Set(list.map(rule)).size > 1) throw new Error(`“${block.title}”的指标筛选口径须一致，请选择相同分类、点位、业务类型和渠道的指标`);
      if (block.kind === 'praise' && list[0].business !== '表扬感谢') throw new Error('表扬感谢板块需绑定业务类型为表扬感谢的工单量指标');
      if (block.body.includes('{{')) throw new Error('系统板块的补充说明只支持纯文字；需要插入指标时请使用自定义板块');
    }
    if (block.kind === 'custom' && !block.body.trim()) throw new Error('请填写自定义板块正文，可插入指标占位符');
    const residue = block.body.replace(/\{\{[^{}]+\}\}/g, '');
    if (residue.includes('{{') || residue.includes('}}')) throw new Error('指标占位符格式应为 {{指标编号}}');
    if (usedDefinitions(block, definitions).some(d => !d.enabled)) throw new Error(`“${block.title}”引用了已停用指标，请重新绑定`);
  }
}
export function saveReportTemplate(items: ReportTemplate[], input: ReportTemplate, definitions: IndicatorDefinition[]): ReportTemplate[] {
  const existing = items.find(t => t.id === input.id);
  const template = { ...input, name: input.name.trim(), version: (existing?.version || 0) + 1, updatedAt: new Date().toISOString() };
  validateTemplate(template, definitions);
  if (items.some(t => t.id !== template.id && t.type === template.type && t.name === template.name)) throw new Error('此报表类型下已存在同名模板');
  return existing ? items.map(t => t.id === template.id ? template : t) : [...items, template];
}
export function restoreReportTemplates(raw: string | null): ReportTemplate[] {
  try {
    if (!raw) return defaultReportTemplates();
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some(t => !t || typeof t.id !== 'string' || typeof t.name !== 'string' || !Object.hasOwn(REPORT_TYPES, t.type) || !Array.isArray(t.blocks) || !Number.isInteger(t.version) || typeof t.updatedAt !== 'string' || typeof t.description !== 'string' || t.blocks.some((b: TemplateBlock) => !b || typeof b.id !== 'string' || !Object.hasOwn(BLOCK_LABELS, b.kind) || typeof b.title !== 'string' || typeof b.body !== 'string' || !b.bindings || typeof b.bindings !== 'object'))) return defaultReportTemplates();
    return parsed.map((template: ReportTemplate) => ({ ...template, name: template.type === 'topic' ? template.name.replaceAll('专题包', REPORT_TYPES.topic) : template.name }));
  } catch { return defaultReportTemplates(); }
}
export function recommendThemes(a: Analysis, custom: ReportTheme[] = []): ThemeResult[] {
  const built: ReportTheme[] = a.topics.flatMap(t => [
    { id: `discussion-${t.category}`, name: `${t.category}共同诉求`, group: '群众热议' as const, filter: { category: t.category } },
    { id: `event-${t.category}`, name: `${t.category}相关诉求`, group: '热点事件' as const, filter: { category: t.category } },
  ]);
  const ranked = [...new Map([...built, ...custom].map(t => [t.id, t])).values()].map(t => {
    const now = a.current.filter(o => matches(o, t.filter)), before = a.previous.filter(o => matches(o, t.filter));
    const points = [...new Set(now.map(o => o.point))].map(point => ({ point, count: now.filter(o => o.point === point).length })).sort((x, y) => y.count - x.count).slice(0, 3);
    return { ...t, count: now.length, previous: before.length, share: a.current.length ? now.length / a.current.length : 0, growth: a.comparisonComplete && before.length ? (now.length - before.length) / before.length : null, points, concentration: now.length ? points.reduce((s, p) => s + p.count, 0) / now.length : 0, score: 0 };
  });
  for (const group of ['热点事件', '群众热议']) {
    const set = ranked.filter(t => t.group === group), maxCount = Math.max(1, ...set.map(t => t.count)), maxGrowth = Math.max(.0001, ...set.map(t => t.previous >= 10 ? Math.max(0, t.growth || 0) : 0)), maxConcentration = Math.max(.0001, ...set.map(t => t.concentration));
    set.forEach(t => { t.score = 100 * (.5 * t.count / maxCount + .3 * (t.previous >= 10 ? Math.max(0, t.growth || 0) : 0) / maxGrowth + .2 * t.concentration / maxConcentration); });
  }
  return ranked.sort((x, y) => y.score - x.score || y.count - x.count);
}
export function validateTheme(theme: ReportTheme, others: ReportTheme[]) {
  if (!theme.name.trim() || theme.name.length > 60) throw new Error('请填写60字以内的主题名称');
  if (!['热点事件', '群众热议'].includes(theme.group)) throw new Error('请选择主题分类');
  if (!theme.filter.semantic && !theme.filter.category && !theme.filter.keyword?.trim() && !theme.filter.point?.trim()) throw new Error('请至少填写诉求分类、关键词或点位中的一项，作为取数依据');
  if (others.some(t => t.name === theme.name.trim())) throw new Error('主题名称已存在');
}
export function registerDefinitionMetric(a: Analysis, definition: IndicatorDefinition, context: MetricFilter = {}): Token {
  if (!definition.enabled) throw new Error(`指标“${definition.name}”已停用`);
  const filter: MetricFilter = { ...context };
  if (definition.category) filter.category = definition.category;
  if (definition.point) filter.point = definition.point;
  if (definition.business) filter.business = definition.business;
  if (definition.channel !== 'report') filter.channel = definition.channel;
  const token = registerMetric(a, definition.kind, filter, definition.period) as { metricId: string };
  const base = a.metrics[token.metricId], id = `${token.metricId}/definition/${definition.id}/v${definition.version}`;
  a.metrics[id] = { ...base, id, label: `${definition.name}${context.category ? ` · ${context.category}` : ''}${context.point ? ` · ${context.point}` : ''}${context.keyword ? ` · ${context.keyword}` : ''}${context.semantic ? ` · ${context.semantic.topic}` : ''}`, definitionId: definition.id, definitionCode: definition.code, definitionVersion: definition.version, definitionDescription: definition.description };
  return { metricId: id };
}
export function buildRecipeVersion(a: Analysis, recipe: SectionRecipe, number: number, modes: RewriteMode[] = []): SectionVersion {
  const { block, theme, definitions } = recipe, paragraphs: Token[][] = [];
  const m = (slot: string, filter: MetricFilter = theme?.filter || {}) => {
    const d = definitions.find(d => d.id === block.bindings[slot]); if (!d) throw new Error(`未找到绑定指标：${slot}`);
    return registerDefinitionMetric(a, d, filter);
  };
  let table: SectionVersion['table'];
  const brief = modes.includes('精简表达');
  if (block.kind === 'custom') {
    for (const paragraph of block.body.split('\n').filter(Boolean)) {
      const tokens: Token[] = []; let offset = 0;
      for (const match of paragraph.matchAll(/\{\{([^{}]+)\}\}/g)) {
        tokens.push(paragraph.slice(offset, match.index));
        const d = definitions.find(d => d.code === match[1].trim()); if (!d) throw new Error(`指标 ${match[1]} 不存在`);
        tokens.push(registerDefinitionMetric(a, d)); offset = match.index! + match[0].length;
      }
      tokens.push(paragraph.slice(offset)); paragraphs.push(tokens);
    }
    if (brief && paragraphs.length > 1) paragraphs.splice(1);
  } else if (block.kind === 'overview') {
    paragraphs.push([`本期（${a.scope.start}至${a.scope.end}），${definitions.find(d => d.id === block.bindings.count)!.name}为`, m('count', {}), '件，日均', m('daily', {}), '件。']);
    if (!brief || modes.includes('突出环比')) paragraphs.push(['上一等长周期工单', m('previous', {}), '件，本期环比', m('change', {}), a.comparisonComplete ? '。' : '（比较期不完整）。']);
  } else if (block.kind === 'topics' && theme) {
    const rows = a.current.filter(o => matches(o, theme.filter));
    paragraphs.push([`围绕“${theme.name}”，本期匹配工单`, m('count'), '件，占本期总量', m('share'), '，日均', m('daily'), '件。']);
    if (!brief || modes.includes('突出环比')) paragraphs.push(['上期同口径工单', m('previous'), '件，本期环比', m('change'), '；上期为零或比较期不完整时不计算环比。']);
    if (!rows.length) paragraphs.push(['本期暂无匹配工单，请核对主题筛选条件。']);
    else if (!brief) paragraphs.push([theme.group === '热点事件' ? '本主题依据相关诉求归集工单，反映本期关注的问题。' : '本主题依据工单中的共同诉求归纳，不代表网络舆情热度。']);
    if (theme.note && !brief) paragraphs.push([`主题说明：${theme.note}`]);
    const points = [...new Set(rows.map(o => o.point))].map(point => ({ point, count: rows.filter(o => o.point === point).length })).sort((x, y) => y.count - x.count).slice(0, 3);
    if (points.length) table = { headers: ['集中点位', '匹配工单量（件）'], rows: points.map(p => [[p.point], [m('count', { ...theme.filter, point: p.point })]]) };
    if (modes.includes('强调点位') && points[0]) paragraphs.push([`优先核查${points[0].point}，匹配`, m('count', { ...theme.filter, point: points[0].point }), '件。']);
    paragraphs.push([theme.filter.category ? `建议：${TOPIC_COPY[theme.filter.category].advice}` : '建议：核对主题所涉诉求与集中点位，分类交办并回访处理结果。']);
  } else if (block.kind === 'tracking') {
    paragraphs.push(['根据上一周期工单规则识别热点，以相同口径跟踪本期变化。']);
    table = { headers: ['上期热点类型', '本期（件）', '上期（件）', '环比'], rows: a.previousTopics.slice(0, brief ? 1 : 2).map(t => [[t.category], [m('count', { category: t.category })], [m('previous', { category: t.category })], [m('change', { category: t.category })]]) };
    if (!table.rows.length) paragraphs.push(['上一周期暂无可跟踪热点。']);
  } else if (block.kind === 'praise') {
    paragraphs.push(['本期匹配表扬感谢类工单', m('count', {}), '件。']);
    const definition = definitions.find(d => d.id === block.bindings.count)!;
    a.current.filter(o => matches(o, { business: definition.business, category: definition.category, point: definition.point, channel: definition.channel === 'report' ? undefined : definition.channel })).slice(0, brief ? 1 : 2).forEach(o => paragraphs.push([`${o.description}（模拟工单：${o.id}）`]));
  }
  if (block.kind !== 'custom' && block.body.trim()) paragraphs.push([block.body]);
  if (modes.includes('加强建议')) paragraphs.push([theme?.filter.category ? `进一步落实：${TOPIC_COPY[theme.filter.category].advice}明确责任单位、办理时限及回访安排。` : '建议核实统计范围与重点诉求，建立交办、反馈、回访记录。']);
  if (number % 2 === 0 && !brief) paragraphs.push(['请结合明细核对统计结果，并跟踪后续处置反馈。']);
  return { number, paragraphs, table, modes, verified: false };
}
export function configurationKey(template: ReportTemplate, definitions: IndicatorDefinition[], themes: ReportTheme[]) {
  return JSON.stringify([template, template.blocks.flatMap(b => usedDefinitions(b, definitions)), themes]);
}
export function generateTemplateReport(a: Analysis, template: ReportTemplate, definitions: IndicatorDefinition[], themes: ReportTheme[], dataRevision = 0): Report {
  validateTemplate(template, definitions);
  for (const group of ['热点事件', '群众热议']) {
    const sameGroup = themes.filter(t => t.group === group);
    if (sameGroup.some(t => t.custom) && (sameGroup.some(t => !t.custom) || sameGroup.length > 1)) throw new Error('每组自定义主题与推荐主题互斥，且只支持一个自定义主题');
  }
  if (template.type === 'daily' && a.days !== 1) throw new Error('日报须选择一个完整自然日');
  const snapshot = structuredClone(definitions), sections: ReportSection[] = [];
  for (const block of template.blocks) {
    const entries = block.kind === 'topics' ? themes : [undefined];
    entries.forEach(theme => {
      const recipe: SectionRecipe = { block: structuredClone(block), definitions: snapshot, theme: theme ? structuredClone(theme) : undefined };
      sections.push({ id: `${block.id}/${theme?.id || 'base'}`, title: theme ? `${theme.group}：${theme.name}` : block.title, active: 0, versions: [buildRecipeVersion(a, recipe, 1)], recipe });
    });
  }
  if (!sections.length) throw new Error('请为主题模板至少选择一个主题');
  return { analysis: a, sections: sections.map((s, i) => ({ ...s, title: `${chineseSectionNumber(i + 1)}、${s.title}` })), title: `闵行区城运诉求热点问题${REPORT_TYPES[template.type]}`, createdAt: new Date().toISOString(), templateSnapshot: structuredClone(template), definitionSnapshot: snapshot, themes: structuredClone(themes), configurationKey: configurationKey(template, definitions, themes), dataRevision };
}
