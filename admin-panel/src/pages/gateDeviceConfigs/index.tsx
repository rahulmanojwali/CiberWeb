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
  fetchGateDeviceConfigs,
  createGateDeviceConfig,
  updateGateDeviceConfig,
  deactivateGateDeviceConfig,
  fetchGateDevices,
} from "../../services/gateApi";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { fetchMandis, fetchMandiGates } from "../../services/mandiApi";

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

type ConfigRow = {
  id: string;
  org_id?: string;
  mandi_id: number;
  gate_code: string;
  device_code: string;
  is_active: string;
};

const defaultForm = {
  org_id: "",
  mandi_id: "",
  gate_code: "",
  device_code: "",
  qr_format: "",
  rfid_protocol: "",
  is_active: "Y",
  advanced_json: "",
};

export const GateDeviceConfigs: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [status, setStatus] = useState("ALL" as "ALL" | "Y" | "N");
  const [filters, setFilters] = useState({ org_id: "", mandi_id: "", gate_code: "", device_code: "" });
  const [orgOptions, setOrgOptions] = useState<any[]>([]);
  const [mandiOptions, setMandiOptions] = useState<any[]>([]);
  const [gateOptions, setGateOptions] = useState<any[]>([]);
  const [deviceOptions, setDeviceOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState<string | null>(null);

  const canCreate = useMemo(() => can(uiConfig.resources, "gate_device_configs.create", "CREATE"), [uiConfig.resources]);
  const canEdit = useMemo(() => can(uiConfig.resources, "gate_device_configs.edit", "UPDATE"), [uiConfig.resources]);
  const canDeactivate = useMemo(
    () => can(uiConfig.resources, "gate_device_configs.deactivate", "DEACTIVATE"),
    [uiConfig.resources],
  );

  const columns = useMemo<GridColDef<ConfigRow>[]>(
    () => [
      { field: "device_code", headerName: "Device Code", width: 180 },
      { field: "mandi_id", headerName: "Mandi", width: 110 },
      { field: "gate_code", headerName: "Gate", width: 130 },
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

  const loadDevices = async (mandiId?: string | number) => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchGateDevices({ username, language, filters: { mandi_id: mandiId ? Number(mandiId) : undefined, is_active: "Y" } });
    setDeviceOptions(resp?.data?.devices || []);
  };

  const loadData = async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp = await fetchGateDeviceConfigs({
        username,
        language,
        filters: {
          org_id: filters.org_id || undefined,
          mandi_id: filters.mandi_id || undefined,
          gate_code: filters.gate_code || undefined,
          device_code: filters.device_code || undefined,
          is_active: status === "ALL" ? undefined : status,
        },
      });
      const list = resp?.data?.configs || resp?.response?.data?.configs || [];
      setRows(
        list.map((c: any) => ({
          id: c._id,
          org_id: c.org_id,
          mandi_id: c.mandi_id,
          gate_code: c.gate_code,
          device_code: c.device_code,
          is_active: c.is_active,
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
  }, [status, filters.org_id, filters.mandi_id, filters.gate_code, filters.device_code, language]);

  const openCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (row: ConfigRow) => {
    setIsEdit(true);
    setEditId(row.id);
    setForm({
      org_id: row.org_id || "",
      mandi_id: String(row.mandi_id),
      gate_code: row.gate_code,
      device_code: row.device_code,
      qr_format: "",
      rfid_protocol: "",
      is_active: row.is_active,
      advanced_json: "",
    });
    loadGates(row.mandi_id);
    loadDevices(row.mandi_id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username) return;
    let advanced: any = null;
    if (form.advanced_json) {
      try {
        advanced = JSON.parse(form.advanced_json);
      } catch {
        advanced = null;
      }
    }
    const payload: any = {
      org_id: form.org_id || undefined,
      mandi_id: Number(form.mandi_id),
      gate_code: form.gate_code,
      device_code: form.device_code,
      qr_format: form.qr_format || undefined,
      rfid_protocol: form.rfid_protocol || undefined,
      is_active: form.is_active,
      notes: advanced ? JSON.stringify(advanced) : undefined,
    };
    if (isEdit && editId) {
      payload.config_id = editId;
      await updateGateDeviceConfig({ username, language, payload });
    } else {
      await createGateDeviceConfig({ username, language, payload });
    }
    setDialogOpen(false);
    await loadData();
  };

  const handleDeactivate = async (config_id: string) => {
    const username = currentUsername();
    if (!username) return;
    await deactivateGateDeviceConfig({ username, language, config_id });
    await loadData();
  };

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Typography variant="h5">{t("menu.gateDeviceConfigs", { defaultValue: "Gate Device Configs" })}</Typography>
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
              setFilters((f) => ({ ...f, mandi_id: e.target.value, gate_code: "", device_code: "" }));
              loadGates(e.target.value);
              loadDevices(e.target.value);
            }}
            sx={{ minWidth: 160 }}
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
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All</MenuItem>
            {gateOptions.map((g: any) => (
              <MenuItem key={g.gate_code || g.gate_id || g._id} value={g.gate_code}>
                {g.gate_code}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Device"
            size="small"
            value={filters.device_code}
            onChange={(e) => setFilters((f) => ({ ...f, device_code: e.target.value }))}
            sx={{ minWidth: 150 }}
          >
            <MenuItem value="">All</MenuItem>
            {deviceOptions.map((d: any) => (
              <MenuItem key={d.device_code} value={d.device_code}>
                {d.device_code}
              </MenuItem>
            ))}
          </TextField>
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
        <ResponsiveDataGrid columns={columns} rows={rows} loading={loading} getRowId={(r) => r.id} />
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{isEdit ? "Edit Device Config" : "Create Device Config"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
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
              setForm((f) => ({ ...f, mandi_id: e.target.value, gate_code: "", device_code: "" }));
              loadGates(e.target.value);
              loadDevices(e.target.value);
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
            label="Device"
            value={form.device_code}
            onChange={(e) => setForm((f) => ({ ...f, device_code: e.target.value }))}
            fullWidth
          >
            {deviceOptions.map((d: any) => (
              <MenuItem key={d.device_code} value={d.device_code}>
                {d.device_code}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="QR Format"
            value={form.qr_format}
            onChange={(e) => setForm((f) => ({ ...f, qr_format: e.target.value }))}
            fullWidth
          />
          <TextField
            label="RFID Protocol"
            value={form.rfid_protocol}
            onChange={(e) => setForm((f) => ({ ...f, rfid_protocol: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Advanced (JSON)"
            value={form.advanced_json}
            onChange={(e) => setForm((f) => ({ ...f, advanced_json: e.target.value }))}
            fullWidth
            multiline
            minRows={3}
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
