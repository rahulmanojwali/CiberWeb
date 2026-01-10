import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useTheme,
  useMediaQuery,
  Pagination,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import CheckIcon from "@mui/icons-material/CheckCircleOutline";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useCrudPermissions } from "../../utils/useCrudPermissions";
import { DEFAULT_PAGE_SIZE, MOBILE_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "../../config/uiDefaults";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import {
  fetchCommodityProducts,
  fetchCommodities,
  createCommodityProduct,
  updateCommodityProduct,
  fetchUnits,
} from "../../services/mandiApi";

type CommodityOption = {
  value: string;
  label: string;
  is_active?: "Y" | "N";
};

type ProductRow = {
  product_id: number;
  commodity_id: number;
  display_label: string;
  product_slug?: string;
  unit: string | null;
  is_active: "Y" | "N";
};

type UnitOption = {
  value: string;
  label: string;
};

const defaultCreateForm = {
  display_label: "",
  unit: "kg",
  notes: "",
  is_active: "Y" as "Y" | "N",
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

export const CommodityProducts: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const uiConfig = useAdminUiConfig();
  const orgCode = uiConfig?.scope?.org_code || "";

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [masterRows, setMasterRows] = useState<ProductRow[]>([]);
  const [commodities, setCommodities] = useState<CommodityOption[]>([]);
  const [selectedCommodityId, setSelectedCommodityId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const initialPageSize = isSmallScreen ? MOBILE_PAGE_SIZE : DEFAULT_PAGE_SIZE;
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [rowCount, setRowCount] = useState(0);
  const [statusFilter, setStatusFilter] = useState("ALL" as "ALL" | "ACTIVE" | "INACTIVE");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [masterSelection, setMasterSelection] = useState<number[]>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState(defaultCreateForm);
  const [units, setUnits] = useState<UnitOption[]>([]);

  const { canCreate, canDeactivate } = useCrudPermissions("commodity_products_masters");

  const commodityLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    commodities.forEach((c) => map.set(c.value, c.label));
    return map;
  }, [commodities]);

  const loadCommodities = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchCommodities({
      username,
      language,
      filters: {
        view: "IMPORTED",
        mandi_id: 0,
      },
    });
    console.log("[CommodityProducts] commodities raw", resp);
    const data = resp?.data || resp?.response?.data || resp || {};
    const list = data?.rows || data?.imported || data?.org_selected || [];
    const options = list
      .filter((item: any) => item?.is_active !== "N")
      .map((item: any) => ({
        value: String(item.commodity_id),
        label: String(item.display_label || item?.label_i18n?.en || item.commodity_id),
        is_active: item?.is_active || "Y",
      }));
    console.log("[CommodityProducts] commodity options", options);
    console.log("[CommodityProducts] selected commodity", selectedCommodityId);
    setCommodities(options);
  }, [language, selectedCommodityId]);

  const loadUnits = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchUnits({ username, language });
    const data = resp?.data || resp?.response?.data || resp || {};
    const list = data?.rows || [];
    const options = list.map((u: any) => ({
      value: String(u.unit_code),
      label: String(u.display_label || u.unit_code),
    }));
    setUnits(options);
    if (!createForm.unit && options.some((o: UnitOption) => o.value === "kg")) {
      setCreateForm((prev) => ({ ...prev, unit: "kg" }));
    }
  }, [createForm.unit, language]);

  const loadImportedProducts = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    if (!selectedCommodityId) {
      setRows([]);
      setRowCount(0);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetchCommodityProducts({
        username,
        language,
        filters: {
          view: "IMPORTED",
          commodity_id: Number(selectedCommodityId),
          is_active: statusFilter === "ALL" ? undefined : statusFilter === "ACTIVE" ? "Y" : "N",
          page: page + 1,
          pageSize,
        },
      });
      const data = resp?.data || resp?.response?.data || {};
      const list = data?.rows || [];
      const total = Number.isFinite(Number(data?.totalCount)) ? Number(data.totalCount) : list.length;
      setRowCount(total);
      setRows(
        list.map((p: any) => ({
          product_id: p.product_id,
          commodity_id: p.commodity_id,
          display_label: p.display_label || p?.label_i18n?.en || String(p.product_id),
          product_slug: p.product_slug || "",
          unit: p.unit || null,
          is_active: p.is_active === "N" ? "N" : "Y",
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [language, page, pageSize, selectedCommodityId, statusFilter]);

  const loadMasterProducts = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    if (!selectedCommodityId) return;
    setLoading(true);
    try {
      const resp = await fetchCommodityProducts({
        username,
        language,
        filters: {
          view: "MASTER",
          commodity_id: Number(selectedCommodityId),
        },
      });
      const data = resp?.data || resp?.response?.data || {};
      const list = data?.rows || [];
      setMasterRows(
        list.map((p: any) => ({
          product_id: p.product_id,
          commodity_id: p.commodity_id,
          display_label: p?.name_i18n?.en || p.product_slug || String(p.product_id),
          product_slug: p.product_slug || p.slug || "",
          unit: p.unit || null,
          is_active: p.is_active === false ? "N" : "Y",
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [language, selectedCommodityId]);

  useEffect(() => {
    loadCommodities();
  }, [loadCommodities]);

  useEffect(() => {
    loadUnits();
  }, [loadUnits]);

  useEffect(() => {
    loadImportedProducts();
  }, [loadImportedProducts]);

  const handleImport = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    if (!selectedCommodityId || masterSelection.length === 0) return;
    await createCommodityProduct({
      username,
      language,
      payload: {
        commodity_id: Number(selectedCommodityId),
        product_ids: masterSelection,
      },
    });
    setMasterSelection([]);
    setImportDialogOpen(false);
    await loadImportedProducts();
  }, [language, loadImportedProducts, masterSelection, selectedCommodityId]);

  const handleCreate = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    if (!selectedCommodityId || !createForm.display_label.trim() || !createForm.unit) return;
    await createCommodityProduct({
      username,
      language,
      payload: {
        commodity_id: Number(selectedCommodityId),
        display_label: createForm.display_label.trim(),
        unit: createForm.unit,
        notes: createForm.notes || null,
        is_active: createForm.is_active,
      },
    });
    setCreateDialogOpen(false);
    setCreateForm(defaultCreateForm);
    await loadImportedProducts();
  }, [createForm, language, loadImportedProducts, selectedCommodityId]);

  const handleToggle = useCallback(
    async (row: ProductRow) => {
      const username = currentUsername();
      if (!username) return;
      const nextStatus = row.is_active === "Y" ? "N" : "Y";
      await updateCommodityProduct({
        username,
        language,
        payload: {
          product_id: row.product_id,
          is_active: nextStatus,
        },
      });
      setRows((prev) =>
        prev.map((item) =>
          item.product_id === row.product_id ? { ...item, is_active: nextStatus } : item,
        ),
      );
    },
    [language],
  );

  const columns = useMemo<GridColDef<ProductRow>[]>(
    () => [
      { field: "product_id", headerName: "ID", width: 90 },
      { field: "display_label", headerName: "Product", flex: 1 },
      {
        field: "commodity",
        headerName: "Commodity",
        width: 180,
        valueGetter: () => commodityLabelMap.get(selectedCommodityId) || "",
      },
      { field: "unit", headerName: "Unit", width: 100 },
      {
        field: "is_active",
        headerName: "Active",
        width: 100,
        valueFormatter: (value) => (value === "Y" ? "Y" : "N"),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 190,
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
    [canDeactivate, commodityLabelMap, handleToggle, selectedCommodityId],
  );

  const listContent = useMemo(() => {
    if (isSmallScreen) {
      return (
        <Stack spacing={1.5} sx={{ maxWidth: 640, mx: "auto", width: "100%", flex: 1 }}>
          {rows.map((row) => (
            <Box
              key={row.product_id}
              sx={{
                borderRadius: 2,
                border: `1px solid ${theme.palette.divider}`,
                p: 2,
                boxShadow: 1,
              }}
            >
              <Stack spacing={1.25}>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.75rem" }}>
                    Product ID
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.95rem", fontWeight: 600 }}>
                    {row.product_id}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.75rem" }}>
                    Product Name
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.9rem" }}>
                    {row.display_label}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.75rem" }}>
                    Commodity
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                    {commodityLabelMap.get(selectedCommodityId) || ""}
                  </Typography>
                </Box>
                <Stack direction="row" justifyContent="flex-end" spacing={1}>
                  {canDeactivate && (
                    <Button
                      size="small"
                      color={row.is_active === "Y" ? "error" : "success"}
                      variant="text"
                      onClick={() => handleToggle(row)}
                      sx={{ textTransform: "none" }}
                    >
                      {row.is_active === "Y" ? "Deactivate" : "Activate"}
                    </Button>
                  )}
                </Stack>
              </Stack>
            </Box>
          ))}
          {!rows.length && selectedCommodityId && (
            <Typography variant="body2" color="text.secondary">
              No products found.
            </Typography>
          )}
          {!selectedCommodityId && (
            <Typography variant="body2" color="text.secondary">
              Select a commodity to view products.
            </Typography>
          )}
          {rowCount > pageSize && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 1 }}>
              <Pagination
                count={Math.max(1, Math.ceil(rowCount / pageSize))}
                page={page + 1}
                onChange={(_event, newPage) => setPage(newPage - 1)}
                color="primary"
              />
            </Box>
          )}
        </Stack>
      );
    }

    return (
      <Card>
        <CardContent>
          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <ResponsiveDataGrid
              columns={columns}
              rows={rows}
              loading={loading}
              getRowId={(r) => r.product_id}
              paginationMode="server"
              rowCount={rowCount}
              paginationModel={{ page, pageSize }}
              autoHeight
              onPaginationModelChange={(model) => {
                setPage(model.page);
                if (model.pageSize !== pageSize) {
                  setPageSize(model.pageSize);
                  setPage(0);
                }
              }}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
            />
          </Box>
        </CardContent>
      </Card>
    );
  }, [
    isSmallScreen,
    rows,
    theme.palette.divider,
    page,
    pageSize,
    rowCount,
    columns,
    loading,
    canDeactivate,
    handleToggle,
    commodityLabelMap,
    selectedCommodityId,
  ]);

  return (
    <PageContainer sx={{ display: "flex", flexDirection: "column", flexGrow: 1, minHeight: 0 }}>
      <Stack spacing={2} mb={2}>
        <Typography variant="h5">{t("menu.commodityProducts", { defaultValue: "Commodity Products" })}</Typography>
        <Stack
          direction={isSmallScreen ? "column" : "row"}
          spacing={2}
          alignItems={isSmallScreen ? "stretch" : "center"}
        >
          <TextField
            label="Organisation"
            size="small"
            value={orgCode || ""}
            disabled
            sx={{ minWidth: isSmallScreen ? "100%" : 200 }}
            fullWidth={isSmallScreen}
          />
          <TextField
            select
            label="Commodity"
            size="small"
            value={selectedCommodityId}
            onChange={(e) => {
              setSelectedCommodityId(String(e.target.value));
              setPage(0);
            }}
            sx={{ minWidth: isSmallScreen ? "100%" : 220 }}
            fullWidth={isSmallScreen}
          >
            <MenuItem value="">Select commodity</MenuItem>
            {commodities.map((c) => (
              <MenuItem key={c.value} value={c.value}>
                {c.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Status"
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            sx={{ width: isSmallScreen ? "100%" : 160 }}
            fullWidth={isSmallScreen}
          >
            <MenuItem value="ALL">All</MenuItem>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="INACTIVE">Inactive</MenuItem>
          </TextField>
          {canCreate && (
            <Stack direction="row" spacing={1} sx={{ width: isSmallScreen ? "100%" : "auto" }}>
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setCreateDialogOpen(true)}
                disabled={!selectedCommodityId}
                fullWidth={isSmallScreen}
              >
                Add Custom Product
              </Button>
              <Button
                variant="contained"
                size="small"
                startIcon={<DownloadIcon />}
                onClick={async () => {
                  setImportDialogOpen(true);
                  await loadMasterProducts();
                }}
                disabled={!selectedCommodityId}
                fullWidth={isSmallScreen}
              >
                Import
              </Button>
            </Stack>
          )}
        </Stack>
      </Stack>

      {listContent}

      <Dialog open={importDialogOpen} onClose={() => setImportDialogOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Import Products</DialogTitle>
        <DialogContent>
          <Box sx={{ height: 520 }}>
            <ResponsiveDataGrid
              columns={[
                { field: "product_id", headerName: "ID", width: 90 },
                { field: "display_label", headerName: "Product", flex: 1 },
                { field: "product_slug", headerName: "Slug", width: 180 },
                { field: "unit", headerName: "Unit", width: 100 },
              ]}
              rows={masterRows}
              loading={loading}
              getRowId={(r) => r.product_id}
              checkboxSelection
              rowSelectionModel={masterSelection}
              onRowSelectionModelChange={(selection) =>
                setMasterSelection((selection as number[]).map((value) => Number(value)))
              }
              disableRowSelectionOnClick
              pageSizeOptions={[25, 50, 100, 200]}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportDialogOpen(false)}>Close</Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            disabled={!masterSelection.length}
            onClick={handleImport}
          >
            Import Selected {masterSelection.length ? `(${masterSelection.length})` : ""}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createDialogOpen} onClose={() => setCreateDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Custom Product</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Product Name"
              value={createForm.display_label}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, display_label: e.target.value }))}
              fullWidth
            />
            <TextField
              select
              label="Unit"
              value={createForm.unit}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, unit: e.target.value }))}
              fullWidth
              required
            >
              {units.map((unit) => (
                <MenuItem key={unit.value} value={unit.value}>
                  {unit.label}
                </MenuItem>
              ))}
            </TextField>
            {!createForm.unit && (
              <Typography sx={{ color: "error.main", fontSize: 12 }}>
                Unit is required.
              </Typography>
            )}
            <TextField
              label="Notes"
              value={createForm.notes}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, notes: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              select
              label="Active"
              value={createForm.is_active}
              onChange={(e) => setCreateForm((prev) => ({ ...prev, is_active: e.target.value as "Y" | "N" }))}
              fullWidth
            >
              <MenuItem value="Y">Yes</MenuItem>
              <MenuItem value="N">No</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreate}
            disabled={!createForm.display_label.trim() || !createForm.unit}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
