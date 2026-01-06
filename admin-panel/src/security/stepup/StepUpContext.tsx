// // working well, however cross button and mobile comptiable is missing dont delete it 04 jan 2026 dont delete it
// import * as React from "react";
// import { useNavigate } from "react-router-dom";
// import {
//   Alert,
//   Box,
//   Button,
//   Chip,
//   CircularProgress,
//   Dialog,
//   DialogActions,
//   DialogContent,
//   Divider,
//   FormControlLabel,
//   IconButton,
//   Switch,
//   TextField,
//   Typography,
// } from "@mui/material";
// import { useSnackbar } from "@refinedev/mui";

// import { requireStepUp, verifyStepUp } from "../../services/adminUsersApi";
// import { canonicalizeResourceKey } from "../../utils/adminUiConfig";
// import { getCurrentAdminUsername, getStoredAdminUser } from "../../utils/session";
// import { getStepupLockedSet, loadStepupLockedSetOnce } from "../../utils/stepupCache";
// import { getBrowserSessionId } from "./browserSession";
// import SecurityIcon from "@mui/icons-material/Security";
// import KeyIcon from "@mui/icons-material/VpnKey";
// import CloseIcon from "@mui/icons-material/Close";

// type StepUpRequestSource = "MENU" | "ROUTE" | "GUARD" | "OTHER";

// type StepUpPrompt = {
//   resourceKey: string;
//   action: string;
// };

// type StepUpContextValue = {
//   ensureStepUp: (
//     resourceKey?: string | null,
//     action?: string,
//     opts?: { source?: StepUpRequestSource },
//   ) => Promise<boolean>;
//   isLocked: (resourceKey?: string | null) => boolean;
//   markVerified: () => void;
//   ready: boolean;
//   ruleKey: string;
// };

// const STEP_UP_RULE_KEY = "ADMIN_SCREEN_STEPUP_V1";
// const STEPUP_SESSION_KEY = "cm_stepup_session_id";

// const StepUpContext = React.createContext<StepUpContextValue | undefined>(undefined);

// function getStoredStepupSessionId(): string | null {
//   if (typeof window === "undefined") return null;

//   // ✅ Correct storage: sessionStorage (clears on browser close)
//   const s = sessionStorage.getItem(STEPUP_SESSION_KEY);
//   if (s) return s;

//   // Backward compatibility: migrate any legacy localStorage value once
//   const legacy = localStorage.getItem(STEPUP_SESSION_KEY);
//   if (legacy) {
//     sessionStorage.setItem(STEPUP_SESSION_KEY, legacy);
//     localStorage.removeItem(STEPUP_SESSION_KEY);
//     return legacy;
//   }
//   return null;
// }

// function storeStepupSessionId(stepupSessionId: string) {
//   if (typeof window === "undefined") return;
//   sessionStorage.setItem(STEPUP_SESSION_KEY, stepupSessionId);
//   // defensive cleanup (old builds)
//   localStorage.removeItem(STEPUP_SESSION_KEY);
// }

// export const StepUpProvider: React.FC<React.PropsWithChildren<unknown>> = ({ children }) => {
//   const navigate = useNavigate();
//   const { enqueueSnackbar } = useSnackbar();
//   const [cacheReady, setCacheReady] = React.useState(false);
//   const [lockedVersion, setLockedVersion] = React.useState(0);
//   const [pendingPrompt, setPendingPrompt] = React.useState<StepUpPrompt | null>(null);
//   const [modalOpen, setModalOpen] = React.useState(false);
//   const [otp, setOtp] = React.useState("");
//   const [backupCode, setBackupCode] = React.useState("");
//   const [useBackup, setUseBackup] = React.useState(false);
//   const [verifying, setVerifying] = React.useState(false);
//   const resolveRef = React.useRef<((result: boolean) => void) | null>(null);
//   const loadPromiseRef = React.useRef<Promise<void> | null>(null);

//   const ensureCacheLoaded = React.useCallback(async () => {
//     if (cacheReady) return;
//     if (loadPromiseRef.current) return loadPromiseRef.current;

//     const storedUser = getStoredAdminUser();
//     if (!storedUser?.username) {
//       setCacheReady(true);
//       return;
//     }

//     const promise = loadStepupLockedSetOnce({
//       username: storedUser.username,
//       language: storedUser.language,
//       country: storedUser.country,
//     })
//       .then(() => {
//         setLockedVersion((prev) => prev + 1);
//       })
//       .catch(() => {
//         // ignore load failure but keep cacheReady true
//       })
//       .finally(() => {
//         loadPromiseRef.current = null;
//         setCacheReady(true);
//       });

//     loadPromiseRef.current = promise;
//     return promise;
//   }, [cacheReady]);

//   React.useEffect(() => {
//     getBrowserSessionId();
//     ensureCacheLoaded();
//   }, [ensureCacheLoaded]);

//   const issueStepUpCheck = React.useCallback(async (resourceKey: string, action: string) => {
//     const storedUser = getStoredAdminUser();
//     const username = storedUser?.username || getCurrentAdminUsername();
//     if (!username) {
//       throw new Error("Unable to resolve current user for step-up");
//     }

//     const browserSessionId = getBrowserSessionId();
//     const sessionId = getStoredStepupSessionId();

//     const resp: any = await requireStepUp({
//       username,
//       target_username: username,
//       language: storedUser?.language,
//       country: storedUser?.country,
//       session_id: sessionId || undefined,
//       browser_session_id: browserSessionId || undefined,
//       resource_key: resourceKey,
//       action,
//     });

//     return resp?.stepup || resp?.response?.stepup || resp?.response || resp?.stepup?.stepup || null;
//   }, []);

//   const isLocked = React.useCallback(
//     (resourceKey?: string | null) => {
//       const normalized = canonicalizeResourceKey(resourceKey);
//       if (!normalized) return false;
//       const lockedSet = getStepupLockedSet();
//       return Boolean(normalized && lockedSet.has(normalized));
//     },
//     [lockedVersion],
//   );

//   const markVerified = React.useCallback(() => {
//     setLockedVersion((prev) => prev + 1);
//   }, []);

//   const handleClose = React.useCallback(() => {
//     // ✅ Close should always cleanly resolve the pending promise
//     setModalOpen(false);
//     setOtp("");
//     setBackupCode("");
//     setUseBackup(false);
//     setPendingPrompt(null);

//     resolveRef.current?.(false);
//     resolveRef.current = null;
//   }, []);

//   const handleRetry = React.useCallback(async () => {
//     if (!pendingPrompt) return;
//     try {
//       const stepup = await issueStepUpCheck(pendingPrompt.resourceKey, pendingPrompt.action);

//       if (!stepup) {
//         resolveRef.current?.(true);
//         resolveRef.current = null;
//         setPendingPrompt(null);
//         setModalOpen(false);
//         markVerified();
//         return;
//       }

//       if (stepup.mode === "ENROLL_MANDATORY") {
//         enqueueSnackbar("2FA enrollment is mandatory before you can continue.", {
//           variant: "warning",
//         });
//         navigate("/system/security/2fa", { replace: true });
//         resolveRef.current?.(false);
//         resolveRef.current = null;
//         setPendingPrompt(null);
//         setModalOpen(false);
//         return;
//       }

//       if (stepup.mode === "OTP_REQUIRED") {
//         setModalOpen(true);
//         return;
//       }

//       resolveRef.current?.(true);
//       resolveRef.current = null;
//       setPendingPrompt(null);
//       setModalOpen(false);
//       markVerified();
//     } catch (error: any) {
//       enqueueSnackbar(error?.message || "Step-up check failed.", { variant: "error" });
//       resolveRef.current?.(false);
//       resolveRef.current = null;
//       setPendingPrompt(null);
//       setModalOpen(false);
//     }
//   }, [enqueueSnackbar, issueStepUpCheck, markVerified, navigate, pendingPrompt]);

//   const ensureStepUp = React.useCallback(
//     async (
//       resourceKey?: string | null,
//       action: string = "VIEW",
//       opts?: { source?: StepUpRequestSource },
//     ) => {
//       const normalized = canonicalizeResourceKey(resourceKey);
//       if (!normalized) return true;

//       const lockedSet = getStepupLockedSet();
//       const isLockedScreen = Boolean(normalized && lockedSet.has(normalized));

//       console.info("[STEPUP_UI]", {
//         resource_key: normalized,
//         locked: isLockedScreen,
//         source: opts?.source ?? "UNKNOWN",
//       });

//       if (!isLockedScreen) return true;

//       try {
//         const stepup = await issueStepUpCheck(normalized, action);
//         if (!stepup) return true;

//         if (stepup.mode === "ENROLL_MANDATORY") {
//           enqueueSnackbar("2FA enrollment is mandatory before you can continue.", {
//             variant: "warning",
//           });
//           navigate("/system/security/2fa", { replace: true });
//           return false;
//         }

//         if (stepup.mode === "OTP_REQUIRED") {
//           setPendingPrompt({ resourceKey: normalized, action });
//           setModalOpen(true);
//           return new Promise<boolean>((resolve) => {
//             resolveRef.current = resolve;
//           });
//         }

//         return true;
//       } catch (error: any) {
//         enqueueSnackbar(error?.message || "Step-up check failed.", { variant: "error" });
//         return false;
//       }
//     },
//     [enqueueSnackbar, issueStepUpCheck, navigate],
//   );

//   const handleVerify = React.useCallback(async () => {
//     if (!pendingPrompt) return;

//     const username = getCurrentAdminUsername();
//     if (!username) {
//       enqueueSnackbar("Unable to resolve current user for verification.", { variant: "error" });
//       return;
//     }

//     if (!useBackup && otp.length !== 6) {
//       enqueueSnackbar("Enter a 6-digit OTP.", { variant: "warning" });
//       return;
//     }

//     if (useBackup && !backupCode.trim()) {
//       enqueueSnackbar("Enter a backup code.", { variant: "warning" });
//       return;
//     }

//     setVerifying(true);
//     try {
//       const resp: any = await verifyStepUp({
//         username,
//         otp: useBackup ? undefined : otp,
//         backup_code: useBackup ? backupCode.trim() : undefined,
//         browser_session_id: getBrowserSessionId() || undefined,
//       });

//       const payload = resp?.stepup?.stepup || resp?.stepup;
//       const stepupSessionId = payload?.stepup_session_id;

//       if (stepupSessionId) {
//         storeStepupSessionId(stepupSessionId);

//         enqueueSnackbar("Step-up verified.", { variant: "success" });
//         setModalOpen(false);
//         setOtp("");
//         setBackupCode("");
//         setUseBackup(false);
//         markVerified();
//         setPendingPrompt(null);

//         resolveRef.current?.(true);
//         resolveRef.current = null;
//         return;
//       }

//       enqueueSnackbar(resp?.response?.description || "Step-up verification failed.", {
//         variant: "error",
//       });
//     } catch (error: any) {
//       enqueueSnackbar(error?.message || "Step-up verification failed.", { variant: "error" });
//     } finally {
//       setVerifying(false);
//     }
//   }, [backupCode, enqueueSnackbar, markVerified, otp, pendingPrompt, useBackup]);

//   const contextValue = React.useMemo(
//     () => ({
//       ensureStepUp,
//       isLocked,
//       markVerified,
//       ready: cacheReady,
//       ruleKey: STEP_UP_RULE_KEY,
//     }),
//     [ensureStepUp, isLocked, markVerified, cacheReady],
//   );

//   return (
//     <StepUpContext.Provider value={contextValue}>
//       {children}
//       <StepUpModal
//         open={modalOpen}
//         onClose={handleClose}
//         onRetry={handleRetry}
//         onVerify={handleVerify}
//         verifying={verifying}
//         otp={otp}
//         backupCode={backupCode}
//         useBackup={useBackup}
//         setUseBackup={setUseBackup}
//         setOtp={setOtp}
//         setBackupCode={setBackupCode}
//       />
//     </StepUpContext.Provider>
//   );
// };

// export const useStepUpContext = () => {
//   const ctx = React.useContext(StepUpContext);
//   if (!ctx) {
//     throw new Error("useStepUpContext must be used within StepUpProvider");
//   }
//   return ctx;
// };

// const StepUpModal: React.FC<{
//   open: boolean;
//   onClose: () => void;
//   onRetry: () => void;
//   onVerify: () => void;
//   verifying: boolean;
//   otp: string;
//   backupCode: string;
//   useBackup: boolean;
//   setUseBackup: (value: boolean) => void;
//   setOtp: (value: string) => void;
//   setBackupCode: (value: string) => void;
// }> = ({
//   open,
//   onClose,
//   onRetry,
//   onVerify,
//   verifying,
//   otp,
//   backupCode,
//   useBackup,
//   setUseBackup,
//   setOtp,
//   setBackupCode,
// }) => (
//   <Dialog
//     open={open}
//     fullWidth
//     maxWidth="xs"
//     // ✅ Prevent accidental close via backdrop click on mobile
//     onClose={(_, reason) => {
//       if (reason === "backdropClick") return;
//       onClose();
//     }}
//     PaperProps={{
//       sx: {
//         borderRadius: 3,
//         border: "1px solid",
//         borderColor: "divider",
//         boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
//         overflow: "hidden",
//       },
//     }}
//   >
//     <Box
//       sx={{
//         px: 2.25,
//         pt: 2.25,
//         pb: 1.5,
//         display: "flex",
//         gap: 1.5,
//         alignItems: "center",
//       }}
//     >
//       <Box
//         sx={{
//           width: 40,
//           height: 40,
//           borderRadius: 2,
//           display: "grid",
//           placeItems: "center",
//           bgcolor: "action.hover",
//           border: "1px solid",
//           borderColor: "divider",
//         }}
//       >
//         <SecurityIcon fontSize="small" />
//       </Box>

//       <Box sx={{ flex: 1, minWidth: 0 }}>
//         <Typography sx={{ fontWeight: 900, fontSize: 16, lineHeight: 1.2 }}>
//           Step-Up Verification
//         </Typography>
//         <Typography sx={{ mt: 0.25, color: "text.secondary", fontSize: 12.5 }}>
//           Additional authentication required for SUPER_ADMIN actions.
//         </Typography>
//       </Box>

//       <Chip
//         size="small"
//         icon={<KeyIcon />}
//         label="Secure"
//         variant="outlined"
//         sx={{ fontWeight: 700 }}
//       />

//       {/* ✅ Close button (top-right) */}
//       <IconButton
//         onClick={onClose}
//         size="small"
//         sx={{
//           ml: 0.5,
//           border: "1px solid",
//           borderColor: "divider",
//           borderRadius: 1.5,
//         }}
//         aria-label="Close"
//       >
//         <CloseIcon fontSize="small" />
//       </IconButton>
//     </Box>

//     <Divider />

//     <DialogContent sx={{ px: 2.25, py: 2 }}>
//       <Alert severity="info" sx={{ mb: 1.5, borderRadius: 2 }}>
//         Enter your authenticator code (or use a backup code).
//       </Alert>

//       <FormControlLabel
//         sx={{ mb: 0.5 }}
//         control={<Switch checked={useBackup} onChange={(e) => setUseBackup(e.target.checked)} />}
//         label={<Typography sx={{ fontSize: 13, fontWeight: 700 }}>Use backup code instead</Typography>}
//       />

//       <TextField
//         label={useBackup ? "Backup code" : "Authenticator code"}
//         value={useBackup ? backupCode : otp}
//         onChange={(event) =>
//           useBackup
//             ? setBackupCode(event.target.value)
//             : setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
//         }
//         fullWidth
//         margin="normal"
//         autoFocus
//         inputProps={
//           useBackup
//             ? { autoComplete: "off" }
//             : {
//                 inputMode: "numeric",
//                 autoComplete: "one-time-code",
//                 style: {
//                   textAlign: "center",
//                   letterSpacing: "0.45em",
//                   fontWeight: 800,
//                   fontSize: "18px",
//                 },
//               }
//         }
//         helperText={
//           useBackup ? "Enter one unused backup code." : "6-digit code from your authenticator app."
//         }
//       />

//       <Typography sx={{ mt: 1, color: "text.secondary", fontSize: 12.5 }}>
//         Tip: If you closed your browser and strict binding is enabled, you’ll be asked again.
//       </Typography>
//     </DialogContent>

//     <Divider />

//     <DialogActions sx={{ px: 2.25, py: 1.5, gap: 1 }}>
//       <Button variant="outlined" onClick={onRetry} disabled={verifying} sx={{ borderRadius: 2 }}>
//         Recheck
//       </Button>

//       <Button
//         variant="contained"
//         onClick={onVerify}
//         disabled={
//           verifying ||
//           (!useBackup && otp.length !== 6) ||
//           (useBackup && backupCode.trim().length === 0)
//         }
//         sx={{ borderRadius: 2, minWidth: 130 }}
//       >
//         {verifying ? <CircularProgress size={20} /> : "Verify"}
//       </Button>
//     </DialogActions>
//   </Dialog>
// );


// // working well, however cross button and mobile comptiable is missing dont delete it 04 jan 2026 dont delete it 
import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
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
import { getBrowserSessionId } from "./browserSession";
import SecurityIcon from "@mui/icons-material/Security";
import KeyIcon from "@mui/icons-material/VpnKey";
import { registerStepUpTrigger } from "./stepupService";

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
const STEPUP_SESSION_KEY = "cm_stepup_session_id";

const StepUpContext = React.createContext<StepUpContextValue | undefined>(undefined);

function getStoredStepupSessionId(): string | null {
  if (typeof window === "undefined") return null;

  // ✅ Correct storage: sessionStorage (clears on browser close)
  const s = sessionStorage.getItem(STEPUP_SESSION_KEY);
  if (s) return s;

  // Backward compatibility: migrate any legacy localStorage value once
  const legacy = localStorage.getItem(STEPUP_SESSION_KEY);
  if (legacy) {
    sessionStorage.setItem(STEPUP_SESSION_KEY, legacy);
    localStorage.removeItem(STEPUP_SESSION_KEY);
    return legacy;
  }
  return null;
}

function storeStepupSessionId(stepupSessionId: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(STEPUP_SESSION_KEY, stepupSessionId);
  // defensive cleanup (old builds)
  localStorage.removeItem(STEPUP_SESSION_KEY);
}

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
    getBrowserSessionId();
    ensureCacheLoaded();
  }, [ensureCacheLoaded]);

  React.useEffect(() => {
    registerStepUpTrigger(ensureStepUp);
    return () => registerStepUpTrigger(null);
  }, [ensureStepUp]);

  const issueStepUpCheck = React.useCallback(
    async (resourceKey: string, action: string) => {
      const storedUser = getStoredAdminUser();
      const username = storedUser?.username || getCurrentAdminUsername();
      if (!username) {
        throw new Error("Unable to resolve current user for step-up");
      }

      const browserSessionId = getBrowserSessionId();
      const sessionId = getStoredStepupSessionId();

      const resp: any = await requireStepUp({
        username,
        target_username: username,
        language: storedUser?.language,
        country: storedUser?.country,
        session_id: sessionId || undefined,
        browser_session_id: browserSessionId || undefined,
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

  React.useEffect(() => {
    const trigger = (resourceKey?: string | null, action?: string, opts?: { source?: string }) =>
      ensureStepUp(resourceKey, action, opts?.source as StepUpRequestSource);
    registerStepUpTrigger(trigger);
    return () => registerStepUpTrigger(null);
  }, [ensureStepUp]);

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
        browser_session_id: getBrowserSessionId() || undefined,
      });
      const payload = resp?.stepup?.stepup || resp?.stepup;
      const stepupSessionId = payload?.stepup_session_id;
      if (stepupSessionId) {
        storeStepupSessionId(stepupSessionId);

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
  <Dialog
    open={open}
    fullWidth
    maxWidth="xs"
    PaperProps={{
      sx: {
        borderRadius: 3,
        border: "1px solid",
        borderColor: "divider",
        boxShadow: "0 12px 40px rgba(0,0,0,0.18)",
        overflow: "hidden",
      },
    }}
  >
    <Box
      sx={{
        px: 2.25,
        pt: 2.25,
        pb: 1.5,
        display: "flex",
        gap: 1.5,
        alignItems: "center",
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 2,
          display: "grid",
          placeItems: "center",
          bgcolor: "action.hover",
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        <SecurityIcon fontSize="small" />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography sx={{ fontWeight: 900, fontSize: 16, lineHeight: 1.2 }}>
          Step-Up Verification
        </Typography>
        <Typography sx={{ mt: 0.25, color: "text.secondary", fontSize: 12.5 }}>
          Additional authentication required for SUPER_ADMIN actions.
        </Typography>
      </Box>
      <Chip
        size="small"
        icon={<KeyIcon />}
        label="Secure"
        variant="outlined"
        sx={{ fontWeight: 700 }}
      />
    </Box>

    <Divider />

    <DialogContent sx={{ px: 2.25, py: 2 }}>
      <Alert severity="info" sx={{ mb: 1.5, borderRadius: 2 }}>
        Enter your authenticator code (or use a backup code).
      </Alert>

      <FormControlLabel
        sx={{ mb: 0.5 }}
        control={
          <Switch
            checked={useBackup}
            onChange={(event) => setUseBackup(event.target.checked)}
          />
        }
        label={
          <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
            Use backup code instead
          </Typography>
        }
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
        autoFocus
        inputProps={
          useBackup
            ? { autoComplete: "off" }
            : {
                inputMode: "numeric",
                autoComplete: "one-time-code",
                style: {
                  textAlign: "center",
                  letterSpacing: "0.45em",
                  fontWeight: 800,
                  fontSize: "18px",
                },
              }
        }
        helperText={
          useBackup
            ? "Enter one unused backup code."
            : "6-digit code from your authenticator app."
        }
      />

      <Typography sx={{ mt: 1, color: "text.secondary", fontSize: 12.5 }}>
        Tip: If you closed your browser and strict binding is enabled, you’ll be asked again.
      </Typography>
    </DialogContent>

    <Divider />

    <DialogActions sx={{ px: 2.25, py: 1.5, gap: 1 }}>
      <Button
        variant="outlined"
        onClick={onRetry}
        disabled={verifying}
        sx={{ borderRadius: 2 }}
      >
        Recheck
      </Button>

      <Button
        variant="contained"
        onClick={onVerify}
        disabled={
          verifying ||
          (!useBackup && otp.length !== 6) ||
          (useBackup && backupCode.trim().length === 0)
        }
        sx={{ borderRadius: 2, minWidth: 130 }}
      >
        {verifying ? <CircularProgress size={20} /> : "Verify"}
      </Button>
    </DialogActions>
  </Dialog>
);
