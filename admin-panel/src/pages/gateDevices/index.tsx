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
  Menu,
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
import CloseIcon from "@mui/icons-material/Close";
import MoreVertIcon from "@mui/icons-material/MoreVert";

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
  const { authContext } = usePermissions();

  // Filters
  const [mandiId, setMandiId] = useState<number | "">("");
  const [gateId, setGateId] = useState<string>("");
  const [deviceType, setDeviceType] = useState<string>("");
  const [search, setSearch] = useState<string>("");

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

  // Row menu
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null);
  const [menuRow, setMenuRow] = useState<DeviceRow | null>(null);

  const openMenu = (e: React.MouseEvent<HTMLElement>, row: DeviceRow) => {
    setMenuAnchor(e.currentTarget);
    setMenuRow(row);
  };
  const closeMenu = () => {
    setMenuAnchor(null);
    setMenuRow(null);
  };

  // Inflight guard (dedupe)
  const inflightRef = useRef<Promise<any> | null>(null);
  const lastKeyRef = useRef<string>("");

  const selectedMandi = useMemo(() => {
    if (!mandiId) return null;
    return mandis.find((m) => String(m.mandi_id) === String(mandiId)) || null;
  }, [mandis, mandiId]);

  const selectedGate = useMemo(() => {
    if (!gateId) return null;
    return gates.find((g) => String(g._id) === String(gateId)) || null;
  }, [gates, gateId]);

  const callBootstrap = useCallback(
    async (opts?: { overrideSearch?: string }) => {
      const username = getUsernameFromStorage();
      if (!username) return;

      const reqKey = JSON.stringify({
        org_id: (authContext as any)?.org_id || "",
        mandi_id: mandiId || "",
        gate_id: gateId || "",
        device_type: deviceType || "",
        search: opts?.overrideSearch ?? search ?? "",
        page,
        pageSize,
      });

      if (inflightRef.current && lastKeyRef.current === reqKey) return;
      lastKeyRef.current = reqKey;

      setLoading(true);

      const p = (async () => {
        const resp = await fetchGateDevicesBootstrap({
          username,
          language: "en",
          filters: {
            mandi_id: mandiId ? Number(mandiId) : undefined,
            gate_id: gateId ? String(gateId) : undefined,
            device_type: deviceType || undefined,
            search: (opts?.overrideSearch ?? search) || undefined,
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
      try {
        await p;
      } finally {
        inflightRef.current = null;
        setLoading(false);
      }
    },
    [authContext, deviceType, enqueueSnackbar, gateId, mandiId, page, pageSize, search],
  );

  // Mount + filter change (search is debounced below)
  useEffect(() => {
    callBootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mandiId, gateId, deviceType, page, pageSize]);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      callBootstrap({ overrideSearch: search });
    }, 350);
    return () => clearTimeout(t);
  }, [search, callBootstrap]);

  // Reset page on filter changes
  useEffect(() => {
    setPage(1);
  }, [mandiId, gateId, deviceType, search]);

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

    // normalize device_code client-side too (server also normalizes)
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
        // device_code is primary key in many flows; keep as is during edit
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
      callBootstrap();
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

      closeMenu();
      callBootstrap();
    } catch (e: any) {
      enqueueSnackbar(e?.message || "Failed to update status", { variant: "error" });
    }
  };

  const columns = useMemo<GridColDef<DeviceRow>[]>(
    () => [
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
      {
        field: "actions",
        headerName: "",
        width: 80,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <IconButton size="small" onClick={(e) => openMenu(e, params.row as any)}>
            <MoreVertIcon fontSize="small" />
          </IconButton>
        ),
      },
    ],
    [],
  );

  const selectedOrgLabel = org?.org_name || org?.org_code || (authContext as any)?.org_name || (authContext as any)?.org_code;

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
              <MenuItem value="">Select</MenuItem>
              {gates.map((g) => (
                <MenuItem key={g._id} value={g._id}>
                  {g.gate_code}
                </MenuItem>
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
              <MenuItem value="">All</MenuItem>
              {deviceTypes.map((t) => (
                <MenuItem key={t} value={t}>
                  {safeType(t)}
                </MenuItem>
              ))}
            </TextField>

            <TextField fullWidth label="Search" size="small" value={search} onChange={(e) => setSearch(e.target.value)} />

            <Box sx={{ flex: "0 0 auto", width: { xs: "100%", md: "auto" } }}>
              <Button fullWidth={isMobile} variant="contained" size="small" startIcon={<AddIcon />} onClick={openAdd}>
                Add Device
              </Button>
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
              {devices.map((r) => (
                <Card key={r.id} variant="outlined">
                  <CardContent sx={{ pb: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Box>
                        <Typography variant="subtitle2">{r.device_code}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {safeLabel(r.device_label)}
                        </Typography>
                      </Box>
                      <IconButton size="small" onClick={(e) => openMenu(e, r)}>
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
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
              ))}

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

      {/* Row actions */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={closeMenu}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <MenuItem
          onClick={() => {
            if (menuRow) openEdit(menuRow);
            closeMenu();
          }}
        >
          Edit
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuRow) toggleActive(menuRow);
          }}
        >
          {String(menuRow?.status || "").toUpperCase() === "ACTIVE" ? "Deactivate" : "Activate"}
        </MenuItem>
      </Menu>

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
                <MenuItem key={t} value={t}>
                  {safeType(t)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Status"
              size="small"
              value={form.status}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as any }))}
            >
              <MenuItem value="ACTIVE">ACTIVE</MenuItem>
              <MenuItem value="INACTIVE">INACTIVE</MenuItem>
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
              <MenuItem value="">Select</MenuItem>
              {gates.map((g) => (
                <MenuItem key={g._id} value={g._id}>
                  {g.gate_code}
                </MenuItem>
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
// import { fetchGateDevicesBootstrap, createGateDevice } from "../../services/gateApi";
// import { useSnackbar } from "notistack";
// import { usePermissions } from "../../authz/usePermissions";

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
// };

// type DeviceRow = {
//   id: string;
//   device_code: string;
//   device_label?: string | null;
//   device_type?: string | null;
//   platform?: string | null;
//   linked_user?: string | null;
//   mandi_id?: number | null;
//   gate_id?: string | null;
//   gate_code?: string | null;
//   status?: string | null;
//   last_seen_on?: string | null;
//   updated_on?: string | null;
// };

// function currentUsername(): string | null {
//   try {
//     const raw = localStorage.getItem("cd_user");
//     const parsed = raw ? JSON.parse(raw) : null;
//     return parsed?.username || null;
//   } catch {
//     return null;
//   }
// }

// function currentOrgInfo() {
//   try {
//     const raw = localStorage.getItem("cd_user");
//     const parsed = raw ? JSON.parse(raw) : null;
//     return {
//       org_id: parsed?.org_id || null,
//       org_code: parsed?.org_code || null,
//       org_name:
//         parsed?.org_name ||
//         parsed?.org_name_en ||
//         parsed?.organisation_name ||
//         parsed?.org_code ||
//         null,
//     };
//   } catch {
//     return { org_id: null, org_code: null, org_name: null };
//   }
// }

// function toUiDeviceType(v: any): string {
//   return String(v || "");
// }

// export const GateDevices: React.FC = () => {
//   const theme = useTheme();
//   const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
//   const { authContext } = usePermissions();
//   const { enqueueSnackbar } = useSnackbar();

//   const initialOrg = currentOrgInfo();

//   const [filters, setFilters] = useState({
//     mandi_id: "" as string | number,
//     gate_id: "" as string, // empty = ALL gates
//     device_type: "" as string,
//     search: "" as string,
//   });

//   const [mandiOptions, setMandiOptions] = useState<MandiOption[]>([]);
//   const [gateOptions, setGateOptions] = useState<GateOption[]>([]);
//   const [deviceTypeOptions, setDeviceTypeOptions] = useState<string[]>([]);

//   const [bootstrapOrg, setBootstrapOrg] = useState<{ org_id?: string; org_code?: string; org_name?: string }>({});

//   const [rows, setRows] = useState<DeviceRow[]>([]);
//   const [page, setPage] = useState(1);
//   const [pageSize, setPageSize] = useState(20);
//   const [totalCount, setTotalCount] = useState(0);

//   const [loading, setLoading] = useState(false);

//   const [dialogOpen, setDialogOpen] = useState(false);
//   const [saving, setSaving] = useState(false);

//   const [form, setForm] = useState({
//     device_code: "",
//     device_label: "",
//     device_type: "",
//     mandi_id: "" as string | number,
//     gate_id: "",
//   });

//   const [dialogGateOptions, setDialogGateOptions] = useState<GateOption[]>([]);

//   // --- Inflight guard (prevents duplicate calls on mount / rapid filter changes)
//   const inflightRef = useRef<Promise<any> | null>(null);
//   const lastKeyRef = useRef<string>("");

//   const orgDisplayName =
//     bootstrapOrg.org_name ||
//     bootstrapOrg.org_code ||
//     (authContext as any).org_name ||
//     initialOrg.org_name ||
//     authContext.org_code ||
//     initialOrg.org_code ||
//     (authContext.org_id ? "Organisation" : "");

//   const selectedMandi = useMemo(() => {
//     return mandiOptions.find((m) => String(m.mandi_id) === String(filters.mandi_id)) || null;
//   }, [mandiOptions, filters.mandi_id]);

//   // ✅ FIXED: use renderCell instead of valueGetter
//   const columns = useMemo<GridColDef<DeviceRow>[]>(
//     () => [
//       { field: "device_code", headerName: "Device Code", width: 210 },
//       {
//         field: "device_label",
//         headerName: "Label",
//         width: 240,
//         renderCell: (params: any) => params?.row?.device_label || "—",
//       },
//       {
//         field: "device_type",
//         headerName: "Type",
//         width: 200,
//         renderCell: (params: any) => toUiDeviceType(params?.row?.device_type),
//       },
//       {
//         field: "gate_code",
//         headerName: "Gate",
//         width: 140,
//         renderCell: (params: any) => params?.row?.gate_code || "—",
//       },
//       {
//         field: "status",
//         headerName: "Status",
//         width: 120,
//         renderCell: (params: any) => params?.row?.status || "—",
//       },
//       {
//         field: "last_seen_on",
//         headerName: "Last Seen",
//         width: 200,
//         renderCell: (params: any) => {
//           const v = params?.row?.last_seen_on;
//           return v ? new Date(String(v)).toLocaleString() : "—";
//         },
//       },
//       {
//         field: "actions",
//         headerName: "",
//         width: 60,
//         sortable: false,
//         filterable: false,
//         renderCell: () => (
//           <IconButton size="small" aria-label="More">
//             <MoreVertIcon fontSize="small" />
//           </IconButton>
//         ),
//       },
//     ],
//     [],
//   );

//   const callBootstrap = useCallback(
//     async (opts: {
//       reason: string;
//       debouncedSearch?: string;
//       override?: Partial<{
//         mandi_id: string | number;
//         gate_id: string;
//         device_type: string;
//         search: string;
//         page: number;
//         pageSize: number;
//       }>;
//     } = { reason: "manual" }) => {
//       const username = currentUsername();
//       if (!username) return;

//       const mandi_id = opts.override?.mandi_id ?? filters.mandi_id;
//       const gate_id = opts.override?.gate_id ?? filters.gate_id;
//       const device_type = opts.override?.device_type ?? filters.device_type;
//       const search = opts.override?.search ?? (opts.debouncedSearch ?? filters.search);
//       const reqPage = opts.override?.page ?? page;
//       const reqPageSize = opts.override?.pageSize ?? pageSize;

//       const keyObj = {
//         org_id: authContext.org_id || initialOrg.org_id || "",
//         mandi_id: mandi_id || "",
//         gate_id: gate_id || "",
//         device_type: device_type || "",
//         search: search || "",
//         page: reqPage,
//         pageSize: reqPageSize,
//       };
//       const requestKey = JSON.stringify(keyObj);

//       if (inflightRef.current && lastKeyRef.current === requestKey) return;
//       lastKeyRef.current = requestKey;

//       setLoading(true);
//       const promise = (async () => {
//         const resp = await fetchGateDevicesBootstrap({
//           username,
//           language: "en",
//           filters: {
//             mandi_id: mandi_id ? Number(mandi_id) : undefined,
//             gate_id: gate_id ? String(gate_id) : undefined,
//             device_type: device_type || undefined,
//             search: search || undefined,
//             page: reqPage,
//             pageSize: reqPageSize,
//           },
//         });

//         if (!resp.ok) {
//           enqueueSnackbar(resp?.description || "Failed to load gate devices", { variant: "error" });
//           setMandiOptions([]);
//           setGateOptions([]);
//           setDeviceTypeOptions([]);
//           setRows([]);
//           setTotalCount(0);
//           return;
//         }

//         const data = resp.data?.data || resp.data || {};

//         setBootstrapOrg(data?.org || {});
//         setMandiOptions((data?.mandis?.items || []) as MandiOption[]);
//         setGateOptions((data?.gates?.items || []) as GateOption[]);
//         setDeviceTypeOptions((data?.device_types?.items || []) as string[]);

//         const devices = (data?.devices?.items || []) as any[];
//         const meta = data?.devices?.meta || {};
//         setRows(
//           devices.map((d) => ({
//             id: String(d._id || d.device_code),
//             device_code: d.device_code,
//             device_label: d.device_label || d.device_name || null,
//             device_type: d.device_type || null,
//             platform: d.platform || null,
//             linked_user: d.linked_user || null,
//             mandi_id: d.mandi_id ?? null,
//             gate_id: d.gate_id ? String(d.gate_id) : null,
//             gate_code: d.gate_code || null,
//             status: d.status || null,
//             last_seen_on: d.last_seen_on || null,
//             updated_on: d.updated_on || null,
//           })),
//         );
//         setTotalCount(Number(meta.totalCount || 0));
//       })();

//       inflightRef.current = promise;
//       try {
//         await promise;
//       } catch (e: any) {
//         enqueueSnackbar(e?.message || "Failed to load gate devices", { variant: "error" });
//       } finally {
//         inflightRef.current = null;
//         setLoading(false);
//       }
//     },
//     [
//       authContext.org_id,
//       enqueueSnackbar,
//       filters.device_type,
//       filters.gate_id,
//       filters.mandi_id,
//       filters.search,
//       initialOrg.org_id,
//       page,
//       pageSize,
//     ],
//   );

//   // Debounce only search typing; other changes trigger one call
//   const searchDebounceRef = useRef<any>(null);
//   useEffect(() => {
//     if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

//     searchDebounceRef.current = setTimeout(() => {
//       callBootstrap({ reason: "filters", debouncedSearch: filters.search });
//     }, 250);

//     return () => {
//       if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
//     };
//   }, [callBootstrap, filters.mandi_id, filters.gate_id, filters.device_type, filters.search, page, pageSize]);

//   // Reset pagination when filters change (refine behavior)
//   useEffect(() => {
//     setPage(1);
//   }, [filters.mandi_id, filters.gate_id, filters.device_type, filters.search]);

//   const showSelectMessage = !filters.mandi_id;

//   const fetchDialogGates = useCallback(async (mandiId: string | number) => {
//     const username = currentUsername();
//     if (!username || !mandiId) {
//       setDialogGateOptions([]);
//       return;
//     }

//     const resp = await fetchGateDevicesBootstrap({
//       username,
//       language: "en",
//       filters: {
//         mandi_id: Number(mandiId),
//         page: 1,
//         pageSize: 1,
//       },
//     });

//     if (!resp.ok) {
//       setDialogGateOptions([]);
//       return;
//     }

//     const data = resp.data?.data || resp.data || {};
//     setDialogGateOptions((data?.gates?.items || []) as GateOption[]);
//   }, []);

//   useEffect(() => {
//     if (!dialogOpen) return;
//     if (!form.mandi_id) {
//       setDialogGateOptions([]);
//       return;
//     }
//     fetchDialogGates(form.mandi_id);
//   }, [dialogOpen, form.mandi_id, fetchDialogGates]);

//   return (
//     <PageContainer>
//       <Stack spacing={1} mb={2}>
//         <Typography variant="h5">Gate Devices</Typography>
//         <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
//           {orgDisplayName ? <Chip size="small" label={`Org: ${orgDisplayName}`} /> : null}
//           <Typography variant="body2" color="text.secondary">
//             Configure and assign devices to gates
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
//               "& .MuiTextField-root": { minWidth: { xs: "100%", md: 180 } },
//               "& .MuiAutocomplete-root": { minWidth: { xs: "100%", md: 260 } },
//             }}
//           >
//             <Autocomplete
//               fullWidth
//               loading={loading}
//               options={mandiOptions}
//               value={selectedMandi}
//               onChange={(_, value) => {
//                 setFilters((f) => ({
//                   ...f,
//                   mandi_id: value?.mandi_id ?? "",
//                   gate_id: "",
//                 }));
//               }}
//               getOptionLabel={(option) =>
//                 option?.name_i18n?.en || option?.label || option?.mandi_slug || String(option?.mandi_id || "")
//               }
//               isOptionEqualToValue={(opt, val) => String(opt?.mandi_id) === String(val?.mandi_id)}
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
//               value={filters.gate_id}
//               onChange={(e) => setFilters((f) => ({ ...f, gate_id: e.target.value }))}
//               disabled={!filters.mandi_id}
//               helperText={!filters.mandi_id ? "Select mandi first" : gateOptions.length === 0 ? "No gates" : "All gates by default"}
//             >
//               <MenuItem value="">All</MenuItem>
//               {gateOptions.map((g) => (
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
//               value={filters.device_type}
//               onChange={(e) => setFilters((f) => ({ ...f, device_type: e.target.value }))}
//             >
//               <MenuItem value="">All</MenuItem>
//               {deviceTypeOptions.map((d) => (
//                 <MenuItem key={d} value={d}>
//                   {toUiDeviceType(d)}
//                 </MenuItem>
//               ))}
//             </TextField>

//             <TextField
//               fullWidth
//               label="Search"
//               size="small"
//               value={filters.search}
//               onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
//             />

//             <Box sx={{ flex: "0 0 auto", width: { xs: "100%", md: "auto" } }}>
//               <Button
//                 fullWidth={isMobile}
//                 variant="contained"
//                 size="small"
//                 startIcon={<AddIcon />}
//                 onClick={() => {
//                   setForm({
//                     device_code: "",
//                     device_label: "",
//                     device_type: filters.device_type || "GPS_PHONE",
//                     mandi_id: filters.mandi_id || "",
//                     gate_id: filters.gate_id || "",
//                   });
//                   setDialogGateOptions([]);
//                   setDialogOpen(true);
//                 }}
//               >
//                 Add Device
//               </Button>
//             </Box>
//           </Stack>
//         </CardContent>
//       </Card>

//       <Card>
//         <CardContent>
//           {showSelectMessage ? (
//             <Typography variant="body2" color="text.secondary">
//               Select a <b>Mandi</b> to view devices. (Gate filter is optional.)
//             </Typography>
//           ) : null}

//           <Divider sx={{ my: 1 }} />

//           {isMobile ? (
//             <Stack spacing={1}>
//               {rows.length === 0 && !loading ? (
//                 <Typography variant="body2" color="text.secondary">
//                   No devices found.
//                 </Typography>
//               ) : null}

//               {rows.map((r) => (
//                 <Card key={r.id} variant="outlined">
//                   <CardContent sx={{ pb: 1.5 }}>
//                     <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
//                       <Box>
//                         <Typography variant="subtitle2">{r.device_code}</Typography>
//                         <Typography variant="body2" color="text.secondary">
//                           {r.device_label || "—"}
//                         </Typography>
//                       </Box>
//                       <IconButton size="small" aria-label="More">
//                         <MoreVertIcon fontSize="small" />
//                       </IconButton>
//                     </Stack>
//                     <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
//                       <Chip size="small" label={`Type: ${toUiDeviceType(r.device_type)}`} />
//                       {r.gate_code ? <Chip size="small" label={`Gate: ${r.gate_code}`} /> : null}
//                       <Chip size="small" label={`Status: ${r.status || "—"}`} />
//                       {r.last_seen_on ? (
//                         <Chip size="small" label={`Last Seen: ${new Date(String(r.last_seen_on)).toLocaleString()}`} />
//                       ) : null}
//                     </Stack>
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
//                 rows={rows}
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

//       <Dialog open={dialogOpen} onClose={() => (!saving ? setDialogOpen(false) : null)} fullWidth maxWidth="sm">
//         <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
//           Add Device
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
//               onChange={(e) => setForm((f) => ({ ...f, device_code: e.target.value }))}
//               helperText="(Optional) Leave blank if backend auto-generates/normalizes."
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
//               {(deviceTypeOptions.length ? deviceTypeOptions : ["GPS_PHONE"]).map((d) => (
//                 <MenuItem key={d} value={d}>
//                   {toUiDeviceType(d)}
//                 </MenuItem>
//               ))}
//             </TextField>

//             <Autocomplete
//               options={mandiOptions}
//               value={mandiOptions.find((m) => String(m.mandi_id) === String(form.mandi_id)) || null}
//               onChange={(_, value) => {
//                 const mandiId = value?.mandi_id || "";
//                 setForm((f) => ({ ...f, mandi_id: mandiId, gate_id: "" }));
//               }}
//               getOptionLabel={(option) =>
//                 option?.name_i18n?.en || option?.label || option?.mandi_slug || String(option?.mandi_id || "")
//               }
//               isOptionEqualToValue={(opt, val) => String(opt?.mandi_id) === String(val?.mandi_id)}
//               renderInput={(params) => <TextField {...params} label="Mandi" size="small" />}
//             />

//             <TextField
//               select
//               label="Gate"
//               size="small"
//               value={form.gate_id}
//               onChange={(e) => setForm((f) => ({ ...f, gate_id: e.target.value }))}
//               disabled={!form.mandi_id}
//               helperText={!form.mandi_id ? "Select mandi first" : dialogGateOptions.length === 0 ? "No gates for this mandi" : ""}
//             >
//               {dialogGateOptions.map((g) => (
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
//             disabled={saving || !form.device_type || !form.mandi_id || !form.gate_id}
//             onClick={async () => {
//               try {
//                 const username = currentUsername();
//                 if (!username) {
//                   enqueueSnackbar("Username missing", { variant: "error" });
//                   return;
//                 }

//                 const orgId = authContext.org_id || initialOrg.org_id;
//                 if (!orgId) {
//                   enqueueSnackbar("Organisation context missing", { variant: "error" });
//                   return;
//                 }

//                 setSaving(true);

//                 const payload: Record<string, any> = {
//                   org_id: orgId,
//                   mandi_id: Number(form.mandi_id),
//                   gate_id: String(form.gate_id),
//                   device_type: form.device_type,
//                   status: "ACTIVE",
//                 };

//                 if (String(form.device_code || "").trim().length > 0) payload.device_code = String(form.device_code).trim();
//                 if (String(form.device_label || "").trim().length > 0) payload.device_label = String(form.device_label).trim();

//                 const resp = await createGateDevice({ username, language: "en", payload });

//                 if (!resp?.ok) {
//                   enqueueSnackbar(resp?.description || "Failed to add device", { variant: "error" });
//                   return;
//                 }

//                 enqueueSnackbar(resp?.description || "Device added", { variant: "success" });
//                 setDialogOpen(false);

//                 // Refresh list for the same mandi
//                 setFilters((f) => ({
//                   ...f,
//                   mandi_id: form.mandi_id || f.mandi_id,
//                   gate_id: "", // show all gates in mandi after create
//                 }));
//                 setPage(1);

//                 await callBootstrap({
//                   reason: "after_create",
//                   override: {
//                     mandi_id: form.mandi_id,
//                     gate_id: "",
//                     device_type: filters.device_type,
//                     search: filters.search,
//                     page: 1,
//                     pageSize,
//                   },
//                 });
//               } catch (err: any) {
//                 enqueueSnackbar(err?.message || "Failed to add device", { variant: "error" });
//               } finally {
//                 setSaving(false);
//               }
//             }}
//           >
//             {saving ? "Saving…" : "Save"}
//           </Button>
//         </DialogActions>
//       </Dialog>
//     </PageContainer>
//   );
// };