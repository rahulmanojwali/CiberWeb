import React from "react";
import {
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Chip,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useSnackbar } from "@refinedev/mui";
import {
  getStepUpSetup,
  enableStepUp,
  rotateStepUp,
  getStepUpStatus,
} from "../../../services/adminUsersApi";
import { securityUi } from "../securityUi";

const TwoFactorSettings: React.FC = () => {
  const [setup, setSetup] = React.useState<{
    provisioning_uri: string;
    secret_base32: string;
    challenge_id: string;
  } | null>(null);
  const [otp, setOtp] = React.useState("");
  const [backupCodes, setBackupCodes] = React.useState<string[] | null>(null);
  const [showBackupCodes, setShowBackupCodes] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState("Not configured");
  const { enqueueSnackbar } = useSnackbar();
  const [rotating, setRotating] = React.useState(false);
  const [isEnabled, setIsEnabled] = React.useState(false);
  const [rotatePromptOpen, setRotatePromptOpen] = React.useState(false);
  const [rotateMode, setRotateMode] = React.useState<"otp" | "backup">("otp");
  const [rotateCode, setRotateCode] = React.useState("");
  const [statusInfo, setStatusInfo] = React.useState<{
    enabled: string;
    enforcement_mode: string;
    last_verified_on: string | null;
  }>({
    enabled: 'N',
    enforcement_mode: 'OPTIONAL',
    last_verified_on: null,
  });

  const fetchStatus = async () => {
    try {
      const usernameRaw = localStorage.getItem("cd_user");
      const parsed = usernameRaw ? JSON.parse(usernameRaw) : null;
      const username = parsed?.username;
      if (!username) return;
      const resp: any = await getStepUpStatus({ username });
      const stepupPayload = resp?.stepup?.stepup || resp?.stepup || {};
      setIsEnabled(stepupPayload.enabled === "Y");
      const enabledFlag = stepupPayload.enabled || "N";
      setStatus(enabledFlag === "Y" ? "Enabled" : "Not configured");
      setStatusInfo({
        enabled: enabledFlag,
        enforcement_mode: stepupPayload.enforcement_mode || "OPTIONAL",
        last_verified_on: stepupPayload.last_verified_on || null,
      });
    } catch (_err) {
      // ignore status failure
    }
  };

  const fetchSetup = async () => {
    setLoading(true);
    try {
      const usernameRaw = localStorage.getItem("cd_user");
      const parsed = usernameRaw ? JSON.parse(usernameRaw) : null;
      const username = parsed?.username;
      if (!username) {
        enqueueSnackbar("User context missing.", { variant: "error" });
        return;
      }
      const resp: any = await getStepUpSetup({
        username,
        target_username: username,
      });
      if (resp?.response?.responsecode === "0") {
        const payload = resp.stepup || resp.setup || null;
        setSetup(payload);
        setStatus("Setup initiated");
        setBackupCodes(null);
        setOtp("");
      } else {
        enqueueSnackbar(resp?.response?.description || "Setup currently unavailable.", { variant: "warning" });
      }
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Setup currently unavailable.", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleRotate = async (otp?: string, backupCode?: string) => {
    const usernameRaw = localStorage.getItem("cd_user");
    const parsed = usernameRaw ? JSON.parse(usernameRaw) : null;
    const username = parsed?.username;
    if (!username) {
      enqueueSnackbar("User context missing.", { variant: "error" });
      return;
    }
    const session = typeof window !== "undefined" ? localStorage.getItem("cm_stepup_session_id") : null;
    if (!session) {
      enqueueSnackbar("Step-up session required to rotate 2FA.", { variant: "warning" });
      return;
    }
    setRotating(true);
    try {
      const resp: any = await rotateStepUp({
        username,
        session_id: session,
        otp,
        backup_code: backupCode,
      });
      if (resp?.response?.responsecode === "0") {
        const payload = resp.stepup?.stepup || resp.stepup || null;
        setSetup(payload);
        setStatus("Setup initiated");
        setBackupCodes(null);
        setOtp("");
        setIsEnabled(false);
        setRotatePromptOpen(false);
        setRotateCode("");
        enqueueSnackbar("2FA rotation initiated.", { variant: "success" });
      } else {
        enqueueSnackbar(resp?.response?.description || "Rotation failed.", { variant: "error" });
        if (resp?.response?.description?.includes("Step-up required")) {
          enqueueSnackbar(
            "Please complete the step-up OTP on a protected screen before rotating.",
            { variant: "warning" },
          );
        }
      }
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Rotation failed.", { variant: "error" });
    } finally {
      setRotating(false);
    }
  };

  const handleEnable = async () => {
    if (!setup || otp.length !== 6) return;
    setLoading(true);
    try {
      const usernameRaw = localStorage.getItem("cd_user");
      const parsed = usernameRaw ? JSON.parse(usernameRaw) : null;
      const username = parsed?.username;
      if (!username) {
        enqueueSnackbar("User context missing.", { variant: "error" });
        return;
      }
      const resp: any = await enableStepUp({
        username,
        challenge_id: setup.challenge_id,
        otp,
      });
      if (resp?.response?.responsecode === "0") {
        const codes = resp?.stepup?.backup_codes || resp?.backup_codes || [];
        setBackupCodes(codes);
        setShowBackupCodes(true);
        setStatus("Enabled");
        setIsEnabled(true);
        setStatusInfo((prev) => ({ ...prev, enabled: "Y", last_verified_on: new Date().toISOString() }));
        enqueueSnackbar(resp.response.description || "2FA enabled.", { variant: "success" });
      } else {
        enqueueSnackbar(resp?.response?.description || "OTP verification failed.", { variant: "error" });
      }
    } catch (err: any) {
      enqueueSnackbar(err?.message || "OTP verification failed.", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const qrSrc = setup
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
        setup.provisioning_uri
      )}`
    : undefined;

  React.useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <Box sx={securityUi.container}>
    <Box
      sx={{
        ...securityUi.content,
        gap: 16,
      }}
    >
        <Box sx={securityUi.headerRow}>
          <Box>
            <Typography sx={securityUi.title}>Two-Factor Authentication (2FA)</Typography>
            <Typography sx={securityUi.subtitle}>
              Secure your SUPER_ADMIN flow with OTP before you can access sensitive screens.
            </Typography>
          </Box>
          <Chip
            label={isEnabled ? "Enabled" : "Not configured"}
            color={isEnabled ? "success" : "warning"}
            size="small"
          />
        </Box>

        <Stack spacing={2}>
          <Card sx={securityUi.card}>
            <CardContent sx={securityUi.cardContent}>
              <Box sx={securityUi.cardHeader}>
                <Typography variant="subtitle1">Current status</Typography>
                <Typography sx={securityUi.helper}>
                  Keep an eye on enforcement mode and last successful verification.
                </Typography>
              </Box>
              <Stack
                direction={{ xs: "column", sm: "row" }}
                spacing={3}
                justifyContent="space-between"
              >
                <Stack spacing={0.5}>
                  <Typography sx={securityUi.label}>State</Typography>
                  <Typography sx={securityUi.value}>
                    {statusInfo.enabled === "Y" ? "Enabled" : "Not configured"}
                  </Typography>
                  <Typography sx={securityUi.helper}>
                    Enforcement: {statusInfo.enforcement_mode}
                  </Typography>
                  <Typography sx={securityUi.helper}>
                    Last verified:{" "}
                    {statusInfo.last_verified_on
                      ? new Date(statusInfo.last_verified_on).toLocaleString()
                      : "Never"}
                  </Typography>
                </Stack>
                <Stack spacing={1} sx={{ flexGrow: 1 }}>
                  <Typography sx={securityUi.label}>Actions</Typography>
                  <Stack
                    direction="row"
                    spacing={1}
                    sx={securityUi.actionBar}
                    flexWrap="wrap"
                  >
                    <Button
                      variant="contained"
                      onClick={fetchSetup}
                      disabled={loading || isEnabled}
                    >
                      {setup ? "Refresh setup" : "Start setup"}
                    </Button>
                    {isEnabled && (
                      <Button
                        variant="outlined"
                        onClick={() => setRotatePromptOpen((prev) => !prev)}
                        disabled={rotating || loading}
                      >
                        {rotating ? "Rotating..." : "Reconfigure 2FA"}
                      </Button>
                    )}
                  </Stack>
                  {rotatePromptOpen && isEnabled && (
                    <Box
                      sx={{
                        ...securityUi.section,
                        border: "1px solid",
                        borderColor: "divider",
                        borderRadius: 1,
                        mt: 1,
                      }}
                    >
                      <Typography sx={securityUi.helper}>
                        Confirm rotation with your authenticator or a backup code.
                      </Typography>
                      <ButtonGroup size="small" variant="outlined" sx={{ mb: 1 }}>
                        <Button
                          variant={rotateMode === "otp" ? "contained" : undefined}
                          onClick={() => setRotateMode("otp")}
                        >
                          Authenticator
                        </Button>
                        <Button
                          variant={rotateMode === "backup" ? "contained" : undefined}
                          onClick={() => setRotateMode("backup")}
                        >
                          Backup code
                        </Button>
                      </ButtonGroup>
                      <TextField
                        label={rotateMode === "otp" ? "Authenticator code" : "Backup code"}
                        value={rotateCode}
                        onChange={(event) => {
                          const value = event.target.value;
                          setRotateCode(
                            rotateMode === "otp"
                              ? value.replace(/\D/g, "").slice(0, 6)
                              : value,
                          );
                        }}
                        fullWidth
                        size="small"
                        helperText={
                          rotateMode === "otp"
                            ? "Enter the 6-digit authenticator code."
                            : "Enter a one-time backup code."
                        }
                      />
                      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                        <Button
                          variant="contained"
                          onClick={() =>
                            handleRotate(
                              rotateMode === "otp" ? rotateCode : undefined,
                              rotateMode === "backup" ? rotateCode : undefined,
                            )
                          }
                          disabled={
                            rotating ||
                            (rotateMode === "otp" ? rotateCode.length !== 6 : !rotateCode.trim())
                          }
                        >
                          {rotating ? "Verifying..." : "Confirm rotate"}
                        </Button>
                        <Button variant="text" onClick={() => setRotatePromptOpen(false)}>
                          Cancel
                        </Button>
                      </Stack>
                    </Box>
                  )}
                </Stack>
              </Stack>
              <Typography sx={{ mt: 2, fontSize: 13, color: "text.secondary" }}>
                2FA must be configured before sensitive screens can be accessed.
              </Typography>
            </CardContent>
          </Card>

          <Card sx={securityUi.card}>
            <CardContent sx={securityUi.cardContent}>
              <Box sx={securityUi.cardHeader}>
                <Typography variant="subtitle1">Setup & Backup</Typography>
              </Box>
              <Stack spacing={2}>
                {setup && qrSrc && (
                  <Box textAlign="center">
                    <img src={qrSrc} alt="2FA QR" width={200} height={200} />
                    <Typography sx={securityUi.helper}>
                      Scan with Google Authenticator or Authy.
                    </Typography>
                  </Box>
                )}
                <Box sx={securityUi.section}>
                  <Typography sx={securityUi.label}>Secret</Typography>
                  <Box sx={securityUi.codeBox}>
                    {setup?.secret_base32 || "Trigger setup to reveal the secret."}
                  </Box>
                </Box>
                <TextField
                  label="One-Time Password"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  fullWidth
                  size="small"
                  helperText="Enter the 6-digit code from your authenticator."
                />
                <Box>
                  <Button
                    variant="contained"
                    onClick={handleEnable}
                    disabled={loading || otp.length !== 6}
                  >
                    Enable 2FA
                  </Button>
                </Box>
                {status && (
                  <Typography sx={securityUi.helper}>Status: {status}</Typography>
                )}
                {backupCodes && backupCodes.length > 0 && showBackupCodes && (
                  <Box>
                    <Typography sx={securityUi.label}>Backup codes (store safely)</Typography>
                    <Stack spacing={1} sx={securityUi.codeBox}>
                      {backupCodes.map((code) => (
                        <Typography key={code} variant="body2">
                          {code}
                        </Typography>
                      ))}
                    </Stack>
                    <Button
                      variant="text"
                      onClick={() => {
                        setShowBackupCodes(false);
                        setBackupCodes(null);
                      }}
                    >
                      I have saved these codes
                    </Button>
                  </Box>
                )}
                {backupCodes && backupCodes.length > 0 && !showBackupCodes && (
                  <Typography sx={securityUi.helper}>
                    Backup codes hidden after confirmation.
                  </Typography>
                )}
              </Stack>
            </CardContent>
          </Card>
        </Stack>
      </Box>
    </Box>
  );
};

export default TwoFactorSettings;
