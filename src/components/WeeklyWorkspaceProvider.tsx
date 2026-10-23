'use client';

import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { analyze, shiftDate, type DataCoverage, type Order, type Analysis, type Metric, type Report, type Scope } from '@/lib/weeklyReport';
import { handleMetricDispute, submitMetricDispute, type MetricDispute, type DisputeStatus } from '@/lib/metricDisputes';
import { defaultReportTemplates, restoreReportTemplates, saveReportTemplate, generateTemplateReport, type ReportTemplate, type ReportType, type ReportTheme, type ThemeGroup } from '@/lib/reportTemplates';
import { getTrialSampleOrders, TRIAL_COVERAGE, TRIAL_SCOPE } from '@/lib/trialData';
import { mergeImportedOrders } from '@/lib/reportDataImport';
import { defaultIndicatorDefinitions, restoreIndicatorDefinitions, saveIndicatorDefinition, type IndicatorDefinition, type IndicatorInput } from '@/lib/indicatorDefinitions';

export const DEFAULT_WEEKLY_SCOPE: Scope = TRIAL_SCOPE;
type Setter<T> = Dispatch<SetStateAction<T>>;
type Workspace = {
  coverage: DataCoverage; datasetName: string; dataKind: 'sample' | 'imported' | 'mixed'; replaceOrders: (orders: Order[], name: string) => void; resetSample: () => void;
  identity: { name: string; role: string } | undefined; setIdentity: Setter<{ name: string; role: string } | undefined>;
  topicSource: 'recommended' | 'custom'; setTopicSource: Setter<'recommended' | 'custom'>; taxonomy: 'city' | 'district'; setTaxonomy: Setter<'city' | 'district'>;
  scope: Scope; setScope: Setter<Scope>; analysis: Analysis | undefined; setAnalysis: Setter<Analysis | undefined>;
  report: Report | undefined; setReport: Setter<Report | undefined>;
  reportType: ReportType; setReportType: Setter<ReportType>; templateId: string; setTemplateId: Setter<string>;
  templates: ReportTemplate[]; saveTemplate: (template: ReportTemplate) => void; deleteTemplate: (id: string) => void;
  themeModes: Record<ThemeGroup, 'recommended' | 'custom'>; setThemeModes: Setter<Record<ThemeGroup, 'recommended' | 'custom'>>;
  customThemes: ReportTheme[]; setCustomThemes: Setter<ReportTheme[]>; selectedThemeIds: string[]; setSelectedThemeIds: Setter<string[]>;
  sourceOrders: Order[] | undefined; dataRevision: number; importOrders: (orders: Order[]) => { updated: number; added: number };
  disputes: MetricDispute[];
  submitDispute: (a: Analysis, m: Metric, reason: string) => void;
  handleDispute: (id: string, status: DisputeStatus, response: string) => void;
  storageReady: boolean; storageAvailable: boolean;
  definitions: IndicatorDefinition[]; saveDefinition: (input: IndicatorInput, editingId?: string) => void;
};
const Context = createContext<Workspace | undefined>(undefined);
const TEMPLATES_KEY = 'minhang.report-templates.v1';
const DEFINITIONS_KEY = 'minhang.indicator-definitions.v1';
export function WeeklyWorkspaceProvider({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<{ name: string; role: string }>();
  const [topicSource, setTopicSource] = useState<'recommended' | 'custom'>('recommended');
  const [taxonomy, setTaxonomy] = useState<'city' | 'district'>('city');
  const [coverage, setCoverage] = useState<DataCoverage>(TRIAL_COVERAGE);
  const [datasetName, setDatasetName] = useState('全渠道工单样例');
  const [dataKind, setDataKind] = useState<'sample' | 'imported' | 'mixed'>('sample');
  const [reportType, setReportType] = useState<ReportType>('weekly');
  const [templateId, setTemplateId] = useState('weekly-standard');
  const [templates, setTemplates] = useState<ReportTemplate[]>(defaultReportTemplates);
  const [themeModes, setThemeModes] = useState<Record<ThemeGroup, 'recommended' | 'custom'>>({ '热点事件': 'recommended', '群众热议': 'recommended' });
  const [customThemes, setCustomThemes] = useState<ReportTheme[]>([]);
  const [selectedThemeIds, setSelectedThemeIds] = useState<string[]>([]);
  const [sourceOrders, setSourceOrders] = useState<Order[]>();
  const [dataRevision, setDataRevision] = useState(0);
  const [scope, setScope] = useState<Scope>(DEFAULT_WEEKLY_SCOPE);
  const [analysis, setAnalysis] = useState<Analysis>();
  const [report, setReport] = useState<Report>();
  const [disputes, setDisputes] = useState<MetricDispute[]>([]);
  const [storageReady, setStorageReady] = useState(false);
  const [storageAvailable, setStorageAvailable] = useState(true);
  const [definitions, setDefinitions] = useState<IndicatorDefinition[]>(defaultIndicatorDefinitions);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        localStorage.removeItem('minhang.metric-disputes.v1');
        setDefinitions(restoreIndicatorDefinitions(localStorage.getItem(DEFINITIONS_KEY)));
        setTemplates(restoreReportTemplates(localStorage.getItem(TEMPLATES_KEY)));
      } catch { setStorageAvailable(false); }
      setStorageReady(true);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!storageReady) return;
    try { localStorage.setItem(DEFINITIONS_KEY, JSON.stringify(definitions)); } catch { queueMicrotask(() => setStorageAvailable(false)); }
  }, [definitions, storageReady]);
  useEffect(() => {
    if (!storageReady) return;
    try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates)); } catch { queueMicrotask(() => setStorageAvailable(false)); }
  }, [templates, storageReady]);
  const saveTemplate = (template: ReportTemplate) => setTemplates(saveReportTemplate(templates, template, definitions));
  const deleteTemplate = (id: string) => setTemplates(items => items.filter(t => t.id !== id));
  const importOrders = (rows: Order[]) => {
    const merged = mergeImportedOrders(sourceOrders || getTrialSampleOrders(), rows);
    const revision = dataRevision + 1;
    const dates = merged.orders.map(o => o.receivedAt.slice(0, 10)).sort();
    const nextCoverage = { start: dates[0], end: dates.at(-1)!, maxDays: 366 };
    const next = analyze(scope, merged.orders, nextCoverage);
    next.dataKind = dataKind === 'sample' ? 'mixed' : dataKind;
    next.dataLabel = dataKind === 'sample' ? '模拟工单与导入明细混合' : datasetName;
    next.dataRevision = revision;
    let nextReport: Report | undefined;
    // Regenerate from the adopted template snapshot; imported data must not retain stale prose or metric tokens.
    if (report?.templateSnapshot && report.definitionSnapshot) nextReport = { ...generateTemplateReport(next, report.templateSnapshot, report.definitionSnapshot, report.themes || [], revision), cadence: report.cadence };
    setCoverage(nextCoverage); if (dataKind === 'sample') { setDataKind('mixed'); setDatasetName('样例工单与上传明细'); }
    setSourceOrders(merged.orders); setDataRevision(revision); setAnalysis(next); setReport(nextReport);
    return { updated: merged.updated, added: merged.added };
  };
  const replaceOrders = (rows: Order[], name: string) => {
    if (!rows.length) throw new Error('导入的数据集不能为空');
    const unique = [...new Map(rows.map(o => [o.id, o])).values()];
    const dates = unique.map(o => o.receivedAt.slice(0, 10)).sort();
    const end = dates.at(-1)!, start = shiftDate(end, -6) < dates[0] ? dates[0] : shiftDate(end, -6);
    setSourceOrders(unique); setCoverage({ start: dates[0], end, maxDays: 366 }); setDatasetName(name); setDataKind('imported'); setDataRevision(r => r + 1);
    setScope({ start, end, channel: '全渠道' }); setAnalysis(undefined); setReport(undefined); setCustomThemes([]); setSelectedThemeIds([]);
  };
  const resetSample = () => {
    setSourceOrders(undefined); setCoverage(TRIAL_COVERAGE); setDatasetName('全渠道工单样例'); setDataKind('sample'); setDataRevision(r => r + 1);
    setScope(DEFAULT_WEEKLY_SCOPE); setAnalysis(undefined); setReport(undefined); setCustomThemes([]); setSelectedThemeIds([]);
  };
  const submitDispute = (a: Analysis, m: Metric, reason: string) => {
    const next = submitMetricDispute(disputes, a, m, reason, crypto.randomUUID());
    setDisputes(next);
  };
  const handleDispute = (id: string, status: DisputeStatus, response: string) => {
    setDisputes(handleMetricDispute(disputes, id, status, response));
  };
  const saveDefinition = (input: IndicatorInput, editingId?: string) => {
    const next = saveIndicatorDefinition(definitions, input, editingId);
    setDefinitions(next);
  };
  return <Context.Provider value={{ coverage, datasetName, dataKind, replaceOrders, resetSample, identity, setIdentity, topicSource, setTopicSource, taxonomy, setTaxonomy, reportType, setReportType, templateId, setTemplateId, templates, saveTemplate, deleteTemplate, themeModes, setThemeModes, customThemes, setCustomThemes, selectedThemeIds, setSelectedThemeIds, sourceOrders, dataRevision, importOrders, scope, setScope, analysis, setAnalysis, report, setReport, disputes, submitDispute, handleDispute, storageReady, storageAvailable, definitions, saveDefinition }}>{children}</Context.Provider>;
}
export function useWeeklyWorkspace() { const context = useContext(Context); if (!context) throw new Error('Missing WeeklyWorkspaceProvider'); return context; }
