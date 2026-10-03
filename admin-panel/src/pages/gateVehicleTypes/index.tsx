import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  EditOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
  StopOutlined,
  TruckOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { CmStatCard } from "../../design-system/components/CmStatCard";
import { normalizeLanguageCode } from "../../config/languages";
import { usePermissions } from "../../authz/usePermissions";
import { fetchOrganisations } from "../../services/adminUsersApi";
import {
  createGateVehicleTypeUserCustom,
  editGateVehicleTypeUser,
  fetchGateVehicleTypesMaster,
  fetchGateVehicleTypesUser,
  importGateVehicleTypes,
  toggleGateVehicleTypeUser,
} from "../../services/gateApi";
import "./gateVehicleTypes.css";

const { Text } = Typography;

type StatusFlag = "Y" | "N";
type UserVehicleRow = {
  id: string;
  vehicle_type_code: string;
  display_label: string;
  label_i18n?: Record<string, string>;
  is_active: StatusFlag;
  mandi_id?: number | null;
  notes?: string | null;
  sort_order?: number | null;
  source_type?: string | null;
};
type MasterVehicleRow = { id: string; vehicle_type_code: string; name_i18n?: Record<string, string>; is_active?: StatusFlag };
type MandiOption = { mandi_id: number; label?: string; name_i18n?: Record<string, string>; mandi_slug?: string };
type OrgOption = { value: string; label: string };

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch { return null; }
}

export const GateVehicleTypes: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const { can, authContext, isSuper } = usePermissions();
  const canCreate = can("gate_vehicle_types_masters.create", "CREATE");
  const canEdit = can("gate_vehicle_types_masters.edit", "UPDATE");
  const canDeactivate = can("gate_vehicle_types_masters.deactivate", "DEACTIVATE");

  const [rows, setRows] = useState<UserVehicleRow[]>([]);
  const [mandis, setMandis] = useState<MandiOption[]>([]);
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string>(authContext.org_id || "");
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | StatusFlag>("ALL");
  const [mandiFilter, setMandiFilter] = useState<"ALL" | number>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0, custom: 0 });

  const [importOpen, setImportOpen] = useState(false);
  const [masterRows, setMasterRows] = useState<MasterVehicleRow[]>([]);
  const [masterSearch, setMasterSearch] = useState("");
  const [masterSelection, setMasterSelection] = useState<React.Key[]>([]);
  const [masterLoading, setMasterLoading] = useState(false);
  const [editRow, setEditRow] = useState<UserVehicleRow | null>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm] = Form.useForm();
  const [customForm] = Form.useForm();

  const scopedOrgId = isSuper ? selectedOrgId : (authContext.org_id || "");

  useEffect(() => {
    if (!isSuper) return;
    const username = currentUsername();
    if (!username) return;
    fetchOrganisations({ username, language }).then((resp: any) => {
      const list = resp?.response?.data?.organisations || resp?.data?.organisations || [];
      const opts = (Array.isArray(list) ? list : []).map((o: any) => ({
        value: String(o?._id || o?.org_id || ""),
        label: String(o?.org_name || o?.org_code || o?._id || "Organisation"),
      })).filter((o: OrgOption) => o.value);
      setOrgOptions(opts);
      if (!selectedOrgId && opts.length) setSelectedOrgId(opts[0].value);
    }).catch(() => setOrgOptions([]));
  }, [isSuper, language, selectedOrgId]);

  const loadUserData = useCallback(async () => {
    const username = currentUsername();
    if (!username || !scopedOrgId) return;
    setLoading(true);
    try {
      const payload: Record<string, any> = { username, language, page, pageSize, org_id: scopedOrgId };
      if (search.trim()) payload.q = search.trim();
      if (status !== "ALL") payload.is_active = status;
      if (mandiFilter !== "ALL") payload.mandi_id = mandiFilter;
      const resp: any = await fetchGateVehicleTypesUser(payload);
      if (resp?.response?.responsecode !== "0") {
        message.error(resp?.response?.description || "Unable to load vehicle types.");
        setRows([]);
        return;
      }
      const data = resp?.data || resp?.response?.data || {};
      const list = Array.isArray(data?.vehicle_types) ? data.vehicle_types : [];
      setRows(list.map((item: any, index: number) => ({
        id: String(item?._id || item?.id || `${item?.vehicle_type_code || "row"}-${index}`),
        vehicle_type_code: item?.vehicle_type_code || "",
        display_label: item?.display_label || item?.label_i18n?.[language] || item?.label_i18n?.en || item?.vehicle_type_code || "",
        label_i18n: item?.label_i18n || undefined,
        is_active: String(item?.is_active || "Y").toUpperCase() === "N" ? "N" : "Y",
        mandi_id: item?.mandi_id ?? 0,
        notes: item?.notes || "",
        sort_order: item?.sort_order ?? null,
        source_type: item?.source_type || (item?.master_vehicle_type_id ? "MASTER" : "CUSTOM"),
      })));
      setMandis(Array.isArray(data?.filters?.mandis) ? data.filters.mandis : []);
      setTotalCount(Number(data?.meta?.totalCount || list.length || 0));
      setSummary(data?.summary || {
        total: Number(data?.meta?.totalCount || list.length || 0),
        active: list.filter((x: any) => String(x?.is_active).toUpperCase() === "Y").length,
        inactive: list.filter((x: any) => String(x?.is_active).toUpperCase() === "N").length,
        custom: list.filter((x: any) => String(x?.source_type || "").toUpperCase() === "CUSTOM").length,
      });
    } finally { setLoading(false); }
  }, [language, mandiFilter, page, pageSize, scopedOrgId, search, status]);

  useEffect(() => { loadUserData(); }, [loadUserData]);

  const mandiOptions = useMemo(() => [
    { value: "ALL", label: "All Mandis" },
    ...mandis.map((m) => ({ value: m.mandi_id, label: m.label || m.name_i18n?.[language] || m.name_i18n?.en || m.mandi_slug || String(m.mandi_id) })),
  ], [language, mandis]);
  const mandiLookup = useMemo(() => new Map(mandiOptions.filter((x) => x.value !== "ALL").map((x) => [Number(x.value), x.label])), [mandiOptions]);

  const loadMaster = async () => {
    const username = currentUsername();
    if (!username || !scopedOrgId) return;
    setMasterLoading(true);
    try {
      const resp: any = await fetchGateVehicleTypesMaster({ username, language, org_id: scopedOrgId, page: 1, pageSize: 200, q: masterSearch.trim() || undefined, is_active: "Y" });
      const data = resp?.data || resp?.response?.data || {};
      setMasterRows((Array.isArray(data?.vehicle_types) ? data.vehicle_types : []).map((item: any, index: number) => ({
        id: String(item?._id || `${item?.vehicle_type_code || "master"}-${index}`),
        vehicle_type_code: item?.vehicle_type_code || "",
        name_i18n: item?.name_i18n || {},
        is_active: item?.is_active || "Y",
      })));
    } finally { setMasterLoading(false); }
  };

  useEffect(() => { if (importOpen) loadMaster(); }, [importOpen]);

  const handleImport = async () => {
    const username = currentUsername();
    if (!username || !scopedOrgId || !masterSelection.length) return;
    setSaving(true);
    try {
      const resp: any = await importGateVehicleTypes({ username, language, org_id: scopedOrgId, mandi_id: mandiFilter === "ALL" ? 0 : Number(mandiFilter), master_ids: masterSelection.map(String) });
      if (resp?.response?.responsecode !== "0") throw new Error(resp?.response?.description || "Import failed.");
      message.success("Vehicle types imported.");
      setImportOpen(false); setMasterSelection([]); await loadUserData();
    } catch (e: any) { message.error(e?.message || "Import failed."); }
    finally { setSaving(false); }
  };

  const handleCustomSave = async () => {
    const username = currentUsername();
    if (!username || !scopedOrgId) return;
    const values = await customForm.validateFields();
    setSaving(true);
    try {
      const resp: any = await createGateVehicleTypeUserCustom({ username, language, org_id: scopedOrgId, ...values, mandi_id: values.mandi_id === "ALL" ? 0 : Number(values.mandi_id), label_i18n: { en: values.label_en || values.display_label } });
      if (resp?.response?.responsecode !== "0") throw new Error(resp?.response?.description || "Create failed.");
      message.success("Vehicle type created."); customForm.resetFields(); setCustomOpen(false); await loadUserData();
    } catch (e: any) { if (e?.errorFields) return; message.error(e?.message || "Create failed."); }
    finally { setSaving(false); }
  };

  const handleEditSave = async () => {
    const username = currentUsername();
    if (!username || !editRow || !scopedOrgId) return;
    const values = await editForm.validateFields();
    setSaving(true);
    try {
      const resp: any = await editGateVehicleTypeUser({ username, language, org_id: scopedOrgId, id: editRow.id, ...values, label_i18n: values.label_en ? { en: values.label_en } : undefined });
      if (resp?.response?.responsecode !== "0") throw new Error(resp?.response?.description || "Update failed.");
      message.success("Vehicle type updated."); setEditRow(null); await loadUserData();
    } catch (e: any) { if (e?.errorFields) return; message.error(e?.message || "Update failed."); }
    finally { setSaving(false); }
  };

  const handleToggle = async (row: UserVehicleRow) => {
    const username = currentUsername();
    if (!username || !scopedOrgId) return;
    const next: StatusFlag = row.is_active === "Y" ? "N" : "Y";
    const resp: any = await toggleGateVehicleTypeUser({ username, language, org_id: scopedOrgId, id: row.id, is_active: next });
    if (resp?.response?.responsecode !== "0") return message.error(resp?.response?.description || "Status update failed.");
    message.success(next === "Y" ? "Vehicle type activated." : "Vehicle type deactivated.");
    await loadUserData();
  };

  const columns: ColumnsType<UserVehicleRow> = [
    { title: "Vehicle type", dataIndex: "display_label", key: "display_label", width: 300, render: (_, row) => <div className="cm-gvt-master-label"><strong>{row.display_label}</strong><span className="cm-gvt-code">{row.vehicle_type_code}</span></div> },
    { title: "Mandi scope", dataIndex: "mandi_id", key: "mandi_id", width: 180, render: (value) => Number(value || 0) === 0 ? <Tag>All Mandis</Tag> : (mandiLookup.get(Number(value)) || `Mandi ${value}`) },
    { title: "Source", dataIndex: "source_type", key: "source_type", width: 130, render: (value) => <Tag color={String(value).toUpperCase() === "CUSTOM" ? "gold" : "blue"}>{String(value || "MASTER").replace("_IMPORT", "")}</Tag> },
    { title: "Order", dataIndex: "sort_order", key: "sort_order", width: 90, render: (value) => value ?? "—" },
    { title: "Status", dataIndex: "is_active", key: "is_active", width: 120, render: (value) => value === "Y" ? <Tag className="cm-gvt-status-tag" color="success" icon={<CheckCircleOutlined />}>Active</Tag> : <Tag className="cm-gvt-status-tag" icon={<StopOutlined />}>Inactive</Tag> },
    { title: "Actions", key: "actions", width: 110, align: "right", render: (_, row) => <Space size={4}>{canEdit && <Tooltip title="Edit"><Button type="text" icon={<EditOutlined />} onClick={() => { setEditRow(row); editForm.setFieldsValue({ display_label: row.display_label, label_en: row.label_i18n?.en || "", sort_order: row.sort_order ?? undefined, notes: row.notes || "" }); }} /></Tooltip>}{canDeactivate && <Tooltip title={row.is_active === "Y" ? "Deactivate" : "Activate"}><Button type="text" danger={row.is_active === "Y"} icon={row.is_active === "Y" ? <StopOutlined /> : <CheckCircleOutlined />} onClick={() => handleToggle(row)} /></Tooltip>}</Space> },
  ];

  const pagination: TablePaginationConfig = { current: page, pageSize, total: totalCount, showSizeChanger: true, pageSizeOptions: [10, 25, 50, 100], showTotal: (n) => `${n} vehicle types`, onChange: (p, ps) => { setPage(p); setPageSize(ps); } };

  const selectedOrgLabel = isSuper ? (orgOptions.find((o) => o.value === selectedOrgId)?.label || "Select organisation") : (authContext.org_code || "Organisation");

  return <PageContainer className="cm-gate-vehicle-types-page">
    <CmPageHeader eyebrow="GATE MASTER DATA" title="Gate Vehicle Types" subtitle="Control the organisation vehicle-type catalogue used by gate entry, gate devices and operational validation." actions={<Button icon={<ReloadOutlined />} onClick={loadUserData}>Refresh</Button>} />

    <CmSectionCard compact className="cm-gvt-scope-card">
      <div className="cm-gvt-scope-row">
        <div className="cm-gvt-scope-copy"><Text type="secondary">WORKING SCOPE</Text><div><strong>{selectedOrgLabel}</strong></div><Text type="secondary">Vehicle types are organisation-controlled and can optionally apply to one mandi or all mandis.</Text></div>
        {isSuper ? <Select className="cm-gvt-scope-control" value={selectedOrgId || undefined} placeholder="Select organisation" options={orgOptions} showSearch optionFilterProp="label" onChange={(v) => { setSelectedOrgId(v); setMandiFilter("ALL"); setPage(1); }} /> : <Alert className="cm-gvt-scope-control" type="info" showIcon message="Organisation scope is fixed by your signed-in role." />}
      </div>
    </CmSectionCard>

    <div className="cm-gvt-stats">
      <CmStatCard label="Catalogue" value={summary.total} icon={<TruckOutlined />} helper="Configured vehicle types" />
      <CmStatCard label="Active" value={summary.active} icon={<CheckCircleOutlined />} helper="Available for gate operations" />
      <CmStatCard label="Inactive" value={summary.inactive} icon={<StopOutlined />} helper="Retained history" />
      <CmStatCard label="Custom" value={summary.custom} icon={<AppstoreOutlined />} helper="Organisation-created types" tone="amber" />
    </div>

    <CmSectionCard className="cm-gvt-table-card">
      <div className="cm-gvt-toolbar">
        <Input.Search className="cm-gvt-search" allowClear placeholder="Search vehicle type or code" value={search} onChange={(e) => setSearch(e.target.value)} onSearch={() => { setPage(1); loadUserData(); }} />
        <Select className="cm-gvt-select" value={status} options={[{ value: "ALL", label: "All statuses" }, { value: "Y", label: "Active" }, { value: "N", label: "Inactive" }]} onChange={(v) => { setStatus(v); setPage(1); }} />
        <Select className="cm-gvt-mandi-select" value={mandiFilter} options={mandiOptions} onChange={(v) => { setMandiFilter(v as any); setPage(1); }} />
        <span style={{ flex: 1 }} />
        {canCreate && <><Button icon={<PlusOutlined />} onClick={() => { customForm.setFieldsValue({ mandi_id: mandiFilter }); setCustomOpen(true); }}>Add custom</Button><Button type="primary" icon={<ImportOutlined />} onClick={() => { setImportOpen(true); setMasterSelection([]); }}>Import from master</Button></>}
      </div>
      <Table<UserVehicleRow> rowKey="id" columns={columns} dataSource={rows} loading={loading} pagination={pagination} scroll={{ x: 960 }} />
    </CmSectionCard>

    <Modal className="cm-gvt-modal" title="Import vehicle types" open={importOpen} onCancel={() => setImportOpen(false)} width={820} okText={`Import selected (${masterSelection.length})`} okButtonProps={{ disabled: !masterSelection.length, loading: saving }} onOk={handleImport}>
      <Space direction="vertical" size={12} style={{ width: "100%" }}>
        <Input.Search allowClear placeholder="Search protected master" value={masterSearch} onChange={(e) => setMasterSearch(e.target.value)} onSearch={loadMaster} />
        <Alert type="info" showIcon message="Imported master types stay traceable to the protected platform catalogue." />
        <Table<MasterVehicleRow> rowKey="id" size="small" loading={masterLoading} pagination={false} rowSelection={{ selectedRowKeys: masterSelection, onChange: setMasterSelection }} columns={[{ title: "Code", dataIndex: "vehicle_type_code", width: 180 }, { title: "Name", key: "name", render: (_, row) => row.name_i18n?.[language] || row.name_i18n?.en || row.vehicle_type_code }]} dataSource={masterRows} scroll={{ y: 420 }} />
      </Space>
    </Modal>

    <Modal className="cm-gvt-modal" title="Edit vehicle type" open={!!editRow} onCancel={() => setEditRow(null)} okText="Save changes" confirmLoading={saving} onOk={handleEditSave}>
      <Form form={editForm} layout="vertical"><Form.Item name="display_label" label="Display label" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="label_en" label="Label (English)"><Input /></Form.Item><Form.Item name="sort_order" label="Sort order"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item><Form.Item name="notes" label="Notes"><Input.TextArea rows={3} maxLength={500} showCount /></Form.Item></Form>
    </Modal>

    <Modal className="cm-gvt-modal" title="Add custom vehicle type" open={customOpen} onCancel={() => setCustomOpen(false)} okText="Create vehicle type" confirmLoading={saving} onOk={handleCustomSave}>
      <Form form={customForm} layout="vertical"><Alert type="info" showIcon message="Use custom only when the vehicle type does not exist in the protected master." style={{ marginBottom: 12 }} /><Form.Item name="display_label" label="Display label" rules={[{ required: true }]}><Input /></Form.Item><Form.Item name="label_en" label="Label (English)"><Input /></Form.Item><Form.Item name="mandi_id" label="Mandi scope" initialValue="ALL"><Select options={mandiOptions} /></Form.Item><Form.Item name="sort_order" label="Sort order"><InputNumber min={0} style={{ width: "100%" }} /></Form.Item><Form.Item name="notes" label="Notes"><Input.TextArea rows={3} maxLength={500} showCount /></Form.Item></Form>
    </Modal>
  </PageContainer>;
};
