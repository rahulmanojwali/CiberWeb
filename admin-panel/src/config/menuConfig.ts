// admin-panel/src/config/menuConfig.ts

// admin-panel/src/config/menuConfig.ts

import * as React from "react";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import StoreMallDirectoryOutlinedIcon from "@mui/icons-material/StoreMallDirectoryOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import HubOutlinedIcon from "@mui/icons-material/HubOutlined";
import QrCodeScannerOutlinedIcon from "@mui/icons-material/QrCodeScannerOutlined";
import ScaleOutlinedIcon from "@mui/icons-material/ScaleOutlined";
import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import { can, type UiResource } from "../utils/adminUiConfig";

// 🔹 All CiberMandi admin roles we want to support in the panel
export type RoleSlug =
  | "SUPER_ADMIN"
  | "ORG_ADMIN"
  | "ORG_VIEWER"
  | "MANDI_ADMIN"
  | "MANDI_MANAGER"
  | "AUCTIONEER"
  | "GATE_OPERATOR"
  | "WEIGHBRIDGE_OPERATOR"
  | "AUDITOR"
  | "VIEWER";

export type MenuItem = {
  key?: string;
  labelKey: string;
  path: string;
  icon: React.ReactNode;
  roles: RoleSlug[]; // which roles can see this menu
  resourceKey?: string;
  requiredAction?: string;
};

// Helper: everyone among all roles
const ALL_ROLES: RoleSlug[] = [
  "SUPER_ADMIN",
  "ORG_ADMIN",
  "ORG_VIEWER",
  "MANDI_ADMIN",
  "MANDI_MANAGER",
  "AUCTIONEER",
  "GATE_OPERATOR",
  "WEIGHBRIDGE_OPERATOR",
  "AUDITOR",
  "VIEWER",
];

export const menuItems: MenuItem[] = [
  // 1) Dashboard – every role gets a dashboard
  {
    labelKey: "menu.dashboard",
    path: "/",
    icon: React.createElement(DashboardOutlinedIcon),
    roles: ALL_ROLES,
    resourceKey: "dashboard.menu",
    requiredAction: "VIEW",
  },

  // 2) Organisations – platform & org level; auditors & org_viewer can see
  // NO mandi roles, gate, weighbridge, auctioneer, viewer.
  {
    labelKey: "menu.organisations",
    path: "/orgs",
    icon: React.createElement(ApartmentOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "AUDITOR"],
    resourceKey: "organisations.menu",
    requiredAction: "VIEW",
  },

  // 3) Org–Mandi mapping – platform & org level; auditors & org_viewer can see
  {
    labelKey: "menu.orgMandi",
    path: "/org-mandi",
    icon: React.createElement(HubOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "AUDITOR"],
    resourceKey: "org_mandi_mappings.menu",
    requiredAction: "VIEW",
  },

  // 4) Mandis master – platform, org, mandi admins/managers; auditors & viewer can see
  {
    labelKey: "menu.mandis",
    path: "/mandis",
    icon: React.createElement(StoreMallDirectoryOutlinedIcon),
    roles: [
      "SUPER_ADMIN",
      "ORG_ADMIN",
      "ORG_VIEWER",
      "MANDI_ADMIN",
      "MANDI_MANAGER",
      "AUDITOR",
      "VIEWER",
    ],
    resourceKey: "mandis.menu",
    requiredAction: "VIEW",
  },

  // --- Mandi module submenus ---
  {
    labelKey: "menu.commodities",
    path: "/commodities",
    icon: React.createElement(StoreMallDirectoryOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "AUDITOR"],
    resourceKey: "commodities.menu",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.commodityProducts",
    path: "/commodity-products",
    icon: React.createElement(StoreMallDirectoryOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "AUDITOR"],
    resourceKey: "commodity_products.menu",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.mandiFacilitiesMasters",
    path: "/mandi-facilities",
    icon: React.createElement(StoreMallDirectoryOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR"],
    resourceKey: "mandi_facilities.menu",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.mandiGates",
    path: "/mandi-gates",
    icon: React.createElement(StoreMallDirectoryOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR", "VIEWER"],
    resourceKey: "mandi_gates.menu",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.mandiHoursTemplates",
    path: "/mandi-hours-templates",
    icon: React.createElement(StoreMallDirectoryOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "AUDITOR", "ORG_VIEWER"],
    resourceKey: "mandi_hours.menu",
    requiredAction: "VIEW",
  },

  // Auctions & Policies
  {
    labelKey: "menu.auctionMethods",
    path: "/auction-methods",
    icon: React.createElement(StoreMallDirectoryOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN"],
    resourceKey: "auction_methods_masters.menu",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.auctionRounds",
    path: "/auction-rounds",
    icon: React.createElement(StoreMallDirectoryOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN"],
    resourceKey: "auction_rounds_masters.menu",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.auctionPolicies",
    path: "/auction-policies",
    icon: React.createElement(StoreMallDirectoryOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN"],
    resourceKey: "cm_mandi_auction_policies.menu",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.auctionSessions",
    path: "/auction-sessions",
    icon: React.createElement(GavelOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUDITOR"],
    resourceKey: "auction_sessions.menu",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.auctionLots",
    path: "/auction-lots",
    icon: React.createElement(GavelOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUDITOR"],
    resourceKey: "auction_lots.menu",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.auctionResults",
    path: "/auction-results",
    icon: React.createElement(GavelOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUDITOR"],
    resourceKey: "auction_results.menu",
    requiredAction: "VIEW",
  },

  // Gate & Yard Masters
  {
    labelKey: "menu.gateEntryReasons",
    path: "/gate-entry-reasons",
    icon: React.createElement(StoreMallDirectoryOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
    resourceKey: "gate_entry_reasons_masters.menu",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.gateVehicleTypes",
    path: "/gate-vehicle-types",
    icon: React.createElement(StoreMallDirectoryOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
    resourceKey: "gate_vehicle_types_masters.menu",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.gateDevices",
    path: "/gate-devices",
    icon: React.createElement(StoreMallDirectoryOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
    resourceKey: "cm_gate_devices.menu",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.gateDeviceConfigs",
    path: "/gate-device-configs",
    icon: React.createElement(StoreMallDirectoryOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
    resourceKey: "gate_device_configs.menu",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.gateTokens",
    path: "/gate-tokens",
    icon: React.createElement(QrCodeScannerOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
    resourceKey: "gate_pass_tokens.view",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.weighmentTickets",
    path: "/weighment-tickets",
    icon: React.createElement(ScaleOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
    resourceKey: "weighment_tickets.view",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.gateMovements",
    path: "/gate-movements",
    icon: React.createElement(TimelineOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
    resourceKey: "gate_movements_log.view",
    requiredAction: "VIEW",
  },

  // 5) Admin users – ONLY superadmin + org admin
  {
    labelKey: "menu.adminUsers",
    path: "/admin-users",
    icon: React.createElement(GroupsOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN"],
    key: "adminUsers",
    resourceKey: "admin_users.menu",
    requiredAction: "VIEW",
  },

  // 6) Trader approvals – platform, org & mandi-level ops (no auditors/viewers)
  {
    labelKey: "menu.traderApprovals",
    path: "/trader-approvals",
    icon: React.createElement(TaskAltOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
    resourceKey: "trader_approvals.menu",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.traders",
    path: "/traders",
    icon: React.createElement(BadgeOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "ORG_VIEWER", "AUDITOR"],
    resourceKey: "traders.menu",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.farmers",
    path: "/farmers",
    icon: React.createElement(BadgeOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "ORG_VIEWER", "AUDITOR"],
    resourceKey: "farmers.menu",
    requiredAction: "VIEW",
  },

  // 7) Reports – management / regulator views (NOT gate/weighbridge/auction-only users)
  {
    labelKey: "menu.reports",
    path: "/reports",
    icon: React.createElement(AssessmentOutlinedIcon),
    roles: [
      "SUPER_ADMIN",
      "ORG_ADMIN",
      "ORG_VIEWER",
      "MANDI_ADMIN",
      "MANDI_MANAGER",
      "AUCTIONEER",
      "GATE_OPERATOR",
      "WEIGHBRIDGE_OPERATOR",
      "AUDITOR",
      "VIEWER",
    ],
  },

  // 8) Mandi coverage – mapping view; management + regulators + viewer
  {
    labelKey: "menu.mandiCoverage",
    path: "/mandi-coverage",
    icon: React.createElement(MapOutlinedIcon),
    roles: [
      "SUPER_ADMIN",
      "ORG_ADMIN",
      "ORG_VIEWER",
      "MANDI_ADMIN",
      "MANDI_MANAGER",
      "AUDITOR",
      "VIEWER",
    ],
  },

  // 9) Mandi prices – price transparency; most roles except gate/weighbridge
  {
    labelKey: "menu.mandiPrices",
    path: "/mandi-prices",
    icon: React.createElement(PriceChangeOutlinedIcon),
    roles: [
      "SUPER_ADMIN",
      "ORG_ADMIN",
      "ORG_VIEWER",
      "MANDI_ADMIN",
      "MANDI_MANAGER",
      "AUCTIONEER",
      "AUDITOR",
      "VIEWER",
    ],
  },
  {
    labelKey: "menu.paymentsAndSettlements",
    path: "/payments-settlements",
    icon: React.createElement(PriceChangeOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
    resourceKey: "payment_models.menu",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.paymentModels",
    path: "/payment-models",
    icon: React.createElement(AccountBalanceWalletOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
    resourceKey: "payment_models.list",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.orgPaymentSettings",
    path: "/org-payment-settings",
    icon: React.createElement(AccountBalanceOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
    resourceKey: "org_payment_settings.list",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.mandiPaymentSettings",
    path: "/mandi-payment-settings",
    icon: React.createElement(StoreMallDirectoryOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
    resourceKey: "mandi_payment_settings.list",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.commodityFeeSettings",
    path: "/commodity-fees",
    icon: React.createElement(Inventory2OutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
    resourceKey: "commodity_payment_settings.list",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.paymentModes",
    path: "/payment-modes",
    icon: React.createElement(SettingsOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
    resourceKey: "payment_mode_rules.list",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.customFees",
    path: "/custom-fees",
    icon: React.createElement(ReceiptLongOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
    resourceKey: "custom_fee_templates.list",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.roleCustomFees",
    path: "/role-custom-fees",
    icon: React.createElement(GroupsOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
    resourceKey: "role_custom_fees.list",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.subscriptions",
    path: "/subscriptions",
    icon: React.createElement(AccountBalanceOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
    resourceKey: "subscriptions.menu",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.subscriptionInvoices",
    path: "/subscription-invoices",
    icon: React.createElement(ReceiptLongOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
    resourceKey: "subscription_invoices.menu",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.settlements",
    path: "/settlements",
    icon: React.createElement(AssessmentOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
    resourceKey: "settlements.menu",
    requiredAction: "VIEW",
  },
  {
    labelKey: "menu.paymentsLog",
    path: "/payments-log",
    icon: React.createElement(ReceiptLongOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
    resourceKey: "payments_log.menu",
    requiredAction: "VIEW",
  },
];

// 🔹 Strict role-based filter used by Header + CustomSider
// Central role-based filter used by Header + CustomSider
export function filterMenuByRole(role: RoleSlug | null) {
  const knownRole = role && ALL_ROLES.includes(role);
  const effectiveRole: RoleSlug = knownRole ? role : "VIEWER";

  if (!knownRole) {
    console.warn(
      "[menuConfig/filterMenuByRole] Unknown or missing role; using VIEWER fallback.",
      { inputRole: role },
    );
  }

  console.log(
    "[menuConfig/filterMenuByRole] input role:",
    role,
    "→ effective role:",
    effectiveRole,
  );

  return menuItems.filter((item) => item.roles.includes(effectiveRole));
}

// 🔹 Preferred filter when backend UI config is available
export function filterMenuByResources(
  resources: UiResource[] | undefined,
  fallbackRole: RoleSlug | null,
) {
  const hasResources = Array.isArray(resources) && resources.length > 0;
  if (!hasResources) {
    return filterMenuByRole(fallbackRole);
  }

  return menuItems.filter((item) => {
    if (!item.resourceKey) return true; // no mapping yet, keep visible
    const action = item.requiredAction || "VIEW";
    return can(resources, item.resourceKey, action);
  });
}



// import * as React from "react";
// import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
// import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
// import StoreMallDirectoryOutlinedIcon from "@mui/icons-material/StoreMallDirectoryOutlined";
// import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
// import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
// import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
// import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
// import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
// import HubOutlinedIcon from "@mui/icons-material/HubOutlined";

// // 🔹 All roles we want to support in CiberMandi admin
// export type RoleSlug =
//   | "SUPER_ADMIN"
//   | "ORG_ADMIN"
//   | "ORG_VIEWER"
//   | "MANDI_ADMIN"
//   | "MANDI_MANAGER"
//   | "AUCTIONEER"
//   | "GATE_OPERATOR"
//   | "WEIGHBRIDGE_OPERATOR"
//   | "AUDITOR"
//   | "VIEWER";

// export type MenuItem = {
//   labelKey: string;
//   path: string;
//   icon: React.ReactNode;
//   roles: RoleSlug[]; // which roles can see this menu
// };

// // Helper: all roles (for items that everyone can see)
// const ALL_ROLES: RoleSlug[] = [
//   "SUPER_ADMIN",
//   "ORG_ADMIN",
//   "ORG_VIEWER",
//   "MANDI_ADMIN",
//   "MANDI_MANAGER",
//   "AUCTIONEER",
//   "GATE_OPERATOR",
//   "WEIGHBRIDGE_OPERATOR",
//   "AUDITOR",
//   "VIEWER",
// ];

// export const menuItems: MenuItem[] = [
//   // Dashboard – everyone gets a dashboard
//   {
//     labelKey: "menu.dashboard",
//     path: "/",
//     icon: React.createElement(DashboardOutlinedIcon),
//     roles: ALL_ROLES,
//   },

//   // Organisations – platform / org level only
//   {
//     labelKey: "menu.organisations",
//     path: "/orgs",
//     icon: React.createElement(ApartmentOutlinedIcon),
//     roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "AUDITOR"],
//   },

//   // Org–Mandi mapping – platform / org level only
//   {
//     labelKey: "menu.orgMandi",
//     path: "/org-mandi-mapping",
//     icon: React.createElement(HubOutlinedIcon),
//     roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "AUDITOR"],
//   },

//   // Mandis master – visible to platform + org + mandi managers
//   {
//     labelKey: "menu.mandis",
//     path: "/mandis",
//     icon: React.createElement(StoreMallDirectoryOutlinedIcon),
//     roles: [
//       "SUPER_ADMIN",
//       "ORG_ADMIN",
//       "ORG_VIEWER",
//       "MANDI_ADMIN",
//       "MANDI_MANAGER",
//       "AUDITOR",
//     ],
//   },

//   // Admin users – only people who can manage users
//   {
//     labelKey: "menu.adminUsers",
//     path: "/admin-users",
//     icon: React.createElement(GroupsOutlinedIcon),
//     roles: ["SUPER_ADMIN", "ORG_ADMIN"],
//   },

//   // Trader approvals – core mandi operations
//   {
//     labelKey: "menu.traderApprovals",
//     path: "/trader-approvals",
//     icon: React.createElement(TaskAltOutlinedIcon),
//     roles: [
//       "SUPER_ADMIN",
//       "ORG_ADMIN",
//       "MANDI_ADMIN",
//       "MANDI_MANAGER",
//       "AUCTIONEER",
//     ],
//   },

//   // Reports – most roles can see some form of reporting
//   {
//     labelKey: "menu.reports",
//     path: "/reports",
//     icon: React.createElement(AssessmentOutlinedIcon),
//     roles: ALL_ROLES,
//   },

//   // Mandi coverage – good for managers, viewers, auditors
//   {
//     labelKey: "menu.mandiCoverage",
//     path: "/mandi-coverage",
//     icon: React.createElement(MapOutlinedIcon),
//     roles: [
//       "SUPER_ADMIN",
//       "ORG_ADMIN",
//       "ORG_VIEWER",
//       "MANDI_ADMIN",
//       "MANDI_MANAGER",
//       "AUDITOR",
//       "VIEWER",
//     ],
//   },

//   // Mandi prices – mainly mandi-related, but also useful for viewers
//   {
//     labelKey: "menu.mandiPrices",
//     path: "/mandi-prices",
//     icon: React.createElement(PriceChangeOutlinedIcon),
//     roles: [
//       "SUPER_ADMIN",
//       "ORG_ADMIN",
//       "MANDI_ADMIN",
//       "MANDI_MANAGER",
//       "AUDITOR",
//       "VIEWER",
//     ],
//   },
// ];



// export function filterMenuByRole(role: RoleSlug | null) {
//   // 👉 If role is missing or not resolved, treat as VIEWER (safest)
//   const effectiveRole: RoleSlug = role ?? "VIEWER";

//   return menuItems.filter((item) => item.roles.includes(effectiveRole));
// }


// import * as React from "react";
// import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
// import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
// import StoreMallDirectoryOutlinedIcon from "@mui/icons-material/StoreMallDirectoryOutlined";
// import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
// import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
// import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
// import PriceChangeOutlinedIcon from "@mui/icons-material/PriceChangeOutlined";
// import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
// import HubOutlinedIcon from "@mui/icons-material/HubOutlined";

// export type RoleSlug = "SUPER_ADMIN" | "ORG_ADMIN" | "MANDI_ADMIN" | "AUDITOR";

// export type MenuItem = {
//   labelKey: string;
//   path: string;
//   icon: React.ReactNode;
//   roles: RoleSlug[];  
// };

// export const menuItems: MenuItem[] = [
//   { labelKey: "menu.dashboard", path: "/", icon: React.createElement(DashboardOutlinedIcon), roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUDITOR"] },
//   { labelKey: "menu.organisations", path: "/orgs", icon: React.createElement(ApartmentOutlinedIcon), roles: ["SUPER_ADMIN", "ORG_ADMIN", "AUDITOR"] },
//   { labelKey: "menu.orgMandi", path: "/org-mandi-mapping", icon: React.createElement(HubOutlinedIcon), roles: ["SUPER_ADMIN", "ORG_ADMIN", "AUDITOR"] },
//   { labelKey: "menu.mandis", path: "/mandis", icon: React.createElement(StoreMallDirectoryOutlinedIcon), roles: ["SUPER_ADMIN", "ORG_ADMIN"] },
//   { labelKey: "menu.adminUsers", path: "/admin-users", icon: React.createElement(GroupsOutlinedIcon), roles: ["SUPER_ADMIN", "ORG_ADMIN"] },
//   { labelKey: "menu.traderApprovals", path: "/trader-approvals", icon: React.createElement(TaskAltOutlinedIcon), roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"] },
//   { labelKey: "menu.reports", path: "/reports", icon: React.createElement(AssessmentOutlinedIcon), roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUDITOR"] },
//   { labelKey: "menu.mandiCoverage", path: "/mandi-coverage", icon: React.createElement(MapOutlinedIcon), roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"] },
//   { labelKey: "menu.mandiPrices", path: "/mandi-prices", icon: React.createElement(PriceChangeOutlinedIcon), roles: ["MANDI_ADMIN", "SUPER_ADMIN"] },
// ];

// export function filterMenuByRole(role: RoleSlug | null) {
//   if (!role) return menuItems;
//   return menuItems.filter((item) => item.roles.includes(role));
// }
