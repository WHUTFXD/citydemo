import { REPORT_COMPILER } from '@/lib/reportDocumentStyle';

export default function ReportDocumentHeader({ masthead, issue, cutoff }: { masthead: string; issue: string; cutoff: string }) {
  return <div className="report-document-header"><div className="report-redhead"><span>{masthead}</span></div><div className="report-issue">{issue}</div><div className="report-publication-line"><span>{REPORT_COMPILER}</span><span>{cutoff}</span></div></div>;
}
