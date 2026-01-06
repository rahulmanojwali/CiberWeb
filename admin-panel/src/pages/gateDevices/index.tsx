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
import { fetchGateDevicesBootstrap, createGateDevice } from "../../services/gateApi";
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
};

type DeviceRow = {
  id: string;
  device_code: string;
  device_label?: string;
  device_type: string;
  platform?: string;
  linked_user?: string;
  mandi_id: number;
  gate_id?: string;
  gate_code?: string;
  status?: string;
  is_active?: string;
  last_seen_on?: string;
  updated_on?: string;
};

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

function currentOrgInfo() {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      org_id: parsed?.org_id || null,
      org_code: parsed?.org_code || null,
      org_name:
        parsed?.org_name ||
        parsed?.org_name_en ||
        parsed?.organisation_name ||
        parsed?.org_code ||
        null,
    };
  } catch {
    return { org_id: null, org_code: null, org_name: null };
  }
}

function toUiDeviceType(v: string): string {
  // Keep backend enums as-is; UI shows raw for now.
  return String(v || "");
}

export const GateDevices: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const { authContext } = usePermissions();
  const { enqueueSnackbar } = useSnackbar();

  const initialOrg = currentOrgInfo();

  const [filters, setFilters] = useState({
    mandi_id: "" as string | number,
    gate_id: "" as string,
    device_type: "" as string,
    search: "" as string,
  });

  const [mandiOptions, setMandiOptions] = useState<MandiOption[]>([]);
  const [gateOptions, setGateOptions] = useState<GateOption[]>([]);
  const [deviceTypeOptions, setDeviceTypeOptions] = useState<string[]>([]);

  const [bootstrapOrg, setBootstrapOrg] = useState<{ org_id?: string; org_code?: string; org_name?: string }>({});

  const [rows, setRows] = useState<DeviceRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  const [loading, setLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    device_code: "",
    device_label: "",
    device_type: "",
    mandi_id: "" as string | number,
    gate_id: "",
  });

  // --- Inflight guard (prevents duplicate calls on mount / rapid filter changes)
  const inflightRef = useRef<Promise<any> | null>(null);
  const lastKeyRef = useRef<string>("");

  const orgDisplayName =
    bootstrapOrg.org_name ||
    bootstrapOrg.org_code ||
    (authContext as any).org_name ||
    initialOrg.org_name ||
    authContext.org_code ||
    initialOrg.org_code ||
    (authContext.org_id ? "Organisation" : "");

  const selectedMandi = useMemo(() => {
    return mandiOptions.find((m) => String(m.mandi_id) === String(filters.mandi_id)) || null;
  }, [mandiOptions, filters.mandi_id]);

  const selectedGate = useMemo(() => {
    return gateOptions.find((g) => String(g._id) === String(filters.gate_id)) || null;
  }, [gateOptions, filters.gate_id]);

  const columns = useMemo<GridColDef<DeviceRow>[]>(
    () => [
      { field: "device_code", headerName: "Device Code", width: 180 },
      {
        field: "device_label",
        headerName: "Label",
        width: 180,
        valueGetter: (params: any) => (params?.row as DeviceRow)?.device_label || "—",
      },
      {
        field: "device_type",
        headerName: "Type",
        width: 200,
        valueGetter: (params: any) => toUiDeviceType((params?.row as DeviceRow)?.device_type),
      },
      { field: "gate_code", headerName: "Gate", width: 120, valueGetter: (p: any) => (p?.row as DeviceRow)?.gate_code || "—" },
      { field: "mandi_id", headerName: "Mandi", width: 110 },
      {
        field: "status",
        headerName: "Status",
        width: 120,
        valueGetter: (params: any) => (params?.row as DeviceRow)?.status || "—",
      },
      {
        field: "last_seen_on",
        headerName: "Last Seen",
        width: 180,
        valueGetter: (params: any) => {
          const v = (params?.row as DeviceRow)?.last_seen_on;
          return v ? new Date(String(v)).toLocaleString() : "—";
        },
      },
      {
        field: "actions",
        headerName: "",
        width: 60,
        sortable: false,
        filterable: false,
        renderCell: () => (
          <IconButton size="small" aria-label="More">
            <MoreVertIcon fontSize="small" />
          </IconButton>
        ),
      },
    ],
    [],
  );

  const callBootstrap = useCallback(
    async (opts: { reason: string; debouncedSearch?: string } = { reason: "manual" }) => {
      const username = currentUsername();
      if (!username) return;

      const keyObj = {
        org_id: authContext.org_id || initialOrg.org_id || "",
        mandi_id: filters.mandi_id || "",
        gate_id: filters.gate_id || "",
        device_type: filters.device_type || "",
        search: opts.debouncedSearch ?? filters.search ?? "",
        page,
        pageSize,
      };
      const requestKey = JSON.stringify(keyObj);
      if (inflightRef.current && lastKeyRef.current === requestKey) {
        return; // same request already in-flight
      }
      lastKeyRef.current = requestKey;

      setLoading(true);
      const promise = (async () => {
        const resp = await fetchGateDevicesBootstrap({
          username,
          language: "en",
          filters: {
            mandi_id: filters.mandi_id ? Number(filters.mandi_id) : undefined,
            gate_id: filters.gate_id ? String(filters.gate_id) : undefined,
            device_type: filters.device_type || undefined,
            search: (opts.debouncedSearch ?? filters.search) || undefined,
            page,
            pageSize,
          },
        });

        if (!resp.ok) {
          enqueueSnackbar(resp?.description || "Failed to load gate devices", { variant: "error" });
          setMandiOptions([]);
          setGateOptions([]);
          setDeviceTypeOptions([]);
          setRows([]);
          setTotalCount(0);
          return;
        }

        const data = resp.data?.data || resp.data || {};

        setBootstrapOrg(data?.org || {});
        setMandiOptions((data?.mandis?.items || []) as MandiOption[]);
        setGateOptions((data?.gates?.items || []) as GateOption[]);
        setDeviceTypeOptions((data?.device_types?.items || []) as string[]);

        const devices = (data?.devices?.items || []) as any[];
        const meta = data?.devices?.meta || {};
        setRows(
          devices.map((d) => ({
            id: String(d._id || d.device_code),
            device_code: d.device_code,
            device_label: d.device_label || d.device_name || null,
            device_type: d.device_type,
            platform: d.platform,
            linked_user: d.linked_user,
            mandi_id: d.mandi_id,
            gate_id: d.gate_id ? String(d.gate_id) : undefined,
            gate_code: d.gate_code,
            status: d.status,
            is_active: d.is_active,
            last_seen_on: d.last_seen_on,
            updated_on: d.updated_on,
          })),
        );
        setTotalCount(Number(meta.totalCount || 0));
      })();

      inflightRef.current = promise;
      try {
        await promise;
      } catch (e: any) {
        enqueueSnackbar(e?.message || "Failed to load gate devices", { variant: "error" });
      } finally {
        inflightRef.current = null;
        setLoading(false);
      }
    },
    [
      authContext.org_id,
      enqueueSnackbar,
      filters.device_type,
      filters.gate_id,
      filters.mandi_id,
      filters.search,
      initialOrg.org_id,
      page,
      pageSize,
    ],
  );

  // --- Mount + filter changes
  const searchDebounceRef = useRef<any>(null);
  useEffect(() => {
    // Debounce only on search typing; other filter changes call immediately
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    const shouldDebounce = true;
    if (shouldDebounce) {
      searchDebounceRef.current = setTimeout(() => {
        callBootstrap({ reason: "filters", debouncedSearch: filters.search });
      }, 300);
    } else {
      callBootstrap({ reason: "filters" });
    }

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [callBootstrap, filters.mandi_id, filters.gate_id, filters.device_type, filters.search, page, pageSize]);

  // Reset pagination when key filters change
  useEffect(() => {
    setPage(1);
  }, [filters.mandi_id, filters.gate_id, filters.device_type, filters.search]);

  const showSelectMessage = !filters.mandi_id || !filters.gate_id;

  return (
    <PageContainer>
      <Stack spacing={1} mb={2}>
        <Typography variant="h5">Gate Devices</Typography>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          {orgDisplayName ? <Chip size="small" label={`Org: ${orgDisplayName}`} /> : null}
          <Typography variant="body2" color="text.secondary">
            Configure and assign devices to gates
          </Typography>
        </Stack>
      </Stack>

      {/* Filter bar */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={1}
            alignItems={{ xs: "stretch", md: "center" }}
            sx={{
              "& .MuiTextField-root": { minWidth: { xs: "100%", md: 180 } },
              "& .MuiAutocomplete-root": { minWidth: { xs: "100%", md: 240 } },
            }}
          >
            <Autocomplete
              fullWidth
              loading={loading}
              options={mandiOptions}
              value={selectedMandi}
              onChange={(_, value) => {
                setFilters((f) => ({
                  ...f,
                  mandi_id: value?.mandi_id ?? "",
                  gate_id: "",
                }));
              }}
              getOptionLabel={(option) =>
                option?.name_i18n?.en || option?.label || option?.mandi_slug || String(option?.mandi_id || "")
              }
              isOptionEqualToValue={(opt, val) => String(opt?.mandi_id) === String(val?.mandi_id)}
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
              value={filters.gate_id}
              onChange={(e) => setFilters((f) => ({ ...f, gate_id: e.target.value }))}
              disabled={!filters.mandi_id}
              helperText={!filters.mandi_id ? "Select mandi first" : gateOptions.length === 0 ? "No gates" : ""}
            >
              <MenuItem value="">Select</MenuItem>
              {gateOptions.map((g) => (
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
              value={filters.device_type}
              onChange={(e) => setFilters((f) => ({ ...f, device_type: e.target.value }))}
            >
              <MenuItem value="">All</MenuItem>
              {deviceTypeOptions.map((d) => (
                <MenuItem key={d} value={d}>
                  {toUiDeviceType(d)}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              label="Search"
              size="small"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            />

            <Box sx={{ flex: "0 0 auto", width: { xs: "100%", md: "auto" } }}>
              <Button
                fullWidth={isMobile}
                variant="contained"
                size="small"
                startIcon={<AddIcon />}
                onClick={() => {
                  // Prefill based on current filters if available
                  setForm({
                    device_code: "",
                    device_label: "",
                    device_type: filters.device_type || "",
                    mandi_id: filters.mandi_id || "",
                    gate_id: filters.gate_id || "",
                  });
                  setDialogOpen(true);
                }}
              >
                Add Device
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {showSelectMessage ? (
            <Stack spacing={1} alignItems="flex-start">
              <Typography variant="body2" color="text.secondary">
                Select <b>Mandi</b> and <b>Gate</b> to view devices.
              </Typography>
            </Stack>
          ) : null}

          <Divider sx={{ my: 1 }} />

          {isMobile ? (
            <Stack spacing={1}>
              {loading ? (
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">
                    Loading…
                  </Typography>
                </Stack>
              ) : null}

              {rows.length === 0 && !loading ? (
                <Typography variant="body2" color="text.secondary">
                  No devices found.
                </Typography>
              ) : null}

              {rows.map((r) => (
                <Card key={r.id} variant="outlined">
                  <CardContent sx={{ pb: 1.5 }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}>
                      <Box>
                        <Typography variant="subtitle2">{r.device_code}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {r.device_label || "—"}
                        </Typography>
                      </Box>
                      <IconButton size="small" aria-label="More">
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                    <Stack direction="row" spacing={1} mt={1} flexWrap="wrap">
                      <Chip size="small" label={`Type: ${toUiDeviceType(r.device_type)}`} />
                      {r.gate_code ? <Chip size="small" label={`Gate: ${r.gate_code}`} /> : null}
                      <Chip size="small" label={`Status: ${r.status || "—"}`} />
                    </Stack>
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
                rows={rows}
                loading={loading}
                getRowId={(r) => r.id}
                autoHeight
                paginationMode="server"
                rowCount={totalCount}
                paginationModel={{ page: page - 1, pageSize }}
                onPaginationModelChange={(model) => {
                  setPage(model.page + 1);
                  if (model.pageSize !== pageSize) {
                    setPageSize(model.pageSize);
                    setPage(1);
                  }
                }}
                pageSizeOptions={[10, 20, 50]}
                minWidth={900}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Add Device Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Add Device
          <IconButton size="small" onClick={() => setDialogOpen(false)} aria-label="close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Device Code"
              size="small"
              value={form.device_code}
              onChange={(e) => setForm((f) => ({ ...f, device_code: e.target.value }))}
              helperText="Example: phone_orgadmin_gate01"
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
              {deviceTypeOptions.map((d) => (
                <MenuItem key={d} value={d}>
                  {toUiDeviceType(d)}
                </MenuItem>
              ))}
            </TextField>
            <Autocomplete
              options={mandiOptions}
              value={mandiOptions.find((m) => String(m.mandi_id) === String(form.mandi_id)) || null}
              onChange={(_, value) => {
                const mandiId = value?.mandi_id || "";
                setForm((f) => ({ ...f, mandi_id: mandiId, gate_id: "" }));
              }}
              getOptionLabel={(option) =>
                option?.name_i18n?.en || option?.label || option?.mandi_slug || String(option?.mandi_id || "")
              }
              isOptionEqualToValue={(opt, val) => String(opt?.mandi_id) === String(val?.mandi_id)}
              renderInput={(params) => <TextField {...params} label="Mandi" size="small" />}
            />
            <TextField
              select
              label="Gate"
              size="small"
              value={form.gate_id}
              onChange={(e) => setForm((f) => ({ ...f, gate_id: e.target.value }))}
              disabled={!form.mandi_id}
              helperText={!form.mandi_id ? "Select mandi first" : gateOptions.length === 0 ? "No gates" : ""}
            >
              {gateOptions.map((g) => (
                <MenuItem key={g._id} value={g._id}>
                  {g.gate_code}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setDialogOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={async () => {
              try {
                const username = currentUsername();
                if (!username) {
                  enqueueSnackbar("Username missing", { variant: "error" });
                  return;
                }
                const orgId = authContext.org_id || initialOrg.org_id;
                if (!orgId) {
                  enqueueSnackbar("Organisation context missing", { variant: "error" });
                  return;
                }

                const resp = await createGateDevice({
                  username,
                  language: "en",
                  payload: {
                    org_id: orgId,
                    mandi_id: Number(form.mandi_id),
                    gate_id: form.gate_id,
                    device_type: form.device_type,
                    device_code: form.device_code,
                    device_label: form.device_label || undefined,
                    status: "ACTIVE",
                  },
                });

                if (!resp?.ok) {
                  enqueueSnackbar(resp?.description || "Failed to add device", { variant: "error" });
                  return;
                }

                enqueueSnackbar(resp?.description || "Device added", { variant: "success" });
                setDialogOpen(false);
                setFilters((f) => ({
                  ...f,
                  mandi_id: form.mandi_id || f.mandi_id,
                  gate_id: form.gate_id || f.gate_id,
                }));
                // Refresh list
                callBootstrap({ reason: "after_create" });
              } catch (err: any) {
                enqueueSnackbar(err?.message || "Failed to add device", { variant: "error" });
              }
            }}
            disabled={!form.device_code || !form.device_type || !form.mandi_id || !form.gate_id}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};



// import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
// import {
//   Autocomplete,
//   Chip,
//   Button,
//   Card,
//   CardContent,
//   CircularProgress,
//   Dialog,
//   DialogActions,
//   DialogContent,
//   DialogTitle,
//   MenuItem,
//   Stack,
//   TextField,
//   Typography,
// } from "@mui/material";
// import { type GridColDef } from "@mui/x-data-grid";
// import AddIcon from "@mui/icons-material/Add";
// import { PageContainer } from "../../components/PageContainer";
// import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
// import { fetchGateDevices, createGateDevice, fetchGateScreenBootstrap } from "../../services/gateApi";
// import { useSnackbar } from "notistack";
// import { usePermissions } from "../../authz/usePermissions";

// type DeviceRow = {
//   id: string;
//   device_code: string;
//   device_name?: string;
//   device_type: string;
//   org_code?: string;
//   mandi_id: number;
//   gate_code: string;
//   is_active: string;
//   created_on?: string;
// };

// const deviceTypes = ["QR_SCANNER", "RFID", "GPS", "WEIGHBRIDGE_CONSOLE", "CAMERA"];
// const MANDI_PAGE_SIZE = 20;

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
//       org_name: parsed?.org_name || parsed?.org_name_en || parsed?.organisation_name || parsed?.org_code || null,
//     };
//   } catch {
//     return { org_id: null, org_code: null, org_name: null };
//   }
// }

// export const GateDevices: React.FC = () => {
//   const { authContext } = usePermissions();
//   const { enqueueSnackbar } = useSnackbar();
//   const initialOrg = currentOrgInfo();
//   const [filters, setFilters] = useState({
//     org_id: authContext.org_id || initialOrg.org_id || "",
//     mandi_id: "",
//     gate_code: "",
//     device_type: "",
//     search: "",
//   });
//   const [mandiOptions, setMandiOptions] = useState<any[]>([]);
//   const [gateOptions, setGateOptions] = useState<any[]>([]);
//   const [mandiSearchText, setMandiSearchText] = useState("");
//   const [bootstrapOrg, setBootstrapOrg] = useState<{ org_id?: string; org_code?: string; org_name?: string }>({});
//   const [bootstrapLoading, setBootstrapLoading] = useState(false);

//   const [rows, setRows] = useState<DeviceRow[]>([]);
//   const [page, setPage] = useState(0);
//   const [perPage, setPerPage] = useState(10);
//   const [total, setTotal] = useState(0);
//   const [loading, setLoading] = useState(false);
//   const didInitDevices = useRef(false);

//   const [dialogOpen, setDialogOpen] = useState(false);
//   const [form, setForm] = useState({
//     device_code: "",
//     device_name: "",
//     device_type: "",
//     mandi_id: "",
//     gate_code: "",
//   });

//   useEffect(() => {
//     if (authContext.org_id && authContext.org_id !== filters.org_id) {
//       setFilters((f) => ({ ...f, org_id: authContext.org_id || initialOrg.org_id || "" }));
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [authContext.org_id]);

//   const columns = useMemo<GridColDef<DeviceRow>[]>(
//     () => [
//       { field: "device_code", headerName: "Device Code", width: 180 },
//       {
//         field: "device_name",
//         headerName: "Name",
//         width: 160,
//         valueGetter: (params: any) => (params?.row as DeviceRow)?.device_name || "—",
//       },
//       { field: "device_type", headerName: "Type", width: 160 },
//       { field: "org_code", headerName: "Org", width: 120 },
//       { field: "mandi_id", headerName: "Mandi", width: 110 },
//       { field: "gate_code", headerName: "Gate", width: 120 },
//       {
//         field: "is_active",
//         headerName: "Active",
//         width: 90,
//         valueGetter: (params: any) => ((params?.row as DeviceRow)?.is_active === "Y" ? "Yes" : "No"),
//       },
//       {
//         field: "created_on",
//         headerName: "Created On",
//         width: 160,
//         valueGetter: (params: any) =>
//           (params?.row as DeviceRow)?.created_on
//             ? new Date(String((params?.row as DeviceRow).created_on)).toLocaleString()
//             : "",
//       },
//     ],
//     [],
//   );

//   const loadGateBootstrap = useCallback(async () => {
//     const username = currentUsername();
//     const effectiveOrgId = filters.org_id || authContext.org_id || initialOrg.org_id;
//     if (!username || !effectiveOrgId) {
//       setBootstrapOrg({});
//       setMandiOptions([]);
//       setGateOptions([]);
//       return;
//     }

//     const mandisPageSize = 200;
//     const gatesPageSize = filters.mandi_id ? 200 : 0;
//     setBootstrapLoading(true);
//     try {
//       const resp = await fetchGateScreenBootstrap({
//         username,
//         language: "en",
//         org_id: effectiveOrgId,
//         mandis_page: 1,
//         mandis_pageSize: mandisPageSize,
//         gates_page: 1,
//         gates_pageSize: gatesPageSize,
//         mandi_id: filters.mandi_id ? Number(filters.mandi_id) : undefined,
//         search: mandiSearchText || undefined,
//       });
//       const responseCode = resp?.response?.responsecode;
//       if (responseCode !== "0") {
//         enqueueSnackbar(resp?.response?.description || "Unable to load mandis", { variant: "error" });
//         setBootstrapOrg({});
//         setMandiOptions([]);
//         setGateOptions([]);
//         return;
//       }
//       const data = resp?.data || {};
//       setBootstrapOrg(data?.org || {});
//       setMandiOptions(data?.mandis?.items || []);
//       setGateOptions(data?.gates?.items || []);
//     } catch (err: any) {
//       console.error("[GateDevices] bootstrap load error", err);
//       enqueueSnackbar(err?.message || "Unable to load mandis", { variant: "error" });
//       setBootstrapOrg({});
//       setMandiOptions([]);
//       setGateOptions([]);
//     } finally {
//       setBootstrapLoading(false);
//     }
//   }, [authContext.org_id, enqueueSnackbar, filters.org_id, filters.mandi_id, initialOrg.org_id, mandiSearchText]);

//   useEffect(() => {
//     const handle = setTimeout(() => {
//       loadGateBootstrap();
//     }, 300);
//     return () => clearTimeout(handle);
//   }, [loadGateBootstrap]);

//   const loadDevices = async () => {
//     if (loading) return;
//     setLoading(true);
//     try {
//       const effectiveOrgId = filters.org_id || authContext.org_id || initialOrg.org_id || undefined;
//       console.log("[GateDevices] Devices fetch START", {
//         org: effectiveOrgId,
//         mandi_id: filters.mandi_id,
//         gate_code: filters.gate_code,
//         page: page + 1,
//         perPage,
//       });
//       const resp = await fetchGateDevices({
//         username: currentUsername() || "",
//         language: "en",
//         filters: {
//           org_id: effectiveOrgId,
//           mandi_id: filters.mandi_id || undefined,
//           gate_code: filters.gate_code || undefined,
//           device_type: filters.device_type || undefined,
//           search: filters.search || undefined,
//           page: page + 1,
//           perPage,
//         },
//       });
//       if (!resp.ok) {
//         enqueueSnackbar(resp.description || "Failed to load devices", { variant: "error" });
//         setRows([]);
//         setTotal(0);
//         return;
//       }
//       const payload = resp.data;
//       const list = payload?.data?.devices || payload?.response?.data?.devices || [];
//       const pagination = payload?.data?.pagination || payload?.response?.data?.pagination;
//       setRows(
//         list.map((d: any) => ({
//           id: d._id || d.device_code,
//           device_code: d.device_code,
//           device_name: d.device_name,
//           device_type: d.device_type,
//           org_code: d.org_code || d.org_code_hint,
//           mandi_id: d.mandi_id,
//           gate_code: d.gate_code,
//           is_active: d.is_active,
//           created_on: d.created_on,
//         })),
//       );
//       setTotal(pagination?.total ?? list.length ?? 0);
//       if (pagination?.perPage) setPerPage(pagination.perPage);
//       console.log("[GateDevices] Devices fetch DONE", {
//         total: pagination?.total ?? list.length ?? 0,
//         returned: list.length,
//       });
//     } catch (err: any) {
//       enqueueSnackbar(err?.message || "Failed to load devices", { variant: "error" });
//       setRows([]);
//       setTotal(0);
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (didInitDevices.current && filters.mandi_id === "" && filters.gate_code === "" && filters.search === "") return;
//     didInitDevices.current = true;
//     loadDevices();
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [filters.org_id, filters.mandi_id, filters.gate_code, filters.device_type, filters.search, page, perPage]);

//   const selectedMandi = mandiOptions.find((m) => String(m.mandi_id) === String(filters.mandi_id)) || null;
//   const orgDisplayName =
//     bootstrapOrg.org_name ||
//     bootstrapOrg.org_code ||
//     (authContext as any).org_name ||
//     initialOrg.org_name ||
//     authContext.org_code ||
//     initialOrg.org_code ||
//     (authContext.org_id ? "Organisation" : "");

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
//       <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }} mb={2}>
//         <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
//           <Autocomplete
//             sx={{ minWidth: 220 }}
//             loading={bootstrapLoading}
//             options={mandiOptions}
//             value={selectedMandi}
//             inputValue={mandiSearchText}
//             onInputChange={(_, value, reason) => {
//               if (reason === "input" || reason === "clear") {
//                 setMandiSearchText(value || "");
//               }
//             }}
//             onChange={(_, value) => {
//               setFilters((f) => ({ ...f, mandi_id: value?.mandi_id || "", gate_code: "" }));
//             }}
//             getOptionLabel={(option) => option?.name_i18n?.en || option?.label || option?.mandi_slug || String(option?.mandi_id || "")}
//             isOptionEqualToValue={(opt, val) => String(opt?.mandi_id) === String(val?.mandi_id)}
//             renderInput={(params) => (
//               <TextField
//                 {...params}
//                 label="Mandi"
//                 size="small"
//                 InputProps={{
//                   ...params.InputProps,
//                   endAdornment: (
//                     <>
//                       {bootstrapLoading ? <CircularProgress color="inherit" size={16} /> : null}
//                       {params.InputProps.endAdornment}
//                     </>
//                   ),
//                 }}
//               />
//             )}
//             loadingText="Loading mandis..."
//             noOptionsText={bootstrapLoading ? "Loading..." : "No mandis found"}
//           />
//           <TextField
//             select
//             label="Gate"
//             size="small"
//             value={filters.gate_code}
//             onChange={(e) => setFilters((f) => ({ ...f, gate_code: e.target.value }))}
//             sx={{ minWidth: 160 }}
//             disabled={!filters.mandi_id}
//             helperText={!filters.mandi_id ? "Select mandi first" : gateOptions.length === 0 ? "No gates found" : ""}
//           >
//             <MenuItem value="">All</MenuItem>
//             {gateOptions.map((g: any) => (
//               <MenuItem key={g.gate_code || g._id} value={g.gate_code}>
//                 {g.gate_code}
//               </MenuItem>
//             ))}
//           </TextField>
//           <TextField
//             select
//             label="Device Type"
//             size="small"
//             value={filters.device_type}
//             onChange={(e) => setFilters((f) => ({ ...f, device_type: e.target.value }))}
//             sx={{ minWidth: 170 }}
//           >
//             <MenuItem value="">All</MenuItem>
//             {deviceTypes.map((d) => (
//               <MenuItem key={d} value={d}>
//                 {d}
//               </MenuItem>
//             ))}
//           </TextField>
//           <TextField
//             label="Search"
//             size="small"
//             value={filters.search}
//             onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
//             sx={{ minWidth: 180 }}
//           />
//           <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setDialogOpen(true)}>
//             Add Device
//           </Button>
//         </Stack>
//       </Stack>

//       <Card>
//         <CardContent>
//           <ResponsiveDataGrid
//             columns={columns}
//             rows={rows}
//             loading={loading}
//             getRowId={(r) => r.id}
//             autoHeight
//             paginationMode="server"
//             rowCount={total}
//             paginationModel={{ page, pageSize: perPage }}
//             onPaginationModelChange={(model) => {
//               setPage(model.page);
//               if (model.pageSize !== perPage) {
//                 setPerPage(model.pageSize);
//                 setPage(0);
//               }
//             }}
//             pageSizeOptions={[10, 25, 50]}
//           />
//         </CardContent>
//       </Card>

//       <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
//         <DialogTitle>Add Device</DialogTitle>
//         <DialogContent dividers>
//           <Stack spacing={2} mt={1}>
//             <TextField
//               label="Device Code"
//               size="small"
//               value={form.device_code}
//               onChange={(e) => setForm((f) => ({ ...f, device_code: e.target.value }))}
//             />
//             <TextField
//               label="Device Name"
//               size="small"
//               value={form.device_name}
//               onChange={(e) => setForm((f) => ({ ...f, device_name: e.target.value }))}
//             />
//             <TextField
//               select
//               label="Device Type"
//               size="small"
//               value={form.device_type}
//               onChange={(e) => setForm((f) => ({ ...f, device_type: e.target.value }))}
//             >
//               {deviceTypes.map((d) => (
//                 <MenuItem key={d} value={d}>
//                   {d}
//                 </MenuItem>
//               ))}
//             </TextField>
//             <Autocomplete
//               options={mandiOptions}
//               value={mandiOptions.find((m) => String(m.mandi_id) === String(form.mandi_id)) || null}
//               inputValue={mandiSearchText}
//               onInputChange={(_, value, reason) => {
//                 if (reason === "input" || reason === "clear") {
//                   setMandiSearchText(value || "");
//                 }
//               }}
//               onChange={(_, value) => {
//                 const mandiId = value?.mandi_id || "";
//                 setForm((f) => ({ ...f, mandi_id: mandiId, gate_code: "" }));
//                 setFilters((f) => ({ ...f, mandi_id: mandiId, gate_code: "" }));
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
//                         {bootstrapLoading ? <CircularProgress color="inherit" size={16} /> : null}
//                         {params.InputProps.endAdornment}
//                       </>
//                     ),
//                   }}
//                 />
//               )}
//               loading={bootstrapLoading}
//               loadingText="Loading mandis..."
//               noOptionsText={bootstrapLoading ? "Loading..." : "No mandis found"}
//             />
//             <TextField
//               select
//               label="Gate"
//               size="small"
//               value={form.gate_code}
//               onChange={(e) => setForm((f) => ({ ...f, gate_code: e.target.value }))}
//               disabled={!form.mandi_id}
//               helperText={!form.mandi_id ? "Select mandi first" : gateOptions.length === 0 ? "No gates found" : ""}
//             >
//               {gateOptions.map((g: any) => (
//                 <MenuItem key={g.gate_code || g._id} value={g.gate_code}>
//                   {g.gate_code}
//                 </MenuItem>
//               ))}
//             </TextField>
//           </Stack>
//         </DialogContent>
//         <DialogActions>
//           <Button variant="outlined" onClick={() => setDialogOpen(false)}>
//             Cancel
//           </Button>
//           <Button
//             variant="contained"
//             onClick={async () => {
//               const orgId = filters.org_id || authContext.org_id || initialOrg.org_id;
//               if (!orgId) {
//                 enqueueSnackbar("Organisation context missing", { variant: "error" });
//                 return;
//               }
//               try {
//                 const resp = await createGateDevice({
//                   username: currentUsername() || "",
//                   language: "en",
//                   payload: {
//                     org_id: orgId,
//                     mandi_id: Number(form.mandi_id),
//                     gate_code: form.gate_code,
//                     device_type: form.device_type,
//                     device_code: form.device_code,
//                     device_name: form.device_name,
//                     is_active: "Y",
//                   },
//                 });
//                 if (!resp.ok) {
//                   enqueueSnackbar(resp.description || "Failed to add device", { variant: "error" });
//                   return;
//                 }
//                 enqueueSnackbar(resp.description ? `Success: ${resp.description}` : "Device added", {
//                   variant: "success",
//                 });
//                 setDialogOpen(false);
//                 setForm({ device_code: "", device_name: "", device_type: "", mandi_id: "", gate_code: "" });
//                 loadDevices();
//               } catch (err: any) {
//                 enqueueSnackbar(err?.message || "Failed to add device", { variant: "error" });
//               }
//             }}
//             disabled={!form.device_code || !form.device_type || !form.mandi_id || !form.gate_code}
//           >
//             Save
//           </Button>
//         </DialogActions>
//       </Dialog>
//     </PageContainer>
//   );
// };
