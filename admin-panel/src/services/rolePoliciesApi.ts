import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

export async function fetchRolePoliciesDashboardData({
  username,
  language = DEFAULT_LANGUAGE,
  country = "IN",
}: {
  username: string;
  language?: string;
  country?: string;
}) {
  const items: Record<string, any> = {
    api: "getRolePoliciesDashboardData",
    api_name: "getRolePoliciesDashboardData",
    username,
    language,
    country,
    resource_key: "role_policies.view",
    action: "VIEW",
  };

  // TEMP DEBUG LOG
  // eslint-disable-next-line no-console
  console.log("[dashboard] items", items);

  return postEncrypted(API_ROUTES.admin.getRolePoliciesDashboardData, items);
}

export async function fetchUiResourcesCatalog({
  username,
  language = DEFAULT_LANGUAGE,
  country = "IN",
}: {
  username: string;
  language?: string;
  country?: string;
}) {
  return postEncrypted(API_ROUTES.admin.getUiResourcesCatalog, {
    api: API_TAGS.ROLE_POLICIES.catalog,
    api_name: API_TAGS.ROLE_POLICIES.catalog,
    username,
    language,
    country,
  });
}

export async function fetchRolePolicy({
  username,
  language = DEFAULT_LANGUAGE,
  country = "IN",
  role_slug,
}: {
  username: string;
  language?: string;
  country?: string;
  role_slug: string;
}) {
  return postEncrypted(API_ROUTES.admin.getRolePolicy, {
    api: API_TAGS.ROLE_POLICIES.get,
    api_name: API_TAGS.ROLE_POLICIES.get,
    username,
    language,
    country,
    role_slug,
  });
}

export async function updateRolePolicies({
  username,
  language = DEFAULT_LANGUAGE,
  country = "IN",
  role_slug,
  permissions,
}: {
  username: string;
  language?: string;
  country?: string;
  role_slug: string;
  permissions: any[];
}) {
  const items: Record<string, any> = {
    api: "updateRolePolicies",
    api_name: "updateRolePolicies",
    username,
    language,
    country,
    role_slug,
    permissions,
    resource_key: "role_policies.edit",
    action: "UPDATE",
  };

  // TEMP DEBUG LOG
  // eslint-disable-next-line no-console
  console.log("[updateRolePolicies] items", items);

  return postEncrypted(API_ROUTES.admin.updateRolePolicies, items);
}

// export async function updateRolePolicy({
//   username,
//   language = DEFAULT_LANGUAGE,
//   country = "IN",
//   role_slug,
//   permissions,
// }: {
//   username: string;
//   language?: string;
//   country?: string;
//   role_slug: string;
//   permissions: any[];
// }) {
//   return postEncrypted(API_ROUTES.admin.updateRolePolicy, {
//     api: API_TAGS.ROLE_POLICIES.updateOne,
//     api_name: API_TAGS.ROLE_POLICIES.updateOne,
//     username,
//     language,
//     country,
//     role_slug,
//     permissions,
//   });
// }
export async function updateRolePolicy({
  username,
  language = DEFAULT_LANGUAGE,
  country = "IN",
  role_slug,
  permissions,
}: {
  username: string;
  language?: string;
  country?: string;
  role_slug: string;
  permissions: any[];
}) {
  // IMPORTANT:
  // Some builds/configs have API_ROUTES.admin.updateRolePolicy mis-pointing to a GET route.
  // To avoid breaking anything else, we route updateRolePolicy() through the known working
  // updateRolePolicies endpoint while keeping this function signature unchanged.

  const items: Record<string, any> = {
    // Send BOTH styles for maximum compatibility with backend validators / api_verifications
    api: "updateRolePolicies",
    api_name: "updateRolePolicies",
    username,
    language,
    country,
    role_slug,
    permissions,
    resource_key: "role_policies.edit",
    action: "UPDATE",

    // Dedupe-buster for debugging / safety. Backend ignores unknown fields.
    _client_nonce: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
  };

  // TEMP DEBUG LOG
  // eslint-disable-next-line no-console
  console.log("[updateRolePolicy->updateRolePolicies] POST", {
    path: API_ROUTES.admin.updateRolePolicies,
    api: items.api,
    api_name: items.api_name,
    role_slug,
    permissionsCount: Array.isArray(permissions) ? permissions.length : 0,
    nonce: items._client_nonce,
  });

  return postEncrypted(API_ROUTES.admin.updateRolePolicies, items);
}

// import { postEncrypted } from "./sharedEncryptedRequest";
// import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

// export async function fetchRolePoliciesDashboardData({
//   username,
//   language = DEFAULT_LANGUAGE,
//   country = "IN",
// }: {
//   username: string;
//   language?: string;
//   country?: string;
// }) {
//   const items: Record<string, any> = {
//     api: "getRolePoliciesDashboardData",
//     username,
//     language,
//     country,
//   };

//   // TEMP DEBUG LOG
//   // eslint-disable-next-line no-console
//   console.log("[dashboard] items", items);

//   return postEncrypted(API_ROUTES.admin.getRolePoliciesDashboardData, items);
// }

// export async function fetchUiResourcesCatalog({
//   username,
//   language = DEFAULT_LANGUAGE,
//   country = "IN",
// }: {
//   username: string;
//   language?: string;
//   country?: string;
// }) {
//   return postEncrypted(API_ROUTES.admin.getUiResourcesCatalog, {
//     api: API_TAGS.ROLE_POLICIES.catalog,
//     api_name: API_TAGS.ROLE_POLICIES.catalog,
//     username,
//     language,
//     country,
//   });
// }

// export async function fetchRolePolicy({
//   username,
//   language = DEFAULT_LANGUAGE,
//   country = "IN",
//   role_slug,
// }: {
//   username: string;
//   language?: string;
//   country?: string;
//   role_slug: string;
// }) {
//   return postEncrypted(API_ROUTES.admin.getRolePolicy, {
//     api: API_TAGS.ROLE_POLICIES.get,
//     api_name: API_TAGS.ROLE_POLICIES.get,
//     username,
//     language,
//     country,
//     role_slug,
//   });
// }

// export async function updateRolePolicies({
//   username,
//   language = DEFAULT_LANGUAGE,
//   country = "IN",
//   role_slug,
//   permissions,
// }: {
//   username: string;
//   language?: string;
//   country?: string;
//   role_slug: string;
//   permissions: any[];
// }) {
//   const items: Record<string, any> = {
//     api: "updateRolePolicies",
//     username,
//     language,
//     country,
//     role_slug,
//     permissions,
//   };

//   // TEMP DEBUG LOG
//   // eslint-disable-next-line no-console
//   console.log("[updateRolePolicies] items", items);

//   return postEncrypted(API_ROUTES.admin.updateRolePolicies, items);
// }

// // export async function updateRolePolicy({
// //   username,
// //   language = DEFAULT_LANGUAGE,
// //   country = "IN",
// //   role_slug,
// //   permissions,
// // }: {
// //   username: string;
// //   language?: string;
// //   country?: string;
// //   role_slug: string;
// //   permissions: any[];
// // }) {
// //   return postEncrypted(API_ROUTES.admin.updateRolePolicy, {
// //     api: API_TAGS.ROLE_POLICIES.updateOne,
// //     api_name: API_TAGS.ROLE_POLICIES.updateOne,
// //     username,
// //     language,
// //     country,
// //     role_slug,
// //     permissions,
// //   });
// // }
// export async function updateRolePolicy({
//   username,
//   language = DEFAULT_LANGUAGE,
//   country = "IN",
//   role_slug,
//   permissions,
// }: {
//   username: string;
//   language?: string;
//   country?: string;
//   role_slug: string;
//   permissions: any[];
// }) {
//   // IMPORTANT:
//   // Some builds/configs have API_ROUTES.admin.updateRolePolicy mis-pointing to a GET route.
//   // To avoid breaking anything else, we route updateRolePolicy() through the known working
//   // updateRolePolicies endpoint while keeping this function signature unchanged.

//   const items: Record<string, any> = {
//     // Send BOTH styles for maximum compatibility with backend validators / api_verifications
//     api: "updateRolePolicies",
//     api_name: "updateRolePolicies",
//     username,
//     language,
//     country,
//     role_slug,
//     permissions,
//   };

//   // TEMP DEBUG LOG
//   // eslint-disable-next-line no-console
//   console.log("[updateRolePolicy->updateRolePolicies] items", items);

//   return postEncrypted(API_ROUTES.admin.updateRolePolicies, items);
// }
