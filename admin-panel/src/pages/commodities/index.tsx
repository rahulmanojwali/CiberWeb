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
  fetchCommodities,
  createCommodity,
  updateCommodity,
  deactivateCommodity,
} from "../../services/mandiApi";

type CommodityRow = {
  commodity_id: number;
  name: string;
  is_active: boolean;
};

const defaultForm = {
  name_en: "",
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

export const Commodities: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const [rows, setRows] = useState<CommodityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL" as "ALL" | "ACTIVE" | "INACTIVE");

  const canCreate = useMemo(() => can(uiConfig.resources, "commodities.create", "CREATE"), [uiConfig.resources]);
  const canEdit = useMemo(() => can(uiConfig.resources, "commodities.edit", "UPDATE"), [uiConfig.resources]);
  const canDeactivate = useMemo(
    () => can(uiConfig.resources, "commodities.deactivate", "DEACTIVATE"),
    [uiConfig.resources],
  );

  const columns = useMemo<GridColDef<CommodityRow>[]>(
    () => [
      { field: "commodity_id", headerName: "ID", width: 100 },
      { field: "name", headerName: "Name", flex: 1 },
      {
        field: "is_active",
        headerName: "Active",
        width: 110,
        valueFormatter: (value) => (value ? "Y" : "N"),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 160,
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
                onClick={() => handleDeactivate(params.row.commodity_id)}
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

  const loadData = async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp = await fetchCommodities({
        username,
        language,
        filters: { is_active: statusFilter === "ALL" ? undefined : statusFilter === "ACTIVE" },
      });
      const list = resp?.data?.commodities || [];
      setRows(
        list.map((c: any) => ({
          commodity_id: c.commodity_id,
          name: c?.name_i18n?.en || c.slug || String(c.commodity_id),
          is_active: Boolean(c.is_active),
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [language, statusFilter]);

  const openCreate = () => {
    setIsEdit(false);
    setSelectedId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (row: CommodityRow) => {
    setIsEdit(true);
    setSelectedId(row.commodity_id);
    setForm({ name_en: row.name, is_active: row.is_active });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username) return;
    const payload: any = { name_i18n: { en: form.name_en }, is_active: form.is_active };
    if (isEdit && selectedId) {
      payload.commodity_id = selectedId;
      await updateCommodity({ username, language, payload });
    } else {
      await createCommodity({ username, language, payload });
    }
    setDialogOpen(false);
    await loadData();
  };

  const handleDeactivate = async (commodity_id: number) => {
    const username = currentUsername();
    if (!username) return;
    await deactivateCommodity({ username, language, commodity_id });
    await loadData();
  };

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Typography variant="h5">{t("menu.commodities", { defaultValue: "Commodities" })}</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            select
            label="Status"
            size="small"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
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
        <ResponsiveDataGrid columns={columns} rows={rows} loading={loading} getRowId={(r) => r.commodity_id} />
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{isEdit ? "Edit Commodity" : "Create Commodity"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Name (EN)"
            value={form.name_en}
            onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
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
