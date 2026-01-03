import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

type Payload = Record<string, any>;

export const getSubscriptions = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Payload;
}) =>
  postEncrypted(API_ROUTES.admin.getSubscriptions, {
    api: API_TAGS.SUBSCRIPTIONS.getSubscriptions,
    username,
    language,
    ...filters,
  });

export const upsertSubscription = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: Payload;
}) =>
  postEncrypted(API_ROUTES.admin.upsertSubscription, {
    api: API_TAGS.SUBSCRIPTIONS.upsertSubscription,
    username,
    language,
    ...payload,
  });

export const getSubscriptionInvoices = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Payload;
}) =>
  postEncrypted(API_ROUTES.admin.getSubscriptionInvoices, {
    api: API_TAGS.SUBSCRIPTIONS.getSubscriptionInvoices,
    username,
    language,
    ...filters,
  });

export const getSubscriptionInvoiceDetail = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: Payload;
}) =>
  postEncrypted(API_ROUTES.admin.getSubscriptionInvoiceDetail, {
    api: API_TAGS.SUBSCRIPTIONS.getSubscriptionInvoiceDetail,
    username,
    language,
    ...payload,
  });

export const recordSubscriptionPayment = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: Payload;
}) =>
  postEncrypted(API_ROUTES.admin.recordSubscriptionPayment, {
    api: API_TAGS.SUBSCRIPTIONS.recordSubscriptionPayment,
    username,
    language,
    ...payload,
  });
