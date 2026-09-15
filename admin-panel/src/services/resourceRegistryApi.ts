import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

export type ResourceRegistryFetchParams = {
  username: string;
  language?: string;
  page?: number;
  pageSize?: number;
  search?: string;
  module?: string;
  status?: "Y" | "N" | "";
};

export async function fetchResourceRegistry({
  username,
  language = DEFAULT_LANGUAGE,
  page,
  pageSize,
  search,
  module,
  status,
}: ResourceRegistryFetchParams) {
  const items: Record<string, any> = {
    api: API_TAGS.RESOURCE_REGISTRY.list,
    username,
    language,
  };

  if (page !== undefined || pageSize !== undefined) {
    items.paginate = true;
    items.page = page ?? 1;
    items.page_size = pageSize ?? 25;
  }
  if (search?.trim()) items.search = search.trim();
  if (module?.trim()) items.module = module.trim();
  if (status === "Y" || status === "N") items.status = status;

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
    resource_key: "resource_registry.edit",
  };

  return postEncrypted(API_ROUTES.admin.updateResourceRegistry, items);
}
