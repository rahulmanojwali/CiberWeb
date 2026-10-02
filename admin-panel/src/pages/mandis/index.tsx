import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Dropdown,
  Empty,
  Grid,
  Input,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  CheckCircleOutlined,
  EditOutlined,
  EnvironmentOutlined,
  HistoryOutlined,
  MoreOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShopOutlined,
  StopOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useSnackbar } from "notistack";

import { PageContainer } from "../../components/PageContainer";
import { CmInput } from "../../design-system/components/CmInput";
import { CmReadOnlyField } from "../../design-system/components/CmReadOnlyField";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { CmStatCard } from "../../design-system/components/CmStatCard";
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
import { DEFAULT_LANGUAGE } from "../../config/appConfig";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { useStepUp } from "../../security/stepup/useStepUp";
import "./mandis.css";

type OrganisationOption = {
  value: string;
  label: string;
  orgCode: string;
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
  const screens = Grid.useBreakpoint();
  const isSmDown = !screens.sm;
  const isMdDown = !screens.md;

  // Action menu (row-level)
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

  const openActionMenu = useCallback((row: MandiLite) => {
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

  // ======== Ant Design table columns ========
  const myColumns: TableColumnsType<MandiLite> = useMemo(
    () => [
      {
        title: "Mandi",
        dataIndex: "display_name",
        key: "display_name",
        minWidth: 220,
        render: (_value, row) => (
          <div className="cm-mandis-name">
            <strong>{String(row.display_name || row.name_i18n?.en || "—")}</strong>
            <span>{row.mandi_slug || `Mandi ID ${row.mandi_id || "—"}`}</span>
          </div>
        ),
      },
      { title: "State", dataIndex: "state_code", key: "state_code", width: 100, responsive: ["sm"] },
      {
        title: "Status",
        key: "status",
        width: 120,
        render: (_value, row) => rowIsActive(row) ? <Tag color="success">Active</Tag> : <Tag>Inactive</Tag>,
      },
      { title: "District", dataIndex: "district_display", key: "district_display", minWidth: 150, responsive: ["md"] },
      { title: "Pincode", dataIndex: "pincode", key: "pincode", width: 105, responsive: ["md"] },
      { title: "ID", dataIndex: "mandi_id", key: "mandi_id", width: 95, responsive: ["lg"] },
      {
        title: "Actions",
        key: "actions",
        width: 120,
        align: "right",
        render: (_value, row) => {
          const active = rowIsActive(row);
          const menuItems = [
            ...(isSuper && row.imported_from_system
              ? [
                  { key: "correct", label: "Correct master data", icon: <EditOutlined /> },
                  { key: "history", label: "Correction history", icon: <HistoryOutlined /> },
                ]
              : []),
            {
              key: "toggle",
              label: active ? "Deactivate" : "Activate",
              icon: active ? <StopOutlined /> : <CheckCircleOutlined />,
              disabled: !canRemove,
              danger: active,
            },
          ];
          const onMenuClick = ({ key }: { key: string }) => {
            setActionMenuRow(row);
            if (key === "correct") openCorrection(row);
            if (key === "history") void openCorrectionHistory(row);
            if (key === "toggle" && canRemove) void handleRowToggleStatus(row);
          };
          if (isSmDown) {
            return (
              <Dropdown menu={{ items: menuItems, onClick: onMenuClick }} trigger={["click"]}>
                <Button type="text" icon={<MoreOutlined />} aria-label="Mandi actions" />
              </Dropdown>
            );
          }
          return (
            <div className="cm-mandis-row-actions">
              {isSuper && row.imported_from_system ? (
                <Tooltip title="Correct protected master data">
                  <Button type="text" icon={<EditOutlined />} onClick={() => openCorrection(row)} />
                </Tooltip>
              ) : null}
              <Tooltip title={active ? "Deactivate" : "Activate"}>
                <Button
                  type="text"
                  danger={active}
                  icon={active ? <StopOutlined /> : <CheckCircleOutlined />}
                  disabled={!canRemove}
                  onClick={() => void handleRowToggleStatus(row)}
                />
              </Tooltip>
            </div>
          );
        },
      },
    ],
    [canRemove, handleRowToggleStatus, isSmDown, isSuper, openCorrection, openCorrectionHistory, rowIsActive],
  );

  const impColumns: TableColumnsType<MandiLite> = [
    { title: "Mandi", dataIndex: "display_name", key: "display_name", minWidth: 200 },
    { title: "State", dataIndex: "state_code", key: "state_code", width: 90 },
    { title: "District", dataIndex: "district_display", key: "district_display", minWidth: 150 },
    { title: "Pincode", dataIndex: "pincode", key: "pincode", width: 105 },
    { title: "ID", dataIndex: "mandi_id", key: "mandi_id", width: 90 },
    { title: "Address", dataIndex: "address_line", key: "address_line", minWidth: 230, ellipsis: true },
    { title: "Contact", dataIndex: "contact_number", key: "contact_number", width: 140 },
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

    const targetOrgCode = isSuper ? selectedOrgCode : String(authContext.org_code || "");
    if (!targetOrgCode) {
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
          org_code: targetOrgCode,
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
    /^\d{10,15}$/.test(createForm.contact.trim()) &&
    pincodeStatus === "success" &&
    Boolean(pincodeLookup.district_name) &&
    Boolean(pincodeLookup.state_name);

  // ======== Render helpers ========
  const stateOptions = useMemo(
    () => [{ value: "", label: "All states" }, ...STATE_OPTIONS.map((code) => ({ value: code, label: STATE_NAME_MAP[code] || code }))],
    [],
  );

  const activeOnPage = useMemo(() => myRows.filter(rowIsActive).length, [myRows, rowIsActive]);
  const inactiveOnPage = Math.max(0, myRows.length - activeOnPage);

  const commonToolbar = (mode: "MY" | "IMPORT") => {
    const isMy = mode === "MY";
    const stateValue = isMy ? myState : impState;
    const searchValue = isMy ? mySearch : impSearch;
    const pageSizeValue = isMy ? myPageSize : impPageSize;
    const disabled = !isMy && !impState;
    return (
      <div className="cm-mandis-toolbar">
        <label className="cm-field">
          <span className="cm-field-label">State</span>
          <Select
            className="cm-mandis-select"
            value={stateValue}
            options={isMy ? stateOptions : [{ value: "", label: "Select state" }, ...stateOptions.slice(1)]}
            onChange={(value) => {
              if (isMy) {
                setMyState(String(value || ""));
                setMyPage(1);
              } else {
                setImpState(String(value || ""));
                setImpPage(1);
                setImpSelectionModel([]);
              }
            }}
          />
        </label>

        <label className="cm-field">
          <span className="cm-field-label">Search</span>
          <Input
            prefix={<SearchOutlined />}
            allowClear
            placeholder={isMy ? "Search by mandi, district or pincode" : "Search system mandi"}
            value={searchValue}
            disabled={disabled}
            onChange={(event) => {
              if (isMy) {
                setMySearch(event.target.value);
                setMyPage(1);
              } else {
                setImpSearch(event.target.value);
                setImpPage(1);
              }
            }}
          />
        </label>

        <label className="cm-field">
          <span className="cm-field-label">Rows</span>
          <Select
            className="cm-mandis-select"
            value={pageSizeValue}
            disabled={disabled}
            options={PAGE_SIZES.map((size) => ({ value: size, label: String(size) }))}
            onChange={(value) => {
              if (isMy) {
                setMyPageSize(Number(value));
                setMyPage(1);
              } else {
                setImpPageSize(Number(value));
                setImpPage(1);
              }
            }}
          />
        </label>

        <div className="cm-mandis-toolbar-actions">
          <Tooltip title="Refresh">
            <Button
              icon={<ReloadOutlined />}
              disabled={disabled}
              onClick={() => isMy ? resetMy() : void fetchSystemMandis()}
            >
              {!isSmDown ? "Refresh" : null}
            </Button>
          </Tooltip>
          {isMy ? (
            <>
              <Tooltip title={!canRemove ? "No permission" : activeSelectedRows.length ? "Deactivate selected" : "Select active mandis first"}>
                <Button danger icon={<StopOutlined />} disabled={!canRemove || !activeSelectedRows.length} onClick={handleRemoveSelected}>
                  {!isSmDown ? "Deactivate" : null}
                </Button>
              </Tooltip>
              <Tooltip title={!canRemove ? "No permission" : inactiveSelectedRows.length ? "Activate selected" : "Select inactive mandis first"}>
                <Button icon={<CheckCircleOutlined />} disabled={!canRemove || !inactiveSelectedRows.length} onClick={() => void handleActivateSelected()}>
                  {!isSmDown ? "Activate" : null}
                </Button>
              </Tooltip>
              <Tooltip title={!canCreate ? "No permission to add mandi" : "Add a custom mandi"}>
                <Button type="primary" icon={<PlusOutlined />} disabled={!canCreate} onClick={() => setCreateModalOpen(true)}>
                  {!isSmDown ? "Add Mandi" : null}
                </Button>
              </Tooltip>
            </>
          ) : (
            <Button
              type="primary"
              disabled={!canImport || !impState || selectedImportMandiIds.length === 0}
              onClick={() => void handleImport()}
            >
              Import Selected{selectedImportMandiIds.length ? ` (${selectedImportMandiIds.length})` : ""}
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderMyMandis = () => (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <CmSectionCard compact>{commonToolbar("MY")}</CmSectionCard>
      <Row gutter={[12, 12]}>
        <Col xs={12} lg={6}><CmStatCard label="Total Mandis" value={myTotal.toLocaleString("en-IN")} icon={<ShopOutlined />} tone="olive" /></Col>
        <Col xs={12} lg={6}><CmStatCard label="Active on page" value={activeOnPage} icon={<CheckCircleOutlined />} tone="olive" /></Col>
        <Col xs={12} lg={6}><CmStatCard label="Inactive on page" value={inactiveOnPage} icon={<StopOutlined />} tone="neutral" /></Col>
        <Col xs={12} lg={6}><CmStatCard label="Selected" value={mySelectionModel.length} icon={<TeamOutlined />} tone="amber" /></Col>
      </Row>
      <Card className="cm-mandis-table-card" bordered>
        <Table<MandiLite>
          rowKey={getMyRowId}
          columns={myColumns}
          dataSource={myRows}
          loading={myLoading}
          scroll={{ x: 860 }}
          rowSelection={{
            selectedRowKeys: mySelectionModel,
            preserveSelectedRowKeys: true,
            onChange: (keys) => setMySelectionModel(keys as (string | number)[]),
          }}
          pagination={{
            current: myPage,
            pageSize: myPageSize,
            total: myTotal,
            showSizeChanger: false,
            showTotal: (total, range) => `${range[0]}–${range[1]} of ${total}`,
            onChange: (page) => setMyPage(page),
          }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No mandis found for this scope" /> }}
        />
      </Card>
    </Space>
  );

  const renderImportMandis = () => (
    <Space direction="vertical" size={12} style={{ width: "100%" }}>
      <CmSectionCard compact>{commonToolbar("IMPORT")}</CmSectionCard>
      <Alert
        type="info"
        showIcon
        message="Import from the protected system mandi master"
        description="Choose a state, select up to 25 mandis, and import them into the selected organisation. Existing mappings are skipped by the API."
      />
      <Card className="cm-mandis-table-card" bordered>
        {!impState ? (
          <div className="cm-mandis-import-guide">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Select a state to load system mandis" />
          </div>
        ) : (
          <Table<MandiLite>
            rowKey={(row) => String(row?.mandi_id ?? row?._id ?? row?._rowId)}
            columns={impColumns}
            dataSource={impRows}
            loading={impLoading}
            scroll={{ x: 1050 }}
            rowSelection={{
              selectedRowKeys: impSelectionModel,
              preserveSelectedRowKeys: true,
              onChange: (keys) => {
                if (keys.length > 25) {
                  enqueueSnackbar("You can import 25 mandis at a time.", { variant: "warning" });
                  return;
                }
                setImpSelectionModel(keys as (string | number)[]);
              },
            }}
            pagination={{
              current: impPage,
              pageSize: impPageSize,
              total: impTotal,
              showSizeChanger: false,
              showTotal: (total, range) => `${range[0]}–${range[1]} of ${total}`,
              onChange: (page) => setImpPage(page),
            }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No system mandis found" /> }}
          />
        )}
      </Card>
    </Space>
  );

  return (
    <PageContainer>
      <div className="cm-mandis-page">
        <CmPageHeader
          title="Mandis"
          subtitle="Manage organisation mandi access, import protected system masters, and maintain operational availability from one scoped workspace."
          eyebrow={<Tag color="gold">Mandi Administration</Tag>}
          actions={<Button icon={<ReloadOutlined />} onClick={() => activeTab === "MY" ? resetMy() : impState ? void fetchSystemMandis() : undefined}>Refresh</Button>}
        />

        {isSuper ? (
          <CmSectionCard className="cm-mandis-scope-card" compact>
            <div className="cm-mandis-scope-grid">
              <label className="cm-field">
                <span className="cm-field-label">Organisation scope</span>
                <Select
                  className="cm-mandis-select"
                  showSearch
                  optionFilterProp="label"
                  loading={organisationsLoading}
                  value={selectedSuperOrgId || undefined}
                  placeholder="Select organisation"
                  options={organisationOptions.map((option) => ({ value: option.value, label: `${option.label} · ${option.orgCode}` }))}
                  onChange={(value) => {
                    setSelectedSuperOrgId(String(value || ""));
                    setMyState("");
                    setImpState("");
                  }}
                />
              </label>
              <div className="cm-mandis-scope-note">
                <EnvironmentOutlined />
                {selectedSuperOrgId
                  ? <>Operating within <strong>{selectedOrgCode || "selected organisation"}</strong>. All list, import and create actions use this organisation scope.</>
                  : <>Select an organisation before loading or changing its mandis.</>}
              </div>
            </div>
          </CmSectionCard>
        ) : (
          <Alert
            type="success"
            showIcon
            message="Organisation scope locked by your account"
            description={`All mandi actions are restricted to your authorised organisation${authContext.org_code ? ` (${authContext.org_code})` : ""}.`}
          />
        )}

        {!orgId ? (
          <CmSectionCard>
            <Empty description={isSuper ? "Select an organisation to manage its mandis" : "No organisation scope is available for this account"} />
          </CmSectionCard>
        ) : (
          <Tabs
            className="cm-mandis-tabs"
            activeKey={activeTab}
            onChange={(key) => {
              const next = key as "MY" | "IMPORT";
              setActiveTab(next);
              if (next === "MY") setMyPage(1);
              else resetImport();
            }}
            items={[
              { key: "MY", label: "Organisation Mandis", children: renderMyMandis() },
              { key: "IMPORT", label: "Import from System", children: renderImportMandis(), disabled: !canImport },
            ]}
          />
        )}

        <Modal
          open={createModalOpen}
          title="Add Custom Mandi"
          width={680}
          onCancel={handleCloseCreateModal}
          confirmLoading={createSubmitting}
          okText="Create Mandi"
          okButtonProps={{ disabled: !canSubmitCreate }}
          onOk={() => void handleCreateCustomMandi()}
          destroyOnClose
        >
          <Alert type="info" showIcon message="Create inside current organisation scope" description="Location metadata is resolved from the pincode master; business data is not invented by the Admin UI." style={{ marginBottom: 16 }} />
          <div className="cm-mandis-modal-grid">
            <div className="cm-span-2"><CmInput label="Mandi name (English)" value={createForm.name} onChange={(value) => setCreateForm((prev) => ({ ...prev, name: value }))} required /></div>
            <CmInput label="Pincode" value={createForm.pincode} onChange={(value) => setCreateForm((prev) => ({ ...prev, pincode: value.replace(/\D/g, "").slice(0, 6) }))} required maxLength={6} inputMode="numeric" help={pincodeError || (pincodeStatus === "loading" ? "Looking up pincode…" : "Enter a 6-digit pincode")} error={Boolean(pincodeError) && pincodeStatus === "error"} />
            <CmInput label="Contact number" value={createForm.contact} onChange={(value) => setCreateForm((prev) => ({ ...prev, contact: value.replace(/\D/g, "").slice(0, 15) }))} inputMode="tel" required help="10–15 digits, as required by the Mandi API" error={Boolean(createForm.contact) && !/^\d{10,15}$/.test(createForm.contact)} />
            <CmReadOnlyField label="State" value={pincodeLookup.state_name} />
            <CmReadOnlyField label="District" value={pincodeLookup.district_name} />
            <div className="cm-span-2"><CmInput label="Address line" value={createForm.address} onChange={(value) => setCreateForm((prev) => ({ ...prev, address: value }))} required multiline rows={3} /></div>
            <div className="cm-span-2 cm-mandis-coordinates"><Typography.Text type="secondary">Latitude: {pincodeLookup.latitude ?? "—"}</Typography.Text><Typography.Text type="secondary">Longitude: {pincodeLookup.longitude ?? "—"}</Typography.Text></div>
          </div>
        </Modal>

        <Modal
          open={deactivateConfirmOpen}
          title="Deactivate Mandi"
          okText="Deactivate"
          okButtonProps={{ danger: true }}
          onCancel={cancelDeactivate}
          onOk={() => void confirmDeactivate()}
        >
          <Typography.Paragraph>This deactivates the selected mandi mappings for this organisation. They remain visible and can be activated again later.</Typography.Paragraph>
        </Modal>

        <Modal
          open={Boolean(correctionRow)}
          title="Correct Protected Mandi Master Data"
          width={760}
          destroyOnClose
          maskClosable={!correctionSubmitting}
          closable={!correctionSubmitting}
          onCancel={() => !correctionSubmitting && setCorrectionRow(null)}
          footer={[
            <Button key="cancel" onClick={() => setCorrectionRow(null)} disabled={correctionSubmitting}>Cancel</Button>,
            <Button key="save" type="primary" onClick={() => void submitCorrection()} loading={correctionSubmitting} disabled={correctionReason.trim().length < 10}>Save Correction</Button>,
          ]}
        >
          <Alert type="warning" showIcon message="Protected platform master data" description="Only SUPER_ADMIN can make verified corrections. Changes require step-up verification, synchronize to imported organisation copies, and are permanently audited." style={{ marginBottom: 16 }} />
          <div className="cm-mandis-modal-grid">
            <div className="cm-span-2"><CmInput label="Mandi name" value={correctionName} onChange={setCorrectionName} /></div>
            <CmInput label="State code" value={correctionState} onChange={(value) => setCorrectionState(value.toUpperCase().slice(0, 3))} maxLength={3} />
            <CmInput label="District" value={correctionDistrict} onChange={setCorrectionDistrict} />
            <CmInput label="Pincode" value={correctionPincode} onChange={(value) => setCorrectionPincode(value.replace(/\D/g, "").slice(0, 6))} maxLength={6} />
            <CmInput label="Contact" value={correctionContact} onChange={(value) => setCorrectionContact(value.replace(/\D/g, "").slice(0, 15))} maxLength={15} />
            <div className="cm-span-2"><CmInput label="Address" value={correctionAddress} onChange={setCorrectionAddress} multiline rows={3} /></div>
            <div className="cm-span-2"><CmInput label="Correction reason" value={correctionReason} onChange={(value) => setCorrectionReason(value.slice(0, 500))} multiline rows={4} error={correctionReason.length > 0 && correctionReason.trim().length < 10} help="Mandatory. Minimum 10 characters. Stored permanently in correction history." /></div>
          </div>
        </Modal>

        <Modal open={Boolean(historyRow)} title="Protected Mandi Correction History" width={900} footer={<Button onClick={() => setHistoryRow(null)}>Close</Button>} onCancel={() => setHistoryRow(null)} destroyOnClose>
          <Alert type="info" showIcon message={historyRow ? String(historyRow?.name_i18n?.en || historyRow?.display_name || "Protected Mandi") : "Protected Mandi"} description="Every protected master-data correction is retained with its reason and changed fields." style={{ marginBottom: 16 }} />
          {historyLoading ? (
            <div style={{ padding: 30, textAlign: "center" }}><Typography.Text>Loading correction history…</Typography.Text></div>
          ) : historyItems.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No correction history available" />
          ) : (
            <Space direction="vertical" size={12} style={{ width: "100%" }}>
              {historyItems.map((item, index) => {
                const before = item?.before && typeof item.before === "object" ? item.before : {};
                const after = item?.after && typeof item.after === "object" ? item.after : {};
                const fields = Array.isArray(item?.changed_fields) ? item.changed_fields : [];
                return (
                  <div className="cm-mandis-history-card" key={String(item?._id || index)}>
                    <Descriptions size="small" column={{ xs: 1, sm: 3 }} items={[
                      { key: "when", label: "Changed on", children: item?.changed_on ? new Date(item.changed_on).toLocaleString() : "—" },
                      { key: "by", label: "Changed by", children: item?.changed_by || "—" },
                      { key: "status", label: "Status", children: item?.status || "—" },
                      { key: "reason", label: "Reason", children: item?.reason || "—", span: 3 },
                      { key: "fields", label: "Fields changed", children: fields.length ? fields.join(", ") : "—", span: 3 },
                    ]} />
                    {fields.length ? <table className="cm-mandis-history-diff"><thead><tr><th>Field</th><th>Previous</th><th>New</th></tr></thead><tbody>{fields.map((field: string) => <tr key={field}><td>{field}</td><td>{typeof before[field] === "object" ? JSON.stringify(before[field]) : String(before[field] ?? "—")}</td><td>{typeof after[field] === "object" ? JSON.stringify(after[field]) : String(after[field] ?? "—")}</td></tr>)}</tbody></table> : null}
                  </div>
                );
              })}
            </Space>
          )}
        </Modal>
      </div>
    </PageContainer>
  );
};
