import { useMemo } from "react";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { canonicalizeResourceKey } from "../utils/adminUiConfig";

type Action = "VIEW" | "CREATE" | "UPDATE" | "DEACTIVATE" | "UPLOAD" | string;

const normalizeAction = (action?: string | null) => {
  if (!action) return "";
  const upper = String(action).trim().toUpperCase();
  if (upper === "EDIT") return "UPDATE";
  if (upper === "DELETE" || upper === "DISABLE" || upper === "REMOVE") return "DEACTIVATE";
  return upper;
};

const normalizeActionsArray = (actions: any): string[] => {
  if (!actions) return [];
  let arr: any[] = [];
  if (Array.isArray(actions)) {
    arr = actions;
  } else if (typeof actions === "string") {
    arr = actions.split(",").map((s) => s.trim());
  } else {
    return [];
  }
  return arr
    .map((a) => {
      if (a && typeof a === "object" && "action" in a) return (a as any).action;
      return a;
    })
    .map((a) => normalizeAction(a))
    .filter(Boolean);
};

export function usePermissions() {
  const uiConfig = useAdminUiConfig();
  const roleSlug = (uiConfig.role || "").trim().toUpperCase().replace(/[\s-]+/g, "_");

  const permissionsMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    const permSource = uiConfig.permissions || [];
    const fallback = (uiConfig as any).resources || [];
    const merged = permSource.length ? permSource : fallback;
    merged.forEach((res: any) => {
      const key = canonicalizeResourceKey(res.resource_key || res.resource || "");
      if (!key) return;
      const actionsRaw = res.allowed_actions ?? res.actions ?? res.permissions ?? [];
      const actions = normalizeActionsArray(actionsRaw);
      const set = new Set<string>();
      actions.forEach((val: string) => set.add(val));
      map[key] = set;
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
      ensure("org_mandi_mapping.menu", ["VIEW"]);
      ensure("org_mandi_mapping.list", ["VIEW"]);
      ensure("org_mandi_mapping.create", mandiActions);
      ensure("org_mandi_mapping.edit", mandiActions);
      ensure("org_mandi_mapping.deactivate", mandiActions);
    }
    return map;
  }, [uiConfig.permissions, (uiConfig as any).resources, roleSlug]);

  const can = (resourceKey: string, action: Action) => {
    const normKey = canonicalizeResourceKey(resourceKey);
    const normAction = normalizeAction(String(action));
    if (!normKey || !normAction) return false;
    const set = permissionsMap[normKey];
    if (!set) return false;
    return set.has(normAction);
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

  return { permissionsMap, can, authContext, isSuper, getPermissionEntry };
}
