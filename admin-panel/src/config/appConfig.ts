// Prefer explicit API origin; fallback to env or relative /api for local dev
// Keep /api suffix so route fragments map correctly (e.g., /auth/loginUser -> /api/auth/loginUser)
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "https://mandiapi.ciberdukaan.com/api" || "/api";


export const API_TAGS = {
  ORGS: {
    list: "get_Organisations21",
    create: "create_Organisation22",
    update: "update_Organisation23",
  },
  ADMIN_USERS: {
    list: "getAdminUsers",
    create: "createAdminUser",
    update: "updateAdminUser",
    deactivate: "deactivateAdminUser",
    reset: "resetAdminUserPassword",
    listRoles: "getAdminRoles",
    listOrgs: "get_Organisations21",
  },
  ORG_MANDI: {
    listMappings: "get_Org_Mandi_Mappings24",
    createMapping: "create_Org_Mandi_Mapping25",
    updateMapping: "update_Org_Mandi_Mapping26",
    addMapping: "add_Org_Mandi27",
    removeMapping: "remove_Org_Mandi28",
    coverage: "get_Mandi_Coverage19",
    getMandis: "get_Mandis18",
  },
  MANDIS: {
    list: "getMandis",
    create: "createMandi",
    update: "updateMandi",
    deactivate: "deactivateMandi",
  },
  COMMODITIES: {
    list: "getCommodities",
    create: "createCommodity",
    update: "updateCommodity",
    deactivate: "deactivateCommodity",
  },
  PRODUCTS: {
    list: "getCommodityProducts",
    create: "createCommodityProduct",
    update: "updateCommodityProduct",
    deactivate: "deactivateCommodityProduct",
  },
  FACILITY_MASTERS: {
    list: "getMandiFacilitiesMasters",
    create: "createMandiFacilityMaster",
    update: "updateMandiFacilityMaster",
    deactivate: "deactivateMandiFacilityMaster",
  },
  FACILITIES: {
    list: "getMandiFacilities",
    create: "createMandiFacility",
    update: "updateMandiFacility",
    deactivate: "deactivateMandiFacility",
  },
  GATES: {
    list: "getMandiGates",
    create: "createMandiGate",
    update: "updateMandiGate",
    deactivate: "deactivateMandiGate",
  },
  HOURS: {
    list: "getMandiHoursMasters",
    create: "createMandiHoursTemplate",
    update: "updateMandiHoursTemplate",
    deactivate: "deactivateMandiHoursTemplate",
  },
  AUTH: {
    loginApiTag: "loginusr_Api",
  },
  ADMIN_UI_CONFIG: {
    getAdminUiConfig: "get_Admin_Ui_Config27",
  },
};

export const DEFAULT_LANGUAGE = "en";
export const DEFAULT_COUNTRY = "IN";

export const API_ROUTES = {
  auth: {
    login: "/auth/loginUser",
  },
  admin: {
    getOrganisations: "/admin/getOrganisations",
    createOrganisation: "/admin/createOrganisation",
    updateOrganisation: "/admin/updateOrganisation",
    getAdminUsers: "/admin/getAdminUsers",
    createAdminUser: "/admin/createAdminUser",
    updateAdminUser: "/admin/updateAdminUser",
    deactivateAdminUser: "/admin/deactivateAdminUser",
    resetAdminUserPassword: "/admin/resetAdminUserPassword",
    getAdminRoles: "/admin/getAdminRoles",
    getOrgMandiMappings: "/admin/getOrgMandiMappings",
    createOrgMandiMapping: "/admin/createOrgMandiMapping",
    updateOrgMandiMapping: "/admin/updateOrgMandiMapping",
    addOrgMandi: "/admin/addOrgMandi",
    removeOrgMandi: "/admin/removeOrgMandi",
    getMandis: "/admin/getMandis",
    createMandi: "/admin/createMandi",
    updateMandi: "/admin/updateMandi",
    deactivateMandi: "/admin/deactivateMandi",
    getCommodities: "/admin/getCommodities",
    createCommodity: "/admin/createCommodity",
    updateCommodity: "/admin/updateCommodity",
    deactivateCommodity: "/admin/deactivateCommodity",
    getCommodityProducts: "/admin/getCommodityProducts",
    createCommodityProduct: "/admin/createCommodityProduct",
    updateCommodityProduct: "/admin/updateCommodityProduct",
    deactivateCommodityProduct: "/admin/deactivateCommodityProduct",
    getMandiFacilitiesMasters: "/admin/getMandiFacilitiesMasters",
    createMandiFacilityMaster: "/admin/createMandiFacilityMaster",
    updateMandiFacilityMaster: "/admin/updateMandiFacilityMaster",
    deactivateMandiFacilityMaster: "/admin/deactivateMandiFacilityMaster",
    getMandiFacilities: "/admin/getMandiFacilities",
    createMandiFacility: "/admin/createMandiFacility",
    updateMandiFacility: "/admin/updateMandiFacility",
    deactivateMandiFacility: "/admin/deactivateMandiFacility",
    getMandiGates: "/admin/getMandiGates",
    createMandiGate: "/admin/createMandiGate",
    updateMandiGate: "/admin/updateMandiGate",
    deactivateMandiGate: "/admin/deactivateMandiGate",
    getMandiHoursMasters: "/admin/getMandiHoursMasters",
    createMandiHoursTemplate: "/admin/createMandiHoursTemplate",
    updateMandiHoursTemplate: "/admin/updateMandiHoursTemplate",
    deactivateMandiHoursTemplate: "/admin/deactivateMandiHoursTemplate",
    getAdminUiConfig: "/admin/getAdminUiConfig",
  },
  masters: {
    getMandiCoverage: "/masters/getMandiCoverage",
    getMandis: "/masters/getMandis",
  },
};

export const BRAND_COLORS = {
  primary: "#2FA652",
  primaryDark: "#1B6B3D",
};

// export const BRAND_ASSETS = {
//   // Resolve relative to Vite base (/admin/) so it serves from the admin bundle
//   logo: `${import.meta.env.BASE_URL}/assets/logo_transparent.png`,
// };

export const BRAND_ASSETS = { logo: "/admin/logo_transparent.png" };


export const COLLECTIONS = {
  adminUsers: "cm_admin_users",
  userRoles: "cm_user_roles",
  orgs: "cm_orgs",
  orgMandis: "cm_org_mandis",
};

export const APP_STRINGS = {
  title: "CiberMandi",
  tagline: "Super Admin Console",
};
