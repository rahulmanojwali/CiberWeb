import React from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import type { SelectChangeEvent } from "@mui/material/Select";
import {
  type GridColDef,
  type GridRenderCellParams,
} from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import LockResetIcon from "@mui/icons-material/LockReset";
import { encryptGenericPayload } from "../../utils/aesUtilBrowser";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { API_BASE_URL, API_TAGS, API_ROUTES } from "../../config/appConfig";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";

type RoleSlug = "SUPER_ADMIN" | "ORG_ADMIN" | "MANDI_ADMIN" | "AUDITOR" | "ADMIN";

type AdminUser = {
  username: string;
  full_name: string | null;
  email: string | null;
  mobile: string | null;
  org_id: string | null;
  org_code: string | null;
  org_name: string | null;
  roles: string[];
  is_active: string;
  last_login_on?: string | null;
  created_on?: string | null;
  updated_on?: string | null;
};

type RoleOption = {
  role_code: string;
  role_name?: string;
  scope?: string;
  role_scope?: string;
};

type OrgOption = { _id: string; org_code: string; org_name: string };

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

function buildHeaders() {
  const token = localStorage.getItem("cd_token");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function buildBody(items: any) {
  const encryptedData = await encryptGenericPayload(JSON.stringify({ items }));
  return { encryptedData };
}

const AdminUsersList: React.FC = () => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const role = getCurrentRole();
  const isSuper = role === "SUPER_ADMIN";
  const [rows, setRows] = React.useState<AdminUser[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
    open: false,
    message: "",
    severity: "info",
  });

  const [filters, setFilters] = React.useState({
    search: "",
    org_id: "",
    role_code: "",
    is_active: "ALL" as "ALL" | "Y" | "N",
  });

  const [orgOptions, setOrgOptions] = React.useState<OrgOption[]>([]);
  const [roleOptions, setRoleOptions] = React.useState<RoleOption[]>([]);
  const [roleSelectOpen, setRoleSelectOpen] = React.useState(false);

  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [editingUser, setEditingUser] = React.useState<AdminUser | null>(null);
  const [form, setForm] = React.useState({
    username: "",
    full_name: "",
    email: "",
    mobile: "",
    org_id: "",
    roles: [] as string[],
    is_active: true,
    password: "",
  });

  const [resetDialog, setResetDialog] = React.useState<{ open: boolean; username: string; temp?: string | null }>({
    open: false,
    username: "",
    temp: null,
  });

  const headers = React.useMemo(() => buildHeaders(), []);

  const loadRoles = React.useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    try {
      const body = await buildBody({ api: API_TAGS.ADMIN_USERS.listRoles, username, language });
      const { data } = await axios.post(`${API_BASE_URL}${API_ROUTES.admin.getAdminRoles}`, body, { headers });
      const resp = data?.response || {};
      if (String(resp.responsecode) !== "0") return;
      const dedup = new Map<string, RoleOption>();
      (resp?.data?.roles || []).forEach((r: any) => {
        const raw = String(r.role_code || "").trim().toUpperCase();
        const normalized = raw === "SUPER_ADMIN" ? "SUPERADMIN" : raw;
        if (!dedup.has(normalized)) {
          dedup.set(normalized, { role_code: normalized, role_name: r.role_name, scope: r.role_scope || r.scope });
        }
      });
      setRoleOptions(Array.from(dedup.values()));
    } catch {
      /* ignore */
    }
  }, [headers, language]);

  const loadOrgs = React.useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    try {
      const body = await buildBody({ api: API_TAGS.ADMIN_USERS.listOrgs, username, language });
      const { data } = await axios.post(`${API_BASE_URL}${API_ROUTES.admin.getOrganisations}`, body, { headers });
      const resp = data?.response || {};
      if (String(resp.responsecode) !== "0") return;
      const orgs: OrgOption[] = (resp?.data?.organisations || []).map((o: any) => ({
        _id: o._id,
        org_code: o.org_code,
        org_name: o.org_name,
      }));
      setOrgOptions(orgs);
    } catch {
      /* ignore */
    }
  }, [headers, language]);

  const loadUsers = React.useCallback(async () => {
    const username = currentUsername();
    if (!username) {
      const sessionMessage = t("adminUsers.messages.validation_missing_user");
      setError(sessionMessage);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload: any = {
        api: API_TAGS.ADMIN_USERS.list,
        username,
        language,
        search: filters.search,
      };
      if (filters.org_id) payload.org_id = filters.org_id;
      if (filters.role_code) payload.role_code = filters.role_code;
      if (filters.is_active === "Y" || filters.is_active === "N") payload.is_active = filters.is_active;
      const body = await buildBody(payload);
      const { data } = await axios.post(`${API_BASE_URL}${API_ROUTES.admin.getAdminUsers}`, body, { headers });
      const resp = data?.response || {};
      const code = String(resp.responsecode ?? "");
      if (code !== "0") {
        const msg = resp.description || t("adminUsers.messages.loadFailed");
        setError(msg);
        setToast({ open: true, message: msg, severity: "error" });
        return;
      }
      // Debug: inspect raw payload from API for is_active/org mapping
      if (typeof window !== "undefined") {
        // eslint-disable-next-line no-console
        console.log("[admin_users_load] users raw", resp?.data?.users);
      }
      const normalized = (resp?.data?.users || []).map((u: any) => ({
        ...u,
        is_active: String(u?.is_active || "Y").trim().toUpperCase(),
      }));
      setRows(normalized);
    } catch (e: any) {
      const msg = e?.message || t("adminUsers.messages.networkLoad");
      setError(msg);
      setToast({ open: true, message: msg, severity: "error" });
    } finally {
      setLoading(false);
    }
  }, [filters.is_active, filters.org_id, filters.role_code, filters.search, headers, language, t]);

  React.useEffect(() => {
    loadRoles();
    loadOrgs();
  }, [loadRoles, loadOrgs]);

  React.useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleOpenCreate = () => {
    if (!isSuper) return;
    setIsEditMode(false);
    setEditingUser(null);
    setForm({
      username: "",
      full_name: "",
      email: "",
      mobile: "",
      org_id: "",
      roles: [],
      is_active: true,
      password: "",
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (user: AdminUser) => {
    if (!isSuper) return;
    const orgId = (user as any).org_id || (user as any).orgId || "";
    setIsEditMode(true);
    setEditingUser(user);
    setForm({
      username: user.username,
      full_name: user.full_name || "",
      email: user.email || "",
      mobile: user.mobile || "",
      org_id: orgId,
      roles: user.roles || [],
      is_active: user.is_active === "Y",
      password: "",
    });
    setDialogOpen(true);
  };

  const handleCloseDialog = () => setDialogOpen(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRolesChange = (event: SelectChangeEvent<string[]>) => {
    const {
      target: { value },
    } = event;
    const roles = typeof value === "string" ? value.split(",") : (value as string[]);
    setForm((prev) => ({
      ...prev,
      roles,
      // if SUPERADMIN chosen, clear org
      org_id: roles.includes("SUPERADMIN") ? "" : prev.org_id,
    }));
    setRoleSelectOpen(false);
  };

  const handleSubmit = async () => {
    if (!isSuper) {
      setDialogOpen(false);
      return;
    }
    const username = currentUsername();
    if (!username) {
      setToast({ open: true, message: t("adminUsers.messages.noSession"), severity: "error" });
      return;
    }
    if (!form.username.trim() && !isEditMode) {
      setToast({ open: true, message: t("adminUsers.messages.usernameRequired"), severity: "error" });
      return;
    }
    const sanitizedUsername = form.username.trim().toLowerCase().replace(/\s+/g, "_");
    const usernamePattern = /^[a-z0-9._-]{3,64}$/;
    if (!usernamePattern.test(sanitizedUsername) && !isEditMode) {
      setToast({
        open: true,
        message: t("adminUsers.messages.usernameInvalid"),
        severity: "error",
      });
      return;
    }
    if (!form.full_name.trim()) {
      setToast({ open: true, message: t("adminUsers.messages.fullNameRequired"), severity: "error" });
      return;
    }
    if (!form.mobile.trim()) {
      setToast({ open: true, message: t("adminUsers.messages.mobileRequired"), severity: "error" });
      return;
    }
    const mobilePattern = /^\d{8,15}$/;
    if (!mobilePattern.test(form.mobile.trim())) {
      setToast({ open: true, message: t("adminUsers.messages.mobileInvalid"), severity: "error" });
      return;
    }
    if (!form.roles.length) {
      setToast({ open: true, message: t("adminUsers.messages.rolesRequired"), severity: "error" });
      return;
    }
    const selectedScopes = form.roles.map((code) => {
      const r = roleOptions.find((opt) => opt.role_code === code);
      return (r?.scope || r?.role_scope || "GLOBAL").toUpperCase();
    });
    const hasSuper = form.roles.includes("SUPERADMIN");
    const needsOrg = selectedScopes.some((s) => s === "ORG");
    if (hasSuper && form.org_id) {
      setToast({ open: true, message: t("adminUsers.messages.superOrgConflict"), severity: "error" });
      return;
    }
    if (needsOrg && !hasSuper && !form.org_id) {
      setToast({ open: true, message: t("adminUsers.messages.orgRequired"), severity: "error" });
      return;
    }
    try {
      setLoading(true);
      setError(null);
      if (isEditMode && editingUser) {
        const payload: any = {
          api: API_TAGS.ADMIN_USERS.update,
          username,
          language,
          target_username: editingUser.username,
          full_name: form.full_name,
          email: form.email,
          mobile: form.mobile,
          role_codes: form.roles,
          is_active: form.is_active ? "Y" : "N",
        };
        if (form.org_id) payload.org_id = form.org_id;
        const body = await buildBody(payload);
        const { data } = await axios.post(`${API_BASE_URL}${API_ROUTES.admin.updateAdminUser}`, body, { headers });
        const resp = data?.response || {};
        const code = String(resp.responsecode ?? "");
        if (code !== "0") {
          setToast({ open: true, message: resp.description || t("adminUsers.messages.updateFailed"), severity: "error" });
        } else {
          setToast({ open: true, message: t("adminUsers.messages.updateSuccess"), severity: "success" });
          await loadUsers();
          setDialogOpen(false);
        }
      } else {
        const payload: any = {
          api: API_TAGS.ADMIN_USERS.create,
          username,
          language,
          new_username: sanitizedUsername,
          full_name: form.full_name,
          email: form.email,
          mobile: form.mobile,
          role_codes: form.roles,
          password: form.password,
        };
        if (form.org_id) payload.org_id = form.org_id;
        const body = await buildBody(payload);
        const { data } = await axios.post(`${API_BASE_URL}${API_ROUTES.admin.createAdminUser}`, body, { headers });
        const resp = data?.response || {};
        const code = String(resp.responsecode ?? "");
        if (code !== "0") {
          setToast({ open: true, message: resp.description || t("adminUsers.messages.createFailed"), severity: "error" });
        } else {
          setToast({ open: true, message: t("adminUsers.messages.createSuccess"), severity: "success" });
          await loadUsers();
          setDialogOpen(false);
        }
      }
    } catch (e: any) {
      setToast({ open: true, message: e?.message || t("adminUsers.messages.networkError"), severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!isSuper || !resetDialog.username) {
      setResetDialog({ open: false, username: "", temp: null });
      return;
    }
    const username = currentUsername();
    if (!username) return;
    try {
      setLoading(true);
      const payload = {
        api: API_TAGS.ADMIN_USERS.reset,
        username,
        language,
        target_username: resetDialog.username,
      };
      const body = await buildBody(payload);
      const { data } = await axios.post(`${API_BASE_URL}${API_ROUTES.admin.resetAdminUserPassword}`, body, { headers });
      const resp = data?.response || {};
      const code = String(resp.responsecode ?? "");
      if (code !== "0") {
        setToast({ open: true, message: resp.description || t("adminUsers.messages.resetFailed"), severity: "error" });
      } else {
        setResetDialog((prev) => ({ ...prev, temp: resp?.data?.temp_password || "" }));
        setToast({ open: true, message: t("adminUsers.messages.resetSuccess"), severity: "success" });
      }
    } catch (e: any) {
      setToast({ open: true, message: e?.message || t("adminUsers.messages.networkError"), severity: "error" });
    } finally {
      setLoading(false);
    }
  };

  const columns = React.useMemo<GridColDef<AdminUser>[]>(
    () => [
      { field: "username", headerName: t("adminUsers.columns.username"), flex: 0.8 },
      { field: "full_name", headerName: t("adminUsers.columns.fullName"), flex: 1 },
      { field: "email", headerName: t("adminUsers.columns.email"), flex: 1 },
      { field: "mobile", headerName: t("adminUsers.columns.mobile"), flex: 0.8 },
      { field: "org_code", headerName: t("adminUsers.columns.orgCode"), flex: 0.7 },
      { field: "org_name", headerName: t("adminUsers.columns.orgName"), flex: 1 },
      {
        field: "roles",
        headerName: t("adminUsers.columns.roles"),
        flex: 1.2,
        renderCell: (params: GridRenderCellParams<AdminUser>) => (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: "wrap" }}>
            {(params.row.roles || []).map((r) => (
              <Chip key={r} size="small" label={r} />
            ))}
          </Stack>
        ),
      },
      {
        field: "is_active",
        headerName: t("adminUsers.columns.status"),
        flex: 0.6,
        valueGetter: ((params: any) => {
          const raw = params?.row?.is_active;
          const val = typeof raw === "string" ? raw.trim().toUpperCase() : raw === true ? "Y" : "N";
          return val === "Y" ? t("common.active") : t("common.inactive");
        }) as any,
      },
      { field: "last_login_on", headerName: t("adminUsers.columns.lastLogin"), flex: 0.9 },
      { field: "updated_on", headerName: t("adminUsers.columns.updatedOn"), flex: 0.9 },
      {
        field: "actions",
        headerName: t("adminUsers.columns.actions"),
        flex: 0.8,
        sortable: false,
        filterable: false,
        renderCell: (params: GridRenderCellParams<AdminUser>) =>
          !isSuper ? null : (
            <Stack direction="row" spacing={1}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleOpenEdit(params.row)}
              >
                {t("adminUsers.actions.edit")}
              </Button>
              <IconButton
                size="small"
                onClick={() => setResetDialog({ open: true, username: params.row.username, temp: null })}
                title={t("adminUsers.actions.reset")}
              >
                <LockResetIcon fontSize="small" />
              </IconButton>
            </Stack>
          ),
      },
    ],
    [isSuper, t]
  );

  const filteredRows = rows.filter((u) => {
    if (filters.is_active === "Y" && u.is_active !== "Y") return false;
    if (filters.is_active === "N" && u.is_active !== "N") return false;
    if (filters.org_id && u.org_id !== filters.org_id) return false;
    if (filters.role_code) {
      const match = (u.roles || []).some((r) => r === filters.role_code);
      if (!match) return false;
    }
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      const hit =
        u.username.toLowerCase().includes(q) ||
        (u.email || "").toLowerCase().includes(q) ||
        (u.mobile || "").toLowerCase().includes(q);
      if (!hit) return false;
    }
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
        <Typography variant="h5">{t("adminUsers.title")}</Typography>
        <Stack direction="row" spacing={1}>
          <IconButton size="small" onClick={loadUsers} title={t("common.refresh")}>
            <RefreshIcon />
          </IconButton>
          <Button variant="contained" size="small" onClick={handleOpenCreate} disabled={!isSuper}>
            {t("adminUsers.actions.new")}
          </Button>
        </Stack>
      </Stack>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        flexWrap="wrap"
      >
        <TextField
          size="small"
          label={t("adminUsers.filters.search")}
          value={filters.search}
          onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
          sx={{ minWidth: { xs: "100%", md: 240 } }}
        />
        <TextField
          select
          size="small"
          label={t("adminUsers.filters.organisation")}
          value={filters.org_id}
          onChange={(e) => setFilters((f) => ({ ...f, org_id: e.target.value }))}
          sx={{ minWidth: { xs: "100%", md: 200 } }}
        >
          <MenuItem value="">{t("adminUsers.filters.all")}</MenuItem>
          {orgOptions.map((o) => (
            <MenuItem key={o._id} value={o._id}>
              {o.org_code} — {o.org_name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t("adminUsers.filters.role")}
          value={filters.role_code}
          onChange={(e) => setFilters((f) => ({ ...f, role_code: e.target.value }))}
          sx={{ minWidth: { xs: "100%", md: 180 } }}
        >
          <MenuItem value="">{t("adminUsers.filters.all")}</MenuItem>
          {roleOptions.map((r) => (
            <MenuItem key={r.role_code} value={r.role_code}>
              {r.role_code}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          size="small"
          label={t("adminUsers.filters.status")}
          value={filters.is_active}
          onChange={(e) => setFilters((f) => ({ ...f, is_active: e.target.value as any }))}
          sx={{ minWidth: { xs: "100%", md: 140 } }}
        >
          <MenuItem value="ALL">{t("adminUsers.filters.all")}</MenuItem>
          <MenuItem value="Y">{t("adminUsers.filters.active")}</MenuItem>
          <MenuItem value="N">{t("adminUsers.filters.inactive")}</MenuItem>
        </TextField>
      </Stack>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <ResponsiveDataGrid
        rows={filteredRows.map((u) => ({ id: u.username, ...u }))}
        columns={columns}
        pageSizeOptions={[10, 25, 50]}
        disableRowSelectionOnClick
        loading={loading}
        minWidth={900}
      />

      <Dialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="sm"
        fullScreen={isSmallScreen}
      >
        <DialogTitle>{isEditMode ? t("adminUsers.dialog.editTitle") : t("adminUsers.dialog.createTitle")}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} mt={1}>
            <TextField
              label={t("adminUsers.dialog.username")}
              name="username"
              value={form.username}
              onChange={handleChange}
              fullWidth
              required
              disabled={isEditMode}
            />
            <TextField
              label={t("adminUsers.dialog.fullName")}
              name="full_name"
              value={form.full_name}
              onChange={handleChange}
              fullWidth
              required
            />
            <TextField
              label={t("adminUsers.dialog.email")}
              name="email"
              value={form.email}
              onChange={handleChange}
              fullWidth
            />
            <TextField
              label={t("adminUsers.dialog.mobile")}
              name="mobile"
              value={form.mobile}
              onChange={handleChange}
              fullWidth
            />
            <TextField
              select
              label={t("adminUsers.dialog.organisation")}
              name="org_id"
              value={form.org_id}
              onChange={handleChange}
              fullWidth
              helperText={t("adminUsers.dialog.orgHelper")}
              disabled={form.roles.includes("SUPERADMIN")}
            >
              <MenuItem value="">{t("common.none")}</MenuItem>
              {orgOptions.map((o) => (
                <MenuItem key={o._id} value={o._id}>
                  {o.org_code} — {o.org_name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={t("adminUsers.dialog.roles")}
              value={form.roles}
              onChange={(event) =>
                handleRolesChange(event as SelectChangeEvent<string[]>)
              }
              SelectProps={{
                multiple: true,
                renderValue: (selected) => (selected as string[]).join(", "),
                open: roleSelectOpen,
                onOpen: () => setRoleSelectOpen(true),
                onClose: () => setRoleSelectOpen(false),
              }}
              fullWidth
              helperText={t("adminUsers.dialog.rolesHelper")}
            >
              {roleOptions.map((r) => (
                <MenuItem key={r.role_code} value={r.role_code}>
                  <Checkbox checked={form.roles.indexOf(r.role_code) > -1} />
                  <ListItemText primary={r.role_code} />
                </MenuItem>
              ))}
            </TextField>

            {!isEditMode && (
              <TextField
                label={t("adminUsers.dialog.password")}
                name="password"
                type="password"
                value={form.password}
                onChange={handleChange}
                fullWidth
                required
              />
            )}

            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography>{t("adminUsers.dialog.status")}</Typography>
              <Switch
                checked={form.is_active}
                onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
              />
              <Typography>{form.is_active ? t("adminUsers.dialog.active") : t("adminUsers.dialog.inactive")}</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t("adminUsers.dialog.cancel")}</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={loading}>
            {loading ? <CircularProgress size={18} /> : t("adminUsers.dialog.save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={resetDialog.open}
        onClose={() => setResetDialog({ open: false, username: "", temp: null })}
        fullScreen={isSmallScreen}
      >
        <DialogTitle>{t("adminUsers.resetDialog.title")}</DialogTitle>
        <DialogContent dividers>
          {resetDialog.temp ? (
            <Typography>
              {t("adminUsers.resetDialog.temp", {
                username: resetDialog.username,
                password: resetDialog.temp,
              })}
            </Typography>
          ) : (
            <Typography>
              {t("adminUsers.resetDialog.prompt", { username: resetDialog.username })}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialog({ open: false, username: "", temp: null })}>{t("adminUsers.resetDialog.close")}</Button>
          {!resetDialog.temp ? (
            <Button onClick={handleResetPassword} variant="contained" disabled={loading}>
              {loading ? <CircularProgress size={18} /> : t("adminUsers.actions.generate")}
            </Button>
          ) : null}
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

export default AdminUsersList;
