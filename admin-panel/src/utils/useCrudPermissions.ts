import { useMemo } from "react";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { can } from "./adminUiConfig";

type CrudPermissions = {
  canView: boolean;
  canViewDetail: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDeactivate: boolean;
  roleSlug: string;
  isSuperAdmin: boolean;
};

type CrudOptions = {
  /**
   * When true, create/edit/deactivate are allowed only for SUPER_ADMIN,
   * even if policies accidentally grant others. Useful for master data.
   */
  masterOnly?: boolean;
};

/**
 * Central helper to derive CRUD permissions from admin-ui-config resources and role.
 * It standardises the resource/action keys and applies SUPER_ADMIN shortcuts.
 */
export function useCrudPermissions(resourceKey: string, options: CrudOptions = {}): CrudPermissions {
  const uiConfig = useAdminUiConfig();
  const roleSlug = (uiConfig.role || "").toUpperCase();
  const isSuperAdmin = roleSlug === "SUPER_ADMIN";
  const masterOnly = options.masterOnly === true;

  const perms = useMemo(() => {
    const viewList = can(uiConfig.resources, `${resourceKey}.list`, "VIEW");
    const viewDetail = can(uiConfig.resources, `${resourceKey}.detail`, "VIEW") || can(uiConfig.resources, `${resourceKey}.detail`, "VIEW_DETAIL");
    const view = viewList || viewDetail;
    const create = can(uiConfig.resources, `${resourceKey}.create`, "CREATE");
    const edit = can(uiConfig.resources, `${resourceKey}.edit`, "UPDATE");
    const deactivate = can(uiConfig.resources, `${resourceKey}.deactivate`, "DEACTIVATE");

    if (isSuperAdmin) {
      // Super admin always has CRUD; view uses policy or default to true.
      return {
        canView: view || true,
        canViewDetail: true,
        canCreate: true,
        canEdit: true,
        canDeactivate: true,
      };
    }

    if (masterOnly) {
      // Master data: non-super roles are read-only regardless of policy.
      return {
        canView: view,
        canViewDetail: viewDetail,
        canCreate: false,
        canEdit: false,
        canDeactivate: false,
      };
    }

    return {
      canView: view,
      canViewDetail: viewDetail,
      canCreate: create,
      canEdit: edit,
      canDeactivate: deactivate,
    };
  }, [uiConfig.resources, resourceKey, isSuperAdmin, masterOnly]);

  return {
    ...perms,
    roleSlug,
    isSuperAdmin,
  };
}
