import { CATEGORIES, DATA_END, DATA_START, type Order } from './weeklyReport';

export const ORDER_COLUMNS = ['唯一工单编号', '受理时间（上海时间）', '渠道', '业务类型', '诉求分类', '街镇', '标准点位', '承办单位', '脱敏诉求摘要'];
const KEYS: (keyof Order)[] = ['id', 'receivedAt', 'channel', 'business', 'category', 'street', 'point', 'department', 'description'];
export function mergeImportedOrders(source: Order[], rows: Order[]) {
  const map = new Map(source.map(o => [o.id, o])); let updated = 0, added = 0;
  for (const row of rows) { if (map.has(row.id)) updated++; else added++; map.set(row.id, row); }
  return { orders: [...map.values()], updated, added };
}
export async function readOrderWorkbook(buffer: ArrayBuffer): Promise<Order[]> {
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook(); await wb.xlsx.load(buffer);
  const result: Order[] = [], ids = new Set<string>();
  const aliases = [ORDER_COLUMNS[0], '工单编号'];
  for (const sheet of wb.worksheets) {
    const headers = (sheet.getRow(1).values as unknown[]).map(v => String(v || '').trim());
    if (!headers.some(h => aliases.includes(h))) continue;
    const columns = ORDER_COLUMNS.map((h, i) => headers.findIndex(v => v === h || (i === 0 && v === '工单编号') || (i === 1 && v === '受理时间') || (i === 8 && ['诉求摘要', '脱敏摘要'].includes(v))));
    if (columns.some(i => i < 1)) throw new Error(`工作表“${sheet.name}”缺少必需字段，请使用工单导入模板或核验明细导出文件`);
    sheet.eachRow((row, index) => {
      if (index === 1 || !columns.some(c => row.getCell(c).value !== null)) return;
      if (result.length >= 150000) throw new Error('单次最多导入15万条工单');
      const values = columns.map((c, i) => {
        const v = row.getCell(c).value;
        if (v && typeof v === 'object' && !(v instanceof Date)) throw new Error(`“${sheet.name}”第${index}行的原始字段不能使用公式或富文本`);
        if (i === 1 && v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ');
        const text = String(v ?? '').trim();
        if (text.length > 3000) throw new Error(`“${sheet.name}”第${index}行字段过长`);
        return text;
      });
      const order = Object.fromEntries(KEYS.map((key, i) => [key, values[i]])) as Order;
      if (values.some(v => !v)) throw new Error(`“${sheet.name}”第${index}行存在空字段，请补全9项工单信息`);
      const date = order.receivedAt.slice(0, 10);
      const parsed = new Date(order.receivedAt.replace(' ', 'T') + '+08:00');
      if (!/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(order.receivedAt) || !Number.isFinite(parsed.getTime()) || new Date(parsed.getTime() + 8 * 3600000).toISOString().slice(0, 19).replace('T', ' ') !== order.receivedAt || date < DATA_START || date > DATA_END) throw new Error(`“${sheet.name}”第${index}行受理时间无效，演示支持2026年3—5月，格式为YYYY-MM-DD HH:mm:ss`);
      if (!CATEGORIES.includes(order.category)) throw new Error(`第${index}行诉求分类无效：${order.category}`);
      if (!['12345热线', '网格巡查', '其他渠道'].includes(order.channel) || !['投诉求助', '咨询', '表扬感谢'].includes(order.business)) throw new Error(`第${index}行渠道或业务类型无效`);
      if (ids.has(order.id)) throw new Error(`上传文件存在重复工单编号：${order.id}，请去重后重试`);
      ids.add(order.id); result.push(order);
    });
  }
  if (!result.length) throw new Error('未找到有效工单明细；请上传含9项必需字段的.xlsx文件');
  return result;
}
export async function createImportTemplate(): Promise<Blob> {
  const ExcelJS = await import('exceljs'); const wb = new ExcelJS.Workbook(), sheet = wb.addWorksheet('工单明细');
  sheet.addRow(ORDER_COLUMNS); sheet.addRow(['DEMO-IMPORT-001', new Date('2026-04-20T09:00:00Z'), '12345热线', '投诉求助', '行道树', '七宝镇', '七宝镇·静安新城片区道路', '七宝镇城运中心', '模拟市民反映枝叶遮挡采光，希望修剪。']);
  sheet.getColumn(2).numFmt = 'yyyy-mm-dd hh:mm:ss'; sheet.columns.forEach(c => { c.width = 26; }); sheet.getColumn(9).width = 65;
  wb.addWorksheet('导入说明').addRows([['规则', '说明'], ['更新方式', '按唯一工单编号更新同号记录，新编号补入；不删除文件未包含的工单。'], ['时间范围', '演示支持2026年3—5月，时间为上海自然时间。'], ['必需字段', '请保留9列表头，不使用合并单元格或原始字段公式；可直接上传核验导出的本期/对比期明细。'], ['保存范围', '上传数据仅当前会话有效，刷新后恢复模拟数据。']]);
  return new Blob([new Uint8Array(await wb.xlsx.writeBuffer())], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
