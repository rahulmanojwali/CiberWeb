// import axios from "axios";
// import { encryptGenericPayload } from "../utils/aesUtilBrowser";
// import { getBrowserSessionId } from "../security/stepup/browserSession";
// import { API_BASE_URL } from "../config/appConfig";

// const STEPUP_SESSION_KEY = "cm_stepup_session_id";

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

// function getStepupSessionId(): string | null {
//   if (typeof window === "undefined") return null;

//   // Preferred: sessionStorage
//   const stored = sessionStorage.getItem(STEPUP_SESSION_KEY);
//   if (stored) return stored;

//   // Backward-compat: migrate legacy localStorage once
//   const legacy = localStorage.getItem(STEPUP_SESSION_KEY);
//   if (legacy) {
//     sessionStorage.setItem(STEPUP_SESSION_KEY, legacy);
//     localStorage.removeItem(STEPUP_SESSION_KEY);
//     return legacy;
//   }

//   return null;
// }

// /**
//  * IMPORTANT:
//  * - Do NOT mutate caller's `items` object (it may be reused).
//  * - Always prefer the latest Step-Up session from storage.
//  * - Always attach BOTH:
//  *   - items.stepup_session_id (payload)
//  *   - x-stepup-session (header)
//  */
// function withStepupMetadata(items: Record<string, unknown>) {
//   const browserSessionId = getBrowserSessionId() || undefined;
//   const stepupSessionId = getStepupSessionId() || undefined;

//   // Shallow copy to avoid stale session id sticking forever
//   const nextItems: Record<string, unknown> = { ...(items || {}) };

//   // Always overwrite with latest from storage if present
//   if (stepupSessionId) {
//     nextItems.stepup_session_id = stepupSessionId;
//   }

//   if (browserSessionId) {
//     nextItems.browser_session_id = browserSessionId;
//   }

//   return { nextItems, stepupSessionId, browserSessionId };
// }

// export async function postEncrypted(
//   path: string,
//   items: Record<string, unknown>,
//   extraHeaders: Record<string, string> = {}
// ) {
//   const { nextItems, stepupSessionId, browserSessionId } = withStepupMetadata(
//     items || {}
//   );

//   if (import.meta.env.DEV) {
//     console.debug("[STEPUP_ATTACH]", {
//       stepupPayload: Boolean((nextItems as any)?.stepup_session_id),
//       stepupHeader: Boolean(stepupSessionId),
//       browserPayload: Boolean((nextItems as any)?.browser_session_id),
//       browserHeader: Boolean(browserSessionId),
//     });
//   }

//   const payload = { items: nextItems };
//   const encryptedData = await encryptGenericPayload(JSON.stringify(payload));
//   const body = { encryptedData };

//   const url = `${API_BASE_URL}${path}`;

//   const browserHeaders = browserSessionId
//     ? {
//         "x-cm-browser-session": browserSessionId,
//         // keep these for backward compat (safe)
//         "x-stepup-browser-session": browserSessionId,
//         "X-StepUp-Browser-Session": browserSessionId,
//       }
//     : {};

//   const stepupHeaders = stepupSessionId
//     ? {
//         // ✅ This is the critical header your backend expects
//         "x-stepup-session": stepupSessionId,
//       }
//     : {};

//   const { data } = await axios.post(url, body, {
//     headers: {
//       ...authHeaders(),
//       ...browserHeaders,
//       ...stepupHeaders,
//       ...extraHeaders,
//     },
//   });

//   return data;
// }


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
  const browserHeaders = browserSessionId
    ? {
        "x-cm-browser-session": browserSessionId,
        "x-stepup-browser-session": browserSessionId,
        "X-StepUp-Browser-Session": browserSessionId,
      }
    : {};
  // IMPORTANT: backend enforcer reads `req.headers['x-stepup-session']`.
  // We still also include `X-StepUp-Session` for compatibility with older tooling/logs.
  const stepupHeaders = stepupSessionId
    ? {
        "x-stepup-session": stepupSessionId,
        "X-StepUp-Session": stepupSessionId,
      }
    : {};
  const { data } = await axios.post(url, body, {
    headers: {
      ...authHeaders(),
      ...browserHeaders,
      ...stepupHeaders,
      ...extraHeaders,
    },
  });
  return data;
}

// import axios from "axios";
// import { encryptGenericPayload } from "../utils/aesUtilBrowser";
// import { getBrowserSessionId } from "../security/stepup/browserSession";
// import { API_BASE_URL } from "../config/appConfig";

// const STEPUP_SESSION_KEY = "cm_stepup_session_id";

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

// function getStepupSessionId(): string | null {
//   if (typeof window === "undefined") return null;
//   const stored = sessionStorage.getItem(STEPUP_SESSION_KEY);
//   if (stored) return stored;
//   const legacy = localStorage.getItem(STEPUP_SESSION_KEY);
//   if (legacy) {
//     sessionStorage.setItem(STEPUP_SESSION_KEY, legacy);
//     localStorage.removeItem(STEPUP_SESSION_KEY);
//     return legacy;
//   }
//   return null;
// }

//   function attachStepupMetadata(items: Record<string, any>) {
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
//   const browserSessionId = getBrowserSessionId();
//   const browserHeaders = browserSessionId
//     ? {
//         "x-cm-browser-session": browserSessionId,
//         "x-stepup-browser-session": browserSessionId,
//         "X-StepUp-Browser-Session": browserSessionId,
//       }
//     : {};
//   const { data } = await axios.post(url, body, {
//     headers: {
//       ...authHeaders(),
//       ...browserHeaders,
//       ...extraHeaders,
//     },
//   });
//   return data;
// }
