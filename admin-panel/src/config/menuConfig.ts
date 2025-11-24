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

export type RoleSlug = "SUPER_ADMIN" | "ORG_ADMIN" | "MANDI_ADMIN" | "AUDITOR";

export type MenuItem = {
  labelKey: string;
  path: string;
  icon: React.ReactNode;
  roles: RoleSlug[];
};

export const menuItems: MenuItem[] = [
  { labelKey: "menu.dashboard", path: "/", icon: React.createElement(DashboardOutlinedIcon), roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUDITOR"] },
  { labelKey: "menu.organisations", path: "/orgs", icon: React.createElement(ApartmentOutlinedIcon), roles: ["SUPER_ADMIN", "ORG_ADMIN", "AUDITOR"] },
  { labelKey: "menu.orgMandi", path: "/org-mandi-mapping", icon: React.createElement(HubOutlinedIcon), roles: ["SUPER_ADMIN", "ORG_ADMIN", "AUDITOR"] },
  { labelKey: "menu.mandis", path: "/mandis", icon: React.createElement(StoreMallDirectoryOutlinedIcon), roles: ["SUPER_ADMIN", "ORG_ADMIN"] },
  { labelKey: "menu.adminUsers", path: "/admin-users", icon: React.createElement(GroupsOutlinedIcon), roles: ["SUPER_ADMIN", "ORG_ADMIN"] },
  { labelKey: "menu.traderApprovals", path: "/trader-approvals", icon: React.createElement(TaskAltOutlinedIcon), roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"] },
  { labelKey: "menu.reports", path: "/reports", icon: React.createElement(AssessmentOutlinedIcon), roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "AUDITOR"] },
  { labelKey: "menu.mandiCoverage", path: "/mandi-coverage", icon: React.createElement(MapOutlinedIcon), roles: ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN"] },
  { labelKey: "menu.mandiPrices", path: "/mandi-prices", icon: React.createElement(PriceChangeOutlinedIcon), roles: ["MANDI_ADMIN", "SUPER_ADMIN"] },
];

export function filterMenuByRole(role: RoleSlug | null) {
  if (!role) return menuItems;
  return menuItems.filter((item) => item.roles.includes(role));
}
