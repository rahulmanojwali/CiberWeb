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
import type { ColumnsType } from "antd/es/table";
import {
  CheckCircleOutlined,
  EditOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
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
  createGateDeviceConfig,
  deactivateGateDeviceConfig,
  fetchGateDeviceConfigs,
  fetchGateDevicesBootstrap,
  updateGateDeviceConfig,
} from "../../services/gateApi";
import { formatBusinessDateTime } from "../../utils/formatters";
import "./gateDeviceConfigs.css";

const { Text } = Typography;

const LEGACY_DEVICE_TYPE_ALIASES: Record<string, string> = {
  GPS_PHONE: "ANDROID_HANDHELD",
  QR_SCANNER: "QR_BARCODE_SCANNER",
  WEIGHBRIDGE_CONSOLE: "WEIGHBRIDGE_INDICATOR",
};

const canonicalDeviceType = (value?: string | null) => {
  const normalized = String(value || "").trim().toUpperCase();
  return LEGACY_DEVICE_TYPE_ALIASES[normalized] || normalized;
};

type ConfigField = {
  key: string;
  label: string;
  type: "TEXT" | "NUMBER" | "BOOLEAN";
  default?: any;
  required?: boolean;
};

type DeviceTypeMaster = {
  device_type_code: string;
  label: string;
  category?: string;
  config_fields?: ConfigField[];
  connection_types?: string[];
  default_capabilities?: string[];
};

type DeviceRow = {
  _id: string;
  device_code: string;
  device_label?: string;
  device_type: string;
  mandi_id: number;
  gate_id?: string;
  gate_code?: string;
  status?: string;
  meta?: { connection_type?: string; capabilities?: string[] };
};

type ConfigRow = {
  id: string;
  _id?: string;
  org_id?: string;
  mandi_id: number;
  gate_code: string;
  device_code: string;
  device_label?: string | null;
  device_type?: string | null;
  connection_type?: string | null;
  config?: Record<string, any>;
  config_status?: string;
  is_active: "Y" | "N";
  version?: number;
  last_validated_on?: string | null;
  last_validated_by?: string | null;
  updated_on?: string;
  updated_by?: string;
  type_master?: DeviceTypeMaster | null;
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

const GateDeviceConfigs: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const { can, authContext, isSuper } = usePermissions();
  const canCreate = can("gate_device_configs.create", "CREATE");
  const canEdit = can("gate_device_configs.edit", "UPDATE");
  const canDeactivate = can("gate_device_configs.deactivate", "DEACTIVATE");

  const [orgOptions, setOrgOptions] = useState<{ value: string; label: string }[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState(String(authContext.org_id || ""));
  const scopedOrgId = isSuper ? selectedOrgId : String(authContext.org_id || "");
  const [mandis, setMandis] = useState<any[]>([]);
  const [gates, setGates] = useState<any[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<DeviceTypeMaster[]>([]);
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [mandiId, setMandiId] = useState<number | undefined>();
  const [gateId, setGateId] = useState<string | undefined>();
  const [deviceCode, setDeviceCode] = useState<string | undefined>();
  const [status, setStatus] = useState<"ALL" | "Y" | "N">("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ConfigRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const watchedDeviceCode = Form.useWatch("device_code", form);

  useEffect(() => {
    if (!isSuper) return;
    const username = currentUsername();
    if (!username) return;
    fetchOrganisations({ username, language })
      .then((resp: any) => {
        const list = resp?.response?.data?.organisations || resp?.data?.organisations || [];
        const opts = (Array.isArray(list) ? list : [])
          .map((o: any) => ({
            value: String(o?._id || o?.org_id || ""),
            label: String(o?.org_name || o?.org_code || o?._id || "Organisation"),
          }))
          .filter((x: any) => x.value);
        setOrgOptions(opts);
        if (!selectedOrgId && opts.length) setSelectedOrgId(opts[0].value);
      })
      .catch(() => setOrgOptions([]));
  }, [isSuper, language, selectedOrgId]);

  const loadBootstrap = useCallback(async () => {
    const username = currentUsername();
    if (!username || !scopedOrgId) return;
    const resp: any = await fetchGateDevicesBootstrap({
      username,
      language,
      filters: {
        org_id: scopedOrgId,
        mandi_id: mandiId,
        gate_id: gateId,
        page: 1,
        pageSize: 200,
      },
    });
    if (!resp?.ok) {
      message.error(resp?.description || "Unable to load gate device reference data.");
      return;
    }
    const data = resp?.data || {};
    setMandis(Array.isArray(data?.mandis?.items) ? data.mandis.items : []);
    setGates(Array.isArray(data?.gates?.items) ? data.gates.items : []);
    setDevices(Array.isArray(data?.devices?.items) ? data.devices.items : []);
    setDeviceTypes(
      Array.isArray(data?.device_types?.items)
        ? data.device_types.items.map((x: any) =>
            typeof x === "string" ? { device_type_code: x, label: x.split("_").join(" ") } : x,
          )
        : [],
    );
  }, [gateId, language, mandiId, scopedOrgId]);

  const loadConfigs = useCallback(async () => {
    const username = currentUsername();
    if (!username || !scopedOrgId) return;
    setLoading(true);
    try {
      const gateCode = gateId
        ? gates.find((g: any) => String(g._id) === String(gateId))?.gate_code
        : undefined;
      const resp: any = await fetchGateDeviceConfigs({
        username,
        language,
        filters: {
          org_id: scopedOrgId,
          mandi_id: mandiId,
          gate_code: gateCode,
          device_code: deviceCode,
          is_active: status === "ALL" ? undefined : status,
          page,
          pageSize,
        },
      });
      const data = resp?.data || resp?.response?.data || {};
      const list = Array.isArray(data?.configs) ? data.configs : [];
      setRows(list.map((x: any) => ({ ...x, id: String(x.id || x._id) })));
      setTotal(Number(data?.meta?.totalCount || 0));
      setSummary({
        total: Number(data?.summary?.total ?? data?.meta?.totalCount ?? list.length),
        active: Number(data?.summary?.active ?? list.filter((x: any) => x.is_active === "Y").length),
        inactive: Number(data?.summary?.inactive ?? list.filter((x: any) => x.is_active === "N").length),
      });
    } catch (err: any) {
      message.error(err?.message || "Unable to load device configurations.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [deviceCode, gateId, gates, language, mandiId, page, pageSize, scopedOrgId, status]);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);
  useEffect(() => {
    loadConfigs();
  }, [loadConfigs]);
  useEffect(() => {
    setGateId(undefined);
    setDeviceCode(undefined);
    setPage(1);
  }, [mandiId]);
  useEffect(() => {
    setDeviceCode(undefined);
    setPage(1);
  }, [gateId]);

  const typeLookup = useMemo(
    () => new Map(deviceTypes.map((x) => [String(x.device_type_code), x])),
    [deviceTypes],
  );
  const selectedDevice = useMemo(
    () => devices.find((d) => d.device_code === watchedDeviceCode),
    [devices, watchedDeviceCode],
  );
  const selectedMaster = useMemo(
    () => typeLookup.get(canonicalDeviceType(selectedDevice?.device_type || editing?.device_type)),
    [editing?.device_type, selectedDevice?.device_type, typeLookup],
  );

  const mandiOptions = useMemo(
    () =>
      mandis.map((m: any) => ({
        value: Number(m.mandi_id),
        label: m.label || m.name_i18n?.[language] || m.name_i18n?.en || m.mandi_slug || String(m.mandi_id),
      })),
    [language, mandis],
  );
  const gateOptions = useMemo(
    () =>
      gates.map((g: any) => ({
        value: String(g._id),
        label: `${g.gate_code}${g.name_i18n?.[language] || g.name_i18n?.en ? ` · ${g.name_i18n?.[language] || g.name_i18n?.en}` : ""}`,
      })),
    [gates, language],
  );
  const deviceOptions = useMemo(
    () =>
      devices.map((d) => ({
        value: d.device_code,
        label: `${d.device_code}${d.device_label ? ` · ${d.device_label}` : ""} · ${typeLookup.get(canonicalDeviceType(d.device_type))?.label || d.device_type}`,
      })),
    [devices, typeLookup],
  );

  const openCreate = () => {
    if (!mandiId || !gateId) {
      message.info("Select a Mandi and Gate before creating a device configuration.");
      return;
    }
    setEditing(null);
    form.resetFields();
    setModalOpen(true);
  };

  const openEdit = (row: ConfigRow) => {
    setEditing(row);
    form.setFieldsValue({
      device_code: row.device_code,
      connection_type: row.connection_type,
      is_active: row.is_active === "Y",
      notes: (row as any).notes || "",
      ...(row.config || {}),
    });
    setModalOpen(true);
  };

  const applyDefaults = (code: string) => {
    const device = devices.find((d) => d.device_code === code);
    const master = typeLookup.get(canonicalDeviceType(device?.device_type));
    const defaults: Record<string, any> = {};
    (master?.config_fields || []).forEach((f) => {
      if (f.default !== undefined) defaults[f.key] = f.default;
    });
    form.setFieldsValue({
      connection_type: device?.meta?.connection_type || master?.connection_types?.[0],
      ...defaults,
    });
  };

  const save = async () => {
    const username = currentUsername();
    if (!username || !scopedOrgId || !mandiId || !gateId) return;
    const gate = gates.find((g: any) => String(g._id) === String(gateId));
    if (!gate?.gate_code) {
      message.error("Selected gate could not be resolved.");
      return;
    }
    const values = await form.validateFields();
    const device = devices.find((d) => d.device_code === values.device_code);
    const master = typeLookup.get(canonicalDeviceType(device?.device_type || editing?.device_type));
    const config: Record<string, any> = {};
    (master?.config_fields || []).forEach((f) => {
      if (values[f.key] !== undefined) config[f.key] = values[f.key];
    });
    const payload = {
      config_id: editing?.id,
      org_id: scopedOrgId,
      mandi_id: mandiId,
      gate_id: gateId,
      gate_code: gate.gate_code,
      device_code: values.device_code,
      device_type: device?.device_type || editing?.device_type,
      connection_type: values.connection_type,
      config,
      notes: values.notes || null,
      is_active: values.is_active ? "Y" : "N",
      config_status: "VALIDATED",
    };
    setSaving(true);
    try {
      const resp: any = editing
        ? await updateGateDeviceConfig({ username, language, payload })
        : await createGateDeviceConfig({ username, language, payload });
      if (resp?.ok === false || resp?.response?.responsecode === "1") {
        throw new Error(resp?.description || resp?.response?.description || "Unable to save configuration.");
      }
      message.success(editing ? "Device configuration updated." : "Device configuration created.");
      setModalOpen(false);
      await loadConfigs();
    } catch (err: any) {
      message.error(err?.message || "Unable to save configuration.");
    } finally {
      setSaving(false);
    }
  };

  const toggle = async (row: ConfigRow) => {
    const username = currentUsername();
    if (!username) return;
    const next = row.is_active === "Y" ? "N" : "Y";
    const resp: any = await deactivateGateDeviceConfig({
      username,
      language,
      config_id: row.id,
      is_active: next,
    });
    if (resp?.ok === false || resp?.response?.responsecode === "1") {
      message.error(resp?.description || resp?.response?.description || "Unable to update status.");
      return;
    }
    message.success(next === "Y" ? "Configuration activated." : "Configuration deactivated.");
    loadConfigs();
  };

  const columns: ColumnsType<ConfigRow> = [
    {
      title: "Device",
      key: "device",
      width: 250,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.device_label || row.device_code}</Text>
          <Text type="secondary" className="cm-gdc-code">{row.device_code}</Text>
        </Space>
      ),
    },
    {
      title: "Type / Connection",
      key: "type",
      width: 220,
      render: (_, row) => (
        <Space direction="vertical" size={2}>
          <Tag>{row.type_master?.label || row.device_type || "Unknown"}</Tag>
          <Text type="secondary">{row.connection_type || "Not set"}</Text>
        </Space>
      ),
    },
    {
      title: "Gate",
      dataIndex: "gate_code",
      width: 140,
      render: (value) => <Text>{value || "—"}</Text>,
    },
    {
      title: "Configuration",
      key: "config",
      render: (_, row) => {
        const entries = Object.entries(row.config || {}).slice(0, 3);
        return entries.length ? (
          <Space wrap size={[4, 4]}>
            {entries.map(([k, v]) => <Tag key={k}>{k}: {String(v)}</Tag>)}
            {Object.keys(row.config || {}).length > 3 && <Tag>+{Object.keys(row.config || {}).length - 3}</Tag>}
          </Space>
        ) : <Text type="secondary">No dynamic settings</Text>;
      },
    },
    {
      title: "Version",
      dataIndex: "version",
      width: 90,
      align: "center",
      render: (v) => <Tag color="blue">v{Number(v || 1)}</Tag>,
    },
    {
      title: "Validation",
      key: "validation",
      width: 180,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Tag color={row.config_status === "VALIDATED" ? "green" : "gold"}>{row.config_status || "LEGACY"}</Tag>
          <Text type="secondary" className="cm-gdc-small">
            {row.last_validated_on ? formatBusinessDateTime(row.last_validated_on) : "Not recorded"}
          </Text>
        </Space>
      ),
    },
    {
      title: "Status",
      dataIndex: "is_active",
      width: 110,
      render: (v) => <Tag className="cm-gdc-status-tag" color={v === "Y" ? "success" : "default"}>{v === "Y" ? "Active" : "Inactive"}</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 120,
      render: (_, row) => (
        <Space>
          <Tooltip title="Edit configuration">
            <Button type="text" icon={<EditOutlined />} disabled={!canEdit} onClick={() => openEdit(row)} />
          </Tooltip>
          <Tooltip title={row.is_active === "Y" ? "Deactivate" : "Activate"}>
            <Button
              type="text"
              danger={row.is_active === "Y"}
              icon={row.is_active === "Y" ? <StopOutlined /> : <CheckCircleOutlined />}
              disabled={!canDeactivate}
              onClick={() => toggle(row)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer className="cm-gdc-page">
      <CmPageHeader
        eyebrow="GATE & YARD"
        title="Device Configs"
        subtitle="Configure how each registered gate device behaves. Device identity stays in Gate Devices; technical and operational settings live here."
        actions={<Button icon={<ReloadOutlined />} onClick={() => { loadBootstrap(); loadConfigs(); }}>Refresh</Button>}
      />

      <CmSectionCard className="cm-gdc-scope-card">
        <div className="cm-gdc-scope-grid">
          <div>
            <Text type="secondary">Working scope</Text>
            <div className="cm-gdc-scope-title">{isSuper ? "Platform administration" : authContext.org_code || "Organisation"}</div>
            <Text type="secondary">Choose organisation, mandi and gate to configure installed devices.</Text>
          </div>
          <Space wrap>
            {isSuper && (
              <Select
                className="cm-gdc-select cm-gdc-org-select"
                value={selectedOrgId || undefined}
                options={orgOptions}
                placeholder="Organisation"
                onChange={(v) => { setSelectedOrgId(v); setMandiId(undefined); setGateId(undefined); setDeviceCode(undefined); }}
              />
            )}
            <Select allowClear className="cm-gdc-select" value={mandiId} options={mandiOptions} placeholder="Mandi" onChange={setMandiId} />
            <Select allowClear className="cm-gdc-select" value={gateId} options={gateOptions} placeholder="Gate" disabled={!mandiId} onChange={setGateId} />
          </Space>
        </div>
      </CmSectionCard>

      <div className="cm-gdc-stats-grid">
        <CmStatCard label="Configurations" value={summary.total} helper="Current scope" icon={<SettingOutlined />} tone="neutral" />
        <CmStatCard label="Active" value={summary.active} helper="Used operationally" icon={<CheckCircleOutlined />} tone="olive" />
        <CmStatCard label="Inactive" value={summary.inactive} helper="Retained for history" icon={<StopOutlined />} tone="amber" />
        <CmStatCard label="Versioned" value={rows.filter((x) => Number(x.version || 1) > 1).length} helper="Changed at least once" icon={<SafetyCertificateOutlined />} tone="neutral" />
      </div>

      <CmSectionCard className="cm-gdc-table-card">
        <div className="cm-gdc-toolbar">
          <Space wrap>
            <Select allowClear className="cm-gdc-filter-select" value={deviceCode} options={deviceOptions} placeholder="All devices" disabled={!gateId} onChange={(v) => { setDeviceCode(v); setPage(1); }} />
            <Select className="cm-gdc-filter-select cm-gdc-status-select" value={status} options={[{value:"ALL",label:"All statuses"},{value:"Y",label:"Active"},{value:"N",label:"Inactive"}]} onChange={(v) => { setStatus(v); setPage(1); }} />
          </Space>
          <Button type="primary" icon={<SettingOutlined />} disabled={!canCreate || !mandiId || !gateId} onClick={openCreate}>Add Config</Button>
        </div>
        <Table<ConfigRow>
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={rows}
          scroll={{ x: 1350 }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
            showTotal: (n) => `${n} configs`,
          }}
        />
      </CmSectionCard>

      <Modal
        className="cm-gdc-modal"
        open={modalOpen}
        title={editing ? `Edit Device Config · v${Number(editing.version || 1)}` : "Create Device Config"}
        onCancel={() => setModalOpen(false)}
        onOk={save}
        okText={editing ? "Save new version" : "Create config"}
        confirmLoading={saving}
        width={760}
      >
        <Alert
          type="info"
          showIcon
          message="Configuration fields are driven by the selected Device Type Master. Saving an edit creates a new version and preserves the previous version in history."
          className="cm-gdc-modal-alert"
        />
        <Form form={form} layout="vertical" initialValues={{ is_active: true }}>
          <div className="cm-gdc-form-grid">
            <Form.Item name="device_code" label="Device" rules={[{ required: true, message: "Select a registered device." }]}>
              <Select
                showSearch
                disabled={!!editing}
                options={deviceOptions}
                placeholder="Select device"
                onChange={applyDefaults}
                optionFilterProp="label"
              />
            </Form.Item>
            <Form.Item name="connection_type" label="Connection type" rules={[{ required: true, message: "Select the connection type." }]}>
              <Select
                options={(selectedMaster?.connection_types || []).map((x) => ({ value: x, label: x.split("_").join(" ") }))}
                placeholder="Connection type"
              />
            </Form.Item>
          </div>

          {selectedMaster && (
            <div className="cm-gdc-device-context">
              <div>
                <Text strong>{selectedMaster.label}</Text>
                <div><Text type="secondary">{selectedMaster.category || "Device"}</Text></div>
              </div>
              <Space wrap>
                {(selectedMaster.default_capabilities || []).slice(0, 6).map((x) => <Tag key={x}>{x}</Tag>)}
              </Space>
            </div>
          )}

          <div className="cm-gdc-config-section-title">Technical & operational settings</div>
          <div className="cm-gdc-form-grid">
            {(selectedMaster?.config_fields || []).map((field) => {
              const rules = field.required ? [{ required: true, message: `${field.label} is required.` }] : undefined;
              if (field.type === "BOOLEAN") {
                return (
                  <Form.Item key={field.key} name={field.key} label={field.label} valuePropName="checked" rules={rules}>
                    <Switch />
                  </Form.Item>
                );
              }
              if (field.type === "NUMBER") {
                return (
                  <Form.Item key={field.key} name={field.key} label={field.label} rules={rules}>
                    <InputNumber style={{ width: "100%" }} />
                  </Form.Item>
                );
              }
              return (
                <Form.Item key={field.key} name={field.key} label={field.label} rules={rules}>
                  <Input />
                </Form.Item>
              );
            })}
          </div>
          {!selectedMaster && watchedDeviceCode && <Alert type="warning" showIcon message="No active Device Type Master was found. Only common settings can be saved." />}
          <Form.Item name="notes" label="Notes"><Input.TextArea rows={3} /></Form.Item>
          <Form.Item name="is_active" label="Active" valuePropName="checked"><Switch /></Form.Item>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export { GateDeviceConfigs };
export default GateDeviceConfigs;
