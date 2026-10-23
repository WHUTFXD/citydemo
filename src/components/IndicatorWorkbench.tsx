'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Alert, App, Button, Descriptions, Drawer, Empty, Form, Input, Select, Segmented, Space, Switch, Table, Tag, Tooltip } from 'antd';
import { CopyOutlined, DatabaseOutlined, EditOutlined, FileTextOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import BriefingShell from './BriefingShell';
import { useWeeklyWorkspace } from './WeeklyWorkspaceProvider';
import IndicatorDisputes from './IndicatorDisputes';
import { isOpenDispute } from '@/lib/metricDisputes';
import { CATEGORIES } from '@/lib/weeklyReport';
import { definitionConditions, definitionFormula, INDICATOR_KINDS, indicatorUnit, nextIndicatorCode, type IndicatorDefinition, type IndicatorInput } from '@/lib/indicatorDefinitions';

const GROUPS = ['通用指标', ...CATEGORIES, '表扬感谢'];
const CHANNELS = [{ value: 'report', label: '随报表统计范围' }, { value: '12345热线', label: '仅12345热线' }, { value: '网格巡查', label: '仅网格巡查' }, { value: '其他渠道', label: '仅其他渠道' }];
export default function IndicatorWorkbench() {
  const { definitions, saveDefinition, storageReady, storageAvailable, disputes } = useWeeklyWorkspace();
  const { message } = App.useApp();
  const [tab, setTab] = useState('definitions');
  const [search, setSearch] = useState('');
  const [group, setGroup] = useState<string>();
  const [kind, setKind] = useState<string>();
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<{ id?: string }>();
  const [detail, setDetail] = useState<IndicatorDefinition>();
  const [form] = Form.useForm<IndicatorInput>();
  const watchedKind = Form.useWatch('kind', form) || 'count';
  const watchedPeriod = Form.useWatch('period', form) || 'current';
  const preview = { kind: watchedKind, period: watchedPeriod } as IndicatorInput;
  const filtered = definitions.filter(d => (!search.trim() || `${d.name} ${d.code} ${d.description}`.toLowerCase().includes(search.trim().toLowerCase())) && (!group || d.group === group) && (!kind || d.kind === kind) && (status === 'all' || (status === 'enabled' ? d.enabled : !d.enabled))).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.code.localeCompare(b.code));
  function openEditor(definition?: IndicatorDefinition, copy = false) {
    form.resetFields();
    form.setFieldsValue(definition ? { ...definition, ...(copy ? { code: nextIndicatorCode(definitions), name: `${definition.name}副本` } : {}) } : { code: nextIndicatorCode(definitions), name: '', group: '通用指标', kind: 'count', period: 'current', channel: 'report', enabled: true, description: '' });
    setEditor({ id: copy ? undefined : definition?.id });
    setDetail(undefined);
  }
  async function save() {
    try {
      const values = await form.validateFields();
      saveDefinition(values, editor?.id);
      message.success(editor?.id ? '指标口径已更新' : '指标已新增');
      setEditor(undefined); setPage(1); setSearch(''); setGroup(undefined); setKind(undefined); setStatus('all');
    } catch (error) { if (error instanceof Error) message.warning(error.message); }
  }
  function toggle(d: IndicatorDefinition) {
    try { saveDefinition({ ...d, enabled: !d.enabled }, d.id); message.success(d.enabled ? '指标已停用，定义仍保留' : '指标已启用'); }
    catch (error) { message.error((error as Error).message); }
  }
  return <BriefingShell><div className="weekly-workbench indicator-workbench"><header className="weekly-heading"><div className="flex items-center gap-3"><div className="weekly-heading-icon"><DatabaseOutlined /></div><div><h1>指标台</h1><p>维护统计口径，处理指标异议</p></div><Tag color="blue">口径维护</Tag></div><div className="indicator-header-actions"><Link href="/templates">模板管理</Link><Link href="/briefing" className="weekly-indicator-link"><FileTextOutlined /> 返回智能报告</Link><Button type="primary" icon={<PlusOutlined />} disabled={!storageReady} onClick={() => openEditor()}>新增指标</Button></div></header>
    <div className="indicator-content"><div style={{ marginBottom: 20 }}><Segmented aria-label="指标台工作区" value={tab} onChange={setTab} options={[{ label: '指标定义', value: 'definitions' }, { label: `异议申报（${disputes.filter(isOpenDispute).length} 待处理）`, value: 'disputes' }]} /></div>{tab === 'disputes' ? <IndicatorDisputes /> : <><div className="indicator-purpose"><DatabaseOutlined /><div><strong>先定义“怎么算”，再用于具体统计</strong><p>在这里维护计算方式、筛选条件和口径说明。具体数值、工单明细及数据核验仍在周报中查看。</p></div><span>本机保存</span></div>
      {!storageAvailable && <Alert type="warning" showIcon title="浏览器本地存储不可用，本次维护仅在当前会话中保留。" />}
      <section className="indicator-panel"><div className="indicator-panel-heading"><div><h2>指标定义</h2><p>统一统计口径，支持新增、编辑、复制与启停。</p></div><Segmented value={status} onChange={value => { setStatus(value); setPage(1); }} options={[{ value: 'all', label: '全部' }, { value: 'enabled', label: '已启用' }, { value: 'disabled', label: '已停用' }]} /></div>
        <div className="indicator-search"><Input aria-label="搜索指标定义" prefix={<SearchOutlined />} placeholder="搜索指标名称、编号或口径说明" value={search} allowClear onChange={e => { setSearch(e.target.value); setPage(1); }} /><Select aria-label="指标业务分组" value={group} allowClear placeholder="全部业务分组" onChange={value => { setGroup(value); setPage(1); }} options={GROUPS.map(value => ({ value, label: value }))} /><Select aria-label="指标计算方式" value={kind} allowClear placeholder="全部计算方式" onChange={value => { setKind(value); setPage(1); }} options={Object.entries(INDICATOR_KINDS).map(([value, label]) => ({ value, label }))} /></div>
        <Table<IndicatorDefinition> rowKey="id" size="middle" dataSource={filtered} loading={!storageReady} pagination={{ current: page, pageSize: 10, showSizeChanger: false, onChange: setPage, showTotal: total => `共 ${total} 项定义` }} scroll={{ x: 950 }} locale={{ emptyText: <Empty description="暂无符合条件的指标定义" /> }} columns={[
          { title: '指标名称 / 编号', key: 'name', width: 175, render: (_, d) => <div className="indicator-name"><Button type="link" onClick={() => setDetail(d)}>{d.name}</Button><small>{d.code}{d.builtin ? ' · 预置' : ' · 自建'}</small></div> },
          { title: '业务分组', dataIndex: 'group', width: 110 },
          { title: '计算方式 / 单位', key: 'kind', width: 110, render: (_, d) => <span>{INDICATOR_KINDS[d.kind]}<small className="indicator-unit">{indicatorUnit(d.kind)}</small></span> },
          { title: '统计口径', key: 'definition', width: 280, render: (_, d) => <div className="indicator-rule"><Tooltip title={d.description}><div>{d.description}</div></Tooltip><small>{definitionConditions(d)}</small></div> },
          { title: '启用状态', key: 'status', width: 75, render: (_, d) => <Tag color={d.enabled ? 'green' : 'default'}>{d.enabled ? '已启用' : '已停用'}</Tag> },
          { title: '版本', key: 'version', width: 55, render: (_, d) => <span className="weekly-muted">v{d.version}</span> },
          { title: '操作', key: 'action', width: 145, fixed: 'right', render: (_, d) => <Space size={0}><Button type="link" size="small" onClick={() => openEditor(d)}>编辑</Button><Button type="link" size="small" onClick={() => openEditor(d, true)}>复制</Button><Button type="link" size="small" onClick={() => toggle(d)}>{d.enabled ? '停用' : '启用'}</Button></Space> },
        ]} />
        <div className="indicator-footnote">此处保存指标定义，不执行统计计算；维护口径不会直接改写已生成的周报。定义保存在当前浏览器中。</div>
      </section></>}
    </div>
    <Drawer open={!!editor} onClose={() => setEditor(undefined)} title={editor?.id ? '编辑指标口径' : '新增指标'} size={680} className="indicator-definition-editor" footer={<div className="indicator-editor-footer"><span>保存后可在指标定义列表中继续维护</span><Space><Button onClick={() => setEditor(undefined)}>取消</Button><Button type="primary" onClick={save}>保存指标</Button></Space></div>}>
      <Form<IndicatorInput> form={form} layout="vertical" requiredMark="optional" onValuesChange={changed => { if (changed.kind === 'change') form.setFieldValue('period', 'current'); }}>
        <div className="indicator-form-section"><h3>基本信息</h3><div className="indicator-form-grid"><Form.Item name="name" label="指标名称" rules={[{ required: true, whitespace: true, message: '请输入指标名称' }]}><Input aria-label="指标名称" maxLength={40} placeholder="例如：行道树工单量" /></Form.Item><Form.Item name="code" label="指标编号" rules={[{ required: true, whitespace: true, message: '请输入指标编号' }]}><Input aria-label="指标编号" maxLength={32} disabled={!!editor?.id} placeholder="例如：MH-009" /></Form.Item><Form.Item name="group" label="业务分组" rules={[{ required: true, message: '请选择业务分组' }]}><Select aria-label="业务分组" options={GROUPS.map(value => ({ value, label: value }))} /></Form.Item><Form.Item name="enabled" label="启用状态" valuePropName="checked"><Switch aria-label="指标启用状态" checkedChildren="启用" unCheckedChildren="停用" /></Form.Item></div></div>
        <div className="indicator-form-section"><h3>计算规则</h3><div className="indicator-form-grid"><Form.Item name="kind" label="计算方式" rules={[{ required: true }]}><Select aria-label="计算方式" options={Object.entries(INDICATOR_KINDS).map(([value, label]) => ({ value, label }))} /></Form.Item><Form.Item label="指标单位"><Input aria-label="指标单位" value={indicatorUnit(watchedKind)} disabled /></Form.Item><Form.Item name="period" label="统计周期" rules={[{ required: true }]}><Select aria-label="统计周期" disabled={watchedKind === 'change'} options={[{ value: 'current', label: '本期' }, { value: 'previous', label: '上一等长周期' }]} /></Form.Item><Form.Item label="时间与去重规则"><Input value="受理时间 · 唯一工单编号去重" disabled /></Form.Item></div><div className="indicator-formula-preview"><span>计算公式</span><strong>{definitionFormula(preview)}</strong><small>日均与百分比保留一位小数；环比在上期为零或比较期不完整时不计算。</small></div></div>
        <div className="indicator-form-section"><h3>筛选条件</h3><div className="indicator-form-grid"><Form.Item name="channel" label="渠道规则" rules={[{ required: true }]}><Select aria-label="渠道规则" options={CHANNELS} /></Form.Item><Form.Item name="category" label="诉求分类"><Select aria-label="诉求分类" allowClear placeholder="不限分类" options={CATEGORIES.map(value => ({ value, label: value }))} /></Form.Item><Form.Item name="business" label="业务类型"><Select aria-label="业务类型" allowClear placeholder="不限业务类型" options={['投诉求助', '咨询', '表扬感谢'].map(value => ({ value, label: value }))} /></Form.Item><Form.Item name="point" label="标准点位" extra="留空表示不限，填写后按完整名称精确匹配。"><Input aria-label="标准点位" maxLength={100} placeholder="例如：七宝镇·静安新城片区道路" /></Form.Item></div></div>
        <Form.Item name="description" label="统计口径说明" rules={[{ required: true, whitespace: true, message: '请填写统计口径说明' }]}><Input.TextArea aria-label="统计口径说明" rows={4} maxLength={500} showCount placeholder="说明纳入统计的业务范围、排除条件及统计目的，便于后续统一使用。" /></Form.Item>
        <p className="indicator-form-help">本地演示支持工单量、日均量、占比和环比四种计算方式。这里只定义规则，具体统计日期在使用指标时确定。</p>
      </Form>
    </Drawer>
    <Drawer open={!!detail} title="指标口径详情" onClose={() => setDetail(undefined)} size={620} extra={detail && <Button icon={<EditOutlined />} onClick={() => openEditor(detail)}>编辑口径</Button>}>
      {detail && <><div className="indicator-detail-title"><h2>{detail.name}</h2><Tag color={detail.enabled ? 'green' : 'default'}>{detail.enabled ? '已启用' : '已停用'}</Tag></div><Descriptions bordered column={1} size="small" items={[
        { key: 'code', label: '指标编号', children: detail.code }, { key: 'group', label: '业务分组', children: detail.group },
        { key: 'kind', label: '计算方式 / 单位', children: `${INDICATOR_KINDS[detail.kind]} / ${indicatorUnit(detail.kind)}` },
        { key: 'formula', label: '计算公式', children: definitionFormula(detail) }, { key: 'conditions', label: '筛选条件', children: definitionConditions(detail) },
        { key: 'period', label: '统计周期', children: detail.period === 'current' ? '本期' : '上一等长周期' },
        { key: 'time', label: '时间规则', children: '按受理时间，上海时间完整自然日，起止日期均计入' },
        { key: 'dedup', label: '去重规则', children: '按唯一工单编号去重，每张工单计一次' },
        { key: 'description', label: '口径说明', children: detail.description }, { key: 'version', label: '定义版本', children: `v${detail.version}` },
        { key: 'updated', label: '最近修改', children: detail.updatedAt ? new Date(detail.updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) : '系统预置' },
      ]} /><Button style={{ marginTop: 18 }} icon={<CopyOutlined />} onClick={() => openEditor(detail, true)}>复制为新指标</Button></>}
    </Drawer>
  </div></BriefingShell>;
}
