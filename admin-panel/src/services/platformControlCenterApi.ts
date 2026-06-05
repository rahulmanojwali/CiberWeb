import { API_ROUTES, API_TAGS, DEFAULT_COUNTRY, DEFAULT_LANGUAGE } from "../config/appConfig";
import { postEncrypted } from "./sharedEncryptedRequest";

type BaseInput = {
  username: string;
  country?: string | null;
  language?: string | null;
  role?: string | null;
};

export type PlatformControlOperation = {
  type:
    | "MENU_VISIBILITY"
    | "MOBILE_WIDGET"
    | "RESOURCE"
    | "MODULE"
    | "BULK_REASSIGN_MODULE"
    | "WORKFLOW_CONTROL"
    | "API_FEATURE";
  _id?: string;
  id?: string;
  key?: string;
  resource_key?: string;
  resource_keys?: string[];
  module?: string;
  target_module?: string;
  is_active: "Y" | "N" | boolean;
};

const withBase = (input: BaseInput, api: string) => ({
  api,
  username: input.username,
  country: input.country || DEFAULT_COUNTRY,
  language: input.language || DEFAULT_LANGUAGE,
  role_slug: input.role || "",
});

export function getPlatformControlCenter(input: BaseInput) {
  return postEncrypted(API_ROUTES.admin.getPlatformControlCenter, {
    ...withBase(input, API_TAGS.PLATFORM_CONTROL_CENTER.get),
  });
}

export function getPlatformMenuControls(input: BaseInput) {
  return postEncrypted(API_ROUTES.admin.getPlatformMenuControls, {
    ...withBase(input, API_TAGS.PLATFORM_CONTROL_CENTER.menuControls),
  });
}

export function updatePlatformControlCenter(input: BaseInput & { operations: PlatformControlOperation[] }) {
  return postEncrypted(API_ROUTES.admin.updatePlatformControlCenter, {
    ...withBase(input, API_TAGS.PLATFORM_CONTROL_CENTER.update),
    operations: input.operations,
  });
}
