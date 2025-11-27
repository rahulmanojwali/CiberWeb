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
  Divider,
  MenuItem,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import ListItemText from "@mui/material/ListItemText";
import Checkbox from "@mui/material/Checkbox";
import type { SelectChangeEvent } from "@mui/material/Select";
import {
  type GridColDef,
} from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import LockResetIcon from "@mui/icons-material/LockReset";
import { useTranslation } from "react-i18next";

import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { getUserScope, isReadOnlyRole, isSuperAdmin, isOrgAdmin } from "../../utils/userScope";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import {
  createAdminUser,
  updateAdminUser,
  deactivateAdminUser,
  resetAdminUserPassword,
  fetchAdminUsers,
  fetchAdminRoles,
  fetchOrganisations,
  fetchOrgMandis,
} from "../../services/adminUsersApi";
import type { RoleSlug } from "../../config/menuConfig";

const normalizeRoleSlug = (value?: string | null): RoleSlug | null => {
  if (!value) return null;
  const upper = value.replace(/[\s-]/g, "_").toUpperCase();
  const map: Record<string, RoleSlug> = {
    SUPERADMIN: "SUPER_ADMIN",
    SUPER_ADMIN: "SUPER_ADMIN",
    ORGADMIN: "ORG_ADMIN",
    ORG_ADMIN: "ORG_ADMIN",
    ORG_VIEWER: "ORG_VIEWER",
    MANDI_ADMIN: "MANDI_ADMIN",
    MANDI_MANAGER: "MANDI_MANAGER",
    AUCTIONEER: "AUCTIONEER",
    GATE_OPERATOR: "GATE_OPERATOR",
    WEIGHBRIDGE_OPERATOR: "WEIGHBRIDGE_OPERATOR",
    AUDITOR: "AUDITOR",
    VIEWER: "VIEWER",
  };
  return map[upper] || null;
};

const ORG_ADMIN_ALLOWED_ROLES = new Set([
  "ORG_VIEWER",
  "MANDI_ADMIN",
  "MANDI_MANAGER",
  "AUCTIONEER",
  "GATE_OPERATOR",
  "WEIGHBRIDGE_OPERATOR",
  "AUDITOR",
  "VIEWER",
]);

export type AdminUser = {
  username: string;
  display_name: string | null;
  email: string | null;
  mobile: string | null;
  role_slug: string;
  org_code: string | null;
  mandi_codes?: string[];
  is_active: "Y" | "N";
  last_login_on?: string | null;
  created_on?: string | null;
};

type OrgOption = { _id?: string; org_code: string; org_name?: string | null };
type MandiOption = { mandi_id: number; mandi_name?: string | null; mandi_slug?: string | null };

type ToastState = { open: boolean; message: string; severity: "success" | "error" | "info" };

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

const AdminUsersList: React.FC = () => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const scope = getUserScope("AdminUsersPage");
  const effectiveRole = normalizeRoleSlug(scope.role || uiConfig.role || null);
  const scopeOrgCode = uiConfig.scope?.org_code ?? scope.orgCode;
  const isSuper = isSuperAdmin(effectiveRole);
  const orgAdmin = isOrgAdmin(effectiveRole);

  const canCreateUser = useMemo(
    () =>
      uiConfig.resources.length
        ? can(uiConfig.resources, "admin_users.create", "CREATE")
        : isSuper || orgAdmin,
    [uiConfig.resources, isSuper, orgAdmin],
  );
  const canUpdateUserAction = useMemo(
    () =>
      uiConfig.resources.length
        ? can(uiConfig.resources, "admin_users.edit", "UPDATE")
        : isSuper || orgAdmin,
    [uiConfig.resources, isSuper, orgAdmin],
  );
  const canDeactivateUserAction = useMemo(
    () =>
      uiConfig.resources.length
        ? can(uiConfig.resources, "admin_users.deactivate", "DEACTIVATE")
        : isSuper,
    [uiConfig.resources, isSuper],
  );
  const canResetPasswordAction = useMemo(
    () =>
      uiConfig.resources.length
        ? can(uiConfig.resources, "admin_users.reset_password", "RESET_PASSWORD")
        : isSuper || orgAdmin,
    [uiConfig.resources, isSuper, orgAdmin],
  );
  const isReadOnly = useMemo(
    () => (uiConfig.resources.length ? !canUpdateUserAction : isReadOnlyRole(effectiveRole)),
    [uiConfig.resources, canUpdateUserAction, effectiveRole],
  );

  const [rows, setRows] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({ open: false, message: "", severity: "info" });

  const [filters, setFilters] = useState({
    org_code: scopeOrgCode || "",
    role_slug: "",
    status: "ALL" as "ALL" | "ACTIVE" | "INACTIVE",
  });

  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [mandiOptions, setMandiOptions] = useState<MandiOption[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState({
    username: "",
    password: "",
    display_name: "",
    email: "",
    mobile: "",
    org_code: scopeOrgCode || "",
    role_slug: "",
    mandi_codes: [] as string[],
    is_active: true,
  });

  const handleToast = (message: string, severity: ToastState["severity"]) =>
    setToast({ open: true, message, severity });

  const loadRoles = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    try {
      const res = await fetchAdminRoles({ username, language });
      const resp = res?.response || {};
      if (String(resp.responsecode) !== "0") return;
      let roles: string[] = (res?.data?.roles || []).map((r: any) => r.role_slug).filter(Boolean);
      roles = Array.from(new Set(roles));
      if (orgAdmin && !isSuper) {
        roles = roles.filter((r) => ORG_ADMIN_ALLOWED_ROLES.has(r));
      }
      setRoleOptions(roles);
    } catch (e) {
      console.error("[admin_users] loadRoles", e);
    }
  }, [language, orgAdmin, isSuper]);

  const loadOrgs = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    try {
      const res = await fetchOrganisations({ username, language });
      const resp = res?.response || {};
      if (String(resp.responsecode) !== "0") return;
      let orgs: OrgOption[] = (res?.data?.organisations || []).map((o: any) => ({
        _id: o._id,
        org_code: o.org_code,
        org_name: o.org_name,
      }));
      if (!isSuper && scopeOrgCode) orgs = orgs.filter((o) => o.org_code === scopeOrgCode);
      setOrgOptions(orgs);
    } catch (e) {
      console.error("[admin_users] loadOrgs", e);
    }
  }, [language, isSuper, scopeOrgCode]);

  const loadMandis = useCallback(
    async (org_code?: string | null) => {
      const username = currentUsername();
      if (!username || !org_code) {
        setMandiOptions([]);
        return;
      }
      const targetOrg = orgOptions.find((o) => o.org_code === org_code);
      if (!targetOrg?._id) {
        setMandiOptions([]);
        return;
      }
      try {
        const res = await fetchOrgMandis({ username, org_id: targetOrg._id, language });
        const resp = res?.response || {};
        if (String(resp.responsecode) !== "0") {
          setMandiOptions([]);
          return;
        }
        const mandis: MandiOption[] = (res?.data?.mappings || []).map((m: any) => ({
          mandi_id: Number(m.mandi_id),
          mandi_name: m.mandi_name,
          mandi_slug: m.mandi_slug,
        }));
        setMandiOptions(mandis);
      } catch (e) {
        console.error("[admin_users] loadMandis", e);
        setMandiOptions([]);
      }
    },
    [language, orgOptions],
  );

  const loadUsers = useCallback(async () => {
    const username = currentUsername();
    if (!username) {
      const sessionMessage = t("adminUsers.messages.validation_missing_user");
      setError(sessionMessage);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const filtersPayload: any = {};
      const orgCodeFilter = !isSuper ? scopeOrgCode || filters.org_code || "" : filters.org_code || "";
      if (orgCodeFilter) filtersPayload.org_code = orgCodeFilter;
      if (filters.role_slug) filtersPayload.role_slug = filters.role_slug;
      if (filters.status === "ACTIVE") filtersPayload.status = "ACTIVE";
      if (filters.status === "INACTIVE") filtersPayload.status = "INACTIVE";

      const res = await fetchAdminUsers({ username, language, filters: filtersPayload });
      const resp = res?.response || {};
      if (String(resp.responsecode ?? "") !== "0") {
        const msg = resp.description || t("adminUsers.messages.loadFailed");
        setError(msg);
        handleToast(msg, "error");
        return;
      }

      const normalized: AdminUser[] = (res?.data?.items || []).map((u: any) => {
        const rawRole =
          u.role_slug || u.role_code || (Array.isArray(u.roles) ? u.roles[0] : null) || "";
        const roleSlug = normalizeRoleSlug(rawRole) || rawRole || "";
        return {
          username: u.username,
          display_name: u.display_name ?? u.full_name ?? null,
          email: u.email ?? null,
          mobile: u.mobile ?? null,
          role_slug: roleSlug || "",
          org_code: u.org_code ?? u.orgCode ?? null,
          mandi_codes: u.mandi_codes || u.mandiCodes || [],
          is_active: String(u.is_active || "Y").toUpperCase() === "N" ? "N" : "Y",
          last_login_on: u.last_login_on || null,
          created_on: u.created_on || null,
        };
      });

      setRows(normalized);
    } catch (e: any) {
      const msg = e?.message || t("adminUsers.messages.networkLoad");
      setError(msg);
      handleToast(msg, "error");
    } finally {
      setLoading(false);
    }
  }, [filters.org_code, filters.role_slug, filters.status, language, scopeOrgCode, t]);

  useEffect(() => {
    loadRoles();
    loadOrgs();
  }, [loadRoles, loadOrgs]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const canManageUser = useCallback(
    (user?: AdminUser | null) => {
      if (!canUpdateUserAction) return false;
      if (isSuper) return true;
      if (orgAdmin && scopeOrgCode) {
        if (!user) return true;
        const userOrg = user.org_code || "";
        const allowedRolesOnly = ORG_ADMIN_ALLOWED_ROLES.has(user.role_slug);
        return userOrg === scopeOrgCode && allowedRolesOnly;
      }
      return false;
    },
    [canUpdateUserAction, isSuper, orgAdmin, scopeOrgCode],
  );

  const resetForm = (orgCode?: string) => {
    setForm({
      username: "",
      password: "",
      display_name: "",
      email: "",
      mobile: "",
      org_code: orgCode || "",
      role_slug: roleOptions[0] || "",
      mandi_codes: [],
      is_active: true,
    });
  };

  const handleOpenCreate = () => {
    if (!canCreateUser) {
      handleToast("You are not authorized to create users.", "error");
      return;
    }
    const enforcedOrg = !isSuper ? scopeOrgCode || "" : "";
    resetForm(enforcedOrg);
    if (enforcedOrg) loadMandis(enforcedOrg);
    setIsEditMode(false);
    setEditingUser(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (user: AdminUser) => {
    if (!canManageUser(user)) {
      handleToast("You are not authorized to edit this user.", "error");
      return;
    }
    setIsEditMode(true);
    setEditingUser(user);
    setForm({
      username: user.username,
      password: "",
      display_name: user.display_name || "",
      email: user.email || "",
      mobile: user.mobile || "",
      org_code: user.org_code || scopeOrgCode || "",
      role_slug: user.role_slug,
      mandi_codes: user.mandi_codes || [],
      is_active: user.is_active === "Y",
    });
    if (user.org_code) loadMandis(user.org_code);
    setDialogOpen(true);
  };

  const handleCloseDialog = () => setDialogOpen(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleRolesChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value as string;
    if (orgAdmin && !isSuper && !ORG_ADMIN_ALLOWED_ROLES.has(value)) {
      handleToast("You cannot assign that role.", "error");
      return;
    }
    setForm((prev) => ({ ...prev, role_slug: value }));
  };

  const handleOrgChange = async (value: string) => {
    setForm((prev) => ({ ...prev, org_code: value, mandi_codes: [] }));
    await loadMandis(value || null);
  };

  const handleMandiChange = (event: SelectChangeEvent<string[]>) => {
    const { value } = event.target;
    const mandis = typeof value === "string" ? value.split(",") : value;
    setForm((prev) => ({ ...prev, mandi_codes: mandis }));
  };

  const handleSubmit = async () => {
    if (isReadOnly) {
      setDialogOpen(false);
      handleToast("You are not authorized to modify users.", "error");
      return;
    }
    const username = currentUsername();
    if (!username) {
      handleToast(t("adminUsers.messages.noSession"), "error");
      return;
    }
    if (!form.display_name.trim()) {
      handleToast(t("adminUsers.messages.fullNameRequired"), "error");
      return;
    }
    if (!form.mobile.trim()) {
      handleToast(t("adminUsers.messages.mobileRequired"), "error");
      return;
    }
    const mobilePattern = /^\d{8,15}$/;
    if (!mobilePattern.test(form.mobile.trim())) {
      handleToast(t("adminUsers.messages.mobileInvalid"), "error");
      return;
    }
    if (!form.role_slug) {
      handleToast(t("adminUsers.messages.rolesRequired"), "error");
      return;
    }
    if (!isSuper && orgAdmin && scopeOrgCode) {
      if (form.org_code !== scopeOrgCode) {
        handleToast("You cannot assign another organisation.", "error");
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);
      if (isEditMode && editingUser) {
        const payload = {
          target_username: editingUser.username,
          display_name: form.display_name,
          email: form.email,
          mobile: form.mobile,
          role_slug: form.role_slug,
          org_code: form.org_code || null,
          mandi_codes: form.mandi_codes,
          is_active: (form.is_active ? "Y" : "N") as "Y" | "N",
        };
        const res = await updateAdminUser({ username, language, payload });
        const resp = res?.response || {};
        const code = String(resp.responsecode ?? "");
        if (code !== "0") {
          handleToast(resp.description || t("adminUsers.messages.updateFailed"), "error");
        } else {
          handleToast(t("adminUsers.messages.updateSuccess"), "success");
          await loadUsers();
          setDialogOpen(false);
        }
      } else {
        if (!form.username.trim()) {
          handleToast(t("adminUsers.messages.usernameRequired"), "error");
          setLoading(false);
          return;
        }
        const usernamePattern = /^[a-z0-9._-]{3,64}$/;
        const sanitizedUsername = form.username.trim().toLowerCase();
        if (!usernamePattern.test(sanitizedUsername)) {
          handleToast(t("adminUsers.messages.usernameInvalid"), "error");
          setLoading(false);
          return;
        }
        if (!form.password.trim()) {
          handleToast(t("adminUsers.messages.passwordRequired"), "error");
          setLoading(false);
          return;
        }
        const payload = {
          new_username: sanitizedUsername,
          password: form.password,
          display_name: form.display_name,
          email: form.email,
          mobile: form.mobile,
          role_slug: form.role_slug,
          org_code: form.org_code || null,
          mandi_codes: form.mandi_codes,
          is_active: (form.is_active ? "Y" : "N") as "Y" | "N",
        };
        const res = await createAdminUser({ username, language, payload });
        const resp = res?.response || {};
        const code = String(resp.responsecode ?? "");
        if (code !== "0") {
          handleToast(resp.description || t("adminUsers.messages.createFailed"), "error");
        } else {
          handleToast(t("adminUsers.messages.createSuccess"), "success");
          await loadUsers();
          setDialogOpen(false);
        }
      }
    } catch (e: any) {
      handleToast(e?.message || t("adminUsers.messages.networkError"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivate = async (user: AdminUser) => {
    if (!canDeactivateUserAction) return;
    try {
      setLoading(true);
      const username = currentUsername();
      if (!username) return;
      const res = await deactivateAdminUser({ username, language, target_username: user.username });
      const resp = res?.response || {};
      if (String(resp.responsecode ?? "") !== "0") {
        handleToast(resp.description || t("adminUsers.messages.updateFailed"), "error");
      } else {
        handleToast(t("adminUsers.messages.updateSuccess"), "success");
        await loadUsers();
      }
    } catch (e: any) {
      handleToast(e?.message || t("adminUsers.messages.networkError"), "error");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (user: AdminUser) => {
    if (!canResetPasswordAction) return;
    try {
      setLoading(true);
      const username = currentUsername();
      if (!username) return;
      const res = await resetAdminUserPassword({ username, language, target_username: user.username });
      const resp = res?.response || {};
      if (String(resp.responsecode ?? "") !== "0") {
        handleToast(resp.description || t("adminUsers.messages.resetFailed"), "error");
      } else {
        handleToast(t("adminUsers.messages.resetSuccess"), "success");
      }
    } catch (e: any) {
      handleToast(e?.message || t("adminUsers.messages.networkError"), "error");
    } finally {
      setLoading(false);
    }
  };

  const columns: GridColDef<AdminUser>[] = useMemo(
    () => [
      { field: "username", headerName: t("adminUsers.columns.username"), flex: 0.9 },
      { field: "display_name", headerName: t("adminUsers.columns.fullName"), flex: 1 },
      {
        field: "role_slug",
        headerName: t("adminUsers.columns.roles"),
        flex: 0.9,
        valueGetter: (params: any) => {
          const row = params?.row || {};
          const raw =
            row.role_slug ||
            row.roleSlug ||
            row.role_code ||
            (Array.isArray(row.roles) && row.roles.length ? row.roles[0] : "");
          const displayRole = raw ? raw.replace(/_/g, " ") : "";
          return displayRole;
        },
      },
      { field: "org_code", headerName: t("adminUsers.columns.orgCode"), flex: 0.7 },
      {
        field: "mandi_codes",
        headerName: t("adminUsers.columns.mandis"),
        flex: 1,
        valueGetter: (params: any) => {
          const row = params?.row || {};
          const codes = row.mandi_codes || row.mandiCodes || [];
          return Array.isArray(codes) ? codes.join(", ") : "";
        },
      },
      {
        field: "is_active",
        headerName: t("adminUsers.columns.status"),
        flex: 0.6,
        renderCell: (params: any) => (
          <Chip
            label={params.value === "Y" ? t("adminUsers.status.active") : t("adminUsers.status.inactive")}
            color={params.value === "Y" ? "success" : "default"}
            size="small"
          />
        ),
      },
      {
        field: "actions",
        headerName: t("adminUsers.columns.actions"),
        sortable: false,
        width: 280,
        renderCell: (params: any) => (
          <Stack direction="row" spacing={1}>
            {canUpdateUserAction && (
              <Button size="small" variant="outlined" onClick={() => handleOpenEdit(params.row)}>
                {t("adminUsers.actions.edit")}
              </Button>
            )}
            {canDeactivateUserAction && (
              <Button
                size="small"
                variant="text"
                color="error"
                onClick={() => handleDeactivate(params.row)}
              >
                {t("adminUsers.actions.deactivate")}
              </Button>
            )}
            {canResetPasswordAction && (
              <Button
                size="small"
                variant="outlined"
                startIcon={<LockResetIcon />}
                onClick={() => handleResetPassword(params.row)}
              >
                {t("adminUsers.actions.reset")}
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [
      canDeactivateUserAction,
      canResetPasswordAction,
      canUpdateUserAction,
      handleDeactivate,
      handleOpenEdit,
      handleResetPassword,
      t,
    ],
  );

  const orgFilterDisabled = !isSuper;

  return (
    <PageContainer>
      <Stack
        direction={{ xs: "column", md: "row" }}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
        spacing={2}
      >
        <Box>
          <Typography variant="h5">{t("adminUsers.title")}</Typography>
          <Typography variant="body2" color="text.secondary">
            {t("adminUsers.subtitle")}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadUsers}>
            {t("common.refresh")}
          </Button>
          {canCreateUser && (
            <Button variant="contained" onClick={handleOpenCreate}>
              {t("adminUsers.actions.new")}
            </Button>
          )}
        </Stack>
      </Stack>

      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", md: "center" }}
          >
            <TextField
              label={t("adminUsers.filters.organisation")}
              select
              value={filters.org_code || ""}
              onChange={(e) => setFilters((prev) => ({ ...prev, org_code: e.target.value }))}
              disabled={orgFilterDisabled}
              fullWidth
            >
              <MenuItem value="">{t("adminUsers.filters.all")}</MenuItem>
              {orgOptions.map((org) => (
                <MenuItem key={org.org_code} value={org.org_code}>
                  {org.org_code} {org.org_name ? `- ${org.org_name}` : ""}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label={t("adminUsers.filters.role")}
              select
              value={filters.role_slug}
              onChange={(e) => setFilters((prev) => ({ ...prev, role_slug: e.target.value }))}
              fullWidth
            >
              <MenuItem value="">{t("adminUsers.filters.all")}</MenuItem>
              {roleOptions.map((role) => (
                <MenuItem key={role} value={role}>
                  {role.replace(/_/g, " ")}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label={t("adminUsers.filters.status")}
              select
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value as any }))}
              fullWidth
            >
              <MenuItem value="ALL">{t("adminUsers.filters.all")}</MenuItem>
              <MenuItem value="ACTIVE">{t("adminUsers.filters.active")}</MenuItem>
              <MenuItem value="INACTIVE">{t("adminUsers.filters.inactive")}</MenuItem>
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      {error && <Alert severity="error">{error}</Alert>}

      {loading ? (
        <Box display="flex" justifyContent="center" py={6}>
          <CircularProgress />
        </Box>
      ) : (
        <ResponsiveDataGrid
          rows={rows}
          columns={columns}
          getRowId={(row) => row.username}
          pageSizeOptions={[10, 25, 50]}
          autoHeight
        />
      )}

      <Dialog fullScreen={isSmallScreen} open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>{isEditMode ? t("adminUsers.dialog.editTitle") : t("adminUsers.dialog.createTitle")}</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Stack spacing={2} divider={<Divider flexItem />}> 
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label={t("adminUsers.dialog.username")}
                name="username"
                value={form.username}
                onChange={handleChange}
                fullWidth
                disabled={isEditMode}
                required
              />
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
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label={t("adminUsers.dialog.fullName")}
                name="display_name"
                value={form.display_name}
                onChange={handleChange}
                fullWidth
                required
              />
              <TextField
                label={t("adminUsers.dialog.email")}
                name="email"
                type="email"
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
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label={t("adminUsers.dialog.organisation")}
                select
                value={form.org_code}
                onChange={(e) => handleOrgChange(e.target.value)}
                disabled={!isSuper}
                fullWidth
              >
                <MenuItem value="">{t("adminUsers.filters.all")}</MenuItem>
                {orgOptions.map((org) => (
                  <MenuItem key={org.org_code} value={org.org_code}>
                    {org.org_code} {org.org_name ? `- ${org.org_name}` : ""}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label={t("adminUsers.dialog.roles")}
                select
                value={form.role_slug}
                onChange={(e) => handleRolesChange(e as unknown as SelectChangeEvent<string>)}
                fullWidth
              >
                {roleOptions.map((role) => (
                  <MenuItem key={role} value={role}>
                    {role.replace(/_/g, " ")}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label={t("adminUsers.dialog.mandis")}
                select
                SelectProps={{
                  multiple: true,
                  renderValue: (selected) => (selected as string[]).join(", "),
                }}
                value={form.mandi_codes}
                onChange={(e) => handleMandiChange(e as unknown as SelectChangeEvent<string[]>)}
                fullWidth
                disabled={!form.org_code}
              >
                {mandiOptions.map((m) => {
                  const code = String(m.mandi_id);
                  return (
                    <MenuItem key={code} value={code}>
                      <Checkbox checked={form.mandi_codes.indexOf(code) > -1} />
                      <ListItemText primary={m.mandi_name || m.mandi_slug || code} />
                    </MenuItem>
                  );
                })}
              </TextField>

              <Stack direction="row" alignItems="center" spacing={1}>
                <Typography>{t("adminUsers.dialog.status")}</Typography>
                <Switch
                  checked={form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                />
                <Typography>{form.is_active ? t("adminUsers.dialog.active") : t("adminUsers.dialog.inactive")}</Typography>
              </Stack>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t("adminUsers.dialog.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? <CircularProgress size={18} /> : t("adminUsers.dialog.save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
          severity={toast.severity}
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
};

export default AdminUsersList;
