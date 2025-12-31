import * as React from "react";
import { useNavigate } from "react-router-dom";
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

import { requireStepUp, verifyStepUp } from "../../services/adminUsersApi";
import { canonicalizeResourceKey } from "../../utils/adminUiConfig";
import { getCurrentAdminUsername, getStoredAdminUser } from "../../utils/session";
import {
  getStepupLockedSet,
  loadStepupLockedSetOnce,
} from "../../utils/stepupCache";

type StepUpRequestSource = "MENU" | "ROUTE" | "GUARD" | "OTHER";

type StepUpPrompt = {
  resourceKey: string;
  action: string;
};

type StepUpContextValue = {
  ensureStepUp: (
    resourceKey?: string | null,
    action?: string,
    opts?: { source?: StepUpRequestSource },
  ) => Promise<boolean>;
  isLocked: (resourceKey?: string | null) => boolean;
  markVerified: () => void;
  ready: boolean;
  ruleKey: string;
};

const STEP_UP_RULE_KEY = "ADMIN_SCREEN_STEPUP_V1";

const StepUpContext = React.createContext<StepUpContextValue | undefined>(undefined);

export const StepUpProvider: React.FC<React.PropsWithChildren<unknown>> = ({ children }) => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [cacheReady, setCacheReady] = React.useState(false);
  const [lockedVersion, setLockedVersion] = React.useState(0);
  const [pendingPrompt, setPendingPrompt] = React.useState<StepUpPrompt | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const [otp, setOtp] = React.useState("");
  const [backupCode, setBackupCode] = React.useState("");
  const [useBackup, setUseBackup] = React.useState(false);
  const [verifying, setVerifying] = React.useState(false);
  const resolveRef = React.useRef<((result: boolean) => void) | null>(null);
  const loadPromiseRef = React.useRef<Promise<void> | null>(null);

  const ensureCacheLoaded = React.useCallback(async () => {
    if (cacheReady) return;
    if (loadPromiseRef.current) return loadPromiseRef.current;

    const storedUser = getStoredAdminUser();
    if (!storedUser?.username) {
      setCacheReady(true);
      return;
    }

    const promise = loadStepupLockedSetOnce({
      username: storedUser.username,
      language: storedUser.language,
      country: storedUser.country,
    })
      .then(() => {
        setLockedVersion((prev) => prev + 1);
      })
      .catch(() => {
        // ignore load failure but keep cacheReady true
      })
      .finally(() => {
        loadPromiseRef.current = null;
        setCacheReady(true);
      });

    loadPromiseRef.current = promise;
    return promise;
  }, [cacheReady]);

  React.useEffect(() => {
    ensureCacheLoaded();
  }, [ensureCacheLoaded]);

  const issueStepUpCheck = React.useCallback(
    async (resourceKey: string, action: string) => {
      const storedUser = getStoredAdminUser();
      const username = storedUser?.username || getCurrentAdminUsername();
      if (!username) {
        throw new Error("Unable to resolve current user for step-up");
      }

      const sessionId =
        typeof window !== "undefined" ? localStorage.getItem("cm_stepup_session_id") : null;
      const resp: any = await requireStepUp({
        username,
        target_username: username,
        language: storedUser?.language,
        country: storedUser?.country,
        session_id: sessionId || undefined,
        resource_key: resourceKey,
        action,
      });

      return (
        resp?.stepup ||
        resp?.response?.stepup ||
        resp?.response ||
        resp?.stepup?.stepup ||
        null
      );
    },
    [],
  );

  const isLocked = React.useCallback(
    (resourceKey?: string | null) => {
      const normalized = canonicalizeResourceKey(resourceKey);
      if (!normalized) return false;
      const lockedSet = getStepupLockedSet();
      return Boolean(normalized && lockedSet.has(normalized));
    },
    [lockedVersion],
  );

  const markVerified = React.useCallback(() => {
    setLockedVersion((prev) => prev + 1);
  }, []);

  const handleRetry = React.useCallback(async () => {
    if (!pendingPrompt) return;
    try {
      const stepup = await issueStepUpCheck(
        pendingPrompt.resourceKey,
        pendingPrompt.action,
      );
      if (!stepup) {
        resolveRef.current?.(true);
        resolveRef.current = null;
        setPendingPrompt(null);
        setModalOpen(false);
        markVerified();
        return;
      }
      if (stepup.mode === "ENROLL_MANDATORY") {
        enqueueSnackbar(
          "2FA enrollment is mandatory before you can continue.",
          { variant: "warning" },
        );
        navigate("/system/security/2fa", { replace: true });
        resolveRef.current?.(false);
        resolveRef.current = null;
        setPendingPrompt(null);
        setModalOpen(false);
        return;
      }
      if (stepup.mode === "OTP_REQUIRED") {
        setModalOpen(true);
        return;
      }
      resolveRef.current?.(true);
      resolveRef.current = null;
      setPendingPrompt(null);
      setModalOpen(false);
      markVerified();
    } catch (error: any) {
      enqueueSnackbar(error?.message || "Step-up check failed.", { variant: "error" });
      resolveRef.current?.(false);
      resolveRef.current = null;
      setPendingPrompt(null);
      setModalOpen(false);
    }
  }, [enqueueSnackbar, issueStepUpCheck, markVerified, navigate, pendingPrompt]);

  const ensureStepUp = React.useCallback(
    async (
      resourceKey?: string | null,
      action: string = "VIEW",
      opts?: { source?: StepUpRequestSource },
    ) => {
      const normalized = canonicalizeResourceKey(resourceKey);
      if (!normalized) return true;
      await ensureCacheLoaded();
      const lockedSet = getStepupLockedSet();
      const isLockedScreen = Boolean(normalized && lockedSet.has(normalized));
      console.info(
        "[STEPUP_UI]",
        { resource_key: normalized, locked: isLockedScreen, source: opts?.source ?? "UNKNOWN" },
      );
      if (!isLockedScreen) return true;

      try {
        const stepup = await issueStepUpCheck(normalized, action);
        if (!stepup) return true;
        if (stepup.mode === "ENROLL_MANDATORY") {
          enqueueSnackbar(
            "2FA enrollment is mandatory before you can continue.",
            { variant: "warning" },
          );
          navigate("/system/security/2fa", { replace: true });
          return false;
        }
        if (stepup.mode === "OTP_REQUIRED") {
          setPendingPrompt({ resourceKey: normalized, action });
          setModalOpen(true);
          return new Promise<boolean>((resolve) => {
            resolveRef.current = resolve;
          });
        }
        return true;
      } catch (error: any) {
        enqueueSnackbar(error?.message || "Step-up check failed.", { variant: "error" });
        return false;
      }
    },
    [enqueueSnackbar, ensureCacheLoaded, issueStepUpCheck, navigate],
  );

  const handleVerify = React.useCallback(async () => {
    if (!pendingPrompt) return;
    const username = getCurrentAdminUsername();
    if (!username) {
      enqueueSnackbar("Unable to resolve current user for verification.", { variant: "error" });
      return;
    }
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
      const stepupSessionId = payload?.stepup_session_id;
      if (stepupSessionId) {
        if (typeof window !== "undefined") {
          localStorage.setItem("cm_stepup_session_id", stepupSessionId);
        }
        enqueueSnackbar("Step-up verified.", { variant: "success" });
        setModalOpen(false);
        setOtp("");
        setBackupCode("");
        setUseBackup(false);
        markVerified();
        setPendingPrompt(null);
        resolveRef.current?.(true);
        resolveRef.current = null;
        return;
      }
      enqueueSnackbar(resp?.response?.description || "Step-up verification failed.", {
        variant: "error",
      });
    } catch (error: any) {
      enqueueSnackbar(error?.message || "Step-up verification failed.", { variant: "error" });
    } finally {
      setVerifying(false);
    }
  }, [backupCode, enqueueSnackbar, markVerified, otp, pendingPrompt, useBackup]);

  const contextValue = React.useMemo(
    () => ({
      ensureStepUp,
      isLocked,
      markVerified,
      ready: cacheReady,
      ruleKey: STEP_UP_RULE_KEY,
    }),
    [ensureStepUp, isLocked, markVerified, cacheReady],
  );

  return (
    <StepUpContext.Provider value={contextValue}>
      {children}
      <StepUpModal
        open={modalOpen}
        onRetry={handleRetry}
        onVerify={handleVerify}
        verifying={verifying}
        otp={otp}
        backupCode={backupCode}
        useBackup={useBackup}
        setUseBackup={setUseBackup}
        setOtp={setOtp}
        setBackupCode={setBackupCode}
      />
    </StepUpContext.Provider>
  );
};

export const useStepUpContext = () => {
  const ctx = React.useContext(StepUpContext);
  if (!ctx) {
    throw new Error("useStepUpContext must be used within StepUpProvider");
  }
  return ctx;
};

const StepUpModal: React.FC<{
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
}> = ({
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
