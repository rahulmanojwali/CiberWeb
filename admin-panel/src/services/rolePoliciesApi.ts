import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

export async function fetchRolePoliciesDashboardData({
  username,
  language = DEFAULT_LANGUAGE,
  country = "IN",
}: {
  username: string;
  language?: string;
  country?: string;
}) {
  const items: Record<string, any> = {
    api: "getRolePoliciesDashboardData",
    username,
    language,
    country,
  };

  // TEMP DEBUG LOG
  // eslint-disable-next-line no-console
  console.log("[dashboard] items", items);

  return postEncrypted(API_ROUTES.admin.getRolePoliciesDashboardData, items);
}

export async function fetchUiResourcesCatalog({
  username,
  language = DEFAULT_LANGUAGE,
  country = "IN",
}: {
  username: string;
  language?: string;
  country?: string;
}) {
  return postEncrypted(API_ROUTES.admin.getUiResourcesCatalog, {
    api: API_TAGS.ROLE_POLICIES.catalog,
    api_name: API_TAGS.ROLE_POLICIES.catalog,
    username,
    language,
    country,
  });
}

export async function fetchRolePolicy({
  username,
  language = DEFAULT_LANGUAGE,
  country = "IN",
  role_slug,
}: {
  username: string;
  language?: string;
  country?: string;
  role_slug: string;
}) {
  return postEncrypted(API_ROUTES.admin.getRolePolicy, {
    api: API_TAGS.ROLE_POLICIES.get,
    api_name: API_TAGS.ROLE_POLICIES.get,
    username,
    language,
    country,
    role_slug,
  });
}

export async function updateRolePolicies({
  username,
  language = DEFAULT_LANGUAGE,
  country = "IN",
  role_slug,
  permissions,
}: {
  username: string;
  language?: string;
  country?: string;
  role_slug: string;
  permissions: any[];
}) {
  const items: Record<string, any> = {
    api: "updateRolePolicies",
    username,
    language,
    country,
    role_slug,
    permissions,
  };

  // TEMP DEBUG LOG
  // eslint-disable-next-line no-console
  console.log("[updateRolePolicies] items", items);

  return postEncrypted(API_ROUTES.admin.updateRolePolicies, items);
}

export async function updateRolePolicy({
  username,
  language = DEFAULT_LANGUAGE,
  country = "IN",
  role_slug,
  permissions,
}: {
  username: string;
  language?: string;
  country?: string;
  role_slug: string;
  permissions: any[];
}) {
  return postEncrypted(API_ROUTES.admin.updateRolePolicy, {
    api: API_TAGS.ROLE_POLICIES.updateOne,
    api_name: API_TAGS.ROLE_POLICIES.updateOne,
    username,
    language,
    country,
    role_slug,
    permissions,
  });
}
