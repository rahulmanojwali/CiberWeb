import { postEncrypted } from "./sharedEncryptedRequest";
import { API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

export const getSettlementChargeSettings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getSettlementChargeSettings, {
    api: API_TAGS.SETTLEMENT_CHARGE_SETTINGS.get,
    username,
    language,
    ...payload,
  });

export const upsertSettlementChargeSettings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.upsertSettlementChargeSettings, {
    api: API_TAGS.SETTLEMENT_CHARGE_SETTINGS.upsert,
    username,
    language,
    ...payload,
  });

export const getSettlementChargeMasters = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getSettlementChargeMasters, {
    api: API_TAGS.SETTLEMENT_CHARGE_SETTINGS.masters,
    username,
    language,
    ...(payload || {}),
  });
