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
import { fetchMandis, createMandi, updateMandi, deactivateMandi } from "../../services/mandiApi";

type MandiRow = {
  mandi_id: number;
  name: string;
  state_code: string;
  district_name_en: string;
  pincode: string;
  is_active: boolean;
};

const defaultForm = {
  mandi_id: "" as string | number,
  name_en: "",
  state_code: "",
  district_name_en: "",
  address_line: "",
  pincode: "",
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

export const Mandis: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const [rows, setRows] = useState<MandiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [filters, setFilters] = useState({ state_code: "", district: "", status: "ALL" as "ALL" | "ACTIVE" | "INACTIVE" });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const canCreate = useMemo(() => can(uiConfig.resources, "mandis.create", "CREATE"), [uiConfig.resources]);
  const canEdit = useMemo(() => can(uiConfig.resources, "mandis.edit", "UPDATE"), [uiConfig.resources]);
  const canDeactivate = useMemo(() => can(uiConfig.resources, "mandis.deactivate", "DEACTIVATE"), [uiConfig.resources]);

  const columns = useMemo<GridColDef<MandiRow>[]>(
    () => [
      { field: "mandi_id", headerName: "ID", width: 90 },
      { field: "name", headerName: "Name", flex: 1 },
      { field: "state_code", headerName: "State", width: 100 },
      { field: "district_name_en", headerName: "District", flex: 1 },
      { field: "pincode", headerName: "Pincode", width: 110 },
      {
        field: "is_active",
        headerName: "Active",
        width: 110,
        valueFormatter: (value) => (value ? "Y" : "N"),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 140,
        sortable: false,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            {canEdit && (
              <Button
                size="small"
                startIcon={<EditIcon />}
                onClick={() => openEdit(params.row)}
              >
                Edit
              </Button>
            )}
            {canDeactivate && (
              <Button
                size="small"
                color="error"
                startIcon={<BlockIcon />}
                onClick={() => handleDeactivate(params.row.mandi_id)}
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
      const resp = await fetchMandis({
        username,
        language,
        filters: {
          state_code: filters.state_code || undefined,
          district_name_en: filters.district || undefined,
          is_active: filters.status === "ALL" ? undefined : filters.status === "ACTIVE",
        },
      });
      const list = resp?.data?.mandis || [];
      setRows(
        list.map((m: any) => ({
          mandi_id: m.mandi_id,
          name: m?.name_i18n?.en || m.mandi_slug || String(m.mandi_id),
          state_code: m.state_code || "",
          district_name_en: m.district_name_en || "",
          pincode: m.pincode || "",
          is_active: Boolean(m.is_active),
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [language, filters.state_code, filters.district, filters.status]);

  const openCreate = () => {
    setIsEdit(false);
    setForm(defaultForm);
    setSelectedId(null);
    setDialogOpen(true);
  };

  const openEdit = (row: MandiRow) => {
    setIsEdit(true);
    setSelectedId(row.mandi_id);
    setForm({
      mandi_id: row.mandi_id,
      name_en: row.name,
      state_code: row.state_code,
      district_name_en: row.district_name_en,
      address_line: "",
      pincode: row.pincode,
      is_active: row.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username) return;
    const payload: any = {
      name_i18n: { en: form.name_en },
      state_code: form.state_code,
      district_name_en: form.district_name_en,
      address_line: form.address_line,
      pincode: form.pincode,
      is_active: form.is_active,
    };
    if (isEdit && selectedId) {
      payload.mandi_id = selectedId;
      await updateMandi({ username, language, payload });
    } else {
      await createMandi({ username, language, payload });
    }
    setDialogOpen(false);
    await loadData();
  };

  const handleDeactivate = async (mandi_id: number) => {
    const username = currentUsername();
    if (!username) return;
    await deactivateMandi({ username, language, mandi_id });
    await loadData();
  };

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Typography variant="h5">{t("menu.mandis", { defaultValue: "Mandis" })}</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            label="State"
            size="small"
            value={filters.state_code}
            onChange={(e) => setFilters((f) => ({ ...f, state_code: e.target.value }))}
          />
          <TextField
            label="District"
            size="small"
            value={filters.district}
            onChange={(e) => setFilters((f) => ({ ...f, district: e.target.value }))}
          />
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

      <Box sx={{ height: 580 }}>
        <ResponsiveDataGrid
          columns={columns}
          rows={rows}
          loading={loading}
          getRowId={(r) => r.mandi_id}
        />
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{isEdit ? "Edit Mandi" : "Create Mandi"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Name (EN)"
            value={form.name_en}
            onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
            fullWidth
          />
          <TextField
            label="State Code"
            value={form.state_code}
            onChange={(e) => setForm((f) => ({ ...f, state_code: e.target.value }))}
            fullWidth
          />
          <TextField
            label="District"
            value={form.district_name_en}
            onChange={(e) => setForm((f) => ({ ...f, district_name_en: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Address"
            value={form.address_line}
            onChange={(e) => setForm((f) => ({ ...f, address_line: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Pincode"
            value={form.pincode}
            onChange={(e) => setForm((f) => ({ ...f, pincode: e.target.value }))}
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
