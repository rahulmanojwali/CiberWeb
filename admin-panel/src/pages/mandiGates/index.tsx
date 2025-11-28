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
  fetchMandiGates,
  createMandiGate,
  updateMandiGate,
  deactivateMandiGate,
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

type GateRow = {
  id: string;
  mandi_id: number;
  gate_code: string;
  name: string;
  is_active: string;
};

const defaultForm = {
  mandi_id: "",
  gate_code: "",
  name_en: "",
  is_entry_only: "N",
  is_exit_only: "N",
  is_weighbridge: "N",
  allowed_vehicle_codes: "",
  is_active: "Y",
};

export const MandiGates: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const [rows, setRows] = useState<GateRow[]>([]);
  const [mandiOptions, setMandiOptions] = useState<any[]>([]);
  const [selectedMandi, setSelectedMandi] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState("ALL" as "ALL" | "Y" | "N");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState<string | null>(null);

  const canCreate = useMemo(() => can(uiConfig.resources, "mandi_gates.create", "CREATE"), [uiConfig.resources]);
  const canEdit = useMemo(() => can(uiConfig.resources, "mandi_gates.edit", "UPDATE"), [uiConfig.resources]);
  const canDeactivate = useMemo(() => can(uiConfig.resources, "mandi_gates.deactivate", "DEACTIVATE"), [uiConfig.resources]);

  const columns = useMemo<GridColDef<GateRow>[]>(
    () => [
      { field: "mandi_id", headerName: "Mandi ID", width: 110 },
      { field: "gate_code", headerName: "Gate Code", width: 140 },
      { field: "name", headerName: "Name", flex: 1 },
      { field: "is_active", headerName: "Active", width: 100 },
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
    if (!selectedMandi && mandis.length) setSelectedMandi(String(mandis[0].mandi_id));
  };

  const loadData = async () => {
    const username = currentUsername();
    if (!username || !selectedMandi) return;
    const resp = await fetchMandiGates({
      username,
      language,
      filters: {
        mandi_id: Number(selectedMandi),
        is_active: statusFilter === "ALL" ? undefined : statusFilter,
      },
    });
    const list = resp?.data?.items || [];
    setRows(
      list.map((g: any) => ({
        id: g._id,
        mandi_id: g.mandi_id,
        gate_code: g.gate_code,
        name: g?.name_i18n?.en || g.gate_code,
        is_active: g.is_active,
      })),
    );
  };

  useEffect(() => {
    loadMandis();
  }, []);

  useEffect(() => {
    loadData();
  }, [selectedMandi, statusFilter]);

  const openCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setForm({ ...defaultForm, mandi_id: selectedMandi });
    setDialogOpen(true);
  };

  const openEdit = (row: GateRow) => {
    setIsEdit(true);
    setEditId(row.id);
    setForm({
      mandi_id: String(row.mandi_id),
      gate_code: row.gate_code,
      name_en: row.name,
      is_entry_only: "N",
      is_exit_only: "N",
      is_weighbridge: "N",
      allowed_vehicle_codes: "",
      is_active: row.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username) return;
    const payload: any = {
      mandi_id: Number(form.mandi_id || selectedMandi),
      gate_code: form.gate_code,
      name_i18n: { en: form.name_en },
      is_entry_only: form.is_entry_only,
      is_exit_only: form.is_exit_only,
      is_weighbridge: form.is_weighbridge,
      allowed_vehicle_codes: form.allowed_vehicle_codes
        ? form.allowed_vehicle_codes.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      is_active: form.is_active,
    };
    if (isEdit && editId) {
      payload._id = editId;
      await updateMandiGate({ username, language, payload });
    } else {
      await createMandiGate({ username, language, payload });
    }
    setDialogOpen(false);
    await loadData();
  };

  const handleDeactivate = async (id: string) => {
    const username = currentUsername();
    if (!username) return;
    await deactivateMandiGate({ username, language, _id: id });
    await loadData();
  };

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Typography variant="h5">{t("menu.mandiGates", { defaultValue: "Mandi Gates" })}</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            select
            label="Mandi"
            size="small"
            value={selectedMandi}
            onChange={(e) => setSelectedMandi(e.target.value)}
            sx={{ minWidth: 200 }}
          >
            {mandiOptions.map((m: any) => (
              <MenuItem key={m.mandi_id} value={m.mandi_id}>
                {m?.name_i18n?.en || m.mandi_slug || m.mandi_id}
              </MenuItem>
            ))}
          </TextField>
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
        <DialogTitle>{isEdit ? "Edit Gate" : "Create Gate"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            select
            label="Mandi"
            value={form.mandi_id || selectedMandi}
            onChange={(e) => setForm((f) => ({ ...f, mandi_id: e.target.value }))}
            fullWidth
            disabled={isEdit}
          >
            {mandiOptions.map((m: any) => (
              <MenuItem key={m.mandi_id} value={m.mandi_id}>
                {m?.name_i18n?.en || m.mandi_slug || m.mandi_id}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Gate Code"
            value={form.gate_code}
            onChange={(e) => setForm((f) => ({ ...f, gate_code: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Gate Name (EN)"
            value={form.name_en}
            onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
            fullWidth
          />
          <TextField
            select
            label="Entry Only"
            value={form.is_entry_only}
            onChange={(e) => setForm((f) => ({ ...f, is_entry_only: e.target.value }))}
            fullWidth
          >
            <MenuItem value="Y">Yes</MenuItem>
            <MenuItem value="N">No</MenuItem>
          </TextField>
          <TextField
            select
            label="Exit Only"
            value={form.is_exit_only}
            onChange={(e) => setForm((f) => ({ ...f, is_exit_only: e.target.value }))}
            fullWidth
          >
            <MenuItem value="Y">Yes</MenuItem>
            <MenuItem value="N">No</MenuItem>
          </TextField>
          <TextField
            select
            label="Weighbridge"
            value={form.is_weighbridge}
            onChange={(e) => setForm((f) => ({ ...f, is_weighbridge: e.target.value }))}
            fullWidth
          >
            <MenuItem value="Y">Yes</MenuItem>
            <MenuItem value="N">No</MenuItem>
          </TextField>
          <TextField
            label="Allowed Vehicle Codes (comma)"
            value={form.allowed_vehicle_codes}
            onChange={(e) => setForm((f) => ({ ...f, allowed_vehicle_codes: e.target.value }))}
            fullWidth
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
