import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

export const getMandiSettings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getMandiSettings, {
    api: API_TAGS.MANDI_SETTINGS.get,
    username,
    language,
    ...filters,
  });

export const upsertMandiSettings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.upsertMandiSettings, {
    api: API_TAGS.MANDI_SETTINGS.upsert,
    username,
    language,
    ...payload,
  });
