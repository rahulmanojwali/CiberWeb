import axios from "axios";
import {
  encryptGenericPayload,
  encryptPasswordPayload,
} from "./aesUtilBrowser";
import {
  API_BASE_URL,
  API_TAGS,
  API_ROUTES,
  DEFAULT_COUNTRY,
  DEFAULT_LANGUAGE,
} from "../config/appConfig";
import { ROLE_MAP } from "./roles";

// Allowed admin roles for this console (must match RoleSlug)
const ADMIN_ROLES = new Set([
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "ORG_VIEWER",
  "MANDI_ADMIN",
  "MANDI_MANAGER",
  "AUCTIONEER",
  "GATE_OPERATOR",
  "WEIGHBRIDGE_OPERATOR",
  "AUDITOR",
  "VIEWER",
]);

const resolveAdminRole = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const upper = value.toUpperCase().trim();
  const normalized = upper.replace(/[\s-]+/g, "_");
  const cleaned = normalized.replace(/[^A-Z_]/g, "");
  const compressed = cleaned.replace(/_/g, "");

  // Direct allow-list match
  if (ADMIN_ROLES.has(upper)) return upper;
  if (ADMIN_ROLES.has(normalized)) return normalized;
  if (ADMIN_ROLES.has(cleaned)) return cleaned;
  if (ADMIN_ROLES.has(compressed)) return compressed;

  // ROLE_MAP fallbacks (e.g., ORGADMIN → ORG_ADMIN)
  const mapped =
    ROLE_MAP[upper] ??
    ROLE_MAP[normalized] ??
    ROLE_MAP[cleaned] ??
    ROLE_MAP[compressed];
  if (mapped && ADMIN_ROLES.has(mapped)) return mapped;

  return null;
};

const BASE_URL = API_BASE_URL;
const LOGIN_ROUTE = API_ROUTES.auth.login;
const LANGUAGE = DEFAULT_LANGUAGE;
const COUNTRY_FALLBACK = DEFAULT_COUNTRY;
const API_KEY = API_TAGS.AUTH.loginApiTag;

const storage = {
  setToken(token: string) { localStorage.setItem("cd_token", token); },
  getToken() { return localStorage.getItem("cd_token"); },
  clearToken() { localStorage.removeItem("cd_token"); },
  setUser(user: any) { localStorage.setItem("cd_user", JSON.stringify(user)); },
  getUser<T = any>(): T | null {
    const raw = localStorage.getItem("cd_user");
    try { return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
  },
  clearUser() { localStorage.removeItem("cd_user"); },
};

type LoginPayload = { username: string; password: string; country?: string };

type ApiResponse = {
  response?: {
    responsecode?: string | number;
    description?: string;
    username?: string;
    usertype?: string;
    role_slug?: string;
    roles_enabled?: Record<string, boolean>;
    roles_blocked?: Record<string, boolean>;
    token?: string; // JWT on success
    blocked?: boolean;
    blocked_reason?: string;
    fallback_roles?: string[];
    default_role_code?: string;
    default_role?: string;
    role?: string;
    role_code?: string;
    org_code?: string | null;
    orgCode?: string | null;
    org_id?: string | null;
    orgId?: string | null;
    mandi_codes?: string[];
    mandis?: string[];
  };
  [k: string]: any;
};

export const authProvider: any = {
  /** Called by useLogin() from our Login page */


  login: async ({ username, password, country }: LoginPayload) => {
  try {
    storage.clearToken();
    storage.clearUser();
    delete axios.defaults.headers.common["Authorization"];

    console.info({ event: "login_start", username, country });

    const encryptedPassword = await encryptPasswordPayload(password);

    const items = {
      api: API_KEY, // required by backend
      username,
      password: encryptedPassword,
      language: LANGUAGE,
      country: country || COUNTRY_FALLBACK,
    };

    const encryptedData = await encryptGenericPayload(JSON.stringify({ items }));

    const { data } = await axios.post<ApiResponse>(
      `${BASE_URL}${LOGIN_ROUTE}`,
      { encryptedData },
      { headers: { "Content-Type": "application/json" } }
    );

    console.info({ event: "login_response", data });

    const codeRaw = data?.response?.responsecode;
    const codeStr = typeof codeRaw === "number" ? String(codeRaw) : (codeRaw ?? "");
    const isSuccess = codeStr === "0" || codeStr === "00";

    if (!isSuccess) {
      const message =
        data?.response?.description ||
        (codeStr === "2" ? "Account blocked" : "Invalid credentials");
      return { success: false, error: { name: "Login Failed", message } };
    }

    const resp = data?.response || {};
    const roleCandidate =
      resp?.default_role_code ??
      resp?.default_role ??
      resp?.role_slug ??
      resp?.role ??
      resp?.role_code ??
      resp?.usertype ??
      null;

    const resolvedRole = resolveAdminRole(roleCandidate);
    if (!resolvedRole) {
      const message = "Not authorized for admin console. Please use the trader/farmer app.";
      console.warn({ event: "login_rejected_non_admin", roleCandidate });
      return { success: false, error: { name: "Unauthorized", message } };
    }

    const token = resp?.token || "";
    storage.setToken(token);
    storage.setUser({
      username: resp?.username || username,
      usertype: resolvedRole,
      role_slug: resp?.role_slug || resolvedRole,
      default_role_code: resolvedRole,
      org_code: resp?.org_code || resp?.orgCode || null,
      org_id: resp?.org_id || resp?.orgId || null,
      mandis: resp?.mandi_codes || resp?.mandis || [],
      language: LANGUAGE,
      country: country || COUNTRY_FALLBACK,
      roles_enabled: resp?.roles_enabled || { [resolvedRole]: true },
      roles_blocked: resp?.roles_blocked || {},
    });

    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    console.info({ event: "login_success", username: resp?.username || username, resolvedRole });

    return { success: true, redirectTo: "/" };
  } catch (e: any) {
    console.error({ event: "login_error", message: e?.message });
    return {
      success: false,
      error: {
        name: "Network / Encryption error",
        message: e?.message || "Unable to sign in",
      },
    };
  }
},

//   login: async ({ username, password, country }: LoginPayload) => {
//     try {
//       // clear stale session so refine won't auto-redirect
//       storage.clearToken();
//       storage.clearUser();
//       delete axios.defaults.headers.common["x-session-token"];

//       console.info({ event: "login_start", username, country });

//       // 1) encrypt password for password channel
//       const encryptedPassword = await encryptPasswordPayload(password);

//       // 2) build items EXACTLY as backend expects (include api key)
//       const items = {
//         api: API_KEY,
//         username,
//         password: encryptedPassword,
//         language: LANGUAGE,
//         country: country || "IN",
//         // Optional device info keys if you want to send later:
//         // login_device_info: {...}, push_token: "", platform: "WEB", app_version: "admin-1.0.0",
//       };

//       // 3) wrap into { items } and encrypt for generic channel
//       const encryptedData = await encryptGenericPayload(JSON.stringify({ items }));

//       console.info({
//         event: "login_request_ready",
//         url: `${BASE_URL}${LOGIN_ROUTE}`,
//         encryptedDataLength: encryptedData?.length ?? 0,
//       });

//       // 4) POST { encryptedData }
//       const { data } = await axios.post<ApiResponse>(
//         `${BASE_URL}${LOGIN_ROUTE}`,
//         { encryptedData },
//         { headers: { "Content-Type": "application/json" } }
//       );

//       console.info({ event: "login_response", data });

//       // normalize response code (0 / "0" / "00" => success)
//       const codeRaw = data?.response?.responsecode;
//       const codeStr = typeof codeRaw === "number" ? String(codeRaw) : (codeRaw ?? "");
//       const isSuccess = codeStr === "0" || codeStr === "00";

//       if (!isSuccess) {
//         const message =
//           data?.response?.description ||
//           (codeStr === "2" ? "Account blocked" : "Invalid credentials");
//         // stay on login page
//         return { success: false, error: { name: "Login Failed", message } };
//       }

//       // Success block: token is inside response
//       const token = data?.response?.token || "";
//       storage.setToken(token);
//       storage.setUser({
//         username: data?.response?.username || username,
//         usertype: data?.response?.usertype || "seller",
//         language: LANGUAGE,
//         country: country || "IN",
//         roles_enabled: data?.response?.roles_enabled || {},
//         roles_blocked: data?.response?.roles_blocked || {},
//       });

//       // if your backend expects this header later, set it now
//       axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

//       console.info({ event: "login_success", username: data?.response?.username || username });

//       return { success: true, redirectTo: "/" };
//     } catch (e: any) {
//       console.error({ event: "login_error", message: e?.message, stack: e?.stack });
//       return {
//         success: false,
//         error: {
//           name: "Network / Encryption error",
//           message: e?.message || "Unable to sign in",
//         },
//       };
//     }
//   },





  /** Guard protected routes */
  check: async () => {
    const token = storage.getToken();
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      return { authenticated: true };
    }
    return { authenticated: false, redirectTo: "/login" };
  },

  /** On 401/403, force logout */
  onError: async (error: any) => {
    const status = error?.status ?? error?.statusCode;
    if (status === 401 || status === 403) {
      storage.clearToken();
      storage.clearUser();
      delete axios.defaults.headers.common["Authorization"];
      return { logout: true, redirectTo: "/login" };
    }
    return { error };
  },

  /** Logout */
  logout: async () => {
    storage.clearToken();
    storage.clearUser();
    delete axios.defaults.headers.common["Authorization"];
    return { success: true, redirectTo: "/login" };
  }
  
  ,

  /** Identity for header/avatar (optional) */
  getIdentity: async () => {
    const user = storage.getUser();
    if (!user) return null;
    return { id: user.username, name: user.username };
  },
};

export default authProvider;
