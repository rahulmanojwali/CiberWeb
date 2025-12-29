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
  FormControl,
  FormControlLabel,
  FormLabel,
  FormHelperText,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Radio,
  RadioGroup,
  Snackbar,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
  Tooltip,
} from "@mui/material";
import { useSearchParams } from "react-router-dom";

import EditIcon from "@mui/icons-material/EditOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircleOutline";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";


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
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { ActionGate } from "../../authz/ActionGate";
import { usePermissions } from "../../authz/usePermissions";
import { useRecordLock } from "../../authz/isRecordLocked";
import {
  createAdminUser,
  updateAdminUser,
  deactivateAdminUser,
  requestAdminPasswordReset,
  resetAdminUserPassword,
  fetchAdminUsers,
  fetchAdminRoles,
  fetchOrganisations,
  fetchOrgMandis,
} from "../../services/adminUsersApi";
import type { RoleSlug } from "../../config/menuConfig";
import { getOrgDisplayName } from "../../utils/orgDisplay";
import { StepUpGuard } from "../../components/StepUpGuard";

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

const MANUAL_PASSWORD_MIN_LENGTH = 8;

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

const getDisplayRole = (row: any): string => {
  const raw =
    row.role_slug ||
    row.roleSlug ||
    row.role_code ||
    row.role ||
    row.admin_role ||
    (Array.isArray(row.roles) && row.roles.length ? row.roles[0] : "") ||
    (row.role && typeof row.role === "object"
      ? row.role.slug || row.role.role_slug || row.role.code
      : "");

  return raw ? String(raw).replace(/_/g, " ") : "";
};

type OrgOption = {
  _id?: string;
  org_code: string;
  org_name?: string | null;
  name?: string | null;
  label?: string | null;
};
type MandiOption = { mandi_id: number; mandi_name?: string | null; mandi_slug?: string | null };

type ToastState = { open: boolean; message: string; severity: "success" | "error" | "info" };

type FormState = {
  username: string;
  password: string;
  display_name: string;
  email: string;
  mobile: string;
  org_code: string;
  role_slug: string;
  mandi_codes: string[];
  is_active: boolean;
};

type FiltersState = {
  org_code: string;
  role_slug: string;
  status: "ALL" | "ACTIVE" | "INACTIVE";
  search: string;
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

const AdminUsersList: React.FC = () => {
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("md"));
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const { can, authContext, isSuper } = usePermissions();
  const { isRecordLocked } = useRecordLock();
  const scopeOrgCode = uiConfig.scope?.org_code || authContext.org_code || "";

  const canCreateUser = useMemo(() => can("admin_users.create", "CREATE"), [can]);
  const canUpdateUserAction = useMemo(() => can("admin_users.edit", "UPDATE"), [can]);
  const canDeactivateUserAction = useMemo(() => can("admin_users.deactivate", "DEACTIVATE"), [can]);
  const canResetPasswordAction = useMemo(() => can("admin_users.reset_password", "RESET_PASSWORD"), [can]);
  const isReadOnly = useMemo(() => !canUpdateUserAction, [canUpdateUserAction]);

  const [rows, setRows] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>({ open: false, message: "", severity: "info" });
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<AdminUser | null>(null);
  const [resetMode, setResetMode] = useState<"EMAIL_LINK" | "MANUAL">("EMAIL_LINK");
  const [manualPassword, setManualPassword] = useState("");
  const [manualConfirmPassword, setManualConfirmPassword] = useState("");
  const [manualShowPassword, setManualShowPassword] = useState(false);
  const [manualShowConfirm, setManualShowConfirm] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  const readStored = (key: string): string | null => {
    try {
      const val = localStorage.getItem(key);
      return val || null;
    } catch {
      return null;
    }
  };

  const initOrgCode =
    searchParams.get("org_code") ||
    readStored("adminUsers.org_code") ||
    scopeOrgCode ||
    (isSuper ? "" : scopeOrgCode || "");
  const initStatus = (searchParams.get("status") as "ALL" | "ACTIVE" | "INACTIVE" | null) ||
    (readStored("adminUsers.status") as any) ||
    "ALL";
  const initSearch = searchParams.get("search") || readStored("adminUsers.search") || "";

  const [filters, setFilters] = useState<FiltersState>({
    org_code: initOrgCode || "",
    role_slug: "",
    status: initStatus as "ALL" | "ACTIVE" | "INACTIVE",
    search: initSearch,
  });

  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [mandiOptions, setMandiOptions] = useState<MandiOption[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<FormState>({
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

  // const loadRoles = useCallback(async () => {
  //   const username = currentUsername();
  //   if (!username) return;
  //   try {
  //     const res = await fetchAdminRoles({ username, language });
  //     const resp = res?.response || {};
  //     if (String(resp.responsecode) !== "0") return;
  //     let roles: string[] = (res?.data?.roles || []).map((r: any) => r.role_slug).filter(Boolean);
  //     roles = Array.from(new Set(roles));
  //     if (orgAdmin && !isSuper) {
  //       roles = roles.filter((r) => ORG_ADMIN_ALLOWED_ROLES.has(r));
  //     }
  //     setRoleOptions(roles);
  //   } catch (e) {
  //     console.error("[admin_users] loadRoles", e);
  //   }
  // }, [language, orgAdmin, isSuper]);

const loadRoles = useCallback(async () => {
  const username = currentUsername();
  if (!username) return;
  try {
    const res = await fetchAdminRoles({ username, language });
    const resp = res?.response || {};
    if (String(resp.responsecode) !== "0") return;

    let roles: string[] = (res?.data?.roles || [])
      .map((r: any) => r.role_slug)
      .filter(Boolean);

    // Unique
    roles = Array.from(new Set(roles));

    // Never show SUPER_ADMIN unless you *are* SUPER_ADMIN
    if (!isSuper) {
      roles = roles.filter((r) => r !== "SUPER_ADMIN");
    }

    setRoleOptions(roles);
  } catch (e) {
    console.error("[admin_users] loadRoles", e);
  }
}, [language, isSuper]);




const loadOrgs = useCallback(async () => {
  const username = currentUsername();
  if (!username) return;

  try {
    const res = await fetchOrganisations({ username, language });
    const resp = res?.response || {};
    if (String(resp.responsecode) !== "0") return;

    // 🔴 OLD (only handled: { data: { organisations } })
    // let orgs: OrgOption[] = (res?.data?.organisations || []).map((o: any) => ({

    // ✅ NEW: handle both { data: { organisations } } and { response: { data: { organisations } } }
    const orgPayload =
      res?.data?.organisations ||          // case 1: top-level data (future consistent shape)
      resp?.data?.organisations || [];     // case 2: data nested under response (your current API)

    let orgs: OrgOption[] = orgPayload.map((o: any) => ({
      _id: o._id,
      org_code: o.org_code,
      org_name: o.org_name,
    }));

    if (!isSuper && scopeOrgCode) {
      orgs = orgs.filter((o) => o.org_code === scopeOrgCode);
    }

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
      const targetOrg = orgOptions.find((o: OrgOption) => o.org_code === org_code);
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
      if (filters.search) filtersPayload.search = filters.search;
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
          org_scope: u.org_scope || null,
          org_id: u.org_id || null,
          owner_type: u.owner_type || null,
          owner_org_id: u.owner_org_id || null,
          is_protected: u.is_protected || null,
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
  }, [filters.org_code, filters.role_slug, filters.status, filters.search, language, scopeOrgCode, t]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams.toString());
    if (filters.org_code) next.set("org_code", filters.org_code);
    else next.delete("org_code");
    if (filters.status) next.set("status", filters.status);
    if (filters.search) next.set("search", filters.search);
    else next.delete("search");
    setSearchParams(next, { replace: true });
    try {
      localStorage.setItem("adminUsers.org_code", filters.org_code || "");
      localStorage.setItem("adminUsers.status", filters.status);
      localStorage.setItem("adminUsers.search", filters.search || "");
    } catch {
      // ignore
    }
  }, [filters]);

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
      const lockInfo = user ? isRecordLocked(user as any, { ...authContext, isSuper }) : { locked: false };
      return !lockInfo.locked;
    },
    [canUpdateUserAction, authContext, isSuper, isRecordLocked],
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
    setForm((prev: FormState) => ({ ...prev, [name]: value }));
  };

  const handleRolesChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value as string;
    setForm((prev: FormState) => ({ ...prev, role_slug: value }));
  };

  const handleOrgChange = async (value: string) => {
    setForm((prev: FormState) => ({ ...prev, org_code: value, mandi_codes: [] }));
    await loadMandis(value || null);
  };

  const handleMandiChange = (event: SelectChangeEvent<string[]>) => {
    const { value } = event.target;
    const mandis = typeof value === "string" ? value.split(",") : value;
    setForm((prev: FormState) => ({ ...prev, mandi_codes: mandis }));
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

  const handleToggleStatus = async (user: AdminUser) => {
    // Temporary debug log – remove after verification
    console.log("[adminUsers] toggle status", { username: user.username, is_active: user.is_active });

    const username = currentUsername();
    if (!username) return;

    const isActive = user.is_active === "Y";
    if (isActive && !canDeactivateUserAction) return;
    if (!isActive && !canUpdateUserAction) return;

    try {
      setLoading(true);
      let resp;

      if (isActive) {
        const res = await deactivateAdminUser({ username, language, target_username: user.username });
        resp = res?.response || {};
      } else {
        if (!user.role_slug) {
          handleToast("Cannot activate: missing role information.", "error");
          setLoading(false);
          return;
        }
        const payload: any = {
          target_username: user.username,
          status: "ACTIVE",
          role_slug: user.role_slug,
        };
        if (user.org_code) payload.org_code = user.org_code;
        const res = await updateAdminUser({ username, language, payload });
        resp = res?.response || {};
      }

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

  const openResetDialog = (user: AdminUser) => {
    setResetTargetUser(user);
    setResetMode("EMAIL_LINK");
    setManualPassword("");
    setManualConfirmPassword("");
    setManualShowPassword(false);
    setManualShowConfirm(false);
    setResetLoading(false);
    setResetDialogOpen(true);
  };

  const closeResetDialog = () => {
    setResetDialogOpen(false);
    setResetTargetUser(null);
    setResetMode("EMAIL_LINK");
    setManualPassword("");
    setManualConfirmPassword("");
    setManualShowPassword(false);
    setManualShowConfirm(false);
    setResetLoading(false);
  };

  const handleSendResetLink = async () => {
    if (!canResetPasswordAction || !resetTargetUser) return;
    const username = currentUsername();
    if (!username) {
      handleToast(t("adminUsers.messages.noSession"), "error");
      return;
    }
    try {
      setResetLoading(true);
      const res = await requestAdminPasswordReset({
        username,
        language,
        target_username: resetTargetUser.username,
      });
      const resp = res?.response || {};
      if (String(resp.responsecode ?? "") !== "0") {
        handleToast(resp.description || t("adminUsers.messages.resetFailed"), "error");
        return;
      }
      const email = res?.email || (res?.data?.email ?? resetTargetUser.email ?? "");
      if (email) {
        handleToast(t("adminUsers.messages.resetEmailSent", { email }), "success");
      } else {
        handleToast(resp.description || t("adminUsers.messages.resetSuccess"), "success");
      }
      closeResetDialog();
    } catch (e: any) {
      handleToast(e?.message || t("adminUsers.messages.networkError"), "error");
    } finally {
      setResetLoading(false);
    }
  };

  const handleManualPasswordReset = async () => {
    if (!resetTargetUser) return;
    if (!resetMode) return;
    const username = currentUsername();
    if (!username) {
      handleToast(t("adminUsers.messages.noSession"), "error");
      return;
    }
    const trimmed = manualPassword.trim();
    const trimmedConfirm = manualConfirmPassword.trim();
    if (trimmed.length < MANUAL_PASSWORD_MIN_LENGTH) {
      handleToast(
        t("adminUsers.messages.resetInvalid", { defaultValue: `Password must be at least ${MANUAL_PASSWORD_MIN_LENGTH} characters.` }),
        "error"
      );
      return;
    }
    if (trimmed !== trimmedConfirm) {
      handleToast(t("adminUsers.messages.resetMismatch", { defaultValue: "Passwords do not match." }), "error");
      return;
    }
    try {
      setResetLoading(true);
      const res = await resetAdminUserPassword({
        username,
        language,
        target_username: resetTargetUser.username,
        new_password: trimmed,
      });
      const resp = res?.response || {};
      if (String(resp.responsecode ?? "") !== "0") {
        handleToast(resp.description || t("adminUsers.messages.resetFailed"), "error");
        return;
      }
      handleToast(t("adminUsers.messages.resetSuccess"), "success");
      closeResetDialog();
    } catch (e: any) {
      handleToast(e?.message || t("adminUsers.messages.networkError"), "error");
    } finally {
      setResetLoading(false);
    }
  };

  const handleResetSubmit = async () => {
    if (resetMode === "EMAIL_LINK") {
      await handleSendResetLink();
    } else {
      await handleManualPasswordReset();
    }
  };

  const columns: GridColDef<AdminUser>[] = useMemo(
    () => [
      { field: "username", headerName: t("adminUsers.columns.username"), flex: 0.9 },
      { field: "display_name", headerName: t("adminUsers.columns.fullName"), flex: 1 },
    
       
       
       
      //   field: "role_slug",
      //   headerName: t("adminUsers.columns.roles"),
      //   flex: 0.9,
      //   valueGetter: (params: any) => {
      //     const row = params?.row || {};
      //     const raw =
      //       row.role_slug ||
      //       row.roleSlug ||
      //       row.role_code ||
      //       (Array.isArray(row.roles) && row.roles.length ? row.roles[0] : "");
      //     const displayRole = raw ? raw.replace(/_/g, " ") : "";
      //     return displayRole;
      //   },
      // },

{
  field: "role_slug",
  headerName: t("adminUsers.columns.roles"),
  flex: 0.9,
  renderCell: (params: any) => {
    const row = params?.row || {};
    const raw =
      row.role_slug ||
      row.roleSlug ||
      row.role_code ||
      row.role ||                    // extra safety
      row.admin_role ||              // extra safety
      (Array.isArray(row.roles) && row.roles.length ? row.roles[0] : "") ||
      (row.role && typeof row.role === "object"
        ? row.role.slug || row.role.role_slug || row.role.code
        : "");

    const displayRole = raw ? String(raw).replace(/_/g, " ") : "";
    return <span>{displayRole}</span>;
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
  width: 220,
  renderCell: (params: any) => {
    const row = params.row as AdminUser;
    const isActive = row.is_active === "Y";

    return (
      <Stack direction="row" spacing={0.5}>
        <ActionGate resourceKey="admin_users.edit" action="UPDATE" record={row}>
          <Tooltip title={t("adminUsers.actions.edit")}>
            <IconButton size="small" onClick={() => handleOpenEdit(row)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </ActionGate>

        <ActionGate resourceKey="admin_users.deactivate" action="DEACTIVATE" record={row}>
          <Tooltip
            title={
              isActive
                ? t("adminUsers.actions.deactivate")
                : t("adminUsers.actions.activate")
            }
          >
            <IconButton
              size="small"
              color={isActive ? "error" : "success"}
              onClick={() => handleToggleStatus(row)}
            >
              {isActive ? (
                <BlockIcon fontSize="small" />
              ) : (
                <CheckCircleIcon fontSize="small" />
              )}
            </IconButton>
          </Tooltip>
        </ActionGate>

        <ActionGate resourceKey="admin_users.reset_password" action="RESET_PASSWORD" record={row}>
          <Tooltip title={t("adminUsers.actions.reset")}>
            <IconButton
              size="small"
              color="primary"
              onClick={() => openResetDialog(row)}
            >
              <LockResetIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </ActionGate>
      </Stack>
    );
  },
},



    ],
    [
      handleOpenEdit,
      handleToggleStatus,
      openResetDialog,
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
          <ActionGate resourceKey="admin_users.create" action="CREATE">
            {canCreateUser && (
              <Button variant="contained" onClick={handleOpenCreate}>
                {t("adminUsers.actions.new")}
              </Button>
            )}
          </ActionGate>
        </Stack>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                label={t("adminUsers.filters.organisation")}
                select
                value={filters.org_code || ""}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFilters((prev: FiltersState) => ({ ...prev, org_code: e.target.value }))
                }
                disabled={orgFilterDisabled}
                fullWidth
              >
                <MenuItem value="">{t("adminUsers.filters.all")}</MenuItem>
                {orgOptions.map((org: OrgOption) => (
                  <MenuItem key={org.org_code} value={org.org_code}>
                    {getOrgDisplayName(org)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label={t("adminUsers.filters.role")}
                select
                value={filters.role_slug}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFilters((prev: FiltersState) => ({ ...prev, role_slug: e.target.value }))
                }
                fullWidth
              >
                <MenuItem value="">{t("adminUsers.filters.all")}</MenuItem>
                {roleOptions.map((role: string) => (
                  <MenuItem key={role} value={role}>
                    {role.replace(/_/g, " ")}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label={t("adminUsers.filters.status")}
                select
                value={filters.status}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setFilters((prev: FiltersState) => ({
                    ...prev,
                    status: e.target.value as FiltersState["status"],
                  }))
                }
                fullWidth
              >
                <MenuItem value="ALL">{t("adminUsers.filters.all")}</MenuItem>
                <MenuItem value="ACTIVE">{t("adminUsers.filters.active")}</MenuItem>
                <MenuItem value="INACTIVE">{t("adminUsers.filters.inactive")}</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Card>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" py={6}>
              <CircularProgress />
            </Box>
          ) : isSmallScreen ? (
            <Stack spacing={1.5}>
              {rows.map((row: AdminUser) => {
                const displayRole = getDisplayRole(row);
                const mandiCodes = Array.isArray(row.mandi_codes) ? row.mandi_codes : [];
                const mandiPreview = mandiCodes.slice(0, 2).join(", ");
                const extraMandis = mandiCodes.length > 2 ? mandiCodes.length - 2 : 0;
                const isActive = row.is_active === "Y";

                return (
                  <Card key={row.username} variant="outlined">
                    <CardContent>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        spacing={1}
                      >
                        <Box>
                          <Typography variant="subtitle2" color="text.secondary">
                            {row.username}
                          </Typography>
                          <Typography variant="h6">
                            {row.display_name ||
                              t("adminUsers.card.noNameFallback", {
                                defaultValue: "Unnamed user",
                              })}
                          </Typography>
                          {displayRole && (
                            <Chip label={displayRole} size="small" sx={{ mt: 0.75 }} />
                          )}
                          {row.org_code && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              mt={0.75}
                            >
                              {t("adminUsers.columns.orgCode")}: {row.org_code}
                            </Typography>
                          )}
                          {mandiCodes.length > 0 && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {t("adminUsers.columns.mandis")}: {mandiPreview}
                              {extraMandis > 0 ? ` (+${extraMandis} more)` : ""}
                            </Typography>
                          )}
                        </Box>

                        <Box textAlign="right">
                          <Chip
                            label={
                              isActive
                                ? t("adminUsers.status.active")
                                : t("adminUsers.status.inactive")
                            }
                            color={isActive ? "success" : "default"}
                            size="small"
                          />
                          {row.last_login_on && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              display="block"
                              mt={0.75}
                            >
                              {t("adminUsers.columns.lastLogin")}: {row.last_login_on}
                            </Typography>
                          )}
                        </Box>
                      </Stack>

                      {(row.email || row.mobile) && (
                        <Stack direction="row" spacing={2} mt={1}>
                          {row.email && (
                            <Typography variant="caption" color="text.secondary">
                              {row.email}
                            </Typography>
                          )}
                          {row.mobile && (
                            <Typography variant="caption" color="text.secondary">
                              • {row.mobile}
                            </Typography>
                          )}
                        </Stack>
                      )}

                      <Stack direction="row" justifyContent="flex-end" spacing={0.5} mt={1.5}>
                        {canUpdateUserAction && (
                          <Tooltip title={t("adminUsers.actions.edit")}>
                            <IconButton size="small" onClick={() => handleOpenEdit(row)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}

                        {canUpdateUserAction && (
                          <Tooltip
                            title={
                              isActive
                                ? t("adminUsers.actions.deactivate")
                                : t("adminUsers.actions.activate")
                            }
                          >
                            <IconButton
                              size="small"
                              color={isActive ? "error" : "success"}
                              onClick={() => handleToggleStatus(row)}
                            >
                              {isActive ? (
                                <BlockIcon fontSize="small" />
                              ) : (
                                <CheckCircleIcon fontSize="small" />
                              )}
                            </IconButton>
                          </Tooltip>
                        )}

        {canResetPasswordAction && (
          <Tooltip title={t("adminUsers.actions.reset")}>
            <IconButton
              size="small"
              color="primary"
              onClick={() => openResetDialog(row)}
            >
              <LockResetIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
                      </Stack>
                    </CardContent>
                  </Card>
                );
              })}
            </Stack>
          ) : (
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <ResponsiveDataGrid
                rows={rows}
                columns={columns}
                getRowId={(row: AdminUser) => row.username}
                pageSizeOptions={[10, 25, 50]}
                autoHeight
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* CM_RESET_FLOW_MARKER_20251227 */}
      <Dialog
        fullScreen={isSmallScreen}
        open={dialogOpen}
        onClose={handleCloseDialog}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{isEditMode ? t("adminUsers.dialog.editTitle") : t("adminUsers.dialog.createTitle")}</DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2} mt={1}>
            <Grid item xs={12} sm={6}>
              <TextField
                label={t("adminUsers.dialog.username")}
                name="username"
                value={form.username}
                onChange={handleChange}
                fullWidth
                disabled={isEditMode}
                required
              />
            </Grid>
            {!isEditMode && (
              <Grid item xs={12} sm={6}>
                <TextField
                  label={t("adminUsers.dialog.password")}
                  name="password"
                  type="password"
                  value={form.password}
                  onChange={handleChange}
                  fullWidth
                  required
                />
              </Grid>
            )}
            <Grid item xs={12} sm={4}>
              <TextField
                label={t("adminUsers.dialog.fullName")}
                name="display_name"
                value={form.display_name}
                onChange={handleChange}
                fullWidth
                required
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label={t("adminUsers.dialog.email")}
                name="email"
                type="email"
                value={form.email}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label={t("adminUsers.dialog.mobile")}
                name="mobile"
                value={form.mobile}
                onChange={handleChange}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} sm={6}>
                  <TextField
                    label={t("adminUsers.dialog.organisation")}
                    select
                    value={form.org_code}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleOrgChange(e.target.value)}
                    disabled={!isSuper}
                    fullWidth
                  >
                <MenuItem value="">{t("adminUsers.filters.all")}</MenuItem>
                {orgOptions.map((org: OrgOption) => (
                  <MenuItem key={org.org_code} value={org.org_code}>
                    {getOrgDisplayName(org)}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
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
            </Grid>
            <Grid item xs={12}>
              <TextField
                label={t("adminUsers.dialog.mandis")}
                select
                SelectProps={{
                  multiple: true,
                  renderValue: (value: unknown) => {
                    const selected =
                      Array.isArray(value) && value.every((item) => typeof item === "string")
                        ? (value as string[])
                        : [];

                    return selected.join(", ");
                  },
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
            </Grid>
            <Grid item xs={12}>
              <Stack direction="row" alignItems="center" spacing={1.5}>
                <Typography>{t("adminUsers.dialog.status")}</Typography>
                <Switch
                  checked={form.is_active}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    setForm((prev: FormState) => ({ ...prev, is_active: e.target.checked }))
                  }
                />
                <Typography>{form.is_active ? t("adminUsers.dialog.active") : t("adminUsers.dialog.inactive")}</Typography>
              </Stack>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>{t("adminUsers.dialog.cancel")}</Button>
          <Button onClick={handleSubmit} disabled={loading} variant="contained">
            {loading ? <CircularProgress size={18} /> : t("adminUsers.dialog.save")}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        fullScreen={isSmallScreen}
        open={resetDialogOpen}
        onClose={closeResetDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {t("adminUsers.actions.resetPassword", { defaultValue: "Reset Password" })}
          {resetTargetUser ? ` – ${resetTargetUser.username}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          {resetTargetUser?.email && (
            <Typography variant="body2" color="text.secondary" mb={2}>
              {t("adminUsers.columns.email")}: {resetTargetUser.email}
            </Typography>
          )}
          <FormControl component="fieldset" sx={{ width: "100%" }}>
            <FormLabel component="legend">{t("adminUsers.resetDialog.mode", { defaultValue: "Reset method" })}</FormLabel>
            <RadioGroup
              aria-label="reset-method"
              value={resetMode}
              onChange={(e) => setResetMode(e.target.value as "EMAIL_LINK" | "MANUAL")}
            >
              <FormControlLabel
                value="EMAIL_LINK"
                control={<Radio />}
                label={
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2">
                      {t("adminUsers.resetDialog.emailOption", { defaultValue: "Send reset link email (recommended)" })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("adminUsers.resetDialog.emailDescription", {
                        defaultValue: "User will open a secure link and set a new password.",
                      })}
                    </Typography>
                  </Stack>
                }
              />
              <FormControlLabel
                value="MANUAL"
                control={<Radio />}
                label={
                  <Stack spacing={0.5}>
                    <Typography variant="subtitle2">
                      {t("adminUsers.resetDialog.manualOption", { defaultValue: "Set password manually (admin sets it now)" })}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t("adminUsers.resetDialog.manualDescription", {
                        defaultValue: "Use only if user cannot access email.",
                      })}
                    </Typography>
                  </Stack>
                }
              />
            </RadioGroup>
          </FormControl>

          {resetMode === "MANUAL" && (
            <Stack spacing={2} mt={2}>
              <TextField
                label={t("adminUsers.resetDialog.newPassword", { defaultValue: "New Password" })}
                type={manualShowPassword ? "text" : "password"}
                value={manualPassword}
                onChange={(e) => setManualPassword(e.target.value)}
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setManualShowPassword((prev) => !prev)}
                        edge="end"
                        size="small"
                      >
                        {manualShowPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                disabled={resetLoading}
              />
              <TextField
                label={t("adminUsers.resetDialog.confirmPassword", { defaultValue: "Confirm Password" })}
                type={manualShowConfirm ? "text" : "password"}
                value={manualConfirmPassword}
                onChange={(e) => setManualConfirmPassword(e.target.value)}
                fullWidth
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setManualShowConfirm((prev) => !prev)}
                        edge="end"
                        size="small"
                      >
                        {manualShowConfirm ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
                disabled={resetLoading}
              />
              <FormHelperText>
                {t("adminUsers.resetDialog.passwordHint", {
                  defaultValue: "Use at least 8 characters, including letters and numbers.",
                })}
              </FormHelperText>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={closeResetDialog}>{t("common.cancel", { defaultValue: "Cancel" })}</Button>
          <Button
            variant="contained"
            onClick={handleResetSubmit}
            disabled={
              resetLoading ||
              (resetMode === "MANUAL" &&
                (manualPassword.trim().length < MANUAL_PASSWORD_MIN_LENGTH ||
                  manualPassword.trim() !== manualConfirmPassword.trim()))
            }
          >
            {resetLoading ? (
              <CircularProgress size={18} color="inherit" />
            ) : resetMode === "EMAIL_LINK" ? (
              t("adminUsers.resetDialog.sendLink", { defaultValue: "Send reset link" })
            ) : (
              t("adminUsers.resetDialog.updatePassword", { defaultValue: "Update password" })
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((prev: ToastState) => ({ ...prev, open: false }))}
      >
        <Alert
          onClose={() => setToast((prev: ToastState) => ({ ...prev, open: false }))}
          severity={toast.severity}
          sx={{ width: "100%" }}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </PageContainer>
  );
};

const GuardedAdminUsers: React.FC = () => {
  const username = currentUsername();
  return (
    <StepUpGuard username={username} resourceKey="admin_users.list" action="VIEW">
      <AdminUsersList />
    </StepUpGuard>
  );
};

export default GuardedAdminUsers;
