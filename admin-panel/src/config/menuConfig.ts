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
import { canonicalizeResourceKey, type UiResource } from "../utils/adminUiConfig";
import { computeAllowedSidebar } from "../utils/rbacHelper";
import { MENU_FREEZE } from "./menuFreeze";
import { getResourceLabel } from "../utils/uiLabel";
import { resolveMenuIcon } from "./iconRegistry";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import VpnKeyOutlinedIcon from "@mui/icons-material/VpnKeyOutlined";

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
  labelOverride?: string;
  path?: string;
  icon?: React.ReactNode;
  resourceKey?: string;
  requiredAction?: string;
  roles?: RoleSlug[];
  children?: AppMenuItem[];
  order?: number;
  disabled?: boolean;
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
  
  // {
  //   key: "organisationsAccess",
  //   labelKey: "menu.organisations",
  //   icon: React.createElement(ApartmentOutlinedIcon),
  //   roles: ALL_ROLES,
  //   children: [
  //     {
  //       key: "organisations",
  //       labelKey: "menu.organisations",
  //       path: "/orgs",
  //       icon: React.createElement(ApartmentOutlinedIcon),
  //       resourceKey: "organisations.menu",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "AUDITOR"],
  //     },
  //     {
  //       key: "orgMandiMapping",
  //       labelKey: "menu.orgMandi",
  //       path: "/org-mandi-mapping",
  //       icon: React.createElement(HubOutlinedIcon),
  //       resourceKey: "org_mandi_mapping.menu",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "AUDITOR"],
  //     },
  //     {
  //       key: "adminUsers",
  //       labelKey: "menu.adminUsers",
  //       path: "/admin-users",
  //       icon: React.createElement(GroupsOutlinedIcon),
  //       resourceKey: "admin_users.menu",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN"],
  //     },
  //   ],
  // },

  {
  key: "organisationsAccess",
  labelKey: "menu.organisations",
  icon: React.createElement(ApartmentOutlinedIcon),
  roles: ALL_ROLES,
  children: [
    {
      key: "organisations",
      labelKey: "menu.organisationsList",   // 👈 changed
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
        key: "system",
        labelKey: "menu.system",
        icon: React.createElement(SettingsOutlinedIcon),
        roles: ["SUPER_ADMIN"],
        children: [
      {
        key: "userRoleManager",
        labelKey: "menu.userRoleManager",
        path: "/system/user-role-manager",
        icon: React.createElement(SecurityOutlinedIcon),
        resourceKey: "user_roles.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN"],
      },
      {
        key: "rolesPermissions",
        labelKey: "menu.rolePermissions",
        path: "/system/permissions-manager",
        icon: React.createElement(SecurityOutlinedIcon),
        resourceKey: "role_policies.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN"],
      },
      {
        key: "resourceRegistry",
        labelKey: "menu.resourceRegistry",
        path: "/system/resource-registry",
        icon: React.createElement(SecurityOutlinedIcon),
        resourceKey: "resource_registry.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN"],
      },
      {
        key: "resourceHealth",
        labelKey: "menu.resourceHealth",
        path: "/system/resource-health",
        icon: React.createElement(SecurityOutlinedIcon),
        resourceKey: "resource_registry.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN"],
      },
      {
        key: "securityTwoFactor",
        labelKey: "menu.twoFactorSecurity",
        path: "/system/security/2fa",
        icon: React.createElement(VpnKeyOutlinedIcon),
        resourceKey: "security_2fa.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN"],
      },
      {
        key: "securitySwitches",
        labelKey: "menu.securitySwitches",
        path: "/system/security/switches",
        icon: React.createElement(SecurityOutlinedIcon),
        resourceKey: "security_switches.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN"],
      },
      {
        key: "systemCapacityControl",
        labelKey: "menu.systemCapacityControl",
        path: "/system/capacity-control",
        icon: React.createElement(SettingsOutlinedIcon),
        resourceKey: "capacity_control.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN"],
      },
    ],
  },



  // {
  //   key: "mandisGroup",
  //   labelKey: "menu.mandis",
  //   icon: React.createElement(StoreMallDirectoryOutlinedIcon),
  //   roles: ALL_ROLES,
  //   children: [
  //     {
  //       key: "mandis",
  //       labelKey: "menu.mandis",
  //       path: "/mandis",
  //       icon: React.createElement(StoreMallDirectoryOutlinedIcon),
  //       resourceKey: "mandis.menu",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR", "VIEWER"],
  //     },
  //     {
  //       key: "commodities",
  //       labelKey: "menu.commodities",
  //       path: "/commodities",
  //       icon: React.createElement(StoreMallDirectoryOutlinedIcon),
  //       resourceKey: "commodities_masters.menu",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR"],
  //     },
  //     {
  //       key: "commodityProducts",
  //       labelKey: "menu.commodityProducts",
  //       path: "/commodity-products",
  //       icon: React.createElement(StoreMallDirectoryOutlinedIcon),
  //       resourceKey: "commodity_products_masters.menu",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR"],
  //     },
  //     {
  //       key: "mandiFacilities",
  //       labelKey: "menu.mandiFacilities",
  //       path: "/mandi-facilities",
  //       icon: React.createElement(StoreMallDirectoryOutlinedIcon),
  //       resourceKey: "mandi_facilities.menu",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR"],
  //     },
  //     {
  //       key: "mandiGates",
  //       labelKey: "menu.mandiGates",
  //       path: "/mandi-gates",
  //       icon: React.createElement(StoreMallDirectoryOutlinedIcon),
  //       resourceKey: "mandi_gates.menu",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR", "VIEWER"],
  //     },
  //     {
  //       key: "mandiHours",
  //       labelKey: "menu.mandiHoursTemplates",
  //       path: "/mandi-hours-templates",
  //       icon: React.createElement(Inventory2OutlinedIcon),
  //       resourceKey: "mandi_hours.menu",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR"],
  //     },
  //   ],
  // },
  {
  key: "mandisGroup",
  labelKey: "menu.mandis",
  icon: React.createElement(StoreMallDirectoryOutlinedIcon),
  roles: ALL_ROLES,
  children: [
    {
      key: "mandis",
      labelKey: "menu.mandisList",  // 👈 changed
      path: "/mandis",
      icon: React.createElement(StoreMallDirectoryOutlinedIcon),
      resourceKey: "mandis.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR", "VIEWER"],
    },
    {
      key: "commodities",
      labelKey: "menu.commodities",
      path: "/masters/commodities",
      icon: React.createElement(StoreMallDirectoryOutlinedIcon),
      resourceKey: "commodities_masters.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR", "VIEWER"],
    },
    {
      key: "commodityProducts",
      labelKey: "menu.commodityProducts",
      path: "/masters/commodity-products",
      icon: React.createElement(StoreMallDirectoryOutlinedIcon),
      resourceKey: "commodity_products_masters.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR", "VIEWER"],
    },
    {
      key: "mandiCommodityProducts",
      labelKey: "menu.mandiCommodityProducts",
      path: "/masters/mandi-products",
      icon: React.createElement(StoreMallDirectoryOutlinedIcon),
      resourceKey: "mandi_commodity_products_masters.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR", "VIEWER"],
    },
    {
      key: "mandiFacilities",
      labelKey: "menu.mandiFacilities",
      path: "/mandi-facilities",
      icon: React.createElement(Inventory2OutlinedIcon),
      resourceKey: "mandi_facilities.menu",
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
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR"],
    },
  ],
},

  // {
  //   key: "gateYard",
  //   labelKey: "menu.gateEntryReasons",
  //   icon: React.createElement(QrCodeScannerOutlinedIcon),
  //   roles: ALL_ROLES,
  //   children: [
  //     {
  //       key: "gateEntryReasons",
  //       labelKey: "menu.gateEntryReasons",
  //       path: "/gate-entry-reasons",
  //       icon: React.createElement(QrCodeScannerOutlinedIcon),
  //       resourceKey: "gate_entry_reasons_masters.menu",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
  //     },
  //     {
  //       key: "gateVehicleTypes",
  //       labelKey: "menu.gateVehicleTypes",
  //       path: "/gate-vehicle-types",
  //       icon: React.createElement(QrCodeScannerOutlinedIcon),
  //       resourceKey: "gate_vehicle_types_masters.menu",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
  //     },
  //     {
  //       key: "gateDevices",
  //       labelKey: "menu.gateDevices",
  //       path: "/gate-devices",
  //       icon: React.createElement(QrCodeScannerOutlinedIcon),
  //       resourceKey: "cm_gate_devices.menu",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
  //     },
  //     {
  //       key: "gateDeviceConfigs",
  //       labelKey: "menu.gateDeviceConfigs",
  //       path: "/gate-device-configs",
  //       icon: React.createElement(QrCodeScannerOutlinedIcon),
  //       resourceKey: "gate_device_configs.menu",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
  //     },
  //     {
  //       key: "gateTokens",
  //       labelKey: "menu.gateTokens",
  //       path: "/gate-tokens",
  //       icon: React.createElement(QrCodeScannerOutlinedIcon),
  //       resourceKey: "gate_pass_tokens.view",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
  //     },
  //     {
  //       key: "gateMovements",
  //       labelKey: "menu.gateMovements",
  //       path: "/gate-movements",
  //       icon: React.createElement(TimelineOutlinedIcon),
  //       resourceKey: "gate_movements_log.view",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
  //     },
  //     {
  //       key: "weighmentTickets",
  //       labelKey: "menu.weighmentTickets",
  //       path: "/weighment-tickets",
  //       icon: React.createElement(ScaleOutlinedIcon),
  //       resourceKey: "weighment_tickets.view",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
  //     },
  //   ],
  // },

{
  key: "gateYard",
  labelKey: "menu.gateYard",
  icon: React.createElement(QrCodeScannerOutlinedIcon),
  roles: ALL_ROLES,
  children: [
    {
      key: "gateEntryReasons",
      labelKey: "menu.gateEntryReasonsMaster",  // 👈 changed
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
      key: "mandiGates",
      labelKey: "menu.mandiGates",
      path: "/mandi-gates",
      icon: React.createElement(QrCodeScannerOutlinedIcon),
      resourceKey: "mandi_gates.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
    },
    {
      key: "gateDevices",
      labelKey: "menu.gateDevices",
      path: "/gate-devices",
      icon: React.createElement(QrCodeScannerOutlinedIcon),
      // Use legacy key to match current policy assignments (canonical: gate_devices.menu)
      resourceKey: "gate_devices.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
    },
    {
      key: "gateDeviceConfigs",
      labelKey: "menu.gateDeviceConfigs",
      path: "/gate-device-configs",
      icon: React.createElement(QrCodeScannerOutlinedIcon),
      resourceKey: "gate_device_configs.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
    },
    {
      key: "gateEntries",
      labelKey: "menu.gateEntries",
      path: "/gate-tokens",
      icon: React.createElement(TimelineOutlinedIcon),
      resourceKey: "gate_entry_tokens.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "GATE_OPERATOR", "WEIGHBRIDGE_OPERATOR"],
    },
    {
      key: "preMarketListings",
      labelKey: "menu.preMarketListings",
      path: "/pre-market-listings",
      icon: React.createElement(Inventory2OutlinedIcon),
      resourceKey: "pre_market_listings.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "GATE_OPERATOR", "WEIGHBRIDGE_OPERATOR"],
    },
    {
      key: "stallFees",
      labelKey: "menu.stallFees",
      path: "/stall-fees",
      icon: React.createElement(Inventory2OutlinedIcon),
      resourceKey: "stall_fees.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "GATE_OPERATOR", "WEIGHBRIDGE_OPERATOR"],
    },
    {
      key: "marketPrices",
      labelKey: "menu.marketPrices",
      path: "/market-prices",
      icon: React.createElement(PriceChangeOutlinedIcon),
      resourceKey: "market_prices.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "GATE_OPERATOR", "WEIGHBRIDGE_OPERATOR"],
    },
    {
      key: "mandiPricePolicies",
      labelKey: "menu.mandiPricePolicies",
      path: "/mandi-price-policies",
      icon: React.createElement(PriceChangeOutlinedIcon),
      resourceKey: "mandi_price_policies.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
    },
    {
      key: "mandiSettings",
      labelKey: "menu.mandiSettings",
      path: "/mandi-settings",
      icon: React.createElement(Inventory2OutlinedIcon),
      resourceKey: "mandi_settings.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
    },
    {
      key: "transportIntents",
      labelKey: "menu.transportIntents",
      path: "/transport-intents",
      icon: React.createElement(Inventory2OutlinedIcon),
      resourceKey: "transport_intents.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "GATE_OPERATOR", "WEIGHBRIDGE_OPERATOR"],
    },
    {
      key: "mandiAssociations",
      labelKey: "menu.mandiAssociations",
      path: "/mandi-associations",
      icon: React.createElement(TimelineOutlinedIcon),
      resourceKey: "mandi_associations.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
    },
    {
      key: "gateMovements",
      labelKey: "menu.gateMovements",
      path: "/gate-movements",
      icon: React.createElement(TimelineOutlinedIcon),
      resourceKey: "gate_movements_log.view",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "GATE_OPERATOR", "WEIGHBRIDGE_OPERATOR"],
    },
    {
      key: "weighmentTickets",
      labelKey: "menu.weighmentTickets",
      path: "/weighment-tickets",
      icon: React.createElement(ScaleOutlinedIcon),
      resourceKey: "weighment_tickets.view",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "WEIGHBRIDGE_OPERATOR"],
    },
  ],
},

  // {
  //   key: "auctions",
  //   labelKey: "menu.auctionMethods",
  //   icon: React.createElement(GavelOutlinedIcon),
  //   roles: ALL_ROLES,
  //   children: [
  //     {
  //       key: "auctionMethods",
  //       labelKey: "menu.auctionMethods",
  //       path: "/auction-methods",
  //       icon: React.createElement(GavelOutlinedIcon),
  //       resourceKey: "auction_methods_masters.menu",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN"],
  //     },
  //     {
  //       key: "auctionRounds",
  //       labelKey: "menu.auctionRounds",
  //       path: "/auction-rounds",
  //       icon: React.createElement(GavelOutlinedIcon),
  //       resourceKey: "auction_rounds_masters.menu",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN"],
  //     },
  //     {
  //       key: "auctionPolicies",
  //       labelKey: "menu.auctionPolicies",
  //       path: "/auction-policies",
  //       icon: React.createElement(GavelOutlinedIcon),
  //       resourceKey: "cm_mandi_auction_policies.menu",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN"],
  //     },
  //     {
  //       key: "auctionSessions",
  //       labelKey: "menu.auctionSessions",
  //       path: "/auction-sessions",
  //       icon: React.createElement(GavelOutlinedIcon),
  //       resourceKey: "auction_sessions.menu",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUDITOR"],
  //     },
  //     {
  //       key: "auctionLots",
  //       labelKey: "menu.auctionLots",
  //       path: "/auction-lots",
  //       icon: React.createElement(GavelOutlinedIcon),
  //       resourceKey: "auction_lots.menu",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUDITOR"],
  //     },
  //     {
  //       key: "auctionResults",
  //       labelKey: "menu.auctionResults",
  //       path: "/auction-results",
  //       icon: React.createElement(GavelOutlinedIcon),
  //       resourceKey: "auction_results.menu",
  //       requiredAction: "VIEW",
  //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUDITOR"],
  //     },
  //   ],
  // },

{
  key: "auctions",
  labelKey: "menu.auctionMethods",
  icon: React.createElement(GavelOutlinedIcon),
  roles: ALL_ROLES,
  children: [
    {
      key: "auctionMethods",
      labelKey: "menu.auctionMethodsMaster",  // 👈 changed
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
      resourceKey: "auction_policies_masters.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN"],
    },
    {
      key: "auctionSettings",
      labelKey: "menu.auctionSettings",
      labelOverride: "Auction Settings",
      path: "/auction-settings",
      icon: React.createElement(SettingsOutlinedIcon),
      resourceKey: "mandi_settings.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
    },
    {
      key: "auctionSessions",
      labelKey: "menu.auctionSessions",
      path: "/auction-sessions",
      icon: React.createElement(GavelOutlinedIcon),
      resourceKey: "auction_sessions.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUCTIONEER", "AUDITOR"],
    },
    {
      key: "auctionLots",
      labelKey: "menu.auctionLots",
      path: "/auction-lots",
      icon: React.createElement(GavelOutlinedIcon),
      resourceKey: "auction_lots.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUCTIONEER", "AUDITOR"],
    },
    {
      key: "lots",
      labelKey: "menu.lots",
      path: "/lots",
      icon: React.createElement(Inventory2OutlinedIcon),
      resourceKey: "lots.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUCTIONEER", "AUDITOR"],
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
  key: "parties",
  labelKey: "menu.traderApprovals",
  icon: React.createElement(TaskAltOutlinedIcon),
  roles: ALL_ROLES,
  children: [
    {
      key: "traderApprovals",
      labelKey: "menu.traderApprovalQueue",  // 👈 changed
      path: "/trader-approvals",
      icon: React.createElement(TaskAltOutlinedIcon),
      resourceKey: "trader_approvals.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
    },
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
      labelKey: "menu.farmerApprovals",
      path: "/farmer-approvals",
      icon: React.createElement(BadgeOutlinedIcon),
      resourceKey: "farmer_approvals.menu",
      requiredAction: "VIEW",
      roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
    },
  ],
},



  {
    key: "payments",
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
    icon: React.createElement(MapOutlinedIcon),
    roles: ALL_ROLES,
    children: [
      {
        key: "mandiCoverage",
        labelKey: "menu.mandiCoverage",
        path: "/mandi-coverage",
        icon: React.createElement(MapOutlinedIcon),
        resourceKey: "mandi_coverage.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR", "VIEWER"],
      },
      {
        key: "mandiPrices",
        labelKey: "menu.mandiPrices",
        path: "/mandi-prices",
        icon: React.createElement(PriceChangeOutlinedIcon),
        resourceKey: "mandi_prices.menu",
        requiredAction: "VIEW",
        roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "MANDI_ADMIN", "MANDI_MANAGER", "AUCTIONEER", "AUDITOR", "VIEWER"],
      },
    ],
  },
];

function cloneMenuItem(item: AppMenuItem, overrides: Partial<AppMenuItem> = {}): AppMenuItem {
  return {
    ...item,
    ...overrides,
  };
}

function filterHierarchy(
  items: AppMenuItem[],
  predicate: (item: AppMenuItem, hasChildren: boolean) => boolean,
): AppMenuItem[] {
  const results: AppMenuItem[] = [];
  for (const item of items) {
    const filteredChildren = item.children ? filterHierarchy(item.children, predicate) : [];
    const hasChildren = filteredChildren.length > 0;
    const visible = predicate(item, hasChildren) || hasChildren;
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

  return filterHierarchy(APP_MENU, (item, hasChildren) => {
    // For group containers without their own permission role check, hide if no visible children.
    if (!item.path && !item.resourceKey && !hasChildren) return false;
    if (!item.roles || item.roles.length === 0) return true;
    return item.roles.includes(effectiveRole);
  });
}

function findMenuItemByResourceKey(
  items: AppMenuItem[],
  targetResourceKey: string,
): AppMenuItem | null {
  const target = canonicalizeResourceKey(targetResourceKey);
  for (const item of items) {
    if (canonicalizeResourceKey(item.resourceKey) === target) {
      return item;
    }
    if (item.children?.length) {
      const childMatch = findMenuItemByResourceKey(item.children, targetResourceKey);
      if (childMatch) return childMatch;
    }
  }
  return null;
}

export function filterMenuByResources(
  resources: UiResource[] | undefined,
  fallbackRole: RoleSlug | null,
  permissionsMap?: Record<string, Set<string>>,
) {
  try {
    const hasResources = Array.isArray(resources) && resources.length > 0;
    if (!hasResources) {
      return [];
    }
    const hasPermissions =
      permissionsMap && Object.keys(permissionsMap).length > 0;
    // If permissions have not been loaded yet, do not render a temporary menu –
    // this avoids the “full menu then collapse” flicker for limited roles.
    if (!hasPermissions) {
      return [];
    }
    const allowedMenus = computeAllowedSidebar(resources, permissionsMap!);
    const byKey = new Map<string, UiResource>();
    allowedMenus.forEach((res) => {
      if (res.resource_key) byKey.set(canonicalizeResourceKey(res.resource_key), res);
    });

    const lang =
      (typeof navigator !== "undefined" && navigator.language
        ? navigator.language.split("-")[0]
        : "en") || "en";

    const freezeItems = MENU_FREEZE.filter((item) => item && item.resource_key);

    type MenuItemRow = AppMenuItem & { order: number; category: string; resource: UiResource };
    const items: MenuItemRow[] = [];
    freezeItems.forEach((freeze) => {
      const key = canonicalizeResourceKey(freeze.resource_key);
      const resource = byKey.get(key);
      if (!resource) return;
      if (freeze.is_active === false) return; // keep active only
      const labelOverride = freeze.menu_name || getResourceLabel(resource, lang);
      const labelKey = freeze.i18n_key || resource.i18n_label_key || resource.resource_key || freeze.resource_key;
      const path = freeze.route || "";
      const disabled = !path;
      items.push({
        key: String(freeze.resource_key),
        labelKey: String(labelKey),
        labelOverride: String(labelOverride),
        path: disabled ? undefined : String(path),
        icon: resolveMenuIcon(freeze.icon_key || (resource as any).icon_key, freeze.resource_key),
        resourceKey: String(freeze.resource_key),
        requiredAction: "VIEW",
        order: typeof freeze.order === "number" ? freeze.order : 9999,
        category: String(freeze.category || ""),
        disabled,
        resource,
      });
    });

    const systemCapacityControlItem = findMenuItemByResourceKey(APP_MENU, "capacity_control.menu");
    const systemCapacityControlKey = canonicalizeResourceKey("capacity_control.menu");
    const systemCapacityControlPermissionMatch = Boolean(
      permissionsMap?.[systemCapacityControlKey]?.has("VIEW"),
    );
    const systemCapacityControlRoleMatch = Boolean(
      !systemCapacityControlItem?.roles?.length ||
        (fallbackRole && systemCapacityControlItem.roles.includes(fallbackRole as RoleSlug)),
    );
    const systemCapacityControlResource = byKey.get(systemCapacityControlKey);

    if (
      systemCapacityControlItem &&
      systemCapacityControlPermissionMatch &&
      systemCapacityControlRoleMatch &&
      !items.some((item) => canonicalizeResourceKey(item.resourceKey) === systemCapacityControlKey)
    ) {
      items.push({
        key: String(systemCapacityControlItem.key || systemCapacityControlKey),
        labelKey: String(systemCapacityControlItem.labelKey),
        labelOverride: systemCapacityControlItem.labelOverride,
        path: systemCapacityControlItem.path,
        icon: systemCapacityControlItem.icon,
        resourceKey: "capacity_control.menu",
        requiredAction: "VIEW",
        order: typeof systemCapacityControlItem.order === "number" ? systemCapacityControlItem.order : 9999,
        category: "System",
        disabled: !systemCapacityControlItem.path,
        resource: systemCapacityControlResource || {
          resource_key: "capacity_control.menu",
          ui_type: "MENU",
          allowed_actions: ["VIEW"],
        },
      });
    }

    const categories = new Map<string, { label: string; order: number; items: MenuItemRow[] }>();
    const categoryOrder = new Map<string, number>();
    freezeItems.forEach((f, idx) => {
      const name = String(f.category || "");
      if (!name) return;
      if (!categoryOrder.has(name)) categoryOrder.set(name, idx);
    });

    items.forEach((item) => {
      const categoryName = item.category || "System";
      if (!categories.has(categoryName)) {
        categories.set(categoryName, {
          label: categoryName,
          order: categoryOrder.get(categoryName) ?? 9999,
          items: [],
        });
      }
      categories.get(categoryName)!.items.push(item);
    });

    const grouped = Array.from(categories.entries())
      .map(([key, value]) => {
      const children = value.items
        .sort((a, b) => {
          if ((a as any).order !== (b as any).order) return (a as any).order - (b as any).order;
          return String(a.labelOverride || a.labelKey).localeCompare(String(b.labelOverride || b.labelKey));
        })
        .map((item) => {
          const { order, category, resource, ...rest } = item;
          return rest;
        });
        return {
          key: `category-${key}`,
          labelKey: `menu.category.${key}`,
          labelOverride: value.label,
          children,
          order: value.order,
        };
      })
      .filter((group) => group.children.length > 0)
      .sort((a, b) => a.order - b.order)
      .map(({ order, ...rest }) => rest);

    return grouped as AppMenuItem[];
  } catch (e) {
    console.error("[sidebar] build failed", e, { sample: (resources || []).slice(0, 5) });
    return [];
  }
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
// import QrCodeScannerOutlinedIcon from "@mui/icons-material/QrCodeScannerOutlined";
// import ScaleOutlinedIcon from "@mui/icons-material/ScaleOutlined";
// import TimelineOutlinedIcon from "@mui/icons-material/TimelineOutlined";
// import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
// import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
// import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
// import AccountBalanceOutlinedIcon from "@mui/icons-material/AccountBalanceOutlined";
// import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
// import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
// import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
// import { type UiResource } from "../utils/adminUiConfig";
// import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";

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

// export type AppMenuItem = {
//   key?: string;
//   labelKey: string;
//   path?: string;
//   icon?: React.ReactNode;
//   resourceKey?: string;
//   requiredAction?: string;
//   roles?: RoleSlug[];
//   children?: AppMenuItem[];
// };

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

// export const APP_MENU: AppMenuItem[] = [
//   {
//     key: "dashboard",
//     labelKey: "menu.dashboard",
//     path: "/dashboard",
//     icon: React.createElement(DashboardOutlinedIcon),
//     resourceKey: "dashboard.menu",
//     requiredAction: "VIEW",
//     roles: ALL_ROLES,
//   },
  
//   // {
//   //   key: "organisationsAccess",
//   //   labelKey: "menu.organisations",
//   //   icon: React.createElement(ApartmentOutlinedIcon),
//   //   roles: ALL_ROLES,
//   //   children: [
//   //     {
//   //       key: "organisations",
//   //       labelKey: "menu.organisations",
//   //       path: "/orgs",
//   //       icon: React.createElement(ApartmentOutlinedIcon),
//   //       resourceKey: "organisations.menu",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "AUDITOR"],
//   //     },
//   //     {
//   //       key: "orgMandiMapping",
//   //       labelKey: "menu.orgMandi",
//   //       path: "/org-mandi-mapping",
//   //       icon: React.createElement(HubOutlinedIcon),
//   //       resourceKey: "org_mandi_mapping.menu",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "AUDITOR"],
//   //     },
//   //     {
//   //       key: "adminUsers",
//   //       labelKey: "menu.adminUsers",
//   //       path: "/admin-users",
//   //       icon: React.createElement(GroupsOutlinedIcon),
//   //       resourceKey: "admin_users.menu",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN"],
//   //     },
//   //   ],
//   // },

//   {
//   key: "organisationsAccess",
//   labelKey: "menu.organisations",
//   icon: React.createElement(ApartmentOutlinedIcon),
//   roles: ALL_ROLES,
//   children: [
//     {
//       key: "organisations",
//       labelKey: "menu.organisationsList",   // 👈 changed
//       path: "/orgs",
//       icon: React.createElement(ApartmentOutlinedIcon),
//       resourceKey: "organisations.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "AUDITOR"],
//     },
//     {
//       key: "orgMandiMapping",
//       labelKey: "menu.orgMandi",
//       path: "/org-mandi-mapping",
//       icon: React.createElement(HubOutlinedIcon),
//       resourceKey: "org_mandi_mapping.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "AUDITOR"],
//     },
//     {
//       key: "adminUsers",
//       labelKey: "menu.adminUsers",
//       path: "/admin-users",
//       icon: React.createElement(GroupsOutlinedIcon),
//       resourceKey: "admin_users.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN"],
//     },
//   ],
// },

//   {
//     key: "system",
//     labelKey: "menu.system",
//     icon: React.createElement(SettingsOutlinedIcon),
//     roles: ["SUPER_ADMIN"],
//     children: [
//       {
//         key: "userRoleManager",
//         labelKey: "menu.userRoleManager",
//         path: "/system/user-role-manager",
//         icon: React.createElement(SecurityOutlinedIcon),
//         resourceKey: "user_roles.menu",
//         requiredAction: "VIEW",
//         roles: ["SUPER_ADMIN"],
//       },
//       {
//         key: "rolesPermissions",
//         labelKey: "menu.rolePermissions",
//         path: "/system/role-policy-manager",
//         icon: React.createElement(SecurityOutlinedIcon),
//         resourceKey: "menu.role_policies",
//         requiredAction: "VIEW",
//         roles: ["SUPER_ADMIN"],
//       },
//       {
//         key: "resourceRegistry",
//         labelKey: "menu.resourceRegistry",
//         path: "/system/resource-registry",
//         icon: React.createElement(SecurityOutlinedIcon),
//         resourceKey: "resource_registry.menu",
//         requiredAction: "VIEW",
//         roles: ["SUPER_ADMIN"],
//       },
//     ],
//   },



//   // {
//   //   key: "mandisGroup",
//   //   labelKey: "menu.mandis",
//   //   icon: React.createElement(StoreMallDirectoryOutlinedIcon),
//   //   roles: ALL_ROLES,
//   //   children: [
//   //     {
//   //       key: "mandis",
//   //       labelKey: "menu.mandis",
//   //       path: "/mandis",
//   //       icon: React.createElement(StoreMallDirectoryOutlinedIcon),
//   //       resourceKey: "mandis.menu",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR", "VIEWER"],
//   //     },
//   //     {
//   //       key: "commodities",
//   //       labelKey: "menu.commodities",
//   //       path: "/commodities",
//   //       icon: React.createElement(StoreMallDirectoryOutlinedIcon),
//   //       resourceKey: "commodities_masters.menu",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR"],
//   //     },
//   //     {
//   //       key: "commodityProducts",
//   //       labelKey: "menu.commodityProducts",
//   //       path: "/commodity-products",
//   //       icon: React.createElement(StoreMallDirectoryOutlinedIcon),
//   //       resourceKey: "commodity_products_masters.menu",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR"],
//   //     },
//   //     {
//   //       key: "mandiFacilities",
//   //       labelKey: "menu.mandiFacilities",
//   //       path: "/mandi-facilities",
//   //       icon: React.createElement(StoreMallDirectoryOutlinedIcon),
//   //       resourceKey: "mandi_facilities.menu",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR"],
//   //     },
//   //     {
//   //       key: "mandiGates",
//   //       labelKey: "menu.mandiGates",
//   //       path: "/mandi-gates",
//   //       icon: React.createElement(StoreMallDirectoryOutlinedIcon),
//   //       resourceKey: "mandi_gates.menu",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR", "VIEWER"],
//   //     },
//   //     {
//   //       key: "mandiHours",
//   //       labelKey: "menu.mandiHoursTemplates",
//   //       path: "/mandi-hours-templates",
//   //       icon: React.createElement(Inventory2OutlinedIcon),
//   //       resourceKey: "mandi_hours.menu",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR"],
//   //     },
//   //   ],
//   // },
//   {
//   key: "mandisGroup",
//   labelKey: "menu.mandis",
//   icon: React.createElement(StoreMallDirectoryOutlinedIcon),
//   roles: ALL_ROLES,
//   children: [
//     {
//       key: "mandis",
//       labelKey: "menu.mandisList",  // 👈 changed
//       path: "/mandis",
//       icon: React.createElement(StoreMallDirectoryOutlinedIcon),
//       resourceKey: "mandis.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR", "VIEWER"],
//     },
//     {
//       key: "commodities",
//       labelKey: "menu.commodities",
//       path: "/commodities",
//       icon: React.createElement(StoreMallDirectoryOutlinedIcon),
//       resourceKey: "commodities_masters.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR", "VIEWER"],
//     },
//     {
//       key: "commodityProducts",
//       labelKey: "menu.commodityProducts",
//       path: "/commodity-products",
//       icon: React.createElement(StoreMallDirectoryOutlinedIcon),
//       resourceKey: "commodity_products_masters.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR", "VIEWER"],
//     },
//     {
//       key: "mandiFacilities",
//       labelKey: "menu.mandiFacilities",
//       path: "/mandi-facilities",
//       icon: React.createElement(Inventory2OutlinedIcon),
//       resourceKey: "mandi_facilities.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR", "VIEWER"],
//     },
//     {
//       key: "mandiHours",
//       labelKey: "menu.mandiHoursTemplates",
//       path: "/mandi-hours-templates",
//       icon: React.createElement(Inventory2OutlinedIcon),
//       resourceKey: "mandi_hours.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR"],
//     },
//   ],
// },

//   // {
//   //   key: "gateYard",
//   //   labelKey: "menu.gateEntryReasons",
//   //   icon: React.createElement(QrCodeScannerOutlinedIcon),
//   //   roles: ALL_ROLES,
//   //   children: [
//   //     {
//   //       key: "gateEntryReasons",
//   //       labelKey: "menu.gateEntryReasons",
//   //       path: "/gate-entry-reasons",
//   //       icon: React.createElement(QrCodeScannerOutlinedIcon),
//   //       resourceKey: "gate_entry_reasons_masters.menu",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
//   //     },
//   //     {
//   //       key: "gateVehicleTypes",
//   //       labelKey: "menu.gateVehicleTypes",
//   //       path: "/gate-vehicle-types",
//   //       icon: React.createElement(QrCodeScannerOutlinedIcon),
//   //       resourceKey: "gate_vehicle_types_masters.menu",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
//   //     },
//   //     {
//   //       key: "gateDevices",
//   //       labelKey: "menu.gateDevices",
//   //       path: "/gate-devices",
//   //       icon: React.createElement(QrCodeScannerOutlinedIcon),
//   //       resourceKey: "cm_gate_devices.menu",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
//   //     },
//   //     {
//   //       key: "gateDeviceConfigs",
//   //       labelKey: "menu.gateDeviceConfigs",
//   //       path: "/gate-device-configs",
//   //       icon: React.createElement(QrCodeScannerOutlinedIcon),
//   //       resourceKey: "gate_device_configs.menu",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
//   //     },
//   //     {
//   //       key: "gateTokens",
//   //       labelKey: "menu.gateTokens",
//   //       path: "/gate-tokens",
//   //       icon: React.createElement(QrCodeScannerOutlinedIcon),
//   //       resourceKey: "gate_pass_tokens.view",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
//   //     },
//   //     {
//   //       key: "gateMovements",
//   //       labelKey: "menu.gateMovements",
//   //       path: "/gate-movements",
//   //       icon: React.createElement(TimelineOutlinedIcon),
//   //       resourceKey: "gate_movements_log.view",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
//   //     },
//   //     {
//   //       key: "weighmentTickets",
//   //       labelKey: "menu.weighmentTickets",
//   //       path: "/weighment-tickets",
//   //       icon: React.createElement(ScaleOutlinedIcon),
//   //       resourceKey: "weighment_tickets.view",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
//   //     },
//   //   ],
//   // },

// {
//   key: "gateYard",
//   labelKey: "menu.gateYard",
//   icon: React.createElement(QrCodeScannerOutlinedIcon),
//   roles: ALL_ROLES,
//   children: [
//     {
//       key: "gateEntryReasons",
//       labelKey: "menu.gateEntryReasonsMaster",  // 👈 changed
//       path: "/gate-entry-reasons",
//       icon: React.createElement(QrCodeScannerOutlinedIcon),
//       resourceKey: "gate_entry_reasons_masters.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
//     },
//     {
//       key: "gateVehicleTypes",
//       labelKey: "menu.gateVehicleTypes",
//       path: "/gate-vehicle-types",
//       icon: React.createElement(QrCodeScannerOutlinedIcon),
//       resourceKey: "gate_vehicle_types_masters.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
//     },
//     {
//       key: "mandiGates",
//       labelKey: "menu.mandiGates",
//       path: "/mandi-gates",
//       icon: React.createElement(QrCodeScannerOutlinedIcon),
//       resourceKey: "mandi_gates.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
//     },
//     {
//       key: "gateDevices",
//       labelKey: "menu.gateDevices",
//       path: "/gate-devices",
//       icon: React.createElement(QrCodeScannerOutlinedIcon),
//       resourceKey: "cm_gate_devices.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
//     },
//     {
//       key: "gateDeviceConfigs",
//       labelKey: "menu.gateDeviceConfigs",
//       path: "/gate-device-configs",
//       icon: React.createElement(QrCodeScannerOutlinedIcon),
//       resourceKey: "gate_device_configs.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
//     },
//     {
//       key: "gateTokens",
//       labelKey: "menu.gateTokens",
//       path: "/gate-tokens",
//       icon: React.createElement(QrCodeScannerOutlinedIcon),
//       resourceKey: "gate_pass_tokens.view",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "GATE_OPERATOR"],
//     },
//     {
//       key: "gateEntries",
//       labelKey: "menu.gateEntries",
//       path: "/gate-entries",
//       icon: React.createElement(TimelineOutlinedIcon),
//       resourceKey: "gate_entry_tokens.list",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "GATE_OPERATOR"],
//     },
//     {
//       key: "gateMovements",
//       labelKey: "menu.gateMovements",
//       path: "/gate-movements",
//       icon: React.createElement(TimelineOutlinedIcon),
//       resourceKey: "gate_movements_log.view",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
//     },
//     {
//       key: "weighmentTickets",
//       labelKey: "menu.weighmentTickets",
//       path: "/weighment-tickets",
//       icon: React.createElement(ScaleOutlinedIcon),
//       resourceKey: "weighment_tickets.view",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
//     },
//   ],
// },

//   // {
//   //   key: "auctions",
//   //   labelKey: "menu.auctionMethods",
//   //   icon: React.createElement(GavelOutlinedIcon),
//   //   roles: ALL_ROLES,
//   //   children: [
//   //     {
//   //       key: "auctionMethods",
//   //       labelKey: "menu.auctionMethods",
//   //       path: "/auction-methods",
//   //       icon: React.createElement(GavelOutlinedIcon),
//   //       resourceKey: "auction_methods_masters.menu",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN"],
//   //     },
//   //     {
//   //       key: "auctionRounds",
//   //       labelKey: "menu.auctionRounds",
//   //       path: "/auction-rounds",
//   //       icon: React.createElement(GavelOutlinedIcon),
//   //       resourceKey: "auction_rounds_masters.menu",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN"],
//   //     },
//   //     {
//   //       key: "auctionPolicies",
//   //       labelKey: "menu.auctionPolicies",
//   //       path: "/auction-policies",
//   //       icon: React.createElement(GavelOutlinedIcon),
//   //       resourceKey: "cm_mandi_auction_policies.menu",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN"],
//   //     },
//   //     {
//   //       key: "auctionSessions",
//   //       labelKey: "menu.auctionSessions",
//   //       path: "/auction-sessions",
//   //       icon: React.createElement(GavelOutlinedIcon),
//   //       resourceKey: "auction_sessions.menu",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUDITOR"],
//   //     },
//   //     {
//   //       key: "auctionLots",
//   //       labelKey: "menu.auctionLots",
//   //       path: "/auction-lots",
//   //       icon: React.createElement(GavelOutlinedIcon),
//   //       resourceKey: "auction_lots.menu",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUDITOR"],
//   //     },
//   //     {
//   //       key: "auctionResults",
//   //       labelKey: "menu.auctionResults",
//   //       path: "/auction-results",
//   //       icon: React.createElement(GavelOutlinedIcon),
//   //       resourceKey: "auction_results.menu",
//   //       requiredAction: "VIEW",
//   //       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUDITOR"],
//   //     },
//   //   ],
//   // },

// {
//   key: "auctions",
//   labelKey: "menu.auctionMethods",
//   icon: React.createElement(GavelOutlinedIcon),
//   roles: ALL_ROLES,
//   children: [
//     {
//       key: "auctionMethods",
//       labelKey: "menu.auctionMethodsMaster",  // 👈 changed
//       path: "/auction-methods",
//       icon: React.createElement(GavelOutlinedIcon),
//       resourceKey: "auction_methods_masters.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN"],
//     },
//     {
//       key: "auctionRounds",
//       labelKey: "menu.auctionRounds",
//       path: "/auction-rounds",
//       icon: React.createElement(GavelOutlinedIcon),
//       resourceKey: "auction_rounds_masters.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN"],
//     },
//     {
//       key: "auctionPolicies",
//       labelKey: "menu.auctionPolicies",
//       path: "/auction-policies",
//       icon: React.createElement(GavelOutlinedIcon),
//       resourceKey: "auction_policies_masters.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN"],
//     },
//     {
//       key: "auctionSessions",
//       labelKey: "menu.auctionSessions",
//       path: "/auction-sessions",
//       icon: React.createElement(GavelOutlinedIcon),
//       resourceKey: "auction_sessions.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUCTIONEER", "AUDITOR"],
//     },
//     {
//       key: "auctionLots",
//       labelKey: "menu.auctionLots",
//       path: "/auction-lots",
//       icon: React.createElement(GavelOutlinedIcon),
//       resourceKey: "auction_lots.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUCTIONEER", "AUDITOR"],
//     },
//     {
//       key: "auctionResults",
//       labelKey: "menu.auctionResults",
//       path: "/auction-results",
//       icon: React.createElement(GavelOutlinedIcon),
//       resourceKey: "auction_results.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUDITOR"],
//     },
//   ],
// },




// {
//   key: "parties",
//   labelKey: "menu.traderApprovals",
//   icon: React.createElement(TaskAltOutlinedIcon),
//   roles: ALL_ROLES,
//   children: [
//     {
//       key: "traderApprovals",
//       labelKey: "menu.traderApprovalQueue",  // 👈 changed
//       path: "/trader-approvals",
//       icon: React.createElement(TaskAltOutlinedIcon),
//       resourceKey: "trader_approvals.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"],
//     },
//     {
//       key: "traders",
//       labelKey: "menu.traders",
//       path: "/traders",
//       icon: React.createElement(BadgeOutlinedIcon),
//       resourceKey: "traders.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "ORG_VIEWER", "AUDITOR"],
//     },
//     {
//       key: "farmers",
//       labelKey: "menu.farmers",
//       path: "/farmers",
//       icon: React.createElement(BadgeOutlinedIcon),
//       resourceKey: "farmers.menu",
//       requiredAction: "VIEW",
//       roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "ORG_VIEWER", "AUDITOR"],
//     },
//   ],
// },



//   {
//     key: "payments",
//     labelKey: "menu.paymentsAndSettlements",
//     icon: React.createElement(AccountBalanceWalletOutlinedIcon),
//     roles: ALL_ROLES,
//     children: [
//       {
//         key: "paymentModels",
//         labelKey: "menu.paymentModels",
//         path: "/payment-models",
//         icon: React.createElement(AccountBalanceWalletOutlinedIcon),
//         resourceKey: "payment_models.menu",
//         requiredAction: "VIEW",
//         roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
//       },
//       {
//         key: "orgPaymentSettings",
//         labelKey: "menu.orgPaymentSettings",
//         path: "/org-payment-settings",
//         icon: React.createElement(AccountBalanceOutlinedIcon),
//         resourceKey: "org_payment_settings.menu",
//         requiredAction: "VIEW",
//         roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
//       },
//       {
//         key: "mandiPaymentSettings",
//         labelKey: "menu.mandiPaymentSettings",
//         path: "/mandi-payment-settings",
//         icon: React.createElement(StoreMallDirectoryOutlinedIcon),
//         resourceKey: "mandi_payment_settings.menu",
//         requiredAction: "VIEW",
//         roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
//       },
//       {
//         key: "commodityFees",
//         labelKey: "menu.commodityFeeSettings",
//         path: "/commodity-fees",
//         icon: React.createElement(Inventory2OutlinedIcon),
//         resourceKey: "commodity_fees.menu",
//         requiredAction: "VIEW",
//         roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
//       },
//       {
//         key: "paymentModes",
//         labelKey: "menu.paymentModes",
//         path: "/payment-modes",
//         icon: React.createElement(SettingsOutlinedIcon),
//         resourceKey: "payment_modes.menu",
//         requiredAction: "VIEW",
//         roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
//       },
//       {
//         key: "customFees",
//         labelKey: "menu.customFees",
//         path: "/custom-fees",
//         icon: React.createElement(ReceiptLongOutlinedIcon),
//         resourceKey: "custom_fees.menu",
//         requiredAction: "VIEW",
//         roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
//       },
//       {
//         key: "roleCustomFees",
//         labelKey: "menu.roleCustomFees",
//         path: "/role-custom-fees",
//         icon: React.createElement(GroupsOutlinedIcon),
//         resourceKey: "role_custom_fees.menu",
//         requiredAction: "VIEW",
//         roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
//       },
//       {
//         key: "subscriptions",
//         labelKey: "menu.subscriptions",
//         path: "/subscriptions",
//         icon: React.createElement(AccountBalanceOutlinedIcon),
//         resourceKey: "subscriptions.menu",
//         requiredAction: "VIEW",
//         roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
//       },
//       {
//         key: "subscriptionInvoices",
//         labelKey: "menu.subscriptionInvoices",
//         path: "/subscription-invoices",
//         icon: React.createElement(ReceiptLongOutlinedIcon),
//         resourceKey: "subscription_invoices.menu",
//         requiredAction: "VIEW",
//         roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
//       },
//       {
//         key: "settlements",
//         labelKey: "menu.settlements",
//         path: "/settlements",
//         icon: React.createElement(AssessmentOutlinedIcon),
//         resourceKey: "settlements.menu",
//         requiredAction: "VIEW",
//         roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
//       },
//       {
//         key: "paymentsLog",
//         labelKey: "menu.paymentsLog",
//         path: "/payments-log",
//         icon: React.createElement(ReceiptLongOutlinedIcon),
//         resourceKey: "payments_log.menu",
//         requiredAction: "VIEW",
//         roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
//       },
//     ],
//   },




//   {
//     key: "reports",
//     labelKey: "menu.reports",
//     icon: React.createElement(MapOutlinedIcon),
//     roles: ALL_ROLES,
//     children: [
//       {
//         key: "mandiCoverage",
//         labelKey: "menu.mandiCoverage",
//         path: "/mandi-coverage",
//         icon: React.createElement(MapOutlinedIcon),
//         resourceKey: "mandi_coverage.menu",
//         requiredAction: "VIEW",
//         roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "MANDI_ADMIN", "MANDI_MANAGER", "AUDITOR", "VIEWER"],
//       },
//       {
//         key: "mandiPrices",
//         labelKey: "menu.mandiPrices",
//         path: "/mandi-prices",
//         icon: React.createElement(PriceChangeOutlinedIcon),
//         resourceKey: "mandi_prices.menu",
//         requiredAction: "VIEW",
//         roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "MANDI_ADMIN", "MANDI_MANAGER", "AUCTIONEER", "AUDITOR", "VIEWER"],
//       },
//     ],
//   },
// ];

// function cloneMenuItem(item: AppMenuItem, overrides: Partial<AppMenuItem> = {}): AppMenuItem {
//   return {
//     ...item,
//     ...overrides,
//   };
// }

// function filterHierarchy(
//   items: AppMenuItem[],
//   predicate: (item: AppMenuItem, hasChildren: boolean) => boolean,
// ): AppMenuItem[] {
//   const results: AppMenuItem[] = [];
//   for (const item of items) {
//     const filteredChildren = item.children ? filterHierarchy(item.children, predicate) : [];
//     const hasChildren = filteredChildren.length > 0;
//     const visible = predicate(item, hasChildren) || hasChildren;
//     if (visible) {
//       const node: AppMenuItem = cloneMenuItem(item, {
//         children: filteredChildren.length ? filteredChildren : undefined,
//       });
//       results.push(node);
//     }
//   }
//   return results;
// }

// export type MenuItem = AppMenuItem;

// export function filterMenuByRole(role: RoleSlug | null) {
//   const knownRole = role && ALL_ROLES.includes(role);
//   const effectiveRole: RoleSlug = knownRole ? role : "VIEWER";

//   if (!knownRole) {
//     console.warn(
//       "[menuConfig/filterMenuByRole] Unknown or missing role; using VIEWER fallback.",
//       { inputRole: role },
//     );
//   }

//   return filterHierarchy(APP_MENU, (item, hasChildren) => {
//     // For group containers without their own permission role check, hide if no visible children.
//     if (!item.path && !item.resourceKey && !hasChildren) return false;
//     if (!item.roles || item.roles.length === 0) return true;
//     return item.roles.includes(effectiveRole);
//   });
// }

// const normalizeKey = (key?: string | null) => {
//   if (!key) return "";
//   return String(key).trim().replace(/\s+/g, "").replace(/_{2,}/g, "_").toLowerCase();
// };

// export function filterMenuByResources(
//   resources: UiResource[] | undefined,
//   fallbackRole: RoleSlug | null,
//   permissionsMap?: Record<string, Set<string>>,
// ) {
//   try {
//     const hasResources = Array.isArray(resources) && resources.length > 0;
//     if (!hasResources) {
//       return [];
//     }
//     const hasPermissions =
//       permissionsMap && Object.keys(permissionsMap).length > 0;
//     // If permissions have not been loaded yet, do not render a temporary menu –
//     // this avoids the “full menu then collapse” flicker for limited roles.
//     if (!hasPermissions) {
//       return [];
//     }

//     let excludedNoRoute = 0;
//     let excludedNoGroup = 0;
