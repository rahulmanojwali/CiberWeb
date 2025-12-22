import axios from "axios";
import { encryptGenericPayload } from "../utils/aesUtilBrowser";
import { API_BASE_URL, API_TAGS, API_ROUTES, DEFAULT_LANGUAGE } from "../config/appConfig";

function authHeaders() {
  const token = typeof window !== "undefined" ? localStorage.getItem("cd_token") : null;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function postEncrypted(path: string, items: Record<string, any>) {
  const encryptedData = await encryptGenericPayload(JSON.stringify({ items }));
  const url = `${API_BASE_URL}${path}`;
  const { data } = await axios.post(url, { encryptedData }, { headers: authHeaders() });
  const rc = data?.response?.responsecode;
  const desc = data?.response?.description || "Something went wrong.";
  if (rc !== "0") {
    const err: any = new Error(desc);
    err.responseCode = rc;
    err.rawResponse = data;
    throw err;
  }
  return data;
}

// Gate Entry Reasons
export const fetchGateEntryReasons = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getGateEntryReasons, {
    api: API_TAGS.GATE_ENTRY_REASONS.list,
    username,
    language,
    ...filters,
  });

export const createGateEntryReason = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.createGateEntryReason, {
    api: API_TAGS.GATE_ENTRY_REASONS.create,
    username,
    language,
    ...payload,
  });

export const updateGateEntryReason = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.updateGateEntryReason, {
    api: API_TAGS.GATE_ENTRY_REASONS.update,
    username,
    language,
    ...payload,
  });

export const deactivateGateEntryReason = async ({
  username,
  language = DEFAULT_LANGUAGE,
  reason_code,
}: {
  username: string;
  language?: string;
  reason_code: string;
}) =>
  postEncrypted(API_ROUTES.admin.deactivateGateEntryReason, {
    api: API_TAGS.GATE_ENTRY_REASONS.deactivate,
    username,
    language,
    reason_code,
  });

// Gate Vehicle Types
export const fetchGateVehicleTypes = async (
  items: {
    username: string;
    language?: string;
    [key: string]: any;
  },
) => {
  return postEncrypted(API_ROUTES.admin.getGateVehicleTypes, {
    api: API_TAGS.GATE_VEHICLE_TYPES.list,
    language: DEFAULT_LANGUAGE,
    ...items,
  });
};

export const createGateVehicleType = async (items: Record<string, any>) =>
  postEncrypted(API_ROUTES.admin.createGateVehicleType, {
    api: API_TAGS.GATE_VEHICLE_TYPES.create,
    language: DEFAULT_LANGUAGE,
    ...items,
  });

export const updateGateVehicleType = async (items: Record<string, any>) =>
  postEncrypted(API_ROUTES.admin.updateGateVehicleType, {
    api: API_TAGS.GATE_VEHICLE_TYPES.update,
    language: DEFAULT_LANGUAGE,
    ...items,
  });

export const deactivateGateVehicleType = async ({
  username,
  language = DEFAULT_LANGUAGE,
  vehicle_type_code,
}: {
  username: string;
  language?: string;
  vehicle_type_code: string;
}) =>
  postEncrypted(API_ROUTES.admin.deactivateGateVehicleType, {
    api: API_TAGS.GATE_VEHICLE_TYPES.deactivate,
    username,
    language,
    vehicle_type_code,
  });

// Gate Devices
export const fetchGateDevices = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getGateDevices, {
    api: API_TAGS.GATE_DEVICES.list,
    username,
    language,
    ...filters,
  });

export const createGateDevice = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.createGateDevice, {
    api: API_TAGS.GATE_DEVICES.create,
    username,
    language,
    ...payload,
  });

export const updateGateDevice = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.updateGateDevice, {
    api: API_TAGS.GATE_DEVICES.update,
    username,
    language,
    ...payload,
  });

export const deactivateGateDevice = async ({
  username,
  language = DEFAULT_LANGUAGE,
  device_code,
}: {
  username: string;
  language?: string;
  device_code: string;
}) =>
  postEncrypted(API_ROUTES.admin.deactivateGateDevice, {
    api: API_TAGS.GATE_DEVICES.deactivate,
    username,
    language,
    device_code,
  });

// Gate Device Configs
export const fetchGateDeviceConfigs = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getGateDeviceConfigs, {
    api: API_TAGS.GATE_DEVICE_CONFIGS.list,
    username,
    language,
    ...filters,
  });

export const fetchMandisWithGatesSummary = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getMandisWithGatesSummary, {
    api: API_TAGS.GATE_DEVICE_CONFIGS.mandisWithGates,
    username,
    language,
    ...filters,
  });

export const createGateDeviceConfig = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.createGateDeviceConfig, {
    api: API_TAGS.GATE_DEVICE_CONFIGS.create,
    username,
    language,
    ...payload,
  });

export const updateGateDeviceConfig = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.updateGateDeviceConfig, {
    api: API_TAGS.GATE_DEVICE_CONFIGS.update,
    username,
    language,
    ...payload,
  });

export const deactivateGateDeviceConfig = async ({
  username,
  language = DEFAULT_LANGUAGE,
  config_id,
  is_active,
}: {
  username: string;
  language?: string;
  config_id: string;
  is_active?: string;
}) =>
  postEncrypted(API_ROUTES.admin.deactivateGateDeviceConfig, {
    api: API_TAGS.GATE_DEVICE_CONFIGS.deactivate,
    username,
    language,
    config_id,
    is_active,
  });
