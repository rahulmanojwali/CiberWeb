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
import {
  fetchGateDeviceConfigs,
  createGateDeviceConfig,
  updateGateDeviceConfig,
  deactivateGateDeviceConfig,
  fetchGateDevices,
} from "../../services/gateApi";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { fetchMandis, fetchMandiGates } from "../../services/mandiApi";
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

type ConfigRow = {
  id: string;
  org_id?: string;
  mandi_id: number;
  gate_code: string;
  device_code: string;
  is_active: string;
  qr_format?: string;
  qr_payload_template?: string;
  updated_on?: string;
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { canView, canCreate, canEdit, canDeactivate, isSuperAdmin } = useCrudPermissions("gate_device_configs");
  const orgCode = uiConfig?.scope?.org_code || "";
  const orgCodes =
    (Array.isArray((uiConfig as any)?.scope?.org_codes) && (uiConfig as any)?.scope?.org_codes) ||
    (orgCode ? [orgCode] : []);

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
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [total, setTotal] = useState(0);

  const orgLabel = (orgId?: string) => {
    const found = orgOptions.find((o) => String(o._id) === String(orgId));
    return found?.org_code || found?.org_name || "";
  };

  const mandiLabel = (mandiId?: number | string) => {
    const found = mandiOptions.find((m: any) => String(m.mandi_id) === String(mandiId));
    return found?.name_i18n?.en || found?.mandi_slug || mandiId;
  };

  const columns = useMemo<GridColDef<ConfigRow>[]>(
    () => [
      { field: "device_code", headerName: "Device Code", width: 180 },
      {
        field: "org_id",
        headerName: "Org",
        width: 140,
        valueGetter: (params) => orgLabel(params.row.org_id),
      },
      {
        field: "mandi_id",
        headerName: "Mandi",
        width: 140,
        valueGetter: (params) => mandiLabel(params.row.mandi_id),
      },
      { field: "gate_code", headerName: "Gate", width: 130 },
      {
        field: "qr_format",
        headerName: "QR Format",
        width: 140,
        valueGetter: (params) => params.row.qr_format || "—",
      },
      {
        field: "qr_payload_template",
        headerName: "QR Template",
        flex: 1,
        valueGetter: (params) => params.row.qr_payload_template || "—",
      },
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
    const filtered = isSuperAdmin ? orgs : orgs.filter((o: any) => orgCodes.includes(o.org_code));
    setOrgOptions(filtered);
    if (!isSuperAdmin && filtered.length) {
      setFilters((f) => ({ ...f, org_id: filtered[0]?._id || "" }));
      setForm((f) => ({ ...f, org_id: filtered[0]?._id || "" }));
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
          (m: any) => String(m.org_id || "") === String(targetOrg) || String(m.org_code || "") === String(orgCode),
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

  const loadDevices = async (mandiId?: string | number) => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchGateDevices({
      username,
      language,
      filters: {
        org_id: filters.org_id || undefined,
        mandi_id: mandiId ? Number(mandiId) : filters.mandi_id ? Number(filters.mandi_id) : undefined,
        is_active: "Y",
      },
    });
    const list = resp?.data?.devices || resp?.response?.data?.devices || [];
    const filtered = filters.gate_code
      ? list.filter((d: any) => String(d.gate_code || "") === String(filters.gate_code))
      : list;
    setDeviceOptions(filtered);
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
          page,
          perPage,
        },
      });
      const list = resp?.data?.configs || resp?.response?.data?.configs || [];
      const pagination = resp?.data?.pagination || resp?.response?.data?.pagination;
      if (pagination?.total !== undefined) {
        setTotal(pagination.total);
        setPerPage(pagination.perPage || perPage);
      } else {
        setTotal(list.length);
      }
      setRows(
        list.map((c: any) => ({
          id: c._id,
          org_id: c.org_id,
          mandi_id: c.mandi_id,
          gate_code: c.gate_code,
          device_code: c.device_code,
          is_active: c.is_active,
          qr_format: c.qr_format,
          qr_payload_template: c.qr_payload_template,
          updated_on: c.updated_on,
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
  }, [status, filters.org_id, filters.mandi_id, filters.gate_code, filters.device_code, language, page, perPage]);

  useEffect(() => {
    loadMandis(filters.org_id);
    setGateOptions([]);
    setDeviceOptions([]);
    setPage(1);
  }, [filters.org_id]);

  const openCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setForm({
      ...defaultForm,
      org_id: filters.org_id || (orgOptions[0]?._id || ""),
    });
    setDialogOpen(true);
  };

  const openEdit = (row: ConfigRow) => {
    setIsEdit(true);
    setEditId(row.id);
    setForm({
      org_id: row.org_id || filters.org_id || "",
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
      qr_payload_template: form.qr_payload_template || undefined,
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

  if (!canView) return null;

  const grid = (
    <ResponsiveDataGrid
      columns={columns}
      rows={rows}
      loading={loading}
      getRowId={(r) => r.id}
      autoHeight
      paginationMode="server"
      rowCount={total}
      page={page - 1}
      pageSize={perPage}
      onPageChange={(newPage) => setPage(newPage + 1)}
      onPageSizeChange={(newSize) => {
        setPerPage(newSize);
        setPage(1);
      }}
      rowsPerPageOptions={[10, 25, 50]}
    />
  );

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Typography variant="h5">{t("menu.gateDeviceConfigs", { defaultValue: "Gate Device Configs" })}</Typography>
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
              setFilters((f) => ({ ...f, org_id: e.target.value, mandi_id: "", gate_code: "", device_code: "" }));
              setPage(1);
            }}
            sx={{ minWidth: { sm: 180 } }}
            fullWidth
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
              setFilters((f) => ({ ...f, mandi_id: e.target.value, gate_code: "", device_code: "" }));
              loadGates(e.target.value);
              loadDevices(e.target.value);
              setPage(1);
            }}
            sx={{ minWidth: { sm: 160 } }}
            fullWidth
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
              setFilters((f) => ({ ...f, gate_code: e.target.value, device_code: "" }));
              setPage(1);
            }}
            sx={{ minWidth: { sm: 150 } }}
            fullWidth
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
            onChange={(e) => {
              setFilters((f) => ({ ...f, device_code: e.target.value }));
              setPage(1);
            }}
            sx={{ minWidth: { sm: 150 } }}
            fullWidth
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
            onChange={(e) => {
              setStatus(e.target.value as any);
              setPage(1);
            }}
            sx={{ minWidth: { sm: 140 } }}
            fullWidth
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
            <Card key={row.id}>
              <CardContent sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center">
                  <Typography variant="subtitle1" fontWeight={600}>
                    {row.device_code}
                  </Typography>
                  <Chip label="Config" size="small" />
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Org: {orgLabel(row.org_id)} · Mandi: {mandiLabel(row.mandi_id)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Gate: {row.gate_code || "—"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  QR: {row.qr_format || "—"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Template: {row.qr_payload_template ? row.qr_payload_template.substring(0, 40) + "..." : "—"}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Chip
                    size="small"
                    label={row.is_active === "Y" ? "Active" : "Inactive"}
                    color={row.is_active === "Y" ? "success" : "default"}
                  />
                </Stack>
                {row.updated_on && (
                  <Typography variant="caption" color="text.secondary">
                    Updated: {new Date(row.updated_on).toLocaleString()}
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
                        onClick={() => handleDeactivate(row.id)}
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
              page={page}
              onChange={(_, p) => setPage(p)}
              size="small"
            />
          </Box>
        </Stack>
      ) : (
        <Card>
          <CardContent>{grid}</CardContent>
        </Card>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="md"
        fullScreen={isMobile}
        PaperProps={{ sx: { display: "flex", flexDirection: "column", maxHeight: isMobile ? "100vh" : "90vh" } }}
      >
        <DialogTitle>{isEdit ? "Edit Device Config" : "Create Device Config"}</DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1, flex: 1, overflowY: "auto" }}
        >
          <TextField
            select
            label="Organisation"
            value={form.org_id}
            onChange={(e) => {
              setForm((f) => ({ ...f, org_id: e.target.value, mandi_id: "", gate_code: "", device_code: "" }));
              loadMandis(e.target.value);
              setGateOptions([]);
              setDeviceOptions([]);
            }}
            fullWidth
            disabled={!isSuperAdmin}
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
            label="QR Payload Template"
            value={form.qr_payload_template || ""}
            onChange={(e) => setForm((f) => ({ ...f, qr_payload_template: e.target.value }))}
            fullWidth
            multiline
            minRows={2}
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
