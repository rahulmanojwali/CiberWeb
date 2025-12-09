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
}: {
  username: string;
  language?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ROLE_POLICIES.dashboard,
    username,
    language,
  };

  return postEncrypted(API_ROUTES.admin.getRolePoliciesDashboardData, items);
}

export async function updateRolePolicies({
  username,
  language = DEFAULT_LANGUAGE,
  role_slug,
  permissions,
}: {
  username: string;
  language?: string;
  role_slug: string;
  permissions: any[];
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ROLE_POLICIES.update,
    username,
    language,
    role_slug,
    permissions,
  };

  return postEncrypted(API_ROUTES.admin.updateRolePolicies, items);
}
