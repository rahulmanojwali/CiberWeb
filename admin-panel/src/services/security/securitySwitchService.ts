import { postEncrypted } from "../sharedEncryptedRequest";
import {
  API_ROUTES,
  API_TAGS,
  DEFAULT_COUNTRY,
  DEFAULT_LANGUAGE,
} from "../../config/appConfig";

export async function getSecuritySwitches({
  username,
  language = DEFAULT_LANGUAGE,
  country = DEFAULT_COUNTRY,
}: {
  username: string;
  language?: string;
  country?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.SECURITY_SWITCH?.get,
    username,
    language,
    country,
  };
  return postEncrypted(API_ROUTES.admin.getSecuritySwitches, items);
}

export async function updateSecuritySwitches({
  username,
  switches,
  language = DEFAULT_LANGUAGE,
  country = DEFAULT_COUNTRY,
}: {
  username: string;
  switches: Record<string, "Y" | "N">;
  language?: string;
  country?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.SECURITY_SWITCH?.update,
    username,
    language,
    country,
    switches,
  };
  return postEncrypted(API_ROUTES.admin.updateSecuritySwitches, items);
}
