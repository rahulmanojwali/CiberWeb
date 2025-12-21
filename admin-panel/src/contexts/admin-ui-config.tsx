import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE_URL, API_ROUTES, API_TAGS, DEFAULT_COUNTRY, DEFAULT_LANGUAGE } from "../config/appConfig";
import { encryptGenericPayload } from "../utils/aesUtilBrowser";
import { canonicalizeResourceKey, type AdminScope, type AdminUiConfig, type UiResource } from "../utils/adminUiConfig";

type AdminUiContextValue = AdminUiConfig & {
  loading: boolean;
  error: string | null;
  refresh: (opts?: { invalidate?: boolean }) => Promise<void>;
};

const defaultValue: AdminUiContextValue = {
  role: null,
  scope: null,
  ui_resources: [],
  permissions: [],
  resources: [],
  loading: false,
  error: null,
  refresh: async () => {},
};

const STORAGE_KEY = "admin_ui_config_cache";
const CACHE_VERSION = "v2";

const oidToString = (v: any): string | null => {
  if (!v) return null;
  if (typeof v === "string") return v;
  if (v.$oid) return String(v.$oid);
  if ((v as any).oid) return String((v as any).oid);
  try {
    return String(v.toString());
  } catch {
    return null;
  }
};

const AdminUiConfigContext = createContext<AdminUiContextValue>(defaultValue);

const canonicalRoleSlug = (role?: string | null) => {
  if (!role) return null;
  const r = String(role).trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (r === "SUPERADMIN") return "SUPER_ADMIN";
  if (r === "ORGADMIN") return "ORG_ADMIN";
  if (r === "MANDIADMIN") return "MANDI_ADMIN";
  return r;
};

const readCachedConfig = (): AdminUiConfig | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (parsed.cacheVersion !== CACHE_VERSION) return null;
    return {
      role: parsed.role ?? null,
      scope: parsed.scope ?? null,
      ui_resources: Array.isArray(parsed.ui_resources) ? parsed.ui_resources : [],
      permissions: Array.isArray(parsed.permissions) ? parsed.permissions : [],
    };
  } catch {
    return null;
  }
};

const writeCachedConfig = (config: AdminUiConfig) => {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...config,
        cacheVersion: CACHE_VERSION,
      }),
    );
  } catch {
    // ignore cache errors
  }
};

const clearCachedConfig = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
};

const getStoredUser = () => {
  try {
    const raw = localStorage.getItem("cd_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const syncUserScope = (scope: AdminScope | null) => {
  try {
    const raw = localStorage.getItem("cd_user");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    const next = {
      ...parsed,
      org_code: scope?.org_code ?? parsed?.org_code ?? null,
      org_id: scope?.org_id ?? parsed?.org_id ?? null,
    };
    localStorage.setItem("cd_user", JSON.stringify(next));
  } catch {
    // ignore
  }
};

const normalizeScope = (scope: any): AdminScope | null => {
  if (!scope || typeof scope !== "object") return null;
  return {
    org_code: scope.org_code ?? null,
    org_id: oidToString(scope.org_id) ?? null,
    mandi_codes: Array.isArray(scope.mandi_codes) ? scope.mandi_codes : [],
    org_level: scope.org_level ?? null,
    mandi_level: scope.mandi_level ?? null,
    role_scope: scope.role_scope ?? null,
  };
};

const normalizeUiResources = (resources: UiResource[]): UiResource[] => {
  const normalized = (resources || []).map((r) => ({
    ...r,
    resource_key: canonicalizeResourceKey(r.resource_key),
    parent_resource_key: canonicalizeResourceKey(r.parent_resource_key) || null,
  }));

  const deduped = new Map<string, UiResource>();
  normalized.forEach((r) => {
    const key = canonicalizeResourceKey(r.resource_key);
    if (!key) return;
    if (!deduped.has(key)) deduped.set(key, r);
  });

  const ensure = (payload: UiResource) => {
    const key = canonicalizeResourceKey(payload.resource_key);
    if (!key || deduped.has(key)) return;
    deduped.set(key, { ...payload, resource_key: key, parent_resource_key: canonicalizeResourceKey(payload.parent_resource_key) || null });
  };

  const mandiView = ["VIEW"];
  const mandiCrud = ["VIEW", "CREATE", "UPDATE", "DEACTIVATE"];
  ensure({
    resource_key: "org_mandi_mappings.menu",
    screen: "Org-Mandi Mapping",
    element: "Org-Mandi menu",
    ui_type: "menu",
    route: "/org-mandi",
    parent_resource_key: null,
    allowed_actions: mandiView,
    is_active: true,
    metadata: { injected: true },
  } as UiResource);
  ensure({
    resource_key: "org_mandi.menu",
    screen: "Org-Mandi Mapping",
    element: "Org-Mandi menu (legacy key)",
    ui_type: "menu",
    route: "/org-mandi",
    parent_resource_key: null,
    allowed_actions: mandiView,
    is_active: true,
    metadata: { injected: true, alias_for: "org_mandi_mappings.menu" },
  } as UiResource);
  ensure({
    resource_key: "org_mandi_mappings.list",
    screen: "Org-Mandi Mapping",
    element: "Org-Mandi list",
    ui_type: "table",
    route: "/org-mandi",
    parent_resource_key: "org_mandi_mappings.menu",
    allowed_actions: mandiView,
    is_active: true,
    metadata: { injected: true },
  } as UiResource);
  ensure({
    resource_key: "org_mandi.list",
    screen: "Org-Mandi Mapping",
    element: "Org-Mandi list (legacy key)",
    ui_type: "table",
    route: "/org-mandi",
    parent_resource_key: "org_mandi.menu",
    allowed_actions: mandiView,
    is_active: true,
    metadata: { injected: true, alias_for: "org_mandi_mappings.list" },
  } as UiResource);
  ensure({
    resource_key: "org_mandi_mappings.create",
    screen: "Org-Mandi Mapping",
    element: "Create org-mandi mapping",
    ui_type: "button",
    route: "/org-mandi",
    parent_resource_key: "org_mandi_mappings.menu",
    allowed_actions: mandiCrud,
    is_active: true,
    metadata: { injected: true },
  } as UiResource);
  ensure({
    resource_key: "org_mandi.create",
    screen: "Org-Mandi Mapping",
    element: "Create org-mandi mapping (legacy key)",
    ui_type: "button",
    route: "/org-mandi",
    parent_resource_key: "org_mandi.menu",
    allowed_actions: mandiCrud,
    is_active: true,
    metadata: { injected: true, alias_for: "org_mandi_mappings.create" },
  } as UiResource);
  ensure({
    resource_key: "org_mandi_mappings.edit",
    screen: "Org-Mandi Mapping",
    element: "Edit org-mandi mapping",
    ui_type: "button",
    route: "/org-mandi",
    parent_resource_key: "org_mandi_mappings.menu",
    allowed_actions: mandiCrud,
    is_active: true,
    metadata: { injected: true },
  } as UiResource);
  ensure({
    resource_key: "org_mandi.edit",
    screen: "Org-Mandi Mapping",
    element: "Edit org-mandi mapping (legacy key)",
    ui_type: "button",
    route: "/org-mandi",
    parent_resource_key: "org_mandi.menu",
    allowed_actions: mandiCrud,
    is_active: true,
    metadata: { injected: true, alias_for: "org_mandi_mappings.edit" },
  } as UiResource);
  ensure({
    resource_key: "org_mandi_mappings.deactivate",
    screen: "Org-Mandi Mapping",
    element: "Deactivate org-mandi mapping",
    ui_type: "button",
    route: "/org-mandi",
    parent_resource_key: "org_mandi_mappings.menu",
    allowed_actions: mandiCrud,
    is_active: true,
    metadata: { injected: true },
  } as UiResource);
  ensure({
    resource_key: "org_mandi.deactivate",
    screen: "Org-Mandi Mapping",
    element: "Deactivate org-mandi mapping (legacy key)",
    ui_type: "button",
    route: "/org-mandi",
    parent_resource_key: "org_mandi.menu",
    allowed_actions: mandiCrud,
    is_active: true,
    metadata: { injected: true, alias_for: "org_mandi_mappings.deactivate" },
  } as UiResource);

  return Array.from(deduped.values());
};

export const AdminUiConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<string | null>(null);
  const [scope, setScope] = useState<AdminScope | null>(null);
  const [uiResources, setUiResources] = useState<UiResource[]>([]);
  const [permissions, setPermissions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bootstrap from cache if present
  useEffect(() => {
    const cached = readCachedConfig();
    if (cached) {
      const normalizedCachedResources = normalizeUiResources(
        Array.isArray(cached.ui_resources) ? cached.ui_resources : Array.isArray((cached as any).resources) ? (cached as any).resources : [],
      );
      setRole(canonicalRoleSlug(cached.role));
      setScope(normalizeScope(cached.scope));
      setUiResources(normalizedCachedResources);
      setPermissions(Array.isArray(cached.permissions) ? cached.permissions : []);
    }
  }, []);

  const fetchConfig = useCallback(async (opts?: { invalidate?: boolean }) => {
    if (opts?.invalidate) {
      clearCachedConfig();
    }
    const user = getStoredUser();
    const username = user?.username;
    const country = user?.country || user?.country_code || DEFAULT_COUNTRY;
    const language = user?.language || DEFAULT_LANGUAGE;

    if (!username) {
      setError("No admin session found.");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload = {
        items: {
          api_name: "getAdminUiConfig",
          username,
          country,
          language,
          api: API_TAGS.ADMIN_UI_CONFIG.getAdminUiConfig,
        },
      };

      // TEMP DEBUG LOG
      // eslint-disable-next-line no-console
      console.log("[adminUiConfig] request items", payload.items);

      const encryptedData = await encryptGenericPayload(JSON.stringify(payload));

      const { data } = await axios.post(
        `${API_BASE_URL}${API_ROUTES.admin.getAdminUiConfig}`,
        { encryptedData },
        { headers: { "Content-Type": "application/json" } },
      );

      const resp = data?.response || {};
      // eslint-disable-next-line no-console
      console.log("[adminUiConfig] response", resp);
      const code = String(resp?.responsecode ?? "");
      if (code !== "0") {
        const message = resp?.description || "Failed to load admin UI config.";
        setError(message);
        return;
      }

      const respData = resp?.data || {};
      const nextRole: string | null = canonicalRoleSlug(respData?.role ?? null);
      const nextScope = normalizeScope(respData?.scope);
      const nextUiResources: UiResource[] = Array.isArray(respData?.ui_resources)
        ? respData.ui_resources
        : Array.isArray(respData?.resources)
          ? respData.resources
          : [];
      const normalizedUiResources = normalizeUiResources(nextUiResources);
      const nextPermissions: any[] = Array.isArray(respData?.permissions)
        ? respData.permissions
        : [];

      setRole(nextRole);
      setScope(nextScope);
      setUiResources(normalizedUiResources);
      setPermissions(nextPermissions);
      writeCachedConfig({
        role: nextRole,
        scope: nextScope,
        ui_resources: normalizedUiResources,
        permissions: nextPermissions,
        resources: normalizedUiResources,
      });
      syncUserScope(nextScope);
    } catch (e: any) {
      setError(e?.message || "Network error while loading admin UI config.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const value = useMemo(
    () => ({
      role,
      scope,
      ui_resources: uiResources,
      permissions,
      resources: uiResources,
      loading,
      error,
      refresh: (opts?: { invalidate?: boolean }) => fetchConfig(opts),
    }),
    [role, scope, uiResources, permissions, loading, error, fetchConfig],
  );

  return (
    <AdminUiConfigContext.Provider value={value}>
      {children}
    </AdminUiConfigContext.Provider>
  );
};

export const useAdminUiConfig = () => useContext(AdminUiConfigContext);
