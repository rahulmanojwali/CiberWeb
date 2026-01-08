import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  Pagination,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import ToggleOnOutlinedIcon from "@mui/icons-material/ToggleOnOutlined";
import ToggleOffOutlinedIcon from "@mui/icons-material/ToggleOffOutlined";

import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";

import {
  fetchGateDevicesBootstrap,
  createGateDevice,
  updateGateDevice,
  deactivateGateDevice,
} from "../../services/gateApi";

import { useSnackbar } from "notistack";
import { usePermissions } from "../../authz/usePermissions";
import { ActionGate } from "../../authz/ActionGate";

type MandiOption = {
  mandi_id: number;
  mandi_slug?: string;
  label?: string;
  name_i18n?: Record<string, string>;
};

type GateOption = {
  _id: string;
  gate_code: string;
  name_i18n?: Record<string, string>;
  is_active?: string;
};

type DeviceRow = {
  id: string;
  _id: string;

  org_id?: string;
  mandi_id: number;
  gate_id: string;

  device_code: string;
  device_label?: string | null;
  device_type?: string | null;
  status?: string | null;

  gate_code?: string | null;
  last_seen_on?: string | null;
  updated_on?: string | null;
};

function safeLabel(val: any, fallback = "—") {
  const s = val === null || val === undefined ? "" : String(val);
  return s.trim() ? s : fallback;
}

function safeType(v: any): string {
  return String(v || "").split("_").join(" ");
}

function getUsernameFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem("cm_username") ||
    localStorage.getItem("cd_username") ||
    (() => {
      try {
        const raw = localStorage.getItem("cd_user");
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed?.username || null;
      } catch {
        return null;
      }
    })()
  );
}

function normalizeDeviceCode(input: string) {
  return (input || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_-]/g, "_")
    .replace(/_+/g, "_");
}

const GateDevicesPage: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const { enqueueSnackbar } = useSnackbar();
  const { authContext, can } = usePermissions();

  const orgId = String((authContext as any)?.org_id || "");

  // RBAC (canonical keys used across this project)
  const canCreate = can("cm_gate_devices.create", "CREATE");
  const canEdit = can("cm_gate_devices.edit", "UPDATE");
  const canToggle = can("cm_gate_devices.deactivate", "DEACTIVATE");
  const showActions = canEdit || canToggle;

  // Single query state (primitives only)
  const [mandiId, setMandiId] = useState<number | "">("");
  const [gateId, setGateId] = useState<string>("");
  const [deviceType, setDeviceType] = useState<string>("");
  const [searchInput, setSearchInput] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");

  // Pagination
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Bootstrap data
  const [org, setOrg] = useState<{ org_id?: string; org_code?: string; org_name?: string }>({});
  const [mandis, setMandis] = useState<MandiOption[]>([]);
  const [gates, setGates] = useState<GateOption[]>([]);
  const [deviceTypes, setDeviceTypes] = useState<string[]>([]);
  const [devices, setDevices] = useState<DeviceRow[]>([]);

  const [loading, setLoading] = useState<boolean>(false);

  // Explicit refresh trigger (for create/update/deactivate actions)
  const [refreshTick, setRefreshTick] = useState<number>(0);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    mandi_id: "" as number | "",
    gate_id: "" as string,
    device_code: "" as string,
    device_label: "" as string,
    device_type: "" as string,
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
  });

  // Inflight guard (dedupe / mutex)
  const inflightRef = useRef<Promise<any> | null>(null);
  const inflightKeyRef = useRef<string>("");
  const lastCompletedKeyRef = useRef<string>("");

  const selectedMandi = useMemo(() => {
    if (!mandiId) return null;
    return mandis.find((m) => String(m.mandi_id) === String(mandiId)) || null;
  }, [mandis, mandiId]);

  const selectedGate = useMemo(() => {
    if (!gateId) return null;
    return gates.find((g) => String(g._id) === String(gateId)) || null;
  }, [gates, gateId]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Reset page on filter/search changes
  useEffect(() => {
    setPage(1);
  }, [mandiId, gateId, deviceType, debouncedSearch]);

  // ✅ Single effect that fetches bootstrap (depends on primitives only)
  useEffect(() => {
    const username = getUsernameFromStorage();
    if (!username) return;

    const reqKey = JSON.stringify({
      org_id: orgId,
      mandi_id: mandiId || "",
      gate_id: gateId || "",
      device_type: deviceType || "",
      search: debouncedSearch || "",
      page,
      pageSize,
    });

    // Dedupe: same inflight request
    if (inflightRef.current && inflightKeyRef.current === reqKey) return;
    // Dedupe: same as last completed (prevents StrictMode/prod re-renders)
    if (lastCompletedKeyRef.current === reqKey) return;

    setLoading(true);

    const p = (async () => {
      const resp = await fetchGateDevicesBootstrap({
        username,
        language: "en",
        filters: {
          mandi_id: mandiId ? Number(mandiId) : undefined,
          gate_id: gateId ? String(gateId) : undefined,
          device_type: deviceType || undefined,
          search: debouncedSearch || undefined,
          page,
          pageSize,
        },
      });

      if (!resp?.ok) {
        setDevices([]);
        setTotalCount(0);
        enqueueSnackbar(resp?.description || "Failed to load gate devices", { variant: "error" });
        return;
      }

      const data = resp.data || {};
      setOrg(data.org || {});
      setMandis(data.mandis?.items || []);
      setGates(data.gates?.items || []);
      setDeviceTypes(data.device_types?.items || []);

      const list: any[] = data.devices?.items || [];
      const meta = data.devices?.meta || {};
      setDevices(
        list.map((d) => ({
          ...d,
          id: String(d._id || d.device_code),
        })),
      );
      setTotalCount(Number(meta.totalCount || 0));
    })();

    inflightRef.current = p;
    inflightKeyRef.current = reqKey;
    lastCompletedKeyRef.current = ""; // clear until this finishes

    (async () => {
      try {
        await p;
        lastCompletedKeyRef.current = reqKey;
      } finally {
        inflightRef.current = null;
        inflightKeyRef.current = "";
        setLoading(false);
      }
    })();
  }, [orgId, mandiId, gateId, deviceType, debouncedSearch, page, pageSize, refreshTick, enqueueSnackbar]);

  // Manual refresh helper for actions (does not affect effect deps)
  const refresh = useCallback(() => {
    lastCompletedKeyRef.current = "";
    setRefreshTick((t) => t + 1);
  }, []);

  // UX: when mandi changes, clear gate; gates come back from bootstrap for mandi
  const onSelectMandi = (m: MandiOption | null) => {
    setMandiId(m?.mandi_id ?? "");
    setGateId("");
  };

  const openAdd = () => {
    setDialogMode("add");
    setEditingId(null);
    setForm({
      mandi_id: mandiId || "",
      gate_id: gateId || "",
      device_code: "",
      device_label: "",
      device_type: deviceType || "GPS_PHONE",
      status: "ACTIVE",
    });
    setDialogOpen(true);
  };

  const openEdit = (row: DeviceRow) => {
    setDialogMode("edit");
    setEditingId(row._id);
    setForm({
      mandi_id: row.mandi_id,
      gate_id: row.gate_id,
      device_code: row.device_code,
      device_label: row.device_label ? String(row.device_label) : "",
      device_type: row.device_type ? String(row.device_type) : "",
      status: (String(row.status || "ACTIVE").toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE") as any,
    });
    setDialogOpen(true);
  };

  const save = async () => {
    const username = getUsernameFromStorage();
    const orgId = (authContext as any)?.org_id;

    if (!username) {
      enqueueSnackbar("Username missing", { variant: "error" });
      return;
    }
    if (!orgId) {
      enqueueSnackbar("Organisation context missing", { variant: "error" });
      return;
    }

    const device_code = normalizeDeviceCode(form.device_code);
    const payloadBase: Record<string, any> = {
      org_id: String(orgId),
      mandi_id: Number(form.mandi_id),
      gate_id: String(form.gate_id),
      device_code,
      device_label: form.device_label?.trim() ? form.device_label.trim() : undefined,
      device_type: form.device_type,
      status: form.status,
    };

    setSaving(true);
    try {
      if (dialogMode === "add") {
        const resp = await createGateDevice({
          username,
          language: "en",
          payload: payloadBase,
        });
        if (!resp?.ok) {
          enqueueSnackbar(resp?.description || "Failed to create device", { variant: "error" });
          return;
        }
        enqueueSnackbar(resp.description || "Device created", { variant: "success" });
      } else {
        const resp = await updateGateDevice({
          username,
          language: "en",
          payload: {
            org_id: String(orgId),
            mandi_id: Number(form.mandi_id),
            device_code,
            device_label: payloadBase.device_label,
            device_type: payloadBase.device_type,
            status: payloadBase.status,
          },
        });
        if (!resp?.ok) {
          enqueueSnackbar(resp?.description || "Failed to update device", { variant: "error" });
          return;
        }
        enqueueSnackbar(resp.description || "Device updated", { variant: "success" });
      }

      setDialogOpen(false);
      refresh();
    } catch (e: any) {
      enqueueSnackbar(e?.message || "Save failed", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row: DeviceRow) => {
    const username = getUsernameFromStorage();
    const orgId = (authContext as any)?.org_id;

    if (!username) {
      enqueueSnackbar("Username missing", { variant: "error" });
      return;
    }
    if (!orgId) {
      enqueueSnackbar("Organisation context missing", { variant: "error" });
      return;
    }

    const isActive = String(row.status || "").toUpperCase() === "ACTIVE";

    try {
      if (isActive) {
        const resp = await deactivateGateDevice({
          username,
          language: "en",
          device_code: row.device_code,
          org_id: String(orgId),
          mandi_id: Number(row.mandi_id),
        });
        if (!resp?.ok) {
          enqueueSnackbar(resp?.description || "Failed to deactivate", { variant: "error" });
          return;
        }
        enqueueSnackbar(resp.description || "Device deactivated", { variant: "success" });
      } else {
        const resp = await updateGateDevice({
          username,
          language: "en",
          payload: {
            org_id: String(orgId),
            mandi_id: Number(row.mandi_id),
            device_code: row.device_code,
            status: "ACTIVE",
          },
        });
        if (!resp?.ok) {
          enqueueSnackbar(resp?.description || "Failed to activate", { variant: "error" });
          return;
        }
        enqueueSnackbar(resp.description || "Device activated", { variant: "success" });
      }

      refresh();
    } catch (e: any) {
      enqueueSnackbar(e?.message || "Failed to update status", { variant: "error" });
    }
  };

  const columns = useMemo<GridColDef<DeviceRow>[]>(() => {
    const cols: GridColDef<DeviceRow>[] = [
      { field: "device_code", headerName: "Device Code", width: 240 },
      {
        field: "device_label",
        headerName: "Label",
        width: 260,
        renderCell: (params) => safeLabel((params.row as any)?.device_label),
      },
      {
        field: "device_type",
        headerName: "Type",
        width: 180,
        renderCell: (params) => safeLabel(safeType((params.row as any)?.device_type)),
      },
      {
        field: "gate_code",
        headerName: "Gate",
        width: 140,
        renderCell: (params) => safeLabel((params.row as any)?.gate_code),
      },
      {
        field: "status",
        headerName: "Status",
        width: 140,
        renderCell: (params) => safeLabel((params.row as any)?.status),
      },
      {
        field: "last_seen_on",
        headerName: "Last Seen",
        width: 200,
        renderCell: (params) => {
          const v = (params.row as any)?.last_seen_on;
          return v ? new Date(String(v)).toLocaleString() : "—";
        },
      },
    ];

    // Inline actions (same style as Admin Users)
    if (showActions) {
      cols.push({
        field: "actions",
        headerName: "",
        width: 110,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const row = params.row as any as DeviceRow;
          const isActive = String(row.status || "").toUpperCase() === "ACTIVE";

          return (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <ActionGate resourceKey="cm_gate_devices.edit" action="UPDATE" record={row}>
                <Tooltip title="Edit">
                  <IconButton size="small" onClick={() => openEdit(row)}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ActionGate>

              <ActionGate resourceKey="cm_gate_devices.deactivate" action="DEACTIVATE" record={row}>
                <Tooltip title={isActive ? "Deactivate" : "Activate"}>
                  <IconButton size="small" onClick={() => toggleActive(row)}>
                    {isActive ? <ToggleOffOutlinedIcon fontSize="small" /> : <ToggleOnOutlinedIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              </ActionGate>
            </Stack>
          );
        },
      });
    }

    return cols;
  }, [showActions]);

  const selectedOrgLabel =
    org?.org_name || org?.org_code || (authContext as any)?.org_name || (authContext as any)?.org_code;

  const showSelectHint = !mandiId || !gateId;

  return (
    <PageContainer>
      <Stack spacing={1} mb={2}>
        <Typography variant="h5">Gate Devices</Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          {selectedOrgLabel ? <Chip size="small" label={`Org: ${selectedOrgLabel}`} /> : null}
          <Typography variant="body2" color="text.secondary">
            Configure devices for gate operations
          </Typography>
        </Stack>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            alignItems={{ xs: "stretch", md: "center" }}
            sx={{
              "& .MuiAutocomplete-root": { minWidth: { xs: "100%", md: 260 } },
              "& .MuiTextField-root": { minWidth: { xs: "100%", md: 200 } },
            }}
          >
            <Autocomplete
              fullWidth
              loading={loading}
              options={mandis}
              value={selectedMandi}
              onChange={(_, value) => onSelectMandi(value)}
              getOptionLabel={(o) => o?.name_i18n?.en || o?.label || o?.mandi_slug || String(o?.mandi_id || "")}
              isOptionEqualToValue={(a, b) => String(a?.mandi_id) === String(b?.mandi_id)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Mandi"
                  size="small"
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {loading ? <CircularProgress color="inherit" size={16} /> : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />

            <TextField
              select
              fullWidth
              label="Gate"
              size="small"
              value={gateId}
              onChange={(e) => setGateId(e.target.value)}
              disabled={!mandiId}
              helperText={!mandiId ? "Select mandi first" : gates.length === 0 ? "No gates" : ""}
            >
              <option value="" />
              {gates.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.gate_code}
                </option>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              label="Device Type"
              size="small"
              value={deviceType}
              onChange={(e) => setDeviceType(e.target.value)}
            >
              <option value="" />
              {deviceTypes.map((t) => (
                <option key={t} value={t}>
                  {safeType(t)}
                </option>
              ))}
            </TextField>

            <TextField
              fullWidth
              label="Search"
              size="small"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
            />

            <Box sx={{ flex: "0 0 auto", width: { xs: "100%", md: "auto" } }}>
              <ActionGate resourceKey="cm_gate_devices.create" action="CREATE">
                <Button fullWidth={isMobile} variant="contained" size="small" startIcon={<AddIcon />} onClick={openAdd}>
                  Add Device
                </Button>
              </ActionGate>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {showSelectHint ? (
            <Typography variant="body2" color="text.secondary">
              Select <b>Mandi</b> and <b>Gate</b> to view devices.
            </Typography>
          ) : null}

          <Divider sx={{ my: 1 }} />

          {isMobile ? (
            <Stack spacing={1}>
              {devices.map((r) => {
                const isActive = String(r.status || "").toUpperCase() === "ACTIVE";
                return (
                  <Card key={r.id} variant="outlined">
                    <CardContent sx={{ pb: 1.5 }}>
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                        <Box>
                          <Typography variant="subtitle2">{r.device_code}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {safeLabel(r.device_label)}
                          </Typography>
                        </Box>

                        {showActions ? (
                          <Stack direction="row" spacing={0.5} alignItems="center">
                            <ActionGate resourceKey="cm_gate_devices.edit" action="UPDATE" record={r}>
                              <Tooltip title="Edit">
                                <IconButton size="small" onClick={() => openEdit(r)}>
                                  <EditOutlinedIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </ActionGate>

                            <ActionGate resourceKey="cm_gate_devices.deactivate" action="DEACTIVATE" record={r}>
                              <Tooltip title={isActive ? "Deactivate" : "Activate"}>
                                <IconButton size="small" onClick={() => toggleActive(r)}>
                                  {isActive ? (
                                    <ToggleOffOutlinedIcon fontSize="small" />
                                  ) : (
                                    <ToggleOnOutlinedIcon fontSize="small" />
                                  )}
                                </IconButton>
                              </Tooltip>
                            </ActionGate>
                          </Stack>
                        ) : null}
                      </Stack>

                      <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                        <Chip size="small" label={`Type: ${safeLabel(safeType(r.device_type))}`} />
                        <Chip size="small" label={`Gate: ${safeLabel(r.gate_code)}`} />
                        <Chip size="small" label={`Status: ${safeLabel(r.status)}`} />
                      </Stack>

                      <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                        Last Seen: {r.last_seen_on ? new Date(String(r.last_seen_on)).toLocaleString() : "—"}
                      </Typography>
                    </CardContent>
                  </Card>
                );
              })}

              {totalCount > pageSize ? (
                <Stack direction="row" justifyContent="center" mt={1}>
                  <Pagination
                    count={Math.max(1, Math.ceil(totalCount / pageSize))}
                    page={page}
                    onChange={(_, p) => setPage(p)}
                    size="small"
                  />
                </Stack>
              ) : null}
            </Stack>
          ) : (
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <ResponsiveDataGrid
                columns={columns}
                rows={devices}
                loading={loading}
                getRowId={(r: any) => r.id}
                autoHeight
                paginationMode="server"
                rowCount={totalCount}
                paginationModel={{ page: page - 1, pageSize }}
                onPaginationModelChange={(model: any) => {
                  setPage(model.page + 1);
                  if (model.pageSize !== pageSize) {
                    setPageSize(model.pageSize);
                    setPage(1);
                  }
                }}
                pageSizeOptions={[10, 20, 50]}
                minWidth={980}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit dialog */}
      <Dialog open={dialogOpen} onClose={() => (!saving ? setDialogOpen(false) : null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {dialogMode === "add" ? "Add Device" : "Edit Device"}
          <IconButton size="small" onClick={() => (!saving ? setDialogOpen(false) : null)} aria-label="close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Device Code"
              size="small"
              value={form.device_code}
              onChange={(e) => setForm((f) => ({ ...f, device_code: normalizeDeviceCode(e.target.value) }))}
              disabled={dialogMode === "edit"}
              helperText="Example: phone_orgadmin_gate01_gps"
            />

            <TextField
              label="Device Label"
              size="small"
              value={form.device_label}
              onChange={(e) => setForm((f) => ({ ...f, device_label: e.target.value }))}
            />

            <TextField
              select
              label="Device Type"
              size="small"
              value={form.device_type}
              onChange={(e) => setForm((f) => ({ ...f, device_type: e.target.value }))}
            >
              {deviceTypes.map((t) => (
                <option key={t} value={t}>
                  {safeType(t)}
                </option>
              ))}
            </TextField>

            <TextField
              select
              label="Status"
              size="small"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))}
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </TextField>

            <Autocomplete
              disabled={dialogMode === "edit"}
              options={mandis}
              value={mandis.find((m) => String(m.mandi_id) === String(form.mandi_id)) || null}
              onChange={(_, value) => {
                setForm((f) => ({ ...f, mandi_id: value?.mandi_id ?? "", gate_id: "" }));
              }}
              getOptionLabel={(o) => o?.name_i18n?.en || o?.label || o?.mandi_slug || String(o?.mandi_id || "")}
              isOptionEqualToValue={(a, b) => String(a?.mandi_id) === String(b?.mandi_id)}
              renderInput={(params) => <TextField {...params} label="Mandi" size="small" />}
            />

            <TextField
              select
              label="Gate"
              size="small"
              value={form.gate_id}
              onChange={(e) => setForm((f) => ({ ...f, gate_id: e.target.value }))}
              disabled={!form.mandi_id || dialogMode === "edit"}
              helperText={!form.mandi_id ? "Select mandi first" : gates.length === 0 ? "No gates" : ""}
            >
              <option value="" />
              {gates.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.gate_code}
                </option>
              ))}
            </TextField>
          </Stack>
        </DialogContent>

        <DialogActions>
          <Button variant="outlined" onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancel
          </Button>

          <Button
            variant="contained"
            onClick={save}
            disabled={
              saving ||
              !String(form.device_code || "").trim() ||
              !String(form.device_type || "").trim() ||
              !form.mandi_id ||
              !String(form.gate_id || "").trim()
            }
          >
            {saving ? "Saving…" : dialogMode === "add" ? "Save" : "Update"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};

export default GateDevicesPage;


// import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import {
//   Autocomplete,
//   Box,
//   Button,
//   Card,
//   CardContent,
//   Chip,
//   CircularProgress,
//   Dialog,
//   DialogActions,
//   DialogContent,
//   DialogTitle,
//   Divider,
//   IconButton,
//   Menu,
//   MenuItem,
//   Pagination,
//   Stack,
//   TextField,
//   Typography,
//   useMediaQuery,
//   useTheme,
// } from "@mui/material";
// import { type GridColDef } from "@mui/x-data-grid";
// import AddIcon from "@mui/icons-material/Add";
// import CloseIcon from "@mui/icons-material/Close";
// import MoreVertIcon from "@mui/icons-material/MoreVert";

// import { PageContainer } from "../../components/PageContainer";
// import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";

// import {
//   fetchGateDevicesBootstrap,
//   createGateDevice,
//   updateGateDevice,
//   deactivateGateDevice,
// } from "../../services/gateApi";

// import { useSnackbar } from "notistack";
// import { usePermissions } from "../../authz/usePermissions";
// import { ActionGate } from "../../authz/ActionGate";

// type MandiOption = {
//   mandi_id: number;
//   mandi_slug?: string;
//   label?: string;
//   name_i18n?: Record<string, string>;
// };

// type GateOption = {
//   _id: string;
//   gate_code: string;
//   name_i18n?: Record<string, string>;
//   is_active?: string;
// };

// type DeviceRow = {
//   id: string;
//   _id: string;

//   org_id?: string;
//   mandi_id: number;
//   gate_id: string;

//   device_code: string;
//   device_label?: string | null;
//   device_type?: string | null;
//   status?: string | null;

//   gate_code?: string | null;
//   last_seen_on?: string | null;
//   updated_on?: string | null;
// };

// function safeLabel(val: any, fallback = "—") {
//   const s = val === null || val === undefined ? "" : String(val);
//   return s.trim() ? s : fallback;
// }

// function safeType(v: any): string {
//   return String(v || "").split("_").join(" ");
// }

// function getUsernameFromStorage(): string | null {
//   if (typeof window === "undefined") return null;
//   return (
//     localStorage.getItem("cm_username") ||
//     localStorage.getItem("cd_username") ||
//     (() => {
//       try {
//         const raw = localStorage.getItem("cd_user");
//         const parsed = raw ? JSON.parse(raw) : null;
//         return parsed?.username || null;
//       } catch {
//         return null;
//       }
//     })()
//   );
// }

// function normalizeDeviceCode(input: string) {
//   return (input || "")
//     .trim()
//     .toLowerCase()
//     .replace(/\s+/g, "_")
//     .replace(/[^a-z0-9_-]/g, "_")
//     .replace(/_+/g, "_");
// }

// const GateDevicesPage: React.FC = () => {
//   const theme = useTheme();
//   const isMobile = useMediaQuery(theme.breakpoints.down("md"));
//   const { enqueueSnackbar } = useSnackbar();
//   const { authContext, can } = usePermissions();

//   const orgId = String((authContext as any)?.org_id || "");

//   // RBAC (canonical keys used across this project)
//   const canCreate = can("cm_gate_devices.create", "CREATE");
//   const canEdit = can("cm_gate_devices.edit", "UPDATE");
//   const canToggle = can("cm_gate_devices.deactivate", "DEACTIVATE");

//   // Single query state (primitives only)
//   const [mandiId, setMandiId] = useState<number | "">("");
//   const [gateId, setGateId] = useState<string>("");
//   const [deviceType, setDeviceType] = useState<string>("");
//   const [searchInput, setSearchInput] = useState<string>("");
//   const [debouncedSearch, setDebouncedSearch] = useState<string>("");

//   // Pagination
//   const [page, setPage] = useState<number>(1);
//   const [pageSize, setPageSize] = useState<number>(20);
//   const [totalCount, setTotalCount] = useState<number>(0);

//   // Bootstrap data
//   const [org, setOrg] = useState<{ org_id?: string; org_code?: string; org_name?: string }>({});
//   const [mandis, setMandis] = useState<MandiOption[]>([]);
//   const [gates, setGates] = useState<GateOption[]>([]);
//   const [deviceTypes, setDeviceTypes] = useState<string[]>([]);
//   const [devices, setDevices] = useState<DeviceRow[]>([]);

//   const [loading, setLoading] = useState<boolean>(false);

//   // Explicit refresh trigger (for create/update/deactivate actions)
//   const [refreshTick, setRefreshTick] = useState<number>(0);

//   // Dialog state
//   const [dialogOpen, setDialogOpen] = useState(false);
//   const [dialogMode, setDialogMode] = useState<"add" | "edit">("add");
//   const [saving, setSaving] = useState(false);
//   const [editingId, setEditingId] = useState<string | null>(null);

//   const [form, setForm] = useState({
//     mandi_id: "" as number | "",
//     gate_id: "" as string,
//     device_code: "" as string,
//     device_label: "" as string,
//     device_type: "" as string,
//     status: "ACTIVE" as "ACTIVE" | "INACTIVE",
//   });

//   // Row menu
//   const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
//   const [menuRow, setMenuRow] = useState<DeviceRow | null>(null);

//   const openMenu = (e: React.MouseEvent<HTMLElement>, row: DeviceRow) => {
//     setMenuAnchor(e.currentTarget);
//     setMenuRow(row);
//   };
//   const closeMenu = () => {
//     setMenuAnchor(null);
//     setMenuRow(null);
//   };

//   // Inflight guard (dedupe / mutex)
//   const inflightRef = useRef<Promise<any> | null>(null);
//   const inflightKeyRef = useRef<string>("");
//   const lastCompletedKeyRef = useRef<string>("");

//   const selectedMandi = useMemo(() => {
//     if (!mandiId) return null;
//     return mandis.find((m) => String(m.mandi_id) === String(mandiId)) || null;
//   }, [mandis, mandiId]);

//   const selectedGate = useMemo(() => {
//     if (!gateId) return null;
//     return gates.find((g) => String(g._id) === String(gateId)) || null;
//   }, [gates, gateId]);

//   // Debounce search input
//   useEffect(() => {
//     const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), 350);
//     return () => clearTimeout(t);
//   }, [searchInput]);

//   // Reset page on filter/search changes
//   useEffect(() => {
//     setPage(1);
//   }, [mandiId, gateId, deviceType, debouncedSearch]);

//   // ✅ Single effect that fetches bootstrap (depends on primitives only)
//   useEffect(() => {
//     const username = getUsernameFromStorage();
//     if (!username) return;

//     const reqKey = JSON.stringify({
//       org_id: orgId,
//       mandi_id: mandiId || "",
//       gate_id: gateId || "",
//       device_type: deviceType || "",
//       search: debouncedSearch || "",
//       page,
//       pageSize,
//     });

//     // Dedupe: same inflight request
//     if (inflightRef.current && inflightKeyRef.current === reqKey) return;
//     // Dedupe: same as last completed (prevents StrictMode/prod re-renders)
//     if (lastCompletedKeyRef.current === reqKey) return;

//     setLoading(true);

//     const p = (async () => {
//       const resp = await fetchGateDevicesBootstrap({
//         username,
//         language: "en",
//         filters: {
//           mandi_id: mandiId ? Number(mandiId) : undefined,
//           gate_id: gateId ? String(gateId) : undefined,
//           device_type: deviceType || undefined,
//           search: debouncedSearch || undefined,
//           page,
//           pageSize,
//         },
//       });

//       if (!resp?.ok) {
//         setDevices([]);
//         setTotalCount(0);
//         enqueueSnackbar(resp?.description || "Failed to load gate devices", { variant: "error" });
//         return;
//       }

//       const data = resp.data || {};
//       setOrg(data.org || {});
//       setMandis(data.mandis?.items || []);
//       setGates(data.gates?.items || []);
//       setDeviceTypes(data.device_types?.items || []);

//       const list: any[] = data.devices?.items || [];
//       const meta = data.devices?.meta || {};
//       setDevices(
//         list.map((d) => ({
//           ...d,
//           id: String(d._id || d.device_code),
//         })),
//       );
//       setTotalCount(Number(meta.totalCount || 0));
//     })();

//     inflightRef.current = p;
//     inflightKeyRef.current = reqKey;
//     lastCompletedKeyRef.current = ""; // clear until this finishes

//     (async () => {
//       try {
//         await p;
//         lastCompletedKeyRef.current = reqKey;
//       } finally {
//         inflightRef.current = null;
//         inflightKeyRef.current = "";
//         setLoading(false);
//       }
//     })();
//   }, [orgId, mandiId, gateId, deviceType, debouncedSearch, page, pageSize, refreshTick, enqueueSnackbar]);

//   // Manual refresh helper for actions (does not affect effect deps)
//   const refresh = useCallback(() => {
//     // allow a re-fetch even if key is same
//     lastCompletedKeyRef.current = "";
//     // bump tick to trigger effect
//     setRefreshTick((t) => t + 1);
//   }, []);

//   // UX: when mandi changes, clear gate; gates come back from bootstrap for mandi
//   const onSelectMandi = (m: MandiOption | null) => {
//     setMandiId(m?.mandi_id ?? "");
//     setGateId("");
//   };

//   const openAdd = () => {
//     setDialogMode("add");
//     setEditingId(null);
//     setForm({
//       mandi_id: mandiId || "",
//       gate_id: gateId || "",
//       device_code: "",
//       device_label: "",
//       device_type: deviceType || "GPS_PHONE",
//       status: "ACTIVE",
//     });
//     setDialogOpen(true);
//   };

//   const openEdit = (row: DeviceRow) => {
//     setDialogMode("edit");
//     setEditingId(row._id);
//     setForm({
//       mandi_id: row.mandi_id,
//       gate_id: row.gate_id,
//       device_code: row.device_code,
//       device_label: row.device_label ? String(row.device_label) : "",
//       device_type: row.device_type ? String(row.device_type) : "",
//       status: (String(row.status || "ACTIVE").toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE") as any,
//     });
//     setDialogOpen(true);
//   };

//   const save = async () => {
//     const username = getUsernameFromStorage();
//     const orgId = (authContext as any)?.org_id;

//     if (!username) {
//       enqueueSnackbar("Username missing", { variant: "error" });
//       return;
//     }
//     if (!orgId) {
//       enqueueSnackbar("Organisation context missing", { variant: "error" });
//       return;
//     }

//     // normalize device_code client-side too (server also normalizes)
//     const device_code = normalizeDeviceCode(form.device_code);
//     const payloadBase: Record<string, any> = {
//       org_id: String(orgId),
//       mandi_id: Number(form.mandi_id),
//       gate_id: String(form.gate_id),
//       device_code,
//       device_label: form.device_label?.trim() ? form.device_label.trim() : undefined,
//       device_type: form.device_type,
//       status: form.status,
//     };

//     setSaving(true);
//     try {
//       if (dialogMode === "add") {
//         const resp = await createGateDevice({
//           username,
//           language: "en",
//           payload: payloadBase,
//         });
//         if (!resp?.ok) {
//           enqueueSnackbar(resp?.description || "Failed to create device", { variant: "error" });
//           return;
//         }
//         enqueueSnackbar(resp.description || "Device created", { variant: "success" });
//       } else {
//         // device_code is primary key in many flows; keep as is during edit
//         const resp = await updateGateDevice({
//           username,
//           language: "en",
//           payload: {
//             org_id: String(orgId),
//             mandi_id: Number(form.mandi_id),
//             device_code,
//             device_label: payloadBase.device_label,
//             device_type: payloadBase.device_type,
//             status: payloadBase.status,
//           },
//         });
//         if (!resp?.ok) {
//           enqueueSnackbar(resp?.description || "Failed to update device", { variant: "error" });
//           return;
//         }
//         enqueueSnackbar(resp.description || "Device updated", { variant: "success" });
//       }

//       setDialogOpen(false);
//       refresh();
//     } catch (e: any) {
//       enqueueSnackbar(e?.message || "Save failed", { variant: "error" });
//     } finally {
//       setSaving(false);
//     }
//   };

//   const toggleActive = async (row: DeviceRow) => {
//     const username = getUsernameFromStorage();
//     const orgId = (authContext as any)?.org_id;

//     if (!username) {
//       enqueueSnackbar("Username missing", { variant: "error" });
//       return;
//     }
//     if (!orgId) {
//       enqueueSnackbar("Organisation context missing", { variant: "error" });
//       return;
//     }

//     const isActive = String(row.status || "").toUpperCase() === "ACTIVE";

//     try {
//       if (isActive) {
//         const resp = await deactivateGateDevice({
//           username,
//           language: "en",
//           device_code: row.device_code,
//           org_id: String(orgId),
//           mandi_id: Number(row.mandi_id),
//         });
//         if (!resp?.ok) {
//           enqueueSnackbar(resp?.description || "Failed to deactivate", { variant: "error" });
//           return;
//         }
//         enqueueSnackbar(resp.description || "Device deactivated", { variant: "success" });
//       } else {
//         const resp = await updateGateDevice({
//           username,
//           language: "en",
//           payload: {
//             org_id: String(orgId),
//             mandi_id: Number(row.mandi_id),
//             device_code: row.device_code,
//             status: "ACTIVE",
//           },
//         });
//         if (!resp?.ok) {
//           enqueueSnackbar(resp?.description || "Failed to activate", { variant: "error" });
//           return;
//         }
//         enqueueSnackbar(resp.description || "Device activated", { variant: "success" });
//       }

//       closeMenu();
//       refresh();
//     } catch (e: any) {
//       enqueueSnackbar(e?.message || "Failed to update status", { variant: "error" });
//     }
//   };

//   const columns = useMemo<GridColDef<DeviceRow>[]>(
//     () => {
//       const cols: GridColDef<DeviceRow>[] = [
//       { field: "device_code", headerName: "Device Code", width: 240 },
//       {
//         field: "device_label",
//         headerName: "Label",
//         width: 260,
//         renderCell: (params) => safeLabel((params.row as any)?.device_label),
//       },
//       {
//         field: "device_type",
//         headerName: "Type",
//         width: 180,
//         renderCell: (params) => safeLabel(safeType((params.row as any)?.device_type)),
//       },
//       {
//         field: "gate_code",
//         headerName: "Gate",
//         width: 140,
//         renderCell: (params) => safeLabel((params.row as any)?.gate_code),
//       },
//       {
//         field: "status",
//         headerName: "Status",
//         width: 140,
//         renderCell: (params) => safeLabel((params.row as any)?.status),
//       },
//       {
//         field: "last_seen_on",
//         headerName: "Last Seen",
//         width: 200,
//         renderCell: (params) => {
//           const v = (params.row as any)?.last_seen_on;
//           return v ? new Date(String(v)).toLocaleString() : "—";
//         },
//       },
//       ];

//       if (canEdit || canToggle) {
//         cols.push({
//           field: "actions",
//           headerName: "",
//           width: 80,
//           sortable: false,
//           filterable: false,
//           renderCell: (params) => (
//             <IconButton size="small" onClick={(e) => openMenu(e, params.row as any)}>
//               <MoreVertIcon fontSize="small" />
//             </IconButton>
//           ),
//         });
//       }

//       return cols;
//     },
//     [canEdit, canToggle],
//   );

//   const selectedOrgLabel = org?.org_name || org?.org_code || (authContext as any)?.org_name || (authContext as any)?.org_code;

//   const showSelectHint = !mandiId || !gateId;

//   return (
//     <PageContainer>
//       <Stack spacing={1} mb={2}>
//         <Typography variant="h5">Gate Devices</Typography>
//         <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
//           {selectedOrgLabel ? <Chip size="small" label={`Org: ${selectedOrgLabel}`} /> : null}
//           <Typography variant="body2" color="text.secondary">
//             Configure devices for gate operations
//           </Typography>
//         </Stack>
//       </Stack>

//       <Card sx={{ mb: 2 }}>
//         <CardContent>
//           <Stack
//             direction={{ xs: "column", md: "row" }}
//             spacing={1}
//             alignItems={{ xs: "stretch", md: "center" }}
//             sx={{
//               "& .MuiAutocomplete-root": { minWidth: { xs: "100%", md: 260 } },
//               "& .MuiTextField-root": { minWidth: { xs: "100%", md: 200 } },
//             }}
//           >
//             <Autocomplete
//               fullWidth
//               loading={loading}
//               options={mandis}
//               value={selectedMandi}
//               onChange={(_, value) => onSelectMandi(value)}
//               getOptionLabel={(o) => o?.name_i18n?.en || o?.label || o?.mandi_slug || String(o?.mandi_id || "")}
//               isOptionEqualToValue={(a, b) => String(a?.mandi_id) === String(b?.mandi_id)}
//               renderInput={(params) => (
//                 <TextField
//                   {...params}
//                   label="Mandi"
//                   size="small"
//                   InputProps={{
//                     ...params.InputProps,
//                     endAdornment: (
//                       <>
//                         {loading ? <CircularProgress color="inherit" size={16} /> : null}
//                         {params.InputProps.endAdornment}
//                       </>
//                     ),
//                   }}
//                 />
//               )}
//             />

//             <TextField
//               select
//               fullWidth
//               label="Gate"
//               size="small"
//               value={gateId}
//               onChange={(e) => setGateId(e.target.value)}
//               disabled={!mandiId}
//               helperText={!mandiId ? "Select mandi first" : gates.length === 0 ? "No gates" : ""}
//             >
//               <MenuItem value="">Select</MenuItem>
//               {gates.map((g) => (
//                 <MenuItem key={g._id} value={g._id}>
//                   {g.gate_code}
//                 </MenuItem>
//               ))}
//             </TextField>

//             <TextField
//               select
//               fullWidth
//               label="Device Type"
//               size="small"
//               value={deviceType}
//               onChange={(e) => setDeviceType(e.target.value)}
//             >
//               <MenuItem value="">All</MenuItem>
//               {deviceTypes.map((t) => (
//                 <MenuItem key={t} value={t}>
//                   {safeType(t)}
//                 </MenuItem>
//               ))}
//             </TextField>

//             <TextField
//               fullWidth
//               label="Search"
//               size="small"
//               value={searchInput}
//               onChange={(e) => setSearchInput(e.target.value)}
//             />

//             <Box sx={{ flex: "0 0 auto", width: { xs: "100%", md: "auto" } }}>
//               <ActionGate resourceKey="cm_gate_devices.create" action="CREATE">
//                 <Button fullWidth={isMobile} variant="contained" size="small" startIcon={<AddIcon />} onClick={openAdd}>
//                   Add Device
//                 </Button>
//               </ActionGate>
//             </Box>
//           </Stack>
//         </CardContent>
//       </Card>

//       <Card>
//         <CardContent>
//           {showSelectHint ? (
//             <Typography variant="body2" color="text.secondary">
//               Select <b>Mandi</b> and <b>Gate</b> to view devices.
//             </Typography>
//           ) : null}

//           <Divider sx={{ my: 1 }} />

//           {isMobile ? (
//             <Stack spacing={1}>
//               {devices.map((r) => (
//                 <Card key={r.id} variant="outlined">
//                   <CardContent sx={{ pb: 1.5 }}>
//                     <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
//                       <Box>
//                         <Typography variant="subtitle2">{r.device_code}</Typography>
//                         <Typography variant="body2" color="text.secondary">
//                           {safeLabel(r.device_label)}
//                         </Typography>
//                       </Box>
//                       {canEdit || canToggle ? (
//                         <IconButton size="small" onClick={(e) => openMenu(e, r)}>
//                           <MoreVertIcon fontSize="small" />
//                         </IconButton>
//                       ) : null}
//                     </Stack>

//                     <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
//                       <Chip size="small" label={`Type: ${safeLabel(safeType(r.device_type))}`} />
//                       <Chip size="small" label={`Gate: ${safeLabel(r.gate_code)}`} />
//                       <Chip size="small" label={`Status: ${safeLabel(r.status)}`} />
//                     </Stack>

//                     <Typography variant="caption" color="text.secondary" display="block" mt={1}>
//                       Last Seen: {r.last_seen_on ? new Date(String(r.last_seen_on)).toLocaleString() : "—"}
//                     </Typography>
//                   </CardContent>
//                 </Card>
//               ))}

//               {totalCount > pageSize ? (
//                 <Stack direction="row" justifyContent="center" mt={1}>
//                   <Pagination
//                     count={Math.max(1, Math.ceil(totalCount / pageSize))}
//                     page={page}
//                     onChange={(_, p) => setPage(p)}
//                     size="small"
//                   />
//                 </Stack>
//               ) : null}
//             </Stack>
//           ) : (
//             <Box sx={{ width: "100%", overflowX: "auto" }}>
//               <ResponsiveDataGrid
//                 columns={columns}
//                 rows={devices}
//                 loading={loading}
//                 getRowId={(r: any) => r.id}
//                 autoHeight
//                 paginationMode="server"
//                 rowCount={totalCount}
//                 paginationModel={{ page: page - 1, pageSize }}
//                 onPaginationModelChange={(model: any) => {
//                   setPage(model.page + 1);
//                   if (model.pageSize !== pageSize) {
//                     setPageSize(model.pageSize);
//                     setPage(1);
//                   }
//                 }}
//                 pageSizeOptions={[10, 20, 50]}
//                 minWidth={980}
//               />
//             </Box>
//           )}
//         </CardContent>
//       </Card>

//       {/* Row actions */}
//       <Menu
//         anchorEl={menuAnchor}
//         open={Boolean(menuAnchor)}
//         onClose={closeMenu}
//         anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
//         transformOrigin={{ vertical: "top", horizontal: "right" }}
//       >
//         <ActionGate resourceKey="cm_gate_devices.edit" action="UPDATE" record={menuRow}>
//           <MenuItem
//             onClick={() => {
//               if (menuRow) openEdit(menuRow);
//               closeMenu();
//             }}
//           >
//             Edit
//           </MenuItem>
//         </ActionGate>

//         <ActionGate resourceKey="cm_gate_devices.deactivate" action="DEACTIVATE" record={menuRow}>
//           <MenuItem
//             onClick={() => {
//               if (menuRow) toggleActive(menuRow);
//               closeMenu();
//             }}
//           >
//             {String(menuRow?.status || "").toUpperCase() === "ACTIVE" ? "Deactivate" : "Activate"}
//           </MenuItem>
//         </ActionGate>
//       </Menu>

//       {/* Add/Edit dialog */}
//       <Dialog open={dialogOpen} onClose={() => (!saving ? setDialogOpen(false) : null)} fullWidth maxWidth="sm">
//         <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
//           {dialogMode === "add" ? "Add Device" : "Edit Device"}
//           <IconButton size="small" onClick={() => (!saving ? setDialogOpen(false) : null)} aria-label="close">
//             <CloseIcon fontSize="small" />
//           </IconButton>
//         </DialogTitle>

//         <DialogContent dividers>
//           <Stack spacing={2} mt={1}>
//             <TextField
//               label="Device Code"
//               size="small"
//               value={form.device_code}
//               onChange={(e) => setForm((f) => ({ ...f, device_code: normalizeDeviceCode(e.target.value) }))}
//               disabled={dialogMode === "edit"}
//               helperText="Example: phone_orgadmin_gate01_gps"
//             />

//             <TextField
//               label="Device Label"
//               size="small"
//               value={form.device_label}
//               onChange={(e) => setForm((f) => ({ ...f, device_label: e.target.value }))}
//             />

//             <TextField
//               select
//               label="Device Type"
//               size="small"
//               value={form.device_type}
//               onChange={(e) => setForm((f) => ({ ...f, device_type: e.target.value }))}
//             >
//               {deviceTypes.map((t) => (
//                 <MenuItem key={t} value={t}>
//                   {safeType(t)}
//                 </MenuItem>
//               ))}
//             </TextField>

//             <TextField
//               select
//               label="Status"
//               size="small"
//               value={form.status}
//               onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))}
//             >
//               <MenuItem value="ACTIVE">ACTIVE</MenuItem>
//               <MenuItem value="INACTIVE">INACTIVE</MenuItem>
//             </TextField>

//             <Autocomplete
//               disabled={dialogMode === "edit"}
//               options={mandis}
//               value={mandis.find((m) => String(m.mandi_id) === String(form.mandi_id)) || null}
//               onChange={(_, value) => {
//                 setForm((f) => ({ ...f, mandi_id: value?.mandi_id ?? "", gate_id: "" }));
//               }}
//               getOptionLabel={(o) => o?.name_i18n?.en || o?.label || o?.mandi_slug || String(o?.mandi_id || "")}
//               isOptionEqualToValue={(a, b) => String(a?.mandi_id) === String(b?.mandi_id)}
//               renderInput={(params) => <TextField {...params} label="Mandi" size="small" />}
//             />

//             <TextField
//               select
//               label="Gate"
//               size="small"
//               value={form.gate_id}
//               onChange={(e) => setForm((f) => ({ ...f, gate_id: e.target.value }))}
//               disabled={!form.mandi_id || dialogMode === "edit"}
//               helperText={!form.mandi_id ? "Select mandi first" : gates.length === 0 ? "No gates" : ""}
//             >
//               <MenuItem value="">Select</MenuItem>
//               {gates.map((g) => (
//                 <MenuItem key={g._id} value={g._id}>
//                   {g.gate_code}
//                 </MenuItem>
//               ))}
//             </TextField>
//           </Stack>
//         </DialogContent>

//         <DialogActions>
//           <Button variant="outlined" onClick={() => setDialogOpen(false)} disabled={saving}>
//             Cancel
//           </Button>

//           <Button
//             variant="contained"
//             onClick={save}
//             disabled={
//               saving ||
//               !String(form.device_code || "").trim() ||
//               !String(form.device_type || "").trim() ||
//               !form.mandi_id ||
//               !String(form.gate_id || "").trim()
//             }
//           >
//             {saving ? "Saving…" : dialogMode === "add" ? "Save" : "Update"}
//           </Button>
//         </DialogActions>
//       </Dialog>
//     </PageContainer>
//   );
// };

// export default GateDevicesPage;
