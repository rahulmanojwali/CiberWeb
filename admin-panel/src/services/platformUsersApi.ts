import { postEncrypted } from "./sharedEncryptedRequest";
import { API_TAGS, API_ROUTES, DEFAULT_LANGUAGE } from "../config/appConfig";

export type PlatformUserFilters = {
  page?: number;
  page_size?: number;
  search?: string;
  role_code?: string;
  status?: "ALL" | "ACTIVE" | "INACTIVE" | "Y" | "N";
};

export async function fetchPlatformRoles({
  username,
  language = DEFAULT_LANGUAGE,
}: {
  username: string;
  language?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.PLATFORM_USERS.listRoles,
    username,
    language,
  };
  return postEncrypted(API_ROUTES.admin.listPlatformRoles, items);
}

export async function fetchPlatformUsers({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: PlatformUserFilters;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.PLATFORM_USERS.list,
    username,
    language,
    ...filters,
  };
  return postEncrypted(API_ROUTES.admin.listPlatformUsers, items);
}

export async function createPlatformUser({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.PLATFORM_USERS.create,
    username,
    language,
    ...payload,
  };
  return postEncrypted(API_ROUTES.admin.createPlatformUser, items);
}

export async function updatePlatformUser({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.PLATFORM_USERS.update,
    username,
    language,
    ...payload,
  };
  return postEncrypted(API_ROUTES.admin.updatePlatformUser, items);
}

export async function resetPlatformUserPassword({
  username,
  language = DEFAULT_LANGUAGE,
  target_username,
  password,
}: {
  username: string;
  language?: string;
  target_username: string;
  password: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.PLATFORM_USERS.resetPassword,
    username,
    language,
    target_username,
    password,
  };
  return postEncrypted(API_ROUTES.admin.resetPlatformUserPassword, items);
}

export async function updatePlatformUserStatus({
  username,
  language = DEFAULT_LANGUAGE,
  target_username,
  is_active,
}: {
  username: string;
  language?: string;
  target_username: string;
  is_active: "Y" | "N";
}) {
  const items: Record<string, any> = {
    api: API_TAGS.PLATFORM_USERS.updateStatus,
    username,
    language,
    target_username,
    is_active,
  };
  return postEncrypted(API_ROUTES.admin.updatePlatformUserStatus, items);
}
