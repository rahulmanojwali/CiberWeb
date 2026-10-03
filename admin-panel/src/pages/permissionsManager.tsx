import React, {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Checkbox,
  Col,
  Collapse,
  Dropdown,
  Empty,
  Input,
  List,
  Modal,
  Progress,
  Row,
  Segmented,
  Space,
  Spin,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { CollapseProps, MenuProps } from "antd";
import {
  AppstoreOutlined,
  AuditOutlined,
  BankOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DatabaseOutlined,
  DeleteOutlined,
  DollarOutlined,
  DownOutlined,
  EditOutlined,
  EyeOutlined,
  FileProtectOutlined,
  HistoryOutlined,
  KeyOutlined,
  PlusCircleOutlined,
  ReloadOutlined,
  RollbackOutlined,
  SafetyCertificateOutlined,
  SaveOutlined,
  SearchOutlined,
  SettingOutlined,
  ShopOutlined,
  StopOutlined,
  TeamOutlined,
  ToolOutlined,
  UnorderedListOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { StepUpGuard } from "../components/StepUpGuard";
import { CmPageHeader } from "../design-system/components/CmPageHeader";
import { CmStatCard } from "../design-system/components/CmStatCard";
import {
  fetchRolePolicy,
  fetchRolePolicyHistory,
  fetchUiResourcesCatalog,
  restoreRolePolicyVersion,
  fetchRbacBackups,
  createRbacBackup,
  restoreRbacBackup,
  updateRolePolicy,
} from "../services/rolePoliciesApi";
import "./permissionsManager.css";

const { Text, Title } = Typography;

type RolePolicy = {
  resource_key: string;
  actions: string[];
};

type RoleOption = {
  role_slug: string;
  role_name?: string | null;
  role_scope?: string | null;
  is_protected?: string | null;
};

type CompactResource = {
  resource_key: string;
  screen?: string | null;
  element?: string | null;
  actions: string[];
  ui_type?: string | null;
  route?: string | null;
  parent_resource_key?: string | null;
  order?: number | null;
  label_i18n?: Record<string, string>;
  description_i18n?: Record<string, string>;
};


type PolicyHistoryRow = {
  _id?: string;
  role_slug?: string;
  snapshot_version?: number;
  snapshot_reason?: string;
  changed_by?: string;
  changed_on?: string;
  permissions?: RolePolicy[];
};

type RbacBackupRow = {
  backup_id: string;
  backup_name?: string;
  backup_type?: string;
  reason?: string | null;
  counts?: Record<string, number>;
  created_on?: string;
  created_by?: string;
  last_restored_on?: string | null;
  last_restored_by?: string | null;
};

type PolicyMeta = {
  role_slug?: string;
  role_scope?: string | null;
  permissions?: RolePolicy[];
  policy_source?: string | null;
  version?: number;
  updated_on?: string | null;
  updated_by?: string | null;
};

type ModuleGroup = {
  key: string;
  title: string;
  description: string;
  entries: CompactResource[];
  totalActions: number;
  grantedActions: number;
  complete: boolean;
  order: number;
};

const ACTION_ORDER = [
  "VIEW",
  "CREATE",
  "UPDATE",
  "UPDATE_STATUS",
  "DEACTIVATE",
  "DELETE",
  "RESET_PASSWORD",
  "BULK_UPLOAD",
  "APPROVE",
  "REJECT",
  "REQUEST_MORE_INFO",
];

const ROW_ORDER = ["menu", "list", "detail", "view", "create", "edit", "update", "deactivate"];


function moduleIcon(group: Pick<ModuleGroup, "key" | "title">): React.ReactNode {
  const value = `${group.key} ${group.title}`.toLowerCase();
  if (value.includes("auction")) return <AuditOutlined />;
  if (value.includes("gate") || value.includes("vehicle")) return <ToolOutlined />;
  if (value.includes("mandi") || value.includes("market")) return <ShopOutlined />;
  if (value.includes("price") || value.includes("fee") || value.includes("payment")) return <DollarOutlined />;
  if (value.includes("farmer") || value.includes("trader") || value.includes("user") || value.includes("participant")) return <UserOutlined />;
  if (value.includes("organisation") || value.includes("organization")) return <BankOutlined />;
  if (value.includes("security") || value.includes("policy") || value.includes("role")) return <SafetyCertificateOutlined />;
  if (value.includes("resource") || value.includes("registry") || value.includes("master")) return <DatabaseOutlined />;
  if (value.includes("setting") || value.includes("config")) return <SettingOutlined />;
  return <AppstoreOutlined />;
}

function actionIcon(action: string): React.ReactNode {
  const normalized = action === "UPDATE_STATUS" ? "UPDATE" : action;
  if (normalized === "VIEW") return <EyeOutlined />;
  if (normalized === "CREATE") return <PlusCircleOutlined />;
  if (normalized === "UPDATE") return <EditOutlined />;
  if (normalized === "DEACTIVATE") return <StopOutlined />;
  if (normalized === "DELETE") return <DeleteOutlined />;
  if (normalized === "APPROVE") return <CheckCircleOutlined />;
  if (normalized === "REJECT") return <CloseCircleOutlined />;
  return <KeyOutlined />;
}

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

function currentRoleSlug(): string {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return String(
      parsed?.default_role_code || parsed?.default_role || parsed?.role_slug || parsed?.role || parsed?.role_code || ""
    ).trim().toUpperCase();
  } catch {
    return "";
  }
}

function normalizeKey(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function normalizeAction(value: unknown): string {
  return String(value || "").trim().toUpperCase();
}

function normalizeActions(actions: unknown[]): string[] {
  return Array.from(new Set((actions || []).map(normalizeAction).filter(Boolean))).sort((a, b) => {
    const ia = ACTION_ORDER.indexOf(a);
    const ib = ACTION_ORDER.indexOf(b);
    const ra = ia === -1 ? ACTION_ORDER.length : ia;
    const rb = ib === -1 ? ACTION_ORDER.length : ib;
    return ra === rb ? a.localeCompare(b) : ra - rb;
  });
}

function normalizeSubmittedAction(resourceKey: string, action: string): string {
  const key = normalizeKey(resourceKey);
  if (
    action === "UPDATE_STATUS" &&
    (key.endsWith(".update_status") || key.endsWith(".arrive") || key.endsWith(".cancel") || key.endsWith(".complete"))
  ) {
    return "UPDATE";
  }
  return action;
}

function clonePermissionMap(source: Map<string, Set<string>>): Map<string, Set<string>> {
  const next = new Map<string, Set<string>>();
  source.forEach((actions, key) => next.set(key, new Set(actions)));
  return next;
}

function permissionMapFromRows(rows: RolePolicy[]): Map<string, Set<string>> {
  const next = new Map<string, Set<string>>();
  (rows || []).forEach((row) => {
    const key = normalizeKey(row.resource_key);
    if (!key) return;
    next.set(key, new Set(normalizeActions(row.actions || [])));
  });
  return next;
}

function computeDiffCount(current: Map<string, Set<string>>, baseline: Map<string, Set<string>>): number {
  const keys = new Set([...current.keys(), ...baseline.keys()]);
  let changed = 0;
  keys.forEach((key) => {
    const a = current.get(key) || new Set<string>();
    const b = baseline.get(key) || new Set<string>();
    if (a.size !== b.size || Array.from(a).some((action) => !b.has(action))) changed += 1;
  });
  return changed;
}

function prettify(value: string): string {
  return String(value || "")
    .replace(/[._-]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function friendlyRowLabel(entry: CompactResource): string {
  if (entry.element) return entry.element;
  const suffix = entry.resource_key.split(".").pop() || entry.resource_key;
  if (suffix === "menu") return "Menu";
  if (suffix === "list") return "List";
  if (["detail", "view", "view_detail"].includes(suffix)) return "Detail";
  if (suffix === "create") return "Create";
  if (["edit", "update"].includes(suffix)) return "Edit";
  if (suffix === "deactivate") return "Deactivate";
  return prettify(suffix);
}

function groupKey(entry: CompactResource): string {
  const screen = String(entry.screen || prettify(entry.resource_key.split(".")[0] || "Other")).trim();
  const parent = normalizeKey(entry.parent_resource_key || "");
  return parent ? `${screen}::${parent}` : `${screen}::`;
}

function groupTitle(entry: CompactResource, labelByKey: Map<string, string>): string {
  const screen = String(entry.screen || prettify(entry.resource_key.split(".")[0] || "Other")).trim();
  const parent = normalizeKey(entry.parent_resource_key || "");
  if (!parent) return screen;
  return `${screen} / ${labelByKey.get(parent) || prettify(parent.split(".").pop() || parent)}`;
}

function rowOrder(entry: CompactResource): number {
  if (Number.isFinite(Number(entry.order))) return Number(entry.order);
  const suffix = entry.resource_key.split(".").pop() || "";
  const idx = ROW_ORDER.indexOf(suffix);
  return idx === -1 ? ROW_ORDER.length + 100 : idx;
}

function unwrapData(resp: any): any {
  return resp?.data || resp?.response?.data || resp?.data?.data || {};
}

function responseCode(resp: any): string {
  return String(resp?.response?.responsecode ?? resp?.responsecode ?? "");
}

function responseDescription(resp: any, fallback: string): string {
  return String(resp?.response?.description || resp?.description || fallback);
}

export const PermissionsManager: React.FC = () => {
  const username = currentUsername() || "";
  const [messageApi, contextHolder] = message.useMessage();

  const [catalog, setCatalog] = useState<CompactResource[]>([]);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [roleSlug, setRoleSlug] = useState("SUPER_ADMIN");
  const [policyMeta, setPolicyMeta] = useState<PolicyMeta>({});
  const [permissionsMap, setPermissionsMap] = useState<Map<string, Set<string>>>(new Map());
  const [baselineMap, setBaselineMap] = useState<Map<string, Set<string>>>(new Map());

  const [initialLoading, setInitialLoading] = useState(true);
  const [policyLoading, setPolicyLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [restoringHistoryId, setRestoringHistoryId] = useState<string | null>(null);
  const [policyHistory, setPolicyHistory] = useState<PolicyHistoryRow[]>([]);
  const [backupOpen, setBackupOpen] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [creatingBackup, setCreatingBackup] = useState(false);
  const [restoringBackupId, setRestoringBackupId] = useState<string | null>(null);
  const [rbacBackups, setRbacBackups] = useState<RbacBackupRow[]>([]);
  const [backupName, setBackupName] = useState("");
  const [canFullBackup, setCanFullBackup] = useState(false);
  const isSuperAdminSession = canFullBackup || ["SUPER_ADMIN", "SUPERADMIN"].includes(currentRoleSlug());

  const [searchInput, setSearchInput] = useState("");
  const deferredSearch = useDeferredValue(searchInput.trim().toLowerCase());
  const [moduleFilter, setModuleFilter] = useState("");
  const [permissionFilter, setPermissionFilter] = useState<"ALL" | "GRANTED" | "MISSING">("ALL");
  const [viewMode, setViewMode] = useState<"LIST" | "GRID">("LIST");
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const selectedRole = useMemo(
    () => roles.find((role) => role.role_slug === roleSlug) || null,
    [roles, roleSlug],
  );
  const protectedRole = selectedRole?.is_protected === "Y";

  const diffCount = useMemo(
    () => computeDiffCount(permissionsMap, baselineMap),
    [permissionsMap, baselineMap],
  );

  const labelByKey = useMemo(() => {
    const labels = new Map<string, string>();
    catalog.forEach((entry) => {
      const key = normalizeKey(entry.resource_key);
      if (!key || labels.has(key)) return;
      labels.set(
        key,
        entry.label_i18n?.en || entry.element || friendlyRowLabel(entry),
      );
    });
    return labels;
  }, [catalog]);

  const baseGroups = useMemo(() => {
    const map = new Map<string, { title: string; entries: CompactResource[]; order: number }>();
    catalog.forEach((entry) => {
      const key = groupKey(entry);
      if (!map.has(key)) {
        map.set(key, {
          title: groupTitle(entry, labelByKey),
          entries: [],
          order: Number.isFinite(Number(entry.order)) ? Number(entry.order) : Number.MAX_SAFE_INTEGER,
        });
      }
      const group = map.get(key)!;
      group.entries.push(entry);
      if (Number.isFinite(Number(entry.order))) group.order = Math.min(group.order, Number(entry.order));
    });

    return Array.from(map.entries())
      .map(([key, group]) => ({
        key,
        title: group.title,
        order: group.order,
        entries: group.entries.slice().sort((a, b) => rowOrder(a) - rowOrder(b) || a.resource_key.localeCompare(b.resource_key)),
      }))
      .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title));
  }, [catalog, labelByKey]);

  const moduleOptions = useMemo(
    () => baseGroups.map((group) => ({ key: group.key, label: group.title })),
    [baseGroups],
  );

  const visibleGroups = useMemo<ModuleGroup[]>(() => {
    return baseGroups
      .filter((group) => !moduleFilter || group.key === moduleFilter)
      .map((group) => {
        const groupNameMatch = deferredSearch ? group.title.toLowerCase().includes(deferredSearch) : false;
        const filteredEntries = group.entries.filter((entry) => {
          const selected = permissionsMap.get(normalizeKey(entry.resource_key));
          const granted = Boolean(selected?.size);
          if (permissionFilter === "GRANTED" && !granted) return false;
          if (permissionFilter === "MISSING" && granted) return false;
          if (!deferredSearch || groupNameMatch) return true;
          const haystack = [
            entry.resource_key,
            entry.screen,
            entry.element,
            entry.label_i18n?.en,
            entry.description_i18n?.en,
            ...(entry.actions || []),
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(deferredSearch);
        });

        if (!filteredEntries.length) return null;

        const totalActions = group.entries.reduce((sum, entry) => sum + entry.actions.length, 0);
        const grantedActions = group.entries.reduce((sum, entry) => {
          const selected = permissionsMap.get(normalizeKey(entry.resource_key));
          return sum + entry.actions.filter((action) => selected?.has(action)).length;
        }, 0);

        return {
          key: group.key,
          title: group.title,
          description: `Manage ${group.title.toLowerCase()} permissions`,
          entries: filteredEntries,
          totalActions,
          grantedActions,
          complete: totalActions > 0 && grantedActions === totalActions,
          order: group.order,
        };
      })
      .filter(Boolean) as ModuleGroup[];
  }, [baseGroups, deferredSearch, moduleFilter, permissionFilter, permissionsMap]);

  const totals = useMemo(() => {
    const totalPermissions = catalog.reduce((sum, entry) => sum + entry.actions.length, 0);
    const grantedPermissions = catalog.reduce((sum, entry) => {
      const selected = permissionsMap.get(normalizeKey(entry.resource_key));
      return sum + entry.actions.filter((action) => selected?.has(action)).length;
    }, 0);
    return {
      modules: baseGroups.length,
      totalPermissions,
      grantedPermissions,
    };
  }, [baseGroups.length, catalog, permissionsMap]);

  const applyPolicy = useCallback((policy: PolicyMeta | null | undefined) => {
    const map = permissionMapFromRows(policy?.permissions || []);
    setPermissionsMap(map);
    setBaselineMap(clonePermissionMap(map));
    setPolicyMeta(policy || {});
    setExpandedKeys([]);
  }, []);

  const loadWorkspace = useCallback(async () => {
    if (!username) return;
    setInitialLoading(true);
    setError(null);
    try {
      const resp = await fetchUiResourcesCatalog({
        username,
        role_slug: roleSlug,
        include_policy: true,
        compact: true,
      });
      if (responseCode(resp) !== "0") throw new Error(responseDescription(resp, "Failed to load role permission workspace."));
      const data = unwrapData(resp);
      const resources: CompactResource[] = Array.isArray(data.compact_resources)
        ? data.compact_resources
        : Array.isArray(data.resources)
          ? data.resources.map((entry: any) => ({ ...entry, actions: normalizeActions(entry.actions || [entry.action_code]) }))
          : [];
      const roleRows: RoleOption[] = (Array.isArray(data.roles) ? data.roles : [])
        .map((role: any) => ({
          role_slug: String(role?.role_slug || role?.role_code || "").trim().toUpperCase(),
          role_name: role?.role_name || role?.display_name || role?.name || null,
          role_scope: role?.role_scope || null,
          is_protected: role?.is_protected || null,
        }))
        .filter((role: RoleOption) => Boolean(role.role_slug));

      setCatalog(resources);
      setRoles(roleRows);
      setCanFullBackup(Boolean(data.can_full_backup) || ["SUPER_ADMIN", "SUPERADMIN"].includes(String(data.session_role_slug || "").toUpperCase()));

      let resolvedRole = roleSlug;
      if (roleRows.length && !roleRows.some((role) => role.role_slug === resolvedRole)) {
        resolvedRole = roleRows.find((role) => role.role_slug === "SUPER_ADMIN")?.role_slug || roleRows[0].role_slug;
        setRoleSlug(resolvedRole);
      }

      if (data.selected_policy && String(data.selected_policy.role_slug || "").toUpperCase() === resolvedRole) {
        applyPolicy(data.selected_policy);
      } else {
        const policyResp = await fetchRolePolicy({ username, role_slug: resolvedRole });
        if (responseCode(policyResp) !== "0") throw new Error(responseDescription(policyResp, "Failed to load role policy."));
        applyPolicy(unwrapData(policyResp));
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load role permission workspace.");
      setCatalog([]);
      setRoles([]);
      setCanFullBackup(false);
      applyPolicy({});
    } finally {
      setInitialLoading(false);
    }
  }, [applyPolicy, roleSlug, username]);

  useEffect(() => {
    loadWorkspace();
    // Initial bootstrap only. Role changes use the smaller getRolePolicy API.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username]);

  const loadRole = useCallback(async (nextRole: string) => {
    if (!username || !nextRole) return;
    setPolicyLoading(true);
    setError(null);
    try {
      const resp = await fetchRolePolicy({ username, role_slug: nextRole });
      if (responseCode(resp) !== "0") throw new Error(responseDescription(resp, "Failed to load role policy."));
      applyPolicy(unwrapData(resp));
    } catch (err: any) {
      setError(err?.message || "Failed to load role policy.");
      applyPolicy({ role_slug: nextRole });
    } finally {
      setPolicyLoading(false);
    }
  }, [applyPolicy, username]);

  const onRoleChange = async (nextRole: string) => {
    if (nextRole === roleSlug) return;
    if (diffCount > 0) {
      messageApi.warning("Save or discard the current permission changes before switching roles.");
      return;
    }
    setRoleSlug(nextRole);
    await loadRole(nextRole);
  };

  const toggleAction = (resourceKey: string, action: string) => {
    if (protectedRole) return;
    const key = normalizeKey(resourceKey);
    setPermissionsMap((previous) => {
      const next = clonePermissionMap(previous);
      const selected = new Set(next.get(key) || []);
      if (selected.has(action)) selected.delete(action);
      else selected.add(action);
      if (selected.size) next.set(key, selected);
      else next.delete(key);
      return next;
    });
  };

  const setGroupActions = (group: ModuleGroup, enabled: boolean) => {
    if (protectedRole) return;
    setPermissionsMap((previous) => {
      const next = clonePermissionMap(previous);
      group.entries.forEach((entry) => {
        const key = normalizeKey(entry.resource_key);
        if (enabled) next.set(key, new Set(entry.actions));
        else next.delete(key);
      });
      return next;
    });
  };

  const handleSave = async () => {
    if (!username || !roleSlug || protectedRole || diffCount === 0) return;
    setSaving(true);
    try {
      const allowedByKey = new Map<string, Set<string>>(
        catalog.map((entry): [string, Set<string>] => [normalizeKey(entry.resource_key), new Set<string>(entry.actions)]),
      );
      const permissions: RolePolicy[] = [];
      permissionsMap.forEach((actions, key) => {
        const allowed = allowedByKey.get(key) || new Set<string>();
        const valid = Array.from(actions as Set<string>)
          .filter((action) => allowed.has(action) || (action === "UPDATE" && allowed.has("UPDATE_STATUS")))
          .map((action) => normalizeSubmittedAction(key, action));
        const unique = Array.from(new Set(valid));
        if (unique.length) permissions.push({ resource_key: key, actions: unique });
      });

      const resp = await updateRolePolicy({
        username,
        role_slug: roleSlug,
        permissions,
        expected_version: Number(policyMeta.version || 0),
      });
      if (responseCode(resp) !== "0") {
        const failAt = String(resp?.response?.failAt || "");
        if (failAt === "STALE_POLICY_VERSION") {
          messageApi.error("This role policy changed in another session. Reloading the latest version.");
          await loadRole(roleSlug);
          return;
        }
        throw new Error(responseDescription(resp, "Failed to save role permissions."));
      }
      const data = unwrapData(resp);
      setBaselineMap(clonePermissionMap(permissionsMap));
      setPolicyMeta((prev) => ({ ...prev, version: Number(data.version || prev.version || 0), updated_on: new Date().toISOString(), updated_by: username }));
      messageApi.success("Permissions updated successfully.");
    } catch (err: any) {
      messageApi.error(err?.message || "Failed to save role permissions.");
    } finally {
      setSaving(false);
    }
  };

  const openRecovery = async () => {
    if (!username || !roleSlug) return;
    if (diffCount > 0) {
      messageApi.warning("Save or discard the current permission changes before opening recovery history.");
      return;
    }
    setRecoveryOpen(true);
    setHistoryLoading(true);
    try {
      const resp = await fetchRolePolicyHistory({ username, role_slug: roleSlug, page: 1, limit: 30 });
      if (responseCode(resp) !== "0") throw new Error(responseDescription(resp, "Failed to load recovery history."));
      const data = unwrapData(resp);
      setPolicyHistory(Array.isArray(data.history) ? data.history : []);
    } catch (err: any) {
      setPolicyHistory([]);
      messageApi.error(err?.message || "Failed to load recovery history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const restoreSnapshot = (row: PolicyHistoryRow) => {
    const historyId = String(row?._id || "");
    if (!historyId || protectedRole) return;
    Modal.confirm({
      title: `Restore ${prettify(roleSlug)} to version ${Number(row.snapshot_version || 0)}?`,
      content: "The current policy will be snapshotted automatically before restore, so this restore can itself be reversed later.",
      okText: "Restore version",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        setRestoringHistoryId(historyId);
        try {
          const resp = await restoreRolePolicyVersion({
            username,
            role_slug: roleSlug,
            history_id: historyId,
            expected_version: Number(policyMeta.version || 0),
          });
          if (responseCode(resp) !== "0") {
            const failAt = String(resp?.response?.failAt || "");
            if (failAt === "STALE_POLICY_VERSION") {
              messageApi.error("This role changed in another session. Reloading the latest version before recovery.");
              await loadRole(roleSlug);
              return;
            }
            throw new Error(responseDescription(resp, "Failed to restore role policy."));
          }
          messageApi.success(`Restored ${prettify(roleSlug)} from version ${Number(row.snapshot_version || 0)}.`);
          setRecoveryOpen(false);
          await loadRole(roleSlug);
        } catch (err: any) {
          messageApi.error(err?.message || "Failed to restore role policy.");
        } finally {
          setRestoringHistoryId(null);
        }
      },
    });
  };

  const loadRbacBackups = async () => {
    if (!username || !isSuperAdminSession) return;
    setBackupLoading(true);
    try {
      const resp = await fetchRbacBackups({ username, page: 1, limit: 50 });
      if (responseCode(resp) !== "0") throw new Error(responseDescription(resp, "Failed to load RBAC backups."));
      const data = unwrapData(resp);
      setRbacBackups(Array.isArray(data.backups) ? data.backups : []);
    } catch (err: any) {
      setRbacBackups([]);
      messageApi.error(err?.message || "Failed to load RBAC backups.");
    } finally {
      setBackupLoading(false);
    }
  };

  const openBackupRecovery = async () => {
    if (!isSuperAdminSession) {
      messageApi.warning("Full RBAC backup and restore is restricted to SUPER_ADMIN.");
      return;
    }
    if (diffCount > 0) {
      messageApi.warning("Save or discard the current permission changes before opening Backup & Recovery.");
      return;
    }
    setBackupName(`RBAC backup ${new Date().toLocaleString()}`);
    setBackupOpen(true);
    await loadRbacBackups();
  };

  const handleCreateRbacBackup = async () => {
    const name = backupName.trim();
    if (!username || !name) {
      messageApi.warning("Enter a backup name.");
      return;
    }
    setCreatingBackup(true);
    try {
      const resp = await createRbacBackup({
        username,
        backup_name: name,
        reason: "Manual point-in-time RBAC backup from Role Permission Manager",
      });
      if (responseCode(resp) !== "0") throw new Error(responseDescription(resp, "Failed to create RBAC backup."));
      messageApi.success("Complete RBAC backup created successfully.");
      setBackupName(`RBAC backup ${new Date().toLocaleString()}`);
      await loadRbacBackups();
    } catch (err: any) {
      messageApi.error(err?.message || "Failed to create RBAC backup.");
    } finally {
      setCreatingBackup(false);
    }
  };

  const restoreFullRbacBackup = (row: RbacBackupRow) => {
    if (!row.backup_id || !isSuperAdminSession) return;
    const totalRecords = Object.values(row.counts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
    Modal.confirm({
      title: `Restore complete RBAC backup?`,
      width: 620,
      content: (
        <div>
          <p><strong>{row.backup_name || row.backup_id}</strong></p>
          <p>This will replace the current RBAC masters, policies and role assignments with this point-in-time snapshot ({totalRecords} records).</p>
          <p><strong>CiberMandi will automatically create a pre-restore backup first.</strong> The restore is therefore reversible even if this snapshot is not the one you wanted.</p>
        </div>
      ),
      okText: "Create safety backup & restore",
      okButtonProps: { danger: true },
      cancelText: "Cancel",
      onOk: async () => {
        setRestoringBackupId(row.backup_id);
        try {
          const resp = await restoreRbacBackup({ username, backup_id: row.backup_id });
          if (responseCode(resp) !== "0") throw new Error(responseDescription(resp, "Failed to restore RBAC backup."));
          const data = unwrapData(resp);
          messageApi.success(`RBAC restored. Safety backup: ${data.pre_restore_backup_id || "created"}.`);
          setBackupOpen(false);
          await loadWorkspace();
        } catch (err: any) {
          messageApi.error(err?.message || "Failed to restore RBAC backup.");
        } finally {
          setRestoringBackupId(null);
        }
      },
    });
  };

  const roleMenu: MenuProps["items"] = roles.map((role) => ({
    key: role.role_slug,
    label: `${role.role_name || prettify(role.role_slug)}${role.role_scope ? ` · ${role.role_scope}` : ""}`,
    onClick: () => onRoleChange(role.role_slug),
  }));

  const moduleMenu: MenuProps["items"] = [
    { key: "__ALL__", label: "All Modules", onClick: () => setModuleFilter("") },
    ...moduleOptions.map((module) => ({ key: module.key, label: module.label, onClick: () => setModuleFilter(module.key) })),
  ];

  const permissionMenu: MenuProps["items"] = [
    { key: "ALL", label: "All", onClick: () => setPermissionFilter("ALL") },
    { key: "GRANTED", label: "Granted", onClick: () => setPermissionFilter("GRANTED") },
    { key: "MISSING", label: "Missing", onClick: () => setPermissionFilter("MISSING") },
  ];

  const renderPermissionRow = (entry: CompactResource) => {
    const selected = permissionsMap.get(normalizeKey(entry.resource_key)) || new Set<string>();
    return (
      <div className="cm-rpm-permission-row" key={entry.resource_key}>
        <div className="cm-rpm-permission-copy">
          <Text strong>{friendlyRowLabel(entry)}</Text>
          <Text type="secondary" className="cm-rpm-resource-key">{entry.resource_key}</Text>
        </div>
        <div className="cm-rpm-action-list">
          {entry.actions.map((action) => {
            const checked = selected.has(action) || (action === "UPDATE_STATUS" && selected.has("UPDATE"));
            return (
              <label key={action} className={`cm-rpm-action-pill ${checked ? "is-checked" : ""} ${protectedRole ? "is-readonly" : ""}`}>
                <Checkbox
                  checked={checked}
                  disabled={protectedRole}
                  onChange={() => toggleAction(entry.resource_key, action)}
                />
                <span className="cm-rpm-action-icon">{actionIcon(action)}</span>
                <span>{action === "UPDATE_STATUS" ? "UPDATE" : action}</span>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  const renderModuleBody = (group: ModuleGroup) => (
    <div className="cm-rpm-module-body">
      {!protectedRole && (
        <div className="cm-rpm-module-actions">
          <Button size="small" onClick={() => setGroupActions(group, true)}>Grant all</Button>
          <Button size="small" danger onClick={() => setGroupActions(group, false)}>Clear module</Button>
        </div>
      )}
      <div className="cm-rpm-permission-list">{group.entries.map(renderPermissionRow)}</div>
    </div>
  );

  const collapseItems: CollapseProps["items"] = visibleGroups.map((group) => ({
    key: group.key,
    label: (
      <div className="cm-rpm-module-summary">
        <div className="cm-rpm-module-summary-copy">
          <div className="cm-rpm-module-heading">
            <span className="cm-rpm-module-icon">{moduleIcon(group)}</span>
            <div className="cm-rpm-module-heading-copy">
              <Text strong className="cm-rpm-module-title">{group.title}</Text>
              <Text type="secondary">{group.description}</Text>
            </div>
          </div>
        </div>
        <div className="cm-rpm-module-metrics">
          <div className="cm-rpm-module-count">
            <Text type="secondary">Permissions</Text>
            <Text strong>{group.grantedActions} / {group.totalActions}</Text>
          </div>
          <Progress percent={group.totalActions ? Math.round((group.grantedActions / group.totalActions) * 100) : 0} showInfo={false} size="small" />
          <Tag color={group.complete ? "success" : group.grantedActions ? "processing" : "default"}>
            {group.complete ? "Complete" : group.grantedActions ? "Partial" : "Not granted"}
          </Tag>
        </div>
      </div>
    ),
    children: renderModuleBody(group),
  }));

  if (!username) return <Alert type="warning" showIcon message="Please log in." />;

  return (
    <StepUpGuard username={username} resourceKey="role_policies.menu" action="VIEW">
      {contextHolder}
      <div className="cm-page cm-rpm-page">
        <CmPageHeader
          breadcrumbs={[{ title: "System" }, { title: "Role Policy Manager" }, { title: "Role Permission Manager" }]}
          title="Role Permission Manager"
          subtitle="Manage role permissions across all modules with a fast, scoped workspace and real-time validation."
          actions={<Button icon={<ReloadOutlined />} onClick={loadWorkspace} loading={initialLoading}>Refresh</Button>}
        />

        {error && <Alert type="error" showIcon closable message="Role permissions could not be loaded" description={error} />}
        {protectedRole && (
          <Alert
            type="info"
            showIcon
            message="Protected role"
            description="This role is platform-protected and is shown read-only. Select an editable role to change permissions."
          />
        )}

        <Spin spinning={initialLoading} tip="Loading permission workspace...">
          <Row gutter={[12, 12]} className="cm-rpm-stats">
            <Col xs={24} md={12} xl={6}>
              <Dropdown menu={{ items: roleMenu, selectedKeys: [roleSlug] }} trigger={["click"]}>
                <Card className="cm-rpm-role-card cm-rpm-role-card-clickable" bordered>
                  <div className="cm-rpm-stat-inline">
                    <div className="cm-rpm-stat-icon cm-rpm-stat-icon-amber"><TeamOutlined /></div>
                    <div className="cm-rpm-stat-copy">
                      <Text type="secondary">Selected Role</Text>
                      <Title level={4}>{selectedRole?.role_name || prettify(roleSlug)}{selectedRole?.role_scope ? ` · ${selectedRole.role_scope}` : ""}</Title>
                    </div>
                    <DownOutlined />
                  </div>
                </Card>
              </Dropdown>
            </Col>
            <Col xs={12} md={6} xl={6}>
              <CmStatCard label="Total Modules" value={totals.modules} helper="Active catalogue" icon={<AppstoreOutlined />} />
            </Col>
            <Col xs={12} md={6} xl={6}>
              <CmStatCard label="Total Permissions" value={totals.totalPermissions} helper={`${totals.grantedPermissions} granted`} icon={<KeyOutlined />} tone="amber" />
            </Col>
            <Col xs={24} md={12} xl={6}>
              <CmStatCard
                label="Last Updated"
                value={policyMeta.updated_on ? new Date(policyMeta.updated_on).toLocaleDateString() : "—"}
                helper={policyMeta.updated_by ? `by ${policyMeta.updated_by}` : "No update metadata"}
                icon={<SafetyCertificateOutlined />}
              />
            </Col>
          </Row>

          <Card className="cm-rpm-filter-card" bordered={false}>
            <Row gutter={[10, 10]} align="middle">
              <Col xs={24} md={12} xl={5}>
                <Dropdown menu={{ items: roleMenu, selectedKeys: [roleSlug] }} trigger={["click"]}>
                  <Button className="cm-rpm-filter-button" block disabled={policyLoading}>
                    <span><TeamOutlined /> {selectedRole?.role_name || prettify(roleSlug)}{selectedRole?.role_scope ? ` · ${selectedRole.role_scope}` : ""}</span>
                    <DownOutlined />
                  </Button>
                </Dropdown>
              </Col>
              <Col xs={24} md={12} xl={5}>
                <Dropdown menu={{ items: moduleMenu, selectedKeys: [moduleFilter || "__ALL__"] }} trigger={["click"]}>
                  <Button className="cm-rpm-filter-button" block>
                    <span><AppstoreOutlined /> {moduleFilter ? moduleOptions.find((item) => item.key === moduleFilter)?.label : "All Modules"}</span>
                    <DownOutlined />
                  </Button>
                </Dropdown>
              </Col>
              <Col xs={24} md={12} xl={4}>
                <Dropdown menu={{ items: permissionMenu, selectedKeys: [permissionFilter] }} trigger={["click"]}>
                  <Button className="cm-rpm-filter-button" block>
                    <span><KeyOutlined /> {permissionFilter === "ALL" ? "All" : prettify(permissionFilter)}</span>
                    <DownOutlined />
                  </Button>
                </Dropdown>
              </Col>
              <Col xs={24} md={12} xl={7}>
                <Input
                  allowClear
                  prefix={<SearchOutlined />}
                  placeholder="Search modules, resources or permissions..."
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  className="cm-rpm-search"
                />
              </Col>
              <Col xs={24} xl={3}>
                <Segmented
                  block
                  value={viewMode}
                  onChange={(value) => setViewMode(value as "LIST" | "GRID")}
                  options={[
                    { value: "LIST", icon: <UnorderedListOutlined /> },
                    { value: "GRID", icon: <AppstoreOutlined /> },
                  ]}
                />
              </Col>
            </Row>
          </Card>

          <Card className="cm-rpm-workspace-card" bordered={false}>
            <div className="cm-rpm-workspace-header">
              <Space size={10} wrap>
                <Title level={3}>Modules & Permissions</Title>
                <Badge count={`${visibleGroups.length} Modules`} color="#eef1e8" style={{ color: "#26311c", boxShadow: "none" }} />
                {diffCount > 0 && <Tag color="warning">{diffCount} unsaved change{diffCount === 1 ? "" : "s"}</Tag>}
              </Space>
              <Space size={8} wrap>
                <Button size="small" onClick={() => setExpandedKeys(visibleGroups.map((group) => group.key))}>Expand All</Button>
                <Button size="small" onClick={() => setExpandedKeys([])}>Collapse All</Button>
                {isSuperAdminSession && (
                  <Tooltip title="Create or restore a complete point-in-time RBAC backup">
                    <Button size="small" icon={<DatabaseOutlined />} onClick={openBackupRecovery} disabled={policyLoading}>Backup & Recovery</Button>
                  </Tooltip>
                )}
                <Tooltip title="View automatically saved policy versions and restore an earlier version">
                  <Button size="small" icon={<HistoryOutlined />} onClick={openRecovery} disabled={policyLoading}>Role Recovery</Button>
                </Tooltip>
                <Tooltip title={protectedRole ? "Protected roles are read-only" : diffCount === 0 ? "No unsaved changes" : "Save permission changes"}>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    disabled={protectedRole || diffCount === 0 || policyLoading}
                    loading={saving}
                    onClick={handleSave}
                  >
                    Save Changes
                  </Button>
                </Tooltip>
              </Space>
            </div>

            {policyLoading ? (
              <div className="cm-rpm-loading"><Spin tip="Loading selected role..." /></div>
            ) : visibleGroups.length === 0 ? (
              <Empty description="No modules match the current filters." />
            ) : viewMode === "LIST" ? (
              <Collapse
                className="cm-rpm-collapse"
                activeKey={expandedKeys}
                onChange={(keys) => setExpandedKeys(Array.isArray(keys) ? keys.map(String) : [String(keys)])}
                items={collapseItems}
                destroyOnHidden
              />
            ) : (
              <div className="cm-rpm-grid">
                {visibleGroups.map((group) => (
                  <Card key={group.key} className="cm-rpm-grid-card" bordered onClick={() => { setExpandedKeys([group.key]); setViewMode("LIST"); }}>
                    <div className="cm-rpm-grid-title"><span className="cm-rpm-module-icon">{moduleIcon(group)}</span><Text strong>{group.title}</Text></div>
                    <Text type="secondary">{group.description}</Text>
                    <Progress percent={group.totalActions ? Math.round((group.grantedActions / group.totalActions) * 100) : 0} />
                    <div className="cm-rpm-grid-footer">
                      <Text>{group.grantedActions} / {group.totalActions} permissions</Text>
                      <Tag color={group.complete ? "success" : group.grantedActions ? "processing" : "default"}>{group.complete ? "Complete" : group.grantedActions ? "Partial" : "Not granted"}</Tag>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </Card>
        </Spin>

        <Modal
          open={backupOpen}
          onCancel={() => setBackupOpen(false)}
          footer={null}
          width={860}
          title={<Space><DatabaseOutlined /><span>RBAC Backup & Recovery</span></Space>}
          destroyOnHidden
        >
          <Alert
            type="warning"
            showIcon
            message="Full RBAC safety backup"
            description="This snapshot includes role policies, resource registry, UI resources, role masters and current system/runtime role assignments. Full restore is SUPER_ADMIN-only, requires step-up verification, and automatically creates a pre-restore safety backup."
            style={{ marginBottom: 14 }}
          />
          <Card size="small" className="cm-rpm-backup-create-card">
            <Space.Compact block>
              <Input
                value={backupName}
                onChange={(event) => setBackupName(event.target.value)}
                placeholder="e.g. Before Mandi RBAC cleanup"
                maxLength={160}
              />
              <Button type="primary" icon={<DatabaseOutlined />} loading={creatingBackup} onClick={handleCreateRbacBackup}>Create Backup</Button>
            </Space.Compact>
          </Card>
          <List
            loading={backupLoading}
            dataSource={rbacBackups}
            locale={{ emptyText: "No full RBAC backups exist yet. Create one before the next permission migration or bulk script." }}
            renderItem={(row) => {
              const totalRecords = Object.values(row.counts || {}).reduce((sum, value) => sum + Number(value || 0), 0);
              return (
                <List.Item
                  className="cm-rpm-history-item"
                  actions={[
                    <Button
                      key="restore-full"
                      size="small"
                      danger
                      icon={<RollbackOutlined />}
                      loading={restoringBackupId === row.backup_id}
                      onClick={() => restoreFullRbacBackup(row)}
                    >
                      Restore Full Backup
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<span className="cm-rpm-history-icon"><DatabaseOutlined /></span>}
                    title={<Space wrap><Text strong>{row.backup_name || row.backup_id}</Text><Tag color={row.backup_type === "PRE_RESTORE" ? "orange" : "blue"}>{row.backup_type || "MANUAL"}</Tag></Space>}
                    description={
                      <div>
                        <Space size={[12, 4]} wrap>
                          <Text type="secondary">{row.created_on ? new Date(row.created_on).toLocaleString() : "Unknown date"}</Text>
                          <Text type="secondary">by {row.created_by || "system"}</Text>
                          <Text type="secondary">{totalRecords} records</Text>
                          {row.last_restored_on && <Text type="secondary">last restored {new Date(row.last_restored_on).toLocaleString()}</Text>}
                        </Space>
                        <div className="cm-rpm-backup-counts">
                          {Object.entries(row.counts || {}).map(([key, value]) => <Tag key={key}>{prettify(key.replace(/^cm_/, ""))}: {value}</Tag>)}
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              );
            }}
          />
        </Modal>

        <Modal
          open={recoveryOpen}
          onCancel={() => setRecoveryOpen(false)}
          footer={null}
          width={760}
          title={<Space><HistoryOutlined /><span>Permission Recovery · {selectedRole?.role_name || prettify(roleSlug)}</span></Space>}
          destroyOnHidden
        >
          <Alert
            type="info"
            showIcon
            message="Automatic recovery history"
            description="Before every permission update, CiberMandi stores the previous policy version in cm_role_policy_history. Before a restore, the current version is snapshotted again, so recovery is reversible."
            style={{ marginBottom: 14 }}
          />
          <List
            loading={historyLoading}
            dataSource={policyHistory}
            locale={{ emptyText: "No recovery snapshots exist for this role yet. A snapshot is created automatically before the next policy change." }}
            renderItem={(row) => {
              const historyId = String(row?._id || "");
              const permissionCount = Array.isArray(row.permissions) ? row.permissions.reduce((sum, item) => sum + (Array.isArray(item.actions) ? item.actions.length : 0), 0) : 0;
              return (
                <List.Item
                  className="cm-rpm-history-item"
                  actions={[
                    <Button
                      key="restore"
                      size="small"
                      icon={<RollbackOutlined />}
                      disabled={protectedRole || !historyId}
                      loading={restoringHistoryId === historyId}
                      onClick={() => restoreSnapshot(row)}
                    >
                      Restore
                    </Button>,
                  ]}
                >
                  <List.Item.Meta
                    avatar={<span className="cm-rpm-history-icon"><FileProtectOutlined /></span>}
                    title={<Space wrap><Text strong>Version {Number(row.snapshot_version || 0)}</Text><Tag>{String(row.snapshot_reason || "SNAPSHOT").replace(/_/g, " ")}</Tag></Space>}
                    description={
                      <Space size={[12, 4]} wrap>
                        <Text type="secondary">{row.changed_on ? new Date(row.changed_on).toLocaleString() : "Unknown date"}</Text>
                        <Text type="secondary">by {row.changed_by || "system"}</Text>
                        <Text type="secondary">{permissionCount} granted actions</Text>
                      </Space>
                    }
                  />
                </List.Item>
              );
            }}
          />
        </Modal>
      </div>
    </StepUpGuard>
  );
};
