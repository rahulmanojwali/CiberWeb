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
import { fetchGateDevices, createGateDevice, updateGateDevice, deactivateGateDevice } from "../../services/gateApi";
import { fetchMandis, fetchMandiGates } from "../../services/mandiApi";
import { fetchOrganisations } from "../../services/adminUsersApi";

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

type DeviceRow = {
  device_code: string;
  device_type: string;
  mandi_id: number;
  gate_code: string;
  is_primary: string;
  is_active: string;
  org_id?: string;
};

const defaultForm = {
  org_id: "",
  mandi_id: "",
  gate_code: "",
  device_code: "",
  device_type: "",
  capability_set: [] as string[],
  is_primary: "N",
  is_active: "Y",
};

export const GateDevices: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [status, setStatus] = useState("ALL" as "ALL" | "Y" | "N");
  const [filters, setFilters] = useState({ org_id: "", mandi_id: "", gate_code: "", device_type: "" });
  const [orgOptions, setOrgOptions] = useState<any[]>([]);
  const [mandiOptions, setMandiOptions] = useState<any[]>([]);
  const [gateOptions, setGateOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const canCreate = useMemo(() => can(uiConfig.resources, "cm_gate_devices.create", "CREATE"), [uiConfig.resources]);
  const canEdit = useMemo(() => can(uiConfig.resources, "cm_gate_devices.edit", "UPDATE"), [uiConfig.resources]);
  const canDeactivate = useMemo(
    () => can(uiConfig.resources, "cm_gate_devices.deactivate", "DEACTIVATE"),
    [uiConfig.resources],
  );

  const columns = useMemo<GridColDef<DeviceRow>[]>(
    () => [
      { field: "device_code", headerName: "Device Code", width: 180 },
      { field: "device_type", headerName: "Type", width: 160 },
      { field: "mandi_id", headerName: "Mandi", width: 110 },
      { field: "gate_code", headerName: "Gate", width: 130 },
      { field: "is_primary", headerName: "Primary", width: 110 },
      { field: "is_active", headerName: "Active", width: 110 },
      {
        field: "actions",
        headerName: "Actions",
        width: 200,
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
                onClick={() => handleDeactivate(params.row.device_code)}
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

  const loadOrgs = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchOrganisations({ username, language });
    const orgs = resp?.response?.data?.organisations || resp?.data?.organisations || [];
    setOrgOptions(orgs);
  };

  const loadMandis = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchMandis({ username, language, filters: { is_active: true } });
    setMandiOptions(resp?.data?.mandis || []);
  };

  const loadGates = async (mandiId?: string | number) => {
    const username = currentUsername();
    if (!username || !mandiId) return;
    const resp = await fetchMandiGates({ username, language, filters: { mandi_id: Number(mandiId), is_active: "Y" } });
    setGateOptions(resp?.data?.items || []);
  };

  const loadData = async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp = await fetchGateDevices({
        username,
        language,
        filters: {
          org_id: filters.org_id || undefined,
          mandi_id: filters.mandi_id || undefined,
          gate_code: filters.gate_code || undefined,
          device_type: filters.device_type || undefined,
          is_active: status === "ALL" ? undefined : status,
        },
      });
      const list = resp?.data?.devices || resp?.response?.data?.devices || [];
      setRows(
        list.map((d: any) => ({
          device_code: d.device_code,
          device_type: d.device_type,
          mandi_id: d.mandi_id,
          gate_code: d.gate_code,
          is_primary: d.is_primary,
          is_active: d.is_active,
          org_id: d.org_id,
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgs();
    loadMandis();
  }, []);

  useEffect(() => {
    loadData();
  }, [status, filters.org_id, filters.mandi_id, filters.gate_code, filters.device_type, language]);

  const openCreate = () => {
    setIsEdit(false);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (row: DeviceRow) => {
    setIsEdit(true);
    setForm({
      org_id: row.org_id || "",
      mandi_id: String(row.mandi_id),
      gate_code: row.gate_code,
      device_code: row.device_code,
      device_type: row.device_type,
      capability_set: [],
      is_primary: row.is_primary,
      is_active: row.is_active,
    });
    loadGates(row.mandi_id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username) return;
    const payload: any = {
      org_id: form.org_id || undefined,
      mandi_id: Number(form.mandi_id),
      gate_code: form.gate_code,
      device_code: form.device_code,
      device_type: form.device_type,
      capability_set: form.capability_set,
      is_primary: form.is_primary,
      is_active: form.is_active,
    };
    if (isEdit) {
      await updateGateDevice({ username, language, payload });
    } else {
      await createGateDevice({ username, language, payload });
    }
    setDialogOpen(false);
    await loadData();
  };

  const handleDeactivate = async (device_code: string) => {
    const username = currentUsername();
    if (!username) return;
    await deactivateGateDevice({ username, language, device_code });
    await loadData();
  };

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Typography variant="h5">{t("menu.gateDevices", { defaultValue: "Gate Devices" })}</Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField
            select
            label="Organisation"
            size="small"
            value={filters.org_id}
            onChange={(e) => setFilters((f) => ({ ...f, org_id: e.target.value }))}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All</MenuItem>
            {orgOptions.map((o) => (
              <MenuItem key={o._id} value={o._id}>
                {o.org_code}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Mandi"
            size="small"
            value={filters.mandi_id}
            onChange={(e) => {
              setFilters((f) => ({ ...f, mandi_id: e.target.value, gate_code: "" }));
              loadGates(e.target.value);
            }}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">All</MenuItem>
            {mandiOptions.map((m: any) => (
              <MenuItem key={m.mandi_id} value={m.mandi_id}>
                {m?.name_i18n?.en || m.mandi_slug || m.mandi_id}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Gate"
            size="small"
            value={filters.gate_code}
            onChange={(e) => setFilters((f) => ({ ...f, gate_code: e.target.value }))}
            sx={{ minWidth: 160 }}
          >
            <MenuItem value="">All</MenuItem>
            {gateOptions.map((g: any) => (
              <MenuItem key={g.gate_code || g.gate_id || g._id} value={g.gate_code}>
                {g.gate_code}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Device Type"
            size="small"
            value={filters.device_type}
            onChange={(e) => setFilters((f) => ({ ...f, device_type: e.target.value }))}
            sx={{ minWidth: 140 }}
          />
          <TextField
            select
            label="Status"
            size="small"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
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
        <ResponsiveDataGrid columns={columns} rows={rows} loading={loading} getRowId={(r) => r.device_code} />
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{isEdit ? "Edit Device" : "Create Device"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Device Code"
            value={form.device_code}
            onChange={(e) => setForm((f) => ({ ...f, device_code: e.target.value }))}
            fullWidth
            disabled={isEdit}
          />
          <TextField
            label="Device Type"
            value={form.device_type}
            onChange={(e) => setForm((f) => ({ ...f, device_type: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Capabilities (comma)"
            value={form.capability_set.join(",")}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                capability_set: e.target.value
                  .split(",")
                  .map((s) => s.trim())
                  .filter(Boolean),
              }))
            }
            fullWidth
          />
          <TextField
            select
            label="Organisation"
            value={form.org_id}
            onChange={(e) => setForm((f) => ({ ...f, org_id: e.target.value }))}
            fullWidth
          >
            <MenuItem value="">Not Set</MenuItem>
            {orgOptions.map((o) => (
              <MenuItem key={o._id} value={o._id}>
                {o.org_code}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Mandi"
            value={form.mandi_id}
            onChange={(e) => {
              setForm((f) => ({ ...f, mandi_id: e.target.value, gate_code: "" }));
              loadGates(e.target.value);
            }}
            fullWidth
          >
            {mandiOptions.map((m: any) => (
              <MenuItem key={m.mandi_id} value={m.mandi_id}>
                {m?.name_i18n?.en || m.mandi_slug || m.mandi_id}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Gate"
            value={form.gate_code}
            onChange={(e) => setForm((f) => ({ ...f, gate_code: e.target.value }))}
            fullWidth
          >
            {gateOptions.map((g: any) => (
              <MenuItem key={g.gate_code || g.gate_id || g._id} value={g.gate_code}>
                {g.gate_code}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Primary"
            value={form.is_primary}
            onChange={(e) => setForm((f) => ({ ...f, is_primary: e.target.value }))}
            fullWidth
          >
            <MenuItem value="Y">Yes</MenuItem>
            <MenuItem value="N">No</MenuItem>
          </TextField>
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
