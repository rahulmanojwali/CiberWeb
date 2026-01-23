import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

export const fetchLots = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getLots, {
    api: API_TAGS.LOTS.list,
    username,
    language,
    ...filters,
  });

export const fetchLotDetail = async ({
  username,
  language = DEFAULT_LANGUAGE,
  lot_id,
  token_code,
}: {
  username: string;
  language?: string;
  lot_id?: string;
  token_code?: string;
}) =>
  postEncrypted(API_ROUTES.admin.getLotDetail, {
    api: API_TAGS.LOTS.detail,
    username,
    language,
    lot_id,
    token_code,
  });
