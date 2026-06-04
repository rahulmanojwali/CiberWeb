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
//           Additional authentication required for the current role actions.
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
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
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
import CloseIcon from "@mui/icons-material/Close";
import { registerStepUpTrigger } from "./stepupService";
import { getUserRoleFromStorage } from "../../utils/roles";

type StepUpRequestSource = "MENU" | "ROUTE" | "GUARD" | "OTHER";
const STEPUP_SOURCE_VALUES: readonly StepUpRequestSource[] = ["MENU", "ROUTE", "GUARD", "OTHER"];

function normalizeStepupSource(value?: string | StepUpRequestSource): StepUpRequestSource | undefined {
  if (!value) return undefined;
  const normalized = String(value).trim().toUpperCase() as StepUpRequestSource;
  return STEPUP_SOURCE_VALUES.includes(normalized) ? normalized : undefined;
}

type StepUpPrompt = {
  resourceKey: string;
  action: string;
};

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ORG_ADMIN: "Organisation Admin",
  MANDI_ADMIN: "Mandi Admin",
  GATE_OPERATOR: "Gate Operator",
  YARD_SUPERVISOR: "Yard Supervisor",
  LOADING_SUPERVISOR: "Loading Supervisor",
  TRADER: "Trader",
  FARMER: "Farmer",
};

const RESOURCE_LABEL_OVERRIDES: Record<string, string> = {
  payment_gateway_settings: "payment gateway settings",
  payment_gateway_configs: "payment gateway settings",
  payment_gateway_config: "payment gateway settings",
  payment_gateways: "payment gateway settings",
  role_policies: "role policies",
  role_policy: "role policies",
  cm_role_policies: "role policies",
  admin_role_policies: "role policies",
  stepup_policy: "step-up policies",
  stepup_policies: "step-up policies",
};

function toFriendlyRoleLabel(role?: string | null): string {
  const normalized = String(role || "").trim().toUpperCase();
  if (!normalized) return "your role";
  return ROLE_LABELS[normalized] || normalized
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function readRawRoleFromSession(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("cd_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const direct =
      parsed?.default_role_code ??
      parsed?.default_role ??
      parsed?.role_slug ??
      parsed?.role ??
      parsed?.role_code ??
      parsed?.usertype ??
      null;
    if (typeof direct === "string" && direct.trim()) return direct.trim().toUpperCase();
    const rolesEnabled = parsed?.roles_enabled;
    if (rolesEnabled && typeof rolesEnabled === "object") {
      const firstEnabledKey = Object.keys(rolesEnabled).find((key) => rolesEnabled[key]);
      if (firstEnabledKey) return firstEnabledKey.trim().toUpperCase();
    }
  } catch {
    return null;
  }
  return null;
}

function prettifyResourceKey(resourceKey?: string | null): string {
  const raw = String(resourceKey || "").trim();
  if (!raw) return "";
  const parts = raw
    .split(/[.:/]/)
    .map((part) => part.trim())
    .filter(Boolean);
  const withoutAction = parts.filter((part) => !/^(view|menu|list|create|add|edit|update|delete|deactivate|manage|verify)$/i.test(part));
  const candidate = withoutAction.length ? withoutAction[withoutAction.length - 1] : parts[parts.length - 1] || raw;
  const normalized = candidate.replace(/[-\s]+/g, "_").toLowerCase();
  const overrideKey = Object.keys(RESOURCE_LABEL_OVERRIDES).find((key) => normalized.includes(key));
  if (overrideKey) return RESOURCE_LABEL_OVERRIDES[overrideKey];
  return normalized
    .replace(/_/g, " ")
    .replace(/\bcm\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function actionVerb(action?: string | null): string {
  const normalized = String(action || "").trim().toUpperCase();
  if (["CREATE", "ADD"].includes(normalized)) return "create";
  if (["EDIT", "UPDATE", "SAVE"].includes(normalized)) return "update";
  if (["DELETE", "DEACTIVATE", "REMOVE"].includes(normalized)) return "delete";
  if (["VERIFY", "APPROVE"].includes(normalized)) return "verify";
  if (["MANAGE", "POLICY", "CONFIGURE"].includes(normalized)) return "manage";
  if (normalized === "VIEW") return "view";
  return normalized ? normalized.toLowerCase().replace(/_/g, " ") : "continue with";
}

function buildStepUpMessage(prompt: StepUpPrompt | null, roleLabel: string): string {
  const resourceLabel = prettifyResourceKey(prompt?.resourceKey);
  if (resourceLabel) {
    const verb = resourceLabel.includes("role policies") ? "manage" : actionVerb(prompt?.action);
    if (verb === "view") {
      return `Additional authentication required to continue with ${resourceLabel}.`;
    }
    return `Additional authentication required to ${verb} ${resourceLabel}.`;
  }
  return `Additional authentication required for ${roleLabel} actions.`;
}

type StepUpContextValue = {
  ensureStepUp: (
    resourceKey?: string | null,
    action?: string,
    opts?: { source?: StepUpRequestSource; force?: boolean },
  ) => Promise<boolean>;
  isLocked: (resourceKey?: string | null) => boolean;
  markVerified: () => void;
  ready: boolean;
  ruleKey: string;
};

const STEP_UP_RULE_KEY = "ADMIN_SCREEN_STEPUP_V1";
const STEPUP_SESSION_KEY = "cm_stepup_session_id";
const OTP_LENGTH = 6;

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
  const [verifying, setVerifying] = React.useState(false);
  const resolveRef = React.useRef<((result: boolean) => void) | null>(null);
  const loadPromiseRef = React.useRef<Promise<void> | null>(null);

  React.useEffect(() => {
    if (!modalOpen) return;
    console.log(
      "[STEPUP_MODAL]",
      `open=true reason=${pendingPrompt ? "OTP_REQUIRED" : "unknown"}`,
      `resource=${pendingPrompt?.resourceKey || "unknown"}`,
      `action=${pendingPrompt?.action || "unknown"}`
    );
  }, [modalOpen, pendingPrompt]);

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

  const issueStepUpCheck = React.useCallback(
    async (resourceKey: string, action: string) => {
      const storedUser = getStoredAdminUser();
      const username = storedUser?.username || getCurrentAdminUsername();
      if (!username) {
        console.warn("[STEPUP_REQUIRE] missing username", { resourceKey, action });
        throw new Error("Unable to resolve current user for step-up");
      }

      console.log("[STEPUP_REQUIRE] calling requireStepUp", { resourceKey, action, username });
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

  const ensureStepUp = React.useCallback(
    async (
      resourceKey?: string | null,
      action: string = "VIEW",
      opts?: { source?: StepUpRequestSource; force?: boolean },
    ) => {
      const normalized = canonicalizeResourceKey(resourceKey);
      if (!normalized) return true;
      const lockedSet = getStepupLockedSet();
      const isLockedScreen = Boolean(normalized && lockedSet.has(normalized));
      const shouldForce = Boolean(opts?.force);
      console.info(
        "[STEPUP_UI]",
        {
          resource_key: normalized,
          locked: isLockedScreen,
          force: shouldForce,
          source: opts?.source ?? "UNKNOWN"
        },
      );
      if (!isLockedScreen && !shouldForce) return true;

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
    if (otp.length !== OTP_LENGTH) {
      enqueueSnackbar("Enter a 6-digit OTP.", { variant: "warning" });
      return;
    }
    setVerifying(true);
    try {
      const resp: any = await verifyStepUp({
        username,
        otp,
        browser_session_id: getBrowserSessionId() || undefined,
      });
      const payload = resp?.stepup?.stepup || resp?.stepup;
      const stepupSessionId = payload?.stepup_session_id;
      if (stepupSessionId) {
        storeStepupSessionId(stepupSessionId);

        enqueueSnackbar("Step-up verified.", { variant: "success" });
        setModalOpen(false);
        setOtp("");
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
  }, [enqueueSnackbar, markVerified, otp, pendingPrompt]);

  const handleCloseModal = React.useCallback(() => {
    if (verifying) return;
    setModalOpen(false);
    setOtp("");
    setPendingPrompt(null);
    resolveRef.current?.(false);
    resolveRef.current = null;
  }, [verifying]);

  React.useEffect(() => {
    const trigger = (resourceKey?: string | null, action?: string, opts?: { source?: string }) => {
      const source = normalizeStepupSource(opts?.source);
      return ensureStepUp(resourceKey, action, source ? { source } : undefined);
    };
    registerStepUpTrigger(trigger);
    return () => registerStepUpTrigger(null);
  }, [ensureStepUp]);

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
        onClose={handleCloseModal}
        onVerify={handleVerify}
        prompt={pendingPrompt}
        verifying={verifying}
        otp={otp}
        setOtp={setOtp}
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
  onClose: () => void;
  onVerify: () => void;
  prompt: StepUpPrompt | null;
  verifying: boolean;
  otp: string;
  setOtp: (value: string) => void;
}> = ({
  open,
  onClose,
  onVerify,
  prompt,
  verifying,
  otp,
  setOtp,
}) => {
  const currentRole = getUserRoleFromStorage("stepup-modal") || readRawRoleFromSession();
  const roleLabel = toFriendlyRoleLabel(currentRole);
  const message = buildStepUpMessage(prompt, roleLabel);
  const normalizedRole = String(currentRole || "").trim().toUpperCase();
  const usesSmsOtp = ["ORG_ADMIN", "MANDI_ADMIN"].includes(normalizedRole);
  const inputRefs = React.useRef<Array<HTMLInputElement | null>>([]);
  const otpDigits = React.useMemo(
    () => Array.from({ length: OTP_LENGTH }, (_, index) => otp[index] || ""),
    [otp],
  );

  React.useEffect(() => {
    if (!open) return;
    window.setTimeout(() => inputRefs.current[0]?.focus(), 60);
  }, [open]);

  const setOtpValue = React.useCallback(
    (value: string, focusIndex?: number) => {
      const cleaned = value.replace(/\D/g, "").slice(0, OTP_LENGTH);
      setOtp(cleaned);
      if (typeof focusIndex === "number") {
        window.setTimeout(() => {
          inputRefs.current[Math.min(focusIndex, OTP_LENGTH - 1)]?.focus();
        }, 0);
      }
    },
    [setOtp],
  );

  const handleDigitChange = React.useCallback(
    (index: number, value: string) => {
      const digits = value.replace(/\D/g, "");
      if (!digits) {
        const next = otpDigits.slice();
        next[index] = "";
        setOtpValue(next.join(""));
        return;
      }
      const next = otpDigits.slice();
      digits
        .slice(0, OTP_LENGTH - index)
        .split("")
        .forEach((digit, offset) => {
          next[index + offset] = digit;
        });
      setOtpValue(next.join(""), index + digits.length);
    },
    [otpDigits, setOtpValue],
  );

  const handleDigitKeyDown = React.useCallback(
    (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Backspace" && !otpDigits[index] && index > 0) {
        event.preventDefault();
        const next = otpDigits.slice();
        next[index - 1] = "";
        setOtpValue(next.join(""), index - 1);
      }
      if (event.key === "ArrowLeft" && index > 0) {
        event.preventDefault();
        inputRefs.current[index - 1]?.focus();
      }
      if (event.key === "ArrowRight" && index < OTP_LENGTH - 1) {
        event.preventDefault();
        inputRefs.current[index + 1]?.focus();
      }
      if (event.key === "Enter" && otp.length === OTP_LENGTH && !verifying) {
        onVerify();
      }
    },
    [onVerify, otp.length, otpDigits, setOtpValue, verifying],
  );

  const handlePaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLInputElement>) => {
      event.preventDefault();
      setOtpValue(event.clipboardData.getData("text"), OTP_LENGTH - 1);
    },
    [setOtpValue],
  );

  return (
    <Dialog
      className="cm-modal"
      open={open}
      onClose={(_, reason) => {
        if (verifying && reason === "backdropClick") return;
        if (verifying && reason === "escapeKeyDown") return;
        onClose();
      }}
      fullWidth
      maxWidth="xs"
      PaperProps={{
        sx: {
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          boxShadow: "0 10px 32px rgba(0,0,0,0.16)",
          overflow: "hidden",
        },
      }}
    >
      <DialogTitle
        sx={{
          px: 2,
          pt: 1.75,
          pb: 1.25,
          display: "flex",
          gap: 1.25,
          alignItems: "center",
        }}
      >
        <Box
          className="cm-stepup-icon-wrap"
          sx={{
            width: 38,
            height: 38,
            flex: "0 0 auto",
          }}
        >
          <SecurityIcon fontSize="small" />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography className="cm-stepup-title" sx={{ lineHeight: 1.2, fontSize: 17 }}>
            Verification required
          </Typography>
          <Typography className="cm-stepup-subtitle" sx={{ mt: 0.35 }}>
            {message}
          </Typography>
        </Box>
        <Chip
          size="small"
          label={roleLabel}
          variant="outlined"
          sx={{
            fontWeight: 700,
            maxWidth: 132,
            height: 26,
            "& .MuiChip-label": {
              overflow: "hidden",
              textOverflow: "ellipsis",
            },
          }}
        />
        <IconButton
          aria-label="Close verification dialog"
          onClick={onClose}
          disabled={verifying}
          sx={{ ml: 0.5 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ px: 2, py: 1.75 }}>
        <Typography sx={{ fontSize: 13.5, fontWeight: 800, color: "text.primary" }}>
          Enter OTP
        </Typography>
        <Typography sx={{ mt: 0.35, mb: 1.4, fontSize: 12.5, color: "text.secondary" }}>
          {usesSmsOtp
            ? "Use the 6-digit SMS OTP sent to your registered mobile number."
            : "Use the 6-digit code from your authenticator app."}
        </Typography>

        <Box sx={{ display: "flex", gap: 0.75, justifyContent: "space-between" }}>
          {otpDigits.map((digit, index) => (
            <Box
              key={index}
              component="input"
              ref={(node: HTMLInputElement | null) => {
                inputRefs.current[index] = node;
              }}
              value={digit}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                handleDigitChange(index, event.target.value)
              }
              onKeyDown={(event: React.KeyboardEvent<HTMLInputElement>) =>
                handleDigitKeyDown(index, event)
              }
              onPaste={handlePaste}
              inputMode="numeric"
              autoComplete={index === 0 ? "one-time-code" : "off"}
              aria-label={`OTP digit ${index + 1}`}
              disabled={verifying}
              sx={{
                width: 42,
                height: 46,
                borderRadius: 1.25,
                border: "1px solid",
                borderColor: digit ? "primary.main" : "divider",
                bgcolor: "background.paper",
                color: "text.primary",
                fontSize: 20,
                fontWeight: 800,
                textAlign: "center",
                outline: "none",
                transition: "border-color 120ms ease, box-shadow 120ms ease",
                "&:focus": {
                  borderColor: "primary.main",
                  boxShadow: "0 0 0 3px rgba(25, 118, 210, 0.14)",
                },
                "&:disabled": {
                  opacity: 0.65,
                },
              }}
            />
          ))}
        </Box>

        <Typography sx={{ mt: 1.1, color: "text.secondary", fontSize: 12 }}>
          {usesSmsOtp
            ? "OTP expires shortly. Request a new SMS OTP from the previous screen if needed."
            : "Codes refresh every 30 seconds. Use the latest code before it expires."}
        </Typography>
      </DialogContent>

      <Divider />

      <DialogActions sx={{ px: 2, py: 1.25, gap: 1 }}>
        <Button
          variant="outlined"
          onClick={onClose}
          disabled={verifying}
          sx={{ borderRadius: 2 }}
        >
          Cancel
        </Button>

        <Button
          variant="contained"
          onClick={onVerify}
          disabled={verifying || otp.length !== OTP_LENGTH}
          sx={{ borderRadius: 2, minWidth: 130 }}
        >
          {verifying ? <CircularProgress size={20} /> : "Verify"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
