import { API_ROUTES, API_TAGS, DEFAULT_COUNTRY, DEFAULT_LANGUAGE } from "../config/appConfig";
import { postEncrypted } from "./sharedEncryptedRequest";

export type RepairSuperAdminPermissionsInput = {
  username: string;
  role?: string | null;
  country?: string | null;
  language?: string | null;
};

export async function repairSuperAdminPermissions(input: RepairSuperAdminPermissionsInput) {
  return postEncrypted(API_ROUTES.admin.repairSuperAdminPermissions, {
    api: API_TAGS.PERMISSION_REPAIR.repairSuperAdminPermissions,
    username: input.username,
    role_slug: input.role || "",
    country: input.country || DEFAULT_COUNTRY,
    language: input.language || DEFAULT_LANGUAGE,
  });
}
