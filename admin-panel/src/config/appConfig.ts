// export const API_BASE_URL = "/api";
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";


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
    login: "/auth/loginUser",
  },
  admin: {
    getOrganisations: "/admin/getOrganisations",
    createOrganisation: "/admin/createOrganisation",
    updateOrganisation: "/admin/updateOrganisation",
    getAdminUsers: "/admin/getAdminUsers",
    createAdminUser: "/admin/createAdminUser",
    updateAdminUser: "/admin/updateAdminUser",
    resetAdminUserPassword: "/admin/resetAdminUserPassword",
    getAdminRoles: "/admin/getAdminRoles",
    getOrgMandiMappings: "/admin/getOrgMandiMappings",
    createOrgMandiMapping: "/admin/createOrgMandiMapping",
    updateOrgMandiMapping: "/admin/updateOrgMandiMapping",
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

export const BRAND_ASSETS = {
  // Resolve relative to Vite base (/admin/) so it serves from the admin bundle
  logo: `${import.meta.env.BASE_URL}logo_transparent.png`,
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
