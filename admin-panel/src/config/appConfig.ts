export const API_BASE_URL = "https://mandiapi.ciberdukaan.com";

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
    reset: "resetAdminUserPassword",
    listRoles: "getAdminRoles",
    listOrgs: "get_Organisations21",
  },
  ORG_MANDI: {
    listMappings: "get_Org_Mandi_Mappings24",
    createMapping: "create_Org_Mandi_Mapping25",
    updateMapping: "update_Org_Mandi_Mapping26",
    coverage: "get_Mandi_Coverage19",
    getMandis: "get_Mandis18",
  },
  AUTH: {
    loginApiTag: "loginusr_Api",
  },
};

export const DEFAULT_LANGUAGE = "en";
export const DEFAULT_COUNTRY = "IN";

export const API_ROUTES = {
  auth: {
    login: "/api/auth/loginUser",
  },
  admin: {
    getOrganisations: "/api/admin/getOrganisations",
    createOrganisation: "/api/admin/createOrganisation",
    updateOrganisation: "/api/admin/updateOrganisation",
    getAdminUsers: "/api/admin/getAdminUsers",
    createAdminUser: "/api/admin/createAdminUser",
    updateAdminUser: "/api/admin/updateAdminUser",
    resetAdminUserPassword: "/api/admin/resetAdminUserPassword",
    getAdminRoles: "/api/admin/getAdminRoles",
    getOrgMandiMappings: "/api/admin/getOrgMandiMappings",
    createOrgMandiMapping: "/api/admin/createOrgMandiMapping",
    updateOrgMandiMapping: "/api/admin/updateOrgMandiMapping",
  },
  masters: {
    getMandiCoverage: "/api/masters/getMandiCoverage",
    getMandis: "/api/masters/getMandis",
  },
};

export const BRAND_COLORS = {
  primary: "#2FA652",
  primaryDark: "#1B6B3D",
};

export const BRAND_ASSETS = {
  logo: "/logo_transparent.png",
};

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
