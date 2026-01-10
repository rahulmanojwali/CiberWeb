import { postEncrypted } from "./sharedEncryptedRequest";
import { API_TAGS, API_ROUTES, DEFAULT_LANGUAGE } from "../config/appConfig";

// --- Gates Bootstrap (Gates screen) ---
export const fetchGateBootstrap = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload = {},
}: {
  username: string;
  language?: string;
  payload?: Record<string, any>;
}) =>
  (() => {
    const rid = Math.random().toString(36).slice(2);
    console.log("[TRACE] fetchGateBootstrap called", {
      rid,
      ts: new Date().toISOString(),
      payload,
    });
    console.log("[TRACE] fetchGateBootstrap rid payload", rid, payload);
    console.trace("[TRACE] fetchGateBootstrap stack");
    return postEncrypted(API_ROUTES.admin.getGateBootstrap, {
      api: API_TAGS.GATES_BOOTSTRAP.list,
      username,
      language,
      ...payload,
    });
  })();

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

export const updateOrgMandiStatus = async ({
  username,
  language = DEFAULT_LANGUAGE,
  mapping_id,
  is_active,
}: {
  username: string;
  language?: string;
  mapping_id: string;
  is_active: "Y" | "N";
}) =>
  postEncrypted(API_ROUTES.admin.removeOrgMandi, {
    api: API_TAGS.ORG_MANDI.removeMapping,
    username,
    language,
    mapping_id,
    is_active,
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

// --- Units (master list) ---
export const fetchUnits = async ({
  username,
  language = DEFAULT_LANGUAGE,
}: {
  username: string;
  language?: string;
}) =>
  postEncrypted(API_ROUTES.admin.getUnits, {
    api: API_TAGS.UNITS.list,
    username,
    language,
  });

// --- Mandi commodity products mapping ---
export const fetchMandiCommodityProducts = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getMandiCommodityProducts, {
    api: API_TAGS.MANDI_COMMODITY_PRODUCTS.list,
    api_name: API_TAGS.MANDI_COMMODITY_PRODUCTS.list,
    username,
    language,
    ...filters,
  });

export const createMandiCommodityProduct = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.createMandiCommodityProduct, {
    api: API_TAGS.MANDI_COMMODITY_PRODUCTS.create,
    api_name: API_TAGS.MANDI_COMMODITY_PRODUCTS.create,
    username,
    language,
    ...payload,
  });

export const updateMandiCommodityProduct = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.updateMandiCommodityProduct, {
    api: API_TAGS.MANDI_COMMODITY_PRODUCTS.update,
    username,
    language,
    ...payload,
  });

export const deactivateMandiCommodityProduct = async ({
  username,
  language = DEFAULT_LANGUAGE,
  mapping_id,
  is_active,
}: {
  username: string;
  language?: string;
  mapping_id: string;
  is_active: "Y" | "N";
}) =>
  postEncrypted(API_ROUTES.admin.deactivateMandiCommodityProduct, {
    api: API_TAGS.MANDI_COMMODITY_PRODUCTS.deactivate,
    username,
    language,
    mapping_id,
    is_active,
  });

// --- New org/system mandis (lite) ---
export const fetchOrgMandisLite = async ({
  username,
  language = DEFAULT_LANGUAGE,
  org_id,
  filters = {},
}: {
  username: string;
  language?: string;
  org_id: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getOrgMandis, {
    api: API_TAGS.ORG_MANDIS.orgList,
    username,
    language,
    org_id,
    ...filters,
  });

export const getMandisForCurrentScope = async ({
  username,
  language = DEFAULT_LANGUAGE,
  org_id,
  filters = {},
}: {
  username: string;
  language?: string;
  org_id: string;
  filters?: Record<string, any>;
}) => {
  const resp = await fetchOrgMandisLite({ username, language, org_id, filters });
  const root = resp?.data ?? resp?.response ?? resp ?? {};
  const data = root?.data ?? root;
  return data?.items ?? [];
};

export const fetchSystemMandisByState = async ({
  username,
  language = DEFAULT_LANGUAGE,
  state_code,
  filters = {},
}: {
  username: string;
  language?: string;
  state_code: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getSystemMandisByState, {
    api: API_TAGS.ORG_MANDIS.systemList,
    username,
    language,
    state_code,
    ...filters,
  });

export const importSystemMandisToOrg = async ({
  username,
  language = DEFAULT_LANGUAGE,
  org_id,
  mandi_ids,
}: {
  username: string;
  language?: string;
  org_id: string;
  mandi_ids: number[];
}) =>
  postEncrypted(API_ROUTES.admin.importSystemMandisToOrg, {
    api: API_TAGS.ORG_MANDIS.import,
    username,
    language,
    org_id,
    mandi_ids,
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
    api_name: API_TAGS.FACILITY_MASTERS.list,
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
    api_name: API_TAGS.FACILITY_MASTERS.create,
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
    api_name: API_TAGS.FACILITY_MASTERS.update,
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
    api_name: API_TAGS.FACILITY_MASTERS.deactivate,
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
    api_name: API_TAGS.FACILITIES.list,
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
    api_name: API_TAGS.FACILITIES.create,
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
    api_name: API_TAGS.FACILITIES.update,
    username,
    language,
    ...payload,
  });

export const deactivateMandiFacility = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.deactivateMandiFacility, {
    api: API_TAGS.FACILITIES.deactivate,
    api_name: API_TAGS.FACILITIES.deactivate,
    username,
    language,
    ...payload,
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
  postEncrypted(API_ROUTES.admin.addMandiGate, {
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
  postEncrypted(API_ROUTES.admin.editMandiGate, {
    api: API_TAGS.GATES.update,
    username,
    language,
    ...payload,
  });

export const deactivateMandiGate = async ({
  username,
  language = DEFAULT_LANGUAGE,
  _id,
  is_active,
}: {
  username: string;
  language?: string;
  _id: string;
  is_active?: string;
}) =>
  postEncrypted(API_ROUTES.admin.deactivateMandiGate, {
    api: API_TAGS.GATES.deactivate,
    username,
    language,
    _id,
    ...(is_active ? { is_active } : {}),
  });

// --- Hours templates ---
export const fetchMandiHoursTemplates = async ({
  username,
  language = DEFAULT_LANGUAGE,
  filters = {},
}: {
  username: string;
  language?: string;
  filters?: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.getMandiHoursTemplates, {
    api: API_TAGS.HOURS.list,
    api_name: API_TAGS.HOURS.list,
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
    api_name: API_TAGS.HOURS.create,
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
    api_name: API_TAGS.HOURS.update,
    username,
    language,
    ...payload,
  });

export const deactivateMandiHoursTemplate = async ({
  username,
  language = DEFAULT_LANGUAGE,
  payload,
}: {
  username: string;
  language?: string;
  payload: Record<string, any>;
}) =>
  postEncrypted(API_ROUTES.admin.deactivateMandiHoursTemplate, {
    api: API_TAGS.HOURS.deactivate,
    api_name: API_TAGS.HOURS.deactivate,
    username,
    language,
    ...payload,
  });

//committed on 07-jun 2026 at 8:54 am
// import { postEncrypted } from "./sharedEncryptedRequest";
// import { API_TAGS, API_ROUTES, DEFAULT_LANGUAGE } from "../config/appConfig";

// // --- Mandis ---
// export const fetchMandis = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   filters = {},
// }: {
//   username: string;
//   language?: string;
//   filters?: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.getMandis, {
//     api: API_TAGS.MANDIS.list,
//     username,
//     language,
//     ...filters,
//   });

// export const createMandi = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   payload,
// }: {
//   username: string;
//   language?: string;
//   payload: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.createMandi, {
//     api: API_TAGS.MANDIS.create,
//     username,
//     language,
//     ...payload,
//   });

// export const updateMandi = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   payload,
// }: {
//   username: string;
//   language?: string;
//   payload: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.updateMandi, {
//     api: API_TAGS.MANDIS.update,
//     username,
//     language,
//     ...payload,
//   });

// export const deactivateMandi = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   mandi_id,
// }: {
//   username: string;
//   language?: string;
//   mandi_id: number;
// }) =>
//   postEncrypted(API_ROUTES.admin.deactivateMandi, {
//     api: API_TAGS.MANDIS.deactivate,
//     username,
//     language,
//     mandi_id,
//   });

// // --- Org-Mandi mapping ---
// export const fetchOrgMandiMappings = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   filters = {},
// }: {
//   username: string;
//   language?: string;
//   filters?: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.getOrgMandiMappings, {
//     api: API_TAGS.ORG_MANDI.listMappings,
//     username,
//     language,
//     ...filters,
//   });

// export const addOrgMandi = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   payload,
// }: {
//   username: string;
//   language?: string;
//   payload: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.addOrgMandi, {
//     api: API_TAGS.ORG_MANDI.addMapping,
//     username,
//     language,
//     ...payload,
//   });

// export const removeOrgMandi = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   mapping_id,
// }: {
//   username: string;
//   language?: string;
//   mapping_id: string;
// }) =>
//   postEncrypted(API_ROUTES.admin.removeOrgMandi, {
//     api: API_TAGS.ORG_MANDI.removeMapping,
//     username,
//     language,
//     mapping_id,
//     is_active: "N",
//   });

// export const updateOrgMandiStatus = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   mapping_id,
//   is_active,
// }: {
//   username: string;
//   language?: string;
//   mapping_id: string;
//   is_active: "Y" | "N";
// }) =>
//   postEncrypted(API_ROUTES.admin.removeOrgMandi, {
//     api: API_TAGS.ORG_MANDI.removeMapping,
//     username,
//     language,
//     mapping_id,
//     is_active,
//   });

// // --- Commodities ---
// export const fetchCommodities = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   filters = {},
// }: {
//   username: string;
//   language?: string;
//   filters?: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.getCommodities, {
//     api: API_TAGS.COMMODITIES.list,
//     username,
//     language,
//     ...filters,
//   });

// export const createCommodity = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   payload,
// }: {
//   username: string;
//   language?: string;
//   payload: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.createCommodity, {
//     api: API_TAGS.COMMODITIES.create,
//     username,
//     language,
//     ...payload,
//   });

// export const updateCommodity = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   payload,
// }: {
//   username: string;
//   language?: string;
//   payload: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.updateCommodity, {
//     api: API_TAGS.COMMODITIES.update,
//     username,
//     language,
//     ...payload,
//   });

// export const deactivateCommodity = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   commodity_id,
// }: {
//   username: string;
//   language?: string;
//   commodity_id: number;
// }) =>
//   postEncrypted(API_ROUTES.admin.deactivateCommodity, {
//     api: API_TAGS.COMMODITIES.deactivate,
//     username,
//     language,
//     commodity_id,
//   });

// // --- Commodity products ---
// export const fetchCommodityProducts = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   filters = {},
// }: {
//   username: string;
//   language?: string;
//   filters?: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.getCommodityProducts, {
//     api: API_TAGS.PRODUCTS.list,
//     username,
//     language,
//     ...filters,
//   });

// export const createCommodityProduct = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   payload,
// }: {
//   username: string;
//   language?: string;
//   payload: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.createCommodityProduct, {
//     api: API_TAGS.PRODUCTS.create,
//     username,
//     language,
//     ...payload,
//   });

// export const updateCommodityProduct = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   payload,
// }: {
//   username: string;
//   language?: string;
//   payload: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.updateCommodityProduct, {
//     api: API_TAGS.PRODUCTS.update,
//     username,
//     language,
//     ...payload,
//   });

// export const deactivateCommodityProduct = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   product_id,
//   org_code,
// }: {
//   username: string;
//   language?: string;
//   product_id: number;
//   org_code?: string;
// }) =>
//   postEncrypted(API_ROUTES.admin.deactivateCommodityProduct, {
//     api: API_TAGS.PRODUCTS.deactivate,
//     username,
//     language,
//     product_id,
//     org_code,
//   });

// // --- New org/system mandis (lite) ---
// export const fetchOrgMandisLite = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   org_id,
//   filters = {},
// }: {
//   username: string;
//   language?: string;
//   org_id: string;
//   filters?: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.getOrgMandis, {
//     api: API_TAGS.ORG_MANDIS.orgList,
//     username,
//     language,
//     org_id,
//     ...filters,
//   });

// export const getMandisForCurrentScope = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   org_id,
//   filters = {},
// }: {
//   username: string;
//   language?: string;
//   org_id: string;
//   filters?: Record<string, any>;
// }) => {
//   const resp = await fetchOrgMandisLite({ username, language, org_id, filters });
//   const root = resp?.data ?? resp?.response ?? resp ?? {};
//   const data = root?.data ?? root;
//   return data?.items ?? [];
// };

// export const fetchSystemMandisByState = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   state_code,
//   filters = {},
// }: {
//   username: string;
//   language?: string;
//   state_code: string;
//   filters?: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.getSystemMandisByState, {
//     api: API_TAGS.ORG_MANDIS.systemList,
//     username,
//     language,
//     state_code,
//     ...filters,
//   });

// export const importSystemMandisToOrg = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   org_id,
//   mandi_ids,
// }: {
//   username: string;
//   language?: string;
//   org_id: string;
//   mandi_ids: number[];
// }) =>
//   postEncrypted(API_ROUTES.admin.importSystemMandisToOrg, {
//     api: API_TAGS.ORG_MANDIS.import,
//     username,
//     language,
//     org_id,
//     mandi_ids,
//   });

// // --- Facility masters ---
// export const fetchMandiFacilitiesMasters = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
// }: {
//   username: string;
//   language?: string;
// }) =>
//   postEncrypted(API_ROUTES.admin.getMandiFacilitiesMasters, {
//     api: API_TAGS.FACILITY_MASTERS.list,
//     username,
//     language,
//   });

// export const createMandiFacilityMaster = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   payload,
// }: {
//   username: string;
//   language?: string;
//   payload: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.createMandiFacilityMaster, {
//     api: API_TAGS.FACILITY_MASTERS.create,
//     username,
//     language,
//     ...payload,
//   });

// export const updateMandiFacilityMaster = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   payload,
// }: {
//   username: string;
//   language?: string;
//   payload: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.updateMandiFacilityMaster, {
//     api: API_TAGS.FACILITY_MASTERS.update,
//     username,
//     language,
//     ...payload,
//   });

// export const deactivateMandiFacilityMaster = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   _id,
// }: {
//   username: string;
//   language?: string;
//   _id: string;
// }) =>
//   postEncrypted(API_ROUTES.admin.deactivateMandiFacilityMaster, {
//     api: API_TAGS.FACILITY_MASTERS.deactivate,
//     username,
//     language,
//     _id,
//   });

// // --- Facilities ---
// export const fetchMandiFacilities = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   filters = {},
// }: {
//   username: string;
//   language?: string;
//   filters?: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.getMandiFacilities, {
//     api: API_TAGS.FACILITIES.list,
//     username,
//     language,
//     ...filters,
//   });

// export const createMandiFacility = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   payload,
// }: {
//   username: string;
//   language?: string;
//   payload: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.createMandiFacility, {
//     api: API_TAGS.FACILITIES.create,
//     username,
//     language,
//     ...payload,
//   });

// export const updateMandiFacility = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   payload,
// }: {
//   username: string;
//   language?: string;
//   payload: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.updateMandiFacility, {
//     api: API_TAGS.FACILITIES.update,
//     username,
//     language,
//     ...payload,
//   });

// export const deactivateMandiFacility = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   _id,
// }: {
//   username: string;
//   language?: string;
//   _id: string;
// }) =>
//   postEncrypted(API_ROUTES.admin.deactivateMandiFacility, {
//     api: API_TAGS.FACILITIES.deactivate,
//     username,
//     language,
//     _id,
//   });

// // --- Gates ---
// export const fetchMandiGates = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   filters = {},
// }: {
//   username: string;
//   language?: string;
//   filters?: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.getMandiGates, {
//     api: API_TAGS.GATES.list,
//     username,
//     language,
//     ...filters,
//   });

// export const createMandiGate = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   payload,
// }: {
//   username: string;
//   language?: string;
//   payload: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.addMandiGate, {
//     api: API_TAGS.GATES.create,
//     username,
//     language,
//     ...payload,
//   });

// export const updateMandiGate = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   payload,
// }: {
//   username: string;
//   language?: string;
//   payload: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.editMandiGate, {
//     api: API_TAGS.GATES.update,
//     username,
//     language,
//     ...payload,
//   });

// export const deactivateMandiGate = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   _id,
//   is_active,
// }: {
//   username: string;
//   language?: string;
//   _id: string;
//   is_active?: string;
// }) =>
//   postEncrypted(API_ROUTES.admin.deactivateMandiGate, {
//     api: API_TAGS.GATES.deactivate,
//     username,
//     language,
//     _id,
//     ...(is_active ? { is_active } : {}),
//   });

// // --- Hours templates ---
// export const fetchMandiHoursMasters = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   filters = {},
// }: {
//   username: string;
//   language?: string;
//   filters?: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.getMandiHoursMasters, {
//     api: API_TAGS.HOURS.list,
//     username,
//     language,
//     ...filters,
//   });

// export const createMandiHoursTemplate = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   payload,
// }: {
//   username: string;
//   language?: string;
//   payload: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.createMandiHoursTemplate, {
//     api: API_TAGS.HOURS.create,
//     username,
//     language,
//     ...payload,
//   });

// export const updateMandiHoursTemplate = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   payload,
// }: {
//   username: string;
//   language?: string;
//   payload: Record<string, any>;
// }) =>
//   postEncrypted(API_ROUTES.admin.updateMandiHoursTemplate, {
//     api: API_TAGS.HOURS.update,
//     username,
//     language,
//     ...payload,
//   });

// export const deactivateMandiHoursTemplate = async ({
//   username,
//   language = DEFAULT_LANGUAGE,
//   _id,
// }: {
//   username: string;
//   language?: string;
//   _id: string;
// }) =>
//   postEncrypted(API_ROUTES.admin.deactivateMandiHoursTemplate, {
//     api: API_TAGS.HOURS.deactivate,
//     username,
//     language,
//     _id,
//   });
