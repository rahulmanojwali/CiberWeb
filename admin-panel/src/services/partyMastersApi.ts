import axios from "axios";
import { encryptGenericPayload } from "../utils/aesUtilBrowser";
import { API_BASE_URL, API_TAGS, API_ROUTES, DEFAULT_LANGUAGE } from "../config/appConfig";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("cd_token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function postEncrypted(path: string, items: Record<string, any>) {
  const encryptedData = await encryptGenericPayload(JSON.stringify({ items }));
  const url = `${API_BASE_URL}${path}`;
  const { data } = await axios.post(url, { encryptedData }, { headers: authHeaders() });
  return data;
}

export const getTraders = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getTraders, {
    api: API_TAGS.PARTY_MASTERS.traders.list,
    username,
    language,
    ...filters,
  });

export const updateTraderStatus = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.updateTraderStatus, {
    api: API_TAGS.PARTY_MASTERS.traders.update,
    username,
    language,
    ...payload,
  });

export const getFarmers = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getFarmers, {
    api: API_TAGS.PARTY_MASTERS.farmers.list,
    username,
    language,
    ...filters,
  });

export const updateFarmerStatus = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.updateFarmerStatus, {
    api: API_TAGS.PARTY_MASTERS.farmers.update,
    username,
    language,
    ...payload,
  });
