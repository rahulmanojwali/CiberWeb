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
  fetchMandiHoursMasters,
  createMandiHoursTemplate,
  updateMandiHoursTemplate,
  deactivateMandiHoursTemplate,
  fetchMandis,
} from "../../services/mandiApi";

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

type HoursRow = {
  id: string;
  mandi_id: number;
  timezone: string;
  is_active: string;
};

const defaultForm = {
  mandi_id: "",
  timezone: "Asia/Kolkata",
  open_days: "MON,TUE,WED,THU,FRI,SAT",
  day_hours_json: "",
  is_active: "Y",
};

export const MandiHoursTemplates: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const [rows, setRows] = useState<HoursRow[]>([]);
  const [mandiOptions, setMandiOptions] = useState<any[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL" as "ALL" | "Y" | "N");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState<string | null>(null);

  const canCreate = useMemo(() => can(uiConfig.resources, "mandi_hours.create", "CREATE"), [uiConfig.resources]);
  const canEdit = useMemo(() => can(uiConfig.resources, "mandi_hours.edit", "UPDATE"), [uiConfig.resources]);
  const canDeactivate = useMemo(() => can(uiConfig.resources, "mandi_hours.deactivate", "DEACTIVATE"), [uiConfig.resources]);

  const columns = useMemo<GridColDef<HoursRow>[]>(
    () => [
      { field: "mandi_id", headerName: "Mandi ID", width: 120 },
      { field: "timezone", headerName: "Timezone", flex: 1 },
      { field: "is_active", headerName: "Active", width: 110 },
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
                onClick={() => handleDeactivate(params.row.id)}
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

  const loadMandis = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchMandis({ username, language, filters: { is_active: true } });
    const mandis = resp?.data?.mandis || [];
    setMandiOptions(mandis);
  };

  const loadData = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchMandiHoursMasters({
      username,
      language,
      filters: { is_active: statusFilter === "ALL" ? undefined : statusFilter },
    });
    const list = resp?.data?.items || [];
    setRows(
      list.map((h: any) => ({
        id: h._id,
        mandi_id: h.mandi_id,
        timezone: h.timezone,
        is_active: h.is_active,
      })),
    );
  };

  useEffect(() => {
    loadMandis();
    loadData();
  }, []);

  useEffect(() => {
    loadData();
  }, [statusFilter]);

  const openCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (row: HoursRow) => {
    setIsEdit(true);
    setEditId(row.id);
    setForm({
      mandi_id: String(row.mandi_id),
      timezone: row.timezone,
      open_days: defaultForm.open_days,
      day_hours_json: "",
      is_active: row.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username) return;
    let day_hours: any = [];
    try {
      day_hours = form.day_hours_json ? JSON.parse(form.day_hours_json) : [];
    } catch {
      // leave empty
    }
    const payload: any = {
      mandi_id: Number(form.mandi_id),
      timezone: form.timezone,
      country: "IN",
      state_code: null,
      district_id: null,
      open_days: form.open_days.split(",").map((s) => s.trim()).filter(Boolean),
      day_hours,
      is_active: form.is_active,
    };
    if (isEdit && editId) {
      payload._id = editId;
      await updateMandiHoursTemplate({ username, language, payload });
    } else {
      await createMandiHoursTemplate({ username, language, payload });
    }
    setDialogOpen(false);
    await loadData();
  };

  const handleDeactivate = async (id: string) => {
    const username = currentUsername();
    if (!username) return;
    await deactivateMandiHoursTemplate({ username, language, _id: id });
    await loadData();
  };

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Typography variant="h5">{t("menu.mandiHoursTemplates", { defaultValue: "Mandi Hours Templates" })}</Typography>
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
            <MenuItem value="Y">Active</MenuItem>
            <MenuItem value="N">Inactive</MenuItem>
          </TextField>
          {canCreate && (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate}>
              {t("actions.create", { defaultValue: "Create" })}
            </Button>
          )}
        </Stack>
      </Stack>

      <Box sx={{ height: 520 }}>
        <ResponsiveDataGrid columns={columns} rows={rows} loading={false} getRowId={(r) => r.id} />
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{isEdit ? "Edit Hours Template" : "Create Hours Template"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            select
            label="Mandi"
            value={form.mandi_id}
            onChange={(e) => setForm((f) => ({ ...f, mandi_id: e.target.value }))}
            fullWidth
          >
            {mandiOptions.map((m: any) => (
              <MenuItem key={m.mandi_id} value={m.mandi_id}>
                {m?.name_i18n?.en || m.mandi_slug || m.mandi_id}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Timezone"
            value={form.timezone}
            onChange={(e) => setForm((f) => ({ ...f, timezone: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Open Days (CSV)"
            value={form.open_days}
            onChange={(e) => setForm((f) => ({ ...f, open_days: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Day Hours JSON"
            value={form.day_hours_json}
            onChange={(e) => setForm((f) => ({ ...f, day_hours_json: e.target.value }))}
            fullWidth
            multiline
            minRows={3}
            placeholder='e.g. [{"day":"MON","windows":[{"open_time":"09:00","close_time":"18:00"}]}]'
          />
          <TextField
            select
            label="Active"
            value={form.is_active}
            onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value }))}
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
