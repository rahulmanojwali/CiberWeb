import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Card, CardContent, CircularProgress, Grid, Stack, TextField, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { GridColDef } from "@mui/x-data-grid";
import { PageContainer } from "../components/PageContainer";
import { ResponsiveDataGrid } from "../components/ResponsiveDataGrid";
import {
  getCommodityPaymentSettings,
  upsertCommodityPaymentSettings,
} from "../services/paymentConfigApi";
import { getCurrentAdminUsername } from "../utils/session";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { can } from "../utils/adminUiConfig";

const defaultPayload = JSON.stringify(
  {
    records: [
      {
        org_id: "",
        mandi_id: null,
        commodity_id: null,
        product_id: null,
        fees: [
          {
            fee_code: "MARKET_FEE",
            mode: "PERCENT",
            percent_value: 1.0,
          },
        ],
        is_active: "Y",
      },
    ],
  },
  null,
  2,
);

export const CommodityFees: React.FC = () => {
  const { i18n } = useTranslation();
  const language = i18n.language || "en";
  const uiConfig = useAdminUiConfig();
  const [filters, setFilters] = useState({
    org_id: "",
    mandi_id: "",
    commodity_id: "",
    product_id: "",
  });
  const [rows, setRows] = useState<any[]>([]);
  const [payloadJson, setPayloadJson] = useState(defaultPayload);
  const [loading, setLoading] = useState(false);
  const canUpdate = useMemo(
    () => can(uiConfig.resources, "commodity_payment_settings.update", "UPDATE"),
    [uiConfig.resources],
  );

  const loadData = async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    setLoading(true);
    try {
      const payload: Record<string, any> = {
        org_id: filters.org_id || undefined,
        mandi_id: filters.mandi_id ? Number(filters.mandi_id) : undefined,
        commodity_id: filters.commodity_id ? Number(filters.commodity_id) : undefined,
        product_id: filters.product_id ? Number(filters.product_id) : undefined,
      };
      const resp = await getCommodityPaymentSettings({
        username,
        language,
        payload,
      });
      setRows(resp?.data?.list || []);
    } catch (error) {
      console.error("Failed to load commodity fees:", error);
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
      await upsertCommodityPaymentSettings({ username, language, payload });
      loadData();
    } catch (error) {
      console.error("Failed to upsert commodity fees:", error);
      alert("Invalid payload.");
    }
  };

  const columns = useMemo<GridColDef<any>[]>(
    () => [
      { field: "commodity_id", headerName: "Commodity ID", width: 140 },
      { field: "product_id", headerName: "Product ID", width: 140 },
      { field: "fees", headerName: "Fees (JSON)", flex: 1 },
      { field: "is_active", headerName: "Active", width: 110 },
      { field: "version", headerName: "Version", width: 110 },
    ],
    [],
  );

  const gridRows = rows.map((doc) => ({
    id: doc._id || `${doc.org_id}-${doc.commodity_id}-${doc.product_id}`,
    commodity_id: doc.commodity_id,
    product_id: doc.product_id,
    fees: JSON.stringify(doc.fees || []),
    is_active: doc.is_active,
    version: doc.version,
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
          <Typography variant="h5">Commodity Fee Settings</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage commodity-level payment overrides.
          </Typography>
        </Stack>
        <Button variant="contained" onClick={loadData}>
          Refresh
        </Button>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <TextField
                label="Org ID"
                size="small"
                value={filters.org_id}
                onChange={(e) => setFilters((prev) => ({ ...prev, org_id: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Mandi ID"
                size="small"
                value={filters.mandi_id}
                onChange={(e) => setFilters((prev) => ({ ...prev, mandi_id: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Commodity ID"
                size="small"
                value={filters.commodity_id}
                onChange={(e) => setFilters((prev) => ({ ...prev, commodity_id: e.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Product ID"
                size="small"
                value={filters.product_id}
                onChange={(e) => setFilters((prev) => ({ ...prev, product_id: e.target.value }))}
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
