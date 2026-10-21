const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const ExcelJS = require('exceljs');
const engine = require('../.qa/weeklyReport.js');
const templates = require('../.qa/reportTemplates.js');
const definitions = require('../.qa/indicatorDefinitions.js');
const imports = require('../.qa/reportDataImport.js');
const exporter = require('../.qa/weeklyReportExport.js');
const { metricFingerprint, versionMetricIds } = require('../.qa/metricPlatform.js');
const defs = definitions.defaultIndicatorDefinitions();
const allScope = { start: '2026-04-20', end: '2026-04-26', channel: '全渠道' };
const source = engine.getMockOrders();
const a = engine.analyze(allScope);
const allTemplates = templates.defaultReportTemplates();
const selected = templates.recommendThemes(a).filter(t => t.group === '群众热议').slice(0, 1).map(({ id, name, group, filter }) => ({ id, name, group, filter }));

test('三种报告类型各有两个模板，全部绑定真实可用指标；模板可增改删及恢复空列表', () => {
  assert.equal(allTemplates.length, 6);
  for (const type of Object.keys(templates.REPORT_TYPES)) assert.equal(allTemplates.filter(t => t.type === type).length, 2);
  allTemplates.forEach(t => templates.validateTemplate(t, defs));
  const custom = { ...structuredClone(allTemplates[0]), id: 'test-template', name: '新增日报模板', version: 0 };
  let saved = templates.saveReportTemplate(allTemplates, custom, defs);
  assert.equal(saved.length, 7); assert.equal(saved.at(-1).version, 1);
  saved = templates.saveReportTemplate(saved, { ...saved.at(-1), name: '修改日报模板' }, defs);
  assert.equal(saved.at(-1).version, 2);
  assert.deepEqual(templates.restoreReportTemplates(JSON.stringify(saved)), saved);
  assert.deepEqual(templates.restoreReportTemplates('[]'), []);
  assert.equal(saved.filter(t => t.id !== 'test-template').length, 6);
});
test('所有报告类型生成实际结构，数字均关联指标定义版本，模板与口径快照隔离', () => {
  for (const type of Object.keys(templates.REPORT_TYPES)) {
    const t = allTemplates.find(t => t.type === type && t.id.endsWith('standard'));
    const scope = type === 'daily' ? { ...allScope, start: allScope.end } : allScope;
    const report = templates.generateTemplateReport(engine.analyze(scope), t, defs, selected);
    assert.ok(report.title.includes(templates.REPORT_TYPES[type]));
    assert.ok(report.sections.length >= 3);
    report.sections.forEach(section => versionMetricIds(section.versions[0]).forEach(id => {
      const m = report.analysis.metrics[id]; assert.ok(m.definitionId); assert.ok(m.definitionCode); assert.equal(m.definitionVersion, 1);
    }));
    const oldName = report.definitionSnapshot[0].name;
    const fresh = structuredClone(defs); fresh[0].name = '新名称';
    assert.equal(report.definitionSnapshot[0].name, oldName);
    assert.notEqual(templates.configurationKey(t, fresh, selected), report.configurationKey);
  }
});
test('模板拒绝缺失、停用或错误类型绑定，自定义正文指标随指标平台改变计算', () => {
  const t = structuredClone(allTemplates.find(t => t.id === 'weekly-standard'));
  t.blocks[0].bindings.count = 'not-found'; assert.throws(() => templates.validateTemplate(t, defs), /绑定/);
  t.blocks[0].bindings.count = 'builtin-2'; assert.throws(() => templates.validateTemplate(t, defs), /同类型/);
  t.blocks[0].bindings.count = 'builtin-1';
  const disabled = defs.map(d => d.id === 'builtin-1' ? { ...d, enabled: false } : d);
  assert.throws(() => templates.generateTemplateReport(a, t, disabled, selected), /已启用/);
  const d = { ...defs[0], id: 'custom-metric', code: 'NEW-COUNT', name: '分类指标', category: '行道树', version: 3 };
  const custom = { ...t, blocks: [{ id: 'custom', kind: 'custom', title: '自定义正文', body: '本期相关工单{{NEW-COUNT}}件。', bindings: {} }] };
  const report = templates.generateTemplateReport(a, custom, [...defs, d], []), id = versionMetricIds(report.sections[0].versions[0])[0];
  assert.equal(report.analysis.metrics[id].value, a.current.filter(o => o.category === '行道树').length);
  assert.equal(report.analysis.metrics[id].definitionVersion, 3);
  const changedDefinition = { ...d, category: '教育', version: 4 };
  const changed = templates.generateTemplateReport(a, custom, [...defs, changedDefinition], []);
  const changedId = versionMetricIds(changed.sections[0].versions[0])[0];
  assert.equal(changed.analysis.metrics[changedId].value, a.current.filter(o => o.category === '教育').length);
  assert.notEqual(changedId, id);
  custom.blocks[0].body = '不存在{{BAD-ID}}'; assert.throws(() => templates.validateTemplate(custom, defs), /不存在/);
});
test('热点事件与群众热议均按主题归集且不限定点位，自定义关键词取交集且可以零结果', () => {
  const themes = templates.recommendThemes(a);
  const events = themes.filter(t => t.group === '热点事件');
  assert.ok(events.length > 0);
  events.forEach(t => {
    assert.equal(t.filter.point, undefined);
    assert.equal(t.name, `${t.filter.category}相关诉求`);
    assert.equal(t.count, a.current.filter(o => o.category === t.filter.category).length);
    assert.equal(t.count, themes.find(other => other.group === '群众热议' && other.filter.category === t.filter.category).count);
  });
  assert.ok(themes.some(t => t.group === '群众热议' && !t.filter.point));
  const theme = { id: 'custom', name: '树木遮挡', group: '群众热议', filter: { category: '行道树', keyword: '遮挡' }, custom: true };
  templates.validateTheme(theme, themes);
  const found = templates.recommendThemes(a, [theme]).find(t => t.id === 'custom');
  assert.equal(found.count, a.current.filter(o => o.category === '行道树' && o.description.includes('遮挡')).length);
  assert.ok(found.count > 0);
  assert.throws(() => templates.validateTheme({ ...theme, filter: {} }, []), /至少/);
  const none = { ...theme, id: 'none', filter: { keyword: '完全不存在的关键词' } };
  assert.equal(templates.recommendThemes(a, [none]).find(t => t.id === 'none').count, 0);
  const zero = templates.generateTemplateReport(a, allTemplates.find(t => t.id === 'topic-standard'), defs, [none]);
  assert.ok(zero.sections.some(s => s.versions[0].paragraphs.some(p => engine.textOf(p, a).includes('暂无匹配'))));
});
test('导入模板可读，按编号更新与补入，统计、报告和异议指纹自动使用新数据', async () => {
  const wb = new ExcelJS.Workbook(); const sheet = wb.addWorksheet('工单明细'); sheet.addRow(imports.ORDER_COLUMNS);
  const existing = a.current.find(o => o.category !== '行道树');
  const modified = { ...existing, category: '行道树', description: '上传修改，树木遮挡', point: '七宝镇·静安新城片区道路' };
  const added = { ...modified, id: 'NEW-IMPORT-001' };
  const add = o => sheet.addRow([o.id, new Date(o.receivedAt.replace(' ', 'T') + 'Z'), o.channel, o.business, o.category, o.street, o.point, o.department, o.description]);
  add(modified); add(added);
  const rows = await imports.readOrderWorkbook(await wb.xlsx.writeBuffer());
  const merged = imports.mergeImportedOrders(source, rows); assert.equal(merged.updated, 1); assert.equal(merged.added, 1);
  assert.equal(source.find(o => o.id === modified.id).category, existing.category);
  const next = engine.analyze(allScope, merged.orders); next.dataRevision = 1;
  assert.equal(next.current.length, a.current.length + 1);
  const oldReport = templates.generateTemplateReport(a, allTemplates.find(t => t.id === 'weekly-standard'), defs, selected);
  const newReport = templates.generateTemplateReport(next, oldReport.templateSnapshot, oldReport.definitionSnapshot, oldReport.themes, 1);
  assert.equal(newReport.analysis.current.length, a.current.length + 1);
  const oldId = versionMetricIds(oldReport.sections[0].versions[0])[0], newId = versionMetricIds(newReport.sections[0].versions[0])[0];
  assert.notEqual(metricFingerprint(a, a.metrics[oldId]), metricFingerprint(next, next.metrics[newId]));
  assert.equal((await imports.readOrderWorkbook(await (await imports.createImportTemplate()).arrayBuffer())).length, 1);
});
test('Excel导入拒绝缺字段、重复编号、公式及无效日期，校验失败不改变来源', async () => {
  async function bytes(rows, header = imports.ORDER_COLUMNS) { const wb = new ExcelJS.Workbook(); const s = wb.addWorksheet('导入明细'); s.addRow(header); rows.forEach(r => s.addRow(r)); return wb.xlsx.writeBuffer(); }
  const row = ['TEST-1', '2026-04-20 09:00:00', '12345热线', '投诉求助', '教育', '七宝镇', '学校', '城运中心', '模拟诉求'];
  await assert.rejects(imports.readOrderWorkbook(await bytes([row, row])), /重复/);
  await assert.rejects(imports.readOrderWorkbook(await bytes([[row[0]]], ['唯一工单编号'])), /缺少/);
  await assert.rejects(imports.readOrderWorkbook(await bytes([[...row.slice(0, 1), '2026-04-31 09:00:00', ...row.slice(2)]])), /时间无效/);
  await assert.rejects(imports.readOrderWorkbook(await bytes([[{ formula: '1+1', result: 2 }, ...row.slice(1)]])), /不能使用公式/);
});
test('自定义关键词和固定渠道的Excel公式与报告值一致，导出明细可重新导入', async () => {
  const d = { ...defs[0], id: 'test-share', code: 'TEST-SHARE', name: '热线树木占比', kind: 'share', category: '行道树', channel: '12345热线' };
  const token = templates.registerDefinitionMetric(a, d, { keyword: '遮挡' }), metric = a.metrics[token.metricId];
  const n = a.current.filter(o => engine.matches(o, metric.filter)).length, denom = a.current.filter(o => o.channel === '12345热线').length;
  assert.equal(metric.value, n / denom);
  const blob = await exporter.createEvidenceWorkbook(a, metric), wb = new ExcelJS.Workbook(); await wb.xlsx.load(await blob.arrayBuffer());
  assert.equal(wb.getWorksheet('汇总核验').getCell('B7').value.result, metric.value);
  assert.ok(wb.getWorksheet('本期明细').getCell('K2').value.formula.includes('SEARCH'));
  assert.ok(wb.getWorksheet('本期明细').getCell('J2').value.formula.includes('C2='));
  assert.equal((await imports.readOrderWorkbook(await blob.arrayBuffer())).length, a.current.length + a.previous.length);
});
test('报告Word沿用参考周报的刊头、仿宋正文和页面尺寸，保留当前改写', async () => {
  const report = templates.generateTemplateReport(a, allTemplates.find(t => t.id === 'weekly-standard'), defs, selected);
  const section = report.sections[1];
  const original = section.versions[0], candidate = templates.buildRecipeVersion(a, section.recipe, 2, ['精简表达', '加强建议']);
  const originalIds = versionMetricIds(original); section.versions.push(candidate); section.active = 1;
  originalIds.forEach(id => { const m = a.metrics[id]; assert.equal(m.numerator, (m.period === 'previous' ? a.previous : a.current).filter(o => engine.matches(o, m.filter)).length); });
  const blob = await exporter.createWord(report), zip = await require('jszip').loadAsync(await blob.arrayBuffer()), xml = await zip.file('word/document.xml').async('string');
  assert.ok(xml.includes('闵行区城市运行管理中心')); assert.ok(xml.includes('FF0000')); assert.ok(xml.includes('闵行区城运工单分析')); assert.ok(xml.includes('华文行楷')); assert.ok(xml.includes('仿宋_GB2312')); assert.ok(xml.includes('w:top="2098"')); assert.ok(xml.includes('w:firstLine="640"'));  assert.ok(xml.includes('w:pBdr')); assert.ok(xml.includes('进一步落实'));
  assert.ok(!xml.includes('确认文字')); assert.ok(!xml.includes('提交异议'));
  await fs.mkdir(path.join(__dirname, '../.qa/artifacts'), { recursive: true });
  await fs.writeFile(path.join(__dirname, '../.qa/artifacts/城运红头周报.docx'), Buffer.from(await blob.arrayBuffer()));
});


test('自定义主题跨分类识别同义表达，忽略分类标签并排除否定描述', () => {
  const { compileThemeRule, themeMatch, themeMatchReason } = require('../.qa/themeMatching.js');
  const rule = compileThemeRule('公共场所吸烟');
  const base = a.current[0];
  const cases = [
    { ...base, id: 'semantic-1', category: '物业管理', point: '居民楼电梯厅', description: '有人抽烟，二手烟影响居民' },
    { ...base, id: 'semantic-2', category: '公共设施', point: '公共大厅', description: '公共场合存在明显烟味' },
    { ...base, id: 'semantic-3', category: '公共区域吸烟', point: '街边', description: '灯具损坏，需要维修' },
    { ...base, id: 'semantic-4', category: '物业管理', point: '公共大厅', description: '巡查未发现吸烟' },
    { ...base, id: 'semantic-5', point: '私人房间', description: '有人抽烟' },
  ];
  assert.deepEqual(cases.map(o => themeMatch(rule, o)), [true, true, false, false, false]);
  assert.match(themeMatchReason(rule, cases[0]), /抽烟/);
  const theme = { id: 'semantic', name: rule.topic, group: '群众热议', custom: true, filter: { semantic: rule } };
  templates.validateTheme(theme, []);
  const mini = engine.analyze(allScope, cases);
  const metricId = engine.registerMetric(mini, 'count', theme.filter).metricId;
  assert.equal(mini.metrics[metricId].value, 2);
  assert.ok(a.current.filter(o => engine.matches(o, theme.filter)).some(o => o.category !== '公共区域吸烟'));
  const unknown = compileThemeRule('未收录的特殊诉求');
  assert.equal(unknown.expanded, false);
  assert.equal(themeMatch(unknown, cases[0]), false);
  assert.equal(themeMatch(compileThemeRule('公共场所跳舞'), cases[0]), false);
});

test('同一Tab的自定义与推荐选题互斥，切换保留另一个Tab选择，生成拒绝混合', () => {
  const events = templates.recommendThemes(a).filter(t => t.group === '热点事件').slice(0, 2);
  const discussion = templates.recommendThemes(a).find(t => t.group === '群众热议');
  const custom = { id: 'only-custom', name: '公共场所吸烟', group: '热点事件', custom: true, filter: { semantic: require('../.qa/themeMatching.js').compileThemeRule('公共场所吸烟') } };
  const themes = [...events, discussion, custom];
  const toCustom = templates.selectThemeMode([events[0].id, events[1].id, discussion.id], themes, '热点事件', 'custom');
  assert.deepEqual(toCustom, [discussion.id, custom.id]);
  assert.deepEqual(templates.selectThemeMode(toCustom, themes, '热点事件', 'recommended'), [discussion.id, events[0].id]);
  assert.throws(() => templates.generateTemplateReport(a, allTemplates[0], defs, [events[0], custom]), /互斥/);
});

test('主题识别的Excel逐行公式与命中依据保留同义组、否定规则与真实数值', async () => {
  const { compileThemeRule } = require('../.qa/themeMatching.js');
  const row = { ...a.current[0], category: '物业管理', description: '电梯厅有人抽烟', point: '居民楼电梯厅' };
  const mini = engine.analyze(allScope, [row]);
  const id = engine.registerMetric(mini, 'count', { semantic: compileThemeRule('公共场所吸烟') }).metricId;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await (await exporter.createEvidenceWorkbook(mini, mini.metrics[id])).arrayBuffer());
  const sheet = wb.getWorksheet('本期明细');
  assert.equal(sheet.getCell('K2').value.result, 1);
  assert.match(sheet.getCell('K2').value.formula, /OR\(/);
  assert.match(sheet.getCell('K2').value.formula, /NOT\(/);
  assert.match(sheet.getCell('K2').value.formula, /抽烟/);
  assert.match(sheet.getCell('L2').value, /抽烟/);
});


test('报告研判按所选段落同口径比较两期工单，点位数字能回溯且不改报告', () => {
  const { insightContexts, buildInsight } = require('../.qa/reportInsight.js');
  const base = source[0];
  const rows = [];
  for (const [date, point, count] of [['2026-04-20', '点位甲', 20], ['2026-04-20', '点位乙', 5], ['2026-04-13', '点位甲', 2], ['2026-04-13', '点位乙', 3]]) {
    for (let i = 0; i < count; i++) rows.push({ ...base, id: `${date}-${point}-${i}`, category: '行道树', business: '投诉求助', point, receivedAt: date + ' 10:00:00' });
  }
  rows.push({ ...rows[0], id: 'unrelated', category: '教育', point: '点位甲' });
  const theme = { id: 'insight-tree', name: '行道树相关诉求', group: '热点事件', filter: { category: '行道树' } };
  const report = templates.generateTemplateReport(engine.analyze(allScope, rows), allTemplates.find(t => t.id === 'weekly-standard'), defs, [theme]);
  const before = JSON.stringify(report.sections);
  const context = insightContexts(report).find(c => c.section.includes('行道树') && c.paragraph === 1);
  assert.equal(context.ambiguous, false);
  const answer = buildInsight(report, context, '为什么增长这么多？');
  const text = answer.blocks.map(b => engine.textOf(b.tokens, report.analysis)).join('\n');
  assert.match(text, /25件/); assert.match(text, /5件/); assert.match(text, /400.0%/); assert.match(text, /小基数/);
  assert.match(text, /无法单凭工单数量确定现实原因/);
  const point = answer.blocks.find(b => b.title === '点位甲');
  assert.match(engine.textOf(point.tokens, report.analysis), /上期2件 → 本期20件/);
  point.tokens.filter(t => typeof t !== 'string').forEach(t => {
    const metric = report.analysis.metrics[t.metricId];
    assert.equal(metric.filter.category, '行道树'); assert.equal(metric.filter.point, '点位甲');
    assert.equal(metric.value, (metric.period === 'current' ? report.analysis.current : report.analysis.previous).filter(o => engine.matches(o, metric.filter)).length);
  });
  assert.equal(JSON.stringify(report.sections), before);
  assert.equal(buildInsight(report, context, '继续展开', 'points').intent, 'points');
  assert.match(buildInsight(report, context, '帮我写一首诗').blocks[0].title, /研判方向/);
  assert.throws(() => buildInsight(report, { ...context, text: '已经变动' }, '分析'), /变化/);
});

test('研判对零基数、零工单、不完整比较期及持平不作虚假增长判断', () => {
  const { insightContexts, buildInsight } = require('../.qa/reportInsight.js');
  const theme = { id: 'insight-edge', name: '主题', group: '群众热议', filter: { category: '行道树' } };
  const row = { ...source[0], category: '行道树', point: '点位甲', receivedAt: '2026-04-20 10:00:00' };
  function answer(rows, complete = true) {
    const a = engine.analyze(allScope, rows); a.comparisonComplete = complete;
    const report = templates.generateTemplateReport(a, allTemplates.find(t => t.id === 'weekly-standard'), defs, [theme]);
    const context = insightContexts(report).find(c => c.section.includes('主题') && c.paragraph === 1);
    return buildInsight(report, context, '为什么增长这么多').blocks.map(b => b.title + engine.textOf(b.tokens, a)).join('\n');
  }
  assert.match(answer([row]), /上期为零，不能计算增长率/);
  assert.match(answer([]), /两期均无匹配记录/);
  assert.match(answer([row], false), /比较期覆盖不完整/);
  assert.match(answer([row, { ...row, id: 'old-row', receivedAt: '2026-04-13 10:00:00' }]), /总量持平/);
});

test('研判拒绝多口径段落的模糊归因，并保留原文及版本定位', () => {
  const { insightContexts, buildInsight } = require('../.qa/reportInsight.js');
  const custom = { ...allTemplates.find(t => t.id === 'weekly-standard'), blocks: [{ id: 'mixed', kind: 'custom', title: '混合口径', body: '工单{{MH-001}}件，表扬{{MH-007}}件。', bindings: {} }] };
  const report = templates.generateTemplateReport(engine.analyze(allScope), custom, defs, []);
  const context = insightContexts(report)[0];
  assert.equal(context.ambiguous, true);
  assert.equal(context.version, 1); assert.equal(context.paragraph, 1);
  assert.match(buildInsight(report, context, '分析增长').blocks[0].title, /明确统计口径/);
});
