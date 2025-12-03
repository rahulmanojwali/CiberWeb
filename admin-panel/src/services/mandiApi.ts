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
  return data;
}

// --- Mandis ---
export const fetchMandis = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getMandis, {
    api: API_TAGS.MANDIS.list,
    username,
    language,
    ...filters,
  });

export const createMandi = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.createMandi, {
    api: API_TAGS.MANDIS.create,
    username,
    language,
    ...payload,
  });

export const updateMandi = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.updateMandi, {
    api: API_TAGS.MANDIS.update,
    username,
    language,
    ...payload,
  });

export const deactivateMandi = async ({
  username,
  language = DEFAULT_LANGUAGE,
  mandi_id,
}: {
  username: string;
  language?: string;
  mandi_id: number;
}) =>
  postEncrypted(API_ROUTES.admin.deactivateMandi, {
    api: API_TAGS.MANDIS.deactivate,
    username,
    language,
    mandi_id,
  });

// --- Org-Mandi mapping ---
export const fetchOrgMandiMappings = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getOrgMandiMappings, {
    api: API_TAGS.ORG_MANDI.listMappings,
    username,
    language,
    ...filters,
  });

export const addOrgMandi = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.addOrgMandi, {
    api: API_TAGS.ORG_MANDI.addMapping,
    username,
    language,
    ...payload,
  });

export const removeOrgMandi = async ({
  username,
  language = DEFAULT_LANGUAGE,
  mapping_id,
}: {
  username: string;
  language?: string;
  mapping_id: string;
}) =>
  postEncrypted(API_ROUTES.admin.removeOrgMandi, {
    api: API_TAGS.ORG_MANDI.removeMapping,
    username,
    language,
    mapping_id,
    is_active: "N",
  });

// --- Commodities ---
export const fetchCommodities = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getCommodities, {
    api: API_TAGS.COMMODITIES.list,
    username,
    language,
    ...filters,
  });

export const createCommodity = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.createCommodity, {
    api: API_TAGS.COMMODITIES.create,
    username,
    language,
    ...payload,
  });

export const updateCommodity = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.updateCommodity, {
    api: API_TAGS.COMMODITIES.update,
    username,
    language,
    ...payload,
  });

export const deactivateCommodity = async ({
  username,
  language = DEFAULT_LANGUAGE,
  commodity_id,
}: {
  username: string;
  language?: string;
  commodity_id: number;
}) =>
  postEncrypted(API_ROUTES.admin.deactivateCommodity, {
    api: API_TAGS.COMMODITIES.deactivate,
    username,
    language,
    commodity_id,
  });

// --- Commodity products ---
export const fetchCommodityProducts = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getCommodityProducts, {
    api: API_TAGS.PRODUCTS.list,
    username,
    language,
    ...filters,
  });

export const createCommodityProduct = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.createCommodityProduct, {
    api: API_TAGS.PRODUCTS.create,
    username,
    language,
    ...payload,
  });

export const updateCommodityProduct = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.updateCommodityProduct, {
    api: API_TAGS.PRODUCTS.update,
    username,
    language,
    ...payload,
  });

export const deactivateCommodityProduct = async ({
  username,
  language = DEFAULT_LANGUAGE,
  product_id,
  org_code,
}: {
  username: string;
  language?: string;
  product_id: number;
  org_code?: string;
}) =>
  postEncrypted(API_ROUTES.admin.deactivateCommodityProduct, {
    api: API_TAGS.PRODUCTS.deactivate,
    username,
    language,
    product_id,
    org_code,
  });

// --- Facility masters ---
export const fetchMandiFacilitiesMasters = async ({
  username,
  language = DEFAULT_LANGUAGE,
}: {
  username: string;
  language?: string;
}) =>
  postEncrypted(API_ROUTES.admin.getMandiFacilitiesMasters, {
    api: API_TAGS.FACILITY_MASTERS.list,
    username,
    language,
  });

export const createMandiFacilityMaster = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.createMandiFacilityMaster, {
    api: API_TAGS.FACILITY_MASTERS.create,
    username,
    language,
    ...payload,
  });

export const updateMandiFacilityMaster = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.updateMandiFacilityMaster, {
    api: API_TAGS.FACILITY_MASTERS.update,
    username,
    language,
    ...payload,
  });

export const deactivateMandiFacilityMaster = async ({
  username,
  language = DEFAULT_LANGUAGE,
  _id,
}: {
  username: string;
  language?: string;
  _id: string;
}) =>
  postEncrypted(API_ROUTES.admin.deactivateMandiFacilityMaster, {
    api: API_TAGS.FACILITY_MASTERS.deactivate,
    username,
    language,
    _id,
  });

// --- Facilities ---
export const fetchMandiFacilities = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getMandiFacilities, {
    api: API_TAGS.FACILITIES.list,
    username,
    language,
    ...filters,
  });

export const createMandiFacility = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.createMandiFacility, {
    api: API_TAGS.FACILITIES.create,
    username,
    language,
    ...payload,
  });

export const updateMandiFacility = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.updateMandiFacility, {
    api: API_TAGS.FACILITIES.update,
    username,
    language,
    ...payload,
  });

export const deactivateMandiFacility = async ({
  username,
  language = DEFAULT_LANGUAGE,
  _id,
}: {
  username: string;
  language?: string;
  _id: string;
}) =>
  postEncrypted(API_ROUTES.admin.deactivateMandiFacility, {
    api: API_TAGS.FACILITIES.deactivate,
    username,
    language,
    _id,
  });

// --- Gates ---
export const fetchMandiGates = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getMandiGates, {
    api: API_TAGS.GATES.list,
    username,
    language,
    ...filters,
  });

export const createMandiGate = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.createMandiGate, {
    api: API_TAGS.GATES.create,
    username,
    language,
    ...payload,
  });

export const updateMandiGate = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.updateMandiGate, {
    api: API_TAGS.GATES.update,
    username,
    language,
    ...payload,
  });

export const deactivateMandiGate = async ({
  username,
  language = DEFAULT_LANGUAGE,
  _id,
}: {
  username: string;
  language?: string;
  _id: string;
}) =>
  postEncrypted(API_ROUTES.admin.deactivateMandiGate, {
    api: API_TAGS.GATES.deactivate,
    username,
    language,
    _id,
  });

// --- Hours templates ---
export const fetchMandiHoursMasters = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getMandiHoursMasters, {
    api: API_TAGS.HOURS.list,
    username,
    language,
    ...filters,
  });

export const createMandiHoursTemplate = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.createMandiHoursTemplate, {
    api: API_TAGS.HOURS.create,
    username,
    language,
    ...payload,
  });

export const updateMandiHoursTemplate = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.updateMandiHoursTemplate, {
    api: API_TAGS.HOURS.update,
    username,
    language,
    ...payload,
  });

export const deactivateMandiHoursTemplate = async ({
  username,
  language = DEFAULT_LANGUAGE,
  _id,
}: {
  username: string;
  language?: string;
  _id: string;
}) =>
  postEncrypted(API_ROUTES.admin.deactivateMandiHoursTemplate, {
    api: API_TAGS.HOURS.deactivate,
    username,
    language,
    _id,
  });
