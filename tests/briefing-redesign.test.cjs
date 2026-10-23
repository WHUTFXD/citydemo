const { test } = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const engine = require('../.qa/weeklyReport.js');
const briefing = require('../.qa/briefingAnalysis.js');
const trial = require('../.qa/trialData.js');
const imports = require('../.qa/reportDataImport.js');
const exporter = require('../.qa/weeklyReportExport.js');
const templates = require('../.qa/reportTemplates.js');
const definitions = require('../.qa/indicatorDefinitions.js');
const insight = require('../.qa/reportInsight.js');
const sample = trial.getTrialSampleOrders();
const a = engine.analyze(trial.TRIAL_SCOPE, sample, trial.TRIAL_COVERAGE);
const discovery = require('../.qa/textDiscovery.js');

test('词云统计实际分词次数，区别重复词与去重工单并复用核验筛选', () => {
  const rows = [
    { ...a.current[0], id: 'word-1', description: '市民反映电梯厅有二手烟，二手烟影响通行', point: '公共大厅' },
    { ...a.current[0], id: 'word-2', description: '电梯厅二手烟', point: '公共大厅' },
    { ...a.current[0], id: 'word-3', description: '树枝遮挡采光', point: '道路' },
  ];
  const local = { ...a, current: rows };
  const words = discovery.wordFrequencies(local);
  const smoke = words.find(w => w.word === '二手烟');
  assert.equal(smoke.frequency, 3);
  assert.equal(smoke.orders, 2);
  assert.ok(!words.some(w => ['市民', '反映'].includes(w.word)));
  words.forEach(w => assert.equal(w.orders, rows.filter(o => engine.matches(o, { textGroups: [[w.word]] })).length));
  assert.deepEqual(discovery.wordFrequencies({ ...a, current: [] }), []);
});

test('语义发现遍历全量文本、跨分类归集，修改分类字段不改变识别结果', () => {
  const words = discovery.wordFrequencies(a), topics = discovery.semanticDiscoveries(a, words);
  assert.ok(topics.length > 0 && topics.length <= 5);
  const reclassified = { ...a, current: a.current.map(o => ({ ...o, category: '任意原分类', cityCategory4: '变更市级', districtCategory: '变更区级' })) };
  assert.deepEqual(topics.map(t => [t.id, t.count]), discovery.semanticDiscoveries(reclassified).map(t => [t.id, t.count]));
  const cross = { ...a, current: [{ ...a.current[0], id: 'cross-1', category: '物业', description: '公共大厅二手烟', point: '大厅' }, { ...a.current[0], id: 'cross-2', category: '设施', description: '电梯里抽烟', point: '电梯' }] };
  const smoking = discovery.semanticDiscoveries(cross).find(t => t.name.includes('二手烟'));
  assert.ok(smoking);
  assert.ok(new Set(cross.current.filter(o => engine.matches(o, smoking.filter)).map(o => o.category)).size > 1);
  topics.forEach(t => {
    assert.equal(t.source, 'semantic');
    assert.ok(!t.filter.category && !t.filter.cityCategory4 && !t.filter.districtCategory);
    assert.equal(t.count, a.current.filter(o => engine.matches(o, t.filter)).length);
    assert.match(t.note, /本地规则模拟/);
  });
  assert.deepEqual(discovery.semanticDiscoveries({ ...a, current: [] }), []);
});

test('新词可从文本共现发现，语义主题生成报告与Excel的统计仍可追溯', async () => {
  const rows = [{ ...a.current[0], id: 'novel-1', description: '机器人配送发生故障，机器人配送需要维修', point: '办公大楼' }];
  const local = { ...a, current: rows };
  const topics = discovery.semanticDiscoveries(local);
  assert.ok(topics.length > 0);
  const theme = topics[0];
  const report = templates.generateTemplateReport(local, templates.defaultReportTemplates().find(t => t.id === 'weekly-standard'), definitions.defaultIndicatorDefinitions(), [theme]);
  assert.ok(report.sections.some(s => s.title.includes(theme.name)));
  const token = engine.registerMetric(local, 'count', theme.filter);
  assert.equal(local.metrics[token.metricId].numerator, 1);
  const blob = await exporter.createEvidenceWorkbook(local, local.metrics[token.metricId]);
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await blob.arrayBuffer());
  assert.equal(wb.getWorksheet('本期明细').getCell('A2').value, 'novel-1');
});

test('试用样例覆盖9月至会议当周，两套分类来源独立且不虚构缺失分类', () => {
  assert.equal(sample[0].receivedAt.slice(0, 10), '2026-09-01');
  assert.equal(sample.at(-1).receivedAt.slice(0, 10), '2026-10-21');
  assert.ok(a.current.length > 8500 && a.current.length < 10000);
  assert.ok(sample.every(o => o.cityCategory4.split(' / ').length === 4));
  const city = briefing.classificationThemes(a, 'city'), district = briefing.classificationThemes(a, 'district');
  assert.equal(city.reduce((n, t) => n + t.count, 0), a.current.length);
  assert.equal(district.reduce((n, t) => n + t.count, 0), a.current.length);
  assert.ok(city.every(t => t.filter.cityCategory4 && !t.filter.districtCategory));
  assert.ok(district.every(t => t.filter.districtCategory && !t.filter.cityCategory4));
  const without = { ...a, current: a.current.map(o => ({ ...o, cityCategory4: undefined, districtCategory: undefined })) };
  assert.deepEqual(briefing.classificationThemes(without, 'city'), []);
  assert.deepEqual(briefing.classificationThemes(without, 'district'), []);
});

test('市级末级仍能语义细分，区级可进入子类，细分口径始终收窄父主题', () => {
  const cityTree = briefing.classificationThemes(a, 'city').find(t => t.name.includes('行道树'));
  assert.deepEqual(briefing.topicChildren(a, cityTree, 'classification'), []);
  const semantics = briefing.topicChildren(a, cityTree, 'semantic');
  assert.ok(semantics.length >= 2);
  semantics.forEach(t => {
    assert.equal(t.filter.cityCategory4, cityTree.filter.cityCategory4);
    assert.ok(t.count > 0 && t.count < cityTree.count);
    assert.equal(t.count, a.current.filter(o => engine.matches(o, t.filter)).length);
    assert.ok(a.current.filter(o => engine.matches(o, t.filter)).every(o => engine.matches(o, cityTree.filter)));
  });
  const districtTree = briefing.classificationThemes(a, 'district').find(t => t.name === '行道树');
  const children = briefing.topicChildren(a, districtTree, 'classification');
  assert.ok(children.length >= 2);
  assert.equal(children.reduce((n, t) => n + t.count, 0), districtTree.count);
});

test('长周期专题支持9月份以来自然语言及多个主题要素', () => {
  const scope = briefing.resolveQuestionScope('9月份以来公建配套中老年人、社区食堂的诉求', trial.TRIAL_SCOPE, trial.TRIAL_COVERAGE);
  assert.equal(scope.start, '2026-09-01');
  const longer = engine.analyze(scope, sample, trial.TRIAL_COVERAGE);
  assert.equal(longer.days, 51);
  const theme = briefing.customTheme('9月份以来公建配套中老年人、社区食堂的诉求', 'canteen');
  assert.equal(theme.filter.category, '公建配套');
  assert.ok(theme.filter.semantic.groups.length >= 2);
  const found = briefing.themeResult(longer, theme);
  assert.ok(found.count > 0);
  assert.ok(longer.current.filter(o => engine.matches(o, theme.filter)).every(o => o.category === '公建配套'));
  assert.throws(() => briefing.resolveQuestionScope('8月份以来', trial.TRIAL_SCOPE, trial.TRIAL_COVERAGE), /数据覆盖/);
  assert.equal(longer.comparisonComplete, false);
});

test('待核对工单置顶并暂不计入，人工计入与排除保留基本筛选边界', () => {
  const theme = briefing.customTheme('老年人、社区食堂', 'pending', '公建配套');
  const base = { ...sample[0], category: '公建配套', point: '居民服务点' };
  const confirmed = { ...base, id: 'A', description: '老年人反映社区食堂饭菜质量' };
  const pending = { ...base, id: 'Z', description: '老年人咨询附近食堂，是否属于社区助餐有待核实' };
  const excluded = { ...base, id: 'X', category: '教育', description: confirmed.description };
  const many = [...Array.from({ length: 1001 }, (_, i) => ({ ...confirmed, id: `A${i}` })), pending, excluded];
  const list = briefing.reviewedRows(many, theme.filter);
  assert.equal(list[0].id, 'Z'); assert.equal(list[0].assessment.state, 'pending');
  assert.equal(many.filter(o => engine.matches(o, theme.filter)).length, 1001);
  const included = { ...theme.filter, reviewOverrides: { Z: 'include', X: 'include' } };
  assert.equal(engine.matches(pending, included), true);
  assert.equal(engine.matches(excluded, included), false);
  assert.equal(briefing.assessOrder(pending, included).reason, '人工确认计入');
  assert.equal(engine.matches(pending, { ...included, reviewOverrides: { Z: 'exclude' } }), false);
});

test('批量核对覆盖跨页选择、保留已有结论且不影响其他主题及原始工单', () => {
  const theme = briefing.customTheme('老年人、社区食堂', 'batch', '公建配套');
  const rows = Array.from({ length: 51 }, (_, i) => ({ ...sample[0], id: `pending-${i}`, category: '公建配套', point: '服务窗口', description: '老年人咨询助餐，是否属于社区助餐有待核实' }));
  const untouched = briefing.customTheme('公共场所吸烟', 'other');
  const latest = { ...theme, filter: { ...theme.filter, reviewOverrides: { historic: 'exclude' } } };
  const pendingIds = briefing.reviewedRows(rows, theme.filter).filter(o => o.assessment.state === 'pending').map(o => o.id);
  assert.equal(pendingIds.length, 51);
  const included = briefing.reviewThemeOrders([latest, untouched], theme, pendingIds, 'include');
  const adopted = included.find(t => t.id === theme.id);
  assert.equal(rows.filter(o => engine.matches(o, adopted.filter)).length, 51);
  assert.equal(adopted.filter.reviewOverrides.historic, 'exclude');
  assert.equal(included.find(t => t.id === untouched.id), untouched);
  assert.equal(rows.filter(o => engine.matches(o, theme.filter)).length, 0);
  const excluded = briefing.reviewThemeOrders(included, theme, pendingIds.slice(0, 21), 'exclude').find(t => t.id === theme.id);
  assert.equal(rows.filter(o => engine.matches(o, excluded.filter)).length, 30);
  assert.equal(excluded.filter.reviewOverrides.historic, 'exclude');
  assert.equal(briefing.reviewedRows(rows, excluded.filter).filter(o => o.assessment.state === 'pending').length, 0);
});

test('Excel保留两套分类与待核对标识，人工归属及统计公式可复核', async () => {
  const theme = briefing.customTheme('老年人、社区食堂', 'excel', '公建配套');
  const base = { ...sample[0], category: '公建配套', receivedAt: '2026-10-20 10:00:00', point: '居民服务点' };
  const rows = [{ ...base, id: 'C', description: '老年人反映社区食堂饭菜质量' }, { ...base, id: 'P', description: '老年人咨询食堂，是否属于社区助餐有待核实' }];
  const report = engine.analyze(trial.TRIAL_SCOPE, rows, trial.TRIAL_COVERAGE);
  const id = engine.registerMetric(report, 'count', theme.filter).metricId;
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(await (await exporter.createEvidenceWorkbook(report, report.metrics[id])).arrayBuffer());
  const sheet = wb.getWorksheet('本期明细');
  assert.equal(sheet.getCell('A2').value, 'P');
  assert.equal(Number(sheet.getCell('K2').value.result || 0), 0); assert.equal(sheet.getCell('S2').value.result, 1);
  assert.equal(sheet.getCell('M1').value, '市级四级分类');
  assert.equal(sheet.getCell('N1').value, '区级案件小类');
  assert.match(sheet.getCell('K2').value.formula, /R2/); assert.match(sheet.getCell('K2').value.formula, /有待核实/);
  assert.equal(wb.getWorksheet('汇总核验').getCell('B7').value.result, 1);
  assert.equal(wb.getWorksheet('汇总核验').getCell('B8').value.result, 1);
  assert.equal(sheet.getRow(2).fill.fgColor.argb, 'FFFFF3D9');
  const back = await imports.readOrderWorkbook(await wb.xlsx.writeBuffer());
  assert.equal(back.length, 2); assert.equal(back[0].cityCategory4, rows[1].cityCategory4);
});

test('试用导入接受近期时间及原业务分类，保留可选分类字段，不补造分类', async () => {
  const wb = new ExcelJS.Workbook(), sheet = wb.addWorksheet('试用工单');
  sheet.addRow([...imports.ORDER_COLUMNS, ...imports.OPTIONAL_COLUMNS]);
  sheet.addRow(['LIVE-1', '2026-10-20 10:30:00', '业务试用渠道', '业务咨询', '业务方原分类', '七宝镇', '社区服务点', '承办单位', '老年人咨询社区食堂', '公共服务 / 社区服务 / 公建配套 / 社区助餐', '公建配套', '社区食堂', '助餐服务', '社区食堂及助餐点']);
  sheet.addRow(['LIVE-2', '2026-10-21 08:00:00', '12345热线', '投诉求助', '其他业务分类', '七宝镇', '社区', '承办单位', '配套设施咨询']);
  const rows = await imports.readOrderWorkbook(await wb.xlsx.writeBuffer());
  assert.equal(rows[0].category, '业务方原分类');
  assert.equal(rows[0].districtSubcategory, '社区食堂'); assert.equal(rows[1].cityCategory4, undefined);
});

test('问数支持具体主题、分类问数及跨轮场景追问，并返回同口径工单', () => {
  const first = briefing.askOrders('公共场所吸烟主要集中在哪些场景？', trial.TRIAL_SCOPE, sample, trial.TRIAL_COVERAGE);
  const matching = first.analysis.current.filter(o => engine.matches(o, first.theme.filter));
  assert.ok(matching.length > 0); assert.equal(first.intent, 'scenes');
  const follow = briefing.askOrders('其中电梯里有哪些问题？', trial.TRIAL_SCOPE, sample, trial.TRIAL_COVERAGE, first);
  const detail = follow.analysis.current.filter(o => engine.matches(o, follow.theme.filter));
  assert.ok(detail.length > 0 && detail.length < matching.length);
  assert.ok(detail.every(o => o.point.includes('电梯') || o.description.includes('电梯')));
  const byClass = briefing.askOrders('区级分类：教育有多少工单？', trial.TRIAL_SCOPE, sample, trial.TRIAL_COVERAGE);
  assert.equal(byClass.theme.filter.districtCategory, '教育');
  assert.equal(byClass.analysis.current.filter(o => engine.matches(o, byClass.theme.filter)).length, a.current.filter(o => o.districtCategory === '教育').length);
});

test('辅助研判展示餐饮、电梯等具体场景和诉求，数字关联完整筛选条件', () => {
  const theme = briefing.customTheme('公共场所吸烟', 'insight-smoke');
  const report = templates.generateTemplateReport(a, templates.defaultReportTemplates().find(t => t.id === 'weekly-standard'), definitions.defaultIndicatorDefinitions(), [theme]);
  const context = insight.insightContexts(report).find(c => c.section.includes('公共场所吸烟') && c.paragraph === 1);
  const answer = insight.buildInsight(report, context, '集中于哪些场景和诉求？');
  assert.equal(answer.intent, 'scenes');
  assert.ok(answer.blocks.some(b => /电梯|餐饮/.test(b.title)));
  assert.ok(answer.blocks.some(b => b.title === '进一步看具体诉求'));
  answer.blocks.forEach(block => block.tokens.filter(t => typeof t !== 'string').forEach(t => {
    const metric = report.analysis.metrics[t.metricId];
    assert.equal(metric.numerator, (metric.period === 'current' ? a.current : a.previous).filter(o => engine.matches(o, metric.filter)).length);
  }));
  assert.ok(report.sections.every(s => !s.title.includes('热点事件：') && !s.title.includes('群众热议：')));
});
