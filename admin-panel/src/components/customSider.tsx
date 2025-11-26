import React, { useMemo, useState } from "react";
import {
  RefineThemedLayoutSiderProps,
} from "@refinedev/mui";

import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTranslation } from "react-i18next";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";

import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";

import { useLocation, useNavigate } from "react-router-dom";

import { BRAND_ASSETS } from "../config/appConfig";

import {
  filterMenuByRole,
  type RoleSlug,
  type MenuItem as NavMenuItem,
} from "../config/menuConfig";




// const VALID_ROLES: RoleSlug[] = [
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

// function getUserRole(): RoleSlug | null {
//   try {
//     const raw = localStorage.getItem("cd_user");
//     if (!raw) return null;
//     const parsed = JSON.parse(raw);

//     const role: unknown =
//       parsed?.default_role_code ?? parsed?.role ?? parsed?.role_code;

//     if (!role || typeof role !== "string") return null;

//     const normalized = role.toUpperCase().trim();

//     if (VALID_ROLES.includes(normalized as RoleSlug)) {
//       return normalized as RoleSlug;
//     }

//     return null;
//   } catch {
//     return null;
//   }
// }

const ROLE_MAP: Record<string, RoleSlug> = {
  SUPERADMIN: "SUPER_ADMIN",
  "SUPER_ADMIN": "SUPER_ADMIN",
  "SUPER ADMIN": "SUPER_ADMIN",

  ORGADMIN: "ORG_ADMIN",
  "ORG_ADMIN": "ORG_ADMIN",
  "ORG ADMIN": "ORG_ADMIN",

  ORGVIEWER: "ORG_VIEWER",
  "ORG_VIEWER": "ORG_VIEWER",
  "ORG VIEWER": "ORG_VIEWER",

  MANDIADMIN: "MANDI_ADMIN",
  "MANDI_ADMIN": "MANDI_ADMIN",
  "MANDI ADMIN": "MANDI_ADMIN",

  MANDIMANAGER: "MANDI_MANAGER",
  "MANDI_MANAGER": "MANDI_MANAGER",
  "MANDI MANAGER": "MANDI_MANAGER",

  GATEOPERATOR: "GATE_OPERATOR",
  "GATE_OPERATOR": "GATE_OPERATOR",
  "GATE OPERATOR": "GATE_OPERATOR",

  WEIGHBRIDGEOPERATOR: "WEIGHBRIDGE_OPERATOR",
  "WEIGHBRIDGE_OPERATOR": "WEIGHBRIDGE_OPERATOR",
  "WEIGHBRIDGE OPERATOR": "WEIGHBRIDGE_OPERATOR",

  AUCTIONEER: "AUCTIONEER",

  AUDITOR: "AUDITOR",

  VIEWER: "VIEWER",
};

function getUserRole(): RoleSlug | null {
  try {
    const raw = localStorage.getItem("cd_user");
    if (!raw) return null;

    const parsed = JSON.parse(raw);

    const rawRole: unknown =
      parsed?.default_role_code ?? parsed?.role ?? parsed?.role_code;

    if (!rawRole || typeof rawRole !== "string") return null;

    const normalized = rawRole.trim().toUpperCase();          // e.g. "superadmin" → "SUPERADMIN"
    const cleaned = normalized.replace(/[^A-Z]/g, "");        // remove spaces/underscores: "SUPER_ADMIN" → "SUPERADMIN"

    // Try exact match first (with spaces/underscores), then cleaned version
    const mapped =
      ROLE_MAP[normalized] ??
      ROLE_MAP[cleaned];

    return mapped ?? null;
  } catch {
    return null;
  }
}






export const CustomSider: React.FC<RefineThemedLayoutSiderProps> = () => {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("md"));
  const { t } = useTranslation();

  // 👉 Hide sider completely on mobile; drawer handles navigation there
  if (isSmall) {
    return null;
  }

  const [collapsed, setCollapsed] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const role = getUserRole();

  const navItems = useMemo<NavMenuItem[]>(() => {
    return filterMenuByRole(role);
  }, [role]);

  const siderWidth = collapsed ? 72 : 260;

  return (
    <Box
      component="aside"
      sx={{
        width: siderWidth,
        flexShrink: 0,
        height: "100vh",
        borderRight: `1px solid ${theme.palette.divider}`,
        bgcolor: theme.palette.background.paper,
        display: "flex",
        flexDirection: "column",
        transition: "width 0.2s ease",
      }}
    >
      {/* Top brand section – replaces "Refine Project" */}
      <Box
        sx={{
          px: collapsed ? 1 : 2,
          py: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: collapsed ? 0 : 1.5,
          }}
        >
          <Box
            component="img"
            src={BRAND_ASSETS.logo}
            alt="CiberMandi"
            sx={{
              height: 32,
              width: "auto",
            }}
          />
          {!collapsed && (
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                CiberMandi Admin
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {t("layout.sider.tagline", {
                  defaultValue: "Control room for mandis",
                })}
              </Typography>
            </Box>
          )}
        </Box>

        {/* Collapse / expand toggle */}
        <IconButton
          size="small"
          onClick={() => setCollapsed((prev) => !prev)}
          sx={{
            ml: collapsed ? 0 : 1,
          }}
        >
          {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
        </IconButton>
      </Box>

      {/* Menu list */}
      <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
        <List disablePadding>
          {navItems.map((item) => {
            const active = location.pathname === item.path;

            const anyItem = item as any;
            const labelKey: string | undefined = anyItem.labelKey;
            const label: string =
              anyItem.label ??
              anyItem.title ??
              (labelKey ? t(labelKey, { defaultValue: labelKey }) : "");

            const listItem = (
              <ListItemButton
                onClick={() => navigate(item.path)}
                selected={active}
                sx={{
                  justifyContent: collapsed ? "center" : "flex-start",
                  px: collapsed ? 1.5 : 2,
                  "&.Mui-selected": {
                    bgcolor: "rgba(47,166,82,0.10)",
                    "& .MuiListItemText-primary": {
                      fontWeight: 600,
                      color: theme.palette.primary.main,
                    },
                  },
                }}
              >
                {item.icon && (
                  <ListItemIcon
                    sx={{
                      minWidth: collapsed ? 0 : 40,
                      mr: collapsed ? 0 : 1,
                      color: active
                        ? theme.palette.primary.main
                        : "text.secondary",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                )}

                {!collapsed && <ListItemText primary={label} />}
              </ListItemButton>
            );

            return (
              <ListItem key={item.path} disablePadding>
                {collapsed ? (
                  <Tooltip title={label} placement="right">
                    {listItem}
                  </Tooltip>
                ) : (
                  listItem
                )}
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Bottom small footer (optional) */}
      <Divider />
      <Box
        sx={{
          px: collapsed ? 1 : 2,
          py: 1.5,
          textAlign: collapsed ? "center" : "left",
        }}
      >
        {!collapsed && (
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            © {new Date().getFullYear()} CiberMandi
          </Typography>
        )}
      </Box>
    </Box>
  );
};
