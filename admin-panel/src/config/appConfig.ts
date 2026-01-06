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
    resetRequest: "requestAdminPasswordReset",
    resetConfirm: "confirmAdminPasswordReset",
    testEmail: "testEmail",
    listRoles: "getAdminRoles",
    listOrgs: "get_Organisations21",
  },
  ADMIN_2FA: {
    requireStepUp: "requireStepUp",
    getSetup: "getSetup",
    enable: "enable",
    verifyStepUp: "verifyStepUp",
    rotate: "rotate",
    getStatus: "getStatus"
  },
  STEPUP_POLICY: {
    list: "getStepupPolicyRules",
    save: "saveStepupPolicyRule",
    getScreens: "getStepupPolicyScreens",
    saveSelection: "saveStepupPolicySelection",
  },
  SECURITY_SWITCH: {
    get: "getSecuritySwitches",
    update: "updateSecuritySwitches",
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
  MASTERS: {
    getStatesDistricts: "get_States_Districts17",
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
    create: "addMandiGate",
    update: "editMandiGate",
    deactivate: "deactivateMandiGate",
  },
  GATES_BOOTSTRAP: {
    list: "getGateBootstrap",
  },
  GATE_DEVICES_BOOTSTRAP: {
    list: "getGateDevicesBootstrap",
  },
  HOURS: {
    list: "getMandiHoursMasters",
    create: "createMandiHoursTemplate",
    update: "updateMandiHoursTemplate",
    deactivate: "deactivateMandiHoursTemplate",
  },
  AUCTION_METHODS: {
    list: "getAuctionMethods",
    create: "createAuctionMethod",
    update: "updateAuctionMethod",
    deactivate: "deactivateAuctionMethod",
  },
  AUCTION_ROUNDS: {
    list: "getAuctionRounds",
    create: "createAuctionRound",
    update: "updateAuctionRound",
    deactivate: "deactivateAuctionRound",
  },
  AUCTION_POLICIES: {
    list: "getMandiAuctionPolicies",
    create: "createMandiAuctionPolicy",
    update: "updateMandiAuctionPolicy",
    deactivate: "deactivateMandiAuctionPolicy",
  },
  AUCTION_OPS: {
    SESSIONS: {
      list: "getAuctionSessions",
    },
    LOTS: {
      list: "getAuctionLots",
    },
    RESULTS: {
      list: "getAuctionResults",
    },
  },
  TRADER_APPROVALS: {
    list: "getTraderApprovals",
    detail: "getTraderApprovalDetail",
    approve: "approveTrader",
    reject: "rejectTrader",
    requestMoreInfo: "requestMoreInfoTrader",
  },
  PARTY_MASTERS: {
    traders: {
      list: "getTraders",
      update: "updateTraderStatus",
    },
    farmers: {
      list: "getFarmers",
      update: "updateFarmerStatus",
    },
  },
  GATE_ENTRY_REASONS: {
    list: "getGateEntryReasons",
    create: "createGateEntryReason",
    update: "updateGateEntryReason",
    deactivate: "deactivateGateEntryReason",
  },
  GATE_VEHICLE_TYPES: {
    list: "getGateVehicleTypes",
    create: "createGateVehicleType",
    update: "updateGateVehicleType",
    deactivate: "deactivateGateVehicleType",
  },
  GATE_DEVICES: {
    list: "getGateDevices",
    create: "createGateDevice",
    update: "updateGateDevice",
    deactivate: "deactivateGateDevice",
  },
  GATE_DEVICE_CONFIGS: {
    list: "getGateDeviceConfigs",
    create: "createGateDeviceConfig",
    update: "updateGateDeviceConfig",
    deactivate: "deactivateGateDeviceConfig",
    mandisWithGates: "getMandisWithGatesSummary",
  },
  ORG_MANDIS: {
    systemList: "getSystemMandisByState",
    import: "importSystemMandisToOrg",
    orgList: "getOrgMandis",
  },
  ROLE_POLICIES: {
    dashboard: "getRolePoliciesDashboardData",
    update: "updateRolePolicies",
  },
  RESOURCE_REGISTRY: {
    list: "getResourceRegistry",
    update: "updateResourceRegistry",
  },
  ADMIN_USER_ROLES: {
    list: "get_Admin_Users_With_Roles120",
    assign: "assignUserRole",
    deactivate: "deactivateUserRole",
  },
  GATE_PASS_TOKENS: {
    list: "getGatePassTokens",
  },
  GATE_ENTRY_TOKENS: {
    list: "getGateEntryTokens",
  },
  GATE_MOVEMENTS: {
    list: "getGateMovements",
  },
  WEIGHMENT_TICKETS: {
    list: "getWeighmentTickets",
  },
  PAYMENT_CONFIG: {
    getPaymentModels: "getPaymentModels",
    upsertPaymentModel: "upsertPaymentModel",
    getOrgPaymentSettings: "getOrgPaymentSettings",
    updateOrgPaymentSettings: "updateOrgPaymentSettings",
    getMandiPaymentSettings: "getMandiPaymentSettings",
    updateMandiPaymentSettings: "updateMandiPaymentSettings",
    getCommodityPaymentSettings: "getCommodityPaymentSettings",
    upsertCommodityPaymentSettings: "upsertCommodityPaymentSettings",
    getPaymentModeRules: "getPaymentModeRules",
    upsertPaymentModeRules: "upsertPaymentModeRules",
    getCustomFeeTemplates: "getCustomFeeTemplates",
    upsertCustomFeeTemplate: "upsertCustomFeeTemplate",
    getRoleCustomFees: "getRoleCustomFees",
    upsertRoleCustomFee: "upsertRoleCustomFee",
    previewEffectiveFees: "previewEffectiveFees",
  },
  SUBSCRIPTIONS: {
    getSubscriptions: "getSubscriptions",
    upsertSubscription: "upsertSubscription",
    getSubscriptionInvoices: "getSubscriptionInvoices",
    getSubscriptionInvoiceDetail: "getSubscriptionInvoiceDetail",
    recordSubscriptionPayment: "recordSubscriptionPayment",
  },
  SETTLEMENTS: {
    getSettlements: "getSettlements",
    getSettlementDetail: "getSettlementDetail",
  },
  PAYMENTS_LOG: {
    getPaymentsLog: "getPaymentsLog",
    getPaymentDetail: "getPaymentDetail",
  },
  DASHBOARD: {
    getDashboardSummary: "getDashboardSummary",
  },
  AUTH: {
    loginApiTag: "loginusr_Api",
  },
  ADMIN_UI_CONFIG: {
    getAdminUiConfig: "get_Admin_Ui_Config27",
  },
} as const;

export const DEFAULT_LANGUAGE = "en";
export const DEFAULT_COUNTRY = "IN";

const PAYMENT_CONFIG_ROUTES = {
  getPaymentModels: "/admin/getPaymentModels",
  upsertPaymentModel: "/admin/upsertPaymentModel",
  getOrgPaymentSettings: "/admin/getOrgPaymentSettings",
  updateOrgPaymentSettings: "/admin/updateOrgPaymentSettings",
  getMandiPaymentSettings: "/admin/getMandiPaymentSettings",
  updateMandiPaymentSettings: "/admin/updateMandiPaymentSettings",
  getCommodityPaymentSettings: "/admin/getCommodityPaymentSettings",
  upsertCommodityPaymentSettings: "/admin/upsertCommodityPaymentSettings",
  getPaymentModeRules: "/admin/getPaymentModeRules",
  upsertPaymentModeRules: "/admin/upsertPaymentModeRules",
  getCustomFeeTemplates: "/admin/getCustomFeeTemplates",
  upsertCustomFeeTemplate: "/admin/upsertCustomFeeTemplate",
  getRoleCustomFees: "/admin/getRoleCustomFees",
  upsertRoleCustomFee: "/admin/upsertRoleCustomFee",
  previewEffectiveFees: "/admin/previewEffectiveFees",
} as const;


const SUBSCRIPTION_ROUTES = {
  getSubscriptions: "/admin/getSubscriptions",
  upsertSubscription: "/admin/upsertSubscription",
  getSubscriptionInvoices: "/admin/getSubscriptionInvoices",
  getSubscriptionInvoiceDetail: "/admin/getSubscriptionInvoiceDetail",
  recordSubscriptionPayment: "/admin/recordSubscriptionPayment",
} as const;

const SETTLEMENT_ROUTES = {
  getSettlements: "/admin/getSettlements",
  getSettlementDetail: "/admin/getSettlementDetail",
} as const;

const PAYMENTS_LOG_ROUTES = {
  getPaymentsLog: "/admin/getPaymentsLog",
  getPaymentDetail: "/admin/getPaymentDetail",
} as const;

const DASHBOARD_ROUTES = {
  getDashboardSummary: "/admin/dashboard",
} as const;

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
    requestAdminPasswordReset: "/admin/requestAdminPasswordReset",
    confirmAdminPasswordReset: "/admin/confirmAdminPasswordReset",
    getAdminRoles: "/admin/getAdminRoles",
    getStepupPolicyRules: "/admin/security/getStepupPolicyRules",
    saveStepupPolicyRule: "/admin/security/saveStepupPolicyRule",
    getStepupPolicyScreens: "/admin/security/getStepupPolicyScreens",
    saveStepupPolicySelection: "/admin/security/saveStepupPolicySelection",
    getSecuritySwitches: "/admin/security/getSecuritySwitches",
    updateSecuritySwitches: "/admin/security/updateSecuritySwitches",
    getOrgMandiMappings: "/admin/getOrgMandiMappings",
    createOrgMandiMapping: "/admin/createOrgMandiMapping",
    updateOrgMandiMapping: "/admin/updateOrgMandiMapping",
    addOrgMandi: "/admin/addOrgMandi",
    removeOrgMandi: "/admin/removeOrgMandi",
    requireStepUp: "/admin/2fa/requireStepUp",
    get2faSetup: "/admin/2fa/getSetup",
    enable: "/admin/2fa/enable",
    verifyStepUp: "/admin/2fa/verifyStepUp",
    rotate: "/admin/2fa/rotate",
    getStatus: "/admin/2fa/getStatus",
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
    addMandiGate: "/admin/addMandiGate",
    editMandiGate: "/admin/editMandiGate",
    deactivateMandiGate: "/admin/mandi-gates/toggle-active",
    getMandisWithGatesSummary: "/admin/getMandisWithGatesSummary",
    // Gates screen bootstrap (ORG scoped)
    getGateBootstrap: "/admin/gates/getGateBootstrap",
    // Gate Devices screen bootstrap (ORG scoped)
    getGateDevicesBootstrap: "/admin/gates/getGateDevicesBootstrap",
    // Backward-compatible alias
    getGateScreenBootstrap: "/admin/gates/getGateScreenBootstrap",
    getMandiHoursMasters: "/admin/getMandiHoursMasters",
    createMandiHoursTemplate: "/admin/createMandiHoursTemplate",
    updateMandiHoursTemplate: "/admin/updateMandiHoursTemplate",
    deactivateMandiHoursTemplate: "/admin/deactivateMandiHoursTemplate",
    getAuctionMethods: "/admin/getAuctionMethods",
    createAuctionMethod: "/admin/createAuctionMethod",
    updateAuctionMethod: "/admin/updateAuctionMethod",
    deactivateAuctionMethod: "/admin/deactivateAuctionMethod",
    getAuctionRounds: "/admin/getAuctionRounds",
    createAuctionRound: "/admin/createAuctionRound",
    updateAuctionRound: "/admin/updateAuctionRound",
    deactivateAuctionRound: "/admin/deactivateAuctionRound",
    getMandiAuctionPolicies: "/admin/getMandiAuctionPolicies",
    createMandiAuctionPolicy: "/admin/createMandiAuctionPolicy",
    updateMandiAuctionPolicy: "/admin/updateMandiAuctionPolicy",
    deactivateMandiAuctionPolicy: "/admin/deactivateMandiAuctionPolicy",
    getTraderApprovals: "/admin/getTraderApprovals",
    getTraderApprovalDetail: "/admin/getTraderApprovalDetail",
    approveTrader: "/admin/approveTrader",
    rejectTrader: "/admin/rejectTrader",
    requestMoreInfoTrader: "/admin/requestMoreInfoTrader",
    getGateEntryReasons: "/admin/getGateEntryReasons",
    createGateEntryReason: "/admin/createGateEntryReason",
    updateGateEntryReason: "/admin/updateGateEntryReason",
    deactivateGateEntryReason: "/admin/deactivateGateEntryReason",
    getGateVehicleTypes: "/admin/getGateVehicleTypes",
    createGateVehicleType: "/admin/createGateVehicleType",
    updateGateVehicleType: "/admin/updateGateVehicleType",
    deactivateGateVehicleType: "/admin/deactivateGateVehicleType",
    getGateDevices: "/admin/getGateDevices",
    createGateDevice: "/admin/createGateDevice",
    updateGateDevice: "/admin/updateGateDevice",
    deactivateGateDevice: "/admin/deactivateGateDevice",
    getGateDeviceConfigs: "/admin/getGateDeviceConfigs",
    createGateDeviceConfig: "/admin/createGateDeviceConfig",
    updateGateDeviceConfig: "/admin/updateGateDeviceConfig",
    deactivateGateDeviceConfig: "/admin/deactivateGateDeviceConfig",
    getRolePoliciesDashboardData: "/admin/getRolePoliciesDashboardData",
    updateRolePolicies: "/admin/updateRolePolicies",
    getResourceRegistry: "/admin/getResourceRegistry",
    updateResourceRegistry: "/admin/updateResourceRegistry",
    getAdminUsersWithRoles: "/admin/getAdminUsersWithRoles",
    assignUserRole: "/admin/assignUserRole",
    deactivateUserRole: "/admin/deactivateUserRole",
    getGatePassTokens: "/admin/getGatePassTokens",
    getGateEntryTokens: "/admin/getGateEntryTokens",
    getGateMovements: "/admin/getGateMovements",
    getWeighmentTickets: "/admin/getWeighmentTickets",
    getAdminUiConfig: "/admin/getAdminUiConfig",
    getTraders: "/admin/getTraders",
    updateTraderStatus: "/admin/updateTraderStatus",
    getFarmers: "/admin/getFarmers",
    updateFarmerStatus: "/admin/updateFarmerStatus",
    getAuctionSessions: "/admin/getAuctionSessions",
    getAuctionLots: "/admin/getAuctionLots",
    getAuctionResults: "/admin/getAuctionResults",
    getSystemMandisByState: "/admin/getSystemMandisByState",
    importSystemMandisToOrg: "/admin/importSystemMandisToOrg",
    getOrgMandis: "/admin/getOrgMandis",
    ...SUBSCRIPTION_ROUTES,
    ...SETTLEMENT_ROUTES,
    ...PAYMENTS_LOG_ROUTES,
    ...DASHBOARD_ROUTES,
    paymentConfig: PAYMENT_CONFIG_ROUTES,
    ...PAYMENT_CONFIG_ROUTES,
  },
  masters: {
    getMandiCoverage: "/masters/getMandiCoverage",
    getMandis: "/masters/getMandis",
    getStatesDistricts: "/masters/getStatesDistricts",
  },
} as const;

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


// // Prefer explicit API origin; fallback to env or relative /api for local dev
// // Keep /api suffix so route fragments map correctly (e.g., /auth/loginUser -> /api/auth/loginUser)
// export const API_BASE_URL =
//   import.meta.env.VITE_API_BASE_URL || "https://mandiapi.ciberdukaan.com/api" || "/api";


// export const API_TAGS = {
//   ORGS: {
//     list: "get_Organisations21",
//     create: "create_Organisation22",
//     update: "update_Organisation23",
//   },

//   ADMIN_USERS: {
//     list: "getAdminUsers",
//     create: "createAdminUser",
//     update: "updateAdminUser",
//     deactivate: "deactivateAdminUser",
//     reset: "resetAdminUserPassword",
//     resetRequest: "requestAdminPasswordReset",
//     resetConfirm: "confirmAdminPasswordReset",
//     testEmail: "testEmail",
//     listRoles: "getAdminRoles",
//     listOrgs: "get_Organisations21",
//   },
//   ADMIN_2FA: {
//     requireStepUp: "requireStepUp",
//     getSetup: "getSetup",
//     enable: "enable",
//     verifyStepUp: "verifyStepUp",
//     rotate: "rotate",
//     getStatus: "getStatus"
//   },
//   STEPUP_POLICY: {
//     list: "getStepupPolicyRules",
//     save: "saveStepupPolicyRule",
//     getScreens: "getStepupPolicyScreens",
//     saveSelection: "saveStepupPolicySelection",
//   },
//   SECURITY_SWITCH: {
//     get: "getSecuritySwitches",
//     update: "updateSecuritySwitches",
//   },
//   ORG_MANDI: {
//     listMappings: "get_Org_Mandi_Mappings24",
//     createMapping: "create_Org_Mandi_Mapping25",
//     updateMapping: "update_Org_Mandi_Mapping26",
//     addMapping: "add_Org_Mandi27",
//     removeMapping: "remove_Org_Mandi28",
//     coverage: "get_Mandi_Coverage19",
//     getMandis: "get_Mandis18",
//   },
//   MANDIS: {
//     list: "getMandis",
//     create: "createMandi",
//     update: "updateMandi",
//     deactivate: "deactivateMandi",
//   },
//   MASTERS: {
//     getStatesDistricts: "get_States_Districts17",
//   },
//   COMMODITIES: {
//     list: "getCommodities",
//     create: "createCommodity",
//     update: "updateCommodity",
//     deactivate: "deactivateCommodity",
//   },
//   PRODUCTS: {
//     list: "getCommodityProducts",
//     create: "createCommodityProduct",
//     update: "updateCommodityProduct",
//     deactivate: "deactivateCommodityProduct",
//   },
//   FACILITY_MASTERS: {
//     list: "getMandiFacilitiesMasters",
//     create: "createMandiFacilityMaster",
//     update: "updateMandiFacilityMaster",
//     deactivate: "deactivateMandiFacilityMaster",
//   },
//   FACILITIES: {
//     list: "getMandiFacilities",
//     create: "createMandiFacility",
//     update: "updateMandiFacility",
//     deactivate: "deactivateMandiFacility",
//   },
//   GATES: {
//     list: "getMandiGates",
//     create: "addMandiGate",
//     update: "editMandiGate",
//     deactivate: "deactivateMandiGate",
//   },
//   GATES_BOOTSTRAP: {
//     list: "getGateBootstrap",
//   },
//   HOURS: {
//     list: "getMandiHoursMasters",
//     create: "createMandiHoursTemplate",
//     update: "updateMandiHoursTemplate",
//     deactivate: "deactivateMandiHoursTemplate",
//   },
//   AUCTION_METHODS: {
//     list: "getAuctionMethods",
//     create: "createAuctionMethod",
//     update: "updateAuctionMethod",
//     deactivate: "deactivateAuctionMethod",
//   },
//   AUCTION_ROUNDS: {
//     list: "getAuctionRounds",
//     create: "createAuctionRound",
//     update: "updateAuctionRound",
//     deactivate: "deactivateAuctionRound",
//   },
//   AUCTION_POLICIES: {
//     list: "getMandiAuctionPolicies",
//     create: "createMandiAuctionPolicy",
//     update: "updateMandiAuctionPolicy",
//     deactivate: "deactivateMandiAuctionPolicy",
//   },
//   AUCTION_OPS: {
//     SESSIONS: {
//       list: "getAuctionSessions",
//     },
//     LOTS: {
//       list: "getAuctionLots",
//     },
//     RESULTS: {
//       list: "getAuctionResults",
//     },
//   },
//   TRADER_APPROVALS: {
//     list: "getTraderApprovals",
//     detail: "getTraderApprovalDetail",
//     approve: "approveTrader",
//     reject: "rejectTrader",
//     requestMoreInfo: "requestMoreInfoTrader",
//   },
//   PARTY_MASTERS: {
//     traders: {
//       list: "getTraders",
//       update: "updateTraderStatus",
//     },
//     farmers: {
//       list: "getFarmers",
//       update: "updateFarmerStatus",
//     },
//   },
//   GATE_ENTRY_REASONS: {
//     list: "getGateEntryReasons",
//     create: "createGateEntryReason",
//     update: "updateGateEntryReason",
//     deactivate: "deactivateGateEntryReason",
//   },
//   GATE_VEHICLE_TYPES: {
//     list: "getGateVehicleTypes",
//     create: "createGateVehicleType",
//     update: "updateGateVehicleType",
//     deactivate: "deactivateGateVehicleType",
//   },
//   GATE_DEVICES: {
//     list: "getGateDevices",
//     create: "createGateDevice",
//     update: "updateGateDevice",
//     deactivate: "deactivateGateDevice",
//   },
//   GATE_DEVICE_CONFIGS: {
//     list: "getGateDeviceConfigs",
//     create: "createGateDeviceConfig",
//     update: "updateGateDeviceConfig",
//     deactivate: "deactivateGateDeviceConfig",
//     mandisWithGates: "getMandisWithGatesSummary",
//   },
//   ORG_MANDIS: {
//     systemList: "getSystemMandisByState",
//     import: "importSystemMandisToOrg",
//     orgList: "getOrgMandis",
//   },
//   ROLE_POLICIES: {
//     dashboard: "getRolePoliciesDashboardData",
//     update: "updateRolePolicies",
//   },
//   RESOURCE_REGISTRY: {
//     list: "getResourceRegistry",
//     update: "updateResourceRegistry",
//   },
//   ADMIN_USER_ROLES: {
//     list: "get_Admin_Users_With_Roles120",
//     assign: "assignUserRole",
//     deactivate: "deactivateUserRole",
//   },
//   GATE_PASS_TOKENS: {
//     list: "getGatePassTokens",
//   },
//   GATE_ENTRY_TOKENS: {
//     list: "getGateEntryTokens",
//   },
//   GATE_MOVEMENTS: {
//     list: "getGateMovements",
//   },
//   WEIGHMENT_TICKETS: {
//     list: "getWeighmentTickets",
//   },
//   PAYMENT_CONFIG: {
//     getPaymentModels: "getPaymentModels",
//     upsertPaymentModel: "upsertPaymentModel",
//     getOrgPaymentSettings: "getOrgPaymentSettings",
//     updateOrgPaymentSettings: "updateOrgPaymentSettings",
//     getMandiPaymentSettings: "getMandiPaymentSettings",
//     updateMandiPaymentSettings: "updateMandiPaymentSettings",
//     getCommodityPaymentSettings: "getCommodityPaymentSettings",
//     upsertCommodityPaymentSettings: "upsertCommodityPaymentSettings",
//     getPaymentModeRules: "getPaymentModeRules",
//     upsertPaymentModeRules: "upsertPaymentModeRules",
//     getCustomFeeTemplates: "getCustomFeeTemplates",
//     upsertCustomFeeTemplate: "upsertCustomFeeTemplate",
//     getRoleCustomFees: "getRoleCustomFees",
//     upsertRoleCustomFee: "upsertRoleCustomFee",
//     previewEffectiveFees: "previewEffectiveFees",
//   },
//   SUBSCRIPTIONS: {
//     getSubscriptions: "getSubscriptions",
//     upsertSubscription: "upsertSubscription",
//     getSubscriptionInvoices: "getSubscriptionInvoices",
//     getSubscriptionInvoiceDetail: "getSubscriptionInvoiceDetail",
//     recordSubscriptionPayment: "recordSubscriptionPayment",
//   },
//   SETTLEMENTS: {
//     getSettlements: "getSettlements",
//     getSettlementDetail: "getSettlementDetail",
//   },
//   PAYMENTS_LOG: {
//     getPaymentsLog: "getPaymentsLog",
//     getPaymentDetail: "getPaymentDetail",
//   },
//   DASHBOARD: {
//     getDashboardSummary: "getDashboardSummary",
//   },
//   AUTH: {
//     loginApiTag: "loginusr_Api",
//   },
//   ADMIN_UI_CONFIG: {
//     getAdminUiConfig: "get_Admin_Ui_Config27",
//   },
// } as const;

// export const DEFAULT_LANGUAGE = "en";
// export const DEFAULT_COUNTRY = "IN";

// const PAYMENT_CONFIG_ROUTES = {
//   getPaymentModels: "/admin/getPaymentModels",
//   upsertPaymentModel: "/admin/upsertPaymentModel",
//   getOrgPaymentSettings: "/admin/getOrgPaymentSettings",
//   updateOrgPaymentSettings: "/admin/updateOrgPaymentSettings",
//   getMandiPaymentSettings: "/admin/getMandiPaymentSettings",
//   updateMandiPaymentSettings: "/admin/updateMandiPaymentSettings",
//   getCommodityPaymentSettings: "/admin/getCommodityPaymentSettings",
//   upsertCommodityPaymentSettings: "/admin/upsertCommodityPaymentSettings",
//   getPaymentModeRules: "/admin/getPaymentModeRules",
//   upsertPaymentModeRules: "/admin/upsertPaymentModeRules",
//   getCustomFeeTemplates: "/admin/getCustomFeeTemplates",
//   upsertCustomFeeTemplate: "/admin/upsertCustomFeeTemplate",
//   getRoleCustomFees: "/admin/getRoleCustomFees",
//   upsertRoleCustomFee: "/admin/upsertRoleCustomFee",
//   previewEffectiveFees: "/admin/previewEffectiveFees",
// } as const;


// const SUBSCRIPTION_ROUTES = {
//   getSubscriptions: "/admin/getSubscriptions",
//   upsertSubscription: "/admin/upsertSubscription",
//   getSubscriptionInvoices: "/admin/getSubscriptionInvoices",
//   getSubscriptionInvoiceDetail: "/admin/getSubscriptionInvoiceDetail",
//   recordSubscriptionPayment: "/admin/recordSubscriptionPayment",
// } as const;

// const SETTLEMENT_ROUTES = {
//   getSettlements: "/admin/getSettlements",
//   getSettlementDetail: "/admin/getSettlementDetail",
// } as const;

// const PAYMENTS_LOG_ROUTES = {
//   getPaymentsLog: "/admin/getPaymentsLog",
//   getPaymentDetail: "/admin/getPaymentDetail",
// } as const;

// const DASHBOARD_ROUTES = {
//   getDashboardSummary: "/admin/dashboard",
// } as const;

// export const API_ROUTES = {
//   auth: {
//     login: "/auth/loginUser",
//   },
//   admin: {
//     getOrganisations: "/admin/getOrganisations",
//     createOrganisation: "/admin/createOrganisation",
//     updateOrganisation: "/admin/updateOrganisation",
//     getAdminUsers: "/admin/getAdminUsers",
//     createAdminUser: "/admin/createAdminUser",
//     updateAdminUser: "/admin/updateAdminUser",
//     deactivateAdminUser: "/admin/deactivateAdminUser",
//     resetAdminUserPassword: "/admin/resetAdminUserPassword",
//     requestAdminPasswordReset: "/admin/requestAdminPasswordReset",
//     confirmAdminPasswordReset: "/admin/confirmAdminPasswordReset",
//     getAdminRoles: "/admin/getAdminRoles",
//     getStepupPolicyRules: "/admin/security/getStepupPolicyRules",
//     saveStepupPolicyRule: "/admin/security/saveStepupPolicyRule",
//     getStepupPolicyScreens: "/admin/security/getStepupPolicyScreens",
//     saveStepupPolicySelection: "/admin/security/saveStepupPolicySelection",
//     getSecuritySwitches: "/admin/security/getSecuritySwitches",
//     updateSecuritySwitches: "/admin/security/updateSecuritySwitches",
//     getOrgMandiMappings: "/admin/getOrgMandiMappings",
//     createOrgMandiMapping: "/admin/createOrgMandiMapping",
//     updateOrgMandiMapping: "/admin/updateOrgMandiMapping",
//     addOrgMandi: "/admin/addOrgMandi",
//     removeOrgMandi: "/admin/removeOrgMandi",
//     requireStepUp: "/admin/2fa/requireStepUp",
//     get2faSetup: "/admin/2fa/getSetup",
//     enable: "/admin/2fa/enable",
//     verifyStepUp: "/admin/2fa/verifyStepUp",
//     rotate: "/admin/2fa/rotate",
//     getStatus: "/admin/2fa/getStatus",
//     getMandis: "/admin/getMandis",
//     createMandi: "/admin/createMandi",
//     updateMandi: "/admin/updateMandi",
//     deactivateMandi: "/admin/deactivateMandi",
//     getCommodities: "/admin/getCommodities",
//     createCommodity: "/admin/createCommodity",
//     updateCommodity: "/admin/updateCommodity",
//     deactivateCommodity: "/admin/deactivateCommodity",
//     getCommodityProducts: "/admin/getCommodityProducts",
//     createCommodityProduct: "/admin/createCommodityProduct",
//     updateCommodityProduct: "/admin/updateCommodityProduct",
//     deactivateCommodityProduct: "/admin/deactivateCommodityProduct",
//     getMandiFacilitiesMasters: "/admin/getMandiFacilitiesMasters",
//     createMandiFacilityMaster: "/admin/createMandiFacilityMaster",
//     updateMandiFacilityMaster: "/admin/updateMandiFacilityMaster",
//     deactivateMandiFacilityMaster: "/admin/deactivateMandiFacilityMaster",
//     getMandiFacilities: "/admin/getMandiFacilities",
//     createMandiFacility: "/admin/createMandiFacility",
//     updateMandiFacility: "/admin/updateMandiFacility",
//     deactivateMandiFacility: "/admin/deactivateMandiFacility",
//     getMandiGates: "/admin/getMandiGates",
//     addMandiGate: "/admin/addMandiGate",
//     editMandiGate: "/admin/editMandiGate",
//     deactivateMandiGate: "/admin/mandi-gates/toggle-active",
//     getMandisWithGatesSummary: "/admin/getMandisWithGatesSummary",
//     // Gates screen bootstrap (ORG scoped)
//     getGateBootstrap: "/admin/gates/getGateBootstrap",
//     // Backward-compatible alias
//     getGateScreenBootstrap: "/admin/gates/getGateScreenBootstrap",
//     getMandiHoursMasters: "/admin/getMandiHoursMasters",
//     createMandiHoursTemplate: "/admin/createMandiHoursTemplate",
//     updateMandiHoursTemplate: "/admin/updateMandiHoursTemplate",
//     deactivateMandiHoursTemplate: "/admin/deactivateMandiHoursTemplate",
//     getAuctionMethods: "/admin/getAuctionMethods",
//     createAuctionMethod: "/admin/createAuctionMethod",
//     updateAuctionMethod: "/admin/updateAuctionMethod",
//     deactivateAuctionMethod: "/admin/deactivateAuctionMethod",
//     getAuctionRounds: "/admin/getAuctionRounds",
//     createAuctionRound: "/admin/createAuctionRound",
//     updateAuctionRound: "/admin/updateAuctionRound",
//     deactivateAuctionRound: "/admin/deactivateAuctionRound",
//     getMandiAuctionPolicies: "/admin/getMandiAuctionPolicies",
//     createMandiAuctionPolicy: "/admin/createMandiAuctionPolicy",
//     updateMandiAuctionPolicy: "/admin/updateMandiAuctionPolicy",
//     deactivateMandiAuctionPolicy: "/admin/deactivateMandiAuctionPolicy",
//     getTraderApprovals: "/admin/getTraderApprovals",
//     getTraderApprovalDetail: "/admin/getTraderApprovalDetail",
//     approveTrader: "/admin/approveTrader",
//     rejectTrader: "/admin/rejectTrader",
//     requestMoreInfoTrader: "/admin/requestMoreInfoTrader",
//     getGateEntryReasons: "/admin/getGateEntryReasons",
//     createGateEntryReason: "/admin/createGateEntryReason",
//     updateGateEntryReason: "/admin/updateGateEntryReason",
//     deactivateGateEntryReason: "/admin/deactivateGateEntryReason",
//     getGateVehicleTypes: "/admin/getGateVehicleTypes",
//     createGateVehicleType: "/admin/createGateVehicleType",
//     updateGateVehicleType: "/admin/updateGateVehicleType",
//     deactivateGateVehicleType: "/admin/deactivateGateVehicleType",
//     getGateDevices: "/admin/getGateDevices",
//     createGateDevice: "/admin/createGateDevice",
//     updateGateDevice: "/admin/updateGateDevice",
//     deactivateGateDevice: "/admin/deactivateGateDevice",
//     getGateDeviceConfigs: "/admin/getGateDeviceConfigs",
//     createGateDeviceConfig: "/admin/createGateDeviceConfig",
//     updateGateDeviceConfig: "/admin/updateGateDeviceConfig",
//     deactivateGateDeviceConfig: "/admin/deactivateGateDeviceConfig",
//     getRolePoliciesDashboardData: "/admin/getRolePoliciesDashboardData",
//     updateRolePolicies: "/admin/updateRolePolicies",
//     getResourceRegistry: "/admin/getResourceRegistry",
//     updateResourceRegistry: "/admin/updateResourceRegistry",
//     getAdminUsersWithRoles: "/admin/getAdminUsersWithRoles",
//     assignUserRole: "/admin/assignUserRole",
//     deactivateUserRole: "/admin/deactivateUserRole",
//     getGatePassTokens: "/admin/getGatePassTokens",
//     getGateEntryTokens: "/admin/getGateEntryTokens",
//     getGateMovements: "/admin/getGateMovements",
//     getWeighmentTickets: "/admin/getWeighmentTickets",
//     getAdminUiConfig: "/admin/getAdminUiConfig",
//     getTraders: "/admin/getTraders",
//     updateTraderStatus: "/admin/updateTraderStatus",
//     getFarmers: "/admin/getFarmers",
//     updateFarmerStatus: "/admin/updateFarmerStatus",
//     getAuctionSessions: "/admin/getAuctionSessions",
//     getAuctionLots: "/admin/getAuctionLots",
//     getAuctionResults: "/admin/getAuctionResults",
//     getSystemMandisByState: "/admin/getSystemMandisByState",
//     importSystemMandisToOrg: "/admin/importSystemMandisToOrg",
//     getOrgMandis: "/admin/getOrgMandis",
//     ...SUBSCRIPTION_ROUTES,
//     ...SETTLEMENT_ROUTES,
//     ...PAYMENTS_LOG_ROUTES,
//     ...DASHBOARD_ROUTES,
//     paymentConfig: PAYMENT_CONFIG_ROUTES,
//     ...PAYMENT_CONFIG_ROUTES,
//   },
//   masters: {
//     getMandiCoverage: "/masters/getMandiCoverage",
//     getMandis: "/masters/getMandis",
//     getStatesDistricts: "/masters/getStatesDistricts",
//   },
// } as const;

// export const BRAND_COLORS = {
//   primary: "#2FA652",
//   primaryDark: "#1B6B3D",
// };

// // export const BRAND_ASSETS = {
// //   // Resolve relative to Vite base (/admin/) so it serves from the admin bundle
// //   logo: `${import.meta.env.BASE_URL}/assets/logo_transparent.png`,
// // };

// export const BRAND_ASSETS = { logo: "/admin/logo_transparent.png" };


// export const COLLECTIONS = {
//   adminUsers: "cm_admin_users",
//   userRoles: "cm_user_roles",
//   orgs: "cm_orgs",
//   orgMandis: "cm_org_mandis",
// };

// export const APP_STRINGS = {
//   title: "CiberMandi",
//   tagline: "Super Admin Console",
// };
