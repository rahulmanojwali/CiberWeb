import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
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
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
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
  deactivateCommodityProduct,
} from "../../services/mandiApi";

type ProductRow = {
  product_id: number;
  commodity_id: number;
  commodity_name: string;
  name: string;
  unit: string | null;
  is_active: boolean;
  scope_type?: string;
  org_code?: string | null;
};

const defaultForm = {
  commodity_id: "",
  name_en: "",
  unit: "",
  is_active: true,
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
  const fullScreenDialog = isSmallScreen;
  const uiConfig = useAdminUiConfig();
  const orgCode = uiConfig?.scope?.org_code || null;

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [commodities, setCommodities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const initialPageSize = isSmallScreen ? MOBILE_PAGE_SIZE : DEFAULT_PAGE_SIZE;
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [rowCount, setRowCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filters, setFilters] = useState({ commodity_id: "", status: "ALL" as "ALL" | "ACTIVE" | "INACTIVE" });
  const [orgFilterCode, setOrgFilterCode] = useState<string>("ALL");

  const { canCreate, canEdit, canDeactivate, canViewDetail, isSuperAdmin } = useCrudPermissions("commodity_products");

  const resolveOrgLabel = useCallback(
    (code?: string | null) => {
      if (!code) return "Global";
      return code;
    },
    [],
  );

  const loadCommodities = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchCommodities({ username, language });
    const list = resp?.data?.commodities || [];
    setCommodities(list);
  }, [language]);

  const loadData = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
    const resp = await fetchCommodityProducts({
      username,
      language,
      filters: {
        page: page + 1,
        pageSize,
        commodity_id: filters.commodity_id || undefined,
        is_active: filters.status === "ALL" ? undefined : filters.status === "ACTIVE",
        org_code: isSuperAdmin
          ? orgFilterCode === "ALL"
            ? undefined
            : orgFilterCode
          : orgCode || undefined,
      },
    });
    const data = resp?.data || resp?.response?.data || {};
    const list = data?.products || [];
    const total = Number.isFinite(Number(data?.totalCount)) ? Number(data.totalCount) : list.length;
    setRowCount(total);
      const mapCommodityName = (cid: number) =>
        commodities.find((c) => Number(c.commodity_id) === Number(cid))?.name_i18n?.en || String(cid);
      setRows(
        list.map((p: any) => ({
          product_id: p.product_id,
          commodity_id: p.commodity_id,
          commodity_name: mapCommodityName(p.commodity_id),
          name: p?.name_i18n?.en || p.slug || String(p.product_id),
          unit: p.unit || null,
          is_active: Boolean(p.is_active),
          scope_type: p.scope_type || "GLOBAL",
          org_code: p.org_code || null,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [commodities, filters.commodity_id, filters.status, language, page, pageSize, orgCode]);

  useEffect(() => {
    loadCommodities();
  }, [loadCommodities]);

  useEffect(() => {
    if (commodities.length) {
      loadData();
    }
  }, [commodities.length, loadData]);

  const openCreate = useCallback(() => {
    setIsEdit(false);
    setSelectedId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  }, []);

  const openEdit = useCallback((row: ProductRow) => {
    setIsEdit(true);
    setSelectedId(row.product_id);
    setForm({
      commodity_id: String(row.commodity_id),
      name_en: row.name,
      unit: row.unit || "",
      is_active: row.is_active,
    });
    setDialogOpen(true);
  }, []);

  const handleSave = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    const payload: any = {
      commodity_id: Number(form.commodity_id),
      name_i18n: { en: form.name_en },
      unit: form.unit || null,
      is_active: form.is_active,
    };
    if (!isSuperAdmin && orgCode) {
      payload.org_code = orgCode;
    }
    if (isSuperAdmin && orgFilterCode !== "ALL") {
      payload.org_code = orgFilterCode;
    }
    if (isEdit && selectedId) {
      payload.product_id = selectedId;
      await updateCommodityProduct({ username, language, payload });
    } else {
      await createCommodityProduct({ username, language, payload });
    }
    setDialogOpen(false);
    await loadData();
  }, [form.commodity_id, form.is_active, form.name_en, form.unit, isEdit, isSuperAdmin, orgCode, language, loadData, selectedId]);

  const handleDeactivate = useCallback(async (product_id: number) => {
    const username = currentUsername();
    if (!username) return;
    await deactivateCommodityProduct({
      username,
      language,
      product_id,
      org_code: !isSuperAdmin && orgCode ? orgCode : undefined,
    });
    await loadData();
  }, [language, loadData, orgCode, isSuperAdmin]);

  const columns = useMemo<GridColDef<ProductRow>[]>(
    () => [
      { field: "product_id", headerName: "ID", width: 90 },
      { field: "name", headerName: "Product", flex: 1 },
      { field: "commodity_name", headerName: "Commodity", width: 180 },
      { field: "unit", headerName: "Unit", width: 100 },
      {
        field: "is_active",
        headerName: "Active",
        width: 100,
        valueFormatter: (value) => (value ? "Y" : "N"),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 190,
        renderCell: (params) => {
          const row = params.row;
          const isOrgOwned = row.scope_type === "ORG" && row.org_code && orgCode && row.org_code === orgCode;
          const canEditRow = canEdit && (isSuperAdmin || isOrgOwned);
          const canDeactivateRow = canDeactivate && (isSuperAdmin || isOrgOwned);
          return (
            <Stack direction="row" spacing={1}>
              {canEditRow && (
                <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(row)}>
                  Edit
                </Button>
              )}
              {canDeactivateRow && (
                <Button
                  size="small"
                  color="error"
                  startIcon={<BlockIcon />}
                  onClick={() => handleDeactivate(row.product_id)}
                >
                  Deactivate
                </Button>
              )}
              {!canEditRow && canViewDetail && (
                <Button size="small" onClick={() => openEdit(row)}>
                  View
                </Button>
              )}
            </Stack>
          );
        },
      },
    ],
    [canEdit, canDeactivate, canViewDetail, isSuperAdmin, orgCode, openEdit, handleDeactivate],
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
              onClick={() => canViewDetail && openEdit(row)}
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
                    {row.name}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.75rem" }}>
                    Commodity
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                    {row.commodity_name}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.75rem" }}>
                    Organisation
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                    {resolveOrgLabel(row.org_code)}
                  </Typography>
                </Box>
                <Stack direction="row" justifyContent="flex-end" spacing={1}>
                  {(isSuperAdmin || (row.scope_type === "ORG" && row.org_code && orgCode === row.org_code)) && canEdit && (
                    <Button size="small" variant="text" onClick={() => openEdit(row)} sx={{ textTransform: "none" }}>
                      Edit
                    </Button>
                  )}
                  {(isSuperAdmin || (row.scope_type === "ORG" && row.org_code && orgCode === row.org_code)) &&
                    canDeactivate && (
                      <Button
                        size="small"
                        color="error"
                        variant="text"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeactivate(row.product_id);
                        }}
                        sx={{ textTransform: "none" }}
                      >
                        Deactivate
                      </Button>
                    )}
                  {!(canEdit && (isSuperAdmin || (row.scope_type === "ORG" && row.org_code && orgCode === row.org_code))) &&
                    canViewDetail && (
                      <Button size="small" variant="text" onClick={() => openEdit(row)} sx={{ textTransform: "none" }}>
                        View
                      </Button>
                    )}
                </Stack>
              </Stack>
            </Box>
          ))}
          {!rows.length && (
            <Typography variant="body2" color="text.secondary">
              No products found.
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
      <Box sx={{ height: 520 }}>
        <ResponsiveDataGrid
          columns={columns}
          rows={rows}
          loading={loading}
          getRowId={(r) => r.product_id}
          paginationMode="server"
          rowCount={rowCount}
          paginationModel={{ page, pageSize }}
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
    );
  }, [
    isSmallScreen,
    rows,
    theme.palette.divider,
    canViewDetail,
    canEdit,
    canDeactivate,
    handleDeactivate,
    page,
    pageSize,
    rowCount,
    columns,
    loading,
    openEdit,
    orgCode,
    isSuperAdmin,
    resolveOrgLabel,
  ]);

  return (
    <PageContainer>
      <Stack spacing={2} mb={2}>
        <Typography variant="h5">{t("menu.commodityProducts", { defaultValue: "Commodity Products" })}</Typography>
        <Stack
          direction={isSmallScreen ? "column" : "row"}
          spacing={2}
          alignItems={isSmallScreen ? "stretch" : "center"}
        >
          <TextField
            select
            label="Organisation"
            size="small"
            value={orgFilterCode}
            onChange={(e) => {
              setOrgFilterCode(e.target.value);
              setPage(0);
            }}
            sx={{ minWidth: isSmallScreen ? "100%" : 200 }}
            fullWidth={isSmallScreen}
          >
            <MenuItem value="ALL">All organisations</MenuItem>
            {Array.isArray((uiConfig as any)?.scope?.org_codes)
              ? (uiConfig as any).scope.org_codes.map((code: string) => (
                  <MenuItem key={code} value={code}>
                    {code}
                  </MenuItem>
                ))
              : orgCode
              ? [orgCode].map((code) => (
                  <MenuItem key={code} value={code}>
                    {code}
                  </MenuItem>
                ))
              : null}
          </TextField>

          <TextField
            select
            label="Commodity"
            size="small"
            value={filters.commodity_id}
            onChange={(e) => setFilters((f) => ({ ...f, commodity_id: e.target.value }))}
            sx={{ minWidth: isSmallScreen ? "100%" : 180 }}
            fullWidth={isSmallScreen}
          >
            <MenuItem value="">All</MenuItem>
            {commodities.map((c: any) => (
              <MenuItem key={c.commodity_id} value={c.commodity_id}>
                {c?.name_i18n?.en || c.slug || c.commodity_id}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Status"
            size="small"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value as any }))}
            sx={{ width: isSmallScreen ? "100%" : 160 }}
            fullWidth={isSmallScreen}
          >
            <MenuItem value="ALL">All</MenuItem>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="INACTIVE">Inactive</MenuItem>
          </TextField>
          {canCreate && (
            <Button
              variant="contained"
              size="small"
              startIcon={<AddIcon />}
              onClick={openCreate}
              fullWidth={isSmallScreen}
              sx={{ minWidth: isSmallScreen ? "100%" : 160 }}
            >
              {t("actions.create", { defaultValue: "Create" })}
            </Button>
          )}
        </Stack>
      </Stack>

      {listContent}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="md"
        fullScreen={fullScreenDialog}
      >
        <DialogTitle>{isEdit ? "Edit Product" : "Create Product"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {orgCode && !isSuperAdmin && (
              <TextField
                label="Organisation"
                value={orgCode}
                fullWidth
                disabled
              />
            )}
            <TextField
              select
              label="Commodity"
              value={form.commodity_id}
              onChange={(e) => setForm((f) => ({ ...f, commodity_id: e.target.value }))}
              fullWidth
              disabled={isEdit ? false : false}
            >
              {commodities.map((c: any) => (
                <MenuItem key={c.commodity_id} value={c.commodity_id}>
                  {c?.name_i18n?.en || c.slug || c.commodity_id}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Product Name (EN)"
              value={form.name_en}
              onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Unit"
              value={form.unit}
              onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
              fullWidth
            />
            <TextField
              select
              label="Active"
              value={form.is_active ? "Y" : "N"}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === "Y" }))}
              fullWidth
            >
              <MenuItem value="Y">Yes</MenuItem>
              <MenuItem value="N">No</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          {(isEdit ? canEdit : canCreate) && (
            <Button variant="contained" onClick={handleSave}>
              {isEdit ? "Update" : "Create"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
