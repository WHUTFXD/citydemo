import { createEvidenceWorkbook, type FilteredExport } from '../lib/weeklyReportExport';
import type { Analysis, Metric } from '../lib/weeklyReport';

const worker = self as unknown as {
  onmessage: ((event: MessageEvent<{ analysis: Analysis; metric: Metric; filtered?: FilteredExport }>) => void) | null;
  postMessage: (value: { blob?: Blob; error?: string }) => void;
};
worker.onmessage = async event => {
  try {
    const { analysis, metric, filtered } = event.data;
    worker.postMessage({ blob: await createEvidenceWorkbook(analysis, metric, filtered) });
  } catch { worker.postMessage({ error: 'Excel导出失败，请重试' }); }
};
