import axios from "axios";
import { encryptGenericPayload } from "../utils/aesUtilBrowser";
import { API_BASE_URL, API_ROUTES, API_TAGS, DEFAULT_LANGUAGE } from "../config/appConfig";

type EncryptedPayload = Record<string, any>;

function getAuthHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("cd_token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function postEncrypted(path: string, items: Record<string, any>) {
  const encryptedData = await encryptGenericPayload(JSON.stringify({ items }));
  const url = `${API_BASE_URL}${path}`;
  const { data } = await axios.post(url, { encryptedData }, { headers: getAuthHeaders() });
  return data;
}

export const getPaymentModels = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.paymentConfig.getPaymentModels, {
    api: API_TAGS.PAYMENT_CONFIG.getPaymentModels,
    username,
    language,
    ...filters,
  });

export const upsertPaymentModel = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: EncryptedPayload;
}) =>
  postEncrypted(API_ROUTES.admin.paymentConfig.upsertPaymentModel, {
    api: API_TAGS.PAYMENT_CONFIG.upsertPaymentModel,
    username,
    language,
    ...payload,
  });

export const getOrgPaymentSettings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: EncryptedPayload;
}) =>
  postEncrypted(API_ROUTES.admin.paymentConfig.getOrgPaymentSettings, {
    api: API_TAGS.PAYMENT_CONFIG.getOrgPaymentSettings,
    username,
    language,
    ...payload,
  });

export const updateOrgPaymentSettings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: EncryptedPayload;
}) =>
  postEncrypted(API_ROUTES.admin.paymentConfig.updateOrgPaymentSettings, {
    api: API_TAGS.PAYMENT_CONFIG.updateOrgPaymentSettings,
    username,
    language,
    ...payload,
  });

export const getMandiPaymentSettings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: EncryptedPayload;
}) =>
  postEncrypted(API_ROUTES.admin.paymentConfig.getMandiPaymentSettings, {
    api: API_TAGS.PAYMENT_CONFIG.getMandiPaymentSettings,
    username,
    language,
    ...payload,
  });

export const updateMandiPaymentSettings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: EncryptedPayload;
}) =>
  postEncrypted(API_ROUTES.admin.paymentConfig.updateMandiPaymentSettings, {
    api: API_TAGS.PAYMENT_CONFIG.updateMandiPaymentSettings,
    username,
    language,
    ...payload,
  });

export const getCommodityPaymentSettings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: EncryptedPayload;
}) =>
  postEncrypted(API_ROUTES.admin.paymentConfig.getCommodityPaymentSettings, {
    api: API_TAGS.PAYMENT_CONFIG.getCommodityPaymentSettings,
    username,
    language,
    ...payload,
  });

export const upsertCommodityPaymentSettings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: EncryptedPayload;
}) =>
  postEncrypted(API_ROUTES.admin.paymentConfig.upsertCommodityPaymentSettings, {
    api: API_TAGS.PAYMENT_CONFIG.upsertCommodityPaymentSettings,
    username,
    language,
    ...payload,
  });

export const getPaymentModeRules = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: EncryptedPayload;
}) =>
  postEncrypted(API_ROUTES.admin.paymentConfig.getPaymentModeRules, {
    api: API_TAGS.PAYMENT_CONFIG.getPaymentModeRules,
    username,
    language,
    ...payload,
  });

export const upsertPaymentModeRules = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: EncryptedPayload;
}) =>
  postEncrypted(API_ROUTES.admin.paymentConfig.upsertPaymentModeRules, {
    api: API_TAGS.PAYMENT_CONFIG.upsertPaymentModeRules,
    username,
    language,
    ...payload,
  });

export const getCustomFeeTemplates = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: EncryptedPayload;
}) =>
  postEncrypted(API_ROUTES.admin.paymentConfig.getCustomFeeTemplates, {
    api: API_TAGS.PAYMENT_CONFIG.getCustomFeeTemplates,
    username,
    language,
    ...payload,
  });

export const upsertCustomFeeTemplate = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: EncryptedPayload;
}) =>
  postEncrypted(API_ROUTES.admin.paymentConfig.upsertCustomFeeTemplate, {
    api: API_TAGS.PAYMENT_CONFIG.upsertCustomFeeTemplate,
    username,
    language,
    ...payload,
  });

export const getRoleCustomFees = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: EncryptedPayload;
}) =>
  postEncrypted(API_ROUTES.admin.paymentConfig.getRoleCustomFees, {
    api: API_TAGS.PAYMENT_CONFIG.getRoleCustomFees,
    username,
    language,
    ...payload,
  });

export const upsertRoleCustomFee = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: EncryptedPayload;
}) =>
  postEncrypted(API_ROUTES.admin.paymentConfig.upsertRoleCustomFee, {
    api: API_TAGS.PAYMENT_CONFIG.upsertRoleCustomFee,
    username,
    language,
    ...payload,
  });

export const previewEffectiveFees = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: EncryptedPayload;
}) =>
  postEncrypted(API_ROUTES.admin.paymentConfig.previewEffectiveFees, {
    api: API_TAGS.PAYMENT_CONFIG.previewEffectiveFees,
    username,
    language,
    ...payload,
  });
