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

export async function fetchOrgMandis({
  username,
  org_id,
  language = DEFAULT_LANGUAGE,
}: {
  username: string;
  org_id?: string;
  language?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ORG_MANDI.listMappings,
    username,
    language,
    is_active: "Y",
  };
  if (org_id) items.org_id = org_id;
  return postEncrypted(API_ROUTES.admin.getOrgMandiMappings, items);
}

export async function createAdminUser({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: {
    new_username: string;
    password: string;
    display_name?: string | null;
    email?: string | null;
    mobile?: string | null;
    role_slug: string;
    org_code?: string | null;
    mandi_codes?: string[];
    is_active?: "Y" | "N";
  };
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
  payload: {
    target_username: string;
    display_name?: string | null;
    email?: string | null;
    mobile?: string | null;
    role_slug?: string | null;
    org_code?: string | null;
    mandi_codes?: string[];
    is_active?: "Y" | "N";
  };
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
  target_username,
}: {
  username: string;
  language?: string;
  target_username: string;
}) {
  const items = {
    api: API_TAGS.ADMIN_USERS.deactivate,
    username,
    language,
    target_username,
  };
  return postEncrypted(API_ROUTES.admin.deactivateAdminUser, items);
}

export async function resetAdminUserPassword({
  username,
  language = DEFAULT_LANGUAGE,
  target_username,
  new_password,
}: {
  username: string;
  language?: string;
  target_username: string;
  new_password?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ADMIN_USERS.reset,
    username,
    language,
    target_username,
  };
  if (new_password) items.new_password = new_password;
  return postEncrypted(API_ROUTES.admin.resetAdminUserPassword, items);
}
