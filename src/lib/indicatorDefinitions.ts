import { CATEGORIES, type Category, type Metric } from './weeklyReport';

export type IndicatorInput = {
  code: string; name: string; group: string; kind: Metric['kind']; period: Metric['period'];
  channel: 'report' | '12345热线' | '网格巡查' | '其他渠道'; category?: Category;
  business?: '投诉求助' | '咨询' | '表扬感谢'; point?: string; description: string; enabled: boolean;
};
export type IndicatorDefinition = IndicatorInput & { id: string; builtin: boolean; version: number; updatedAt: string };
export const INDICATOR_KINDS = { count: '工单量', daily: '日均量', share: '占比', change: '环比' } as const;
export const indicatorUnit = (kind: Metric['kind']) => kind === 'count' ? '件' : kind === 'daily' ? '件/天' : '%';
export function definitionFormula(d: Pick<IndicatorInput, 'kind' | 'period'>) {
  const period = d.period === 'previous' ? '上期' : '本期';
  return d.kind === 'count' ? `${period}匹配工单按唯一工单编号去重计数` : d.kind === 'daily' ? `${period}匹配工单量 ÷ 统计天数` : d.kind === 'share' ? `${period}匹配工单量 ÷ 同期统计范围内工单总量 × 100%` : '(本期匹配工单量 − 上期匹配工单量) ÷ 上期匹配工单量 × 100%';
}
export function definitionConditions(d: IndicatorInput) {
  return [d.channel === 'report' ? '渠道随报表统计范围' : `渠道：${d.channel}`, d.category ? `诉求分类：${d.category}` : '', d.business ? `业务类型：${d.business}` : '', d.point ? `标准点位：${d.point}（精确匹配）` : ''].filter(Boolean).join('；');
}
export function defaultIndicatorDefinitions(): IndicatorDefinition[] {
  const seeds: Partial<IndicatorInput>[] = [
    { name: '受理工单总量', group: '通用指标', kind: 'count', description: '统计所选时间和渠道范围内的受理工单，按唯一工单编号去重，每张工单计一次。' },
    { name: '日均受理工单量', group: '通用指标', kind: 'daily', description: '以统计范围内去重后的受理工单量除以完整自然日天数，起止日期均计入。' },
    { name: '教育相关工单量', group: '教育', category: '教育', kind: 'count', description: '筛选诉求分类为教育的受理工单，按唯一工单编号去重统计。' },
    { name: '市容市貌工单量', group: '市容市貌', category: '市容市貌', kind: 'count', description: '筛选诉求分类为市容市貌的受理工单，按唯一工单编号去重统计。' },
    { name: '行道树诉求占比', group: '行道树', category: '行道树', kind: 'share', description: '分子为行道树类去重工单量，分母为同一时间与渠道范围内的全部去重工单量。' },
    { name: '公共区域吸烟诉求环比', group: '公共区域吸烟', category: '公共区域吸烟', kind: 'change', description: '比较公共区域吸烟类工单在本期和前一连续等长周期的变化；上期为零或比较期不完整时不计算。' },
    { name: '表扬感谢工单量', group: '表扬感谢', business: '表扬感谢', kind: 'count', description: '筛选业务类型为表扬感谢的工单，按唯一工单编号去重统计。' },
    { name: '上期受理工单量', group: '通用指标', period: 'previous', kind: 'count', description: '统计本期之前连续等长周期内的受理工单量，用于本期与上期的对照。' },
  ];
  const defaults = seeds.map((seed, i) => ({ code: `MH-${String(i + 1).padStart(3, '0')}`, name: '', group: '通用指标', kind: 'count', period: 'current', channel: 'report', description: '', enabled: true, ...seed, id: `builtin-${i + 1}`, builtin: true, version: 1, updatedAt: '' } as IndicatorDefinition));
  return ensureReportIndicators(defaults);
}
export function ensureReportIndicators(items: IndicatorDefinition[]): IndicatorDefinition[] {
  const additions: IndicatorDefinition[] = [
    { id: 'system-share', code: 'SYS-SHARE', name: '通用诉求占比', group: '通用指标', kind: 'share', period: 'current', channel: 'report', description: '匹配主题的去重工单量除以同期全渠道去重工单总量。主题条件由报表模板传入。', enabled: true, builtin: true, version: 1, updatedAt: '' },
    { id: 'system-change', code: 'SYS-CHANGE', name: '通用诉求环比', group: '通用指标', kind: 'change', period: 'current', channel: 'report', description: '本期与前一等长周期匹配工单量比较；上期为零或比较期不完整时不计算。主题条件由模板传入。', enabled: true, builtin: true, version: 1, updatedAt: '' },
  ];
  return [...items, ...additions.filter(d => !items.some(item => item.id === d.id || item.code === d.code))];
}
export function nextIndicatorCode(definitions: IndicatorDefinition[]) {
  let n = 1;
  const used = new Set(definitions.map(d => d.code.toUpperCase()));
  while (used.has(`MH-${String(n).padStart(3, '0')}`)) n++;
  return `MH-${String(n).padStart(3, '0')}`;
}
export function saveIndicatorDefinition(definitions: IndicatorDefinition[], input: IndicatorInput, editingId?: string, now = new Date().toISOString()): IndicatorDefinition[] {
  const item: IndicatorInput = { ...input, code: input.code.trim().toUpperCase(), name: input.name.trim(), group: input.group.trim(), description: input.description.trim(), point: input.point?.trim() || undefined };
  if (!item.point) delete item.point;
  if (!item.category) delete item.category;
  if (!item.business) delete item.business;
  if (!/^[A-Z][A-Z0-9_-]{1,31}$/.test(item.code)) throw new Error('指标编号须为2–32位大写字母、数字、下划线或短横线，且以字母开头');
  if (!item.name || item.name.length > 40) throw new Error('请输入不超过40字的指标名称');
  if (!item.group || !item.description || item.description.length > 500) throw new Error('请选择业务分组，并填写不超过500字的统计口径说明');
  if (!['count', 'daily', 'share', 'change'].includes(item.kind) || !['current', 'previous'].includes(item.period)) throw new Error('请选择有效的计算方式和统计周期');
  if (!['report', '12345热线', '网格巡查', '其他渠道'].includes(item.channel)) throw new Error('请选择有效的渠道规则');
  if (typeof item.enabled !== 'boolean') throw new Error('请选择有效的启用状态');
  if (item.category && !(CATEGORIES as readonly string[]).includes(item.category)) throw new Error('诉求分类无效');
  if (item.business && !['投诉求助', '咨询', '表扬感谢'].includes(item.business)) throw new Error('业务类型无效');
  if (item.point && item.point.length > 100) throw new Error('标准点位不得超过100字');
  if (item.kind === 'change' && item.period !== 'current') throw new Error('环比指标应选择本期，并对比前一等长周期');
  const existing = editingId ? definitions.find(d => d.id === editingId) : undefined;
  if (editingId && !existing) throw new Error('未找到要编辑的指标');
  if (existing && item.code !== existing.code) throw new Error('已保存的指标编号不能修改');
  if (definitions.some(d => d.id !== editingId && d.code === item.code)) throw new Error('该指标编号已存在，请使用其他编号');
  if (definitions.some(d => d.id !== editingId && d.name.toLowerCase() === item.name.toLowerCase())) throw new Error('该指标名称已存在，请使用其他名称');
  const saved: IndicatorDefinition = { ...item, id: existing?.id || `custom-${item.code}`, builtin: existing?.builtin || false, version: (existing?.version || 0) + 1, updatedAt: now };
  return existing ? definitions.map(d => d.id === existing.id ? saved : d) : [...definitions, saved];
}
export function restoreIndicatorDefinitions(raw: string | null): IndicatorDefinition[] {
  if (!raw) return defaultIndicatorDefinitions();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || !parsed.length) return defaultIndicatorDefinitions();
    let checked: IndicatorDefinition[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object' || typeof item.code !== 'string' || typeof item.name !== 'string' || typeof item.group !== 'string' || typeof item.description !== 'string' || typeof item.enabled !== 'boolean' || typeof item.id !== 'string' || typeof item.builtin !== 'boolean' || !Number.isInteger(item.version) || item.version < 1 || typeof item.updatedAt !== 'string') return defaultIndicatorDefinitions();
      checked = saveIndicatorDefinition(checked, item);
    }
    if (new Set(parsed.map(d => d.id)).size !== parsed.length) return defaultIndicatorDefinitions();
    return ensureReportIndicators(parsed as IndicatorDefinition[]);
  } catch { return defaultIndicatorDefinitions(); }
}
