import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { type GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { ScreenHelpDrawer } from "../../components/ScreenHelpDrawer";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import { readAuctionScope, writeAuctionScope } from "../../utils/auctionScope";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { fetchMandis } from "../../services/mandiApi";
import { createAuctionSession, finalizeAuctionResult, getAuctionLots, getAuctionSessions, startAuctionLot } from "../../services/auctionOpsApi";
import { getLotList } from "../../services/lotsApi";
import { postEncrypted } from "../../services/sharedEncryptedRequest";
import { subscribeAuctionLot, subscribeAuctionSession } from "../../services/socketClient";

type LotRow = {
  id: string;
  lot_id: string;
  backend_lot_id?: string | null;
  session_id?: string | null;
  session_code?: string | null;
  session_name?: string | null;
  session_lane_type?: string | null;
  session_commodity_group?: string | null;
  session_is_overflow_lane?: boolean | null;
  org_id?: string | null;
  mandi_id_value?: number | string | null;
  org_code?: string | null;
  mandi_code?: string | null;
  commodity?: string | null;
  product?: string | null;
  quantity?: number | null;
  status?: string | null;
  base_price?: number | null;
  session_start_time?: string | null;
  session_scheduled_end_time?: string | null;
  session_closure_mode?: string | null;
  session_status?: string | null;
  is_active_lot?: "Y" | "N" | null;
  lot_phase?: string | null;
  session_has_active_lot?: boolean | null;
  session_no_active_lot?: boolean | null;
  session_remaining_lot_count?: number | null;
  session_ready_to_close?: boolean | null;
  session_active_lot_id?: string | null;
  session_active_lot_code?: string | null;
  session_next_queued_lot_id?: string | null;
  session_next_queued_lot_code?: string | null;
  session_queued_count?: number | null;
  session_live_count?: number | null;
  session_sold_count?: number | null;
  session_unsold_count?: number | null;
  created_on?: string | null;
};

type Option = { value: string; label: string };
type SessionOption = Option & {
  session: any;
};
type LotOption = { value: string; label: string; shortCode?: string; lot: any };
type LaneCapacitySummary = {
  live_session_count: number;
  open_session_count: number;
  total_queued_lots: number;
  average_queue_per_lane: number;
  overloaded_lane_count: number;
  max_live_sessions_per_mandi: number;
  max_total_open_sessions_per_mandi: number;
  max_queue_per_lane: number;
  can_create_new_lane: boolean;
  can_start_new_live_lane: boolean;
  auction_lanes_enabled: boolean;
  show_capacity_guardrails: boolean;
  current_live_sessions: number;
  current_open_sessions: number;
  current_total_queued_lots: number;
  current_system_live_sessions?: number;
  current_system_open_sessions?: number;
  current_system_total_queued_lots?: number;
  current_org_live_sessions: number;
  current_org_open_sessions: number;
  current_org_total_queued_lots: number;
  effective_max_live_sessions: number;
  effective_max_open_sessions: number;
  effective_max_queue_per_lane: number;
  effective_max_total_queued_lots: number;
  effective_system_max_live_sessions?: number;
  effective_system_max_open_sessions?: number;
  effective_system_max_total_queued_lots?: number;
  capacity_guard_state: string;
  blocking_reason?: string | null;
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

function currentCountry(): string {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return String(parsed?.country || parsed?.country_code || "IN").trim().toUpperCase() || "IN";
  } catch {
    return "IN";
  }
}

function formatDate(value?: string | Date | null) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

const toNumber = (v: any): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const formatInr = (value: number | null): string => {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  try {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(value);
  } catch {
    return String(value);
  }
};

const buildLotLabel = (lot: any) => {
  const partyDisplay =
    lot?.party_display_name ||
    `${lot?.party_type || ""} ${lot?.party_ref || ""}`.trim() ||
    "";

  const commodity =
    lot?.commodity_name_en ||
    lot?.commodity_name ||
    lot?.commodity ||
    lot?.commodity_code ||
    lot?.commodity_id ||
    "Commodity";
  const product =
    lot?.product_name_en ||
    lot?.commodity_product_name_en ||
    lot?.product ||
    lot?.product_code ||
    lot?.commodity_product_id ||
    "Product";

  const bags = toNumber(lot?.quantity?.bags ?? lot?.bags) ?? null;
  const weightPerBag = toNumber(lot?.quantity?.weight_per_bag_kg ?? lot?.weight_per_bag_kg) ?? null;
  const totalWeight =
    toNumber(lot?.quantity?.net_kg) ??
    toNumber(lot?.quantity?.gross_kg) ??
    toNumber(lot?.quantity?.total_kg) ??
    toNumber(lot?.quantity?.estimated_kg) ??
    toNumber(lot?.quantity?.weight_kg) ??
    toNumber(lot?.weight_kg) ??
    (bags !== null && weightPerBag !== null ? bags * weightPerBag : null) ??
    null;

  const gateCode = lot?.gate_code || lot?.gate?.code || lot?.gate || "-";
  const lotSeq = lot?.lot_seq || lot?.lot_sequence || lot?.lot_no || lot?.lot_number || "-";

  const qtyPart =
    bags !== null && weightPerBag !== null
      ? `${bags}x${weightPerBag}kg (${totalWeight ?? "-"}kg)`
      : totalWeight !== null
      ? `${totalWeight}kg`
      : "-";

  const label = `${partyDisplay} \u2022 ${commodity}/${product} \u2022 ${qtyPart} \u2022 Gate ${gateCode} \u2022 Lot#${lotSeq}`;
  const lotCode = lot?.lot_code || lot?.token_code || lot?._id || "";
  const shortCode = lotCode ? String(lotCode).slice(-6) : "";
  return { label, shortCode };
};

const buildSessionCode = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `SESS_${yyyy}${mm}${dd}_${hh}${min}`;
};

const toDateTimeLocal = (date: Date) => {
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const defaultScheduledEndLocal = (durationMinutes = 120) =>
  toDateTimeLocal(new Date(Date.now() + Math.max(1, durationMinutes) * 60 * 1000));

const closureModeHelperText = (closureMode: string) => {
  if (closureMode === "MANUAL_ONLY") return "Manual close only. Scheduled end is optional.";
  if (closureMode === "AUTO_AT_END_TIME") return "Auto close at scheduled end time. Scheduled end is required.";
  return "Auto close at scheduled end time or manual close earlier. Scheduled end is required.";
};

const closureModeLabel = (mode: string | null | undefined) => {
  const key = String(mode || "").trim().toUpperCase();
  if (key === "MANUAL_ONLY") return "Manual";
  if (key === "AUTO_AT_END_TIME") return "Auto";
  if (key === "MANUAL_OR_AUTO") return "Manual + Auto";
  return "—";
};

const humanizeLaneType = (value: string | null | undefined) => {
  const key = String(value || "").trim().toUpperCase();
  if (!key) return "—";
  return key
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
};

const formatCountdown = (scheduledEnd: string | null | undefined, nowMs: number) => {
  if (!scheduledEnd) {
    return { label: "No session timing available", danger: false };
  }
  const end = new Date(scheduledEnd);
  if (Number.isNaN(end.getTime())) {
    return { label: "No session timing available", danger: false };
  }
  const diffMs = end.getTime() - nowMs;
  if (diffMs <= 0) {
    return { label: "Ended / Awaiting Close", danger: true };
  }
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
  const danger = diffMs < 10 * 60 * 1000;
  return {
    label: `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`,
    danger,
  };
};

const normalizeSessionStatus = (value: string | null | undefined) => {
  const key = String(value || "").trim().toUpperCase();
  if (["PLANNED", "LIVE", "PAUSED", "CLOSED", "CANCELLED"].includes(key)) return key;
  return "";
};

const getTimeLeftPresentation = (
  sessionStatus: string | null | undefined,
  scheduledEnd: string | null | undefined,
  nowMs: number
) => {
  const status = normalizeSessionStatus(sessionStatus);
  if (status === "PLANNED") return { label: "Not started", tone: "muted" as const };
  if (status === "PAUSED") return { label: "Paused", tone: "warning" as const };
  if (status === "CLOSED") return { label: "Ended", tone: "muted" as const };
  if (status === "CANCELLED") return { label: "Cancelled", tone: "error" as const };
  if (status !== "LIVE") return { label: "No session timing available", tone: "muted" as const };

  const countdown = formatCountdown(scheduledEnd, nowMs);
  if (countdown.label === "No session timing available") return { label: countdown.label, tone: "muted" as const };
  if (countdown.label === "Ended / Awaiting Close") return { label: countdown.label, tone: "error" as const };
  const end = new Date(String(scheduledEnd || ""));
  const diffMs = end.getTime() - nowMs;
  if (!Number.isFinite(diffMs)) return { label: countdown.label, tone: "muted" as const };
  if (diffMs < 2 * 60 * 1000) return { label: countdown.label, tone: "error" as const };
  if (diffMs < 10 * 60 * 1000) return { label: countdown.label, tone: "warning" as const };
  return { label: countdown.label, tone: "live" as const };
};

export const AuctionLots: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const [openCreate, setOpenCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOptionsLoading, setCreateOptionsLoading] = useState(false);
  const [sessionItems, setSessionItems] = useState<any[]>([]);
  const [sessionOptions, setSessionOptions] = useState<SessionOption[]>([]);
  const [lotOptions, setLotOptions] = useState<LotOption[]>([]);
  const [selectedLot, setSelectedLot] = useState<any | null>(null);
  const [openCreateSession, setOpenCreateSession] = useState(false);
  const [createSessionLoading, setCreateSessionLoading] = useState(false);
  const [createSessionError, setCreateSessionError] = useState<string | null>(null);
  const [createSessionForm, setCreateSessionForm] = useState({
    method_code: "OPEN_OUTCRY",
    rounds_enabled: ["ROUND1"],
    status: "PLANNED",
    session_code: buildSessionCode(),
    session_name: "",
    lane_type: "COMMODITY_LANE",
    commodity_group: "",
    commodity_group_code: "",
    hall_or_zone: "",
    auctioneer_username: "",
    closure_mode: "MANUAL_OR_AUTO",
    scheduled_start_time: "",
    scheduled_end_time: defaultScheduledEndLocal(120),
    is_overflow_lane: false,
    max_queue_size: "",
    display_order: "",
    notes: "",
    allow_manual_close_when_auto_enabled: true,
  });
  const [createForm, setCreateForm] = useState({
    session_id: "",
    lot_id: "",
    base_price: "",
  });

  const persistedScope = readAuctionScope();
  const [filters, setFilters] = useState({
    org_code: persistedScope.org_code || "",
    mandi_code: persistedScope.mandi_code || "",
    commodity: "",
    product: "",
    session_id: "",
    lot_status: "",
    date_from: "",
    date_to: "",
  });
  const [rows, setRows] = useState<LotRow[]>([]);
  const [orgOptions, setOrgOptions] = useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<LotRow | null>(null);
  const [openHelp, setOpenHelp] = useState(false);
  const [helpTitle, setHelpTitle] = useState("Help");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [laneCapacitySummary, setLaneCapacitySummary] = useState<LaneCapacitySummary>({
    live_session_count: 0,
    open_session_count: 0,
    total_queued_lots: 0,
    average_queue_per_lane: 0,
    overloaded_lane_count: 0,
    max_live_sessions_per_mandi: 3,
    max_total_open_sessions_per_mandi: 6,
    max_queue_per_lane: 25,
    can_create_new_lane: true,
    can_start_new_live_lane: true,
    auction_lanes_enabled: true,
    show_capacity_guardrails: true,
    current_live_sessions: 0,
    current_open_sessions: 0,
    current_total_queued_lots: 0,
    current_org_live_sessions: 0,
    current_org_open_sessions: 0,
    current_org_total_queued_lots: 0,
    effective_max_live_sessions: 3,
    effective_max_open_sessions: 6,
    effective_max_queue_per_lane: 25,
    effective_max_total_queued_lots: 75,
    capacity_guard_state: "GREEN",
    blocking_reason: null,
  });
  const selectedSessionStatus = normalizeSessionStatus(String(selectedRow?.session_status || ""));
  const isSelectedSessionLive = selectedSessionStatus === "LIVE";
  const canStartSelectedLot = Boolean(selectedRow && isSelectedSessionLive && String(selectedRow.status || "").toUpperCase() === "QUEUED");
  const canFinalizeSelectedLot = Boolean(
    selectedRow &&
    isSelectedSessionLive &&
    String(selectedRow.status || "").toUpperCase() === "LIVE" &&
    String(selectedRow.is_active_lot || "N").toUpperCase() === "Y"
  );

  const scopedMandiCodes = useMemo(() => (Array.isArray(uiConfig.scope?.mandi_codes) ? uiConfig.scope.mandi_codes.filter(Boolean) : []), [uiConfig.scope?.mandi_codes]);
  const defaultOrgCode = uiConfig.role === "SUPER_ADMIN" ? "" : uiConfig.scope?.org_code || "";
  const defaultMandiCode = useMemo(() => {
    if (scopedMandiCodes.length > 0) return String(scopedMandiCodes[0]);
    if (mandiOptions.length === 1) return mandiOptions[0].value;
    return "";
  }, [scopedMandiCodes, mandiOptions]);

  const canMenu = useMemo(
    () => can(uiConfig.resources, "auction_lots.menu", "VIEW") || can(uiConfig.resources, "auction_lots.view", "VIEW"),
    [uiConfig.resources],
  );
  const canView = useMemo(() => can(uiConfig.resources, "auction_lots.view", "VIEW"), [uiConfig.resources]);
  const canCreate = useMemo(
    () => can(uiConfig.resources, "auction_lots.create", "CREATE"),
    [uiConfig.resources],
  );
  const canSessionsList = useMemo(
    () => can(uiConfig.resources, "auction_sessions.list", "VIEW"),
    [uiConfig.resources],
  );
  const canLotUpdate = useMemo(() => can(uiConfig.resources, "auction_lots.update", "UPDATE"), [uiConfig.resources]);
  const selectedCreateSession = useMemo(
    () => sessionItems.find((s: any) => String(s._id || s.session_id || "") === String(createForm.session_id || "")) || null,
    [sessionItems, createForm.session_id],
  );
  const createBasePriceRaw = String(createForm.base_price || "").trim();
  const createBasePriceValid = /^\d+(\.\d{1,2})?$/.test(createBasePriceRaw) && Number(createBasePriceRaw) > 0;
  const selectedTotalKg = useMemo(() => {
    const lot: any = selectedLot || null;
    const kgCandidate =
      lot?.quantity?.net_kg ??
      lot?.quantity?.gross_kg ??
      lot?.quantity?.total_kg ??
      lot?.quantity?.estimated_kg ??
      lot?.quantity?.weight_kg ??
      lot?.weight_kg ??
      null;
    return toNumber(kgCandidate);
  }, [selectedLot]);
  const selectedTotalQtl = useMemo(() => {
    if (!selectedTotalKg || selectedTotalKg <= 0) return null;
    return selectedTotalKg / 100;
  }, [selectedTotalKg]);
  const openingRatePerQtl = useMemo(() => {
    if (!createBasePriceValid) return null;
    return Number(createBasePriceRaw);
  }, [createBasePriceRaw, createBasePriceValid]);
  const selectedEstimatedValue = useMemo(() => {
    if (!openingRatePerQtl || !selectedTotalQtl) return null;
    return openingRatePerQtl * selectedTotalQtl;
  }, [openingRatePerQtl, selectedTotalQtl]);
  const createSubmitValid = Boolean(createForm.lot_id && createForm.session_id && createBasePriceValid);
  const createSubmitDisabled = createLoading || !createSubmitValid;
  const requiresMandiSelection = uiConfig.role !== "SUPER_ADMIN" && !filters.mandi_code;
  const showMandiInstruction = !loading && requiresMandiSelection;
  const showNoRowsForFilters = !loading && !showMandiInstruction && rows.length === 0;
  const createSessionRequiresEnd =
    createSessionForm.closure_mode === "AUTO_AT_END_TIME" || createSessionForm.closure_mode === "MANUAL_OR_AUTO";

  const columns = useMemo<GridColDef<LotRow>[]>(
    () => [
      {
        field: "lot_id",
        headerName: "Lot / Product",
        width: 240,
        renderCell: (params) => (
          <Stack spacing={0.2} sx={{ py: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {params.row.lot_id}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {params.row.commodity || "—"} / {params.row.product || "—"}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "lot_status",
        headerName: "Lot Status",
        width: 150,
        renderCell: (params) => {
          const lotStatus = String(params.row.status || "").toUpperCase() || "—";
          const sessionStatusForLot = normalizeSessionStatus(String(params.row.session_status || ""));
          const label = lotStatus === "WITHDRAWN" && sessionStatusForLot === "EXPIRED" ? "Expired" : lotStatus;
          const color =
            lotStatus === "LIVE"
              ? "success"
              : lotStatus === "QUEUED"
              ? "warning"
              : lotStatus === "SOLD"
              ? "success"
              : lotStatus === "WITHDRAWN"
              ? "default"
              : lotStatus === "UNSOLD"
              ? "default"
              : "default";
          const variant = lotStatus === "LIVE" ? "filled" : "outlined";
          return (
            <Box sx={{ height: "100%", width: "100%", display: "flex", alignItems: "center" }}>
              <Chip
                size="small"
                label={label}
                color={color as "default" | "success" | "warning" | "error"}
                variant={variant}
              />
            </Box>
          );
        },
      },
      {
        field: "session_status",
        headerName: "Session Status",
        width: 160,
        renderCell: (params) => {
          const sessionStatus = normalizeSessionStatus(String(params.row.session_status || ""));
          const label = sessionStatus || "—";
          const color =
            sessionStatus === "LIVE"
              ? "success"
              : sessionStatus === "PAUSED"
              ? "warning"
              : sessionStatus === "EXPIRED"
              ? "error"
              : sessionStatus === "CANCELLED"
              ? "error"
              : "default";
          const variant = sessionStatus === "PLANNED" || sessionStatus === "CLOSED" ? "outlined" : "filled";
          return (
            <Box sx={{ height: "100%", width: "100%", display: "flex", alignItems: "center" }}>
              <Chip
                size="small"
                label={label}
                color={color as "default" | "success" | "warning" | "error"}
                variant={variant}
              />
            </Box>
          );
        },
      },
      {
        field: "time_left",
        headerName: "Time Left",
        width: 200,
        renderCell: (params) => {
          const sessionStatus = String(params.row.session_status || params.row.status || "").toUpperCase();
          const timeLeft = getTimeLeftPresentation(sessionStatus, params.row.session_scheduled_end_time, nowMs);
          const color =
            timeLeft.tone === "error"
              ? "error.main"
              : timeLeft.tone === "warning"
              ? "warning.main"
              : timeLeft.tone === "live"
              ? "success.main"
              : "text.secondary";
          return (
            <Box sx={{ height: "100%", width: "100%", display: "flex", alignItems: "center" }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: timeLeft.tone === "muted" ? 500 : 700,
                  color,
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {timeLeft.label}
              </Typography>
            </Box>
          );
        },
      },
      {
        field: "end_time",
        headerName: "Scheduled End",
        width: 180,
        valueGetter: (_value, row) => formatDate((row as any)?.session_scheduled_end_time) || "—",
      },
      {
        field: "closure_mode",
        headerName: "Closure Mode",
        width: 140,
        valueGetter: (_value, row) => closureModeLabel((row as any)?.session_closure_mode),
      },
      {
        field: "session_lane",
        headerName: "Lane",
        width: 240,
        renderCell: (params) => (
          <Stack spacing={0.2} sx={{ py: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {params.row.session_name || params.row.session_code || "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {[params.row.session_commodity_group, params.row.session_lane_type?.replace(/_/g, " ")].filter(Boolean).join(" • ") || "—"}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "is_active_lot",
        headerName: "Active Lot",
        width: 120,
        renderCell: (params) => {
          const isActive = String(params.row.is_active_lot || "N").toUpperCase() === "Y";
          return (
            <Chip
              size="small"
              label={isActive ? "YES" : "NO"}
              color={isActive ? "success" : "default"}
              variant={isActive ? "filled" : "outlined"}
            />
          );
        },
      },
      { field: "created_on", headerName: "Created On", width: 180, valueFormatter: (value) => formatDate(value) },
      { field: "session_code", headerName: "Session Code", width: 150, valueGetter: (_value, row) => row.session_code || row.session_id || "—" },
      { field: "org_code", headerName: "Org", width: 110 },
      { field: "mandi_code", headerName: "Mandi", width: 140 },
      {
        field: "quantity",
        headerName: "Qty",
        width: 160,
        valueGetter: (value) => {
          const kg = toNumber(value);
          if (!kg || kg <= 0) return "—";
          const qtl = kg / 100;
          return `${formatInr(kg)} kg / ${qtl.toFixed(2)} qtl`;
        },
      },
      {
        field: "base_price",
        headerName: "Reference Rate",
        width: 160,
        valueGetter: (value) => {
          const rate = toNumber(value);
          if (!rate || rate <= 0) return "—";
          return `₹${formatInr(rate)} / qtl`;
        },
      },
      {
        field: "rate_per_kg",
        headerName: "Rate/kg",
        width: 120,
        valueGetter: (_value, row) => {
          const rate = toNumber((row as any)?.base_price);
          if (!rate || rate <= 0) return "—";
          return `₹${formatInr(rate / 100)}`;
        },
      },
      {
        field: "opening_value",
        headerName: "Opening Bid (Lot)",
        width: 140,
        valueGetter: (_value, row) => {
          const kg = toNumber((row as any)?.quantity);
          const rate = toNumber((row as any)?.base_price);
          if (!kg || kg <= 0 || !rate || rate <= 0) return "—";
          const value = (kg / 100) * rate;
          return `₹${formatInr(value)}`;
        },
      },
      {
        field: "start_time",
        headerName: "Start Time",
        width: 180,
        valueGetter: (_value, row) => formatDate((row as any)?.session_start_time) || "—",
      },
    ],
    [nowMs],
  );

  const loadOrganisations = async () => {
    if (uiConfig.role !== "SUPER_ADMIN") return;
    const username = currentUsername();
    const country = currentCountry();
    if (!username) return;
    const resp = await fetchOrganisations({ username, language });
    const list = resp?.data?.organisations || resp?.response?.data?.organisations || [];
    setOrgOptions(
      list.map((org: any) => ({
        value: org.org_code || org._id || "",
        label: org.org_name ? `${org.org_name} (${org.org_code || org._id})` : org.org_code || org._id,
      })),
    );
  };

  const loadMandis = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchMandis({ username, language, filters: { is_active: true } });
    const list = resp?.data?.mandis || resp?.response?.data?.mandis || [];
    setMandiOptions(
      list.map((m: any) => ({
        value: m.mandi_slug || m.slug || String(m.mandi_id || ""),
        label: m?.name_i18n?.en || m.mandi_slug || String(m.mandi_id),
      })),
    );
  };

  const isObjectId = (v: string) => /^[a-f\d]{24}$/i.test(v);
  const isIntString = (v: string) => /^\d+$/.test(v);
  const parseDecimal = (v: any): string | number | null => {
    if (v == null) return null;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? v : null;
    }
    if (typeof v === "object" && v.$numberDecimal) {
      return String(v.$numberDecimal);
    }
    return null;
  };

  const buildSessionOptionsForLot = (lot: any, sessions: any[]) => {
    if (!lot) return [];
    const orgId = lot?.org_id ? String(lot.org_id) : null;
    const orgCode = lot?.org_code ? String(lot.org_code) : null;
    const mandiId = lot?.mandi_id !== undefined && lot?.mandi_id !== null ? Number(lot.mandi_id) : null;
    const mandiCode = lot?.mandi_code ? String(lot.mandi_code) : null;
    const allowedStatuses = new Set(["PLANNED", "LIVE"]);

    return sessions
      .filter((s) => {
        const status = String(s?.derived_status || s?.status || "").toUpperCase();
        if (!allowedStatuses.has(status)) return false;
        const sOrgId = s?.org_id ? String(s.org_id) : null;
        const sOrgCode = s?.org_code ? String(s.org_code) : null;
        const sMandiId = s?.mandi_id !== undefined && s?.mandi_id !== null ? Number(s.mandi_id) : null;
        const sMandiCode = s?.mandi_code ? String(s.mandi_code) : null;

        const orgMatch = orgId ? sOrgId === orgId : orgCode ? sOrgCode === orgCode : true;
        const mandiMatch = mandiId !== null ? sMandiId === mandiId : mandiCode ? sMandiCode === mandiCode : true;
        return orgMatch && mandiMatch;
      })
      .map((s: any) => ({
        value: s._id || s.session_id || "",
        label: [
          s.session_name || s.session_code || s._id || s.session_id || "",
          s.commodity_group ? `• ${s.commodity_group}` : "",
          s.lane_type ? `• ${humanizeLaneType(s.lane_type)}` : "",
        ].filter(Boolean).join(" "),
        session: s,
      }))
      .filter((s: SessionOption) => s.value);
  };

  const loadData = async () => {
    const username = currentUsername();
    if (!username || !canView) return;
    if (!filters.mandi_code && uiConfig.role !== "SUPER_ADMIN") {
      if (import.meta.env.DEV) {
        console.debug("[AUCTION_LOTS_INIT] skipped load, mandi unresolved", {
          defaultMandiCode,
          appliedFilters: filters,
        });
      }
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const resp = await getAuctionLots({
        username,
        language,
        filters: {
          org_id: filters.org_code && isObjectId(filters.org_code) ? filters.org_code : undefined,
          org_code: filters.org_code && !isObjectId(filters.org_code) ? filters.org_code : undefined,
          mandi_id:
            filters.mandi_code && isIntString(filters.mandi_code)
              ? Number(filters.mandi_code)
              : undefined,
          mandi_code:
            filters.mandi_code && !isIntString(filters.mandi_code)
              ? filters.mandi_code
              : undefined,
          commodity: filters.commodity || undefined,
          product: filters.product || undefined,
          session_id: filters.session_id || undefined,
          lot_status: filters.lot_status || undefined,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
          page_size: 100,
        },
      });
      const list = resp?.data?.items || resp?.response?.data?.items || [];
      const mapped: LotRow[] = list.map((item: any, idx: number) => ({
        id: item._id || item.lot_code || item.lot_id || `lot-${idx}`,
        lot_id: item.lot_code || item.lot_id || item._id || `lot-${idx}`,
        backend_lot_id: item._id || item.lot_id || null,
        session_id: item.session_id || null,
        session_code: item?.session?.session_code || item?.session_code || null,
        session_name: item?.session?.session_name || item?.session_name || null,
        session_lane_type: item?.session?.lane_type || item?.session_lane_type || null,
        session_commodity_group: item?.session?.commodity_group || item?.session_commodity_group || null,
        session_is_overflow_lane: typeof item?.session?.is_overflow_lane === "boolean" ? item.session.is_overflow_lane : null,
        org_id: item.org_id || null,
        mandi_id_value: item.mandi_id ?? null,
        org_code: item.org_code || item.org_id || null,
        mandi_code: item.mandi_code ?? item.mandi_id ?? null,
        commodity: item.commodity_name_en || item.commodity || item.commodity_code || null,
        product: item.product_name_en || item.product || item.product_code || null,
        quantity: item.estimated_qty_kg ?? item.quantity ?? null,
        base_price: parseDecimal(item.start_price_per_qtl) ?? item.base_price ?? null,
        status: item.status || null,
        is_active_lot: String(item.is_active_lot || "").toUpperCase() === "Y" ? "Y" : "N",
        lot_phase: item.lot_phase || null,
        session_start_time: item?.session?.start_time || item?.session_start_time || item?.start_time || null,
        session_scheduled_end_time: item?.session?.scheduled_end_time || item?.session_scheduled_end_time || item?.scheduled_end_time || null,
        session_closure_mode: item?.session?.closure_mode || item?.session_closure_mode || item?.closure_mode || null,
        session_status: item?.session?.status || item?.session_status || null,
        session_has_active_lot: typeof item?.session?.has_active_lot === "boolean" ? item.session.has_active_lot : null,
        session_no_active_lot: typeof item?.session?.no_active_lot === "boolean" ? item.session.no_active_lot : null,
        session_remaining_lot_count:
          item?.session?.remaining_lot_count !== undefined && item?.session?.remaining_lot_count !== null
            ? Number(item.session.remaining_lot_count)
            : null,
        session_ready_to_close: typeof item?.session?.ready_to_close === "boolean" ? item.session.ready_to_close : null,
        session_active_lot_id: item?.session?.active_lot_id || null,
        session_active_lot_code: item?.session?.active_lot_code || null,
        session_next_queued_lot_id: item?.session?.next_queued_lot_id || null,
        session_next_queued_lot_code: item?.session?.next_queued_lot_code || null,
        session_queued_count: item?.session?.queued_count != null ? Number(item.session.queued_count) : null,
        session_live_count: item?.session?.live_count != null ? Number(item.session.live_count) : null,
        session_sold_count: item?.session?.sold_count != null ? Number(item.session.sold_count) : null,
        session_unsold_count: item?.session?.unsold_count != null ? Number(item.session.unsold_count) : null,
        created_on: item.created_on || item.createdAt || null,
      }));
      if (import.meta.env.DEV) {
        console.debug("[AUCTION_LOTS_DEBUG] sample_item", list[0]);
        console.debug("[AUCTION_LOTS_DEBUG] sample_row", mapped[0]);
      }
      setRows(mapped);
      const summary = resp?.data?.lane_capacity_summary || resp?.response?.data?.lane_capacity_summary || null;
      if (summary) {
        setLaneCapacitySummary({
          live_session_count: Number(summary.live_session_count || 0),
          open_session_count: Number(summary.open_session_count || 0),
          total_queued_lots: Number(summary.total_queued_lots || 0),
          average_queue_per_lane: Number(summary.average_queue_per_lane || 0),
          overloaded_lane_count: Number(summary.overloaded_lane_count || 0),
          max_live_sessions_per_mandi: Number(summary.max_live_sessions_per_mandi || 3),
          max_total_open_sessions_per_mandi: Number(summary.max_total_open_sessions_per_mandi || 6),
          max_queue_per_lane: Number(summary.max_queue_per_lane || 25),
          can_create_new_lane: Boolean(summary.can_create_new_lane),
          can_start_new_live_lane: Boolean(summary.can_start_new_live_lane ?? true),
          auction_lanes_enabled: Boolean(summary.auction_lanes_enabled ?? true),
          show_capacity_guardrails: Boolean(summary.show_capacity_guardrails ?? true),
          current_live_sessions: Number(summary.current_live_sessions || summary.live_session_count || 0),
          current_open_sessions: Number(summary.current_open_sessions || summary.open_session_count || 0),
          current_total_queued_lots: Number(summary.current_total_queued_lots || summary.total_queued_lots || 0),
          current_org_live_sessions: Number(summary.current_org_live_sessions || 0),
          current_org_open_sessions: Number(summary.current_org_open_sessions || 0),
          current_org_total_queued_lots: Number(summary.current_org_total_queued_lots || 0),
          effective_max_live_sessions: Number(summary.effective_max_live_sessions || summary.max_live_sessions_per_mandi || 3),
          effective_max_open_sessions: Number(summary.effective_max_open_sessions || summary.max_total_open_sessions_per_mandi || 6),
          effective_max_queue_per_lane: Number(summary.effective_max_queue_per_lane || summary.max_queue_per_lane || 25),
          effective_max_total_queued_lots: Number(summary.effective_max_total_queued_lots || 75),
          capacity_guard_state: String(summary.capacity_guard_state || "GREEN").toUpperCase(),
          blocking_reason: summary.blocking_reason || null,
        });
      }
      setSelectedRow((prev) => mapped.find((row) => row.id === prev?.id) || null);
    } finally {
      setLoading(false);
    }
  };

  const loadCreateOptions = async () => {
    const username = currentUsername();
    if (!username) return;
    setCreateError(null);
    setCreateOptionsLoading(true);
    try {
      const [sessionsResp, lotsResp] = await Promise.all([
        canSessionsList ? getAuctionSessions({
          username,
          language,
          filters: {
            org_code: filters.org_code || undefined,
            mandi_code: filters.mandi_code || undefined,
            page_size: 100,
            usable_for_mapping: true,
            lot_id: selectedLot?._id || selectedLot?.lot_id || undefined,
          }
        }) : Promise.resolve(null),
        getLotList({ username, language, filters: { org_code: filters.org_code || undefined, mandi_code: filters.mandi_code || undefined, status: "VERIFIED", page_size: 100 } }),
      ]);
      const sessions = sessionsResp?.data?.items ?? sessionsResp?.response?.data?.items ?? [];
      const lots = lotsResp?.data?.items || lotsResp?.response?.data?.items || [];

      setSessionItems(sessions);
      const lotMapped: LotOption[] = lots
        .map((l: any) => {
          const { label, shortCode } = buildLotLabel(l);
          return {
            value: l._id || l.lot_id || "",
            label,
            shortCode,
            lot: l,
          };
        })
        .filter((l: LotOption) => l.value);
      setLotOptions(lotMapped);

      if (selectedLot) {
        setSessionOptions(buildSessionOptionsForLot(selectedLot, sessions));
      } else if (lotMapped.length > 0) {
        setSessionOptions(buildSessionOptionsForLot(lotMapped[0].lot, sessions));
      } else {
        setSessionOptions([]);
      }
    } catch (err: any) {
      setCreateError(err?.message || "Failed to load sessions/lots.");
    } finally {
      setCreateOptionsLoading(false);
    }
  };

  const handleStartSelectedLot = async () => {
    const username = currentUsername();
    if (!username || !selectedRow || !selectedRow.backend_lot_id || !selectedRow.session_id || !selectedRow.org_id || selectedRow.mandi_id_value == null) return;
    if (!isSelectedSessionLive) {
      setActionError("Auction lot can be started only when the auction session is live.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const resp: any = await startAuctionLot({
        username,
        language,
        payload: {
          org_id: selectedRow.org_id,
          mandi_id: Number(selectedRow.mandi_id_value),
          session_id: selectedRow.session_id,
          lot_id: selectedRow.backend_lot_id,
        },
      });
      const rc = resp?.response?.responsecode ?? resp?.responsecode;
      const desc = resp?.response?.description ?? resp?.description;
      if (String(rc) !== "0") {
        setActionError(desc || "Failed to start auction lot.");
        return;
      }
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || "Failed to start auction lot.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleFinalizeSelectedLot = async () => {
    const username = currentUsername();
    if (!username || !selectedRow || !selectedRow.backend_lot_id || !selectedRow.session_id || !selectedRow.org_id || selectedRow.mandi_id_value == null) return;
    if (!isSelectedSessionLive) {
      setActionError("Auction lot cannot be finalized unless the session is live.");
      return;
    }
    setActionLoading(true);
    setActionError(null);
    try {
      const resp: any = await finalizeAuctionResult({
        username,
        language,
        payload: {
          org_id: selectedRow.org_id,
          mandi_id: Number(selectedRow.mandi_id_value),
          session_id: selectedRow.session_id,
          lot_id: selectedRow.backend_lot_id,
        },
      });
      const rc = resp?.response?.responsecode ?? resp?.responsecode;
      const desc = resp?.response?.description ?? resp?.description;
      if (String(rc) !== "0") {
        setActionError(desc || "Failed to finalize auction result.");
        return;
      }
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || "Failed to finalize auction result.");
    } finally {
      setActionLoading(false);
    }
  };

  const loadSessionsForDropdown = async () => {
    const username = currentUsername();
    setCreateOptionsLoading(true);
    if (!username || !selectedLot || !canSessionsList) {
      setCreateOptionsLoading(false);
      return;
    }
    try {
      const resp = await getAuctionSessions({
        username,
        language,
        filters: {
          org_id: selectedLot?.org_id || undefined,
          mandi_id: selectedLot?.mandi_id ?? undefined,
          page_size: 100,
          usable_for_mapping: true,
          lot_id: selectedLot?._id || selectedLot?.lot_id || undefined,
        },
      });
      const sessions = resp?.data?.items ?? resp?.response?.data?.items ?? [];
      setSessionItems(sessions);
      const options = buildSessionOptionsForLot(selectedLot, sessions);
      setSessionOptions(options);
    } catch (err: any) {
      setCreateError(err?.message || "Failed to load sessions.");
    } finally {
      setCreateOptionsLoading(false);
    }
  };

  const handleCreateSubmit = async () => {
    const username = currentUsername();
    const country = currentCountry();
    if (!username) return;
    console.log("CREATE FORM:", createForm);
    console.log("SESSION OPTIONS:", sessionOptions);
    if (import.meta.env.DEV) {
      console.debug("[AUCTION_LOTS_CREATE] submit_state", {
        selected_lot_id: createForm.lot_id || null,
        selected_session_id: createForm.session_id || null,
        opening_price: createBasePriceRaw || null,
        session_status: String(selectedCreateSession?.status || "").toUpperCase() || null,
        validation_result: createSubmitValid,
        submit_disabled: createSubmitDisabled,
      });
    }
    const sessionStatus = String(selectedCreateSession?.status || "").toUpperCase();
    if (sessionStatus === "CLOSED" || sessionStatus === "CANCELLED") {
      setCreateError("Cannot map lots to a CLOSED or CANCELLED session.");
      return;
    }
    if (!createForm.session_id || !createForm.lot_id || !createBasePriceRaw) {
      setCreateError("Session, lot, and opening price are required.");
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(createBasePriceRaw)) {
      setCreateError("Opening price must be a number with up to 2 decimals.");
      return;
    }
    const basePriceNum = Number(createBasePriceRaw);
    if (!Number.isFinite(basePriceNum) || basePriceNum <= 0) {
      setCreateError("Opening price must be greater than 0.");
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    try {
      const payload = {
        api: "mapLotToAuctionSession",
        api_name: "mapLotToAuctionSession",
        username,
        country,
        language,
        lot_id: createForm.lot_id,
        session_id: createForm.session_id,
        start_price_per_qtl: createBasePriceRaw,
      };
      if (import.meta.env.DEV) {
        console.debug("[AUCTION_LOTS_CREATE] payload", payload);
      }
      const resp: any = await postEncrypted("/admin/mapLotToAuctionSession", {
        ...payload,
      });
      const rc = resp?.response?.responsecode ?? resp?.responsecode;
      const desc = resp?.response?.description ?? resp?.description;
      if (String(rc) !== "0") {
        setCreateError(desc || "Failed to create auction lot.");
        return;
      }
      setOpenCreate(false);
      setCreateForm({ session_id: "", lot_id: "", base_price: "" });
      await loadData();
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create auction lot.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCreateSession = async () => {
    const username = currentUsername();
    if (!username || !selectedLot) return;
    setCreateSessionLoading(true);
    setCreateSessionError(null);
    try {
      const orgId = selectedLot?.org_id ? String(selectedLot.org_id) : "";
      const mandiId = selectedLot?.mandi_id !== undefined && selectedLot?.mandi_id !== null ? Number(selectedLot.mandi_id) : null;
      if (!orgId || mandiId === null) {
        setCreateSessionError("Lot does not have org/mandi context.");
        return;
      }
      const payload = {
        org_id: orgId,
        mandi_id: mandiId,
        method_code: createSessionForm.method_code || "OPEN_OUTCRY",
        rounds_enabled: createSessionForm.rounds_enabled?.length ? createSessionForm.rounds_enabled : ["ROUND1"],
        status: "PLANNED",
        session_code: createSessionForm.session_code || undefined,
        session_name: createSessionForm.session_name,
        lane_type: createSessionForm.lane_type,
        commodity_group: createSessionForm.commodity_group || undefined,
        commodity_group_code: createSessionForm.commodity_group_code || undefined,
        hall_or_zone: createSessionForm.hall_or_zone || undefined,
        auctioneer_username: createSessionForm.auctioneer_username || undefined,
        closure_mode: createSessionForm.closure_mode || "MANUAL_OR_AUTO",
        scheduled_start_time: createSessionForm.scheduled_start_time
          ? new Date(createSessionForm.scheduled_start_time).toISOString()
          : undefined,
        scheduled_end_time:
          createSessionForm.closure_mode === "AUTO_AT_END_TIME" || createSessionForm.closure_mode === "MANUAL_OR_AUTO"
            ? (createSessionForm.scheduled_end_time ? new Date(createSessionForm.scheduled_end_time).toISOString() : undefined)
            : undefined,
        is_overflow_lane: Boolean(createSessionForm.is_overflow_lane),
        max_queue_size: createSessionForm.max_queue_size || undefined,
        display_order: createSessionForm.display_order || undefined,
        notes: createSessionForm.notes || undefined,
        allow_manual_close_when_auto_enabled: Boolean(createSessionForm.allow_manual_close_when_auto_enabled),
      };
      if (
        (payload.closure_mode === "AUTO_AT_END_TIME" || payload.closure_mode === "MANUAL_OR_AUTO") &&
        !payload.scheduled_end_time
      ) {
        setCreateSessionError("Scheduled end time is required for selected closure mode.");
        return;
      }

      const resp: any = await createAuctionSession({
        username,
        language,
        payload,
      });
      const rc = resp?.response?.responsecode ?? resp?.responsecode;
      const desc = resp?.response?.description ?? resp?.description;
      if (String(rc) !== "0") {
        setCreateSessionError(desc || "Failed to create session.");
        return;
      }
      const newSessionId = resp?.data?.session_id || resp?.response?.data?.session_id || "";
      await loadCreateOptions();
      if (newSessionId) {
        setCreateForm((prev) => ({ ...prev, session_id: newSessionId }));
      }
      setOpenCreateSession(false);
    } catch (err: any) {
      setCreateSessionError(err?.message || "Failed to create session.");
    } finally {
      setCreateSessionLoading(false);
    }
  };

  useEffect(() => {
    loadOrganisations();
    loadMandis();
  }, [language, uiConfig.role]);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    setFilters((prev) => {
      const next = { ...prev };
      let changed = false;
      if (!next.org_code && defaultOrgCode) {
        next.org_code = defaultOrgCode;
        changed = true;
      }
      if (!next.mandi_code && defaultMandiCode) {
        next.mandi_code = defaultMandiCode;
        changed = true;
      }
      if (changed && import.meta.env.DEV) {
        console.debug("[AUCTION_LOTS_INIT] resolved defaults", {
          default_mandi_id: defaultMandiCode || null,
          initial_api_call_fired: true,
          appliedFilters: next,
        });
      }
      return changed ? next : prev;
    });
  }, [defaultOrgCode, defaultMandiCode]);

  useEffect(() => {
    writeAuctionScope({ org_code: filters.org_code, mandi_code: filters.mandi_code });
  }, [filters.org_code, filters.mandi_code]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug("[AUCTION_LOTS_INIT] loadData effect", {
        default_mandi_id: defaultMandiCode || null,
        initial_api_call_fired: Boolean(filters.mandi_code || uiConfig.role === "SUPER_ADMIN"),
        appliedFilters: filters,
      });
    }
    loadData();
  }, [filters.org_code, filters.mandi_code, filters.commodity, filters.product, filters.session_id, filters.lot_status, filters.date_from, filters.date_to, language, canView]);

  useEffect(() => {
    if (!canView || !filters.session_id) return;
    let unsubSession: null | (() => void) = null;
    let unsubLot: null | (() => void) = null;
    const refreshForSession = (payload: any) => {
      if (!payload?.session_id || String(payload.session_id) !== String(filters.session_id)) return;
      void loadData();
    };
    subscribeAuctionSession(
      { sessionId: filters.session_id, mandiId: filters.mandi_code || undefined },
      {
        "auction.bid.placed": refreshForSession,
        "auction.leaderboard.updated": refreshForSession,
        "auction.lot.updated": refreshForSession,
        "auction.result.finalized": refreshForSession,
        "auction.session.updated": refreshForSession,
      }
    ).then((cleanup) => {
      unsubSession = cleanup;
    }).catch((err) => {
      if (import.meta.env.DEV) console.debug("[auctionLots] session realtime subscribe failed", err);
    });

    const selectedRealtimeLotId = selectedLot?._id || selectedLot?.lot_id || selectedLot?.lot_code || null;
    if (selectedRealtimeLotId) {
      subscribeAuctionLot(
        { lotId: String(selectedRealtimeLotId), sessionId: filters.session_id },
        {
          "auction.bid.placed": refreshForSession,
          "auction.leaderboard.updated": refreshForSession,
          "auction.lot.updated": refreshForSession,
          "auction.result.finalized": refreshForSession,
        }
      ).then((cleanup) => {
        unsubLot = cleanup;
      }).catch((err) => {
        if (import.meta.env.DEV) console.debug("[auctionLots] lot realtime subscribe failed", err);
      });
    }

    return () => {
      if (unsubLot) unsubLot();
      if (unsubSession) unsubSession();
    };
  }, [canView, filters.session_id, filters.mandi_code, selectedLot?._id, selectedLot?.lot_id, selectedLot?.lot_code]);

  useEffect(() => {
    if (openCreate) {
      setCreateForm({ session_id: "", lot_id: "", base_price: "" });
      setSelectedLot(null);
      setSessionOptions([]);
      setCreateSessionForm({
        method_code: "OPEN_OUTCRY",
        rounds_enabled: ["ROUND1"],
        status: "PLANNED",
        session_code: buildSessionCode(),
        session_name: "",
        lane_type: "COMMODITY_LANE",
        commodity_group: "",
        commodity_group_code: "",
        hall_or_zone: "",
        auctioneer_username: "",
        closure_mode: "MANUAL_OR_AUTO",
        scheduled_start_time: "",
        scheduled_end_time: defaultScheduledEndLocal(120),
        is_overflow_lane: false,
        max_queue_size: "",
        display_order: "",
        notes: "",
        allow_manual_close_when_auto_enabled: true,
      });
      loadCreateOptions();
    }
  }, [openCreate, language]);

  useEffect(() => {
    if (!selectedLot) return;
    const nextOptions = buildSessionOptionsForLot(selectedLot, sessionItems);
    setSessionOptions(nextOptions);
    // ✅ keep selected session if still valid; otherwise clear
    setCreateForm((prev) => {
      if (!prev.session_id) return prev;
      const exists = nextOptions.some(
        (o: any) => String(o.value) === String(prev.session_id)
      );
      return exists ? prev : { ...prev, session_id: "" };
    });
  }, [selectedLot, sessionItems]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (import.meta.env.DEV && key === "mandi_code") {
      console.debug("[AUCTION_LOTS_INIT] current selected mandi_id", value || null);
    }
  };

  const clearFilters = () => {
    setFilters({
      org_code: uiConfig.role === "SUPER_ADMIN" ? "" : defaultOrgCode || "",
      mandi_code: defaultMandiCode || "",
      commodity: "",
      product: "",
      session_id: "",
      lot_status: "",
      date_from: "",
      date_to: "",
    });
  };

  if (!canMenu || !canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view auction lots.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
        mb={2}
      >
        <Stack spacing={0.5}>
          <Typography variant="h5">{t("menu.auctionLots", { defaultValue: "Auction Lots" })}</Typography>
          <Typography variant="body2" color="text.secondary">
            Monitor mapped lots, active sessions, and opening rates before live auction.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          {selectedRow && canLotUpdate && (
            <>
              <Button
                variant="contained"
                size="small"
                onClick={handleStartSelectedLot}
                disabled={actionLoading || !canStartSelectedLot}
              >
                Start Selected Lot
              </Button>
              <Button
                variant="outlined"
                size="small"
                color="error"
                onClick={handleFinalizeSelectedLot}
                disabled={actionLoading || !canFinalizeSelectedLot}
              >
                Finalize Selected Lot
              </Button>
            </>
          )}
          {canCreate && (
            <Button variant="contained" size="small" onClick={() => setOpenCreate(true)}>
              {t("actions.create", { defaultValue: "Create" })}
            </Button>
          )}
          <Button variant="outlined" size="small" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading || actionLoading}>
            Refresh
          </Button>
          <IconButton color="primary" size="small" onClick={() => { setHelpTitle("Auction Lot Mapping Help"); setOpenHelp(true); }} title="Help">
            <HelpOutlineIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      {laneCapacitySummary.show_capacity_guardrails && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Stack spacing={1.5}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Auction Capacity Summary
            </Typography>
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(140px, 1fr))" },
                gap: 1.25,
              }}
            >
              <Typography variant="body2"><strong>Live Lanes:</strong> {laneCapacitySummary.current_live_sessions}</Typography>
              <Typography variant="body2"><strong>Open Lanes:</strong> {laneCapacitySummary.current_open_sessions}</Typography>
              <Typography variant="body2"><strong>Allowed Live Lanes:</strong> {laneCapacitySummary.effective_max_live_sessions}</Typography>
              <Typography variant="body2"><strong>Allowed Open Lanes:</strong> {laneCapacitySummary.effective_max_open_sessions}</Typography>
              <Typography variant="body2"><strong>Total Queued Lots:</strong> {laneCapacitySummary.current_total_queued_lots}</Typography>
              <Typography variant="body2"><strong>Allowed Queue Capacity:</strong> {laneCapacitySummary.effective_max_total_queued_lots}</Typography>
              <Typography variant="body2"><strong>Org Live / Open:</strong> {laneCapacitySummary.current_org_live_sessions} / {laneCapacitySummary.current_org_open_sessions}</Typography>
              <Typography variant="body2"><strong>Org Queued Lots:</strong> {laneCapacitySummary.current_org_total_queued_lots}</Typography>
              <Typography variant="body2"><strong>System Live / Open:</strong> {laneCapacitySummary.current_system_live_sessions ?? 0} / {laneCapacitySummary.current_system_open_sessions ?? 0}</Typography>
              <Typography variant="body2"><strong>System Queued Lots:</strong> {laneCapacitySummary.current_system_total_queued_lots ?? 0}</Typography>
              <Typography variant="body2"><strong>Average Queue per Lane:</strong> {laneCapacitySummary.average_queue_per_lane}</Typography>
              <Typography variant="body2"><strong>Overloaded Lanes:</strong> {laneCapacitySummary.overloaded_lane_count}</Typography>
              <Typography variant="body2"><strong>Can Create New Lane?:</strong> {laneCapacitySummary.can_create_new_lane ? "Yes" : "No"}</Typography>
              <Typography variant="body2"><strong>Guard State:</strong> {laneCapacitySummary.capacity_guard_state || "GREEN"}</Typography>
            </Box>
            {!laneCapacitySummary.can_create_new_lane && (
              <Alert severity="warning">
                {laneCapacitySummary.blocking_reason || "Lane creation is currently blocked by configured auction capacity limits."}
              </Alert>
            )}
          </Stack>
        </Paper>
      )}

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1} mb={2}>
          <Typography variant="subtitle2" color="text.secondary">
            Filter Auction Lots
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="text" onClick={clearFilters}>
              Clear
            </Button>
            <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading}>
              Apply / Refresh
            </Button>
          </Stack>
        </Stack>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(180px, 1fr))", lg: "repeat(4, minmax(180px, 1fr))" },
            gap: 1.5,
          }}
        >
          {uiConfig.role === "SUPER_ADMIN" && (
            <TextField
              select
              label="Organisation"
              size="small"
              value={filters.org_code}
              onChange={(e) => updateFilter("org_code", e.target.value)}
              fullWidth
            >
              <MenuItem value="">All</MenuItem>
              {orgOptions.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
          )}

          <TextField
            select
            label="Mandi"
            size="small"
            value={filters.mandi_code}
            onChange={(e) => updateFilter("mandi_code", e.target.value)}
            fullWidth
          >
            <MenuItem value="">All</MenuItem>
            {mandiOptions.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField label="Session ID" size="small" value={filters.session_id} onChange={(e) => updateFilter("session_id", e.target.value)} fullWidth />
          <TextField label="Commodity" size="small" value={filters.commodity} onChange={(e) => updateFilter("commodity", e.target.value)} fullWidth />
          <TextField label="Product" size="small" value={filters.product} onChange={(e) => updateFilter("product", e.target.value)} fullWidth />
          <TextField
            select
            label="Lot Status"
            size="small"
            value={filters.lot_status}
            onChange={(e) => updateFilter("lot_status", e.target.value)}
            fullWidth
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="QUEUED">Queued</MenuItem>
            <MenuItem value="LIVE">Live</MenuItem>
            <MenuItem value="SOLD">Sold</MenuItem>
            <MenuItem value="UNSOLD">Unsold</MenuItem>
            <MenuItem value="CANCELLED">Cancelled</MenuItem>
          </TextField>
          <TextField
            label="Date From"
            type="date"
            size="small"
            value={filters.date_from}
            onChange={(e) => updateFilter("date_from", e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
          <TextField
            label="Date To"
            type="date"
            size="small"
            value={filters.date_to}
            onChange={(e) => updateFilter("date_to", e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
          />
        </Box>
      </Paper>

      {actionError && <Alert severity="error" sx={{ mb: 2 }}>{actionError}</Alert>}
      {selectedRow?.session_status === "LIVE" && selectedRow?.session_no_active_lot && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No active lot currently selected in this live session.
          {selectedRow?.session_ready_to_close ? " This session is ready to close." : ""}
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        {loading && <LinearProgress />}
        <Box sx={{ p: 1.5, pb: 0 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Auction Lots List
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
            Historical rows are retained: older withdrawn attempts remain visible for audit, and remapped attempts appear as new rows. Actual End appears only after session closure.
          </Typography>
        </Box>
        {!showMandiInstruction && (
          <Box sx={{ px: 1.5, pb: 1.5 }}>
            <ResponsiveDataGrid
              rows={rows}
              columns={columns}
              loading={loading}
              getRowId={(r) => r.id}
              disableRowSelectionOnClick
              pageSizeOptions={[25, 50, 100]}
              initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
              minWidth={960}
              onRowClick={(params) => setSelectedRow(params.row as LotRow)}
              sx={{
                "& .MuiDataGrid-row": { cursor: "pointer" },
                "& .MuiDataGrid-row:hover": { backgroundColor: "rgba(47,166,82,0.05)" },
                "& .MuiDataGrid-columnHeaders": { position: "sticky", top: 0, zIndex: 1 },
                "& .MuiDataGrid-cell": { display: "flex", alignItems: "center" },
              }}
            />
          </Box>
        )}
      </Paper>

      {showMandiInstruction && (
        <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 2, bgcolor: "rgba(47,166,82,0.04)" }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            Select a mandi to continue
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Choose a mandi in filters to load auction lots and sessions for operations.
          </Typography>
        </Paper>
      )}

      {showNoRowsForFilters && (
        <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            No auction lots found for selected filters
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Verify lots first and map them to an active auction session, then refresh this page.
          </Typography>
        </Paper>
      )}

      {openCreate && (
        <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="md">
          <DialogTitle>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Create Auction Lot</Typography>
              <IconButton size="small" onClick={() => { setHelpTitle("Create Auction Lot Help"); setOpenHelp(true); }}>
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent>
            {createOptionsLoading && <LinearProgress sx={{ mb: 2 }} />}
            <Stack spacing={2} mt={1}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                  Section A — Source Lot
                </Typography>
                <TextField
                  select
                  label="Select VERIFIED Lot"
                  size="small"
                  value={createForm.lot_id}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCreateForm((prev) => ({ ...prev, lot_id: value, session_id: "" }));
                    const next = lotOptions.find((l) => l.value === value);
                    setSelectedLot(next?.lot || null);
                  }}
                  fullWidth
                >
                  <MenuItem value="">Select</MenuItem>
                  {lotOptions.map((l) => (
                    <MenuItem key={l.value} value={l.value}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%" }}>
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {l.label}
                        </Typography>
                        {l.shortCode && (
                          <Typography variant="caption" color="text.secondary">
                            #{l.shortCode}
                          </Typography>
                        )}
                      </Stack>
                    </MenuItem>
                  ))}
                </TextField>
                {!createOptionsLoading && lotOptions.length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    No VERIFIED lots available. Complete lot verification first.
                  </Typography>
                )}

                {selectedLot && (
                  <Paper variant="outlined" sx={{ mt: 1.5, p: 1.5, borderRadius: 1.5, bgcolor: "rgba(47,166,82,0.03)" }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Selected Lot Summary
                    </Typography>
                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                        gap: 1,
                      }}
                    >
                      <Typography variant="body2"><strong>Party:</strong> {selectedLot?.party?.ref || selectedLot?.party?.username || selectedLot?.party_username || selectedLot?.party_ref || selectedLot?.farmer_username || selectedLot?.trader_username || "-"}</Typography>
                      <Typography variant="body2"><strong>Token / Lot:</strong> {selectedLot?.token_code || selectedLot?.lot_code || selectedLot?._id || "-"}</Typography>
                      <Typography variant="body2"><strong>Commodity:</strong> {selectedLot?.commodity_name_en || selectedLot?.commodity_name || selectedLot?.commodity || selectedLot?.commodity_code || selectedLot?.commodity_id || "-"}</Typography>
                      <Typography variant="body2"><strong>Product:</strong> {selectedLot?.product_name_en || selectedLot?.commodity_product_name_en || selectedLot?.product || selectedLot?.product_code || selectedLot?.commodity_product_id || "-"}</Typography>
                      <Typography variant="body2"><strong>Bags:</strong> {selectedLot?.quantity?.bags ?? selectedLot?.bags ?? "-"}</Typography>
                      <Typography variant="body2"><strong>Weight/Bag:</strong> {selectedLot?.quantity?.weight_per_bag_kg ?? selectedLot?.weight_per_bag_kg ?? "-"} kg</Typography>
                      <Typography variant="body2"><strong>Total Weight:</strong> {selectedTotalKg != null ? `${formatInr(selectedTotalKg)} kg` : "-"}</Typography>
                      <Typography variant="body2"><strong>Gate / Mandi:</strong> {selectedLot?.gate_code || selectedLot?.gate?.code || "-"} / {selectedLot?.mandi_name || selectedLot?.mandi_name_en || selectedLot?.mandi_code || selectedLot?.mandi_id || "-"}</Typography>
                    </Box>
                  </Paper>
                )}
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                  Section B — Auction Lane
                </Typography>
                <TextField
                  select
                  label="Auction Lane"
                  size="small"
                  value={createForm.session_id}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, session_id: e.target.value }))}
                  SelectProps={{ onOpen: loadSessionsForDropdown }}
                  onClick={loadSessionsForDropdown}
                  fullWidth
                >
                  <MenuItem value="">Select</MenuItem>
                  {sessionOptions.map((s) => (
                    <MenuItem
                      key={s.value}
                      value={s.value}
                      sx={s.session?.suggested_for_selected_lot ? { bgcolor: "rgba(110, 124, 58, 0.08)" } : undefined}
                    >
                      <Stack spacing={0.35} sx={{ py: 0.3, width: "100%" }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {s.session?.session_name || s.session?.session_code || s.label}
                          </Typography>
                          {s.session?.suggested_for_selected_lot && (
                            <Chip size="small" color="success" label="Suggested" />
                          )}
                          {s.session?.is_overflow_lane && (
                            <Chip size="small" color="warning" variant="outlined" label="Overflow" />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          Commodity Group: {s.session?.commodity_group || "-"} · Lane Type: {humanizeLaneType(s.session?.lane_type)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Queue: {s.session?.queued_count ?? 0} · Active: {s.session?.active_lot_code || "-"} · Status: {s.session?.status_display || s.session?.derived_status || s.session?.status || "-"} · Overflow: {s.session?.is_overflow_lane ? "Yes" : "No"}
                        </Typography>
                        {s.session?.suggestion_reason && (
                          <Typography variant="caption" sx={{ color: "success.main", fontWeight: 600 }}>
                            {s.session.suggested_for_selected_lot ? `Best match for selected lot · ${s.session.suggestion_reason}` : s.session.suggestion_reason}
                          </Typography>
                        )}
                      </Stack>
                    </MenuItem>
                  ))}
                </TextField>
                {!canSessionsList && (
                  <Alert severity="error" sx={{ mt: 1.25 }}>
                    Missing permission: `auction_sessions.list` (VIEW). Session list cannot be loaded.
                  </Alert>
                )}
                {selectedLot && sessionOptions.length === 0 && (
                  <Alert severity="info" sx={{ mt: 1.25 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1}>
                      <Typography variant="body2">No active auction lane is available for this mandi. Please create a lane before mapping this lot.</Typography>
                      <Button variant="outlined" size="small" onClick={() => setOpenCreateSession(true)} disabled={!laneCapacitySummary.can_create_new_lane}>
                        Create Session
                      </Button>
                    </Stack>
                  </Alert>
                )}
                {selectedCreateSession && (
                  <Paper variant="outlined" sx={{ mt: 1.25, p: 1.5, borderRadius: 1.5, bgcolor: "background.paper" }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      Selected Lane Summary
                    </Typography>
                    <Stack spacing={0.6}>
                      <Typography variant="body2"><strong>Lane Name:</strong> {selectedCreateSession.session_name || selectedCreateSession.session_code || "—"}</Typography>
                      <Typography variant="body2"><strong>Type:</strong> {humanizeLaneType(selectedCreateSession.lane_type)}</Typography>
                      <Typography variant="body2"><strong>Commodity:</strong> {selectedCreateSession.commodity_group || "—"}</Typography>
                      <Typography variant="body2"><strong>Status:</strong> {selectedCreateSession.status_display || selectedCreateSession.derived_status || selectedCreateSession.status || "—"}</Typography>
                      <Typography variant="body2"><strong>Queued Count:</strong> {selectedCreateSession.queued_count ?? 0}</Typography>
                      <Typography variant="body2"><strong>Active Lot:</strong> {selectedCreateSession.active_lot_code || "—"}</Typography>
                      <Typography variant="body2"><strong>Next Queued Lot:</strong> {selectedCreateSession.next_queued_lot_code || "—"}</Typography>
                      <Typography variant="body2"><strong>Ready to Close:</strong> {selectedCreateSession.ready_to_close ? "Yes" : "No"}</Typography>
                    </Stack>
                    {selectedCreateSession.overloaded && (
                      <Alert severity="warning" sx={{ mt: 1.25 }}>
                        {selectedCreateSession.overload_reason || "Queue exceeds configured limit. Consider creating an overflow lane."}
                      </Alert>
                    )}
                  </Paper>
                )}
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                  Section C — Pricing
                </Typography>
                <TextField
                  label="Opening Price (₹/qtl)"
                  size="small"
                  type="number"
                  value={createForm.base_price}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, base_price: e.target.value }))}
                  helperText="Opening bid rate for this lot (per quintal)."
                  inputProps={{ step: "0.01", min: "0" }}
                  fullWidth
                />
                {selectedLot && openingRatePerQtl != null && (
                  <Paper variant="outlined" sx={{ mt: 1.25, p: 1.25, borderRadius: 1.5 }}>
                    <Typography variant="body2" color="text.secondary">
                      Rate/kg: <strong>₹{formatInr(openingRatePerQtl / 100)}</strong> · Quantity:{" "}
                      <strong>{selectedTotalKg != null ? `${formatInr(selectedTotalKg)} kg` : "—"}</strong> · Estimated lot opening value:{" "}
                      <strong>₹{formatInr(selectedEstimatedValue)}</strong>
                    </Typography>
                  </Paper>
                )}
              </Paper>

              {createError && <Alert severity="error">{createError}</Alert>}
              {import.meta.env.DEV && (
                <Typography variant="caption" color="text.secondary">
                  lot_id={createForm.lot_id || "—"} | session_id={createForm.session_id || "—"} | opening_price={createBasePriceRaw || "—"} | valid={String(createSubmitValid)} | disabled={String(createSubmitDisabled)}
                </Typography>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenCreate(false)} disabled={createLoading}>Close</Button>
            <Button
              variant="contained"
              onClick={handleCreateSubmit}
              disabled={createSubmitDisabled}
            >
              {createLoading ? "Submitting..." : "Submit"}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {openCreateSession && (
        <Dialog open={openCreateSession} onClose={() => setOpenCreateSession(false)} fullWidth maxWidth="md">
          <DialogTitle>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Create Session</Typography>
              <IconButton size="small" onClick={() => { setHelpTitle("Create Auction Lane Help"); setOpenHelp(true); }}>
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                  Section A — Session Context
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 1.5,
                  }}
                >
                  <TextField
                    label="Organisation"
                    size="small"
                    value={selectedLot?.org_name || selectedLot?.org_name_en || selectedLot?.org_code || selectedLot?.org_id || ""}
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />
                  <TextField
                    label="Mandi"
                    size="small"
                    value={selectedLot?.mandi_name || selectedLot?.mandi_name_en || selectedLot?.mandi_code || selectedLot?.mandi_id || ""}
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />
                  <TextField
                    select
                    label="Method"
                    size="small"
                    value={createSessionForm.method_code}
                    onChange={(e) => setCreateSessionForm((prev) => ({ ...prev, method_code: e.target.value }))}
                    fullWidth
                  >
                    <MenuItem value="OPEN_OUTCRY">OPEN_OUTCRY</MenuItem>
                    <MenuItem value="E_AUCTION">E_AUCTION</MenuItem>
                  </TextField>
                  <TextField
                    select
                    label="Rounds Enabled"
                    size="small"
                    SelectProps={{
                      multiple: true,
                      value: createSessionForm.rounds_enabled,
                      onChange: (e) => {
                        const value = e.target.value;
                        setCreateSessionForm((prev) => ({
                          ...prev,
                          rounds_enabled: Array.isArray(value) ? value : String(value).split(","),
                        }));
                      },
                    }}
                    fullWidth
                  >
                    <MenuItem value="PREVIEW">PREVIEW</MenuItem>
                    <MenuItem value="ROUND1">ROUND1</MenuItem>
                    <MenuItem value="ROUND2">ROUND2</MenuItem>
                    <MenuItem value="FINAL">FINAL</MenuItem>
                  </TextField>
                </Box>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                  Section B — Auction Lane Details
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                    gap: 1.5,
                  }}
                >
                  <TextField
                    label="Session Code"
                    size="small"
                    value={createSessionForm.session_code}
                    onChange={(e) => setCreateSessionForm((prev) => ({ ...prev, session_code: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Lane Name"
                    size="small"
                    value={createSessionForm.session_name}
                    onChange={(e) => setCreateSessionForm((prev) => ({ ...prev, session_name: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    select
                    label="Lane Type"
                    size="small"
                    value={createSessionForm.lane_type}
                    onChange={(e) => setCreateSessionForm((prev) => ({ ...prev, lane_type: e.target.value }))}
                    fullWidth
                  >
                    <MenuItem value="COMMODITY_LANE">Commodity Lane</MenuItem>
                    <MenuItem value="PREMIUM_LANE">Premium Lane</MenuItem>
                    <MenuItem value="FAST_TRACK_LANE">Fast Track Lane</MenuItem>
                    <MenuItem value="BULK_LANE">Bulk Lane</MenuItem>
                    <MenuItem value="OVERFLOW_LANE">Overflow Lane</MenuItem>
                    <MenuItem value="SPECIAL_EVENT_LANE">Special Event Lane</MenuItem>
                  </TextField>
                  <TextField
                    label="Commodity Group"
                    size="small"
                    value={createSessionForm.commodity_group}
                    onChange={(e) => setCreateSessionForm((prev) => ({ ...prev, commodity_group: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Internal Commodity Code"
                    size="small"
                    value={createSessionForm.commodity_group_code}
                    onChange={(e) => setCreateSessionForm((prev) => ({ ...prev, commodity_group_code: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Hall / Zone"
                    size="small"
                    value={createSessionForm.hall_or_zone}
                    onChange={(e) => setCreateSessionForm((prev) => ({ ...prev, hall_or_zone: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Auctioneer / Operator Username"
                    size="small"
                    value={createSessionForm.auctioneer_username}
                    onChange={(e) => setCreateSessionForm((prev) => ({ ...prev, auctioneer_username: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    select
                    label="Is Overflow Lane?"
                    size="small"
                    value={createSessionForm.is_overflow_lane ? "Y" : "N"}
                    onChange={(e) => setCreateSessionForm((prev) => ({ ...prev, is_overflow_lane: e.target.value === "Y" }))}
                    fullWidth
                  >
                    <MenuItem value="N">No</MenuItem>
                    <MenuItem value="Y">Yes</MenuItem>
                  </TextField>
                  <TextField
                    label="Max Queue Size"
                    size="small"
                    type="number"
                    value={createSessionForm.max_queue_size}
                    onChange={(e) => setCreateSessionForm((prev) => ({ ...prev, max_queue_size: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    label="Screen Order"
                    size="small"
                    type="number"
                    value={createSessionForm.display_order}
                    onChange={(e) => setCreateSessionForm((prev) => ({ ...prev, display_order: e.target.value }))}
                    fullWidth
                  />
                </Box>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                  Section C — Closure Plan
                </Typography>
                <Stack spacing={1.5}>
                  <TextField
                    select
                    label="Closure Mode"
                    size="small"
                    value={createSessionForm.closure_mode}
                    onChange={(e) => setCreateSessionForm((prev) => ({ ...prev, closure_mode: e.target.value }))}
                    fullWidth
                  >
                    <MenuItem value="MANUAL_ONLY">MANUAL_ONLY</MenuItem>
                    <MenuItem value="AUTO_AT_END_TIME">AUTO_AT_END_TIME</MenuItem>
                    <MenuItem value="MANUAL_OR_AUTO">MANUAL_OR_AUTO</MenuItem>
                  </TextField>
                  <Typography variant="caption" color="text.secondary">
                    {closureModeHelperText(createSessionForm.closure_mode)}
                  </Typography>
                  <Divider />
                  <Box
                    sx={{
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                      gap: 1.5,
                    }}
                  >
                    <TextField
                      label="Scheduled Start (optional)"
                      type="datetime-local"
                      size="small"
                      value={createSessionForm.scheduled_start_time}
                      onChange={(e) => setCreateSessionForm((prev) => ({ ...prev, scheduled_start_time: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                    />
                    <TextField
                      label="Scheduled End"
                      type="datetime-local"
                      required={createSessionRequiresEnd}
                      size="small"
                      value={createSessionForm.scheduled_end_time}
                      onChange={(e) => setCreateSessionForm((prev) => ({ ...prev, scheduled_end_time: e.target.value }))}
                      InputLabelProps={{ shrink: true }}
                      fullWidth
                    />
                  </Box>
                  {createSessionForm.closure_mode === "AUTO_AT_END_TIME" && (
                    <TextField
                      select
                      label="Allow Manual Close"
                      size="small"
                      value={createSessionForm.allow_manual_close_when_auto_enabled ? "Y" : "N"}
                      onChange={(e) =>
                        setCreateSessionForm((prev) => ({
                          ...prev,
                          allow_manual_close_when_auto_enabled: e.target.value === "Y",
                        }))
                      }
                      fullWidth
                    >
                      <MenuItem value="Y">Yes</MenuItem>
                      <MenuItem value="N">No</MenuItem>
                    </TextField>
                  )}
                  <TextField
                    label="Notes"
                    size="small"
                    value={createSessionForm.notes}
                    onChange={(e) => setCreateSessionForm((prev) => ({ ...prev, notes: e.target.value }))}
                    multiline
                    minRows={3}
                    fullWidth
                  />
                </Stack>
              </Paper>

              {createSessionError && <Alert severity="error">{createSessionError}</Alert>}
              {!laneCapacitySummary.can_create_new_lane && (
                <Alert severity="warning">
                  Maximum open or live auction lanes have reached the configured mandi limit.
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenCreateSession(false)} disabled={createSessionLoading}>
              Close
            </Button>
            <Button variant="contained" onClick={handleCreateSession} disabled={createSessionLoading || !createSessionForm.session_name || !laneCapacitySummary.can_create_new_lane}>
              {createSessionLoading ? "Creating..." : "Create Session"}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <ScreenHelpDrawer
        open={openHelp}
        onClose={() => setOpenHelp(false)}
        route="/auction-lots"
        language={language}
        title={helpTitle}
      />
    </PageContainer>
  );
};
