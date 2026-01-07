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
    gate_id: "" as string, // empty = ALL gates
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
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    device_code: "",
    device_label: "",
    device_type: "",
    mandi_id: "" as string | number,
    gate_id: "",
  });

  // gates shown inside dialog (must match dialog mandi, not necessarily page mandi)
  const [dialogGateOptions, setDialogGateOptions] = useState<GateOption[]>([]);

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

  const columns = useMemo<GridColDef<DeviceRow>[]>(
    () => [
      { field: "device_code", headerName: "Device Code", width: 210 },
      {
        field: "device_label",
        headerName: "Label",
        width: 220,
        valueGetter: (params: any) => (params?.row as DeviceRow)?.device_label || "—",
      },
      {
        field: "device_type",
        headerName: "Type",
        width: 200,
        valueGetter: (params: any) => toUiDeviceType((params?.row as DeviceRow)?.device_type),
      },
      {
        field: "gate_code",
        headerName: "Gate",
        width: 140,
        valueGetter: (p: any) => (p?.row as DeviceRow)?.gate_code || "—",
      },
      {
        field: "status",
        headerName: "Status",
        width: 120,
        valueGetter: (params: any) => (params?.row as DeviceRow)?.status || "—",
      },
      {
        field: "last_seen_on",
        headerName: "Last Seen",
        width: 190,
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

  /**
   * Bootstrap fetch with optional overrides to avoid stale state issues.
   * This is the main fix for: "saved in DB but not showing on screen".
   */
  const callBootstrap = useCallback(
    async (opts: {
      reason: string;
      debouncedSearch?: string;
      override?: Partial<{
        mandi_id: string | number;
        gate_id: string;
        device_type: string;
        search: string;
        page: number;
        pageSize: number;
      }>;
    } = { reason: "manual" }) => {
      const username = currentUsername();
      if (!username) return;

      const mandi_id = opts.override?.mandi_id ?? filters.mandi_id;
      const gate_id = opts.override?.gate_id ?? filters.gate_id;
      const device_type = opts.override?.device_type ?? filters.device_type;
      const search = opts.override?.search ?? (opts.debouncedSearch ?? filters.search);
      const reqPage = opts.override?.page ?? page;
      const reqPageSize = opts.override?.pageSize ?? pageSize;

      const keyObj = {
        org_id: authContext.org_id || initialOrg.org_id || "",
        mandi_id: mandi_id || "",
        gate_id: gate_id || "",
        device_type: device_type || "",
        search: search || "",
        page: reqPage,
        pageSize: reqPageSize,
      };
      const requestKey = JSON.stringify(keyObj);

      if (inflightRef.current && lastKeyRef.current === requestKey) return;
      lastKeyRef.current = requestKey;

      setLoading(true);
      const promise = (async () => {
        const resp = await fetchGateDevicesBootstrap({
          username,
          language: "en",
          filters: {
            mandi_id: mandi_id ? Number(mandi_id) : undefined,
            gate_id: gate_id ? String(gate_id) : undefined, // empty means ALL gates
            device_type: device_type || undefined,
            search: search || undefined,
            page: reqPage,
            pageSize: reqPageSize,
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
            device_label: d.device_label || null,
            device_type: d.device_type,
            platform: d.platform,
            linked_user: d.linked_user,
            mandi_id: d.mandi_id,
            gate_id: d.gate_id ? String(d.gate_id) : undefined,
            gate_code: d.gate_code,
            status: d.status,
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

  // Debounce only search typing; other changes trigger one call
  const searchDebounceRef = useRef<any>(null);
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

    searchDebounceRef.current = setTimeout(() => {
      callBootstrap({ reason: "filters", debouncedSearch: filters.search });
    }, 250);

    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [callBootstrap, filters.mandi_id, filters.gate_id, filters.device_type, filters.search, page, pageSize]);

  // Reset pagination when filters change (refine behavior)
  useEffect(() => {
    setPage(1);
  }, [filters.mandi_id, filters.gate_id, filters.device_type, filters.search]);

  // IMPORTANT: do NOT block list by gate selection.
  // Selecting Mandi should show all devices for that mandi across gates.
  const showSelectMessage = !filters.mandi_id;

  /**
   * Fetch gates for dialog mandi selection, so user can select gate reliably.
   */
  const fetchDialogGates = useCallback(
    async (mandiId: string | number) => {
      const username = currentUsername();
      if (!username || !mandiId) {
        setDialogGateOptions([]);
        return;
      }

      const resp = await fetchGateDevicesBootstrap({
        username,
        language: "en",
        filters: {
          mandi_id: Number(mandiId),
          // no gate_id -> we only want gates list
          page: 1,
          pageSize: 1,
        },
      });

      if (!resp.ok) {
        setDialogGateOptions([]);
        return;
      }

      const data = resp.data?.data || resp.data || {};
      setDialogGateOptions((data?.gates?.items || []) as GateOption[]);
    },
    [],
  );

  // when dialog mandi changes, refresh its gates list
  useEffect(() => {
    if (!dialogOpen) return;
    if (!form.mandi_id) {
      setDialogGateOptions([]);
      return;
    }
    fetchDialogGates(form.mandi_id);
  }, [dialogOpen, form.mandi_id, fetchDialogGates]);

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
              "& .MuiAutocomplete-root": { minWidth: { xs: "100%", md: 260 } },
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
                  gate_id: "", // reset to ALL gates when mandi changes
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
              helperText={!filters.mandi_id ? "Select mandi first" : gateOptions.length === 0 ? "No gates" : "All gates by default"}
            >
              <MenuItem value="">All</MenuItem>
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
                  setForm({
                    device_code: "",
                    device_label: "",
                    device_type: filters.device_type || "GPS_PHONE",
                    mandi_id: filters.mandi_id || "",
                    gate_id: filters.gate_id || "",
                  });
                  setDialogGateOptions([]);
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
                Select a <b>Mandi</b> to view devices. (Gate filter is optional.)
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
                      {r.last_seen_on ? (
                        <Chip size="small" label={`Last Seen: ${new Date(String(r.last_seen_on)).toLocaleString()}`} />
                      ) : null}
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
                minWidth={980}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Add Device Dialog */}
      <Dialog open={dialogOpen} onClose={() => (!saving ? setDialogOpen(false) : null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          Add Device
          <IconButton size="small" onClick={() => (!saving ? setDialogOpen(false) : null)} aria-label="close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Device Code (optional)"
              size="small"
              value={form.device_code}
              onChange={(e) => setForm((f) => ({ ...f, device_code: e.target.value }))}
              helperText="Optional. Leave blank if backend auto-generates / normalizes."
            />

            <TextField
              label="Device Label"
              size="small"
              value={form.device_label}
              onChange={(e) => setForm((f) => ({ ...f, device_label: e.target.value }))}
              helperText="Human-friendly name (recommended)."
            />

            <TextField
              select
              label="Device Type"
              size="small"
              value={form.device_type}
              onChange={(e) => setForm((f) => ({ ...f, device_type: e.target.value }))}
            >
              {deviceTypeOptions.length ? (
                deviceTypeOptions.map((d) => (
                  <MenuItem key={d} value={d}>
                    {toUiDeviceType(d)}
                  </MenuItem>
                ))
              ) : (
                <MenuItem value="GPS_PHONE">GPS_PHONE</MenuItem>
              )}
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
              helperText={
                !form.mandi_id
                  ? "Select mandi first"
                  : dialogGateOptions.length === 0
                    ? "No gates for this mandi"
                    : ""
              }
            >
              {dialogGateOptions.map((g) => (
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
            disabled={saving || !form.device_type || !form.mandi_id || !form.gate_id}
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

                setSaving(true);

                const payload: Record<string, any> = {
                  org_id: orgId,
                  mandi_id: Number(form.mandi_id),
                  gate_id: String(form.gate_id),
                  device_type: form.device_type,
                  status: "ACTIVE",
                };

                // send device_code only if user provided
                if (String(form.device_code || "").trim().length > 0) {
                  payload.device_code = String(form.device_code).trim();
                }
                if (String(form.device_label || "").trim().length > 0) {
                  payload.device_label = String(form.device_label).trim();
                }

                const resp = await createGateDevice({
                  username,
                  language: "en",
                  payload,
                });

                if (!resp?.ok) {
                  enqueueSnackbar(resp?.description || "Failed to add device", { variant: "error" });
                  return;
                }

                enqueueSnackbar(resp?.description || "Device added", { variant: "success" });
                setDialogOpen(false);

                // Ensure list refresh uses NEW filters immediately (no stale state)
                const newMandiId = form.mandi_id;
                const newGateId = ""; // after create, show all gates in mandi (better UX)
                setFilters((f) => ({
                  ...f,
                  mandi_id: newMandiId || f.mandi_id,
                  gate_id: newGateId,
                }));
                setPage(1);

                await callBootstrap({
                  reason: "after_create",
                  override: {
                    mandi_id: newMandiId,
                    gate_id: newGateId,
                    device_type: filters.device_type,
                    search: filters.search,
                    page: 1,
                    pageSize,
                  },
                });
              } catch (err: any) {
                enqueueSnackbar(err?.message || "Failed to add device", { variant: "error" });
              } finally {
                setSaving(false);
              }
            }}
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};

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
//   device_label?: string;
//   device_type: string;
//   platform?: string;
//   linked_user?: string;
//   mandi_id: number;
//   gate_id?: string;
//   gate_code?: string;
//   status?: string;
//   is_active?: string;
//   last_seen_on?: string;
//   updated_on?: string;
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

// function toUiDeviceType(v: string): string {
//   // Keep backend enums as-is; UI shows raw for now.
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
//     gate_id: "" as string,
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
//   const [form, setForm] = useState({
//     device_code: "",
//     device_label: "",
//     device_type: "",
//     mandi_id: "" as string | number,
//     gate_id: "",
//   });

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

//   const selectedGate = useMemo(() => {
//     return gateOptions.find((g) => String(g._id) === String(filters.gate_id)) || null;
//   }, [gateOptions, filters.gate_id]);

//   const columns = useMemo<GridColDef<DeviceRow>[]>(
//     () => [
//       { field: "device_code", headerName: "Device Code", width: 180 },
//       {
//         field: "device_label",
//         headerName: "Label",
//         width: 180,
//         valueGetter: (params: any) => (params?.row as DeviceRow)?.device_label || "—",
//       },
//       {
//         field: "device_type",
//         headerName: "Type",
//         width: 200,
//         valueGetter: (params: any) => toUiDeviceType((params?.row as DeviceRow)?.device_type),
//       },
//       { field: "gate_code", headerName: "Gate", width: 120, valueGetter: (p: any) => (p?.row as DeviceRow)?.gate_code || "—" },
//       {
//         field: "status",
//         headerName: "Status",
//         width: 120,
//         valueGetter: (params: any) => (params?.row as DeviceRow)?.status || "—",
//       },
//       {
//         field: "last_seen_on",
//         headerName: "Last Seen",
//         width: 180,
//         valueGetter: (params: any) => {
//           const v = (params?.row as DeviceRow)?.last_seen_on;
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
//     async (opts: { reason: string; debouncedSearch?: string } = { reason: "manual" }) => {
//       const username = currentUsername();
//       if (!username) return;

//       const keyObj = {
//         org_id: authContext.org_id || initialOrg.org_id || "",
//         mandi_id: filters.mandi_id || "",
//         gate_id: filters.gate_id || "",
//         device_type: filters.device_type || "",
//         search: opts.debouncedSearch ?? filters.search ?? "",
//         page,
//         pageSize,
//       };
//       const requestKey = JSON.stringify(keyObj);
//       if (inflightRef.current && lastKeyRef.current === requestKey) {
//         return; // same request already in-flight
//       }
//       lastKeyRef.current = requestKey;

//       setLoading(true);
//       const promise = (async () => {
//         const resp = await fetchGateDevicesBootstrap({
//           username,
//           language: "en",
//           filters: {
//             mandi_id: filters.mandi_id ? Number(filters.mandi_id) : undefined,
//             gate_id: filters.gate_id ? String(filters.gate_id) : undefined,
//             device_type: filters.device_type || undefined,
//             search: (opts.debouncedSearch ?? filters.search) || undefined,
//             page,
//             pageSize,
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
//             device_type: d.device_type,
//             platform: d.platform,
//             linked_user: d.linked_user,
//             mandi_id: d.mandi_id,
//             gate_id: d.gate_id ? String(d.gate_id) : undefined,
//             gate_code: d.gate_code,
//             status: d.status,
//             is_active: d.is_active,
//             last_seen_on: d.last_seen_on,
//             updated_on: d.updated_on,
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

//   // --- Mount + filter changes
//   const searchDebounceRef = useRef<any>(null);
//   useEffect(() => {
//     // Debounce only on search typing; other filter changes call immediately
//     if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);

//     const shouldDebounce = true;
//     if (shouldDebounce) {
//       searchDebounceRef.current = setTimeout(() => {
//         callBootstrap({ reason: "filters", debouncedSearch: filters.search });
//       }, 300);
//     } else {
//       callBootstrap({ reason: "filters" });
//     }

//     return () => {
//       if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
//     };
//   }, [callBootstrap, filters.mandi_id, filters.gate_id, filters.device_type, filters.search, page, pageSize]);

//   // Reset pagination when key filters change
//   useEffect(() => {
//     setPage(1);
//   }, [filters.mandi_id, filters.gate_id, filters.device_type, filters.search]);

//   const showSelectMessage = !filters.mandi_id || !filters.gate_id;

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

//       {/* Filter bar */}
//       <Card sx={{ mb: 2 }}>
//         <CardContent>
//           <Stack
//             direction={{ xs: "column", md: "row" }}
//             spacing={1}
//             alignItems={{ xs: "stretch", md: "center" }}
//             sx={{
//               "& .MuiTextField-root": { minWidth: { xs: "100%", md: 180 } },
//               "& .MuiAutocomplete-root": { minWidth: { xs: "100%", md: 240 } },
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
//               helperText={!filters.mandi_id ? "Select mandi first" : gateOptions.length === 0 ? "No gates" : ""}
//             >
//               <MenuItem value="">Select</MenuItem>
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
//                   // Prefill based on current filters if available
//                   setForm({
//                     device_code: "",
//                     device_label: "",
//                     device_type: filters.device_type || "",
//                     mandi_id: filters.mandi_id || "",
//                     gate_id: filters.gate_id || "",
//                   });
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
//             <Stack spacing={1} alignItems="flex-start">
//               <Typography variant="body2" color="text.secondary">
//                 Select <b>Mandi</b> and <b>Gate</b> to view devices.
//               </Typography>
//             </Stack>
//           ) : null}

//           <Divider sx={{ my: 1 }} />

//           {isMobile ? (
//             <Stack spacing={1}>
//               {loading ? (
//                 <Stack direction="row" alignItems="center" spacing={1}>
//                   <CircularProgress size={18} />
//                   <Typography variant="body2" color="text.secondary">
//                     Loading…
//                   </Typography>
//                 </Stack>
//               ) : null}

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
//                 getRowId={(r) => r.id}
//                 autoHeight
//                 paginationMode="server"
//                 rowCount={totalCount}
//                 paginationModel={{ page: page - 1, pageSize }}
//                 onPaginationModelChange={(model) => {
//                   setPage(model.page + 1);
//                   if (model.pageSize !== pageSize) {
//                     setPageSize(model.pageSize);
//                     setPage(1);
//                   }
//                 }}
//                 pageSizeOptions={[10, 20, 50]}
//                 minWidth={900}
//               />
//             </Box>
//           )}
//         </CardContent>
//       </Card>

//       {/* Add Device Dialog */}
//       <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
//         <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
//           Add Device
//           <IconButton size="small" onClick={() => setDialogOpen(false)} aria-label="close">
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
//               helperText="Example: phone_orgadmin_gate01"
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
//               {deviceTypeOptions.map((d) => (
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
//               helperText={!form.mandi_id ? "Select mandi first" : gateOptions.length === 0 ? "No gates" : ""}
//             >
//               {gateOptions.map((g) => (
//                 <MenuItem key={g._id} value={g._id}>
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

//                 const resp = await createGateDevice({
//                   username,
//                   language: "en",
//                   payload: {
//                     org_id: orgId,
//                     mandi_id: Number(form.mandi_id),
//                     gate_id: form.gate_id,
//                     device_type: form.device_type,
//                     device_code: form.device_code,
//                     device_label: form.device_label || undefined,
//                     status: "ACTIVE",
//                   },
//                 });

//                 if (!resp?.ok) {
//                   enqueueSnackbar(resp?.description || "Failed to add device", { variant: "error" });
//                   return;
//                 }

//                 enqueueSnackbar(resp?.description || "Device added", { variant: "success" });
//                 setDialogOpen(false);
//                 setFilters((f) => ({
//                   ...f,
//                   mandi_id: form.mandi_id || f.mandi_id,
//                   gate_id: form.gate_id || f.gate_id,
//                 }));
//                 // Refresh list
//                 callBootstrap({ reason: "after_create" });
//               } catch (err: any) {
//                 enqueueSnackbar(err?.message || "Failed to add device", { variant: "error" });
//               }
//             }}
//             disabled={!form.device_code || !form.device_type || !form.mandi_id || !form.gate_id}
//           >
//             Save
//           </Button>
//         </DialogActions>
//       </Dialog>
//     </PageContainer>
//   );
// };