import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Card, CardContent, CircularProgress, Grid, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../components/PageContainer";
import { ResponsiveDataGrid } from "../components/ResponsiveDataGrid";
import { getPaymentModeRules, upsertPaymentModeRules } from "../services/paymentConfigApi";
import { getCurrentAdminUsername } from "../utils/session";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { can } from "../utils/adminUiConfig";

const defaultPayload = JSON.stringify(
  {
    org_scope: "GLOBAL",
    org_id: null,
    mode_code: "UPI",
    rules: [
      {
        rule_type: "MDR",
        mode: "PERCENT",
        percent_value: 0.5,
      },
    ],
    is_allowed: "Y",
    is_active: "Y",
  },
  null,
  2,
);

export const PaymentModes: React.FC = () => {
  const { i18n } = useTranslation();
  const language = i18n.language || "en";
  const uiConfig = useAdminUiConfig();
  const [filters, setFilters] = useState({ org_scope: "GLOBAL", org_id: "" });
  const [rows, setRows] = useState<any[]>([]);
  const [payloadJson, setPayloadJson] = useState(defaultPayload);
  const [loading, setLoading] = useState(false);
  const canUpdate = useMemo(
    () => can(uiConfig.resources, "payment_mode_rules.update", "UPDATE"),
    [uiConfig.resources],
  );

  const loadData = async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    setLoading(true);
    try {
      const payload: Record<string, any> = {
        org_scope: filters.org_scope,
      };
      if (filters.org_scope === "ORG" && filters.org_id) {
        payload.org_id = filters.org_id;
      }
      const resp = await getPaymentModeRules({
        username,
        language,
        payload,
      });
      setRows(resp?.data?.list || []);
    } catch (error) {
      console.error("Failed to load payment mode rules:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [language]);

  const handleSave = async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    try {
      const payload = JSON.parse(payloadJson);
      await upsertPaymentModeRules({ username, language, payload });
      loadData();
    } catch (error) {
      console.error("Failed to upsert payment mode rule:", error);
      alert("Invalid payload.");
    }
  };

  const columns = useMemo<GridColDef<any>[]>(
    () => [
      { field: "mode_code", headerName: "Mode Code", width: 160 },
      { field: "org_scope", headerName: "Scope", width: 120 },
      { field: "is_allowed", headerName: "Allowed", width: 120 },
      { field: "is_active", headerName: "Active", width: 120 },
      { field: "rules", headerName: "Rules", flex: 1 },
    ],
    [],
  );

  const gridRows = rows.map((doc) => ({
    id: doc._id || `${doc.org_scope}-${doc.mode_code}`,
    mode_code: doc.mode_code,
    org_scope: doc.org_scope,
    is_allowed: doc.is_allowed,
    is_active: doc.is_active,
    rules: JSON.stringify(doc.rules || []),
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
          <Typography variant="h5">Payment Modes</Typography>
          <Typography variant="body2" color="text.secondary">
            Control payment mode rules per scope.
          </Typography>
        </Stack>
        <Button variant="contained" onClick={loadData}>
          Refresh
        </Button>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <TextField
                label="Scope"
                select
                size="small"
                value={filters.org_scope}
                onChange={(e) => setFilters((prev) => ({ ...prev, org_scope: e.target.value }))}
                fullWidth
              >
                <MenuItem value="GLOBAL">GLOBAL</MenuItem>
                <MenuItem value="ORG">ORG</MenuItem>
              </TextField>
            </Grid>
            {filters.org_scope === "ORG" && (
              <Grid item xs={12} md={6}>
                <TextField
                  label="Org ID"
                  size="small"
                  value={filters.org_id}
                  onChange={(e) => setFilters((prev) => ({ ...prev, org_id: e.target.value }))}
                  fullWidth
                />
              </Grid>
            )}
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
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <ResponsiveDataGrid
                columns={columns}
                rows={gridRows}
                loading={loading}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Stack spacing={1}>
            <Typography variant="subtitle1">Upsert payload</Typography>
            <TextField
              multiline
              minRows={10}
              value={payloadJson}
              onChange={(event) => setPayloadJson(event.target.value)}
              fullWidth
            />
            <Box display="flex" justifyContent="flex-end">
              <Button variant="contained" disabled={!canUpdate} onClick={handleSave}>
                Save
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </PageContainer>
  );
};
