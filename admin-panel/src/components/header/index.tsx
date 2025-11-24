import DarkModeOutlined from "@mui/icons-material/DarkModeOutlined";
import LightModeOutlined from "@mui/icons-material/LightModeOutlined";
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
import { useGetIdentity, useLogout } from "@refinedev/core";
import { HamburgerMenu, RefineThemedLayoutHeaderProps } from "@refinedev/mui";
import React, { useContext } from "react";
import { useTranslation } from "react-i18next";
import { ColorModeContext } from "../../contexts/color-mode";
import { BRAND_ASSETS, DEFAULT_LANGUAGE } from "../../config/appConfig";
import { LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES, normalizeLanguageCode } from "../../config/languages";

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

  const { data: user } = useGetIdentity<IUser>();
  const currentLanguage = normalizeLanguageCode(i18n.language || DEFAULT_LANGUAGE);

  const handleLanguageChange = (event: any) => {
    const next = event.target.value;
    i18n.changeLanguage(next);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // ignore storage errors
    }
  };

  return (
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
      <Toolbar sx={{ py: 1.5, px: { xs: 2, md: 3 } }}>
        <Stack
          direction="row"
          width="100%"
          alignItems="center"
          justifyContent="space-between"
          gap={2}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <HamburgerMenu />
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box
                component="img"
                src={BRAND_ASSETS.logo}
                alt="CiberMandi"
                sx={{
                  height: 42,
                  width: "auto",
                  filter: "brightness(0) invert(1)",
                }}
              />
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {t("app.title")}
                </Typography>
                <Typography
                  variant="caption"
                  sx={{ letterSpacing: 0.5, opacity: 0.85 }}
                >
                  {t("app.tagline")}
                </Typography>
              </Box>
            </Stack>
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center">
            <IconButton
              color="inherit"
              onClick={() => {
                setMode();
              }}
              sx={{
                border: "1px solid rgba(255,255,255,0.4)",
              }}
              title={t("header.theme_toggle")}
            >
              {mode === "dark" ? <LightModeOutlined /> : <DarkModeOutlined />}
            </IconButton>

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

            {(user?.avatar || user?.name) && (
              <Stack direction="row" gap="12px" alignItems="center">
                {user?.name && (
                  <Typography
                    sx={{
                      display: {
                        xs: "none",
                        sm: "inline-block",
                      },
                      fontWeight: 600,
                    }}
                    variant="body2"
                  >
                    {user?.name}
                  </Typography>
                )}
                <Avatar
                  src={user?.avatar}
                  alt={user?.name}
                  sx={{ border: "2px solid rgba(255,255,255,0.6)" }}
                />
              </Stack>
            )}
            <Button
              variant="contained"
              color="secondary"
              size="small"
              onClick={() => logout()}
              sx={{
                px: 2.5,
                fontWeight: 600,
                bgcolor: "rgba(255,255,255,0.2)",
                color: "#ffffff",
                "&:hover": {
                  bgcolor: "rgba(255,255,255,0.3)",
                },
              }}
            >
              {t("header.sign_out")}
            </Button>
          </Stack>
        </Stack>
      </Toolbar>
    </AppBar>
  );
};
