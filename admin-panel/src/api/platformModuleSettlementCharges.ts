import { postEncrypted } from "../services/sharedEncryptedRequest";

const BASE = "/api/admin/platform-module-settlement-charges";
export const listPlatformModuleSettlementCharges = (username: string, payload: Record<string, any> = {}) =>
  postEncrypted(`${BASE}/list`, { api: "listPlatformModuleSettlementCharges", username, country: "IN", ...payload });
export const savePlatformModuleSettlementCharges = (username: string, payload: Record<string, any>) =>
  postEncrypted(`${BASE}/save`, { api: "savePlatformModuleSettlementCharges", username, country: "IN", ...payload });
export const togglePlatformModuleSettlementCharges = (username: string, payload: Record<string, any>) =>
  postEncrypted(`${BASE}/toggle`, { api: "togglePlatformModuleSettlementCharges", username, country: "IN", ...payload });
