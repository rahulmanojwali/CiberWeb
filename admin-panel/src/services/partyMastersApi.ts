import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

export const getTraders = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getTraders, {
    api: API_TAGS.PARTY_MASTERS.traders.list,
    username,
    language,
    ...filters,
  });

export const updateTraderStatus = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.updateTraderStatus, {
    api: API_TAGS.PARTY_MASTERS.traders.update,
    username,
    language,
    ...payload,
  });

export const getFarmers = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getFarmers, {
    api: API_TAGS.PARTY_MASTERS.farmers.list,
    username,
    language,
    ...filters,
  });

export const updateFarmerStatus = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.updateFarmerStatus, {
    api: API_TAGS.PARTY_MASTERS.farmers.update,
    username,
    language,
    ...payload,
  });
