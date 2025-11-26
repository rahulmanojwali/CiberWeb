import React, { useMemo } from "react";
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

import { useLocation, useNavigate } from "react-router-dom";

import { BRAND_ASSETS } from "../config/appConfig";

import {
  filterMenuByRole,
  type RoleSlug,
  type MenuItem as NavMenuItem,
} from "../config/menuConfig";

function getUserRole(): RoleSlug | null {
  try {
    const raw = localStorage.getItem("cd_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    const role: unknown =
      parsed?.default_role_code ?? parsed?.role ?? parsed?.role_code;

    if (!role || typeof role !== "string") return null;

    const normalized = role.toUpperCase().trim();

    if (
      normalized === "SUPER_ADMIN" ||
      normalized === "ORG_ADMIN" ||
      normalized === "MANDI_ADMIN" ||
      normalized === "AUDITOR"
    ) {
      return normalized as RoleSlug;
    }

    return null;
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

  const navigate = useNavigate();
  const location = useLocation();
  const role = getUserRole();

  const navItems = useMemo<NavMenuItem[]>(() => {
    return filterMenuByRole(role);
  }, [role]);

  return (
    <Box
      component="aside"
      sx={{
        width: 260,
        flexShrink: 0,
        height: "100vh",
        borderRight: `1px solid ${theme.palette.divider}`,
        bgcolor: theme.palette.background.paper,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Top brand section – replaces "Refine Project" */}
      <Box
        sx={{
          px: 2,
          py: 2,
          borderBottom: `1px solid ${theme.palette.divider}`,
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Box
          component="img"
          src={BRAND_ASSETS.logo}
          alt="CiberMandi"
          sx={{ height: 32, width: "auto" }}
        />
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

            return (
              <ListItem key={item.path} disablePadding>
                <ListItemButton
                  onClick={() => navigate(item.path)}
                  selected={active}
                  sx={{
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
                        minWidth: 40,
                        color: active
                          ? theme.palette.primary.main
                          : "text.secondary",
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                  )}

                  <ListItemText primary={label} />
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      {/* Bottom small footer (optional) */}
      <Divider />
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          © {new Date().getFullYear()} CiberMandi
        </Typography>
      </Box>
    </Box>
  );
};
