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
  postEncrypted(API_ROUTES.admin.getLotList, {
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

export const updateLotStatus = async ({
  username,
  language = DEFAULT_LANGUAGE,
  lot_id,
  to_status,
  reason,
  meta,
}: {
  username: string;
  language?: string;
  lot_id: string;
  to_status: string;
  reason?: string;
  meta?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.updateLotStatus, {
    api: API_TAGS.LOTS.update_status,
    username,
    language,
    lot_id,
    to_status,
    reason,
    meta,
  });

export const mapLotToAuction = async ({
  username,
  language = DEFAULT_LANGUAGE,
  lot_id,
  auction_id,
  auction_code,
  meta,
}: {
  username: string;
  language?: string;
  lot_id: string;
  auction_id?: string;
  auction_code?: string;
  meta?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.mapLotToAuction, {
    api: API_TAGS.LOTS.map_to_auction,
    username,
    language,
    lot_id,
    auction_id,
    auction_code,
    meta,
  });
