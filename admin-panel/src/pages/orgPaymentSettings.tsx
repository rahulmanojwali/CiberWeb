import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../components/PageContainer";
import { ResponsiveDataGrid } from "../components/ResponsiveDataGrid";
import { getOrgPaymentSettings, updateOrgPaymentSettings } from "../services/paymentConfigApi";
import { getCurrentAdminUsername } from "../utils/session";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { can } from "../utils/adminUiConfig";

const defaultPayload = JSON.stringify(
  {
    org_id: "",
    country: "IN",
    fee_overrides: [
      {
        fee_code: "MARKET_FEE",
        mode: "DEFAULT",
        percent_value: 1.0,
        fixed_value: null,
      },
    ],
    subscription_override: {
      enabled: "N",
    },
    is_active: "Y",
  },
  null,
  2,
);

export const OrgPaymentSettings: React.FC = () => {
  const { i18n } = useTranslation();
  const language = i18n.language || "en";
  const uiConfig = useAdminUiConfig();
  const [orgId, setOrgId] = useState("");
  const [settings, setSettings] = useState<any>(null);
  const [payloadJson, setPayloadJson] = useState(defaultPayload);
  const [loading, setLoading] = useState(false);
  const canUpdate = useMemo(
    () => can(uiConfig.resources, "org_payment_settings.update", "UPDATE"),
    [uiConfig.resources],
  );

  const loadSettings = async () => {
    const username = getCurrentAdminUsername();
    if (!username || !orgId) return;
    setLoading(true);
    try {
      const resp = await getOrgPaymentSettings({
        username,
        language,
        payload: { org_id: orgId },
      });
      const data = resp?.data?.settings || null;
      setSettings(data);
      if (data) {
        setPayloadJson(JSON.stringify({ org_id: data.org_id, ...data }, null, 2));
      }
    } catch (error) {
      console.error("Failed to load org payment settings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orgId) loadSettings();
  }, [language, orgId]);

  const handleSave = async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    try {
      const payload = JSON.parse(payloadJson);
      await updateOrgPaymentSettings({ username, language, payload });
      loadSettings();
    } catch (error) {
      console.error("Failed to update org payment settings:", error);
      alert("Invalid payload.");
    }
  };

  const feeRows = (settings?.fee_overrides || []).map((fee: any, index: number) => ({
    id: `${fee.fee_code}-${index}`,
    fee_code: fee.fee_code,
    mode: fee.mode,
    percent_value: fee.percent_value,
    fixed_value: fee.fixed_value,
  }));

  const columns = useMemo<GridColDef<any>[]>(
    () => [
      { field: "fee_code", headerName: "Fee Code", width: 180 },
      { field: "mode", headerName: "Mode", width: 120 },
      { field: "percent_value", headerName: "Percent", width: 120 },
      { field: "fixed_value", headerName: "Fixed", width: 120 },
    ],
    [],
  );

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        <Stack spacing={1}>
          <Typography variant="h5">Org Payment Settings</Typography>
          <Stack direction="row" spacing={1}>
            <TextField
              label="Org ID"
              size="small"
              value={orgId}
              onChange={(e) => setOrgId(e.target.value)}
            />
            <Button variant="contained" onClick={loadSettings} disabled={!orgId}>
              Load
            </Button>
          </Stack>
        </Stack>
        <Stack spacing={1} flex={1}>
          <Typography variant="subtitle1">Editable payload</Typography>
          <TextField
            multiline
            minRows={10}
            value={payloadJson}
            onChange={(event) => setPayloadJson(event.target.value)}
            fullWidth
          />
          <Button variant="contained" disabled={!canUpdate} onClick={handleSave}>
            Save
          </Button>
        </Stack>
      </Stack>
      <Box sx={{ mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Fee overrides
        </Typography>
        <ResponsiveDataGrid
          columns={columns}
          rows={feeRows}
          loading={loading}
        />
      </Box>
    </PageContainer>
  );
};
