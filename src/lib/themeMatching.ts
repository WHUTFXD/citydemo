// Serializable rules are shared by report snapshots, evidence drawers and Excel formulas.
export type ThemeRule = { topic: string; version: 1; groups: string[][]; excluded: string[]; expanded: boolean };
const concepts = [
  ['吸烟', '抽烟', '二手烟', '烟味', '烟草', '禁烟', '控烟'],
  ['公共场所', '公共场合', '公共区域', '公共空间', '楼道', '电梯', '大厅', '入户厅', '服务场所', '商场', '车站', '公共厕所', '候车室', '医院', '餐厅'],
  ['噪声', '噪音', '扰民', '喇叭', '高音', '吵闹'],
  ['树木', '行道树', '树枝', '枝叶', '绿化树'],
  ['遮挡', '挡光', '采光', '遮光'],
  ['充电', '充电桩', '充电设施', '飞线'],
  ['电动车', '电瓶车', '非机动车'],
  ['积水', '内涝', '排水不畅', '雨水倒灌'],
  ['垃圾', '废弃物', '堆物', '乱倒'],
];
export function compileThemeRule(input: string): ThemeRule {
  const topic = input.trim();
  if (!topic || topic.length > 60) throw new Error('请输入60字以内的具体主题');
  const found = concepts.filter(words => words.some(word => topic.includes(word)));
  let remainder = topic;
  found.flat().sort((a, b) => b.length - a.length).forEach(word => { remainder = remainder.replaceAll(word, ''); });
  remainder = remainder.replace(/相关|有关|问题|现象|治理|投诉|诉求|的|[\s，。、]/g, '');
  // Unknown phrases use literal matching; never pretend arbitrary semantic comprehension.
  return { topic, version: 1, groups: found.length ? [...found.map(words => [...words]), ...(remainder ? [[remainder]] : [])] : [[topic]], excluded: found.some(words => words.includes('吸烟')) ? ['未发现吸烟', '没有吸烟', '无人吸烟', '不涉及吸烟'] : [], expanded: found.length > 0 };
}
export function themeMatch(rule: ThemeRule, order: { description: string; point: string }) {
  const values = [order.description.toLowerCase(), order.point.toLowerCase()];
  return rule.groups.every(words => words.some(word => values.some(value => value.includes(word.toLowerCase())))) && !rule.excluded.some(word => values.some(value => value.includes(word.toLowerCase())));
}
export function themeMatchReason(rule: ThemeRule, order: { description: string; point: string }) {
  return themeMatch(rule, order) ? rule.groups.map(words => words.filter(word => [order.description, order.point].some(value => value.toLowerCase().includes(word.toLowerCase()))).join('、')).join(' + ') : '未命中主题规则';
}
export function themeRuleDescription(rule: ThemeRule) {
  return `${rule.expanded ? '同义表达展开' : '未收录同义表达，按原文短语匹配'}：${rule.groups.map(words => `（${words.join(' / ')}）`).join(' 且 ')}${rule.excluded.length ? `；排除：${rule.excluded.join(' / ')}` : ''}；仅检索摘要和点位，不依据原分类；本地规则模拟`;
}
