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
import { fetchMandisWithGatesSummary } from "../../services/gateApi";
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
  gate_id: "",
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
  const [mandiSearchText, setMandiSearchText] = useState("");
  const [mandiSearchTextForm, setMandiSearchTextForm] = useState("");
  const [mandiLoading, setMandiLoading] = useState(false);
  const lastMandiParams = React.useRef<string>("");

  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [status, setStatus] = useState<"ALL" | "Y" | "N">(
    (stored("status", "ALL") as "ALL" | "Y" | "N") || "ALL",
  );
  const [filters, setFilters] = useState({
    mandi_id: stored("mandi_id", ""),
    gate_id: stored("gate_id", ""),
    device_code: stored("device_code", ""),
  });
  const [orgOptions, setOrgOptions] = useState<any[]>([]);
  const [mandiOptions, setMandiOptions] = useState<any[]>([]);
  const [gateOptionsFilter, setGateOptionsFilter] = useState<any[]>([]);
  const [gateOptionsForm, setGateOptionsForm] = useState<any[]>([]);
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
      gate_id: filters.gate_id,
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
  }, [selectedOrgId, filters.mandi_id, filters.gate_id, filters.device_code, status]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (selectedOrgCode || isOrgScoped) {
        loadMandis(mandiSearchText);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [mandiSearchText, selectedOrgCode, isOrgScoped]);

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
    if (!selectedOrgId && !isOrgScoped) return;
    const org_code = selectedOrgCode || authContext.org_code || undefined;
    const key = `${selectedOrgId || "NOORG"}|${org_code || "ORG"}|${search || mandiSearchText || ""}`;
    if (key === lastMandiParams.current) return;
    lastMandiParams.current = key;
    setMandiLoading(true);
    try {
      console.log("[gateDeviceConfigs] Loading mandis", {
        org_id: selectedOrgId,
        org_code,
        search: search || mandiSearchText || "",
      });
      const resp = await fetchMandisWithGatesSummary({
        username,
        language,
        filters: {
          org_id: selectedOrgId,
          search: search || mandiSearchText || undefined,
          page: 1,
          pageSize: 50,
          only_with_gates: "Y",
        },
      });
      const mandis = resp?.data?.items || resp?.response?.data?.items || [];
      setMandiOptions(mandis);
      console.log("[gateDeviceConfigs] Mandis loaded", mandis.length);
    } catch (err) {
      console.warn("[gateDeviceConfigs] loadMandis failed", err);
    } finally {
      setMandiLoading(false);
    }
  };

  const resolveGateCode = (options: any[], gateId?: string, fallback?: string) => {
    if (!gateId) return fallback || "";
    const gate = options.find((g: any) => String(g._id || g.id || g.gate_id) === String(gateId));
    return gate?.gate_code || fallback || "";
  };

  const findGateIdByCode = (mandiId?: string | number, gateCode?: string) => {
    if (!mandiId || !gateCode) return "";
    const mandi = mandiOptions.find((m: any) => String(m.mandi_id) === String(mandiId));
    const gate = (mandi?.gates || []).find((g: any) => g.gate_code === gateCode);
    return String(gate?._id || gate?.id || gate?.gate_id || "");
  };

  const capsForDeviceType = (deviceType?: string) => {
    const normalized = String(deviceType || "").trim().toUpperCase();
    if (normalized === "GPS_PHONE") return ["GPS"];
    if (normalized === "QR_SCANNER") return ["QR"];
    if (normalized === "RFID_READER") return ["RFID"];
    if (normalized === "WEIGHBRIDGE_CONSOLE") return ["WEIGHBRIDGE"];
    return [];
  };

  const loadDevices = async (mandiId?: string | number, gateId?: string) => {
    const username = currentUsername();
    if (!username || !selectedOrgId) return;
    try {
      const resp = await fetchGateDevices({
        username,
        language,
        filters: {
          org_id: selectedOrgId,
          mandi_id: mandiId ? Number(mandiId) : undefined,
          gate_id: gateId || undefined,
          status: "ACTIVE",
        },
      });
      setDeviceOptions(resp?.data?.devices || resp?.response?.data?.devices || []);
    } catch (err) {
      console.warn("[gateDeviceConfigs] loadDevices failed", err);
    }
  };

  const filterDevices = (options: any[], mandiId?: string | number, gateId?: string) => {
    if (!options.length) return [];
    return options.filter((d: any) => {
      if (mandiId && String(d.mandi_id) !== String(mandiId)) return false;
      if (gateId && String(d.gate_id) !== String(gateId)) return false;
      return true;
    });
  };

  const fetchData = async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
    const gate_code = resolveGateCode(gateOptionsFilter, filters.gate_id);
    const resp = await fetchGateDeviceConfigs({
      username,
      language,
      filters: {
        org_id: selectedOrgId || undefined,
        mandi_id: filters.mandi_id ? Number(filters.mandi_id) : undefined,
        gate_code: gate_code || undefined,
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
    if (!selectedOrgId && !isOrgScoped) return;
    loadMandis("");
  }, [selectedOrgId, selectedOrgCode, isOrgScoped]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!dialogOpen) return;
      if (selectedOrgId || selectedOrgCode || isOrgScoped) {
        loadMandis(mandiSearchTextForm);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [mandiSearchTextForm, selectedOrgId, selectedOrgCode, isOrgScoped, dialogOpen]);

  useEffect(() => {
    const selected = mandiOptions.find((m: any) => String(m.mandi_id) === String(filters.mandi_id));
    setGateOptionsFilter(selected?.gates || []);
    setDeviceOptions([]);
    if (filters.mandi_id && filters.gate_id) {
      loadDevices(filters.mandi_id, filters.gate_id);
    }
  }, [filters.mandi_id, filters.gate_id, selectedOrgId, mandiOptions]);

  useEffect(() => {
    const selected = mandiOptions.find((m: any) => String(m.mandi_id) === String(form.mandi_id));
    setGateOptionsForm(selected?.gates || []);
    if (dialogOpen && form.mandi_id && form.gate_id) {
      loadDevices(form.mandi_id, form.gate_id);
    } else if (dialogOpen) {
      setDeviceOptions([]);
    }
  }, [dialogOpen, form.mandi_id, form.gate_id, selectedOrgId, mandiOptions]);

  const filteredDeviceOptionsFilter = useMemo(
    () => filterDevices(deviceOptions, filters.mandi_id, filters.gate_id),
    [deviceOptions, filters.mandi_id, filters.gate_id],
  );

  const filteredDeviceOptionsForm = useMemo(
    () => filterDevices(deviceOptions, form.mandi_id, form.gate_id),
    [deviceOptions, form.mandi_id, form.gate_id],
  );

  useEffect(() => {
    if (!dialogOpen) return;
    if (!form.mandi_id && mandiOptions.length === 1) {
      setForm((f) => ({ ...f, mandi_id: String(mandiOptions[0].mandi_id) }));
    }
  }, [dialogOpen, form.mandi_id, mandiOptions]);

  useEffect(() => {
    if (!dialogOpen) return;
    if (!form.gate_id && gateOptionsForm.length === 1) {
      setForm((f) => ({
        ...f,
        gate_id: String(gateOptionsForm[0]._id || gateOptionsForm[0].id || gateOptionsForm[0].gate_id || ""),
        gate_code: gateOptionsForm[0].gate_code,
      }));
    }
  }, [dialogOpen, form.gate_id, gateOptionsForm]);

  useEffect(() => {
    if (!dialogOpen) return;
    if (!form.device_code && deviceOptions.length === 1) {
      setForm((f) => ({ ...f, device_code: deviceOptions[0].device_code }));
    }
  }, [dialogOpen, form.device_code, deviceOptions]);

  useEffect(() => {
    if (!dialogOpen || !form.device_code) return;
    const selectedDevice = filteredDeviceOptionsForm.find(
      (d: any) => d.device_code === form.device_code,
    );
    if (!selectedDevice) return;
    const caps = capsForDeviceType(selectedDevice.device_type);
    setForm((prev) => {
      const next = { ...prev };
      if (!caps.includes("QR")) {
        next.qr_format = "";
        next.qr_payload_template = "";
      }
      if (!caps.includes("RFID")) {
        next.rfid_protocol = "NONE";
      }
      return next;
    });
  }, [dialogOpen, form.device_code, filteredDeviceOptionsForm]);

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
      gate_id: filters.gate_id || "",
      device_code: "",
      is_active: "Y",
    });
    setDialogOpen(true);
  };

  const openEdit = (row: ConfigRow) => {
    setIsEdit(true);
    setEditId(row.id);
    const matchedGateId = findGateIdByCode(row.mandi_id, row.gate_code);
    setForm({
      org_id: row.org_id || "",
      mandi_id: String(row.mandi_id || ""),
      gate_id: matchedGateId,
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
    const gate_code = resolveGateCode(gateOptionsForm, form.gate_id, form.gate_code);
    const payload = {
      ...form,
      org_id: form.org_id || selectedOrgId,
      mandi_id: Number(form.mandi_id) || undefined,
      gate_code: gate_code || undefined,
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
            {!isOrgScoped && (
              <TextField
                select
                label="Organisation"
                value={selectedOrgId}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedOrgId(val);
                  setFilters((f) => ({
                    ...f,
                    mandi_id: "",
                    gate_id: "",
                    device_code: "",
                  }));
                  const org = orgOptions.find((o) => oidToString(o._id) === oidToString(val));
                  setSelectedOrgCode(org?.org_code || "");
                  setMandiOptions([]);
                  setGateOptionsFilter([]);
                  setGateOptionsForm([]);
                  setDeviceOptions([]);
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
            <Autocomplete
              size="small"
              options={mandiOptions}
              loading={mandiLoading}
              getOptionLabel={(option: any) => option.name_i18n?.en || option.mandi_slug || String(option.mandi_id)}
              isOptionEqualToValue={(opt: any, val: any) => String(opt.mandi_id) === String(val.mandi_id)}
              disabled={!isOrgScoped && !selectedOrgId}
              value={
                filters.mandi_id
                  ? mandiOptions.find((m: any) => String(m.mandi_id) === String(filters.mandi_id)) || null
                  : null
              }
              onChange={(_, val: any) => {
                const nextId = val ? String(val.mandi_id) : "";
                if (nextId === filters.mandi_id) return;
                setFilters((f) => ({
                  ...f,
                  mandi_id: nextId,
                  gate_id: "",
                  device_code: "",
                }));
                if (!val) {
                  setGateOptionsFilter([]);
                  setGateOptionsForm([]);
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
              value={filters.gate_id}
              onChange={(e) =>
                setFilters((f) => ({ ...f, gate_id: e.target.value, device_code: "" }))
              }
              size="small"
              sx={{ minWidth: 140 }}
              disabled={!filters.mandi_id}
            >
              <MenuItem value="">All</MenuItem>
              {gateOptionsFilter.map((g: any) => (
                <MenuItem
                  key={String(g._id || g.id || g.gate_id || g.gate_code)}
                  value={String(g._id || g.id || g.gate_id || g.gate_code)}
                >
                  {g.name_i18n?.en || g.gate_code}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Device Code"
              value={filters.device_code}
              onChange={(e) => setFilters((f) => ({ ...f, device_code: e.target.value }))}
              select
              size="small"
              sx={{ minWidth: 180 }}
              disabled={!filters.gate_id}
            >
              <MenuItem value="">Select</MenuItem>
              {filteredDeviceOptionsFilter.map((d: any) => (
                <MenuItem key={d.device_code} value={d.device_code}>
                  {d.device_code} • {d.device_type || "UNKNOWN"}
                  {d.device_label ? ` • ${d.device_label}` : ""}
                </MenuItem>
              ))}
            </TextField>
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
              disabled={!isOrgScoped && !selectedOrgId}
              value={
                form.mandi_id
                  ? mandiOptions.find((m: any) => String(m.mandi_id) === String(form.mandi_id)) || null
                  : null
              }
              onChange={(_, val: any) => {
                const nextId = val ? String(val.mandi_id) : "";
                if (nextId === form.mandi_id) return;
                setForm((f) => ({
                  ...f,
                  mandi_id: nextId,
                  gate_id: "",
                  device_code: "",
                }));
                if (!val) {
                  setGateOptionsForm([]);
                  setDeviceOptions([]);
                }
              }}
              inputValue={mandiSearchTextForm}
              onInputChange={(_, val) => {
                if (val === mandiSearchTextForm) return;
                setMandiSearchTextForm(val);
              }}
              renderInput={(params) => (
                <TextField {...params} label="Mandi" placeholder="Select mandi" size="small" />
              )}
            />
            <TextField
              select
              label="Gate"
              value={form.gate_id}
              onChange={(e) => {
                setForm((f) => ({ ...f, gate_id: e.target.value, device_code: "" }));
                if (form.mandi_id) {
                  loadDevices(form.mandi_id, e.target.value as string);
                }
              }}
              fullWidth
              size="small"
              disabled={!form.mandi_id}
            >
              <MenuItem value="">Select</MenuItem>
              {gateOptionsForm.map((g: any) => (
                <MenuItem
                  key={String(g._id || g.id || g.gate_id || g.gate_code)}
                  value={String(g._id || g.id || g.gate_id || g.gate_code)}
                >
                  {g.name_i18n?.en || g.gate_code}
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
              disabled={!form.gate_id}
            >
              <MenuItem value="">Select</MenuItem>
              {filteredDeviceOptionsForm.map((d: any) => (
                <MenuItem key={d.device_code} value={d.device_code}>
                  {d.device_code} • {d.device_type || "UNKNOWN"}
                  {d.device_label ? ` • ${d.device_label}` : ""}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Device Type"
              value={
                filteredDeviceOptionsForm.find((d: any) => d.device_code === form.device_code)
                  ?.device_type || ""
              }
              fullWidth
              size="small"
              InputProps={{ readOnly: true }}
            />
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
