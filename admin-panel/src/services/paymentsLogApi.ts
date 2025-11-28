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

export const getPaymentsLog = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Payload;
}) =>
  postEncrypted(API_ROUTES.admin.getPaymentsLog, {
    api: API_TAGS.PAYMENTS_LOG.getPaymentsLog,
    username,
    language,
    ...filters,
  });

export const getPaymentDetail = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: Payload;
}) =>
  postEncrypted(API_ROUTES.admin.getPaymentDetail, {
    api: API_TAGS.PAYMENTS_LOG.getPaymentDetail,
    username,
    language,
    ...payload,
  });
