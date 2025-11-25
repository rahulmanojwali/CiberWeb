import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";

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
import Drawer from "@mui/material/Drawer";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import { useTheme } from "@mui/material/styles";

import { useGetIdentity, useLogout } from "@refinedev/core";
import { RefineThemedLayoutHeaderProps } from "@refinedev/mui";

import React, { useContext, useMemo, useState } from "react";
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
  filterMenuByRole,
  type RoleSlug,
  type MenuItem as NavMenuItem,
} from "../../config/menuConfig";

type IUser = {
  id: number;
  name: string;
  avatar: string;
};

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

  const navigate = useNavigate();
  const location = useLocation();

  const { data: user } = useGetIdentity<IUser>();
  const currentLanguage = normalizeLanguageCode(
    i18n.language || DEFAULT_LANGUAGE,
  );

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const role = getUserRole();
  const navItems = useMemo<NavMenuItem[]>(
    () => filterMenuByRole(role),
    [role],
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

  const handleNavClick = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
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
      <Drawer
        anchor="left"
        open={mobileMenuOpen && isSmall}
        onClose={() => setMobileMenuOpen(false)}
        PaperProps={{
          sx: {
            width: "80%",
            maxWidth: 340,
            bgcolor: theme.palette.background.default,
          },
        }}
      >
        {/* Drawer header: close button + logo/text */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <IconButton
            edge="start"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="close menu"
          >
            <CloseIcon />
          </IconButton>

          <Stack direction="row" spacing={1.25} alignItems="center">
            <Box
              component="img"
              src={BRAND_ASSETS.logo}
              alt="CiberMandi"
              sx={{
                height: 32,
                width: "auto",
              }}
            />
            <Box>
              <Typography
                variant="subtitle1"
                sx={{ fontWeight: 700, lineHeight: 1.1 }}
              >
                CiberMandi Admin
              </Typography>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary" }}
              >
                {t("header.mobile_menu_title", {
                  defaultValue: "Navigation",
                })}
              </Typography>
            </Box>
          </Stack>
        </Box>

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
        <Box sx={{ py: 1 }}>
          <List disablePadding>
            {navItems.map((item) => {
              const active = location.pathname === item.path;

              return (
                <ListItem key={item.path} disablePadding>
                  <ListItemButton
                    onClick={() => handleNavClick(item.path)}
                    selected={active}
                    sx={{
                      "&.Mui-selected": {
                        bgcolor: "rgba(47,166,82,0.08)",
                      },
                    }}
                  >
                    {item.icon && (
                      <ListItemIcon
                        sx={{
                          minWidth: 40,
                          color: active
                            ? theme.palette.primary.main
                            : "inherit",
                        }}
                      >
                        {item.icon}
                      </ListItemIcon>
                    )}
                    <ListItemText
                      primary={t(item.labelKey)}
                      primaryTypographyProps={{
                        fontWeight: active ? 600 : 500,
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>
      </Drawer>
    </>
  );
};


// import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
// import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
// import AppBar from "@mui/material/AppBar";
// import Avatar from "@mui/material/Avatar";
// import IconButton from "@mui/material/IconButton";
// import Stack from "@mui/material/Stack";
// import Toolbar from "@mui/material/Toolbar";
// import Typography from "@mui/material/Typography";
// import Button from "@mui/material/Button";
// import Box from "@mui/material/Box";
// import FormControl from "@mui/material/FormControl";
// import Select from "@mui/material/Select";
// import MenuItem from "@mui/material/MenuItem";
// import useMediaQuery from "@mui/material/useMediaQuery";
// import LogoutIcon from "@mui/icons-material/Logout";
// import { useGetIdentity, useLogout } from "@refinedev/core";
// import { HamburgerMenu, RefineThemedLayoutHeaderProps } from "@refinedev/mui";
// import React, { useContext } from "react";
// import { useTranslation } from "react-i18next";
// import { ColorModeContext } from "../../contexts/color-mode";
// import { BRAND_ASSETS, DEFAULT_LANGUAGE } from "../../config/appConfig";
// import { LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES, normalizeLanguageCode } from "../../config/languages";

// type IUser = {
//   id: number;
//   name: string;
//   avatar: string;
// };

// export const Header: React.FC<RefineThemedLayoutHeaderProps> = ({
//   sticky = true,
// }) => {
//   const { mode, setMode } = useContext(ColorModeContext);
//   const { mutate: logout } = useLogout();
//   const { t, i18n } = useTranslation();
//   const isSmall = useMediaQuery((theme: any) => theme.breakpoints.down("md"));

//   const { data: user } = useGetIdentity<IUser>();
//   const currentLanguage = normalizeLanguageCode(i18n.language || DEFAULT_LANGUAGE);

//   const handleLanguageChange = (event: any) => {
//     const next = event.target.value;
//     i18n.changeLanguage(next);
//     try {
//       localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
//     } catch {
//       // ignore storage errors
//     }
//   };

//   return (
//     <AppBar
//       position={sticky ? "sticky" : "relative"}
//       color="primary"
//       elevation={0}
//       sx={{
//         boxShadow: "0 8px 24px rgba(47, 166, 82, 0.35)",
//         backgroundImage:
//           "linear-gradient(135deg, rgba(47,166,82,0.95), rgba(25,107,61,0.95))",
//       }}
//     >
//       <Toolbar sx={{ py: 1.25, px: { xs: 1.5, md: 3 } }}>
//         <Stack
//           direction="row"
//           width="100%"
//           alignItems="center"
//           justifyContent="space-between"
//           gap={2}
//         >
//           <Stack direction="row" spacing={isSmall ? 1 : 2} alignItems="center">
//             <HamburgerMenu />
//             <Stack direction="row" spacing={1.5} alignItems="center">
//               <Box
//                 component="img"
//                 src={BRAND_ASSETS.logo}
//                 alt="CiberMandi"
//                 sx={{
//                   height: isSmall ? 32 : 42,
//                   width: "auto",
//                   filter: "brightness(0) invert(1)",
//                 }}
//               />
//               <Box>
//                 <Typography
//                   variant={isSmall ? "subtitle1" : "h6"}
//                   sx={{ fontWeight: 700 }}
//                 >
//                   {t("app.title")}
//                 </Typography>
//                 {!isSmall && (
//                   <Typography
//                     variant="caption"
//                     sx={{ letterSpacing: 0.5, opacity: 0.85 }}
//                   >
//                     {t("app.tagline")}
//                   </Typography>
//                 )}
//               </Box>
//             </Stack>
//           </Stack>

//           <Stack
//             direction="row"
//             spacing={isSmall ? 1 : 2}
//             alignItems="center"
//           >
//             <IconButton
//               color="inherit"
//               onClick={() => {
//                 setMode();
//               }}
//               sx={{
//                 border: "1px solid rgba(255,255,255,0.4)",
//               }}
//               title={t("header.theme_toggle")}
//             >
//               {mode === "dark" ? <LightModeOutlined /> : <DarkModeOutlined />}
//             </IconButton>

//             {!isSmall && (
//               <FormControl
//                 size="small"
//                 sx={{
//                   minWidth: 120,
//                   "& .MuiOutlinedInput-notchedOutline": {
//                     borderColor: "rgba(255,255,255,0.4)",
//                   },
//                   "& .MuiSvgIcon-root": {
//                     color: "#fff",
//                   },
//                 }}
//               >
//                 <Select
//                   value={currentLanguage}
//                   onChange={handleLanguageChange}
//                   color="secondary"
//                   sx={{
//                     color: "#fff",
//                     "& .MuiSelect-select": { py: 0.75 },
//                   }}
//                 >
//                   {SUPPORTED_LANGUAGES.map((lang) => (
//                     <MenuItem key={lang.code} value={lang.code}>
//                       {lang.nativeLabel} ({lang.label})
//                     </MenuItem>
//                   ))}
//                 </Select>
//               </FormControl>
//             )}

//             {(user?.avatar || user?.name) && (
//               <Stack direction="row" gap="12px" alignItems="center">
//                 {user?.name && (
//                   <Typography
//                     sx={{
//                       display: {
//                         xs: "none",
//                         md: "inline-block",
//                       },
//                       fontWeight: 600,
//                     }}
//                     variant="body2"
//                   >
//                     {user?.name}
//                   </Typography>
//                 )}
//                 <Avatar
//                   src={user?.avatar}
//                   alt={user?.name}
//                   sx={{ border: "2px solid rgba(255,255,255,0.6)" }}
//                 />
//               </Stack>
//             )}
//             {isSmall ? (
//               <IconButton
//                 color="inherit"
//                 onClick={() => logout()}
//                 sx={{
//                   border: "1px solid rgba(255,255,255,0.4)",
//                 }}
//                 title={t("header.sign_out")}
//               >
//                 <LogoutIcon fontSize="small" />
//               </IconButton>
//             ) : (
//               <Button
//                 variant="contained"
//                 color="secondary"
//                 size="small"
//                 onClick={() => logout()}
//                 sx={{
//                   px: 2.5,
//                   fontWeight: 600,
//                   bgcolor: "rgba(255,255,255,0.2)",
//                   color: "#ffffff",
//                   "&:hover": {
//                     bgcolor: "rgba(255,255,255,0.3)",
//                   },
//                 }}
//               >
//                 {t("header.sign_out")}
//               </Button>
//             )}
//           </Stack>
//         </Stack>
//       </Toolbar>
//     </AppBar>
//   );
// };
