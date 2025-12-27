import * as React from "react";
import { Box, Button, Card, CardContent, Stack, TextField, Typography, Alert, Link } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { Link as RouterLink } from "react-router-dom";

import {
  DEFAULT_COUNTRY,
  DEFAULT_LANGUAGE,
  APP_STRINGS,
} from "../../config/appConfig";
import { requestAdminPasswordReset } from "../../services/adminUsersApi";

export const ForgotPassword: React.FC = () => {
  const theme = useTheme();
  const [username, setUsername] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    document.title = `${APP_STRINGS.title} – Forgot Password`;
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitted) return;
    setError(null);

    const target = username.trim();
    if (!target) {
      setError("Enter your username.");
      return;
    }

    setLoading(true);
    try {
      await requestAdminPasswordReset({
        username: target,
        target_username: target,
        language: DEFAULT_LANGUAGE,
        country: DEFAULT_COUNTRY,
      });
    } catch (err: any) {
      console.error("Failed to send forgot password request", err);
    } finally {
      setLoading(false);
      setSubmitted(true);
    }
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
      <Box sx={{ width: "100%", maxWidth: 520 }}>
        <Card sx={{ borderRadius: 3, boxShadow: 8 }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 }, position: "relative" }}>
            {/* CM_FORGOT_PASSWORD_FLOW_20251227 */}
            <Stack spacing={2.5}>
              <Typography variant="h5" fontWeight={600}>
                Forgot Password
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Enter your admin username and we will send a secure reset link to
                the registered email. You will not be notified whether the account
                exists for security reasons.
              </Typography>

              {submitted ? (
                <Alert severity="info">
                  If the account exists, we’ve sent a reset link to the registered
                  email.
                </Alert>
              ) : (
                <Box component="form" onSubmit={handleSubmit} noValidate>
                  <Stack spacing={2}>
                    <TextField
                      label="Username"
                      fullWidth
                      size="small"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={loading}
                    />
                    {error && (
                      <Alert severity="error" variant="outlined">
                        {error}
                      </Alert>
                    )}
                    <Button type="submit" variant="contained" fullWidth disabled={loading}>
                      {loading ? "Sending…" : "Send reset link"}
                    </Button>
                  </Stack>
                </Box>
              )}

              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Link component={RouterLink} to="/login" variant="body2">
                  Back to login
                </Link>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};
