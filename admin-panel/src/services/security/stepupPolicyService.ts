import axios from "axios";
import { encryptGenericPayload } from "../../utils/aesUtilBrowser";
import {
  API_BASE_URL,
  API_ROUTES,
  API_TAGS,
  DEFAULT_COUNTRY,
  DEFAULT_LANGUAGE,
} from "../../config/appConfig";

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

async function postEncrypted(
  path: string,
  items: Record<string, any>,
  extraHeaders: Record<string, string> = {}
) {
  const payload = { items };
  const encryptedData = await encryptGenericPayload(JSON.stringify(payload));
  const body = { encryptedData };

  const url = `${API_BASE_URL}${path}`;
  const { data } = await axios.post(url, body, {
    headers: {
      ...authHeaders(),
      ...extraHeaders,
    },
  });
  return data;
}

export type StepupScreensParams = {
  username: string;
  language?: string;
  country?: string;
};

export async function getStepupPolicyScreens({
  username,
  language = DEFAULT_LANGUAGE,
  country = DEFAULT_COUNTRY,
}: StepupScreensParams) {
  const items: Record<string, any> = {
    api: API_TAGS.STEPUP_POLICY.getScreens,
    username,
    language,
    country,
  };
  return postEncrypted(API_ROUTES.admin.getStepupPolicyScreens, items);
}

export type StepupSelectionPayload = {
  username: string;
  selected: string[];
  language?: string;
  country?: string;
};

export async function saveStepupPolicySelection({
  username,
  selected,
  language = DEFAULT_LANGUAGE,
  country = DEFAULT_COUNTRY,
}: StepupSelectionPayload) {
  const items: Record<string, any> = {
    api: API_TAGS.STEPUP_POLICY.saveSelection,
    username,
    language,
    country,
    selected,
  };
  return postEncrypted(API_ROUTES.admin.saveStepupPolicySelection, items);
}
