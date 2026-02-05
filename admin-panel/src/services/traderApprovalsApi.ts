import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

export const getTraderApprovals = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getTraderApprovals, {
    api: API_TAGS.TRADER_APPROVALS.list,
    username,
    language,
    ...filters,
  });

export const approveTrader = async ({
  username,
  language = DEFAULT_LANGUAGE,
  trader_username,
  mandis,
}: {
  username: string;
  language?: string;
  trader_username: string;
  mandis: Array<string | number>;
}) =>
  postEncrypted(API_ROUTES.admin.approveTrader, {
    api: API_TAGS.TRADER_APPROVALS.approve,
    username,
    language,
    trader_username,
    mandis,
  });

export const rejectTrader = async ({
  username,
  language = DEFAULT_LANGUAGE,
  trader_username,
  reason,
}: {
  username: string;
  language?: string;
  trader_username: string;
  reason: string;
}) =>
  postEncrypted(API_ROUTES.admin.rejectTrader, {
    api: API_TAGS.TRADER_APPROVALS.reject,
    username,
    language,
    trader_username,
    reason,
  });


export const requestMoreInfoForTrader = async ({
  username,
  language = DEFAULT_LANGUAGE,
  trader_username,
  reason,
}: {
  username: string;
  language?: string;
  trader_username: string;
  reason: string;
}) =>
  postEncrypted(API_ROUTES.admin.requestMoreInfoTrader, {
    api: API_TAGS.TRADER_APPROVALS.requestMoreInfo,
    username,
    language,
    trader_username,
    reason,
  });
