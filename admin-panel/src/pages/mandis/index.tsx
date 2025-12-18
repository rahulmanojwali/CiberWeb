import React, { useEffect, useMemo, useState } from "react";
import {
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
  Stack,
  TextField,
  Typography,
  IconButton,
  Tooltip,
  useMediaQuery,
  useTheme,
  Pagination,
  Snackbar,
  Alert,
  Chip,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { DEFAULT_PAGE_SIZE, MOBILE_PAGE_SIZE, PAGE_SIZE_OPTIONS } from "../../config/uiDefaults";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { ActionGate } from "../../authz/ActionGate";
import { usePermissions } from "../../authz/usePermissions";
import { useRecordLock } from "../../authz/isRecordLocked";
import { fetchMandis, createMandi, updateMandi, deactivateMandi } from "../../services/mandiApi";
import { normalizeFlag } from "../../utils/statusUtils";
import { fetchStatesDistrictsByPincode } from "../../services/mastersApi";
import { useScopedFilters } from "../../hooks/useScopedFilters";

type MandiRow = {
  mandi_id: number;
  name: string;
  state_code: string;
  district_name_en: string;
  pincode: string;
  is_active: boolean;
  address_line?: string;
  contact_number?: string | null;
  remarks?: string | null;
  district_id?: string | null;
  scope_type?: "GLOBAL" | "ORG" | string;
  status_flag?: "Y" | "N";
  is_system?: boolean;
  can_edit?: boolean;
  can_deactivate?: boolean;
  org_scope?: string | null;
  org_id?: string | null;
  owner_type?: string | null;
  owner_org_id?: string | null;
  is_protected?: string | null;
};

const defaultForm = {
  mandi_id: "" as string | number,
  name_en: "",
  state_code: "",
  district_name_en: "",
  district_id: "",
  address_line: "",
  pincode: "",
  contact_number: "",
  remarks: "",
  is_active: true,
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

export const Mandis: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const theme = useTheme();
  const fullScreenDialog = useMediaQuery(theme.breakpoints.down("sm"));
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const initialPageSize = isSmallScreen ? MOBILE_PAGE_SIZE : DEFAULT_PAGE_SIZE;
  const [rows, setRows] = useState<MandiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0); // 0-based for grid/mobile controls
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [rowCount, setRowCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [filters, setFilters] = useState({ state_code: "", district: "", status: "ALL" as "ALL" | "ACTIVE" | "INACTIVE" });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rowLoading, setRowLoading] = useState<Record<number, boolean>>({});
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [isPincodeResolving, setIsPincodeResolving] = useState(false);
  const [isPincodeValid, setIsPincodeValid] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [toast, setToast] = useState<{ open: boolean; message: string; severity: "success" | "error" | "info" }>({
    open: false,
    message: "",
    severity: "info",
  });
  const [orgFilters, setOrgFilters] = useState<{ org_code: string; org_name: string }[]>([]);
  const [viewMode, setViewMode] = useState(false);
  const pincodeTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  const { can, authContext, isSuper, getPermissionEntry } = usePermissions();
  const { isRecordLocked } = useRecordLock();
  const { orgCode, viewScope, setOrgCode, defaultOrgCode } = useScopedFilters({
    resourceKey: "mandis",
    role: uiConfig.role || null,
    org_code: uiConfig.scope?.org_code || null,
  });
  const isOrgAdminRole = false; // role-based gating removed; rely on permissions + record lock
  const canCreate = can("mandis.create", "CREATE");
  const canUpdate = can("mandis.edit", "UPDATE");
  const canDeactivate = can("mandis.deactivate", "DEACTIVATE");
  const isReadOnly = useMemo(() => viewMode, [viewMode]);
  const canSeeOrgFilter = true;

  const debugAuth = typeof window !== "undefined" && window.location.search.includes("debugAuth=1");

  const columns = useMemo<GridColDef<MandiRow>[]>(
    () => [
      { field: "mandi_id", headerName: "ID", width: 90 },
      { field: "name", headerName: "Name", flex: 1 },
      { field: "state_code", headerName: "State", width: 100 },
      { field: "district_name_en", headerName: "District", flex: 1 },
      { field: "pincode", headerName: "Pincode", width: 110 },
      { field: "address_line", headerName: "Address", flex: 1.5 },
      {
        field: "status",
        headerName: "Active",
        width: 130,
        renderCell: (params) => {
          const row: any = params.row;
          const isActive = Boolean(row.is_active);
          const label = isActive ? "Active" : "Inactive";
          const color = isActive ? "success" : "default";
          return <Chip size="small" label={label} color={color} variant="outlined" />;
        },
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 180,
        sortable: false,
        renderCell: (params) => {
          const row = params.row as MandiRow;
          const showEdit = !row.is_system;
          const showDeactivate = !row.is_system;
          const lockInfo = isRecordLocked(row as any, { ...authContext, isSuper });
          const canEdit = can("mandis.edit", "UPDATE");
          const canDeact = can("mandis.deactivate", "DEACTIVATE");
          if (debugAuth) {
            console.log("[mandis row auth]", {
              mandi_id: row.mandi_id,
              record_org_id: String((row as any).org_id || ""),
              record_owner_org_id: String((row as any).owner_org_id || ""),
              user_org_id: String(authContext.org_id || ""),
              lock: lockInfo,
              canEdit,
              canDeact,
              permEdit: getPermissionEntry("mandis.edit"),
              permDeact: getPermissionEntry("mandis.deactivate"),
            });
          }
          return (
            <Stack direction="row" spacing={1}>
              <Button size="small" onClick={() => openView(row)}>
                View
              </Button>
              <ActionGate resourceKey="mandis.edit" action="UPDATE" record={row}>
                {showEdit && (
                  <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(row)}>
                    Edit
                  </Button>
                )}
              </ActionGate>
              <ActionGate resourceKey="mandis.deactivate" action="DEACTIVATE" record={row}>
                {showDeactivate && (
                  <Tooltip title={row.is_active ? "Deactivate" : "Activate"}>
                    <span>
                      <IconButton
                        size="small"
                        color={row.is_active ? "error" : "success"}
                        disabled={!!rowLoading[row.mandi_id]}
                        onClick={() => toggleMandiStatus(row, !row.is_active)}
                      >
                        {row.is_active ? <CancelIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              </ActionGate>
            </Stack>
          );
        },
      },
    ],
    [canUpdate, canDeactivate, debugAuth],
  );

  const loadData = async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
      const effectiveOrg =
        orgCode && orgCode !== "ALL"
          ? orgCode
          : uiConfig.scope?.org_code || undefined;
      const effectiveViewScope = viewScope || (isSuper ? "ALL" : "ORG_ASSIGNED");
      const resp = await fetchMandis({
        username,
        language,
        filters: {
          org_code: effectiveOrg,
          view_scope: effectiveViewScope,
          page: page + 1, // API expects 1-based
          pageSize,
          search: debouncedSearch || undefined,
          state_code: filters.state_code || undefined,
          district_name_en: filters.district || undefined,
          is_active: filters.status === "ALL" ? undefined : filters.status === "ACTIVE" ? "Y" : "N",
        },
      });
      const data = resp?.data || resp?.response?.data || {};
      const orgList = data?.filters?.org_filters || data?.org_filters;
      if (Array.isArray(orgList)) {
        if (debugAuth) console.log("org_filters", orgList);
        setOrgFilters(orgList);
      }
      const list = data?.mandis || [];
      const totalMeta = Number.isFinite(Number(data?.meta?.totalCount)) ? Number(data.meta.totalCount) : null;
      const total = totalMeta ?? (Number.isFinite(Number(data?.totalCount)) ? Number(data.totalCount) : list.length);
      setRowCount(total);
      setRows(
        list.map((m: any) => ({
          mandi_id: m.mandi_id,
          name: m?.name_i18n?.en || m.mandi_slug || String(m.mandi_id),
          state_code: m.state_code || "",
          district_name_en: m.district_name || m.district_name_en || "",
          pincode: m.pincode || "",
          // Effective status from API (single source of truth)
          is_active: normalizeFlag(m.is_active) === "Y",
          status_flag: normalizeFlag(m.is_active),
          address_line: m.address_line || "",
          contact_number: m.contact_number || "",
          remarks: m.remarks || "",
          district_id: m.district_id || null,
          scope_type: (m.scope_type || "").toUpperCase() as any,
          org_scope: (m.org_scope || "").toUpperCase(),
          org_id: m.org_id || null,
          owner_type: m.owner_type || null,
          owner_org_id: m.owner_org_id || null,
          is_protected: m.is_protected || null,
          is_system: Boolean(m.is_system),
          can_edit: Boolean(m.can_edit),
          can_deactivate: Boolean(m.can_deactivate),
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchText), 400);
    return () => clearTimeout(handle);
  }, [searchText]);

  useEffect(() => {
    loadData();
  }, [language, filters.state_code, filters.district, filters.status, page, pageSize, debouncedSearch, orgCode, viewScope]);

  const openCreate = () => {
    if (!canCreate) return;
    setIsEdit(false);
    setViewMode(false);
    setForm(defaultForm);
    setPincodeError(null);
    setIsPincodeValid(false);
    setIsPincodeResolving(false);
    setSelectedId(null);
    setDialogOpen(true);
  };

  const openEdit = (row: MandiRow) => {
    if (!canUpdate) return;
    setIsEdit(true);
    setViewMode(false);
    setSelectedId(row.mandi_id);
    setPincodeError(null);
    setIsPincodeResolving(false);
    setIsPincodeValid(Boolean(row.pincode && row.state_code && row.district_name_en));
    setForm({
      mandi_id: row.mandi_id,
      name_en: row.name,
      state_code: row.state_code,
      district_name_en: row.district_name_en,
      district_id: row.district_id || "",
      address_line: row.address_line || "",
      pincode: row.pincode,
      contact_number: row.contact_number || "",
      remarks: row.remarks || "",
      is_active: row.is_active,
    });
    setDialogOpen(true);
  };

  const openView = (row: MandiRow) => {
    setIsEdit(true);
    setViewMode(true);
    setSelectedId(row.mandi_id);
    setForm({
      mandi_id: row.mandi_id,
      name_en: row.name,
      state_code: row.state_code,
      district_name_en: row.district_name_en,
      district_id: row.district_id || "",
      address_line: row.address_line || "",
      pincode: row.pincode,
      contact_number: row.contact_number || "",
      remarks: row.remarks || "",
      is_active: row.is_active,
    });
    setDialogOpen(true);
  };

  const handlePincodeLookup = async (pincode: string) => {
    const username = currentUsername();
    if (!username) return;
    if (!pincode || pincode.trim().length !== 6) {
      setPincodeError(pincode ? "Enter a 6-digit pincode" : null);
      setForm((f) => ({ ...f, state_code: "", district_name_en: "" }));
      setIsPincodeValid(false);
      return;
    }
    try {
      setIsPincodeResolving(true);
      const resp = await fetchStatesDistrictsByPincode({
        username,
        language,
        pincode: pincode.trim(),
        country: "IN",
      });
      const directData = resp?.response?.data || resp?.data;
      const statesArray = directData?.states || resp?.response?.data?.states || resp?.states || [];

      let stateCode: string | undefined;
      let districtName: string | undefined;
       let districtId: string | null | undefined;

      if (directData?.state_code && (directData?.district_name_en || directData?.district_name)) {
        stateCode = directData.state_code;
        districtName = directData.district_name_en || directData.district_name;
        districtId = directData.district_id || null;
      } else if (Array.isArray(statesArray) && statesArray[0]?.state_code && statesArray[0]?.districts?.[0]?.district_name) {
        stateCode = statesArray[0].state_code;
        districtName = statesArray[0].districts[0].district_name;
        districtId = statesArray[0].districts[0].district_id || null;
      }

      if (stateCode && districtName) {
        setForm((f) => ({
          ...f,
          state_code: stateCode,
          district_name_en: districtName,
          district_id: districtId || "",
        }));
        setPincodeError(null);
        setIsPincodeValid(true);
      } else {
        setForm((f) => ({ ...f, state_code: "", district_name_en: "" }));
        setPincodeError("Pincode not found");
        setIsPincodeValid(false);
      }
    } catch (err) {
      console.error("[mandis] pincode lookup", err);
      setForm((f) => ({ ...f, state_code: "", district_name_en: "" }));
      setPincodeError("Pincode lookup failed");
      setIsPincodeValid(false);
    } finally {
      setIsPincodeResolving(false);
    }
  };

  const handlePincodeChange = (value: string) => {
    const numeric = value.replace(/\D/g, "").slice(0, 6);
    setForm((f) => ({ ...f, pincode: numeric, state_code: numeric.length === 6 ? f.state_code : "", district_name_en: numeric.length === 6 ? f.district_name_en : "" }));
    if (numeric.length < 6) {
      setIsPincodeValid(false);
      setPincodeError(numeric ? "Enter a 6-digit pincode" : null);
      setIsPincodeResolving(false);
      return;
    }
    if (pincodeTimerRef.current) {
      clearTimeout(pincodeTimerRef.current);
    }
    setIsPincodeResolving(true);
    pincodeTimerRef.current = setTimeout(() => {
      handlePincodeLookup(numeric);
    }, 350);
  };

  const isCreateDisabled = () => {
    const hasRequired =
      form.name_en.trim().length > 0 &&
      form.pincode.trim().length === 6 &&
      isPincodeValid &&
      form.state_code &&
      form.district_name_en &&
      form.address_line.trim().length > 0;
    return (
      !canSubmit ||
      isReadOnly ||
      isPincodeResolving ||
      !hasRequired
    );
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username) return;
    const effectiveOrgCode =
      orgCode && orgCode !== "ALL"
        ? orgCode
        : uiConfig.scope?.org_code || "";
    const payload: any = {
      name_i18n: { en: form.name_en },
      state_code: form.state_code,
      district_name_en: form.district_name_en,
      district_id: form.district_id || undefined,
      address_line: form.address_line,
      pincode: form.pincode,
      contact_number: form.contact_number || null,
      remarks: form.remarks || null,
      is_active: form.is_active,
      org_code: effectiveOrgCode || undefined,
    };
    try {
      let resp;
      if (isEdit && selectedId) {
        payload.mandi_id = selectedId;
        resp = await updateMandi({ username, language, payload });
      } else {
        console.log("Create mandi submit payload", payload); // temp debug
        resp = await createMandi({ username, language, payload });
      }
      const responseCode = resp?.response?.responsecode || resp?.responsecode || resp?.responseCode;
      const description = resp?.response?.description || resp?.description || "";
      if (String(responseCode) === "0") {
        setDialogOpen(false);
        await loadData();
        setToast({ open: true, message: isEdit ? "Mandi updated." : "Mandi created.", severity: "success" });
      } else {
        setToast({ open: true, message: description || "Operation failed.", severity: "error" });
      }
    } catch (err: any) {
      setToast({ open: true, message: err?.message || "Operation failed.", severity: "error" });
    }
  };

  const toggleMandiStatus = async (row: MandiRow, nextActive: boolean) => {
    const username = currentUsername();
    if (!username) return;
    setRowLoading((m) => ({ ...m, [row.mandi_id]: true }));
    try {
      const resp = await updateMandi({ username, language, payload: { mandi_id: row.mandi_id, is_active: nextActive } });
      const code = resp?.response?.responsecode || resp?.responsecode || "";
      if (String(code) === "0") {
        setRows((prev) =>
          prev.map((r) => (r.mandi_id === row.mandi_id ? { ...r, is_active: nextActive, status_flag: nextActive ? "Y" : "N" } : r)),
        );
        await loadData();
      } else {
        setToast({ open: true, message: resp?.response?.description || "Status update failed", severity: "error" });
      }
    } catch (err: any) {
      setToast({ open: true, message: err?.message || "Status update failed", severity: "error" });
    } finally {
      setRowLoading((m) => ({ ...m, [row.mandi_id]: false }));
    }
  };

  const handleDeactivate = async (mandi_id: number) => {
    const username = currentUsername();
    if (!username) return;
    try {
      const resp = await deactivateMandi({ username, language, mandi_id });
      const responseCode = resp?.response?.responsecode || resp?.responsecode || resp?.responseCode;
      const description = resp?.response?.description || resp?.description || "";
      if (String(responseCode) === "0") {
        await loadData();
        setToast({ open: true, message: "Mandi deactivated.", severity: "success" });
      } else {
        setToast({ open: true, message: description || "Operation failed.", severity: "error" });
      }
    } catch (err: any) {
      setToast({ open: true, message: err?.message || "Operation failed.", severity: "error" });
    }
  };

  const canSubmit = isEdit ? canUpdate : canCreate;

  return (
    <PageContainer>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems="flex-start"
        spacing={2}
      >
        <Stack spacing={0.5}>
          <Typography variant="h5">{t("menu.mandis", { defaultValue: "Mandis" })}</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage mandis across the network with filters and actions.
          </Typography>
        </Stack>
        {canCreate && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            {t("actions.create", { defaultValue: "Create" })}
          </Button>
        )}
      </Stack>

      <Card sx={{ mt: 2, mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            {canSeeOrgFilter && (
              <Grid item xs={12} md={4}>
                <TextField
                  select
                  label="Organisation"
                  size="small"
                  value={orgCode || defaultOrgCode || "SYSTEM"}
                  onChange={(e) => {
                    setPage(0);
                    setOrgCode(e.target.value);
                  }}
                  fullWidth
                >
                  {(orgFilters.length
                    ? orgFilters.filter((o) => (isSuper ? true : o.org_code === uiConfig.scope?.org_code))
                    : [{ org_code: defaultOrgCode || "SYSTEM", org_name: "System Mandis (Default)" }]
                  ).map((o) => (
                    <MenuItem key={o.org_code} value={o.org_code}>
                      {o.org_name || o.org_code}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            )}
            <Grid item xs={12} md={4}>
              <TextField
                label="Search code/name/pincode"
                size="small"
                value={searchText}
                onChange={(e) => {
                  setPage(0);
                  setSearchText(e.target.value);
                }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="State"
                size="small"
                value={filters.state_code}
                onChange={(e) => {
                  setPage(0);
                  setFilters((f) => ({ ...f, state_code: e.target.value }));
                }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="District"
                size="small"
                value={filters.district}
                onChange={(e) => {
                  setPage(0);
                  setFilters((f) => ({ ...f, district: e.target.value }));
                }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="Status"
                size="small"
                value={filters.status}
                onChange={(e) => {
                  setPage(0);
                  setFilters((f) => ({ ...f, status: e.target.value as any }));
                }}
                fullWidth
              >
                <MenuItem value="ALL">All</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="INACTIVE">Inactive</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {isSmallScreen ? (
        <Stack spacing={1.5} sx={{ maxWidth: 640, mx: "auto", width: "100%" }}>
          {rows.map((row) => {
            const lockInfo = isRecordLocked(row as any, { ...authContext, isSuper });
            const permEdit = getPermissionEntry("mandis.edit");
            const permDeact = getPermissionEntry("mandis.deactivate");
            return (
            <Card key={row.mandi_id} variant="outlined" sx={{ borderRadius: 2, px: 2, py: 1.5, boxShadow: 1 }}>
              <Stack spacing={1}>
                {debugAuth && (
                  <Typography variant="caption" color="text.secondary">
                    scope:{row.org_scope || "-"} org_id:{String(row.org_id || "-")} owner_org:{String(row.owner_org_id || "-")} protected:{String(row.is_protected || "")}
                  </Typography>
                )}
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, fontSize: "0.95rem" }}>
                    {row.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {row.is_active ? "Active" : "Inactive"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.75rem" }}>
                    Mandi ID
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                    {row.mandi_id}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.75rem" }}>
                    State / District
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                    {row.state_code} {row.district_name_en ? `• ${row.district_name_en}` : ""}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.75rem" }}>
                    Pincode
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                    {row.pincode || "-"}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.75rem", mt: 0.5 }}>
                    Address
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                    {row.address_line || "-"}
                  </Typography>
                </Box>
                <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, pt: 0.5 }}>
                  <Button size="small" variant="text" onClick={() => openView(row)} sx={{ textTransform: "none" }}>
                    View
                  </Button>
                  <ActionGate resourceKey="mandis.edit" action="UPDATE" record={row}>
                    {!row.is_system && (
                      <Button size="small" variant="text" onClick={() => openEdit(row)} sx={{ textTransform: "none" }}>
                        Edit
                      </Button>
                    )}
                  </ActionGate>
                  <ActionGate resourceKey="mandis.deactivate" action="DEACTIVATE" record={row}>
                    {!row.is_system && (
                      <Tooltip title={row.is_active ? "Deactivate" : "Activate"}>
                        <span>
                          <IconButton
                            size="small"
                            color={row.is_active ? "error" : "success"}
                            disabled={!!rowLoading[row.mandi_id]}
                            onClick={() => toggleMandiStatus(row, !row.is_active)}
                          >
                            {row.is_active ? <CancelIcon fontSize="small" /> : <CheckCircleIcon fontSize="small" />}
                          </IconButton>
                        </span>
                      </Tooltip>
                    )}
                  </ActionGate>
                </Box>
                {debugAuth && (
                  <>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                      canEdit:{String(can("mandis.edit","UPDATE"))} canDeactivate:{String(can("mandis.deactivate","DEACTIVATE"))}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                      {(() => {
                        const canEdit = can("mandis.edit", "UPDATE");
                        const canDeact = can("mandis.deactivate", "DEACTIVATE");
                        const lockedText = lockInfo.locked ? `locked (${lockInfo.reason || "rule"})` : "open";
                        return `${lockedText} | authOrgId:${String(authContext.org_id || "-")} rowOrgId:${String(row.org_id || row.owner_org_id || "-")} | canEdit:${canEdit} canDeact:${canDeact} permEdit:${JSON.stringify(permEdit)} permDeact:${JSON.stringify(permDeact)}`;
                      })()}
                    </Typography>
                  </>
                )}
              </Stack>
            </Card>
            );
          })}
          {!rows.length && (
            <Typography variant="body2" color="text.secondary">
              No mandis found.
            </Typography>
          )}
          {rowCount > pageSize && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Pagination
                count={Math.max(1, Math.ceil(rowCount / pageSize))}
                page={page + 1}
                onChange={(_, newPage) => setPage(newPage - 1)}
                color="primary"
              />
            </Box>
          )}
        </Stack>
      ) : (
        <Card>
          <CardContent>
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <ResponsiveDataGrid
                columns={columns}
                rows={rows}
                loading={loading}
                getRowId={(r) => r.mandi_id}
                paginationMode="server"
                rowCount={rowCount}
                paginationModel={{ page, pageSize }}
                onPaginationModelChange={(model) => {
                  setPage(model.page);
                  if (model.pageSize !== pageSize) {
                    setPageSize(model.pageSize);
                    setPage(0);
                  }
                }}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
              />
            </Box>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="md"
        fullScreen={fullScreenDialog}
      >
        <DialogTitle>{isEdit ? "Edit Mandi" : "Create Mandi"}</DialogTitle>
        <DialogContent dividers>
            <Grid container spacing={1.5} mt={1}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Mandi Name"
                value={form.name_en}
                onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                fullWidth
                disabled={isReadOnly}
              />
            </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Pincode"
                  value={form.pincode}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  fullWidth
                  disabled={isReadOnly}
                  helperText={pincodeError || (isPincodeResolving ? "Resolving location..." : undefined)}
                  error={Boolean(pincodeError)}
                  inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 6 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="State Code"
                  value={form.state_code}
                  fullWidth
                  disabled
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="District"
                  value={form.district_name_en}
                  fullWidth
                  disabled
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Address"
                  value={form.address_line}
                  onChange={(e) => setForm((f) => ({ ...f, address_line: e.target.value }))}
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={isReadOnly || isPincodeResolving || !isPincodeValid}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Contact Number"
                  value={form.contact_number}
                  onChange={(e) => setForm((f) => ({ ...f, contact_number: e.target.value }))}
                  fullWidth
                  disabled={isReadOnly}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Remarks"
                  value={form.remarks}
                  onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                  fullWidth
                  disabled={isReadOnly}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Active"
                  value={form.is_active ? "Y" : "N"}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === "Y" }))}
                  fullWidth
                  disabled={isReadOnly || isPincodeResolving || !isPincodeValid}
                >
                  <MenuItem value="Y">Yes</MenuItem>
                  <MenuItem value="N">No</MenuItem>
                </TextField>
              </Grid>
            </Grid>
        </DialogContent>

        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          {canSubmit && (
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={isCreateDisabled()}
            >
              {isEdit ? "Update" : "Create"}
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
