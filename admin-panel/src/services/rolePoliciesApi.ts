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
    api_name: "getRolePoliciesDashboardData",
    username,
    language,
    country,
    resource_key: "role_policies.view",
    action: "VIEW",
  };

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
  expected_version,
}: {
  username: string;
  language?: string;
  country?: string;
  role_slug: string;
  permissions: any[];
  expected_version?: number;
}) {
  const items: Record<string, any> = {
    api: "updateRolePolicies",
    api_name: "updateRolePolicies",
    username,
    language,
    country,
    role_slug,
    permissions,
    expected_version,
    resource_key: "role_policies.edit",
    action: "UPDATE",
  };

  return postEncrypted(API_ROUTES.admin.updateRolePolicies, items);
}


export async function fetchRolePolicyHistory({
  username,
  language = DEFAULT_LANGUAGE,
  country = "IN",
  role_slug,
  page = 1,
  limit = 20,
}: {
  username: string;
  language?: string;
  country?: string;
  role_slug: string;
  page?: number;
  limit?: number;
}) {
  return postEncrypted(API_ROUTES.admin.getRolePolicyHistory, {
    api: API_TAGS.ROLE_POLICIES.history,
    api_name: API_TAGS.ROLE_POLICIES.history,
    username,
    language,
    country,
    role_slug,
    page,
    limit,
    resource_key: "role_policies.view",
    action: "VIEW",
  });
}

export async function restoreRolePolicyVersion({
  username,
  language = DEFAULT_LANGUAGE,
  country = "IN",
  role_slug,
  history_id,
  expected_version,
}: {
  username: string;
  language?: string;
  country?: string;
  role_slug: string;
  history_id: string;
  expected_version?: number;
}) {
  return postEncrypted(API_ROUTES.admin.restoreRolePolicyVersion, {
    api: API_TAGS.ROLE_POLICIES.restore,
    api_name: API_TAGS.ROLE_POLICIES.restore,
    username,
    language,
    country,
    role_slug,
    history_id,
    expected_version,
    resource_key: "role_policies.edit",
    action: "UPDATE",
  });
}

export async function updateRolePolicy({
  username,
  language = DEFAULT_LANGUAGE,
  country = "IN",
  role_slug,
  permissions,
  expected_version,
}: {
  username: string;
  language?: string;
  country?: string;
  role_slug: string;
  permissions: any[];
  expected_version?: number;
}) {
  return updateRolePolicies({
    username,
    language,
    country,
    role_slug,
    permissions,
    expected_version,
  });
}
