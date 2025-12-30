import type { AuthProvider } from "@refinedev/core";
import axios from "axios";
import {
  encryptGenericPayload,
  encryptPasswordPayload,
} from "./utils/aesUtilBrowser";
import {
  API_BASE_URL,
  API_TAGS,
  API_ROUTES,
  DEFAULT_COUNTRY,
  DEFAULT_LANGUAGE,
} from "./config/appConfig";

const BASE_URL = API_BASE_URL;
const LOGIN_ROUTE = API_ROUTES.auth.login;
const LANGUAGE = DEFAULT_LANGUAGE;
const COUNTRY_FALLBACK = DEFAULT_COUNTRY;
const API_KEY = API_TAGS.AUTH.loginApiTag;

export const TOKEN_KEY = "cd_token";
const USER_KEY = "cd_user";

/** Small helpers for storage */
const storage = {
  setToken(token: string) { localStorage.setItem(TOKEN_KEY, token); },
  getToken() { return localStorage.getItem(TOKEN_KEY); },
  clearToken() { localStorage.removeItem(TOKEN_KEY); },
  setUser(user: any) { localStorage.setItem(USER_KEY, JSON.stringify(user)); },
  getUser<T = any>(): T | null {
    const raw = localStorage.getItem(USER_KEY);
    try { return raw ? (JSON.parse(raw) as T) : null; } catch { return null; }
  },
  clearUser() { localStorage.removeItem(USER_KEY); },
};

export const authProvider: AuthProvider = {
  /** We expect params: { username, password, country } from the Login page */
  // login: async (params: any) => {
  //   try {
  //     const { username, password, country } = params || {};
  //     if (!username || !password || !country) {
  //       return {
  //         success: false,
  //         error: { name: "LoginError", message: "Username, password and country are required" },
  //       };
  //     }

  //     // Clear any stale session so we don't get redirected by old tokens
  //     storage.clearToken();
  //     storage.clearUser();
  //     delete axios.defaults.headers.common["Authorization"];

  //     console.info({ event: "login_start", username, country });

  //     // 1) Encrypt password for password channel (AES-256-CBC)
  //     const encryptedPassword = await encryptPasswordPayload(password);

  //     // 2) Build items EXACTLY like backend expects (note: api key is required)
  //     const items = {
  //       api: API_KEY,
  //       username,
  //       password: encryptedPassword,
  //       language: LANGUAGE,
  //       country: country || "IN",
  //       // Optional:
  //       // platform: "WEB",
  //       // login_device_info: { userAgent: navigator.userAgent },
  //     };

  //     // 3) Encrypt whole body for generic channel
  //     const encryptedData = await encryptGenericPayload(JSON.stringify({ items }));
  //     const url = `${BASE_URL}${LOGIN_ROUTE}`;
  //     console.info({
  //       event: "login_request_ready",
  //       url,
  //       encryptedDataLength: encryptedData?.length ?? 0,
  //     });

  //     // 4) POST { encryptedData }
  //     const { data } = await axios.post(
  //       url,
  //       { encryptedData },
  //       { headers: { "Content-Type": "application/json" } }
  //     );

  //     console.info({ event: "login_response", data });

  //     // Success only if response.responsecode is 0 / "0" / "00"
  //     const codeRaw = data?.response?.responsecode;
  //     const codeStr = typeof codeRaw === "number" ? String(codeRaw) : (codeRaw ?? "");
  //     const isSuccess = codeStr === "0" || codeStr === "00";

  //     if (!isSuccess) {
  //       const message =
  //         data?.response?.description ||
  //         (codeStr === "2" ? "Account blocked" : "Invalid credentials");
  //       // returning success:false keeps you on the login page
  //       return {
  //         success: false,
  //         error: {
  //           name: "LoginError",
  //           message,
  //           meta: { response: data?.response, url },
  //         },
  //       };
  //     }

  //     // OK: token is in response.token (per your Node code)
  //     const token = data?.response?.token || "";
  //     storage.setToken(token);
  //     storage.setUser({
  //       username: data?.response?.username || username,
  //       usertype: data?.response?.usertype || "seller",
  //       language: LANGUAGE,
  //       country: country || "IN",
  //       roles_enabled: data?.response?.roles_enabled || {},
  //       roles_blocked: data?.response?.roles_blocked || {},
  //     });

  //     // set default header so subsequent axios calls include your JWT
  //     axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
  //     console.info({ event: "login_success", username: data?.response?.username || username });

  //     // refine will navigate to "/" only when success:true
  //     return { success: true, redirectTo: "/" };
  //   } catch (e: any) {
  //     console.error({ event: "login_error", message: e?.message });
  //     return {
  //       success: false,
  //       error: {
  //         name: "Network / Encryption error",
  //         message: e?.message || "Unable to sign in",
  //         meta: { url: `${BASE_URL}${LOGIN_ROUTE}` },
  //       },
  //     };
  //   }
  // },
  login: async (params: any) => {
  const { username, password, country } = params || {};
  if (!username || !password || !country) {
    return {
      success: false,
      error: { name: "LoginError", message: "Username, password and country are required" },
    };
  }

  // clear stale session
  storage.clearToken();
  storage.clearUser();
  delete axios.defaults.headers.common["Authorization"];

  try {
    const encryptedPassword = await encryptPasswordPayload(password);

    const items = {
      api: API_KEY, // REQUIRED by backend
      username,
      password: encryptedPassword,
      language: LANGUAGE,
      country: country || COUNTRY_FALLBACK,
    };

    const encryptedData = await encryptGenericPayload(JSON.stringify({ items }));
    const url = `${BASE_URL}${LOGIN_ROUTE}`;

    // keep the url around for the UI to display
    (window as any).__cd_last_login_url = url;

    const { data } = await axios.post(
      url,
      { encryptedData },
      { headers: { "Content-Type": "application/json" } }
    );

    const resp = data?.response || {};
    const respData = resp?.data || {};

    // success only if response.responsecode is 0 / "0" / "00"
    const codeRaw = resp?.responsecode;
    const codeStr = typeof codeRaw === "number" ? String(codeRaw) : (codeRaw ?? "");
    const isSuccess = codeStr === "0" || codeStr === "00";

    if (!isSuccess) {
      const message =
        resp?.description ||
        (codeStr === "2" ? "Account blocked" : "Invalid credentials");

      return {
        success: false,
        error: {
          name: "LoginError",
          message,
          meta: { url, response: data?.response },
        },
      };
    }

    // OK
    // Backend currently returns data only (no JWT). Use backend token if present; otherwise set a session marker so refine sees you as authenticated.
    const token = resp?.token || respData?.token || `admin_session_${Date.now()}`;
    storage.setToken(token);
    axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
    storage.setUser({
      username: respData?.username || resp?.username || username,
      display_name: respData?.display_name || resp?.display_name || null,
      email: respData?.email || resp?.email || null,
      mobile: respData?.mobile || resp?.mobile || null,
      usertype: resp?.usertype || "admin",
      language: LANGUAGE,
      country: country || COUNTRY_FALLBACK,
      roles_enabled: resp?.roles_enabled || {},
      roles_blocked: resp?.roles_blocked || {},
    });
    return { success: true, redirectTo: "/" };
  } catch (e: any) {
    const url = `${BASE_URL}${LOGIN_ROUTE}`;
    const status = e?.response?.status || e?.status || "ERR";
    const resp = e?.response?.data;

    // IMPORTANT: success MUST be false here so refine doesn’t navigate
    return {
      success: false,
      error: {
        name: "Network / Encryption error",
        message: `POST ${url} → ${status}`,
        meta: { url, status, response: resp },
      },
    };
  }
},

  logout: async () => {
    storage.clearToken();
    storage.clearUser();
    try { localStorage.removeItem("cm_stepup_session_id"); } catch { /* ignore */ }
    try { localStorage.removeItem("admin_ui_config_cache"); } catch { /* ignore */ }
    delete axios.defaults.headers.common["Authorization"];
    return { success: true, redirectTo: "/login" };
  },

  check: async () => {
    const token = storage.getToken();
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      return { authenticated: true };
    }
    return { authenticated: false, redirectTo: "/login" };
  },

  getPermissions: async () => null,

  getIdentity: async () => {
    const user = storage.getUser();
    if (!user) return null;
    return {
      id: user.username,
      name: user.username,
    };
  },

  onError: async (error: any) => {
    const status = error?.status ?? error?.statusCode;
    if (status === 401 || status === 403) {
      storage.clearToken();
      storage.clearUser();
      try { localStorage.removeItem("cm_stepup_session_id"); } catch { /* ignore */ }
      try { localStorage.removeItem("admin_ui_config_cache"); } catch { /* ignore */ }
      delete axios.defaults.headers.common["Authorization"];
      return { logout: true, redirectTo: "/login" };
    }
    console.error(error);
    return { error };
  },
};

export default authProvider;

// import type { AuthProvider } from "@refinedev/core";

// export const TOKEN_KEY = "refine-auth";

// export const authProvider: AuthProvider = {
//   login: async ({ username, email, password }) => {
//     if ((username || email) && password) {
//       localStorage.setItem(TOKEN_KEY, username);
//       return {
//         success: true,
//         redirectTo: "/",
//       };
//     }

//     return {
//       success: false,
//       error: {
//         name: "LoginError",
//         message: "Invalid username or password",
//       },
//     };
//   },


  
//   logout: async () => {
//     localStorage.removeItem(TOKEN_KEY);
//     return {
//       success: true,
//       redirectTo: "/login",
//     };
//   },
//   check: async () => {
//     const token = localStorage.getItem(TOKEN_KEY);
//     if (token) {
//       return {
//         authenticated: true,
//       };
//     }

//     return {
//       authenticated: false,
//       redirectTo: "/login",
//     };
//   },
//   getPermissions: async () => null,
//   getIdentity: async () => {
//     const token = localStorage.getItem(TOKEN_KEY);
//     if (token) {
//       return {
//         id: 1,
//         name: "John Doe",
//         avatar: "https://i.pravatar.cc/300",
//       };
//     }
//     return null;
//   },
//   onError: async (error) => {
//     console.error(error);
//     return { error };
//   },
// };
