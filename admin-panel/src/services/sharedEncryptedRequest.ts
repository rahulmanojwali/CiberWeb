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

/**
 * Critical Step-Up correctness rule:
 * - NEVER rely on caller-provided items.stepup_session_id / items.browser_session_id.
 * - Always overwrite from storage on every request.
 *
 * Why:
 * Many callers re-use the same `items` object across retries/renders.
 * If we only attach when missing, a stale/invalid step-up session can stick forever and the backend
 * will keep asking for Step-Up -> causing infinite requireStepUp loops.
 */
function withStepupMetadata(items: Record<string, unknown>) {
  const browserSessionId = getBrowserSessionId() || undefined;
  const stepupSessionId = getStepupSessionId() || undefined;

  // Shallow copy to avoid mutating caller object.
  const nextItems: Record<string, unknown> = { ...(items || {}) };

  if (stepupSessionId) {
    // Always overwrite with latest.
    nextItems.stepup_session_id = stepupSessionId;
  } else {
    // If storage has no session, do not send a stale one.
    delete (nextItems as any).stepup_session_id;
  }

  if (browserSessionId) {
    nextItems.browser_session_id = browserSessionId;
  } else {
    delete (nextItems as any).browser_session_id;
  }

  return { nextItems, stepupSessionId, browserSessionId };
}

export async function postEncrypted(
  path: string,
  items: Record<string, unknown>,
  extraHeaders: Record<string, string> = {},
) {
  const { nextItems, stepupSessionId, browserSessionId } = withStepupMetadata(items || {});

  if (import.meta.env.DEV) {
    console.debug("[STEPUP_ATTACH]", {
      stepupPayload: Boolean((nextItems as any)?.stepup_session_id),
      stepupHeader: Boolean(stepupSessionId),
      browserPayload: Boolean((nextItems as any)?.browser_session_id),
      browserHeader: Boolean(browserSessionId),
    });
  }

  const payload = { items: nextItems };
  const encryptedData = await encryptGenericPayload(JSON.stringify(payload));
  const body = { encryptedData };
  const url = `${API_BASE_URL}${path}`;

  const browserHeaders = browserSessionId
    ? {
        "x-cm-browser-session": browserSessionId,
        "x-stepup-browser-session": browserSessionId,
        "X-StepUp-Browser-Session": browserSessionId,
      }
    : {};

  const stepupHeaders = stepupSessionId
    ? {
        "x-stepup-session": stepupSessionId,
        "X-StepUp-Session": stepupSessionId,
      }
    : {};

  const headersFactory = () => ({
    ...authHeaders(),
    ...browserHeaders,
    ...stepupHeaders,
    ...extraHeaders,
  });

  const data = await runEncryptedRequest({
    url,
    body,
    headersFactory,
    path,
    resourceKey: deriveStepupResourceKey(nextItems),
    excludeStepup: isStepupExemptPath(path),
  });

  return data;
}


// import { encryptGenericPayload } from "../utils/aesUtilBrowser";
// import { getBrowserSessionId } from "../security/stepup/browserSession";
// import { getStepupSessionId } from "../security/stepup/storage";
// import { API_BASE_URL } from "../config/appConfig";
// import {
//   deriveStepupResourceKey,
//   isStepupExemptPath,
//   runEncryptedRequest,
// } from "./encryptedRequestRunner";

// function authHeaders(): Record<string, string> {
//   const token =
//     typeof window !== "undefined" ? localStorage.getItem("cd_token") : null;
//   const headers: Record<string, string> = {
//     "Content-Type": "application/json",
//   };
//   if (token) {
//     headers.Authorization = `Bearer ${token}`;
//   }
//   return headers;
// }

// function attachStepupMetadata(items: Record<string, any>) {
//   if (!items) return;
//   if (!items.stepup_session_id) {
//     const stepupSessionId = getStepupSessionId();
//     if (stepupSessionId) {
//       items.stepup_session_id = stepupSessionId;
//     }
//   }
//   if (!items.browser_session_id) {
//     const browserSessionId = getBrowserSessionId();
//     if (browserSessionId) {
//       items.browser_session_id = browserSessionId;
//     }
//   }
// }

// export async function postEncrypted(
//   path: string,
//   items: Record<string, any>,
//   extraHeaders: Record<string, string> = {}
// ) {
//   attachStepupMetadata(items);
//   if (import.meta.env.DEV) {
//     console.debug("[STEPUP_ATTACH]", {
//       stepup: Boolean(items.stepup_session_id),
//       browser: Boolean(items.browser_session_id),
//     });
//   }
//   const payload = { items };
//   const encryptedData = await encryptGenericPayload(JSON.stringify(payload));
//   const body = { encryptedData };
//   const url = `${API_BASE_URL}${path}`;
//   const buildHeaders = () => {
//     const headers: Record<string, string> = {
//       ...authHeaders(),
//       ...extraHeaders,
//     };
//     const browserSessionId = getBrowserSessionId();
//     const stepupSessionId = getStepupSessionId();
//     if (browserSessionId) {
//       headers["x-cm-browser-session"] = browserSessionId;
//       headers["x-stepup-browser-session"] = browserSessionId;
//     }
//     if (stepupSessionId) {
//       headers["x-stepup-session"] = stepupSessionId;
//     }
//     return headers;
//   };

//   const data = await runEncryptedRequest({
//     url,
//     body,
//     headersFactory: buildHeaders,
//     path,
//     resourceKey: deriveStepupResourceKey(items),
//     excludeStepup: isStepupExemptPath(path),
//   });

//   return data;
// }
