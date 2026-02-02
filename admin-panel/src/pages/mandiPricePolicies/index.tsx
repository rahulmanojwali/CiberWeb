import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import { useNavigate } from "react-router-dom";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { usePermissions } from "../../authz/usePermissions";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { normalizeLanguageCode } from "../../config/languages";
import { useTranslation } from "react-i18next";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import { getMandiPricePolicies, deactivateMandiPricePolicy } from "../../services/mandiPricePoliciesApi";

type Option = { value: string; label: string };

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

export const MandiPricePolicies: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const navigate = useNavigate();
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();

  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [filters, setFilters] = useState({
    mandi_id: "",
    commodity_product_id: "",
    active_only: true,
  });

  const canView = useMemo(
    () => can("mandi_price_policies.list", "VIEW"),
    [can],
  );
  const canCreate = useMemo(
    () => can("mandi_price_policies.create", "CREATE"),
    [can],
  );
  const canDeactivate = useMemo(
    () => can("mandi_price_policies.deactivate", "DEACTIVATE"),
    [can],
  );

  const loadMandis = useCallback(async () => {
    const username = currentUsername();
    const orgId = uiConfig.scope?.org_id || "";
    if (!username || !orgId) return;
    const list = await getMandisForCurrentScope({
      username,
      language,
      org_id: orgId,
    });
    setMandiOptions(
      (list || []).map((m: any) => ({
        value: String(m.mandi_id ?? m.mandiId ?? ""),
        label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
      })),
    );
  }, [language, uiConfig.scope?.org_id]);

  const loadPolicies = useCallback(async () => {
    const username = currentUsername();
    const orgId = uiConfig.scope?.org_id || "";
    if (!username || !orgId || !filters.mandi_id) return;
    setLoading(true);
    try {
      const resp = await getMandiPricePolicies({
        username,
        language,
        filters: {
          org_id: orgId,
          mandi_id: filters.mandi_id,
          commodity_product_id: filters.commodity_product_id || undefined,
          active_only: filters.active_only ? "Y" : undefined,
        },
      });
      const data = resp?.data || resp?.response?.data || {};
      setRows(Array.isArray(data?.rows) ? data.rows : []);
    } finally {
      setLoading(false);
    }
  }, [filters, language, uiConfig.scope?.org_id]);

  useEffect(() => {
    if (canView) loadMandis();
  }, [canView, loadMandis]);

  const columns = useMemo<GridColDef<any>[]>(
    () => [
      { field: "_id", headerName: "Policy ID", width: 220 },
      { field: "mandi_id", headerName: "Mandi", width: 120 },
      { field: "commodity_product_id", headerName: "Product", width: 140 },
      {
        field: "price_band",
        headerName: "Band (min-max)",
        width: 180,
        valueGetter: (value, row) =>
          `${row?.price_band?.min ?? "-"} - ${row?.price_band?.max ?? "-"}`,
      },
      {
        field: "effective",
        headerName: "Effective From",
        width: 160,
        valueGetter: (value, row) => row?.effective?.from || "-",
      },
      {
        field: "enforcement",
        headerName: "Mode",
        width: 140,
        valueGetter: (value, row) => row?.enforcement?.mode || "-",
      },
      {
        field: "is_active",
        headerName: "Active",
        width: 90,
        valueGetter: (value, row) => row?.is_active || "Y",
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 140,
        sortable: false,
        renderCell: (params) =>
          canDeactivate ? (
            <Button
              size="small"
              onClick={async () => {
                const username = currentUsername();
                if (!username) return;
                await deactivateMandiPricePolicy({
                  username,
                  language,
                  payload: { _id: params.row?._id },
                });
                loadPolicies();
              }}
            >
              Deactivate
            </Button>
          ) : null,
      },
    ],
    [canDeactivate, language, loadPolicies],
  );

  if (!canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view mandi price policies.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">Mandi Price Policies</Typography>
          <Typography variant="body2" color="text.secondary">
            Configure price bands and enforcement per mandi product.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          {canCreate ? (
            <Button variant="contained" onClick={() => navigate("/mandi-price-policies/create")}>
              Create Policy
            </Button>
          ) : null}
          <Button variant="outlined" onClick={loadPolicies} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Box mb={2}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
          <TextField
            select
            label="Mandi"
            value={filters.mandi_id}
            onChange={(e) => setFilters((prev) => ({ ...prev, mandi_id: e.target.value }))}
            sx={{ minWidth: 200 }}
          >
            {mandiOptions.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Commodity Product ID (optional)"
            value={filters.commodity_product_id}
            onChange={(e) => setFilters((prev) => ({ ...prev, commodity_product_id: e.target.value }))}
            sx={{ minWidth: 200 }}
          />
          <TextField
            select
            label="Active Only"
            value={filters.active_only ? "Y" : "N"}
            onChange={(e) => setFilters((prev) => ({ ...prev, active_only: e.target.value === "Y" }))}
            sx={{ minWidth: 140 }}
          >
            <MenuItem value="Y">Yes</MenuItem>
            <MenuItem value="N">No</MenuItem>
          </TextField>
          <Button variant="contained" onClick={loadPolicies}>
            Search
          </Button>
        </Stack>
      </Box>

      <Box sx={{ width: "100%" }}>
        <ResponsiveDataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r._id || `${r.mandi_id}-${r.commodity_product_id}-${r?.effective?.from || ""}`}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </Box>
    </PageContainer>
  );
};
