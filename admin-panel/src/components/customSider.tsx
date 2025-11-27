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
  filterMenuByResources,
  type MenuItem as NavMenuItem,
} from "../config/menuConfig";
import { getUserRoleFromStorage } from "../utils/roles";
import { useAdminUiConfig } from "../contexts/admin-ui-config";


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
  const { resources, role: configRole } = useAdminUiConfig();
  const storageRole = getUserRoleFromStorage("CustomSider");
  const effectiveRole = (configRole as any) || storageRole;

  console.log("[CustomSider] resolved role from cd_user:", storageRole, "config role:", configRole);

  const navItems = useMemo<NavMenuItem[]>(() => {
    const items = filterMenuByResources(resources, effectiveRole);
    console.log("[CustomSider] navItems via resources", { effectiveRole, resourcesCount: resources.length }, items);
    return items;
  }, [effectiveRole, resources]);



  

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
