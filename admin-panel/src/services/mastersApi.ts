import axios from "axios";
import { encryptGenericPayload } from "../utils/aesUtilBrowser";
import { API_BASE_URL, API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

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

export const fetchStatesDistrictsByPincode = async ({
  username,
  language = DEFAULT_LANGUAGE,
  pincode,
  country = "IN",
}: {
  username: string;
  language?: string;
  pincode: string;
  country?: string;
}) =>
  postEncrypted(API_ROUTES.masters.getStatesDistricts, {
    api: API_TAGS.MASTERS.getStatesDistricts,
    username,
    language,
    country,
    pincode,
    include_inactive: false,
  });

