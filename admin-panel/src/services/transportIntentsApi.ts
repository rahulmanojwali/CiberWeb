import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

export const createTransportIntent = async (payload: Record<string, any>) =>
  postEncrypted(API_ROUTES.admin.createTransportIntent, {
    api: API_TAGS.TRANSPORT_INTENTS.create,
    ...payload,
  });

export const fetchTransportIntents = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.listTransportIntents, {
    api: API_TAGS.TRANSPORT_INTENTS.list,
    username,
    language,
    ...filters,
  });

export const matchTransportIntent = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.matchTransportIntent, {
    api: API_TAGS.TRANSPORT_INTENTS.match,
    username,
    language,
    ...payload,
  });

export const completeTransportIntent = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.completeTransportIntent, {
    api: API_TAGS.TRANSPORT_INTENTS.complete,
    username,
    language,
    ...payload,
  });

export const cancelTransportIntent = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.cancelTransportIntent, {
    api: API_TAGS.TRANSPORT_INTENTS.cancel,
    username,
    language,
    ...payload,
  });
