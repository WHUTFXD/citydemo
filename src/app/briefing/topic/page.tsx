import ReportWorkbench from '@/components/ReportWorkbench';
import '../../weekly-report/weekly-report.css';
export const metadata = { title: '智能简报 · 专题报' };
export default function Page() { return <ReportWorkbench mode="topic" />; }
