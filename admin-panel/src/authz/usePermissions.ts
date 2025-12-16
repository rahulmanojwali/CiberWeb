import { useMemo } from "react";
import { useAdminUiConfig } from "../contexts/admin-ui-config";

type Action = "VIEW" | "CREATE" | "UPDATE" | "DEACTIVATE" | "UPLOAD" | string;

export function usePermissions() {
  const uiConfig = useAdminUiConfig();

  const permissionsMap = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    (uiConfig.resources || []).forEach((res: any) => {
      const key = res.resource_key || res.resource || "";
      if (!key) return;
      const actions = res.actions || res.allowed_actions || [];
      const set = new Set<string>();
      actions.forEach((a: any) => {
        const val = String(a || "").toUpperCase();
        if (val) set.add(val);
      });
      map[key] = set;
    });
    return map;
  }, [uiConfig.resources]);

  const can = (resourceKey: string, action: Action) => {
    if (!resourceKey || !action) return false;
    const set = permissionsMap[resourceKey];
    if (!set) return false;
    return set.has(String(action).toUpperCase());
  };

  const authContext = {
    role: (uiConfig.role || "").toUpperCase(),
    org_id: uiConfig.scope?.org_id || null,
    org_code: uiConfig.scope?.org_code || null,
  };

  const isSuper = authContext.role === "SUPER_ADMIN";

  return { permissionsMap, can, authContext, isSuper };
}
