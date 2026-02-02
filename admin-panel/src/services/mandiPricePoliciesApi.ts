import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

export const getMandiPricePolicies = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getMandiPricePolicies, {
    api: API_TAGS.MANDI_PRICE_POLICIES.list,
    username,
    language,
    ...filters,
  });

export const upsertMandiPricePolicy = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.upsertMandiPricePolicy, {
    api: API_TAGS.MANDI_PRICE_POLICIES.upsert,
    username,
    language,
    ...payload,
  });

export const deactivateMandiPricePolicy = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.deactivateMandiPricePolicy, {
    api: API_TAGS.MANDI_PRICE_POLICIES.deactivate,
    username,
    language,
    ...payload,
  });
