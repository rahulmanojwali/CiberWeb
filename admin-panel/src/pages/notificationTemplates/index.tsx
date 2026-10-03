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
  BellOutlined,
  CheckCircleOutlined,
  EditOutlined,
  EyeOutlined,
  GlobalOutlined,
  PlusOutlined,
  ReloadOutlined,
  SendOutlined,
  StopOutlined,
  TranslationOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { CmStatCard } from "../../design-system/components/CmStatCard";
import { normalizeLanguageCode } from "../../config/languages";
import { usePermissions } from "../../authz/usePermissions";
import {
  fetchNotificationTemplates,
  previewNotificationTemplate,
  saveNotificationTemplate,
  testSendNotificationTemplate,
  validateNotificationTemplatesEnglish,
} from "../../services/notificationTemplatesApi";
import "./notificationTemplates.css";

const { Text, Paragraph } = Typography;
const { TextArea } = Input;

type Channel = "in_app" | "push" | "both";

type TemplateRow = {
  _id?: string;
  id: string;
  event_key: string;
  channel: Channel;
  language: string;
  title_template: string;
  body_template: string;
  variables: string[];
  is_active: boolean;
  version?: number;
  updated_on?: string;
  updated_by?: string;
};

type TemplateForm = {
  event_key: string;
  channel: Channel;
  language: string;
  title_template: string;
  body_template: string;
  variables: string;
  is_active: boolean;
};

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English", short: "EN" },
  { value: "hi", label: "Hindi", short: "HI" },
  { value: "bn", label: "Bengali", short: "BN" },
  { value: "ta", label: "Tamil", short: "TA" },
  { value: "te", label: "Telugu", short: "TE" },
  { value: "mr", label: "Marathi", short: "MR" },
  { value: "kn", label: "Kannada", short: "KN" },
  { value: "ml", label: "Malayalam", short: "ML" },
  { value: "pa", label: "Punjabi", short: "PA" },
  { value: "gu", label: "Gujarati", short: "GU" },
  { value: "or", label: "Odia", short: "OR" },
];

const CHANNEL_OPTIONS = [
  { value: "in_app", label: "In-app" },
  { value: "push", label: "Push" },
  { value: "both", label: "In-app + Push" },
];

const EMPTY_FORM: TemplateForm = {
  event_key: "",
  channel: "both",
  language: "en",
  title_template: "",
  body_template: "",
  variables: "",
  is_active: true,
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

function responseData(raw: any): any {
  return raw?.data || raw?.response?.data || {};
}

function responseMeta(raw: any): { code: string; description: string } {
  const response = raw?.response || raw?.data?.response || raw;
  return {
    code: String(response?.responsecode ?? "1"),
    description: String(response?.description || "Request failed."),
  };
}

function parseJsonObject(raw: string): Record<string, any> {
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Sample variables must be a JSON object.");
  }
  return parsed;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function languageLabel(code: string): string {
  const match = LANGUAGE_OPTIONS.find((item) => item.value === code);
  return match ? `${match.short} · ${match.label}` : code.toUpperCase();
}

export const NotificationTemplates: React.FC = () => {
  const { i18n } = useTranslation();
  const { can } = usePermissions();
  const username = currentUsername();
  const language = normalizeLanguageCode(i18n.language);
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<TemplateForm>();

  const canView = useMemo(() => can("notification_templates.view", "VIEW"), [can]);
  const canUpdate = useMemo(() => can("notification_templates.update", "UPDATE"), [can]);
  const canTest = useMemo(() => can("notification_templates.test", "CREATE"), [can]);

  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [total, setTotal] = useState(0);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [filterLanguage, setFilterLanguage] = useState<string | undefined>();
  const [filterChannel, setFilterChannel] = useState<string | undefined>();
  const [filterStatus, setFilterStatus] = useState<"active" | "inactive" | undefined>();

  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [saving, setSaving] = useState(false);
  const [sampleVariables, setSampleVariables] = useState(
    '{"party_type":"FARMER","org_name":"Demo Org","mandi_name":"Demo Mandi"}',
  );
  const [preview, setPreview] = useState({ title: "", body: "" });
  const [testTarget, setTestTarget] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [validating, setValidating] = useState(false);
  const [englishValidation, setEnglishValidation] = useState<{
    valid: boolean;
    text: string;
  } | null>(null);

  const loadData = useCallback(async () => {
    if (!username || !canView) return;
    setLoading(true);
    try {
      const resp = await fetchNotificationTemplates({
        username,
        language,
        filters: {
          page,
          page_size: pageSize,
          q: search || undefined,
          language: filterLanguage,
          channel: filterChannel,
          is_active:
            filterStatus === undefined ? undefined : filterStatus === "active",
        },
      });
      const meta = responseMeta(resp);
      if (meta.code !== "0") throw new Error(meta.description);
      const data = responseData(resp);
      const list = Array.isArray(data?.items) ? data.items : [];
      setRows(
        list.map((item: any) => ({
          ...item,
          id: String(item?._id || `${item?.event_key || "template"}-${item?.language || "en"}`),
          is_active: item?.is_active !== false,
        })),
      );
      setTotal(Number(data?.pagination?.total || 0));
    } catch (err: any) {
      messageApi.error(err?.message || "Unable to load notification templates.");
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [canView, filterChannel, filterLanguage, filterStatus, language, messageApi, page, pageSize, search, username]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openAdd = () => {
    setEditingId("");
    form.setFieldsValue(EMPTY_FORM);
    setPreview({ title: "", body: "" });
    setTestTarget("");
    setEditorOpen(true);
  };

  const openEdit = (row: TemplateRow) => {
    setEditingId(row._id || row.id);
    form.setFieldsValue({
      event_key: row.event_key || "",
      channel: row.channel || "both",
      language: row.language || "en",
      title_template: row.title_template || "",
      body_template: row.body_template || "",
      variables: Array.isArray(row.variables) ? row.variables.join(", ") : "",
      is_active: row.is_active !== false,
    });
    setPreview({ title: "", body: "" });
    setTestTarget("");
    setEditorOpen(true);
  };

  const handleSave = async () => {
    if (!username || !canUpdate) return;
    try {
      const values = await form.validateFields();
      setSaving(true);
      const resp = await saveNotificationTemplate({
        ...values,
        _id: editingId || undefined,
        event_key: values.event_key.trim().toUpperCase(),
        username,
        language,
        template_language: values.language,
      });
      const meta = responseMeta(resp);
      if (meta.code !== "0") throw new Error(meta.description);
      messageApi.success("Notification template saved.");
      setEditorOpen(false);
      await loadData();
    } catch (err: any) {
      if (err?.errorFields) return;
      messageApi.error(err?.message || "Unable to save notification template.");
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!username) return;
    try {
      const values = await form.validateFields(["title_template", "body_template"]);
      const sample = parseJsonObject(sampleVariables);
      setPreviewing(true);
      const resp = await previewNotificationTemplate({
        username,
        language,
        title_template: values.title_template,
        body_template: values.body_template,
        sample_variables: sample,
      });
      const meta = responseMeta(resp);
      if (meta.code !== "0") throw new Error(meta.description);
      setPreview(responseData(resp) || { title: "", body: "" });
    } catch (err: any) {
      if (err?.errorFields) return;
      messageApi.error(err?.message || "Preview failed.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleTestSend = async () => {
    if (!username || !canTest) return;
    try {
      const values = await form.validateFields(["event_key", "language"]);
      if (!testTarget.trim()) {
        messageApi.warning("Enter a test username or mobile number.");
        return;
      }
      const sample = parseJsonObject(sampleVariables);
      setTesting(true);
      const resp = await testSendNotificationTemplate({
        username,
        language,
        event_key: values.event_key.trim().toUpperCase(),
        template_language: values.language,
        target_username: testTarget.trim(),
        target_mobile: testTarget.trim(),
        sample_variables: sample,
      });
      const meta = responseMeta(resp);
      if (meta.code !== "0") throw new Error(meta.description);
      messageApi.success("Test notification submitted.");
    } catch (err: any) {
      if (err?.errorFields) return;
      messageApi.error(err?.message || "Test send failed.");
    } finally {
      setTesting(false);
    }
  };

  const handleValidateEnglish = async () => {
    if (!username) return;
    setValidating(true);
    try {
      const resp = await validateNotificationTemplatesEnglish({ username, language });
      const meta = responseMeta(resp);
      if (meta.code !== "0") throw new Error(meta.description);
      const data = responseData(resp);
      const missing = Array.isArray(data?.missing) ? data.missing : [];
      const valid = Boolean(data?.valid);
      setEnglishValidation({
        valid,
        text: valid
          ? "Every configured event has an English template."
          : `Missing English template: ${missing.map((item: any) => item.event_key).filter(Boolean).join(", ")}`,
      });
    } catch (err: any) {
      messageApi.error(err?.message || "English-template validation failed.");
    } finally {
      setValidating(false);
    }
  };

  const clearFilters = () => {
    setSearchDraft("");
    setSearch("");
    setFilterLanguage(undefined);
    setFilterChannel(undefined);
    setFilterStatus(undefined);
    setPage(1);
  };

  const pageStats = useMemo(() => {
    const active = rows.filter((row) => row.is_active).length;
    const events = new Set(rows.map((row) => row.event_key).filter(Boolean)).size;
    const languages = new Set(rows.map((row) => row.language).filter(Boolean)).size;
    return { active, events, languages };
  }, [rows]);

  const columns = useMemo<TableColumnsType<TemplateRow>>(
    () => [
      {
        title: "Event",
        dataIndex: "event_key",
        key: "event_key",
        width: 245,
        render: (value: string, row) => (
          <div className="cm-notification-template-event">
            <Text strong ellipsis={{ tooltip: value }}>{value}</Text>
            <Text type="secondary">v{row.version || 1}</Text>
          </div>
        ),
      },
      {
        title: "Language",
        dataIndex: "language",
        key: "language",
        width: 115,
        render: (value: string) => <Tag>{languageLabel(value)}</Tag>,
      },
      {
        title: "Channel",
        dataIndex: "channel",
        key: "channel",
        width: 125,
        render: (value: Channel) => (
          <Tag color={value === "push" ? "blue" : value === "both" ? "purple" : "green"}>
            {CHANNEL_OPTIONS.find((item) => item.value === value)?.label || value}
          </Tag>
        ),
      },
      {
        title: "Template",
        key: "template",
        width: 390,
        render: (_, row) => (
          <div className="cm-notification-template-copy">
            <Text strong ellipsis={{ tooltip: row.title_template }}>{row.title_template}</Text>
            <Text type="secondary" ellipsis={{ tooltip: row.body_template }}>{row.body_template}</Text>
          </div>
        ),
      },
      {
        title: "Variables",
        dataIndex: "variables",
        key: "variables",
        width: 165,
        render: (value: string[]) =>
          Array.isArray(value) && value.length ? (
            <Space size={[4, 4]} wrap>
              {value.slice(0, 3).map((item) => <Tag key={item}>{item}</Tag>)}
              {value.length > 3 ? <Tag>+{value.length - 3}</Tag> : null}
            </Space>
          ) : <Text type="secondary">None</Text>,
      },
      {
        title: "Status",
        dataIndex: "is_active",
        key: "is_active",
        width: 120,
        render: (value: boolean) => (
          <Tag
            className="cm-notification-status-tag"
            color={value ? "success" : "default"}
            icon={value ? <CheckCircleOutlined /> : <StopOutlined />}
          >
            {value ? "Active" : "Inactive"}
          </Tag>
        ),
      },
      {
        title: "Updated",
        dataIndex: "updated_on",
        key: "updated_on",
        width: 175,
        render: (value: string, row) => (
          <div className="cm-notification-template-updated">
            <Text>{formatDate(value)}</Text>
            {row.updated_by ? <Text type="secondary">{row.updated_by}</Text> : null}
          </div>
        ),
      },
      {
        title: "Actions",
        key: "actions",
        width: 78,
        align: "center",
        render: (_, row) => (
          <Button
            type="text"
            icon={<EditOutlined />}
            aria-label={`Edit ${row.event_key}`}
            disabled={!canUpdate}
            onClick={() => openEdit(row)}
          />
        ),
      },
    ],
    [canUpdate],
  );

  if (!canView) {
    return (
      <PageContainer className="cm-notification-templates-page">
        {contextHolder}
        <Alert type="error" showIcon message="Forbidden" description="You do not have permission to view notification templates." />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="cm-notification-templates-page">
      {contextHolder}
      <CmPageHeader
        eyebrow="SYSTEM · NOTIFICATIONS"
        title="Notification Templates"
        subtitle="Manage multilingual in-app and push notification copy, validate English fallbacks, preview variables and safely test delivery."
        breadcrumbs={[
          { title: "System" },
          { title: "Notifications" },
          { title: "Notification Templates" },
        ]}
        actions={
          <>
            <Button icon={<ReloadOutlined />} onClick={loadData} loading={loading}>Refresh</Button>
            <Button icon={<EyeOutlined />} onClick={handleValidateEnglish} loading={validating}>Validate English</Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={openAdd} disabled={!canUpdate}>Add template</Button>
          </>
        }
      />

      {englishValidation ? (
        <Alert
          className="cm-notification-validation-alert"
          type={englishValidation.valid ? "success" : "warning"}
          showIcon
          closable
          onClose={() => setEnglishValidation(null)}
          message={englishValidation.valid ? "English coverage complete" : "English fallback gaps found"}
          description={englishValidation.text}
        />
      ) : null}

      <Row gutter={[12, 12]} className="cm-notification-stat-row">
        <Col xs={24} sm={12} xl={6}>
          <CmStatCard label="Templates" value={total} helper="Current filtered catalogue" icon={<BellOutlined />} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <CmStatCard label="Active on page" value={pageStats.active} helper={`${rows.length} loaded`} icon={<CheckCircleOutlined />} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <CmStatCard label="Events on page" value={pageStats.events} helper="Unique event keys" icon={<GlobalOutlined />} />
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <CmStatCard label="Languages on page" value={pageStats.languages} helper="11 supported languages" icon={<TranslationOutlined />} tone="amber" />
        </Col>
      </Row>

      <CmSectionCard className="cm-notification-catalogue-card" compact>
        <div className="cm-notification-toolbar">
          <Input.Search
            allowClear
            value={searchDraft}
            placeholder="Search event key"
            onChange={(event) => setSearchDraft(event.target.value)}
            onSearch={(value) => {
              setPage(1);
              setSearch(value.trim());
            }}
          />
          <Select
            allowClear
            placeholder="All languages"
            value={filterLanguage}
            options={LANGUAGE_OPTIONS.map((item) => ({ value: item.value, label: `${item.short} · ${item.label}` }))}
            onChange={(value) => {
              setPage(1);
              setFilterLanguage(value);
            }}
          />
          <Select
            allowClear
            placeholder="All channels"
            value={filterChannel}
            options={CHANNEL_OPTIONS}
            onChange={(value) => {
              setPage(1);
              setFilterChannel(value);
            }}
          />
          <Select
            allowClear
            placeholder="All statuses"
            value={filterStatus}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
            onChange={(value) => {
              setPage(1);
              setFilterStatus(value);
            }}
          />
          <Button onClick={clearFilters}>Clear</Button>
        </div>

        <Table<TemplateRow>
          className="cm-notification-table"
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          scroll={{ x: 1415 }}
          locale={{ emptyText: <Empty description="No notification templates match the current filters." /> }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [10, 25, 50, 100],
            showTotal: (count) => `${count} templates`,
            onChange: (nextPage, nextPageSize) => {
              if (nextPageSize !== pageSize) {
                setPageSize(nextPageSize);
                setPage(1);
              } else {
                setPage(nextPage);
              }
            },
          }}
        />
      </CmSectionCard>

      <Modal
        className="cm-notification-template-modal"
        title={editingId ? "Edit notification template" : "Add notification template"}
        open={editorOpen}
        width={900}
        destroyOnHidden
        onCancel={() => setEditorOpen(false)}
        footer={
          <Space>
            <Button onClick={() => setEditorOpen(false)}>Cancel</Button>
            <Button type="primary" onClick={handleSave} loading={saving} disabled={!canUpdate}>Save template</Button>
          </Space>
        }
      >
        <Alert
          type="info"
          showIcon
          message="English is the fallback language"
          description="Create the English template for an event before adding its other language versions. Placeholders such as {{mandi_name}} are preserved exactly."
        />

        <Form<TemplateForm>
          form={form}
          layout="vertical"
          initialValues={EMPTY_FORM}
          className="cm-notification-editor-form"
        >
          <Row gutter={12}>
            <Col xs={24} lg={12}>
              <Form.Item
                label="Event key"
                name="event_key"
                rules={[{ required: true, whitespace: true, message: "Event key is required." }]}
              >
                <Input placeholder="e.g. MANDI_ASSOCIATION_APPROVED" onChange={(event) => {
                  const upper = event.target.value.toUpperCase();
                  form.setFieldValue("event_key", upper);
                }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Form.Item label="Channel" name="channel" rules={[{ required: true }]}> 
                <Select options={CHANNEL_OPTIONS} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Form.Item label="Language" name="language" rules={[{ required: true }]}> 
                <Select options={LANGUAGE_OPTIONS.map((item) => ({ value: item.value, label: `${item.short} · ${item.label}` }))} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label="Title template" name="title_template" rules={[{ required: true, whitespace: true, message: "Title template is required." }]}> 
            <Input placeholder="Notification title" />
          </Form.Item>

          <Form.Item label="Body template" name="body_template" rules={[{ required: true, whitespace: true, message: "Body template is required." }]}> 
            <TextArea rows={5} spellCheck={false} placeholder="Notification body with optional {{variables}}" />
          </Form.Item>

          <Form.Item
            label="Variables"
            name="variables"
            extra="Comma-separated variable names used by this template."
          >
            <Input placeholder="party_type, org_name, mandi_name" />
          </Form.Item>

          <Form.Item label="Active" name="is_active" valuePropName="checked">
            <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
          </Form.Item>
        </Form>

        <CmSectionCard
          className="cm-notification-preview-card"
          title="Preview & test"
          subtitle="Render the current draft using sample values before saving or test delivery."
          compact
        >
          <Text className="cm-notification-field-label">Sample variables JSON</Text>
          <TextArea
            rows={4}
            spellCheck={false}
            value={sampleVariables}
            onChange={(event) => setSampleVariables(event.target.value)}
          />

          <div className="cm-notification-preview-actions">
            <Button icon={<EyeOutlined />} onClick={handlePreview} loading={previewing}>Preview</Button>
            <Input
              value={testTarget}
              onChange={(event) => setTestTarget(event.target.value)}
              placeholder="Test username or mobile"
            />
            <Button
              icon={<SendOutlined />}
              onClick={handleTestSend}
              loading={testing}
              disabled={!canTest || !testTarget.trim()}
            >
              Test send
            </Button>
          </div>

          {preview.title || preview.body ? (
            <div className="cm-notification-preview-output">
              <Text strong>{preview.title || "Untitled notification"}</Text>
              <Paragraph>{preview.body}</Paragraph>
            </div>
          ) : null}
        </CmSectionCard>
      </Modal>
    </PageContainer>
  );
};

export default NotificationTemplates;
