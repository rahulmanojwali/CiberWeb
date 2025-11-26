import React from "react";
import {
  Alert,
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
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
  Snackbar,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  type GridColDef,
  type GridRenderCellParams,
} from "@mui/x-data-grid";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { encryptGenericPayload } from "../../utils/aesUtilBrowser";
import { API_BASE_URL, API_TAGS, API_ROUTES } from "../../config/appConfig";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { getUserScope, isReadOnlyRole, isSuperAdmin, isOrgAdmin } from "../../utils/userScope";

type Scope = "EXCLUSIVE" | "SHARED";
type YesNo = "Y" | "N";

interface MappingRow {
  id: string;
  org_id: string;
  org_code: string | null;
  org_name: string | null;
  state_code: string | null;
  district_name: string | null;
  mandi_id: number;
  mandi_name: string | null;
  mandi_slug: string | null;
  pincode: string | null;
  assignment_scope: Scope;
  is_active: YesNo;
  assignment_start: string | null;
  assignment_end: string | null;
  updated_on?: string | null;
  updated_by?: string | null;
}

interface OrgOption {
  _id: string;
  org_code: string;
  org_name: string;
}

interface StateOption {
  state_code: string;
  state_name: string;
  districts: DistrictOption[];
}

interface DistrictOption {
  district_id: string | null;
  district_name: string | null;
  has_active_mandis: boolean;
}

interface MandiOption {
  mandi_id: number;
  mandi_name: string;
  pincode: string | null;
  state_code: string | null;
  district_name: string | null;
  mandi_slug?: string | null;
}

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
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const scope = getUserScope("OrgMandiPage");
  const role = scope.role;
  const isSuper = isSuperAdmin(role);
  const orgAdmin = isOrgAdmin(role);
  const isReadOnly = isReadOnlyRole(role) || (!isSuper && !orgAdmin);

  const [rows, setRows] = React.useState<MappingRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
    open: false,
    message: "",
    severity: "info",
  });

  const [orgOptions, setOrgOptions] = React.useState<OrgOption[]>([]);
  const [stateOptions, setStateOptions] = React.useState<StateOption[]>([]);
  const [mandiOptions, setMandiOptions] = React.useState<MandiOption[]>([]);

  const [filters, setFilters] = React.useState({
    org_id: "",
    state_code: "",
    district_id: "",
    mandi_id: "",
    is_active: "ALL" as "ALL" | YesNo,
  });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState({
    org_id: "",
    state_code: "",
    district_id: "",
    mandi_id: "",
    assignment_scope: "EXCLUSIVE" as Scope,
    is_active: true,
    assignment_start: "",
    assignment_end: "",
    org_name: "",
    org_code: "",
    mandi_name: "",
    district_name: "",
  });

  const headers = React.useMemo(() => {
    const token = localStorage.getItem("cd_token");
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  }, []);

  const buildBody = React.useCallback(async (items: any) => {
    const encryptedData = await encryptGenericPayload(JSON.stringify({ items }));
    return { encryptedData };
  }, []);

  // --- Load Organisations (for SUPER) ---
  const loadOrgs = React.useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    try {
      const body = await buildBody({ api: API_TAGS.ADMIN_USERS.listOrgs, username, language });
      const { data } = await axios.post(`${API_BASE_URL}${API_ROUTES.admin.getOrganisations}`, body, { headers });
      const resp = data?.response || {};
      if (String(resp.responsecode) !== "0") return;
      let orgs: OrgOption[] = (resp?.data?.organisations || []).map((o: any) => ({
        _id: o._id,
        org_code: o.org_code,
        org_name: o.org_name,
      }));
      if (!isSuper && scope.orgCode) {
        orgs = orgs.filter((o) => o.org_code === scope.orgCode);
      }
      setOrgOptions(orgs);
      if (orgAdmin && scope.orgCode) {
        const match = orgs.find((o) => o.org_code === scope.orgCode);
        if (match) {
          setFilters((f) => ({ ...f, org_id: match._id }));
        }
      }
    } catch (e) {
      // ignore, handled elsewhere
    }
  }, [buildBody, headers, isSuper, orgAdmin, scope.orgCode, language]);

  // --- Load coverage (states + districts) ---
  const loadCoverage = React.useCallback(async () => {
    try {
      const body = await buildBody({
        api: API_TAGS.ORG_MANDI.coverage,
        country: "IN",
        language,
        state_code: null,
        include_inactive: false,
      });
      const { data } = await axios.post(`${API_BASE_URL}${API_ROUTES.masters.getMandiCoverage}`, body, { headers });
      const resp = data?.response || {};
      if (String(resp.responsecode) !== "0") return;
      const states: StateOption[] = (resp?.data?.states || []).map((s: any) => ({
        state_code: s.state_code,
        state_name: s.state_name || s.state_code,
        districts: (s.districts || []).map((d: any) => ({
          district_id: d.district_id,
          district_name: d.district_name,
          has_active_mandis: d.has_active_mandis,
        })),
      }));
      setStateOptions(states);
    } catch (e) {
      // ignore; handled by main error path if needed
    }
  }, [buildBody, headers, language]);

  const loadMandis = React.useCallback(
    async (state_code: string, district_id: string) => {
      if (!state_code || !district_id) {
        setMandiOptions([]);
        return;
      }
      try {
        const body = await buildBody({
          api: API_TAGS.ORG_MANDI.getMandis,
          country: "IN",
          language,
          state_code,
          district_id,
        });
        const { data } = await axios.post(`${API_BASE_URL}${API_ROUTES.masters.getMandis}`, body, { headers });
        const resp = data?.response || {};
        if (String(resp.responsecode) !== "0") return;
        const list: MandiOption[] = (resp?.data?.mandis || []).map((m: any) => ({
          mandi_id: Number(m.mandi_id),
          mandi_name: m.mandi_name || m.display_name || `Mandi ${m.mandi_id}`,
          pincode: m.pincode || null,
          state_code: m.state_code || null,
          district_name: m.district_name || null,
          mandi_slug: m.mandi_slug || null,
        }));
        setMandiOptions(list);
      } catch (e) {
        // ignore
      }
    },
    [buildBody, headers, language]
  );

  const loadMappings = React.useCallback(async () => {
    const username = currentUsername();
    if (!username) {
      setError("No admin session found.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        api: API_TAGS.ORG_MANDI.listMappings,
        username,
        language,
      };
      if (!isSuper && scope.orgCode) payload.org_code = scope.orgCode;
      if (filters.state_code) payload.state_code = filters.state_code;
      if (filters.is_active === "Y" || filters.is_active === "N") payload.is_active = filters.is_active;
      if (filters.org_id) payload.org_id = filters.org_id;
      const body = await buildBody(payload);
      const { data } = await axios.post(`${API_BASE_URL}${API_ROUTES.admin.getOrgMandiMappings}`, body, { headers });
      const resp = data?.response || {};
      const code = String(resp.responsecode ?? "");
      if (code !== "0") {
        setError(resp.description || "Failed to load mappings.");
        setToast({ open: true, message: resp.description || "Failed to load mappings.", severity: "error" });
        return;
      }
      let list: MappingRow[] = (resp?.data?.mappings || []).map((m: any) => ({
        id: m._id,
        org_id: m.org_id,
        org_code: m.org_code,
        org_name: m.org_name,
        state_code: m.state_code,
        district_name: m.district_name,
        mandi_id: Number(m.mandi_id),
        mandi_name: m.mandi_name,
        mandi_slug: m.mandi_slug,
        pincode: m.pincode,
        assignment_scope: m.assignment_scope,
        is_active: m.is_active,
        assignment_start: m.assignment_start,
        assignment_end: m.assignment_end,
        updated_on: m.updated_on,
        updated_by: m.updated_by,
      }));
      if (!isSuper && scope.orgCode) {
        list = list.filter((m) => m.org_code === scope.orgCode);
      }
      setRows(list);
    } catch (e: any) {
      setError(e?.message || "Network error while loading mappings.");
      setToast({ open: true, message: e?.message || "Network error while loading mappings.", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [buildBody, filters.is_active, filters.org_id, filters.state_code, headers, language]);

  React.useEffect(() => {
    loadOrgs();
    loadCoverage();
  }, [loadOrgs, loadCoverage]);

  React.useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  const handleFilterChange = (field: string, value: string) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
    if (field === "state_code") {
      setFilters((prev) => ({ ...prev, state_code: value, district_id: "", mandi_id: "" }));
      setMandiOptions([]);
    }
    if (field === "district_id") {
      setFilters((prev) => ({ ...prev, district_id: value, mandi_id: "" }));
      const state = filters.state_code || value ? filters.state_code : "";
      loadMandis(filters.state_code, value);
    }
  };

  const handleOpenCreate = () => {
    if (!(isSuper || (orgAdmin && scope.orgCode))) {
      setToast({ open: true, message: "You are not authorized to create mappings.", severity: "error" });
      return;
    }
    setIsEditMode(false);
    setEditingId(null);
    setForm({
      org_id: orgAdmin && scope.orgCode
        ? (orgOptions.find((o) => o.org_code === scope.orgCode)?._id || "")
        : "",
      state_code: "",
      district_id: "",
      mandi_id: "",
      assignment_scope: "EXCLUSIVE",
      is_active: true,
      assignment_start: new Date().toISOString().slice(0, 10),
      assignment_end: "",
      org_name: "",
      org_code: "",
      mandi_name: "",
      district_name: "",
    });
    setMandiOptions([]);
    setDialogOpen(true);
  };

  const handleOpenEdit = (row: MappingRow) => {
    const orgScoped = orgAdmin && scope.orgCode && row.org_code === scope.orgCode;
    if (!(isSuper || orgScoped)) {
      setToast({ open: true, message: "You are not authorized to edit this mapping.", severity: "error" });
      return;
    }
    setIsEditMode(true);
    setEditingId(row.id);
    setForm({
      org_id: row.org_id,
      state_code: row.state_code || "",
      district_id: row.district_name || "",
      mandi_id: String(row.mandi_id),
      assignment_scope: row.assignment_scope,
      is_active: row.is_active === "Y",
      assignment_start: row.assignment_start?.slice(0, 10) || "",
      assignment_end: row.assignment_end?.slice(0, 10) || "",
      org_name: row.org_name || "",
      org_code: row.org_code || "",
      mandi_name: row.mandi_name || "",
      district_name: row.district_name || "",
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => setDialogOpen(false);

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (isReadOnly) {
      setDialogOpen(false);
      setToast({ open: true, message: "You are not authorized to modify mappings.", severity: "error" });
      return;
    }
    if (!form.org_id || !form.state_code || !form.district_id || !form.mandi_id) {
      setToast({ open: true, message: "Organisation, State, District, and Mandi are required.", severity: "error" });
      return;
    }
    const username = currentUsername();
    if (!username) {
      setToast({ open: true, message: "No admin session found.", severity: "error" });
      return;
    }
    try {
      setLoading(true);
      setError(null);
      if (isEditMode && editingId) {
        const payload: any = {
          api: API_TAGS.ORG_MANDI.updateMapping,
          username,
          language,
          mapping_id: editingId,
          assignment_scope: form.assignment_scope,
          is_active: form.is_active ? "Y" : "N",
        };
        if (!isSuper && scope.orgCode) payload.org_code = scope.orgCode;
        if (form.assignment_start) payload.assignment_start = form.assignment_start;
        if (form.assignment_end) payload.assignment_end = form.assignment_end;
        const body = await buildBody(payload);
        const { data } = await axios.post(`${API_BASE_URL}${API_ROUTES.admin.updateOrgMandiMapping}`, body, { headers });
        const resp = data?.response || {};
        const code = String(resp.responsecode ?? "");
        if (code !== "0") {
          setToast({ open: true, message: resp.description || "Update failed.", severity: "error" });
        } else {
          setToast({ open: true, message: "Mapping updated.", severity: "success" });
          await loadMappings();
          setDialogOpen(false);
        }
      } else {
        const payload: any = {
          api: API_TAGS.ORG_MANDI.createMapping,
          username,
          language,
          org_id: form.org_id,
          mandi_id: Number(form.mandi_id),
          assignment_scope: form.assignment_scope,
          is_active: form.is_active ? "Y" : "N",
          assignment_start: form.assignment_start || new Date().toISOString(),
        };
        if (!isSuper && scope.orgCode) payload.org_code = scope.orgCode;
        if (form.assignment_end) payload.assignment_end = form.assignment_end;
        const body = await buildBody(payload);
        const { data } = await axios.post(`${API_BASE_URL}${API_ROUTES.admin.createOrgMandiMapping}`, body, { headers });
        const resp = data?.response || {};
        const code = String(resp.responsecode ?? "");
        if (code !== "0") {
          setToast({ open: true, message: resp.description || "Create failed.", severity: "error" });
        } else {
          setToast({ open: true, message: "Mapping created.", severity: "success" });
          await loadMappings();
          setDialogOpen(false);
        }
      }
    } catch (e: any) {
      setToast({ open: true, message: e?.message || "Network error.", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const columns = React.useMemo<GridColDef<MappingRow>[]>(
    () => [
      { field: "org_code", headerName: "Org Code", flex: 0.6 },
      { field: "org_name", headerName: "Org Name", flex: 1 },
      { field: "state_code", headerName: "State", flex: 0.5 },
      { field: "district_name", headerName: "District", flex: 0.9 },
      { field: "mandi_name", headerName: "Mandi", flex: 1.1 },
      { field: "mandi_id", headerName: "Mandi ID", flex: 0.6 },
      { field: "pincode", headerName: "Pincode", flex: 0.6 },
      { field: "assignment_scope", headerName: "Scope", flex: 0.6 },
      {
        field: "is_active",
        headerName: "Active",
        flex: 0.5,
        valueGetter: ((params: any) => (params?.row?.is_active === "Y" ? "Yes" : "No")) as any,
      },
      { field: "assignment_start", headerName: "Start", flex: 0.8 },
      { field: "assignment_end", headerName: "End", flex: 0.8 },
      { field: "updated_on", headerName: "Updated On", flex: 0.9 },
      { field: "updated_by", headerName: "Updated By", flex: 0.7 },
      {
        field: "actions",
        headerName: "Actions",
        sortable: false,
        filterable: false,
        flex: 0.7,
        renderCell: (params: GridRenderCellParams<MappingRow>) => {
          const orgScoped = orgAdmin && scope.orgCode && params.row.org_code === scope.orgCode;
          const canEdit = isSuper || orgScoped;
          if (!canEdit) return null;
          return (
            <Button
              size="small"
              variant="outlined"
              onClick={() => handleOpenEdit(params.row as MappingRow)}
              disabled={!canEdit}
            >
              Edit
            </Button>
          );
        },
      },
    ],
    [isSuper, orgAdmin, scope.orgCode]
  );

  const filteredRows = rows.filter((r) => {
    if (filters.is_active === "Y" && r.is_active !== "Y") return false;
    if (filters.is_active === "N" && r.is_active !== "N") return false;
    if (filters.org_id && r.org_id !== filters.org_id) return false;
    if (filters.state_code && r.state_code !== filters.state_code) return false;
    if (filters.district_id && r.district_name !== filters.district_id) return false;
    if (filters.mandi_id && String(r.mandi_id) !== filters.mandi_id) return false;
    return true;
  });

  return (
    <PageContainer>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
      >
        <Typography variant="h5">Org–Mandi Mapping</Typography>
        <Button
          variant="contained"
          size="small"
          onClick={handleOpenCreate}
          disabled={!isSuper}
          sx={{ alignSelf: { xs: "stretch", md: "flex-start" } }}
        >
          Add Mapping
        </Button>
      </Stack>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        flexWrap="wrap"
      >
        {isSuper ? (
          <TextField
            select
            size="small"
            label="Organisation"
            value={filters.org_id}
            onChange={(e) => setFilters((f) => ({ ...f, org_id: e.target.value }))}
            sx={{ minWidth: { xs: "100%", md: 200 } }}
          >
            <MenuItem value="">All</MenuItem>
            {orgOptions.map((o) => (
              <MenuItem key={o._id} value={o._id}>
                {o.org_code} — {o.org_name}
              </MenuItem>
            ))}
          </TextField>
        ) : null}
        <TextField
          select
          size="small"
          label="State"
          value={filters.state_code}
          onChange={(e) => handleFilterChange("state_code", e.target.value)}
          sx={{ minWidth: { xs: "100%", md: 160 } }}
        >
          <MenuItem value="">All</MenuItem>
          {stateOptions.map((s) => (
            <MenuItem key={s.state_code} value={s.state_code}>
              {s.state_name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label="District"
          value={filters.district_id}
          onChange={(e) => handleFilterChange("district_id", e.target.value)}
          sx={{ minWidth: { xs: "100%", md: 200 } }}
          disabled={!filters.state_code}
        >
          <MenuItem value="">All</MenuItem>
          {stateOptions
            .find((s) => s.state_code === filters.state_code)
            ?.districts.map((d) => (
              <MenuItem key={d.district_id || d.district_name || "NA"} value={d.district_name || ""}>
                {d.district_name || "Unknown"}
              </MenuItem>
            ))}
        </TextField>
        <TextField
          select
          size="small"
          label="Active"
          value={filters.is_active}
          onChange={(e) => setFilters((f) => ({ ...f, is_active: e.target.value as any }))}
          sx={{ minWidth: { xs: "100%", md: 140 } }}
        >
          <MenuItem value="ALL">All</MenuItem>
          <MenuItem value="Y">Active</MenuItem>
          <MenuItem value="N">Inactive</MenuItem>
        </TextField>
        <Button
          variant="outlined"
          size="small"
          onClick={loadMappings}
          disabled={loading}
          sx={{ width: { xs: "100%", md: "auto" } }}
        >
          Refresh
        </Button>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {isSmallScreen ? (
        <Stack spacing={1.5}>
          {filteredRows.map((row) => (
            <Card key={row.id} variant="outlined">
              <CardContent>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  spacing={1}
                >
                  <Box>
                    <Typography variant="subtitle2" color="text.secondary">
                      {row.org_code || row.org_name || "Organisation"}
                    </Typography>
                    <Typography variant="h6">
                      {row.mandi_name || `Mandi #${row.mandi_id}`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {row.state_code} • {row.district_name}
                    </Typography>
                  </Box>
                  <Chip
                    label={row.is_active === "Y" ? "ACTIVE" : "INACTIVE"}
                    color={row.is_active === "Y" ? "success" : "default"}
                    size="small"
                  />
                </Stack>
                <Stack spacing={0.5} mt={1}>
                  <Typography variant="caption" color="text.secondary">
                    Scope: {row.assignment_scope}
                  </Typography>
                  {row.assignment_start && (
                    <Typography variant="caption" color="text.secondary">
                      Start: {row.assignment_start}
                    </Typography>
                  )}
                  {row.assignment_end && (
                    <Typography variant="caption" color="text.secondary">
                      End: {row.assignment_end}
                    </Typography>
                  )}
                </Stack>
                {!isReadOnly && (
                  <Stack direction="row" justifyContent="flex-end" mt={1.5}>
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => handleOpenEdit(row)}
                    >
                      Edit
                    </Button>
                  </Stack>
                )}
              </CardContent>
            </Card>
          ))}
          {!filteredRows.length && (
            <Typography variant="body2" color="text.secondary">
              No mappings found.
            </Typography>
          )}
        </Stack>
      ) : (
        <ResponsiveDataGrid
          rows={filteredRows}
          columns={columns}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          loading={loading}
          minWidth={980}
        />
      )}

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="sm"
        fullScreen={isSmallScreen}
      >
        <DialogTitle>{isEditMode ? "Edit Mapping" : "Add Mapping"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField
              select
              label="Organisation"
              name="org_id"
              value={form.org_id}
              onChange={handleFormChange}
              fullWidth
              disabled={!isSuper || isEditMode}
            >
              {orgOptions.map((o) => (
                <MenuItem key={o._id} value={o._id}>
                  {o.org_code} — {o.org_name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="State"
              name="state_code"
              value={form.state_code}
              onChange={(e) => {
                handleFormChange(e);
                setForm((prev) => ({ ...prev, district_id: "", mandi_id: "" }));
                setMandiOptions([]);
              }}
              fullWidth
              disabled={!isSuper || isEditMode}
            >
              {stateOptions.map((s) => (
                <MenuItem key={s.state_code} value={s.state_code}>
                  {s.state_name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="District"
              name="district_id"
              value={form.district_id}
              onChange={(e) => {
                handleFormChange(e);
                loadMandis(form.state_code, e.target.value);
              }}
              fullWidth
              disabled={!isSuper || isEditMode || !form.state_code}
            >
              {stateOptions
                .find((s) => s.state_code === form.state_code)
                ?.districts.map((d) => (
                  <MenuItem key={d.district_id || d.district_name || "NA"} value={d.district_id || d.district_name || ""}>
                    {d.district_name || "Unknown"}
                  </MenuItem>
                ))}
            </TextField>
            <TextField
              select
              label="Mandi"
              name="mandi_id"
              value={form.mandi_id}
              onChange={handleFormChange}
              fullWidth
              disabled={!isSuper || isEditMode || !form.district_id}
            >
              {mandiOptions.map((m) => (
                <MenuItem key={m.mandi_id} value={String(m.mandi_id)}>
                  {m.mandi_name} ({m.mandi_id})
                </MenuItem>
              ))}
            </TextField>

            <Typography variant="subtitle2">Assignment Scope</Typography>
            <RadioGroup
              row
              name="assignment_scope"
              value={form.assignment_scope}
              onChange={(e) => setForm((prev) => ({ ...prev, assignment_scope: e.target.value as Scope }))}
            >
              <FormControlLabel value="EXCLUSIVE" control={<Radio />} label="Exclusive" />
              <FormControlLabel value="SHARED" control={<Radio />} label="Shared" />
            </RadioGroup>

            <FormControlLabel
              control={
                <Switch
                  checked={form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
              }
              label="Active"
            />

            <TextField
              label="Assignment Start"
              name="assignment_start"
              type="date"
              value={form.assignment_start}
              onChange={handleFormChange}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="Assignment End"
              name="assignment_end"
              type="date"
              value={form.assignment_end}
              onChange={handleFormChange}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={isReadOnly || loading}>
            {loading ? <CircularProgress size={18} /> : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          severity={toast.severity}
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
};
