import { useMemo } from "react";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { can, canonicalizeResourceKey } from "./adminUiConfig";

type CrudPermissions = {
  canView: boolean;
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
  const canonicalKey = canonicalizeResourceKey(resourceKey);
  const normalizeRole = (raw?: string | null) =>
    (raw || "")
      .toString()
      .toUpperCase()
      .replace(/[\s-]+/g, "_");
  const roleSlug = normalizeRole(uiConfig.role || (uiConfig.scope as any)?.role_slug || "");
  const isSuperAdmin = roleSlug === "SUPER_ADMIN";
  const masterOnly = options.masterOnly === true;

  const perms = useMemo(() => {
    const viewList = can(uiConfig.resources, `${canonicalKey}.list`, "VIEW");
    const viewDetail = can(uiConfig.resources, `${canonicalKey}.detail`, "VIEW");
    const view = viewList || viewDetail;
    let create = can(uiConfig.resources, `${canonicalKey}.create`, "CREATE");
    let edit = can(uiConfig.resources, `${canonicalKey}.edit`, "UPDATE");
    let deactivate = can(uiConfig.resources, `${canonicalKey}.deactivate`, "DEACTIVATE");

    if (isSuperAdmin) {
      // Super admin always has CRUD; view uses policy or default to true.
      return {
        canView: view || true,
        canCreate: true,
        canEdit: true,
        canDeactivate: true,
      };
    }

    // Org-admin fallback for org-scoped commodity products when policies are missing create/edit/deactivate.
    if (resourceKey === "commodity_products" && roleSlug === "ORG_ADMIN" && uiConfig.scope?.org_code) {
      if (!create) create = true;
      if (!edit) edit = true;
      if (!deactivate) deactivate = true;
    }
    if (roleSlug === "MANDI_ADMIN") {
      const mandiKeys = new Set(["mandis", "org_mandi_mappings"]);
      if (mandiKeys.has(canonicalKey)) {
        create = true;
        edit = true;
        deactivate = true;
      }
    }

    if (masterOnly) {
      // Master data: non-super roles are read-only regardless of policy.
      return {
        canView: view,
        canCreate: false,
        canEdit: false,
        canDeactivate: false,
      };
    }

    return {
      canView: view,
      canCreate: create,
      canEdit: edit,
      canDeactivate: deactivate,
    };
  }, [uiConfig.resources, canonicalKey, resourceKey, roleSlug, isSuperAdmin, masterOnly]);

  return {
    ...perms,
    roleSlug,
    isSuperAdmin,
  };
}

// import { useMemo } from "react";
// import { useAdminUiConfig } from "../contexts/admin-ui-config";
// import { can } from "./adminUiConfig";

// type CrudPermissions = {
//   canView: boolean;
//   canCreate: boolean;
//   canEdit: boolean;
//   canDeactivate: boolean;
//   roleSlug: string;
//   isSuperAdmin: boolean;
// };

// type CrudOptions = {
//   /**
//    * When true, create/edit/deactivate are allowed only for SUPER_ADMIN,
//    * even if policies accidentally grant others. Useful for master data.
//    */
//   masterOnly?: boolean;
// };

// /**
//  * Central helper to derive CRUD permissions from admin-ui-config resources and role.
//  * It standardises the resource/action keys and applies SUPER_ADMIN shortcuts.
//  */
// export function useCrudPermissions(resourceKey: string, options: CrudOptions = {}): CrudPermissions {
//   const uiConfig = useAdminUiConfig();
//   const normalizeRole = (raw?: string | null) =>
//     (raw || "")
//       .toString()
//       .toUpperCase()
//       .replace(/[\s-]+/g, "_");
//   const roleSlug = normalizeRole(uiConfig.role || (uiConfig.scope as any)?.role_slug || "");
//   const isSuperAdmin = roleSlug === "SUPER_ADMIN";
//   const masterOnly = options.masterOnly === true;

//   const perms = useMemo(() => {
//     const viewList = can(uiConfig.resources, `${resourceKey}.list`, "VIEW");
//     const viewDetail = can(uiConfig.resources, `${resourceKey}.detail`, "VIEW");
//     const view = viewList || viewDetail;
//     let create = can(uiConfig.resources, `${resourceKey}.create`, "CREATE");
//     let edit = can(uiConfig.resources, `${resourceKey}.edit`, "UPDATE");
//     let deactivate = can(uiConfig.resources, `${resourceKey}.deactivate`, "DEACTIVATE");

//     if (isSuperAdmin) {
//       // Super admin always has CRUD; view uses policy or default to true.
//       return {
//         canView: view || true,
//         canCreate: true,
//         canEdit: true,
//         canDeactivate: true,
//       };
//     }

//     // Org-admin fallback for org-scoped commodity products when policies are missing create/edit/deactivate.
//     if (resourceKey === "commodity_products" && roleSlug === "ORG_ADMIN" && uiConfig.scope?.org_code) {
//       if (!create) create = true;
//       if (!edit) edit = true;
//       if (!deactivate) deactivate = true;
//     }

//     if (masterOnly) {
//       // Master data: non-super roles are read-only regardless of policy.
//       return {
//         canView: view,
//         canCreate: false,
//         canEdit: false,
//         canDeactivate: false,
//       };
//     }

//     return {
//       canView: view,
//       canCreate: create,
//       canEdit: edit,
//       canDeactivate: deactivate,
//     };
//   }, [uiConfig.resources, resourceKey, isSuperAdmin, masterOnly]);

//   return {
//     ...perms,
//     roleSlug,
//     isSuperAdmin,
//   };
// }
