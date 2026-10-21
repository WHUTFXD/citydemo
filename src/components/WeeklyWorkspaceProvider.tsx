'use client';

import { createContext, useContext, useEffect, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { analyze, getMockOrders, type Order, type Analysis, type Metric, type Report, type Scope } from '@/lib/weeklyReport';
import { handleMetricDispute, submitMetricDispute, type MetricDispute, type DisputeStatus } from '@/lib/metricDisputes';
import { defaultReportTemplates, restoreReportTemplates, saveReportTemplate, generateTemplateReport, type ReportTemplate, type ReportType, type ReportTheme, type ThemeGroup } from '@/lib/reportTemplates';
import { mergeImportedOrders } from '@/lib/reportDataImport';
import { defaultIndicatorDefinitions, restoreIndicatorDefinitions, saveIndicatorDefinition, type IndicatorDefinition, type IndicatorInput } from '@/lib/indicatorDefinitions';

export const DEFAULT_WEEKLY_SCOPE: Scope = { start: '2026-04-20', end: '2026-04-26', channel: '全渠道' };
type Setter<T> = Dispatch<SetStateAction<T>>;
type Workspace = {
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
    try {
      localStorage.removeItem('minhang.metric-disputes.v1');
    } catch { setStorageAvailable(false); }
    setStorageReady(true);
  }, []);
  useEffect(() => {
    try { setDefinitions(restoreIndicatorDefinitions(localStorage.getItem(DEFINITIONS_KEY))); setTemplates(restoreReportTemplates(localStorage.getItem(TEMPLATES_KEY))); }
    catch { setStorageAvailable(false); }
  }, []);
  useEffect(() => {
    if (!storageReady) return;
    try { localStorage.setItem(DEFINITIONS_KEY, JSON.stringify(definitions)); } catch { setStorageAvailable(false); }
  }, [definitions, storageReady]);
  useEffect(() => {
    if (!storageReady) return;
    try { localStorage.setItem(TEMPLATES_KEY, JSON.stringify(templates)); } catch { setStorageAvailable(false); }
  }, [templates, storageReady]);
  const saveTemplate = (template: ReportTemplate) => setTemplates(saveReportTemplate(templates, template, definitions));
  const deleteTemplate = (id: string) => setTemplates(items => items.filter(t => t.id !== id));
  const importOrders = (rows: Order[]) => {
    const merged = mergeImportedOrders(sourceOrders || getMockOrders(), rows);
    const revision = dataRevision + 1;
    const next = analyze(scope, merged.orders);
    next.dataRevision = revision;
    let nextReport: Report | undefined;
    // Regenerate from the adopted template snapshot; imported data must not retain stale prose or metric tokens.
    if (report?.templateSnapshot && report.definitionSnapshot) nextReport = generateTemplateReport(next, report.templateSnapshot, report.definitionSnapshot, report.themes || [], revision);
    setSourceOrders(merged.orders); setDataRevision(revision); setAnalysis(next); setReport(nextReport);
    return { updated: merged.updated, added: merged.added };
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
  return <Context.Provider value={{ reportType, setReportType, templateId, setTemplateId, templates, saveTemplate, deleteTemplate, themeModes, setThemeModes, customThemes, setCustomThemes, selectedThemeIds, setSelectedThemeIds, sourceOrders, dataRevision, importOrders, scope, setScope, analysis, setAnalysis, report, setReport, disputes, submitDispute, handleDispute, storageReady, storageAvailable, definitions, saveDefinition }}>{children}</Context.Provider>;
}
export function useWeeklyWorkspace() { const context = useContext(Context); if (!context) throw new Error('Missing WeeklyWorkspaceProvider'); return context; }
