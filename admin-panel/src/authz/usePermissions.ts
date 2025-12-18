import { useMemo } from "react";
import { useAdminUiConfig } from "../contexts/admin-ui-config";

type Action = "VIEW" | "CREATE" | "UPDATE" | "DEACTIVATE" | "UPLOAD" | string;

const normalizeResourceKey = (key?: string | null) => {
  if (!key) return "";
  return String(key).trim().replace(/\s+/g, "").replace(/_{2,}/g, "_").toLowerCase();
};

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

  const permissionsMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    const permSource = uiConfig.permissions || [];
    const fallback = (uiConfig as any).resources || [];
    const merged = permSource.length ? permSource : fallback;
    merged.forEach((res: any) => {
      const key = normalizeResourceKey(res.resource_key || res.resource || "");
      if (!key) return;
      const actionsRaw = res.allowed_actions ?? res.actions ?? res.permissions ?? [];
      const actions = normalizeActionsArray(actionsRaw);
      const set = new Set<string>();
      actions.forEach((val: string) => set.add(val));
      map[key] = set;
    });
    return map;
  }, [uiConfig.permissions, (uiConfig as any).resources]);

  const can = (resourceKey: string, action: Action) => {
    const normKey = normalizeResourceKey(resourceKey);
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
    const normKey = normalizeResourceKey(resourceKey);
    return permissionsMap[normKey] ? { key: normKey, actions: Array.from(permissionsMap[normKey]) } : null;
  };

  return { permissionsMap, can, authContext, isSuper, getPermissionEntry };
}
