import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Form,
  Input,
  Modal,
  Row,
  Dropdown,
  Space,
  Statistic,
  Switch,
  Segmented,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import {
  EditOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  DownOutlined,
} from "@ant-design/icons";
import { ActionGate } from "../../authz/ActionGate";
import "./resourceRegistry.css";
import { StepUpGuard } from "../../components/StepUpGuard";
import { useStepUp } from "../../security/stepup/useStepUp";
import {
  fetchResourceRegistry,
  updateResourceRegistry,
} from "../../services/resourceRegistryApi";

const { Text } = Typography;

type RegistryEntry = {
  resource_key: string;
  module?: string | null;
  allowed_actions: string[];
  description?: string | null;
  aliases?: string[];
  is_active?: "Y" | "N";
  version?: number;
  created_on?: string;
  created_by?: string;
  updated_on?: string;
  updated_by?: string;
};

type RegistryFormValues = {
  resource_key: string;
  module: string;
  description?: string;
  allowed_actions: string[];
  aliases?: string;
  is_active: boolean;
};

const DEFAULT_PAGE_SIZE = 25;

function responseData(resp: any) {
  return resp?.data || resp?.response?.data || {};
}

function responseError(resp: any, fallback: string) {
  return resp?.response?.description || fallback;
}

function normalizeStringList(values: unknown[]) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

function normalizeActions(values: unknown[]) {
  return normalizeStringList(values).map((value) => value.toUpperCase());
}

const ResourceRegistryPage: React.FC = () => {
  const rawUser = typeof window !== "undefined" ? localStorage.getItem("cd_user") : null;
  const parsedUser = rawUser ? JSON.parse(rawUser) : null;
  const username: string = parsedUser?.username || "";
  const { ensureStepUp } = useStepUp();
  const [messageApi, contextHolder] = message.useMessage();
  const [form] = Form.useForm<RegistryFormValues>();

  const [rows, setRows] = useState<RegistryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusSavingKey, setStatusSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [modules, setModules] = useState<string[]>([]);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"" | "Y" | "N">("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RegistryEntry | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setPage(1);
      setSearch(searchInput.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const loadRegistry = useCallback(async () => {
    if (!username) return;
    try {
      setLoading(true);
      setError(null);
      const resp = await fetchResourceRegistry({
        username,
        page,
        pageSize,
        search,
        module: moduleFilter,
        status: statusFilter,
      });
      if (resp?.response?.responsecode !== "0") {
        setRows([]);
        setError(responseError(resp, "Failed to load resource registry."));
        return;
      }
      const data = responseData(resp);
      setRows(Array.isArray(data.registry) ? data.registry : []);
      setTotal(Number(data?.pagination?.total || 0));
      setSummary({
        total: Number(data?.summary?.total || 0),
        active: Number(data?.summary?.active || 0),
        inactive: Number(data?.summary?.inactive || 0),
      });
      setModules(Array.isArray(data.modules) ? data.modules : []);
    } catch (err: any) {
      setRows([]);
      setError(err?.message || "Failed to load resource registry.");
    } finally {
      setLoading(false);
    }
  }, [username, page, pageSize, search, moduleFilter, statusFilter]);

  useEffect(() => {
    loadRegistry();
  }, [loadRegistry]);

  const valuesForEntry = (entry: RegistryEntry | null): RegistryFormValues => ({
    resource_key: entry?.resource_key || "",
    module: String(entry?.module || ""),
    description: String(entry?.description || ""),
    allowed_actions: entry ? normalizeActions(entry.allowed_actions || []) : ["VIEW"],
    aliases: entry ? normalizeStringList(entry.aliases || []).join(", ") : "",
    is_active: entry ? entry.is_active !== "N" : true,
  });

  const openCreate = () => {
    const nextValues = valuesForEntry(null);
    setEditing(null);
    form.resetFields();
    form.setFieldsValue(nextValues);
    setModalOpen(true);
  };

  const openEdit = (entry: RegistryEntry) => {
    const nextValues = valuesForEntry(entry);
    setEditing(entry);
    form.resetFields();
    form.setFieldsValue(nextValues);
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    form.resetFields();
  };

  const saveValues = async (values: RegistryFormValues) => {
    const resourceKey = String(values.resource_key || "").trim();
    const allowedActions = editing
      ? normalizeActions(editing.allowed_actions || [])
      : normalizeActions(values.allowed_actions || []);
    if (!allowedActions.length) {
      messageApi.error("At least one allowed action is required.");
      return;
    }

    const stepupOk = await ensureStepUp(
      editing ? "resource_registry.edit" : "resource_registry.create",
      editing ? "UPDATE" : "CREATE",
      { source: "OTHER", force: true },
    );
    if (!stepupOk) return;

    const entry = {
      resource_key: resourceKey,
      module: String(values.module || "").trim(),
      description: String(values.description || "").trim(),
      allowed_actions: allowedActions,
      aliases: normalizeStringList(String(values.aliases || "").split(",")),
      is_active: values.is_active ? "Y" : "N",
      ...(editing?.version ? { expected_version: Number(editing.version) } : {}),
    };

    try {
      setSaving(true);
      const resp = await updateResourceRegistry({ username, entries: [entry] });
      if (resp?.response?.responsecode !== "0") {
        const failAt = String(resp?.response?.failAt || "");
        if (failAt === "RESOURCE_VERSION_CONFLICT") {
          messageApi.error("This resource changed in another session. The table has been refreshed.");
          setModalOpen(false);
          setEditing(null);
          form.resetFields();
          await loadRegistry();
          return;
        }
        messageApi.error(responseError(resp, "Failed to save resource."));
        return;
      }
      messageApi.success(editing ? "Resource updated." : "Resource created.");
      setModalOpen(false);
      setEditing(null);
      form.resetFields();
      await loadRegistry();
    } catch (err: any) {
      messageApi.error(err?.message || "Failed to save resource.");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (entry: RegistryEntry) => {
    const nextStatus: "Y" | "N" = entry.is_active === "N" ? "Y" : "N";
    if (nextStatus === "N") {
      const confirmed = await new Promise<boolean>((resolve) => {
        Modal.confirm({
          title: "Deactivate resource?",
          content: (
            <Space direction="vertical" size={4}>
              <Text>This can affect role-policy authorization and UI access.</Text>
              <Text code>{entry.resource_key}</Text>
            </Space>
          ),
          okText: "Deactivate",
          okButtonProps: { danger: true },
          cancelText: "Cancel",
          onOk: () => resolve(true),
          onCancel: () => resolve(false),
        });
      });
      if (!confirmed) return;
    }

    const stepupOk = await ensureStepUp("resource_registry.edit", "UPDATE", {
      source: "OTHER",
      force: true,
    });
    if (!stepupOk) return;

    try {
      setStatusSavingKey(entry.resource_key);
      const resp = await updateResourceRegistry({
        username,
        entries: [
          {
            ...entry,
            expected_version: Number(entry.version || 0),
            is_active: nextStatus,
          },
        ],
      });
      if (resp?.response?.responsecode !== "0") {
        const failAt = String(resp?.response?.failAt || "");
        if (failAt === "RESOURCE_VERSION_CONFLICT") {
          messageApi.error("This resource changed in another session. The table has been refreshed.");
          await loadRegistry();
          return;
        }
        messageApi.error(responseError(resp, "Failed to update resource status."));
        return;
      }
      messageApi.success(nextStatus === "Y" ? "Resource activated." : "Resource deactivated.");
      await loadRegistry();
    } catch (err: any) {
      messageApi.error(err?.message || "Failed to update resource status.");
    } finally {
      setStatusSavingKey(null);
    }
  };

  const columns = useMemo<ColumnsType<RegistryEntry>>(
    () => [
      {
        title: "Resource Key",
        dataIndex: "resource_key",
        key: "resource_key",
        width: 300,
        render: (value: string, row) => (
          <Space direction="vertical" size={2}>
            <Text strong copyable>{value}</Text>
            {row.description ? <Text type="secondary">{row.description}</Text> : null}
          </Space>
        ),
      },
      {
        title: "Module",
        dataIndex: "module",
        key: "module",
        width: 190,
        render: (value?: string | null) => value || "—",
      },
      {
        title: "Allowed Actions",
        dataIndex: "allowed_actions",
        key: "allowed_actions",
        width: 260,
        render: (actions: string[]) => (
          <Space size={[4, 4]} wrap>
            {(actions || []).map((action) => <Tag key={action}>{action}</Tag>)}
          </Space>
        ),
      },
      {
        title: "Aliases",
        dataIndex: "aliases",
        key: "aliases",
        width: 220,
        render: (aliases?: string[]) =>
          aliases?.length ? (
            <Space size={[4, 4]} wrap>
              {aliases.map((alias) => <Tag key={alias}>{alias}</Tag>)}
            </Space>
          ) : "—",
      },
      {
        title: "Status",
        dataIndex: "is_active",
        key: "is_active",
        width: 110,
        render: (value?: string) => (
          <Tag color={value === "N" ? "default" : "success"}>{value === "N" ? "Inactive" : "Active"}</Tag>
        ),
      },
      {
        title: "Version",
        dataIndex: "version",
        key: "version",
        width: 90,
        render: (value?: number) => value || 1,
      },
      {
        title: "Updated",
        key: "updated",
        width: 190,
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <Text>{row.updated_by || "—"}</Text>
            <Text type="secondary">
              {row.updated_on ? new Date(row.updated_on).toLocaleString() : "—"}
            </Text>
          </Space>
        ),
      },
      {
        title: "Actions",
        key: "actions",
        fixed: "right",
        width: 180,
        render: (_, row) => (
          <Space>
            <ActionGate resourceKey="resource_registry.edit" action="UPDATE" record={row}>
              <Tooltip title="Edit resource">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)}>
                  Edit
                </Button>
              </Tooltip>
            </ActionGate>
            <ActionGate resourceKey="resource_registry.edit" action="UPDATE" record={row}>
              <Switch
                size="small"
                checked={row.is_active !== "N"}
                loading={statusSavingKey === row.resource_key}
                onChange={() => changeStatus(row)}
              />
            </ActionGate>
          </Space>
        ),
      },
    ],
    [statusSavingKey],
  );

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total,
    showSizeChanger: false,
    showTotal: (value) => `${value} resources`,
    onChange: (nextPage) => {
      setPage(nextPage);
    },
  };

  if (!username) {
    return <Alert type="warning" showIcon message="Please log in." />;
  }

  return (
    <StepUpGuard username={username} resourceKey="resource_registry.menu">
      {contextHolder}
      <div className="cm-page cm-resource-registry-page">
        <div className="cm-page-header">
          <h1 className="cm-page-title">Resource Registry</h1>
          <div className="cm-page-subtitle">
            Canonical RBAC resource keys, actions, aliases and activation state.
          </div>
        </div>

        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {error ? <Alert type="error" showIcon message="Resource Registry could not be loaded" description={error} /> : null}

          <Row gutter={[12, 12]}>
            <Col xs={12} md={6}><Card loading={loading && summary.total === 0}><Statistic title="Total Resources" value={summary.total} /></Card></Col>
            <Col xs={12} md={6}><Card loading={loading && summary.total === 0}><Statistic title="Active" value={summary.active} /></Card></Col>
            <Col xs={12} md={6}><Card loading={loading && summary.total === 0}><Statistic title="Inactive" value={summary.inactive} /></Card></Col>
            <Col xs={12} md={6}><Card loading={loading && summary.total === 0}><Statistic title="Modules" value={modules.length} /></Card></Col>
          </Row>

          <Card bordered={false}>
            <Row gutter={[12, 12]} align="middle">
              <Col xs={24} lg={9}>
                <Input
                  className="cm-resource-registry-search"
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="Search resource key, module, description or alias"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                />
              </Col>
              <Col xs={24} sm={12} lg={5}>
                <Dropdown
                  trigger={["click"]}
                  menu={{
                    selectedKeys: [moduleFilter || "__ALL__"],
                    items: [
                      { key: "__ALL__", label: "All modules" },
                      ...modules.map((module) => ({ key: module, label: module })),
                    ],
                    onClick: ({ key }) => {
                      setPage(1);
                      setModuleFilter(key === "__ALL__" ? "" : String(key));
                    },
                  }}
                >
                  <Button className="cm-resource-registry-filter-button" block>
                    <span>{moduleFilter || "All modules"}</span>
                    <DownOutlined />
                  </Button>
                </Dropdown>
              </Col>
              <Col xs={24} sm={12} lg={4}>
                <Dropdown
                  trigger={["click"]}
                  menu={{
                    selectedKeys: [statusFilter || "__ALL__"],
                    items: [
                      { key: "__ALL__", label: "All statuses" },
                      { key: "Y", label: "Active" },
                      { key: "N", label: "Inactive" },
                    ],
                    onClick: ({ key }) => {
                      setPage(1);
                      setStatusFilter((key === "__ALL__" ? "" : key) as "" | "Y" | "N");
                    },
                  }}
                >
                  <Button className="cm-resource-registry-filter-button" block>
                    <span>{statusFilter === "Y" ? "Active" : statusFilter === "N" ? "Inactive" : "All statuses"}</span>
                    <DownOutlined />
                  </Button>
                </Dropdown>
              </Col>
              <Col xs={24} lg={6}>
                <Space style={{ width: "100%", justifyContent: "flex-end" }}>
                  <Button icon={<ReloadOutlined />} onClick={loadRegistry} loading={loading}>
                    Refresh
                  </Button>
                  <ActionGate resourceKey="resource_registry.create" action="CREATE">
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                      Add Resource
                    </Button>
                  </ActionGate>
                </Space>
              </Col>
            </Row>
          </Card>

          <Alert
            type="info"
            showIcon
            message="Registry is authoritative"
            description="Changing actions, aliases or activation can affect authorization across Web and API. Updates require step-up verification and are audit logged."
          />

          <Card bordered={false}>
            <div className="cm-resource-registry-table-toolbar">
              <Text type="secondary">Rows per page</Text>
              <Segmented
                size="small"
                value={pageSize}
                options={[10, 25, 50, 100]}
                onChange={(value) => {
                  setPage(1);
                  setPageSize(Number(value));
                }}
              />
            </div>
            <Table<RegistryEntry>
              rowKey="resource_key"
              columns={columns}
              dataSource={rows}
              loading={loading}
              pagination={pagination}
              scroll={{ x: 1500 }}
              locale={{ emptyText: error ? "Unable to load resources." : "No resources match the current filters." }}
            />
          </Card>
        </Space>

        <Modal
          title={editing ? "Edit Resource" : "Add Resource"}
          open={modalOpen}
          className="cm-resource-registry-modal"
          width={620}
          onCancel={closeModal}
          onOk={() => form.submit()}
          confirmLoading={saving}
          okText={editing ? "Save Changes" : "Create Resource"}
          forceRender
        >
          <Form<RegistryFormValues>
            form={form}
            layout="vertical"
            onFinish={saveValues}
          >
            <Form.Item
              label="Resource Key"
              name="resource_key"
              rules={[
                { required: true, message: "Resource key is required." },
                {
                  pattern: /^[a-z0-9][a-z0-9_]*(?:\.[a-z0-9][a-z0-9_]*)+$/i,
                  message: "Use dot-separated resource segments, for example module.action.",
                },
              ]}
            >
              <Input disabled={Boolean(editing)} placeholder="example_module.view" />
            </Form.Item>

            <Form.Item label="Module" name="module" rules={[{ required: true, message: "Module is required." }]}>
              <Input placeholder="Module name" />
            </Form.Item>

            <Form.Item label="Description" name="description">
              <Input.TextArea rows={3} maxLength={500} showCount />
            </Form.Item>

            {editing ? (
              <Form.Item label="Allowed Actions">
                <div className="cm-resource-registry-readonly-actions">
                  <Space size={[6, 6]} wrap>
                    {normalizeActions(editing.allowed_actions || []).map((action) => (
                      <Tag key={action}>{action}</Tag>
                    ))}
                  </Space>
                  <Text type="secondary" className="cm-resource-registry-action-note">
                    Supported actions are structural RBAC metadata and are read-only during normal Edit.
                  </Text>
                </div>
              </Form.Item>
            ) : (
              <Form.Item
                label="Allowed Actions"
                name="allowed_actions"
                rules={[{ required: true, message: "At least one action is required." }]}
                extra="For a new resource, enter the exact actions this resource supports, separated by commas."
                getValueFromEvent={(event) => normalizeActions(String(event?.target?.value || "").split(","))}
                getValueProps={(value) => ({ value: normalizeActions(value || []).join(", ") })}
              >
                <Input placeholder="VIEW or VIEW, UPDATE_STATUS" />
              </Form.Item>
            )}

            <Form.Item
              label="Aliases"
              name="aliases"
              extra="Optional legacy resource keys. Separate multiple aliases with commas."
            >
              <Input placeholder="legacy.resource, old.resource" />
            </Form.Item>

            <Form.Item label="Active" name="is_active" valuePropName="checked">
              <Switch checkedChildren="Active" unCheckedChildren="Inactive" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </StepUpGuard>
  );
};

export default ResourceRegistryPage;
