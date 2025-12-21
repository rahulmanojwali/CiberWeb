import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Snackbar,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import { normalizeFlag } from "../../utils/statusUtils";
import { fetchOrganisations } from "../../services/adminUsersApi";
import {
  fetchOrgMandiMappings,
  addOrgMandi,
  fetchMandis,
} from "../../services/mandiApi";
import Autocomplete from "@mui/material/Autocomplete";

type MappingRow = {
  id: string;
  org_id: string;
  org_code: string | null;
  org_name: string | null;
  org_display: string;      // "CODE - Name"
  mandi_id: number;
  mandi_slug: string | null;
  mandi_name: string | null;
  mandi_display: string;    // "Name (ID)" or "Slug (ID)"
  state_code: string | null;
  district_name: string | null;
  pincode: string | null;
  assignment_scope: string;
  // raw flags (optional)
  mandi_is_active_raw?: any;
  mapping_is_active_raw?: any;
  // effective status
  status_effective: "Y" | "N";
  status_label: string;     // "Active"/"Inactive"
  status_color: "success" | "default";
};

type OrgOption = { _id: string; org_code: string; org_name: string };
type MandiOption = { mandi_id: number; name: string };

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

export const OrgMandiMapping: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const theme = useTheme();
  const fullScreenDialog = useMediaQuery(theme.breakpoints.down("sm"));
  const isMobile = fullScreenDialog;
  const roleSlug = uiConfig.role || "";

  const [rows, setRows] = useState<MappingRow[]>([]);
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [mandiOptions, setMandiOptions] = useState<MandiOption[]>([]);
  const [mandiSearch, setMandiSearch] = useState("");
  const [selectedMandi, setSelectedMandi] = useState<MandiOption | null>(null);
  const [filters, setFilters] = useState({
    org_id: "",
    status: "ALL" as "ALL" | "Y" | "N",
  });
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    org_id: "",
    mandi_id: "",
    assignment_scope: "EXCLUSIVE",
    is_active: true,
  });
  const [toast, setToast] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });

  const canCreate = useMemo(
    () =>
      can(uiConfig.resources, "org_mandi_mapping.create", "CREATE") ||
      ["SUPER_ADMIN", "ORG_ADMIN"].includes(roleSlug),
    [uiConfig.resources, roleSlug]
  );

  // ---------------------- LOAD ORGS ---------------------- //

  const loadOrgs = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchOrganisations({ username, language });

    const payload: any = resp?.data || resp?.response || resp;
    const orgs =
      payload?.data?.organisations ||
      payload?.organisations ||
      [];

    setOrgOptions(
      orgs.map((o: any) => ({
        _id: o._id,
        org_code: o.org_code,
        org_name: o.org_name,
      }))
    );
  };

  // ---------------------- LOAD MANDIS FOR DIALOG ---------------------- //

  const loadMandis = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchMandis({
      username,
      language,
      filters: { is_active: true, page: 1, pageSize: 1000, search: mandiSearch },
    });
    const payload: any = resp?.data || resp?.response || resp;
    const mandis =
      payload?.data?.mandis ||
      payload?.mandis ||
      [];

    const mapped: MandiOption[] = mandis.map((m: any) => ({
      mandi_id: m.mandi_id,
      name:
        m.mandi_name ||
        m.name_i18n?.en ||
        m.mandi_slug ||
        String(m.mandi_id),
    }));

    if (
      selectedMandi &&
      !mapped.find((m) => m.mandi_id === selectedMandi.mandi_id)
    ) {
      mapped.push(selectedMandi);
    }
    setMandiOptions(mapped);

    if (!selectedMandi && form.mandi_id) {
      const found = mapped.find(
        (m) => String(m.mandi_id) === String(form.mandi_id)
      );
      if (found) setSelectedMandi(found);
    }
  };

  // ---------------------- LOAD MAPPINGS (MAIN LIST) ---------------------- //

  const loadMappings = async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp = await fetchOrgMandiMappings({
        username,
        language,
        filters: {
          org_id: filters.org_id || undefined,
          is_active: filters.status === "ALL" ? undefined : filters.status,
        },
      });

      const payload: any = resp?.data || resp?.response || resp;
      const list: any[] =
        payload?.data?.mappings ||
        payload?.mappings ||
        [];

      console.log("OrgMandi mappings RAW from API:", list);

      const mappedRows: MappingRow[] = list.map((m) => {
        const org_code = m.org_code || null;
        const org_name = m.org_name || null;
        const org_display =
          org_code && org_name
            ? `${org_code} - ${org_name}`
            : org_code || org_name || m.org_id || "";

        const mandi_id = Number(m.mandi_id);
        const mandi_name = m.mandi_name || null;
        const mandi_slug = m.mandi_slug || null;
        const mandi_display =
          mandi_name
            ? `${mandi_name} (${mandi_id})`
            : mandi_slug
            ? `${mandi_slug} (${mandi_id})`
            : String(mandi_id);

        // flags from backend
        const mandiFlagRaw =
          m.master_is_active ??
          m.mandi_is_active ??
          m.mandi_active ??
          m.is_active_mandi ??
          m.active_mandi ??
          m.active_master;
        const mappingFlagRaw =
          m.org_mandi_is_active ??
          m.mapping_is_active ??
          m.is_active;

        const mandiFlag = normalizeFlag(mandiFlagRaw);
        const mappingFlag = normalizeFlag(mappingFlagRaw);

        // Effective: ACTIVE only if both mandi and mapping are active
        const effectiveFlag: "Y" | "N" =
          mandiFlag === "Y" && mappingFlag === "Y" ? "Y" : "N";

        const status_label = effectiveFlag === "Y" ? "Active" : "Inactive";
        const status_color: "success" | "default" =
          effectiveFlag === "Y" ? "success" : "default";

        const row: MappingRow = {
          id: String(m._id),
          org_id: String(m.org_id),
          org_code,
          org_name,
          org_display,
          mandi_id,
          mandi_slug,
          mandi_name,
          mandi_display,
          state_code: m.state_code || null,
          district_name: m.district_name || null,
          pincode: m.pincode || null,
          assignment_scope: m.assignment_scope || "EXCLUSIVE",
          mandi_is_active_raw: mandiFlagRaw,
          mapping_is_active_raw: mappingFlagRaw,
          status_effective: effectiveFlag,
          status_label,
          status_color,
        };

        console.log("OrgMandi row mapped for UI:", row);
        return row;
      });

      setRows(mappedRows);
    } catch (err: any) {
      console.error("OrgMandi mappings load error", err);
      setToast({
        open: true,
        message: "Failed to load mappings",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // ---------------------- EFFECTS ---------------------- //

  useEffect(() => {
    loadOrgs();
    loadMandis();
  }, []);

  useEffect(() => {
    loadMappings();
  }, [filters.org_id, filters.status]);

  useEffect(() => {
    loadMandis();
  }, [mandiSearch]);

  // ---------------------- DIALOG HANDLERS ---------------------- //

  const openCreate = () => {
    setForm({
      org_id: "",
      mandi_id: "",
      assignment_scope: "EXCLUSIVE",
      is_active: true,
    });
    setSelectedMandi(null);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username) return;
    if (!form.org_id || !form.mandi_id) {
      setToast({
        open: true,
        message: "org and mandi required",
        severity: "error",
      });
      return;
    }
    try {
      const resp = await addOrgMandi({
        username,
        language,
        payload: {
          org_id: form.org_id,
          mandi_id: Number(form.mandi_id),
          assignment_scope: form.assignment_scope,
          is_active: form.is_active ? "Y" : "N",
        },
      });
      console.log("AddOrgMandi resp", resp);

      const payload: any = resp?.data || resp?.response || resp;
      const code =
        payload?.response?.responsecode || payload?.responsecode || "1";
      const desc =
        payload?.response?.description || payload?.description || "Unknown";

      if (code !== "0") {
        setToast({ open: true, message: desc, severity: "error" });
        return;
      }
      setDialogOpen(false);
      setToast({ open: true, message: "Saved", severity: "success" });
      await loadMappings();
    } catch (err: any) {
      console.error("AddOrgMandi error", err);
      setToast({
        open: true,
        message: "Failed to save mapping",
        severity: "error",
      });
    }
  };

  // ---------------------- RENDER ---------------------- //

  return (
    <PageContainer>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h5">Org–Mandi Mapping</Typography>
          <Typography variant="body2" color="text.secondary">
            Assign mandis to organisations with granular scope controls.
          </Typography>
        </Stack>
        {canCreate && (
          <Button
            variant="contained"
            size="medium"
            startIcon={<AddIcon />}
            onClick={openCreate}
          >
            Add Mapping
          </Button>
        )}
      </Stack>

      {/* Filters */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                select
                label="Organisation"
                size="small"
                value={filters.org_id}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, org_id: e.target.value }))
                }
                fullWidth
              >
                <MenuItem value="">All</MenuItem>
                {orgOptions.map((o) => (
                  <MenuItem key={o._id} value={o._id}>
                    {o.org_code} {o.org_name ? `- ${o.org_name}` : ""}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                label="Status"
                size="small"
                value={filters.status}
                onChange={(e) =>
                  setFilters((f) => ({
                    ...f,
                    status: e.target.value as "ALL" | "Y" | "N",
                  }))
                }
                fullWidth
              >
                <MenuItem value="ALL">All</MenuItem>
                <MenuItem value="Y">Active</MenuItem>
                <MenuItem value="N">Inactive</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant="outlined"
                size="medium"
                onClick={loadMappings}
                disabled={loading}
                fullWidth
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* List */}
      <Card>
        <CardContent>
          {loading ? (
            <Box
              sx={{
                py: 4,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <CircularProgress />
            </Box>
          ) : rows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No mappings found.
            </Typography>
          ) : isMobile ? (
            // ---------- MOBILE: CARD VIEW ----------
            <Stack spacing={2}>
              {rows.map((row) => (
                <Card key={row.id} variant="outlined">
                  <CardContent
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 0.75,
                    }}
                  >
                    <Typography variant="subtitle1">
                      Org: {row.org_display || row.org_id}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Mandi: {row.mandi_display}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Scope: {row.assignment_scope}
                    </Typography>
                    <Chip
                      size="small"
                      color={row.status_color}
                      label={row.status_label}
                      sx={{ alignSelf: "flex-start" }}
                    />
                    <Typography variant="caption" color="text.secondary">
                      State: {row.state_code || "-"} • District:{" "}
                      {row.district_name || "-"} • Pincode:{" "}
                      {row.pincode || "-"}
                    </Typography>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          ) : (
            // ---------- DESKTOP: TABLE VIEW ----------
            <TableContainer sx={{ maxHeight: 500 }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Organisation</TableCell>
                    <TableCell>Mandi ID</TableCell>
                    <TableCell>Mandi</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell>District</TableCell>
                    <TableCell>Pincode</TableCell>
                    <TableCell>Scope</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>{row.org_display || row.org_id}</TableCell>
                      <TableCell>{row.mandi_id}</TableCell>
                      <TableCell>{row.mandi_display}</TableCell>
                      <TableCell>{row.state_code || "-"}</TableCell>
                      <TableCell>{row.district_name || "-"}</TableCell>
                      <TableCell>{row.pincode || "-"}</TableCell>
                      <TableCell>{row.assignment_scope}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={row.status_color}
                          label={row.status_label}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* Create Mapping Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
        fullScreen={fullScreenDialog}
      >
        <DialogTitle>Map Organisation to Mandi</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} mt={1}>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Organisation"
                size="small"
                value={form.org_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, org_id: e.target.value }))
                }
                fullWidth
              >
                {orgOptions.map((o) => (
                  <MenuItem key={o._id} value={o._id}>
                    {o.org_code} {o.org_name ? `- ${o.org_name}` : ""}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Autocomplete
                size="small"
                options={mandiOptions}
                getOptionLabel={(option) =>
                  `${option.name} (${option.mandi_id})`
                }
                inputValue={mandiSearch}
                onInputChange={(_, value) => setMandiSearch(value)}
                value={selectedMandi}
                onChange={(_, val) => {
                  setSelectedMandi(val);
                  setForm((f) => ({
                    ...f,
                    mandi_id: val ? String(val.mandi_id) : "",
                  }));
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Mandi"
                    placeholder="Search mandi by name or slug"
                    fullWidth
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Scope"
                size="small"
                value={form.assignment_scope}
                onChange={(e) =>
                  setForm((f) => ({ ...f, assignment_scope: e.target.value }))
                }
                fullWidth
              >
                <MenuItem value="EXCLUSIVE">Exclusive</MenuItem>
                <MenuItem value="SHARED">Shared</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Active"
                size="small"
                value={form.is_active ? "Y" : "N"}
                onChange={(e) =>
                  setForm((f) => ({ ...f, is_active: e.target.value === "Y" }))
                }
                fullWidth
              >
                <MenuItem value="Y">Yes</MenuItem>
                <MenuItem value="N">No</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      {/* Toast */}
      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((t) => ({ ...t, open: false }))}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
};

// import React, { useEffect, useMemo, useState } from "react";
// import {
//   Alert,
//   Box,
//   Button,
//   Card,
//   CardContent,
//   Dialog,
//   DialogActions,
//   DialogContent,
//   DialogTitle,
//   Grid,
//   MenuItem,
//   Snackbar,
//   Stack,
//   TextField,
//   Typography,
//   useMediaQuery,
//   useTheme,
//   Chip,
//   Table,
//   TableBody,
//   TableCell,
//   TableContainer,
//   TableHead,
//   TableRow,
//   CircularProgress,
// } from "@mui/material";
// import AddIcon from "@mui/icons-material/Add";
// import { useTranslation } from "react-i18next";
// import { PageContainer } from "../../components/PageContainer";
// import { normalizeLanguageCode } from "../../config/languages";
// import { useAdminUiConfig } from "../../contexts/admin-ui-config";
// import { can } from "../../utils/adminUiConfig";
// import { fetchOrganisations } from "../../services/adminUsersApi";
// import {
//   fetchOrgMandiMappings,
//   addOrgMandi,
//   fetchMandis,
// } from "../../services/mandiApi";
// import Autocomplete from "@mui/material/Autocomplete";

// type MappingRow = {
//   id: string;
//   org_id: string;
//   org_code: string | null;
//   org_name: string | null;
//   org_display: string;      // "CODE - Name"
//   mandi_id: number;
//   mandi_slug: string | null;
//   mandi_name: string | null;
//   mandi_display: string;    // "Name (ID)" or "Slug (ID)"
//   state_code: string | null;
//   district_name: string | null;
//   pincode: string | null;
//   assignment_scope: string;
//   is_active: string;
//   status_label: string;     // "Active"/"Inactive"
//   status_color: "success" | "default";
// };

// type OrgOption = { _id: string; org_code: string; org_name: string };
// type MandiOption = { mandi_id: number; name: string };

// function currentUsername(): string | null {
//   try {
//     const raw = localStorage.getItem("cd_user");
//     const parsed = raw ? JSON.parse(raw) : null;
//     return parsed?.username || null;
//   } catch {
//     return null;
//   }
// }

// export const OrgMandiMapping: React.FC = () => {
//   const { i18n } = useTranslation();
//   const language = normalizeLanguageCode(i18n.language);
//   const uiConfig = useAdminUiConfig();
//   const theme = useTheme();
//   const fullScreenDialog = useMediaQuery(theme.breakpoints.down("sm"));
//   const isMobile = fullScreenDialog;
//   const roleSlug = uiConfig.role || "";

//   const [rows, setRows] = useState<MappingRow[]>([]);
//   const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
//   const [mandiOptions, setMandiOptions] = useState<MandiOption[]>([]);
//   const [mandiSearch, setMandiSearch] = useState("");
//   const [selectedMandi, setSelectedMandi] = useState<MandiOption | null>(null);
//   const [filters, setFilters] = useState({
//     org_id: "",
//     status: "ALL" as "ALL" | "Y" | "N",
//   });
//   const [loading, setLoading] = useState(false);
//   const [dialogOpen, setDialogOpen] = useState(false);
//   const [form, setForm] = useState({
//     org_id: "",
//     mandi_id: "",
//     assignment_scope: "EXCLUSIVE",
//     is_active: true,
//   });
//   const [toast, setToast] = useState<{
//     open: boolean;
//     message: string;
//     severity: "success" | "error";
//   }>({
//     open: false,
//     message: "",
//     severity: "success",
//   });

//   const canCreate = useMemo(
//     () =>
//       can(uiConfig.resources, "org_mandi_mappings.create", "CREATE") ||
//       ["SUPER_ADMIN", "ORG_ADMIN"].includes(roleSlug),
//     [uiConfig.resources, roleSlug]
//   );

//   // ---------------------- LOAD ORGS ---------------------- //

//   const loadOrgs = async () => {
//     const username = currentUsername();
//     if (!username) return;
//     const resp = await fetchOrganisations({ username, language });

//     const payload: any = resp?.data || resp?.response || resp;
//     const orgs =
//       payload?.data?.organisations ||
//       payload?.organisations ||
//       [];

//     setOrgOptions(
//       orgs.map((o: any) => ({
//         _id: o._id,
//         org_code: o.org_code,
//         org_name: o.org_name,
//       }))
//     );
//   };

//   // ---------------------- LOAD MANDIS FOR DIALOG ---------------------- //

//   const loadMandis = async () => {
//     const username = currentUsername();
//     if (!username) return;
//     const resp = await fetchMandis({
//       username,
//       language,
//       filters: { is_active: true, page: 1, pageSize: 1000, search: mandiSearch },
//     });
//     const payload: any = resp?.data || resp?.response || resp;
//     const mandis =
//       payload?.data?.mandis ||
//       payload?.mandis ||
//       [];

//     const mapped: MandiOption[] = mandis.map((m: any) => ({
//       mandi_id: m.mandi_id,
//       name:
//         m.mandi_name ||
//         m.name_i18n?.en ||
//         m.mandi_slug ||
//         String(m.mandi_id),
//     }));

//     if (
//       selectedMandi &&
//       !mapped.find((m) => m.mandi_id === selectedMandi.mandi_id)
//     ) {
//       mapped.push(selectedMandi);
//     }
//     setMandiOptions(mapped);

//     if (!selectedMandi && form.mandi_id) {
//       const found = mapped.find(
//         (m) => String(m.mandi_id) === String(form.mandi_id)
//       );
//       if (found) setSelectedMandi(found);
//     }
//   };

//   // ---------------------- LOAD MAPPINGS (MAIN LIST) ---------------------- //

//   const loadMappings = async () => {
//     const username = currentUsername();
//     if (!username) return;
//     setLoading(true);
//     try {
//       const resp = await fetchOrgMandiMappings({
//         username,
//         language,
//         filters: {
//           org_id: filters.org_id || undefined,
//           is_active: filters.status === "ALL" ? undefined : filters.status,
//         },
//       });

//       const payload: any = resp?.data || resp?.response || resp;
//       const list: any[] =
//         payload?.data?.mappings ||
//         payload?.mappings ||
//         [];

//       console.log("OrgMandi mappings RAW from API:", list);

//       const mappedRows: MappingRow[] = list.map((m) => {
//         const org_code = m.org_code || null;
//         const org_name = m.org_name || null;
//         const org_display =
//           org_code && org_name
//             ? `${org_code} - ${org_name}`
//             : org_code || org_name || m.org_id || "";

//         const mandi_id = Number(m.mandi_id);
//         const mandi_name = m.mandi_name || null;
//         const mandi_slug = m.mandi_slug || null;
//         const mandi_display =
//           mandi_name
//             ? `${mandi_name} (${mandi_id})`
//             : mandi_slug
//             ? `${mandi_slug} (${mandi_id})`
//             : String(mandi_id);

//         const rawStatus =
//           m.mandi_is_active ??
//           m.mandi_active ??
//           m.is_active_mandi ??
//           m.is_active;

//         const normalizedStatus =
//           String(rawStatus).trim().toUpperCase() === "Y" || rawStatus === true
//             ? "Y"
//             : "N";

//         const status_label = normalizedStatus === "Y" ? "Active" : "Inactive";
//         const status_color: "success" | "default" =
//           normalizedStatus === "Y" ? "success" : "default";

//         const row: MappingRow = {
//           id: String(m._id),
//           org_id: String(m.org_id),
//           org_code,
//           org_name,
//           org_display,
//           mandi_id,
//           mandi_slug,
//           mandi_name,
//           mandi_display,
//           state_code: m.state_code || null,
//           district_name: m.district_name || null,
//           pincode: m.pincode || null,
//           assignment_scope: m.assignment_scope || "EXCLUSIVE",
//           is_active: m.is_active || "Y",
//           status_label,
//           status_color,
//         };

//         console.log("OrgMandi row mapped for table:", row);
//         return row;
//       });

//       setRows(mappedRows);
//     } catch (err: any) {
//       console.error("OrgMandi mappings load error", err);
//       setToast({
//         open: true,
//         message: "Failed to load mappings",
//         severity: "error",
//       });
//     } finally {
//       setLoading(false);
//     }
//   };

//   // ---------------------- EFFECTS ---------------------- //

//   useEffect(() => {
//     loadOrgs();
//     loadMandis();
//   }, []);

//   useEffect(() => {
//     loadMappings();
//   }, [filters.org_id, filters.status]);

//   useEffect(() => {
//     loadMandis();
//   }, [mandiSearch]);

//   // ---------------------- DIALOG HANDLERS ---------------------- //

//   const openCreate = () => {
//     setForm({
//       org_id: "",
//       mandi_id: "",
//       assignment_scope: "EXCLUSIVE",
//       is_active: true,
//     });
//     setSelectedMandi(null);
//     setDialogOpen(true);
//   };

//   const handleSave = async () => {
//     const username = currentUsername();
//     if (!username) return;
//     if (!form.org_id || !form.mandi_id) {
//       setToast({
//         open: true,
//         message: "org and mandi required",
//         severity: "error",
//       });
//       return;
//     }
//     try {
//       const resp = await addOrgMandi({
//         username,
//         language,
//         payload: {
//           org_id: form.org_id,
//           mandi_id: Number(form.mandi_id),
//           assignment_scope: form.assignment_scope,
//           is_active: form.is_active ? "Y" : "N",
//         },
//       });
//       console.log("AddOrgMandi resp", resp);

//       const payload: any = resp?.data || resp?.response || resp;
//       const code =
//         payload?.response?.responsecode || payload?.responsecode || "1";
//       const desc =
//         payload?.response?.description || payload?.description || "Unknown";

//       if (code !== "0") {
//         setToast({ open: true, message: desc, severity: "error" });
//         return;
//       }
//       setDialogOpen(false);
//       setToast({ open: true, message: "Saved", severity: "success" });
//       await loadMappings();
//     } catch (err: any) {
//       console.error("AddOrgMandi error", err);
//       setToast({
//         open: true,
//         message: "Failed to save mapping",
//         severity: "error",
//       });
//     }
//   };

//   // ---------------------- RENDER ---------------------- //

//   return (
//     <PageContainer>
//       <Stack
//         direction={{ xs: "column", md: "row" }}
//         justifyContent="space-between"
//         alignItems={{ xs: "flex-start", md: "center" }}
//         spacing={2}
//         sx={{ mb: 2 }}
//       >
//         <Stack spacing={0.5}>
//           <Typography variant="h5">Org–Mandi Mapping</Typography>
//           <Typography variant="body2" color="text.secondary">
//             Assign mandis to organisations with granular scope controls.
//           </Typography>
//         </Stack>
//         {canCreate && (
//           <Button
//             variant="contained"
//             size="medium"
//             startIcon={<AddIcon />}
//             onClick={openCreate}
//           >
//             Add Mapping
//           </Button>
//         )}
//       </Stack>

//       {/* Filters */}
//       <Card sx={{ mb: 2 }}>
//         <CardContent>
//           <Grid container spacing={2} alignItems="center">
//             <Grid item xs={12} md={6}>
//               <TextField
//                 select
//                 label="Organisation"
//                 size="small"
//                 value={filters.org_id}
//                 onChange={(e) =>
//                   setFilters((f) => ({ ...f, org_id: e.target.value }))
//                 }
//                 fullWidth
//               >
//                 <MenuItem value="">All</MenuItem>
//                 {orgOptions.map((o) => (
//                   <MenuItem key={o._id} value={o._id}>
//                     {o.org_code} {o.org_name ? `- ${o.org_name}` : ""}
//                   </MenuItem>
//                 ))}
//               </TextField>
//             </Grid>
//             <Grid item xs={12} md={3}>
//               <TextField
//                 select
//                 label="Status"
//                 size="small"
//                 value={filters.status}
//                 onChange={(e) =>
//                   setFilters((f) => ({
//                     ...f,
//                     status: e.target.value as "ALL" | "Y" | "N",
//                   }))
//                 }
//                 fullWidth
//               >
//                 <MenuItem value="ALL">All</MenuItem>
//                 <MenuItem value="Y">Active</MenuItem>
//                 <MenuItem value="N">Inactive</MenuItem>
//               </TextField>
//             </Grid>
//             <Grid item xs={12} md={3}>
//               <Button
//                 variant="outlined"
//                 size="medium"
//                 onClick={loadMappings}
//                 disabled={loading}
//                 fullWidth
//               >
//                 Refresh
//               </Button>
//             </Grid>
//           </Grid>
//         </CardContent>
//       </Card>

//       {/* List */}
//       <Card>
//         <CardContent>
//           {loading ? (
//             <Box
//               sx={{
//                 py: 4,
//                 display: "flex",
//                 alignItems: "center",
//                 justifyContent: "center",
//               }}
//             >
//               <CircularProgress />
//             </Box>
//           ) : rows.length === 0 ? (
//             <Typography variant="body2" color="text.secondary">
//               No mappings found.
//             </Typography>
//           ) : (
//             <TableContainer sx={{ maxHeight: 500 }}>
//               <Table stickyHeader size="small">
//                 <TableHead>
//                   <TableRow>
//                     <TableCell>Organisation</TableCell>
//                     <TableCell>Mandi ID</TableCell>
//                     <TableCell>Mandi</TableCell>
//                     <TableCell>State</TableCell>
//                     <TableCell>District</TableCell>
//                     <TableCell>Pincode</TableCell>
//                     <TableCell>Scope</TableCell>
//                     <TableCell>Status</TableCell>
//                   </TableRow>
//                 </TableHead>
//                 <TableBody>
//                   {rows.map((row) => (
//                     <TableRow key={row.id} hover>
//                       <TableCell>{row.org_display || row.org_id}</TableCell>
//                       <TableCell>{row.mandi_id}</TableCell>
//                       <TableCell>{row.mandi_display}</TableCell>
//                       <TableCell>{row.state_code || "-"}</TableCell>
//                       <TableCell>{row.district_name || "-"}</TableCell>
//                       <TableCell>{row.pincode || "-"}</TableCell>
//                       <TableCell>{row.assignment_scope}</TableCell>
//                       <TableCell>
//                         <Chip
//                           size="small"
//                           color={row.status_color}
//                           label={row.status_label}
//                         />
//                       </TableCell>
//                     </TableRow>
//                   ))}
//                 </TableBody>
//               </Table>
//             </TableContainer>
//           )}
//         </CardContent>
//       </Card>

//       {/* Create Mapping Dialog */}
//       <Dialog
//         open={dialogOpen}
//         onClose={() => setDialogOpen(false)}
//         fullWidth
//         maxWidth="sm"
//         fullScreen={fullScreenDialog}
//       >
//         <DialogTitle>Map Organisation to Mandi</DialogTitle>
//         <DialogContent dividers>
//           <Grid container spacing={2} mt={1}>
//             <Grid item xs={12} sm={6}>
//               <TextField
//                 select
//                 label="Organisation"
//                 size="small"
//                 value={form.org_id}
//                 onChange={(e) =>
//                   setForm((f) => ({ ...f, org_id: e.target.value }))
//                 }
//                 fullWidth
//               >
//                 {orgOptions.map((o) => (
//                   <MenuItem key={o._id} value={o._id}>
//                     {o.org_code} {o.org_name ? `- ${o.org_name}` : ""}
//                   </MenuItem>
//                 ))}
//               </TextField>
//             </Grid>
//             <Grid item xs={12} sm={6}>
//               <Autocomplete
//                 size="small"
//                 options={mandiOptions}
//                 getOptionLabel={(option) =>
//                   `${option.name} (${option.mandi_id})`
//                 }
//                 inputValue={mandiSearch}
//                 onInputChange={(_, value) => setMandiSearch(value)}
//                 value={selectedMandi}
//                 onChange={(_, val) => {
//                   setSelectedMandi(val);
//                   setForm((f) => ({
//                     ...f,
//                     mandi_id: val ? String(val.mandi_id) : "",
//                   }));
//                 }}
//                 renderInput={(params) => (
//                   <TextField
//                     {...params}
//                     label="Mandi"
//                     placeholder="Search mandi by name or slug"
//                     fullWidth
//                   />
//                 )}
//               />
//             </Grid>
//             <Grid item xs={12} sm={6}>
//               <TextField
//                 select
//                 label="Scope"
//                 size="small"
//                 value={form.assignment_scope}
//                 onChange={(e) =>
//                   setForm((f) => ({ ...f, assignment_scope: e.target.value }))
//                 }
//                 fullWidth
//               >
//                 <MenuItem value="EXCLUSIVE">Exclusive</MenuItem>
//                 <MenuItem value="SHARED">Shared</MenuItem>
//               </TextField>
//             </Grid>
//             <Grid item xs={12} sm={6}>
//               <TextField
//                 select
//                 label="Active"
//                 size="small"
//                 value={form.is_active ? "Y" : "N"}
//                 onChange={(e) =>
//                   setForm((f) => ({ ...f, is_active: e.target.value === "Y" }))
//                 }
//                 fullWidth
//               >
//                 <MenuItem value="Y">Yes</MenuItem>
//                 <MenuItem value="N">No</MenuItem>
//               </TextField>
//             </Grid>
//           </Grid>
//         </DialogContent>
//         <DialogActions>
//           <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
//           <Button variant="contained" onClick={handleSave}>
//             Save
//           </Button>
//         </DialogActions>
//       </Dialog>

//       {/* Toast */}
//       <Snackbar
//         open={toast.open}
//         autoHideDuration={3000}
//         onClose={() => setToast((t) => ({ ...t, open: false }))}
//         anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
//       >
//         <Alert
//           severity={toast.severity}
//           onClose={() => setToast((t) => ({ ...t, open: false }))}
//         >
//           {toast.message}
//         </Alert>
//       </Snackbar>
//     </PageContainer>
//   );
// };
