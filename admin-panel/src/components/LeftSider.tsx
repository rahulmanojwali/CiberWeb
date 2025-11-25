import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Box, ListItemButton, ListItemIcon, ListItemText } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { filterMenuByRole, RoleSlug } from "../config/menuConfig";
import type { MenuItem } from "../config/menuConfig";
import { BRAND_COLORS } from "../config/appConfig";

function getUserRole(): RoleSlug | null {
  try {
    const raw = localStorage.getItem("cd_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const role = parsed?.roles_enabled?.primary || parsed?.usertype || parsed?.role;
    const normalized = typeof role === "string" ? role.toUpperCase() : null;
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

export const LeftSider: React.FC = () => {
  const location = useLocation();
  const role = getUserRole();
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("md"));
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation();
  const toolbarHeight =
    typeof theme.mixins.toolbar.minHeight === "number"
      ? theme.mixins.toolbar.minHeight
      : 64;

  const items = useMemo<MenuItem[]>(() => filterMenuByRole(role), [role]);

  return (
    <Box
      component="nav"
      sx={{
        width: isCompact ? 68 : 240,
        flexShrink: 0,
        backgroundColor: isDark ? alpha("#0f1f17", 0.82) : "#f8fbf9",
        borderRight: `1px solid ${alpha(BRAND_COLORS.primary, isDark ? 0.3 : 0.15)}`,
        position: "sticky",
        top: toolbarHeight,
        height: `calc(100vh - ${toolbarHeight}px)`,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: isCompact ? "center" : "stretch",
        zIndex: 10,
      }}
    >
      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 1 }}>
        {items.map((item) => {
          const active = location.pathname === item.path;
          return (
            <ListItemButton
              key={item.path}
              component={NavLink}
              to={item.path}
              sx={{
                borderLeft: active ? `4px solid ${BRAND_COLORS.primary}` : "4px solid transparent",
                borderRadius: 2,
                mx: 0.5,
                mb: 0.5,
                backgroundColor: active
                  ? alpha(BRAND_COLORS.primary, isDark ? 0.35 : 0.1)
                  : "transparent",
                "&:hover": {
                  backgroundColor: alpha(BRAND_COLORS.primary, isDark ? 0.4 : 0.18),
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 36,
                  color: active
                    ? BRAND_COLORS.primaryDark
                    : isDark
                      ? alpha("#ffffff", 0.85)
                      : "inherit",
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={t(item.labelKey)}
                primaryTypographyProps={{
                  fontWeight: active ? 600 : 500,
                }}
                sx={{ display: isCompact ? "none" : "block" }}
              />
            </ListItemButton>
          );
        })}
      </Box>
    </Box>
  );
};
