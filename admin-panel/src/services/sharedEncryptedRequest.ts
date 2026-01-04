import { encryptGenericPayload } from "../utils/aesUtilBrowser";
import { getBrowserSessionId } from "../security/stepup/browserSession";
import { getStepupSessionId } from "../security/stepup/storage";
import { API_BASE_URL } from "../config/appConfig";
import {
  deriveStepupResourceKey,
  isStepupExemptPath,
  runEncryptedRequest,
} from "./encryptedRequestRunner";

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
  if (import.meta.env.DEV) {
    console.debug("[STEPUP_ATTACH]", {
      stepup: Boolean(items.stepup_session_id),
      browser: Boolean(items.browser_session_id),
    });
  }
  const payload = { items };
  const encryptedData = await encryptGenericPayload(JSON.stringify(payload));
  const body = { encryptedData };
  const url = `${API_BASE_URL}${path}`;
  const browserSessionId = getBrowserSessionId();
  const stepupSessionId = getStepupSessionId();
  const headers: Record<string, string> = {
    ...authHeaders(),
    ...extraHeaders,
  };
  if (browserSessionId) {
    headers["x-cm-browser-session"] = browserSessionId;
    headers["x-stepup-browser-session"] = browserSessionId;
  }
  if (stepupSessionId) {
    headers["x-stepup-session"] = stepupSessionId;
  }

  const data = await runEncryptedRequest({
    url,
    body,
    headers,
    path,
    resourceKey: deriveStepupResourceKey(items),
    excludeStepup: isStepupExemptPath(path),
  });

  return data;
}
