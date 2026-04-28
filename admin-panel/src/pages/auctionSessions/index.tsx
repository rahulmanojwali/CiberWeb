import React, { useEffect, useMemo, useState } from "react";
import { Accordion, AccordionDetails, AccordionSummary, Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
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
import { closeAuctionSession, createAuctionSession, getAuctionLots, getAuctionSessions, rescheduleAuctionSession, startAuctionSession } from "../../services/auctionOpsApi";

type SessionRow = {
  id: string;
  session_id: string;
  session_code?: string | null;
  session_name?: string | null;
  lane_type?: string | null;
  commodity_group?: string | null;
  commodity_group_code?: string | null;
  hall_or_zone?: string | null;
  auctioneer_username?: string | null;
  is_overflow_lane?: boolean;
  max_queue_size?: number | null;
  display_order?: number | null;
  notes?: string | null;
  org_code?: string | null;
  mandi_code?: string | null;
  method?: string | null;
  round?: string | null;
  status?: string | null;
  derived_status?: string | null;
  start_mode?: "MANUAL" | "AUTO" | "MANUAL_OR_AUTO" | string | null;
  actual_start?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  closure_mode?: string | null;
  scheduled_start_time?: string | null;
  scheduled_end_time?: string | null;
  auto_start_state?: "PENDING" | "OVERDUE" | string | null;
  auto_start_label?: string | null;
  auto_start_reason?: string | null;
  lifecycle_state_reason?: string | null;
  auto_close_enabled?: boolean;
  closed_by_type?: string | null;
  close_reason?: string | null;
  closed_by_username?: string | null;
  queued_count?: number | null;
  live_count?: number | null;
  sold_count?: number | null;
  unsold_count?: number | null;
  withdrawn_count?: number | null;
  has_active_lot?: boolean;
  active_lot_code?: string | null;
  next_queued_lot_code?: string | null;
  ready_to_close?: boolean;
  overloaded?: boolean;
  overload_reason?: string | null;
};

type SessionStartMode = "MANUAL" | "AUTO" | "MANUAL_OR_AUTO";

type LaneCapacitySummary = {
  testing_mode_enabled: boolean;
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

const LANE_TYPE_OPTIONS = [
  "COMMODITY_LANE",
  "PREMIUM_LANE",
  "FAST_TRACK_LANE",
  "BULK_LANE",
  "OVERFLOW_LANE",
  "SPECIAL_EVENT_LANE",
];

const COMMODITY_FAMILY_OPTIONS = [
  "Vegetables",
  "Fruits",
  "Cereals",
  "Pulses",
  "Oilseeds",
  "Dry Fruits",
  "General / Other",
] as const;

type CommodityFamily = typeof COMMODITY_FAMILY_OPTIONS[number];

type LaneTemplate = {
  key: string;
  label: string;
  session_name: string;
  lane_type: string;
  commodity_group: string;
  commodity_group_code?: string;
  is_overflow_lane?: boolean;
};

const LANE_TEMPLATE_MAP: Record<CommodityFamily, LaneTemplate[]> = {
  "Vegetables": [
    { key: "veg-onion-garlic-ginger", label: "Onion / Garlic / Ginger Lane", session_name: "Onion / Garlic / Ginger Lane", lane_type: "COMMODITY_LANE", commodity_group: "Vegetables", commodity_group_code: "VEGETABLES" },
    { key: "veg-leafy", label: "Leafy Vegetables Lane", session_name: "Leafy Vegetables Lane", lane_type: "COMMODITY_LANE", commodity_group: "Vegetables", commodity_group_code: "VEGETABLES" },
    { key: "veg-root", label: "Root Vegetables Lane", session_name: "Root Vegetables Lane", lane_type: "COMMODITY_LANE", commodity_group: "Vegetables", commodity_group_code: "VEGETABLES" },
    { key: "veg-general", label: "General Vegetables Lane", session_name: "General Vegetables Lane", lane_type: "COMMODITY_LANE", commodity_group: "Vegetables", commodity_group_code: "VEGETABLES" },
    { key: "veg-premium", label: "Premium Vegetables Lane", session_name: "Premium Vegetables Lane", lane_type: "PREMIUM_LANE", commodity_group: "Vegetables", commodity_group_code: "VEGETABLES" },
    { key: "veg-overflow", label: "Overflow Vegetables Lane", session_name: "Overflow Vegetables Lane", lane_type: "OVERFLOW_LANE", commodity_group: "Vegetables", commodity_group_code: "VEGETABLES", is_overflow_lane: true },
  ],
  "Fruits": [
    { key: "fruit-general", label: "General Fruits Lane", session_name: "General Fruits Lane", lane_type: "COMMODITY_LANE", commodity_group: "Fruits", commodity_group_code: "FRUITS" },
    { key: "fruit-premium", label: "Premium Fruits Lane", session_name: "Premium Fruits Lane", lane_type: "PREMIUM_LANE", commodity_group: "Fruits", commodity_group_code: "FRUITS" },
    { key: "fruit-bulk", label: "Bulk Fruits Lane", session_name: "Bulk Fruits Lane", lane_type: "BULK_LANE", commodity_group: "Fruits", commodity_group_code: "FRUITS" },
    { key: "fruit-overflow", label: "Overflow Fruits Lane", session_name: "Overflow Fruits Lane", lane_type: "OVERFLOW_LANE", commodity_group: "Fruits", commodity_group_code: "FRUITS", is_overflow_lane: true },
  ],
  "Cereals": [
    { key: "cereals-general", label: "General Cereals Lane", session_name: "General Cereals Lane", lane_type: "COMMODITY_LANE", commodity_group: "Cereals", commodity_group_code: "CEREALS" },
    { key: "cereals-premium", label: "Premium Cereals Lane", session_name: "Premium Cereals Lane", lane_type: "PREMIUM_LANE", commodity_group: "Cereals", commodity_group_code: "CEREALS" },
    { key: "cereals-bulk", label: "Bulk Cereals Lane", session_name: "Bulk Cereals Lane", lane_type: "BULK_LANE", commodity_group: "Cereals", commodity_group_code: "CEREALS" },
    { key: "cereals-overflow", label: "Overflow Cereals Lane", session_name: "Overflow Cereals Lane", lane_type: "OVERFLOW_LANE", commodity_group: "Cereals", commodity_group_code: "CEREALS", is_overflow_lane: true },
  ],
  "Pulses": [
    { key: "pulses-general", label: "General Pulses Lane", session_name: "General Pulses Lane", lane_type: "COMMODITY_LANE", commodity_group: "Pulses", commodity_group_code: "PULSES" },
    { key: "pulses-premium", label: "Premium Pulses Lane", session_name: "Premium Pulses Lane", lane_type: "PREMIUM_LANE", commodity_group: "Pulses", commodity_group_code: "PULSES" },
    { key: "pulses-overflow", label: "Overflow Pulses Lane", session_name: "Overflow Pulses Lane", lane_type: "OVERFLOW_LANE", commodity_group: "Pulses", commodity_group_code: "PULSES", is_overflow_lane: true },
  ],
  "Oilseeds": [
    { key: "oilseeds-general", label: "General Oilseeds Lane", session_name: "General Oilseeds Lane", lane_type: "COMMODITY_LANE", commodity_group: "Oilseeds", commodity_group_code: "OILSEEDS" },
    { key: "oilseeds-premium", label: "Premium Oilseeds Lane", session_name: "Premium Oilseeds Lane", lane_type: "PREMIUM_LANE", commodity_group: "Oilseeds", commodity_group_code: "OILSEEDS" },
    { key: "oilseeds-overflow", label: "Overflow Oilseeds Lane", session_name: "Overflow Oilseeds Lane", lane_type: "OVERFLOW_LANE", commodity_group: "Oilseeds", commodity_group_code: "OILSEEDS", is_overflow_lane: true },
  ],
  "Dry Fruits": [
    { key: "dry-fruits-general", label: "General Dry Fruits Lane", session_name: "General Dry Fruits Lane", lane_type: "COMMODITY_LANE", commodity_group: "Dry Fruits", commodity_group_code: "DRY_FRUITS" },
    { key: "dry-fruits-premium", label: "Premium Dry Fruits Lane", session_name: "Premium Dry Fruits Lane", lane_type: "PREMIUM_LANE", commodity_group: "Dry Fruits", commodity_group_code: "DRY_FRUITS" },
    { key: "dry-fruits-overflow", label: "Overflow Dry Fruits Lane", session_name: "Overflow Dry Fruits Lane", lane_type: "OVERFLOW_LANE", commodity_group: "Dry Fruits", commodity_group_code: "DRY_FRUITS", is_overflow_lane: true },
  ],
  "General / Other": [
    { key: "general-auction", label: "General Auction Lane", session_name: "General Auction Lane", lane_type: "COMMODITY_LANE", commodity_group: "General / Other", commodity_group_code: "GENERAL" },
    { key: "premium-auction", label: "Premium Auction Lane", session_name: "Premium Auction Lane", lane_type: "PREMIUM_LANE", commodity_group: "General / Other", commodity_group_code: "GENERAL" },
    { key: "bulk-auction", label: "Bulk Auction Lane", session_name: "Bulk Auction Lane", lane_type: "BULK_LANE", commodity_group: "General / Other", commodity_group_code: "GENERAL" },
    { key: "overflow-auction", label: "Overflow Auction Lane", session_name: "Overflow Auction Lane", lane_type: "OVERFLOW_LANE", commodity_group: "General / Other", commodity_group_code: "GENERAL", is_overflow_lane: true },
  ],
};

type Option = { value: string; label: string };
type CloseSummary = {
  mappedCount: number;
  liveCount: number;
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

function formatDate(value?: string | Date | null) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function deriveDisplayStatus(session: SessionRow, nowMs: number) {
  const backendDerived = String(session.derived_status || "").trim().toUpperCase();
  if (backendDerived === "EXPIRED") return "EXPIRED";
  const base = String(session.status || "PLANNED").trim().toUpperCase();
  if (base === "PLANNED" && session.scheduled_end_time) {
    const scheduledEnd = new Date(session.scheduled_end_time);
    if (!Number.isNaN(scheduledEnd.getTime()) && nowMs > scheduledEnd.getTime()) return "EXPIRED";
  }
  return base;
}

function toDateTimeInputValue(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function displayValue(value?: string | null) {
  const text = String(value || "").trim();
  return text || "—";
}

function getActionFailure(resp: any, fallbackMessage: string) {
  const message = resp?.response?.description || resp?.description || fallbackMessage;
  const guardState = String(
    resp?.data?.capacity_guard_state ||
    resp?.response?.data?.capacity_guard_state ||
    ""
  ).trim().toUpperCase();
  return {
    message,
    severity: guardState === "RED" ? "error" as const : "warning" as const,
  };
}

function displayCount(value?: number | null) {
  return Number.isFinite(Number(value)) ? String(Number(value)) : "0";
}

function laneTypeOptionLabel(value?: string | null) {
  const text = String(value || "").trim().toUpperCase();
  if (!text) return "—";
  return text
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function closureModeLabel(mode?: string | null) {
  const normalized = String(mode || "").trim().toUpperCase();
  if (normalized === "MANUAL_ONLY") return "Manual";
  if (normalized === "AUTO_AT_END_TIME") return "Auto";
  if (normalized === "MANUAL_OR_AUTO") return "Manual + Auto";
  return displayValue(mode);
}

function normalizeStartMode(mode?: string | null): SessionStartMode {
  const normalized = String(mode || "").trim().toUpperCase();
  if (normalized === "MANUAL") return "MANUAL";
  if (normalized === "AUTO") return "AUTO";
  return "MANUAL_OR_AUTO";
}

function formatDurationHms(diffMs: number) {
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function getStartCountdownLabel(session: SessionRow, nowMs: number) {
  const status = String(session.status || "").trim().toUpperCase();
  if (status !== "PLANNED") return "";
  if (session.auto_start_label) {
    if (String(session.auto_start_state || "").toUpperCase() === "OVERDUE") {
      return "Auto start overdue";
    }
    if (String(session.auto_start_state || "").toUpperCase() === "PENDING") {
      const scheduledStartRaw = session.scheduled_start_time;
      if (scheduledStartRaw) {
        const scheduledStart = new Date(scheduledStartRaw);
        if (!Number.isNaN(scheduledStart.getTime())) {
          const diffMs = scheduledStart.getTime() - nowMs;
          if (diffMs > 0) return `Auto start pending • Starts in ${formatDurationHms(diffMs)}`;
        }
      }
      return "Auto start pending";
    }
  }
  const scheduledStartRaw = session.scheduled_start_time;
  if (!scheduledStartRaw) return "";
  const scheduledStart = new Date(scheduledStartRaw);
  if (Number.isNaN(scheduledStart.getTime())) return "";
  const diffMs = scheduledStart.getTime() - nowMs;
  if (diffMs > 0) {
    return `Starts in ${formatDurationHms(diffMs)}`;
  }
  const mode = normalizeStartMode(session.start_mode);
  if (mode === "AUTO" || mode === "MANUAL_OR_AUTO") {
    return "Waiting to start (scheduler delay)";
  }
  return "Start time reached";
}

function sessionStatusHelperText(status?: string | null) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "PLANNED") return "This session is created but not started yet. Bidding should remain blocked until the session is started.";
  if (normalized === "EXPIRED") return "This session has not started yet. Update the schedule to continue.";
  if (normalized === "LIVE") return "This session is currently active.";
  if (normalized === "PAUSED") return "This session is currently paused.";
  if (normalized === "CLOSED") return "This session has ended.";
  if (normalized === "CANCELLED") return "This session was cancelled.";
  return "Session status is currently unavailable.";
}

const DetailField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Stack spacing={0.35}>
    <Typography variant="caption" sx={{ color: "text.secondary", letterSpacing: 0.2 }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>
      {value}
    </Typography>
  </Stack>
);

export const AuctionSessions: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const persistedScope = readAuctionScope();
  const [filters, setFilters] = useState({
    org_code: persistedScope.org_code || "",
    mandi_code: persistedScope.mandi_code || "",
    status: "",
    method: "",
    lane_type: "",
    commodity_group: "",
    overflow_only: "",
    auctioneer_username: "",
    date_from: "",
    date_to: "",
  });
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [orgOptions, setOrgOptions] = useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailErrorSeverity, setDetailErrorSeverity] = useState<"error" | "warning">("error");
  const [detailLoading, setDetailLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [openReschedule, setOpenReschedule] = useState(false);
  const [rescheduleLoading, setRescheduleLoading] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [rescheduleForm, setRescheduleForm] = useState({
    scheduled_start_time: "",
    scheduled_end_time: "",
    session_name: "",
    lane_type: "COMMODITY_LANE",
    commodity_group: "",
    commodity_group_code: "",
    hall_or_zone: "",
    auctioneer_username: "",
    is_overflow_lane: false,
    max_queue_size: "",
    display_order: "",
    notes: "",
  });
  const [openCloseConfirm, setOpenCloseConfirm] = useState(false);
  const [closeConfirmLoading, setCloseConfirmLoading] = useState(false);
  const [closeSummary, setCloseSummary] = useState<CloseSummary>({ mappedCount: 0, liveCount: 0 });
  const [openHelp, setOpenHelp] = useState(false);
  const [openCreateLane, setOpenCreateLane] = useState(false);
  const [createLaneLoading, setCreateLaneLoading] = useState(false);
  const [createLaneError, setCreateLaneError] = useState<string | null>(null);
  const [createLaneErrorSeverity, setCreateLaneErrorSeverity] = useState<"error" | "warning">("error");
  const [createLaneForm, setCreateLaneForm] = useState({
    mandi_code: "",
    start_mode: "MANUAL_OR_AUTO" as SessionStartMode,
    session_code: "",
    commodity_family: "" as string,
    lane_template_key: "" as string,
    session_name: "",
    lane_type: "COMMODITY_LANE",
    commodity_group: "",
    commodity_group_code: "",
    hall_or_zone: "",
    auctioneer_username: "",
    method_code: "OPEN_OUTCRY",
    rounds_enabled: ["ROUND1"],
    closure_mode: "MANUAL_OR_AUTO",
    scheduled_start_time: "",
    scheduled_end_time: "",
    is_overflow_lane: false,
    max_queue_size: "",
    display_order: "",
    notes: "",
  });
  const [laneCapacitySummary, setLaneCapacitySummary] = useState<LaneCapacitySummary>({
    testing_mode_enabled: false,
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
  const [helpRoute, setHelpRoute] = useState("/auction-sessions");
  const [helpTitle, setHelpTitle] = useState("Help");

  const scopedMandiCodes = useMemo(() => (Array.isArray(uiConfig.scope?.mandi_codes) ? uiConfig.scope?.mandi_codes.filter(Boolean) : []), [uiConfig.scope?.mandi_codes]);
  const defaultOrgCode = uiConfig.role === "SUPER_ADMIN" ? "" : uiConfig.scope?.org_code || "";
  const defaultMandiCode = useMemo(() => {
    if (scopedMandiCodes.length > 0) return String(scopedMandiCodes[0]);
    if (mandiOptions.length === 1) return mandiOptions[0].value;
    return "";
  }, [scopedMandiCodes, mandiOptions]);

  const canMenu = useMemo(
    () => can(uiConfig.resources, "auction_sessions.menu", "VIEW") || can(uiConfig.resources, "auction_sessions.list", "VIEW"),
    [uiConfig.resources],
  );
  const canView = useMemo(() => can(uiConfig.resources, "auction_sessions.list", "VIEW"), [uiConfig.resources]);
  const canUpdateSessions = useMemo(() => can(uiConfig.resources, "auction_sessions.update", "UPDATE"), [uiConfig.resources]);
  const canCreateSessions = canUpdateSessions;

  const statusColor = (status?: string | null) => {
    const s = String(status || "").toUpperCase();
    if (s === "LIVE") return "success";
    if (s === "EXPIRED" || s === "CANCELLED") return "error";
    if (s === "PAUSED" || s === "PLANNED") return "warning";
    if (s === "CLOSED") return "default";
    return "default";
  };

  const columns = useMemo<GridColDef<SessionRow>[]>(
    () => [
      {
        field: "session_code",
        headerName: "Lane",
        width: 230,
        renderCell: (params) => (
          <Stack spacing={0.2} sx={{ py: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {displayValue(params.row.session_name || params.row.session_code)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {displayValue(params.row.session_code)}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "status",
        headerName: "Status",
        width: 190,
        renderCell: (params) => {
          const row = params.row as SessionRow;
          const derivedStatus = deriveDisplayStatus(row, nowMs);
          const countdownLabel = getStartCountdownLabel(row, nowMs);
          return (
            <Stack spacing={0.3} sx={{ py: 0.4 }}>
              <Chip size="small" label={derivedStatus} color={statusColor(derivedStatus)} />
              {countdownLabel && (
                <Typography variant="caption" color={countdownLabel.includes("scheduler delay") ? "warning.main" : "text.secondary"}>
                  {countdownLabel}
                </Typography>
              )}
              {row.auto_start_reason && String(row.auto_start_state || "").toUpperCase() === "OVERDUE" && (
                <Typography variant="caption" color="error.main">
                  {row.auto_start_reason}
                </Typography>
              )}
            </Stack>
          );
        },
      },
      {
        field: "commodity_group",
        headerName: "Commodity Group",
        width: 180,
        valueGetter: (_v, row) => row.commodity_group || "—",
      },
      { field: "mandi_code", headerName: "Mandi", width: 140 },
      {
        field: "lane_type",
        headerName: "Lane Type",
        width: 170,
        valueGetter: (_v, row) => laneTypeOptionLabel(row.lane_type),
      },
      {
        field: "active_lot_code",
        headerName: "Active Lot",
        width: 160,
        valueGetter: (_v, row) => row.active_lot_code || "—",
      },
      {
        field: "next_queued_lot_code",
        headerName: "Next Queued",
        width: 160,
        valueGetter: (_v, row) => row.next_queued_lot_code || "—",
      },
      {
        field: "queued_count",
        headerName: "Queued",
        width: 110,
        valueGetter: (_v, row) => row.queued_count ?? 0,
      },
      {
        field: "sold_count",
        headerName: "Sold",
        width: 110,
        valueGetter: (_v, row) => row.sold_count ?? 0,
      },
      {
        field: "unsold_count",
        headerName: "Unsold",
        width: 110,
        valueGetter: (_v, row) => row.unsold_count ?? 0,
      },
      {
        field: "ready_to_close",
        headerName: "Ready To Close",
        width: 150,
        renderCell: (params) => (
          <Chip
            size="small"
            label={params.row.ready_to_close ? "YES" : "NO"}
            color={params.row.ready_to_close ? "success" : "default"}
            variant={params.row.ready_to_close ? "filled" : "outlined"}
          />
        ),
      },
      { field: "method", headerName: "Method", width: 130 },
      { field: "closure_mode", headerName: "Closure Mode", width: 170, valueGetter: (v) => v || "MANUAL_OR_AUTO" },
      {
        field: "scheduled_end_time",
        headerName: "Scheduled End",
        width: 180,
        valueFormatter: (value) => formatDate(value) || "—",
      },
      {
        field: "start_time",
        headerName: "Start",
        width: 180,
        valueFormatter: (value) => formatDate(value) || "—",
      },
      {
        field: "end_time",
        headerName: "Actual End",
        width: 180,
        valueFormatter: (value) => formatDate(value) || "—",
      },
      { field: "hall_or_zone", headerName: "Hall / Zone", width: 140, valueGetter: (value) => value || "—" },
      { field: "auctioneer_username", headerName: "Auctioneer", width: 160, valueGetter: (value) => value || "—" },
      {
        field: "is_overflow_lane",
        headerName: "Overflow",
        width: 120,
        renderCell: (params) => (
          <Chip
            size="small"
            label={params.row.is_overflow_lane ? "OVERFLOW" : "STANDARD"}
            color={params.row.is_overflow_lane ? "warning" : "default"}
            variant={params.row.is_overflow_lane ? "filled" : "outlined"}
          />
        ),
      },
    ],
    [nowMs],
  );

  const loadOrganisations = async () => {
    if (uiConfig.role !== "SUPER_ADMIN") return;
    const username = currentUsername();
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
        const candidates = [
          m?.mandi_slug,
          m?.slug,
          m?.mandi_code,
          m?.mandi_id,
        ].map((value) => String(value || "").toLowerCase()).filter(Boolean);
        return candidates.some((candidate) => allowed.has(candidate));
      });
    }
    setMandiOptions(
      list.map((m: any) => ({
        value: m.mandi_slug || m.slug || String(m.mandi_id || ""),
        label: m?.name_i18n?.en || m.mandi_slug || String(m.mandi_id),
      })),
    );
  };

  const loadData = async () => {
    const username = currentUsername();
    if (!username || !canView) return;
    setLoading(true);
    try {
      const resp = await getAuctionSessions({
        username,
        language,
        filters: {
          org_code: filters.org_code || undefined,
          mandi_code: filters.mandi_code || undefined,
          status: filters.status || undefined,
          method: filters.method || undefined,
          lane_type: filters.lane_type || undefined,
          commodity_group: filters.commodity_group || undefined,
          is_overflow_lane: filters.overflow_only || undefined,
          auctioneer_username: filters.auctioneer_username || undefined,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
          page_size: 100,
        },
      });
      const list = resp?.data?.items || resp?.response?.data?.items || [];
      const mapped: SessionRow[] = list.map((item: any, idx: number) => ({
        id: item._id || item.session_id || `session-${idx}`,
        session_id: item.session_id || item._id || `session-${idx}`,
        session_code: item.session_code || null,
        session_name: item.session_name || null,
        lane_type: item.lane_type || null,
        commodity_group: item.commodity_group || null,
        commodity_group_code: item.commodity_group_code || null,
        hall_or_zone: item.hall_or_zone || null,
        auctioneer_username: item.auctioneer_username || null,
        is_overflow_lane: Boolean(item.is_overflow_lane),
        max_queue_size: item.max_queue_size ?? null,
        display_order: item.display_order ?? null,
        notes: item.notes || null,
        org_code: item.org_code || null,
        mandi_code: item.mandi_code || null,
        method: item.method || item.method_code || null,
        round: item.round || item.round_code || null,
        status: item.status || null,
        derived_status: item.derived_status || null,
        start_mode: item.start_mode || "MANUAL_OR_AUTO",
        actual_start: item.actual_start || item.start_time || null,
        start_time: item.start_time || item.start || null,
        end_time: item.end_time || item.end || null,
        closure_mode: item.closure_mode || "MANUAL_OR_AUTO",
        scheduled_start_time: item.scheduled_start_time || null,
        scheduled_end_time: item.scheduled_end_time || null,
        auto_start_state: item.auto_start_state || null,
        auto_start_label: item.auto_start_label || null,
        auto_start_reason: item.auto_start_reason || null,
        lifecycle_state_reason: item.lifecycle_state_reason || null,
        auto_close_enabled: Boolean(item.auto_close_enabled),
        closed_by_type: item.closed_by_type || null,
        close_reason: item.close_reason || null,
        closed_by_username: item.closed_by_username || null,
        queued_count: item.queued_count ?? 0,
        live_count: item.live_count ?? 0,
        sold_count: item.sold_count ?? 0,
        unsold_count: item.unsold_count ?? 0,
        withdrawn_count: item.withdrawn_count ?? 0,
        has_active_lot: Boolean(item.has_active_lot),
        active_lot_code: item.active_lot_code || null,
        next_queued_lot_code: item.next_queued_lot_code || null,
        ready_to_close: Boolean(item.ready_to_close),
        overloaded: Boolean(item.overloaded),
        overload_reason: item.overload_reason || null,
      }));
      setRows(mapped);
      const summary = resp?.data?.lane_capacity_summary || resp?.response?.data?.lane_capacity_summary || null;
      if (summary) {
        setLaneCapacitySummary({
          testing_mode_enabled: Boolean(summary.testing_mode_enabled),
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
      if (selectedSession) {
        const updated = mapped.find((r) => r.id === selectedSession.id || r.session_id === selectedSession.session_id);
        if (updated) setSelectedSession(updated);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganisations();
    loadMandis();
  }, [language, uiConfig.role]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
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
        console.debug("[AUCTION_SESSIONS_INIT] resolved defaults", {
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
      console.debug("[AUCTION_SESSIONS_INIT] loadData effect", {
        default_mandi_id: defaultMandiCode || null,
        initial_api_call_fired: Boolean(filters.mandi_code || uiConfig.role === "SUPER_ADMIN"),
        appliedFilters: filters,
      });
    }
    loadData();
  }, [
    filters.org_code,
    filters.mandi_code,
    filters.status,
    filters.method,
    filters.lane_type,
    filters.commodity_group,
    filters.overflow_only,
    filters.auctioneer_username,
    filters.date_from,
    filters.date_to,
    language,
    canView,
  ]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (import.meta.env.DEV && key === "mandi_code") {
      console.debug("[AUCTION_SESSIONS_INIT] current selected mandi_id", value || null);
    }
  };

  if (!canMenu || !canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view auction sessions.</Typography>
      </PageContainer>
    );
  }

  const handleStart = async () => {
    const username = currentUsername();
    if (!username || !selectedSession) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const resp: any = await startAuctionSession({
        username,
        language,
        session_id: selectedSession.session_id,
      });
      const rc = resp?.response?.responsecode ?? resp?.responsecode;
      if (String(rc) !== "0") {
        const failure = getActionFailure(resp, "Failed to start session.");
        setDetailErrorSeverity(failure.severity);
        setDetailError(failure.message);
        return;
      }
      setDetailError(null);
      await loadData();
    } catch (err: any) {
      setDetailErrorSeverity("error");
      setDetailError(err?.message || "Failed to start session.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleClose = async () => {
    const username = currentUsername();
    if (!username || !selectedSession) return false;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const resp: any = await closeAuctionSession({
        username,
        language,
        session_id: selectedSession.session_id,
      });
      const rc = resp?.response?.responsecode ?? resp?.responsecode;
      if (String(rc) !== "0") {
        const failure = getActionFailure(resp, "Failed to close session.");
        setDetailErrorSeverity(failure.severity);
        setDetailError(failure.message);
        return false;
      }
      setDetailError(null);
      await loadData();
      return true;
    } catch (err: any) {
      setDetailErrorSeverity("error");
      setDetailError(err?.message || "Failed to close session.");
      return false;
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenCloseConfirm = async () => {
    const username = currentUsername();
    if (!username || !selectedSession) return;
    setDetailError(null);
    setCloseConfirmLoading(true);
    try {
      const resp = await getAuctionLots({
        username,
        language,
        filters: {
          session_id: selectedSession.session_id,
          mandi_code: selectedSession.mandi_code || undefined,
          org_code: selectedSession.org_code || undefined,
          page_size: 200,
        },
      });
      const list: any[] = resp?.data?.items || resp?.response?.data?.items || [];
      const liveCount = list.filter((item) => String(item?.status || "").toUpperCase() === "LIVE").length;
      setCloseSummary({ mappedCount: list.length, liveCount });
    } catch {
      setCloseSummary({ mappedCount: 0, liveCount: 0 });
    } finally {
      setCloseConfirmLoading(false);
      setOpenCloseConfirm(true);
    }
  };

  const handleConfirmCloseAuction = async () => {
    const ok = await handleClose();
    if (ok) {
      setOpenCloseConfirm(false);
    }
  };

  const handleOpenReschedule = () => {
    if (!selectedSession) return;
    setRescheduleError(null);
    setRescheduleForm({
      scheduled_start_time: toDateTimeInputValue(selectedSession.scheduled_start_time || null),
      scheduled_end_time: toDateTimeInputValue(selectedSession.scheduled_end_time || null),
      session_name: selectedSession.session_name || "",
      lane_type: selectedSession.lane_type || "COMMODITY_LANE",
      commodity_group: selectedSession.commodity_group || "",
      commodity_group_code: selectedSession.commodity_group_code || "",
      hall_or_zone: selectedSession.hall_or_zone || "",
      auctioneer_username: selectedSession.auctioneer_username || "",
      is_overflow_lane: Boolean(selectedSession.is_overflow_lane),
      max_queue_size: selectedSession.max_queue_size != null ? String(selectedSession.max_queue_size) : "",
      display_order: selectedSession.display_order != null ? String(selectedSession.display_order) : "",
      notes: selectedSession.notes || "",
    });
    setOpenReschedule(true);
  };

  const handleSubmitReschedule = async () => {
    const username = currentUsername();
    if (!username || !selectedSession) return;
    setRescheduleLoading(true);
    setRescheduleError(null);
    try {
      const payload: Record<string, any> = { session_id: selectedSession.session_id };
      if (rescheduleForm.scheduled_start_time) payload.scheduled_start_time = new Date(rescheduleForm.scheduled_start_time).toISOString();
      if (rescheduleForm.scheduled_end_time) payload.scheduled_end_time = new Date(rescheduleForm.scheduled_end_time).toISOString();
      payload.session_name = rescheduleForm.session_name;
      payload.lane_type = rescheduleForm.lane_type;
      payload.commodity_group = rescheduleForm.commodity_group || undefined;
      payload.commodity_group_code = rescheduleForm.commodity_group_code || undefined;
      payload.hall_or_zone = rescheduleForm.hall_or_zone || undefined;
      payload.auctioneer_username = rescheduleForm.auctioneer_username || undefined;
      payload.is_overflow_lane = rescheduleForm.is_overflow_lane;
      payload.max_queue_size = rescheduleForm.max_queue_size || undefined;
      payload.display_order = rescheduleForm.display_order || undefined;
      payload.notes = rescheduleForm.notes || undefined;
      const resp: any = await rescheduleAuctionSession({
        username,
        language,
        payload,
      });
      const rc = resp?.response?.responsecode ?? resp?.responsecode;
      const desc = resp?.response?.description ?? resp?.description;
      if (String(rc) !== "0") {
        setRescheduleError(desc || "Failed to reschedule session.");
        return;
      }
      setOpenReschedule(false);
      await loadData();
    } catch (err: any) {
      setRescheduleError(err?.message || "Failed to reschedule session.");
    } finally {
      setRescheduleLoading(false);
    }
  };

  const selectedSessionDisplayStatus = selectedSession ? deriveDisplayStatus(selectedSession, nowMs) : "PLANNED";
  const isExpiredPlanned = selectedSessionDisplayStatus === "EXPIRED";
  const selectedRole = String(uiConfig.role || "").toUpperCase();
  const roleCanReschedule = ["SUPER_ADMIN", "ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER"].includes(selectedRole);
  const canRescheduleSelected = Boolean(
    selectedSession &&
    canUpdateSessions &&
    roleCanReschedule &&
    String(selectedSession.status || "").toUpperCase() === "PLANNED" &&
    !selectedSession.start_time
  );
  const liveLaneRows = useMemo(
    () => rows.filter((row) => deriveDisplayStatus(row, nowMs) === "LIVE"),
    [rows, nowMs],
  );
  const selectedCommodityFamily = createLaneForm.commodity_family as CommodityFamily | "";
  const createLaneTemplateOptions = selectedCommodityFamily
    ? (LANE_TEMPLATE_MAP[selectedCommodityFamily] || [])
    : [];

  const applyLaneTemplate = (templateKey: string, commodityFamily: CommodityFamily) => {
    const template = (LANE_TEMPLATE_MAP[commodityFamily] || []).find((item) => item.key === templateKey);
    if (!template) return;
    setCreateLaneForm((prev) => ({
      ...prev,
      commodity_family: commodityFamily,
      lane_template_key: template.key,
      session_name: template.session_name,
      lane_type: template.lane_type,
      commodity_group: template.commodity_group,
      commodity_group_code: template.commodity_group_code || prev.commodity_group_code,
      is_overflow_lane: Boolean(template.is_overflow_lane),
    }));
  };

  const handleOpenCreateLane = () => {
    const singleScopedMandi = scopedMandiCodes.length === 1 ? String(scopedMandiCodes[0]) : "";
    const singleLoadedMandi = mandiOptions.length === 1 ? String(mandiOptions[0].value) : "";
    const modalMandiCode = filters.mandi_code || singleScopedMandi || singleLoadedMandi || "";
    setCreateLaneError(null);
    setCreateLaneForm({
      mandi_code: modalMandiCode,
      start_mode: "MANUAL_OR_AUTO",
      session_code: "",
      commodity_family: "",
      lane_template_key: "",
      session_name: "",
      lane_type: "COMMODITY_LANE",
      commodity_group: "",
      commodity_group_code: "",
      hall_or_zone: "",
      auctioneer_username: "",
      method_code: "OPEN_OUTCRY",
      rounds_enabled: ["ROUND1"],
      closure_mode: "MANUAL_OR_AUTO",
      scheduled_start_time: "",
      scheduled_end_time: "",
      is_overflow_lane: false,
      max_queue_size: "",
      display_order: "",
      notes: "",
    });
    setOpenCreateLane(true);
  };

  const handleCreateLane = async () => {
    const username = currentUsername();
    if (!username) return;
    setCreateLaneLoading(true);
    setCreateLaneError(null);
    try {
      const payload: Record<string, any> = {
        org_code: filters.org_code || undefined,
        mandi_code: createLaneForm.mandi_code || undefined,
        method_code: createLaneForm.method_code,
        rounds_enabled: createLaneForm.rounds_enabled,
        status: "PLANNED",
        start_mode: createLaneForm.start_mode,
        closure_mode: createLaneForm.closure_mode,
        session_code: createLaneForm.session_code || undefined,
        session_name: createLaneForm.session_name,
        lane_type: createLaneForm.lane_type,
        commodity_group: createLaneForm.commodity_group || undefined,
        commodity_group_code: createLaneForm.commodity_group_code || undefined,
        hall_or_zone: createLaneForm.hall_or_zone || undefined,
        auctioneer_username: createLaneForm.auctioneer_username || undefined,
        is_overflow_lane: createLaneForm.is_overflow_lane,
        max_queue_size: createLaneForm.max_queue_size || undefined,
        display_order: createLaneForm.display_order || undefined,
        notes: createLaneForm.notes || undefined,
        scheduled_start_time: createLaneForm.scheduled_start_time ? new Date(createLaneForm.scheduled_start_time).toISOString() : undefined,
        scheduled_end_time: createLaneForm.scheduled_end_time ? new Date(createLaneForm.scheduled_end_time).toISOString() : undefined,
        allow_manual_close_when_auto_enabled: true,
      };
      const resp: any = await createAuctionSession({ username, language, payload });
      const rc = resp?.response?.responsecode ?? resp?.responsecode;
      if (String(rc) !== "0") {
        const failure = getActionFailure(resp, "Failed to create auction lane.");
        setCreateLaneErrorSeverity(failure.severity);
        setCreateLaneError(failure.message);
        return;
      }
      setCreateLaneError(null);
      setOpenCreateLane(false);
      await loadData();
    } catch (err: any) {
      setCreateLaneErrorSeverity("error");
      setCreateLaneError(err?.message || "Failed to create auction lane.");
    } finally {
      setCreateLaneLoading(false);
    }
  };

  const scheduledStartDate = createLaneForm.scheduled_start_time ? new Date(createLaneForm.scheduled_start_time) : null;
  const scheduledEndDate = createLaneForm.scheduled_end_time ? new Date(createLaneForm.scheduled_end_time) : null;
  const scheduledStartMs = scheduledStartDate ? scheduledStartDate.getTime() : null;
  const scheduledEndMs = scheduledEndDate ? scheduledEndDate.getTime() : null;
  const isScheduledStartInvalid = Boolean(scheduledStartDate && Number.isNaN(scheduledStartDate.getTime()));
  const isScheduledEndInvalid = Boolean(scheduledEndDate && Number.isNaN(scheduledEndDate.getTime()));
  const requiresScheduledEnd = createLaneForm.closure_mode === "AUTO_AT_END_TIME" || createLaneForm.closure_mode === "MANUAL_OR_AUTO";
  const missingScheduledEnd = requiresScheduledEnd && !createLaneForm.scheduled_end_time;
  const isScheduleRangeInvalid =
    scheduledStartMs !== null
    && scheduledEndMs !== null
    && !Number.isNaN(scheduledStartMs)
    && !Number.isNaN(scheduledEndMs)
    && scheduledEndMs <= scheduledStartMs;
  const hasCreateLaneDateError = isScheduledStartInvalid || isScheduledEndInvalid || missingScheduledEnd || isScheduleRangeInvalid;
  const isCreateLaneMandiMissing = !String(createLaneForm.mandi_code || "").trim();
  const isCreateLaneRequiredFieldsMissing = !String(createLaneForm.session_name || "").trim() || !String(filters.org_code || "").trim();
  const isCreateLaneCapacityBlocked = !laneCapacitySummary.auction_lanes_enabled || !laneCapacitySummary.can_create_new_lane;
  const isCreateLaneSubmitDisabled =
    createLaneLoading
    || isCreateLaneMandiMissing
    || isCreateLaneRequiredFieldsMissing
    || isCreateLaneCapacityBlocked
    || hasCreateLaneDateError;

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">{t("menu.auctionSessions", { defaultValue: "Auction Sessions" })}</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage auction lanes by commodity, queue depth, and close readiness.
          </Typography>
          {!filters.mandi_code && uiConfig.role !== "SUPER_ADMIN" && (
            <Typography variant="body2" color="text.secondary">
              Showing sessions across your allowed mandis. Use the mandi dropdown to narrow the list.
            </Typography>
          )}
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          {canCreateSessions && (
            <Button variant="contained" onClick={handleOpenCreateLane} disabled={!laneCapacitySummary.can_create_new_lane || !laneCapacitySummary.auction_lanes_enabled}>
              Create Lane
            </Button>
          )}
          <IconButton color="primary" onClick={() => { setHelpRoute("/auction-sessions"); setHelpTitle("Auction Sessions Help"); setOpenHelp(true); }} title="Help">
            <HelpOutlineIcon />
          </IconButton>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1} mb={2}>
          <Typography variant="subtitle2" color="text.secondary">
            Filter Lanes
          </Typography>
        </Stack>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(190px, 1fr))", lg: "repeat(4, minmax(190px, 1fr))" },
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
          >
            <MenuItem value="">All</MenuItem>
            {mandiOptions.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Status"
            size="small"
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="PLANNED">Planned</MenuItem>
            <MenuItem value="LIVE">Live</MenuItem>
            <MenuItem value="PAUSED">Paused</MenuItem>
            <MenuItem value="CLOSED">Closed</MenuItem>
            <MenuItem value="CANCELLED">Cancelled</MenuItem>
          </TextField>

          <TextField
            label="Lane Type"
            size="small"
            value={filters.lane_type}
            onChange={(e) => updateFilter("lane_type", e.target.value)}
            select
          >
            <MenuItem value="">All</MenuItem>
            {LANE_TYPE_OPTIONS.map((laneType) => (
              <MenuItem key={laneType} value={laneType}>
                {laneTypeOptionLabel(laneType)}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Commodity Group"
            size="small"
            value={filters.commodity_group}
            onChange={(e) => updateFilter("commodity_group", e.target.value)}
          />

          <TextField
            select
            label="Overflow"
            size="small"
            value={filters.overflow_only}
            onChange={(e) => updateFilter("overflow_only", e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="true">Yes</MenuItem>
            <MenuItem value="false">No</MenuItem>
          </TextField>

          <TextField
            label="Auctioneer"
            size="small"
            value={filters.auctioneer_username}
            onChange={(e) => updateFilter("auctioneer_username", e.target.value)}
          />

          <TextField
            label="Method"
            size="small"
            value={filters.method}
            onChange={(e) => updateFilter("method", e.target.value)}
          />

          <TextField
            label="Date From"
            type="date"
            size="small"
            value={filters.date_from}
            onChange={(e) => updateFilter("date_from", e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Date To"
            type="date"
            size="small"
            value={filters.date_to}
            onChange={(e) => updateFilter("date_to", e.target.value)}
            InputLabelProps={{ shrink: true }}
          />
        </Box>
      </Paper>

      {laneCapacitySummary.testing_mode_enabled && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Testing Mode is enabled. Additional lanes can be created using testing limits.
        </Alert>
      )}

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
              <DetailField label="Live Lanes" value={displayCount(laneCapacitySummary.current_live_sessions)} />
              <DetailField label="Open Lanes" value={displayCount(laneCapacitySummary.current_open_sessions)} />
              <DetailField label="Allowed Live Lanes" value={displayCount(laneCapacitySummary.effective_max_live_sessions)} />
              <DetailField label="Allowed Open Lanes" value={displayCount(laneCapacitySummary.effective_max_open_sessions)} />
              <DetailField label="Total Queued Lots" value={displayCount(laneCapacitySummary.current_total_queued_lots)} />
              <DetailField label="Allowed Queue Capacity" value={displayCount(laneCapacitySummary.effective_max_total_queued_lots)} />
              <DetailField label="Org Live / Open" value={`${displayCount(laneCapacitySummary.current_org_live_sessions)} / ${displayCount(laneCapacitySummary.current_org_open_sessions)}`} />
              <DetailField label="Org Queued Lots" value={displayCount(laneCapacitySummary.current_org_total_queued_lots)} />
              <DetailField label="System Live / Open" value={`${displayCount(laneCapacitySummary.current_system_live_sessions)} / ${displayCount(laneCapacitySummary.current_system_open_sessions)}`} />
              <DetailField label="System Queued Lots" value={displayCount(laneCapacitySummary.current_system_total_queued_lots)} />
              <DetailField label="Average Queue per Lane" value={String(laneCapacitySummary.average_queue_per_lane || 0)} />
              <DetailField label="Overloaded Lanes" value={displayCount(laneCapacitySummary.overloaded_lane_count)} />
              <DetailField label="Can Create New Lane?" value={laneCapacitySummary.can_create_new_lane ? "Yes" : "No"} />
              <DetailField label="Guard State" value={laneCapacitySummary.capacity_guard_state || "GREEN"} />
              <DetailField label="Limit Source" value={laneCapacitySummary.testing_mode_enabled ? "TESTING_CAPACITY_OVERRIDE" : "LIVE_CAPACITY_CONFIG"} />
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
        <Stack spacing={1.5}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              Live Auction Lanes
            </Typography>
            <Typography variant="caption" color="text.secondary">
              One live lot per session lane. Ready-to-close means no active or queued lot remains.
            </Typography>
          </Stack>
          {liveLaneRows.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No live lanes for the selected filters.
            </Typography>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(280px, 1fr))", xl: "repeat(3, minmax(280px, 1fr))" },
                gap: 1.5,
              }}
            >
              {liveLaneRows.map((lane) => (
                <Paper key={lane.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "background.paper" }}>
                  <Stack spacing={0.8}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                          {displayValue(lane.session_name || lane.session_code)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {displayValue(lane.commodity_group)} · {laneTypeOptionLabel(lane.lane_type)}
                        </Typography>
                      </Box>
                      <Stack direction="row" spacing={0.75} flexWrap="wrap" justifyContent="flex-end">
                        {lane.is_overflow_lane && <Chip size="small" label="Overflow" color="warning" variant="outlined" />}
                        {lane.overloaded && <Chip size="small" label="Overloaded" color="error" />}
                        <Chip size="small" label={lane.ready_to_close ? "Ready To Close" : "In Progress"} color={lane.ready_to_close ? "success" : "warning"} />
                      </Stack>
                    </Stack>
                    <Typography variant="body2" color="text.secondary">
                      Active lot: <strong>{displayValue(lane.active_lot_code)}</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Next queued: <strong>{displayValue(lane.next_queued_lot_code)}</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Queue: <strong>{displayCount(lane.queued_count)}</strong> · Sold: <strong>{displayCount(lane.sold_count)}</strong> · Unsold: <strong>{displayCount(lane.unsold_count)}</strong>
                    </Typography>
                    {lane.overload_reason && (
                      <Typography variant="caption" sx={{ color: lane.overloaded ? "error.main" : "warning.main", fontWeight: 600 }}>
                        {lane.overload_reason}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary">
                      Scheduled end: {displayValue(formatDate(lane.scheduled_end_time))}
                    </Typography>
                  </Stack>
                </Paper>
              ))}
            </Box>
          )}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
        <Box sx={{ width: "100%" }}>
        <ResponsiveDataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r.id}
          disableRowSelectionOnClick
          onRowClick={(params: any) => {
            setSelectedSession(params.row as SessionRow);
            setDetailError(null);
            setOpenDetail(true);
          }}
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
          minWidth={960}
          sx={{
            "& .MuiDataGrid-cell": { alignItems: "center", py: 0.6 },
            "& .MuiDataGrid-columnHeaders": { borderBottom: "1px solid", borderColor: "divider" },
            "& .MuiDataGrid-row:hover": { backgroundColor: "action.hover", cursor: "pointer" },
          }}
        />
        </Box>
        {!loading && rows.length === 0 && (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              No auction sessions found for selected filters.
            </Typography>
          </Box>
        )}
      </Paper>

      {openDetail && selectedSession && (
        <Dialog open={openDetail} onClose={() => { setDetailError(null); setOpenDetail(false); }} fullWidth maxWidth="md">
          <DialogTitle sx={{ pb: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
              <Stack spacing={0.4}>
                <Typography variant="h6">Auction Session Detail</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {displayValue(selectedSession.session_code)}
                </Typography>
              </Stack>
              <Chip
                size="small"
                label={selectedSessionDisplayStatus}
                color={statusColor(selectedSessionDisplayStatus)}
                sx={{ alignSelf: "center", fontWeight: 700 }}
              />
            </Stack>
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ bgcolor: "#f7f8f3", py: 2.5 }}>
            <Stack spacing={2}>
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2, bgcolor: "background.paper" }}>
                <Typography variant="subtitle2" sx={{ mb: 1.4, fontWeight: 700 }}>
                  Session Identity
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
                  <DetailField label="Session ID" value={displayValue(selectedSession.session_id)} />
                  <DetailField label="Session Code" value={displayValue(selectedSession.session_code)} />
                  <DetailField label="Session Name" value={displayValue(selectedSession.session_name)} />
                  <DetailField label="Lane Type" value={displayValue(laneTypeOptionLabel(selectedSession.lane_type))} />
                  <DetailField label="Commodity Group" value={displayValue(selectedSession.commodity_group)} />
                  <DetailField label="Hall / Zone" value={displayValue(selectedSession.hall_or_zone)} />
                  <DetailField label="Auctioneer" value={displayValue(selectedSession.auctioneer_username)} />
                  <DetailField label="Overflow Lane" value={selectedSession.is_overflow_lane ? "Yes" : "No"} />
                  <DetailField label="Organisation" value={displayValue(selectedSession.org_code)} />
                  <DetailField label="Mandi" value={displayValue(selectedSession.mandi_code)} />
                  <DetailField label="Method" value={displayValue(selectedSession.method)} />
                  <DetailField label="Start Mode" value={displayValue(normalizeStartMode(selectedSession.start_mode))} />
                  <DetailField label="Round(s)" value={displayValue(selectedSession.round)} />
                </Box>
              </Box>

              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2, bgcolor: "background.paper" }}>
                <Typography variant="subtitle2" sx={{ mb: 1.4, fontWeight: 700 }}>
                  Session Timing
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
                  <DetailField label="Start Time" value={displayValue(formatDate(selectedSession.start_time))} />
                  <DetailField label="Actual Start" value={displayValue(formatDate(selectedSession.actual_start || selectedSession.start_time))} />
                  <DetailField label="Actual End" value={displayValue(formatDate(selectedSession.end_time))} />
                  <DetailField label="Scheduled End" value={displayValue(formatDate(selectedSession.scheduled_end_time))} />
                  <DetailField label="Closure Mode" value={closureModeLabel(selectedSession.closure_mode || "MANUAL_OR_AUTO")} />
                  <DetailField label="Closed By Type" value={displayValue(selectedSession.closed_by_type)} />
                  <DetailField label="Close Reason" value={displayValue(selectedSession.close_reason)} />
                  <DetailField label="Closed By Username" value={displayValue(selectedSession.closed_by_username)} />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1.2, display: "block" }}>
                  Actual End remains blank until the session is closed.
                </Typography>
                {selectedSession.scheduled_end_time && ["PLANNED", "LIVE"].includes(String(selectedSession.status || "").toUpperCase()) && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`Scheduled to end at ${formatDate(selectedSession.scheduled_end_time)}`}
                    sx={{ mt: 1.5 }}
                  />
                )}
              </Box>

              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2, bgcolor: "background.paper" }}>
                <Typography variant="subtitle2" sx={{ mb: 0.8, fontWeight: 700 }}>
                  Session Progress
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5, mb: 1.5 }}>
                  <DetailField label="Queued Lots" value={displayCount(selectedSession.queued_count)} />
                  <DetailField label="Live Lots" value={displayCount(selectedSession.live_count)} />
                  <DetailField label="Sold Lots" value={displayCount(selectedSession.sold_count)} />
                  <DetailField label="Unsold Lots" value={displayCount(selectedSession.unsold_count)} />
                  <DetailField label="Withdrawn Lots" value={displayCount(selectedSession.withdrawn_count)} />
                  <DetailField label="Active Lot Code" value={displayValue(selectedSession.active_lot_code)} />
                  <DetailField label="Next Queued Lot" value={displayValue(selectedSession.next_queued_lot_code)} />
                  <DetailField label="Ready To Close" value={selectedSession.ready_to_close ? "Yes" : "No"} />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {sessionStatusHelperText(selectedSessionDisplayStatus)}
                </Typography>
                {selectedSessionDisplayStatus === "LIVE" && !selectedSession.has_active_lot && Boolean(selectedSession.next_queued_lot_code) && (
                  <Alert severity="warning" sx={{ mt: 1 }}>
                    Live lane has no active lot. Next queued lot could not be activated.
                  </Alert>
                )}
                {isExpiredPlanned && (
                  <Typography variant="body2" sx={{ mt: 0.8 }} color="text.secondary">
                    This session has not started yet. Update the schedule to continue.
                  </Typography>
                )}
              </Box>

              {detailError && (
                <Alert severity={detailErrorSeverity}>
                  {detailError}
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 1.75 }}>
            <Button onClick={() => { setDetailError(null); setOpenDetail(false); }} disabled={detailLoading} color="inherit">
              Close
            </Button>
            {canRescheduleSelected && (
              <Button variant="outlined" onClick={handleOpenReschedule} disabled={detailLoading}>
                Edit Lane
              </Button>
            )}
            {String(selectedSession.status || "").toUpperCase() === "PLANNED" && (
              <Button variant="contained" onClick={handleStart} disabled={detailLoading} sx={{ minWidth: 140 }}>
                {detailLoading ? "Starting..." : "Start Now"}
              </Button>
            )}
            {(String(selectedSession.status || "").toUpperCase() === "LIVE" || String(selectedSession.status || "").toUpperCase() === "PLANNED") && (
              <Button variant="outlined" color="error" onClick={handleOpenCloseConfirm} disabled={detailLoading} sx={{ minWidth: 140 }}>
                Close Auction
              </Button>
            )}
          </DialogActions>
        </Dialog>
      )}

      {openCloseConfirm && selectedSession && (
        <Dialog open={openCloseConfirm} onClose={() => { setDetailError(null); setOpenCloseConfirm(false); }} fullWidth maxWidth="sm">
          <DialogTitle>Close Auction Session?</DialogTitle>
          <DialogContent>
            <Stack spacing={1.25} mt={0.5}>
              <DetailField label="Session Code" value={displayValue(selectedSession.session_code)} />
              <DetailField label="Status" value={selectedSessionDisplayStatus} />
              <DetailField label="Mandi" value={displayValue(selectedSession.mandi_code)} />
              <DetailField label="Scheduled End" value={displayValue(formatDate(selectedSession.scheduled_end_time))} />
              <DetailField label="Mapped Lots" value={String(closeSummary.mappedCount)} />
              <DetailField label="Active/Live Lots" value={String(closeSummary.liveCount)} />
              <Typography variant="body2" color="text.secondary">
                Closing this session will stop bidding. Mapped lots will be evaluated: lots with winning bids become SOLD and move to settlement pending, while lots without bids become UNSOLD. Results will be written to Auction Results.
              </Typography>
              {detailError && (
                <Alert severity={detailErrorSeverity}>
                  {detailError}
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setDetailError(null); setOpenCloseConfirm(false); }} disabled={detailLoading || closeConfirmLoading}>
              Cancel
            </Button>
            <Button
              variant="contained"
              color="error"
              onClick={handleConfirmCloseAuction}
              disabled={detailLoading || closeConfirmLoading}
            >
              {detailLoading ? "Closing..." : "Confirm Close"}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {openReschedule && selectedSession && (
        <Dialog open={openReschedule} onClose={() => setOpenReschedule(false)} fullWidth maxWidth="sm">
          <DialogTitle>Edit Auction Lane</DialogTitle>
          <DialogContent>
            <Stack spacing={1.5} mt={1}>
              <Typography variant="body2" color="text.secondary">
                Update lane metadata and session timing before bidding begins.
              </Typography>
              {isExpiredPlanned && (
                <Typography variant="body2" color="text.secondary">
                  This session missed its scheduled window. Reschedule it to make it startable again.
                </Typography>
              )}
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper" }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 700 }}>
                  Section B — Auction Lane Details
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Create one auction lane for a commodity or auction purpose. Example: Cereals Lane A, Pulses Lane A, Premium Dry Fruits Lane.
                </Typography>
                <Stack spacing={1.5}>
                  <TextField
                    label="Session Code"
                    value={selectedSession.session_code || ""}
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />
                  <TextField
                    label="Lane Name"
                    value={rescheduleForm.session_name}
                    onChange={(e) => setRescheduleForm((prev) => ({ ...prev, session_name: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    select
                    label="Lane Type"
                    value={rescheduleForm.lane_type}
                    onChange={(e) => setRescheduleForm((prev) => ({ ...prev, lane_type: e.target.value }))}
                    fullWidth
                  >
                    {LANE_TYPE_OPTIONS.map((laneType) => (
                      <MenuItem key={laneType} value={laneType}>
                        {laneTypeOptionLabel(laneType)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Commodity Group"
                    value={rescheduleForm.commodity_group}
                    onChange={(e) => setRescheduleForm((prev) => ({ ...prev, commodity_group: e.target.value }))}
                    fullWidth
                  />
                </Stack>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f6f1e8", mb: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                    Examples
                  </Typography>
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      Example 1: Lane Name: <strong>Cereals Lane A</strong> · Lane Type: <strong>Commodity Lane</strong> · Commodity Group: <strong>Cereals</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Example 2: Lane Name: <strong>Pulses Lane A</strong> · Lane Type: <strong>Commodity Lane</strong> · Commodity Group: <strong>Pulses</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Example 3: Lane Name: <strong>Premium Dry Fruits Lane</strong> · Lane Type: <strong>Premium Lane</strong> · Commodity Group: <strong>Dry Fruits</strong>
                    </Typography>
                  </Stack>
                </Paper>
                <Accordion disableGutters elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, "&:before": { display: "none" } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Advanced Lane Settings
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1.5}>
                      <TextField
                        label="Internal Commodity Code"
                        value={rescheduleForm.commodity_group_code}
                        onChange={(e) => setRescheduleForm((prev) => ({ ...prev, commodity_group_code: e.target.value }))}
                        helperText="Optional internal code such as CEREALS or PULSES."
                        fullWidth
                      />
                      <TextField
                        label="Hall / Zone"
                        value={rescheduleForm.hall_or_zone}
                        onChange={(e) => setRescheduleForm((prev) => ({ ...prev, hall_or_zone: e.target.value }))}
                        helperText="Optional physical mandi area, such as Hall A or Yard 1."
                        fullWidth
                      />
                      <TextField
                        label="Auctioneer / Operator Username"
                        value={rescheduleForm.auctioneer_username}
                        onChange={(e) => setRescheduleForm((prev) => ({ ...prev, auctioneer_username: e.target.value }))}
                        fullWidth
                      />
                      <TextField
                        select
                        label="Is Overflow Lane?"
                        value={rescheduleForm.is_overflow_lane ? "true" : "false"}
                        onChange={(e) => setRescheduleForm((prev) => ({ ...prev, is_overflow_lane: e.target.value === "true" }))}
                        helperText="Use this only when opening an extra lane to reduce crowding in a busy commodity group."
                        fullWidth
                      >
                        <MenuItem value="false">No</MenuItem>
                        <MenuItem value="true">Yes</MenuItem>
                      </TextField>
                      <TextField
                        label="Max Queue Size"
                        type="number"
                        value={rescheduleForm.max_queue_size}
                        onChange={(e) => setRescheduleForm((prev) => ({ ...prev, max_queue_size: e.target.value }))}
                        helperText="Optional limit for how many lots should stay in this lane before opening another lane."
                        fullWidth
                      />
                      <TextField
                        label="Screen Order"
                        type="number"
                        value={rescheduleForm.display_order}
                        onChange={(e) => setRescheduleForm((prev) => ({ ...prev, display_order: e.target.value }))}
                        helperText="Optional order for showing lanes on the screen."
                        fullWidth
                      />
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper" }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>
                  Section C — Closure Plan
                </Typography>
                <Stack spacing={1.5}>
                  <TextField
                    label="Closure Mode"
                    value={closureModeLabel(selectedSession.closure_mode || "")}
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />
                  <TextField
                    label="Scheduled Start"
                    type="datetime-local"
                    value={rescheduleForm.scheduled_start_time}
                    onChange={(e) => setRescheduleForm((prev) => ({ ...prev, scheduled_start_time: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                  <TextField
                    label="Scheduled End"
                    type="datetime-local"
                    value={rescheduleForm.scheduled_end_time}
                    onChange={(e) => setRescheduleForm((prev) => ({ ...prev, scheduled_end_time: e.target.value }))}
                    InputLabelProps={{ shrink: true }}
                    fullWidth
                  />
                </Stack>
              </Paper>
              <TextField
                label="Notes"
                value={rescheduleForm.notes}
                onChange={(e) => setRescheduleForm((prev) => ({ ...prev, notes: e.target.value }))}
                multiline
                minRows={3}
                fullWidth
              />
              {rescheduleError && (
                <Typography variant="body2" color="error">
                  {rescheduleError}
                </Typography>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenReschedule(false)} disabled={rescheduleLoading}>
              Close
            </Button>
            <Button variant="contained" onClick={handleSubmitReschedule} disabled={rescheduleLoading || !rescheduleForm.session_name}>
              {rescheduleLoading ? "Saving..." : "Save Lane"}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      {openCreateLane && (
        <Dialog open={openCreateLane} onClose={() => { setCreateLaneError(null); setOpenCreateLane(false); }} fullWidth maxWidth="md">
          <DialogTitle>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">Create Auction Lane</Typography>
              <IconButton size="small" onClick={() => { setHelpRoute("/auction-sessions"); setHelpTitle("Create Auction Lane Help"); setOpenHelp(true); }}>
                <HelpOutlineIcon fontSize="small" />
              </IconButton>
            </Stack>
          </DialogTitle>
          <DialogContent>
            <Stack spacing={1.5} mt={1}>
              <Typography variant="body2" color="text.secondary">
                Create a lane-aware auction session. Existing lifecycle behavior remains unchanged; this only adds business identity and queue metadata.
              </Typography>
              <TextField label="Organisation" value={filters.org_code || "Select in filters"} InputProps={{ readOnly: true }} fullWidth />
              <TextField
                select
                required
                label="Mandi"
                value={createLaneForm.mandi_code}
                onChange={(e) => setCreateLaneForm((prev) => ({ ...prev, mandi_code: e.target.value }))}
                helperText="Required. Only mandis you can access are shown."
                fullWidth
              >
                <MenuItem value="">Select Mandi</MenuItem>
                {mandiOptions.map((m) => (
                  <MenuItem key={m.value} value={m.value}>
                    {m.label}
                  </MenuItem>
                ))}
              </TextField>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper" }}>
                <Typography variant="subtitle2" sx={{ mb: 0.5, fontWeight: 700 }}>
                  Section B — Auction Lane Details
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                  Create one auction lane for a commodity or auction purpose. Example: Cereals Lane A, Pulses Lane A, Premium Dry Fruits Lane.
                </Typography>
                <Stack spacing={1.5}>
                  <TextField
                    label="Session Code"
                    value={createLaneForm.session_code}
                    InputProps={{ readOnly: true }}
                    fullWidth
                  />
                  <TextField
                    select
                    label="Commodity Family"
                    value={createLaneForm.commodity_family}
                    onChange={(e) => {
                      const family = e.target.value as CommodityFamily | "";
                      setCreateLaneForm((prev) => ({
                        ...prev,
                        commodity_family: family,
                        lane_template_key: "",
                      }));
                    }}
                    helperText="Choose a commodity family first to reduce manual lane setup."
                    fullWidth
                  >
                    {COMMODITY_FAMILY_OPTIONS.map((family) => (
                      <MenuItem key={family} value={family}>
                        {family}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    select
                    label="Lane Template"
                    value={createLaneForm.lane_template_key}
                    onChange={(e) => {
                      if (!selectedCommodityFamily) return;
                      applyLaneTemplate(e.target.value, selectedCommodityFamily);
                    }}
                    helperText={
                      selectedCommodityFamily
                        ? "Selecting a template will auto-fill lane name, type, and commodity details."
                        : "Select a commodity family to see lane templates."
                    }
                    disabled={!selectedCommodityFamily}
                    fullWidth
                  >
                    {createLaneTemplateOptions.map((template) => (
                      <MenuItem key={template.key} value={template.key}>
                        {template.label}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Lane Name"
                    value={createLaneForm.session_name}
                    onChange={(e) => setCreateLaneForm((prev) => ({ ...prev, lane_template_key: "", session_name: e.target.value }))}
                    fullWidth
                  />
                  <TextField
                    select
                    label="Lane Type"
                    value={createLaneForm.lane_type}
                    onChange={(e) => setCreateLaneForm((prev) => ({ ...prev, lane_template_key: "", lane_type: e.target.value }))}
                    fullWidth
                  >
                    {LANE_TYPE_OPTIONS.map((laneType) => (
                      <MenuItem key={laneType} value={laneType}>
                        {laneTypeOptionLabel(laneType)}
                      </MenuItem>
                    ))}
                  </TextField>
                  <TextField
                    label="Commodity Group"
                    value={createLaneForm.commodity_group}
                    onChange={(e) => setCreateLaneForm((prev) => ({ ...prev, lane_template_key: "", commodity_group: e.target.value }))}
                    fullWidth
                  />
                </Stack>
                <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2, bgcolor: "#f6f1e8", mt: 1.5, mb: 1.5 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                    Examples
                  </Typography>
                  <Stack spacing={1}>
                    <Typography variant="body2" color="text.secondary">
                      Example 1: Lane Name: <strong>Cereals Lane A</strong> · Lane Type: <strong>Commodity Lane</strong> · Commodity Group: <strong>Cereals</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Example 2: Lane Name: <strong>Pulses Lane A</strong> · Lane Type: <strong>Commodity Lane</strong> · Commodity Group: <strong>Pulses</strong>
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Example 3: Lane Name: <strong>Premium Dry Fruits Lane</strong> · Lane Type: <strong>Premium Lane</strong> · Commodity Group: <strong>Dry Fruits</strong>
                    </Typography>
                  </Stack>
                </Paper>
                <Accordion disableGutters elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, "&:before": { display: "none" } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      Advanced Lane Settings
                    </Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={1.5}>
                      <TextField
                        label="Internal Commodity Code"
                        value={createLaneForm.commodity_group_code}
                        onChange={(e) => setCreateLaneForm((prev) => ({ ...prev, commodity_group_code: e.target.value }))}
                        helperText="Optional internal code such as CEREALS or PULSES."
                        fullWidth
                      />
                      <TextField
                        label="Hall / Zone"
                        value={createLaneForm.hall_or_zone}
                        onChange={(e) => setCreateLaneForm((prev) => ({ ...prev, hall_or_zone: e.target.value }))}
                        helperText="Optional physical mandi area, such as Hall A or Yard 1."
                        fullWidth
                      />
                      <TextField
                        label="Auctioneer / Operator Username"
                        value={createLaneForm.auctioneer_username}
                        onChange={(e) => setCreateLaneForm((prev) => ({ ...prev, auctioneer_username: e.target.value }))}
                        fullWidth
                      />
                      <TextField
                        select
                        label="Is Overflow Lane?"
                        value={createLaneForm.is_overflow_lane ? "true" : "false"}
                        onChange={(e) => setCreateLaneForm((prev) => ({ ...prev, is_overflow_lane: e.target.value === "true" }))}
                        helperText="Use this only when opening an extra lane to reduce crowding in a busy commodity group."
                        fullWidth
                      >
                        <MenuItem value="false">No</MenuItem>
                        <MenuItem value="true">Yes</MenuItem>
                      </TextField>
                      <TextField
                        label="Max Queue Size"
                        type="number"
                        value={createLaneForm.max_queue_size}
                        onChange={(e) => setCreateLaneForm((prev) => ({ ...prev, max_queue_size: e.target.value }))}
                        helperText="Optional limit for how many lots should stay in this lane before opening another lane."
                        fullWidth
                      />
                      <TextField
                        label="Screen Order"
                        type="number"
                        value={createLaneForm.display_order}
                        onChange={(e) => setCreateLaneForm((prev) => ({ ...prev, display_order: e.target.value }))}
                        helperText="Optional order for showing lanes on the screen."
                        fullWidth
                      />
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: "background.paper" }}>
                <Typography variant="subtitle2" sx={{ mb: 1.5, fontWeight: 700 }}>
                  Section C — Closure Plan
                </Typography>
                <Stack spacing={1.5}>
                  <TextField
                    select
                    label="Start Mode"
                    value={createLaneForm.start_mode}
                    onChange={(e) => setCreateLaneForm((prev) => ({ ...prev, start_mode: normalizeStartMode(e.target.value) }))}
                    helperText="AUTO and MANUAL_OR_AUTO sessions can auto-start at scheduled start."
                    fullWidth
                  >
                    <MenuItem value="MANUAL">MANUAL</MenuItem>
                    <MenuItem value="AUTO">AUTO</MenuItem>
                    <MenuItem value="MANUAL_OR_AUTO">MANUAL_OR_AUTO</MenuItem>
                  </TextField>
                  <TextField select label="Closure Mode" value={createLaneForm.closure_mode} onChange={(e) => setCreateLaneForm((prev) => ({ ...prev, closure_mode: e.target.value }))} fullWidth>
                    <MenuItem value="MANUAL_ONLY">MANUAL_ONLY</MenuItem>
                    <MenuItem value="AUTO_AT_END_TIME">AUTO_AT_END_TIME</MenuItem>
                    <MenuItem value="MANUAL_OR_AUTO">MANUAL_OR_AUTO</MenuItem>
                  </TextField>
                  <TextField label="Scheduled Start" type="datetime-local" value={createLaneForm.scheduled_start_time} onChange={(e) => setCreateLaneForm((prev) => ({ ...prev, scheduled_start_time: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                  <TextField label="Scheduled End" type="datetime-local" value={createLaneForm.scheduled_end_time} onChange={(e) => setCreateLaneForm((prev) => ({ ...prev, scheduled_end_time: e.target.value }))} InputLabelProps={{ shrink: true }} fullWidth />
                </Stack>
              </Paper>
              {hasCreateLaneDateError && (
                <Alert severity="warning">
                  {missingScheduledEnd
                    ? "Scheduled End is required for selected closure mode."
                    : isScheduleRangeInvalid
                    ? "Scheduled End must be after Scheduled Start."
                    : "Please enter valid scheduled date/time values."}
                </Alert>
              )}
              <TextField label="Notes" value={createLaneForm.notes} onChange={(e) => setCreateLaneForm((prev) => ({ ...prev, notes: e.target.value }))} multiline minRows={3} fullWidth />
              {createLaneError && (
                <Alert severity={createLaneErrorSeverity}>
                  {createLaneError}
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            {isCreateLaneMandiMissing && (
              <Typography variant="body2" color="warning.main" sx={{ mr: "auto" }}>
                Please select a mandi to create an auction lane.
              </Typography>
            )}
            <Button onClick={() => { setCreateLaneError(null); setOpenCreateLane(false); }} disabled={createLaneLoading}>Close</Button>
            <Button variant="contained" onClick={handleCreateLane} disabled={isCreateLaneSubmitDisabled}>
              {createLaneLoading ? "Creating..." : "Create Lane"}
            </Button>
          </DialogActions>
        </Dialog>
      )}
      <ScreenHelpDrawer
        open={openHelp}
        onClose={() => setOpenHelp(false)}
        route={helpRoute}
        language={language}
        title={helpTitle}
      />
    </PageContainer>
  );
};
