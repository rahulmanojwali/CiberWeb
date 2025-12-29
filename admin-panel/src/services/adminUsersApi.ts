// src/services/adminUsersApi.ts

import axios from "axios";
import { encryptGenericPayload } from "../utils/aesUtilBrowser";
import {
  API_BASE_URL,
  API_TAGS,
  API_ROUTES,
  DEFAULT_LANGUAGE,
  DEFAULT_COUNTRY,
} from "../config/appConfig";

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

/**
 * Generic helper: POST { encryptedData } to a given path
 */
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

/* ------------------------------------------------------------------ */
/*  ADMIN USERS – LIST / CREATE / UPDATE / DEACTIVATE / RESET PWD     */
/* ------------------------------------------------------------------ */

export async function fetchAdminUsers({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ADMIN_USERS.list, // "getAdminUsers"
    username,
    language,
    ...filters,
  };

  return postEncrypted(API_ROUTES.admin.getAdminUsers, items);
}

export async function createAdminUser({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ADMIN_USERS.create, // "createAdminUser"
    username,
    language,
    ...payload,
  };

  return postEncrypted(API_ROUTES.admin.createAdminUser, items);
}

export async function updateAdminUser({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ADMIN_USERS.update, // "updateAdminUser"
    username,
    language,
    ...payload,
  };

  return postEncrypted(API_ROUTES.admin.updateAdminUser, items);
}

export async function deactivateAdminUser({
  username,
  language = DEFAULT_LANGUAGE,
  target_username,
}: {
  username: string;
  language?: string;
  target_username: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ADMIN_USERS.deactivate, // "deactivateAdminUser"
    username,
    language,
    target_username,
  };

  return postEncrypted(API_ROUTES.admin.deactivateAdminUser, items);
}

export async function requestAdminPasswordReset({
  username,
  language = DEFAULT_LANGUAGE,
  country = DEFAULT_COUNTRY,
  target_username,
  target_admin_user_id,
}: {
  username: string;
  language?: string;
  country?: string;
  target_username?: string;
  target_admin_user_id?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ADMIN_USERS.resetRequest,
    username,
    language,
    country,
  };

  if (target_username) {
    items.target_username = target_username;
  }
  if (target_admin_user_id) {
    items.target_admin_user_id = target_admin_user_id;
  }

  return postEncrypted(API_ROUTES.admin.requestAdminPasswordReset, items);
}

export async function resetAdminUserPassword({
  username,
  language = DEFAULT_LANGUAGE,
  target_username,
  new_password,
}: {
  username: string;
  language?: string;
  target_username: string;
  new_password: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ADMIN_USERS.reset,
    username,
    language,
    target_username,
    new_password,
  };

  return postEncrypted(API_ROUTES.admin.resetAdminUserPassword, items);
}

export async function confirmAdminPasswordReset({
  token,
  new_password,
  language = DEFAULT_LANGUAGE,
  country = DEFAULT_COUNTRY,
}: {
  token: string;
  new_password: string;
  language?: string;
  country?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ADMIN_USERS.resetConfirm,
    token,
    new_password,
    language,
    country,
  };

  return postEncrypted(API_ROUTES.admin.confirmAdminPasswordReset, items);
}

export async function requireStepUp({
  username,
  target_username,
  language = DEFAULT_LANGUAGE,
  country = DEFAULT_COUNTRY,
  session_id,
}: {
  username: string;
  target_username: string;
  language?: string;
  country?: string;
  session_id?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ADMIN_2FA.requireStepUp,
    username,
    target_username,
    language,
    country,
  };
  if (session_id) {
    items.stepup_session_id = session_id;
  }
  const headers: Record<string, string> = session_id
    ? { "X-StepUp-Session": session_id }
    : {};
  return postEncrypted(API_ROUTES.admin.requireStepUp, items, headers);
}

export async function verifyStepUp({
  username,
  otp,
  backup_code,
}: {
  username: string;
  otp?: string;
  backup_code?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ADMIN_2FA.verifyStepUp,
    username,
    target_username: username,
  };
  if (otp) items.otp = otp;
  if (backup_code) items.backup_code = backup_code;
  return postEncrypted(API_ROUTES.admin.verifyStepUp, items);
}

export async function rotateStepUp({
  username,
  session_id,
}: {
  username: string;
  session_id?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ADMIN_2FA.rotate,
    username,
    target_username: username,
  };
  const headers: Record<string, string> = session_id
    ? { "X-StepUp-Session": session_id }
    : {};
  return postEncrypted(API_ROUTES.admin.rotate, items, headers);
}

export async function getStepUpStatus({
  username,
}: {
  username: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ADMIN_2FA.getStatus,
    username,
    target_username: username,
  };
  return postEncrypted(API_ROUTES.admin.getStatus, items);
}

export async function getStepUpSetup({
  username,
  target_username,
  language = DEFAULT_LANGUAGE,
  country = DEFAULT_COUNTRY,
}: {
  username: string;
  target_username: string;
  language?: string;
  country?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ADMIN_2FA.getSetup,
    username,
    target_username,
    language,
    country,
  };
  return postEncrypted(API_ROUTES.admin.get2faSetup, items);
}

export async function enableStepUp({
  username,
  challenge_id,
  otp,
  language = DEFAULT_LANGUAGE,
  country = DEFAULT_COUNTRY,
}: {
  username: string;
  challenge_id: string;
  otp: string;
  language?: string;
  country?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ADMIN_2FA.enable,
    username,
    challenge_id,
    otp,
    language,
    country,
  };
  return postEncrypted(API_ROUTES.admin.enable, items);
}

/* ------------------------------------------------------------------ */
/*  ROLES – FOR ROLE DROPDOWN                                         */
/* ------------------------------------------------------------------ */

export async function fetchAdminRoles({
  username,
  language = DEFAULT_LANGUAGE,
}: {
  username: string;
  language?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ADMIN_USERS.listRoles, // "getAdminRoles"
    username,
    language,
  };

  return postEncrypted(API_ROUTES.admin.getAdminRoles, items);
}

/* ------------------------------------------------------------------ */
/*  ORGS + ORG–MANDI MAPPINGS – FOR ORG & MANDI DROPDOWNS             */
/* ------------------------------------------------------------------ */

export async function fetchOrganisations({
  username,
  language = DEFAULT_LANGUAGE,
}: {
  username: string;
  language?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ORGS.list, // "get_Organisations21"
    username,
    language,
  };

  return postEncrypted(API_ROUTES.admin.getOrganisations, items);
}

export async function fetchOrgMandis({
  username,
  org_id,
  language = DEFAULT_LANGUAGE,
}: {
  username: string;
  org_id?: string;
  language?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.ORG_MANDI.listMappings, // "get_Org_Mandi_Mappings24"
    username,
    language,
    is_active: "Y",
  };

  if (org_id) {
    items.org_id = org_id;
  }

  return postEncrypted(API_ROUTES.admin.getOrgMandiMappings, items);
}

// import axios from "axios";
// import { encryptGenericPayload } from "../utils/aesUtilBrowser";
// import {
//   API_BASE_URL,
//   API_TAGS,
//   API_ROUTES,
//   DEFAULT_LANGUAGE,
// } from "../config/appConfig";

// function authHeaders() {
//   const token = typeof window !== "undefined" ? localStorage.getItem("cd_token") : null;
//   const headers: Record<string, string> = { "Content-Type": "application/json" };
//   if (token) headers.Authorization = `Bearer ${token}`;
//   return headers;
// }

// async function postEncrypted(path: string, items: Record<string, any>) {
//   const encryptedData = await encryptGenericPayload(JSON.stringify({ items }));
//   const { data } = await axios.post(`${API_BASE_URL}${path}`, { encryptedData }, { headers: authHeaders() });
//   return data;
// }

// export async function fetchAdminUsers({
//   username,
//   language = DEFAULT_LANGUAGE,
//   filters = {},
// }: {
//   username: string;
//   language?: string;
//   filters?: Record<string, any>;
// }) {
//   const items = {
//     api: API_TAGS.ADMIN_USERS.list,
//     username,
//     language,
//     ...filters,
//   };
//   return postEncrypted(API_ROUTES.admin.getAdminUsers, items);
// }

// export async function fetchAdminRoles({
//   username,
//   language = DEFAULT_LANGUAGE,
// }: {
//   username: string;
//   language?: string;
// }) {
//   const items = {
//     api: API_TAGS.ADMIN_USERS.listRoles,
//     username,
//     language,
//   };
//   return postEncrypted(API_ROUTES.admin.getAdminRoles, items);
// }

// export async function fetchOrganisations({
//   username,
//   language = DEFAULT_LANGUAGE,
// }: {
//   username: string;
//   language?: string;
// }) {
//   const items = {
//     api: API_TAGS.ADMIN_USERS.listOrgs || API_TAGS.ORGS.list,
//     username,
//     language,
//   };
//   return postEncrypted(API_ROUTES.admin.getOrganisations, items);
// }

// export async function fetchOrgMandis({
//   username,
//   org_id,
//   language = DEFAULT_LANGUAGE,
// }: {
//   username: string;
//   org_id?: string;
//   language?: string;
// }) {
//   const items: Record<string, any> = {
//     api: API_TAGS.ORG_MANDI.listMappings,
//     username,
//     language,
//     is_active: "Y",
//   };
//   if (org_id) items.org_id = org_id;
//   return postEncrypted(API_ROUTES.admin.getOrgMandiMappings, items);
// }

// export async function createAdminUser({
//   username,
//   language = DEFAULT_LANGUAGE,
//   payload,
// }: {
//   username: string;
//   language?: string;
//   payload: {
//     new_username: string;
//     password: string;
//     display_name?: string | null;
//     email?: string | null;
//     mobile?: string | null;
//     role_slug: string;
//     org_code?: string | null;
//     mandi_codes?: string[];
//     is_active?: "Y" | "N";
//   };
// }) {
//   const items = {
//     api: API_TAGS.ADMIN_USERS.create,
//     username,
//     language,
//     ...payload,
//   };
//   return postEncrypted(API_ROUTES.admin.createAdminUser, items);
// }

// export async function updateAdminUser({
//   username,
//   language = DEFAULT_LANGUAGE,
//   payload,
// }: {
//   username: string;
//   language?: string;
//   payload: {
//     target_username: string;
//     display_name?: string | null;
//     email?: string | null;
//     mobile?: string | null;
//     role_slug?: string | null;
//     org_code?: string | null;
//     mandi_codes?: string[];
//     is_active?: "Y" | "N";
//   };
// }) {
//   const items = {
//     api: API_TAGS.ADMIN_USERS.update,
//     username,
//     language,
//     ...payload,
//   };
//   return postEncrypted(API_ROUTES.admin.updateAdminUser, items);
// }

// export async function deactivateAdminUser({
//   username,
//   language = DEFAULT_LANGUAGE,
//   target_username,
// }: {
//   username: string;
//   language?: string;
//   target_username: string;
// }) {
//   const items = {
//     api: API_TAGS.ADMIN_USERS.deactivate,
//     username,
//     language,
//     target_username,
//   };
//   return postEncrypted(API_ROUTES.admin.deactivateAdminUser, items);
// }

// export async function resetAdminUserPassword({
//   username,
//   language = DEFAULT_LANGUAGE,
//   target_username,
//   new_password,
// }: {
//   username: string;
//   language?: string;
//   target_username: string;
//   new_password?: string;
// }) {
//   const items: Record<string, any> = {
//     api: API_TAGS.ADMIN_USERS.reset,
//     username,
//     language,
//     target_username,
//   };
//   if (new_password) items.new_password = new_password;
//   return postEncrypted(API_ROUTES.admin.resetAdminUserPassword, items);
// }
