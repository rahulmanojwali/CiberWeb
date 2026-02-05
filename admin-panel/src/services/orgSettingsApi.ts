import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

export const getOrgSettings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getOrgSettings, {
    api: API_TAGS.ORG_SETTINGS.get,
    username,
    language,
    ...payload,
  });

export const upsertOrgSettings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.upsertOrgSettings, {
    api: API_TAGS.ORG_SETTINGS.upsert,
    username,
    language,
    ...payload,
  });
