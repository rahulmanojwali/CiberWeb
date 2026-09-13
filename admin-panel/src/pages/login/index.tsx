import * as React from "react";
import { useLogin } from "@refinedev/core";
import {
  Box,
  Button,
  Divider,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import PublicOutlinedIcon from "@mui/icons-material/PublicOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";

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
  username: string;
  password: string;
  country: string;
};

export const Login: React.FC = () => {
  const { mutate: login, isPending } = useLogin<LoginPayload>();
  const { i18n } = useTranslation();

  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [country, setCountry] = React.useState(DEFAULT_COUNTRY);
  const [language, setLanguage] = React.useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT_LANGUAGE;
    try {
      return normalizeLanguageCode(localStorage.getItem(LANGUAGE_STORAGE_KEY));
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
      // Storage availability must never block authentication.
    }
    i18n.changeLanguage(value).catch(() => undefined);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password || !country) {
      setError("Please enter your username, password and country.");
      return;
    }

    login(
      { username: username.trim(), password, country },
      {
        onError: (err: any) => {
          setError(
            err?.message ||
              err?.error?.message ||
              "Login failed. Please check your credentials.",
          );
        },
      },
    );
  };

  return (
    <Box className="cm-login-page">
      <Box className="cm-login-orb cm-login-orb-one" />
      <Box className="cm-login-orb cm-login-orb-two" />

      <Box className="cm-login-shell">
        <Box className="cm-login-brand-panel">
          <Stack className="cm-login-brand-content" spacing={0}>
            <Stack direction="row" alignItems="center" spacing={1.5} className="cm-login-brand-lockup">
              <Box component="img" src={BRAND_ASSETS.logo} alt="CiberMandi" className="cm-login-logo" />
              <Box>
                <Typography className="cm-login-brand-name">CiberMandi</Typography>
                <Typography className="cm-login-brand-kicker">Enterprise Operations Console</Typography>
              </Box>
            </Stack>

            <Box className="cm-login-brand-copy">
              <Typography component="h1" className="cm-login-hero-title">
                One command centre for the complete mandi network.
              </Typography>
              <Typography className="cm-login-hero-copy">
                Securely manage organisations, mandis, operations, approvals, staff and reporting from one governed workspace.
              </Typography>
            </Box>

            <Stack className="cm-login-trust-list" spacing={1.35}>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Box className="cm-login-trust-icon"><ShieldOutlinedIcon /></Box>
                <Box>
                  <Typography className="cm-login-trust-title">Role-scoped access</Typography>
                  <Typography className="cm-login-trust-copy">Permissions and operational scope remain server-authoritative.</Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Box className="cm-login-trust-icon"><VerifiedUserOutlinedIcon /></Box>
                <Box>
                  <Typography className="cm-login-trust-title">Protected administration</Typography>
                  <Typography className="cm-login-trust-copy">Built for controlled administrative and operational workflows.</Typography>
                </Box>
              </Stack>
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Box className="cm-login-trust-icon"><PublicOutlinedIcon /></Box>
                <Box>
                  <Typography className="cm-login-trust-title">Responsive everywhere</Typography>
                  <Typography className="cm-login-trust-copy">A consistent console across desktop, laptop, tablet and mobile.</Typography>
                </Box>
              </Stack>
            </Stack>

            <Typography className="cm-login-brand-footnote">
              CiberMandi · India&apos;s Digital Mandi Network
            </Typography>
          </Stack>
        </Box>

        <Box className="cm-login-form-panel">
          <Box className="cm-login-form-wrap">
            <Stack direction="row" alignItems="center" spacing={1.25} className="cm-login-mobile-brand">
              <Box component="img" src={BRAND_ASSETS.logo} alt="CiberMandi" className="cm-login-mobile-logo" />
              <Box>
                <Typography className="cm-login-mobile-name">CiberMandi</Typography>
                <Typography className="cm-login-mobile-tagline">Enterprise Operations Console</Typography>
              </Box>
            </Stack>

            <Box className="cm-login-form-heading">
              <Box className="cm-login-lock-badge"><LockOutlinedIcon /></Box>
              <Typography component="h2" className="cm-login-form-title">Welcome back</Typography>
              <Typography className="cm-login-form-subtitle">
                Sign in with your authorised CiberMandi administrator account.
              </Typography>
            </Box>

            <Box component="form" onSubmit={handleSubmit} noValidate>
              <Stack spacing={2.1}>
                <TextField
                  label="Username"
                  size="small"
                  fullWidth
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  autoFocus
                  className="cm-login-field"
                />

                <TextField
                  label="Password"
                  size="small"
                  fullWidth
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="cm-login-field"
                  InputProps={{
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          onClick={() => setShowPassword((value) => !value)}
                          edge="end"
                          size="small"
                        >
                          {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }}
                />

                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
                  <FormControl fullWidth size="small" className="cm-login-select">
                    <InputLabel id="cm-login-language-label">Language</InputLabel>
                    <Select
                      labelId="cm-login-language-label"
                      label="Language"
                      value={language}
                      onChange={(e) => handleLanguageChange(e.target.value as string)}
                    >
                      {SUPPORTED_LANGUAGES.map((lang) => (
                        <MenuItem key={lang.code} value={lang.code}>
                          {lang.nativeLabel} ({lang.label})
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <FormControl fullWidth size="small" className="cm-login-select">
                    <InputLabel id="cm-login-country-label">Country</InputLabel>
                    <Select
                      labelId="cm-login-country-label"
                      label="Country"
                      value={country}
                      onChange={(e) => setCountry(e.target.value as string)}
                    >
                      <MenuItem value="IN">India</MenuItem>
                    </Select>
                  </FormControl>
                </Stack>

                <Stack direction="row" justifyContent="flex-end">
                  <Link component={RouterLink} to="/forgot-password" className="cm-login-forgot-link">
                    Forgot password?
                  </Link>
                </Stack>

                {error && (
                  <Box role="alert" className="cm-login-error">
                    <Typography>{error}</Typography>
                  </Box>
                )}

                <Button
                  type="submit"
                  variant="contained"
                  fullWidth
                  size="large"
                  disabled={isPending}
                  endIcon={!isPending ? <ArrowForwardRoundedIcon /> : undefined}
                  className="cm-login-submit"
                >
                  {isPending ? "Signing in…" : "Sign in securely"}
                </Button>
              </Stack>
            </Box>

            <Divider className="cm-login-divider" />

            <Stack direction={{ xs: "column", sm: "row" }} spacing={0.75} justifyContent="space-between">
              <Typography className="cm-login-footer-text">
                © {new Date().getFullYear()} Ciberdukaan Technologies
              </Typography>
              <Typography className="cm-login-footer-text">
                Need access? Contact your organisation administrator.
              </Typography>
            </Stack>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};
