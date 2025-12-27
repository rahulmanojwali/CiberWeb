import React, { useMemo, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";

import { confirmAdminPasswordReset } from "../../services/adminUsersApi";
import { DEFAULT_COUNTRY, DEFAULT_LANGUAGE } from "../../config/appConfig";

const MIN_PASSWORD_LENGTH = 8;

type ResetStatus = "idle" | "success" | "error";

export const ResetPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = (searchParams.get("token") || "").trim();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<ResetStatus>("idle");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(
    () => Boolean(token && password.length >= MIN_PASSWORD_LENGTH && password === confirmPassword && status !== "success"),
    [token, password, confirmPassword, status],
  );

  const handleSubmit = async () => {
    if (!token) {
      setStatus("error");
      setMessage(t("resetPasswordPage.messages.invalidToken"));
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setStatus("error");
      setMessage(t("resetPasswordPage.messages.passwordTooShort", { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (password !== confirmPassword) {
      setStatus("error");
      setMessage(t("resetPasswordPage.messages.passwordMismatch"));
      return;
    }

    try {
      setLoading(true);
      setStatus("idle");
      setMessage("");
      const res = await confirmAdminPasswordReset({
        token,
        new_password: password,
        language: DEFAULT_LANGUAGE,
        country: DEFAULT_COUNTRY,
      });
      const resp = res?.response || {};

      if (String(resp.responsecode ?? "") !== "0") {
        setStatus("error");
        setMessage(resp.description || t("resetPasswordPage.messages.invalidToken"));
      } else {
        setStatus("success");
        setMessage(t("resetPasswordPage.messages.success"));
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message || t("resetPasswordPage.messages.unexpectedError"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* CM_RESET_FLOW_MARKER_20251227 */}
      <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        px: 2,
        py: 6,
        backgroundColor: "background.default",
      }}
    >
      <Paper
        elevation={2}
        sx={{
          maxWidth: 420,
          width: "100%",
          px: { xs: 3, md: 4 },
          py: { xs: 4, md: 5 },
        }}
      >
        <Stack spacing={2}>
          <Typography variant="h4" component="h1">
            {t("resetPasswordPage.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("resetPasswordPage.subtitle")}
          </Typography>

          {!token && (
            <Alert severity="error">{t("resetPasswordPage.messages.invalidToken")}</Alert>
          )}

          {status !== "idle" && token && (
            <Alert severity={status === "success" ? "success" : "error"}>{message}</Alert>
          )}

          <TextField
            label={t("resetPasswordPage.fields.newPassword")}
            type="password"
            value={password}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
            disabled={status === "success"}
            fullWidth
          />
          <TextField
            label={t("resetPasswordPage.fields.confirmPassword")}
            type="password"
            value={confirmPassword}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
            disabled={status === "success"}
            fullWidth
          />

          {status === "success" ? (
            <Button component={RouterLink} to="/login" variant="contained">
              {t("resetPasswordPage.actions.goToLogin")}
            </Button>
          ) : (
            <Button
              variant="contained"
              onClick={handleSubmit}
              disabled={!canSubmit || loading}
              endIcon={loading ? <CircularProgress size={18} color="inherit" /> : undefined}
            >
              {t("resetPasswordPage.actions.submit")}
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  );
};
