import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { Box, ListItemButton, ListItemIcon, ListItemText } from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  filterMenuByResources,
  type MenuItem,
} from "../config/menuConfig";
import { BRAND_COLORS } from "../config/appConfig";
import { getUserRoleFromStorage } from "../utils/roles";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { usePermissions } from "../authz/usePermissions";
import { filterMenuTreeByPlatformControl } from "../utils/platformMenuVisibility";
import { usePlatformMenuControls } from "../hooks/usePlatformMenuControls";

export const LeftSider: React.FC = () => {
  const location = useLocation();
  const { ui_resources, resources: compatResources, role: configRole, refresh: refreshAdminUiConfig } = useAdminUiConfig();
  const role = getUserRoleFromStorage("LeftSider");
  const effectiveRole = (configRole as any) || role;
  const { permissionsMap } = usePermissions();
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down("md"));
  const isDark = theme.palette.mode === "dark";
  const { t } = useTranslation();

  const menuResources = ui_resources?.length ? ui_resources : compatResources || [];
  const { controls: platformMenuControls } = usePlatformMenuControls(menuResources);
  const items = useMemo<MenuItem[]>(() => {
    const built = filterMenuByResources(menuResources, effectiveRole, permissionsMap);
    return filterMenuTreeByPlatformControl(built, platformMenuControls);
  }, [effectiveRole, menuResources, permissionsMap, platformMenuControls]);

  React.useEffect(() => {
    const loadMenuControls = () => {
      refreshAdminUiConfig({ invalidate: true }).catch((err) => {
        console.error("[sidebar] platform menu controls refresh failed", err);
      });
    };
    window.addEventListener("platform-menu-controls-updated", loadMenuControls);
    return () => window.removeEventListener("platform-menu-controls-updated", loadMenuControls);
  }, [refreshAdminUiConfig]);

  const flattenMenu = (menuItems: MenuItem[]): MenuItem[] => {
    const result: MenuItem[] = [];
    menuItems.forEach((entry) => {
      if (entry.path) {
        result.push(entry);
      }
      if (entry.children) {
        result.push(...flattenMenu(entry.children));
      }
    });
    return result;
  };

  const navigableItems = useMemo(() => flattenMenu(items), [items]);
  const translateMenuLabel = (menuItem: MenuItem) => {
    if (menuItem.labelOverride && String(menuItem.labelOverride).trim()) {
      return menuItem.labelOverride;
    }
    return t(menuItem.labelKey, { defaultValue: menuItem.labelKey });
  };
  const CM = {
    primary: "#6E7C3A",
    primaryDark: "#55632C",
    secondary: "#C57A35",
    bg: "#F6F1E8",
    text: "#3B3B3B",
    textMuted: "#6B6B6B",
  };

  return (
    <Box
      component="nav"
      className="cm-sidebar"
      sx={{
        width: isCompact ? 72 : 260,
        flexShrink: 0,
        backgroundColor: isDark ? alpha("#0f1f17", 0.82) : "var(--cm-surface)",
        borderRight: `1px solid ${alpha(BRAND_COLORS.primary, isDark ? 0.3 : 0.15)}`,
        position: "sticky",
        top: "var(--cm-header-height)",
        height: "calc(100vh - var(--cm-header-height))",
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        alignItems: isCompact ? "center" : "stretch",
        zIndex: 10,
      }}
    >
      <Box component="ul" sx={{ listStyle: "none", m: 0, p: 1 }}>
        {navigableItems.length === 0 && (
          <Box
            component="li"
            sx={{ px: 1, py: 1, color: "text.secondary", fontSize: "0.85rem" }}
          >
            {t("layout.sider.noMenuAccess", { defaultValue: "No menu access assigned. Contact admin." })}
          </Box>
        )}
        {navigableItems.map((item) => {
          const active = location.pathname === item.path;
          return (
            <ListItemButton
              key={item.path}
              component={NavLink}
              to={item.path!}
              className={active ? "cm-sidebar-item-active" : undefined}
              sx={{
                borderLeft: active ? `4px solid ${CM.secondary}` : "4px solid transparent",
                borderRadius: "var(--cm-radius-md)",
                mx: 0.5,
                mb: 0.5,
                backgroundColor: active
                  ? CM.bg
                  : "transparent",
                "&:hover": {
                  backgroundColor: CM.bg,
                },
              }}
            >
              <ListItemIcon
                sx={{
                  minWidth: 36,
                  color: active ? CM.secondary : CM.textMuted,
                }}
              >
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={translateMenuLabel(item)}
                primaryTypographyProps={{
                  fontWeight: active ? 600 : 500,
                  color: active ? CM.primaryDark : CM.text,
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
