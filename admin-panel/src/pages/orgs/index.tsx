// src/pages/orgs/index.tsx

import React from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  DataGrid,
  type GridColDef,
  type GridRenderCellParams,
} from "@mui/x-data-grid";
import Snackbar from "@mui/material/Snackbar";
import axios from "axios";
import { encryptGenericPayload } from "../../utils/aesUtilBrowser";
import type { RoleSlug } from "../../config/menuConfig";
import { API_BASE_URL, API_TAGS, API_ROUTES } from "../../config/appConfig";

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

function getCurrentRole(): RoleSlug | null {
  try {
    const raw = localStorage.getItem("cd_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const role =
      parsed?.roles_enabled?.primary ||
      parsed?.usertype ||
      parsed?.role;
    let normalized = typeof role === "string" ? role.toUpperCase() : null;
    // Temporary fallback: treat generic ADMIN as SUPER_ADMIN until backend returns role details
    if (normalized === "ADMIN") normalized = "SUPER_ADMIN";
    if (
      normalized === "SUPER_ADMIN" ||
      normalized === "ORG_ADMIN" ||
      normalized === "MANDI_ADMIN" ||
      normalized === "AUDITOR"
    ) {
      return normalized as RoleSlug;
    }
    return null;
  } catch {
    return null;
  }
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

export const Orgs: React.FC = () => {
  const role = getCurrentRole();
  const isSuper = role === "SUPER_ADMIN";
  const isOrgAdmin = role === "ORG_ADMIN";
  const isAuditor = role === "AUDITOR";
  const isReadOnly = isAuditor || role === "MANDI_ADMIN";

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
      const body = await buildBody({
        api: API_TAGS.ORGS.list,
        username,
        language: "en",
      });
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
      const mapped: OrgRow[] = list.map((o) => ({
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

  const handleOpenCreate = () => {
    if (!isSuper) return;
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
    if (isReadOnly) return;
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
        const payload: any = {
          api: API_TAGS.ORGS.update,
          username,
          language: "en",
          org_id: editingId,
          org_name: form.org_name,
        };
        if (isSuper) {
          payload.country = form.country;
          payload.is_active = form.status === "ACTIVE" ? "Y" : "N";
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
          alert("Only SUPER_ADMIN can create organisations.");
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
            disabled={isReadOnly}
          >
            Edit
          </Button>
        ),
      },
    ],
    [isReadOnly]
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
    <Box p={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Organisations</Typography>
        <Button variant="contained" size="small" onClick={handleOpenCreate} disabled={!isSuper}>
          Add Organisation
        </Button>
      </Stack>

      <Stack direction="row" spacing={2} mb={2}>
        <TextField
          label="Search code/name"
          size="small"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <TextField
          select
          size="small"
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          sx={{ width: 180 }}
        >
          <MenuItem value="ALL">All</MenuItem>
          <MenuItem value="ACTIVE">Active</MenuItem>
          <MenuItem value="INACTIVE">Inactive</MenuItem>
        </TextField>
        <Button variant="outlined" size="small" onClick={loadOrgs} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Box height={500}>
        <DataGrid
          rows={filteredRows}
          columns={columns}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          loading={loading}
        />
      </Box>

      <Dialog open={dialogOpen} onClose={handleCloseDialog} fullWidth maxWidth="sm">
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
    </Box>
  );
};
