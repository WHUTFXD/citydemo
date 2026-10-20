const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const engine = require('../.qa/weeklyReport.js');
const exporter = require('../.qa/weeklyReportExport.js');
const ExcelJS = require('exceljs');
const scope = { start: '2026-04-20', end: '2026-04-26', channel: '12345热线' };
const data = engine.getMockOrders();
const analysis = engine.analyze(scope);

test('固定模拟明细规模、唯一编号、每日渠道量与覆盖范围', () => {
  assert.ok(data.length > 110000 && data.length < 125000);
  assert.equal(new Set(data.map(o => o.id)).size, data.length);
  assert.equal(data[0].receivedAt.slice(0, 10), engine.DATA_START);
  assert.equal(data.at(-1).receivedAt.slice(0, 10), engine.DATA_END);
  const daily = new Map();
  data.forEach(o => { const d = o.receivedAt.slice(0, 10); const value = daily.get(d) || [0, 0]; value[0]++; value[1] += Number(o.channel === '12345热线'); daily.set(d, value); });
  assert.equal(daily.size, 92);
  for (const [all, hotline] of daily.values()) { assert.ok(all >= 1220 && all <= 1380); assert.ok(hotline >= 365 && hotline <= 445); }
  assert.strictEqual(engine.getMockOrders(), data);
});
test('日期、渠道、分类汇总和比较期保持一致', () => {
  const full = engine.analyze({ ...scope, channel: '全渠道' });
  assert.ok(full.current.length > 8500 && full.current.length < 10000);
  assert.equal(analysis.current.length, full.current.filter(o => o.channel === '12345热线').length);
  assert.equal(analysis.topics.reduce((sum, t) => sum + t.count, 0), analysis.current.length);
  assert.deepEqual([analysis.previousScope.start, analysis.previousScope.end], ['2026-04-13', '2026-04-19']);
  assert.ok(analysis.topics.every(t => Number.isFinite(t.score) && t.score >= 0 && t.score <= 100));
  assert.ok(analysis.topics.find(t => t.category === '行道树').growth > 0);
  assert.notDeepEqual(analysis.topics.slice(0, 2).map(t => t.category), engine.analyze({ ...scope, start: '2026-04-13', end: '2026-04-19' }).topics.slice(0, 2).map(t => t.category));
});
test('去重、范围边界和完整自然日', () => {
  assert.equal(engine.analyze(scope, [...data, ...data]).current.length, analysis.current.length);
  const one = engine.analyze({ ...scope, end: scope.start });
  assert.equal(one.days, 1);
  assert.ok(one.current.every(o => o.receivedAt.startsWith(scope.start)));
  assert.throws(() => engine.analyze({ ...scope, end: '2026-06-01' }));
  assert.throws(() => engine.analyze({ ...scope, start: '2026-05-01' }));
  assert.throws(() => engine.analyze({ ...scope, start: '2026-04-01', end: '2026-05-02' }));
});
test('无工单、上期为零、小基数与比较期不完整', () => {
  const empty = engine.analyze(scope, []);
  assert.equal(empty.topics.length, 0);
  assert.equal(empty.current.length, 0);
  const count = engine.registerMetric(empty, 'change');
  assert.equal(empty.metrics[count.metricId].value, null);
  const onlyCurrent = engine.analyze(scope, analysis.current);
  assert.ok(onlyCurrent.topics.every(t => t.growth === null && t.reasons.some(r => r.includes('小基数'))));
  const incomplete = engine.analyze({ ...scope, start: '2026-03-01', end: '2026-03-07' });
  assert.equal(incomplete.comparisonComplete, false);
  assert.ok(incomplete.topics.every(t => t.growth === null));
  const smallSource = [...analysis.current.slice(0, 10).map(o => ({ ...o, category: '教育' })), ...analysis.previous.slice(0, 2).map(o => ({ ...o, category: '教育' }))];
  const small = engine.analyze(scope, smallSource);
  assert.ok(small.topics[0].reasons.some(r => r.includes('不以增长率加分')));
  assert.ok(Math.abs(small.topics[0].score - 70) < 1e-8);
});
test('结构化指标均能定位明细，数值与公式相符', () => {
  const report = engine.generateReport(analysis, analysis.topics.slice(0, 2).map(t => t.category), true);
  assert.equal(report.sections.length, 6);
  for (const m of Object.values(analysis.metrics)) {
    const base = m.period === 'current' ? analysis.current : analysis.previous;
    assert.equal(m.numerator, base.filter(o => engine.matches(o, m.filter)).length);
    if (m.kind === 'change') assert.equal(m.value, (m.numerator - m.denominator) / m.denominator);
    const value = engine.textOf([{ metricId: m.id }], analysis);
    assert.equal(value, engine.metricText(m));
  }
});
test('四类改写保持统计事实，主题建议相关，版本独立', () => {
  const category = analysis.topics[0].category;
  const first = engine.buildVersion(analysis, 'topic-' + category, category, 1);
  first.verified = true;
  const next = engine.buildVersion(analysis, 'topic-' + category, category, 2, engine.REWRITE_MODES);
  assert.equal(first.verified, true); assert.equal(next.verified, false);
  assert.ok(next.paragraphs.some(p => engine.textOf(p, analysis).includes('牵头单位')));
  assert.ok(next.paragraphs.some(p => engine.textOf(p, analysis).includes('集中点位')));
  assert.ok(next.paragraphs.some(p => engine.textOf(p, analysis).includes('环比')));
  assert.deepEqual(engine.parseModes('精简表达并加强工作建议'), ['精简表达', '加强建议']);
  assert.deepEqual(engine.parseModes('写一首诗'), []);
});
test('Excel完整明细超出分页且具有可复算公式、数值与日期类型', async () => {
  const token = engine.registerMetric(analysis, 'share', { category: analysis.topics[0].category });
  const blob = await exporter.createEvidenceWorkbook(analysis, analysis.metrics[token.metricId]);
  const bytes = Buffer.from(await blob.arrayBuffer());
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(bytes);
  assert.equal(wb.worksheets.length, 4);
  assert.equal(wb.getWorksheet('本期明细').rowCount - 1, analysis.current.length);
  assert.equal(wb.getWorksheet('对比期明细').rowCount - 1, analysis.previous.length);
  assert.ok(wb.getWorksheet('本期明细').getCell('B2').value instanceof Date);
  assert.equal(typeof wb.getWorksheet('本期明细').getCell('J2').value.result, 'number');
  assert.ok(wb.getWorksheet('本期明细').getCell('K2').value.formula.includes('E2='));
  assert.equal(wb.getWorksheet('汇总核验').getCell('B7').value.formula, 'IF(B4=0,0,B2/B4)');
  assert.equal(wb.getWorksheet('汇总核验').getCell('B7').value.result, analysis.metrics[token.metricId].value);
  await fs.mkdir(path.join(__dirname, '../.qa/artifacts'), { recursive: true });
  await fs.writeFile(path.join(__dirname, '../.qa/artifacts/核验示例.xlsx'), bytes);
});
test('Excel筛选导出包含完整筛选结果而非当前页', async () => {
  const token = engine.registerMetric(analysis, 'count', { category: analysis.topics[0].category });
  const rows = analysis.current.filter(o => o.category === analysis.topics[0].category);
  assert.ok(rows.length > 20);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(Buffer.from(await (await exporter.createEvidenceWorkbook(analysis, analysis.metrics[token.metricId], { rows, period: 'current', description: '分类筛选' })).arrayBuffer()));
  assert.equal(wb.getWorksheet('本期明细').rowCount - 1, rows.length);
  assert.equal(wb.getWorksheet('汇总核验').getCell('B7').value.result, rows.length);
});
test('Word生成有效OOXML，导出当前版本与选定板块', async () => {
  const report = engine.generateReport(analysis, analysis.topics.slice(0, 2).map(t => t.category), false);
  const section = report.sections[1];
  section.versions.push(engine.buildVersion(analysis, section.id, section.category, 2, ['强调点位'])); section.active = 1;
  const blob = await exporter.createWord(report), bytes = Buffer.from(await blob.arrayBuffer());
  assert.equal(bytes[0], 0x50); assert.equal(bytes[1], 0x4b);
  const JSZip = require('jszip'); const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file('word/document.xml').async('string');
  assert.ok(xml.includes(report.title)); assert.ok(xml.includes('诉求集中点位为'));
  assert.ok(xml.includes('模拟数据')); assert.ok(!xml.includes('标记已核验'));
  assert.ok(!xml.includes('本期暂未录入经核实的领导批示'));
  await fs.mkdir(path.join(__dirname, '../.qa/artifacts'), { recursive: true });
  await fs.writeFile(path.join(__dirname, '../.qa/artifacts/周报示例.docx'), bytes);
});
