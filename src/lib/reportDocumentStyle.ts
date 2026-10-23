import type { Report } from './weeklyReport';

// Measurements distilled from the two supplied weekly reports (A4, in twips).
export const REPORT_PAGE = { width: 11906, height: 16838, top: 2098, right: 1474, bottom: 1985, left: 1588, header: 851, footer: 992 };
export const REPORT_COMPILER = '闵行区城市运行管理中心编';
export function reportDocumentStyle(report: Report) {
  const type = ({ daily: '日报', weekly: '周报', topic: '专题报' })[report.templateSnapshot?.type || 'weekly'];
  const [year, month, day] = report.analysis.scope.end.split('-').map(Number);
  const shortDate = (date: string) => date.slice(5).split('-').map(Number).join('.');
  const { start, end } = report.analysis.scope;
  return {
    masthead: report.analysis.scope.channel === '全渠道' ? '闵行区城运工单分析' : '闵行区12345热线分析',
    issue: `${year}年${type}（${report.cadence === 'daily' ? '每日制作·' : ''}演示稿）`,
    cutoff: `统计截止：${year}年${month}月${day}日`,
    period: start === end ? `（${shortDate(end)}）` : `（${shortDate(start)}—${start.slice(0, 4) === end.slice(0, 4) ? shortDate(end) : end}）`,
    scopeNote: `统计范围：${report.analysis.scope.channel}；对比期：${report.analysis.previousScope.start}至${report.analysis.previousScope.end}${report.analysis.comparisonComplete ? '' : '（覆盖不完整）'}。`,
    disclaimer: `${report.analysis.dataKind === 'imported' ? '试用数据，统计结果待业务核验。' : '模拟数据，仅用于产品演示。'}${report.dataRevision ? '报告已按当前会话上传明细重新计算。' : ''}`,
  };
}
export function chineseSectionNumber(number: number): string {
  const digits = '零一二三四五六七八九';
  if (number < 10) return digits[number];
  if (number < 100) return `${number < 20 ? '' : digits[Math.floor(number / 10)]}十${number % 10 ? digits[number % 10] : ''}`;
  return String(number);
}
