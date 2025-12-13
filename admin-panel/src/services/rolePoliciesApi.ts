// src/services/rolePoliciesApi.ts
import axios from "axios";
import { encryptGenericPayload } from "../utils/aesUtilBrowser";
import {
  API_BASE_URL,
  API_TAGS,
  API_ROUTES,
  DEFAULT_LANGUAGE,
} from "../config/appConfig";

function authHeaders() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("cd_token") : null;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function postEncrypted(path: string, items: Record<string, any>) {
  const payload = { items };
  const encryptedData = await encryptGenericPayload(JSON.stringify(payload));
  const body = { encryptedData };

  const url = `${API_BASE_URL}${path}`;
  const { data } = await axios.post(url, body, { headers: authHeaders() });
  return data;
}

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
