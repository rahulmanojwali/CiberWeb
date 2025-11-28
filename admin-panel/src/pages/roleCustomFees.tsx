import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../components/PageContainer";
import { ResponsiveDataGrid } from "../components/ResponsiveDataGrid";
import { getRoleCustomFees, upsertRoleCustomFee } from "../services/paymentConfigApi";
import { getCurrentAdminUsername } from "../utils/session";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { can } from "../utils/adminUiConfig";

const defaultPayload = JSON.stringify(
  {
    org_id: "",
    mandi_id: null,
    custom_fee_code: "CUSTOM_TEMPLATE",
    label: "Custom Fee",
    mode: "PERCENT",
    values: {
      percent_value: 1.0,
      fixed_value: null,
    },
    is_active: "Y",
  },
  null,
  2,
);

export const RoleCustomFees: React.FC = () => {
  const { i18n } = useTranslation();
  const language = i18n.language || "en";
  const uiConfig = useAdminUiConfig();
  const [filters, setFilters] = useState({ org_id: "", mandi_id: "" });
  const [rows, setRows] = useState<any[]>([]);
  const [payloadJson, setPayloadJson] = useState(defaultPayload);
  const [loading, setLoading] = useState(false);
  const canUpdate = useMemo(
    () => can(uiConfig.resources, "role_custom_fees.update", "UPDATE"),
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
      };
      const resp = await getRoleCustomFees({
        username,
        language,
        payload,
      });
      setRows(resp?.data?.list || []);
    } catch (error) {
      console.error("Failed to load role custom fees:", error);
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
      await upsertRoleCustomFee({ username, language, payload });
      loadData();
    } catch (error) {
      console.error("Failed to save role custom fee:", error);
      alert("Invalid payload.");
    }
  };

  const columns = useMemo<GridColDef<any>[]>(
    () => [
      { field: "custom_fee_code", headerName: "Fee Code", width: 180 },
      { field: "org_id", headerName: "Org ID", width: 140 },
      { field: "mandi_id", headerName: "Mandi ID", width: 120 },
      { field: "mode", headerName: "Mode", width: 120 },
      { field: "values", headerName: "Values", flex: 1 },
      { field: "is_active", headerName: "Active", width: 120 },
    ],
    [],
  );

  const gridRows = rows.map((doc) => ({
    id: doc._id || `${doc.org_id}-${doc.mandi_id}-${doc.custom_fee_code}`,
    custom_fee_code: doc.custom_fee_code,
    org_id: doc.org_id,
    mandi_id: doc.mandi_id,
    mode: doc.mode,
    values: JSON.stringify(doc.values || {}),
    is_active: doc.is_active,
  }));

  return (
    <PageContainer>
      <Stack spacing={2}>
        <Typography variant="h5">Role Custom Fees</Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Stack spacing={1} flex={1}>
            <Typography variant="subtitle2">Filters</Typography>
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
              <Button variant="contained" onClick={loadData}>
                Refresh
              </Button>
            </Stack>
          </Stack>
          <Stack spacing={1} flex={1}>
            <Typography variant="subtitle1">Editable payload</Typography>
            <TextField
              multiline
              minRows={8}
              value={payloadJson}
              onChange={(event) => setPayloadJson(event.target.value)}
              fullWidth
            />
            <Button variant="contained" disabled={!canUpdate} onClick={handleSave}>
              Save
            </Button>
          </Stack>
        </Stack>
        <Box>
          <ResponsiveDataGrid
            columns={columns}
            rows={gridRows}
            loading={loading}
          />
        </Box>
      </Stack>
    </PageContainer>
  );
};
