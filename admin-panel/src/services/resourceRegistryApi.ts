import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

export async function fetchResourceRegistry({
  username,
  language = DEFAULT_LANGUAGE,
}: {
  username: string;
  language?: string;
}) {
  const items: Record<string, any> = {
    api: API_TAGS.RESOURCE_REGISTRY.list,
    username,
    language,
  };

  return postEncrypted(API_ROUTES.admin.getResourceRegistry, items);
}

export async function updateResourceRegistry({
  username,
  language = DEFAULT_LANGUAGE,
  entries,
}: {
  username: string;
  language?: string;
  entries: any[];
}) {
  const items: Record<string, any> = {
    api: API_TAGS.RESOURCE_REGISTRY.update,
    username,
    language,
    entries,
  };

  return postEncrypted(API_ROUTES.admin.updateResourceRegistry, items);
}
