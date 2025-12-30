import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useSnackbar } from "@refinedev/mui";

import { requireStepUp, verifyStepUp } from "../services/adminUsersApi";
import { getStepupLockedSet } from "../utils/stepupCache";

type StepUpResponse = {
  required?: boolean;
  mode?: "ENROLL_MANDATORY" | "OTP_REQUIRED";
};

type StepUpGuardProps = {
  username: string | null;
  resourceKey?: string;
  action?: string;
  children: React.ReactNode;
};

type StepUpModalProps = {
  open: boolean;
  onRetry: () => void;
  onVerify: () => void;
  verifying: boolean;
  otp: string;
  backupCode: string;
  useBackup: boolean;
  setUseBackup: (value: boolean) => void;
  setOtp: (value: string) => void;
  setBackupCode: (value: string) => void;
};

const StepUpModal: React.FC<StepUpModalProps> = ({
  open,
  onRetry,
  onVerify,
  verifying,
  otp,
  backupCode,
  useBackup,
  setUseBackup,
  setOtp,
  setBackupCode,
}) => (
  <Dialog open={open} fullWidth maxWidth="xs">
    <DialogTitle>2FA Step-Up Required</DialogTitle>
    <DialogContent dividers>
      <Typography mb={2}>
        Your SUPER_ADMIN role requires secondary authentication before continuing.
        Please complete the verification below.
      </Typography>
      <FormControlLabel
        control={
          <Switch
            checked={useBackup}
            onChange={(event) => setUseBackup(event.target.checked)}
            color="primary"
          />
        }
        label="Use backup code"
      />
      <TextField
        label={useBackup ? "Backup code" : "Authenticator code"}
        value={useBackup ? backupCode : otp}
        onChange={(event) =>
          useBackup
            ? setBackupCode(event.target.value)
            : setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
        }
        fullWidth
        margin="normal"
        helperText={
          useBackup
            ? "Enter one of your unused backup codes."
            : "Enter the 6-digit code from your authenticator."
        }
      />
    </DialogContent>
    <DialogActions>
      <Button variant="outlined" onClick={onRetry} disabled={verifying}>
        Recheck Step-Up Status
      </Button>
      <Button
        variant="contained"
        onClick={onVerify}
        disabled={
          verifying ||
          (!useBackup && otp.length !== 6) ||
          (useBackup && backupCode.trim().length === 0)
        }
      >
        {verifying ? <CircularProgress size={20} /> : "Verify"}
      </Button>
    </DialogActions>
  </Dialog>
);

export const StepUpGuard: React.FC<StepUpGuardProps> = ({
  username,
  children,
  resourceKey,
  action = "VIEW",
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const normalizedResourceKey = resourceKey ? resourceKey.trim().toLowerCase() : "";
  const finalResourceKey = normalizedResourceKey || resourceKey || undefined;
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = React.useState(true);
  const [stepupRequired, setStepupRequired] = React.useState<StepUpResponse | null>(
    null
  );
  const [modalOpen, setModalOpen] = React.useState(false);
  const [otp, setOtp] = React.useState("");
  const [backupCode, setBackupCode] = React.useState("");
  const [useBackup, setUseBackup] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);

  const checkStepUp = React.useCallback(async () => {
    if (!username) {
      setLoading(false);
      setStepupRequired({ required: false });
      return;
    }

    const lockedSet = getStepupLockedSet();
    const isLocked = Boolean(finalResourceKey && lockedSet.has(finalResourceKey));
    console.log(
      "[STEPUP_GUARD]",
      `route=${location?.pathname || "unknown"}`,
      `key=${finalResourceKey || "unknown"}`,
      `locked=${isLocked}`,
    );
    if (!isLocked) {
      setLoading(false);
      setStepupRequired({ required: false });
      return;
    }

    try {
      const session = typeof window !== "undefined" ? localStorage.getItem("cm_stepup_session_id") : null;
      const resp: any = await requireStepUp({
        username,
        target_username: username,
        session_id: session || undefined,
        resource_key: finalResourceKey,
        action,
      });
      const stepup: StepUpResponse = resp?.stepup || {};
      if (stepup.mode === "ENROLL_MANDATORY") {
        enqueueSnackbar(
          "2FA is mandatory for your role. Please enable it to continue.",
          { variant: "warning" }
        );
        navigate("/system/security/2fa", { replace: true });
        setStepupRequired(stepup);
        return;
      }
      if (stepup.mode === "OTP_REQUIRED") {
        setModalOpen(true);
        setStepupRequired(stepup);
        return;
      }
      setModalOpen(false);
      setStepupRequired({ required: false });
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Step-up check failed.", { variant: "error" });
      setStepupRequired({ required: false });
    } finally {
      setLoading(false);
    }
  }, [username, enqueueSnackbar, navigate, resourceKey, action]);

  const handleVerify = React.useCallback(async () => {
    if (!username) return;
    if (!useBackup && otp.length !== 6) {
      enqueueSnackbar("Enter a 6-digit OTP.", { variant: "warning" });
      return;
    }
    if (useBackup && !backupCode.trim()) {
      enqueueSnackbar("Enter a backup code.", { variant: "warning" });
      return;
    }
    setVerifying(true);
    try {
      const resp: any = await verifyStepUp({
        username,
        otp: useBackup ? undefined : otp,
        backup_code: useBackup ? backupCode.trim() : undefined,
      });
      const payload = resp?.stepup?.stepup || resp?.stepup;
      const stepupId = payload?.stepup_session_id;
      if (stepupId) {
        if (typeof window !== "undefined") {
          localStorage.setItem("cm_stepup_session_id", stepupId);
        }
        enqueueSnackbar("Step-up verified.", { variant: "success" });
        setModalOpen(false);
        setOtp("");
        setBackupCode("");
        setUseBackup(false);
        await checkStepUp();
        return;
      }
      enqueueSnackbar(resp?.response?.description || "Step-up verification failed.", {
        variant: "error",
      });
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Step-up verification failed.", { variant: "error" });
    } finally {
      setVerifying(false);
    }
  }, [
    username,
    useBackup,
    otp,
    backupCode,
    enqueueSnackbar,
    checkStepUp,
  ]);

  React.useEffect(() => {
    checkStepUp();
  }, [checkStepUp]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (stepupRequired?.mode === "ENROLL_MANDATORY") {
    return null;
  }

  if (modalOpen) {
    return (
      <StepUpModal
        open={modalOpen}
        onRetry={() => checkStepUp()}
        onVerify={handleVerify}
        verifying={verifying}
        otp={otp}
        backupCode={backupCode}
        useBackup={useBackup}
        setUseBackup={setUseBackup}
        setOtp={setOtp}
        setBackupCode={setBackupCode}
      />
    );
  }

  return <>{children}</>;
};
