import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../components/PageContainer";
import { ResponsiveDataGrid } from "../components/ResponsiveDataGrid";
import { getPaymentModels, upsertPaymentModel } from "../services/paymentConfigApi";
import { getCurrentAdminUsername } from "../utils/session";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { can } from "../utils/adminUiConfig";

const defaultPayload = JSON.stringify(
  {
    model_code: "BASIC_FEE",
    scope: {
      org_scope: "GLOBAL",
    },
    description: "Global default fee model",
    currency: "INR",
    fees: [
      {
        fee_code: "MARKET_FEE",
        mode: "PERCENT",
        percent_value: 1.0,
      },
      {
        fee_code: "COMMISSION",
        mode: "PERCENT",
        percent_value: 1.5,
      },
    ],
    is_active: "Y",
  },
  null,
  2,
);

export const PaymentModels: React.FC = () => {
  const { i18n } = useTranslation();
  const language = i18n.language || "en";
  const uiConfig = useAdminUiConfig();
  const [filters, setFilters] = useState({ org_id: "", mandi_id: "", is_active: "" });
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [payloadJson, setPayloadJson] = useState(defaultPayload);
  const canUpdate = useMemo(
    () => can(uiConfig.resources, "payment_models.update", "UPDATE"),
    [uiConfig.resources],
  );

  const loadData = async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    setLoading(true);
    try {
      const requestFilters: Record<string, any> = {};
      if (filters.org_id) requestFilters.org_id = filters.org_id;
      if (filters.mandi_id) requestFilters.mandi_id = Number(filters.mandi_id);
      if (filters.is_active) requestFilters.is_active = filters.is_active;
      const resp = await getPaymentModels({
        username,
        language,
        filters: requestFilters,
      });
      setRows(resp?.data?.list || []);
    } catch (error) {
      console.error("Failed to load payment models:", error);
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
      await upsertPaymentModel({ username, language, payload });
      setPayloadJson(defaultPayload);
      loadData();
    } catch (error) {
      console.error("Failed to upsert payment model:", error);
      alert("Invalid payload structure.");
    }
  };

  const columns = useMemo<GridColDef<any>[]>(
    () => [
      { field: "model_code", headerName: "Model Code", width: 200 },
      { field: "scope", headerName: "Scope", width: 140 },
      { field: "org_id", headerName: "Org ID", width: 120 },
      { field: "mandi_id", headerName: "Mandi ID", width: 120 },
      { field: "is_active", headerName: "Active", width: 100 },
      { field: "version", headerName: "Version", width: 110 },
      { field: "created_on", headerName: "Created On", width: 200 },
    ],
    [],
  );

  const gridRows = rows.map((doc) => ({
    id: doc._id || `${doc.scope?.org_scope}-${doc.model_code}`,
    model_code: doc.model_code,
    scope: doc.scope?.org_scope,
    org_id: doc.scope?.org_id || null,
    mandi_id: doc.scope?.mandi_id || null,
    is_active: doc.is_active,
    version: doc.version,
    created_on: doc.created_on ? new Date(doc.created_on).toLocaleString() : "",
  }));

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="flex-start">
        <Stack spacing={1} flex={1}>
          <Typography variant="h5">Payment Models</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <TextField
              label="Org ID"
              size="small"
              value={filters.org_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, org_id: e.target.value }))}
            />
            <TextField
              label="Mandi ID"
              size="small"
              value={filters.mandi_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, mandi_id: e.target.value }))}
            />
            <TextField
              label="Active?"
              size="small"
              select
              value={filters.is_active}
              onChange={(e) => setFilters((prev) => ({ ...prev, is_active: e.target.value }))}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="Y">Y</MenuItem>
              <MenuItem value="N">N</MenuItem>
            </TextField>
            <Button variant="contained" onClick={loadData}>
              Refresh
            </Button>
          </Stack>
        </Stack>
        <Stack spacing={1} flex={1}>
          <Typography variant="subtitle1">Upsert payload</Typography>
          <TextField
            multiline
            minRows={12}
            maxRows={16}
            value={payloadJson}
            onChange={(event) => setPayloadJson(event.target.value)}
            fullWidth
          />
          <Button
            variant="contained"
            disabled={!canUpdate}
            onClick={handleSave}
            sx={{ alignSelf: "flex-end" }}
          >
            Save Model
          </Button>
        </Stack>
      </Stack>
      <Box sx={{ mt: 2 }}>
        <ResponsiveDataGrid
          columns={columns}
          rows={gridRows}
          loading={loading}
          hideFooterRowCount
          hideFooterSelectedRowCount
        />
      </Box>
    </PageContainer>
  );
};
