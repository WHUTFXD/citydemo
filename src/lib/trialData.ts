import { getMockOrders, shiftDate, type DataCoverage, type Order } from './weeklyReport';

export const TRIAL_COVERAGE: DataCoverage = { start: '2026-09-01', end: '2026-10-21', maxDays: 366 };
export const TRIAL_SCOPE = { start: '2026-10-15', end: '2026-10-21', channel: '全渠道' as const };
let sample: Order[] | undefined;
export function getTrialSampleOrders(): Order[] {
  if (sample) return sample;
  sample = getMockOrders().filter(o => o.receivedAt.slice(0, 10) <= '2026-04-20').map(order => {
    const date = shiftDate(order.receivedAt.slice(0, 10), 184);
    return { ...order, id: `TRIAL-${date.replaceAll('-', '')}-${order.id.split('-').at(-1)}`, receivedAt: date + order.receivedAt.slice(10) };
  });
  return sample;
}
