import { textOf, type Analysis, type Metric, type ReportSection, type SectionVersion } from './weeklyReport';

export function metricFingerprint(a: Analysis, m: Metric) { return JSON.stringify(['mock-v1', a.key, a.dataRevision || 0, a.comparisonComplete, m.id, m.value, m.numerator, m.denominator]); }
export function versionMetricIds(version: SectionVersion): string[] {
  const tokens = [...version.paragraphs.flat(), ...(version.table?.rows.flat(2) || [])];
  return [...new Set(tokens.flatMap(t => typeof t === 'string' ? [] : [t.metricId]))];
}
export function sectionVerified(section: ReportSection) {
  return section.versions[section.active].verified;
}
export function versionText(v: SectionVersion, a: Analysis) {
  return [...v.paragraphs.map(p => textOf(p, a)), ...(v.table ? [v.table.headers.join(' ｜ '), ...v.table.rows.map(row => row.map(cell => textOf(cell, a)).join(' ｜ '))] : [])].join('\n\n');
}
export type DiffPart = { kind: 'same' | 'added' | 'removed'; text: string };
// Character LCS keeps changed wording visible without treating unchanged numbers as a replacement.
export function diffText(before: string, after: string): DiffPart[] {
  const left = Array.from(before), right = Array.from(after), width = right.length + 1;
  if (left.length * right.length > 4000000) return before === after ? [{ kind: 'same', text: before }] : [{ kind: 'removed', text: before }, { kind: 'added', text: after }];
  const matrix = new Uint16Array((left.length + 1) * width);
  for (let i = left.length - 1; i >= 0; i--) for (let j = right.length - 1; j >= 0; j--) matrix[i * width + j] = left[i] === right[j] ? matrix[(i + 1) * width + j + 1] + 1 : Math.max(matrix[(i + 1) * width + j], matrix[i * width + j + 1]);
  const parts: DiffPart[] = [];
  const push = (kind: DiffPart['kind'], text: string) => { const last = parts.at(-1); if (last?.kind === kind) last.text += text; else parts.push({ kind, text }); };
  let i = 0, j = 0;
  while (i < left.length || j < right.length) {
    if (i < left.length && j < right.length && left[i] === right[j]) { push('same', left[i++]); j++; }
    else if (j < right.length && (i === left.length || matrix[i * width + j + 1] > matrix[(i + 1) * width + j])) push('added', right[j++]);
    else push('removed', left[i++]);
  }
  return parts;
}
