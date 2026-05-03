import React, { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
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
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import VisibilityIcon from "@mui/icons-material/Visibility";
import EditIcon from "@mui/icons-material/Edit";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
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
import { createAuctionSession, finalizeAuctionResult, getAuctionLots, getAuctionSessions, startAuctionLot, updateQueuedAuctionLot, withdrawQueuedAuctionLot } from "../../services/auctionOpsApi";
import { updateOrgAuctionCapacityAllocation } from "../../services/systemCapacityControlApi";
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
  lane_name?: string | null;
  lane_type?: string | null;
  commodity_group?: string | null;
  queue_position?: number | null;
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
  product_start_time?: string | null;
  product_end_time?: string | null;
  product_schedule_status?: string | null;
  session_closure_mode?: string | null;
  session_status?: string | null;
  session_auto_start_state?: "PENDING" | "OVERDUE" | string | null;
  session_auto_start_label?: string | null;
  session_auto_start_reason?: string | null;
  queue_reason?: string | null;
  queue_reason_message?: string | null;
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
  rank_meta?: {
    isCompatible: boolean;
    rank: number;
    queueAvailable: boolean;
    queueRemaining: number | null;
    why: string;
  };
};
type LotOption = { value: string; label: string; shortCode?: string; lot: any };
type CapacitySummary = {
  testing_mode_enabled: boolean;
  org_allocation_configured: boolean;
  no_org_allocation_message: string | null;
  can_create_new_lane: boolean;
  auction_lanes_enabled: boolean;
  guard_enabled: boolean;
  guard_state: string;
  blocking_reason?: string | null;
  org_allocation: {
    allocated_max_live_lanes: number;
    allocated_max_open_lanes: number;
    allocated_max_queued_lots: number;
    allocated_max_concurrent_bidders: number;
  };
  org_usage: {
    used_live_lanes: number;
    used_open_lanes: number;
    used_queued_lots: number;
    used_concurrent_bidders: number;
  };
  org_remaining: {
    remaining_live_lanes: number;
    remaining_open_lanes: number;
    remaining_queued_lots: number;
    remaining_concurrent_bidders: number;
  };
  mandi_effective: {
    max_live_lanes: number;
    max_open_lanes: number;
    max_queue_per_lane: number;
  };
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

const firstNonEmpty = (...values: any[]) => {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
};

const buildLotLabel = (lot: any) => {
  const partyDisplay = firstNonEmpty(
    lot?.party_contact,
    lot?.party_mobile,
    lot?.farmer_mobile,
    lot?.party_display_name,
    lot?.party?.username,
    lot?.party_ref,
    lot?.farmer_username,
    lot?.trader_username,
    `${lot?.party_type || ""} ${lot?.party_ref || ""}`.trim(),
    "-"
  );

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
  const quality = lot?.quality_grade || "-";
  const lotSeq = lot?.lot_seq || lot?.lot_sequence || lot?.lot_no || lot?.lot_number || "-";

  const qtyPart =
    bags !== null && weightPerBag !== null
      ? `${bags}x${weightPerBag}kg (${totalWeight ?? "-"}kg)`
      : totalWeight !== null
      ? `${totalWeight}kg`
      : "-";

  const previousStatus = String(lot?.previous_attempt_status || "").trim().toUpperCase();
  const isReauctionEligible = String(lot?.reauction_eligible || "").toUpperCase() === "Y";
  const reauctionBadge = isReauctionEligible
    ? ` \u2022 Re-auction eligible${previousStatus ? ` \u2022 Previous attempt ${previousStatus.toLowerCase()}` : ""}`
    : "";
  const label = `${partyDisplay} \u2022 ${commodity}/${product} \u2022 ${qtyPart} \u2022 ${quality} \u2022 ${gateCode} \u2022 #${lotSeq}${reauctionBadge}`;
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

const normalizeLaneTextUpper = (value: any) => String(value || "").trim().toUpperCase();

const toDateTimeLocal = (date: Date) => {
  const pad = (num: number) => String(num).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const roundToNearestFiveMinutes = (value: Date) => {
  const d = new Date(value);
  d.setSeconds(0, 0);
  const rounded = Math.ceil(d.getMinutes() / 5) * 5;
  d.setMinutes(rounded);
  return d;
};

function normalizeCommodityGroupCode(value: any): string {
  const raw = String(value || "").trim();
  if (!raw) return "";
  return raw
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function resolveLotCommodityGroup(lot: any) {
  const rawCodeOrSlug = String(
    lot?.commodity_group_code
    || lot?.commodity_group
    || lot?.commodity_slug
    || lot?.commodity
    || lot?.commodity_name_en
    || "",
  ).trim();
  const label = String(
    lot?.commodity_group
    || lot?.commodity
    || lot?.commodity_name_en
    || lot?.commodity_slug
    || "Selected Commodity",
  ).trim();
  return {
    codeOrSlug: rawCodeOrSlug || "",
    label: label || "Selected Commodity",
    normalizedCode: normalizeCommodityGroupCode(rawCodeOrSlug || label),
  };
}

const defaultScheduledEndLocal = (durationMinutes = 120) =>
  toDateTimeLocal(new Date(Date.now() + Math.max(1, durationMinutes) * 60 * 1000));

const toDateTimeInputValue = (value?: string | Date | null) => {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return toDateTimeLocal(date);
};

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

const normalizeLaneType = (value: any): string => {
  const key = String(value || "").trim().toUpperCase();
  return key || "COMMODITY_LANE";
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

const formatDurationHms = (diffMs: number) => {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
};

const normalizeSessionStatus = (value: string | null | undefined) => {
  const key = String(value || "").trim().toUpperCase();
  if (["PLANNED", "LIVE", "PAUSED", "CLOSED", "CANCELLED"].includes(key)) return key;
  return "";
};

const isProductWindowEnded = (productEndTime: string | null | undefined, nowMs: number) => {
  if (!productEndTime) return false;
  const parsed = new Date(productEndTime);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.getTime() <= nowMs;
};

const getEffectiveLotDisplayStatus = (
  lotStatus: string | null | undefined,
  productEndTime: string | null | undefined,
  nowMs: number,
): "LIVE" | "QUEUED" | "SOLD" | "UNSOLD" | "WITHDRAWN" | "READY_TO_CLOSE" | string => {
  const normalized = String(lotStatus || "").trim().toUpperCase();
  if (normalized === "WITHDRAWN") return "WITHDRAWN";
  if (normalized === "LIVE" && isProductWindowEnded(productEndTime, nowMs)) return "READY_TO_CLOSE";
  return normalized || "—";
};

const getTimeLeftPresentation = (
  lotStatus: string | null | undefined,
  sessionStatus: string | null | undefined,
  scheduledEnd: string | null | undefined,
  productEndTime: string | null | undefined,
  productStartTime: string | null | undefined,
  queueReason: string | null | undefined,
  nowMs: number
) => {
  const lot = String(lotStatus || "").trim().toUpperCase();
  const status = normalizeSessionStatus(sessionStatus);
  const isTerminalLotStatus = [
    "WITHDRAWN",
    "CANCELLED",
    "SOLD",
    "UNSOLD",
    "EXPIRED",
    "CLOSED",
    "FINALIZED",
    "SETTLED",
  ].includes(lot);
  if (lot === "WITHDRAWN") return { label: "Withdrawn", tone: "muted" as const };
  if (isTerminalLotStatus) return { label: "—", tone: "muted" as const };
  if (lot === "LIVE" && isProductWindowEnded(productEndTime, nowMs)) return { label: "Ended / Awaiting Close", tone: "error" as const };

  if (lot === "QUEUED") {
    const queueReasonCode = String(queueReason || "").trim().toUpperCase();
    if (queueReasonCode === "WAITING_FOR_PRODUCT_WINDOW") {
      const start = productStartTime ? new Date(productStartTime) : null;
      if (start && !Number.isNaN(start.getTime())) {
        const diffMs = start.getTime() - nowMs;
        if (diffMs > 0) return { label: `Starts in ${formatDurationHms(diffMs)}`, tone: "warning" as const };
        return { label: `Scheduled start: ${formatDate(start) || "—"}`, tone: "muted" as const };
      }
      return { label: "Queued", tone: "warning" as const };
    }
    return { label: "Queued", tone: "warning" as const };
  }

  if (!["LIVE", "IN_AUCTION", "MAPPED_TO_AUCTION"].includes(lot)) {
    return { label: "—", tone: "muted" as const };
  }

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

const queueReasonLabel = (code: string | null | undefined, fallbackMessage?: string | null) => {
  const normalized = String(code || "").trim().toUpperCase();
  if (normalized === "WAITING_FOR_PRODUCT_WINDOW") return "Waiting for product window.";
  if (normalized === "CAPACITY_CAP") return "Capacity limit reached. Lot is queued until lane capacity is available.";
  if (normalized === "LIVE_CAPACITY_FULL") return "Live capacity is full. Lot is queued.";
  if (normalized === "OPEN_LANE_CAPACITY_FULL") return "Open lane capacity is full. Lot is queued.";
  if (normalized === "MANDI_CAPACITY_FULL") return "Mandi capacity is full. Lot is queued.";
  if (normalized === "ORG_CAPACITY_FULL") return "Organisation capacity is full. Lot is queued.";
  if (normalized === "PLATFORM_CAPACITY_FULL") return "Platform capacity is full. Lot is queued.";
  if (normalized === "WAITING_FOR_ACTIVE_LOT_TO_CLOSE") return "Waiting for active lot to close in this lane.";
  return String(fallbackMessage || "").trim() || "Queued";
};

const capacityCapDetailedMessage = (summary: CapacitySummary) => {
  const usedOpen = Number(summary.org_usage.used_open_lanes || 0);
  const allocatedOpen = Number(summary.org_allocation.allocated_max_open_lanes || 0);
  const usedLive = Number(summary.org_usage.used_live_lanes || 0);
  const allocatedLive = Number(summary.org_allocation.allocated_max_live_lanes || 0);
  const mandiOpen = Number(summary.mandi_effective.max_open_lanes || 0);
  const mandiLive = Number(summary.mandi_effective.max_live_lanes || 0);
  const openDeficit = Math.max(0, usedOpen + 1 - Math.max(allocatedOpen, 0));
  const liveDeficit = Math.max(0, usedLive + 1 - Math.max(allocatedLive, 0));
  const requiredOpen = Math.max(5, usedOpen + 1);
  const requiredLive = Math.max(3, usedLive + 1);
  return `Cannot auto-start this lot because org open lanes are full: ${usedOpen} used / ${allocatedOpen} allocated. Org live lanes: ${usedLive} used / ${allocatedLive} allocated. Mandi effective limits: open ${mandiOpen}, live ${mandiLive}. Required additional capacity: open +${openDeficit}, live +${liveDeficit}. Increase Section F → Allocated Max Open and Allocated Max Live for this org, or close an existing lane. Suggested testing target: Allocated Max Open at least ${requiredOpen} and Allocated Max Live at least ${requiredLive}.`;
};

export const AuctionLots: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const [openCreate, setOpenCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createAssignLoading, setCreateAssignLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);
  const [testCapacityLoading, setTestCapacityLoading] = useState(false);
  const [createOptionsLoading, setCreateOptionsLoading] = useState(false);
  const [sourceLotSearch, setSourceLotSearch] = useState("");
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
    auto_assign_lane: true,
    session_id: "",
    lot_id: "",
    base_price: "",
    product_start_time: "",
    product_end_time: "",
  });
  const [openCreateAssignConfirm, setOpenCreateAssignConfirm] = useState(false);
  const [createAssignForm, setCreateAssignForm] = useState({
    lane_name: "",
    lane_type: "COMMODITY_LANE",
    scheduled_start_time: "",
    scheduled_end_time: "",
    max_queue_size: "25",
  });

  const persistedScope = readAuctionScope();
  const [filters, setFilters] = useState({
    org_code: persistedScope.org_code || "",
    mandi_code: persistedScope.mandi_code || "",
    commodity: "",
    product: "",
    session_id: "",
    lane: "",
    lane_type: "",
    commodity_group: "",
    lot_status: "",
    date_from: "",
    date_to: "",
  });
  const [rows, setRows] = useState<LotRow[]>([]);
  const [orgOptions, setOrgOptions] = useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasCapacitySummary, setHasCapacitySummary] = useState(false);
  const [selectedRow, setSelectedRow] = useState<LotRow | null>(null);
  const [openRowDialog, setOpenRowDialog] = useState(false);
  const [rowDialogMode, setRowDialogMode] = useState<"VIEW" | "EDIT">("VIEW");
  const [rowEditForm, setRowEditForm] = useState({
    estimated_qty_kg: "",
    start_price_per_qtl: "",
    reserve_price_per_qtl: "",
  });
  const [openHelp, setOpenHelp] = useState(false);
  const [helpTitle, setHelpTitle] = useState("Help");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [capacitySummary, setCapacitySummary] = useState<CapacitySummary>({
    testing_mode_enabled: false,
    org_allocation_configured: false,
    no_org_allocation_message: "No auction capacity allocation is configured for your organisation. Please configure System -> Capacity Control -> Section F.",
    can_create_new_lane: true,
    auction_lanes_enabled: true,
    guard_enabled: true,
    guard_state: "GREEN",
    blocking_reason: null,
    org_allocation: {
      allocated_max_live_lanes: 0,
      allocated_max_open_lanes: 0,
      allocated_max_queued_lots: 0,
      allocated_max_concurrent_bidders: 0,
    },
    org_usage: {
      used_live_lanes: 0,
      used_open_lanes: 0,
      used_queued_lots: 0,
      used_concurrent_bidders: 0,
    },
    org_remaining: {
      remaining_live_lanes: 0,
      remaining_open_lanes: 0,
      remaining_queued_lots: 0,
      remaining_concurrent_bidders: 0,
    },
    mandi_effective: {
      max_live_lanes: 0,
      max_open_lanes: 0,
      max_queue_per_lane: 0,
    },
  });
  const selectedSessionStatus = normalizeSessionStatus(String(selectedRow?.session_status || ""));
  const isSelectedSessionLive = selectedSessionStatus === "LIVE";
  const selectedRowEffectiveStatus = getEffectiveLotDisplayStatus(selectedRow?.status, selectedRow?.product_end_time, nowMs);
  const canStartSelectedLot = Boolean(selectedRow && isSelectedSessionLive && String(selectedRow.status || "").toUpperCase() === "QUEUED");
  const canFinalizeSelectedLot = Boolean(
    selectedRow &&
    isSelectedSessionLive &&
    (
      selectedRowEffectiveStatus === "READY_TO_CLOSE"
      || (String(selectedRow.status || "").toUpperCase() === "LIVE" && String(selectedRow.is_active_lot || "N").toUpperCase() === "Y")
    )
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
  const canCreateLaneInline = useMemo(
    () => can(uiConfig.resources, "auction_sessions.create", "CREATE")
      || can(uiConfig.resources, "auction_sessions.update", "UPDATE")
      || can(uiConfig.resources, "auction_lots.update", "UPDATE"),
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
  const autoAssignedCreateSession = useMemo(() => {
    if (!createForm.auto_assign_lane) return null;
    const bestCompatible = sessionOptions.find((opt) => Boolean(opt?.rank_meta?.isCompatible));
    return bestCompatible?.session || null;
  }, [createForm.auto_assign_lane, sessionOptions]);
  const autoAssignedSessionOption = useMemo(() => {
    if (!createForm.auto_assign_lane || !autoAssignedCreateSession) return null;
    return sessionOptions.find((opt) => String(opt?.value || "") === String(autoAssignedCreateSession?._id || autoAssignedCreateSession?.session_id || "")) || null;
  }, [createForm.auto_assign_lane, autoAssignedCreateSession, sessionOptions]);
  const effectiveCreateSession = createForm.auto_assign_lane ? autoAssignedCreateSession : selectedCreateSession;
  const resolvedLotCommodity = useMemo(() => resolveLotCommodityGroup(selectedLot || {}), [selectedLot]);
  const selectedLotCommodityGroup = useMemo(() => resolvedLotCommodity.label, [resolvedLotCommodity]);
  const selectedLaneCommodityGroup = useMemo(() => (
    String(
      effectiveCreateSession?.commodity_group
      || effectiveCreateSession?.commodity_group_code
      || "",
    ).trim()
  ), [effectiveCreateSession]);
  const selectedLaneCommodityMismatch = useMemo(() => {
    if (!effectiveCreateSession || !selectedLotCommodityGroup || !selectedLaneCommodityGroup) return false;
    const laneGroup = selectedLaneCommodityGroup.toUpperCase();
    const lotGroup = selectedLotCommodityGroup.toUpperCase();
    return !(laneGroup === lotGroup || laneGroup.includes(lotGroup) || lotGroup.includes(laneGroup));
  }, [effectiveCreateSession, selectedLotCommodityGroup, selectedLaneCommodityGroup]);
  const createBasePriceRaw = String(createForm.base_price || "").trim();
  const createBasePriceValid = /^\d+(\.\d{1,2})?$/.test(createBasePriceRaw) && Number(createBasePriceRaw) > 0;
  const selectedLaneStartTime = useMemo(() => toDateTimeInputValue(effectiveCreateSession?.scheduled_start_time || null), [effectiveCreateSession]);
  const selectedLaneEndTime = useMemo(() => toDateTimeInputValue(effectiveCreateSession?.scheduled_end_time || null), [effectiveCreateSession]);
  const selectedLaneStartDate = useMemo(() => {
    if (!effectiveCreateSession?.scheduled_start_time) return null;
    const parsed = new Date(effectiveCreateSession.scheduled_start_time);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [effectiveCreateSession]);
  const selectedLaneEndDate = useMemo(() => {
    if (!effectiveCreateSession?.scheduled_end_time) return null;
    const parsed = new Date(effectiveCreateSession.scheduled_end_time);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }, [effectiveCreateSession]);
  const productEndMinTime = useMemo(
    () => createForm.product_start_time || selectedLaneStartTime || undefined,
    [createForm.product_start_time, selectedLaneStartTime],
  );
  const selectedProductStart = useMemo(() => (createForm.product_start_time ? new Date(createForm.product_start_time) : null), [createForm.product_start_time]);
  const selectedProductEnd = useMemo(() => (createForm.product_end_time ? new Date(createForm.product_end_time) : null), [createForm.product_end_time]);
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
  const createSubmitValid = Boolean(createForm.lot_id && effectiveCreateSession && createBasePriceValid);
  const noOrgAllocationConfigured = !capacitySummary.testing_mode_enabled && !capacitySummary.org_allocation_configured;
  const orgAllocationWarning = capacitySummary.no_org_allocation_message
    || "No auction capacity allocation is configured for your organisation. Please configure System -> Capacity Control -> Section F.";
  const canCreateSessionWithinCapacity = Boolean(capacitySummary.can_create_new_lane && capacitySummary.auction_lanes_enabled);
  const capacityBlockingFull = useMemo(() => (
    !capacitySummary.testing_mode_enabled && (
    Number(capacitySummary.org_usage.used_open_lanes || 0) >= Number(capacitySummary.org_allocation.allocated_max_open_lanes || 0)
    || Number(capacitySummary.org_usage.used_live_lanes || 0) >= Number(capacitySummary.org_allocation.allocated_max_live_lanes || 0)
    || Number(capacitySummary.org_usage.used_open_lanes || 0) >= Number(capacitySummary.mandi_effective.max_open_lanes || 0)
    || Number(capacitySummary.org_usage.used_live_lanes || 0) >= Number(capacitySummary.mandi_effective.max_live_lanes || 0)
    || !Boolean(capacitySummary.can_create_new_lane)
    )
  ), [capacitySummary]);
  const showTestCapacityHelper = Boolean(import.meta.env.DEV || String(import.meta.env.VITE_ENABLE_TEST_CAPACITY_HELPER || "").toLowerCase() === "true");
  const noAutoCompatibleLane = Boolean(createForm.auto_assign_lane && selectedLot && !autoAssignedCreateSession);
  const createSubmitDisabled = createLoading || !createSubmitValid || noOrgAllocationConfigured || selectedLaneCommodityMismatch || noAutoCompatibleLane;
  const inlineLanePrefill = useMemo(() => {
    if (!selectedLot) return null;
    const start = roundToNearestFiveMinutes(new Date());
    const end = new Date(start.getTime() + 4 * 60 * 60 * 1000);
    const commodityGroup = String(resolvedLotCommodity?.label || "").trim();
    const commodityGroupCode = String(resolvedLotCommodity?.normalizedCode || "").trim();
    return {
      mandi_id: Number(selectedLot?.mandi_id ?? selectedLot?.mandi_id_value ?? 0) || null,
      mandi_name: selectedLot?.mandi_name || selectedLot?.mandi_name_en || selectedLot?.mandi_code || "",
      commodity_group: commodityGroup,
      commodity_group_code: commodityGroupCode || null,
      lane_name: commodityGroup ? `${commodityGroup} Lane` : "Commodity Lane",
      lane_type: "COMMODITY_LANE",
      method_code: "OPEN_OUTCRY",
      rounds_enabled: ["ROUND1"],
      scheduled_start_time: toDateTimeLocal(start),
      scheduled_end_time: toDateTimeLocal(end),
      max_queue_size: Number(capacitySummary?.mandi_effective?.max_queue_per_lane || 25) || 25,
      is_overflow_lane: false,
      auto_close_enabled: true,
      closure_mode: "MANUAL_OR_AUTO",
    };
  }, [selectedLot, capacitySummary, resolvedLotCommodity]);
  const createAssignMissingMandi = Boolean(selectedLot && !(inlineLanePrefill?.mandi_id));
  const createAssignMissingCommodity = Boolean(selectedLot && !inlineLanePrefill?.commodity_group && !inlineLanePrefill?.commodity_group_code);
  const createAssignPermissionDenied = !canCreateLaneInline;
  const createAssignDisabled = createAssignLoading || !selectedLot || createAssignMissingMandi || createAssignMissingCommodity || createAssignPermissionDenied;
  const createAssignDisableReason = !selectedLot
    ? null
    : createAssignMissingMandi
    ? "Cannot create lane: selected lot has no mandi."
    : createAssignMissingCommodity
    ? "Cannot create lane: commodity group is missing."
    : createAssignPermissionDenied
    ? "You do not have permission to create lane."
    : null;
  useEffect(() => {
    if (!openCreateAssignConfirm || !inlineLanePrefill) return;
    setCreateAssignForm({
      lane_name: inlineLanePrefill.lane_name || "",
      lane_type: inlineLanePrefill.lane_type || "COMMODITY_LANE",
      scheduled_start_time: inlineLanePrefill.scheduled_start_time || "",
      scheduled_end_time: inlineLanePrefill.scheduled_end_time || "",
      max_queue_size: String(inlineLanePrefill.max_queue_size || 25),
    });
  }, [openCreateAssignConfirm, inlineLanePrefill]);
  const noSingleMandiDefault = scopedMandiCodes.length > 1 || (scopedMandiCodes.length === 0 && mandiOptions.length > 1);
  const requiresMandiSelection = uiConfig.role !== "SUPER_ADMIN" && noSingleMandiDefault && !filters.mandi_code;
  const showMandiInstruction = !loading && requiresMandiSelection;
  const showNoRowsForFilters = !loading && !showMandiInstruction && rows.length === 0;
  const createSessionRequiresEnd =
    createSessionForm.closure_mode === "AUTO_AT_END_TIME" || createSessionForm.closure_mode === "MANUAL_OR_AUTO";

  const columns = useMemo<GridColDef<LotRow>[]>(
    () => [
      {
        field: "actions",
        headerName: "Actions",
        width: 220,
        sortable: false,
        filterable: false,
        renderCell: (params) => {
          const row = params.row;
          const lotStatus = String(row.status || "").toUpperCase();
          const sessionStatus = normalizeSessionStatus(String(row.session_status || ""));
          const isWithdrawn = lotStatus === "WITHDRAWN";
          const withdrawnTooltip = "This lot was withdrawn. Re-auction can be created from verified/source lot.";
          const canStart = lotStatus === "QUEUED" && sessionStatus === "LIVE";
          const canEdit = lotStatus === "QUEUED";
          return (
            <Stack direction="row" spacing={0.5}>
              <IconButton size="small" title="View lot details" onClick={() => openRowDialogFor(row, "VIEW")}>
                <VisibilityIcon fontSize="small" />
              </IconButton>
              <Tooltip title={isWithdrawn ? withdrawnTooltip : "Edit queued lot"}>
                <span>
                  <IconButton size="small" onClick={() => openRowDialogFor(row, "EDIT")} disabled={!canEdit}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={isWithdrawn ? withdrawnTooltip : "Withdraw from queue"}>
                <span>
                  <IconButton size="small" onClick={() => handleWithdrawQueuedLot(row)} disabled={!canEdit}>
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title={isWithdrawn ? withdrawnTooltip : "Start/Promote lot"}>
                <span>
                  <IconButton size="small" onClick={() => handleStartSelectedLot(row)} disabled={!canStart}>
                    <PlayArrowIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          );
        },
      },
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
          const displayStatus = getEffectiveLotDisplayStatus(params.row.status, params.row.product_end_time, nowMs);
          const sessionStatusForLot = normalizeSessionStatus(String(params.row.session_status || ""));
          const label = lotStatus === "WITHDRAWN" && sessionStatusForLot === "EXPIRED" ? "Expired" : displayStatus;
          const color =
            displayStatus === "LIVE"
              ? "success"
              : displayStatus === "READY_TO_CLOSE"
              ? "warning"
              : displayStatus === "QUEUED"
              ? "warning"
              : displayStatus === "SOLD"
              ? "success"
              : displayStatus === "WITHDRAWN"
              ? "default"
              : displayStatus === "UNSOLD"
              ? "default"
              : "default";
          const variant = displayStatus === "LIVE" ? "filled" : "outlined";
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
        width: 240,
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
            <Stack spacing={0.25} sx={{ py: 0.4 }}>
              <Chip
                size="small"
                label={label}
                color={color as "default" | "success" | "warning" | "error"}
                variant={variant}
              />
              {sessionStatus === "PLANNED" && params.row.session_auto_start_label && (
                <Typography variant="caption" color={String(params.row.session_auto_start_state || "").toUpperCase() === "OVERDUE" ? "error.main" : "text.secondary"}>
                  {params.row.session_auto_start_label}
                </Typography>
              )}
              {sessionStatus === "PLANNED" && params.row.session_auto_start_reason && String(params.row.session_auto_start_state || "").toUpperCase() === "OVERDUE" && (
                <Typography variant="caption" color="error.main">
                  {params.row.session_auto_start_reason}
                </Typography>
              )}
            </Stack>
          );
        },
      },
      {
        field: "queue_reason",
        headerName: "Queue Reason",
        width: 260,
        renderCell: (params) => {
          const lotStatus = String(params.row.status || "").toUpperCase();
          const effectiveStatus = getEffectiveLotDisplayStatus(params.row.status, params.row.product_end_time, nowMs);
          if (lotStatus === "WITHDRAWN") {
            return <Typography variant="body2" color="text.secondary">Withdrawn from auction</Typography>;
          }
          if (effectiveStatus === "READY_TO_CLOSE") {
            return <Typography variant="body2" color="warning.main">Product bidding window ended. Close/finalize this lot.</Typography>;
          }
          if (lotStatus !== "QUEUED") return <Typography variant="body2" color="text.secondary">—</Typography>;
          const code = params.row.queue_reason || null;
          const message = String(code || "").toUpperCase() === "CAPACITY_CAP" && hasCapacitySummary
            ? (capacitySummary.testing_mode_enabled
              ? "Testing mode is active. Lot remains queued until operational conditions allow auto-start."
              : `Org open ${capacitySummary.org_usage.used_open_lanes}/${capacitySummary.org_allocation.allocated_max_open_lanes}, live ${capacitySummary.org_usage.used_live_lanes}/${capacitySummary.org_allocation.allocated_max_live_lanes}. Increase Section F org allocation or close a lane.`)
            : queueReasonLabel(code, params.row.queue_reason_message);
          return (
            <Stack spacing={0.2} sx={{ py: 0.3 }}>
              <Typography variant="caption" sx={{ fontWeight: 700 }}>
                {code || "QUEUED"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {message}
              </Typography>
            </Stack>
          );
        },
      },
      {
        field: "time_left",
        headerName: "Time Left",
        width: 200,
        renderCell: (params) => {
          const timeLeft = getTimeLeftPresentation(
            params.row.status,
            params.row.session_status,
            params.row.session_scheduled_end_time,
            params.row.product_end_time,
            params.row.product_start_time,
            params.row.queue_reason,
            nowMs,
          );
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
        field: "product_start_time",
        headerName: "Product Start",
        width: 180,
        valueGetter: (_value, row) => formatDate((row as any)?.product_start_time) || "—",
      },
      {
        field: "product_end_time",
        headerName: "Product End",
        width: 180,
        valueGetter: (_value, row) => formatDate((row as any)?.product_end_time) || "—",
      },
      {
        field: "product_schedule_status",
        headerName: "Product Schedule",
        width: 170,
        valueGetter: (_value, row) => String((row as any)?.product_schedule_status || "—"),
      },
      {
        field: "closure_mode",
        headerName: "Closure Mode",
        width: 140,
        valueGetter: (_value, row) => closureModeLabel((row as any)?.session_closure_mode),
      },
      {
        field: "lane_name",
        headerName: "Lane Name",
        width: 220,
        valueGetter: (_value, row) => row.lane_name || row.session_name || row.session_code || "—",
      },
      {
        field: "lane_type",
        headerName: "Lane Type",
        width: 150,
        valueGetter: (_value, row) => humanizeLaneType(row.lane_type || row.session_lane_type),
      },
      {
        field: "commodity_group",
        headerName: "Commodity Group",
        width: 170,
        valueGetter: (_value, row) => row.commodity_group || row.session_commodity_group || "—",
      },
      {
        field: "queue_position",
        headerName: "Queue Position",
        width: 130,
        valueGetter: (_value, row) => row.queue_position ?? "—",
      },
      {
        field: "session_lane",
        headerName: "Lane Summary",
        width: 250,
        renderCell: (params) => (
          <Stack spacing={0.2} sx={{ py: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {params.row.lane_name || params.row.session_name || params.row.session_code || "—"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              [params.row.commodity_group || params.row.session_commodity_group, (params.row.lane_type || params.row.session_lane_type)?.replace(/_/g, " ")].filter(Boolean).join(" • ") || "—"
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
    let list = resp?.data?.mandis || resp?.response?.data?.mandis || [];
    if (uiConfig.role !== "SUPER_ADMIN" && scopedMandiCodes.length > 0) {
      const allowed = new Set(scopedMandiCodes.map((code) => String(code).toLowerCase()));
      list = list.filter((m: any) => {
        const code = String(m.mandi_slug || m.slug || m.mandi_code || "").toLowerCase();
        return allowed.has(code);
      });
    }
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
    const wantedLaneType = normalizeLaneType(lot?.lane_type) || "COMMODITY_LANE";
    const wantedCode = normalizeLaneTextUpper(
      lot?.commodity_group_code || lot?.commodity_code || "",
    );
    const wantedLabel = normalizeLaneTextUpper(
      lot?.commodity_group || lot?.commodity_name_en || lot?.commodity_name || lot?.commodity || "",
    );

    const ranked = sessions
      .map((s) => {
        const status = String(s?.derived_status || s?.status || "").toUpperCase();
        const sOrgId = s?.org_id ? String(s.org_id) : null;
        const sOrgCode = s?.org_code ? String(s.org_code) : null;
        const sMandiId = s?.mandi_id !== undefined && s?.mandi_id !== null ? Number(s.mandi_id) : null;
        const sMandiCode = s?.mandi_code ? String(s.mandi_code) : null;
        const orgMatch = orgId ? sOrgId === orgId : orgCode ? sOrgCode === orgCode : true;
        const mandiMatch = mandiId !== null ? sMandiId === mandiId : mandiCode ? sMandiCode === mandiCode : true;
        const laneType = normalizeLaneType(s?.lane_type);
        const laneCode = normalizeLaneTextUpper(s?.commodity_group_code);
        const laneLabel = normalizeLaneTextUpper(s?.commodity_group);
        const laneTypeMatch = laneType === wantedLaneType;
        const exactCodeMatch = Boolean(wantedCode && laneCode && wantedCode === laneCode);
        const exactLabelMatch = Boolean(wantedLabel && laneLabel && wantedLabel === laneLabel);
        const rank = exactCodeMatch ? 0 : exactLabelMatch ? 1 : 9;
        const queueLimit = Number(s?.max_queue_size || 0) > 0
          ? Number(s?.max_queue_size || 0)
          : Number(capacitySummary?.mandi_effective?.max_queue_per_lane || 25);
        const queuedCount = Number(s?.queued_count || 0);
        const queueRemaining = Number.isFinite(queueLimit) ? Math.max(0, queueLimit - queuedCount) : null;
        const queueAvailable = queueLimit <= 0 || queuedCount < queueLimit;
        const compatible = laneTypeMatch && (exactCodeMatch || exactLabelMatch);
        const endMs = s?.scheduled_end_time ? new Date(s.scheduled_end_time).getTime() : Number.MAX_SAFE_INTEGER;
        const why = exactCodeMatch
          ? "Exact commodity group code match"
          : exactLabelMatch
          ? "Exact commodity group match"
          : laneTypeMatch
          ? "Lane type matches but commodity group differs"
          : "Lane type mismatch";
        return {
          raw: s,
          status,
          orgMatch,
          mandiMatch,
          compatible,
          rank,
          queueAvailable,
          queueRemaining,
          queuedCount,
          queueLimit,
          endMs: Number.isFinite(endMs) ? endMs : Number.MAX_SAFE_INTEGER,
          why,
        };
      })
      .filter((entry) => entry.orgMatch && entry.mandiMatch && allowedStatuses.has(entry.status))
      .sort((a, b) => {
        if (a.rank !== b.rank) return a.rank - b.rank;
        if (a.queueAvailable !== b.queueAvailable) return Number(b.queueAvailable) - Number(a.queueAvailable);
        if (a.endMs !== b.endMs) return a.endMs - b.endMs;
        return Number(a.queuedCount || 0) - Number(b.queuedCount || 0);
      });

    if (import.meta.env.DEV) {
      console.debug("[AUCTION_LOTS][laneRankingUI]", {
        selected_lot_commodity_group: wantedLabel || null,
        selected_lot_commodity_group_code: wantedCode || null,
        candidates: ranked.map((entry) => ({
          session_id: entry?.raw?._id || entry?.raw?.session_id || null,
          session_name: entry?.raw?.session_name || entry?.raw?.session_code || null,
          lane_type: entry?.raw?.lane_type || null,
          commodity_group: entry?.raw?.commodity_group || null,
          commodity_group_code: entry?.raw?.commodity_group_code || null,
          rank: entry.rank,
          queue_available: entry.queueAvailable,
          queue_remaining: entry.queueRemaining,
          reason: entry.why,
        })),
      });
    }

    return ranked
      .map((entry: any) => ({
        value: entry.raw._id || entry.raw.session_id || "",
        label: [
          entry.raw.session_name || entry.raw.session_code || entry.raw._id || entry.raw.session_id || "",
          entry.raw.commodity_group ? `• ${entry.raw.commodity_group}` : "",
          entry.raw.lane_type ? `• ${humanizeLaneType(entry.raw.lane_type)}` : "",
        ].filter(Boolean).join(" "),
        session: entry.raw,
        rank_meta: {
          isCompatible: Boolean(entry.compatible),
          rank: Number(entry.rank),
          queueAvailable: Boolean(entry.queueAvailable),
          queueRemaining: entry.queueRemaining,
          why: entry.why,
        },
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
          lane: filters.lane || undefined,
          lane_type: filters.lane_type || undefined,
          commodity_group: filters.commodity_group || undefined,
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
        lane_name: item?.lane_name || item?.session?.session_name || item?.session_name || null,
        lane_type: item?.lane_type || item?.session?.lane_type || item?.session_lane_type || null,
        commodity_group: item?.commodity_group || item?.session?.commodity_group || item?.session_commodity_group || null,
        queue_position: item?.queue_position !== undefined && item?.queue_position !== null ? Number(item.queue_position) : null,
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
        product_start_time: item?.product_start_time || null,
        product_end_time: item?.product_end_time || null,
        product_schedule_status: item?.product_schedule_status || null,
        session_closure_mode: item?.session?.closure_mode || item?.session_closure_mode || item?.closure_mode || null,
        session_status: item?.session?.status || item?.session_status || null,
        session_auto_start_state: item?.session?.auto_start_state || null,
        session_auto_start_label: item?.session?.auto_start_label || null,
        session_auto_start_reason: item?.session?.auto_start_reason || null,
        queue_reason: item.queue_reason || null,
        queue_reason_message: item.queue_reason_message || null,
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
      const summary = resp?.data?.capacity_summary || resp?.response?.data?.capacity_summary || null;
      if (summary) {
        setHasCapacitySummary(true);
        setCapacitySummary({
          testing_mode_enabled: Boolean(summary.testing_mode_enabled),
          org_allocation_configured: Boolean(summary.org_allocation_configured),
          no_org_allocation_message: summary.no_org_allocation_message || null,
          can_create_new_lane: Boolean(summary.can_create_new_lane),
          auction_lanes_enabled: Boolean(summary.auction_lanes_enabled ?? true),
          guard_enabled: Boolean(summary.guard_enabled ?? true),
          guard_state: String(summary.guard_state || "GREEN").toUpperCase(),
          blocking_reason: summary.blocking_reason || null,
          org_allocation: {
            allocated_max_live_lanes: Number(summary?.org_allocation?.allocated_max_live_lanes || 0),
            allocated_max_open_lanes: Number(summary?.org_allocation?.allocated_max_open_lanes || 0),
            allocated_max_queued_lots: Number(summary?.org_allocation?.allocated_max_queued_lots || 0),
            allocated_max_concurrent_bidders: Number(summary?.org_allocation?.allocated_max_concurrent_bidders || 0),
          },
          org_usage: {
            used_live_lanes: Number(summary?.org_usage?.used_live_lanes || 0),
            used_open_lanes: Number(summary?.org_usage?.used_open_lanes || 0),
            used_queued_lots: Number(summary?.org_usage?.used_queued_lots || 0),
            used_concurrent_bidders: Number(summary?.org_usage?.used_concurrent_bidders || 0),
          },
          org_remaining: {
            remaining_live_lanes: Number(summary?.org_remaining?.remaining_live_lanes || 0),
            remaining_open_lanes: Number(summary?.org_remaining?.remaining_open_lanes || 0),
            remaining_queued_lots: Number(summary?.org_remaining?.remaining_queued_lots || 0),
            remaining_concurrent_bidders: Number(summary?.org_remaining?.remaining_concurrent_bidders || 0),
          },
          mandi_effective: {
            max_live_lanes: Number(summary?.mandi_effective?.max_live_lanes || 0),
            max_open_lanes: Number(summary?.mandi_effective?.max_open_lanes || 0),
            max_queue_per_lane: Number(summary?.mandi_effective?.max_queue_per_lane || 0),
          },
        });
      } else {
        setHasCapacitySummary(false);
        setCapacitySummary((prev) => ({
          ...prev,
          testing_mode_enabled: false,
          org_allocation_configured: false,
          can_create_new_lane: false,
          blocking_reason: null,
          org_allocation: {
            allocated_max_live_lanes: 0,
            allocated_max_open_lanes: 0,
            allocated_max_queued_lots: 0,
            allocated_max_concurrent_bidders: 0,
          },
          org_usage: {
            used_live_lanes: 0,
            used_open_lanes: 0,
            used_queued_lots: 0,
            used_concurrent_bidders: 0,
          },
          org_remaining: {
            remaining_live_lanes: 0,
            remaining_open_lanes: 0,
            remaining_queued_lots: 0,
            remaining_concurrent_bidders: 0,
          },
          mandi_effective: {
            max_live_lanes: 0,
            max_open_lanes: 0,
            max_queue_per_lane: 0,
          },
        }));
      }
      setSelectedRow((prev) => mapped.find((row) => row.id === prev?.id) || null);
    } finally {
      setLoading(false);
    }
  };

  const loadCreateOptions = async (opts?: { search?: string; includeSessions?: boolean }) => {
    const username = currentUsername();
    if (!username) return;
    setCreateError(null);
    setCreateOptionsLoading(true);
    try {
      const searchRaw = String(opts?.search || "").trim();
      const search = searchRaw.length >= 2 ? searchRaw : "";
      const [sessionsResp, lotsResp] = await Promise.all([
        canSessionsList && opts?.includeSessions ? getAuctionSessions({
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
        getLotList({
          username,
          language,
          filters: {
            org_code: filters.org_code || undefined,
            mandi_code: filters.mandi_code || undefined,
            status: "VERIFIED",
            page_size: 25,
            search: search || undefined,
          }
        }),
      ]);
      const sessions = sessionsResp?.data?.items ?? sessionsResp?.response?.data?.items ?? [];
      const lots = lotsResp?.data?.items || lotsResp?.response?.data?.items || [];

      if (opts?.includeSessions) {
        setSessionItems(sessions);
      }
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
        if (opts?.includeSessions) {
          setSessionOptions(buildSessionOptionsForLot(lotMapped[0].lot, sessions));
        }
      } else {
        if (opts?.includeSessions) {
          setSessionOptions([]);
        }
      }
    } catch (err: any) {
      setCreateError(err?.message || "Failed to load sessions/lots.");
    } finally {
      setCreateOptionsLoading(false);
    }
  };

  const handleStartSelectedLot = async (rowInput?: LotRow | null) => {
    const username = currentUsername();
    const row = rowInput || selectedRow;
    if (!username || !row || !row.backend_lot_id || !row.session_id || !row.org_id || row.mandi_id_value == null) return;
    const rowSessionStatus = normalizeSessionStatus(String(row.session_status || ""));
    if (!isSelectedSessionLive) {
      if (rowInput && rowSessionStatus === "LIVE") {
        // no-op, continue below
      } else {
        setActionError("Auction lot can be started only when the auction session is live.");
        return;
      }
    }
    if (rowSessionStatus !== "LIVE") {
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
          org_id: row.org_id,
          mandi_id: Number(row.mandi_id_value),
          session_id: row.session_id,
          lot_id: row.backend_lot_id,
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

  const openRowDialogFor = (row: LotRow, mode: "VIEW" | "EDIT") => {
    setSelectedRow(row);
    setRowDialogMode(mode);
    setRowEditForm({
      estimated_qty_kg: row.quantity != null ? String(row.quantity) : "",
      start_price_per_qtl: row.base_price != null ? String(row.base_price) : "",
      reserve_price_per_qtl: "",
    });
    setOpenRowDialog(true);
  };

  const handleSaveQueuedLotEdit = async () => {
    const username = currentUsername();
    if (!username || !selectedRow || !selectedRow.backend_lot_id) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const payload: Record<string, any> = {
        auction_lot_id: selectedRow.backend_lot_id,
      };
      if (String(rowEditForm.estimated_qty_kg || "").trim()) payload.estimated_qty_kg = rowEditForm.estimated_qty_kg;
      if (String(rowEditForm.start_price_per_qtl || "").trim()) payload.start_price_per_qtl = rowEditForm.start_price_per_qtl;
      if (rowEditForm.reserve_price_per_qtl !== undefined) payload.reserve_price_per_qtl = rowEditForm.reserve_price_per_qtl;
      const resp: any = await updateQueuedAuctionLot({ username, language, payload });
      const rc = resp?.response?.responsecode ?? resp?.responsecode;
      const desc = resp?.response?.description ?? resp?.description;
      if (String(rc) !== "0") {
        setActionError(desc || "Failed to update queued lot.");
        return;
      }
      setOpenRowDialog(false);
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || "Failed to update queued lot.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdrawQueuedLot = async (row?: LotRow | null) => {
    const username = currentUsername();
    const selected = row || selectedRow;
    if (!username || !selected || !selected.backend_lot_id) return;
    if (!window.confirm("Withdraw this queued lot from lane queue?")) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const resp: any = await withdrawQueuedAuctionLot({
        username,
        language,
        payload: { auction_lot_id: selected.backend_lot_id },
      });
      const rc = resp?.response?.responsecode ?? resp?.responsecode;
      const desc = resp?.response?.description ?? resp?.description;
      if (String(rc) !== "0") {
        setActionError(desc || "Failed to withdraw queued lot.");
        return;
      }
      if (openRowDialog) setOpenRowDialog(false);
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || "Failed to withdraw queued lot.");
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
    if (noOrgAllocationConfigured) {
      setCreateError(orgAllocationWarning);
      return;
    }
    console.log("CREATE FORM:", createForm);
    console.log("SESSION OPTIONS:", sessionOptions);
    if (import.meta.env.DEV) {
      console.debug("[AUCTION_LOTS_CREATE] submit_state", {
        selected_lot_id: createForm.lot_id || null,
        selected_session_id: createForm.session_id || null,
        selected_auto_lane_id: autoAssignedCreateSession?._id || autoAssignedCreateSession?.session_id || null,
        selected_auto_lane_name: autoAssignedCreateSession?.session_name || autoAssignedCreateSession?.session_code || null,
        mismatch_reason: selectedLaneCommodityMismatch ? "commodity_group_or_lane_type_mismatch" : null,
        opening_price: createBasePriceRaw || null,
        session_status: String(selectedCreateSession?.status || "").toUpperCase() || null,
        validation_result: createSubmitValid,
        submit_disabled: createSubmitDisabled,
      });
    }
    if (!createForm.lot_id || !createBasePriceRaw) {
      setCreateError("Lot and opening price are required.");
      return;
    }
    if (!createForm.auto_assign_lane && !createForm.session_id) {
      setCreateError("Select a preferred lane or enable Auto assign best lane.");
      return;
    }
    if (createForm.auto_assign_lane && !autoAssignedCreateSession) {
      setCreateError(
        `No matching lane found for ${resolvedLotCommodity?.label || "this commodity"} / ${selectedLot?.product_name_en || selectedLot?.commodity_product_name_en || selectedLot?.product || "this product"}.`,
      );
      return;
    }
    if (selectedLaneCommodityMismatch) {
      setCreateError("Selected lane does not match lot commodity group. Use Auto assignment recommended or choose a matching lane.");
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(createBasePriceRaw)) {
      setCreateError("Opening price must be a number with up to 2 decimals.");
      return;
    }
    const laneStart = selectedLaneStartDate;
    const laneEnd = selectedLaneEndDate;
    if (laneStart && selectedProductStart && selectedProductStart.getTime() < laneStart.getTime()) {
      setCreateError(`Product start time must be on or after lane start: ${formatDate(laneStart)}.`);
      return;
    }
    if (laneEnd && selectedProductEnd && selectedProductEnd.getTime() > laneEnd.getTime()) {
      setCreateError(`Product end time cannot be after lane end time: ${formatDate(laneEnd)}.`);
      return;
    }
    if (selectedProductStart && selectedProductEnd && selectedProductStart.getTime() >= selectedProductEnd.getTime()) {
      setCreateError("Product start time must be before product end time.");
      return;
    }
    if (laneStart && laneEnd) {
      const effectiveStart = selectedProductStart || laneStart;
      const effectiveEnd = selectedProductEnd || laneEnd;
      if (effectiveStart.getTime() >= effectiveEnd.getTime()) {
        setCreateError("Product start time must be before product end time.");
        return;
      }
    }
    const basePriceNum = Number(createBasePriceRaw);
    if (!Number.isFinite(basePriceNum) || basePriceNum <= 0) {
      setCreateError("Opening price must be greater than 0.");
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    setCreateSuccess(null);
    try {
      const payload = {
        api: "mapLotToAuctionSession",
        api_name: "mapLotToAuctionSession",
        username,
        country,
        language,
        lot_id: createForm.lot_id,
        auto_assign_lane: Boolean(createForm.auto_assign_lane),
        session_id: createForm.auto_assign_lane ? undefined : (createForm.session_id || undefined),
        start_price_per_qtl: createBasePriceRaw,
        product_start_time: createForm.product_start_time || undefined,
        product_end_time: createForm.product_end_time || undefined,
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
      const createdItem = resp?.data?.item || resp?.response?.data?.item || null;
      const assignedLane = createdItem?.lane_name || createdItem?.session?.session_name || createdItem?.session?.session_code || "—";
      const assignedLaneType = humanizeLaneType(createdItem?.lane_type || createdItem?.session?.lane_type || null);
      const queuePos = createdItem?.queue_position ?? "—";
      const queueReasonMsg = queueReasonLabel(createdItem?.queue_reason, createdItem?.queue_reason_message);
      const willAutoStart = String(createdItem?.status || "").toUpperCase() === "LIVE" ? "Yes" : (String(createdItem?.queue_reason || "").toUpperCase() === "WAITING_FOR_ACTIVE_LOT_TO_CLOSE" ? "Yes" : "No");
      if (String(createdItem?.queue_reason || "").toUpperCase() === "CAPACITY_CAP") {
        setCreateSuccess("Lane assigned successfully, but lot is queued because capacity is full. Auto-start will happen after capacity is available.");
      } else {
        setCreateSuccess(
          `Assigned Lane: ${assignedLane} | Lane Type: ${assignedLaneType} | Queue Position: ${queuePos} | Queue Reason: ${queueReasonMsg} | Auto-start: ${willAutoStart}`,
        );
      }
      setOpenCreate(false);
      setCreateForm({ auto_assign_lane: true, session_id: "", lot_id: "", base_price: "", product_start_time: "", product_end_time: "" });
      await loadData();
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create auction lot.");
    } finally {
      setCreateLoading(false);
    }
  };

  const handleCreateAndAssignLane = async () => {
    const username = currentUsername();
    const country = currentCountry();
    if (!username) return;
    if (!selectedLot) {
      setCreateError("Select a lot first.");
      return;
    }
    if (!inlineLanePrefill?.mandi_id) {
      setCreateError("No mandi found for selected lot.");
      return;
    }
    if (!resolvedLotCommodity?.label && !resolvedLotCommodity?.codeOrSlug) {
      setCreateError("Commodity group missing for selected product.");
      return;
    }
    const laneStart = new Date(createAssignForm.scheduled_start_time);
    const laneEnd = new Date(createAssignForm.scheduled_end_time);
    if (Number.isNaN(laneStart.getTime()) || Number.isNaN(laneEnd.getTime()) || laneStart.getTime() >= laneEnd.getTime()) {
      setCreateError("Lane timing is invalid.");
      return;
    }
    if (selectedProductStart && selectedProductEnd && selectedProductStart.getTime() >= selectedProductEnd.getTime()) {
      setCreateError("Product timing must be within lane timing.");
      return;
    }
    if (selectedProductStart && selectedProductStart.getTime() < laneStart.getTime()) {
      setCreateError(`Product start time must be on or after lane start: ${formatDate(laneStart)}.`);
      return;
    }
    if (selectedProductEnd && selectedProductEnd.getTime() > laneEnd.getTime()) {
      setCreateError("Product timing must be within lane timing.");
      return;
    }
    setCreateAssignLoading(true);
    setCreateError(null);
    try {
      const resp: any = await postEncrypted("/admin/createLaneAndAssignLot", {
        api: "createLaneAndAssignLot",
        api_name: "createLaneAndAssignLot",
        mode: "CREATE_LANE_ONLY",
        username,
        country,
        language,
        source_lot_id: selectedLot?._id || selectedLot?.lot_id,
        lane: {
          ...inlineLanePrefill,
          lane_name: createAssignForm.lane_name || inlineLanePrefill?.lane_name,
          lane_type: createAssignForm.lane_type || "COMMODITY_LANE",
          commodity_group: resolvedLotCommodity?.label || resolvedLotCommodity?.codeOrSlug || inlineLanePrefill?.commodity_group || "Selected Commodity",
          commodity_group_code: resolvedLotCommodity?.normalizedCode || inlineLanePrefill?.commodity_group_code || normalizeCommodityGroupCode(resolvedLotCommodity?.label),
          scheduled_start_time: createAssignForm.scheduled_start_time,
          scheduled_end_time: createAssignForm.scheduled_end_time,
          max_queue_size: Number(createAssignForm.max_queue_size || inlineLanePrefill?.max_queue_size || 25),
        },
      });
      const rc = resp?.response?.responsecode ?? resp?.responsecode;
      const desc = resp?.response?.description ?? resp?.description;
      if (String(rc) !== "0") {
        setCreateError(desc || "Unable to create lane. Please try again.");
        return;
      }
      const data = resp?.data || resp?.response?.data || {};
      setCreateSuccess(
        data?.lane_created
          ? `Lane created successfully. Lane: ${data?.session_code || data?.session_id || "—"}`
          : "A matching lane already existed. Using that lane.",
      );
      setCreateForm((prev) => ({
        ...prev,
        auto_assign_lane: false,
        session_id: String(data?.session_id || prev.session_id || ""),
        product_start_time: prev.product_start_time || createAssignForm.scheduled_start_time,
        product_end_time: prev.product_end_time || createAssignForm.scheduled_end_time,
      }));
      setOpenCreateAssignConfirm(false);
      await Promise.all([loadData(), loadSessionsForDropdown()]);
    } catch (err: any) {
      setCreateError(err?.message || "Unable to create lane. Please try again.");
    } finally {
      setCreateAssignLoading(false);
    }
  };

  const handleCreateSession = async () => {
    const username = currentUsername();
    if (!username || !selectedLot) return;
    if (noOrgAllocationConfigured) {
      setCreateSessionError(orgAllocationWarning);
      return;
    }
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

  const handleOpenCapacityControl = () => {
    window.location.assign("/admin/system/capacity-control");
  };

  const handleApplySafeTestCapacity = async () => {
    const username = currentUsername();
    if (!username) return;
    const target = selectedRow || rows[0];
    if (!target?.org_id && !target?.org_code) {
      setActionError("Select an org/mandi context first to apply test capacity.");
      return;
    }
    setTestCapacityLoading(true);
    setActionError(null);
    try {
      const payload: Record<string, any> = {
        action: "UPSERT_ALLOCATION",
        clear_allocation: false,
        capacity: {
          tier_code: "CUSTOM",
          max_live_sessions: 3,
          max_open_sessions: 5,
          max_total_queued_lots: 500,
          max_concurrent_bidders: 300,
          allow_overflow_lanes: false,
          allow_special_event_lanes: false,
          reserved_capacity_enabled: false,
        },
      };
      if (target?.org_id) payload.org_id = target.org_id;
      if (target?.org_code) payload.org_code = target.org_code;
      const resp: any = await updateOrgAuctionCapacityAllocation({ username, language, payload });
      const rc = resp?.response?.responsecode ?? resp?.responsecode;
      const desc = resp?.response?.description ?? resp?.description;
      if (String(rc) !== "0") {
        setActionError(desc || "Failed to apply safe test capacity.");
        return;
      }
      setCreateSuccess("Safe test capacity applied: Live=3, Open=5, Queue=500, Bidders=300.");
      await loadData();
    } catch (err: any) {
      setActionError(err?.message || "Failed to apply safe test capacity.");
    } finally {
      setTestCapacityLoading(false);
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
  }, [filters.org_code, filters.mandi_code, filters.commodity, filters.product, filters.session_id, filters.lane, filters.lane_type, filters.commodity_group, filters.lot_status, filters.date_from, filters.date_to, language, canView]);

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
      setOpenCreateAssignConfirm(false);
      setCreateAssignLoading(false);
      setCreateAssignForm({
        lane_name: "",
        lane_type: "COMMODITY_LANE",
        scheduled_start_time: "",
        scheduled_end_time: "",
        max_queue_size: "25",
      });
      setCreateForm({ auto_assign_lane: true, session_id: "", lot_id: "", base_price: "", product_start_time: "", product_end_time: "" });
      setSelectedLot(null);
      setSourceLotSearch("");
      setSessionOptions([]);
      setCreateError(null);
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
      loadCreateOptions({ includeSessions: true, search: "" });
    }
  }, [openCreate, language]);

  useEffect(() => {
    if (!openCreate) return;
    const q = String(sourceLotSearch || "");
    const timer = window.setTimeout(() => {
      loadCreateOptions({ includeSessions: false, search: q });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [openCreate, sourceLotSearch]);

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
      lane: "",
      lane_type: "",
      commodity_group: "",
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
            Only live and queued auction lots are shown by default. Sold, unsold, withdrawn and closed lots are available through status filter for audit.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          {selectedRow && canLotUpdate && (
            <>
              <Button
                variant="contained"
                size="small"
                onClick={() => handleStartSelectedLot()}
                disabled={actionLoading || !canStartSelectedLot}
              >
                Start Selected Lot
              </Button>
              <Tooltip title={selectedRowEffectiveStatus === "READY_TO_CLOSE" ? "Product window has ended. Close this lot to generate result." : "Finalize selected lot"}>
                <span>
                  <Button
                    variant="outlined"
                    size="small"
                    color="error"
                    onClick={handleFinalizeSelectedLot}
                    disabled={actionLoading || !canFinalizeSelectedLot}
                  >
                    {selectedRowEffectiveStatus === "READY_TO_CLOSE" ? "Close / Finalize Lot" : "Finalize Selected Lot"}
                  </Button>
                </span>
              </Tooltip>
            </>
          )}
          {canCreate && (
            <Button variant="contained" size="small" onClick={() => setOpenCreate(true)} disabled={noOrgAllocationConfigured}>
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

      {capacitySummary.testing_mode_enabled && (
      <Alert severity="warning" sx={{ mb: 2 }}>
        Testing Mode is enabled. Additional lanes can be created using testing limits.
      </Alert>
      )}
      {hasCapacitySummary && (
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Stack spacing={1.5}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            Auction Capacity Summary
          </Typography>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(170px, 1fr))" },
              gap: 1.25,
            }}
          >
            <Typography variant="body2"><strong>Org Allocated Live:</strong> {capacitySummary.org_allocation.allocated_max_live_lanes}</Typography>
            <Typography variant="body2"><strong>Org Used Live:</strong> {capacitySummary.org_usage.used_live_lanes}</Typography>
            <Typography variant="body2"><strong>Org Remaining Live:</strong> {capacitySummary.org_remaining.remaining_live_lanes}</Typography>
            <Typography variant="body2"><strong>Mandi Effective Live:</strong> {capacitySummary.mandi_effective.max_live_lanes}</Typography>
            <Typography variant="body2"><strong>Org Allocated Open:</strong> {capacitySummary.org_allocation.allocated_max_open_lanes}</Typography>
            <Typography variant="body2"><strong>Org Used Open:</strong> {capacitySummary.org_usage.used_open_lanes}</Typography>
            <Typography variant="body2"><strong>Org Remaining Open:</strong> {capacitySummary.org_remaining.remaining_open_lanes}</Typography>
            <Typography variant="body2"><strong>Mandi Effective Open:</strong> {capacitySummary.mandi_effective.max_open_lanes}</Typography>
            <Typography variant="body2"><strong>Org Allocated Queue:</strong> {capacitySummary.org_allocation.allocated_max_queued_lots}</Typography>
            <Typography variant="body2"><strong>Org Used Queue:</strong> {capacitySummary.org_usage.used_queued_lots}</Typography>
            <Typography variant="body2"><strong>Org Remaining Queue:</strong> {capacitySummary.org_remaining.remaining_queued_lots}</Typography>
            <Typography variant="body2"><strong>Queue Per Lane:</strong> {capacitySummary.mandi_effective.max_queue_per_lane}</Typography>
            <Typography variant="body2"><strong>Org Allocated Bidders:</strong> {capacitySummary.org_allocation.allocated_max_concurrent_bidders}</Typography>
            <Typography variant="body2"><strong>Org Used Bidders:</strong> {capacitySummary.org_usage.used_concurrent_bidders}</Typography>
            <Typography variant="body2"><strong>Remaining Org Bidder Capacity:</strong> {capacitySummary.org_remaining.remaining_concurrent_bidders}</Typography>
            <Typography variant="body2"><strong>Guard State:</strong> {capacitySummary.guard_state || "GREEN"}</Typography>
            <Typography variant="body2"><strong>Limit Source:</strong> {capacitySummary.testing_mode_enabled ? "TESTING_CAPACITY_OVERRIDE" : "LIVE_CAPACITY_CONFIG"}</Typography>
          </Box>
          {noOrgAllocationConfigured && (
            <Alert severity="warning">{orgAllocationWarning}</Alert>
          )}
          {!noOrgAllocationConfigured && !canCreateSessionWithinCapacity && (
            <Alert severity="warning">
              {capacitySummary.blocking_reason || "Lane creation is currently blocked by configured auction capacity limits."}
            </Alert>
          )}
        </Stack>
      </Paper>
      )}
      {hasCapacitySummary && capacityBlockingFull && (
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2, borderColor: "warning.main" }}>
          <Stack spacing={1.25}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, color: "warning.dark" }}>
              Capacity is blocking auto-start
            </Typography>
            <Typography variant="body2">
              Current org open lanes: {capacitySummary.org_usage.used_open_lanes} used / {capacitySummary.org_allocation.allocated_max_open_lanes} allocated
            </Typography>
            <Typography variant="body2">
              Current org live lanes: {capacitySummary.org_usage.used_live_lanes} used / {capacitySummary.org_allocation.allocated_max_live_lanes} allocated
            </Typography>
            <Typography variant="body2">
              Current mandi effective limits: open {capacitySummary.mandi_effective.max_open_lanes}, live {capacitySummary.mandi_effective.max_live_lanes}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Suggested action: Increase org Allocated Max Open to at least 5 and Allocated Max Live to at least 3 for testing parallel lanes.
            </Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button size="small" variant="outlined" onClick={handleOpenCapacityControl}>
                Open Capacity Control
              </Button>
              {showTestCapacityHelper && (
                <Button size="small" variant="contained" onClick={handleApplySafeTestCapacity} disabled={testCapacityLoading}>
                  {testCapacityLoading ? "Applying..." : "Apply Safe Test Capacity"}
                </Button>
              )}
            </Stack>
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
          <TextField label="Lane" size="small" value={filters.lane} onChange={(e) => updateFilter("lane", e.target.value)} fullWidth />
          <TextField
            select
            label="Lane Type"
            size="small"
            value={filters.lane_type}
            onChange={(e) => updateFilter("lane_type", e.target.value)}
            fullWidth
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="COMMODITY_LANE">Commodity Lane</MenuItem>
            <MenuItem value="PREMIUM_LANE">Premium Lane</MenuItem>
            <MenuItem value="FAST_TRACK_LANE">Fast Track Lane</MenuItem>
            <MenuItem value="BULK_LANE">Bulk Lane</MenuItem>
            <MenuItem value="OVERFLOW_LANE">Overflow Lane</MenuItem>
            <MenuItem value="SPECIAL_EVENT_LANE">Special Event Lane</MenuItem>
          </TextField>
          <TextField label="Commodity Group" size="small" value={filters.commodity_group} onChange={(e) => updateFilter("commodity_group", e.target.value)} fullWidth />
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
            <MenuItem value="WITHDRAWN">Withdrawn</MenuItem>
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
      {createSuccess && <Alert severity="success" sx={{ mb: 2 }}>{createSuccess}</Alert>}
      {selectedRow?.session_status === "LIVE" && selectedRow?.session_no_active_lot && (
        <Alert severity="info" sx={{ mb: 2 }}>
          No active lot currently selected in this live session.
          {selectedRow?.session_ready_to_close ? " This session is ready to close." : ""}
        </Alert>
      )}
      {String(selectedRow?.status || "").toUpperCase() === "QUEUED" && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {String(selectedRow?.queue_reason || "").toUpperCase() === "CAPACITY_CAP" && hasCapacitySummary
            ? capacityCapDetailedMessage(capacitySummary)
            : queueReasonLabel(selectedRow?.queue_reason, selectedRow?.queue_reason_message)}
        </Alert>
      )}
      {selectedRowEffectiveStatus === "READY_TO_CLOSE" && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Product bidding window ended. Close/finalize this lot.
        </Alert>
      )}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        {loading && <LinearProgress />}
        <Box sx={{ p: 1.5, pb: 0 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Auction Lots List
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
            Only live and queued auction lots are shown by default. Sold, unsold, withdrawn and closed lots are available through status filter for audit.
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

      {openRowDialog && selectedRow && (
        <Dialog open={openRowDialog} onClose={() => setOpenRowDialog(false)} fullWidth maxWidth="sm">
          <DialogTitle>{rowDialogMode === "EDIT" ? "Edit Queued Lot" : "Auction Lot Details"}</DialogTitle>
          <DialogContent>
            <Stack spacing={1.25} mt={0.5}>
              <Typography variant="body2"><strong>Lot:</strong> {selectedRow.lot_id}</Typography>
              <Typography variant="body2"><strong>Session:</strong> {selectedRow.session_name || selectedRow.session_code || "—"}</Typography>
              <Typography variant="body2"><strong>Status:</strong> {selectedRow.status || "—"}</Typography>
              <Typography variant="body2"><strong>Active Lot:</strong> {String(selectedRow.is_active_lot || "N").toUpperCase() === "Y" ? "Yes" : "No"}</Typography>
              {String(selectedRow.status || "").toUpperCase() === "QUEUED" && (
                <Alert severity="info">
                  {queueReasonLabel(selectedRow.queue_reason, selectedRow.queue_reason_message)}
                </Alert>
              )}
              {rowDialogMode === "EDIT" ? (
                <Stack spacing={1}>
                  <TextField
                    label="Estimated Qty (kg)"
                    size="small"
                    type="number"
                    value={rowEditForm.estimated_qty_kg}
                    onChange={(e) => setRowEditForm((prev) => ({ ...prev, estimated_qty_kg: e.target.value }))}
                    inputProps={{ min: 0.01, step: 0.01 }}
                    fullWidth
                  />
                  <TextField
                    label="Start Price (₹/qtl)"
                    size="small"
                    type="number"
                    value={rowEditForm.start_price_per_qtl}
                    onChange={(e) => setRowEditForm((prev) => ({ ...prev, start_price_per_qtl: e.target.value }))}
                    inputProps={{ min: 0.01, step: 0.01 }}
                    fullWidth
                  />
                  <TextField
                    label="Reserve Price (₹/qtl)"
                    size="small"
                    type="number"
                    value={rowEditForm.reserve_price_per_qtl}
                    onChange={(e) => setRowEditForm((prev) => ({ ...prev, reserve_price_per_qtl: e.target.value }))}
                    inputProps={{ min: 0, step: 0.01 }}
                    fullWidth
                  />
                </Stack>
              ) : (
                <Stack spacing={0.8}>
                  <Typography variant="body2"><strong>Commodity:</strong> {selectedRow.commodity || "—"}</Typography>
                  <Typography variant="body2"><strong>Product:</strong> {selectedRow.product || "—"}</Typography>
                  <Typography variant="body2"><strong>Qty:</strong> {selectedRow.quantity != null ? `${formatInr(selectedRow.quantity)} kg` : "—"}</Typography>
                  <Typography variant="body2"><strong>Start Price:</strong> {selectedRow.base_price != null ? `₹${formatInr(selectedRow.base_price)}/qtl` : "—"}</Typography>
                </Stack>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            {rowDialogMode === "EDIT" && (
              <Button
                variant="outlined"
                color="error"
                onClick={() => handleWithdrawQueuedLot(selectedRow)}
                disabled={actionLoading || String(selectedRow.status || "").toUpperCase() !== "QUEUED"}
              >
                Withdraw
              </Button>
            )}
            <Button onClick={() => setOpenRowDialog(false)} disabled={actionLoading}>Close</Button>
            {rowDialogMode === "EDIT" ? (
              <Button variant="contained" onClick={handleSaveQueuedLotEdit} disabled={actionLoading}>
                Save
              </Button>
            ) : (
              <Button
                variant="contained"
                onClick={() => handleStartSelectedLot(selectedRow)}
                disabled={actionLoading || String(selectedRow.status || "").toUpperCase() !== "QUEUED" || normalizeSessionStatus(selectedRow.session_status) !== "LIVE"}
              >
                Start Lot
              </Button>
            )}
          </DialogActions>
        </Dialog>
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
              {noOrgAllocationConfigured && (
                <Alert severity="warning">{orgAllocationWarning}</Alert>
              )}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                  Section A — Source Lot
                </Typography>
                <Autocomplete
                  options={lotOptions}
                  filterOptions={(x) => x}
                  loading={createOptionsLoading}
                  value={lotOptions.find((l) => l.value === createForm.lot_id) || null}
                  inputValue={sourceLotSearch}
                  onInputChange={(_e, value, reason) => {
                    if (reason === "input" || reason === "clear") setSourceLotSearch(value || "");
                  }}
                  onChange={(_e, option) => {
                    const value = option?.value || "";
                    setCreateForm((prev) => ({ ...prev, lot_id: value, session_id: "" }));
                    setSelectedLot(option?.lot || null);
                  }}
                  getOptionLabel={(option) => option?.label || ""}
                  isOptionEqualToValue={(opt, val) => String(opt?.value || "") === String(val?.value || "")}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Select VERIFIED Lot"
                      size="small"
                      placeholder="Search by farmer mobile, token, lot, commodity, product"
                      helperText="Type at least 2 characters to search. Showing max 25 results."
                    />
                  )}
                  renderOption={(props, option) => (
                    <Box component="li" {...props}>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%" }}>
                        <Typography variant="body2" sx={{ flex: 1 }}>
                          {option.label}
                        </Typography>
                        {option.shortCode && (
                          <Typography variant="caption" color="text.secondary">
                            #{option.shortCode}
                          </Typography>
                        )}
                      </Stack>
                    </Box>
                  )}
                />
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
                  Section B — Lane Assignment (Automatic)
                </Typography>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>
                    Auto assign best lane
                  </Typography>
                  <Switch
                    checked={Boolean(createForm.auto_assign_lane)}
                    onChange={(e) => setCreateForm((prev) => ({
                      ...prev,
                      auto_assign_lane: e.target.checked,
                      session_id: e.target.checked ? "" : prev.session_id,
                    }))}
                  />
                </Stack>
                <Alert severity="info" sx={{ mt: 1.25 }}>
                  Auto assignment recommended.
                </Alert>
                {!createForm.auto_assign_lane && (
                  <Alert severity="warning" sx={{ mt: 1.25 }}>
                    Manual lane selection is enabled. Choose carefully to avoid commodity mismatch.
                  </Alert>
                )}
                {!createForm.auto_assign_lane && (
                  <TextField
                    select
                    label="Preferred Lane (Manual)"
                    size="small"
                    value={createForm.session_id}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, session_id: e.target.value }))}
                    SelectProps={{ onOpen: loadSessionsForDropdown }}
                    onClick={loadSessionsForDropdown}
                    fullWidth
                    sx={{ mt: 1.25 }}
                    helperText="Manual selection only. Lane must match lot commodity group and lane type."
                  >
                    <MenuItem value="">Select</MenuItem>
                    {sessionOptions.map((s) => (
                      <MenuItem
                        key={s.value}
                        value={s.value}
                        sx={s.rank_meta?.isCompatible ? { bgcolor: "rgba(110, 124, 58, 0.08)" } : undefined}
                      >
                        <Stack spacing={0.35} sx={{ py: 0.3, width: "100%" }}>
                          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {s.session?.session_name || s.session?.session_code || s.label}
                            </Typography>
                            {s.rank_meta?.isCompatible && (
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
                          {s.rank_meta?.why && (
                            <Typography variant="caption" sx={{ color: "success.main", fontWeight: 600 }}>
                              {s.rank_meta?.isCompatible ? `Best match for selected lot · ${s.rank_meta.why}` : s.rank_meta.why}
                            </Typography>
                          )}
                        </Stack>
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                {noAutoCompatibleLane && (
                  <Alert severity="warning" sx={{ mt: 1.25 }}>
                    <Stack spacing={1}>
                      <Typography variant="body2">
                        No matching lane found for {resolvedLotCommodity?.label || "this commodity"} / {selectedLot?.product_name_en || selectedLot?.commodity_product_name_en || selectedLot?.product || "this product"}.
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        You can create a new lane for {inlineLanePrefill?.mandi_name || "selected mandi"} mandi and assign this product to it.
                      </Typography>
                      <Box>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={() => setOpenCreateAssignConfirm(true)}
                          disabled={createAssignDisabled}
                        >
                          Create Lane &amp; Use This Lane
                        </Button>
                      </Box>
                      {createAssignDisableReason && (
                        <Typography variant="caption" color="error">
                          {createAssignDisableReason}
                        </Typography>
                      )}
                    </Stack>
                  </Alert>
                )}
                {selectedLaneCommodityMismatch && (
                  <Alert severity="warning" sx={{ mt: 1.25 }}>
                    Selected lane commodity group does not match the selected lot. Choose a matching lane or keep Preferred Lane empty.
                  </Alert>
                )}
                {!canSessionsList && (
                  <Alert severity="error" sx={{ mt: 1.25 }}>
                    Missing permission: `auction_sessions.list` (VIEW). Session list cannot be loaded.
                  </Alert>
                )}
                {selectedLot && sessionOptions.length === 0 && (
                  <Alert severity="info" sx={{ mt: 1.25 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", sm: "center" }} spacing={1}>
                      <Typography variant="body2">No active auction lane is available for this mandi. Please create a lane before mapping this lot.</Typography>
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => setOpenCreateSession(true)}
                        disabled={noOrgAllocationConfigured || !canCreateSessionWithinCapacity}
                      >
                        Create Session
                      </Button>
                    </Stack>
                  </Alert>
                )}
                {effectiveCreateSession && (
                  <Paper variant="outlined" sx={{ mt: 1.25, p: 1.5, borderRadius: 1.5, bgcolor: "background.paper" }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>
                      {createForm.auto_assign_lane ? "Auto-Assigned Lane Summary" : "Selected Lane Summary"}
                    </Typography>
                    <Stack spacing={0.6}>
                      <Typography variant="body2"><strong>Lane Name:</strong> {effectiveCreateSession.session_name || effectiveCreateSession.session_code || "—"}</Typography>
                      <Typography variant="body2"><strong>Type:</strong> {humanizeLaneType(effectiveCreateSession.lane_type)}</Typography>
                      <Typography variant="body2"><strong>Commodity:</strong> {effectiveCreateSession.commodity_group || "—"}</Typography>
                      {createForm.auto_assign_lane && autoAssignedSessionOption?.rank_meta?.why && (
                        <Typography variant="body2"><strong>Why selected:</strong> {autoAssignedSessionOption.rank_meta.why}</Typography>
                      )}
                      <Typography variant="body2"><strong>Status:</strong> {effectiveCreateSession.status_display || effectiveCreateSession.derived_status || effectiveCreateSession.status || "—"}</Typography>
                      <Typography variant="body2"><strong>Queued Count:</strong> {effectiveCreateSession.queued_count ?? 0}</Typography>
                      <Typography variant="body2"><strong>Active Lot:</strong> {effectiveCreateSession.active_lot_code || "—"}</Typography>
                      <Typography variant="body2"><strong>Next Queued Lot:</strong> {effectiveCreateSession.next_queued_lot_code || "—"}</Typography>
                      <Typography variant="body2"><strong>Ready to Close:</strong> {effectiveCreateSession.ready_to_close ? "Yes" : "No"}</Typography>
                    </Stack>
                    {effectiveCreateSession.overloaded && (
                      <Alert severity="warning" sx={{ mt: 1.25 }}>
                        {effectiveCreateSession.overload_reason || "Queue exceeds configured limit. Consider creating an overflow lane."}
                      </Alert>
                    )}
                  </Paper>
                )}
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                  Section C — Product Timing (Optional)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  If left blank, product will follow lane timing.
                </Typography>
                {effectiveCreateSession && (
                  <Stack spacing={0.4} sx={{ mb: 1.5 }}>
                    <Typography variant="body2">
                      <strong>Lane Window:</strong>
                    </Typography>
                    <Typography variant="body2">
                      <strong>Start:</strong> {formatDate(effectiveCreateSession.scheduled_start_time) || "—"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>End:</strong> {formatDate(effectiveCreateSession.scheduled_end_time) || "—"}
                    </Typography>
                    {!effectiveCreateSession.scheduled_end_time && (
                      <Typography variant="caption" color="warning.main">
                        Lane end time is not configured. Product timing will follow lane defaults.
                      </Typography>
                    )}
                  </Stack>
                )}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
                  <TextField
                    label="Product Start Date/Time"
                    type="datetime-local"
                    size="small"
                    value={createForm.product_start_time}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, product_start_time: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ min: selectedLaneStartTime || undefined, max: selectedLaneEndTime || undefined }}
                    helperText={selectedLaneStartTime ? `Must be on or after lane start: ${formatDate(selectedLaneStartDate)}` : undefined}
                    fullWidth
                  />
                  <TextField
                    label="Product End Date/Time"
                    type="datetime-local"
                    size="small"
                    value={createForm.product_end_time}
                    onChange={(e) => setCreateForm((prev) => ({ ...prev, product_end_time: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ min: productEndMinTime, max: selectedLaneEndTime || undefined }}
                    helperText={selectedLaneEndTime ? `Must be on or before lane end: ${formatDate(selectedLaneEndDate)}` : "Lane end time is not configured. Product timing will follow lane defaults."}
                    fullWidth
                  />
                </Stack>
              </Paper>

              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
                  Section D — Pricing
                </Typography>
                <TextField
                  label="Opening Price (₹/qtl)"
                  size="small"
                  type="number"
                  value={createForm.base_price}
                  onChange={(e) => setCreateForm((prev) => ({ ...prev, base_price: e.target.value }))}
                  helperText="Opening bid rate for this lot (per quintal). Opening price is required before assigning product to lane."
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

      <Dialog open={openCreateAssignConfirm} onClose={() => setOpenCreateAssignConfirm(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create &amp; Assign Lane</DialogTitle>
        <DialogContent>
          <Stack spacing={1.2} mt={1}>
            <Alert severity="info">
              This will create a new lane for the selected mandi and commodity group, then assign this product to it.
            </Alert>
            <Typography variant="body2"><strong>Mandi:</strong> {inlineLanePrefill?.mandi_name || inlineLanePrefill?.mandi_id || "—"}</Typography>
            <Typography variant="body2"><strong>Commodity Group:</strong> {resolvedLotCommodity?.label || inlineLanePrefill?.commodity_group || "—"}</Typography>
            <TextField
              label="Lane Name"
              size="small"
              value={createAssignForm.lane_name}
              onChange={(e) => setCreateAssignForm((prev) => ({ ...prev, lane_name: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Lane Type"
              size="small"
              value={createAssignForm.lane_type}
              onChange={(e) => setCreateAssignForm((prev) => ({ ...prev, lane_type: e.target.value }))}
              fullWidth
            />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <TextField
                label="Start Date/Time"
                type="datetime-local"
                size="small"
                value={createAssignForm.scheduled_start_time}
                onChange={(e) => setCreateAssignForm((prev) => ({ ...prev, scheduled_start_time: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
              <TextField
                label="End Date/Time"
                type="datetime-local"
                size="small"
                value={createAssignForm.scheduled_end_time}
                onChange={(e) => setCreateAssignForm((prev) => ({ ...prev, scheduled_end_time: e.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
            <TextField
              label="Max Queue Size"
              size="small"
              type="number"
              value={createAssignForm.max_queue_size}
              onChange={(e) => setCreateAssignForm((prev) => ({ ...prev, max_queue_size: e.target.value }))}
              inputProps={{ min: "1", step: "1" }}
              fullWidth
            />
            <Typography variant="caption" color="text.secondary">
              Suggested timing is auto-filled. You may change it before creating the lane.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenCreateAssignConfirm(false)} disabled={createAssignLoading}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateAndAssignLane} disabled={createAssignDisabled}>
            {createAssignLoading ? "Creating..." : "Create Lane & Use This Lane"}
          </Button>
        </DialogActions>
      </Dialog>

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
              {noOrgAllocationConfigured && (
                <Alert severity="warning">
                  {orgAllocationWarning}
                </Alert>
              )}
              {!noOrgAllocationConfigured && !canCreateSessionWithinCapacity && (
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
            <Button
              variant="contained"
              onClick={handleCreateSession}
              disabled={createSessionLoading || !createSessionForm.session_name || noOrgAllocationConfigured || !canCreateSessionWithinCapacity}
            >
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
