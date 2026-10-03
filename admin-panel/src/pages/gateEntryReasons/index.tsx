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
  Tooltip,
  Typography,
  message,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  CheckCircleOutlined,
  EditOutlined,
  EyeOutlined,
  FileProtectOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  StopOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { CmStatCard } from "../../design-system/components/CmStatCard";
import { normalizeLanguageCode } from "../../config/languages";
import { useCrudPermissions } from "../../utils/useCrudPermissions";
import {
  createGateEntryReason,
  deactivateGateEntryReason,
  fetchGateEntryReasons,
  updateGateEntryReason,
} from "../../services/gateApi";
import "./gateEntryReasons.css";

const { Text } = Typography;

const CATEGORY_OPTIONS = [
  "FARMER",
  "TRADER",
  "TRANSPORT",
  "SERVICE",
  "ADMIN",
  "OTHER",
].map((value) => ({ value, label: value.charAt(0) + value.slice(1).toLowerCase() }));

type StatusFlag = "Y" | "N";

type ReasonRow = {
  reason_code: string;
  name: string;
  name_hi?: string;
  category: string;
  requires_documents: string[];
  needs_vehicle_check: StatusFlag;
  needs_weight_check: StatusFlag;
  is_active: StatusFlag;
  updated_on?: string;
  updated_by?: string;
};

type ReasonForm = {
  reason_code: string;
  name_en: string;
  name_hi?: string;
  category: string;
  required_documents: string[];
  needs_vehicle_check: boolean;
  needs_weight_check: boolean;
  is_active: StatusFlag;
};

const EMPTY_FORM: ReasonForm = {
  reason_code: "",
  name_en: "",
  name_hi: "",
  category: "OTHER",
  required_documents: [],
  needs_vehicle_check: false,
  needs_weight_check: false,
  is_active: "Y",
};

function currentUsername(): string {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return String(parsed?.username || "");
  } catch {
    return "";
  }
}

function responseMeta(resp: any) {
  return {
    code: String(resp?.response?.responsecode ?? resp?.data?.response?.responsecode ?? "1"),
    description: String(resp?.response?.description ?? resp?.data?.response?.description ?? resp?.description ?? "Request failed."),
  };
}

function responseData(resp: any): any {
  return resp?.data || resp?.response?.data || {};
}

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48);
}

function formatDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString();
}

export const GateEntryReasons: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const username = currentUsername();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<ReasonForm>();

  // Global protected master: non-super roles may view if RBAC grants VIEW,
  // but create/edit/deactivate remain SUPER_ADMIN-only.
  const { canView, canCreate, canEdit, canDeactivate, isSuperAdmin } = useCrudPermissions(
    "gate_entry_reasons_masters",
    { masterOnly: true },
  );

  const [rows, setRows] = useState<ReasonRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"ALL" | StatusFlag>("ALL");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadData = useCallback(async () => {
    if (!username || !canView) return;
    setLoading(true);
    try {
      const resp = await fetchGateEntryReasons({
        username,
        language,
        filters: { is_active: status === "ALL" ? undefined : status },
      });
      const meta = responseMeta(resp);
      if (meta.code !== "0") throw new Error(meta.description);
      const data = responseData(resp);
      const list = Array.isArray(data?.reasons) ? data.reasons : Array.isArray(data?.items) ? data.items : [];
      setRows(
        list.map((r: any) => ({
          reason_code: String(r?.reason_code || ""),
          name: String(r?.name_i18n?.[language] || r?.label || r?.name_i18n?.en || r?.name_en || r?.reason_code || "—"),
          name_hi: String(r?.name_i18n?.hi || ""),
          category: String(r?.category || "OTHER").toUpperCase(),
          requires_documents: Array.isArray(r?.requires_documents)
            ? r.requires_documents
            : Array.isArray(r?.required_documents)
              ? r.required_documents
              : [],
          needs_vehicle_check: String(r?.needs_vehicle_check || r?.vehicle_check || "N").toUpperCase() === "Y" ? "Y" : "N",
          needs_weight_check: String(r?.needs_weight_check || r?.weight_check || "N").toUpperCase() === "Y" ? "Y" : "N",
          is_active: String(r?.is_active || r?.active || "Y").toUpperCase() === "N" ? "N" : "Y",
          updated_on: r?.updated_on,
          updated_by: r?.updated_by,
        })),
      );
    } catch (err: any) {
      messageApi.error(err?.message || "Unable to load gate entry reasons.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [username, canView, language, status, messageApi]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.name, row.reason_code, row.category, ...(row.requires_documents || [])]
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [rows, search]);

  const stats = useMemo(() => {
    const active = rows.filter((r) => r.is_active === "Y").length;
    const vehicle = rows.filter((r) => r.needs_vehicle_check === "Y").length;
    const weight = rows.filter((r) => r.needs_weight_check === "Y").length;
    return { total: rows.length, active, inactive: rows.length - active, checks: `${vehicle}/${weight}` };
  }, [rows]);

  const openCreate = () => {
    setEditingCode(null);
    form.setFieldsValue(EMPTY_FORM);
    setEditorOpen(true);
  };

  const openEdit = (row: ReasonRow) => {
    setEditingCode(row.reason_code);
    form.setFieldsValue({
      reason_code: row.reason_code,
      name_en: row.name,
      name_hi: row.name_hi || "",
      category: row.category || "OTHER",
      required_documents: row.requires_documents || [],
      needs_vehicle_check: row.needs_vehicle_check === "Y",
      needs_weight_check: row.needs_weight_check === "Y",
      is_active: row.is_active,
    });
    setEditorOpen(true);
  };

  const saveReason = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload = {
        reason_code: values.reason_code,
        name_en: values.name_en,
        name_i18n: { en: values.name_en, ...(values.name_hi?.trim() ? { hi: values.name_hi.trim() } : {}) },
        category: values.category,
        required_documents: values.required_documents || [],
        needs_vehicle_check: values.needs_vehicle_check ? "Y" : "N",
        needs_weight_check: values.needs_weight_check ? "Y" : "N",
        is_active: values.is_active,
      };
      const resp = editingCode
        ? await updateGateEntryReason({ username, language, payload })
        : await createGateEntryReason({ username, language, payload });
      const meta = responseMeta(resp);
      if (meta.code !== "0") throw new Error(meta.description);
      messageApi.success(editingCode ? "Gate entry reason updated." : "Gate entry reason created.");
      setEditorOpen(false);
      await loadData();
    } catch (err: any) {
      if (err?.errorFields) return;
      messageApi.error(err?.message || "Unable to save gate entry reason.");
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (row: ReasonRow) => {
    Modal.confirm({
      title: "Deactivate gate entry reason?",
      content: `${row.name} will no longer be available for new gate-entry workflows. Existing records are retained.`,
      okText: "Deactivate",
      okButtonProps: { danger: true },
      onOk: async () => {
        const resp = await deactivateGateEntryReason({ username, language, reason_code: row.reason_code });
        const meta = responseMeta(resp);
        if (meta.code !== "0") throw new Error(meta.description);
        messageApi.success("Gate entry reason deactivated.");
        await loadData();
      },
    });
  };

  const columns = useMemo<TableColumnsType<ReasonRow>>(
    () => [
      {
        title: "Reason",
        key: "reason",
        width: 280,
        render: (_, row) => (
          <div className="cm-gate-reasons-primary">
            <Text strong>{row.name}</Text>
            <Text type="secondary" code>{row.reason_code}</Text>
          </div>
        ),
      },
      {
        title: "Category",
        dataIndex: "category",
        width: 130,
        render: (value) => <Tag className="cm-gate-reasons-category">{String(value || "OTHER")}</Tag>,
      },
      {
        title: "Required documents",
        dataIndex: "requires_documents",
        width: 270,
        render: (docs: string[]) =>
          docs?.length ? (
            <Space size={[4, 4]} wrap>{docs.slice(0, 3).map((doc) => <Tag key={doc}>{doc}</Tag>)}{docs.length > 3 && <Tag>+{docs.length - 3}</Tag>}</Space>
          ) : <Text type="secondary">None</Text>,
      },
      {
        title: "Operational checks",
        key: "checks",
        width: 190,
        render: (_, row) => (
          <Space size={[4, 4]} wrap>
            {row.needs_vehicle_check === "Y" && <Tag color="blue">Vehicle</Tag>}
            {row.needs_weight_check === "Y" && <Tag color="gold">Weight</Tag>}
            {row.needs_vehicle_check !== "Y" && row.needs_weight_check !== "Y" && <Text type="secondary">None</Text>}
          </Space>
        ),
      },
      {
        title: "Status",
        dataIndex: "is_active",
        width: 120,
        render: (value: StatusFlag) => (
          <Tag
            className="cm-gate-reasons-status"
            icon={value === "Y" ? <CheckCircleOutlined /> : <StopOutlined />}
            color={value === "Y" ? "success" : "default"}
          >
            {value === "Y" ? "Active" : "Inactive"}
          </Tag>
        ),
      },
      {
        title: "Updated",
        key: "updated",
        width: 190,
        render: (_, row) => (
          <div className="cm-gate-reasons-updated">
            <Text>{formatDate(row.updated_on)}</Text>
            <Text type="secondary">{row.updated_by || "—"}</Text>
          </div>
        ),
      },
      {
        title: "Actions",
        key: "actions",
        width: 110,
        fixed: "right",
        render: (_, row) => (
          <Space size={4}>
            {(canEdit || canView) && (
              <Tooltip title={canEdit ? "Edit" : "View"}>
                <Button type="text" icon={canEdit ? <EditOutlined /> : <EyeOutlined />} onClick={() => openEdit(row)} />
              </Tooltip>
            )}
            {canDeactivate && row.is_active === "Y" && (
              <Tooltip title="Deactivate">
                <Button danger type="text" icon={<StopOutlined />} onClick={() => void deactivate(row)} />
              </Tooltip>
            )}
          </Space>
        ),
      },
    ],
    [canEdit, canView, canDeactivate],
  );

  const editorReadOnly = !!editingCode && !canEdit;

  return (
    <PageContainer>
      {contextHolder}
      <div className="cm-gate-reasons-page">
        <CmPageHeader
          eyebrow="GATE OPERATIONS · MASTER DATA"
          title="Gate Entry Reasons"
          subtitle="Control the protected reasons available to gate-entry workflows, including supporting-document and operational-check requirements."
          breadcrumbs={[
            { title: "Gate Operation" },
            { title: "Gate Entry Reasons" },
          ]}
          actions={
            <Space size={8} wrap>
              <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>Refresh</Button>
              {canCreate && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Add reason</Button>}
            </Space>
          }
        />

        {!isSuperAdmin && (
          <Alert
            showIcon
            type="info"
            message="Protected global master"
            description="Gate entry reasons are platform-wide master data. Your role may view them when permitted; changes are restricted to SUPER_ADMIN."
          />
        )}

        <Row gutter={[12, 12]} className="cm-gate-reasons-stat-row">
          <Col xs={24} sm={12} xl={6}><CmStatCard label="Reasons" value={stats.total} icon={<TagsOutlined />} helper="Current filtered master" /></Col>
          <Col xs={24} sm={12} xl={6}><CmStatCard label="Active" value={stats.active} icon={<CheckCircleOutlined />} helper="Available to gate entry" /></Col>
          <Col xs={24} sm={12} xl={6}><CmStatCard label="Inactive" value={stats.inactive} icon={<StopOutlined />} helper="Retained, not deleted" /></Col>
          <Col xs={24} sm={12} xl={6}><CmStatCard label="Vehicle / Weight" value={stats.checks} icon={<SafetyCertificateOutlined />} helper="Operational check rules" tone="amber" /></Col>
        </Row>

        <CmSectionCard className="cm-gate-reasons-card" compact>
          <div className="cm-gate-reasons-toolbar">
            <Input.Search
              allowClear
              placeholder="Search reason, code, category or document"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select
              value={status}
              onChange={(value) => setStatus(value)}
              options={[
                { value: "ALL", label: "All statuses" },
                { value: "Y", label: "Active" },
                { value: "N", label: "Inactive" },
              ]}
            />
          </div>

          {!canView ? (
            <Alert type="warning" showIcon message="You do not have permission to view gate entry reasons." />
          ) : (
            <Table<ReasonRow>
              className="cm-gate-reasons-table"
              rowKey="reason_code"
              columns={columns}
              dataSource={filteredRows}
              loading={loading}
              scroll={{ x: 1350 }}
              locale={{ emptyText: <Empty description="No gate entry reasons found" /> }}
              pagination={{
                defaultPageSize: 20,
                showSizeChanger: true,
                pageSizeOptions: [10, 20, 50, 100],
                showTotal: (total) => `${total} reasons`,
              }}
            />
          )}
        </CmSectionCard>
      </div>

      <Modal
        className="cm-gate-reasons-modal"
        open={editorOpen}
        title={editingCode ? (editorReadOnly ? "View gate entry reason" : "Edit gate entry reason") : "Add gate entry reason"}
        width={760}
        onCancel={() => setEditorOpen(false)}
        destroyOnHidden
        footer={
          <Space>
            <Button onClick={() => setEditorOpen(false)}>{editorReadOnly ? "Close" : "Cancel"}</Button>
            {!editorReadOnly && <Button type="primary" loading={saving} onClick={() => void saveReason()}>{editingCode ? "Save changes" : "Create reason"}</Button>}
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          message="Platform-wide gate master"
          description="Changes affect every gate-entry workflow that consumes this master. Use concise, operational reason names and only require documents/checks that are genuinely needed."
        />
        <Form<ReasonForm>
          form={form}
          layout="vertical"
          initialValues={EMPTY_FORM}
          disabled={editorReadOnly}
          className="cm-gate-reasons-form"
        >
          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item
                name="name_en"
                label="Reason name (English)"
                rules={[{ required: true, message: "Enter the English reason name." }]}
              >
                <Input
                  placeholder="e.g. Produce delivery"
                  onChange={(e) => {
                    if (!editingCode) {
                      const current = form.getFieldValue("reason_code");
                      if (!current) form.setFieldValue("reason_code", toSlug(e.target.value));
                    }
                  }}
                />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="name_hi" label="Reason name (Hindi)">
                <Input placeholder="Optional Hindi label" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={12}>
            <Col xs={24} md={12}>
              <Form.Item
                name="reason_code"
                label="Reason code"
                rules={[
                  { required: true, message: "Enter the reason code." },
                  { pattern: /^[a-z0-9_.-]+$/, message: "Use lowercase letters, numbers, dot, underscore or hyphen only." },
                ]}
              >
                <Input disabled={!!editingCode || editorReadOnly} maxLength={48} placeholder="produce_delivery" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="category" label="Category" rules={[{ required: true }]}>
                <Select options={CATEGORY_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="required_documents" label="Required documents">
            <Select
              mode="tags"
              tokenSeparators={[","]}
              placeholder="Type a document code and press Enter"
              maxTagCount="responsive"
            />
          </Form.Item>

          <div className="cm-gate-reasons-check-grid">
            <Form.Item name="needs_vehicle_check" label="Vehicle check" valuePropName="checked">
              <Switch checkedChildren="Required" unCheckedChildren="Not required" />
            </Form.Item>
            <Form.Item name="needs_weight_check" label="Weight check" valuePropName="checked">
              <Switch checkedChildren="Required" unCheckedChildren="Not required" />
            </Form.Item>
            <Form.Item name="is_active" label="Status">
              <Select options={[{ value: "Y", label: "Active" }, { value: "N", label: "Inactive" }]} />
            </Form.Item>
          </div>
        </Form>
      </Modal>
    </PageContainer>
  );
};
