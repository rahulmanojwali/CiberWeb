import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import DownloadIcon from "@mui/icons-material/Download";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import CheckIcon from "@mui/icons-material/CheckCircleOutline";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useCrudPermissions } from "../../utils/useCrudPermissions";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import {
  createMandiCommodityProduct,
  deactivateMandiCommodityProduct,
  fetchMandiCommodityProducts,
  fetchCommodityProducts,
  fetchCommodities,
  getMandisForCurrentScope,
} from "../../services/mandiApi";

type MandiOption = {
  mandi_id: number;
  label?: string;
  name_i18n?: Record<string, string>;
  mandi_slug?: string;
};

type CommodityOption = {
  value: string;
  label: string;
};

type ProductOption = {
  product_id: number;
  label: string;
  unit?: string | null;
};

type MappingRow = {
  id: string;
  mandi_id: number;
  commodity_id: number;
  product_id: number;
  trade_type: "PROCUREMENT" | "SALES" | "BOTH";
  is_active: "Y" | "N";
  notes?: string | null;
};

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

export const MandiCommodityProductsMasters: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const uiConfig = useAdminUiConfig();
  const orgId = uiConfig?.scope?.org_id ? String(uiConfig.scope.org_id) : "";

  const { canCreate, canDeactivate } = useCrudPermissions("mandi_commodity_products_masters");

  const [mandis, setMandis] = useState<MandiOption[]>([]);
  const [commodities, setCommodities] = useState<CommodityOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedMandiId, setSelectedMandiId] = useState<string>("");
  const [selectedCommodityId, setSelectedCommodityId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Y" | "N">("ALL");

  const [importOpen, setImportOpen] = useState(false);
  const [importSelection, setImportSelection] = useState<number[]>([]);
  const [importTradeType, setImportTradeType] = useState<"PROCUREMENT" | "SALES" | "BOTH">("BOTH");

  const mappedProductIds = useMemo(() => new Set(rows.map((r) => r.product_id)), [rows]);

  const loadMandis = useCallback(async () => {
    const username = currentUsername();
    if (!username || !orgId) return;
    const resp = await getMandisForCurrentScope({
      username,
      language,
      org_id: orgId,
      filters: { page: 1, pageSize: 200 },
    });
    setMandis(Array.isArray(resp) ? resp : []);
  }, [language, orgId]);

  const loadCommodities = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchCommodities({
      username,
      language,
      filters: { view: "IMPORTED", mandi_id: 0 },
    });
    console.log("[mandiCommodityProducts] commodities response", resp);
    const data = resp?.data || resp?.response?.data || resp || {};
    const list = data?.rows || data?.imported || data?.org_selected || [];
    const options = list
      .filter((item: any) => item?.is_active !== "N")
      .map((item: any) => ({
        value: String(item.commodity_id),
        label: String(item.display_label || item?.label_i18n?.en || item.commodity_id),
      }));
    console.log("[mandiCommodityProducts] commodity options", options);
    setCommodities(options);
  }, [language]);

  const loadProducts = useCallback(async () => {
    const username = currentUsername();
    if (!username || !selectedCommodityId) {
      setProducts([]);
      return;
    }
    const resp = await fetchCommodityProducts({
      username,
      language,
      filters: {
        view: "IMPORTED",
        commodity_id: Number(selectedCommodityId),
        is_active: "Y",
        page: 1,
        pageSize: 500,
      },
    });
    console.log("[mandiCommodityProducts] products response", resp);
    const data = resp?.data || resp?.response?.data || {};
    const list = data?.rows || [];
    const options = list.map((p: any) => ({
      product_id: p.product_id,
      label: String(p.display_label || p?.label_i18n?.en || p.product_id),
      unit: p.unit || null,
    }));
    setProducts(options);
  }, [language, selectedCommodityId]);

  const loadMappings = useCallback(async () => {
    const username = currentUsername();
    if (!username || !selectedMandiId || !selectedCommodityId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const payload = {
        mandi_id: Number(selectedMandiId),
        commodity_id: Number(selectedCommodityId),
        is_active: statusFilter === "ALL" ? undefined : statusFilter,
        page: 1,
        pageSize: 200,
      };
      console.log("[mandiCommodityProducts] list payload", payload);
      const resp = await fetchMandiCommodityProducts({
        username,
        language,
        filters: payload,
      });
      console.log("[mandiCommodityProducts] list response", resp);
      const data = resp?.data || resp?.response?.data || {};
      const list = data?.rows || [];
      setRows(
        list.map((item: any, index: number) => ({
          id: String(item?._id || item?.id || `${item?.mandi_id}-${item?.product_id}-${index}`),
          mandi_id: Number(item?.mandi_id || 0),
          commodity_id: Number(item?.commodity_id || 0),
          product_id: Number(item?.product_id || 0),
          trade_type: item?.trade_type || "BOTH",
          is_active: item?.is_active || "Y",
          notes: item?.notes || null,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [language, selectedCommodityId, selectedMandiId, statusFilter]);

  useEffect(() => {
    loadMandis();
  }, [loadMandis]);

  useEffect(() => {
    loadCommodities();
  }, [loadCommodities]);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  useEffect(() => {
    console.log("[mandiCommodityProducts] selection", {
      mandi_id: selectedMandiId,
      commodity_id: selectedCommodityId,
    });
  }, [selectedMandiId, selectedCommodityId]);

  const handleImport = useCallback(async () => {
    const username = currentUsername();
    if (!username || !selectedMandiId || !selectedCommodityId || importSelection.length === 0) return;
    const payload = {
      mandi_id: Number(selectedMandiId),
      commodity_id: Number(selectedCommodityId),
      product_ids: importSelection,
      trade_type: importTradeType,
    };
    console.log("[mandiCommodityProducts] create payload", payload);
    const resp = await createMandiCommodityProduct({
      username,
      language,
      payload,
    });
    console.log("[mandiCommodityProducts] create response", resp);
    setImportSelection([]);
    setImportOpen(false);
    await loadMappings();
  }, [importSelection, importTradeType, language, loadMappings, selectedCommodityId, selectedMandiId]);

  const handleToggle = useCallback(
    async (row: MappingRow) => {
      const username = currentUsername();
      if (!username) return;
      const nextState = row.is_active === "Y" ? "N" : "Y";
      await deactivateMandiCommodityProduct({
        username,
        language,
        mapping_id: row.id,
        is_active: nextState,
      });
      setRows((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, is_active: nextState } : item)),
      );
    },
    [language],
  );

  const columns = useMemo<GridColDef<MappingRow>[]>(
    () => [
      {
        field: "product_id",
        headerName: "Product",
        flex: 1,
        minWidth: 200,
        valueGetter: (_, row) =>
          products.find((p) => p.product_id === row.product_id)?.label || String(row.product_id),
      },
      {
        field: "trade_type",
        headerName: "Trade Type",
        minWidth: 140,
        valueGetter: (_, row) => row.trade_type,
      },
      {
        field: "is_active",
        headerName: "Status",
        minWidth: 120,
        renderCell: (params) => (
          <Chip
            label={params.value === "Y" ? "Active" : "Inactive"}
            color={params.value === "Y" ? "success" : "default"}
            size="small"
          />
        ),
      },
      {
        field: "actions",
        headerName: "Actions",
        minWidth: 140,
        sortable: false,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            {canDeactivate && (
              <Button
                size="small"
                color={params.row.is_active === "Y" ? "error" : "success"}
                startIcon={params.row.is_active === "Y" ? <BlockIcon /> : <CheckIcon />}
                onClick={() => handleToggle(params.row)}
              >
                {params.row.is_active === "Y" ? "Deactivate" : "Activate"}
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [canDeactivate, handleToggle, products],
  );

  const availableProducts = products.filter((p) => !mappedProductIds.has(p.product_id));

  return (
    <PageContainer title="Mandi Commodity Products">
      <Typography sx={{ color: "text.secondary", mt: -1 }}>
        Manage mandi-level commodity product mappings
      </Typography>
      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", md: "center" }}
            sx={{ mb: 2 }}
          >
            <TextField
              label="Mandi"
              size="small"
              select
              value={selectedMandiId}
              onChange={(event) => setSelectedMandiId(String(event.target.value))}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">Select mandi</MenuItem>
              {mandis.map((mandi) => (
                <MenuItem key={mandi.mandi_id} value={String(mandi.mandi_id)}>
                  {mandi.label || mandi.name_i18n?.en || mandi.mandi_slug || mandi.mandi_id}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Commodity"
              size="small"
              select
              value={selectedCommodityId}
              onChange={(event) => setSelectedCommodityId(String(event.target.value))}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">Select commodity</MenuItem>
              {commodities.map((commodity) => (
                <MenuItem key={commodity.value} value={commodity.value}>
                  {commodity.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Status"
              size="small"
              select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "ALL" | "Y" | "N")}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="Y">Active</MenuItem>
              <MenuItem value="N">Inactive</MenuItem>
            </TextField>
            <Box sx={{ flex: 1 }} />
            {canCreate && (
              <Button
                variant="contained"
                startIcon={<DownloadIcon />}
                onClick={() => setImportOpen(true)}
                disabled={!selectedMandiId || !selectedCommodityId}
                sx={{ alignSelf: isSmallScreen ? "stretch" : "center" }}
              >
                Import to Mandi
              </Button>
            )}
          </Stack>

          {!selectedCommodityId && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select a commodity to load products.
            </Typography>
          )}
          {selectedCommodityId && products.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Import/create products first.
            </Typography>
          )}

          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <ResponsiveDataGrid
              rows={rows}
              columns={columns}
              loading={loading}
              pageSizeOptions={[10, 25, 50, 100]}
              paginationMode="server"
              rowCount={rows.length}
              paginationModel={{ page: 0, pageSize: 25 }}
              autoHeight
              disableRowSelectionOnClick
              sx={{
                "& .MuiDataGrid-columnHeaders": {
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  backgroundColor: theme.palette.background.paper,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                },
              }}
            />
          </Box>
        </CardContent>
      </Card>

      <Dialog open={importOpen} onClose={() => setImportOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Import Products to Mandi</DialogTitle>
        <DialogContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              select
              label="Trade Type"
              value={importTradeType}
              onChange={(event) =>
                setImportTradeType(event.target.value as "PROCUREMENT" | "SALES" | "BOTH")
              }
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="PROCUREMENT">Procurement</MenuItem>
              <MenuItem value="SALES">Sales</MenuItem>
              <MenuItem value="BOTH">Both</MenuItem>
            </TextField>
            <Typography sx={{ color: "text.secondary", alignSelf: "center" }}>
              Select products to enable for this mandi.
            </Typography>
          </Stack>
          <Box sx={{ height: 520 }}>
            <ResponsiveDataGrid
              rows={availableProducts}
              columns={[
                { field: "product_id", headerName: "ID", width: 90 },
                { field: "label", headerName: "Product", flex: 1 },
                { field: "unit", headerName: "Unit", width: 120 },
              ]}
              loading={loading}
              getRowId={(r) => r.product_id}
              checkboxSelection
              rowSelectionModel={importSelection}
              onRowSelectionModelChange={(selection) =>
                setImportSelection((selection as number[]).map((value) => Number(value)))
              }
              disableRowSelectionOnClick
              pageSizeOptions={[25, 50, 100, 200]}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            disabled={!importSelection.length}
            onClick={handleImport}
          >
            Import Selected {importSelection.length ? `(${importSelection.length})` : ""}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
