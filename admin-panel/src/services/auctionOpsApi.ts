import { postEncrypted } from "./sharedEncryptedRequest";
import { API_TAGS, API_ROUTES, DEFAULT_LANGUAGE } from "../config/appConfig";

export const getAuctionSessions = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getAuctionSessions, {
    api: API_TAGS.AUCTION_OPS.SESSIONS.list,
    username,
    language,
    ...filters,
  });

export const startAuctionSession = async ({
  username,
  language = DEFAULT_LANGUAGE,
  session_id,
}: {
  username: string;
  language?: string;
  session_id: string;
}) =>
  postEncrypted(API_ROUTES.admin.startAuctionSession, {
    api: API_TAGS.AUCTION_OPS.SESSIONS.start,
    username,
    language,
    session_id,
  });

export const closeAuctionSession = async ({
  username,
  language = DEFAULT_LANGUAGE,
  session_id,
}: {
  username: string;
  language?: string;
  session_id: string;
}) =>
  postEncrypted(API_ROUTES.admin.closeAuctionSession, {
    api: API_TAGS.AUCTION_OPS.SESSIONS.close,
    username,
    language,
    session_id,
  });

export const getAuctionLots = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getAuctionLots, {
    api: API_TAGS.AUCTION_OPS.LOTS.list,
    username,
    language,
    ...filters,
  });

export const getAuctionResults = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getAuctionResults, {
    api: API_TAGS.AUCTION_OPS.RESULTS.list,
    username,
    language,
    ...filters,
  });
