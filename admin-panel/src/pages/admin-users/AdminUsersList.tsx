import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button as AntButton,
  Card as AntCard,
  Checkbox as AntCheckbox,
  Col as AntCol,
  Dropdown,
  Input as AntInput,
  Modal as AntModal,
  Pagination as AntPagination,
  Radio as AntRadio,
  Row as AntRow,
  Space as AntSpace,
  Statistic,
  Switch as AntSwitch,
} from "antd";
import { DownOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
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
  Drawer,
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
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import CloseIcon from "@mui/icons-material/Close";


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
import { usePermissions } from "../../authz/usePermissions";
import { useRecordLock } from "../../authz/isRecordLocked";
import {
  createAdminUser,
  updateAdminUser,
  deactivateAdminUser,
  requestAdminPasswordReset,
  resetAdminUserPassword,
  fetchAdminUsers,
  fetchOrganisations,
  fetchOrgMandis,
} from "../../services/adminUsersApi";
import { getScreenHelp } from "../../services/screenHelpApi";
import type { RoleSlug } from "../../config/menuConfig";
import { getOrgDisplayName } from "../../utils/orgDisplay";

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
    YARD_SUPERVISOR: "YARD_SUPERVISOR",
    LOADING_SUPERVISOR: "LOADING_SUPERVISOR",
    WEIGHBRIDGE_OPERATOR: "WEIGHBRIDGE_OPERATOR",
    AUDITOR: "AUDITOR",
    VIEWER: "VIEWER",
  };
  return map[upper] || null;
};

const ORG_ADMIN_ALLOWED_ROLES = new Set<RoleSlug>([
  "ORG_VIEWER",
  "MANDI_ADMIN",
  "MANDI_MANAGER",
  "AUCTIONEER",
  "GATE_OPERATOR",
  "YARD_SUPERVISOR",
  "LOADING_SUPERVISOR",
  "WEIGHBRIDGE_OPERATOR",
  "AUDITOR",
  "VIEWER",
]);

// These are active operational roles in cm_roles_masters.
// The Admin Users role API may return role_code/name_i18n instead of role_slug,
// and in some builds may omit newly-added roles until backend cache is refreshed.
// Keep this list minimal and do NOT use cm_user_roles as a role master; that collection is user-role assignment data.
const ADMIN_USER_CREATE_ROLE_FALLBACKS: RoleSlug[] = ["YARD_SUPERVISOR"];

const ADMIN_ROLE_ORDER: RoleSlug[] = [
  "ORG_ADMIN",
  "ORG_VIEWER",
  "MANDI_MANAGER",
  "MANDI_ADMIN",
  "AUCTIONEER",
  "GATE_OPERATOR",
  "YARD_SUPERVISOR",
  "WEIGHBRIDGE_OPERATOR",
  "AUDITOR",
  "VIEWER",
  "SUPER_ADMIN",
];

const extractRoleCode = (role: AdminRoleApiItem): RoleSlug | null => {
  const raw =
    role?.role_slug ||
    role?.role_code ||
    role?.code ||
    role?.slug ||
    role?.value ||
    role?.name ||
    role?.name_i18n?.en ||
    "";

  return normalizeRoleSlug(String(raw)) || null;
};

const sortRoleOptions = (roles: RoleSlug[]): RoleSlug[] => {
  return [...roles].sort((a, b) => {
    const ai = ADMIN_ROLE_ORDER.indexOf(a);
    const bi = ADMIN_ROLE_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
};

const MANUAL_PASSWORD_MIN_LENGTH = 8;

type AdminRoleApiItem = {
  role_slug?: string | null;
  role_code?: string | null;
  code?: string | null;
  slug?: string | null;
  value?: string | null;
  name?: string | null;
  name_i18n?: {
    en?: string | null;
  } | null;
};


const SINGLE_MANDI_ROLE_SLUGS = new Set(["GATE_OPERATOR", "YARD_SUPERVISOR", "LOADING_SUPERVISOR", "WEIGHBRIDGE_OPERATOR"]);
const MANDI_REQUIRED_ROLE_SLUGS = new Set([
  "MANDI_ADMIN",
  "MANDI_MANAGER",
  "AUCTIONEER",
  "GATE_OPERATOR",
  "YARD_SUPERVISOR",
  "LOADING_SUPERVISOR",
  "WEIGHBRIDGE_OPERATOR",
]);

const requiresMandiScope = (roleSlug?: string | null) => !!roleSlug && MANDI_REQUIRED_ROLE_SLUGS.has(String(roleSlug).toUpperCase());
const isSingleMandiRole = (roleSlug?: string | null) => !!roleSlug && SINGLE_MANDI_ROLE_SLUGS.has(String(roleSlug).toUpperCase());
const normalizeMandiCodes = (value: any): string[] => Array.isArray(value) ? value.map((item) => String(item)) : [];

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ORG_ADMIN: "Organisation Admin",
  ORG_VIEWER: "Organisation Viewer",
  MANDI_ADMIN: "Mandi Admin",
  MANDI_MANAGER: "Mandi Manager",
  AUCTIONEER: "Auctioneer",
  GATE_OPERATOR: "Gate Operator",
  YARD_SUPERVISOR: "Yard Supervisor",
  LOADING_SUPERVISOR: "Loading Supervisor",
  WEIGHBRIDGE_OPERATOR: "Weighbridge Operator",
  AUDITOR: "Auditor",
  VIEWER: "Viewer",
};

const formatRoleLabel = (role?: string | null): string => {
  const normalized = String(role || "").trim().toUpperCase();
  if (!normalized) return "";
  return ROLE_LABELS[normalized] || normalized
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
};

export type AdminUser = {
  username: string;
  display_name: string | null;
  email: string | null;
  mobile: string | null;
  role_slug: string;
  role_code?: string;
  org_code: string | null;
  mandi_codes?: string[];
  mandi_names?: string[];
  gate_setup?: {
    status: "OK" | "MULTIPLE" | "MISSING_BINDING" | "SCOPE_MISMATCH";
    linked_active_devices: number;
    valid_in_scope_bindings: number;
    unique_gates: number;
  } | null;
  is_active: "Y" | "N";
  last_login_on?: string | null;
  created_on?: string | null;
  org_scope?: string | null;
  org_id?: string | null;
  owner_type?: string | null;
  owner_org_id?: string | null;
  is_protected?: string | null;
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

  return formatRoleLabel(raw);
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
  org_id: string;
  role_slug: string;
  mandi_codes: string[];
  is_active: boolean;
};

type AdminUserFieldErrors = Partial<Record<
  "username" | "password" | "display_name" | "email" | "mobile" | "org_code" | "role_slug" | "mandi_codes",
  string
>>;

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
  const inFlightUsersKeyRef = useRef<string | null>(null);
  const completedUsersKeyRef = useRef<string | null>(null);
  const inFlightOrgsKeyRef = useRef<string | null>(null);
  const completedOrgsKeyRef = useRef<string | null>(null);
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("md"));
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const { can, authContext, isSuper } = usePermissions();
  const { isRecordLocked } = useRecordLock();
  const scopeOrgCode = uiConfig.scope?.org_code || authContext.org_code || "";
  const recordLockContext = useMemo(
    () => ({
      role: authContext.role || null,
      org_id: authContext.org_id || null,
      org_code: authContext.org_code || null,
      isSuper,
    }),
    [authContext.role, authContext.org_id, authContext.org_code, isSuper],
  );

  const canCreateUser = useMemo(() => can("admin_users.create", "CREATE"), [can]);
  const canUpdateUserAction = useMemo(() => can("admin_users.edit", "UPDATE"), [can]);
  const canDeactivateUserAction = useMemo(() => can("admin_users.deactivate", "DEACTIVATE"), [can]);
  const canResetPasswordAction = useMemo(() => can("admin_users.reset_password", "RESET_PASSWORD"), [can]);
  const isReadOnly = useMemo(() => !canUpdateUserAction, [canUpdateUserAction]);

  const [rows, setRows] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpLoading, setHelpLoading] = useState(false);
  const [helpError, setHelpError] = useState(false);
  const [helpContent, setHelpContent] = useState("");
  const [helpTitle, setHelpTitle] = useState("Help");
  const [helpFetched, setHelpFetched] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    setHelpFetched(false);
  }, [language]);

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
  const [searchDraft, setSearchDraft] = useState(initSearch);
  const [paginationModel, setPaginationModel] = useState({ page: 0, pageSize: 25 });
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });

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
    org_id: "",
    role_slug: "",
    mandi_codes: [] as string[],
    is_active: true,
  });
  const [fieldErrors, setFieldErrors] = useState<AdminUserFieldErrors>({});

  const handleToast = useCallback((message: string, severity: ToastState["severity"]) => {
    setToast({ open: true, message, severity });
  }, []);

  const loadOrgs = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;

    const requestKey = `${username}|${language}|${isSuper ? "SUPER" : scopeOrgCode}`;
    if (inFlightOrgsKeyRef.current === requestKey || completedOrgsKeyRef.current === requestKey) return;
    inFlightOrgsKeyRef.current = requestKey;

    try {
      const res = await fetchOrganisations({ username, language });
      const resp = res?.response || {};
      if (String(resp.responsecode) !== "0") return;

      const orgPayload = res?.data?.organisations || resp?.data?.organisations || [];
      let orgs: OrgOption[] = orgPayload.map((o: any) => ({
        _id: o._id,
        org_code: o.org_code,
        org_name: o.org_name,
      }));

      if (!isSuper && scopeOrgCode) {
        orgs = orgs.filter((o) => o.org_code === scopeOrgCode);
      }

      setOrgOptions((prev) => {
        const same =
          prev.length === orgs.length &&
          prev.every((item, index) => item._id === orgs[index]?._id && item.org_code === orgs[index]?.org_code && item.org_name === orgs[index]?.org_name);
        return same ? prev : orgs;
      });
      completedOrgsKeyRef.current = requestKey;
    } catch (e) {
      console.error("[admin_users] loadOrgs", e);
    } finally {
      if (inFlightOrgsKeyRef.current === requestKey) inFlightOrgsKeyRef.current = null;
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
      //  const mandis: MandiOption[] = (res?.data?.mappings || []).map((m: any) => ({ // rw on 25 march 2026
        
        
        //   const mandis: MandiOption[] = ((res?.data?.items || resp?.data?.items || []) as any[]).map((m: any) => ({
        
        //   mandi_id: Number(m.mandi_id),
        //   mandi_name: m.mandi_name,
        //   mandi_slug: m.mandi_slug,
        // }));
const mandis: MandiOption[] = ((res?.data?.items || resp?.data?.items || []) as any[]).map((m: any) => ({
  mandi_id: Number(m.mandi_id),
  mandi_name: m.label || m.name_i18n?.en || m.mandi_slug || `Mandi ${m.mandi_id}`,
  mandi_slug: m.mandi_slug || "",
}));

        setMandiOptions(mandis);
      } catch (e) {
        console.error("[admin_users] loadMandis", e);
        setMandiOptions([]);
      }
    },
    [language, orgOptions],
  );

  const loadUsers = useCallback(async (options: { force?: boolean } = {}) => {
    const username = currentUsername();
    if (!username) {
      const sessionMessage = t("adminUsers.messages.validation_missing_user");
      setError(sessionMessage);
      setLoading(false);
      return;
    }
    const filtersPayload: any = {};
    try {
      const orgCodeFilter = !isSuper ? scopeOrgCode || filters.org_code || "" : filters.org_code || "";
      if (orgCodeFilter) filtersPayload.org_code = orgCodeFilter;
      if (filters.role_slug) filtersPayload.role_slug = filters.role_slug;
      if (filters.search) filtersPayload.search = filters.search;
      if (filters.status === "ACTIVE") filtersPayload.status = "ACTIVE";
      if (filters.status === "INACTIVE") filtersPayload.status = "INACTIVE";
      filtersPayload.page = paginationModel.page + 1;
      filtersPayload.page_size = paginationModel.pageSize;

      const requestKey = JSON.stringify({ username, language, filters: filtersPayload });
      if (!options.force && (inFlightUsersKeyRef.current === requestKey || completedUsersKeyRef.current === requestKey)) {
        return;
      }
      inFlightUsersKeyRef.current = requestKey;
      setLoading(true);
      setError(null);

      const res = await fetchAdminUsers({ username, language, filters: filtersPayload });
      const resp = res?.response || {};
      if (String(resp.responsecode ?? "") !== "0") {
        const msg = resp.description || t("adminUsers.messages.loadFailed");
        setError(msg);
        handleToast(msg, "error");
        return;
      }

      const apiRoleOptions: AdminRoleApiItem[] = Array.isArray(res?.data?.role_options)
        ? res.data.role_options
        : [];
      let availableRoles: RoleSlug[] = apiRoleOptions
        .map(extractRoleCode)
        .filter((role): role is RoleSlug => role !== null);
      availableRoles = Array.from(new Set([...availableRoles, ...ADMIN_USER_CREATE_ROLE_FALLBACKS]));
      if (!isSuper) {
        availableRoles = availableRoles.filter(
          (role) => role !== "SUPER_ADMIN" && ORG_ADMIN_ALLOWED_ROLES.has(role),
        );
      }
      const sortedRoles = sortRoleOptions(availableRoles);
      setRoleOptions((prev) =>
        prev.length === sortedRoles.length && prev.every((role, index) => role === sortedRoles[index])
          ? prev
          : sortedRoles,
      );

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
          mandi_codes: normalizeMandiCodes(u.mandi_ids || u.mandi_codes || u.mandiCodes || []),
          mandi_names: Array.isArray(u.mandi_names) ? u.mandi_names.map((value: any) => String(value)) : [],
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
      const meta = res?.data?.meta || {};
      setTotalCount(Number(meta.totalCount ?? res?.data?.total_records ?? normalized.length) || 0);
      const apiSummary = res?.data?.summary || {};
      setSummary({
        total: Number(apiSummary.total ?? meta.totalCount ?? normalized.length) || 0,
        active: Number(apiSummary.active ?? normalized.filter((item) => item.is_active === "Y").length) || 0,
        inactive: Number(apiSummary.inactive ?? normalized.filter((item) => item.is_active === "N").length) || 0,
      });
      completedUsersKeyRef.current = JSON.stringify({ username, language, filters: filtersPayload });
    } catch (e: any) {
      const msg = e?.message || t("adminUsers.messages.networkLoad");
      setError(msg);
      handleToast(msg, "error");
    } finally {
      inFlightUsersKeyRef.current = null;
      setLoading(false);
    }
  }, [filters.org_code, filters.role_slug, filters.status, filters.search, language, scopeOrgCode, t, isSuper, paginationModel.page, paginationModel.pageSize]);

  const loadHelpContent = useCallback(async () => {
    if (helpFetched || helpLoading) return;

    setHelpLoading(true);
    setHelpError(false);
    setHelpContent("");
    setHelpTitle("Help");

    try {
      const doc = await getScreenHelp("/admin-users", language);
      const title = String(doc?.title || "Help").trim() || "Help";
      const html = String(doc?.html || doc?.content || "").trim();

      setHelpTitle(title);

      if (!html) {
        setHelpContent("");
        setHelpError(false);
      } else {
        setHelpContent(html);
        setHelpError(false);
      }
    } catch (err) {
      console.error("Failed to load help content", err);
      setHelpError(true);
      setHelpContent("");
      setHelpTitle("Help");
    } finally {
      setHelpLoading(false);
      setHelpFetched(true);
    }
  }, [helpFetched, helpLoading, language]);

  useEffect(() => {
    const currentQuery = searchParams.toString();
    const next = new URLSearchParams(currentQuery);
    if (filters.org_code) next.set("org_code", filters.org_code);
    else next.delete("org_code");
    if (filters.status) next.set("status", filters.status);
    if (filters.search) next.set("search", filters.search);
    else next.delete("search");
    if (next.toString() !== currentQuery) {
      setSearchParams(next, { replace: true });
    }
    try {
      localStorage.setItem("adminUsers.org_code", filters.org_code || "");
      localStorage.setItem("adminUsers.status", filters.status);
      localStorage.setItem("adminUsers.search", filters.search || "");
    } catch {
      // ignore
    }
  }, [filters, searchParams, setSearchParams]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFilters((prev) => prev.search === searchDraft ? prev : { ...prev, search: searchDraft });
      setPaginationModel((prev) => prev.page === 0 ? prev : { ...prev, page: 0 });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [searchDraft]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const canManageUser = useCallback(
    (user?: AdminUser | null) => {
      if (!canUpdateUserAction) return false;
      const lockInfo = user ? isRecordLocked(user as any, recordLockContext) : { locked: false };
      return !lockInfo.locked;
    },
    [canUpdateUserAction, isRecordLocked, recordLockContext],
  );

  const resetForm = (orgCode?: string) => {
    const targetOrg = orgOptions.find((o: OrgOption) => o.org_code === orgCode);
    setFieldErrors({});
    setForm({
      username: "",
      password: "",
      display_name: "",
      email: "",
      mobile: "",
      org_code: orgCode || "",
      org_id: targetOrg?._id || "",
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

  const handleOpenEdit = useCallback((user: AdminUser) => {
    if (!canManageUser(user)) {
      handleToast("You are not authorized to edit this user.", "error");
      return;
    }
    setIsEditMode(true);
    setEditingUser(user);
    setFieldErrors({});
    setForm({
      username: user.username,
      password: "",
      display_name: user.display_name || "",
      email: user.email || "",
      mobile: user.mobile || "",
      org_code: user.org_code || scopeOrgCode || "",
      org_id: user.org_id || "",
      role_slug: user.role_slug,
      mandi_codes: normalizeMandiCodes(user.mandi_codes || []),
      is_active: user.is_active === "Y",
    });
    if (user.org_code) void loadMandis(user.org_code);
    setDialogOpen(true);
  }, [canManageUser, handleToast, loadMandis, scopeOrgCode]);

  const handleCloseDialog = () => {
    setFieldErrors({});
    setDialogOpen(false);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev: FormState) => ({ ...prev, [name]: value }));
  };

  const handleRolesChange = (event: SelectChangeEvent<string>) => {
    const value = event.target.value as string;
    setForm((prev: FormState) => ({ ...prev, role_slug: value }));
  };

  const handleOrgChange = async (value: string) => {
    clearFieldError("org_code");
    const targetOrg = orgOptions.find((o: OrgOption) => o.org_code === value);
    setForm((prev: FormState) => ({
      ...prev,
      org_code: value,
      org_id: targetOrg?._id || "",
      mandi_codes: [],
    }));
    await loadMandis(value || null);
  };

  const handleMandiChange = (event: SelectChangeEvent<string[]>) => {
    const { value } = event.target;
    const rawMandis = typeof value === "string" ? value.split(",") : value;
    const normalized = rawMandis.map((item) => String(item));
    const nextMandis = isSingleMandiRole(form.role_slug)
      ? normalized.slice(-1)
      : normalized;
    setFieldErrors((prev) => ({ ...prev, mandi_codes: undefined }));
    setForm((prev: FormState) => ({ ...prev, mandi_codes: nextMandis }));
  };

  const clearFieldError = useCallback((field: keyof AdminUserFieldErrors) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  }, []);

  const applyAdminUserApiError = useCallback((description?: string | null) => {
    const message = String(description || "Unable to save admin user.").trim();
    const normalized = message.toLowerCase();
    let field: keyof AdminUserFieldErrors | null = null;

    if (normalized.includes("email") && normalized.includes("already")) field = "email";
    else if (normalized.includes("mobile") && normalized.includes("already")) field = "mobile";
    else if (normalized.includes("username") && normalized.includes("already")) field = "username";

    if (field) {
      setFieldErrors((prev) => ({ ...prev, [field as string]: message }));
    }
    setError(message);
    handleToast(message, "error");
  }, [handleToast]);

  const handleSubmit = async () => {
    setFieldErrors({});
    setError(null);
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
    if (requiresMandiScope(form.role_slug) && form.mandi_codes.length === 0) {
      handleToast("Please select at least one mandi for this role.", "error");
      return;
    }
    if (isSingleMandiRole(form.role_slug) && form.mandi_codes.length !== 1) {
      handleToast("Please select exactly one mandi for this role.", "error");
      return;
    }
    try {
      setLoading(true);
      setError(null);
      if (isEditMode && editingUser) {
        const selectedOrg = orgOptions.find((o: OrgOption) => o.org_code === form.org_code);
        const normalizedMandiIds = (form.mandi_codes || [])
          .map((v) => Number(v))
          .filter((v) => Number.isFinite(v) && v > 0);

        const payload = {
          target_username: editingUser.username,
          display_name: form.display_name,
          email: form.email,
          mobile: form.mobile,
          role_slug: form.role_slug,
          org_code: form.org_code || null,
          org_id: selectedOrg?._id || form.org_id || null,
          mandi_ids: normalizedMandiIds,
          mandi_codes: normalizedMandiIds.map(String),
          is_active: (form.is_active ? "Y" : "N") as "Y" | "N",
        };
        const res = await updateAdminUser({ username, language, payload });
        const resp = res?.response || {};
        const code = String(resp.responsecode ?? "");
        if (code !== "0") {
          applyAdminUserApiError(resp.description || t("adminUsers.messages.updateFailed"));
        } else {
          handleToast(t("adminUsers.messages.updateSuccess"), "success");
          await loadUsers({ force: true });
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
        const selectedOrg = orgOptions.find((o: OrgOption) => o.org_code === form.org_code);
        const normalizedMandiIds = (form.mandi_codes || [])
          .map((v) => Number(v))
          .filter((v) => Number.isFinite(v) && v > 0);

        const payload = {
          new_username: sanitizedUsername,
          password: form.password,
          display_name: form.display_name,
          email: form.email,
          mobile: form.mobile,
          role_slug: form.role_slug,
          org_code: form.org_code || null,
          org_id: selectedOrg?._id || form.org_id || null,
          mandi_ids: normalizedMandiIds,
          mandi_codes: normalizedMandiIds.map(String),
          is_active: (form.is_active ? "Y" : "N") as "Y" | "N",
        };
        const res = await createAdminUser({ username, language, payload });
        const resp = res?.response || {};
        const code = String(resp.responsecode ?? "");
        if (code !== "0") {
          applyAdminUserApiError(resp.description || t("adminUsers.messages.createFailed"));
        } else {
          handleToast(t("adminUsers.messages.createSuccess"), "success");
          await loadUsers({ force: true });
          setDialogOpen(false);
        }
      }
    } catch (e: any) {
      const message = e?.message || t("adminUsers.messages.networkError");
      setError(message);
      handleToast(message, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = useCallback(async (user: AdminUser) => {
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
        await loadUsers({ force: true });
      }
    } catch (e: any) {
      handleToast(e?.message || t("adminUsers.messages.networkError"), "error");
    } finally {
      setLoading(false);
    }
   }, [canDeactivateUserAction, canUpdateUserAction, handleToast, language, loadUsers, t]);

  const openResetDialog = useCallback((user: AdminUser) => {
    setResetTargetUser(user);
    setResetMode("EMAIL_LINK");
    setManualPassword("");
    setManualConfirmPassword("");
    setManualShowPassword(false);
    setManualShowConfirm(false);
    setResetLoading(false);
    setResetDialogOpen(true);
  }, []);

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

    const displayRole = formatRoleLabel(raw);
    return <span>{displayRole}</span>;
  },
},



      { field: "org_code", headerName: t("adminUsers.columns.orgCode"), flex: 0.7 },
      
      // {
      //   field: "mandi_codes",
      //   headerName: t("adminUsers.columns.mandis"),
      //   flex: 1,
      //   valueGetter: (params: any) => {
      //     const row = params?.row || {};
      //     const codes = row.mandi_codes || row.mandiCodes || [];
      //     return Array.isArray(codes) ? codes.join(", ") : "";
      //   },
      // },
      
{
  field: "mandi_codes",
  headerName: t("adminUsers.columns.mandis"),
  flex: 1,
  renderCell: (params: any) => {
    const row = params?.row || {};
    const names = Array.isArray(row.mandi_names) ? row.mandi_names : [];
    const codes = Array.isArray(row.mandi_codes) ? row.mandi_codes : [];
    const display = names.length ? names.join(", ") : codes.join(", ");
    return <span>{display}</span>;
  },
},

      {
        field: "gate_setup",
        headerName: "Setup",
        flex: 0.7,
        sortable: false,
        renderCell: (params: any) => {
          const row = params?.row || {};
          const roleRaw = String(row.role_slug || row.role_code || "").toUpperCase();
          const isGateRole = roleRaw === "GATE_OPERATOR" || roleRaw === "WEIGHBRIDGE_OPERATOR";
          if (!isGateRole) return <span>-</span>;
          const setup = row.gate_setup || null;
          const status = setup?.status ? String(setup.status) : "MISSING_BINDING";
          const label =
            status === "OK"
              ? "OK"
              : status === "MULTIPLE"
                ? "Multiple"
                : status === "SCOPE_MISMATCH"
                  ? "Mismatch"
                  : "Missing";
          const color =
            status === "OK"
              ? "success"
              : status === "MULTIPLE"
                ? "warning"
                : status === "SCOPE_MISMATCH"
                  ? "warning"
                  : "default";
          const title = setup
            ? `Linked: ${setup.linked_active_devices}, Valid: ${setup.valid_in_scope_bindings}, Gates: ${setup.unique_gates}`
            : "No linked active gate devices found.";
          return (
            <Tooltip title={title}>
              <Chip label={label} size="small" color={color as any} />
            </Tooltip>
          );
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
          const locked = isRecordLocked(row, recordLockContext).locked;
          const showEdit = canUpdateUserAction && !locked;
          const showStatus = !locked && (isActive ? canDeactivateUserAction : canUpdateUserAction);
          const showReset = canResetPasswordAction && !locked;

          if (!showEdit && !showStatus && !showReset) return null;

          return (
            <Stack direction="row" spacing={0.5}>
              {showEdit && (
                <Tooltip title={t("adminUsers.actions.edit")}>
                  <IconButton size="small" onClick={() => handleOpenEdit(row)}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
              {showStatus && (
                <Tooltip title={isActive ? t("adminUsers.actions.deactivate") : t("adminUsers.actions.activate")}>
                  <IconButton
                    size="small"
                    color={isActive ? "error" : "success"}
                    onClick={() => handleToggleStatus(row)}
                  >
                    {isActive ? <BlockIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                  </IconButton>
                </Tooltip>
              )}
              {showReset && (
                <Tooltip title={t("adminUsers.actions.reset")}>
                  <IconButton size="small" color="primary" onClick={() => openResetDialog(row)}>
                    <LockResetIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
          );
        },
      },


    ],
    [
      canDeactivateUserAction,
      canResetPasswordAction,
      canUpdateUserAction,
      handleOpenEdit,
      handleToggleStatus,
      isRecordLocked,
      openResetDialog,
      recordLockContext,
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
        <AntSpace wrap>
          <AntButton icon={<ReloadOutlined />} onClick={() => void loadUsers({ force: true })}>
            {t("common.refresh")}
          </AntButton>
          {canCreateUser && (
            <AntButton type="primary" icon={<PlusOutlined />} onClick={handleOpenCreate}>
              {t("adminUsers.actions.new")}
            </AntButton>
          )}
          <AntButton
            onClick={() => {
              setIsHelpOpen(true);
              void loadHelpContent();
            }}
          >
            Help
          </AntButton>
        </AntSpace>
      </Stack>

      <AntRow gutter={[12, 12]} style={{ marginBottom: 16 }}>
        <AntCol xs={24} sm={8}>
          <AntCard size="small">
            <Statistic title="Total Administrators / Users" value={summary.total} />
          </AntCard>
        </AntCol>
        <AntCol xs={12} sm={8}>
          <AntCard size="small">
            <Statistic title="Active" value={summary.active} />
          </AntCard>
        </AntCol>
        <AntCol xs={12} sm={8}>
          <AntCard size="small">
            <Statistic title="Inactive" value={summary.inactive} />
          </AntCard>
        </AntCol>
      </AntRow>

      <AntCard size="small" style={{ marginBottom: 16 }}>
        <AntRow gutter={[12, 12]} align="middle">
          <AntCol xs={24} md={7}>
            <AntInput
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search username, name, email or mobile"
              style={{ height: 40 }}
            />
          </AntCol>
          <AntCol xs={24} sm={8} md={6}>
            <Dropdown
              disabled={orgFilterDisabled}
              trigger={["click"]}
              menu={{
                items: [
                  { key: "", label: t("adminUsers.filters.all") },
                  ...orgOptions.map((org: OrgOption) => ({ key: org.org_code, label: getOrgDisplayName(org) })),
                ],
                onClick: ({ key }) => {
                  setFilters((prev) => ({ ...prev, org_code: String(key) }));
                  setPaginationModel((prev) => ({ ...prev, page: 0 }));
                },
              }}
            >
              <AntButton block style={{ height: 40, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{filters.org_code ? getOrgDisplayName(orgOptions.find((org) => org.org_code === filters.org_code) || { org_code: filters.org_code }) : t("adminUsers.filters.organisation")}</span>
                <DownOutlined />
              </AntButton>
            </Dropdown>
          </AntCol>
          <AntCol xs={12} sm={8} md={5}>
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  { key: "", label: t("adminUsers.filters.all") },
                  ...roleOptions.map((role: string) => ({ key: role, label: formatRoleLabel(role) })),
                ],
                onClick: ({ key }) => {
                  setFilters((prev) => ({ ...prev, role_slug: String(key) }));
                  setPaginationModel((prev) => ({ ...prev, page: 0 }));
                },
              }}
            >
              <AntButton block style={{ height: 40, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{filters.role_slug ? formatRoleLabel(filters.role_slug) : t("adminUsers.filters.role")}</span>
                <DownOutlined />
              </AntButton>
            </Dropdown>
          </AntCol>
          <AntCol xs={12} sm={8} md={6}>
            <Dropdown
              trigger={["click"]}
              menu={{
                items: [
                  { key: "ALL", label: t("adminUsers.filters.all") },
                  { key: "ACTIVE", label: t("adminUsers.filters.active") },
                  { key: "INACTIVE", label: t("adminUsers.filters.inactive") },
                ],
                onClick: ({ key }) => {
                  setFilters((prev) => ({ ...prev, status: key as FiltersState["status"] }));
                  setPaginationModel((prev) => ({ ...prev, page: 0 }));
                },
              }}
            >
              <AntButton block style={{ height: 40, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{filters.status === "ALL" ? t("adminUsers.filters.status") : filters.status === "ACTIVE" ? t("adminUsers.filters.active") : t("adminUsers.filters.inactive")}</span>
                <DownOutlined />
              </AntButton>
            </Dropdown>
          </AntCol>
        </AntRow>
      </AntCard>

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
                const mandiNames = Array.isArray(row.mandi_names) ? row.mandi_names : [];
                const mandiCodes = Array.isArray(row.mandi_codes) ? row.mandi_codes : [];
                const mandiSource = mandiNames.length ? mandiNames : mandiCodes;
                const mandiPreview = mandiSource.slice(0, 2).join(", ");
                const extraMandis = mandiSource.length > 2 ? mandiSource.length - 2 : 0;
                const isActive = row.is_active === "Y";
                const roleRaw = String(row.role_slug || row.role_code || "").toUpperCase();
                const isGateRole = roleRaw === "GATE_OPERATOR" || roleRaw === "WEIGHBRIDGE_OPERATOR";
                const setupStatus = String(row.gate_setup?.status || "MISSING_BINDING");
                const setupLabel =
                  setupStatus === "OK"
                    ? "OK"
                    : setupStatus === "MULTIPLE"
                      ? "Multiple"
                      : setupStatus === "SCOPE_MISMATCH"
                        ? "Mismatch"
                        : "Missing";

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
                          {mandiSource.length > 0 && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {t("adminUsers.columns.mandis")}: {mandiPreview}
                              {extraMandis > 0 ? ` (+${extraMandis} more)` : ""}
                            </Typography>
                          )}
                          {isGateRole && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              Setup: {setupLabel}
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
              {totalCount > paginationModel.pageSize && (
                <Box display="flex" justifyContent="center" mt={2}>
                  <AntPagination
                    current={paginationModel.page + 1}
                    pageSize={paginationModel.pageSize}
                    total={totalCount}
                    showSizeChanger
                    pageSizeOptions={["10", "25", "50"]}
                    onChange={(page, pageSize) => setPaginationModel({ page: page - 1, pageSize })}
                  />
                </Box>
              )}
            </Stack>
          ) : (
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <ResponsiveDataGrid
                rows={rows}
                columns={columns}
                getRowId={(row: AdminUser) => row.username}
                pageSizeOptions={[10, 25, 50]}
                paginationMode="server"
                rowCount={totalCount}
                paginationModel={paginationModel}
                onPaginationModelChange={setPaginationModel}
                autoHeight
              />
            </Box>
          )}
        </CardContent>
      </Card>

      {/* CM_RESET_FLOW_MARKER_20251227 */}
      <AntModal
        open={dialogOpen}
        onCancel={handleCloseDialog}
        title={isEditMode ? t("adminUsers.dialog.editTitle") : t("adminUsers.dialog.createTitle")}
        width={820}
        style={{ top: 72 }}
        styles={{ body: { maxHeight: "calc(100vh - 190px)", overflowY: "auto", paddingTop: 8 } }}
        footer={[
          <AntButton key="cancel" onClick={handleCloseDialog}>
            {t("adminUsers.dialog.cancel")}
          </AntButton>,
          <AntButton key="save" type="primary" loading={loading} onClick={() => void handleSubmit()}>
            {t("adminUsers.dialog.save")}
          </AntButton>,
        ]}
      >
        <AntRow gutter={[16, 16]}>
          <AntCol xs={24} sm={12}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t("adminUsers.dialog.username")} *</div>
            <AntInput
              value={form.username}
              onChange={(event) => {
                clearFieldError("username");
                setForm((prev) => ({ ...prev, username: event.target.value }));
              }}
              disabled={isEditMode}
              status={fieldErrors.username ? "error" : undefined}
              style={{ height: 40 }}
            />
            {fieldErrors.username && <div style={{ marginTop: 4, fontSize: 12, color: "#d4380d" }}>{fieldErrors.username}</div>}
          </AntCol>
          {!isEditMode && (
            <AntCol xs={24} sm={12}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t("adminUsers.dialog.password")} *</div>
              <AntInput.Password
                value={form.password}
                onChange={(event) => {
                  clearFieldError("password");
                  setForm((prev) => ({ ...prev, password: event.target.value }));
                }}
                status={fieldErrors.password ? "error" : undefined}
                style={{ height: 40 }}
              />
              {fieldErrors.password && <div style={{ marginTop: 4, fontSize: 12, color: "#d4380d" }}>{fieldErrors.password}</div>}
            </AntCol>
          )}
          <AntCol xs={24} sm={8}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t("adminUsers.dialog.fullName")} *</div>
            <AntInput
              value={form.display_name}
              onChange={(event) => {
                clearFieldError("display_name");
                setForm((prev) => ({ ...prev, display_name: event.target.value }));
              }}
              status={fieldErrors.display_name ? "error" : undefined}
              style={{ height: 40 }}
            />
            {fieldErrors.display_name && <div style={{ marginTop: 4, fontSize: 12, color: "#d4380d" }}>{fieldErrors.display_name}</div>}
          </AntCol>
          <AntCol xs={24} sm={8}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t("adminUsers.dialog.email")}</div>
            <AntInput
              type="email"
              value={form.email}
              onChange={(event) => {
                clearFieldError("email");
                setForm((prev) => ({ ...prev, email: event.target.value }));
              }}
              status={fieldErrors.email ? "error" : undefined}
              style={{ height: 40 }}
            />
            {fieldErrors.email && <div style={{ marginTop: 4, fontSize: 12, color: "#d4380d" }}>{fieldErrors.email}</div>}
          </AntCol>
          <AntCol xs={24} sm={8}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t("adminUsers.dialog.mobile")} *</div>
            <AntInput
              value={form.mobile}
              onChange={(event) => {
                clearFieldError("mobile");
                setForm((prev) => ({ ...prev, mobile: event.target.value }));
              }}
              status={fieldErrors.mobile ? "error" : undefined}
              style={{ height: 40 }}
            />
            {fieldErrors.mobile && <div style={{ marginTop: 4, fontSize: 12, color: "#d4380d" }}>{fieldErrors.mobile}</div>}
          </AntCol>
          <AntCol xs={24} sm={12}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t("adminUsers.dialog.organisation")}</div>
            <Dropdown
              disabled={!isSuper || form.role_slug === "SUPER_ADMIN"}
              trigger={["click"]}
              menu={{
                items: orgOptions.map((org) => ({ key: org.org_code, label: getOrgDisplayName(org) })),
                onClick: ({ key }) => void handleOrgChange(String(key)),
              }}
            >
              <AntButton block style={{ height: 40, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{form.org_code ? getOrgDisplayName(orgOptions.find((org) => org.org_code === form.org_code) || { org_code: form.org_code }) : "Select organisation"}</span>
                <DownOutlined />
              </AntButton>
            </Dropdown>
          </AntCol>
          <AntCol xs={24} sm={12}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t("adminUsers.dialog.roles")} *</div>
            <Dropdown
              trigger={["click"]}
              menu={{
                items: roleOptions.map((role) => ({ key: role, label: formatRoleLabel(role) })),
                onClick: ({ key }) => {
                  const nextRole = String(key);
                  setForm((prev) => ({
                    ...prev,
                    role_slug: nextRole,
                    org_code: nextRole === "SUPER_ADMIN" ? "" : prev.org_code,
                    org_id: nextRole === "SUPER_ADMIN" ? "" : prev.org_id,
                    mandi_codes: nextRole === "SUPER_ADMIN" ? [] : prev.mandi_codes,
                  }));
                },
              }}
            >
              <AntButton block style={{ height: 40, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{form.role_slug ? formatRoleLabel(form.role_slug) : "Select role"}</span>
                <DownOutlined />
              </AntButton>
            </Dropdown>
          </AntCol>
          <AntCol xs={24}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>{t("adminUsers.dialog.mandis")}</div>
            <AntCard size="small" styles={{ body: { maxHeight: 180, overflowY: "auto" } }}>
              {!form.org_code ? (
                <div style={{ color: "#6b7280" }}>Select organisation first.</div>
              ) : mandiOptions.length === 0 ? (
                <div style={{ color: "#6b7280" }}>No active Mandis are available for this organisation.</div>
              ) : (
                <AntCheckbox.Group
                  value={form.mandi_codes}
                  style={{ width: "100%" }}
                  onChange={(values) => {
                    const normalized = values.map(String);
                    const next = isSingleMandiRole(form.role_slug) ? normalized.slice(-1) : normalized;
                    setForm((prev) => ({ ...prev, mandi_codes: next }));
                  }}
                >
                  <AntRow gutter={[8, 8]}>
                    {mandiOptions.map((mandi) => {
                      const code = String(mandi.mandi_id);
                      return (
                        <AntCol xs={24} sm={12} key={code}>
                          <AntCheckbox value={code}>
                            {mandi.mandi_name || mandi.mandi_slug || code}
                          </AntCheckbox>
                        </AntCol>
                      );
                    })}
                  </AntRow>
                </AntCheckbox.Group>
              )}
            </AntCard>
            <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
              {!form.org_code
                ? "Select organisation first."
                : isSingleMandiRole(form.role_slug)
                  ? "Exactly one mandi is required for this role."
                  : requiresMandiScope(form.role_slug)
                    ? "At least one mandi is required for this role."
                    : "Optional mandi scope."}
            </div>
          </AntCol>
          <AntCol xs={24}>
            <AntSpace>
              <span style={{ fontWeight: 600 }}>{t("adminUsers.dialog.status")}</span>
              <AntSwitch
                checked={form.is_active}
                onChange={(checked) => setForm((prev) => ({ ...prev, is_active: checked }))}
              />
              <span>{form.is_active ? t("adminUsers.dialog.active") : t("adminUsers.dialog.inactive")}</span>
            </AntSpace>
          </AntCol>
        </AntRow>
      </AntModal>

      <AntModal
        open={resetDialogOpen}
        onCancel={closeResetDialog}
        title={`${t("adminUsers.actions.resetPassword", { defaultValue: "Reset Password" })}${resetTargetUser ? ` – ${resetTargetUser.username}` : ""}`}
        width={620}
        style={{ top: 72 }}
        footer={[
          <AntButton key="cancel" onClick={closeResetDialog}>
            {t("common.cancel", { defaultValue: "Cancel" })}
          </AntButton>,
          <AntButton
            key="submit"
            type="primary"
            loading={resetLoading}
            disabled={
              resetMode === "MANUAL" &&
              (manualPassword.trim().length < MANUAL_PASSWORD_MIN_LENGTH ||
                manualPassword.trim() !== manualConfirmPassword.trim())
            }
            onClick={() => void handleResetSubmit()}
          >
            {resetMode === "EMAIL_LINK"
              ? t("adminUsers.resetDialog.sendLink", { defaultValue: "Send reset link" })
              : t("adminUsers.resetDialog.updatePassword", { defaultValue: "Update password" })}
          </AntButton>,
        ]}
      >
        {resetTargetUser?.email && (
          <div style={{ color: "#6b7280", marginBottom: 16 }}>
            {t("adminUsers.columns.email")}: {resetTargetUser.email}
          </div>
        )}
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>
          {t("adminUsers.resetDialog.mode", { defaultValue: "Reset method" })}
        </div>
        <AntRadio.Group
          value={resetMode}
          onChange={(event) => setResetMode(event.target.value as "EMAIL_LINK" | "MANUAL")}
          style={{ width: "100%" }}
        >
          <AntSpace direction="vertical" size={12} style={{ width: "100%" }}>
            <AntRadio value="EMAIL_LINK">
              <div>
                <div style={{ fontWeight: 600 }}>
                  {t("adminUsers.resetDialog.emailOption", { defaultValue: "Send reset link email (recommended)" })}
                </div>
                <div style={{ color: "#6b7280", fontSize: 12 }}>
                  {t("adminUsers.resetDialog.emailDescription", {
                    defaultValue: "User will open a secure link and set a new password.",
                  })}
                </div>
              </div>
            </AntRadio>
            <AntRadio value="MANUAL">
              <div>
                <div style={{ fontWeight: 600 }}>
                  {t("adminUsers.resetDialog.manualOption", { defaultValue: "Set password manually (admin sets it now)" })}
                </div>
                <div style={{ color: "#6b7280", fontSize: 12 }}>
                  {t("adminUsers.resetDialog.manualDescription", {
                    defaultValue: "Use only if user cannot access email.",
                  })}
                </div>
              </div>
            </AntRadio>
          </AntSpace>
        </AntRadio.Group>

        {resetMode === "MANUAL" && (
          <AntSpace direction="vertical" size={12} style={{ width: "100%", marginTop: 18 }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                {t("adminUsers.resetDialog.newPassword", { defaultValue: "New Password" })}
              </div>
              <AntInput.Password
                value={manualPassword}
                onChange={(event) => setManualPassword(event.target.value)}
                disabled={resetLoading}
                style={{ height: 40 }}
              />
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>
                {t("adminUsers.resetDialog.confirmPassword", { defaultValue: "Confirm Password" })}
              </div>
              <AntInput.Password
                value={manualConfirmPassword}
                onChange={(event) => setManualConfirmPassword(event.target.value)}
                disabled={resetLoading}
                style={{ height: 40 }}
              />
            </div>
            <div style={{ color: "#6b7280", fontSize: 12 }}>
              {t("adminUsers.resetDialog.passwordHint", {
                defaultValue: "Use at least 8 characters, including letters and numbers.",
              })}
            </div>
          </AntSpace>
        )}
      </AntModal>

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

      <Drawer
        anchor="right"
        open={isHelpOpen}
        onClose={() => setIsHelpOpen(false)}
        PaperProps={{ sx: { width: { xs: "100%", sm: 420 } } }}
      >
        <Box
          p={2}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          borderBottom="1px solid"
          borderColor="divider"
        >
          <Typography variant="h6">{helpTitle || "Help"}</Typography>
          <IconButton onClick={() => setIsHelpOpen(false)} size="small">
            <CloseIcon />
          </IconButton>
        </Box>

        <Box
          p={3}
          sx={{
            overflowY: "auto",
            "& h1, & h2, & h3, & h4, & h5, & h6": { mt: 0, mb: 1.5, color: "text.primary" },
            "& p": { mt: 0, mb: 2, color: "text.secondary", lineHeight: 1.6 },
            "& ul, & ol": { mt: 0, pl: 3, mb: 2, color: "text.secondary" },
            "& li": { mb: 0.75 },
            "& code": {
              backgroundColor: "action.hover",
              padding: "2px 4px",
              borderRadius: "4px",
              fontFamily: "monospace",
              fontSize: "0.9em",
              color: "error.main",
            },
            "& hr": {
              my: 2,
              border: 0,
              borderTop: "1px solid",
              borderColor: "divider",
            },
          }}
        >
          {helpLoading ? (
            <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" py={4}>
              <CircularProgress size={24} />
              <Typography color="text.secondary">Loading help content...</Typography>
            </Stack>
          ) : helpError ? (
            <Alert severity="error">Failed to load help content. Please try again later.</Alert>
          ) : helpContent ? (
            <div dangerouslySetInnerHTML={{ __html: helpContent }} />
          ) : (
            <Alert severity="info">Help content is not available for this screen yet.</Alert>
          )}
        </Box>
      </Drawer>
    </PageContainer>
  );
};

// Step-up for this route is enforced globally by StepUpRouteEnforcer in App.tsx.
// Do not add a second page-level StepUpGuard here; doing so duplicates
// requireStepUp requests (and is especially noisy under React StrictMode).
export default AdminUsersList;

