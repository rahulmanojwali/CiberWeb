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

export type AppMenuItem = {
  key?: string;
  labelKey: string;
  path?: string;
  icon?: React.ReactNode;
  resourceKey?: string;
  requiredAction?: string;
  roles?: RoleSlug[];
  children?: AppMenuItem[];
};

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

export const APP_MENU: AppMenuItem[] = [
  {
    key: "dashboard",
    labelKey: "menu.dashboard",
    path: "/dashboard",
    icon: React.createElement(DashboardOutlinedIcon),
    resourceKey: "dashboard.menu",
    requiredAction: "VIEW",
    roles: ALL_ROLES,
  },
  {
    key: "organisationsAndAdmin",
    labelKey: "menu.organisations",
    icon: React.createElement(ApartmentOutlinedIcon),
    roles: ALL_ROLES,
    children: [
      {
        key: "organisations",
        labelKey: "menu.organisations",
        path: "/orgs",
        icon: React.createElement(ApartmentOutlinedIcon),
        resourceKey: "organisations.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "AUDITOR"],
      },
      {
        key: "orgMandiMapping",
        labelKey: "menu.orgMandi",
        path: "/org-mandi",
        icon: React.createElement(HubOutlinedIcon),
        resourceKey: "org_mandi_mappings.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "AUDITOR"],
      },
      {
        key: "mandis",
        labelKey: "menu.mandis",
        path: "/mandis",
        icon: React.createElement(StoreMallDirectoryOutlinedIcon),
        resourceKey: "mandis.menu",
        requiredAction: "VIEW",
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
      {
        key: "adminUsers",
        labelKey: "menu.adminUsers",
        path: "/admin-users",
        icon: React.createElement(GroupsOutlinedIcon),
        resourceKey: "admin_users.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN"],
      },
    ],
  },
  {
    key: "registry",
    labelKey: "menu.traders",
    icon: React.createElement(BadgeOutlinedIcon),
    roles: ALL_ROLES,
    children: [
      {
        key: "traders",
        labelKey: "menu.traders",
        path: "/traders",
        icon: React.createElement(BadgeOutlinedIcon),
        resourceKey: "traders.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "ORG_VIEWER", "AUDITOR"],
      },
      {
        key: "farmers",
        labelKey: "menu.farmers",
        path: "/farmers",
        icon: React.createElement(BadgeOutlinedIcon),
        resourceKey: "farmers.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "ORG_VIEWER", "AUDITOR"],
      },
      {
        key: "traderApprovals",
        labelKey: "menu.traderApprovals",
        path: "/trader-approvals",
        icon: React.createElement(TaskAltOutlinedIcon),
        resourceKey: "trader_approvals.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
      },
    ],
  },
  {
    key: "mastersMandiSetup",
    labelKey: "menu.commodities",
    icon: React.createElement(StoreMallDirectoryOutlinedIcon),
    roles: ALL_ROLES,
    children: [
      {
        key: "commodities",
        labelKey: "menu.commodities",
        path: "/commodities",
        icon: React.createElement(StoreMallDirectoryOutlinedIcon),
        resourceKey: "commodities.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "AUDITOR"],
      },
      {
        key: "commodityProducts",
        labelKey: "menu.commodityProducts",
        path: "/commodity-products",
        icon: React.createElement(StoreMallDirectoryOutlinedIcon),
        resourceKey: "commodity_products.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "AUDITOR"],
      },
      {
        key: "mandiFacilities",
        labelKey: "menu.mandiFacilities",
        path: "/mandi-facilities",
        icon: React.createElement(StoreMallDirectoryOutlinedIcon),
        resourceKey: "mandi_facilities.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR"],
      },
      {
        key: "mandiGates",
        labelKey: "menu.mandiGates",
        path: "/mandi-gates",
        icon: React.createElement(StoreMallDirectoryOutlinedIcon),
        resourceKey: "mandi_gates.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR", "VIEWER"],
      },
      {
        key: "mandiHours",
        labelKey: "menu.mandiHoursTemplates",
        path: "/mandi-hours-templates",
        icon: React.createElement(Inventory2OutlinedIcon),
        resourceKey: "mandi_hours.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "AUDITOR", "ORG_VIEWER"],
      },
    ],
  },
  {
    key: "mastersAuctionSetup",
    labelKey: "menu.auctionMethods",
    icon: React.createElement(GavelOutlinedIcon),
    roles: ALL_ROLES,
    children: [
      {
        key: "auctionMethods",
        labelKey: "menu.auctionMethods",
        path: "/auction-methods",
        icon: React.createElement(GavelOutlinedIcon),
        resourceKey: "auction_methods_masters.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN"],
      },
      {
        key: "auctionRounds",
        labelKey: "menu.auctionRounds",
        path: "/auction-rounds",
        icon: React.createElement(GavelOutlinedIcon),
        resourceKey: "auction_rounds_masters.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN"],
      },
      {
        key: "auctionPolicies",
        labelKey: "menu.auctionPolicies",
        path: "/auction-policies",
        icon: React.createElement(GavelOutlinedIcon),
        resourceKey: "cm_mandi_auction_policies.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN"],
      },
    ],
  },
  {
    key: "gateYardMasters",
    labelKey: "menu.gateEntryReasons",
    icon: React.createElement(QrCodeScannerOutlinedIcon),
    roles: ALL_ROLES,
    children: [
      {
        key: "gateEntryReasons",
        labelKey: "menu.gateEntryReasons",
        path: "/gate-entry-reasons",
        icon: React.createElement(QrCodeScannerOutlinedIcon),
        resourceKey: "gate_entry_reasons_masters.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
      },
      {
        key: "gateVehicleTypes",
        labelKey: "menu.gateVehicleTypes",
        path: "/gate-vehicle-types",
        icon: React.createElement(QrCodeScannerOutlinedIcon),
        resourceKey: "gate_vehicle_types_masters.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
      },
      {
        key: "gateDevices",
        labelKey: "menu.gateDevices",
        path: "/gate-devices",
        icon: React.createElement(QrCodeScannerOutlinedIcon),
        resourceKey: "cm_gate_devices.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
      },
      {
        key: "deviceConfigs",
        labelKey: "menu.gateDeviceConfigs",
        path: "/gate-device-configs",
        icon: React.createElement(QrCodeScannerOutlinedIcon),
        resourceKey: "gate_device_configs.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
      },
    ],
  },
  {
    key: "gateYardOperations",
    labelKey: "menu.gateTokens",
    icon: React.createElement(QrCodeScannerOutlinedIcon),
    roles: ALL_ROLES,
    children: [
      {
        key: "gateTokens",
        labelKey: "menu.gateTokens",
        path: "/gate-tokens",
        icon: React.createElement(QrCodeScannerOutlinedIcon),
        resourceKey: "gate_pass_tokens.view",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
      },
      {
        key: "weighmentTickets",
        labelKey: "menu.weighmentTickets",
        path: "/weighment-tickets",
        icon: React.createElement(ScaleOutlinedIcon),
        resourceKey: "weighment_tickets.view",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
      },
      {
        key: "gateMovements",
        labelKey: "menu.gateMovements",
        path: "/gate-movements",
        icon: React.createElement(TimelineOutlinedIcon),
        resourceKey: "gate_movements_log.view",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
      },
    ],
  },
  {
    key: "auctionOperations",
    labelKey: "menu.auctionSessions",
    icon: React.createElement(TimelineOutlinedIcon),
    roles: ALL_ROLES,
    children: [
      {
        key: "auctionSessions",
        labelKey: "menu.auctionSessions",
        path: "/auction-sessions",
        icon: React.createElement(GavelOutlinedIcon),
        resourceKey: "auction_sessions.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUDITOR"],
      },
      {
        key: "auctionLots",
        labelKey: "menu.auctionLots",
        path: "/auction-lots",
        icon: React.createElement(GavelOutlinedIcon),
        resourceKey: "auction_lots.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUDITOR"],
      },
      {
        key: "auctionResults",
        labelKey: "menu.auctionResults",
        path: "/auction-results",
        icon: React.createElement(GavelOutlinedIcon),
        resourceKey: "auction_results.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUDITOR"],
      },
    ],
  },
  {
    key: "pricesCoverage",
    labelKey: "menu.mandiCoverage",
    icon: React.createElement(MapOutlinedIcon),
    roles: ALL_ROLES,
    children: [
      {
        key: "mandiCoverage",
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
      {
        key: "mandiPrices",
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
    ],
  },
  {
    key: "paymentsAndSettlement",
    labelKey: "menu.paymentsAndSettlements",
    icon: React.createElement(AccountBalanceWalletOutlinedIcon),
    roles: ALL_ROLES,
    children: [
      {
        key: "paymentModels",
        labelKey: "menu.paymentModels",
        path: "/payment-models",
        icon: React.createElement(AccountBalanceWalletOutlinedIcon),
        resourceKey: "payment_models.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
      },
      {
        key: "orgPaymentSettings",
        labelKey: "menu.orgPaymentSettings",
        path: "/org-payment-settings",
        icon: React.createElement(AccountBalanceOutlinedIcon),
        resourceKey: "org_payment_settings.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
      },
      {
        key: "mandiPaymentSettings",
        labelKey: "menu.mandiPaymentSettings",
        path: "/mandi-payment-settings",
        icon: React.createElement(StoreMallDirectoryOutlinedIcon),
        resourceKey: "mandi_payment_settings.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
      },
      {
        key: "commodityFees",
        labelKey: "menu.commodityFeeSettings",
        path: "/commodity-fees",
        icon: React.createElement(Inventory2OutlinedIcon),
        resourceKey: "commodity_fees.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
      },
      {
        key: "paymentModes",
        labelKey: "menu.paymentModes",
        path: "/payment-modes",
        icon: React.createElement(SettingsOutlinedIcon),
        resourceKey: "payment_modes.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
      },
      {
        key: "customFees",
        labelKey: "menu.customFees",
        path: "/custom-fees",
        icon: React.createElement(ReceiptLongOutlinedIcon),
        resourceKey: "custom_fees.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
      },
      {
        key: "roleCustomFees",
        labelKey: "menu.roleCustomFees",
        path: "/role-custom-fees",
        icon: React.createElement(GroupsOutlinedIcon),
        resourceKey: "role_custom_fees.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
      },
      {
        key: "subscriptions",
        labelKey: "menu.subscriptions",
        path: "/subscriptions",
        icon: React.createElement(AccountBalanceOutlinedIcon),
        resourceKey: "subscriptions.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
      },
      {
        key: "subscriptionInvoices",
        labelKey: "menu.subscriptionInvoices",
        path: "/subscription-invoices",
        icon: React.createElement(ReceiptLongOutlinedIcon),
        resourceKey: "subscription_invoices.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
      },
      {
        key: "settlements",
        labelKey: "menu.settlements",
        path: "/settlements",
        icon: React.createElement(AssessmentOutlinedIcon),
        resourceKey: "settlements.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
      },
      {
        key: "paymentsLog",
        labelKey: "menu.paymentsLog",
        path: "/payments-log",
        icon: React.createElement(ReceiptLongOutlinedIcon),
        resourceKey: "payments_log.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
      },
    ],
  },
  {
    key: "reports",
    labelKey: "menu.reports",
    path: "/reports",
    icon: React.createElement(AssessmentOutlinedIcon),
    roles: ALL_ROLES,
  },
];

function cloneMenuItem(item: AppMenuItem, overrides: Partial<AppMenuItem> = {}): AppMenuItem {
  return {
    ...item,
    ...overrides,
  };
}

function filterHierarchy(items: AppMenuItem[], predicate: (item: AppMenuItem) => boolean): AppMenuItem[] {
  const results: AppMenuItem[] = [];
  for (const item of items) {
    const filteredChildren = item.children ? filterHierarchy(item.children, predicate) : [];
    const visible = predicate(item) || filteredChildren.length > 0;
    if (visible) {
      const node: AppMenuItem = cloneMenuItem(item, {
        children: filteredChildren.length ? filteredChildren : undefined,
      });
      results.push(node);
    }
  }
  return results;
}

export type MenuItem = AppMenuItem;

export function filterMenuByRole(role: RoleSlug | null) {
  const knownRole = role && ALL_ROLES.includes(role);
  const effectiveRole: RoleSlug = knownRole ? role : "VIEWER";

  if (!knownRole) {
    console.warn(
      "[menuConfig/filterMenuByRole] Unknown or missing role; using VIEWER fallback.",
      { inputRole: role },
    );
  }

  return filterHierarchy(APP_MENU, (item) => {
    if (!item.roles || item.roles.length === 0) return true;
    return item.roles.includes(effectiveRole);
  });
}

export function filterMenuByResources(resources: UiResource[] | undefined, fallbackRole: RoleSlug | null) {
  const hasResources = Array.isArray(resources) && resources.length > 0;
  if (!hasResources) {
    return filterMenuByRole(fallbackRole);
  }

  return filterHierarchy(APP_MENU, (item) => {
    if (!item.resourceKey) return true;
    const action = item.requiredAction || "VIEW";
    return can(resources, item.resourceKey, action);
  });
}
