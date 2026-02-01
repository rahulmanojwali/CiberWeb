import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

export const collectStallFee = async (payload: Record<string, any>) =>
  postEncrypted(API_ROUTES.admin.collectStallFee, {
    api: API_TAGS.STALL_FEES.collect,
    ...payload,
  });

export const fetchStallFees = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.listStallFees, {
    api: API_TAGS.STALL_FEES.list,
    username,
    language,
    ...filters,
  });

export const fetchStallFeeReport = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.stallFeeReport, {
    api: API_TAGS.STALL_FEES.report,
    username,
    language,
    ...filters,
  });

export const refundStallFee = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.refundStallFee, {
    api: API_TAGS.STALL_FEES.refund,
    username,
    language,
    ...payload,
  });
