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

export const getLotList = fetchLots;

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

export const verifyLot = async ({
  username,
  language = DEFAULT_LANGUAGE,
  lot_id,
}: {
  username: string;
  language?: string;
  lot_id: string;
}) =>
  postEncrypted(API_ROUTES.admin.verifyLot, {
    api: API_TAGS.LOTS.verify,
    username,
    language,
    lot_id,
  });

export const createLot = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.createLot, {
    api: API_TAGS.LOTS.create,
    username,
    language,
    ...payload,
  });

export const fetchLotTokenContext = async ({
  username,
  language = DEFAULT_LANGUAGE,
  token_code,
}: {
  username: string;
  language?: string;
  token_code: string;
}) =>
  postEncrypted(API_ROUTES.admin.getLotTokenContext, {
    api: API_TAGS.LOTS.token_context,
    username,
    language,
    token_code,
  });

export const fetchLotTokenSearch = async ({
  username,
  language = DEFAULT_LANGUAGE,
  token_code,
  org_id,
  mandi_id,
}: {
  username: string;
  language?: string;
  token_code: string;
  org_id?: string;
  mandi_id?: number | string;
}) =>
  postEncrypted(API_ROUTES.admin.getLotTokenContext, {
    api: API_TAGS.LOTS.token_context,
    username,
    language,
    token_code,
    org_id,
    mandi_id,
    search_only: "Y",
  });

export const fetchLotManualFarmerContext = async ({
  username,
  language = DEFAULT_LANGUAGE,
  farmer_identifier,
}: {
  username: string;
  language?: string;
  farmer_identifier: string;
}) =>
  postEncrypted(API_ROUTES.admin.getLotManualFarmerContext, {
    api: API_TAGS.LOTS.manual_farmer_context,
    username,
    language,
    farmer_identifier,
  });
