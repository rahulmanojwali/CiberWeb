import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Input,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { ReloadOutlined, SearchOutlined } from "@ant-design/icons";
import { StepUpGuard } from "../../components/StepUpGuard";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { fetchResourceRegistry } from "../../services/resourceRegistryApi";

const { Text } = Typography;

type UiResource = {
  resource_key: string;
  action_code?: string;
  ui_type?: string;
  route?: string | null;
  screen?: string | null;
  element?: string | null;
  is_active?: string | boolean;
};

type RegistryEntry = {
  resource_key: string;
  allowed_actions: string[];
  aliases?: string[];
  is_active?: string | boolean;
  module?: string | null;
};

type MismatchRow = {
  key: string;
  resource_key: string;
  ui_action?: string;
  registry_actions?: string[];
  reason: string;
  module?: string | null;
};

const normalizeKey = (value: string) => String(value || "").trim();
const normalizeAction = (value: string) => String(value || "").trim().toUpperCase();
const isActive = (value: string | boolean | undefined) => value === true || value === "Y" || value === undefined;

const ResourceHealthPage: React.FC = () => {
  const rawUser = typeof window !== "undefined" ? localStorage.getItem("cd_user") : null;
  const parsedUser = rawUser ? JSON.parse(rawUser) : null;
  const username: string = parsedUser?.username || "";
  const { ui_resources } = useAdminUiConfig();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [registry, setRegistry] = useState<RegistryEntry[]>([]);
  const [query, setQuery] = useState("");

  const load = async () => {
    if (!username) return;
    try {
      setLoading(true);
      setError(null);
      const resp = await fetchResourceRegistry({ username });
      if (resp?.response?.responsecode !== "0") {
        setError(resp?.response?.description || "Failed to load registry");
      }
      setRegistry(resp?.data?.registry || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load registry");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const registryMap = useMemo(() => {
    const map = new Map<string, RegistryEntry>();
    registry.filter((entry) => isActive(entry.is_active)).forEach((entry) => {
      const key = normalizeKey(entry.resource_key);
      if (key) map.set(key, entry);
    });
    return map;
  }, [registry]);

  const uiMap = useMemo(() => {
    const map = new Map<string, UiResource[]>();
    (ui_resources || []).filter((entry: UiResource) => isActive(entry.is_active)).forEach((entry: UiResource) => {
      const key = normalizeKey(entry.resource_key);
      if (!key) return;
      const list = map.get(key) || [];
      list.push(entry);
      map.set(key, list);
    });
    return map;
  }, [ui_resources]);

  const health = useMemo(() => {
    const missingRegistry: MismatchRow[] = [];
    const registryOnly: MismatchRow[] = [];
    const actionMismatch: MismatchRow[] = [];

    uiMap.forEach((entries, key) => {
      const registryEntry = registryMap.get(key);
      if (!registryEntry) {
        entries.forEach((entry, index) => {
          missingRegistry.push({
            key: `${key}-${entry.action_code || index}`,
            resource_key: key,
            ui_action: entry.action_code,
            reason: "Active UI resource has no registry definition",
          });
        });
        return;
      }

      const allowed = (registryEntry.allowed_actions || []).map(normalizeAction);
      const allowedSet = new Set(allowed);
      entries.forEach((entry, index) => {
        const action = normalizeAction(entry.action_code || "");
        if (action && !allowedSet.has(action)) {
          actionMismatch.push({
            key: `${key}-${action}-${index}`,
            resource_key: key,
            ui_action: action,
            registry_actions: allowed,
            module: registryEntry.module,
            reason: "UI action is not allowed by the registry",
          });
        }
      });
    });

    registryMap.forEach((entry, key) => {
      if (!uiMap.has(key)) {
        registryOnly.push({
          key,
          resource_key: key,
          registry_actions: entry.allowed_actions || [],
          module: entry.module,
          reason: "Registry-only authorization resource",
        });
      }
    });

    return { missingRegistry, registryOnly, actionMismatch };
  }, [registryMap, uiMap]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return health;
    const filterRows = (rows: MismatchRow[]) => rows.filter((row) =>
      row.resource_key.toLowerCase().includes(q) || String(row.module || "").toLowerCase().includes(q)
    );
    return {
      missingRegistry: filterRows(health.missingRegistry),
      registryOnly: filterRows(health.registryOnly),
      actionMismatch: filterRows(health.actionMismatch),
    };
  }, [health, query]);

  const blockingIssues = health.missingRegistry.length + health.actionMismatch.length;

  const issueColumns: ColumnsType<MismatchRow> = [
    {
      title: "Resource Key",
      dataIndex: "resource_key",
      key: "resource_key",
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: "UI Action",
      dataIndex: "ui_action",
      key: "ui_action",
      width: 150,
      render: (value?: string) => value ? <Tag>{value}</Tag> : "—",
    },
    {
      title: "Registry Actions",
      dataIndex: "registry_actions",
      key: "registry_actions",
      render: (actions?: string[]) => (
        <Space size={[4, 4]} wrap>
          {(actions || []).map((action) => <Tag key={action}>{action}</Tag>)}
          {(!actions || actions.length === 0) && "—"}
        </Space>
      ),
    },
    {
      title: "Reason",
      dataIndex: "reason",
      key: "reason",
    },
  ];

  const registryOnlyColumns: ColumnsType<MismatchRow> = [
    {
      title: "Resource Key",
      dataIndex: "resource_key",
      key: "resource_key",
      render: (value: string) => <Text strong>{value}</Text>,
    },
    {
      title: "Module",
      dataIndex: "module",
      key: "module",
      width: 220,
      render: (value?: string | null) => value || "—",
    },
    {
      title: "Allowed Actions",
      dataIndex: "registry_actions",
      key: "registry_actions",
      render: (actions?: string[]) => (
        <Space size={[4, 4]} wrap>
          {(actions || []).map((action) => <Tag key={action}>{action}</Tag>)}
        </Space>
      ),
    },
  ];

  if (!username) return <Alert type="warning" showIcon message="Please log in." />;

  return (
    <StepUpGuard username={username} resourceKey="resource_health.menu">
      <div className="cm-page">
        <div className="cm-page-header">
          <h1 className="cm-page-title">Resource Health</h1>
          <div className="cm-page-subtitle">
            Validate active UI permissions against the canonical resource registry.
          </div>
        </div>

        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Row gutter={[12, 12]}>
            <Col xs={24} md={8}>
              <Card className="cm-card">
                <Statistic title="Blocking Issues" value={blockingIssues} valueStyle={{ color: blockingIssues ? undefined : "inherit" }} />
                <Text type="secondary">Missing registry definitions or invalid UI actions.</Text>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card className="cm-card">
                <Statistic title="Active UI Resources" value={uiMap.size} />
                <Text type="secondary">Resources currently exposed by the admin UI.</Text>
              </Card>
            </Col>
            <Col xs={24} md={8}>
              <Card className="cm-card">
                <Statistic title="Registry-only Resources" value={health.registryOnly.length} />
                <Text type="secondary">Informational: backend/action resources do not all require UI rows.</Text>
              </Card>
            </Col>
          </Row>

          {blockingIssues === 0 ? (
            <Alert
              type="success"
              showIcon
              message="Resource health is clean"
              description="Every active UI resource exists in the registry and every UI action is permitted by its registry definition."
            />
          ) : (
            <Alert
              type="warning"
              showIcon
              message={`${blockingIssues} blocking resource issue${blockingIssues === 1 ? "" : "s"} found`}
              description="Resolve these before changing role policies."
            />
          )}

          <Card className="cm-card">
            <Space.Compact style={{ width: "100%", maxWidth: 620 }}>
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Search resource key or module"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>
                Refresh
              </Button>
            </Space.Compact>
          </Card>

          {error && <Alert type="error" showIcon message={error} />}

          <Card className="cm-card" title={`UI keys missing in Registry (${filtered.missingRegistry.length})`}>
            <Text type="secondary">
              These are blocking issues because the UI is exposing a permission key that the authorization registry does not define.
            </Text>
            <Table
              style={{ marginTop: 12 }}
              size="small"
              rowKey="key"
              columns={issueColumns}
              dataSource={filtered.missingRegistry}
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              loading={loading}
              locale={{ emptyText: "No missing registry definitions." }}
            />
          </Card>

          <Card className="cm-card" title={`Action mismatches (${filtered.actionMismatch.length})`}>
            <Text type="secondary">
              These are blocking issues because the UI action does not match the action enforced by the canonical registry/API permission.
            </Text>
            <Table
              style={{ marginTop: 12 }}
              size="small"
              rowKey="key"
              columns={issueColumns}
              dataSource={filtered.actionMismatch}
              pagination={{ pageSize: 10, hideOnSinglePage: true }}
              loading={loading}
              locale={{ emptyText: "No action mismatches." }}
            />
          </Card>

          <Card className="cm-card" title={`Registry-only resources (${filtered.registryOnly.length})`}>
            <Alert
              type="info"
              showIcon
              message="Informational, not a health failure"
              description="cm_resource_registry is the authorization source of truth and intentionally contains backend/action resources that do not need a cm_ui_resources row. Review these only when retiring legacy functionality or adding a visible UI control."
              style={{ marginBottom: 12 }}
            />
            <Table
              size="small"
              rowKey="key"
              columns={registryOnlyColumns}
              dataSource={filtered.registryOnly}
              pagination={{ pageSize: 15, showSizeChanger: false }}
              loading={loading}
            />
          </Card>
        </Space>
      </div>
    </StepUpGuard>
  );
};

export default ResourceHealthPage;
