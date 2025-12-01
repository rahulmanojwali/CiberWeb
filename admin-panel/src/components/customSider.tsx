import React, { useMemo, useState, useCallback } from "react";
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

import { useLocation, useNavigate } from "react-router-dom";

import {
  filterMenuByResources,
  type MenuItem as NavMenuItem,
} from "../config/menuConfig";
import { getUserRoleFromStorage } from "../utils/roles";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { getCurrentAdminUsername } from "../utils/session";


export const CustomSider: React.FC<RefineThemedLayoutSiderProps> = () => {
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("md"));
  const { t } = useTranslation();

  const [collapsed, setCollapsed] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggleGroup = useCallback((key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const { resources, role: configRole } = useAdminUiConfig();
  const storageRole = getUserRoleFromStorage("CustomSider");
  const effectiveRole = (configRole as any) || storageRole;

  console.log("[CustomSider] resolved role from cd_user:", storageRole, "config role:", configRole);

  const navItems = useMemo<NavMenuItem[]>(() => {
    const items = filterMenuByResources(resources, effectiveRole);
    console.log("[CustomSider] navItems via resources", { effectiveRole, resourcesCount: resources.length }, items);
    return items;
  }, [effectiveRole, resources]);

  const username = getCurrentAdminUsername();
  const displayName = username || t("layout.sider.unknownUser", { defaultValue: "Admin user" });
  const initials = displayName?.charAt(0)?.toUpperCase() || "?";

const handleCloseClick = () => {
    if (isSmall) {
      setCollapsed(true);
    } else {
      setCollapsed((prev) => !prev);
    }
  };


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
        borderRight: `1px solid ${theme.palette.divider}`,
        bgcolor: theme.palette.background.paper,
        display: "flex",
        flexDirection: "column",
        transition: "width 0.2s ease",
      }}
    >
      {/* Top section – desktop only: label + close */}
      {!isSmall && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1,
            borderBottom: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            {t("layout.sider.adminMenu", { defaultValue: "Admin menu" })}
          </Typography>
          <IconButton
            size="small"
            onClick={handleCloseClick}
            sx={{ p: "6px" }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      )}

      {/* Menu list */}
      <Box sx={{ flex: 1, overflowY: "auto", py: 1 }}>
        <List
          component="nav"
          sx={{
            mt: 1,
            px: collapsed ? 0.5 : 1.5,
            pb: 2,
          }}
        >
          {navItems.map((item) => {
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
                    onClick={() => item.path && navigate(item.path)}
                    sx={{
                      minHeight: { xs: 30, sm: 32, md: 32 },
                      py: { xs: 0.4, sm: 0.5, md: 0.6 },
                      justifyContent: collapsed ? "center" : "flex-start",
                      px: collapsed ? 1.25 : 2,
                    }}
                  >
                    {item.icon && (
                      <ListItemIcon
                        sx={{
                          minWidth: 0,
                          mr: collapsed ? 0 : 1.25,
                          justifyContent: "center",
                          "& svg": { fontSize: { xs: 16, sm: 18, md: 18 } },
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                    )}
                    {!collapsed && (
                      <ListItemText
                        primary={t(item.labelKey)}
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
                      minHeight: collapsed ? 36 : 34,
                      justifyContent: collapsed ? "center" : "flex-start",
                      px: collapsed ? 1.25 : 2,
                    }}
                  >
                    {item.icon && (
                      <ListItemIcon
                        sx={{
                          minWidth: 0,
                          mr: collapsed ? 0 : 1,
                          justifyContent: "center",
                          "& svg": { fontSize: 18 },
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                    )}
                    {!collapsed && (
                      <ListItemText
                        primary={t(item.labelKey)}
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
                              onClick={() => child.path && navigate(child.path)}
                              sx={{
                                minHeight: { xs: 30, sm: 32, md: 32 },
                                py: { xs: 0.4, sm: 0.5, md: 0.6 },
                                justifyContent: "flex-start",
                                px: 2.5,
                              }}
                            >
                              {child.icon && (
                                <ListItemIcon
                                  sx={{
                                    minWidth: 0,
                                    mr: 1.1,
                                    justifyContent: "center",
                                    "& svg": { fontSize: { xs: 16, sm: 18, md: 18 } },
                                  }}
                                >
                                  {child.icon}
                                </ListItemIcon>
                              )}
                              <ListItemText
                                primary={t(child.labelKey)}
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
              </Box>
            );
          })}
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
