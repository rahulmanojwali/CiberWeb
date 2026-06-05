import React, { useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from "@mui/material";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import { useSnackbar } from "@refinedev/mui";

import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { repairSuperAdminPermissions } from "../../services/permissionRepairApi";
import { getStoredAdminUser } from "../../utils/session";
import { getUserRoleFromStorage } from "../../utils/roles";

function isSuperAdmin(role?: string | null) {
  const normalized = String(role || "").trim().toUpperCase().replace(/\s+/g, "_");
  return normalized === "SUPER_ADMIN" || normalized === "SUPERADMIN";
}

const SystemSecurityPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const adminUiConfig = useAdminUiConfig();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const storedUser = useMemo(() => getStoredAdminUser(), []);
  const storageRole = getUserRoleFromStorage("SystemSecurity");
  const currentRole = adminUiConfig.role || storageRole;
  const canRepair = isSuperAdmin(currentRole);

  const handleRepair = async () => {
    if (!storedUser?.username || !canRepair) return;
    setSaving(true);
    try {
      const response: any = await repairSuperAdminPermissions({
        username: storedUser.username,
        role: currentRole,
        country: storedUser.country,
        language: storedUser.language,
      });
      const resp = response?.response || response || {};
      if (String(resp?.responsecode ?? "") !== "0") {
        throw new Error(resp?.description || "Unable to repair permissions.");
      }
      enqueueSnackbar(resp?.description || "Permissions repaired successfully.", { variant: "success" });
      await adminUiConfig.refresh?.({ invalidate: true });
      setConfirmOpen(false);
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Unable to repair permissions.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (!storedUser?.username) {
    return <Typography>Please log in.</Typography>;
  }

  return (
    <div className="cm-page">
      <div className="cm-page-header">
        <h1 className="cm-page-title">System Security</h1>
        <div className="cm-page-subtitle">Security controls and permission repair tools.</div>
      </div>

      <Box sx={{ maxWidth: 920 }}>
        <Card className="cm-card">
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" gap={2}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <SecurityOutlinedIcon color="primary" />
                  <Box>
                    <Typography variant="h6">RBAC Permission Repair</Typography>
                    <Typography variant="body2" color="text.secondary">
                      Restore Super Admin access to System menus and core permission screens.
                    </Typography>
                  </Box>
                </Stack>
                <Chip label={currentRole || "Unknown role"} size="small" />
              </Stack>

              {!canRepair && (
                <Alert severity="info">
                  Fix Permissions is available only for Super Admin users.
                </Alert>
              )}

              <Box>
                <Button
                  variant="contained"
                  startIcon={<BuildOutlinedIcon />}
                  disabled={!canRepair || saving}
                  onClick={() => setConfirmOpen(true)}
                >
                  Fix Permissions
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Box>

      <Dialog open={confirmOpen} onClose={() => (!saving ? setConfirmOpen(false) : undefined)} maxWidth="sm" fullWidth>
        <DialogTitle>Fix Super Admin Permissions?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will repair System Security, role policy, resource registry, mobile dashboard,
            and capacity control permissions for the Super Admin role.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmOpen(false)} disabled={saving}>
            Cancel
          </Button>
          <Button variant="contained" onClick={handleRepair} disabled={saving}>
            {saving ? "Fixing..." : "Fix Permissions"}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
};

export default SystemSecurityPage;
