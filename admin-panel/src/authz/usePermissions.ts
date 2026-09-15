import { useMemo } from "react";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { canonicalizeResourceKey } from "../utils/adminUiConfig";
import { hasAccess, normalizeAction as normalizeActionBase } from "../utils/rbacHelper";
import { buildCanonicalPermissionMap } from "../utils/permissions";

type Action = "VIEW" | "CREATE" | "UPDATE" | "DEACTIVATE" | "UPLOAD" | string;

const normalizeAction = (action?: string | null) => {
  if (!action) return "";
  const upper = String(action).trim().toUpperCase();
  if (upper === "ADD" || upper === "INSERT") return "CREATE";
  if (upper === "EDIT") return "UPDATE";
  if (upper === "DELETE" || upper === "DISABLE" || upper === "REMOVE") return "DEACTIVATE";
  if (upper === "DETAIL") return "VIEW";
  return upper;
};

export function usePermissions() {
  const uiConfig = useAdminUiConfig();
  const permissionsMap = useMemo(() => {
    const permSource = uiConfig.permissions || [];
    const fallback = (uiConfig as any).resources || [];
    const merged = [...fallback, ...permSource];
    const actionMap = buildCanonicalPermissionMap(merged);
    const map: Record<string, Set<string>> = {};
    Object.entries(actionMap).forEach(([key, actions]) => {
      map[key] = new Set(actions.map((action) => normalizeAction(action)).filter(Boolean));
    });
    // Do not synthesize frontend permissions from hard-coded role names.
    // The effective role policy returned by the API is authoritative for all
    // menu and action visibility. Frontend-only grants can make the UI disagree
    // with backend RBAC and can expose controls a role was never assigned.
    return map;
  }, [uiConfig.permissions, (uiConfig as any).resources]);

  const can = (resourceKey: string, action: Action = "VIEW") => {
    const normKey = canonicalizeResourceKey(resourceKey);
    const normAction = normalizeAction(String(action));
    if (!normKey || !normAction) return false;
    return hasAccess(permissionsMap, normKey, normalizeActionBase(normAction));
  };

  const authContext = {
    role: (uiConfig.role || "").toUpperCase(),
    role_scope: String(uiConfig.scope?.role_scope || "").trim().toUpperCase(),
    org_id: uiConfig.scope?.org_id || null,
    org_code: uiConfig.scope?.org_code || null,
  };

  const isSuper = authContext.role === "SUPER_ADMIN";

  const getPermissionEntry = (resourceKey: string) => {
    const normKey = canonicalizeResourceKey(resourceKey);
    return permissionsMap[normKey] ? { key: normKey, actions: Array.from(permissionsMap[normKey]) } : null;
  };

  return { permissionsMap, can, authContext, isSuper, getPermissionEntry, loadingPermissions: uiConfig.loading };
}
