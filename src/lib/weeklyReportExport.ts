import { matches, metricText, textOf, type Analysis, type Metric, type Order, type Report } from './weeklyReport';

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob), link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export async function createWord(report: Report): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, AlignmentType, HeadingLevel } = await import('docx');
  const a = report.analysis;
  const children: (InstanceType<typeof Paragraph> | InstanceType<typeof Table>)[] = [
    new Paragraph({ text: report.title, heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 260 } }),
    new Paragraph({ text: `${a.scope.start} 至 ${a.scope.end}`, alignment: AlignmentType.CENTER }),
    new Paragraph({ text: '闵行区城市运行管理中心 · 模拟数据演示', alignment: AlignmentType.CENTER, spacing: { after: 260 } }),
    new Paragraph({ text: `统计口径：${a.scope.channel}；按受理时间（上海时间）统计，唯一工单编号去重。比较期：${a.previousScope.start}至${a.previousScope.end}${a.comparisonComplete ? '' : '（覆盖不完整，不计算环比）'}。`, spacing: { after: 200 } }),
  ];
  report.sections.forEach(section => {
    const v = section.versions[section.active];
    children.push(new Paragraph({ text: section.title, heading: HeadingLevel.HEADING_1, keepNext: true, spacing: { before: 240, after: 120 } }));
    v.paragraphs.forEach(tokens => children.push(new Paragraph({ children: [new TextRun(textOf(tokens, a))], spacing: { line: 360, after: 120 } })));
    if (v.table?.rows.length) children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ tableHeader: true, children: v.table.headers.map(text => new TableCell({ shading: { fill: 'EAF1F8' }, children: [new Paragraph({ children: [new TextRun({ text, bold: true })] })] })) }), ...v.table.rows.map(row => new TableRow({ children: row.map(tokens => new TableCell({ children: [new Paragraph(textOf(tokens, a))] })) }))] }));
  });
  return Packer.toBlob(new Document({
    styles: { default: {
      document: { run: { font: '宋体', size: 24, color: '202020' } },
      title: { run: { font: '黑体', size: 36, bold: true, color: '202020' } },
      heading1: { run: { font: '黑体', size: 28, bold: true, color: '202020' } },
    } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1134, right: 1134, bottom: 1134, left: 1134 } } }, children }],
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
  const currentRows = filtered ? filtered.period === 'current' ? filtered.rows : [] : a.current;
  const previousRows = filtered ? filtered.period === 'previous' ? filtered.rows : [] : a.previous;
  const writeOrders = (sheet: typeof current, rows: Order[]) => {
    sheet.columns = [
      { header: '唯一工单编号', key: 'id', width: 30 }, { header: '受理时间（上海时间）', key: 'date', width: 24 },
      { header: '渠道', key: 'channel', width: 17 }, { header: '业务类型', key: 'business', width: 15 },
      { header: '诉求分类', key: 'category', width: 18 }, { header: '街镇', key: 'street', width: 17 },
      { header: '标准点位', key: 'point', width: 42 }, { header: '承办单位', key: 'department', width: 26 },
      { header: '脱敏诉求摘要', key: 'description', width: 75 }, { header: '工单计数', key: 'unit', width: 14 },
      { header: '匹配当前指标（1/0）', key: 'match', width: 22 },
    ];
    const literal = (value: string) => `"${value.replaceAll('"', '""')}"`;
    sheet.addRows(rows.map((o, index) => {
      const row = index + 2;
      const conditions = [metric.filter.category ? `E${row}=${literal(metric.filter.category)}` : '', metric.filter.point ? `G${row}=${literal(metric.filter.point)}` : '', metric.filter.business ? `D${row}=${literal(metric.filter.business)}` : ''].filter(Boolean);
      return { ...o, date: new Date(o.receivedAt.replace(' ', 'T') + 'Z'), unit: { formula: `IF(A${row}="",0,1)`, result: 1 }, match: { formula: `IF(A${row}="",0,${conditions.length ? `IF(AND(${conditions.join(',')}),1,0)` : '1'})`, result: matches(o, metric.filter) ? 1 : 0 } };
    }));
    sheet.getColumn('date').numFmt = 'yyyy-mm-dd hh:mm:ss';
    sheet.autoFilter = { from: 'A1', to: 'K1' };
    sheet.views = [{ state: 'frozen', ySplit: 1 }];
  };
  writeOrders(current, currentRows); writeOrders(previous, previousRows);
  rules.columns = [{ width: 28 }, { width: 105 }];
  rules.addRows([
    ['统计口径', '内容'], ['数据性质', '本地固定种子生成的模拟工单，不代表真实业务情况'],
    ['指标', metric.label], ['原指标展示值', metricText(metric)], ['本期范围', `${a.scope.start}至${a.scope.end}`],
    ['比较期范围', `${a.previousScope.start}至${a.previousScope.end}`], ['统计渠道', a.scope.channel],
    ['时间与去重', '上海时间，起止日期均含全天；按唯一工单编号去重；同一编号只计一次'],
    ['指标筛选条件', JSON.stringify(metric.filter)], ['指标计算', metric.formula],
    ['天数', a.days], ['比较期完整', a.comparisonComplete ? '是' : '否；不计算环比'],
    ['舍入规则', '数量保留整数，日均及百分比保留1位小数；底层公式使用未舍入数值'],
    ['导出范围', filtered ? `当前筛选结果：${filtered.description}；仅导出所选周期的筛选记录，不代表完整指标。` : '本期及比较期完整口径明细；K列标识哪些记录匹配当前指标，J列用于复核总量与占比分母'],
    ['核验说明', '汇总核验中的数值由明细单元格公式计算；修改明细后可在Excel中重新计算。未覆盖的比较期不能按0解释。'],
  ]);
  summary.columns = [{ width: 35 }, { width: 25 }, { width: 75 }];
  summary.addRow(['核验项目', '计算结果', '说明']);
  const sumRange = (name: string, col: string, count: number) => `SUM('${name}'!${col}2:${col}${Math.max(2, count + 1)})`;
  const countNow = currentRows.filter(o => matches(o, metric.filter)).length;
  const countOld = previousRows.filter(o => matches(o, metric.filter)).length;
  summary.addRow(['本期匹配指标工单量', { formula: sumRange('本期明细', 'K', currentRows.length), result: countNow }, '按本期明细K列求和']);
  summary.addRow(['上期匹配指标工单量', { formula: sumRange('对比期明细', 'K', previousRows.length), result: countOld }, '按对比期明细K列求和']);
  summary.addRow(['本期口径总量', { formula: sumRange('本期明细', 'J', currentRows.length), result: currentRows.length }, '作为本期占比分母']);
  summary.addRow(['上期口径总量', { formula: sumRange('对比期明细', 'J', previousRows.length), result: previousRows.length }, '作为上期占比分母']);
  summary.addRow(['统计天数', a.days, '完整自然日，含起止日期']);
  if (filtered) {
    summary.addRow(['当前筛选结果条数', { formula: filtered.period === 'current' ? 'B4' : 'B5', result: filtered.rows.length }, '本文件是筛选结果，不用于直接复算原指标']);
  } else {
    const numeratorCell = metric.period === 'current' ? 'B2' : 'B3', baseCell = metric.period === 'current' ? 'B4' : 'B5';
    const formula = metric.kind === 'count' ? numeratorCell : metric.kind === 'daily' ? `${numeratorCell}/B6` : metric.kind === 'share' ? `IF(${baseCell}=0,0,${numeratorCell}/${baseCell})` : a.comparisonComplete ? 'IF(B3=0,"不可计算",(B2-B3)/B3)' : '"比较期不完整"';
    summary.addRow([metric.label, { formula, result: metric.value ?? (a.comparisonComplete ? '不可计算' : '比较期不完整') }, metric.formula]);
    summary.getCell('B7').numFmt = metric.kind === 'share' || metric.kind === 'change' ? '0.0%' : metric.kind === 'daily' ? '0.0' : '0';
  }
  workbook.eachSheet(sheet => {
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2468B8' } };
    sheet.getRow(1).height = 28;
    if (sheet === rules || sheet === summary) sheet.eachRow(row => { row.alignment = { vertical: 'middle', wrapText: true }; row.height = 36; });
  });
  const bytes = await workbook.xlsx.writeBuffer();
  return new Blob([new Uint8Array(bytes)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
