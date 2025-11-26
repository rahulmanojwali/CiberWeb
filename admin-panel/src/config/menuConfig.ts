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

// 🔹 All roles we want to support in CiberMandi admin
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
  labelKey: string;
  path: string;
  icon: React.ReactNode;
  roles: RoleSlug[]; // which roles can see this menu
};

// Helper: all roles (for items that everyone can see)
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
  // Dashboard – everyone gets a dashboard
  {
    labelKey: "menu.dashboard",
    path: "/",
    icon: React.createElement(DashboardOutlinedIcon),
    roles: ALL_ROLES,
  },

  // Organisations – platform / org level only
  {
    labelKey: "menu.organisations",
    path: "/orgs",
    icon: React.createElement(ApartmentOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "AUDITOR"],
  },

  // Org–Mandi mapping – platform / org level only
  {
    labelKey: "menu.orgMandi",
    path: "/org-mandi-mapping",
    icon: React.createElement(HubOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "AUDITOR"],
  },

  // Mandis master – visible to platform + org + mandi managers
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
    ],
  },

  // Admin users – only people who can manage users
  {
    labelKey: "menu.adminUsers",
    path: "/admin-users",
    icon: React.createElement(GroupsOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN"],
  },

  // Trader approvals – core mandi operations
  {
    labelKey: "menu.traderApprovals",
    path: "/trader-approvals",
    icon: React.createElement(TaskAltOutlinedIcon),
    roles: [
      "SUPER_ADMIN",
      "ORG_ADMIN",
      "MANDI_ADMIN",
      "MANDI_MANAGER",
      "AUCTIONEER",
    ],
  },

  // Reports – most roles can see some form of reporting
  {
    labelKey: "menu.reports",
    path: "/reports",
    icon: React.createElement(AssessmentOutlinedIcon),
    roles: ALL_ROLES,
  },

  // Mandi coverage – good for managers, viewers, auditors
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

  // Mandi prices – mainly mandi-related, but also useful for viewers
  {
    labelKey: "menu.mandiPrices",
    path: "/mandi-prices",
    icon: React.createElement(PriceChangeOutlinedIcon),
    roles: [
      "SUPER_ADMIN",
      "ORG_ADMIN",
      "MANDI_ADMIN",
      "MANDI_MANAGER",
      "AUDITOR",
      "VIEWER",
    ],
  },
];

// Filter helper used by Header + CustomSider
export function filterMenuByRole(role: RoleSlug | null) {
  if (!role) {
    // If for some reason we don't know the role, show a safe default –
    // you can change this to only VIEWER menus if you want.
    return menuItems;
  }
  return menuItems.filter((item) => item.roles.includes(role));
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
