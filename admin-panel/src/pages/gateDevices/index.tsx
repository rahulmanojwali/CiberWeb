import React, { useEffect, useMemo, useState } from "react";
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
  MenuItem,
  Pagination,
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
import { useCrudPermissions } from "../../utils/useCrudPermissions";
import { fetchGateDevices, createGateDevice, updateGateDevice, deactivateGateDevice } from "../../services/gateApi";
import { fetchMandis, fetchMandiGates } from "../../services/mandiApi";
import { fetchOrganisations } from "../../services/adminUsersApi";
import useMediaQuery from "@mui/material/useMediaQuery";
import { useTheme } from "@mui/material/styles";

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
  org_code?: string;
  updated_on?: string;
  capability_set?: string[];
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

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
  const [page, setPage] = useState(0); // zero-based for DataGrid
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const { canView, canCreate, canEdit, canDeactivate, isSuperAdmin } = useCrudPermissions("gate_devices");
  const orgCode = uiConfig?.scope?.org_code || "";
  const orgCodes =
    (Array.isArray((uiConfig as any)?.scope?.org_codes) && (uiConfig as any)?.scope?.org_codes) ||
    (orgCode ? [orgCode] : []);

  const columns = useMemo<GridColDef<DeviceRow>[]>(
    () => [
      { field: "device_code", headerName: "Device Code", width: 180 },
      { field: "device_type", headerName: "Type", width: 160 },
      {
        field: "org_code",
        headerName: "Org",
        width: 140,
        valueGetter: (params: any) => orgLabel(params.row.org_id) || params.row.org_code || "",
      },
      { field: "mandi_id", headerName: "Mandi", width: 110 },
      { field: "gate_code", headerName: "Gate", width: 130 },
      {
        field: "capability_set",
        headerName: "Capabilities",
        flex: 1,
        valueGetter: (params: any) => (params.row.capability_set || []).join(", "),
      },
      { field: "is_primary", headerName: "Primary", width: 110 },
      {
        field: "is_active",
        headerName: "Active",
        width: 110,
        valueGetter: (params: any) => (params.row.is_active === "Y" ? "Active" : "Inactive"),
      },
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
    const filtered = isSuperAdmin ? orgs : orgs.filter((o: any) => orgCodes.includes(o.org_code));
    setOrgOptions(filtered);
    if (!isSuperAdmin && filtered.length) {
      setFilters((f) => ({ ...f, org_id: filtered[0]?._id || "" }));
    }
  };

  const loadMandis = async (orgId?: string) => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchMandis({ username, language, filters: { is_active: true } });
    const mandis = resp?.data?.mandis || [];
    const targetOrg = orgId ?? filters.org_id;
    const filtered = targetOrg
      ? mandis.filter(
          (m: any) => String(m.org_id || "") === String(targetOrg) || String(m.org_code || "") === orgCode,
        )
      : mandis;
    setMandiOptions(filtered);
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
          page: page + 1,
          perPage,
        },
      });
      const list = resp?.data?.devices || resp?.response?.data?.devices || [];
      const pagination = resp?.data?.pagination || resp?.response?.data?.pagination;
      if (pagination?.total !== undefined) {
        setTotal(pagination.total);
        setPerPage(pagination.perPage || perPage);
      } else {
        setTotal(list.length);
      }
      setRows(
        list.map((d: any) => ({
          device_code: d.device_code,
          device_type: d.device_type,
          mandi_id: d.mandi_id,
          gate_code: d.gate_code,
          is_primary: d.is_primary,
          is_active: d.is_active,
          org_id: d.org_id,
          org_code: d.org_code || d.org_code_hint,
          updated_on: d.updated_on,
          capability_set: d.capability_set || [],
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgs();
    loadMandis();
  }, [language]);

  useEffect(() => {
    loadData();
  }, [status, filters.org_id, filters.mandi_id, filters.gate_code, filters.device_type, language, page, perPage]);

  useEffect(() => {
    loadMandis(filters.org_id);
    setGateOptions([]);
  }, [filters.org_id]);

  const openCreate = () => {
    setIsEdit(false);
    setForm({
      ...defaultForm,
      org_id: filters.org_id || (orgOptions[0]?._id || ""),
    });
    setDialogOpen(true);
  };

  const openEdit = (row: DeviceRow) => {
    setIsEdit(true);
    setForm({
      org_id: row.org_id || filters.org_id || "",
      mandi_id: String(row.mandi_id),
      gate_code: row.gate_code,
      device_code: row.device_code,
      device_type: row.device_type,
      capability_set: row.capability_set || [],
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

  const orgLabel = (orgId?: string) => {
    const found = orgOptions.find((o) => String(o._id) === String(orgId));
    return found?.org_code || found?.org_name || "";
  };

  const mandiLabel = (mandiId?: number | string) => {
    const found = mandiOptions.find((m: any) => String(m.mandi_id) === String(mandiId));
    return found?.name_i18n?.en || found?.mandi_slug || mandiId;
  };

  if (!canView) return null;

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Typography variant="h5">{t("menu.gateDevices", { defaultValue: "Gate Devices" })}</Typography>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", sm: "center" }}
          width={{ xs: "100%", sm: "auto" }}
        >
          <TextField
            select
            label="Organisation"
            size="small"
            value={filters.org_id}
            onChange={(e) => {
              setFilters((f) => ({ ...f, org_id: e.target.value, mandi_id: "", gate_code: "" }));
              setGateOptions([]);
              setMandiOptions((prev) =>
                prev.filter(
                  (m: any) =>
                    !e.target.value ||
                    String(m.org_id || "") === String(e.target.value) ||
                    String(m.org_code || "") === orgCode,
                ),
              );
              setPage(1);
              loadMandis();
            }}
            fullWidth
            sx={{ minWidth: { sm: 180 } }}
            disabled={!isSuperAdmin}
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
              setPage(1);
              setGateOptions([]);
            }}
            fullWidth
            sx={{ minWidth: { sm: 180 } }}
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
            onChange={(e) => {
              setFilters((f) => ({ ...f, gate_code: e.target.value }));
              setPage(1);
            }}
            fullWidth
            sx={{ minWidth: { sm: 160 } }}
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
            label="Status"
            size="small"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as any);
              setPage(1);
            }}
            fullWidth
            sx={{ minWidth: { sm: 140 } }}
          >
            <MenuItem value="ALL">All</MenuItem>
            <MenuItem value="Y">Active</MenuItem>
            <MenuItem value="N">Inactive</MenuItem>
          </TextField>
          {canCreate && (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate} fullWidth>
              {t("actions.create", { defaultValue: "Create" })}
            </Button>
          )}
        </Stack>
      </Stack>

      {isMobile ? (
        <Stack spacing={2}>
          {(rows || []).map((row) => (
            <Card key={row.device_code}>
              <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle1" fontWeight={600}>
                    {row.device_code}
                  </Typography>
                  <Chip label={row.device_type} size="small" />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Org: {orgLabel(row.org_id)} · Mandi: {mandiLabel(row.mandi_id)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Gate: {row.gate_code || "—"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Capabilities: {(row.capability_set || []).join(", ") || "—"}
                </Typography>
                <Stack direction="row" spacing={1}>
                  {row.is_primary === "Y" && <Chip size="small" label="Primary" color="primary" />}
                  <Chip
                    size="small"
                    label={row.is_active === "Y" ? "Active" : "Inactive"}
                    color={row.is_active === "Y" ? "success" : "default"}
                  />
                </Stack>
                {row.updated_on && (
                  <Typography variant="caption" color="text.secondary">
                    Last updated: {new Date(row.updated_on).toLocaleString()}
                  </Typography>
                )}
                {(canEdit || canDeactivate) && (
                  <Stack direction="row" justifyContent="flex-end" spacing={1} sx={{ mt: 1 }}>
                    {canEdit && (
                      <Button variant="text" size="small" onClick={() => openEdit(row)} sx={{ textTransform: "none" }}>
                        Edit
                      </Button>
                    )}
                    {canDeactivate && (
                      <Button
                        variant="text"
                        size="small"
                        color="error"
                        onClick={() => handleDeactivate(row.device_code)}
                        sx={{ textTransform: "none" }}
                      >
                        Deactivate
                      </Button>
                    )}
                  </Stack>
                )}
              </CardContent>
            </Card>
          ))}
          <Box display="flex" justifyContent="center">
            <Pagination
              count={Math.max(1, Math.ceil(total / perPage))}
              page={page + 1}
              onChange={(_, p) => setPage(p - 1)}
              size="small"
            />
          </Box>
        </Stack>
      ) : (
        <Card>
          <CardContent>
            <ResponsiveDataGrid
              columns={columns}
              rows={rows || []}
              loading={loading}
              getRowId={(r) => r.device_code}
              autoHeight
              paginationMode="server"
              rowCount={total}
              paginationModel={{ page, pageSize: perPage }}
              onPaginationModelChange={(model) => {
                setPage(model.page);
                if (model.pageSize !== perPage) {
                  setPerPage(model.pageSize);
                  setPage(0);
                }
              }}
              pageSizeOptions={[10, 25, 50]}
            />
          </CardContent>
        </Card>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="md"
        fullScreen={isMobile}
        PaperProps={{
          sx: { display: "flex", flexDirection: "column", maxHeight: isMobile ? "100vh" : "90vh" },
        }}
      >
        <DialogTitle>{isEdit ? "Edit Device" : "Create Device"}</DialogTitle>
        <DialogContent
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 2,
            overflowY: "auto",
          }}
        >
          <TextField
            label="Device Code"
            value={form.device_code}
            onChange={(e) => setForm((f) => ({ ...f, device_code: e.target.value }))}
            fullWidth
            disabled={isEdit}
          />
          <TextField
            select
            label="Device Type"
            value={form.device_type}
            onChange={(e) => setForm((f) => ({ ...f, device_type: e.target.value }))}
            fullWidth
          >
            {["WEIGHBRIDGE_CONSOLE", "QR_SCANNER", "RFID_READER", "GPS_TRACKER"].map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Capabilities"
            SelectProps={{ multiple: true }}
            value={form.capability_set}
            onChange={(e) => {
              const value = e.target.value;
              const arr = Array.isArray(value) ? value.map((s) => String(s).trim()) : [];
              setForm((f) => ({ ...f, capability_set: arr }));
            }}
            fullWidth
          >
            {["QR", "RFID", "GPS", "PRINTER", "DISPLAY", "API"].map((cap) => (
              <MenuItem key={cap} value={cap}>
                {cap}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Organisation"
            value={form.org_id}
            onChange={(e) => {
              setForm((f) => ({ ...f, org_id: e.target.value, mandi_id: "", gate_code: "" }));
              loadMandis(e.target.value);
              setGateOptions([]);
            }}
            fullWidth
            disabled={!isSuperAdmin}
          >
            <MenuItem value="">Select</MenuItem>
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
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.device_code || !form.device_type}>
            {isEdit ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
