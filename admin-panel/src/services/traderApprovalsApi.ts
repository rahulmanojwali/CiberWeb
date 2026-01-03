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

export const getTraderApprovalDetail = async ({
  username,
  language = DEFAULT_LANGUAGE,
  application_id,
}: {
  username: string;
  language?: string;
  application_id: string | number;
}) =>
  postEncrypted(API_ROUTES.admin.getTraderApprovalDetail, {
    api: API_TAGS.TRADER_APPROVALS.detail,
    username,
    language,
    application_id,
  });

export const approveTrader = async ({
  username,
  language = DEFAULT_LANGUAGE,
  application_id,
  remarks,
}: {
  username: string;
  language?: string;
  application_id: string | number;
  remarks?: string;
}) =>
  postEncrypted(API_ROUTES.admin.approveTrader, {
    api: API_TAGS.TRADER_APPROVALS.approve,
    username,
    language,
    application_id,
    remarks,
  });

export const rejectTrader = async ({
  username,
  language = DEFAULT_LANGUAGE,
  application_id,
  remarks,
}: {
  username: string;
  language?: string;
  application_id: string | number;
  remarks?: string;
}) =>
  postEncrypted(API_ROUTES.admin.rejectTrader, {
    api: API_TAGS.TRADER_APPROVALS.reject,
    username,
    language,
    application_id,
    remarks,
  });

export const requestMoreInfoForTrader = async ({
  username,
  language = DEFAULT_LANGUAGE,
  application_id,
  remarks,
}: {
  username: string;
  language?: string;
  application_id: string | number;
  remarks?: string;
}) =>
  postEncrypted(API_ROUTES.admin.requestMoreInfoTrader, {
    api: API_TAGS.TRADER_APPROVALS.requestMoreInfo,
    username,
    language,
    application_id,
    remarks,
  });
