import { assessOrder } from './briefingAnalysis';
import { inferScene } from './workOrderTaxonomy';
import { REPORT_COMPILER, REPORT_PAGE, reportDocumentStyle } from './reportDocumentStyle';
import { themeMatchReason, themeRuleDescription } from './themeMatching';
import { matches, metricText, textOf, type Analysis, type Metric, type Order, type Report } from './weeklyReport';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function createWord(report: Report): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel, BorderStyle, LineRuleType, TabStopType, Footer, PageNumber } = await import('docx');
  const a = report.analysis, presentation = reportDocumentStyle(report);
  const contentWidth = REPORT_PAGE.width - REPORT_PAGE.left - REPORT_PAGE.right;
  const noIndent = { firstLine: 0, left: 0, right: 0 };
  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    new Paragraph({ children: [new TextRun({ text: ' ', size: 2 })], indent: noIndent, spacing: { before: 0, after: 0, line: 2800, lineRule: LineRuleType.EXACT } }),
    new Paragraph({ children: [new TextRun({ text: presentation.masthead, color: 'FF0000', font: '华文行楷', size: 116, scale: 80, characterSpacing: -20 })], alignment: AlignmentType.CENTER, indent: noIndent, spacing: { before: 0, after: 312, line: 1300, lineRule: LineRuleType.AT_LEAST }, keepNext: true }),
    new Paragraph({ children: [new TextRun({ text: presentation.issue, font: '楷体_GB2312', size: 36 })], alignment: AlignmentType.CENTER, indent: noIndent, spacing: { before: 157, after: 157, line: 660, lineRule: LineRuleType.AT_LEAST }, keepNext: true }),
    new Paragraph({ children: [new TextRun({ text: REPORT_COMPILER, font: '仿宋_GB2312', size: 26 }), new TextRun({ text: '\t' + presentation.cutoff, font: '仿宋_GB2312', size: 26 })], indent: noIndent, tabStops: [{ type: TabStopType.RIGHT, position: contentWidth }], border: { bottom: { color: 'FF0000', style: BorderStyle.SINGLE, size: 8, space: 6 } }, spacing: { before: 200, after: 300, line: 400 }, keepNext: true }),
    new Paragraph({ text: report.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, indent: noIndent, spacing: { before: 157, after: 100, line: 650, lineRule: LineRuleType.AT_LEAST }, keepNext: true }),
    new Paragraph({ children: [new TextRun({ text: presentation.period, font: '方正小标宋简体', size: 44, bold: true })], alignment: AlignmentType.CENTER, indent: noIndent, spacing: { after: 450, line: 650, lineRule: LineRuleType.AT_LEAST }, keepNext: true }),
  ];
  report.sections.forEach(section => {
    const v = section.versions[section.active];
    children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1, keepNext: true, indent: { firstLine: 640 }, spacing: { before: 120, after: 0, line: 550, lineRule: LineRuleType.AT_LEAST } }));
    v.paragraphs.forEach(tokens => children.push(new Paragraph({ children: [new TextRun(textOf(tokens, a))], alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 640 }, widowControl: true, spacing: { line: 550, lineRule: LineRuleType.AT_LEAST, after: 0 } })));
    if (v.table?.rows.length) {
      const count = v.table.headers.length;
      const widths = count === 2 ? [Math.round(contentWidth * .72), Math.round(contentWidth * .28)] : Array.from({ length: count }, () => Math.floor(contentWidth / count));
      const cell = (text: string, index: number, header = false) => new TableCell({ width: { size: widths[index], type: WidthType.DXA }, margins: { top: 75, bottom: 75, left: 90, right: 90 }, children: [new Paragraph({ alignment: header || index > 0 ? AlignmentType.CENTER : AlignmentType.LEFT, indent: noIndent, spacing: { line: 300, after: 0 }, children: [new TextRun({ text, size: 22, font: header ? '黑体' : '仿宋_GB2312', bold: header })] })] });
      const border = { style: BorderStyle.SINGLE, size: 4, color: '808080' };
      children.push(new Table({ width: { size: contentWidth, type: WidthType.DXA }, columnWidths: widths, borders: { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border }, rows: [new TableRow({ tableHeader: true, children: v.table.headers.map((text, index) => cell(text, index, true)) }), ...v.table.rows.map(row => new TableRow({ children: row.map((tokens, index) => cell(textOf(tokens, a), index)) }))] }));
    }
  });
  children.push(new Paragraph({ children: [new TextRun({ text: presentation.scopeNote, size: 22 })], indent: noIndent, spacing: { before: 250, line: 360 } }), new Paragraph({ children: [new TextRun({ text: presentation.disclaimer, size: 22 })], indent: noIndent, spacing: { line: 360 } }));
  const pageFooter = (alignment: typeof AlignmentType.LEFT | typeof AlignmentType.RIGHT) => new Footer({ children: [new Paragraph({ alignment, indent: noIndent, children: [new TextRun({ text: '－ ', size: 28 }), new TextRun({ children: [PageNumber.CURRENT], size: 28 }), new TextRun({ text: ' －', size: 28 })] })] });
  return Packer.toBlob(new Document({
    evenAndOddHeaderAndFooters: true,
    styles: { default: {
      document: { run: { font: '仿宋_GB2312', size: 32, color: '000000' } },
      title: { run: { font: '方正小标宋简体', size: 44, bold: true, color: '000000' } },
      heading1: { run: { font: '黑体', size: 32, color: '000000' } },
    } },
    sections: [{ properties: { page: { size: { width: REPORT_PAGE.width, height: REPORT_PAGE.height }, margin: { top: REPORT_PAGE.top, right: REPORT_PAGE.right, bottom: REPORT_PAGE.bottom, left: REPORT_PAGE.left, header: REPORT_PAGE.header, footer: REPORT_PAGE.footer } } }, footers: { default: pageFooter(AlignmentType.RIGHT), even: pageFooter(AlignmentType.LEFT) }, children }],
  }));
}

export type FilteredExport = { rows: Order[]; period: 'current' | 'previous'; description: string };
export async function createEvidenceWorkbook(a: Analysis, metric: Metric, filtered?: FilteredExport): Promise<Blob> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = '闵行城运周报演示';
  workbook.calcProperties.fullCalcOnLoad = true;
  const summary = workbook.addWorksheet('汇总核验');
  const rules = workbook.addWorksheet('统计口径');
  const current = workbook.addWorksheet('本期明细');
  const previous = workbook.addWorksheet('对比期明细');
  const orderByReview = (rows: Order[]) => [...rows].sort((x, y) => ({ pending: 0, confirmed: 1, excluded: 2 }[assessOrder(x, metric.filter).state]) - ({ pending: 0, confirmed: 1, excluded: 2 }[assessOrder(y, metric.filter).state]));
  const currentRows = orderByReview(filtered ? filtered.period === 'current' ? filtered.rows : [] : a.current);
  const previousRows = orderByReview(filtered ? filtered.period === 'previous' ? filtered.rows : [] : a.previous);
  const writeOrders = (sheet: typeof current, rows: Order[]) => {
    sheet.columns = [
      { header: '唯一工单编号', key: 'id', width: 30 }, { header: '受理时间（上海时间）', key: 'date', width: 24 },
      { header: '渠道', key: 'channel', width: 17 }, { header: '业务类型', key: 'business', width: 15 },
      { header: '诉求分类', key: 'category', width: 18 }, { header: '街镇', key: 'street', width: 17 },
      { header: '标准点位', key: 'point', width: 42 }, { header: '承办单位', key: 'department', width: 26 },
      { header: '脱敏诉求摘要', key: 'description', width: 75 }, { header: '工单计数', key: 'unit', width: 14 },
      { header: '匹配当前指标（1/0）', key: 'match', width: 22 },
      { header: '主题命中依据（本地规则模拟）', key: 'themeReason', width: 65 },
      { header: '市级四级分类', key: 'cityCategory4', width: 55 }, { header: '区级案件小类', key: 'districtCategory', width: 22 }, { header: '区级案件子类', key: 'districtSubcategory', width: 28 }, { header: '诉求细分', key: 'issueType', width: 26 }, { header: '发生场景', key: 'scene', width: 24 }, { header: '人工归属结论', key: 'reviewDecision', width: 18 }, { header: '待核对（暂不计入）', key: 'pending', width: 22 },
    ];
    const literal = (value: string) => `"${value.replaceAll('"', '""')}"`;
    sheet.addRows(rows.map((o, index) => {
      const row = index + 2;
      const conditions = [metric.filter.category ? `E${row}=${literal(metric.filter.category)}` : '', metric.filter.point ? `G${row}=${literal(metric.filter.point)}` : '', metric.filter.business ? `D${row}=${literal(metric.filter.business)}` : '', metric.filter.channel ? `C${row}=${literal(metric.filter.channel)}` : '', metric.filter.keyword ? `ISNUMBER(SEARCH(${literal(metric.filter.keyword.replaceAll('~', '~~').replaceAll('*', '~*').replaceAll('?', '~?'))},I${row}&CHAR(1)&G${row}&CHAR(1)&E${row}))` : ''].filter(Boolean);
      const search = (term: string) => `ISNUMBER(SEARCH(${literal(term.replaceAll('~', '~~').replaceAll('*', '~*').replaceAll('?', '~?'))},I${row}&CHAR(1)&G${row}))`;
      for (const [key, column] of [['cityCategory4', 'M'], ['districtCategory', 'N'], ['districtSubcategory', 'O'], ['issueType', 'P'], ['scene', 'Q']] as const) if (metric.filter[key]) conditions.push(`${column}${row}=${literal(metric.filter[key]!)}`);
      metric.filter.textGroups?.forEach(words => conditions.push(`OR(${words.map(search).join(',')})`));
      const semantic = metric.filter.semantic;
      const semanticConditions = semantic ? [...semantic.groups.map(words => `OR(${words.map(search).join(',')})`), ...[...semantic.excluded, ...(semantic.reviewTerms || [])].map(term => `NOT(${search(term)})`)] : [];
      const baseMatch = conditions.length ? `AND(${conditions.join(',')})` : 'TRUE';
      const semanticMatch = semanticConditions.length ? `AND(${semanticConditions.join(',')})` : 'TRUE';
      const matched = `IF(R${row}="计入",1,IF(R${row}="排除",0,IF(${semanticMatch},1,0)))`;
      const assessment = assessOrder(o, metric.filter);
      const related = semantic ? `AND(${baseMatch},R${row}="",OR(${semantic.groups.flat().map(search).join(',')}),${semantic.excluded.length ? `AND(${semantic.excluded.map(term => `NOT(${search(term)})`).join(',')})` : 'TRUE'},NOT(${semanticMatch}))` : 'FALSE';
      return { ...o, scene: o.scene || inferScene(o), reviewDecision: metric.filter.reviewOverrides?.[o.id] === 'include' ? '计入' : metric.filter.reviewOverrides?.[o.id] === 'exclude' ? '排除' : '', themeReason: metric.filter.semantic ? (assessment.reason === '符合主题表达组合' ? themeMatchReason(metric.filter.semantic, o) : assessment.reason) : '', date: new Date(o.receivedAt.replace(' ', 'T') + 'Z'), unit: { formula: `IF(A${row}="",0,${metric.filter.channel ? `IF(C${row}=${literal(metric.filter.channel)},1,0)` : '1'})`, result: !metric.filter.channel || o.channel === metric.filter.channel ? 1 : 0 }, match: { formula: `IF(A${row}="",0,IF(${baseMatch},${matched},0))`, result: matches(o, metric.filter) ? 1 : 0 }, pending: { formula: `IF(A${row}="",0,IF(${related},1,0))`, result: assessment.state === 'pending' ? 1 : 0 } };

    }));
    sheet.eachRow((row, index) => { if (index > 1 && (row.getCell('S').value as { result?: number })?.result === 1) row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF3D9' } }; });
    sheet.getColumn('date').numFmt = 'yyyy-mm-dd hh:mm:ss';
    sheet.autoFilter = { from: 'A1', to: 'S1' };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  };
  writeOrders(current, currentRows); writeOrders(previous, previousRows);
  rules.columns = [{ width: 28 }, { width: 105 }];
  rules.addRows([
    ['统计口径', '内容'], ['数据性质', a.dataKind === 'imported' ? `当前会话导入的试用数据：${a.dataLabel || '业务工单'}；结果待业务核验` : a.dataRevision ? '当前会话数据集，数据性质请核对页面标识' : '本地固定种子生成的模拟工单，不代表真实业务情况'],
    ['指标', metric.label], ['原指标展示值', metricText(metric)], ['本期范围', `${a.scope.start}至${a.scope.end}`],
    ['比较期范围', `${a.previousScope.start}至${a.previousScope.end}`], ['统计渠道', a.scope.channel],
    ['时间与去重', '上海时间，起止日期均含全天；按唯一工单编号去重；同一编号只计一次'],
    ['绑定指标', metric.definitionCode ? `${metric.definitionCode} · v${metric.definitionVersion}；${metric.definitionDescription}` : '分析统计指标'], ['指标筛选条件', JSON.stringify(metric.filter)], ['指标计算', metric.formula],
    ['主题识别规则', metric.filter.semantic ? themeRuleDescription(metric.filter.semantic) : '无自定义主题识别条件'],
    ['天数', a.days], ['比较期完整', a.comparisonComplete ? '是' : '否；不计算环比'],
    ['舍入规则', '数量保留整数，日均及百分比保留1位小数；底层公式使用未舍入数值'],
    ['导出范围', filtered ? `当前筛选结果：${filtered.description}；仅导出所选周期的筛选记录，不代表完整指标。` : '本期及比较期完整口径明细；K列标识哪些记录匹配当前指标，J列用于复核总量与占比分母'],
    ['人工归属', '待核对工单暂不计入K列统计，S列单独计数；R列保留当前人工归属结论，可在线下修改并复算。分类与语义筛选同时生效。'],
    ['核验说明', '汇总核验中的数值由明细单元格公式计算；修改明细后可在Excel中重新计算。未覆盖的比较期不能按0解释。'],
  ]);
  summary.columns = [{ width: 35 }, { width: 25 }, { width: 75 }];
  summary.addRow(['核验项目', '计算结果', '说明']);
  const sumRange = (name: string, col: string, count: number) => `SUM('${name}'!${col}2:${col}${Math.max(2, count + 1)})`;
  const countNow = currentRows.filter(o => matches(o, metric.filter)).length;
  const countOld = previousRows.filter(o => matches(o, metric.filter)).length;
  summary.addRow(['本期匹配指标工单量', { formula: sumRange('本期明细', 'K', currentRows.length), result: countNow }, '按本期明细K列求和']);
  summary.addRow(['上期匹配指标工单量', { formula: sumRange('对比期明细', 'K', previousRows.length), result: countOld }, '按对比期明细K列求和']);
  summary.addRow(['本期口径总量', { formula: sumRange('本期明细', 'J', currentRows.length), result: currentRows.filter(o => !metric.filter.channel || o.channel === metric.filter.channel).length }, '作为本期占比分母']);
  summary.addRow(['上期口径总量', { formula: sumRange('对比期明细', 'J', previousRows.length), result: previousRows.filter(o => !metric.filter.channel || o.channel === metric.filter.channel).length }, '作为上期占比分母']);
  summary.addRow(['统计天数', a.days, '完整自然日，含起止日期']);
  if (filtered) {
    summary.addRow(['当前筛选结果条数', { formula: filtered.period === 'current' ? 'B4' : 'B5', result: filtered.rows.length }, '本文件是筛选结果，不用于直接复算原指标']);
  } else {
    const numeratorCell = metric.period === 'current' ? 'B2' : 'B3', baseCell = metric.period === 'current' ? 'B4' : 'B5';
    const formula = metric.kind === 'count' ? numeratorCell : metric.kind === 'daily' ? `${numeratorCell}/B6` : metric.kind === 'share' ? `IF(${baseCell}=0,0,${numeratorCell}/${baseCell})` : a.comparisonComplete ? 'IF(B3=0,"不可计算",(B2-B3)/B3)' : '"比较期不完整"';
    summary.addRow([metric.label, { formula, result: metric.value ?? (a.comparisonComplete ? '不可计算' : '比较期不完整') }, metric.formula]);
    summary.getCell('B7').numFmt = metric.kind === 'share' || metric.kind === 'change' ? '0.0%' : metric.kind === 'daily' ? '0.0' : '0';
  }
  summary.addRow(['本期待核对（暂未计入）', { formula: sumRange('本期明细', 'S', currentRows.length), result: currentRows.filter(o => assessOrder(o, metric.filter).state === 'pending').length }, '按S列计数，不计入已确认工单量']);
  workbook.eachSheet(sheet => {
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2468B8' } };
    sheet.getRow(1).height = 28;
    if (sheet === rules || sheet === summary) sheet.eachRow(row => { row.alignment = { vertical: 'middle', wrapText: true }; row.height = 36; });
  });
  const bytes = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
