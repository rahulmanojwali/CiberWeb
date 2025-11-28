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

export const getAuctionSessions = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getAuctionSessions, {
    api: API_TAGS.AUCTION_OPS.SESSIONS.list,
    username,
    language,
    ...filters,
  });

export const getAuctionLots = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getAuctionLots, {
    api: API_TAGS.AUCTION_OPS.LOTS.list,
    username,
    language,
    ...filters,
  });

export const getAuctionResults = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getAuctionResults, {
    api: API_TAGS.AUCTION_OPS.RESULTS.list,
    username,
    language,
    ...filters,
  });
