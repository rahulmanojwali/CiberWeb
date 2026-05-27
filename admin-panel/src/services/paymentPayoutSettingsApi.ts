import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

export const getPaymentPayoutSettings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getPaymentPayoutSettings, {
    api: API_TAGS.PAYMENT_PAYOUT_SETTINGS.get,
    username,
    language,
    ...payload,
  });

export const upsertPaymentPayoutSettings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.upsertPaymentPayoutSettings, {
    api: API_TAGS.PAYMENT_PAYOUT_SETTINGS.upsert,
    username,
    language,
    ...payload,
  });

