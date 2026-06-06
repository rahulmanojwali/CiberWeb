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
  const roleSlug = (uiConfig.role || "").trim().toUpperCase().replace(/[\s-]+/g, "_");

  const permissionsMap = useMemo(() => {
    const permSource = uiConfig.permissions || [];
    const fallback = (uiConfig as any).resources || [];
    const merged = [...fallback, ...permSource];
    merged.forEach((permission) => {
      console.log("RAW_PERMISSION", JSON.stringify(permission, null, 2));
    });
    const actionMap = buildCanonicalPermissionMap(merged);
    const map: Record<string, Set<string>> = {};
    Object.entries(actionMap).forEach(([key, actions]) => {
      map[key] = new Set(actions.map((action) => normalizeAction(action)).filter(Boolean));
    });
    if (roleSlug === "MANDI_ADMIN") {
      const ensure = (resourceKey: string, actions: string[]) => {
        const key = canonicalizeResourceKey(resourceKey);
        if (!key) return;
        const existing = map[key] || new Set<string>();
        actions.forEach((a) => existing.add(a));
        map[key] = existing;
      };
      const mandiActions = ["VIEW", "CREATE", "UPDATE", "DEACTIVATE"];
      ensure("mandis.menu", ["VIEW"]);
      ensure("mandis.list", ["VIEW"]);
      ensure("mandis.detail", ["VIEW"]);
      ensure("mandis.create", mandiActions);
      ensure("mandis.edit", mandiActions);
      ensure("mandis.deactivate", mandiActions);
      ensure("mandis.system.list", ["VIEW"]);
      ensure("mandis.org.list", ["VIEW"]);
      ensure("mandis.import", ["CREATE"]);
      ensure("org_mandi_mappings.menu", ["VIEW"]);
      ensure("org_mandi_mappings.list", ["VIEW"]);
      ensure("org_mandi_mappings.create", mandiActions);
      ensure("org_mandi_mappings.edit", mandiActions);
      ensure("org_mandi_mappings.deactivate", mandiActions);
      ensure("lots.menu", ["VIEW"]);
      ensure("lots.list", ["VIEW"]);
      ensure("lots.detail", ["VIEW"]);
      ensure("lots.verify", ["UPDATE"]);
      ensure("lots.map_to_auction", ["UPDATE"]);
      ensure("lots.update_status", ["UPDATE"]);
    }
    console.log("PERMISSION_MAP", map);
    return map;
  }, [uiConfig.permissions, (uiConfig as any).resources, roleSlug]);

  const can = (resourceKey: string, action: Action = "VIEW") => {
    const normKey = canonicalizeResourceKey(resourceKey);
    const normAction = normalizeAction(String(action));
    if (!normKey || !normAction) return false;
    return hasAccess(permissionsMap, normKey, normalizeActionBase(normAction));
  };

  const authContext = {
    role: (uiConfig.role || "").toUpperCase(),
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
