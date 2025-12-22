import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Autocomplete,
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
  qr_format: "JSON",
  qr_payload_template: "",
  rfid_protocol: "NONE",
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

  const roleScope = (authContext as any)?.role_scope || (authContext as any)?.roleScope;
  const orgName = (authContext as any)?.org_name;
  const orgCode = authContext.org_code;
  const isScopedUser = !isSuper;
  const isOrgScoped = isScopedUser && (!!authContext.org_id || authContext.role === "MANDI_ADMIN");
  const initialOrgId = isOrgScoped ? oidToString(authContext.org_id) : stored("org_id", "");

  const [selectedOrgId, setSelectedOrgId] = useState<string>(initialOrgId);
  const [selectedOrgCode, setSelectedOrgCode] = useState<string>(isOrgScoped ? authContext.org_code || "" : "");
  const [mandiSource, setMandiSource] = useState<"ORG" | "SYSTEM">("ORG");
  const [mandiSearchText, setMandiSearchText] = useState("");
  const [mandiLoading, setMandiLoading] = useState(false);
  const lastMandiParams = React.useRef<string>("");

  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [status, setStatus] = useState<"ALL" | "Y" | "N">(
    (stored("status", "ALL") as "ALL" | "Y" | "N") || "ALL",
  );
  const [filters, setFilters] = useState({
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

  const currentSearchStr = searchParams.toString();

  useEffect(() => {
    const next = new URLSearchParams(currentSearchStr);
    Object.entries({
      org_id: selectedOrgId,
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
    const nextStr = next.toString();
    if (nextStr !== currentSearchStr) {
      setSearchParams(next, { replace: true });
    }
  }, [filters, status, page, perPage, selectedOrgId, setSearchParams, currentSearchStr]);

  useEffect(() => {
    setPage(1);
  }, [selectedOrgId, filters.mandi_id, filters.gate_code, filters.device_code, status]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      // avoid firing until org code (or SYSTEM) is known to prevent tight loops
      if (mandiSource === "SYSTEM" || selectedOrgCode || isOrgScoped) {
        loadMandis(mandiSearchText);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [mandiSearchText, mandiSource, selectedOrgCode, isOrgScoped]);

  const loadOrgs = async () => {
    // Only SUPER_ADMIN should fetch organisations; scoped users rely on auth context
    if (isScopedUser) {
      const single = {
        _id: oidToString(authContext.org_id),
        org_code: orgCode,
        org_name: orgName,
      };
      setOrgOptions(single._id ? [single] : []);
      if (single._id && single._id !== selectedOrgId) setSelectedOrgId(single._id);
      if (orgCode && orgCode !== selectedOrgCode) setSelectedOrgCode(orgCode);
      return;
    }
    const username = currentUsername();
    if (!username) return;
    try {
      const resp = await fetchOrganisations({ username, language });
      const orgs = resp?.response?.data?.organisations || resp?.data?.organisations || [];
      setOrgOptions(orgs);
    } catch (err) {
      console.warn("[gateDeviceConfigs] loadOrgs failed", err);
    }
  };

  const loadMandis = async (search?: string) => {
    const username = currentUsername();
    if (!username) return;
    const org_code = mandiSource === "SYSTEM" ? "SYSTEM" : selectedOrgCode || authContext.org_code || undefined;
    if (!org_code && mandiSource !== "SYSTEM") return;
    const key = `${org_code || "ORG"}|${mandiSource}|${search || mandiSearchText || ""}`;
    if (key === lastMandiParams.current) return;
    lastMandiParams.current = key;
    setMandiLoading(true);
    try {
      const resp = await fetchMandis({
        username,
        language,
        filters: {
          ...(org_code ? { org_code } : {}),
          search: search || mandiSearchText || undefined,
          page: 1,
          pageSize: 50,
          is_active: true,
        },
      });
      const mandis = resp?.data?.mandis || [];
      setMandiOptions(mandis);
    } catch (err) {
      console.warn("[gateDeviceConfigs] loadMandis failed", err);
    } finally {
      setMandiLoading(false);
    }
  };

  const loadGates = async (mandiId?: string | number) => {
    const username = currentUsername();
    if (!username || !mandiId || !selectedOrgId) return;
    try {
      const resp = await fetchMandiGates({
        username,
        language,
        filters: { org_id: selectedOrgId, mandi_id: Number(mandiId), is_active: "Y" },
      });
      setGateOptions(resp?.data?.items || resp?.response?.data?.items || []);
    } catch (err) {
      console.warn("[gateDeviceConfigs] loadGates failed", err);
    }
  };

  const loadDevices = async (mandiId?: string | number, gateCode?: string) => {
    const username = currentUsername();
    if (!username || !selectedOrgId) return;
    try {
      const resp = await fetchGateDevices({
        username,
        language,
        filters: {
          org_id: selectedOrgId,
          mandi_id: mandiId ? Number(mandiId) : undefined,
          gate_code: gateCode || undefined,
          is_active: "Y",
        },
      });
      setDeviceOptions(resp?.data?.devices || resp?.response?.data?.devices || []);
    } catch (err) {
      console.warn("[gateDeviceConfigs] loadDevices failed", err);
    }
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
        org_id: selectedOrgId || undefined,
        mandi_id: filters.mandi_id ? Number(filters.mandi_id) : undefined,
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
    } catch (err) {
      console.warn("[gateDeviceConfigs] fetchData failed", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrgs();
  }, []);

  useEffect(() => {
    if (!isOrgScoped && selectedOrgId) {
      const org = orgOptions.find((o) => oidToString(o._id) === oidToString(selectedOrgId));
      const nextCode = org?.org_code || "";
      if (nextCode && nextCode !== selectedOrgCode) setSelectedOrgCode(nextCode);
    }
  }, [orgOptions, selectedOrgId, isOrgScoped, selectedOrgCode]);

  useEffect(() => {
    loadMandis();
  }, [mandiSource, selectedOrgCode]);

  useEffect(() => {
    if (filters.mandi_id) {
      loadGates(filters.mandi_id);
      loadDevices(filters.mandi_id, filters.gate_code);
    }
  }, [filters.mandi_id, filters.gate_code, selectedOrgId]);

  useEffect(() => {
    if (dialogOpen && form.mandi_id) {
      loadGates(form.mandi_id);
      loadDevices(form.mandi_id, form.gate_code);
    }
  }, [dialogOpen, form.mandi_id, form.gate_code, selectedOrgId]);

  useEffect(() => {
    fetchData();
  }, [filters, status, page, perPage, selectedOrgId]);

  const openCreate = () => {
    setIsEdit(false);
    setEditId(null);
    setForm({
      ...defaultForm,
      org_id: selectedOrgId || "",
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
    const payload = {
      ...form,
      org_id: form.org_id || selectedOrgId,
      mandi_id: Number(form.mandi_id) || undefined,
      device_code: form.device_code,
    };
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
              label="Mandi Source"
              value={mandiSource}
              onChange={(e) => setMandiSource(e.target.value as "ORG" | "SYSTEM")}
              size="small"
              sx={{ minWidth: 170 }}
            >
              <MenuItem value="ORG">Organisation Mandis</MenuItem>
              <MenuItem value="SYSTEM">System Mandis</MenuItem>
            </TextField>
            {!isOrgScoped && (
              <TextField
                select
                label="Organisation"
                value={selectedOrgId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedOrgId(val);
                  const org = orgOptions.find((o) => oidToString(o._id) === oidToString(val));
                  setSelectedOrgCode(org?.org_code || "");
                }}
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
            )}
            {isOrgScoped && (
              <TextField
                label="Organisation"
                value={orgName || orgCode || ""}
                size="small"
                InputProps={{ readOnly: true }}
                sx={{ minWidth: 200 }}
              />
            )}
            <Autocomplete
              size="small"
              options={mandiOptions}
              loading={mandiLoading}
              getOptionLabel={(option: any) => option.name_i18n?.en || option.mandi_slug || String(option.mandi_id)}
              isOptionEqualToValue={(opt: any, val: any) => String(opt.mandi_id) === String(val.mandi_id)}
              value={
                filters.mandi_id
                  ? mandiOptions.find((m: any) => String(m.mandi_id) === String(filters.mandi_id)) || null
                  : null
              }
              onChange={(_, val: any) => {
                const nextId = val ? String(val.mandi_id) : "";
                if (nextId === filters.mandi_id) return;
                setFilters((f) => ({ ...f, mandi_id: nextId }));
                if (val) {
                  loadGates(val.mandi_id);
                  loadDevices(val.mandi_id);
                } else {
                  setGateOptions([]);
                  setDeviceOptions([]);
                }
              }}
              inputValue={mandiSearchText}
              onInputChange={(_, val) => {
                if (val === mandiSearchText) return;
                setMandiSearchText(val);
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Mandi"
                  placeholder="Search mandis"
                  size="small"
                  sx={{ minWidth: 200 }}
                />
              )}
            />
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
            {!isOrgScoped && (
              <TextField
                select
                label="Organisation"
                value={form.org_id || selectedOrgId}
                onChange={(e) => {
                  const val = e.target.value;
                  setForm((f) => ({ ...f, org_id: val }));
                  const org = orgOptions.find((o) => oidToString(o._id) === oidToString(val));
                  setSelectedOrgId(val);
                  setSelectedOrgCode(org?.org_code || "");
                }}
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
            )}
            {isOrgScoped && (
              <TextField
                label="Organisation"
                value={orgName || orgCode || ""}
                fullWidth
                size="small"
                InputProps={{ readOnly: true }}
              />
            )}
            <Autocomplete
              fullWidth
              size="small"
              options={mandiOptions}
              loading={mandiLoading}
              getOptionLabel={(option: any) => option.name_i18n?.en || option.mandi_slug || String(option.mandi_id)}
              isOptionEqualToValue={(opt: any, val: any) => String(opt.mandi_id) === String(val.mandi_id)}
              value={
                form.mandi_id
                  ? mandiOptions.find((m: any) => String(m.mandi_id) === String(form.mandi_id)) || null
                  : null
              }
              onChange={(_, val: any) => {
                const nextId = val ? String(val.mandi_id) : "";
                if (nextId === form.mandi_id) return;
                setForm((f) => ({ ...f, mandi_id: nextId }));
                if (val) {
                  loadGates(val.mandi_id);
                  loadDevices(val.mandi_id);
                } else {
                  setGateOptions([]);
                  setDeviceOptions([]);
                }
              }}
              inputValue={mandiSearchText}
              onInputChange={(_, val) => {
                if (val === mandiSearchText) return;
                setMandiSearchText(val);
              }}
              renderInput={(params) => (
                <TextField {...params} label="Mandi" placeholder="Select mandi" size="small" />
              )}
            />
            <TextField
              select
              label="Gate"
              value={form.gate_code}
              onChange={(e) => {
                setForm((f) => ({ ...f, gate_code: e.target.value }));
                if (form.mandi_id) loadDevices(form.mandi_id, e.target.value);
              }}
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
              select
              label="QR Format"
              value={form.qr_format}
              onChange={(e) => setForm((f) => ({ ...f, qr_format: e.target.value }))}
              fullWidth
              size="small"
            >
              <MenuItem value="JSON">JSON</MenuItem>
              <MenuItem value="PLAIN_TEXT">Plain Text</MenuItem>
              <MenuItem value="URL_QUERY">URL Query</MenuItem>
            </TextField>
            <TextField
              label="QR Payload Template"
              value={form.qr_payload_template}
              onChange={(e) => setForm((f) => ({ ...f, qr_payload_template: e.target.value }))}
              fullWidth
              size="small"
              multiline
              minRows={3}
              placeholder={`{
  "v": 1,
  "org_id": "{{org_id}}",
  "mandi_id": "{{mandi_id}}",
  "gate_code": "{{gate_code}}",
  "token_id": "{{token_id}}",
  "vehicle_no": "{{vehicle_no}}",
  "ts": "{{timestamp}}"
}`}
            />
            <TextField
              select
              label="RFID Protocol"
              value={form.rfid_protocol}
              onChange={(e) => setForm((f) => ({ ...f, rfid_protocol: e.target.value }))}
              fullWidth
              size="small"
            >
              <MenuItem value="NONE">None</MenuItem>
              <MenuItem value="EPC_GEN2_UHF">EPC GEN2 UHF</MenuItem>
              <MenuItem value="MIFARE_CLASSIC">MIFARE CLASSIC</MenuItem>
              <MenuItem value="MIFARE_DESFIRE">MIFARE DESFIRE</MenuItem>
              <MenuItem value="ISO14443_A">ISO14443-A</MenuItem>
              <MenuItem value="ISO15693">ISO15693</MenuItem>
            </TextField>
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
