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
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import CheckIcon from "@mui/icons-material/CheckCircleOutline";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useCrudPermissions } from "../../utils/useCrudPermissions";
import {
  createMandiCommodityProduct,
  deactivateMandiCommodityProduct,
  fetchMandiCommodityProducts,
  updateMandiCommodityProduct,
} from "../../services/mandiApi";

type MandiOption = {
  mandi_id: number;
  label?: string;
  name_i18n?: Record<string, string>;
  mandi_slug?: string;
};

type CommodityOption = {
  commodity_id: number;
  name_i18n?: Record<string, string>;
  label?: string;
};

type ProductOption = {
  product_id: number;
  commodity_id?: number;
  name_i18n?: Record<string, string>;
  label?: string;
};

type MappingRow = {
  id: string;
  mandi_id: number;
  commodity_id: number;
  product_id: number;
  trade_type: "PROCUREMENT" | "SALES" | "BOTH";
  is_active: "Y" | "N";
  mandi_label?: string | null;
  commodity_label?: string | null;
  product_label?: string | null;
  notes?: string | null;
  sort_order?: number | null;
};

type FormState = {
  mandi_id: number | "";
  commodity_id: number | "";
  product_id: number | "";
  trade_type: "PROCUREMENT" | "SALES" | "BOTH";
  notes: string;
  sort_order: string;
};

const defaultForm: FormState = {
  mandi_id: "",
  commodity_id: "",
  product_id: "",
  trade_type: "BOTH",
  notes: "",
  sort_order: "",
};

const tradeTypeOptions = [
  { value: "ALL", label: "All" },
  { value: "PROCUREMENT", label: "Procurement" },
  { value: "SALES", label: "Sales" },
  { value: "BOTH", label: "Both" },
] as const;

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

  const { canCreate, canEdit, canDeactivate } =
    useCrudPermissions("mandi_commodity_products_masters");

  const [rows, setRows] = useState<MappingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [mandis, setMandis] = useState<MandiOption[]>([]);
  const [commodities, setCommodities] = useState<CommodityOption[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  const [filters, setFilters] = useState<{
    mandi_id: number | "ALL";
    commodity_id: number | "ALL";
    product_id: number | "ALL";
    trade_type: "ALL" | "PROCUREMENT" | "SALES" | "BOTH";
    status: "ALL" | "Y" | "N";
  }>({
    mandi_id: "ALL",
    commodity_id: "ALL",
    product_id: "ALL",
    trade_type: "ALL",
    status: "ALL",
  });

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [activeRow, setActiveRow] = useState<MappingRow | null>(null);
  const [form, setForm] = useState<FormState>(defaultForm);

  const mandiLookup = useMemo(() => {
    const map = new Map<number, string>();
    mandis.forEach((m) => {
      const label = m.label || m.name_i18n?.en || m.mandi_slug || String(m.mandi_id);
      map.set(m.mandi_id, label);
    });
    return map;
  }, [mandis]);

  const commodityLookup = useMemo(() => {
    const map = new Map<number, string>();
    commodities.forEach((c) => {
      const label = c.label || c.name_i18n?.en || String(c.commodity_id);
      map.set(c.commodity_id, label);
    });
    return map;
  }, [commodities]);

  const productLookup = useMemo(() => {
    const map = new Map<number, string>();
    products.forEach((p) => {
      const label = p.label || p.name_i18n?.en || String(p.product_id);
      map.set(p.product_id, label);
    });
    return map;
  }, [products]);

  const loadMappings = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
      const payload: Record<string, any> = {
        page,
        pageSize,
      };
      if (filters.mandi_id !== "ALL") payload.mandi_id = filters.mandi_id;
      if (filters.commodity_id !== "ALL") payload.commodity_id = filters.commodity_id;
      if (filters.product_id !== "ALL") payload.product_id = filters.product_id;
      if (filters.trade_type !== "ALL") payload.trade_type = filters.trade_type;
      if (filters.status !== "ALL") payload.is_active = filters.status;

      const resp = await fetchMandiCommodityProducts({
        username,
        language,
        filters: payload,
      });
      const root = resp?.data ?? resp?.response ?? resp ?? {};
      const data = root?.data ?? root;
      const items = data?.items || data?.mappings || data?.mandi_products || [];
      const meta = data?.meta || {};
      const responseFilters = data?.filters || {};

      setRows(
        items.map((item: any, index: number) => ({
          id: String(item?._id || item?.id || `${item?.mandi_id}-${item?.product_id}-${index}`),
          mandi_id: Number(item?.mandi_id || 0),
          commodity_id: Number(item?.commodity_id || 0),
          product_id: Number(item?.product_id || 0),
          trade_type: item?.trade_type || "BOTH",
          is_active: item?.is_active || "Y",
          mandi_label: item?.mandi_label || item?.mandi_name || null,
          commodity_label: item?.commodity_label || item?.commodity_name || null,
          product_label: item?.product_label || item?.product_name || null,
          notes: item?.notes || null,
          sort_order: item?.sort_order ?? null,
        })),
      );
      setTotalCount(Number(meta.totalCount || items.length || 0));
      if (Array.isArray(responseFilters?.mandis)) setMandis(responseFilters.mandis);
      if (Array.isArray(responseFilters?.commodities)) setCommodities(responseFilters.commodities);
      if (Array.isArray(responseFilters?.products)) setProducts(responseFilters.products);
    } finally {
      setLoading(false);
    }
  }, [filters, language, page, pageSize]);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  useEffect(() => {
    setPage(1);
  }, [filters.mandi_id, filters.commodity_id, filters.product_id, filters.trade_type, filters.status]);

  const openCreate = useCallback(() => {
    setForm(defaultForm);
    setCreateOpen(true);
  }, []);

  const closeCreate = useCallback(() => {
    setCreateOpen(false);
  }, []);

  const openEdit = useCallback((row: MappingRow) => {
    setActiveRow(row);
    setForm({
      mandi_id: row.mandi_id,
      commodity_id: row.commodity_id,
      product_id: row.product_id,
      trade_type: row.trade_type,
      notes: row.notes || "",
      sort_order: row.sort_order !== null && row.sort_order !== undefined ? String(row.sort_order) : "",
    });
    setEditOpen(true);
  }, []);

  const closeEdit = useCallback(() => {
    setEditOpen(false);
    setActiveRow(null);
  }, []);

  const handleCreate = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    await createMandiCommodityProduct({
      username,
      language,
      payload: {
        mandi_id: Number(form.mandi_id),
        commodity_id: Number(form.commodity_id),
        product_id: Number(form.product_id),
        trade_type: form.trade_type,
        notes: form.notes || undefined,
        sort_order: form.sort_order ? Number(form.sort_order) : undefined,
      },
    });
    setCreateOpen(false);
    loadMappings();
  }, [form, language, loadMappings]);

  const handleEdit = useCallback(async () => {
    if (!activeRow) return;
    const username = currentUsername();
    if (!username) return;
    await updateMandiCommodityProduct({
      username,
      language,
      payload: {
        id: activeRow.id,
        trade_type: form.trade_type,
        notes: form.notes || undefined,
        sort_order: form.sort_order ? Number(form.sort_order) : undefined,
      },
    });
    closeEdit();
    loadMappings();
  }, [activeRow, closeEdit, form, language, loadMappings]);

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
        field: "mandi_id",
        headerName: "Mandi",
        flex: 1,
        minWidth: 160,
        valueGetter: (_, row) =>
          row.mandi_label || mandiLookup.get(row.mandi_id) || String(row.mandi_id),
      },
      {
        field: "commodity_id",
        headerName: "Commodity",
        flex: 1,
        minWidth: 160,
        valueGetter: (_, row) =>
          row.commodity_label || commodityLookup.get(row.commodity_id) || String(row.commodity_id),
      },
      {
        field: "product_id",
        headerName: "Product",
        flex: 1,
        minWidth: 180,
        valueGetter: (_, row) =>
          row.product_label || productLookup.get(row.product_id) || String(row.product_id),
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
        minWidth: 130,
        sortable: false,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            {canEdit && (
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => openEdit(params.row)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canDeactivate && (
              <Tooltip title={params.row.is_active === "Y" ? "Deactivate" : "Activate"}>
                <IconButton size="small" onClick={() => handleToggle(params.row)}>
                  {params.row.is_active === "Y" ? (
                    <BlockIcon fontSize="small" />
                  ) : (
                    <CheckIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        ),
      },
    ],
    [canDeactivate, canEdit, commodityLookup, handleToggle, mandiLookup, openEdit, productLookup],
  );

  const isCreateDisabled =
    !form.mandi_id || !form.commodity_id || !form.product_id || !form.trade_type;

  return (
    <PageContainer
      title="Mandi Commodity Products"
      subtitle="Manage mandi-level commodity product mappings"
    >
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
              value={filters.mandi_id}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  mandi_id: event.target.value === "ALL" ? "ALL" : Number(event.target.value),
                }))
              }
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="ALL">All Mandis</MenuItem>
              {mandis.map((mandi) => (
                <MenuItem key={mandi.mandi_id} value={mandi.mandi_id}>
                  {mandi.label || mandi.name_i18n?.en || mandi.mandi_slug || mandi.mandi_id}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Commodity"
              size="small"
              select
              value={filters.commodity_id}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  commodity_id:
                    event.target.value === "ALL" ? "ALL" : Number(event.target.value),
                }))
              }
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="ALL">All Commodities</MenuItem>
              {commodities.map((commodity) => (
                <MenuItem key={commodity.commodity_id} value={commodity.commodity_id}>
                  {commodity.label || commodity.name_i18n?.en || commodity.commodity_id}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Product"
              size="small"
              select
              value={filters.product_id}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  product_id: event.target.value === "ALL" ? "ALL" : Number(event.target.value),
                }))
              }
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="ALL">All Products</MenuItem>
              {products.map((product) => (
                <MenuItem key={product.product_id} value={product.product_id}>
                  {product.label || product.name_i18n?.en || product.product_id}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Trade Type"
              size="small"
              select
              value={filters.trade_type}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  trade_type: event.target.value as FormState["trade_type"] | "ALL",
                }))
              }
              sx={{ minWidth: 160 }}
            >
              {tradeTypeOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Status"
              size="small"
              select
              value={filters.status}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  status: event.target.value as "ALL" | "Y" | "N",
                }))
              }
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
                startIcon={<AddIcon />}
                onClick={openCreate}
                sx={{ alignSelf: isSmallScreen ? "stretch" : "center" }}
              >
                Add Mapping
              </Button>
            )}
          </Stack>

          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <ResponsiveDataGrid
              rows={rows}
              columns={columns}
              loading={loading}
              pageSizeOptions={[10, 25, 50, 100]}
              paginationMode="server"
              rowCount={totalCount}
              paginationModel={{ page: page - 1, pageSize }}
              onPaginationModelChange={(model) => {
                setPage(model.page + 1);
                setPageSize(model.pageSize);
              }}
              autoHeight
              disableRowSelectionOnClick
            />
          </Box>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onClose={closeCreate} fullWidth maxWidth="sm">
        <DialogTitle>Create Mandi Commodity Product</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Mandi"
              value={form.mandi_id}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, mandi_id: Number(event.target.value) }))
              }
              select
              fullWidth
            >
              {mandis.map((mandi) => (
                <MenuItem key={mandi.mandi_id} value={mandi.mandi_id}>
                  {mandi.label || mandi.name_i18n?.en || mandi.mandi_slug || mandi.mandi_id}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Commodity"
              value={form.commodity_id}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, commodity_id: Number(event.target.value) }))
              }
              select
              fullWidth
            >
              {commodities.map((commodity) => (
                <MenuItem key={commodity.commodity_id} value={commodity.commodity_id}>
                  {commodity.label || commodity.name_i18n?.en || commodity.commodity_id}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Product"
              value={form.product_id}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, product_id: Number(event.target.value) }))
              }
              select
              fullWidth
            >
              {products.map((product) => (
                <MenuItem key={product.product_id} value={product.product_id}>
                  {product.label || product.name_i18n?.en || product.product_id}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Trade type"
              value={form.trade_type}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, trade_type: event.target.value as FormState["trade_type"] }))
              }
              select
              fullWidth
            >
              {tradeTypeOptions
                .filter((option) => option.value !== "ALL")
                .map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              label="Notes"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Sort order"
              value={form.sort_order}
              onChange={(event) => setForm((prev) => ({ ...prev, sort_order: event.target.value }))}
              fullWidth
            />
            <Typography sx={{ color: "text.secondary", fontSize: 12 }}>
              Mapping is created for the selected mandi, commodity, and product.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeCreate}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={isCreateDisabled}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={closeEdit} fullWidth maxWidth="sm">
        <DialogTitle>Edit Mapping</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Trade type"
              value={form.trade_type}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, trade_type: event.target.value as FormState["trade_type"] }))
              }
              select
              fullWidth
            >
              {tradeTypeOptions
                .filter((option) => option.value !== "ALL")
                .map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              label="Notes"
              value={form.notes}
              onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Sort order"
              value={form.sort_order}
              onChange={(event) => setForm((prev) => ({ ...prev, sort_order: event.target.value }))}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit}>Cancel</Button>
          <Button variant="contained" onClick={handleEdit} disabled={!activeRow}>
            Update
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
