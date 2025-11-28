import axios from "axios";
import { encryptGenericPayload } from "../utils/aesUtilBrowser";
import { API_BASE_URL, API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

type Payload = Record<string, any>;

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

export const getSettlements = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Payload;
}) =>
  postEncrypted(API_ROUTES.admin.getSettlements, {
    api: API_TAGS.SETTLEMENTS.getSettlements,
    username,
    language,
    ...filters,
  });

export const getSettlementDetail = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: Payload;
}) =>
  postEncrypted(API_ROUTES.admin.getSettlementDetail, {
    api: API_TAGS.SETTLEMENTS.getSettlementDetail,
    username,
    language,
    ...payload,
  });
