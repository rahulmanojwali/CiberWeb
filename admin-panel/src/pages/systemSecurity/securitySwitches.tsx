import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Card, CardContent, Chip, Stack, Switch, Typography } from "@mui/material";
import { useSnackbar } from "@refinedev/mui";
import { securityUi } from "./securityUi";
import { getSecuritySwitches, updateSecuritySwitches } from "../../services/security/securitySwitchService";
import { getStoredAdminUser } from "../../utils/session";
import { usePermissions } from "../../authz/usePermissions";

const SecuritySwitchesPage: React.FC = () => {
  const [bindingState, setBindingState] = useState<"Y" | "N">("N");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { enqueueSnackbar } = useSnackbar();
  const { can } = usePermissions();
  const canUpdateSwitch = can("security_switches.update", "UPDATE");

  const username = useMemo(() => {
    const stored = getStoredAdminUser();
    return stored?.username || "";
  }, []);

  const fetchSwitch = React.useCallback(async () => {
    if (!username) return;
    setLoading(true);
    try {
      const resp: any = await getSecuritySwitches({ username });
      const value =
        resp?.switches?.STEPUP_BROWSER_SESSION_BINDING ||
        resp?.data?.switches?.STEPUP_BROWSER_SESSION_BINDING ||
        resp?.response?.switches?.STEPUP_BROWSER_SESSION_BINDING ||
        "N";
      setBindingState(value === "Y" ? "Y" : "N");
    } catch (err) {
      console.error("[SecuritySwitches] fetch error:", err);
      enqueueSnackbar("Unable to load security switches.", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar, username]);

  useEffect(() => {
    fetchSwitch();
  }, [fetchSwitch]);

  const handleToggle = async () => {
    if (!username) return;
    if (!canUpdateSwitch) {
      enqueueSnackbar("You do not have permission to update security switches.", { variant: "warning" });
      return;
    }
    setSaving(true);
    const target = bindingState === "Y" ? "N" : "Y";
    try {
      const resp: any = await updateSecuritySwitches({
        username,
        switches: { STEPUP_BROWSER_SESSION_BINDING: target },
      });
      const updated =
        resp?.switches?.STEPUP_BROWSER_SESSION_BINDING ||
        resp?.data?.switches?.STEPUP_BROWSER_SESSION_BINDING ||
        resp?.response?.switches?.STEPUP_BROWSER_SESSION_BINDING ||
        target;
      setBindingState(updated === "Y" ? "Y" : "N");
      enqueueSnackbar("Security switch updated.", { variant: "success" });
      await fetchSwitch();
    } catch (err: any) {
      console.error("[SecuritySwitches] update error:", err);
      enqueueSnackbar(err?.message || "Unable to update switch.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={securityUi.container}>
      <Box sx={securityUi.content}>
        <Box sx={securityUi.headerRow}>
          <Box>
            <Typography sx={securityUi.title}>Security Switches</Typography>
            <Typography sx={securityUi.subtitle}>
              Global flags that change security enforcement behavior.
            </Typography>
          </Box>
          <Chip label="Admin only" size="small" color="secondary" />
        </Box>

        <Card sx={securityUi.card}>
          <CardContent sx={securityUi.cardContent}>
            <Box sx={securityUi.cardHeader}>
              <Typography variant="subtitle1">Bind Step-Up to Browser Session</Typography>
              <Typography sx={securityUi.helper}>
                When enabled, closing the browser requires a fresh OTP before accessing locked screens.
              </Typography>
            </Box>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography sx={securityUi.value}>
                {bindingState === "Y" ? "Enabled" : "Disabled"}
              </Typography>
              <Stack spacing={0.5} alignItems="flex-end">
                <Switch
                  checked={bindingState === "Y"}
                  onChange={handleToggle}
                  disabled={loading || saving || !canUpdateSwitch}
                  color="primary"
                />
                {!canUpdateSwitch && (
                  <Typography variant="caption" sx={securityUi.helper}>
                    Update permission required
                  </Typography>
                )}
              </Stack>
            </Stack>
            <Typography sx={securityUi.helper}>
              Applies immediately across all admin instances (may take a few seconds depending on load).
            </Typography>
            <Button variant="text" onClick={fetchSwitch} disabled={loading}>
              {loading ? "Refreshing…" : "Refresh status"}
            </Button>
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
};

export default SecuritySwitchesPage;
