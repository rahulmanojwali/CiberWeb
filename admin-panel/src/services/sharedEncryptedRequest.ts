import axios from "axios";
import { encryptGenericPayload } from "../utils/aesUtilBrowser";
import { getBrowserSessionId } from "../security/stepup/browserSession";
import { API_BASE_URL } from "../config/appConfig";

const STEPUP_SESSION_KEY = "cm_stepup_session_id";

function authHeaders(): Record<string, string> {
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

function getStepupSessionId(): string | null {
  if (typeof window === "undefined") return null;
  const stored = sessionStorage.getItem(STEPUP_SESSION_KEY);
  if (stored) return stored;
  const legacy = localStorage.getItem(STEPUP_SESSION_KEY);
  if (legacy) {
    sessionStorage.setItem(STEPUP_SESSION_KEY, legacy);
    localStorage.removeItem(STEPUP_SESSION_KEY);
    return legacy;
  }
  return null;
}

function attachStepupMetadata(items: Record<string, any>) {
  if (!items) return;
  if (!items.stepup_session_id) {
    const stepupSessionId = getStepupSessionId();
    if (stepupSessionId) {
      items.stepup_session_id = stepupSessionId;
    }
  }
  if (!items.browser_session_id) {
    const browserSessionId = getBrowserSessionId();
    if (browserSessionId) {
      items.browser_session_id = browserSessionId;
    }
  }
}

export async function postEncrypted(
  path: string,
  items: Record<string, any>,
  extraHeaders: Record<string, string> = {}
) {
  attachStepupMetadata(items);
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
