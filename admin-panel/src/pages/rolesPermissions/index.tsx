import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Col,
  Drawer,
  Input,
  Modal,
  Pagination,
  Row,
  Select,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  HistoryOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  UndoOutlined,
} from "@ant-design/icons";
import {
  fetchRolePoliciesDashboardData,
  fetchRolePolicyHistory,
  restoreRolePolicyVersion,
  updateRolePolicies,
} from "../../services/rolePoliciesApi";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { canonicalizeResourceKey } from "../../utils/adminUiConfig";
import { StepUpGuard } from "../../components/StepUpGuard";
import { useStepUpContext } from "../../security/stepup/StepUpContext";

const { Text } = Typography;

function currentUsername(): string {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return String(parsed?.username || "").trim();
  } catch {
    return "";
  }
}

type PolicyEntry = { resource_key: string; actions: string[] };
type RoleEntry = {
  role_slug: string;
  role_name?: string;
  source?: "SYSTEM" | "RUNTIME" | string;
  is_protected?: "Y" | "N" | string;
  scope?: any;
  version?: number;
};
type RegistryEntry = {
  resource_key: string;
  module?: string;
  allowed_actions: string[];
  description?: string;
  aliases?: string[];
  is_active?: string | boolean;
};
type UiOnlyResource = {
  key: string;
  resource_key: string;
  action_code?: string;
  screen?: string;
  route?: string;
};
type HistoryEntry = {
  _id: string;
  role_slug: string;
  policy_collection: string;
  snapshot_version: number;
  permissions?: PolicyEntry[];
  snapshot_reason?: string;
  changed_by?: string;
  changed_on?: string;
};

const normalizeKey = (value: string) => {
  const canonical = canonicalizeResourceKey(String(value || "").trim());
  return String(canonical || value || "").trim().toLowerCase();
};
const normalizeAction = (value: string) => String(value || "").trim().toUpperCase();
const isActive = (value: string | boolean | undefined) =>
  value === undefined || value === true || String(value).trim().toUpperCase() === "Y";

function normalizePolicyEntries(entries: PolicyEntry[], registryMap: Map<string, RegistryEntry>) {
  const merged = new Map<string, Set<string>>();
  (entries || []).forEach((entry) => {
    const key = normalizeKey(entry?.resource_key);
    if (!key) return;
    const registry = registryMap.get(key);
    const allowed = new Set((registry?.allowed_actions || []).map(normalizeAction));
    const actions = (entry?.actions || [])
      .map(normalizeAction)
      .filter(Boolean)
      .filter((action) => !allowed.size || allowed.has(action));
    if (!actions.length) return;
    const set = merged.get(key) || new Set<string>();
    actions.forEach((action) => set.add(action));
    merged.set(key, set);
  });
  return Array.from(merged.entries())
    .map(([resource_key, actions]) => ({ resource_key, actions: Array.from(actions).sort() }))
    .sort((a, b) => a.resource_key.localeCompare(b.resource_key));
}

function policyFingerprint(entries: PolicyEntry[]) {
  return JSON.stringify(
    (entries || [])
      .map((entry) => ({
        resource_key: normalizeKey(entry.resource_key),
        actions: Array.from(new Set((entry.actions || []).map(normalizeAction))).sort(),
      }))
      .filter((entry) => entry.resource_key && entry.actions.length)
      .sort((a, b) => a.resource_key.localeCompare(b.resource_key)),
  );
}

function unwrapDashboardPayload(resp: any) {
  if (resp?.data?.roles || resp?.data?.registry || resp?.data?.policiesByRole) return resp.data;
  if (resp?.data?.data?.roles || resp?.data?.data?.registry || resp?.data?.data?.policiesByRole) return resp.data.data;
  if (resp?.data?.items?.roles || resp?.data?.items?.registry || resp?.data?.items?.policiesByRole) return resp.data.items;
  if (resp?.roles || resp?.registry || resp?.policiesByRole) return resp;
  return {};
}

function unwrapHistoryPayload(resp: any) {
  if (resp?.data?.history || resp?.data?.pagination) return resp.data;
  if (resp?.data?.data?.history || resp?.data?.data?.pagination) return resp.data.data;
  if (resp?.history || resp?.pagination) return resp;
  return {};
}

const RolesPermissionsPage: React.FC = () => {
  const username = currentUsername();
  const { refresh, ui_resources } = useAdminUiConfig();
  const { ensureStepUp } = useStepUpContext();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [roles, setRoles] = useState<RoleEntry[]>([]);
  const [registry, setRegistry] = useState<RegistryEntry[]>([]);
  const [policiesByRole, setPoliciesByRole] = useState<Record<string, PolicyEntry[]>>({});
  const [editablePoliciesByRole, setEditablePoliciesByRole] = useState<Record<string, PolicyEntry[]>>({});
  const [diagnostics, setDiagnostics] = useState<any>({});
  const [selectedRole, setSelectedRole] = useState("");
  const [selectedModule, setSelectedModule] = useState("ALL");
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"registered" | "unregistered">("registered");

  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyRows, setHistoryRows] = useState<HistoryEntry[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);
  const historyLimit = 10;

  const registryMap = useMemo(() => {
    const map = new Map<string, RegistryEntry>();
    registry.forEach((entry) => map.set(normalizeKey(entry.resource_key), entry));
    return map;
  }, [registry]);

  const applyDashboardPayload = useCallback((payload: any, preserveSelectedRole = true) => {
    const nextRegistry: RegistryEntry[] = (payload?.registry || [])
      .filter((entry: RegistryEntry) => isActive(entry?.is_active))
      .map((entry: RegistryEntry) => ({
        ...entry,
        resource_key: normalizeKey(entry.resource_key),
        allowed_actions: Array.from(new Set((entry.allowed_actions || []).map(normalizeAction))).filter(Boolean),
      }));
    const nextRegistryMap = new Map(nextRegistry.map((entry) => [entry.resource_key, entry]));
    const nextPolicies: Record<string, PolicyEntry[]> = {};
    Object.entries(payload?.policiesByRole || {}).forEach(([role, entries]) => {
      nextPolicies[role] = normalizePolicyEntries((entries as PolicyEntry[]) || [], nextRegistryMap);
    });

    const nextRoles: RoleEntry[] = payload?.roles || [];
    setRegistry(nextRegistry);
    setRoles(nextRoles);
    setPoliciesByRole(nextPolicies);
    setEditablePoliciesByRole(JSON.parse(JSON.stringify(nextPolicies)));
    setDiagnostics(payload?.diagnostics || {});
    setSelectedRole((current) => {
      if (preserveSelectedRole && current && nextRoles.some((role) => role.role_slug === current)) return current;
      return nextRoles[0]?.role_slug || "";
    });
  }, []);

  const loadDashboard = useCallback(async (preserveSelectedRole = true) => {
    if (!username) return;
    try {
      setLoading(true);
      setError(null);
      const resp = await fetchRolePoliciesDashboardData({ username, country: "IN" });
      if (resp?.response?.responsecode !== "0") {
        throw new Error(resp?.response?.description || "Failed to load role policies");
      }
      const payload = unwrapDashboardPayload(resp);
      applyDashboardPayload(payload, preserveSelectedRole);
      if (!(payload?.roles || []).length) setError("No role policies are configured.");
    } catch (err: any) {
      setError(err?.message || "Failed to load role policies");
    } finally {
      setLoading(false);
    }
  }, [applyDashboardPayload, username]);

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  const selectedRoleEntry = useMemo(
    () => roles.find((role) => role.role_slug === selectedRole) || null,
    [roles, selectedRole],
  );
  const isProtectedRole = selectedRoleEntry?.is_protected === "Y";
  const currentPolicy = editablePoliciesByRole[selectedRole] || [];
  const originalPolicy = policiesByRole[selectedRole] || [];
  const hasChanges = policyFingerprint(currentPolicy) !== policyFingerprint(originalPolicy);
  const unknownForRole: string[] = diagnostics?.unknownByRole?.[selectedRole] || [];
  const duplicatesForRole: string[] = diagnostics?.duplicateByRole?.[selectedRole] || [];

  const rolePermissionLookup = useMemo(() => {
    const map = new Map<string, Set<string>>();
    currentPolicy.forEach((entry) => {
      map.set(normalizeKey(entry.resource_key), new Set((entry.actions || []).map(normalizeAction)));
    });
    return map;
  }, [currentPolicy]);

  const moduleOptions = useMemo(() => {
    const modules = Array.from(new Set(registry.map((entry) => String(entry.module || "Other").trim() || "Other"))).sort();
    return [{ value: "ALL", label: "All modules" }, ...modules.map((module) => ({ value: module, label: module }))];
  }, [registry]);

  const filteredRegistry = useMemo(() => {
    const q = search.trim().toLowerCase();
    return registry.filter((entry) => {
      if (selectedModule !== "ALL" && String(entry.module || "Other") !== selectedModule) return false;
      if (!q) return true;
      return (
        entry.resource_key.toLowerCase().includes(q) ||
        String(entry.module || "").toLowerCase().includes(q) ||
        String(entry.description || "").toLowerCase().includes(q)
      );
    });
  }, [registry, search, selectedModule]);

  const unregisteredResources = useMemo<UiOnlyResource[]>(() => {
    const registered = new Set(registry.map((entry) => normalizeKey(entry.resource_key)));
    const seen = new Set<string>();
    return (ui_resources || [])
      .filter((entry: any) => isActive(entry?.is_active) && entry?.resource_key)
      .map((entry: any) => ({
        key: `${normalizeKey(entry.resource_key)}:${normalizeAction(entry.action_code || "VIEW")}`,
        resource_key: normalizeKey(entry.resource_key),
        action_code: normalizeAction(entry.action_code || ""),
        screen: entry.screen || entry.ui_type || "",
        route: entry.route || "",
      }))
      .filter((entry: UiOnlyResource) => {
        if (registered.has(entry.resource_key) || seen.has(entry.key)) return false;
        seen.add(entry.key);
        return true;
      });
  }, [registry, ui_resources]);

  const toggleAction = (resourceKey: string, action: string, checked: boolean) => {
    if (isProtectedRole) return;
    const key = normalizeKey(resourceKey);
    const normalizedAction = normalizeAction(action);
    const registryEntry = registryMap.get(key);
    if (!registryEntry) {
      setError(`Resource ${key} is not present in the active Resource Registry.`);
      return;
    }
    const allowed = new Set((registryEntry.allowed_actions || []).map(normalizeAction));
    if (!allowed.has(normalizedAction)) {
      setError(`Action ${normalizedAction} is not allowed for ${key}.`);
      return;
    }

    setEditablePoliciesByRole((prev) => {
      const next = [...(prev[selectedRole] || [])].map((entry) => ({ ...entry, actions: [...entry.actions] }));
      const index = next.findIndex((entry) => normalizeKey(entry.resource_key) === key);
      if (checked) {
        if (index === -1) next.push({ resource_key: key, actions: [normalizedAction] });
        else next[index].actions = Array.from(new Set([...next[index].actions.map(normalizeAction), normalizedAction])).sort();
      } else if (index !== -1) {
        next[index].actions = next[index].actions.map(normalizeAction).filter((value) => value !== normalizedAction);
        if (!next[index].actions.length) next.splice(index, 1);
      }
      return { ...prev, [selectedRole]: next };
    });
  };

  const buildFullPolicyPayload = () => {
    const normalized = normalizePolicyEntries(currentPolicy, registryMap);
    const invalid = normalized.filter((entry) => !registryMap.has(entry.resource_key));
    if (invalid.length) throw new Error(`Invalid Registry keys: ${invalid.map((entry) => entry.resource_key).join(", ")}`);
    return normalized;
  };

  const handleSave = async () => {
    if (!selectedRole || !hasChanges || isProtectedRole) return;
    if (unknownForRole.length) {
      setError("This role contains policy keys that are no longer in the Registry. Resolve them in Resource Health before saving to avoid an unintended policy cleanup.");
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const verified = await ensureStepUp("role_policies.edit", "UPDATE", { source: "GUARD", force: true });
      if (!verified) return;
      const permissions = buildFullPolicyPayload();
      const resp = await updateRolePolicies({
        username,
        country: "IN",
        role_slug: selectedRole,
        permissions,
        expected_version: Number(selectedRoleEntry?.version || 0),
      });
      if (resp?.response?.responsecode !== "0") {
        throw new Error(resp?.response?.description || "Failed to update role policy");
      }
      message.success("Role policy updated and previous version archived.");
      await loadDashboard(true);
      await refresh({ invalidate: true });
      if (historyOpen) await loadHistory(selectedRole, 1);
    } catch (err: any) {
      setError(err?.message || "Failed to update role policy");
    } finally {
      setSaving(false);
    }
  };

  const loadHistory = async (roleSlug = selectedRole, page = historyPage) => {
    if (!username || !roleSlug) return;
    try {
      setHistoryLoading(true);
      const resp = await fetchRolePolicyHistory({
        username,
        country: "IN",
        role_slug: roleSlug,
        page,
        limit: historyLimit,
      });
      if (resp?.response?.responsecode !== "0") {
        throw new Error(resp?.response?.description || "Failed to load policy history");
      }
      const payload = unwrapHistoryPayload(resp);
      setHistoryRows(payload?.history || []);
      setHistoryPage(payload?.pagination?.page || page);
      setHistoryTotal(payload?.pagination?.total || 0);
    } catch (err: any) {
      message.error(err?.message || "Failed to load policy history");
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistory = async () => {
    setHistoryOpen(true);
    setHistoryPage(1);
    await loadHistory(selectedRole, 1);
  };

  const restoreHistoryEntry = (entry: HistoryEntry) => {
    if (isProtectedRole) return;
    Modal.confirm({
      title: `Restore ${selectedRole} from version ${entry.snapshot_version}?`,
      content: "The current policy will be archived first. The historical permissions will then be validated against the current Resource Registry before restore.",
      okText: "Restore version",
      okButtonProps: { danger: true },
      async onOk() {
        const verified = await ensureStepUp("role_policies.edit", "UPDATE", { source: "GUARD", force: true });
        if (!verified) return Promise.reject(new Error("Step-up verification was not completed."));
        const resp = await restoreRolePolicyVersion({
          username,
          country: "IN",
          role_slug: selectedRole,
          history_id: entry._id,
          expected_version: Number(selectedRoleEntry?.version || 0),
        });
        if (resp?.response?.responsecode !== "0") {
          throw new Error(resp?.response?.description || "Failed to restore policy version");
        }
        message.success(`Restored ${selectedRole} from archived version ${entry.snapshot_version}.`);
        await loadDashboard(true);
        await loadHistory(selectedRole, 1);
        await refresh({ invalidate: true });
      },
    });
  };

  const registeredColumns: ColumnsType<RegistryEntry> = [
    {
      title: "Resource",
      dataIndex: "resource_key",
      key: "resource_key",
      width: 360,
      render: (value: string, row) => (
        <Space direction="vertical" size={2}>
          <Text strong>{value}</Text>
          {row.description ? <Text type="secondary">{row.description}</Text> : null}
          {row.aliases?.length ? (
            <Space size={[4, 4]} wrap>
              {row.aliases.map((alias) => <Tag key={alias}>alias: {alias}</Tag>)}
            </Space>
          ) : null}
        </Space>
      ),
    },
    {
      title: "Module",
      dataIndex: "module",
      key: "module",
      width: 220,
      render: (value?: string) => value || "Other",
    },
    {
      title: "Permission",
      key: "actions",
      render: (_, row) => {
        const granted = rolePermissionLookup.get(row.resource_key) || new Set<string>();
        return (
          <Space size={[6, 6]} wrap>
            {(row.allowed_actions || []).map((action) => {
              const normalizedAction = normalizeAction(action);
              const checked = granted.has(normalizedAction);
              return (
                <Checkbox
                  key={`${row.resource_key}:${normalizedAction}`}
                  checked={checked}
                  disabled={isProtectedRole}
                  onChange={(event) => toggleAction(row.resource_key, normalizedAction, event.target.checked)}
                >
                  {normalizedAction.split("_").join(" ")}
                </Checkbox>
              );
            })}
          </Space>
        );
      },
    },
  ];

  const unregisteredColumns: ColumnsType<UiOnlyResource> = [
    { title: "Resource", dataIndex: "resource_key", key: "resource_key", render: (value) => <Text strong>{value}</Text> },
    { title: "UI Action", dataIndex: "action_code", key: "action_code", width: 160, render: (value) => value ? <Tag>{value}</Tag> : "—" },
    { title: "Screen / Type", dataIndex: "screen", key: "screen", width: 220, render: (value) => value || "—" },
    { title: "Route", dataIndex: "route", key: "route", render: (value) => value || "—" },
  ];

  const historyColumns: ColumnsType<HistoryEntry> = [
    { title: "Version", dataIndex: "snapshot_version", key: "snapshot_version", width: 90, render: (value) => <Tag>v{value}</Tag> },
    { title: "Reason", dataIndex: "snapshot_reason", key: "snapshot_reason", width: 150, render: (value) => String(value || "—").split("_").join(" ") },
    { title: "Permissions", key: "permissions", width: 110, render: (_, row) => row.permissions?.length || 0 },
    { title: "Changed By", dataIndex: "changed_by", key: "changed_by", width: 160, render: (value) => value || "—" },
    { title: "Archived On", dataIndex: "changed_on", key: "changed_on", width: 190, render: (value) => value ? new Date(value).toLocaleString() : "—" },
    {
      title: "Action",
      key: "action",
      width: 130,
      render: (_, row) => (
        <Button
          size="small"
          icon={<UndoOutlined />}
          disabled={isProtectedRole}
          onClick={() => restoreHistoryEntry(row)}
        >
          Restore
        </Button>
      ),
    },
  ];

  if (!username) return <Alert type="warning" showIcon message="Please log in." />;

  return (
    <div className="cm-page">
      <div className="cm-page-header">
        <h1 className="cm-page-title">Role Policy Manager</h1>
        <div className="cm-page-subtitle">
          Assign role permissions from the canonical Resource Registry with versioned recovery.
        </div>
      </div>

      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Row gutter={[12, 12]}>
          <Col xs={24} md={6}><Card className="cm-card"><Statistic title="Roles" value={roles.length} /></Card></Col>
          <Col xs={24} md={6}><Card className="cm-card"><Statistic title="Active Registry Resources" value={registry.length} /></Card></Col>
          <Col xs={24} md={6}><Card className="cm-card"><Statistic title="Granted Resources" value={currentPolicy.length} /></Card></Col>
          <Col xs={24} md={6}><Card className="cm-card"><Statistic title="Unsaved Changes" value={hasChanges ? 1 : 0} /></Card></Col>
        </Row>

        {error ? <Alert type="error" showIcon message={error} closable onClose={() => setError(null)} /> : null}
        {isProtectedRole ? (
          <Alert type="warning" showIcon message={`${selectedRole} is protected and cannot be edited.`} />
        ) : null}
        {unknownForRole.length ? (
          <Alert
            type="warning"
            showIcon
            message="Policy contains resources missing from the current Registry"
            description={`${unknownForRole.join(", ")}. Saving is blocked until these are reconciled in Resource Health / Resource Registry.`}
          />
        ) : null}
        {duplicatesForRole.length ? (
          <Alert type="warning" showIcon message={`Duplicate policy keys detected: ${duplicatesForRole.join(", ")}`} />
        ) : null}

        <Card className="cm-card">
          <Row gutter={[12, 12]} align="middle">
            <Col xs={24} lg={6}>
              <Select
                value={selectedRole || undefined}
                onChange={(value) => { setSelectedRole(value); setHistoryRows([]); setHistoryTotal(0); }}
                options={roles.map((role) => ({
                  value: role.role_slug,
                  label: `${role.role_name || role.role_slug}${role.is_protected === "Y" ? " (PROTECTED)" : role.source === "SYSTEM" ? " (PLATFORM)" : ""}`,
                }))}
                style={{ width: "100%" }}
                placeholder="Select role"
                showSearch
                optionFilterProp="label"
              />
            </Col>
            <Col xs={24} lg={5}>
              <Select
                value={selectedModule}
                onChange={setSelectedModule}
                options={moduleOptions}
                style={{ width: "100%" }}
                disabled={activeTab === "unregistered"}
              />
            </Col>
            <Col xs={24} lg={7}>
              <Input
                prefix={<SearchOutlined />}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search resource, module or description"
                allowClear
                disabled={activeTab === "unregistered"}
              />
            </Col>
            <Col xs={24} lg={6}>
              <Space wrap>
                <Button icon={<HistoryOutlined />} onClick={openHistory} disabled={!selectedRole}>History</Button>
                <Button icon={<ReloadOutlined />} onClick={() => loadDashboard(true)} loading={loading}>Refresh</Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={saving}
                  disabled={!selectedRole || !hasChanges || isProtectedRole || !!unknownForRole.length || activeTab !== "registered"}
                >
                  Save
                </Button>
              </Space>
            </Col>
          </Row>
        </Card>

        <Card
          className="cm-card"
          tabList={[
            { key: "registered", tab: `Registered (${registry.length})` },
            { key: "unregistered", tab: `Unregistered UI (${unregisteredResources.length})` },
          ]}
          activeTabKey={activeTab}
          onTabChange={(key) => setActiveTab(key as "registered" | "unregistered")}
        >
          {activeTab === "registered" ? (
            <Table
              rowKey="resource_key"
              columns={registeredColumns}
              dataSource={filteredRegistry}
              loading={loading}
              pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: [25, 50, 100], showTotal: (total) => `${total} resources` }}
              scroll={{ x: 900 }}
              size="middle"
            />
          ) : (
            <>
              <Alert
                type="info"
                showIcon
                message="Maintenance view only"
                description="These active UI resources are not registered in the canonical Resource Registry and cannot be assigned here. Reconcile them through Resource Health / Resource Registry."
                style={{ marginBottom: 12 }}
              />
              <Table
                rowKey="key"
                columns={unregisteredColumns}
                dataSource={unregisteredResources}
                pagination={{ pageSize: 50, showSizeChanger: true, pageSizeOptions: [25, 50, 100] }}
                scroll={{ x: 850 }}
                size="middle"
              />
            </>
          )}
        </Card>
      </Space>

      <Drawer
        title={`Policy History — ${selectedRole || "Role"}`}
        width={900}
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        destroyOnClose={false}
      >
        <Alert
          type="info"
          showIcon
          message="Restore is controlled"
          description="A restore archives the current version first, requires step-up verification, and revalidates every historical resource/action against the current Resource Registry."
          style={{ marginBottom: 12 }}
        />
        <Table
          rowKey="_id"
          columns={historyColumns}
          dataSource={historyRows}
          loading={historyLoading}
          pagination={false}
          scroll={{ x: 800 }}
          size="middle"
        />
        <div style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}>
          <Pagination
            current={historyPage}
            pageSize={historyLimit}
            total={historyTotal}
            showSizeChanger={false}
            onChange={(page) => loadHistory(selectedRole, page)}
          />
        </div>
      </Drawer>
    </div>
  );
};

const GuardedRolesPermissionsPage: React.FC = () => {
  const username = currentUsername();
  return (
    <StepUpGuard username={username} resourceKey="role_policies.menu" action="VIEW">
      <RolesPermissionsPage />
    </StepUpGuard>
  );
};

export default GuardedRolesPermissionsPage;
