import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { API_BASE_URL, API_ROUTES, API_TAGS, DEFAULT_COUNTRY, DEFAULT_LANGUAGE } from "../config/appConfig";
import { encryptGenericPayload } from "../utils/aesUtilBrowser";
import type { AdminScope, AdminUiConfig, UiResource } from "../utils/adminUiConfig";

type AdminUiContextValue = AdminUiConfig & {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
};

const defaultValue: AdminUiContextValue = {
  role: null,
  scope: null,
  resources: [],
  loading: false,
  error: null,
  refresh: async () => {},
};

const STORAGE_KEY = "admin_ui_config_cache";

const AdminUiConfigContext = createContext<AdminUiContextValue>(defaultValue);

const readCachedConfig = (): AdminUiConfig | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      role: parsed.role ?? null,
      scope: parsed.scope ?? null,
      resources: Array.isArray(parsed.resources) ? parsed.resources : [],
    };
  } catch {
    return null;
  }
};

const writeCachedConfig = (config: AdminUiConfig) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore cache errors
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

const normalizeScope = (scope: any): AdminScope | null => {
  if (!scope || typeof scope !== "object") return null;
  return {
    org_code: scope.org_code ?? null,
    mandi_codes: Array.isArray(scope.mandi_codes) ? scope.mandi_codes : [],
    org_level: scope.org_level ?? null,
    mandi_level: scope.mandi_level ?? null,
    role_scope: scope.role_scope ?? null,
  };
};

export const AdminUiConfigProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRole] = useState<string | null>(null);
  const [scope, setScope] = useState<AdminScope | null>(null);
  const [resources, setResources] = useState<UiResource[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bootstrap from cache if present
  useEffect(() => {
    const cached = readCachedConfig();
    if (cached) {
      setRole(cached.role);
      setScope(normalizeScope(cached.scope));
      setResources(Array.isArray(cached.resources) ? cached.resources : []);
    }
  }, []);

  const fetchConfig = useCallback(async () => {
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
          api: API_TAGS.ADMIN_UI_CONFIG.getAdminUiConfig,
        },
        language,
      };

      const encryptedData = await encryptGenericPayload(JSON.stringify(payload));

      const { data } = await axios.post(
        `${API_BASE_URL}${API_ROUTES.admin.getAdminUiConfig}`,
        { encryptedData },
        { headers: { "Content-Type": "application/json" } },
      );

      const resp = data?.response || {};
      const code = String(resp?.responsecode ?? "");
      if (code !== "0") {
        const message = resp?.description || "Failed to load admin UI config.";
        setError(message);
        return;
      }

      const respData = resp?.data || {};
      const nextRole: string | null = respData?.role ?? null;
      const nextScope = normalizeScope(respData?.scope);
      const nextResources: UiResource[] = Array.isArray(respData?.resources)
        ? respData.resources
        : [];

      setRole(nextRole);
      setScope(nextScope);
      setResources(nextResources);
      writeCachedConfig({ role: nextRole, scope: nextScope, resources: nextResources });
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
      resources,
      loading,
      error,
      refresh: fetchConfig,
    }),
    [role, scope, resources, loading, error, fetchConfig],
  );

  return (
    <AdminUiConfigContext.Provider value={value}>
      {children}
    </AdminUiConfigContext.Provider>
  );
};

export const useAdminUiConfig = () => useContext(AdminUiConfigContext);
