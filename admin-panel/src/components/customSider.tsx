import React, { useState, useCallback, useEffect } from "react";
import {
  RefineThemedLayoutSiderProps,
} from "@refinedev/mui";

import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTranslation } from "react-i18next";

import Box from "@mui/material/Box";
import Avatar from "@mui/material/Avatar";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Collapse from "@mui/material/Collapse";
import IconButton from "@mui/material/IconButton";

import CloseIcon from "@mui/icons-material/Close";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";

import { useLocation } from "react-router-dom";

import {
  filterMenuByResources,
  type MenuItem as NavMenuItem,
} from "../config/menuConfig";
import { getUserRoleFromStorage } from "../utils/roles";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { getCurrentAdminUsername } from "../utils/session";
import { usePermissions } from "../authz/usePermissions";
import { useMenuNavigation } from "../hooks/useMenuNavigation";


export const CustomSider: React.FC<RefineThemedLayoutSiderProps> = () => {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("md"));
  const { t } = useTranslation();

  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleGroup = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const location = useLocation();
  const { ui_resources, resources: compatResources, role: configRole } = useAdminUiConfig();
  const storageRole = getUserRoleFromStorage("CustomSider");
  const effectiveRole = (configRole as any) || storageRole;
  const { permissionsMap } = usePermissions();

  console.log("[CustomSider] resolved role from cd_user:", storageRole, "config role:", configRole);

  const [navItems, setNavItems] = useState<NavMenuItem[]>([]);
  const [menuError, setMenuError] = useState<string | null>(null);
  const menuResources = ui_resources?.length ? ui_resources : compatResources || [];
  const resourcesCount = menuResources?.length || 0;
  const isDebug = new URLSearchParams(window.location.search).get("debugAuth") === "1";

  useEffect(() => {
    try {
      if (resourcesCount === 0) {
        setMenuError(null);
        setNavItems([]);
        return;
      }
      const built = filterMenuByResources(menuResources, effectiveRole, permissionsMap);
      const builtCount = built.length;
      console.log("[menu] setting dynamic menu", { resourcesCount, builtCount });
      if (isDebug) {
        const systemGroup = built.find((g) => g.key === "system");
        console.log("[sider debug] system group", {
          totalGroups: built.length,
          systemChildCount: systemGroup?.children?.length || 0,
          systemChildren: systemGroup?.children?.map((c) => ({
            key: c.key,
            label: (c as any).label || c.labelKey,
            path: c.path,
            resourceKey: c.resourceKey,
          })),
        });
      }

      if (resourcesCount > 0 && builtCount === 0) {
        console.warn("[menu] built menu empty after pruning; showing empty state");
        setMenuError("No menu access assigned. Contact admin.");
        setNavItems([]);
        return;
      }

      setMenuError(null);
      setNavItems(builtCount > 0 ? built : []);
    } catch (e) {
      console.error("[sidebar] build failed", e, { resourcesSample: (menuResources || []).slice(0, 5) });
      setMenuError("Menu failed to load.");
    }
  }, [effectiveRole, menuResources, resourcesCount, permissionsMap]);

  useEffect(() => {
    console.log("[CustomSider] render", { hasUiConfig: resourcesCount > 0, menuLen: navItems.length });
  }, [resourcesCount, navItems.length]);

  const username = getCurrentAdminUsername();
  const displayName = username || t("layout.sider.unknownUser", { defaultValue: "Admin user" });
  const initials = displayName?.charAt(0)?.toUpperCase() || "?";

  const menuNavigate = useMenuNavigation();

  const handleCloseClick = () => {
    // Desktop: toggle collapsed; mobile never renders this sider.
    setCollapsed((prev) => !prev);
  };

  const translateMenuLabel = (menuItem: NavMenuItem) =>
    t(menuItem.labelKey, { defaultValue: menuItem.labelOverride || menuItem.labelKey });

  const renderMenuItem = useCallback(
    (item: NavMenuItem) => {
      const isGroup = !!item.children?.length && !item.path;
      const labelKey = item.key || item.labelKey || item.path;
      if (!isGroup) {
        const active = !!item.path && location.pathname.startsWith(item.path);
        return (
          <ListItem
            key={labelKey}
            disablePadding
            sx={{ display: "block" }}
          >
            <ListItemButton
              selected={active}
              onClick={() => item.path && menuNavigate(item.path, item.resourceKey)}
              sx={{
                minHeight: 48,
                py: 0.75,
                justifyContent: collapsed ? "center" : "flex-start",
                px: collapsed ? 1.25 : 2,
                "&.Mui-selected": {
                  backgroundColor: "#e0f2f1",
                  borderRadius: 1,
                },
              }}
            >
              {item.icon && (
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: collapsed ? 0 : 1.25,
                    justifyContent: "center",
                    "& svg": { fontSize: 20 },
                  }}
                >
                  {item.icon}
                </ListItemIcon>
              )}
              {!collapsed && (
                <ListItemText
                  primary={translateMenuLabel(item)}
                  primaryTypographyProps={{
                    fontWeight: active ? 600 : 500,
                    variant: "body2",
                    fontSize: { xs: "0.75rem", sm: "0.8rem", md: "0.8rem" },
                  }}
                />
              )}
            </ListItemButton>
          </ListItem>
        );
      }

      const groupKey = item.key || item.labelKey || item.path || `${labelKey}-group`;
      const isExpanded = !!expanded[groupKey];
      return (
        <Box key={groupKey} sx={{ mt: collapsed ? 0.5 : 1.5 }}>
          <ListItem disablePadding>
            <ListItemButton
              onClick={() => toggleGroup(groupKey)}
              sx={{
                minHeight: 48,
                justifyContent: collapsed ? "center" : "flex-start",
                px: collapsed ? 1.25 : 2,
                py: 0.75,
              }}
            >
              {item.icon && (
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: collapsed ? 0 : 1,
                    justifyContent: "center",
                    "& svg": { fontSize: 20 },
                  }}
                >
                  {item.icon}
                </ListItemIcon>
              )}
              {!collapsed && (
                <ListItemText
                  primary={translateMenuLabel(item)}
                  primaryTypographyProps={{
                    variant: "subtitle2",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                  }}
                />
              )}
              {!collapsed && (
                isExpanded ? (
                  <ExpandLess sx={{ fontSize: 18 }} />
                ) : (
                  <ExpandMore sx={{ fontSize: 18 }} />
                )
              )}
            </ListItemButton>
          </ListItem>
          {!collapsed && (
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {item.children!.map((child) => {
                  const childKey = child.key || child.labelKey || child.path;
                  const active = !!child.path && location.pathname.startsWith(child.path);
                  return (
                    <ListItem
                      key={childKey}
                      disablePadding
                      sx={{ display: "block" }}
                    >
                      <ListItemButton
                        selected={active}
                        onClick={() => child.path && menuNavigate(child.path, child.resourceKey)}
                        sx={{
                          minHeight: 48,
                          py: 0.75,
                          justifyContent: "flex-start",
                          px: 2.5,
                          "&.Mui-selected": {
                            backgroundColor: "#e0f2f1",
                            borderRadius: 1,
                          },
                        }}
                      >
                        {child.icon && (
                          <ListItemIcon
                            sx={{
                              minWidth: 0,
                              mr: 1.1,
                              justifyContent: "center",
                              "& svg": { fontSize: 20 },
                            }}
                          >
                            {child.icon}
                          </ListItemIcon>
                        )}
                        <ListItemText
                          primary={translateMenuLabel(child)}
                          primaryTypographyProps={{
                            variant: "body2",
                            fontWeight: active ? 600 : 500,
                            fontSize: { xs: "0.75rem", sm: "0.8rem", md: "0.8rem" },
                          }}
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </List>
            </Collapse>
          )}
          <Divider sx={{ my: 1, opacity: 0.3 }} />
        </Box>
      );
    },
    [collapsed, expanded, location.pathname, menuNavigate, toggleGroup],
  );


  if (isSmall) {
    return null;
  }

  const siderWidth = collapsed ? 72 : 260;

  return (
    <Box
      component="aside"
      sx={{
        width: siderWidth,
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
        borderRight: `1px solid ${theme.palette.divider}`,
        bgcolor: theme.palette.background.paper,
        display: "flex",
        flexDirection: "column",
        transition: "width 0.2s ease",
      }}
    >
      {/* Top section – desktop only: label + close (always visible when rendered) */}
      {!isSmall && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: collapsed ? 1 : 2,
            py: 1,
            borderBottom: `1px solid ${theme.palette.divider}`,
            minHeight: 44,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{
              fontWeight: 600,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: collapsed ? 80 : "100%",
            }}
          >
            {t("layout.sider.adminMenu", { defaultValue: "Admin menu" })}
          </Typography>
          <IconButton
            size="small"
            onClick={handleCloseClick}
            sx={{ p: "6px", color: "text.primary" }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* Menu list */}
      <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
        {menuError && (
          <Box sx={{ px: 2, pb: 1 }}>
            <Typography variant="caption" color="error">
              {menuError}
            </Typography>
          </Box>
        )}
        <List
          component="nav"
          sx={{
            mt: 1,
            px: collapsed ? 0.5 : 1.5,
            pb: 2,
          }}
        >
          {menuError && navItems.length === 0 && (
            <ListItem disablePadding>
              <ListItemText
                primary={menuError}
                primaryTypographyProps={{ variant: "body2", color: "text.secondary" }}
                sx={{ px: 1.5, py: 0.5 }}
              />
            </ListItem>
          )}
          {navItems.map((item) => renderMenuItem(item))}
        </List>
      </Box>

      {/* Profile section */}
      <Box
        sx={{
          borderTop: `1px solid ${theme.palette.divider}`,
          px: collapsed ? 1 : 2,
          py: 1.5,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar sx={{ width: 32, height: 32 }}>{initials}</Avatar>
          {!collapsed && (
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {displayName}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                {t("layout.sider.signedIn", { defaultValue: "Signed in" })}
              </Typography>
            </Box>
          )}
        </Box>
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
