import React, { useEffect, useMemo, useState } from "react";
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
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
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
  const uiConfig = useAdminUiConfig();

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [commodities, setCommodities] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [filters, setFilters] = useState({ commodity_id: "", status: "ALL" as "ALL" | "ACTIVE" | "INACTIVE" });

  const canCreate = useMemo(() => can(uiConfig.resources, "commodity_products.create", "CREATE"), [uiConfig.resources]);
  const canEdit = useMemo(() => can(uiConfig.resources, "commodity_products.edit", "UPDATE"), [uiConfig.resources]);
  const canDeactivate = useMemo(
    () => can(uiConfig.resources, "commodity_products.deactivate", "DEACTIVATE"),
    [uiConfig.resources],
  );

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
        width: 170,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            {canEdit && (
              <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(params.row)}>
                Edit
              </Button>
            )}
            {canDeactivate && (
              <Button
                size="small"
                color="error"
                startIcon={<BlockIcon />}
                onClick={() => handleDeactivate(params.row.product_id)}
              >
                Deactivate
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [canEdit, canDeactivate],
  );

  const loadCommodities = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchCommodities({ username, language });
    const list = resp?.data?.commodities || [];
    setCommodities(list);
  };

  const loadData = async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp = await fetchCommodityProducts({
        username,
        language,
        filters: {
          commodity_id: filters.commodity_id || undefined,
          is_active: filters.status === "ALL" ? undefined : filters.status === "ACTIVE",
        },
      });
      const list = resp?.data?.products || [];
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
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommodities();
  }, []);

  useEffect(() => {
    if (commodities.length) {
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commodities, language, filters.commodity_id, filters.status]);

  const openCreate = () => {
    setIsEdit(false);
    setSelectedId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (row: ProductRow) => {
    setIsEdit(true);
    setSelectedId(row.product_id);
    setForm({
      commodity_id: String(row.commodity_id),
      name_en: row.name,
      unit: row.unit || "",
      is_active: row.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username) return;
    const payload: any = {
      commodity_id: Number(form.commodity_id),
      name_i18n: { en: form.name_en },
      unit: form.unit || null,
      is_active: form.is_active,
    };
    if (isEdit && selectedId) {
      payload.product_id = selectedId;
      await updateCommodityProduct({ username, language, payload });
    } else {
      await createCommodityProduct({ username, language, payload });
    }
    setDialogOpen(false);
    await loadData();
  };

  const handleDeactivate = async (product_id: number) => {
    const username = currentUsername();
    if (!username) return;
    await deactivateCommodityProduct({ username, language, product_id });
    await loadData();
  };

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Typography variant="h5">{t("menu.commodityProducts", { defaultValue: "Commodity Products" })}</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            select
            label="Commodity"
            size="small"
            value={filters.commodity_id}
            onChange={(e) => setFilters((f) => ({ ...f, commodity_id: e.target.value }))}
            sx={{ minWidth: 180 }}
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
            sx={{ width: 140 }}
          >
            <MenuItem value="ALL">All</MenuItem>
            <MenuItem value="ACTIVE">Active</MenuItem>
            <MenuItem value="INACTIVE">Inactive</MenuItem>
          </TextField>
          {canCreate && (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
              {t("actions.create", { defaultValue: "Create" })}
            </Button>
          )}
        </Stack>
      </Stack>

      <Box sx={{ height: 520 }}>
        <ResponsiveDataGrid columns={columns} rows={rows} loading={loading} getRowId={(r) => r.product_id} />
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{isEdit ? "Edit Product" : "Create Product"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            select
            label="Commodity"
            value={form.commodity_id}
            onChange={(e) => setForm((f) => ({ ...f, commodity_id: e.target.value }))}
            fullWidth
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            {isEdit ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
