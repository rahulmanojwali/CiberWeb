import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

type WithRequiredUsername<T> = T & { username: string };

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
        mandi_ids?: number[];
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
      org_id?: string | number | null;
      state_code?: string | null;
      district_name_en?: string | null;
      is_active?: string | null;
    }>;
  };
}

export async function getAdminUsersWithRoles(
  params: WithRequiredUsername<{
    language?: string;
    country?: string;
    filters?: Record<string, any>;
  }>,
): Promise<AdminUserRoleListResponse> {
  const { username, language = DEFAULT_LANGUAGE, ...rest } = params;
  const items = {
    api: API_TAGS.ADMIN_USER_ROLES.list,
    username,
    language,
    ...rest,
  };
  return postEncrypted(API_ROUTES.admin.getAdminUsersWithRoles, items);
}

export async function assignUserRole(
  params: WithRequiredUsername<{
    language?: string;
    target_user_id: string;
    role_code: string;
    role_scope?: string | null;
    org_id?: string | null;
    mandi_ids?: Array<number | string>;
  }>,
) {
  const { username, language = DEFAULT_LANGUAGE, ...rest } = params;
  const items = {
    api: API_TAGS.ADMIN_USER_ROLES.assign,
    username,
    language,
    ...rest,
  };
  return postEncrypted(API_ROUTES.admin.assignUserRole, items);
}

export async function deactivateUserRole(
  params: WithRequiredUsername<{
    language?: string;
    user_role_id: string;
  }>,
) {
  const { username, language = DEFAULT_LANGUAGE, ...rest } = params;
  const items = {
    api: API_TAGS.ADMIN_USER_ROLES.deactivate,
    username,
    language,
    ...rest,
  };
  return postEncrypted(API_ROUTES.admin.deactivateUserRole, items);
}
