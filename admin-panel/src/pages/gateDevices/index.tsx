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
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import {
  ApiOutlined,
  CheckCircleOutlined,
  EditOutlined,
  LinkOutlined,
  MobileOutlined,
  PlusOutlined,
  QrcodeOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
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
  createGateDevice,
  deactivateGateDevice,
  fetchGateDevicesBootstrap,
  generateGateDevicePairCode,
  updateGateDevice,
} from "../../services/gateApi";
import { formatBusinessDateTime } from "../../utils/formatters";
import "./gateDevices.css";

const { Text } = Typography;
type DeviceStatus = "ACTIVE" | "INACTIVE";
type ConfigField = { key: string; label: string; type: "TEXT" | "NUMBER" | "BOOLEAN"; default?: any };
type DeviceTypeMaster = {
  device_type_code: string;
  label: string;
  category?: string;
  icon_key?: string;
  default_capabilities?: string[];
  connection_types?: string[];
  provisioning_methods?: string[];
  platforms?: string[];
  config_fields?: ConfigField[];
};
type MandiOption = { mandi_id: number; label?: string; name_i18n?: Record<string, string>; mandi_slug?: string };
type GateOption = { _id: string; gate_code: string; name_i18n?: Record<string, string>; is_active?: string };
type OrgOption = { value: string; label: string };
type DeviceRow = {
  _id: string;
  device_code: string;
  device_label?: string | null;
  device_type: string;
  mandi_id: number;
  gate_id: string;
  gate_code?: string;
  status: DeviceStatus;
  platform?: string | null;
  hardware_id?: string | null;
  linked_user?: string | null;
  last_seen_on?: string | null;
  last_seen_ip?: string | null;
  meta?: {
    connection_type?: string | null;
    capabilities?: string[];
    manufacturer?: string | null;
    model?: string | null;
    serial_number?: string | null;
    firmware_version?: string | null;
    provisioning_method?: string | null;
    config?: Record<string, any>;
  };
};

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || localStorage.getItem("cm_username") || localStorage.getItem("cd_username");
  } catch {
    return localStorage.getItem("cm_username") || localStorage.getItem("cd_username");
  }
}
function normalizeCode(value: string) {
  return String(value || "").trim().toUpperCase().replace(/\s+/g, "_").replace(/[^A-Z0-9_-]/g, "_").replace(/_+/g, "_");
}
function healthOf(row: DeviceRow) {
  if (row.status === "INACTIVE") return { label: "Disabled", color: "default" as const };
  if (!row.last_seen_on) return { label: "Unpaired", color: "gold" as const };
  const age = Date.now() - new Date(row.last_seen_on).getTime();
  if (!Number.isFinite(age)) return { label: "Unknown", color: "default" as const };
  if (age <= 10 * 60 * 1000) return { label: "Online", color: "success" as const };
  if (age <= 60 * 60 * 1000) return { label: "Degraded", color: "warning" as const };
  return { label: "Offline", color: "error" as const };
}

const GateDevicesPage: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const { can, authContext, isSuper } = usePermissions();
  const canCreate = can("gate_devices.create", "CREATE");
  const canEdit = can("gate_devices.edit", "UPDATE");
  const canDeactivate = can("gate_devices.deactivate", "DEACTIVATE");

  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState(authContext.org_id || "");
  const scopedOrgId = isSuper ? selectedOrgId : (authContext.org_id || "");

  const [mandis, setMandis] = useState<MandiOption[]>([]);
  const [gates, setGates] = useState<GateOption[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<DeviceTypeMaster[]>([]);
  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [mandiId, setMandiId] = useState<number | undefined>();
  const [gateId, setGateId] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const [form] = Form.useForm();
  const [deviceModalOpen, setDeviceModalOpen] = useState(false);
  const [editing, setEditing] = useState<DeviceRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [pairing, setPairing] = useState<any>(null);
  const [pairingLoading, setPairingLoading] = useState(false);
  const selectedTypeCode = Form.useWatch("device_type", form);
  const selectedType = useMemo(() => deviceTypes.find((x) => x.device_type_code === selectedTypeCode), [deviceTypes, selectedTypeCode]);

  useEffect(() => {
    if (!isSuper) return;
    const username = currentUsername();
    if (!username) return;
    fetchOrganisations({ username, language }).then((resp: any) => {
      const list = resp?.response?.data?.organisations || resp?.data?.organisations || [];
      const opts = (Array.isArray(list) ? list : []).map((o: any) => ({ value: String(o?._id || o?.org_id || ""), label: String(o?.org_name || o?.org_code || o?._id || "Organisation") })).filter((x: OrgOption) => x.value);
      setOrgOptions(opts);
      if (!selectedOrgId && opts.length) setSelectedOrgId(opts[0].value);
    }).catch(() => setOrgOptions([]));
  }, [isSuper, language, selectedOrgId]);

  const load = useCallback(async () => {
    const username = currentUsername();
    if (!username || !scopedOrgId) return;
    setLoading(true);
    try {
      const resp: any = await fetchGateDevicesBootstrap({
        username,
        language,
        filters: {
          org_id: scopedOrgId,
          mandi_id: mandiId,
          gate_id: gateId,
          device_type: typeFilter,
          search: search.trim() || undefined,
          page,
          pageSize,
        },
      });
      if (!resp?.ok) {
        message.error(resp?.description || "Unable to load gate devices.");
        setRows([]); setTotal(0); return;
      }
      const data = resp?.data || {};
      setMandis(Array.isArray(data?.mandis?.items) ? data.mandis.items : []);
      setGates(Array.isArray(data?.gates?.items) ? data.gates.items : []);
      setDeviceTypes(Array.isArray(data?.device_types?.items) ? data.device_types.items.map((x: any) => typeof x === "string" ? { device_type_code: x, label: x.split("_").join(" ") } : x) : []);
      setRows(Array.isArray(data?.devices?.items) ? data.devices.items : []);
      setTotal(Number(data?.devices?.meta?.totalCount || 0));
    } finally { setLoading(false); }
  }, [gateId, language, mandiId, page, pageSize, scopedOrgId, search, typeFilter]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setGateId(undefined); setPage(1); }, [mandiId]);

  const mandiOptions = useMemo(() => mandis.map((m) => ({ value: Number(m.mandi_id), label: m.label || m.name_i18n?.[language] || m.name_i18n?.en || m.mandi_slug || String(m.mandi_id) })), [language, mandis]);
  const gateOptions = useMemo(() => gates.map((g) => ({ value: String(g._id), label: `${g.gate_code}${g.name_i18n?.[language] || g.name_i18n?.en ? ` · ${g.name_i18n?.[language] || g.name_i18n?.en}` : ""}` })), [gates, language]);
  const typeOptions = useMemo(() => deviceTypes.map((d) => ({ value: d.device_type_code, label: d.label || d.device_type_code })), [deviceTypes]);
  const typeLookup = useMemo(() => new Map(deviceTypes.map((d) => [d.device_type_code, d])), [deviceTypes]);

  const stats = useMemo(() => {
    const active = rows.filter((x) => x.status === "ACTIVE").length;
    const online = rows.filter((x) => healthOf(x).label === "Online").length;
    const unpaired = rows.filter((x) => healthOf(x).label === "Unpaired").length;
    return { visible: rows.length, active, online, unpaired };
  }, [rows]);

  const openAdd = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ mandi_id: mandiId, gate_id: gateId, status: "ACTIVE" });
    setDeviceModalOpen(true);
  };
  const openEdit = (row: DeviceRow) => {
    setEditing(row);
    form.setFieldsValue({
      mandi_id: row.mandi_id,
      gate_id: row.gate_id,
      device_code: row.device_code,
      device_label: row.device_label,
      device_type: row.device_type,
      status: row.status,
      platform: row.platform,
      hardware_id: row.hardware_id,
      linked_user: row.linked_user,
      connection_type: row.meta?.connection_type,
      capabilities: row.meta?.capabilities || [],
      manufacturer: row.meta?.manufacturer,
      model: row.meta?.model,
      serial_number: row.meta?.serial_number,
      firmware_version: row.meta?.firmware_version,
      provisioning_method: row.meta?.provisioning_method,
      ...(row.meta?.config || {}),
    });
    setDeviceModalOpen(true);
  };

  const handleTypeChange = (code: string) => {
    const master = typeLookup.get(code);
    if (!master) return;
    const configDefaults: Record<string, any> = {};
    (master.config_fields || []).forEach((f) => { if (f.default !== undefined) configDefaults[f.key] = f.default; });
    form.setFieldsValue({ capabilities: master.default_capabilities || [], connection_type: master.connection_types?.[0], provisioning_method: master.provisioning_methods?.[0], platform: master.platforms?.[0], ...configDefaults });
  };

  const save = async () => {
    const username = currentUsername();
    if (!username || !scopedOrgId) return;
    const values = await form.validateFields();
    const cfg: Record<string, any> = {};
    (selectedType?.config_fields || []).forEach((f) => { if (values[f.key] !== undefined) cfg[f.key] = values[f.key]; });
    const payload: Record<string, any> = {
      org_id: scopedOrgId,
      mandi_id: Number(values.mandi_id),
      gate_id: String(values.gate_id),
      device_code: editing ? editing.device_code : normalizeCode(values.device_code),
      device_label: values.device_label || undefined,
      device_type: values.device_type,
      status: values.status,
      platform: values.platform || undefined,
      hardware_id: values.hardware_id || undefined,
      linked_user: values.linked_user || undefined,
      meta: {
        connection_type: values.connection_type || null,
        capabilities: values.capabilities || [],
        manufacturer: values.manufacturer || null,
        model: values.model || null,
        serial_number: values.serial_number || null,
        firmware_version: values.firmware_version || null,
        provisioning_method: values.provisioning_method || null,
        config: cfg,
      },
    };
    setSaving(true);
    try {
      const resp: any = editing ? await updateGateDevice({ username, language, payload }) : await createGateDevice({ username, language, payload });
      if (!resp?.ok) throw new Error(resp?.description || "Unable to save device.");
      message.success(editing ? "Device updated." : "Device registered.");
      setDeviceModalOpen(false); await load();
    } catch (e: any) { message.error(e?.message || "Unable to save device."); }
    finally { setSaving(false); }
  };

  const toggleStatus = async (row: DeviceRow) => {
    const username = currentUsername(); if (!username || !scopedOrgId) return;
    const next = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const resp: any = next === "INACTIVE"
      ? await deactivateGateDevice({ username, language, device_code: row.device_code, org_id: scopedOrgId, mandi_id: row.mandi_id })
      : await updateGateDevice({ username, language, payload: { org_id: scopedOrgId, mandi_id: row.mandi_id, device_code: row.device_code, status: "ACTIVE" } });
    if (!resp?.ok) return message.error(resp?.description || "Unable to update device status.");
    message.success(next === "ACTIVE" ? "Device activated." : "Device disabled."); await load();
  };

  const pair = async (row: DeviceRow) => {
    const username = currentUsername(); if (!username) return;
    setPairingLoading(true);
    try {
      const resp: any = await generateGateDevicePairCode({ username, language, device_id: row._id, ttl_minutes: 10 });
      if (!resp?.ok) throw new Error(resp?.description || "Unable to create pairing code.");
      setPairing({ ...resp.data, label: row.device_label || row.device_code });
    } catch (e: any) { message.error(e?.message || "Unable to create pairing code."); }
    finally { setPairingLoading(false); }
  };

  const columns: ColumnsType<DeviceRow> = [
    { title: "Device", key: "device", width: 240, render: (_, row) => <div className="cm-gd-device"><strong>{row.device_label || row.device_code}</strong><span>{row.device_code}</span></div> },
    { title: "Type", dataIndex: "device_type", width: 190, render: (v) => <Tag icon={<ApiOutlined />}>{typeLookup.get(String(v))?.label || String(v).split("_").join(" ")}</Tag> },
    { title: "Gate", dataIndex: "gate_code", width: 120, render: (v) => v || "—" },
    { title: "Connection", key: "connection", width: 150, render: (_, row) => row.meta?.connection_type ? <Tag>{row.meta.connection_type}</Tag> : "—" },
    { title: "Capabilities", key: "caps", width: 250, render: (_, row) => <Space size={[4, 4]} wrap>{(row.meta?.capabilities || []).slice(0, 3).map((x) => <Tag key={x}>{x}</Tag>)}{(row.meta?.capabilities?.length || 0) > 3 && <Tag>+{(row.meta?.capabilities?.length || 0) - 3}</Tag>}</Space> },
    { title: "Health", key: "health", width: 115, render: (_, row) => { const h = healthOf(row); return <Tag color={h.color}>{h.label}</Tag>; } },
    { title: "Last seen", dataIndex: "last_seen_on", width: 170, render: (v) => v ? formatBusinessDateTime(v) : "Never" },
    { title: "Status", dataIndex: "status", width: 110, render: (v) => v === "ACTIVE" ? <Tag className="cm-gd-status" color="success" icon={<CheckCircleOutlined />}>Active</Tag> : <Tag className="cm-gd-status" icon={<StopOutlined />}>Inactive</Tag> },
    { title: "Actions", key: "actions", width: 130, align: "right", render: (_, row) => <Space size={2}>{canEdit && <Tooltip title="Pair / provision"><Button type="text" icon={<QrcodeOutlined />} loading={pairingLoading} onClick={() => pair(row)} /></Tooltip>}{canEdit && <Tooltip title="Edit"><Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)} /></Tooltip>}{canDeactivate && <Tooltip title={row.status === "ACTIVE" ? "Disable" : "Activate"}><Button type="text" danger={row.status === "ACTIVE"} icon={row.status === "ACTIVE" ? <StopOutlined /> : <CheckCircleOutlined />} onClick={() => toggleStatus(row)} /></Tooltip>}</Space> },
  ];

  const pagination: TablePaginationConfig = { current: page, pageSize, total, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100], showTotal: (n) => `${n} devices`, onChange: (p, ps) => { setPage(p); setPageSize(ps); } };
  const orgLabel = isSuper ? (orgOptions.find((x) => x.value === selectedOrgId)?.label || "Select organisation") : (authContext.org_code || "Organisation");

  return <PageContainer className="cm-gate-devices-page">
    <CmPageHeader eyebrow="GATE & YARD" title="Gate Devices" subtitle="Register, pair and configure mobile, scanner, camera, weighing, access-control and IoT devices by capability." actions={<Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>} />

    <CmSectionCard compact>
      <div className="cm-gd-scope-row"><div className="cm-gd-scope-copy"><Text type="secondary">WORKING SCOPE</Text><div><strong>{orgLabel}</strong></div><Text type="secondary">Device inventory is organisation-owned and assigned to authorised mandis and gates.</Text></div>{isSuper ? <Select className="cm-gd-scope-control" value={selectedOrgId || undefined} options={orgOptions} placeholder="Select organisation" showSearch optionFilterProp="label" onChange={(v) => { setSelectedOrgId(v); setMandiId(undefined); setGateId(undefined); }} /> : <Alert className="cm-gd-scope-control" type="info" showIcon message="Organisation scope is fixed by your signed-in role." />}</div>
    </CmSectionCard>

    <div className="cm-gd-stats">
      <CmStatCard label="Visible devices" value={stats.visible} icon={<ApiOutlined />} helper="Current filtered page" />
      <CmStatCard label="Active" value={stats.active} icon={<SafetyCertificateOutlined />} helper="Enabled for operations" />
      <CmStatCard label="Online" value={stats.online} icon={<LinkOutlined />} helper="Seen in last 10 minutes" />
      <CmStatCard label="Unpaired" value={stats.unpaired} icon={<MobileOutlined />} helper="Active but never seen" tone="amber" />
    </div>

    <CmSectionCard compact className="cm-gd-table-card">
      <div className="cm-gd-toolbar">
        <Select className="cm-gd-select cm-gd-mandi" value={mandiId} placeholder="Select mandi" allowClear options={mandiOptions} showSearch optionFilterProp="label" onChange={(v) => setMandiId(v)} />
        <Select className="cm-gd-select" value={gateId} placeholder="All gates" allowClear disabled={!mandiId} options={gateOptions} onChange={(v) => { setGateId(v); setPage(1); }} />
        <Select className="cm-gd-select cm-gd-type" value={typeFilter} placeholder="All device types" allowClear options={typeOptions} showSearch optionFilterProp="label" onChange={(v) => { setTypeFilter(v); setPage(1); }} />
        <Input.Search className="cm-gd-search" allowClear placeholder="Search code, label, hardware or user" value={search} onChange={(e) => setSearch(e.target.value)} onSearch={() => { setPage(1); load(); }} />
        {canCreate && <Button type="primary" icon={<PlusOutlined />} disabled={!mandiId || !gateId} onClick={openAdd}>Register device</Button>}
      </div>
      {!mandiId && <Alert type="info" showIcon message="Select a mandi to load its gates and registered devices." className="cm-gd-hint" />}
      <Table<DeviceRow> rowKey={(r) => r._id} columns={columns} dataSource={rows} loading={loading} pagination={pagination} scroll={{ x: 1450 }} locale={{ emptyText: mandiId ? "No devices found for this scope." : "Select a mandi to begin." }} />
    </CmSectionCard>

    <Modal className="cm-gd-modal" width={820} open={deviceModalOpen} onCancel={() => setDeviceModalOpen(false)} onOk={save} confirmLoading={saving} okText={editing ? "Save changes" : "Register device"} title={editing ? `Edit ${editing.device_code}` : "Register gate device"} destroyOnHidden>
      <Form form={form} layout="vertical">
        <div className="cm-gd-form-grid">
          <Form.Item name="mandi_id" label="Mandi" rules={[{ required: true }]}><Select options={mandiOptions} disabled={!!editing} /></Form.Item>
          <Form.Item name="gate_id" label="Gate" rules={[{ required: true }]}><Select options={gateOptions} disabled={!!editing} /></Form.Item>
          <Form.Item name="device_code" label="Device code" rules={[{ required: true }]}><Input disabled={!!editing} placeholder="CM-G1-DEVICE-01" /></Form.Item>
          <Form.Item name="device_label" label="Display label"><Input placeholder="Inbound rugged phone" /></Form.Item>
          <Form.Item name="device_type" label="Device type" rules={[{ required: true }]}><Select options={typeOptions} showSearch optionFilterProp="label" onChange={handleTypeChange} /></Form.Item>
          <Form.Item name="status" label="Status" initialValue="ACTIVE"><Select options={[{value:"ACTIVE",label:"Active"},{value:"INACTIVE",label:"Inactive"}]} /></Form.Item>
          <Form.Item name="connection_type" label="Connection type"><Select allowClear options={(selectedType?.connection_types || []).map((x) => ({value:x,label:x.split("_").join(" ")}))} /></Form.Item>
          <Form.Item name="provisioning_method" label="Provisioning"><Select allowClear options={(selectedType?.provisioning_methods || []).map((x) => ({value:x,label:x.split("_").join(" ")}))} /></Form.Item>
          <Form.Item name="platform" label="Platform"><Select allowClear options={(selectedType?.platforms || ["ANDROID","LINUX","WINDOWS","EMBEDDED"]).map((x) => ({value:x,label:x}))} /></Form.Item>
          <Form.Item name="hardware_id" label="Hardware / device ID"><Input placeholder="Serial, Android ID or controller ID" /></Form.Item>
          <Form.Item name="manufacturer" label="Manufacturer"><Input /></Form.Item>
          <Form.Item name="model" label="Model"><Input /></Form.Item>
          <Form.Item name="serial_number" label="Serial number"><Input /></Form.Item>
          <Form.Item name="firmware_version" label="Firmware / app version"><Input /></Form.Item>
          <Form.Item name="linked_user" label="Primary operator"><Input placeholder="Optional admin/operator username" /></Form.Item>
        </div>
        <Form.Item name="capabilities" label="Capabilities"><Select mode="tags" tokenSeparators={[","]} options={(selectedType?.default_capabilities || []).map((x) => ({value:x,label:x.split("_").join(" ")}))} /></Form.Item>
        {!!selectedType?.config_fields?.length && <CmSectionCard compact title="Device configuration" subtitle="Fields are driven by the selected device-type master."><div className="cm-gd-form-grid">{selectedType.config_fields.map((f) => <Form.Item key={f.key} name={f.key} label={f.label} initialValue={f.default}>{f.type === "NUMBER" ? <InputNumber style={{width:"100%"}} /> : f.type === "BOOLEAN" ? <Switch /> : <Input />}</Form.Item>)}</div></CmSectionCard>}
      </Form>
    </Modal>

    <Modal open={!!pairing} onCancel={() => setPairing(null)} footer={<Button type="primary" onClick={() => setPairing(null)}>Done</Button>} title="Pair / provision device" width={520}>
      {pairing && <div className="cm-gd-pairing"><Text type="secondary">Device</Text><strong>{pairing.label}</strong><Text type="secondary">Pair code</Text><div className="cm-gd-pair-code">{pairing.pair_code}</div><Text>Enter this code on the device or mobile provisioning flow before it expires.</Text><Text type="secondary">Expires: {pairing.expires_on ? formatBusinessDateTime(pairing.expires_on) : "—"}</Text></div>}
    </Modal>
  </PageContainer>;
};

export default GateDevicesPage;
