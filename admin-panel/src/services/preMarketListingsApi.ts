import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

export const createPreMarketListing = async (payload: Record<string, any>) =>
  postEncrypted(API_ROUTES.admin.createPreMarketListing, {
    api: API_TAGS.PRE_MARKET_LISTINGS.create,
    ...payload,
  });

export const fetchPreMarketListings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.listPreMarketListings, {
    api: API_TAGS.PRE_MARKET_LISTINGS.list,
    username,
    language,
    ...filters,
  });

export const fetchPreMarketListingDetail = async ({
  username,
  language = DEFAULT_LANGUAGE,
  listing_id,
  org_id,
}: {
  username: string;
  language?: string;
  listing_id: string;
  org_id?: string;
}) =>
  postEncrypted(API_ROUTES.admin.getPreMarketListingDetail, {
    api: API_TAGS.PRE_MARKET_LISTINGS.detail,
    username,
    language,
    listing_id,
    org_id,
  });

export const markPreMarketArrival = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.markPreMarketArrival, {
    api: API_TAGS.PRE_MARKET_LISTINGS.arrive,
    username,
    language,
    ...payload,
  });

export const linkLotToPreMarketListing = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.linkLotToPreMarketListing, {
    api: API_TAGS.PRE_MARKET_LISTINGS.link,
    username,
    language,
    ...payload,
  });

export const cancelPreMarketListing = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.cancelPreMarketListing, {
    api: API_TAGS.PRE_MARKET_LISTINGS.cancel,
    username,
    language,
    ...payload,
  });

export const searchPreMarketListingsForGate = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.searchPreMarketListingsForGate, {
    api: API_TAGS.PRE_MARKET_LISTINGS.search,
    username,
    language,
    ...filters,
  });
