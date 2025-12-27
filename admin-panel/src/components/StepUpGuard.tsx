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
  Typography,
} from "@mui/material";
import { useSnackbar } from "../notistack-compat";

import { requireStepUp } from "../services/adminUsersApi";

type StepUpResponse = {
  required?: boolean;
  mode?: "ENROLL_MANDATORY" | "OTP_REQUIRED";
};

type StepUpGuardProps = {
  username: string | null;
  children: React.ReactNode;
};

const StepUpModal: React.FC<{ open: boolean; onRetry: () => void }> = ({
  open,
  onRetry,
}) => (
  <Dialog open={open} fullWidth maxWidth="xs">
    <DialogTitle>2FA Step-Up Required</DialogTitle>
    <DialogContent dividers>
      <Typography>
        Your SUPER_ADMIN role requires secondary authentication before continuing.
        Please complete the OTP verification via your 2FA portal.
      </Typography>
    </DialogContent>
    <DialogActions>
      <Button variant="contained" onClick={onRetry}>
        Recheck Step-Up Status
      </Button>
    </DialogActions>
  </Dialog>
);

export const StepUpGuard: React.FC<StepUpGuardProps> = ({ username, children }) => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const [loading, setLoading] = React.useState(true);
  const [stepupRequired, setStepupRequired] = React.useState<StepUpResponse | null>(
    null
  );
  const [modalOpen, setModalOpen] = React.useState(false);

  const checkStepUp = React.useCallback(async () => {
    if (!username) {
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
      });
      const stepup: StepUpResponse = resp?.stepup || {};
      if (stepup.mode === "ENROLL_MANDATORY") {
        enqueueSnackbar(
          "2FA is mandatory for your role. Please enable it to continue.",
          { variant: "warning" }
        );
        navigate("/admin/system/security/2fa", { replace: true });
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
  }, [username, enqueueSnackbar, navigate]);

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
    return <StepUpModal open={modalOpen} onRetry={() => checkStepUp()} />;
  }

  return <>{children}</>;
};
