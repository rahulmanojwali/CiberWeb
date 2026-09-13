// src/pages/mandis/index.tsx

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  MenuItem,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  InputAdornment,
  Chip,
  IconButton,
  Menu,
  useMediaQuery,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import { Alert as AntAlert, Button as AntButton, Col as AntCol, Dropdown, Input as AntInput, Modal as AntModal, Row as AntRow, Typography as AntTypography } from "antd";
import {
  CheckCircleOutlined,
  DownOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined as AntSearchOutlined,
  StopOutlined,
} from "@ant-design/icons";
import RefreshIcon from "@mui/icons-material/Refresh";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import MoreVertIcon from "@mui/icons-material/MoreVert";
import AddIcon from "@mui/icons-material/Add";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";

import { PageContainer } from "../../components/PageContainer";
import { CmInput } from "../../design-system/components/CmInput";
import { CmSelect } from "../../design-system/components/CmSelect";
import { CmReadOnlyField } from "../../design-system/components/CmReadOnlyField";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { usePermissions } from "../../authz/usePermissions";
import {
  fetchOrgMandisLite,
  fetchSystemMandisByState,
  importSystemMandisToOrg,
  updateOrgMandiStatus,
  createMandi,
  correctProtectedMandi,
  fetchProtectedMandiCorrectionHistory,
} from "../../services/mandiApi";
import { fetchStatesDistrictsByPincode } from "../../services/mastersApi";
import { useSnackbar } from "notistack";
import { DEFAULT_LANGUAGE } from "../../config/appConfig";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { useTheme } from "@mui/material/styles";
import { useStepUp } from "../../security/stepup/useStepUp";



type MandisDropdownOption = { value: string | number; label: React.ReactNode };

type OrganisationOption = {
  value: string;
  label: string;
  orgCode: string;
};

const MandisBoxedDropdown = ({
  id,
  value,
  options,
  onChange,
  disabled = false,
}: {
  id: string;
  value: string | number;
  options: MandisDropdownOption[];
  onChange: (value: string | number) => void;
  disabled?: boolean;
}) => {
  const selected = options.find((option) => String(option.value) === String(value));
  return (
    <Dropdown
      disabled={disabled}
      trigger={["click"]}
      menu={{
        selectedKeys: [String(value)],
        items: options.map((option) => ({
          key: String(option.value),
          label: option.label,
        })),
        onClick: ({ key }) => {
          const option = options.find((item) => String(item.value) === String(key));
          if (option) onChange(option.value);
        },
      }}
    >
      <AntButton
        id={id}
        disabled={disabled}
        className="cm-mandis-dropdown-trigger"
        style={{ width: "100%", height: 40, display: "flex", alignItems: "center", justifyContent: "space-between" }}
      >
        <span>{selected?.label ?? "Select"}</span>
        <DownOutlined />
      </AntButton>
    </Dropdown>
  );
};

type MandiLite = {
  _id?: string;
  mandi_id: number;
  mandi_slug?: string;
  name_i18n?: { en?: string };
  state_code?: string;
  district_name?: string;
  district_name_en?: string;
  district_id?: string | number;
  pincode?: string;

  address_line?: string;
  contact_number?: string;

  _rowId?: string;

  // status flags from backend
  is_active?: "Y" | "N" | string;
  org_mandi_is_active?: "Y" | "N" | string;

  [key: string]: any;
};

const toPositiveMandiId = (value: any): number | null => {
  let raw = value;
  if (raw && typeof raw === "object") {
    raw = raw.$numberInt ?? raw.$numberLong ?? raw.value ?? null;
  }
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

type CreateMandiForm = {
  name: string;
  pincode: string;
  address: string;
  contact: string;
};

type PincodeLookupResult = {
  district_name?: string | null;
  state_name?: string | null;
  district_id?: string | null;
  state_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
};

const PAGE_SIZES = [10, 20, 50];
const STATE_NAME_MAP: Record<string, string> = {
  AP: "Andhra Pradesh",
  AR: "Arunachal Pradesh",
  AS: "Assam",
  BR: "Bihar",
  CH: "Chandigarh",
  CT: "Chhattisgarh",
  DL: "Delhi",
  GA: "Goa",
  GJ: "Gujarat",
  HR: "Haryana",
  HP: "Himachal Pradesh",
  JH: "Jharkhand",
  JK: "Jammu and Kashmir",
  KA: "Karnataka",
  KL: "Kerala",
  LA: "Ladakh",
  LD: "Lakshadweep",
  MH: "Maharashtra",
  ML: "Meghalaya",
  MN: "Manipur",
  MP: "Madhya Pradesh",
  MZ: "Mizoram",
  NL: "Nagaland",
  OR: "Odisha",
  PB: "Punjab",
  PY: "Puducherry",
  RJ: "Rajasthan",
  SK: "Sikkim",
  TN: "Tamil Nadu",
  TS: "Telangana",
  TR: "Tripura",
  UP: "Uttar Pradesh",
  UT: "Uttarakhand",
  WB: "West Bengal",
};
const STATE_OPTIONS = Object.keys(STATE_NAME_MAP);

const INITIAL_CREATE_FORM: CreateMandiForm = { name: "", pincode: "", address: "", contact: "" };
const INITIAL_PINCODE_LOOKUP: PincodeLookupResult = {
  district_name: null,
  state_name: null,
  district_id: null,
  state_code: null,
  latitude: null,
  longitude: null,
};

export const Mandis: React.FC = () => {
  const { authContext, can, isSuper } = usePermissions();
  const [searchParams] = useSearchParams();
  const { enqueueSnackbar } = useSnackbar();
  const { ensureStepUp } = useStepUp();
  const theme = useTheme();

  const username =
    (() => {
      try {
        const raw = localStorage.getItem("cd_user");
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed?.username || null;
      } catch {
        return null;
      }
    })() || "";

  const requestedOrgId = (searchParams.get("org_id") || "").trim();
  const requestedOrgCode = (searchParams.get("org_code") || "").trim();

  // SUPER_ADMIN explicitly selects the organisation whose Mandis are being managed.
  // Organisation-scoped users are always locked to their authenticated organisation.
  const [selectedSuperOrgId, setSelectedSuperOrgId] = useState<string>(isSuper ? requestedOrgId : "");
  const [organisationOptions, setOrganisationOptions] = useState<OrganisationOption[]>([]);
  const [organisationsLoading, setOrganisationsLoading] = useState(false);
  const orgId = isSuper ? selectedSuperOrgId : authContext.org_id || "";
  const selectedOrgCode = isSuper
    ? organisationOptions.find((option) => option.value === selectedSuperOrgId)?.orgCode || requestedOrgCode
    : "";

  const canImport = can("mandis.create", "CREATE");
  const canRemove = can("mandis.deactivate", "DEACTIVATE");
  const canCreate = can("mandis.create", "CREATE");

  const [activeTab, setActiveTab] = useState<"MY" | "IMPORT">("MY");
  const isSmDown = useMediaQuery(theme.breakpoints.down("sm"));
  const isMdDown = useMediaQuery(theme.breakpoints.down("md"));

  // Action menu (row-level)
  const [actionMenuAnchor, setActionMenuAnchor] = useState<null | HTMLElement>(null);
  const [actionMenuRow, setActionMenuRow] = useState<MandiLite | null>(null);

  const [correctionRow, setCorrectionRow] = useState<MandiLite | null>(null);
  const [correctionName, setCorrectionName] = useState("");
  const [correctionState, setCorrectionState] = useState("");
  const [correctionDistrict, setCorrectionDistrict] = useState("");
  const [correctionPincode, setCorrectionPincode] = useState("");
  const [correctionAddress, setCorrectionAddress] = useState("");
  const [correctionContact, setCorrectionContact] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [correctionSubmitting, setCorrectionSubmitting] = useState(false);
  const [historyRow, setHistoryRow] = useState<MandiLite | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyItems, setHistoryItems] = useState<any[]>([]);

  // My Mandis state
  const [myState, setMyState] = useState<string>("");
  const [mySearch, setMySearch] = useState("");
  const [myDebounced, setMyDebounced] = useState("");
  const [myPage, setMyPage] = useState(1);
  const [myPageSize, setMyPageSize] = useState(10);
  const [myRows, setMyRows] = useState<MandiLite[]>([]);
  const [myTotal, setMyTotal] = useState(0);
  const [myLoading, setMyLoading] = useState(false);
  const [mySelectionModel, setMySelectionModel] = useState<(string | number)[]>([]);

  // Import tab state
  const [impState, setImpState] = useState<string>("");
  const [impSearch, setImpSearch] = useState("");
  const [impDebounced, setImpDebounced] = useState("");
  const [impPage, setImpPage] = useState(1);
  const [impPageSize, setImpPageSize] = useState(10);
  const [impRows, setImpRows] = useState<MandiLite[]>([]);
  const [impTotal, setImpTotal] = useState(0);
  const [impLoading, setImpLoading] = useState(false);
  const [impSelectionModel, setImpSelectionModel] = useState<(string | number)[]>([]);

  // Create Mandi modal
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createForm, setCreateForm] = useState<CreateMandiForm>(INITIAL_CREATE_FORM);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  // Refresh trigger
  const [myRefreshKey, setMyRefreshKey] = useState(0);

  // Pincode lookup
  const [pincodeLookup, setPincodeLookup] = useState<PincodeLookupResult>(INITIAL_PINCODE_LOOKUP);
  const [pincodeStatus, setPincodeStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [pincodeError, setPincodeError] = useState("");
  const pincodeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPincodeRef = useRef("");

  // Abort / dedupe
  const myReqRef = useRef<AbortController | null>(null);
  const impReqRef = useRef<AbortController | null>(null);

  // ======== Helpers ========
  const getMyRowId = (row: any) => String(row?.mandi_id ?? row?._id ?? row?._rowId);

  const selectedImportMandiIds = useMemo(() => {
    if (!impSelectionModel?.length) return [] as number[];
    return Array.from(
      new Set(
        impSelectionModel
          .map((v) => {
            const n = Number(String(v));
            return Number.isFinite(n) && n > 0 ? n : null;
          })
          .filter((n): n is number => n !== null),
      ),
    );
  }, [impSelectionModel]);

  const selectedMyRows = useMemo(() => {
    if (!mySelectionModel?.length) return [] as MandiLite[];
    const selected = new Set(mySelectionModel.map((val) => String(val)));
    return (myRows || []).filter((row) => selected.has(getMyRowId(row)));
  }, [myRows, mySelectionModel]);

  // ✅ Status definition used everywhere: Active only if BOTH master & org mapping are active
  const rowIsActive = useCallback((row: MandiLite) => {
    const masterActive = String(row?.is_active || "N").toUpperCase() === "Y";
    const orgMappingActive = String(row?.org_mandi_is_active ?? "Y").toUpperCase() === "Y";
    return masterActive && orgMappingActive;
  }, []);

  // ✅ Use rowIsActive for selections (previously you were using is_active only)
  const activeSelectedRows = useMemo(() => selectedMyRows.filter((row) => rowIsActive(row)), [selectedMyRows, rowIsActive]);
  const inactiveSelectedRows = useMemo(() => selectedMyRows.filter((row) => !rowIsActive(row)), [selectedMyRows, rowIsActive]);

  const normalizeList = (resp: any) => {
    const root = resp ?? {};
    const responseMeta = root?.response ?? root?.data?.response ?? resp?.response;
    const data = root?.data ?? {};
    const items = data?.items ?? data?.mandis ?? [];
    const meta = data?.meta ?? {};
    const totalRaw = meta?.totalCount ?? (Array.isArray(items) ? items.length : 0);
    const total = Number(totalRaw ?? 0);
    return { responseMeta, items: Array.isArray(items) ? items : [], total };
  };

  const normalizeImportResponse = (resp: any) => {
    const body = resp?.data ?? resp ?? {};
    return {
      imported: Number(body.imported ?? 0),
      skipped_existing: Number(body.skipped_existing ?? 0),
      skipped_invalid: Number(body.skipped_invalid ?? 0),
    };
  };

  const prepareRows = (items: any[]) =>
    (items || []).map((m, idx) => {
      const district =
        m?.district_name_en ||
        m?.district_name ||
        m?.district ||
        m?.district_id ||
        "";

      const pincode = m?.pincode ?? m?.pincode_no ?? "";

      const address_line =
        m?.address_line ||
        m?.address ||
        m?.address_line1 ||
        m?.address_line_en ||
        m?.mandi_address ||
        m?.location_address ||
        m?.address_i18n?.en ||
        "";

      const contact_number =
        m?.contact_number ||
        m?.contact ||
        m?.mandi_contact ||
        m?.phone ||
        m?.mobile ||
        m?.contact_no ||
        "";

      const display_name =
        m?.name_i18n?.en ||
        m?.label ||
        m?.mandi_slug ||
        (m?.mandi_id != null ? `Mandi ${m.mandi_id}` : "");

      const district_display =
        m?.district_name_en ||
        m?.district_name ||
        m?.district ||
        m?.district_id ||
        "";

      return {
        ...m,
        _rowId:
          m?._rowId ||
          m?._id ||
          (m?.mandi_id != null ? `mandi_${m.mandi_id}` : `row_${idx}`),

        district_name_en: district,
        pincode,
        address_line,
        contact_number,
        display_name,
        district_display,
      };
    });

  // ======== Row actions (declare BEFORE myColumns to avoid TS2448/TS2454) ========
  const closeActionMenu = useCallback(() => {
    setActionMenuAnchor(null);
    setActionMenuRow(null);
  }, []);

  const updateLocalRowsStatus = useCallback((ids: string[], status: "Y" | "N") => {
    if (!ids.length) return;
    const targetSet = new Set(ids);
    setMyRows((prev) =>
      prev.map((row) => {
        const rowId = String(row?._id || "");
        if (!rowId || !targetSet.has(rowId)) return row;

        // ✅ Keep in list, update flags so UI shows "Inactive"
        return { ...row, is_active: status, org_mandi_is_active: status };
      }),
    );
  }, []);

  const handleRowToggleStatus = useCallback(
    async (row: MandiLite) => {
      if (!row?._id) return;
      const targetStatus = rowIsActive(row) ? "N" : "Y";
      setMyLoading(true);
      try {
        await updateOrgMandiStatus({
          username,
          language: DEFAULT_LANGUAGE,
          mapping_id: String(row._id),
          is_active: targetStatus,
        });

        // ✅ Do NOT remove row. Just update local status.
        updateLocalRowsStatus([String(row._id)], targetStatus);

        enqueueSnackbar(
          targetStatus === "Y"
            ? "Mandi activated for this organisation."
            : "Mandi deactivated for this organisation.",
          { variant: "success" },
        );
      } catch (err: any) {
        enqueueSnackbar(err?.message || "Status update failed", { variant: "error" });
      } finally {
        setMyLoading(false);
      }
    },
    [enqueueSnackbar, rowIsActive, updateLocalRowsStatus, username],
  );

  const openActionMenu = useCallback((event: React.MouseEvent<HTMLElement>, row: MandiLite) => {
    event.stopPropagation();
    setActionMenuAnchor(event.currentTarget);
    setActionMenuRow(row);
  }, []);

  const openCorrection = useCallback((row: MandiLite) => {
    if (!isSuper || !row?.imported_from_system) return;
    setCorrectionRow(row);
    setCorrectionName(String(row?.name_i18n?.en || row?.display_name || ""));
    setCorrectionState(String(row?.state_code || ""));
    setCorrectionDistrict(String(row?.district_name || row?.district_name_en || row?.district_display || ""));
    setCorrectionPincode(String(row?.pincode || ""));
    setCorrectionAddress(String(row?.address_line || ""));
    setCorrectionContact(String(row?.contact_number || ""));
    setCorrectionReason("");
  }, [isSuper]);

  const handleActionMenuEdit = useCallback(() => {
    if (actionMenuRow && isSuper && actionMenuRow.imported_from_system) openCorrection(actionMenuRow);
    closeActionMenu();
  }, [actionMenuRow, closeActionMenu, isSuper, openCorrection]);

  const submitCorrection = useCallback(async () => {
    if (!correctionRow || !username || !isSuper) return;
    const reason = correctionReason.trim();
    if (reason.length < 10) {
      enqueueSnackbar("Please enter a correction reason of at least 10 characters.", { variant: "error" });
      return;
    }
    const masterMandiId = toPositiveMandiId(correctionRow.source_system_mandi_id ?? correctionRow.mandi_id);
    if (!masterMandiId) {
      enqueueSnackbar("Unable to resolve the protected master Mandi ID. Refresh the list and try again.", { variant: "error" });
      return;
    }
    const stepupOk = await ensureStepUp("mandis.master_correction", "UPDATE", { source: "OTHER", force: true });
    if (!stepupOk) return;
    setCorrectionSubmitting(true);
    try {
      const response = await correctProtectedMandi({
        username,
        language: DEFAULT_LANGUAGE,
        payload: {
          mandi_id: masterMandiId,
          name_i18n: { ...(correctionRow.name_i18n || {}), en: correctionName.trim() },
          state_code: correctionState.trim().toUpperCase(),
          district_name: correctionDistrict.trim(),
          pincode: correctionPincode.trim(),
          address_line: correctionAddress.trim(),
          contact_number: correctionContact.trim(),
          correction_reason: reason,
        },
      });
      if (String(response?.response?.responsecode ?? "1") !== "0") {
        throw new Error(response?.response?.description || "Master-data correction failed.");
      }
      enqueueSnackbar("Protected Mandi master data corrected and imported copies synchronized.", { variant: "success" });
      setCorrectionRow(null);
      setMyRefreshKey((value) => value + 1);
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Master-data correction failed.", { variant: "error" });
    } finally {
      setCorrectionSubmitting(false);
    }
  }, [correctionAddress, correctionContact, correctionDistrict, correctionName, correctionPincode, correctionReason, correctionRow, correctionState, enqueueSnackbar, ensureStepUp, isSuper, username]);

  const openCorrectionHistory = useCallback(async (row: MandiLite) => {
    if (!isSuper || !row?.imported_from_system || !username) return;
    setHistoryRow(row);
    setHistoryItems([]);
    setHistoryLoading(true);
    try {
      const response = await fetchProtectedMandiCorrectionHistory({
        username,
        language: DEFAULT_LANGUAGE,
        mandi_id: toPositiveMandiId(row.source_system_mandi_id ?? row.mandi_id) || 0,
        page: 1,
        page_size: 25,
      });
      const responseMeta = response?.response ?? response;
      if (String(responseMeta?.responsecode ?? "0") !== "0") {
        throw new Error(responseMeta?.description || "Unable to load correction history.");
      }
      const payload = response?.response?.data ?? response?.data ?? response;
      setHistoryItems(Array.isArray(payload?.history) ? payload.history : []);
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Unable to load correction history.", { variant: "error" });
    } finally {
      setHistoryLoading(false);
    }
  }, [enqueueSnackbar, isSuper, username]);

  const handleActionMenuHistory = useCallback(() => {
    const row = actionMenuRow;
    closeActionMenu();
    if (row) void openCorrectionHistory(row);
  }, [actionMenuRow, closeActionMenu, openCorrectionHistory]);

  const handleActionMenuToggle = useCallback(() => {
    if (!actionMenuRow) {
      closeActionMenu();
      return;
    }
    if (!canRemove) {
      closeActionMenu();
      return;
    }
    closeActionMenu();
    handleRowToggleStatus(actionMenuRow);
  }, [actionMenuRow, canRemove, closeActionMenu, handleRowToggleStatus]);

  // ======== Columns ========
  const myColumns: GridColDef<MandiLite>[] = useMemo(
    () => [
      { field: "display_name", headerName: "Name", flex: 1, minWidth: 200 },
      { field: "state_code", headerName: "State", width: 110, hide: isSmDown },
      {
        field: "status",
        headerName: "Status",
        width: 140,
        renderCell: (params) => {
          const activeFlag = rowIsActive(params.row as MandiLite);
          return (
            <Chip
              label={activeFlag ? "Active" : "Inactive"}
              size="small"
              color={activeFlag ? "success" : "default"}
              variant="outlined"
            />
          );
        },
      },
      { field: "district_display", headerName: "District", flex: 1, minWidth: 160, hide: isSmDown },
      { field: "pincode", headerName: "Pincode", width: 120, hide: isSmDown },
      { field: "mandi_id", headerName: "ID", width: 110, hide: isMdDown },
      {
        field: "actions",
        headerName: "",
        width: isSmDown ? 64 : 110,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: (params) => {
          const row = params.row as MandiLite;
          const active = rowIsActive(row);
          const icon = active ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />;
          const label = active ? "Deactivate" : "Activate";

          // ✅ Mobile: 3-dot menu only
          if (isSmDown) {
            return (
              <IconButton
                size="small"
                onClick={(event) => openActionMenu(event, row)}
                aria-label="More actions"
                disabled={!canRemove && !canCreate}
              >
                <MoreVertIcon fontSize="small" />
              </IconButton>
            );
          }

          // ✅ Desktop: icons only
          return (
            <Stack direction="row" spacing={0.5}>
              {isSuper && row.imported_from_system ? (
                <Tooltip title="Correct protected master data">
                  <span>
                    <IconButton size="small" onClick={() => openCorrection(row)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </span>
                </Tooltip>
              ) : null}

              <Tooltip title={label}>
                <span>
                  <IconButton
                    size="small"
                    color={active ? "error" : "primary"}
                    onClick={() => handleRowToggleStatus(row)}
                    disabled={!canRemove}
                  >
                    {icon}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
    ],
    [canCreate, canRemove, handleRowToggleStatus, isMdDown, isSmDown, isSuper, openActionMenu, openCorrection, rowIsActive],
  );

  const impColumns: GridColDef[] = [
    { field: "display_name", headerName: "Name", flex: 1, minWidth: 180 },
    { field: "state_code", headerName: "State", width: 110 },
    { field: "district_display", headerName: "District", flex: 1, minWidth: 160 },
    { field: "pincode", headerName: "Pincode", width: 110 },
    { field: "mandi_id", headerName: "ID", width: 90 },
    { field: "address_line", headerName: "Address", flex: 2, minWidth: 220 },
    { field: "contact_number", headerName: "Contact", width: 150 },
  ];

  useEffect(() => {
    if (!isSuper) return;
    setSelectedSuperOrgId(requestedOrgId || "");
  }, [isSuper, requestedOrgId]);

  useEffect(() => {
    if (!isSuper || !username) return;

    let cancelled = false;
    const loadOrganisations = async () => {
      setOrganisationsLoading(true);
      try {
        const raw = await fetchOrganisations({ username, language: DEFAULT_LANGUAGE });
        if (cancelled) return;
        const response = raw?.response ?? raw?.data?.response ?? raw;
        const code = String(response?.responsecode ?? "");
        if (code && code !== "0") {
          throw new Error(response?.description || "Failed to load organisations");
        }
        const organisations = response?.data?.organisations ?? raw?.data?.organisations ?? [];
        const options: OrganisationOption[] = (Array.isArray(organisations) ? organisations : [])
          .filter((org: any) => org?._id && org?.org_code)
          .map((org: any) => ({
            value: String(org._id),
            label: String(org.org_name || org.org_code),
            orgCode: String(org.org_code),
          }));
        setOrganisationOptions(options);
      } catch (err: any) {
        if (!cancelled) {
          setOrganisationOptions([]);
          enqueueSnackbar(err?.message || "Failed to load organisations", { variant: "error" });
        }
      } finally {
        if (!cancelled) setOrganisationsLoading(false);
      }
    };

    void loadOrganisations();
    return () => {
      cancelled = true;
    };
  }, [enqueueSnackbar, isSuper, username]);

  useEffect(() => {
    if (!isSuper) return;
    setMyPage(1);
    setImpPage(1);
    setMySelectionModel([]);
    setImpSelectionModel([]);
  }, [isSuper, selectedSuperOrgId]);

  // ======== Debounce search ========
  useEffect(() => {
    const h = setTimeout(() => setMyDebounced(mySearch), 500);
    return () => clearTimeout(h);
  }, [mySearch]);

  useEffect(() => {
    const h = setTimeout(() => setImpDebounced(impSearch), 500);
    return () => clearTimeout(h);
  }, [impSearch]);

  // ======== Fetchers ========
  const fetchMyMandis = useCallback(async () => {
    if (!orgId) return;
    if (myReqRef.current) myReqRef.current.abort();
    const controller = new AbortController();
    myReqRef.current = controller;

    setMyLoading(true);
    try {
      const rawResp = await fetchOrgMandisLite({
        username,
        language: DEFAULT_LANGUAGE,
        org_id: orgId,
        filters: {
          state_code: myState || undefined,
          q: myDebounced || undefined,
          page: myPage,
          pageSize: myPageSize,
          include_inactive: true, // ✅ always include inactive so it doesn't "look deleted"
        },
      });

      if (controller.signal.aborted) return;

      const { responseMeta, items, total } = normalizeList(rawResp);

      if (responseMeta?.responsecode && responseMeta.responsecode !== "0") {
        enqueueSnackbar(responseMeta?.description || "Failed to load mandis", { variant: "error" });
        setMyRows([]);
        setMyTotal(0);
        return;
      }

      setMyRows(prepareRows(items) as MandiLite[]);
      setMyTotal(total);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      enqueueSnackbar(err?.message || "Failed to load mandis", { variant: "error" });
      setMyRows([]);
      setMyTotal(0);
    } finally {
      if (!controller.signal.aborted) setMyLoading(false);
    }
  }, [orgId, myState, myDebounced, myPage, myPageSize, username, enqueueSnackbar]);

  const fetchSystemMandis = useCallback(async () => {
    if (!impState) return;
    if (impReqRef.current) impReqRef.current.abort();
    const controller = new AbortController();
    impReqRef.current = controller;

    setImpLoading(true);
    try {
      const rawResp = await fetchSystemMandisByState({
        username,
        language: DEFAULT_LANGUAGE,
        state_code: impState,
        filters: {
          q: impDebounced || undefined,
          page: impPage,
          pageSize: impPageSize,
        },
      });

      if (controller.signal.aborted) return;

      const { responseMeta, items, total } = normalizeList(rawResp);

      if (responseMeta?.responsecode && responseMeta.responsecode !== "0") {
        enqueueSnackbar(responseMeta?.description || "Failed to load system mandis", { variant: "error" });
        setImpRows([]);
        setImpTotal(0);
        return;
      }

      setImpRows(prepareRows(items) as MandiLite[]);
      setImpTotal(total);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      enqueueSnackbar(err?.message || "Failed to load system mandis", { variant: "error" });
      setImpRows([]);
      setImpTotal(0);
    } finally {
      if (!controller.signal.aborted) setImpLoading(false);
    }
  }, [impState, impPage, impPageSize, impDebounced, username, enqueueSnackbar]);

  // ======== Effects ========
  useEffect(() => {
    if (activeTab === "MY") fetchMyMandis();
  }, [myDebounced, myState, myPage, myPageSize, fetchMyMandis, activeTab, myRefreshKey]);

  useEffect(() => {
    if (activeTab === "IMPORT" && impState) fetchSystemMandis();
  }, [impDebounced, impState, impPage, impPageSize, fetchSystemMandis, activeTab]);

  const resetMy = () => {
    setMyPage(1);
    setMySelectionModel([]);
    setMyRefreshKey((prev) => prev + 1);
  };

  const resetImport = () => {
    setImpSelectionModel([]);
    setImpPage(1);
  };

  // ======== Bulk status update ========
  const [deactivateConfirmOpen, setDeactivateConfirmOpen] = useState(false);

  const performStatusUpdate = async (rows: MandiLite[], targetStatus: "Y" | "N", successMessage: string) => {
    if (!orgId) {
      enqueueSnackbar("Organisation not found", { variant: "error" });
      return;
    }
    const ids = rows
      .map((row) => String(row?._id || ""))
      .filter((id) => Boolean(id));

    if (!ids.length) return;

    setMyLoading(true);
    try {
      await Promise.all(
        ids.map((mapping_id) =>
          updateOrgMandiStatus({
            username,
            language: DEFAULT_LANGUAGE,
            mapping_id,
            is_active: targetStatus,
          }),
        ),
      );

      // ✅ Keep rows visible, update status
      updateLocalRowsStatus(ids, targetStatus);

      setMySelectionModel([]);
      enqueueSnackbar(successMessage, { variant: "success" });
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Status update failed", { variant: "error" });
    } finally {
      setMyLoading(false);
    }
  };

  const handleRemoveSelected = () => {
    if (!canRemove || !activeSelectedRows.length) return;
    setDeactivateConfirmOpen(true);
  };

  const handleActivateSelected = async () => {
    if (!canRemove || !inactiveSelectedRows.length) return;
    await performStatusUpdate(inactiveSelectedRows, "Y", "Mandi activated successfully.");
  };

  const confirmDeactivate = async () => {
    setDeactivateConfirmOpen(false);
    await performStatusUpdate(activeSelectedRows, "N", "Mandi deactivated for this organisation.");
  };

  const cancelDeactivate = () => setDeactivateConfirmOpen(false);

  // ======== Pincode lookup ========
  const isPincodeValid = (value: string) => /^\d{6}$/.test(value.trim());

  const clearPendingPincodeLookup = () => {
    if (pincodeDebounceRef.current) {
      clearTimeout(pincodeDebounceRef.current);
      pincodeDebounceRef.current = null;
    }
    pendingPincodeRef.current = "";
  };

  const resetCreateForm = () => {
    setCreateForm(INITIAL_CREATE_FORM);
    setPincodeLookup(INITIAL_PINCODE_LOOKUP);
    setPincodeStatus("idle");
    setPincodeError("");
    clearPendingPincodeLookup();
  };

  const handleCloseCreateModal = () => {
    setCreateModalOpen(false);
    resetCreateForm();
  };

  const lookupPincode = useCallback(async (pin: string) => {
    try {
      const resp = await fetchStatesDistrictsByPincode({
        username,
        language: DEFAULT_LANGUAGE,
        pincode: pin,
      });

      if (pendingPincodeRef.current !== pin) return;

      const body = resp ?? {};
      const responseMeta = body?.response ?? body;

      if (responseMeta?.responsecode && responseMeta.responsecode !== "0") {
        throw new Error(responseMeta?.description || "Unable to resolve pincode");
      }

      const payload = body?.response?.data ?? body?.data ?? body;
      const district = payload?.district_name || payload?.district;
      const state = payload?.state_name || payload?.state;

      if (!district || !state) throw new Error("Unable to resolve pincode");

      const toNumber = (value: any) => {
        if (value === null || value === undefined) return null;
        const num = Number(value);
        return Number.isFinite(num) ? num : null;
      };

      const latitude = toNumber(payload?.latitude ?? payload?.lat ?? payload?.location?.coordinates?.[1]) || null;
      const longitude = toNumber(payload?.longitude ?? payload?.lon ?? payload?.location?.coordinates?.[0]) || null;

      setPincodeLookup({
        district_name: district,
        state_name: state,
        district_id: payload?.district_id || null,
        state_code: payload?.state_code || null,
        latitude,
        longitude,
      });
      setPincodeStatus("success");
      setPincodeError("");
    } catch (err: any) {
      if (pendingPincodeRef.current !== pin) return;
      setPincodeLookup(INITIAL_PINCODE_LOOKUP);
      setPincodeStatus("error");
      setPincodeError(err?.message || "Invalid pincode");
    }
  }, [username]);

  useEffect(() => {
    clearPendingPincodeLookup();
    const trimmed = createForm.pincode.trim();

    if (!trimmed) {
      setPincodeStatus("idle");
      setPincodeError("");
      setPincodeLookup(INITIAL_PINCODE_LOOKUP);
      return;
    }

    if (!isPincodeValid(trimmed)) {
      setPincodeStatus("error");
      setPincodeError("Enter a 6-digit pincode");
      setPincodeLookup(INITIAL_PINCODE_LOOKUP);
      return;
    }

    setPincodeStatus("loading");
    setPincodeError("");
    pendingPincodeRef.current = trimmed;

    pincodeDebounceRef.current = setTimeout(() => {
      lookupPincode(trimmed);
    }, 450);

    return () => {
      clearPendingPincodeLookup();
    };
  }, [createForm.pincode, lookupPincode]);

  // ======== Import ========
  const handleImport = async () => {
    if (!orgId) {
      enqueueSnackbar("Organisation not found", { variant: "error" });
      return;
    }
    if (selectedImportMandiIds.length === 0) return;

    const mandiIds = selectedImportMandiIds.slice(0, 25);

    try {
      const resp = await importSystemMandisToOrg({
        username,
        language: DEFAULT_LANGUAGE,
        org_id: orgId,
        mandi_ids: mandiIds,
      });

      const { imported, skipped_existing, skipped_invalid } = normalizeImportResponse(resp);

      enqueueSnackbar(`Imported ${imported}, skipped ${skipped_existing}, invalid ${skipped_invalid}`, { variant: "success" });

      setActiveTab("MY");
      resetMy();
      setImpSelectionModel([]);
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Import failed", { variant: "error" });
    }
  };

  // ======== Create custom mandi ========
  const handleCreateCustomMandi = async () => {
    if (!canCreate) return;

    if (!authContext.org_code) {
      enqueueSnackbar("Organisation not found", { variant: "error" });
      return;
    }
    if (!createForm.name.trim() || !createForm.address.trim()) return;
    if (pincodeStatus !== "success") return;

    setCreateSubmitting(true);
    try {
      const location =
        pincodeLookup.latitude !== null && pincodeLookup.longitude !== null
          ? { type: "Point", coordinates: [pincodeLookup.longitude, pincodeLookup.latitude] }
          : null;

      await createMandi({
        username,
        language: DEFAULT_LANGUAGE,
        payload: {
          org_code: String(authContext.org_code),
          name_i18n: { en: createForm.name.trim() },
          pincode: createForm.pincode.trim(),
          address_line: createForm.address.trim(),
          contact_number: createForm.contact.trim() || null,
          district_name: pincodeLookup.district_name ?? undefined,
          state_name: pincodeLookup.state_name ?? undefined,
          state_code: pincodeLookup.state_code ?? undefined,
          district_id: pincodeLookup.district_id ?? undefined,
          location: location || undefined,
          country: "IN",
        },
      });

      enqueueSnackbar("Custom mandi created", { variant: "success" });
      resetCreateForm();
      setCreateModalOpen(false);
      setActiveTab("MY");
      resetMy();
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Unable to create mandi", { variant: "error" });
    } finally {
      setCreateSubmitting(false);
    }
  };

  const canSubmitCreate =
    canCreate &&
    Boolean(createForm.name.trim()) &&
    Boolean(createForm.address.trim()) &&
    pincodeStatus === "success" &&
    Boolean(pincodeLookup.district_name) &&
    Boolean(pincodeLookup.state_name);

  // ======== Render: My Mandis ========
  const renderMyMandis = () => {
    const addTooltip = !canCreate ? "No permission to add mandi" : "";

    return (
      <Stack spacing={2}>
        {/* Toolbar */}
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          alignItems={{ xs: "stretch", sm: "center" }}
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            bgcolor: "background.paper",
            borderBottom: 1,
            borderColor: "divider",
            py: 1,
            gap: 1,
          }}
        >
          <Box sx={{ width: { xs: "100%", sm: 220 }, flex: "0 0 auto" }}>
            <Typography component="label" htmlFor="mandis-my-state" variant="caption" sx={{ display: "block", mb: 0.5, fontWeight: 600 }}>
              State
            </Typography>
            <MandisBoxedDropdown
              id="mandis-my-state"
              value={myState}
              onChange={(value) => {
                setMyState(String(value || ""));
                setMyPage(1);
              }}
              options={[
                { value: "", label: "All States" },
                ...STATE_OPTIONS.map((code) => ({ value: code, label: STATE_NAME_MAP[code] || code })),
              ]}
            />
          </Box>

          <Box sx={{ width: { xs: "100%", sm: 320 }, flex: "0 0 auto" }}>
            <Typography component="label" htmlFor="mandis-my-search" variant="caption" sx={{ display: "block", mb: 0.5, fontWeight: 600 }}>
              Search
            </Typography>
            <AntInput
              id="mandis-my-search"
              value={mySearch}
              prefix={<AntSearchOutlined />}
              placeholder="Search mandi"
              onChange={(e) => {
                setMySearch(e.target.value);
                setMyPage(1);
              }}
              style={{ width: "100%" }}
              allowClear
            />
          </Box>

          <Box sx={{ width: { xs: "100%", sm: 120 }, flex: "0 0 auto" }}>
            <Typography component="label" htmlFor="mandis-my-page-size" variant="caption" sx={{ display: "block", mb: 0.5, fontWeight: 600 }}>
              Page Size
            </Typography>
            <MandisBoxedDropdown
              id="mandis-my-page-size"
              value={myPageSize}
              onChange={(value) => {
                setMyPageSize(Number(value));
                setMyPage(1);
              }}
              options={PAGE_SIZES.map((size) => ({ value: size, label: String(size) }))}
            />
          </Box>

          {/* Actions align to the same 40px control baseline as State/Search/Page Size. */}
          <Stack
            direction="row"
            spacing={0.75}
            alignItems="center"
            sx={{
              ml: { sm: "auto" },
              alignSelf: { xs: "stretch", sm: "flex-end" },
              height: 40,
            }}
          >
            <Tooltip title="Refresh" arrow>
              <span>
                <AntButton
                  aria-label="Refresh"
                  icon={<ReloadOutlined />}
                  onClick={resetMy}
                  style={{ width: 40, height: 40, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                />
              </span>
            </Tooltip>

            <Tooltip
              title={
                !canRemove
                  ? "No permission"
                  : activeSelectedRows.length
                    ? "Deactivate selected"
                    : "Select an active mandi to deactivate"
              }
              arrow
            >
              <span>
                <AntButton
                  danger
                  aria-label="Deactivate selected"
                  icon={<StopOutlined />}
                  disabled={!canRemove || activeSelectedRows.length === 0}
                  onClick={handleRemoveSelected}
                  style={{ width: 40, height: 40, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                />
              </span>
            </Tooltip>

            <Tooltip
              title={
                !canRemove
                  ? "No permission"
                  : inactiveSelectedRows.length
                    ? "Activate selected"
                    : "Select an inactive mandi to activate"
              }
              arrow
            >
              <span>
                <AntButton
                  aria-label="Activate selected"
                  icon={<CheckCircleOutlined />}
                  disabled={!canRemove || inactiveSelectedRows.length === 0}
                  onClick={handleActivateSelected}
                  style={{ width: 40, height: 40, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                />
              </span>
            </Tooltip>

            <Tooltip title={addTooltip || "Add custom mandi"} arrow>
              <span>
                <AntButton
                  type="primary"
                  aria-label="Add custom mandi"
                  icon={<PlusOutlined />}
                  disabled={!canCreate}
                  onClick={() => canCreate && setCreateModalOpen(true)}
                  style={{ width: 40, height: 40, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                />
              </span>
            </Tooltip>
          </Stack>
        </Stack>

        <Card>
          <CardContent>
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <ResponsiveDataGrid
                autoHeight
                getRowId={getMyRowId}
                rows={myRows}
                columns={myColumns}
                loading={myLoading}
                paginationMode="server"
                rowCount={myTotal}
                pageSizeOptions={PAGE_SIZES}
                paginationModel={{ page: myPage - 1, pageSize: myPageSize }}
                onPaginationModelChange={(m) => {
                  setMyPage(m.page + 1);
                  setMyPageSize(m.pageSize);
                }}
                checkboxSelection
                disableRowSelectionOnClick
                rowSelectionModel={mySelectionModel}
                onRowSelectionModelChange={(model) => {
                  const next = Array.isArray(model) ? model : [];
                  setMySelectionModel(next);
                }}
                sx={{
                  minWidth: isSmDown ? 600 : 840,
                  // Keep DataGrid selection controls readable. The global theme styles
                  // native inputs, so explicitly size/reset the MUI checkbox internals
                  // for both header and row selectors on this screen.
                  "& .MuiDataGrid-cellCheckbox .MuiCheckbox-root, & .MuiDataGrid-columnHeaderCheckbox .MuiCheckbox-root": {
                    width: 36,
                    height: 36,
                    minWidth: 36,
                    minHeight: 36,
                    padding: "6px !important",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  },
                  "& .MuiDataGrid-cellCheckbox .MuiCheckbox-root .MuiSvgIcon-root, & .MuiDataGrid-columnHeaderCheckbox .MuiCheckbox-root .MuiSvgIcon-root": {
                    width: 22,
                    height: 22,
                    fontSize: "22px !important",
                  },
                  "& .MuiDataGrid-cellCheckbox .MuiCheckbox-root input[type='checkbox'], & .MuiDataGrid-columnHeaderCheckbox .MuiCheckbox-root input[type='checkbox']": {
                    minHeight: "0 !important",
                    border: "0 !important",
                    borderRadius: "0 !important",
                    background: "transparent !important",
                    boxShadow: "none !important",
                    padding: "0 !important",
                  },
                }}
              />
            </Box>
          </CardContent>
        </Card>

        <Menu
          anchorEl={actionMenuAnchor}
          open={Boolean(actionMenuAnchor)}
          onClose={closeActionMenu}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          {isSuper && actionMenuRow?.imported_from_system ? (
            <>
              <MenuItem onClick={handleActionMenuEdit}>Correct Master Data</MenuItem>
              <MenuItem onClick={handleActionMenuHistory}>Correction History</MenuItem>
            </>
          ) : null}
          <MenuItem onClick={handleActionMenuToggle} disabled={!canRemove}>
            {actionMenuRow && rowIsActive(actionMenuRow) ? "Deactivate" : "Activate"}
          </MenuItem>
        </Menu>
      </Stack>
    );
  };

  // ======== Render: Import Mandis ========
  const renderImportMandis = () => {
    return (
      <Box sx={{ height: "72vh", display: "flex", flexDirection: "column", width: "100%" }}>
        <Box
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            bgcolor: "background.paper",
            borderBottom: "1px solid",
            borderColor: "divider",
            px: 1,
            py: 1,
          }}
        >
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
            <Box sx={{ width: { xs: "100%", sm: 240 }, flex: "0 0 auto" }}>
              <Typography component="label" htmlFor="mandis-import-state" variant="caption" sx={{ display: "block", mb: 0.5, fontWeight: 600 }}>
                State
              </Typography>
              <MandisBoxedDropdown
                id="mandis-import-state"
                value={impState}
                onChange={(value) => {
                  setImpState(String(value || ""));
                  setImpPage(1);
                  setImpSelectionModel([]);
                }}
                options={[
                  { value: "", label: "Select state" },
                  ...STATE_OPTIONS.map((code) => ({ value: code, label: STATE_NAME_MAP?.[code] || code })),
                ]}
              />
            </Box>

            <Box sx={{ width: { xs: "100%", sm: 320 }, flex: "0 0 auto" }}>
              <Typography component="label" htmlFor="mandis-import-search" variant="caption" sx={{ display: "block", mb: 0.5, fontWeight: 600 }}>
                Search
              </Typography>
              <AntInput
                id="mandis-import-search"
                value={impSearch}
                prefix={<AntSearchOutlined />}
                placeholder="Search system mandi"
                onChange={(e) => {
                  setImpSearch(e.target.value);
                  setImpPage(1);
                }}
                disabled={!impState}
                style={{ width: "100%" }}
                allowClear
              />
            </Box>

            <Box sx={{ width: { xs: "100%", sm: 120 }, flex: "0 0 auto" }}>
              <Typography component="label" htmlFor="mandis-import-page-size" variant="caption" sx={{ display: "block", mb: 0.5, fontWeight: 600 }}>
                Page Size
              </Typography>
              <MandisBoxedDropdown
                id="mandis-import-page-size"
                value={impPageSize}
                onChange={(value) => {
                  setImpPageSize(Number(value));
                  setImpPage(1);
                }}
                options={PAGE_SIZES.map((size) => ({ value: size, label: String(size) }))}
                disabled={!impState}
              />
            </Box>

            <Box sx={{ width: { xs: "100%", sm: "auto" }, alignSelf: { sm: "flex-end" } }}>
              <AntButton
                icon={<ReloadOutlined />}
                onClick={() => {
                  if (impState) fetchSystemMandis();
                }}
                disabled={!impState}
                block={isSmDown}
                style={{ height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
              >
                Refresh
              </AntButton>
            </Box>

            <Box sx={{ width: { xs: "100%", sm: "auto" }, alignSelf: { sm: "flex-end" } }}>
              <Tooltip title={!canImport ? "No permission" : ""} arrow>
                <span style={{ display: "block" }}>
                  <AntButton
                    type="primary"
                    disabled={!canImport || !impState || selectedImportMandiIds.length === 0}
                    onClick={handleImport}
                    block={isSmDown}
                    style={{ height: 40, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                  >
                    Import Selected
                  </AntButton>
                </span>
              </Tooltip>
            </Box>

            <Typography
              variant="body2"
              sx={{
                opacity: 0.72,
                alignSelf: { xs: "stretch", sm: "flex-end" },
                minHeight: 40,
                display: "flex",
                alignItems: "center",
                whiteSpace: "nowrap",
                px: { xs: 0, sm: 0.5 },
              }}
            >
              Selected: {selectedImportMandiIds.length} (max 25) • Total: {impTotal}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ flex: 1, minHeight: 0 }}>
          {!impState ? (
            <Box sx={{ p: 2 }}>
              <Typography variant="body2" color="text.secondary">
                Select a state to load system mandis.
              </Typography>
            </Box>
          ) : (
            <ResponsiveDataGrid
              rows={impRows}
              columns={impColumns}
              loading={impLoading}
              checkboxSelection
              disableRowSelectionOnClick
              getRowId={(row: any) => String(row?.mandi_id ?? row?._id ?? row?._rowId)}
              rowSelectionModel={impSelectionModel}
              onRowSelectionModelChange={(m) => {
                const next = Array.isArray(m) ? m : [];
                if (next.length > 25) {
                  enqueueSnackbar("You can import 25 mandis at a time.", { variant: "warning" });
                  return;
                }
                setImpSelectionModel(next);
              }}
              paginationMode="server"
              rowCount={impTotal}
              pageSizeOptions={PAGE_SIZES}
              paginationModel={{ page: impPage - 1, pageSize: impPageSize }}
              onPaginationModelChange={(m) => {
                setImpPage(m.page + 1);
                setImpPageSize(m.pageSize);
              }}
              sx={{
                height: "100%",
                "& .MuiDataGrid-cellCheckbox .MuiCheckbox-root, & .MuiDataGrid-columnHeaderCheckbox .MuiCheckbox-root": {
                  width: 36,
                  height: 36,
                  minWidth: 36,
                  minHeight: 36,
                  padding: "6px !important",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                },
                "& .MuiDataGrid-cellCheckbox .MuiCheckbox-root .MuiSvgIcon-root, & .MuiDataGrid-columnHeaderCheckbox .MuiCheckbox-root .MuiSvgIcon-root": {
                  width: 22,
                  height: 22,
                  fontSize: "22px !important",
                },
                "& .MuiDataGrid-cellCheckbox .MuiCheckbox-root input[type='checkbox'], & .MuiDataGrid-columnHeaderCheckbox .MuiCheckbox-root input[type='checkbox']": {
                  minHeight: "0 !important",
                  border: "0 !important",
                  borderRadius: "0 !important",
                  background: "transparent !important",
                  boxShadow: "none !important",
                  padding: "0 !important",
                },
                "& .MuiDataGrid-columnHeaders": {
                  position: "sticky",
                  top: 0,
                  zIndex: 10,
                  backgroundColor: "background.paper",
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  boxShadow: 1,
                },
                "& .MuiDataGrid-virtualScroller": { overflowY: "auto" },
              }}
            />
          )}
        </Box>
      </Box>
    );
  };

  // ======== Dialogs ========
  const renderCreateDialog = () => (
    <Dialog open={createModalOpen} onClose={handleCloseCreateModal} fullWidth maxWidth="sm">
      <DialogTitle>Add Custom Mandi</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <CmInput
            label="Mandi name (English)"
            value={createForm.name}
            onChange={(value) => setCreateForm((prev) => ({ ...prev, name: value }))}
            required
          />

          <CmInput
            label="Pincode"
            value={createForm.pincode}
            onChange={(value) => setCreateForm((prev) => ({ ...prev, pincode: value }))}
            required
            maxLength={6}
            inputMode="numeric"
            help={pincodeError || (pincodeStatus === "loading" ? "Looking up pincode…" : "Enter a 6-digit pincode")}
            error={Boolean(pincodeError) && pincodeStatus === "error"}
          />

          <div className="cm-form-grid cm-form-grid-2">
            <CmReadOnlyField label="State" value={pincodeLookup.state_name} />
            <CmReadOnlyField label="District" value={pincodeLookup.district_name} />
          </div>

          <CmInput
            label="Address line"
            value={createForm.address}
            onChange={(value) => setCreateForm((prev) => ({ ...prev, address: value }))}
            required
            multiline
            rows={3}
          />

          <CmInput
            label="Contact number"
            value={createForm.contact}
            onChange={(value) => setCreateForm((prev) => ({ ...prev, contact: value }))}
          />

          <Stack direction="row" spacing={2}>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Latitude: {pincodeLookup.latitude ?? "-"}
            </Typography>
            <Typography variant="caption" sx={{ opacity: 0.7 }}>
              Longitude: {pincodeLookup.longitude ?? "-"}
            </Typography>
          </Stack>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleCloseCreateModal} disabled={createSubmitting}>
          Cancel
        </Button>
        <Button variant="contained" color="primary" disabled={!canSubmitCreate || createSubmitting} onClick={handleCreateCustomMandi}>
          {createSubmitting ? <CircularProgress size={18} color="inherit" /> : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );

  const renderDeactivateDialog = () => (
    <Dialog open={deactivateConfirmOpen} onClose={cancelDeactivate} aria-labelledby="deactivate-mandi-dialog-title">
      <DialogTitle id="deactivate-mandi-dialog-title">Deactivate Mandi</DialogTitle>
      <DialogContent>
        <DialogContentText>
          This will deactivate the mandi for this organisation. You can activate it again later if required.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={cancelDeactivate}>Cancel</Button>
        <Button variant="contained" color="error" onClick={confirmDeactivate}>
          Deactivate
        </Button>
      </DialogActions>
    </Dialog>
  );

  // ======== Page ========
  return (
    <>
      <PageContainer>
      {isSuper && selectedSuperOrgId && selectedOrgCode ? (
        <Box sx={{ mb: 1.5 }}>
          <Typography variant="body2" color="text.secondary">
            Organisation scope: <strong>{selectedOrgCode}</strong>
          </Typography>
        </Box>
      ) : null}

        <Box className="cm-mandis-page">
          <Stack spacing={2}>
          <Typography variant="h5">Mandis</Typography>

          {isSuper ? (
            <Box sx={{ width: { xs: "100%", sm: 360 }, maxWidth: "100%" }}>
              <Typography variant="caption" sx={{ display: "block", mb: 0.5, fontWeight: 600 }}>
                Organisation
              </Typography>
              <MandisBoxedDropdown
                id="mandis-organisation-filter"
                value={selectedSuperOrgId}
                disabled={organisationsLoading}
                options={[
                  { value: "", label: organisationsLoading ? "Loading organisations..." : "Select Organisation" },
                  ...organisationOptions.map((option) => ({ value: option.value, label: option.label })),
                ]}
                onChange={(value) => {
                  setSelectedSuperOrgId(String(value));
                  setMyState("");
                  setImpState("");
                }}
              />
            </Box>
          ) : null}

          <Tabs
            value={activeTab}
            onChange={(_, v) => {
              setActiveTab(v);
              if (v === "MY") {
                setMyPage(1);
              } else {
                resetImport();
              }
            }}
          >
            <Tab label="My Mandis" value="MY" />
            <Tab label="Import Mandis" value="IMPORT" />
          </Tabs>

          {activeTab === "MY" ? renderMyMandis() : renderImportMandis()}
          </Stack>
        </Box>

      <AntModal
        open={Boolean(correctionRow)}
        title="Correct Protected Mandi Master Data"
        width={720}
        style={{ top: 84, paddingBottom: 24 }}
        destroyOnClose
        maskClosable={!correctionSubmitting}
        closable={!correctionSubmitting}
        onCancel={() => !correctionSubmitting && setCorrectionRow(null)}
        footer={[
          <AntButton
            key="cancel"
            onClick={() => setCorrectionRow(null)}
            disabled={correctionSubmitting}
          >
            Cancel
          </AntButton>,
          <AntButton
            key="save"
            type="primary"
            onClick={submitCorrection}
            loading={correctionSubmitting}
            disabled={correctionSubmitting || correctionReason.trim().length < 10}
          >
            Save Correction
          </AntButton>,
        ]}
      >
        <div style={{ maxHeight: "calc(100vh - 220px)", overflowY: "auto", paddingRight: 4 }}>
        <AntAlert
          type="warning"
          showIcon
          message="Protected platform master data"
          description="Only SUPER_ADMIN can make verified corrections. Changes require step-up verification, are synchronized to imported organisation copies, and are permanently audited."
          style={{ marginBottom: 20 }}
        />

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <AntTypography.Text strong>Mandi name</AntTypography.Text>
            <AntInput
              value={correctionName}
              onChange={(e) => setCorrectionName(e.target.value)}
              style={{ marginTop: 6, height: 40 }}
            />
          </div>

          <AntRow gutter={[16, 16]}>
            <AntCol xs={24} sm={12}>
              <AntTypography.Text strong>State code</AntTypography.Text>
              <AntInput
                value={correctionState}
                maxLength={3}
                onChange={(e) => setCorrectionState(e.target.value.toUpperCase())}
                style={{ marginTop: 6, height: 40 }}
              />
            </AntCol>
            <AntCol xs={24} sm={12}>
              <AntTypography.Text strong>District</AntTypography.Text>
              <AntInput
                value={correctionDistrict}
                onChange={(e) => setCorrectionDistrict(e.target.value)}
                style={{ marginTop: 6, height: 40 }}
              />
            </AntCol>
          </AntRow>

          <AntRow gutter={[16, 16]}>
            <AntCol xs={24} sm={12}>
              <AntTypography.Text strong>Pincode</AntTypography.Text>
              <AntInput
                value={correctionPincode}
                maxLength={6}
                inputMode="numeric"
                onChange={(e) => setCorrectionPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                style={{ marginTop: 6, height: 40 }}
              />
            </AntCol>
            <AntCol xs={24} sm={12}>
              <AntTypography.Text strong>Contact</AntTypography.Text>
              <AntInput
                value={correctionContact}
                maxLength={15}
                inputMode="tel"
                onChange={(e) => setCorrectionContact(e.target.value.replace(/\D/g, "").slice(0, 15))}
                style={{ marginTop: 6, height: 40 }}
              />
            </AntCol>
          </AntRow>

          <div>
            <AntTypography.Text strong>Address</AntTypography.Text>
            <AntInput.TextArea
              value={correctionAddress}
              onChange={(e) => setCorrectionAddress(e.target.value)}
              autoSize={{ minRows: 2, maxRows: 4 }}
              style={{ marginTop: 6 }}
            />
          </div>

          <div>
            <AntTypography.Text strong>Correction reason <span style={{ color: "#cf1322" }}>*</span></AntTypography.Text>
            <AntInput.TextArea
              value={correctionReason}
              maxLength={500}
              showCount
              onChange={(e) => setCorrectionReason(e.target.value.slice(0, 500))}
              autoSize={{ minRows: 3, maxRows: 6 }}
              status={correctionReason.length > 0 && correctionReason.trim().length < 10 ? "error" : undefined}
              style={{ marginTop: 6 }}
            />
            <AntTypography.Text type={correctionReason.length > 0 && correctionReason.trim().length < 10 ? "danger" : "secondary"}>
              Mandatory. Minimum 10 characters. This reason is stored in the audit history.
            </AntTypography.Text>
          </div>
        </div>
        </div>
      </AntModal>

      <AntModal
        open={Boolean(historyRow)}
        title="Protected Mandi Correction History"
        width={860}
        style={{ top: 84, paddingBottom: 24 }}
        destroyOnClose
        footer={[
          <AntButton key="close" onClick={() => setHistoryRow(null)}>Close</AntButton>,
        ]}
        onCancel={() => setHistoryRow(null)}
      >
        <div style={{ maxHeight: "calc(100vh - 190px)", overflowY: "auto", paddingRight: 4 }}>
          <AntAlert
            type="info"
            showIcon
            message={historyRow ? String(historyRow?.name_i18n?.en || historyRow?.display_name || "Protected Mandi") : "Protected Mandi"}
            description="Every protected master-data correction is retained here. The reason belongs to that specific correction and is not reused for future edits."
            style={{ marginBottom: 16 }}
          />

          {historyLoading ? (
            <div style={{ padding: "28px 0", textAlign: "center" }}>Loading correction history…</div>
          ) : historyItems.length === 0 ? (
            <AntTypography.Text type="secondary">No correction history is available for this Mandi yet.</AntTypography.Text>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {historyItems.map((item, index) => {
                const before = item?.before && typeof item.before === "object" ? item.before : {};
                const after = item?.after && typeof item.after === "object" ? item.after : {};
                const fields = Array.isArray(item?.changed_fields) ? item.changed_fields : [];
                return (
                  <div key={String(item?._id || index)} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: 14 }}>
                    <AntRow gutter={[12, 8]}>
                      <AntCol xs={24} md={8}>
                        <AntTypography.Text type="secondary">Changed on</AntTypography.Text><br />
                        <AntTypography.Text>{item?.changed_on ? new Date(item.changed_on).toLocaleString() : "—"}</AntTypography.Text>
                      </AntCol>
                      <AntCol xs={24} md={8}>
                        <AntTypography.Text type="secondary">Changed by</AntTypography.Text><br />
                        <AntTypography.Text>{item?.changed_by || "—"}</AntTypography.Text>
                      </AntCol>
                      <AntCol xs={24} md={8}>
                        <AntTypography.Text type="secondary">Status</AntTypography.Text><br />
                        <AntTypography.Text strong>{item?.status || "—"}</AntTypography.Text>
                      </AntCol>
                    </AntRow>

                    <div style={{ marginTop: 12 }}>
                      <AntTypography.Text type="secondary">Reason</AntTypography.Text><br />
                      <AntTypography.Text>{item?.reason || "—"}</AntTypography.Text>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <AntTypography.Text type="secondary">Fields changed</AntTypography.Text><br />
                      <AntTypography.Text>{fields.length ? fields.join(", ") : "—"}</AntTypography.Text>
                    </div>

                    {fields.length > 0 ? (
                      <div style={{ marginTop: 12, overflowX: "auto" }}>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                          <thead>
                            <tr>
                              <th style={{ textAlign: "left", padding: "7px 8px", borderBottom: "1px solid #e5e7eb" }}>Field</th>
                              <th style={{ textAlign: "left", padding: "7px 8px", borderBottom: "1px solid #e5e7eb" }}>Previous</th>
                              <th style={{ textAlign: "left", padding: "7px 8px", borderBottom: "1px solid #e5e7eb" }}>New</th>
                            </tr>
                          </thead>
                          <tbody>
                            {fields.map((field: string) => (
                              <tr key={field}>
                                <td style={{ padding: "7px 8px", verticalAlign: "top", borderBottom: "1px solid #f0f0f0" }}>{field}</td>
                                <td style={{ padding: "7px 8px", verticalAlign: "top", borderBottom: "1px solid #f0f0f0", wordBreak: "break-word" }}>{typeof before[field] === "object" ? JSON.stringify(before[field]) : String(before[field] ?? "—")}</td>
                                <td style={{ padding: "7px 8px", verticalAlign: "top", borderBottom: "1px solid #f0f0f0", wordBreak: "break-word" }}>{typeof after[field] === "object" ? JSON.stringify(after[field]) : String(after[field] ?? "—")}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </AntModal>
      </PageContainer>

      {renderCreateDialog()}
      {renderDeactivateDialog()}
    </>
  );
};
