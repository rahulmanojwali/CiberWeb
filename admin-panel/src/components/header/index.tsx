import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";

import AppBar from "@mui/material/AppBar";
import Avatar from "@mui/material/Avatar";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Box from "@mui/material/Box";
import FormControl from "@mui/material/FormControl";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import useMediaQuery from "@mui/material/useMediaQuery";
import SwipeableDrawer from "@mui/material/SwipeableDrawer";
import Collapse from "@mui/material/Collapse";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import { useTheme } from "@mui/material/styles";

import { useGetIdentity, useLogout } from "@refinedev/core";
import { RefineThemedLayoutHeaderProps } from "@refinedev/mui";

// import React, { useContext, useMemo, useState } from "react";
import React, { useCallback, useContext, useMemo, useState, useEffect } from "react";


import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";

import { ColorModeContext } from "../../contexts/color-mode";
import { BRAND_ASSETS, DEFAULT_LANGUAGE } from "../../config/appConfig";
import {
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  normalizeLanguageCode,
} from "../../config/languages";


import {
  filterMenuByResources,
  type MenuItem as NavMenuItem,
} from "../../config/menuConfig";
import { getUserRoleFromStorage } from "../../utils/roles";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";

const flattenNavMenuItems = (items: NavMenuItem[]): NavMenuItem[] => {
  const flattened: NavMenuItem[] = [];
  items.forEach((item) => {
    if (item.path) {
      flattened.push(item);
    }
    if (item.children?.length) {
      flattened.push(...flattenNavMenuItems(item.children));
    }
  });
  return flattened;
};


// Height of the mobile AppBar (toolbar)
const APPBAR_MOBILE_HEIGHT = 56;

type IUser = {
  id: number;
  name: string;
  avatar: string;
};

export const Header: React.FC<RefineThemedLayoutHeaderProps> = ({
  sticky = true,
}) => {
  const { mode, setMode } = useContext(ColorModeContext);
  const { mutate: logout } = useLogout();
  const { t, i18n } = useTranslation();

  const theme = useTheme();
  const isSmall = useMediaQuery((themeParam: any) =>
    themeParam.breakpoints.down("md"),
  );
  
   // 👇 Override browser tab title when header is mounted
  useEffect(() => {
    document.title = "CiberMandi Admin Console";
  }, []);

  const navigate = useNavigate();
  const location = useLocation();
  const handleNavClick = useCallback(
    (path: string) => {
      navigate(path);
      setMobileMenuOpen(false);
    },
    [navigate],
  );

  const { data: user } = useGetIdentity<IUser>();
  const currentLanguage = normalizeLanguageCode(
    i18n.language || DEFAULT_LANGUAGE,
  );
  const { resources, role: configRole } = useAdminUiConfig();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [menuExpanded, setMenuExpanded] = useState<Record<string, boolean>>({});

  const role = getUserRoleFromStorage("Header");
  const effectiveRole = (configRole as any) || role;
  console.log("[Header] resolved role from cd_user:", role, "config role:", configRole);

  const navItems: NavMenuItem[] = useMemo(() => {
    const items = filterMenuByResources(resources, effectiveRole);
    console.log("[Header] navItems via resources", { effectiveRole, resourcesCount: resources.length }, items);
    return items;
  }, [effectiveRole, resources]);
  const flattenedNavItems = useMemo(() => flattenNavMenuItems(navItems), [navItems]);
  const handleToggleGroup = useCallback((key: string) => {
    setMenuExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) {
      setMenuExpanded({});
    }
    if (isSmall) {
      document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      if (isSmall) {
        document.body.style.overflow = "";
      }
    };
  }, [mobileMenuOpen, isSmall]);

  const resolveKey = (item: NavMenuItem) =>
    item.key ?? item.labelKey ?? item.path ?? item.labelKey;

  const renderMobileMenuItem = useCallback(
    (item: NavMenuItem, depth = 0): React.ReactNode => {
      const key = resolveKey(item);
      const hasChildren = !!item.children?.length && !item.path;
      const active = item.path ? location.pathname.startsWith(item.path) : false;
      if (hasChildren) {
        const isExpanded = !!menuExpanded[key];
        return (
          <Box key={key} sx={{ mt: depth === 0 ? 1 : 0 }}>
            <ListItem disablePadding>
              <ListItemButton
                onClick={() => handleToggleGroup(key)}
                sx={{
                  minHeight: 48,
                  py: 0.75,
                  justifyContent: "flex-start",
                  px: 2.5,
                }}
              >
                {item.icon && (
                  <ListItemIcon
                    sx={{
                      minWidth: 0,
                      mr: 1.25,
                      justifyContent: "center",
                      "& svg": { fontSize: 20 },
                    }}
                  >
                    {item.icon}
                  </ListItemIcon>
                )}
                <ListItemText
                  primary={t(item.labelKey)}
                  primaryTypographyProps={{
                    fontWeight: 600,
                    variant: "subtitle2",
                    fontSize: { xs: "0.78rem", sm: "0.82rem", md: "0.85rem" },
                  }}
                />
                {isExpanded ? <ExpandLess sx={{ fontSize: 18 }} /> : <ExpandMore sx={{ fontSize: 18 }} />}
              </ListItemButton>
            </ListItem>
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              <List component="div" disablePadding>
                {item.children!.map((child) => renderMobileMenuItem(child, depth + 1))}
              </List>
            </Collapse>
          </Box>
        );
      }

      return (
        <ListItem
          key={key}
          disablePadding
          sx={{ display: "block" }}
        >
          <ListItemButton
            selected={active}
            onClick={() => item.path && handleNavClick(item.path)}
            sx={{
              minHeight: 48,
              py: 0.75,
              justifyContent: "flex-start",
              px: 3 + depth * 1.5,
            }}
          >
            {item.icon && (
              <ListItemIcon
                sx={{
                  minWidth: 0,
                  mr: 1.25,
                  justifyContent: "center",
                  "& svg": { fontSize: 20 },
                }}
              >
                {item.icon}
              </ListItemIcon>
            )}
            <ListItemText
              primary={t(item.labelKey)}
              primaryTypographyProps={{
                fontWeight: active ? 600 : 500,
                variant: "body2",
                fontSize: { xs: "0.75rem", sm: "0.8rem", md: "0.8rem" },
              }}
            />
          </ListItemButton>
        </ListItem>
      );
    },
    [handleNavClick, handleToggleGroup, location.pathname, menuExpanded, t],
  );




  const handleLanguageChange = (event: any) => {
    const next = event.target.value;
    i18n.changeLanguage(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  };

  const handleLogout = () => {
    logout();
  };

  return (
    <>
      <AppBar
        position={sticky ? "sticky" : "relative"}
        color="primary"
        elevation={0}
        sx={{
          boxShadow: "0 8px 24px rgba(47, 166, 82, 0.35)",
          backgroundImage:
            "linear-gradient(135deg, rgba(47,166,82,0.95), rgba(25,107,61,0.95))",
        }}
      >
        <Toolbar sx={{ py: 1.25, px: { xs: 1.5, md: 3 } }}>
          <Stack
            direction="row"
            width="100%"
            alignItems="center"
            justifyContent="space-between"
            gap={2}
          >
            {/* LEFT SIDE: Logo + hamburger on mobile */}
            <Stack
              direction="row"
              spacing={isSmall ? 1 : 2}
              alignItems="center"
            >
              {isSmall && (
                <IconButton
                  edge="start"
                  color="inherit"
                  aria-label="open navigation"
                  onClick={() => setMobileMenuOpen(true)}
                  sx={{
                    mr: 0.5,
                    borderRadius: 2,
                    bgcolor: "rgba(255,255,255,0.10)",
                  }}
                >
                  <MenuIcon />
                </IconButton>
              )}

              <Stack direction="row" spacing={1.5} alignItems="center">
                <Box
                  component="img"
                  src={BRAND_ASSETS.logo}
                  alt="CiberMandi"
                  sx={{
                    height: isSmall ? 32 : 42,
                    width: "auto",
                    filter: "brightness(0) invert(1)",
                  }}
                />
                <Box>
                  <Typography
                    variant={isSmall ? "subtitle1" : "h6"}
                    sx={{ fontWeight: 700, lineHeight: 1.1 }}
                  >
                    CiberMandi
                  </Typography>
                  {!isSmall && (
                    <Typography
                      variant="body2"
                      sx={{ opacity: 0.9, fontWeight: 400 }}
                    >
                      India&apos;s Digital Mandi Network
                    </Typography>
                  )}
                </Box>
              </Stack>
            </Stack>

            {/* RIGHT SIDE: theme toggle, language, profile, logout */}
            <Stack
              direction="row"
              spacing={isSmall ? 1 : 2}
              alignItems="center"
              justifyContent="flex-end"
            >
              {/* Dark / light mode toggle */}
              <IconButton
                sx={{
                  color: "#fff",
                  bgcolor: "rgba(255,255,255,0.12)",
                  "&:hover": {
                    bgcolor: "rgba(255,255,255,0.24)",
                  },
                }}  
           
                onClick={setMode}

              >
                {mode === "dark" ? <LightModeOutlined /> : <DarkModeOutlined />}
              </IconButton>

              {/* Language select – hide on very small screens */}
              {!isSmall && (
                <FormControl
                  size="small"
                  sx={{
                    minWidth: 120,
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(255,255,255,0.4)",
                    },
                    "& .MuiSvgIcon-root": {
                      color: "#fff",
                    },
                  }}
                >
                  <Select
                    value={currentLanguage}
                    onChange={handleLanguageChange}
                    color="secondary"
                    sx={{
                      color: "#fff",
                      "& .MuiSelect-select": { py: 0.75 },
                    }}
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <MenuItem key={lang.code} value={lang.code}>
                        {lang.nativeLabel} ({lang.label})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              {/* User name + avatar */}
              {(user?.avatar || user?.name) && (
                <Stack direction="row" gap="12px" alignItems="center">
                  {user?.name && (
                    <Typography
                      sx={{
                        display: {
                          xs: "none",
                          sm: "block",
                        },
                        color: "#ffffff",
                        fontWeight: 500,
                      }}
                    >
                      {user.name}
                    </Typography>
                  )}
                  {user?.avatar && (
                    <Avatar
                      src={user.avatar}
                      alt={user.name}
                      sx={{
                        width: 36,
                        height: 36,
                        border: "2px solid rgba(255,255,255,0.7)",
                      }}
                    />
                  )}
                </Stack>
              )}

              {/* Sign out */}
              {isSmall ? (
                <IconButton
                  color="inherit"
                  onClick={handleLogout}
                  sx={{
                    bgcolor: "rgba(255,255,255,0.12)",
                    "&:hover": {
                      bgcolor: "rgba(255,255,255,0.24)",
                    },
                  }}
                >
                  <LogoutIcon />
                </IconButton>
              ) : (
                <Button
                  variant="outlined"
                  startIcon={<LogoutIcon />}
                  onClick={handleLogout}
                  sx={{
                    borderColor: "rgba(255,255,255,0.7)",
                    color: "#ffffff",
                    fontWeight: 600,
                    "&:hover": {
                      bgcolor: "rgba(255,255,255,0.3)",
                    },
                  }}
                >
                  {t("header.sign_out")}
                </Button>
              )}
            </Stack>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* MOBILE NAV DRAWER */}
      <SwipeableDrawer
        anchor="left"
        disableDiscovery={false}
        open={mobileMenuOpen && isSmall}
        onOpen={() => setMobileMenuOpen(true)}
        onClose={() => setMobileMenuOpen(false)}
        PaperProps={{
          sx: {
            width: "80%",
            maxWidth: 340,
            bgcolor: theme.palette.background.default,
            top: APPBAR_MOBILE_HEIGHT,
            height: `calc(100% - ${APPBAR_MOBILE_HEIGHT}px)`,
            position: "fixed",
          },
        }}
      >
        {/* User info inside drawer */}
        {user && (
          <Box
            sx={{
              px: 2,
              py: 2,
              display: "flex",
              alignItems: "center",
              gap: 1.5,
            }}
          >
            <Avatar
              src={user.avatar}
              alt={user.name}
              sx={{
                width: 44,
                height: 44,
              }}
            />
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                {user.name}
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary" }}
              >
                {t("header.signed_in_as", {
                  defaultValue: "Signed in",
                })}
              </Typography>
            </Box>
          </Box>
        )}

        <Divider />

        {/* Navigation list */}
        <Box
          sx={{
            py: 1,
            maxHeight: `calc(100% - ${APPBAR_MOBILE_HEIGHT}px)`,
            overflowY: "auto",
            overscrollBehavior: "contain",
          }}
        >
          <List component="nav" disablePadding>
            {navItems.map((item, idx) => (
              <React.Fragment key={resolveKey(item)}>
                {renderMobileMenuItem(item)}
                {idx < navItems.length - 1 && <Divider sx={{ my: 1, opacity: 0.3 }} />}
              </React.Fragment>
            ))}
          </List>
        </Box>
      </SwipeableDrawer>
    </>
  );
};
