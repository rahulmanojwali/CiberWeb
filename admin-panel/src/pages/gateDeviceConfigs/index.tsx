import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Pagination,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";

import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { fetchMandis, fetchMandiGates } from "../../services/mandiApi";
import {
  fetchGateDeviceConfigs,
  createGateDeviceConfig,
  updateGateDeviceConfig,
  deactivateGateDeviceConfig,
  fetchGateDevices,
} from "../../services/gateApi";
import { ActionGate } from "../../authz/ActionGate";
import { usePermissions } from "../../authz/usePermissions";
import { useRecordLock } from "../../authz/isRecordLocked";

const currentUsername = (): string | null => {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
};

const oidToString = (v: any): string => {
  if (!v) return "";
  if (typeof v === "string") return v;
  if ((v as any).$oid) return String((v as any).$oid);
  if ((v as any).oid) return String((v as any).oid);
  try {
    return String(v.toString());
  } catch {
    return "";
  }
};

type ConfigRow = {
  id: string;
  org_id?: string;
  mandi_id: number;
  gate_code: string;
  device_code: string;
  qr_format?: string;
  qr_payload_template?: string;
  rfid_protocol?: string | null;
  is_active: string;
  updated_on?: string;
  org_scope?: string | null;
  owner_type?: string | null;
  owner_org_id?: string | null;
  is_protected?: string | null;
};

const defaultForm = {
  org_id: "",
  mandi_id: "",
  gate_code: "",
  device_code: "",
  qr_format: "",
  qr_payload_template: "",
  rfid_protocol: "",
  is_active: "Y",
  advanced_json: "",
};

export const GateDeviceConfigs: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { can, authContext, isSuper } = usePermissions();
  const { isRecordLocked } = useRecordLock();
  const [searchParams, setSearchParams] = useSearchParams();
  const debug = searchParams.get("debugAuth") === "1";

  const stored = (key: string, fallback = "") =>
    searchParams.get(key) || localStorage.getItem(`gateDeviceConfigs.${key}`) || fallback;

  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [status, setStatus] = useState<"ALL" | "Y" | "N">(
    (stored("status", "ALL") as "ALL" | "Y" | "N") || "ALL",
  );
  const [filters, setFilters] = useState({
    org_id: stored("org_id", isSuper ? "" : authContext.org_id || ""),
    mandi_id: stored("mandi_id", ""),
    gate_code: stored("gate_code", ""),
    device_code: stored("device_code", ""),
  });
  const [orgOptions, setOrgOptions] = useState<any[]>([]);
  const [mandiOptions, setMandiOptions] = useState<any[]>([]);
  const [gateOptions, setGateOptions] = useState<any[]>([]);
  const [deviceOptions, setDeviceOptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [page, setPage] = useState<number>(Number(stored("page", "1")) || 1);
  const [perPage, setPerPage] = useState<number>(Number(stored("pageSize", "10")) || 10);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    Object.entries({
      org_id: filters.org_id,
      mandi_id: filters.mandi_id,
      gate_code: filters.gate_code,
      device_code: filters.device_code,
      status,
      page: String(page),
      pageSize: String(perPage),
    }).forEach(([k, v]) => {
      if (v) next.set(k, String(v));
      else next.delete(k);
      try {
        if (v) localStorage.setItem(`gateDeviceConfigs.${k}`, String(v));
      } catch {
        // ignore
      }
    });
    setSearchParams(next, { replace: true });
  }, [filters, status, page, perPage]);

  useEffect(() => {
    setPage(1);
  }, [filters.org_id, filters.mandi_id, filters.gate_code, filters.device_code, status]);

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
    const mandis = resp?.data?.mandis || [];
    setMandiOptions(mandis);
  };

  const loadGates = async (mandiId?: string | number) => {
    const username = currentUsername();
    if (!username || !mandiId) return;
    const resp = await fetchMandiGates({ username, language, filters: { mandi_id: Number(mandiId), is_active: "Y" } });
    setGateOptions(resp?.data?.items || []);
  };

  const loadDevices = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchGateDevices({ username, language, filters: { is_active: "Y" } });
    setDeviceOptions(resp?.data?.devices || []);
  };

  const fetchData = async () => {
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
      const configs = resp?.data?.configs || resp?.response?.data?.configs || [];
      const meta = resp?.data?.meta || resp?.response?.data?.meta || resp?.response?.pagination || resp?.data?.pagination;
      setTotal(meta?.totalCount || meta?.total || configs.length);
      setRows(
        configs.map((c: any) => ({
          ...c,
          id: c._id || c.id,
          org_id: oidToString(c.org_id || c.owner_org_id),
          org_scope: c.org_scope,
          owner_type: c.owner_type,
          owner_org_id: oidToString(c.owner_org_id),
          is_protected: c.is_protected,
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgs();
    loadMandis();
    loadDevices();
  }, []);

  useEffect(() => {
    if (filters.mandi_id) loadGates(filters.mandi_id);
  }, [filters.mandi_id]);

  useEffect(() => {
    fetchData();
  }, [filters, status, page, perPage]);

  const openCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setForm({
      ...defaultForm,
      org_id: filters.org_id || "",
      mandi_id: filters.mandi_id || "",
      gate_code: filters.gate_code || "",
      device_code: "",
      is_active: "Y",
    });
    setDialogOpen(true);
  };

  const openEdit = (row: ConfigRow) => {
    setIsEdit(true);
    setEditId(row.id);
    setForm({
      org_id: row.org_id || "",
      mandi_id: String(row.mandi_id || ""),
      gate_code: row.gate_code || "",
      device_code: row.device_code || "",
      qr_format: row.qr_format || "",
      qr_payload_template: row.qr_payload_template || "",
      rfid_protocol: row.rfid_protocol || "",
      is_active: row.is_active || "Y",
      advanced_json: "",
    } as any);
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    const username = currentUsername();
    if (!username) return;
    const payload = { ...form, mandi_id: Number(form.mandi_id) || undefined };
    if (isEdit && editId) {
      await updateGateDeviceConfig({ username, language, payload: { ...payload, config_id: editId } });
    } else {
      await createGateDeviceConfig({ username, language, payload });
    }
    setDialogOpen(false);
    fetchData();
  };

  const handleToggle = async (row: ConfigRow) => {
    const username = currentUsername();
    if (!username) return;
    const nextStatus = row.is_active === "Y" ? "N" : "Y";
    await deactivateGateDeviceConfig({ username, language, config_id: row.id, is_active: nextStatus });
    fetchData();
  };

  const orgLabel = (orgId?: string) => {
    const found = orgOptions.find((o) => oidToString(o._id) === oidToString(orgId));
    return found?.org_code || found?.org_name || "";
  };

  const mandiLabel = (mandiId?: number | string) => {
    const found = mandiOptions.find((m: any) => String(m.mandi_id) === String(mandiId));
    return found?.name_i18n?.en || found?.mandi_slug || mandiId;
  };

  const columns = useMemo<GridColDef<ConfigRow>[]>(
    () => [
      { field: "device_code", headerName: "Device Code", width: 150 },
      { field: "gate_code", headerName: "Gate", width: 120 },
      {
        field: "org_id",
        headerName: "Org",
        width: 140,
        valueGetter: (params: any) => orgLabel(params.row.org_id),
      },
      {
        field: "mandi_id",
        headerName: "Mandi",
        width: 140,
        valueGetter: (params: any) => mandiLabel(params.row.mandi_id),
      },
      {
        field: "qr_format",
        headerName: "QR Format",
        width: 140,
        valueGetter: (params: any) => params.row.qr_format || "—",
      },
      {
        field: "qr_payload_template",
        headerName: "QR Template",
        flex: 1,
        valueGetter: (params: any) => params.row.qr_payload_template || "—",
      },
      {
        field: "is_active",
        headerName: "Active",
        width: 110,
        renderCell: (params: any) => (
          <Stack direction="row" spacing={1} alignItems="center">
            {params.row.is_active === "Y" ? <CheckCircleIcon color="success" fontSize="small" /> : <BlockIcon color="error" fontSize="small" />}
            <Typography variant="body2">{params.row.is_active}</Typography>
          </Stack>
        ),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 240,
        renderCell: (params: any) => {
          const row = params.row as ConfigRow;
          return (
            <Stack direction="row" spacing={1}>
              <ActionGate resourceKey="gate_device_configs.edit" action="UPDATE" record={row}>
                <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(row)}>
                  Edit
                </Button>
              </ActionGate>
              <ActionGate resourceKey="gate_device_configs.deactivate" action="DEACTIVATE" record={row}>
                <Button
                  size="small"
                  color={row.is_active === "Y" ? "error" : "success"}
                  startIcon={row.is_active === "Y" ? <BlockIcon /> : <CheckCircleIcon />}
                  onClick={() => handleToggle(row)}
                >
                  {row.is_active === "Y" ? "Deactivate" : "Activate"}
                </Button>
              </ActionGate>
              {debug && (
                <Typography variant="caption">
                  canEdit:{String(can("gate_device_configs.edit", "UPDATE"))} | canDeact:
                  {String(can("gate_device_configs.deactivate", "DEACTIVATE"))} | locked:
                  {String(isRecordLocked(row, authContext).locked)} | org:{oidToString(authContext.org_id)} vs{" "}
                  {oidToString(row.org_id || row.owner_org_id)}
                </Typography>
              )}
            </Stack>
          );
        },
      },
    ],
    [debug, authContext],
  );

  const totalPages = Math.max(1, Math.ceil(total / perPage));

  return (
    <PageContainer
      title={t("Gate Device Configs")}
      actions={
        <ActionGate resourceKey="gate_device_configs.create" action="CREATE">
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            Add Config
          </Button>
        </ActionGate>
      }
    >
      <Card>
        <CardContent>
          <Stack direction={isMobile ? "column" : "row"} spacing={2}>
            <TextField
              select
              label="Status"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              size="small"
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="Y">Active</MenuItem>
              <MenuItem value="N">Inactive</MenuItem>
            </TextField>
            <TextField
              select
              label="Organisation"
              value={filters.org_id}
              onChange={(e) => setFilters((f) => ({ ...f, org_id: e.target.value }))}
              size="small"
              sx={{ minWidth: 180 }}
            >
              <MenuItem value="">All</MenuItem>
              {orgOptions.map((org) => (
                <MenuItem key={org._id} value={oidToString(org._id)}>
                  {org.org_code || org.org_name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Mandi"
              value={filters.mandi_id}
              onChange={(e) => setFilters((f) => ({ ...f, mandi_id: e.target.value }))}
              size="small"
              sx={{ minWidth: 150 }}
            >
              <MenuItem value="">All</MenuItem>
              {mandiOptions.map((m: any) => (
                <MenuItem key={m.mandi_id} value={m.mandi_id}>
                  {m.name_i18n?.en || m.mandi_slug || m.mandi_id}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Gate"
              value={filters.gate_code}
              onChange={(e) => setFilters((f) => ({ ...f, gate_code: e.target.value }))}
              size="small"
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="">All</MenuItem>
              {gateOptions.map((g: any) => (
                <MenuItem key={g.mandi_id + g.gate_code} value={g.gate_code}>
                  {g.gate_code}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Device Code"
              value={filters.device_code}
              onChange={(e) => setFilters((f) => ({ ...f, device_code: e.target.value }))}
              size="small"
              sx={{ minWidth: 160 }}
            />
          </Stack>
        </CardContent>
      </Card>

      <Box mt={2}>
        <ResponsiveDataGrid
          autoHeight
          columns={columns}
          rows={rows}
          loading={loading}
          getRowId={(row) => row.id}
          hideFooter
          density="compact"
        />
        <Stack direction="row" justifyContent="space-between" alignItems="center" mt={2}>
          <Box />
          <Pagination
            page={page}
            count={totalPages}
            onChange={(_, p) => setPage(p)}
            color="primary"
            shape="rounded"
            size="small"
          />
        </Stack>
      </Box>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{isEdit ? "Edit Config" : "Create Config"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              select
              label="Organisation"
              value={form.org_id}
              onChange={(e) => setForm((f) => ({ ...f, org_id: e.target.value }))}
              fullWidth
              size="small"
            >
              <MenuItem value="">Select</MenuItem>
              {orgOptions.map((org) => (
                <MenuItem key={org._id} value={oidToString(org._id)}>
                  {org.org_code || org.org_name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Mandi"
              value={form.mandi_id}
              onChange={(e) => setForm((f) => ({ ...f, mandi_id: e.target.value }))}
              fullWidth
              size="small"
            >
              <MenuItem value="">Select</MenuItem>
              {mandiOptions.map((m: any) => (
                <MenuItem key={m.mandi_id} value={m.mandi_id}>
                  {m.name_i18n?.en || m.mandi_slug || m.mandi_id}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Gate"
              value={form.gate_code}
              onChange={(e) => setForm((f) => ({ ...f, gate_code: e.target.value }))}
              fullWidth
              size="small"
            >
              <MenuItem value="">Select</MenuItem>
              {gateOptions.map((g: any) => (
                <MenuItem key={g.mandi_id + g.gate_code} value={g.gate_code}>
                  {g.gate_code}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Device Code"
              value={form.device_code}
              onChange={(e) => setForm((f) => ({ ...f, device_code: e.target.value }))}
              select
              fullWidth
              size="small"
            >
              <MenuItem value="">Select</MenuItem>
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
              size="small"
            />
            <TextField
              label="QR Payload Template"
              value={form.qr_payload_template}
              onChange={(e) => setForm((f) => ({ ...f, qr_payload_template: e.target.value }))}
              fullWidth
              size="small"
              multiline
              minRows={2}
            />
            <TextField
              label="RFID Protocol"
              value={form.rfid_protocol}
              onChange={(e) => setForm((f) => ({ ...f, rfid_protocol: e.target.value }))}
              fullWidth
              size="small"
            />
            <TextField
              select
              label="Active"
              value={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value }))}
              fullWidth
              size="small"
            >
              <MenuItem value="Y">Active</MenuItem>
              <MenuItem value="N">Inactive</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained">
            {isEdit ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
