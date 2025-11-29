import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Card, CardContent, CircularProgress, Grid, Stack, Switch, TextField, Typography } from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../components/PageContainer";
import { ResponsiveDataGrid } from "../components/ResponsiveDataGrid";
import {
  getMandiPaymentSettings,
  updateMandiPaymentSettings,
} from "../services/paymentConfigApi";
import { getCurrentAdminUsername } from "../utils/session";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { can } from "../utils/adminUiConfig";

const defaultPayload = JSON.stringify(
  {
    org_id: "",
    mandi_id: null,
    fee_overrides: [
      {
        fee_code: "MARKET_FEE",
        mode: "DEFAULT",
      },
    ],
    custom_fees: [
      {
        custom_fee_code: "CUSTOM01",
        is_active: "Y",
      },
    ],
    subscription_active: "N",
    is_active: "Y",
  },
  null,
  2,
);

export const MandiPaymentSettings: React.FC = () => {
  const { i18n } = useTranslation();
  const language = i18n.language || "en";
  const uiConfig = useAdminUiConfig();
  const [orgId, setOrgId] = useState("");
  const [mandiId, setMandiId] = useState("");
  const [settings, setSettings] = useState<any>(null);
  const [payloadJson, setPayloadJson] = useState(defaultPayload);
  const [loading, setLoading] = useState(false);
  const canUpdate = useMemo(
    () => can(uiConfig.resources, "mandi_payment_settings.update", "UPDATE"),
    [uiConfig.resources],
  );

  const loadSettings = async () => {
    const username = getCurrentAdminUsername();
    if (!username || !orgId || !mandiId) return;
    setLoading(true);
    try {
      const resp = await getMandiPaymentSettings({
        username,
        language,
        payload: { org_id: orgId, mandi_id: Number(mandiId) },
      });
      const data = resp?.data?.settings || null;
      setSettings(data);
      if (data) {
        setPayloadJson(JSON.stringify({ org_id: data.org_id, mandi_id: data.mandi_id, ...data }, null, 2));
      }
    } catch (error) {
      console.error("Failed to load mandi payment settings:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (orgId && mandiId) loadSettings();
  }, [language, orgId, mandiId]);

  const handleSave = async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    try {
      const payload = JSON.parse(payloadJson);
      await updateMandiPaymentSettings({ username, language, payload });
      loadSettings();
    } catch (error) {
      console.error("Failed to update mandi payment settings:", error);
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

  const customFeeRows = (settings?.custom_fees || []).map((fee: any, index: number) => ({
    id: `${fee.custom_fee_code}-${index}`,
    custom_fee_code: fee.custom_fee_code,
    label: fee.label,
    is_active: fee.is_active,
  }));

  return (
    <PageContainer>
      <Stack
        direction={{ xs: "column", md: "row" }}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h5">Mandi Payment Settings</Typography>
          <Typography variant="body2" color="text.secondary">
            Configure mandi-specific overrides and custom fees.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={loadSettings} disabled={!orgId || !mandiId}>
            Load
          </Button>
          <Button variant="contained" disabled={!canUpdate} onClick={handleSave}>
            Save
          </Button>
        </Stack>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Org ID"
                size="small"
                value={orgId}
                onChange={(e) => setOrgId(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <TextField
                label="Mandi ID"
                size="small"
                value={mandiId}
                onChange={(e) => setMandiId(e.target.value)}
                fullWidth
              />
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : (
            <Stack spacing={3}>
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Fee overrides
                </Typography>
                <Box sx={{ width: "100%", overflowX: "auto" }}>
                  <ResponsiveDataGrid
                    columns={columns}
                    rows={feeRows}
                    loading={loading}
                  />
                </Box>
              </Box>
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Custom fees
                </Typography>
                <Box sx={{ width: "100%", overflowX: "auto" }}>
                  <ResponsiveDataGrid
                    columns={[
                      { field: "custom_fee_code", headerName: "Code", width: 140 },
                      { field: "label", headerName: "Label", width: 200 },
                      { field: "is_active", headerName: "Active", width: 120 },
                    ]}
                    rows={customFeeRows}
                    loading={loading}
                  />
                </Box>
              </Box>
            </Stack>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="subtitle1">Editable payload</Typography>
            <TextField
              multiline
              minRows={8}
              value={payloadJson}
              onChange={(event) => setPayloadJson(event.target.value)}
              fullWidth
            />
          </Stack>
        </CardContent>
      </Card>
    </PageContainer>
  );
};
