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
  Grid,
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
import { can } from "../../utils/adminUiConfig";
import { API_BASE_URL, API_TAGS, API_ROUTES } from "../../config/appConfig";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { getUserScope } from "../../utils/userScope";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { useCrudPermissions } from "../../utils/useCrudPermissions";



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
  created_on_display?: string;
  updated_on_display?: string;
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

function formatDateTime(value?: string | Date | null): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export const Orgs: React.FC = () => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const uiConfig = useAdminUiConfig();
  const orgPerms = useCrudPermissions("organisations");
  const scope = getUserScope("OrgsPage");
  const scopeOrgCode = uiConfig.scope?.org_code ?? scope.orgCode;
  const isSuperAdmin = (uiConfig.role || "").toUpperCase() === "SUPER_ADMIN";
  const canUpdateOrgAction = React.useMemo(
    () => isSuperAdmin || can(uiConfig.resources, "organisations.edit", "UPDATE"),
    [isSuperAdmin, uiConfig.resources],
  );
  const canCreateOrg = React.useMemo(
    () => isSuperAdmin || can(uiConfig.resources, "organisations.create", "CREATE"),
    [isSuperAdmin, uiConfig.resources],
  );
  const isReadOnly = React.useMemo(() => !canUpdateOrgAction, [canUpdateOrgAction]);
  const showCreateButton = canCreateOrg;
  // Temporary debug for perms; remove after verifying
  if ((uiConfig.role || "").toUpperCase() === "ORG_ADMIN") {
    const orgActions = (uiConfig.resources || []).filter((r) => (r.resource_key || "").startsWith("organisations."));
    console.log("ORG PAGE RBAC", { role: uiConfig.role, actions: orgActions });
  }

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
  type DialogMode = "CREATE" | "EDIT" | "VIEW";
  const [dialogMode, setDialogMode] = React.useState<DialogMode>("CREATE");
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
  const isViewMode = dialogMode === "VIEW";
  const isEditMode = dialogMode === "EDIT";
  const isViewOnlyMode = isViewMode || isReadOnly;
  
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
      if (scopeOrgCode) {
        items.org_code = scopeOrgCode;
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
        created_on_display: formatDateTime(o.created_on),
        updated_on_display: formatDateTime(o.updated_on),
      }));
      if (scopeOrgCode) {
        mapped = mapped.filter((o) => o.org_code === scopeOrgCode);
      }
      setRows(mapped);
      setToast({ open: true, message: "Organisations refreshed.", severity: "success" });
    } catch (e: any) {
      setError(e?.message || "Network error while loading organisations.");
      setToast({ open: true, message: e?.message || "Network error while loading organisations.", severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [buildBody, headers, scopeOrgCode]);

  React.useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const canEditOrg = React.useCallback(
    (row: OrgRow) => {
      if (!canUpdateOrgAction) return false;
      if (!scopeOrgCode) return true;
      return row.org_code === scopeOrgCode;
    },
    [canUpdateOrgAction, scopeOrgCode],
  );

  const handleOpenCreate = () => {
    setDialogMode("CREATE");
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
    setDialogMode("EDIT");
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

  const handleOpenView = (row: OrgRow) => {
    setDialogMode("VIEW");
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
    if (name === "org_name" && dialogMode === "CREATE") {
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
    if (isViewOnlyMode) {
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
        const isOrgAllowed = canEditOrg({ ...form, id: editingId } as OrgRow);
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
        payload.org_code = scopeOrgCode || form.org_code;
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
        const payload: any = {
          api: API_TAGS.ORGS.create,
          username,
          language: "en",
          org_name: form.org_name,
          org_code: scopeOrgCode || form.org_code,
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
      {
        field: "created_on_display",
        headerName: "Created On",
        flex: 0.9,
      },
      {
        field: "updated_on_display",
        headerName: "Updated On",
        flex: 0.9,
      },
      {
        field: "actions",
        headerName: "Actions",
        sortable: false,
        filterable: false,
        flex: 0.7,
        renderCell: (params: GridRenderCellParams<OrgRow>) => {
          const row = params.row as OrgRow;
          const editable = canUpdateOrgAction && canEditOrg(row);
          return (
            <Button
              size="small"
              variant="outlined"
              onClick={() => (editable ? handleOpenEdit(row) : handleOpenView(row))}
            >
              {editable ? "Edit" : "View"}
            </Button>
          );
        },
      },
    ],
    [canUpdateOrgAction, canEditOrg]
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
        sx={{ mb: 2 }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h5">Organisations</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage organisation master data and status quickly.
          </Typography>
        </Stack>
        {showCreateButton && (
          <Button
            variant="contained"
            size="medium"
            onClick={handleOpenCreate}
          >
            Add Organisation
          </Button>
        )}
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={6}>
              <TextField
                label="Search code/name"
                size="small"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                select
                size="small"
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                fullWidth
              >
                <MenuItem value="ALL">All</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="INACTIVE">Inactive</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <Button
                variant="outlined"
                size="medium"
                onClick={loadOrgs}
                disabled={loading}
                fullWidth
              >
                Refresh
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      {isSmallScreen ? (
        <Stack spacing={1.5} sx={{ maxWidth: 640, mx: "auto", width: "100%" }}>
          {filteredRows.map((row) => (
            <Card
              key={row.id}
              variant="outlined"
              sx={{ borderRadius: 2, px: 2, py: 1.5, boxShadow: 2, mb: 0.5 }}
            >
              <Stack spacing={1}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    mb: 1,
                  }}
                >
                  <Typography
                    variant="body1"
                    sx={{ fontWeight: 600, fontSize: { xs: "0.9rem", md: "1rem" }, lineHeight: 1.3 }}
                  >
                    {row.org_name}
                  </Typography>
                  <Chip
                    label={row.status === "ACTIVE" ? "Active" : "Inactive"}
                    size="small"
                    color={row.status === "ACTIVE" ? "success" : "default"}
                    sx={{ fontSize: { xs: "0.7rem", md: "0.75rem" }, height: 22 }}
                  />
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontSize: { xs: "0.75rem", md: "0.8rem" } }}
                  >
                    Organisation Code
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ fontSize: { xs: "0.85rem", md: "0.9rem" } }}
                  >
                    {row.org_code}
                  </Typography>
                </Box>

                <Box sx={{ mb: 1 }}>
                  <Typography
                    variant="caption"
                    sx={{ display: "block", color: "text.secondary", fontSize: { xs: "0.75rem", md: "0.8rem" } }}
                  >
                    Last Updated
                  </Typography>
                  <Typography
                    variant="caption"
                    sx={{ display: "block", fontSize: { xs: "0.75rem", md: "0.8rem" } }}
                  >
                    {formatDateTime(row.updated_on)}
                  </Typography>
                </Box>

                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "flex-end",
                    mt: 1,
                  }}
                >
                  <Button
                    variant="outlined"
                    size="small"
                    onClick={() =>
                      canUpdateOrgAction && canEditOrg(row) ? handleOpenEdit(row) : handleOpenView(row)
                    }
                    sx={{
                      textTransform: "none",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      borderRadius: 1,
                      px: 1.5,
                      py: 0.3,
                    }}
                  >
                    {canUpdateOrgAction && canEditOrg(row) ? "Edit" : "View"}
                  </Button>
                </Box>
              </Stack>
            </Card>
          ))}
          {!filteredRows.length && (
            <Typography variant="body2" color="text.secondary">
              No organisations found.
            </Typography>
          )}
        </Stack>
      ) : (
        <Card>
          <CardContent>
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <ResponsiveDataGrid
                rows={filteredRows}
                columns={columns}
                pageSizeOptions={[10, 25, 50]}
                disableRowSelectionOnClick
                loading={loading}
                minWidth={760}
              />
            </Box>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="md"
        fullScreen={isSmallScreen}
      >
        <DialogTitle>{dialogMode === "CREATE" ? "Add Organisation" : dialogMode === "EDIT" ? "Edit Organisation" : "View Organisation"}</DialogTitle>
        <DialogContent dividers>
          {isViewOnlyMode && (
            <Alert severity="info" sx={{ mb: 2 }}>
              View only – insufficient permission.
            </Alert>
          )}
          <Grid container spacing={2} mt={1}>
            <Grid item xs={12} sm={6}>
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
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Organisation Name"
                name="org_name"
                value={form.org_name}
                onChange={handleChange}
                fullWidth
                required
                InputLabelProps={{ shrink: true }}
                disabled={isViewOnlyMode}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Country"
                name="country"
                value={form.country}
                onChange={handleChange}
                fullWidth
                InputLabelProps={{ shrink: true }}
                disabled={isViewOnlyMode}
              >
                <MenuItem value="IN">India (IN)</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                select
                label="Status"
                name="status"
                value={form.status}
                onChange={handleChange}
                fullWidth
                InputLabelProps={{ shrink: true }}
                disabled={isViewOnlyMode}
              >
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="INACTIVE">Inactive</MenuItem>
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Created On"
                name="created_on"
                value={formatDateTime(form.created_on)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                disabled
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Updated On"
                name="updated_on"
                value={formatDateTime(form.updated_on)}
                InputLabelProps={{ shrink: true }}
                fullWidth
                disabled
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Created By"
                name="created_by"
                value={form.created_by || ""}
                InputLabelProps={{ shrink: true }}
                fullWidth
                disabled
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Updated By"
                name="updated_by"
                value={form.updated_by || ""}
                InputLabelProps={{ shrink: true }}
                fullWidth
                disabled
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
          {!isViewOnlyMode && (
            <Button onClick={handleSubmit} variant="contained" disabled={loading}>
              {loading ? <CircularProgress size={18} /> : "Save"}
            </Button>
          )}
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
