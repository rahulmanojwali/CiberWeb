import React, { useCallback, useEffect, useMemo, useState } from "react";
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
  IconButton,
  InputAdornment,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LockResetOutlinedIcon from "@mui/icons-material/LockResetOutlined";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useTranslation } from "react-i18next";
import {
  createPlatformUser,
  fetchPlatformRoles,
  fetchPlatformUsers,
  resetPlatformUserPassword,
  updatePlatformUser,
  updatePlatformUserStatus,
} from "../../services/platformUsersApi";

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

const ROLE_LABELS: Record<string, string> = {
  PLATFORM_REVIEWER: "Platform Reviewer",
  PLATFORM_APPROVER: "Platform Approver",
  PLATFORM_SUPERVISOR: "Platform Supervisor",
  DIRECT_TRADE_REVIEWER: "Direct Trade Reviewer",
  DIRECT_TRADE_APPROVER: "Direct Trade Approver",
  PLATFORM_OPERATIONS_MANAGER: "Platform Operations Manager",
};

function formatRoleLabel(role?: string | null) {
  const normalized = String(role || "").trim().toUpperCase();
  if (!normalized) return "";
  return ROLE_LABELS[normalized] || normalized
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

type PlatformRole = {
  role_code: string;
  role_slug?: string;
  label?: string;
  description?: string | null;
};

type PlatformUser = {
  username: string;
  display_name: string | null;
  email: string | null;
  mobile: string | null;
  role_code: string;
  role_slug?: string;
  role_scope?: string;
  is_active: "Y" | "N";
  role_is_active?: "Y" | "N";
  last_login_on?: string | null;
  created_on?: string | null;
  updated_on?: string | null;
};

type ToastState = { open: boolean; message: string; severity: "success" | "error" | "info" };

type FormState = {
  username: string;
  password: string;
  display_name: string;
  email: string;
  mobile: string;
  role_code: string;
  is_active: boolean;
};

const USERNAME_PATTERN = /^[a-z0-9._-]{3,64}$/;
const PASSWORD_MIN_LENGTH = 8;

const PlatformUsers: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);

  const [rows, setRows] = useState<PlatformUser[]>([]);
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({ open: false, message: "", severity: "info" });

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [roleFilter, setRoleFilter] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [selectedUser, setSelectedUser] = useState<PlatformUser | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetPasswordTarget, setResetPasswordTarget] = useState<PlatformUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [form, setForm] = useState<FormState>({
    username: "",
    password: "",
    display_name: "",
    email: "",
    mobile: "",
    role_code: "",
    is_active: true,
  });

  const roleMap = useMemo(() => {
    const map: Record<string, PlatformRole> = {};
    roles.forEach((role) => {
      map[String(role.role_code || role.role_slug || "").toUpperCase()] = role;
    });
    return map;
  }, [roles]);

  const handleToast = (message: string, severity: ToastState["severity"]) => {
    setToast({ open: true, message, severity });
  };

  const loadRoles = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    try {
      const res = await fetchPlatformRoles({ username, language });
      const resp = res?.response || {};
      if (String(resp.responsecode ?? "") !== "0") {
        handleToast(resp.description || "Unable to load platform roles.", "error");
        return;
      }
      const list: PlatformRole[] = Array.isArray(res?.data?.roles) ? res.data.roles : [];
      setRoles(list);
      if (!list.length) {
        setError("No PLATFORM roles are configured. Please run the platform role seed script once.");
      }
      setForm((prev) => ({
        ...prev,
        role_code: prev.role_code || list[0]?.role_code || list[0]?.role_slug || "",
      }));
    } catch (err: any) {
      handleToast(err?.message || "Unable to load platform roles.", "error");
    }
  }, [language]);

  const loadUsers = useCallback(async () => {
    const username = currentUsername();
    if (!username) {
      setError("Session expired. Please login again.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const filters: Record<string, any> = { page, page_size: pageSize };
      if (search.trim()) filters.search = search.trim();
      if (status !== "ALL") filters.status = status;
      if (roleFilter) filters.role_code = roleFilter;

      const res = await fetchPlatformUsers({ username, language, filters });
      const resp = res?.response || {};
      if (String(resp.responsecode ?? "") !== "0") {
        const msg = resp.description || "Unable to load platform users.";
        setError(msg);
        handleToast(msg, "error");
        return;
      }
      const data = res?.data || {};
      setRows(Array.isArray(data.users) ? data.users : []);
      setTotal(Number(data.total || 0));
    } catch (err: any) {
      const msg = err?.message || "Network error while loading platform users.";
      setError(msg);
      handleToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [language, page, pageSize, roleFilter, search, status]);

  useEffect(() => {
    loadRoles();
  }, [loadRoles]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const resetForm = () => {
    setForm({
      username: "",
      password: "",
      display_name: "",
      email: "",
      mobile: "",
      role_code: roles[0]?.role_code || roles[0]?.role_slug || "",
      is_active: true,
    });
    setShowPassword(false);
  };

  const openCreateDialog = () => {
    if (!roles.length) {
      handleToast("No platform roles are available. Please run the platform role seed script once.", "error");
      return;
    }
    setDialogMode("create");
    setSelectedUser(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (user: PlatformUser) => {
    if (!roles.length) {
      handleToast("No platform roles are available. Please run the platform role seed script once.", "error");
      return;
    }
    setDialogMode("edit");
    setSelectedUser(user);
    setForm({
      username: user.username || "",
      password: "",
      display_name: user.display_name || "",
      email: user.email || "",
      mobile: user.mobile || "",
      role_code: user.role_code || user.role_slug || roles[0]?.role_code || roles[0]?.role_slug || "",
      is_active: user.is_active === "Y",
    });
    setShowPassword(false);
    setDialogOpen(true);
  };

  const openResetPasswordDialog = (user: PlatformUser) => {
    setResetPasswordTarget(user);
    setNewPassword("");
    setConfirmPassword("");
    setShowResetPassword(false);
    setResetDialogOpen(true);
  };

  const handleFormChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    const actor = currentUsername();
    if (!actor) {
      handleToast("Session expired. Please login again.", "error");
      return;
    }

    if (!form.role_code) {
      handleToast("Please select a platform role.", "error");
      return;
    }

    if (dialogMode === "create") {
      const newUsername = form.username.trim().toLowerCase();
      if (!USERNAME_PATTERN.test(newUsername)) {
        handleToast("Username must be 3-64 chars, lowercase letters/numbers/._- only.", "error");
        return;
      }
      if (form.password.trim().length < PASSWORD_MIN_LENGTH) {
        handleToast(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`, "error");
        return;
      }

      setLoading(true);
      try {
        const res = await createPlatformUser({
          username: actor,
          language,
          payload: {
            new_username: newUsername,
            password: form.password.trim(),
            display_name: form.display_name.trim() || null,
            email: form.email.trim().toLowerCase() || null,
            mobile: form.mobile.trim() || null,
            role_code: form.role_code,
            is_active: form.is_active ? "Y" : "N",
          },
        });
        const resp = res?.response || {};
        if (String(resp.responsecode ?? "") !== "0") {
          handleToast(resp.description || "Unable to create platform user.", "error");
          return;
        }
        handleToast("CiberMandi platform user created successfully.", "success");
        setDialogOpen(false);
        await loadUsers();
      } catch (err: any) {
        handleToast(err?.message || "Network error while creating platform user.", "error");
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!selectedUser?.username) {
      handleToast("No platform user selected for edit.", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await updatePlatformUser({
        username: actor,
        language,
        payload: {
          target_username: selectedUser.username,
          display_name: form.display_name.trim() || null,
          email: form.email.trim().toLowerCase() || null,
          mobile: form.mobile.trim() || null,
          role_code: form.role_code,
          is_active: form.is_active ? "Y" : "N",
        },
      });
      const resp = res?.response || {};
      if (String(resp.responsecode ?? "") !== "0") {
        handleToast(resp.description || "Unable to update platform user.", "error");
        return;
      }
      handleToast("Platform user updated successfully.", "success");
      setDialogOpen(false);
      setSelectedUser(null);
      await loadUsers();
    } catch (err: any) {
      handleToast(err?.message || "Network error while updating platform user.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    const actor = currentUsername();
    if (!actor) {
      handleToast("Session expired. Please login again.", "error");
      return;
    }
    if (!resetPasswordTarget?.username) {
      handleToast("No platform user selected for password reset.", "error");
      return;
    }
    if (newPassword.trim().length < PASSWORD_MIN_LENGTH) {
      handleToast(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`, "error");
      return;
    }
    if (newPassword.trim() !== confirmPassword.trim()) {
      handleToast("New password and confirm password do not match.", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await resetPlatformUserPassword({
        username: actor,
        language,
        target_username: resetPasswordTarget.username,
        password: newPassword.trim(),
      });
      const resp = res?.response || {};
      if (String(resp.responsecode ?? "") !== "0") {
        handleToast(resp.description || "Unable to reset password.", "error");
        return;
      }
      handleToast("Password reset successfully.", "success");
      setResetDialogOpen(false);
      setResetPasswordTarget(null);
      setNewPassword("");
      setConfirmPassword("");
      await loadUsers();
    } catch (err: any) {
      handleToast(err?.message || "Network error while resetting password.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (user: PlatformUser) => {
    const actor = currentUsername();
    if (!actor) return;
    const nextStatus: "Y" | "N" = user.is_active === "Y" ? "N" : "Y";
    setLoading(true);
    try {
      const res = await updatePlatformUserStatus({
        username: actor,
        language,
        target_username: user.username,
        is_active: nextStatus,
      });
      const resp = res?.response || {};
      if (String(resp.responsecode ?? "") !== "0") {
        handleToast(resp.description || "Unable to update user status.", "error");
        return;
      }
      handleToast("Platform user status updated.", "success");
      await loadUsers();
    } catch (err: any) {
      handleToast(err?.message || "Network error while updating status.", "error");
    } finally {
      setLoading(false);
    }
  };

  const columns: GridColDef<PlatformUser>[] = useMemo(
    () => [
      {
        field: "username",
        headerName: "Username",
        flex: 0.9,
        minWidth: 170,
        renderHeader: () => <Typography variant="subtitle2" fontWeight={700}>Username</Typography>,
        renderCell: (params: any) => <Typography variant="body2" fontWeight={600}>{params?.row?.username || "—"}</Typography>,
      },
      { field: "display_name", headerName: "Full Name", flex: 1, minWidth: 180 },
      {
        field: "role_code",
        headerName: "Platform Role",
        flex: 1,
        minWidth: 220,
        renderCell: (params: any) => {
          const raw = String(params?.row?.role_code || params?.row?.role_slug || "").toUpperCase();
          const role = roleMap[raw];
          return <Chip size="small" label={role?.label || formatRoleLabel(raw)} />;
        },
      },
      { field: "email", headerName: "Email", flex: 1, minWidth: 180 },
      { field: "mobile", headerName: "Mobile", flex: 0.8, minWidth: 140 },
      {
        field: "scope",
        headerName: "Scope",
        minWidth: 130,
        renderCell: () => <Chip size="small" color="primary" variant="outlined" label="PLATFORM" />,
      },
      {
        field: "is_active",
        headerName: "Status",
        minWidth: 130,
        renderCell: (params: any) => (
          <Chip
            size="small"
            color={params?.row?.is_active === "Y" ? "success" : "default"}
            label={params?.row?.is_active === "Y" ? "Active" : "Inactive"}
          />
        ),
      },
      {
        field: "actions",
        headerName: "Actions",
        minWidth: 210,
        sortable: false,
        renderCell: (params: any) => {
          const row = params.row as PlatformUser;
          return (
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Tooltip title="Edit user">
                <IconButton size="small" onClick={() => openEditDialog(row)} disabled={loading}>
                  <EditOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Reset password">
                <IconButton size="small" onClick={() => openResetPasswordDialog(row)} disabled={loading}>
                  <LockResetOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title={row.is_active === "Y" ? "Deactivate" : "Activate"}>
                <Switch
                  size="small"
                  checked={row.is_active === "Y"}
                  onChange={() => handleToggleStatus(row)}
                  disabled={loading}
                />
              </Tooltip>
            </Stack>
          );
        },
      },
    ],
    [handleToggleStatus, loading, roleMap, roles],
  );

  return (
    <PageContainer
      title="CiberMandi Users"
      subtitle="Create and manage internal CiberMandi platform users for approval and operations workflows."
      actions={
        <Stack direction="row" spacing={1}>
          <Button startIcon={<RefreshIcon />} onClick={loadUsers} disabled={loading}>
            Refresh
          </Button>
          <Button variant="contained" startIcon={<PersonAddAltOutlinedIcon />} onClick={openCreateDialog}>
            Create Platform User
          </Button>
        </Stack>
      }
    >
      <Stack spacing={2}>
        <Alert severity="info">
          These users are stored in the existing admin user store, but with GLOBAL / PLATFORM scope. They are not linked to any organisation or mandi.
        </Alert>

        <Card>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  size="small"
                  label="Search"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Role"
                  value={roleFilter}
                  onChange={(e) => {
                    setRoleFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <MenuItem value="">All Roles</MenuItem>
                  {roles.length === 0 && <MenuItem value="" disabled>No platform roles configured</MenuItem>}
                  {roles.map((role) => {
                    const code = role.role_code || role.role_slug || "";
                    return (
                      <MenuItem key={code} value={code}>
                        {role.label || formatRoleLabel(code)}
                      </MenuItem>
                    );
                  })}
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Status"
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as any);
                    setPage(1);
                  }}
                >
                  <MenuItem value="ALL">All</MenuItem>
                  <MenuItem value="ACTIVE">Active</MenuItem>
                  <MenuItem value="INACTIVE">Inactive</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={2}>
                <Button fullWidth variant="outlined" onClick={loadUsers} disabled={loading}>
                  Apply
                </Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {error && <Alert severity="error">{error}</Alert>}

        <Box sx={{ width: "100%" }}>
          {loading && rows.length === 0 ? (
            <Stack alignItems="center" py={6}>
              <CircularProgress />
            </Stack>
          ) : (
            <ResponsiveDataGrid
              rows={rows.map((row) => ({ ...row, id: row.username }))}
              columns={columns}
              autoHeight
              disableRowSelectionOnClick
              paginationMode="server"
              rowCount={total}
              paginationModel={{ page: page - 1, pageSize }}
              onPaginationModelChange={(model: any) => {
                setPage(Number(model.page || 0) + 1);
                setPageSize(Number(model.pageSize || pageSize));
              }}
              pageSizeOptions={[10, 20, 50, 100]}
            />
          )}
        </Box>
      </Stack>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{dialogMode === "create" ? "Create CiberMandi Platform User" : "Edit CiberMandi Platform User"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning">
              This user will be created as a CiberMandi internal platform user. Organisation and mandi will remain empty.
            </Alert>
            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="Username"
                  name="username"
                  value={form.username}
                  onChange={handleFormChange}
                  helperText={dialogMode === "create" ? "Lowercase letters, numbers, dot, underscore or hyphen." : "Username cannot be changed after creation."}
                  disabled={dialogMode === "edit"}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              {dialogMode === "create" && (
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    required
                    label="Password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={handleFormChange}
                    InputProps={{
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowPassword((prev) => !prev)} edge="end">
                            {showPassword ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>
              )}
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  required
                  label="Full Name"
                  name="display_name"
                  value={form.display_name}
                  onChange={handleFormChange}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  select
                  fullWidth
                  required
                  label="Platform Role"
                  name="role_code"
                  value={form.role_code}
                  onChange={handleFormChange}
                >
                  {roles.map((role) => {
                    const code = role.role_code || role.role_slug || "";
                    return (
                      <MenuItem key={code} value={code}>
                        {role.label || formatRoleLabel(code)}
                      </MenuItem>
                    );
                  })}
                </TextField>
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Email" name="email" value={form.email} onChange={handleFormChange} />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField fullWidth label="Mobile" name="mobile" value={form.mobile} onChange={handleFormChange} />
              </Grid>
              <Grid item xs={12}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography>Status</Typography>
                  <Switch
                    checked={form.is_active}
                    onChange={(event) => setForm((prev) => ({ ...prev, is_active: event.target.checked }))}
                  />
                  <Typography>{form.is_active ? "Active" : "Inactive"}</Typography>
                </Stack>
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={loading}>
            {dialogMode === "create" ? "Save" : "Update"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={resetDialogOpen} onClose={() => setResetDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Reset Platform User Password</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Alert severity="warning">
              Password will be reset for {resetPasswordTarget?.display_name || resetPasswordTarget?.username}. Share it securely and ask the user to change it after login.
            </Alert>
            <TextField
              fullWidth
              label="Username"
              value={resetPasswordTarget?.username || ""}
              disabled
            />
            <TextField
              fullWidth
              required
              label="New Password"
              type={showResetPassword ? "text" : "password"}
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowResetPassword((prev) => !prev)} edge="end">
                      {showResetPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              required
              label="Confirm Password"
              type={showResetPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setResetDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" color="warning" onClick={handleResetPassword} disabled={loading}>
            Reset Password
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={toast.severity} onClose={() => setToast((prev) => ({ ...prev, open: false }))}>
          {toast.message}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
};

export default PlatformUsers;
