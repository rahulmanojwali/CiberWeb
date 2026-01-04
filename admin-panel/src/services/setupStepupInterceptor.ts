import axios, { AxiosHeaders } from "axios";
import { getBrowserSessionId } from "../security/stepup/browserSession";

const STEPUP_SESSION_KEY = "cm_stepup_session_id";
const STEPUP_BROWSER_SESSION_KEY = "cm_browser_session_id";

/**
 * IMPORTANT:
 * - browser session id now lives in localStorage (shared across tabs) but we still fall back to
 *   sessionStorage so legacy sessions keep working while migrating.
 * - step-up session id must ALSO live in sessionStorage, otherwise it persists across browser close
 *   and defeats "force OTP again after closing browser" behavior.
 */
function getStepupSessionId(): string | null {
  if (typeof window === "undefined") return null;

  // Prefer sessionStorage (correct)
  const s = sessionStorage.getItem(STEPUP_SESSION_KEY);
  if (s) return s;

  // Backward compatibility: if older builds stored in localStorage, migrate once
  const legacy = localStorage.getItem(STEPUP_SESSION_KEY);
  if (legacy) {
    sessionStorage.setItem(STEPUP_SESSION_KEY, legacy);
    localStorage.removeItem(STEPUP_SESSION_KEY);
    return legacy;
  }
  return null;
}

function getLastBrowserSessionId(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(STEPUP_BROWSER_SESSION_KEY);
}

function setLastBrowserSessionId(id: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STEPUP_BROWSER_SESSION_KEY, id);
}

function clearStepupSessionId() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STEPUP_SESSION_KEY);
  localStorage.removeItem(STEPUP_SESSION_KEY); // defensive cleanup
}

axios.interceptors.request.use(
  (config) => {
    if (typeof window !== "undefined") {
      const currentHeaders = AxiosHeaders.from(config.headers || {});

      // Browser session id (persists in localStorage now; fall back to sessionStorage for legacy)
      const browserSessionId = getBrowserSessionId();
      const storedBrowserSessionId =
        window.localStorage.getItem(STEPUP_BROWSER_SESSION_KEY) ??
        window.sessionStorage.getItem(STEPUP_BROWSER_SESSION_KEY) ??
        browserSessionId;
      if (storedBrowserSessionId) {
        currentHeaders.set("X-StepUp-Browser-Session", storedBrowserSessionId);
        currentHeaders.set("x-cm-browser-session", storedBrowserSessionId);

        // If browser session changed (new tab/session), drop any old stepup session id
        const last = getLastBrowserSessionId();
        if (last && last !== storedBrowserSessionId) {
          clearStepupSessionId();
        }
        setLastBrowserSessionId(storedBrowserSessionId);
      }

      // Step-up session id MUST be sessionStorage-based
      const stepupSessionId = getStepupSessionId();
      if (stepupSessionId) {
        // Backend reads req.headers['x-stepup-session'] (Node lowercases header keys)
        // Set both to make it visible in devtools and compatible with earlier code.
        currentHeaders.set("x-stepup-session", stepupSessionId);
        currentHeaders.set("X-StepUp-Session", stepupSessionId);
      }

      config.headers = currentHeaders;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// import axios, { AxiosHeaders } from "axios";
// import { getBrowserSessionId } from "../security/stepup/browserSession";

// axios.interceptors.request.use(
//   (config) => {
//     if (typeof window !== "undefined") {
//       const stepupSessionId = localStorage.getItem("cm_stepup_session_id");
//       const currentHeaders = AxiosHeaders.from(config.headers || {});
//       if (stepupSessionId) {
//         currentHeaders.set("X-StepUp-Session", stepupSessionId);
//       }
//       const browserSessionId = getBrowserSessionId();
//       if (browserSessionId) {
//         currentHeaders.set("X-StepUp-Browser-Session", browserSessionId);
//         currentHeaders.set("x-cm-browser-session", browserSessionId);
//       }
//       config.headers = currentHeaders;
//     }
//     return config;
//   },
//   (error) => Promise.reject(error),
// );


// import axios, { AxiosHeaders } from "axios";
// import { getBrowserSessionId } from "../security/stepup/browserSession";

// const STEPUP_SESSION_KEY = "cm_stepup_session_id";
// const STEPUP_BROWSER_SESSION_KEY = "cm_browser_session_id";

// /**
//  * IMPORTANT:
//  * - browser session id now lives in localStorage (shared across tabs) but we still fall back to
//  *   sessionStorage so legacy sessions keep working while migrating.
//  * - step-up session id must ALSO live in sessionStorage, otherwise it persists across browser close
//  *   and defeats "force OTP again after closing browser" behavior.
//  */
// function getStepupSessionId(): string | null {
//   if (typeof window === "undefined") return null;

//   // Prefer sessionStorage (correct)
//   const s = sessionStorage.getItem(STEPUP_SESSION_KEY);
//   if (s) return s;

//   // Backward compatibility: if older builds stored in localStorage, migrate once
//   const legacy = localStorage.getItem(STEPUP_SESSION_KEY);
//   if (legacy) {
//     sessionStorage.setItem(STEPUP_SESSION_KEY, legacy);
//     localStorage.removeItem(STEPUP_SESSION_KEY);
//     return legacy;
//   }
//   return null;
// }

// function getLastBrowserSessionId(): string | null {
//   if (typeof window === "undefined") return null;
//   return sessionStorage.getItem(STEPUP_BROWSER_SESSION_KEY);
// }

// function setLastBrowserSessionId(id: string) {
//   if (typeof window === "undefined") return;
//   sessionStorage.setItem(STEPUP_BROWSER_SESSION_KEY, id);
// }

// function clearStepupSessionId() {
//   if (typeof window === "undefined") return;
//   sessionStorage.removeItem(STEPUP_SESSION_KEY);
//   localStorage.removeItem(STEPUP_SESSION_KEY); // defensive cleanup
// }

// axios.interceptors.request.use(
//   (config) => {
//     if (typeof window !== "undefined") {
//       const currentHeaders = AxiosHeaders.from(config.headers || {});

//       // Browser session id (persists in localStorage now; fall back to sessionStorage for legacy)
//       const browserSessionId = getBrowserSessionId();
//       const storedBrowserSessionId =
//         window.localStorage.getItem(STEPUP_BROWSER_SESSION_KEY) ??
//         window.sessionStorage.getItem(STEPUP_BROWSER_SESSION_KEY) ??
//         browserSessionId;
//       if (storedBrowserSessionId) {
//         currentHeaders.set("X-StepUp-Browser-Session", storedBrowserSessionId);
//         currentHeaders.set("x-cm-browser-session", storedBrowserSessionId);

//         // If browser session changed (new tab/session), drop any old stepup session id
//         const last = getLastBrowserSessionId();
//         if (last && last !== storedBrowserSessionId) {
//           clearStepupSessionId();
//         }
//         setLastBrowserSessionId(storedBrowserSessionId);
//       }

//       // Step-up session id MUST be sessionStorage-based
//       const stepupSessionId = getStepupSessionId();
//       if (stepupSessionId) {
//         currentHeaders.set("X-StepUp-Session", stepupSessionId);
//       }

//       config.headers = currentHeaders;
//     }
//     return config;
//   },
//   (error) => Promise.reject(error),
// );