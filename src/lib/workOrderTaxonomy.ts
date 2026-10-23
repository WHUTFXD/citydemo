import type { Order } from './weeklyReport';

// Demonstration labels only. Imported trial data keeps the classifications supplied in the file.
const CITY_PATHS: Record<string, string> = {
  教育: '公共服务 / 教育服务 / 基础教育 / 入学招生',
  市容市貌: '城市管理 / 市容环境 / 经营秩序 / 占道经营',
  行道树: '城市管理 / 绿化管理 / 绿化养护 / 行道树养护',
  公共区域吸烟: '公共卫生 / 健康管理 / 控烟管理 / 公共场所吸烟',
  物业管理: '房屋管理 / 住宅管理 / 物业服务 / 小区公共管理',
  噪声扰民: '生态环境 / 污染防治 / 噪声管理 / 社会生活噪声',
  交通出行: '交通管理 / 道路交通 / 通行管理 / 出行秩序',
  公共设施: '城市管理 / 公共设施 / 设施养护 / 设施维修',
  公建配套: '公共服务 / 社区服务 / 公建配套 / 社区助餐',
};
export function sampleTaxonomy(order: Order, issue: string): Partial<Order> {
  return { cityCategory4: CITY_PATHS[order.category], districtCategory: order.category, districtSubcategory: issue, issueType: issue, scene: inferScene(order) };
}
export function inferScene(order: Pick<Order, 'point' | 'description'>): string {
  const text = order.point + ' ' + order.description;
  const scenes: [string, RegExp][] = [['餐饮场所', /餐厅|餐馆|饭店|餐饮/], ['电梯及电梯厅', /电梯/], ['楼道及入户厅', /楼道|入户厅/], ['社区食堂及助餐点', /社区食堂|长者食堂|老年食堂|助餐|配餐/], ['学校周边', /学校|小学|幼儿园|招生/], ['住宅小区', /小区|居民|住宅/], ['道路沿线', /道路|路沿线|行道树/], ['公共服务大厅', /大厅|公共服务|窗口/]];
  return scenes.find(([, rule]) => rule.test(text))?.[0] || '其他场景';
}
export const TAXONOMY_LABELS = { city: '市级四级分类', district: '区级案件小类' } as const;
export type TaxonomyMode = keyof typeof TAXONOMY_LABELS;
