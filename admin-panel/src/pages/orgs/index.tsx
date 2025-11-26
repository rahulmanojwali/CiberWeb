// src/pages/orgs/index.tsx

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
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import {
  type GridColDef,
  type GridRenderCellParams,
} from "@mui/x-data-grid";
import Snackbar from "@mui/material/Snackbar";
import axios from "axios";
import { encryptGenericPayload } from "../../utils/aesUtilBrowser";
import { API_BASE_URL, API_TAGS, API_ROUTES } from "../../config/appConfig";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { getUserScope, isReadOnlyRole, isSuperAdmin, isOrgAdmin } from "../../utils/userScope";

type OrgStatus = "ACTIVE" | "INACTIVE";

interface OrgRow {
  id: string;
  org_code: string;
  org_name: string;
  country?: string;
  status: OrgStatus;
  created_on?: string;
  created_by?: string;
  updated_on?: string;
  updated_by?: string;
}

type FormState = Omit<OrgRow, "id">;

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

export const Orgs: React.FC = () => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const scope = getUserScope("OrgsPage");
  const role = scope.role;
  const isSuper = isSuperAdmin(role);
  const orgAdmin = isOrgAdmin(role);
  const isReadOnly = isReadOnlyRole(role);

  const [rows, setRows] = React.useState<OrgRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"ALL" | OrgStatus>("ALL");
  const [toast, setToast] = React.useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
    open: false,
    message: "",
    severity: "info",
  });

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [form, setForm] = React.useState<FormState>({
    org_code: "",
    org_name: "",
    country: "IN",
    status: "ACTIVE",
    created_on: "",
    created_by: "",
    updated_on: "",
    updated_by: "",
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

  const loadOrgs = React.useCallback(async () => {
    const username = currentUsername();
    if (!username) {
      setError("No admin session found.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const items: any = {
        api: API_TAGS.ORGS.list,
        username,
        language: "en",
      };
      if (!isSuper && scope.orgCode) {
        items.org_code = scope.orgCode;
      }
      const body = await buildBody(items);
      const { data } = await axios.post(
        `${API_BASE_URL}${API_ROUTES.admin.getOrganisations}`,
        body,
        { headers }
      );
      const resp = data?.response || {};
      const code = String(resp.responsecode ?? "");
      if (code !== "0") {
        setError(resp.description || "Failed to load organisations.");
        setToast({ open: true, message: resp.description || "Failed to load organisations.", severity: "error" });
        return;
      }
      const list: any[] = resp?.data?.organisations || [];
      let mapped: OrgRow[] = list.map((o) => ({
        id: o._id || o.org_code,
        org_code: o.org_code,
        org_name: o.org_name,
        country: o.country,
        status: o.is_active === "Y" ? "ACTIVE" : "INACTIVE",
        created_on: o.created_on,
        created_by: o.created_by,
        updated_on: o.updated_on,
        updated_by: o.updated_by,
      }));
      if (!isSuper && scope.orgCode) {
        mapped = mapped.filter((o) => o.org_code === scope.orgCode);
      }
      setRows(mapped);
      setToast({ open: true, message: "Organisations refreshed.", severity: "success" });
    } catch (e: any) {
      setError(e?.message || "Network error while loading organisations.");
      setToast({ open: true, message: e?.message || "Network error while loading organisations.", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [buildBody, headers]);

  React.useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const canEditOrg = React.useCallback(
    (row: OrgRow) => isSuper || (orgAdmin && scope.orgCode && row.org_code === scope.orgCode),
    [isSuper, orgAdmin, scope.orgCode],
  );

  const handleOpenCreate = () => {
    if (!isSuper) {
      setToast({ open: true, message: "You are not authorized to create organisations.", severity: "error" });
      return;
    }
    setIsEditMode(false);
    setEditingId(null);
    setForm({
      org_code: "",
      org_name: "",
      country: "IN",
      status: "ACTIVE",
      created_on: new Date().toISOString().slice(0, 10),
      created_by: "",
      updated_on: "",
      updated_by: "",
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (row: OrgRow) => {
    if (!canEditOrg(row)) {
      setToast({ open: true, message: "You are not authorized to edit this organisation.", severity: "error" });
      return;
    }
    setIsEditMode(true);
    setEditingId(row.id);
    setForm({
      org_code: row.org_code,
      org_name: row.org_name,
      country: row.country,
      status: row.status,
      created_on: row.created_on || "",
      updated_on: row.updated_on || "",
      created_by: row.created_by || "",
      updated_by: row.updated_by || "",
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => setDialogOpen(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    // Auto-generate org_code from org_name on create
    if (name === "org_name" && !isEditMode) {
      const generated = value
        .replace(/[^A-Za-z0-9]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "")
        .toUpperCase()
        .slice(0, 40);
      setForm((prev) => ({ ...prev, org_name: value, org_code: generated }));
      return;
    }
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    if (isReadOnly) {
      setDialogOpen(false);
      setToast({ open: true, message: "You are not authorized to modify organisations.", severity: "error" });
      return;
    }
    if (!form.org_code.trim() || !form.org_name.trim()) {
      alert("Org Code and Org Name are required.");
      return;
    }
    const username = currentUsername();
    if (!username) {
      alert("No admin session found.");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      if (isEditMode && editingId) {
        const isOrgAllowed = isSuper || (orgAdmin && scope.orgCode && form.org_code === scope.orgCode);
        if (!isOrgAllowed) {
          setToast({ open: true, message: "You are not authorized to edit this organisation.", severity: "error" });
          setLoading(false);
          return;
        }
        const payload: any = {
          api: API_TAGS.ORGS.update,
          username,
          language: "en",
          org_id: editingId,
          org_name: form.org_name,
        };
        payload.country = form.country;
        payload.is_active = form.status === "ACTIVE" ? "Y" : "N";
        if (!isSuper && scope.orgCode) {
          payload.org_code = scope.orgCode;
        }
        const body = await buildBody(payload);
        const { data } = await axios.post(
          `${API_BASE_URL}${API_ROUTES.admin.updateOrganisation}`,
          body,
          { headers }
        );
        const resp = data?.response || {};
        const code = String(resp.responsecode ?? "");
        if (code !== "0") {
          setError(resp.description || "Update failed.");
          setToast({ open: true, message: resp.description || "Update failed.", severity: "error" });
        } else {
          await loadOrgs();
          setToast({ open: true, message: "Organisation updated.", severity: "success" });
          setDialogOpen(false);
        }
      } else {
        if (!isSuper) {
          setToast({ open: true, message: "Only SUPER_ADMIN can create organisations.", severity: "error" });
          setLoading(false);
          return;
        }
        const payload = {
          api: API_TAGS.ORGS.create,
          username,
          language: "en",
          org_code: form.org_code.toUpperCase(),
          org_name: form.org_name,
          country: form.country,
          is_active: form.status === "ACTIVE" ? "Y" : "N",
        };
        const body = await buildBody(payload);
        const { data } = await axios.post(
          `${API_BASE_URL}${API_ROUTES.admin.createOrganisation}`,
          body,
          { headers }
        );
        const resp = data?.response || {};
        const code = String(resp.responsecode ?? "");
        if (code !== "0") {
          setError(resp.description || "Create failed.");
          setToast({ open: true, message: resp.description || "Create failed.", severity: "error" });
        } else {
          await loadOrgs();
          setToast({ open: true, message: "Organisation created.", severity: "success" });
          setDialogOpen(false);
        }
      }
    } catch (e: any) {
      setError(e?.message || "Network error.");
      setToast({ open: true, message: e?.message || "Network error.", severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const columns = React.useMemo<GridColDef<OrgRow>[]>(
    () => [
      { field: "org_code", headerName: "Org Code", flex: 0.6 },
      { field: "org_name", headerName: "Organisation Name", flex: 1.2 },
      { field: "country", headerName: "Country", flex: 0.5 },
      { field: "status", headerName: "Status", flex: 0.6 },
      { field: "created_on", headerName: "Created On", flex: 0.8 },
      {
        field: "actions",
        headerName: "Actions",
        sortable: false,
        filterable: false,
        flex: 0.7,
        renderCell: (params: GridRenderCellParams<OrgRow>) => (
          <Button
            size="small"
            variant="outlined"
            onClick={() => handleOpenEdit(params.row as OrgRow)}
            disabled={isReadOnly || !canEditOrg(params.row)}
          >
            Edit
          </Button>
        ),
      },
    ],
    [isReadOnly, canEditOrg]
  );

  const filteredRows = rows.filter((r) => {
    const q = search.trim().toLowerCase();
    const match =
      !q ||
      r.org_code.toLowerCase().includes(q) ||
      r.org_name.toLowerCase().includes(q);
    const statusOk =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" ? r.status === "ACTIVE" : r.status === "INACTIVE");
    return match && statusOk;
  });

  return (
    <PageContainer>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
      >
        <Typography variant="h5">Organisations</Typography>
        <Button
          variant="contained"
          size="small"
          onClick={handleOpenCreate}
          disabled={!isSuper}
          sx={{ alignSelf: { xs: "stretch", md: "flex-start" } }}
        >
          Add Organisation
        </Button>
      </Stack>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        alignItems={{ xs: "stretch", md: "center" }}
      >
        <TextField
          label="Search code/name"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          fullWidth
        />
        <TextField
          select
          size="small"
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          sx={{ width: { xs: "100%", md: 180 } }}
        >
          <MenuItem value="ALL">All</MenuItem>
          <MenuItem value="ACTIVE">Active</MenuItem>
          <MenuItem value="INACTIVE">Inactive</MenuItem>
        </TextField>
        <Button
          variant="outlined"
          size="small"
          onClick={loadOrgs}
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
                      {row.org_code}
                    </Typography>
                    <Typography variant="h6">{row.org_name}</Typography>
                    {row.country && (
                      <Typography variant="caption" color="text.secondary">
                        {row.country}
                      </Typography>
                    )}
                  </Box>
                  <Chip
                    label={row.status}
                    color={row.status === "ACTIVE" ? "success" : "default"}
                    size="small"
                  />
                </Stack>
                <Stack direction="row" spacing={2} mt={1}>
                  {row.created_on && (
                    <Typography variant="caption" color="text.secondary">
                      Created: {row.created_on}
                    </Typography>
                  )}
                  {row.updated_on && (
                    <Typography variant="caption" color="text.secondary">
                      Updated: {row.updated_on}
                    </Typography>
                  )}
                </Stack>
                {!isReadOnly && (
                  <Stack direction="row" justifyContent="flex-end" mt={1.5}>
                    <Button
                      variant="outlined"
                      size="small"
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
              No organisations found.
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
          minWidth={760}
        />
      )}

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="sm"
        fullScreen={isSmallScreen}
      >
        <DialogTitle>{isEditMode ? "Edit Organisation" : "Add Organisation"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Org Code"
              name="org_code"
              value={form.org_code}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
              disabled
              helperText="Auto-generated from Organisation Name"
            />
            <TextField
              label="Organisation Name"
              name="org_name"
              value={form.org_name}
              onChange={handleChange}
              fullWidth
              required
              InputLabelProps={{ shrink: true }}
              disabled={isReadOnly}
            />
            <TextField
              select
              label="Country"
              name="country"
              value={form.country}
              onChange={handleChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
              disabled={!isSuper}
              helperText={!isSuper ? "Only SUPER_ADMIN can change Country." : undefined}
            >
              <MenuItem value="IN">India (IN)</MenuItem>
            </TextField>
            <TextField
              select
              label="Status"
              name="status"
              value={form.status}
              onChange={handleChange}
              fullWidth
              InputLabelProps={{ shrink: true }}
              disabled={!isSuper}
              helperText={!isSuper ? "Only SUPER_ADMIN can change status." : undefined}
            >
              <MenuItem value="ACTIVE">Active</MenuItem>
              <MenuItem value="INACTIVE">Inactive</MenuItem>
            </TextField>
            <TextField
              label="Created On"
              name="created_on"
              value={form.created_on || ""}
              InputLabelProps={{ shrink: true }}
              fullWidth
              disabled
            />
            <TextField
              label="Updated On"
              name="updated_on"
              value={form.updated_on || ""}
              InputLabelProps={{ shrink: true }}
              fullWidth
              disabled
            />
            <TextField
              label="Created By"
              name="created_by"
              value={form.created_by || ""}
              InputLabelProps={{ shrink: true }}
              fullWidth
              disabled
            />
            <TextField
              label="Updated By"
              name="updated_by"
              value={form.updated_by || ""}
              InputLabelProps={{ shrink: true }}
              fullWidth
              disabled
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
