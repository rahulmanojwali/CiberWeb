import * as React from "react";
import { useLogin } from "@refinedev/core";
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Stack,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";

import {
  BRAND_ASSETS,
  DEFAULT_COUNTRY,
  DEFAULT_LANGUAGE,
  APP_STRINGS,
} from "../../config/appConfig";
import {
  LANGUAGE_STORAGE_KEY,
  SUPPORTED_LANGUAGES,
  normalizeLanguageCode,
} from "../../config/languages";

type LoginPayload = {
  username: string; // admin username
  password: string;
  country: string;  // e.g., "IN"
};

export const Login: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  
  const { mutate: login, isPending } = useLogin<LoginPayload>();

  const { t, i18n } = useTranslation();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [country, setCountry] = React.useState(DEFAULT_COUNTRY);
  const [language, setLanguage] = React.useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_LANGUAGE;
    try {
      const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
      return normalizeLanguageCode(stored);
    } catch {
      return DEFAULT_LANGUAGE;
    }
  });
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    document.title = `${APP_STRINGS.title} – Admin Login`;
  }, []);

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, value);
    } catch {
      // ignore storage errors
    }
    i18n.changeLanguage(value).catch(() => undefined);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!username.trim() || !password || !country) {
      setError("Please fill all the fields.");
      return;
    }

    login(
      { username: username.trim(), password, country },
      {
        onError: (err: any) => {
          const msg =
            err?.message ||
            err?.error?.message ||
            "Login failed. Please check your credentials.";
          setError(msg);
        },
      },
    );
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "background.default",
        px: { xs: 2, sm: 3 },
        py: { xs: 4, sm: 6 },
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 1120 }}>
        <Card
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            borderRadius: 4,
            overflow: "hidden",
            boxShadow: 4,
          }}
        >
          {/* Left side – illustration / branding (hidden on very small screens) */}
          <Box
            sx={{
              display: { xs: "none", md: "flex" },
              flex: 1,
              background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.success.dark})`,
              color: "#fff",
              alignItems: "center",
              justifyContent: "center",
              p: 4,
            }}
          >
            <Stack spacing={3} maxWidth={360}>
              <Box
                component="img"
                src={BRAND_ASSETS.logo}
                alt="CiberMandi"
                sx={{
                  width: 120,
                  height: "auto",
                  filter: "drop-shadow(0 8px 16px rgba(0,0,0,0.3))",
                }}
              />
              <Box>
                <Typography variant="h5" fontWeight={600}>
                  {APP_STRINGS.title}
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9, mt: 1.5 }}>
                  Secure admin console for managing organisations, mandis,
                  and marketplace operations across the CiberMandi network.
                </Typography>
              </Box>
              <Divider
                sx={{
                  borderColor: "rgba(255,255,255,0.25)",
                  my: 2,
                }}
              />
              <Typography variant="caption" sx={{ opacity: 0.8 }}>
                Tip: Use your Superadmin / Org Admin / Mandi Admin credentials
                provided by Ciberdukaan Technologies.
              </Typography>
            </Stack>
          </Box>

          {/* Right side – actual login form */}
          <Box
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "stretch",
              bgcolor: "background.paper",
            }}
          >
            <CardContent
              sx={{
                width: "100%",
                p: { xs: 3, sm: 4, md: 5 },
              }}
            >
              {/* Mobile logo / title */}
              {isMobile && (
                <Stack
                  direction="row"
                  alignItems="center"
                  spacing={2}
                  sx={{ mb: 3 }}
                >
                  <Box
                    component="img"
                    src={BRAND_ASSETS.logo}
                    alt="CiberMandi"
                    sx={{ width: 64, height: "auto" }}
                  />
                  <Box>
                    <Typography variant="h6" fontWeight={600}>
                      {APP_STRINGS.title}
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                    >
                      {APP_STRINGS.tagline}
                    </Typography>
                  </Box>
                </Stack>
              )}

              {/* Heading */}
              <Stack spacing={0.5} sx={{ mb: 3 }}>
                <Typography variant="h5" fontWeight={600}>
                  Admin Login
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Sign in to manage organisations, mandis and admin users.
                </Typography>
              </Stack>

              {/* Language & Country row */}
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={2}
                sx={{ mb: 3 }}
              >
                <FormControl fullWidth size="small">
                  <InputLabel id="language-label">Language</InputLabel>
                  <Select
                    labelId="language-label"
                    label="Language"
                    value={language}
                    onChange={(e) =>
                      handleLanguageChange(e.target.value as string)
                    }
                  >
                    {SUPPORTED_LANGUAGES.map((lang) => (
                      <MenuItem key={lang.code} value={lang.code}>
                        {lang.nativeLabel} ({lang.label})
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth size="small">
                  <InputLabel id="country-label">Country</InputLabel>
                  <Select
                    labelId="country-label"
                    label="Country"
                    value={country}
                    onChange={(e) =>
                      setCountry(e.target.value as string)
                    }
                  >
                    {/* You can add more countries later if needed */}
                    <MenuItem value="IN">India</MenuItem>
                  </Select>
                </FormControl>
              </Stack>

              {/* Login form */}
              <Box component="form" onSubmit={handleSubmit} noValidate>
                <Stack spacing={2.5}>
                  <TextField
                    label="Username"
                    fullWidth
                    size="small"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                  />
                  <TextField
                    label="Password"
                    fullWidth
                    size="small"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                  />

                  {error && (
                    <Typography
                      variant="body2"
                      color="error"
                      sx={{ mt: 0.5 }}
                    >
                      {error}
                    </Typography>
                  )}

                <Button
  type="submit"
  variant="contained"
  fullWidth
  size="medium"
  disabled={isPending}
  sx={{ mt: 1.5, py: 1.1 }}
>
  {isPending ? "Signing in..." : "Sign in"}
</Button>

                </Stack>
              </Box>

              {/* Footer hint */}
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={1}
                justifyContent="space-between"
                alignItems={{ xs: "flex-start", sm: "center" }}
                sx={{ mt: 3 }}
              >
                <Typography variant="caption" color="text.secondary">
                  © {new Date().getFullYear()} Ciberdukaan Technologies.
                </Typography>

                <Typography
                  variant="caption"
                  color="text.secondary"
                >
                  Need access? Contact your organisation admin.
                </Typography>
              </Stack>
            </CardContent>
          </Box>
        </Card>
      </Box>
    </Box>
  );
};
