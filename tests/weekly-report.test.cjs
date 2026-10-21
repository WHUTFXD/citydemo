const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const engine = require('../.qa/weeklyReport.js');
const exporter = require('../.qa/weeklyReportExport.js');
const platform = require('../.qa/metricPlatform.js');
const definitions = require('../.qa/indicatorDefinitions.js');
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

test('指标维护只包含定义和符号公式，不依赖日期或实际计算结果', () => {
  const items = definitions.defaultIndicatorDefinitions();
  assert.equal(items.length, 10);
  assert.ok(items.every(d => !('value' in d) && !('numerator' in d) && !('denominator' in d) && !('scope' in d)));
  assert.equal(definitions.nextIndicatorCode(items), 'MH-009');
  assert.ok(definitions.definitionFormula(items.find(d => d.kind === 'share')).includes('同期统计范围内工单总量'));
});
test('新增、编辑、停用、启用定义，保留编号并提升口径版本', () => {
  const initial = definitions.defaultIndicatorDefinitions();
  const custom = { ...initial[0], name: '行道树工单量', code: 'mh-009', category: '行道树', group: '行道树', description: '按受理时间统计行道树诉求，按唯一工单编号去重。' };
  let saved = definitions.saveIndicatorDefinition(initial, custom);
  assert.equal(saved.length, 11); const added = saved.at(-1);
  assert.equal(added.code, 'MH-009'); assert.equal(added.builtin, false); assert.equal(added.version, 1);
  saved = definitions.saveIndicatorDefinition(saved, { ...added, description: '更新后的统计口径说明', enabled: false }, added.id);
  assert.equal(saved.at(-1).enabled, false); assert.equal(saved.at(-1).version, 2);
  assert.equal(saved.at(-1).description, '更新后的统计口径说明');
  saved = definitions.saveIndicatorDefinition(saved, { ...saved.at(-1), enabled: true }, added.id);
  assert.equal(saved.at(-1).enabled, true); assert.equal(saved.at(-1).version, 3);
  assert.deepEqual(definitions.restoreIndicatorDefinitions(JSON.stringify(saved)), saved);
});
test('指标定义拒绝重复、空口径和无效计算规则，损坏存储可恢复默认', () => {
  const items = definitions.defaultIndicatorDefinitions();
  assert.throws(() => definitions.saveIndicatorDefinition(items, { ...items[0], name: '新名称' }), /编号已存在/);
  assert.throws(() => definitions.saveIndicatorDefinition(items, { ...items[0], code: 'MH-009' }), /名称已存在/);
  assert.throws(() => definitions.saveIndicatorDefinition(items, { ...items[0], description: '' }, items[0].id));
  assert.throws(() => definitions.saveIndicatorDefinition(items, { ...items[0], code: 'MH-099' }, items[0].id), /不能修改/);
  assert.throws(() => definitions.saveIndicatorDefinition(items, { ...items[0], kind: 'change', period: 'previous' }, items[0].id));
  assert.equal(definitions.restoreIndicatorDefinitions('invalid json').length, 10);
  assert.equal(definitions.restoreIndicatorDefinitions('[{"code":"BAD"}]').length, 10);
});
const disputes = require('../.qa/metricDisputes.js');
test('异议提交保存统计快照，不改变指标值；拒绝空原因和重复未处理申报', () => {
  const a = engine.analyze(scope), token = engine.registerMetric(a, 'count'), m = a.metrics[token.metricId];
  const before = JSON.stringify(m);
  assert.throws(() => disputes.submitMetricDispute([], a, m, '   ', 'bad'), /异议原因/);
  const records = disputes.submitMetricDispute([], a, m, '  怀疑重复计数  ', 'test-1');
  assert.equal(records[0].reason, '怀疑重复计数'); assert.equal(records[0].status, 'pending');
  assert.equal(JSON.stringify(m), before);
  assert.throws(() => disputes.submitMetricDispute(records, a, m, '再提交', 'test-2'), /已有待处理/);
  const other = engine.analyze({ ...scope, channel: '全渠道' }), otherToken = engine.registerMetric(other, 'count');
  assert.equal(disputes.submitMetricDispute(records, other, other.metrics[otherToken.metricId], '不同渠道', 'test-2').length, 2);
  const savedValue = records[0].metric.value; m.value = 999;
  assert.equal(records[0].metric.value, savedValue); assert.equal(records[0].scope.start, scope.start);
});
test('管理员处理状态与回复保留在会话中，结束后允许重新申报，历史数值不变', () => {
  const a = engine.analyze(scope), token = engine.registerMetric(a, 'daily'), m = a.metrics[token.metricId];
  let records = disputes.submitMetricDispute([], a, m, '请检查统计天数', 'test-3');
  assert.throws(() => disputes.handleMetricDispute(records, 'test-3', 'resolved', ' '), /处理说明/);
  records = disputes.handleMetricDispute(records, 'test-3', 'processing', '正在核对明细');
  assert.equal(disputes.disputesFor(records, a, m)[0].status, 'processing');
  records = disputes.handleMetricDispute(records, 'test-3', 'resolved', '已确认按完整自然日计算，无需调整');
  assert.equal(records[0].history.length, 3); assert.equal(records[0].metric.value, m.value);
  assert.equal(disputes.isOpenDispute(records[0]), false);
  assert.throws(() => disputes.handleMetricDispute(records, 'test-3', 'processing', '再改'), /已结束/);
  assert.equal(disputes.submitMetricDispute(records, a, m, '补充新证据', 'test-4').length, 2);
  const rejected = disputes.handleMetricDispute(disputes.submitMetricDispute([], a, m, '测试异议', 'test-5'), 'test-5', 'rejected', '核查后口径符合定义');
  assert.equal(rejected[0].status, 'rejected');
});
test('板块文字确认无需逐个核验数字，改写后新版本仍需确认', () => {
  const a = engine.analyze(scope), section = engine.generateReport(a, ['行道树'], false).sections[1];
  assert.equal(platform.sectionVerified(section), false);
  section.versions[0].verified = true; assert.equal(platform.sectionVerified(section), true);
  section.versions.push(engine.buildVersion(a, section.id, section.category, 2, ['精简表达'])); section.active = 1;
  assert.equal(platform.sectionVerified(section), false);
});
test('重写对照可还原左右原文，候选内容不会自动改变已采用版本', () => {
  const a = engine.analyze(scope), report = engine.generateReport(a, ['行道树'], false), section = report.sections[1];
  const before = platform.versionText(section.versions[0], a);
  const candidate = engine.buildVersion(a, section.id, section.category, 2, ['精简表达', '加强建议']);
  const after = platform.versionText(candidate, a), parts = platform.diffText(before, after);
  assert.equal(parts.filter(p => p.kind !== 'added').map(p => p.text).join(''), before);
  assert.equal(parts.filter(p => p.kind !== 'removed').map(p => p.text).join(''), after);
  assert.ok(parts.some(p => p.kind === 'added')); assert.ok(parts.some(p => p.kind === 'removed'));
  assert.equal(section.versions.length, 1); assert.equal(section.active, 0);
  assert.deepEqual(platform.diffText('同一段文字', '同一段文字'), [{ kind: 'same', text: '同一段文字' }]);
  for (const [l, r] of [['', '新增'], ['删除', ''], ['abc', 'xyz'], ['🙂你好', '🙂你们好']]) {
    const d = platform.diffText(l, r);
    assert.equal(d.filter(p => p.kind !== 'added').map(p => p.text).join(''), l);
    assert.equal(d.filter(p => p.kind !== 'removed').map(p => p.text).join(''), r);
  }
});
