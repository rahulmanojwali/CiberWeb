import React from "react";
import { Box, Button, Card, CardContent, Stack, TextField, Typography } from "@mui/material";
import { useSnackbar } from "@refinedev/mui";
import { getStepUpSetup, enableStepUp, rotateStepUp } from "../../../services/adminUsersApi";

const TwoFactorSettings: React.FC = () => {
  const [setup, setSetup] = React.useState<{
    provisioning_uri: string;
    secret_base32: string;
    challenge_id: string;
  } | null>(null);
  const [otp, setOtp] = React.useState("");
  const [backupCodes, setBackupCodes] = React.useState<string[] | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState("Not configured");
  const { enqueueSnackbar } = useSnackbar();
  const [rotating, setRotating] = React.useState(false);

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

  const handleRotate = async () => {
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
      const resp: any = await rotateStepUp({ username });
      if (resp?.response?.responsecode === "0") {
        const payload = resp.stepup?.stepup || resp.stepup || null;
        setSetup(payload);
        setStatus("Setup initiated");
        setBackupCodes(null);
        setOtp("");
        enqueueSnackbar("2FA rotation initiated.", { variant: "success" });
      } else {
        enqueueSnackbar(resp?.response?.description || "Rotation failed.", { variant: "error" });
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
        setBackupCodes(resp?.backup_codes || []);
        setStatus("Enabled");
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

  return (
    <Box
      sx={{
        minHeight: "100vh",
        py: 4,
      }}
    >
      <Box maxWidth={560} mx="auto">
        <Card>
          <CardContent>
            <Stack spacing={3}>
              <Typography variant="h5">Two-Factor Authentication (2FA)</Typography>
              <Typography>
                2FA is mandatory for your role. Setup will be enabled here.
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button variant="contained" onClick={fetchSetup} disabled={loading}>
                  {setup ? "Refresh Setup" : "Start Setup"}
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleRotate}
                  disabled={rotating || loading}
                >
                  {rotating ? "Rotating..." : "Reconfigure 2FA"}
                </Button>
              </Stack>
              {setup && (
                <>
                  {qrSrc && (
                    <Box textAlign="center">
                      <img src={qrSrc} alt="2FA QR" width={220} height={220} />
                      <Typography variant="body2" color="text.secondary">
                        Scan with Google Authenticator or Authy
                      </Typography>
                    </Box>
                  )}
                  <Typography variant="body2">
                    Manual entry: <strong>{setup.secret_base32}</strong>
                  </Typography>
                  <TextField
                    label="One-Time Password"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    fullWidth
                    size="small"
                    helperText="Enter the 6-digit code from your authenticator."
                  />
                  <Button variant="contained" onClick={handleEnable} disabled={loading || otp.length !== 6}>
                    Enable 2FA
                  </Button>
                </>
              )}
              {status && (
                <Typography variant="subtitle2" color="text.secondary">
                  Status: {status}
                </Typography>
              )}
              {backupCodes && backupCodes.length > 0 && (
                <Box>
                  <Typography variant="subtitle2">Backup codes (store safely):</Typography>
                  <Stack spacing={1}>
                    {backupCodes.map((code) => (
                      <Typography key={code} variant="body2">
                        {code}
                      </Typography>
                    ))}
                  </Stack>
                </Box>
              )}
            </Stack>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default TwoFactorSettings;
