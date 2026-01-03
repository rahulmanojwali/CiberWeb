import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, DEFAULT_LANGUAGE } from "../config/appConfig";

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
