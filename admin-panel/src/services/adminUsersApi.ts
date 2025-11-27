import axios from "axios";
import { encryptGenericPayload } from "../utils/aesUtilBrowser";
import {
  API_BASE_URL,
  API_TAGS,
  API_ROUTES,
  DEFAULT_LANGUAGE,
} from "../config/appConfig";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("cd_token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function postEncrypted(path: string, items: Record<string, any>) {
  const encryptedData = await encryptGenericPayload(JSON.stringify({ items }));
  const { data } = await axios.post(`${API_BASE_URL}${path}`, { encryptedData }, { headers: authHeaders() });
  return data;
}

export async function fetchAdminUsers({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) {
  const items = {
    api: API_TAGS.ADMIN_USERS.list,
    username,
    language,
    ...filters,
  };
  return postEncrypted(API_ROUTES.admin.getAdminUsers, items);
}

export async function fetchAdminRoles({
  username,
  language = DEFAULT_LANGUAGE,
}: {
  username: string;
  language?: string;
}) {
  const items = {
    api: API_TAGS.ADMIN_USERS.listRoles,
    username,
    language,
  };
  return postEncrypted(API_ROUTES.admin.getAdminRoles, items);
}

export async function fetchOrganisations({
  username,
  language = DEFAULT_LANGUAGE,
}: {
  username: string;
  language?: string;
}) {
  const items = {
    api: API_TAGS.ADMIN_USERS.listOrgs || API_TAGS.ORGS.list,
    username,
    language,
  };
  return postEncrypted(API_ROUTES.admin.getOrganisations, items);
}

export async function createAdminUser({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) {
  const items = {
    api: API_TAGS.ADMIN_USERS.create,
    username,
    language,
    ...payload,
  };
  return postEncrypted(API_ROUTES.admin.createAdminUser, items);
}

export async function updateAdminUser({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) {
  const items = {
    api: API_TAGS.ADMIN_USERS.update,
    username,
    language,
    ...payload,
  };
  return postEncrypted(API_ROUTES.admin.updateAdminUser, items);
}

export async function deactivateAdminUser({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) {
  const items = {
    api: API_TAGS.ADMIN_USERS.update,
    username,
    language,
    is_active: "N",
    ...payload,
  };
  return postEncrypted(API_ROUTES.admin.updateAdminUser, items);
}
