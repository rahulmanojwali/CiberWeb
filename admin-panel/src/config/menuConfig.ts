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
    path: "/org-mandi-mapping",
    icon: React.createElement(HubOutlinedIcon),
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "ORG_VIEWER", "AUDITOR"],
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
    roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"],
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
