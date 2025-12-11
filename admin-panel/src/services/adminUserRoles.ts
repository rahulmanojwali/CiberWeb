import { postEncrypted } from "./apiClient";
import { API_ROUTES, API_TAGS } from "../config/appConfig";

export interface AdminUserRoleListResponse {
  response?: { responsecode: string; description: string };
  data?: {
    users?: Array<{
      user_id?: string;
      username: string;
      email?: string | null;
      mobile?: string | null;
      is_active?: string;
      created_on?: string | null;
      roles?: Array<{
        _id?: string;
        role_code: string;
        role_scope?: string | null;
        org_id?: string | null;
        is_active?: string;
      }>;
    }>;
    roles?: Array<{
      role_code: string;
      role_scope?: string | null;
      name?: string;
      description?: string | null;
    }>;
    organisations?: Array<{
      org_id: string;
      org_code?: string | null;
      org_name?: string | null;
      is_active?: string;
    }>;
    mandis?: Array<{
      mandi_id: number;
      mandi_slug?: string | null;
      name?: string;
      state_code?: string | null;
      district_name_en?: string | null;
    }>;
  };
}

export async function getAdminUsersWithRoles(items: any): Promise<AdminUserRoleListResponse> {
  return postEncrypted(API_ROUTES.admin.getAdminUsersWithRoles, { items });
}

// Stubs for future use; they simply forward payload to backend.
export async function assignUserRole(params: any) {
  const items = { ...params, api: API_TAGS.ADMIN_USER_ROLES.assign };
  return postEncrypted(API_ROUTES.admin.assignUserRole, { items });
}

export async function deactivateUserRole(params: any) {
  const items = { ...params, api: API_TAGS.ADMIN_USER_ROLES.deactivate };
  return postEncrypted(API_ROUTES.admin.deactivateUserRole, { items });
}
