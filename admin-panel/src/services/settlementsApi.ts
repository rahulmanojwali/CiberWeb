import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

type Payload = Record<string, any>;

export const getSettlements = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Payload;
}) =>
  postEncrypted(API_ROUTES.admin.getSettlements, {
    api: API_TAGS.SETTLEMENTS.getSettlements,
    username,
    language,
    ...filters,
  });

export const getSettlementDetail = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: Payload;
}) =>
  postEncrypted(API_ROUTES.admin.getSettlementDetail, {
    api: API_TAGS.SETTLEMENTS.getSettlementDetail,
    username,
    language,
    ...payload,
  });
