import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Col,
  Empty,
  Form,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  CheckCircleOutlined,
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  SwapOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { CmStatCard } from "../../design-system/components/CmStatCard";
import { normalizeLanguageCode } from "../../config/languages";
import { usePermissions } from "../../authz/usePermissions";
import { fetchOrganisations } from "../../services/adminUsersApi";
import {
  createMandiGate,
  deactivateMandiGate,
  fetchGateBootstrap,
  fetchMandiGates,
  updateMandiGate,
} from "../../services/mandiApi";
import "./mandiGates.css";

const { Text, Paragraph } = Typography;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
type StatusFlag = "Y" | "N";
type StatusFilter = "ALL" | "Y" | "N";

type OrganisationOption = { value: string; label: string; orgCode: string };
type MandiOption = { value: string; label: string; isActive: StatusFlag };
type GateRow = {
  id: string;
  org_id: string;
  mandi_id: number;
  mandi_name?: string;
  gate_code: string;
  gate_name: string;
  name_i18n?: Record<string, string>;
  is_entry_only: StatusFlag;
  is_exit_only: StatusFlag;
  is_weighbridge: StatusFlag;
  allowed_vehicle_codes: string[];
  description?: string | null;
  is_active: StatusFlag;
  updated_on?: string;
  updated_by?: string;
};

type GateSummary = { total: number; active: number; inactive: number; weighbridge: number };
const EMPTY_SUMMARY: GateSummary = { total: 0, active: 0, inactive: 0, weighbridge: 0 };

function currentUsername(): string {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return String(parsed?.username || "");
  } catch {
    return "";
  }
}

function responseData(raw: any): any {
  return raw?.data || raw?.response?.data || raw || {};
}
function responseMeta(raw: any): { code: string; description: string } {
  const response = raw?.response || raw?.data?.response || raw;
  return {
    code: String(response?.responsecode ?? raw?.responsecode ?? "0"),
    description: String(response?.description ?? raw?.description ?? ""),
  };
}
function localize(row: any, language: string): string {
  return String(row?.name_i18n?.[language] || row?.name_i18n?.en || row?.label || row?.mandi_slug || row?.gate_code || row?.mandi_id || "");
}

export const MandiGates: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const username = currentUsername();
  const { authContext, can, isSuper } = usePermissions();
  const [searchParams] = useSearchParams();
  const [messageApi, messageContextHolder] = message.useMessage();

  const canCreate = can("mandi_gates.create", "CREATE");
  const canUpdate = can("mandi_gates.edit", "UPDATE");
  const canDeactivate = can("mandi_gates.deactivate", "DEACTIVATE");

  const [organisationOptions, setOrganisationOptions] = useState<OrganisationOption[]>([]);
  const [organisationsLoading, setOrganisationsLoading] = useState(false);
  const [selectedSuperOrgId, setSelectedSuperOrgId] = useState<string>(String(searchParams.get("org_id") || ""));
  const orgId = isSuper ? selectedSuperOrgId : String(authContext.org_id || "");
  const selectedOrg = organisationOptions.find((x) => x.value === selectedSuperOrgId);

  const [mandis, setMandis] = useState<MandiOption[]>([]);
  const [selectedMandiId, setSelectedMandiId] = useState<string>(String(searchParams.get("mandi_id") || ""));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchText, setSearchText] = useState("");
  const [rows, setRows] = useState<GateRow[]>([]);
  const [summary, setSummary] = useState<GateSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [modalOpen, setModalOpen] = useState(false);
  const [editRow, setEditRow] = useState<GateRow | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm<{
    gate_code: string;
    gate_name: string;
    description?: string;
    direction: "ENTRY" | "EXIT" | "BOTH";
    has_weighbridge: boolean;
    allowed_vehicle_codes: string[];
    is_active: StatusFlag;
  }>();

  useEffect(() => {
    if (!isSuper || !username) return;
    let cancelled = false;
    (async () => {
      setOrganisationsLoading(true);
      try {
        const raw = await fetchOrganisations({ username, language });
        const data = responseData(raw);
        const list = Array.isArray(data?.items) ? data.items : Array.isArray(data?.organisations) ? data.organisations : Array.isArray(data) ? data : [];
        const options: OrganisationOption[] = list
          .map((item: any) => ({
            value: String(item?._id || item?.org_id || ""),
            label: String(item?.org_name || item?.name || item?.org_code || item?._id || ""),
            orgCode: String(item?.org_code || ""),
          }))
          .filter((item: OrganisationOption) => item.value && item.label);
        if (!cancelled) setOrganisationOptions(options);
      } catch (err: any) {
        if (!cancelled) messageApi.error(err?.message || "Unable to load organisations.");
      } finally {
        if (!cancelled) setOrganisationsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isSuper, username, language, messageApi]);

  const loadBootstrap = useCallback(async () => {
    if (!username || !orgId) {
      setMandis([]);
      setRows([]);
      setTotal(0);
      setSummary(EMPTY_SUMMARY);
      return;
    }
    try {
      const raw = await fetchGateBootstrap({
        username,
        language,
        payload: { org_id: orgId, mandi_page: 1, mandi_pageSize: 500 },
      });
      const meta = responseMeta(raw);
      if (meta.code !== "0") throw new Error(meta.description || "Unable to load gate workspace.");
      const data = responseData(raw);
      const mandiItems = Array.isArray(data?.mandis?.items) ? data.mandis.items : [];
      const options: MandiOption[] = mandiItems
        .map((item: any) => ({
          value: String(item?.mandi_id ?? ""),
          label: localize(item, language),
          isActive: String(item?.org_mandi_is_active || item?.is_active || "Y").toUpperCase() === "N" ? "N" : "Y",
        }))
        .filter((item: MandiOption) => item.value && item.label);
      setMandis(options);
      if (selectedMandiId && !options.some((x) => x.value === selectedMandiId)) setSelectedMandiId("");
      if (!selectedMandiId && options.length === 1) setSelectedMandiId(options[0].value);
    } catch (err: any) {
      messageApi.error(err?.message || "Unable to load Mandi gates setup.");
    }
  }, [username, orgId, language, selectedMandiId, messageApi]);

  useEffect(() => { loadBootstrap(); }, [loadBootstrap]);

  const loadRows = useCallback(async () => {
    if (!username || !orgId || !selectedMandiId) {
      setRows([]); setTotal(0); setSummary(EMPTY_SUMMARY); return;
    }
    setLoading(true);
    try {
      const raw = await fetchMandiGates({
        username,
        language,
        filters: {
          org_id: orgId,
          mandi_id: Number(selectedMandiId),
          ...(statusFilter === "ALL" ? {} : { is_active: statusFilter }),
          ...(searchText.trim() ? { search: searchText.trim() } : {}),
          page,
          pageSize,
        },
      });
      const meta = responseMeta(raw);
      if (meta.code !== "0") throw new Error(meta.description || "Unable to load Mandi gates.");
      const data = responseData(raw);
      const list = Array.isArray(data?.items) ? data.items : Array.isArray(data?.gates) ? data.gates : [];
      const mapped: GateRow[] = list.map((g: any) => ({
        id: String(g?._id || g?.id || ""),
        org_id: String(g?.org_id || ""),
        mandi_id: Number(g?.mandi_id || 0),
        mandi_name: String(g?.mandi_name || ""),
        gate_code: String(g?.gate_code || ""),
        gate_name: localize(g, language),
        name_i18n: g?.name_i18n || {},
        is_entry_only: String(g?.is_entry_only || "N").toUpperCase() === "Y" ? "Y" : "N",
        is_exit_only: String(g?.is_exit_only || "N").toUpperCase() === "Y" ? "Y" : "N",
        is_weighbridge: String(g?.is_weighbridge || "N").toUpperCase() === "Y" ? "Y" : "N",
        allowed_vehicle_codes: Array.isArray(g?.allowed_vehicle_codes) ? g.allowed_vehicle_codes.map(String) : [],
        description: g?.description || null,
        is_active: String(g?.is_active || "N").toUpperCase() === "Y" ? "Y" : "N",
        updated_on: g?.updated_on,
        updated_by: g?.updated_by,
      }));
      setRows(mapped);
      const count = Number(data?.meta?.totalCount ?? mapped.length);
      setTotal(count);
      const allForSummary = statusFilter === "ALL" ? mapped : mapped;
      setSummary({
        total: count,
        active: allForSummary.filter((x) => x.is_active === "Y").length,
        inactive: allForSummary.filter((x) => x.is_active === "N").length,
        weighbridge: allForSummary.filter((x) => x.is_weighbridge === "Y").length,
      });
    } catch (err: any) {
      setRows([]); setTotal(0); setSummary(EMPTY_SUMMARY);
      messageApi.error(err?.message || "Unable to load Mandi gates.");
    } finally {
      setLoading(false);
    }
  }, [username, orgId, selectedMandiId, statusFilter, searchText, page, pageSize, language, messageApi]);

  useEffect(() => { loadRows(); }, [loadRows]);

  const openCreate = () => {
    setEditRow(null);
    form.setFieldsValue({
      gate_code: "",
      gate_name: "",
      description: "",
      direction: "BOTH",
      has_weighbridge: false,
      allowed_vehicle_codes: ["general"],
      is_active: "Y",
    });
    setModalOpen(true);
  };
  const openEdit = (row: GateRow) => {
    setEditRow(row);
    const direction = row.is_entry_only === "Y" && row.is_exit_only === "Y" ? "BOTH" : row.is_entry_only === "Y" ? "ENTRY" : "EXIT";
    form.setFieldsValue({
      gate_code: row.gate_code,
      gate_name: row.gate_name,
      description: row.description || "",
      direction,
      has_weighbridge: row.is_weighbridge === "Y",
      allowed_vehicle_codes: row.allowed_vehicle_codes.length ? row.allowed_vehicle_codes : ["general"],
      is_active: row.is_active,
    });
    setModalOpen(true);
  };

  const submit = async () => {
    if (!selectedMandiId || !orgId) return;
    try {
      const values = await form.validateFields();
      setSubmitting(true);
      const both = values.direction === "BOTH";
      const payload = {
        ...(editRow ? { _id: editRow.id } : {}),
        org_id: orgId,
        mandi_id: Number(selectedMandiId),
        gate_code: values.gate_code.trim().toLowerCase(),
        name_i18n: { ...(editRow?.name_i18n || {}), en: values.gate_name.trim() },
        description: values.description?.trim() || "",
        is_entry_only: both || values.direction === "ENTRY" ? "Y" : "N",
        is_exit_only: both || values.direction === "EXIT" ? "Y" : "N",
        is_weighbridge: values.has_weighbridge ? "Y" : "N",
        allowed_vehicle_codes: values.allowed_vehicle_codes,
        is_active: values.is_active,
      };
      const raw = editRow
        ? await updateMandiGate({ username, language, payload })
        : await createMandiGate({ username, language, payload });
      const meta = responseMeta(raw);
      if (meta.code !== "0") throw new Error(meta.description || `Unable to ${editRow ? "update" : "create"} gate.`);
      messageApi.success(editRow ? "Gate updated." : "Gate created.");
      setModalOpen(false);
      setPage(1);
      await loadRows();
    } catch (err: any) {
      if (err?.errorFields) return;
      messageApi.error(err?.message || "Unable to save gate.");
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (row: GateRow) => {
    const next: StatusFlag = row.is_active === "Y" ? "N" : "Y";
    Modal.confirm({
      title: next === "Y" ? "Activate gate?" : "Deactivate gate?",
      content: `${row.gate_name} (${row.gate_code})`,
      okText: next === "Y" ? "Activate" : "Deactivate",
      okButtonProps: { danger: next === "N" },
      onOk: async () => {
        const raw = await deactivateMandiGate({ username, language, _id: row.id, is_active: next });
        const meta = responseMeta(raw);
        if (meta.code !== "0") throw new Error(meta.description || "Unable to update gate status.");
        messageApi.success(next === "Y" ? "Gate activated." : "Gate deactivated.");
        await loadRows();
      },
    });
  };

  const columns: TableColumnsType<GateRow> = useMemo(() => [
    {
      title: "Gate",
      dataIndex: "gate_name",
      key: "gate_name",
      render: (_: any, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.gate_name || row.gate_code}</Text>
          <Text type="secondary" className="cm-gates-code">{row.gate_code}</Text>
        </Space>
      ),
    },
    {
      title: "Direction",
      key: "direction",
      width: 130,
      render: (_: any, row) => {
        const label = row.is_entry_only === "Y" && row.is_exit_only === "Y" ? "Both" : row.is_entry_only === "Y" ? "Entry" : "Exit";
        return <Tag>{label}</Tag>;
      },
    },
    { title: "Vehicles", dataIndex: "allowed_vehicle_codes", key: "vehicles", width: 180, render: (codes: string[]) => (codes || []).join(", ") || "—" },
    { title: "Weighbridge", key: "wb", width: 120, render: (_: any, row) => row.is_weighbridge === "Y" ? <Tag color="green">Yes</Tag> : <Tag>No</Tag> },
    { title: "Status", dataIndex: "is_active", key: "status", width: 110, render: (v: StatusFlag) => <Tag color={v === "Y" ? "success" : "default"}>{v === "Y" ? "Active" : "Inactive"}</Tag> },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      align: "right",
      render: (_: any, row) => (
        <Space size={4}>
          {canUpdate && <Button type="text" size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />}
          {canDeactivate && (
            <Button
              type="text"
              size="small"
              danger={row.is_active === "Y"}
              icon={row.is_active === "Y" ? <StopOutlined /> : <CheckCircleOutlined />}
              onClick={() => toggleActive(row)}
            />
          )}
        </Space>
      ),
    },
  ], [canUpdate, canDeactivate]);

  const scopeLabel = isSuper ? selectedOrg?.label || "Select an organisation" : String(authContext.org_code || "Organisation");

  return (
    <PageContainer>
      {messageContextHolder}
      <div className="cm-gates-page">
        <CmPageHeader
          eyebrow="MANDI OPERATIONS"
          title="Mandi Gates"
          subtitle="Manage entry and exit points, vehicle access and weighbridge-linked gates within the selected mandi."
          actions={<Button icon={<ReloadOutlined />} onClick={() => { loadBootstrap(); loadRows(); }}>Refresh</Button>}
        />

        <CmSectionCard compact className="cm-gates-scope-card">
          <Row gutter={[16, 12]} align="middle">
            <Col xs={24} lg={10}>
              <Text className="cm-gates-kicker">WORKING SCOPE</Text>
              <div className="cm-gates-scope-title">{scopeLabel}</div>
              <Text type="secondary">Gate administration remains locked to the current organisation and permitted mandi scope.</Text>
            </Col>
            <Col xs={24} lg={14}>
              {isSuper ? (
                <Select
                  className="cm-gates-select"
                  value={selectedSuperOrgId || undefined}
                  placeholder="Select organisation"
                  loading={organisationsLoading}
                  options={organisationOptions.map((x) => ({ value: x.value, label: `${x.label}${x.orgCode ? ` · ${x.orgCode}` : ""}` }))}
                  onChange={(value) => { setSelectedSuperOrgId(value); setSelectedMandiId(""); setPage(1); }}
                  showSearch
                  optionFilterProp="label"
                />
              ) : (
                <Alert type="info" showIcon message={`Organisation scope: ${scopeLabel}`} />
              )}
            </Col>
          </Row>
        </CmSectionCard>

        <Row gutter={[12, 12]} className="cm-gates-stats">
          <Col xs={12} xl={6}><CmStatCard label="Gates" value={summary.total} helper="Current mandi" icon={<SwapOutlined />} /></Col>
          <Col xs={12} xl={6}><CmStatCard label="Active" value={summary.active} helper="Available for operations" icon={<CheckCircleOutlined />} /></Col>
          <Col xs={12} xl={6}><CmStatCard label="Inactive" value={summary.inactive} helper="Retained history" icon={<StopOutlined />} tone="neutral" /></Col>
          <Col xs={12} xl={6}><CmStatCard label="Weighbridge" value={summary.weighbridge} helper="Linked gate capability" icon={<SwapOutlined />} tone="amber" /></Col>
        </Row>

        <CmSectionCard compact>
          <div className="cm-gates-toolbar">
            <Select
              className="cm-gates-select cm-gates-mandi-select"
              value={selectedMandiId || undefined}
              placeholder="Select mandi"
              options={mandis.map((m) => ({ value: m.value, label: m.isActive === "N" ? `${m.label} · inactive` : m.label, disabled: m.isActive === "N" }))}
              onChange={(value) => { setSelectedMandiId(value); setPage(1); }}
              showSearch
              optionFilterProp="label"
              disabled={!orgId}
            />
            <Input
              allowClear
              prefix={<SearchOutlined />}
              placeholder="Search gate name or code"
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
              className="cm-gates-search"
            />
            <Select
              className="cm-gates-select cm-gates-status-select"
              value={statusFilter}
              options={[{ value: "ALL", label: "All statuses" }, { value: "Y", label: "Active" }, { value: "N", label: "Inactive" }]}
              onChange={(value) => { setStatusFilter(value); setPage(1); }}
            />
            <div className="cm-gates-toolbar-spacer" />
            {canCreate && <Button type="primary" icon={<PlusOutlined />} disabled={!selectedMandiId} onClick={openCreate}>Add gate</Button>}
          </div>

          {!selectedMandiId ? (
            <Empty description="Select a mandi to view gates." />
          ) : (
            <Table<GateRow>
              rowKey="id"
              columns={columns}
              dataSource={rows}
              loading={loading}
              pagination={{
                current: page,
                pageSize,
                total,
                showSizeChanger: true,
                pageSizeOptions: PAGE_SIZE_OPTIONS,
                showTotal: (count) => `${count} gates`,
                onChange: (nextPage, nextSize) => { setPage(nextPage); setPageSize(nextSize); },
              }}
              locale={{ emptyText: <Empty description="No gates found for this mandi." /> }}
              scroll={{ x: 900 }}
            />
          )}
        </CmSectionCard>
      </div>

      <Modal
        title={editRow ? "Edit gate" : "Add gate"}
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        okText={editRow ? "Save changes" : "Create gate"}
        confirmLoading={submitting}
        destroyOnHidden
        className="cm-gates-modal"
      >
        <Form form={form} layout="vertical" requiredMark="optional">
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Gate code" name="gate_code" rules={[{ required: true }, { pattern: /^[A-Za-z0-9_-]{2,32}$/, message: "Use 2–32 letters, numbers, _ or -." }]}>
                <Input placeholder="e.g. main_entry" disabled={!!editRow} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Gate name" name="gate_name" rules={[{ required: true, message: "Enter a gate name." }]}>
                <Input placeholder="Main Entry Gate" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Direction" name="direction" rules={[{ required: true }]}>
            <Select className="cm-gates-select" options={[{ value: "ENTRY", label: "Entry only" }, { value: "EXIT", label: "Exit only" }, { value: "BOTH", label: "Entry & exit" }]} />
          </Form.Item>
          <Form.Item label="Allowed vehicle categories" name="allowed_vehicle_codes" rules={[{ required: true, message: "Select at least one category." }]}>
            <Select
              className="cm-gates-select"
              mode="tags"
              tokenSeparators={[","]}
              options={["general", "tractor", "truck", "pickup", "two_wheeler", "car"].map((v) => ({ value: v, label: v.replace(/_/g, " ") }))}
            />
          </Form.Item>
          <Row gutter={12}>
            <Col span={12}>
              <Form.Item label="Weighbridge at gate" name="has_weighbridge" valuePropName="checked">
                <Switch />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Status" name="is_active">
                <Select className="cm-gates-select" options={[{ value: "Y", label: "Active" }, { value: "N", label: "Inactive" }]} />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item label="Notes" name="description">
            <Input.TextArea rows={3} maxLength={500} showCount placeholder="Operational notes" />
          </Form.Item>
          <Paragraph type="secondary" className="cm-gates-note">Gate changes affect only the selected mandi. Vehicle and device enforcement remains API-controlled.</Paragraph>
        </Form>
      </Modal>
    </PageContainer>
  );
};

export default MandiGates;
