import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

export const fetchMarketPrices = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getMarketPrices, {
    api: API_TAGS.MARKET_PRICES.list,
    username,
    language,
    ...filters,
  });

export const generateMarketPriceSnapshots = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.generateMarketPriceSnapshots, {
    api: API_TAGS.MARKET_PRICES.generate,
    username,
    language,
    ...payload,
  });

export const listDailyMarketRates = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.listDailyMarketRates, {
    api: API_TAGS.MARKET_PRICES.dailyList,
    username,
    language,
    ...payload,
  });

export const getDailyMarketRates = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getDailyMarketRates, {
    api: API_TAGS.MARKET_PRICES.dailyGet,
    username,
    language,
    ...payload,
  });

export const generateDailyMarketRates = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.generateDailyMarketRates, {
    api: API_TAGS.MARKET_PRICES.dailyGenerate,
    username,
    language,
    ...payload,
  });
