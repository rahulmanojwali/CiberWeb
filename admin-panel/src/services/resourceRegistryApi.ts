import axios from "axios";
import { encryptGenericPayload } from "../utils/aesUtilBrowser";
import { API_BASE_URL, API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("cd_token") : null;

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

export async function fetchResourceRegistry({
  username,
  language = DEFAULT_LANGUAGE,
}: {
  username: string;
  language?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.RESOURCE_REGISTRY.list,
    username,
    language,
  };

  return postEncrypted(API_ROUTES.admin.getResourceRegistry, items);
}

export async function updateResourceRegistry({
  username,
  language = DEFAULT_LANGUAGE,
  entries,
}: {
  username: string;
  language?: string;
  entries: any[];
}) {
  const items: Record<string, any> = {
    api: API_TAGS.RESOURCE_REGISTRY.update,
    username,
    language,
    entries,
  };

  return postEncrypted(API_ROUTES.admin.updateResourceRegistry, items);
}
