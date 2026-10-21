import { readOrderWorkbook } from '../lib/reportDataImport';
self.onmessage = async (event: MessageEvent<ArrayBuffer>) => {
  try { self.postMessage({ rows: await readOrderWorkbook(event.data) }); }
  catch (error) { self.postMessage({ error: error instanceof Error ? error.message : '文件解析失败' }); }
};
