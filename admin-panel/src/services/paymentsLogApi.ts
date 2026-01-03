import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

type Payload = Record<string, any>;

export const getPaymentsLog = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Payload;
}) =>
  postEncrypted(API_ROUTES.admin.getPaymentsLog, {
    api: API_TAGS.PAYMENTS_LOG.getPaymentsLog,
    username,
    language,
    ...filters,
  });

export const getPaymentDetail = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: Payload;
}) =>
  postEncrypted(API_ROUTES.admin.getPaymentDetail, {
    api: API_TAGS.PAYMENTS_LOG.getPaymentDetail,
    username,
    language,
    ...payload,
  });
