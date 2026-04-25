import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import { PageContainer } from "../../components/PageContainer";
import { StepUpGuard } from "../../components/StepUpGuard";
import { usePermissions } from "../../authz/usePermissions";
import {
  getAuctionCapacityControl,
  updatePhysicalInfrastructureCapacity,
  updatePlatformAuctionCapacity,
  updateOrgAuctionCapacityAllocation,
} from "../../services/systemCapacityControlApi";
import {
  CAPACITY_MODEL_CONSTANTS,
  deriveSafeCapacityFromInfra,
  estimateRequiredInfraFromLoad,
} from "../../utils/capacityModel";

type SystemConfig = {
  deployment_profile_name: string;
  auction_capacity: Record<string, any>;
  infra_profile: Record<string, any>;
};

type OrgAllocation = {
  org_id: string;
  org_name: string;
  org_code?: string | null;
  tier_code?: string | null;
  current_live_lanes: number;
  current_open_lanes: number;
  current_queued_lots: number;
  allocated_max_live_lanes?: number | null;
  allocated_max_open_lanes?: number | null;
  allocated_max_queued_lots?: number | null;
  allocated_max_concurrent_bidders?: number | null;
  overflow_allowed?: boolean | null;
  special_event_allowed?: boolean | null;
  priority_weight?: number | null;
  reserved_capacity_enabled?: boolean | null;
  usage_percent?: number | null;
  allocation_invalid?: boolean;
  allocation_warning?: string | null;
};

type TierPreset = {
  tier_code: string;
  max_live_sessions: number;
  max_open_sessions: number;
  max_total_queued_lots: number;
  max_concurrent_bidders: number;
  allow_overflow_lanes: boolean;
  allow_special_event_lanes: boolean;
  reserved_capacity_enabled: boolean;
  price_hint?: number;
};

type DerivedSafeCapacity = {
  infra_ready?: boolean;
  usable_api_ram_gb?: number;
  usable_api_vcpu?: number;
  usable_db_ram_gb?: number;
  usable_db_vcpu?: number;
  usable_web_ram_gb?: number;
  usable_web_vcpu?: number;
  api_safe_max_live_lanes?: number;
  api_safe_max_open_lanes?: number;
  api_safe_max_concurrent_bidders?: number;
  api_safe_max_socket_connections?: number;
  db_safe_max_total_queued_lots?: number;
  db_safe_support_bidders?: number;
  final_safe_max_live_lanes?: number;
  final_safe_max_open_lanes?: number;
  final_safe_max_total_queued_lots?: number;
  final_safe_max_concurrent_bidders?: number;
  final_bottleneck_label?: string;
  derived_safe_max_live_lanes: number;
  derived_safe_max_open_lanes: number;
  derived_safe_max_total_queued_lots: number;
  derived_safe_max_concurrent_bidders: number;
  derived_safe_max_socket_mobile_connections: number;
  derived_safe_max_socket_connections?: number;
  derived_safe_max_bidders_per_lane: number;
  derived_safe_max_queue_per_lane?: number;
  derived_reserve_percent: number;
  derived_warning_messages?: string[];
};

type RemainingAllocatablePool = {
  total_allocated_live: number;
  total_allocated_open: number;
  total_allocated_queued: number;
  total_allocated_bidders: number;
  remaining_allocatable_live: number;
  remaining_allocatable_open: number;
  remaining_allocatable_queued: number;
  remaining_allocatable_bidders: number;
};

type CapacityHealth = {
  live_lanes_state: "GREEN" | "AMBER" | "RED";
  bidders_state: "GREEN" | "AMBER" | "RED";
  queue_state: "GREEN" | "AMBER" | "RED";
};

type StateFlags = {
  infra_ready: boolean;
  derived_ready: boolean;
  platform_configured: boolean;
  platform_valid: boolean;
  allocation_valid: boolean;
  org_allocation_allowed: boolean;
  usage_sections_allowed: boolean;
};

type CapacityPlanningMode = "MANUAL" | "AUTO_FROM_SAFE_CAPACITY";
type PlannerState = {
  selected_org_id: string;
  number_of_mandis: number;
  expected_farmers: number;
  expected_traders: number;
  peak_active_traders: number;
  expected_lots_per_day: number;
  expected_peak_queued_lots: number;
  expected_concurrent_auctions: number;
  growth_buffer_percent: number;
  usage_profile: "TESTING" | "SMALL" | "NORMAL" | "HEAVY" | "PEAK_SEASON";
};
type PlannerSuggestion = {
  raw_suggested_live_lanes: number;
  raw_suggested_open_lanes: number;
  raw_suggested_queued_lots: number;
  raw_suggested_concurrent_bidders: number;
  suggested_live_lanes: number;
  suggested_open_lanes: number;
  suggested_queued_lots: number;
  suggested_concurrent_bidders: number;
  suggested_tier_code: string | null;
  remaining_platform_capacity_before_apply: {
    live: number;
    open: number;
    queued: number;
    bidders: number;
  };
  remaining_platform_capacity_after_apply: {
    live: number;
    open: number;
    queued: number;
    bidders: number;
  };
  warnings: string[];
  was_clamped: boolean;
};
type PlannerValidationResult = {
  fieldErrors: Partial<Record<keyof PlannerState, string>>;
  topErrors: string[];
  isValid: boolean;
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

function num(v: any): string {
  if (v === null || v === undefined || v === "") return "";
  return String(v);
}

function toNumberOrNull(v: any): number | null {
  if (v === null || v === undefined || v === "") return null;
  const parsed = Number(v);
  return Number.isFinite(parsed) ? parsed : null;
}

function toNonNegativeNumber(value: any): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

const headerHelpIconSx = {
  ml: 0.5,
  fontSize: 16,
  verticalAlign: "middle",
  color: "text.secondary",
};

const CLOUD_PROVIDER_OPTIONS = ["OCI", "AWS", "AZURE", "GCP", "ON_PREM", "HYBRID", "OTHER"] as const;
const DEPLOYMENT_TYPE_OPTIONS = ["SHARED", "DEDICATED", "HYBRID"] as const;
const SAME_MACHINE_OPTIONS = ["SAME", "SEPARATE"] as const;
const WEBSOCKET_MODE_OPTIONS = ["SHARED", "SEPARATE"] as const;
const SECTION_F_TIER_OPTIONS = ["STARTER", "STANDARD", "PREMIUM", "ENTERPRISE", "DEDICATED", "CUSTOM"] as const;

function normalizeSelectValue(
  value: any,
  allowed: readonly string[],
  fallback = "",
  mapUnknownToOther = false,
) {
  const normalized = String(value || "").trim().toUpperCase();
  if (!normalized) return fallback;
  if (allowed.includes(normalized)) return normalized;
  if (mapUnknownToOther && allowed.includes("OTHER")) return "OTHER";
  return fallback;
}

const HeaderWithTooltip: React.FC<{ label: string; help: string }> = ({ label, help }) => (
  <Box component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
    <span>{label}</span>
    <Tooltip title={help} arrow>
      <HelpOutlineIcon sx={headerHelpIconSx} />
    </Tooltip>
  </Box>
);

const FormLabelWithTooltip: React.FC<{ label: string; help: string }> = ({ label, help }) => (
  <Box component="span" sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}>
    <span>{label}</span>
    <Tooltip title={help} arrow enterTouchDelay={0} leaveTouchDelay={3000}>
      <Typography
        component="span"
        sx={{ fontSize: "0.95rem", lineHeight: 1, color: "text.secondary", cursor: "help", userSelect: "none" }}
        aria-label={`${label} info`}
      >
        {"\u2139\uFE0F"}
      </Typography>
    </Tooltip>
  </Box>
);

const MetricCard: React.FC<{ label: string; value: React.ReactNode; help: string }> = ({
  label,
  value,
  help,
}) => (
  <Box sx={{ p: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 1.5, backgroundColor: "background.paper" }}>
    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
      {label}
    </Typography>
    <Typography variant="body1" sx={{ fontWeight: 700, mb: 0.5 }}>
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {help}
    </Typography>
  </Box>
);

function buildPresetMap(presets: TierPreset[]) {
  return presets.reduce<Record<string, TierPreset>>((acc, preset) => {
    acc[String(preset.tier_code || "").trim().toUpperCase()] = preset;
    return acc;
  }, {});
}

function applyPreset(row: OrgAllocation, preset?: TierPreset | null): OrgAllocation {
  if (!preset) return row;
  return {
    ...row,
    tier_code: preset.tier_code,
    allocated_max_live_lanes: preset.max_live_sessions,
    allocated_max_open_lanes: preset.max_open_sessions,
    allocated_max_queued_lots: preset.max_total_queued_lots,
    allocated_max_concurrent_bidders: preset.max_concurrent_bidders,
    overflow_allowed: preset.allow_overflow_lanes,
    special_event_allowed: preset.allow_special_event_lanes,
    reserved_capacity_enabled: preset.reserved_capacity_enabled,
  };
}

function healthColor(state?: string): "success" | "warning" | "error" | "default" {
  if (state === "GREEN") return "success";
  if (state === "AMBER") return "warning";
  if (state === "RED") return "error";
  return "default";
}

function isInfraFormReady(infraProfile: Record<string, any> = {}) {
  const required = [
    infraProfile?.app_server_ram_gb,
    infraProfile?.app_server_vcpu,
    infraProfile?.db_server_ram_gb,
    infraProfile?.db_server_vcpu,
    infraProfile?.web_server_ram_gb,
    infraProfile?.web_server_vcpu,
  ];
  const cloudProvider = normalizeSelectValue(
    infraProfile?.cloud_provider || infraProfile?.provider_name || "",
    CLOUD_PROVIDER_OPTIONS,
    "",
    true,
  );
  const deploymentType = normalizeSelectValue(
    infraProfile?.deployment_type || "",
    DEPLOYMENT_TYPE_OPTIONS,
    "",
  );
  const sameMachine = String(
    infraProfile?.same_machine_or_separate || infraProfile?.same_machine || "",
  ).trim();
  return required.every((value) => Number(value) > 0) && Boolean(sameMachine) && Boolean(cloudProvider) && Boolean(deploymentType);
}

function emptyStateFlags(): StateFlags {
  return {
    infra_ready: false,
    derived_ready: false,
    platform_configured: false,
    platform_valid: false,
    allocation_valid: false,
    org_allocation_allowed: false,
    usage_sections_allowed: false,
  };
}

const SystemCapacityControlPage: React.FC = () => {
  const username = useMemo(() => currentUsername(), []);
  const { can } = usePermissions();
  const canViewCapacityControl = can("capacity_control.view", "VIEW");
  const canEditCapacityControl = can("capacity_control.edit", "UPDATE");
  const [loading, setLoading] = useState(false);
  const [savingSystem, setSavingSystem] = useState(false);
  const [savingOrgId, setSavingOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [infraSaveError, setInfraSaveError] = useState<string | null>(null);
  const [infraSaveSuccess, setInfraSaveSuccess] = useState<string | null>(null);
  const [platformSaveError, setPlatformSaveError] = useState<string | null>(null);
  const [platformSaveSuccess, setPlatformSaveSuccess] = useState<string | null>(null);
  const [orgSaveError, setOrgSaveError] = useState<string | null>(null);
  const [orgSaveSuccess, setOrgSaveSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [orgAllocationAllowed, setOrgAllocationAllowed] = useState(false);
  const [stateFlags, setStateFlags] = useState<StateFlags>(emptyStateFlags());
  const [capacityHealth, setCapacityHealth] = useState<CapacityHealth | null>(null);
  const [upgradeAlerts, setUpgradeAlerts] = useState<string[]>([]);
  const [infraDirty, setInfraDirty] = useState(false);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    deployment_profile_name: "",
    auction_capacity: {},
    infra_profile: {},
  });
  const [platformUsage, setPlatformUsage] = useState<any>(null);
  const [derivedSafeCapacity, setDerivedSafeCapacity] = useState<DerivedSafeCapacity | null>(null);
  const [remainingPool, setRemainingPool] = useState<RemainingAllocatablePool | null>(null);
  const [tierPresets, setTierPresets] = useState<TierPreset[]>([]);
  const [availableTiers, setAvailableTiers] = useState<string[]>([]);
  const [orgRows, setOrgRows] = useState<OrgAllocation[]>([]);
  const [capacityPlanningMode, setCapacityPlanningMode] = useState<CapacityPlanningMode>("MANUAL");
  const [bufferPercent, setBufferPercent] = useState<number>(20);
  const [plannerOpen, setPlannerOpen] = useState(false);
  const [plannerValidationError, setPlannerValidationError] = useState<string | null>(null);
  const [plannerFieldErrors, setPlannerFieldErrors] = useState<Partial<Record<keyof PlannerState, string>>>({});
  const [plannerTopErrors, setPlannerTopErrors] = useState<string[]>([]);
  const [plannerApplyMessage, setPlannerApplyMessage] = useState<string | null>(null);
  const [plannerApplyError, setPlannerApplyError] = useState<string | null>(null);
  const [plannerResult, setPlannerResult] = useState<PlannerSuggestion | null>(null);
  const [planner, setPlanner] = useState<PlannerState>({
    selected_org_id: "",
    number_of_mandis: 1,
    expected_farmers: 0,
    expected_traders: 0,
    peak_active_traders: 0,
    expected_lots_per_day: 0,
    expected_peak_queued_lots: 0,
    expected_concurrent_auctions: 1,
    growth_buffer_percent: 20,
    usage_profile: "NORMAL",
  });

  const presetMap = useMemo(() => buildPresetMap(tierPresets), [tierPresets]);
  const infraFormReady = useMemo(() => isInfraFormReady(systemConfig.infra_profile || {}), [systemConfig.infra_profile]);
  const safeMaxLive = Number(derivedSafeCapacity?.final_safe_max_live_lanes ?? derivedSafeCapacity?.derived_safe_max_live_lanes ?? 0);
  const safeMaxOpen = Number(derivedSafeCapacity?.final_safe_max_open_lanes ?? derivedSafeCapacity?.derived_safe_max_open_lanes ?? 0);
  const safeMaxQueued = Number(derivedSafeCapacity?.final_safe_max_total_queued_lots ?? derivedSafeCapacity?.derived_safe_max_total_queued_lots ?? 0);
  const safeMaxBidders = Number(derivedSafeCapacity?.final_safe_max_concurrent_bidders ?? derivedSafeCapacity?.derived_safe_max_concurrent_bidders ?? 0);
  const platformMaxLive = Number(systemConfig.auction_capacity?.max_total_live_lanes || 0);
  const platformMaxOpen = Number(systemConfig.auction_capacity?.max_total_open_lanes || 0);
  const platformMaxQueued = Number(systemConfig.auction_capacity?.max_total_queued_lots || 0);
  const platformMaxBidders = Number(systemConfig.auction_capacity?.max_total_concurrent_bidders || 0);

  const orgAllocationSummary = useMemo(() => {
    const allocatedLive = orgRows.reduce((sum, row) => sum + Number(row.allocated_max_live_lanes || 0), 0);
    const allocatedOpen = orgRows.reduce((sum, row) => sum + Number(row.allocated_max_open_lanes || 0), 0);
    const allocatedQueued = orgRows.reduce((sum, row) => sum + Number(row.allocated_max_queued_lots || 0), 0);
    const allocatedBidders = orgRows.reduce((sum, row) => sum + Number(row.allocated_max_concurrent_bidders || 0), 0);
    const exceeded = {
      live: allocatedLive > platformMaxLive,
      open: allocatedOpen > platformMaxOpen,
      queued: allocatedQueued > platformMaxQueued,
      bidders: allocatedBidders > platformMaxBidders,
    };
    const messages: string[] = [];
    if (exceeded.live) messages.push(`Allocated live lanes exceed platform limit. Allocated: ${allocatedLive}, Allowed: ${platformMaxLive}.`);
    if (exceeded.open) messages.push(`Allocated open lanes exceed platform limit. Allocated: ${allocatedOpen}, Allowed: ${platformMaxOpen}.`);
    if (exceeded.queued) messages.push(`Allocated queued lots exceed platform limit. Allocated: ${allocatedQueued}, Allowed: ${platformMaxQueued}.`);
    if (exceeded.bidders) messages.push(`Allocated bidders exceed platform limit. Allocated: ${allocatedBidders}, Allowed: ${platformMaxBidders}.`);
    return {
      allocatedLive,
      allocatedOpen,
      allocatedQueued,
      allocatedBidders,
      exceeded,
      messages,
      hasExceeded: messages.length > 0,
    };
  }, [orgRows, platformMaxLive, platformMaxOpen, platformMaxQueued, platformMaxBidders]);

  const hasOrgNumericErrors = useMemo(() => (
    orgRows.some((row) => (
      Number(row.allocated_max_live_lanes || 0) < 0
      || Number(row.allocated_max_open_lanes || 0) < 0
      || Number(row.allocated_max_queued_lots || 0) < 0
      || Number(row.allocated_max_concurrent_bidders || 0) < 0
    ))
  ), [orgRows]);

  const plannerSelectedRow = useMemo(
    () => orgRows.find((row) => String(row.org_id) === String(planner.selected_org_id)) || null,
    [orgRows, planner.selected_org_id],
  );
  const plannerModelEstimate = useMemo(() => estimateRequiredInfraFromLoad({
    expected_farmers: Number(planner.expected_farmers || 0),
    expected_traders: Number(planner.expected_traders || 0),
    peak_active_traders: Number(planner.peak_active_traders || 0),
    expected_lots_per_day: Number(planner.expected_lots_per_day || 0),
    expected_peak_queued_lots: Number(planner.expected_peak_queued_lots || 0),
    expected_concurrent_auctions: Number(planner.expected_concurrent_auctions || 0),
    growth_buffer_percent: Number(planner.growth_buffer_percent || 0),
    number_of_mandis: Number(planner.number_of_mandis || 0),
    deployment_type: String(systemConfig?.infra_profile?.deployment_type || ""),
    same_machine_or_separate: String(
      systemConfig?.infra_profile?.same_machine_or_separate || systemConfig?.infra_profile?.same_machine || "",
    ),
    websocket_shared_or_separate: String(systemConfig?.infra_profile?.websocket_shared_or_separate || "SHARED"),
    usage_profile: planner.usage_profile,
  }), [planner, systemConfig?.infra_profile]);
  const findExactMatchingTierCode = (
    live: number,
    open: number,
    queued: number,
    bidders: number,
  ): string | null => {
    const exactMatch = SECTION_F_TIER_OPTIONS
      .filter((tierCode) => tierCode !== "CUSTOM")
      .map((tierCode) => presetMap[tierCode])
      .filter(Boolean)
      .find((preset) => (
        Number(preset?.max_live_sessions || 0) === Number(live || 0)
        && Number(preset?.max_open_sessions || 0) === Number(open || 0)
        && Number(preset?.max_total_queued_lots || 0) === Number(queued || 0)
        && Number(preset?.max_concurrent_bidders || 0) === Number(bidders || 0)
      ));
    return exactMatch?.tier_code || null;
  };

  const plannerSuggestion = useMemo<PlannerSuggestion>(() => {
    const bufferedLive = Number(plannerModelEstimate.demand_after_buffer_live_lanes || 0);
    const bufferedOpen = Number(plannerModelEstimate.demand_after_buffer_open_lanes || 0);
    const bufferedQueued = Number(plannerModelEstimate.demand_after_buffer_queued_lots || 0);
    const bufferedBidders = Number(plannerModelEstimate.demand_after_buffer_concurrent_bidders || 0);

    const selectedOrgCurrentLive = Number(plannerSelectedRow?.allocated_max_live_lanes || 0);
    const selectedOrgCurrentOpen = Number(plannerSelectedRow?.allocated_max_open_lanes || 0);
    const selectedOrgCurrentQueued = Number(plannerSelectedRow?.allocated_max_queued_lots || 0);
    const selectedOrgCurrentBidders = Number(plannerSelectedRow?.allocated_max_concurrent_bidders || 0);

    const sectionERemainingLive = Number(remainingPool?.remaining_allocatable_live ?? Math.max(0, platformMaxLive - orgAllocationSummary.allocatedLive));
    const sectionERemainingOpen = Number(remainingPool?.remaining_allocatable_open ?? Math.max(0, platformMaxOpen - orgAllocationSummary.allocatedOpen));
    const sectionERemainingQueued = Number(remainingPool?.remaining_allocatable_queued ?? Math.max(0, platformMaxQueued - orgAllocationSummary.allocatedQueued));
    const sectionERemainingBidders = Number(remainingPool?.remaining_allocatable_bidders ?? Math.max(0, platformMaxBidders - orgAllocationSummary.allocatedBidders));

    const remainingLiveBeforeApply = Math.max(0, sectionERemainingLive + selectedOrgCurrentLive);
    const remainingOpenBeforeApply = Math.max(0, sectionERemainingOpen + selectedOrgCurrentOpen);
    const remainingQueuedBeforeApply = Math.max(0, sectionERemainingQueued + selectedOrgCurrentQueued);
    const remainingBiddersBeforeApply = Math.max(0, sectionERemainingBidders + selectedOrgCurrentBidders);

    const appliedLive = Math.max(0, bufferedLive);
    const appliedOpen = Math.max(0, bufferedOpen);
    const appliedQueued = Math.max(0, bufferedQueued);
    const appliedBidders = Math.max(0, bufferedBidders);

    const warnings: string[] = [];
    if (appliedLive > remainingLiveBeforeApply) warnings.push(`Live auctions exceed available capacity by ${appliedLive - remainingLiveBeforeApply}.`);
    if (appliedOpen > remainingOpenBeforeApply) warnings.push(`Open auctions exceed available capacity by ${appliedOpen - remainingOpenBeforeApply}.`);
    if (appliedQueued > remainingQueuedBeforeApply) warnings.push(`Queued lots exceed available capacity by ${appliedQueued - remainingQueuedBeforeApply}.`);
    if (appliedBidders > remainingBiddersBeforeApply) warnings.push(`Concurrent bidders exceed available capacity by ${appliedBidders - remainingBiddersBeforeApply}.`);

    const hasSuggestedValues = appliedLive > 0 || appliedOpen > 0 || appliedQueued > 0 || appliedBidders > 0;
    const exactTierCode = findExactMatchingTierCode(appliedLive, appliedOpen, appliedQueued, appliedBidders);
    const suggestedTierCode = hasSuggestedValues ? (exactTierCode || "CUSTOM") : null;
    const remainingAfterApply = {
      live: remainingLiveBeforeApply - appliedLive,
      open: remainingOpenBeforeApply - appliedOpen,
      queued: remainingQueuedBeforeApply - appliedQueued,
      bidders: remainingBiddersBeforeApply - appliedBidders,
    };

    return {
      raw_suggested_live_lanes: bufferedLive,
      raw_suggested_open_lanes: bufferedOpen,
      raw_suggested_queued_lots: bufferedQueued,
      raw_suggested_concurrent_bidders: bufferedBidders,
      suggested_live_lanes: appliedLive,
      suggested_open_lanes: appliedOpen,
      suggested_queued_lots: appliedQueued,
      suggested_concurrent_bidders: appliedBidders,
      suggested_tier_code: suggestedTierCode,
      remaining_platform_capacity_before_apply: {
        live: remainingLiveBeforeApply,
        open: remainingOpenBeforeApply,
        queued: remainingQueuedBeforeApply,
        bidders: remainingBiddersBeforeApply,
      },
      remaining_platform_capacity_after_apply: remainingAfterApply,
      warnings,
      was_clamped: false,
    };
  }, [
    plannerModelEstimate,
    plannerSelectedRow,
    platformMaxLive,
    platformMaxOpen,
    platformMaxQueued,
    platformMaxBidders,
    orgAllocationSummary,
    remainingPool,
    presetMap,
  ]);

  const sectionCFieldErrors = useMemo<Record<string, string>>(() => {
    const auction = systemConfig.auction_capacity || {};
    const errors: Record<string, string> = {};

    const maxTotalLive = toNumberOrNull(auction.max_total_live_lanes);
    const maxTotalOpen = toNumberOrNull(auction.max_total_open_lanes);
    const maxTotalQueued = toNumberOrNull(auction.max_total_queued_lots);
    const maxTotalBidders = toNumberOrNull(auction.max_total_concurrent_bidders);
    const defaultOrgLive = toNumberOrNull(auction.default_org_max_live_lanes);
    const defaultOrgOpen = toNumberOrNull(auction.default_org_max_open_lanes);
    const defaultOrgQueued = toNumberOrNull(auction.default_org_max_total_queued_lots);
    const defaultOrgBidders = toNumberOrNull(auction.default_org_max_concurrent_bidders);
    const defaultMandiLive = toNumberOrNull(auction.default_mandi_max_live_lanes);
    const defaultMandiOpen = toNumberOrNull(auction.default_mandi_max_open_lanes);
    const defaultMandiTotalQueued = toNumberOrNull(auction.default_mandi_max_total_queued_lots);
    const defaultMandiQueuePerLane = toNumberOrNull(auction.default_mandi_max_queue_per_lane);

    if (maxTotalLive !== null && maxTotalLive > safeMaxLive) {
      errors.max_total_live_lanes = `Live lanes cannot exceed safe maximum ${safeMaxLive}.`;
    }
    if (maxTotalOpen !== null && maxTotalOpen > safeMaxOpen) {
      errors.max_total_open_lanes = `Open lanes cannot exceed safe maximum ${safeMaxOpen}.`;
    }
    if (maxTotalQueued !== null && maxTotalQueued > safeMaxQueued) {
      errors.max_total_queued_lots = `Queued lots cannot exceed safe maximum ${safeMaxQueued}.`;
    }
    if (maxTotalBidders !== null && maxTotalBidders > safeMaxBidders) {
      errors.max_total_concurrent_bidders = `Concurrent bidders cannot exceed safe maximum ${safeMaxBidders}.`;
    }

    if (defaultOrgLive !== null && maxTotalLive !== null && defaultOrgLive > maxTotalLive) {
      errors.default_org_max_live_lanes = "Default org live lanes must be less than or equal to Max Total Live Lanes.";
    }
    if (defaultOrgOpen !== null && maxTotalOpen !== null && defaultOrgOpen > maxTotalOpen) {
      errors.default_org_max_open_lanes = "Default org open lanes must be less than or equal to Max Total Open Lanes.";
    }
    if (defaultOrgQueued !== null && maxTotalQueued !== null && defaultOrgQueued > maxTotalQueued) {
      errors.default_org_max_total_queued_lots = "Default org queued lots must be less than or equal to Max Total Queued Lots.";
    }
    if (defaultOrgBidders !== null && maxTotalBidders !== null && defaultOrgBidders > maxTotalBidders) {
      errors.default_org_max_concurrent_bidders = "Default org concurrent bidders must be less than or equal to Max Total Concurrent Bidders.";
    }

    if (defaultMandiLive !== null && defaultOrgLive !== null && defaultMandiLive > defaultOrgLive) {
      errors.default_mandi_max_live_lanes = "Default mandi live lanes must be less than or equal to Default Org Max Live Lanes.";
    }
    if (defaultMandiOpen !== null && defaultOrgOpen !== null && defaultMandiOpen > defaultOrgOpen) {
      errors.default_mandi_max_open_lanes = "Default mandi open lanes must be less than or equal to Default Org Max Open Lanes.";
    }
    if (defaultMandiTotalQueued !== null && defaultOrgQueued !== null && defaultMandiTotalQueued > defaultOrgQueued) {
      errors.default_mandi_max_total_queued_lots = "Default mandi total queued lots must be less than or equal to Default Org Max Total Queued Lots.";
    }
    if (defaultMandiQueuePerLane !== null && defaultMandiTotalQueued !== null && defaultMandiQueuePerLane > defaultMandiTotalQueued) {
      errors.default_mandi_max_queue_per_lane = "Default mandi queue per lane must be less than or equal to Default Mandi Max Total Queued Lots.";
    }

    return errors;
  }, [
    systemConfig.auction_capacity,
    safeMaxLive,
    safeMaxOpen,
    safeMaxQueued,
    safeMaxBidders,
  ]);
  const hasSectionCErrors = Object.keys(sectionCFieldErrors).length > 0;

  const loadData = async () => {
    if (!username) return;
    setLoading(true);
    setError(null);
    try {
      const resp: any = await getAuctionCapacityControl({ username });
      const code = String(resp?.response?.responsecode || "");
      if (code !== "0") {
        setError(resp?.response?.description || "Failed to load system capacity control.");
        return;
      }
      const data = resp?.data || {};
      setSystemConfig(data.system_capacity_config || { deployment_profile_name: "", auction_capacity: {}, infra_profile: {} });
      const backendFlags: StateFlags = {
        ...emptyStateFlags(),
        ...(data.state_flags || {}),
      };
      setStateFlags(backendFlags);
      setOrgAllocationAllowed(Boolean(data.org_allocation_allowed ?? backendFlags.org_allocation_allowed));
      setPlatformUsage(data.platform_usage_summary || null);
      setDerivedSafeCapacity(data.derived_safe_capacity || null);
      setRemainingPool(data.remaining_allocatable_pool || null);
      setTierPresets(Array.isArray(data.tier_presets) ? data.tier_presets : []);
      setAvailableTiers(Array.isArray(data.available_tiers) ? data.available_tiers : []);
      setWarnings(Array.isArray(data.warnings) ? data.warnings.filter(Boolean) : []);
      setCapacityHealth(data.capacity_health || null);
      setUpgradeAlerts(Array.isArray(data.upgrade_alerts) ? data.upgrade_alerts.filter(Boolean) : []);
      setOrgRows(Array.isArray(data.org_allocations) ? data.org_allocations : []);
      setInfraDirty(false);
    } catch (err: any) {
      setError(err?.message || "Failed to load system capacity control.");
      setStateFlags(emptyStateFlags());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!planner.selected_org_id && orgRows.length > 0) {
      setPlanner((prev) => ({ ...prev, selected_org_id: String(orgRows[0].org_id || "") }));
    }
  }, [orgRows, planner.selected_org_id]);

  const setAuctionField = (key: string, value: any) => {
    setSystemConfig((prev) => ({
      ...prev,
      auction_capacity: {
        ...(prev.auction_capacity || {}),
        [key]: value,
      },
    }));
  };

  const clampedBufferPercent = Math.min(90, Math.max(0, Number(bufferPercent || 0)));
  const isBufferPercentValid = Number.isFinite(Number(bufferPercent)) && Number(bufferPercent) >= 0 && Number(bufferPercent) <= 90;
  const hasDerivedSafeForGeneration = stateFlags.derived_ready
    && [safeMaxLive, safeMaxOpen, safeMaxQueued, safeMaxBidders].every((value) => Number.isFinite(value));

  const generateFromSafe = (safeValue: number) => {
    const generated = Math.floor(Number(safeValue || 0) * ((100 - clampedBufferPercent) / 100));
    return Math.max(0, Math.min(Number(safeValue || 0), generated));
  };

  const buildGeneratedAuctionCapacity = () => {
    const generatedLive = generateFromSafe(safeMaxLive);
    const generatedOpen = generateFromSafe(safeMaxOpen);
    const generatedQueued = generateFromSafe(safeMaxQueued);
    const generatedBidders = generateFromSafe(safeMaxBidders);

    const suggestedOrgLive = Math.max(0, Math.floor(generatedLive * 0.4));
    const suggestedOrgOpen = Math.max(0, Math.floor(generatedOpen * 0.4));
    const suggestedOrgQueued = Math.max(0, Math.floor(generatedQueued * 0.35));
    const suggestedOrgBidders = Math.max(0, Math.floor(generatedBidders * 0.35));
    const suggestedMandiLive = Math.max(0, Math.floor(suggestedOrgLive * 0.5));
    const suggestedMandiOpen = Math.max(0, Math.floor(suggestedOrgOpen * 0.5));
    const suggestedMandiQueued = Math.max(0, Math.floor(suggestedOrgQueued * 0.5));
    const suggestedMandiQueuePerLane = suggestedMandiQueued > 0
      ? Math.max(0, Math.floor(suggestedMandiQueued / Math.max(1, suggestedMandiLive || 1)))
      : 0;

    return {
      max_total_live_lanes: generatedLive,
      max_total_open_lanes: generatedOpen,
      max_total_queued_lots: generatedQueued,
      max_total_concurrent_bidders: generatedBidders,
      default_org_max_live_lanes: suggestedOrgLive,
      default_org_max_open_lanes: suggestedOrgOpen,
      default_org_max_total_queued_lots: suggestedOrgQueued,
      default_org_max_concurrent_bidders: suggestedOrgBidders,
      default_mandi_max_live_lanes: suggestedMandiLive,
      default_mandi_max_open_lanes: suggestedMandiOpen,
      default_mandi_max_total_queued_lots: suggestedMandiQueued,
      default_mandi_max_queue_per_lane: Math.min(suggestedMandiQueuePerLane, suggestedMandiQueued),
    };
  };

  const generatedPreview = useMemo(() => buildGeneratedAuctionCapacity(), [safeMaxLive, safeMaxOpen, safeMaxQueued, safeMaxBidders, clampedBufferPercent]);

  const handleGeneratePlatformLimits = () => {
    if (!hasDerivedSafeForGeneration || !isBufferPercentValid) return;
    const generated = buildGeneratedAuctionCapacity();
    setSystemConfig((prev) => ({
      ...prev,
      auction_capacity: {
        ...(prev.auction_capacity || {}),
        ...generated,
      },
    }));
    setPlatformSaveError(null);
    setPlatformSaveSuccess("Platform limits generated from derived safe capacity. Review and save Section C.");
  };

  useEffect(() => {
    const sectionCDisabled = !canEditCapacityControl || !stateFlags.infra_ready || infraDirty;
    if (capacityPlanningMode !== "AUTO_FROM_SAFE_CAPACITY") return;
    if (!hasDerivedSafeForGeneration || !isBufferPercentValid || sectionCDisabled) return;
    const generated = buildGeneratedAuctionCapacity();
    setSystemConfig((prev) => {
      const current = prev.auction_capacity || {};
      const hasAnyDifference = Object.entries(generated).some(([key, value]) => Number(current[key]) !== Number(value));
      if (!hasAnyDifference) return prev;
      return {
        ...prev,
        auction_capacity: {
          ...current,
          ...generated,
        },
      };
    });
  }, [
    capacityPlanningMode,
    clampedBufferPercent,
    safeMaxLive,
    safeMaxOpen,
    safeMaxQueued,
    safeMaxBidders,
    hasDerivedSafeForGeneration,
    isBufferPercentValid,
    canEditCapacityControl,
    stateFlags.infra_ready,
    infraDirty,
  ]);

  const setInfraField = (key: string, value: any) => {
    setSystemConfig((prev) => ({
      ...prev,
      infra_profile: {
        ...(prev.infra_profile || {}),
        [key]: value,
      },
    }));
    setInfraDirty(true);
  };

  const setPlannerField = <K extends keyof PlannerState>(key: K, value: PlannerState[K]) => {
    setPlanner((prev) => ({ ...prev, [key]: value }));
    setPlannerValidationError(null);
    setPlannerApplyMessage(null);
    setPlannerApplyError(null);
    setPlannerResult(null);
  };

  const plannerPhysicalResources = useMemo(() => {
    if (!plannerResult) return null;
    const demandLive = Number(plannerModelEstimate.demand_after_buffer_live_lanes || 0);
    const demandOpen = Number(plannerModelEstimate.demand_after_buffer_open_lanes || 0);
    const demandQueued = Number(plannerModelEstimate.demand_after_buffer_queued_lots || 0);
    const demandBidders = Number(plannerModelEstimate.demand_after_buffer_concurrent_bidders || 0);
    const rawReq = plannerModelEstimate.raw_requirements || {};

    const appLiveRamNeed = demandLive * CAPACITY_MODEL_CONSTANTS.ram_per_live_lane_gb;
    const appOpenRamNeed = demandOpen * CAPACITY_MODEL_CONSTANTS.ram_per_open_lane_gb;
    const appBidderRamNeed = (demandBidders / 100) * CAPACITY_MODEL_CONSTANTS.ram_per_100_bidders_gb;
    const appChosenRamNeed = Math.max(appLiveRamNeed, appOpenRamNeed, appBidderRamNeed);

    const appLiveCpuNeed = demandLive * CAPACITY_MODEL_CONSTANTS.cpu_per_live_lane;
    const appOpenCpuNeed = demandOpen * (CAPACITY_MODEL_CONSTANTS.cpu_per_live_lane / CAPACITY_MODEL_CONSTANTS.open_lane_cpu_divisor);
    const appBidderCpuNeed = (demandBidders / 100) * CAPACITY_MODEL_CONSTANTS.cpu_per_100_bidders;
    const appChosenCpuNeed = Math.max(appLiveCpuNeed, appOpenCpuNeed, appBidderCpuNeed);

    const dbQueueRamNeed = (demandQueued / 100) * CAPACITY_MODEL_CONSTANTS.ram_per_100_queued_lots_gb;
    const dbBidderRamNeed = (demandBidders / 100) * CAPACITY_MODEL_CONSTANTS.ram_per_100_bidders_gb;
    const dbChosenRamNeed = Math.max(dbQueueRamNeed, dbBidderRamNeed);

    const dbQueueCpuNeed = (demandQueued / 100) * CAPACITY_MODEL_CONSTANTS.cpu_per_100_queued_lots;
    const dbBidderCpuNeed = (demandBidders / 100) * CAPACITY_MODEL_CONSTANTS.cpu_per_100_bidders;
    const dbChosenCpuNeed = Math.max(dbQueueCpuNeed, dbBidderCpuNeed);

    const webRawRam = Number(rawReq.web_server_ram_gb || 0);
    const webRawCpu = Number(rawReq.web_server_vcpu || 0);
    const webBaseRam = 0.5;
    const webBaseCpu = 1;
    const webUserRam = Math.max(0, webRawRam - webBaseRam);
    const webUserCpu = Math.max(0, webRawCpu - webBaseCpu);

    return {
      required_app_server_ram_gb: Number(plannerModelEstimate.required_app_server_ram_gb || 0),
      required_app_server_vcpu: Number(plannerModelEstimate.required_app_server_vcpu || 0),
      required_db_server_ram_gb: Number(plannerModelEstimate.required_db_server_ram_gb || 0),
      required_db_server_vcpu: Number(plannerModelEstimate.required_db_server_vcpu || 0),
      required_web_server_ram_gb: Number(plannerModelEstimate.required_web_server_ram_gb || 0),
      required_web_server_vcpu: Number(plannerModelEstimate.required_web_server_vcpu || 0),
      recommended_os_reserve_percent: Number(plannerModelEstimate.recommended_os_reserve_percent || 0),
      recommended_system_reserve_percent: Number(plannerModelEstimate.recommended_system_reserve_percent || 0),
      recommended_web_admin_reserve_percent: Number(plannerModelEstimate.recommended_web_admin_reserve_percent || 0),
      breakdown: {
        app_ram: { base: 0, live: appLiveRamNeed, bidder: appBidderRamNeed, open: appOpenRamNeed, selected: appChosenRamNeed, estimated: Number(rawReq.app_server_ram_gb || 0), recommended: Number(plannerModelEstimate.required_app_server_ram_gb || 0) },
        app_cpu: { base: 0, live: appLiveCpuNeed, bidder: appBidderCpuNeed, open: appOpenCpuNeed, selected: appChosenCpuNeed, estimated: Number(rawReq.app_server_vcpu || 0), recommended: Number(plannerModelEstimate.required_app_server_vcpu || 0) },
        db_ram: { base: 0, queue: dbQueueRamNeed, bidder: dbBidderRamNeed, selected: dbChosenRamNeed, estimated: Number(rawReq.db_server_ram_gb || 0), recommended: Number(plannerModelEstimate.required_db_server_ram_gb || 0) },
        db_cpu: { base: 0, queue: dbQueueCpuNeed, bidder: dbBidderCpuNeed, selected: dbChosenCpuNeed, estimated: Number(rawReq.db_server_vcpu || 0), recommended: Number(plannerModelEstimate.required_db_server_vcpu || 0) },
        web_ram: { base: webBaseRam, users: webUserRam, selected: webRawRam, estimated: webRawRam, recommended: Number(plannerModelEstimate.required_web_server_ram_gb || 0) },
        web_cpu: { base: webBaseCpu, users: webUserCpu, selected: webRawCpu, estimated: webRawCpu, recommended: Number(plannerModelEstimate.required_web_server_vcpu || 0) },
      },
    };
  }, [plannerResult, plannerModelEstimate]);

  const plannerCapacityFromRecommendedInfra = useMemo(() => {
    if (!plannerPhysicalResources) return null;
    return deriveSafeCapacityFromInfra({
      app_server_ram_gb: plannerPhysicalResources.required_app_server_ram_gb,
      app_server_vcpu: plannerPhysicalResources.required_app_server_vcpu,
      db_server_ram_gb: plannerPhysicalResources.required_db_server_ram_gb,
      db_server_vcpu: plannerPhysicalResources.required_db_server_vcpu,
      web_server_ram_gb: plannerPhysicalResources.required_web_server_ram_gb,
      web_server_vcpu: plannerPhysicalResources.required_web_server_vcpu,
      os_reserve_percent: plannerPhysicalResources.recommended_os_reserve_percent,
      system_reserve_percent: plannerPhysicalResources.recommended_system_reserve_percent,
      web_admin_reserve_percent: plannerPhysicalResources.recommended_web_admin_reserve_percent,
      websocket_shared_or_separate: String(systemConfig?.infra_profile?.websocket_shared_or_separate || "SHARED"),
    });
  }, [plannerPhysicalResources, systemConfig?.infra_profile?.websocket_shared_or_separate]);

  const plannerModelMismatch = useMemo(() => {
    if (!plannerResult || !plannerCapacityFromRecommendedInfra) return false;
    return (
      Number(plannerCapacityFromRecommendedInfra.final_safe_live_lanes || 0) < Number(plannerModelEstimate.demand_after_buffer_live_lanes || 0)
      || Number(plannerCapacityFromRecommendedInfra.final_safe_open_lanes || 0) < Number(plannerModelEstimate.demand_after_buffer_open_lanes || 0)
      || Number(plannerCapacityFromRecommendedInfra.final_safe_queued_lots || 0) < Number(plannerModelEstimate.demand_after_buffer_queued_lots || 0)
      || Number(plannerCapacityFromRecommendedInfra.final_safe_concurrent_bidders || 0) < Number(plannerModelEstimate.demand_after_buffer_concurrent_bidders || 0)
    );
  }, [plannerResult, plannerCapacityFromRecommendedInfra, plannerModelEstimate]);

  const plannerPhysicalFitRows = useMemo(() => {
    if (!plannerPhysicalResources) return [];
    const currentInfra = systemConfig?.infra_profile || {};
    return [
      {
        label: "App Server RAM",
        required: Number(plannerPhysicalResources.required_app_server_ram_gb || 0),
        current: Number(currentInfra.app_server_ram_gb || 0),
        unit: "GB",
      },
      {
        label: "App Server vCPU",
        required: Number(plannerPhysicalResources.required_app_server_vcpu || 0),
        current: Number(currentInfra.app_server_vcpu || 0),
        unit: "vCPU",
      },
      {
        label: "DB Server RAM",
        required: Number(plannerPhysicalResources.required_db_server_ram_gb || 0),
        current: Number(currentInfra.db_server_ram_gb || 0),
        unit: "GB",
      },
      {
        label: "DB Server vCPU",
        required: Number(plannerPhysicalResources.required_db_server_vcpu || 0),
        current: Number(currentInfra.db_server_vcpu || 0),
        unit: "vCPU",
      },
      {
        label: "Web Server RAM",
        required: Number(plannerPhysicalResources.required_web_server_ram_gb || 0),
        current: Number(currentInfra.web_server_ram_gb || 0),
        unit: "GB",
      },
      {
        label: "Web Server vCPU",
        required: Number(plannerPhysicalResources.required_web_server_vcpu || 0),
        current: Number(currentInfra.web_server_vcpu || 0),
        unit: "vCPU",
      },
    ].map((row) => ({
      ...row,
      ok: row.current >= row.required,
    }));
  }, [plannerPhysicalResources, systemConfig?.infra_profile]);

  const plannerSafeCapacityRows = useMemo(() => {
    if (!plannerResult) return [];
    return [
      {
        label: "Live auctions",
        required: Number(plannerResult.raw_suggested_live_lanes || 0),
        safe: Number(derivedSafeCapacity?.final_safe_max_live_lanes ?? derivedSafeCapacity?.derived_safe_max_live_lanes ?? 0),
      },
      {
        label: "Open auctions",
        required: Number(plannerResult.raw_suggested_open_lanes || 0),
        safe: Number(derivedSafeCapacity?.final_safe_max_open_lanes ?? derivedSafeCapacity?.derived_safe_max_open_lanes ?? 0),
      },
      {
        label: "Queued lots",
        required: Number(plannerResult.raw_suggested_queued_lots || 0),
        safe: Number(derivedSafeCapacity?.final_safe_max_total_queued_lots ?? derivedSafeCapacity?.derived_safe_max_total_queued_lots ?? 0),
      },
      {
        label: "Concurrent bidders",
        required: Number(plannerResult.raw_suggested_concurrent_bidders || 0),
        safe: Number(derivedSafeCapacity?.final_safe_max_concurrent_bidders ?? derivedSafeCapacity?.derived_safe_max_concurrent_bidders ?? 0),
      },
    ].map((row) => ({
      ...row,
      ok: row.safe >= row.required,
    }));
  }, [plannerResult, derivedSafeCapacity]);

  const plannerPlatformFitRows = useMemo(() => {
    if (!plannerResult) return [];
    return [
      {
        label: "Live auctions",
        availableBeforeApply: Number(plannerResult.remaining_platform_capacity_before_apply.live || 0),
        plannerAllocationToApply: Number(plannerResult.suggested_live_lanes || 0),
        rawPlannerAllocation: Number(plannerResult.raw_suggested_live_lanes || 0),
        remainingAfterApply: Number(plannerResult.remaining_platform_capacity_after_apply.live || 0),
      },
      {
        label: "Open auctions",
        availableBeforeApply: Number(plannerResult.remaining_platform_capacity_before_apply.open || 0),
        plannerAllocationToApply: Number(plannerResult.suggested_open_lanes || 0),
        rawPlannerAllocation: Number(plannerResult.raw_suggested_open_lanes || 0),
        remainingAfterApply: Number(plannerResult.remaining_platform_capacity_after_apply.open || 0),
      },
      {
        label: "Queued lots",
        availableBeforeApply: Number(plannerResult.remaining_platform_capacity_before_apply.queued || 0),
        plannerAllocationToApply: Number(plannerResult.suggested_queued_lots || 0),
        rawPlannerAllocation: Number(plannerResult.raw_suggested_queued_lots || 0),
        remainingAfterApply: Number(plannerResult.remaining_platform_capacity_after_apply.queued || 0),
      },
      {
        label: "Concurrent bidders",
        availableBeforeApply: Number(plannerResult.remaining_platform_capacity_before_apply.bidders || 0),
        plannerAllocationToApply: Number(plannerResult.suggested_concurrent_bidders || 0),
        rawPlannerAllocation: Number(plannerResult.raw_suggested_concurrent_bidders || 0),
        remainingAfterApply: Number(plannerResult.remaining_platform_capacity_after_apply.bidders || 0),
      },
    ].map((row) => ({
      ...row,
      status: row.remainingAfterApply < 0
        ? "ERROR"
        : row.remainingAfterApply === 0 && row.plannerAllocationToApply > 0
          ? "FULL"
          : row.rawPlannerAllocation > row.plannerAllocationToApply
            ? "REDUCED"
            : "OK",
    }));
  }, [plannerResult, remainingPool, platformMaxLive, platformMaxOpen, platformMaxQueued, platformMaxBidders, orgAllocationSummary, plannerSelectedRow]);

  const plannerHasErrorMetric = plannerPlatformFitRows.some((row) => row.status === "ERROR");
  const plannerHasFullMetric = plannerPlatformFitRows.some((row) => row.status === "FULL");

  const plannerPhysicalFitOk = plannerPhysicalFitRows.every((row) => row.ok);
  const plannerSafeCapacityFitOk = plannerSafeCapacityRows.every((row) => row.ok);
  const plannerPlatformTotalFitOk = Boolean(plannerResult) && (
    Number(platformMaxLive || 0) >= Number(plannerResult?.raw_suggested_live_lanes || 0)
    && Number(platformMaxOpen || 0) >= Number(plannerResult?.raw_suggested_open_lanes || 0)
    && Number(platformMaxQueued || 0) >= Number(plannerResult?.raw_suggested_queued_lots || 0)
    && Number(platformMaxBidders || 0) >= Number(plannerResult?.raw_suggested_concurrent_bidders || 0)
  );
  const plannerFinalAllocationWithinAvailable = Boolean(plannerResult) && (
    Number(plannerResult?.suggested_live_lanes || 0) <= Number(plannerResult?.remaining_platform_capacity_before_apply.live || 0)
    && Number(plannerResult?.suggested_open_lanes || 0) <= Number(plannerResult?.remaining_platform_capacity_before_apply.open || 0)
    && Number(plannerResult?.suggested_queued_lots || 0) <= Number(plannerResult?.remaining_platform_capacity_before_apply.queued || 0)
    && Number(plannerResult?.suggested_concurrent_bidders || 0) <= Number(plannerResult?.remaining_platform_capacity_before_apply.bidders || 0)
  );
  const plannerNoRemainingLiveCapacity = Boolean(plannerResult) && (
    Number(plannerResult?.remaining_platform_capacity_before_apply.live || 0) <= 0
    && Number(plannerResult?.suggested_live_lanes || 0) > 0
  );
  const plannerCanReplaceSelectedOrgAllocation = Boolean(plannerResult) && (
    Number(remainingPool?.remaining_allocatable_live ?? Math.max(0, platformMaxLive - orgAllocationSummary.allocatedLive)) <= 0
    && Number(plannerSelectedRow?.allocated_max_live_lanes || 0) > 0
    && Number(plannerResult?.remaining_platform_capacity_before_apply.live || 0) > 0
    && Number(plannerResult?.suggested_live_lanes || 0) <= Number(plannerResult?.remaining_platform_capacity_before_apply.live || 0)
  );

  const plannerResultStatus = useMemo(() => {
    if (!plannerResult) return null;
    if (plannerNoRemainingLiveCapacity) {
      return {
        severity: "error" as const,
        text: "Cannot apply because no remaining platform capacity",
      };
    }
    if (plannerCanReplaceSelectedOrgAllocation) {
      return {
        severity: "info" as const,
        text: "Can replace selected org allocation",
      };
    }
    if (!plannerPhysicalFitOk || !plannerSafeCapacityFitOk) {
      return {
        severity: "error" as const,
        text: "Needs more physical infrastructure",
      };
    }
    if (!plannerFinalAllocationWithinAvailable || !plannerPlatformTotalFitOk) {
      return {
        severity: "warning" as const,
        text: "Needs more platform capacity",
      };
    }
    return {
      severity: "success" as const,
      text: "Fits current setup",
    };
  }, [
    plannerResult,
    plannerNoRemainingLiveCapacity,
    plannerCanReplaceSelectedOrgAllocation,
    plannerPhysicalFitOk,
    plannerSafeCapacityFitOk,
    plannerFinalAllocationWithinAvailable,
    plannerPlatformTotalFitOk,
  ]);

  const applyPlannerToSelectedOrg = () => {
    if (!plannerResult) return;
    if (!planner.selected_org_id) return;
    setPlannerApplyMessage(null);
    setPlannerApplyError(null);
    if (plannerHasErrorMetric || plannerNoRemainingLiveCapacity) {
      setPlannerApplyError("No remaining live auction capacity is available. Increase Section C capacity or reduce/remove another organisation allocation.");
      return;
    }
    if (!plannerFinalAllocationWithinAvailable) {
      setPlannerApplyError("Planner allocation exceeds available capacity for the selected organisation.");
      return;
    }
    if (plannerHasFullMetric) {
      const confirmedFull = window.confirm("Applying this will exhaust platform capacity. Continue?");
      if (!confirmedFull) return;
    }
    if (!plannerPhysicalFitOk) {
      const confirmed = window.confirm("Physical Resource Fit Check is not OK. Apply allocation anyway?");
      if (!confirmed) return;
    }
    const finalTierCode = findExactMatchingTierCode(
      plannerResult.suggested_live_lanes,
      plannerResult.suggested_open_lanes,
      plannerResult.suggested_queued_lots,
      plannerResult.suggested_concurrent_bidders,
    ) || "CUSTOM";
    setOrgRows((prev) => prev.map((row) => {
      if (String(row.org_id) !== String(planner.selected_org_id)) return row;
      return {
        ...row,
        tier_code: finalTierCode,
        allocated_max_live_lanes: plannerResult.suggested_live_lanes,
        allocated_max_open_lanes: plannerResult.suggested_open_lanes,
        allocated_max_queued_lots: plannerResult.suggested_queued_lots,
        allocated_max_concurrent_bidders: plannerResult.suggested_concurrent_bidders,
      };
    }));
    setOrgSaveError(null);
    setOrgSaveSuccess("Values applied to the form. Please save the relevant section to persist.");
    setPlannerOpen(false);
  };

  const applyPlannerResourcesToSectionA = () => {
    if (!plannerPhysicalResources) return;
    setSystemConfig((prev) => ({
      ...prev,
      infra_profile: {
        ...(prev.infra_profile || {}),
        app_server_ram_gb: plannerPhysicalResources.required_app_server_ram_gb,
        app_server_vcpu: plannerPhysicalResources.required_app_server_vcpu,
        db_server_ram_gb: plannerPhysicalResources.required_db_server_ram_gb,
        db_server_vcpu: plannerPhysicalResources.required_db_server_vcpu,
        web_server_ram_gb: plannerPhysicalResources.required_web_server_ram_gb,
        web_server_vcpu: plannerPhysicalResources.required_web_server_vcpu,
        os_reserve_percent: plannerPhysicalResources.recommended_os_reserve_percent,
        system_reserve_percent: plannerPhysicalResources.recommended_system_reserve_percent,
        web_admin_reserve_percent: plannerPhysicalResources.recommended_web_admin_reserve_percent,
      },
    }));
    setInfraDirty(true);
    setPlannerApplyMessage("Resources copied to Section A. Save Physical Infrastructure and re-check Section B.");
  };

  const validatePlannerInputs = useCallback((current: PlannerState): PlannerValidationResult => {
    const nextFieldErrors: Partial<Record<keyof PlannerState, string>> = {};
    const nextTopErrors: string[] = [];
    const farmers = Number(current.expected_farmers || 0);
    const traders = Number(current.expected_traders || 0);
    const peakTraders = Number(current.peak_active_traders || 0);
    const lotsPerDay = Number(current.expected_lots_per_day || 0);
    const peakQueued = Number(current.expected_peak_queued_lots || 0);
    const mandis = Number(current.number_of_mandis || 0);
    const concurrentAuctions = Number(current.expected_concurrent_auctions || 0);
    const growthBuffer = Number(current.growth_buffer_percent || 0);

    if (!current.selected_org_id) {
      nextFieldErrors.selected_org_id = "Select an organisation.";
      nextTopErrors.push("Select an organisation.");
    }
    if (!(mandis > 0)) {
      nextFieldErrors.number_of_mandis = "Number of mandis must be greater than 0.";
      nextTopErrors.push("Number of mandis must be greater than 0.");
    }
    if (farmers < 0) nextFieldErrors.expected_farmers = "Total farmers must be zero or greater.";
    if (traders < 0) nextFieldErrors.expected_traders = "Total registered traders must be zero or greater.";
    if (peakTraders < 0) nextFieldErrors.peak_active_traders = "Peak traders must be zero or greater.";
    if (lotsPerDay < 0) nextFieldErrors.expected_lots_per_day = "Total lots per day must be zero or greater.";
    if (peakQueued < 0) nextFieldErrors.expected_peak_queued_lots = "Peak queued lots must be zero or greater.";
    if (!(concurrentAuctions > 0)) {
      nextFieldErrors.expected_concurrent_auctions = "Peak concurrent auctions in this organisation must be greater than 0.";
      nextTopErrors.push("Peak concurrent auctions in this organisation must be greater than 0.");
    }
    if (growthBuffer < 0 || growthBuffer > 100) {
      nextFieldErrors.growth_buffer_percent = "Growth buffer (%) must be between 0 and 100.";
      nextTopErrors.push("Growth buffer (%) must be between 0 and 100.");
    }
    if (peakTraders > traders) {
      nextFieldErrors.peak_active_traders = "Peak traders bidding at the same time cannot exceed total registered traders.";
      nextTopErrors.push("Peak traders bidding at the same time cannot exceed total registered traders.");
    }
    if (lotsPerDay > 0 && peakQueued > lotsPerDay) {
      nextFieldErrors.expected_peak_queued_lots = "Peak queued lots cannot exceed total lots per day.";
      nextTopErrors.push("Peak queued lots cannot exceed total lots per day.");
    }
    const hasBusinessValues = [farmers, traders, peakTraders, lotsPerDay, peakQueued].some((value) => value > 0);
    if (!hasBusinessValues) {
      nextTopErrors.push("Enter expected farmers, traders, or lots before calculating.");
    }
    const combinedErrors = Array.from(new Set([...nextTopErrors, ...Object.values(nextFieldErrors)]));
    return {
      fieldErrors: nextFieldErrors,
      topErrors: combinedErrors,
      isValid: combinedErrors.length === 0,
    };
  }, []);

  useEffect(() => {
    if (!plannerOpen) return;
    const validation = validatePlannerInputs(planner);
    setPlannerFieldErrors(validation.fieldErrors);
    setPlannerTopErrors(validation.topErrors);
    setPlannerValidationError(validation.topErrors[0] || null);
    if (!validation.isValid) {
      setPlannerResult(null);
      return;
    }
    setPlannerResult(plannerSuggestion);
  }, [planner, plannerOpen, plannerSuggestion, validatePlannerInputs]);

  const handleCalculatePlanner = () => {
    setPlannerApplyError(null);
    const validation = validatePlannerInputs(planner);
    setPlannerFieldErrors(validation.fieldErrors);
    setPlannerTopErrors(validation.topErrors);
    setPlannerValidationError(validation.topErrors[0] || null);
    if (!validation.isValid) {
      setPlannerResult(null);
      return;
    }
    setPlannerResult(plannerSuggestion);
  };

  const updateOrgRow = (orgId: string, patch: Partial<OrgAllocation>) => {
    setOrgRows((prev) => prev.map((row) => (row.org_id === orgId ? { ...row, ...patch } : row)));
  };

  const updateOrgNumericField = (
    orgId: string,
    key: "allocated_max_live_lanes" | "allocated_max_open_lanes" | "allocated_max_queued_lots" | "allocated_max_concurrent_bidders",
    rawValue: string,
  ) => {
    const trimmed = String(rawValue ?? "").trim();
    const parsed = trimmed === "" ? null : Number(trimmed);
    const value = parsed === null || Number.isNaN(parsed) ? null : parsed;
    setOrgRows((prev) => prev.map((row) => (row.org_id === orgId
      ? { ...row, [key]: value, tier_code: "CUSTOM" }
      : row)));
  };

  const handleTierChange = (orgId: string, tierCode: string) => {
    const normalizedTier = String(tierCode || "").trim().toUpperCase();
    setOrgRows((prev) => prev.map((row) => {
      if (row.org_id !== orgId) return row;
      if (!normalizedTier) {
        return {
          ...row,
          tier_code: null,
          allocated_max_live_lanes: null,
          allocated_max_open_lanes: null,
          allocated_max_queued_lots: null,
          allocated_max_concurrent_bidders: null,
          overflow_allowed: false,
          special_event_allowed: false,
        };
      }
      if (normalizedTier === "CUSTOM") {
        return { ...row, tier_code: "CUSTOM" };
      }
      const preset = presetMap[normalizedTier] || null;
      if (!preset) {
        return { ...row, tier_code: normalizedTier };
      }
      return applyPreset(row, preset);
    }));
  };

  const handleSaveInfra = async () => {
    if (!username || !infraFormReady) return;
    setSavingSystem(true);
    setInfraSaveError(null);
    setInfraSaveSuccess(null);
    try {
      const resp: any = await updatePhysicalInfrastructureCapacity({
        username,
        payload: {
          deployment_profile_name: systemConfig.deployment_profile_name,
          infra_profile: systemConfig.infra_profile,
        },
      });
      if (String(resp?.response?.responsecode || "") !== "0") {
        setInfraSaveError(resp?.response?.description || "Failed to save physical infrastructure.");
        return;
      }
      await loadData();
      setInfraSaveSuccess("Physical infrastructure saved. Derived capacity refreshed.");
    } catch (err: any) {
      setInfraSaveError(err?.message || "Failed to save physical infrastructure.");
    } finally {
      setSavingSystem(false);
    }
  };

  const handleSaveSystem = async () => {
    if (!username || !infraFormReady || infraDirty) return;
    if (hasSectionCErrors) {
      setPlatformSaveError("Please resolve Section C validation errors before saving.");
      return;
    }
    setSavingSystem(true);
    setPlatformSaveError(null);
    setPlatformSaveSuccess(null);
    try {
      const resp: any = await updatePlatformAuctionCapacity({
        username,
        payload: {
          deployment_profile_name: systemConfig.deployment_profile_name,
          auction_capacity: systemConfig.auction_capacity,
        },
      });
      if (String(resp?.response?.responsecode || "") !== "0") {
        setPlatformSaveError(resp?.response?.description || "Failed to save platform capacity.");
        return;
      }
      setPlatformSaveSuccess(resp?.response?.description || "Platform auction capacity saved successfully.");
      await loadData();
    } catch (err: any) {
      setPlatformSaveError(err?.message || "Failed to save platform capacity.");
    } finally {
      setSavingSystem(false);
    }
  };

  const handleSaveOrg = async (row: OrgAllocation) => {
    if (!username || !orgAllocationAllowed || !infraFormReady || infraDirty) return;
    if (!stateFlags.platform_configured) {
      setOrgSaveError("Complete and save Section C to continue.");
      return;
    }
    if (hasOrgNumericErrors) {
      setOrgSaveError("One or more org allocation values are invalid. Ensure all values are zero or positive.");
      return;
    }
    if (orgAllocationSummary.hasExceeded) {
      setOrgSaveError(orgAllocationSummary.messages[0] || "Allocated org totals exceed platform limits.");
      return;
    }
    setSavingOrgId(row.org_id);
    setOrgSaveError(null);
    setOrgSaveSuccess(null);
    try {
      const resp: any = await updateOrgAuctionCapacityAllocation({
        username,
        payload: {
          org_id: row.org_id,
          capacity: {
            tier_code: row.tier_code,
            max_live_sessions: row.allocated_max_live_lanes,
            max_open_sessions: row.allocated_max_open_lanes,
            max_total_queued_lots: row.allocated_max_queued_lots,
            max_concurrent_bidders: row.allocated_max_concurrent_bidders,
            allow_overflow_lanes: row.overflow_allowed,
            allow_special_event_lanes: row.special_event_allowed,
            priority_weight: row.priority_weight,
            reserved_capacity_enabled: row.reserved_capacity_enabled,
          },
        },
      });
      if (String(resp?.response?.responsecode || "") !== "0") {
        setOrgSaveError(resp?.response?.description || "Failed to save organisation allocation.");
        setRemainingPool(resp?.data?.remaining_allocatable_pool || remainingPool);
        return;
      }
      setOrgSaveSuccess(resp?.response?.description || "Organisation auction capacity allocation saved successfully.");
      await loadData();
    } catch (err: any) {
      setOrgSaveError(err?.message || "Failed to save organisation allocation.");
    } finally {
      setSavingOrgId(null);
    }
  };

  const handleSaveAllOrg = async () => {
    if (!username || !orgAllocationAllowed || !infraFormReady || infraDirty) return;
    if (!stateFlags.platform_configured) {
      setOrgSaveError("Complete and save Section C to continue.");
      return;
    }
    if (hasOrgNumericErrors) {
      setOrgSaveError("One or more org allocation values are invalid. Ensure all values are zero or positive.");
      return;
    }
    if (orgAllocationSummary.hasExceeded) {
      setOrgSaveError(orgAllocationSummary.messages[0] || "Allocated org totals exceed platform limits.");
      return;
    }
    setSavingOrgId("__ALL__");
    setOrgSaveError(null);
    setOrgSaveSuccess(null);
    try {
      for (const row of orgRows) {
        const resp: any = await updateOrgAuctionCapacityAllocation({
          username,
          payload: {
            org_id: row.org_id,
            capacity: {
              tier_code: row.tier_code,
              max_live_sessions: row.allocated_max_live_lanes,
              max_open_sessions: row.allocated_max_open_lanes,
              max_total_queued_lots: row.allocated_max_queued_lots,
              max_concurrent_bidders: row.allocated_max_concurrent_bidders,
              allow_overflow_lanes: row.overflow_allowed,
              allow_special_event_lanes: row.special_event_allowed,
              priority_weight: row.priority_weight,
              reserved_capacity_enabled: row.reserved_capacity_enabled,
            },
          },
        });
        if (String(resp?.response?.responsecode || "") !== "0") {
          setOrgSaveError(`${row.org_name}: ${resp?.response?.description || "Failed to save organisation allocation."}`);
          setRemainingPool(resp?.data?.remaining_allocatable_pool || remainingPool);
          return;
        }
      }
      await loadData();
      setOrgSaveSuccess("Organisation auction capacity allocation saved successfully.");
    } catch (err: any) {
      setOrgSaveError(err?.message || "Failed to save organisation allocation.");
    } finally {
      setSavingOrgId(null);
    }
  };

  const systemTotalsWarning = platformUsage?.allocation_warning || null;
  const sectionAReadyToContinue = stateFlags.infra_ready && !infraDirty;
  const platformSectionDisabled = !canEditCapacityControl || !sectionAReadyToContinue;
  const usageSectionsLocked = !stateFlags.usage_sections_allowed || infraDirty;
  const orgSectionDisabled = !canEditCapacityControl || !orgAllocationAllowed || usageSectionsLocked;
  const isHealthBlockedByInfra = !stateFlags.infra_ready
    && Number(derivedSafeCapacity?.derived_safe_max_live_lanes || 0) === 0;
  const usageBlockMessage = (!stateFlags.infra_ready || infraDirty)
    ? "Complete and save Section A to continue."
    : "Complete and save Section C to continue.";
  const hasInvalidOrgRows = orgRows.some((row) => Boolean(row.allocation_invalid));
  const orgSaveDisabled = orgSectionDisabled
    || hasInvalidOrgRows
    || hasOrgNumericErrors
    || orgAllocationSummary.hasExceeded
    || !stateFlags.platform_configured;

  if (!username) {
    return <Typography>Please log in.</Typography>;
  }

  if (!canViewCapacityControl) {
    return (
      <Typography color="error">
        You do not have permission to view Capacity Control.
      </Typography>
    );
  }

  return (
    <StepUpGuard username={username} resourceKey="capacity_control.view">
      <PageContainer>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
          <Stack spacing={0.5}>
            <Typography variant="h5">System Capacity Control</Typography>
            <Typography variant="body2" color="text.secondary">
              Physical infrastructure is the source of truth. Platform and org limits cannot exceed infra-derived safe capacity.
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading || savingSystem || !!savingOrgId}>
              Refresh
            </Button>
            <Button variant="outlined" onClick={() => setPlannerOpen(true)}>
              Capacity Planner
            </Button>
            <Button variant="outlined" onClick={handleSaveSystem} disabled={!canEditCapacityControl || !sectionAReadyToContinue || savingSystem || loading}>
              {savingSystem ? "Saving..." : "Save Platform Capacity"}
            </Button>
          </Stack>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 2, mb: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={{ xs: 0.5, md: 2 }}>
            <Typography variant="caption">Infra Ready: {stateFlags.infra_ready ? "Yes" : "No"}</Typography>
            <Typography variant="caption">Derived Ready: {stateFlags.derived_ready ? "Yes" : "No"}</Typography>
            <Typography variant="caption">Platform Configured: {stateFlags.platform_configured ? "Yes" : "No"}</Typography>
            <Typography variant="caption">Platform Valid: {stateFlags.platform_valid ? "Yes" : "No"}</Typography>
            <Typography variant="caption">Allocation Valid: {stateFlags.allocation_valid ? "Yes" : "No"}</Typography>
          </Stack>
        </Paper>
        {infraDirty && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Section A has unsaved changes. Derived values shown below are from the last saved infrastructure profile.
          </Alert>
        )}
        {systemTotalsWarning && <Alert severity="warning" sx={{ mb: 2 }}>{systemTotalsWarning}</Alert>}
        {!canEditCapacityControl && <Alert severity="info" sx={{ mb: 2 }}>You do not have permission to edit Capacity Control.</Alert>}
        {(!infraFormReady || infraDirty) && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Complete and save Section A to continue.
          </Alert>
        )}
        {warnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            {warnings.map((warning, idx) => (
              <Typography key={`${warning}-${idx}`} variant="body2">{warning}</Typography>
            ))}
          </Alert>
        )}

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Section A — Physical Infrastructure Capacity (Mandatory)
          </Typography>
          {infraSaveError && <Alert severity="error" sx={{ mb: 1.5 }}>{infraSaveError}</Alert>}
          {infraSaveSuccess && <Alert severity="success" sx={{ mb: 1.5 }}>{infraSaveSuccess}</Alert>}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(220px, 1fr))" }, gap: 1.5 }}>
            <TextField
              select
              label={<FormLabelWithTooltip label="Cloud Provider" help="Select your hosting provider or infrastructure type (e.g., OCI, AWS, On-Prem)." />}
              helperText="Hosting provider or infra label."
              value={normalizeSelectValue(
                systemConfig.infra_profile?.cloud_provider || systemConfig.infra_profile?.provider_name || "",
                CLOUD_PROVIDER_OPTIONS,
                "",
                true,
              )}
              onChange={(e) => setInfraField("cloud_provider", String(e.target.value || "").toUpperCase())}
              fullWidth
              disabled={!canEditCapacityControl}
              required
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">Select</MenuItem>
              {CLOUD_PROVIDER_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={<FormLabelWithTooltip label="Deployment Type" help="Choose how your application is deployed: Shared, Dedicated, or Hybrid." />}
              helperText="Shared, Dedicated, or Hybrid hosting arrangement."
              value={normalizeSelectValue(systemConfig.infra_profile?.deployment_type || "", DEPLOYMENT_TYPE_OPTIONS, "")}
              onChange={(e) => setInfraField("deployment_type", String(e.target.value || "").toUpperCase())}
              fullWidth
              disabled={!canEditCapacityControl}
              required
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">Select</MenuItem>
              {DEPLOYMENT_TYPE_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label={<FormLabelWithTooltip label="Same Machine or Separate" help="Specify whether App, Web, and Database run on the same server or separate machines." />}
              helperText="Whether app, web, and database run on the same server or are split."
              value={normalizeSelectValue(
                systemConfig.infra_profile?.same_machine_or_separate || systemConfig.infra_profile?.same_machine || "",
                SAME_MACHINE_OPTIONS,
                "",
              )}
              onChange={(e) => setInfraField("same_machine_or_separate", String(e.target.value || "").toUpperCase())}
              fullWidth
              disabled={!canEditCapacityControl}
              required
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">Select</MenuItem>
              {SAME_MACHINE_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </TextField>
            <TextField label={<FormLabelWithTooltip label="App Server RAM (GB)" help="Total RAM allocated to the application server (API/backend processing)." />} helperText="Required physical memory for the application tier." type="number" value={num(systemConfig.infra_profile?.app_server_ram_gb)} onChange={(e) => setInfraField("app_server_ram_gb", e.target.value)} fullWidth disabled={!canEditCapacityControl} required />
            <TextField label={<FormLabelWithTooltip label="App Server vCPU" help="Number of CPU cores allocated to the application server." />} helperText="Required compute capacity for the application tier." type="number" value={num(systemConfig.infra_profile?.app_server_vcpu)} onChange={(e) => setInfraField("app_server_vcpu", e.target.value)} fullWidth disabled={!canEditCapacityControl} required />
            <TextField label={<FormLabelWithTooltip label="DB Server RAM (GB)" help="Memory allocated for database operations." />} helperText="Required memory capacity for the database tier." type="number" value={num(systemConfig.infra_profile?.db_server_ram_gb)} onChange={(e) => setInfraField("db_server_ram_gb", e.target.value)} fullWidth disabled={!canEditCapacityControl} required />
            <TextField label={<FormLabelWithTooltip label="DB Server vCPU" help="CPU cores allocated for database processing." />} helperText="Required compute capacity for the database tier." type="number" value={num(systemConfig.infra_profile?.db_server_vcpu)} onChange={(e) => setInfraField("db_server_vcpu", e.target.value)} fullWidth disabled={!canEditCapacityControl} required />
            <TextField label={<FormLabelWithTooltip label="Web Server RAM (GB)" help="Memory used for web/admin UI." />} helperText="Required memory for web and admin delivery." type="number" value={num(systemConfig.infra_profile?.web_server_ram_gb)} onChange={(e) => setInfraField("web_server_ram_gb", e.target.value)} fullWidth disabled={!canEditCapacityControl} required />
            <TextField label={<FormLabelWithTooltip label="Web Server vCPU" help="CPU capacity for web/admin interface." />} helperText="Required compute for web and admin delivery." type="number" value={num(systemConfig.infra_profile?.web_server_vcpu)} onChange={(e) => setInfraField("web_server_vcpu", e.target.value)} fullWidth disabled={!canEditCapacityControl} required />
            <TextField label={<FormLabelWithTooltip label="OS Reserve %" help="Reserved resources for OS usage." />} helperText="Capacity reserved for operating system overhead." type="number" value={num(systemConfig.infra_profile?.os_reserve_percent)} onChange={(e) => setInfraField("os_reserve_percent", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label={<FormLabelWithTooltip label="System Reserve %" help="Additional buffer to prevent overload." />} helperText="Additional platform reserve kept outside allocatable auction load." type="number" value={num(systemConfig.infra_profile?.system_reserve_percent)} onChange={(e) => setInfraField("system_reserve_percent", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label={<FormLabelWithTooltip label="Web/Admin Reserve %" help="Reserved for web/admin traffic." />} helperText="Reserved capacity for admin and web traffic not directly tied to auction lanes." type="number" value={num(systemConfig.infra_profile?.web_admin_reserve_percent)} onChange={(e) => setInfraField("web_admin_reserve_percent", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField
              select
              label={<FormLabelWithTooltip label="WebSocket Shared or Separate" help="Defines whether realtime connections run on shared or separate infra." />}
              helperText="Whether websocket load is shared with app servers or isolated."
              value={normalizeSelectValue(systemConfig.infra_profile?.websocket_shared_or_separate, WEBSOCKET_MODE_OPTIONS, "SHARED")}
              onChange={(e) => setInfraField("websocket_shared_or_separate", String(e.target.value || "").toUpperCase())}
              fullWidth
              disabled={!canEditCapacityControl}
              SelectProps={{ displayEmpty: true }}
            >
              <MenuItem value="">Select</MenuItem>
              {WEBSOCKET_MODE_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>{option}</MenuItem>
              ))}
            </TextField>
            <TextField label={<FormLabelWithTooltip label="Notes" help="Add deployment-specific remarks." />} helperText="Any infra-specific operational notes." value={systemConfig.infra_profile?.notes || ""} onChange={(e) => setInfraField("notes", e.target.value)} multiline minRows={3} fullWidth sx={{ gridColumn: { md: "1 / -1" } }} disabled={!canEditCapacityControl} />
          </Box>
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
            <Button variant="contained" onClick={handleSaveInfra} disabled={!canEditCapacityControl || !infraFormReady || savingSystem || loading}>
              {savingSystem ? "Saving..." : "Save Physical Infrastructure"}
            </Button>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Section B — Derived Safe Capacity
          </Typography>
          {!stateFlags.infra_ready && (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              Save Physical Infrastructure to calculate derived safe capacity.
            </Alert>
          )}
          <Alert severity="info" sx={{ mb: 1.5 }}>
            Auction safe capacity is derived from the strictest required infrastructure component, not by summing all server RAM/CPU.
          </Alert>
          <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.5, mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Infrastructure Breakdown
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(180px, 1fr))" }, gap: 1.25 }}>
              <MetricCard label="API Usable RAM (GB)" value={derivedSafeCapacity?.usable_api_ram_gb ?? 0} help="API/App usable RAM after reserve deductions." />
              <MetricCard label="API Usable vCPU" value={derivedSafeCapacity?.usable_api_vcpu ?? 0} help="API/App usable CPU after reserve deductions." />
              <MetricCard label="API Safe Live Lanes" value={derivedSafeCapacity?.api_safe_max_live_lanes ?? 0} help="API-governed safe live lane limit." />
              <MetricCard label="DB Usable RAM (GB)" value={derivedSafeCapacity?.usable_db_ram_gb ?? 0} help="DB usable RAM after reserve deductions." />
              <MetricCard label="DB Usable vCPU" value={derivedSafeCapacity?.usable_db_vcpu ?? 0} help="DB usable CPU after reserve deductions." />
              <MetricCard label="DB Safe Queued Lots" value={derivedSafeCapacity?.db_safe_max_total_queued_lots ?? 0} help="DB-governed safe queued lot limit." />
              <MetricCard label="Web Usable RAM (GB)" value={derivedSafeCapacity?.usable_web_ram_gb ?? 0} help="Web/Admin usable RAM after reserve deductions." />
              <MetricCard label="Web Usable vCPU" value={derivedSafeCapacity?.usable_web_vcpu ?? 0} help="Web/Admin usable CPU after reserve deductions." />
              <MetricCard label="DB Support Bidders" value={derivedSafeCapacity?.db_safe_support_bidders ?? 0} help="DB-backed bidder throughput support limit." />
            </Box>
          </Paper>
          <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.5, mb: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              Final Governing Bottleneck
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {derivedSafeCapacity?.final_bottleneck_label || "N/A"}
            </Typography>
          </Paper>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(180px, 1fr))" }, gap: 1.25 }}>
            <MetricCard label="Final Safe Live Lanes" value={derivedSafeCapacity?.final_safe_max_live_lanes ?? derivedSafeCapacity?.derived_safe_max_live_lanes ?? 0} help="Final safe live-lane ceiling after API/DB bottleneck checks." />
            <MetricCard label="Final Safe Open Lanes" value={derivedSafeCapacity?.final_safe_max_open_lanes ?? derivedSafeCapacity?.derived_safe_max_open_lanes ?? 0} help="Final safe open-lane ceiling." />
            <MetricCard label="Final Safe Queued Lots" value={derivedSafeCapacity?.final_safe_max_total_queued_lots ?? derivedSafeCapacity?.derived_safe_max_total_queued_lots ?? 0} help="Final safe queued-lot ceiling (DB-governed)." />
            <MetricCard label="Final Safe Concurrent Bidders" value={derivedSafeCapacity?.final_safe_max_concurrent_bidders ?? derivedSafeCapacity?.derived_safe_max_concurrent_bidders ?? 0} help="Final safe bidder concurrency ceiling (API/DB bottleneck)." />
            <MetricCard label="Safe Socket Connections" value={derivedSafeCapacity?.derived_safe_max_socket_mobile_connections ?? 0} help="Infra-derived safe realtime connection ceiling." />
            <MetricCard label="Safe Bidders per Lane" value={derivedSafeCapacity?.derived_safe_max_bidders_per_lane ?? 0} help="Safe bidder concurrency per live lane." />
            <MetricCard label="Safe Queue per Lane" value={derivedSafeCapacity?.derived_safe_max_queue_per_lane ?? 0} help="Safe queued-lot count per live lane." />
            <MetricCard label="Reserve %" value={derivedSafeCapacity?.derived_reserve_percent ?? 0} help="Base reserve input used in component-level deductions." />
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Section C — Platform Capacity Profile
          </Typography>
          <Alert severity="info" sx={{ mb: 1.5 }}>
            Section B shows maximum safe capacity from physical infrastructure. Section C shows how much of that safe capacity the platform is allowed to use. Section F must fit inside Section C.
          </Alert>
          {platformSectionDisabled && (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              Complete and save Section A to continue.
            </Alert>
          )}
          {platformSaveError && <Alert severity="error" sx={{ mb: 1.5 }}>{platformSaveError}</Alert>}
          {platformSaveSuccess && <Alert severity="success" sx={{ mb: 1.5 }}>{platformSaveSuccess}</Alert>}
          <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5, mb: 1.5 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
              Capacity Planning
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(220px, 1fr))" }, gap: 1.5 }}>
              <TextField
                select
                label="Capacity Planning Mode"
                value={capacityPlanningMode}
                onChange={(e) => setCapacityPlanningMode(e.target.value as CapacityPlanningMode)}
                fullWidth
                disabled={platformSectionDisabled}
              >
                <MenuItem value="MANUAL">MANUAL</MenuItem>
                <MenuItem value="AUTO_FROM_SAFE_CAPACITY">AUTO_FROM_SAFE_CAPACITY</MenuItem>
              </TextField>
              <TextField
                label="Buffer Percent"
                type="number"
                value={bufferPercent}
                onChange={(e) => setBufferPercent(Number(e.target.value || 0))}
                fullWidth
                disabled={platformSectionDisabled}
                inputProps={{ min: 0, max: 90 }}
                helperText="Default: 20"
                error={!isBufferPercentValid}
              />
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={handleGeneratePlatformLimits}
                  disabled={platformSectionDisabled || !hasDerivedSafeForGeneration || !isBufferPercentValid}
                >
                  Generate Platform Limits
                </Button>
              </Box>
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
              With {clampedBufferPercent}% buffer → Live: {generatedPreview.max_total_live_lanes}, Open: {generatedPreview.max_total_open_lanes}, Queued: {generatedPreview.max_total_queued_lots}, Bidders: {generatedPreview.max_total_concurrent_bidders}
            </Typography>
          </Box>
          <Stack spacing={1.5}>
            <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                C1. Platform Control
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.25 }}>
                These values define the maximum total auction load allowed across the full platform.
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(220px, 1fr))" }, gap: 1.5 }}>
                <TextField label={<FormLabelWithTooltip label="Deployment / Profile Name" help="Name this configuration (e.g., Production, Testing)." />} helperText="Friendly name of the current platform capacity profile." value={systemConfig.deployment_profile_name || ""} onChange={(e) => setSystemConfig((prev) => ({ ...prev, deployment_profile_name: e.target.value }))} fullWidth disabled={platformSectionDisabled} />
                <TextField select label={<FormLabelWithTooltip label="Guard Enabled" help="Enables capacity enforcement. Recommended: Yes." />} helperText="Turns backend capacity enforcement on or off." value={systemConfig.auction_capacity?.guard_enabled ? "true" : "false"} onChange={(e) => setAuctionField("guard_enabled", e.target.value === "true")} fullWidth disabled={platformSectionDisabled}>
                  <MenuItem value="true">Yes</MenuItem>
                  <MenuItem value="false">No</MenuItem>
                </TextField>
                <TextField
                  label={<FormLabelWithTooltip label="Max Total Live Lanes" help="Maximum number of auctions running LIVE simultaneously." />}
                  helperText={sectionCFieldErrors.max_total_live_lanes || `Safe maximum from infrastructure: ${safeMaxLive}`}
                  type="number"
                  value={num(systemConfig.auction_capacity?.max_total_live_lanes)}
                  onChange={(e) => setAuctionField("max_total_live_lanes", e.target.value)}
                  fullWidth
                  disabled={platformSectionDisabled}
                  error={Boolean(sectionCFieldErrors.max_total_live_lanes)}
                  inputProps={{ min: 0, max: safeMaxLive }}
                />
                <TextField
                  label={<FormLabelWithTooltip label="Max Total Open Lanes" help="Total auctions allowed (LIVE + PLANNED)." />}
                  helperText={sectionCFieldErrors.max_total_open_lanes || `Safe maximum from infrastructure: ${safeMaxOpen}`}
                  type="number"
                  value={num(systemConfig.auction_capacity?.max_total_open_lanes)}
                  onChange={(e) => setAuctionField("max_total_open_lanes", e.target.value)}
                  fullWidth
                  disabled={platformSectionDisabled}
                  error={Boolean(sectionCFieldErrors.max_total_open_lanes)}
                  inputProps={{ min: 0, max: safeMaxOpen }}
                />
                <TextField
                  label={<FormLabelWithTooltip label="Max Total Queued Lots" help="Maximum lots waiting in auction queues." />}
                  helperText={sectionCFieldErrors.max_total_queued_lots || `Safe maximum from infrastructure: ${safeMaxQueued}`}
                  type="number"
                  value={num(systemConfig.auction_capacity?.max_total_queued_lots)}
                  onChange={(e) => setAuctionField("max_total_queued_lots", e.target.value)}
                  fullWidth
                  disabled={platformSectionDisabled}
                  error={Boolean(sectionCFieldErrors.max_total_queued_lots)}
                  inputProps={{ min: 0, max: safeMaxQueued }}
                />
                <TextField
                  label={<FormLabelWithTooltip label="Max Total Concurrent Bidders" help="Maximum bidders allowed simultaneously." />}
                  helperText={sectionCFieldErrors.max_total_concurrent_bidders || `Safe maximum from infrastructure: ${safeMaxBidders}`}
                  type="number"
                  value={num(systemConfig.auction_capacity?.max_total_concurrent_bidders)}
                  onChange={(e) => setAuctionField("max_total_concurrent_bidders", e.target.value)}
                  fullWidth
                  disabled={platformSectionDisabled}
                  error={Boolean(sectionCFieldErrors.max_total_concurrent_bidders)}
                  inputProps={{ min: 0, max: safeMaxBidders }}
                />
              </Box>
            </Box>

            <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                C2. Warning Thresholds
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.25 }}>
                These values do not block usage. They only warn when platform resource usage becomes risky.
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(220px, 1fr))" }, gap: 1.5 }}>
                <TextField label={<FormLabelWithTooltip label="CPU Warning Threshold %" help="CPU usage alert threshold." />} helperText="Warning threshold for CPU usage before the platform should be treated as stressed." type="number" value={num(systemConfig.auction_capacity?.cpu_warning_threshold_percent)} onChange={(e) => setAuctionField("cpu_warning_threshold_percent", e.target.value)} fullWidth disabled={platformSectionDisabled} />
                <TextField label={<FormLabelWithTooltip label="Memory Warning Threshold %" help="Memory usage alert threshold." />} helperText="Warning threshold for memory usage before the platform should be treated as stressed." type="number" value={num(systemConfig.auction_capacity?.memory_warning_threshold_percent)} onChange={(e) => setAuctionField("memory_warning_threshold_percent", e.target.value)} fullWidth disabled={platformSectionDisabled} />
              </Box>
            </Box>

            <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                C3. Default Organisation Limits
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.25 }}>
                These are the default limits assigned to each organisation unless customised later.
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(220px, 1fr))" }, gap: 1.5 }}>
                <TextField label={<FormLabelWithTooltip label="Default Org Max Live Lanes" help="Default live auction limit per organization." />} helperText={sectionCFieldErrors.default_org_max_live_lanes || "Default live-lane quota assigned to a new org if no custom allocation is set."} type="number" value={num(systemConfig.auction_capacity?.default_org_max_live_lanes)} onChange={(e) => setAuctionField("default_org_max_live_lanes", e.target.value)} fullWidth disabled={platformSectionDisabled} error={Boolean(sectionCFieldErrors.default_org_max_live_lanes)} />
                <TextField label={<FormLabelWithTooltip label="Default Org Max Open Lanes" help="Default total auctions per organization." />} helperText={sectionCFieldErrors.default_org_max_open_lanes || "Default open-lane quota assigned to a new org."} type="number" value={num(systemConfig.auction_capacity?.default_org_max_open_lanes)} onChange={(e) => setAuctionField("default_org_max_open_lanes", e.target.value)} fullWidth disabled={platformSectionDisabled} error={Boolean(sectionCFieldErrors.default_org_max_open_lanes)} />
                <TextField label={<FormLabelWithTooltip label="Default Org Max Total Queued Lots" help="Default queue limit per organization." />} helperText={sectionCFieldErrors.default_org_max_total_queued_lots || "Default total queued-lot quota assigned to a new org."} type="number" value={num(systemConfig.auction_capacity?.default_org_max_total_queued_lots)} onChange={(e) => setAuctionField("default_org_max_total_queued_lots", e.target.value)} fullWidth disabled={platformSectionDisabled} error={Boolean(sectionCFieldErrors.default_org_max_total_queued_lots)} />
                <TextField label={<FormLabelWithTooltip label="Default Org Max Concurrent Bidders" help="Default bidder limit per organization." />} helperText={sectionCFieldErrors.default_org_max_concurrent_bidders || "Default concurrent bidder quota assigned to a new org."} type="number" value={num(systemConfig.auction_capacity?.default_org_max_concurrent_bidders)} onChange={(e) => setAuctionField("default_org_max_concurrent_bidders", e.target.value)} fullWidth disabled={platformSectionDisabled} error={Boolean(sectionCFieldErrors.default_org_max_concurrent_bidders)} />
              </Box>
            </Box>

            <Box sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 1.5 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                C4. Default Mandi Limits
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.25 }}>
                These are the default limits assigned to each mandi under an organisation unless overridden later.
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(220px, 1fr))" }, gap: 1.5 }}>
                <TextField label={<FormLabelWithTooltip label="Default Mandi Max Live Lanes" help="Default live auctions per mandi." />} helperText={sectionCFieldErrors.default_mandi_max_live_lanes || "Default mandi live-lane limit when mandi override is not set."} type="number" value={num(systemConfig.auction_capacity?.default_mandi_max_live_lanes)} onChange={(e) => setAuctionField("default_mandi_max_live_lanes", e.target.value)} fullWidth disabled={platformSectionDisabled} error={Boolean(sectionCFieldErrors.default_mandi_max_live_lanes)} />
                <TextField label={<FormLabelWithTooltip label="Default Mandi Max Open Lanes" help="Default auctions per mandi." />} helperText={sectionCFieldErrors.default_mandi_max_open_lanes || "Default mandi open-lane limit when mandi override is not set."} type="number" value={num(systemConfig.auction_capacity?.default_mandi_max_open_lanes)} onChange={(e) => setAuctionField("default_mandi_max_open_lanes", e.target.value)} fullWidth disabled={platformSectionDisabled} error={Boolean(sectionCFieldErrors.default_mandi_max_open_lanes)} />
                <TextField label={<FormLabelWithTooltip label="Default Mandi Max Queue Per Lane" help="Max lots allowed in a single lane." />} helperText={sectionCFieldErrors.default_mandi_max_queue_per_lane || "Default number of queued lots allowed in one mandi lane."} type="number" value={num(systemConfig.auction_capacity?.default_mandi_max_queue_per_lane)} onChange={(e) => setAuctionField("default_mandi_max_queue_per_lane", e.target.value)} fullWidth disabled={platformSectionDisabled} error={Boolean(sectionCFieldErrors.default_mandi_max_queue_per_lane)} />
                <TextField label={<FormLabelWithTooltip label="Default Mandi Max Total Queued Lots" help="Total queue capacity per mandi." />} helperText={sectionCFieldErrors.default_mandi_max_total_queued_lots || "Default total queued lots allowed for one mandi."} type="number" value={num(systemConfig.auction_capacity?.default_mandi_max_total_queued_lots)} onChange={(e) => setAuctionField("default_mandi_max_total_queued_lots", e.target.value)} fullWidth disabled={platformSectionDisabled} error={Boolean(sectionCFieldErrors.default_mandi_max_total_queued_lots)} />
              </Box>
            </Box>
          </Stack>
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
            <Button variant="contained" onClick={handleSaveSystem} disabled={platformSectionDisabled || savingSystem || loading || hasSectionCErrors}>
              {savingSystem ? "Saving..." : "Save Platform Capacity"}
            </Button>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Section D — Current Platform Usage / Health
          </Typography>
          {usageSectionsLocked && (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              {usageBlockMessage}
            </Alert>
          )}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(180px, 1fr))" }, gap: 1.25, mb: 2, opacity: usageSectionsLocked ? 0.65 : 1, pointerEvents: usageSectionsLocked ? "none" : "auto" }}>
            <MetricCard label="Current Live Lanes" value={platformUsage?.current_live_lanes ?? 0} help="Number of lanes currently running live." />
            <MetricCard label="Current Open Lanes" value={platformUsage?.current_open_lanes ?? 0} help="Number of planned, open, or live lanes currently present." />
            <MetricCard label="Current Queued Lots" value={platformUsage?.current_queued_lots ?? 0} help="Number of lots currently waiting in lane queues." />
            <MetricCard label="Current Bidders" value={platformUsage?.current_bidders ?? 0} help="Current bidder usage tracked in capacity health." />
            <MetricCard label="Current Socket Connections" value={platformUsage?.current_socket_connections ?? 0} help="Current realtime socket usage tracked in capacity health." />
            <MetricCard label="Remaining Live Capacity" value={platformUsage?.remaining_live_capacity ?? 0} help="Configured platform live capacity still available." />
            <MetricCard label="Remaining Open Capacity" value={platformUsage?.remaining_open_capacity ?? 0} help="Configured platform open capacity still available." />
            <MetricCard label="Remaining Queue Capacity" value={platformUsage?.remaining_queue_capacity ?? 0} help="Configured platform queued capacity still available." />
          </Box>
          {isHealthBlockedByInfra ? (
            <Alert severity="info" sx={{ mb: upgradeAlerts.length ? 2 : 0 }}>
              Health cannot be evaluated until physical infrastructure is configured.
            </Alert>
          ) : !stateFlags.platform_configured ? (
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} mb={upgradeAlerts.length ? 2 : 0}>
              <Chip color="default" label="Live Lanes: NOT CONFIGURED" />
              <Chip color="default" label="Bidders: NOT CONFIGURED" />
              <Chip color="default" label="Queue: NOT CONFIGURED" />
            </Stack>
          ) : (
            <Stack direction={{ xs: "column", md: "row" }} spacing={1} mb={upgradeAlerts.length ? 2 : 0}>
              <Chip color={healthColor(capacityHealth?.live_lanes_state)} label={`Live Lanes: ${capacityHealth?.live_lanes_state || "RED"}`} />
              <Chip color={healthColor(capacityHealth?.bidders_state)} label={`Bidders: ${capacityHealth?.bidders_state || "RED"}`} />
              <Chip color={healthColor(capacityHealth?.queue_state)} label={`Queue: ${capacityHealth?.queue_state || "RED"}`} />
            </Stack>
          )}
          {upgradeAlerts.length > 0 && (
            <Alert severity="warning">
              {upgradeAlerts.map((alert, idx) => (
                <Typography key={`${alert}-${idx}`} variant="body2">{alert}</Typography>
              ))}
            </Alert>
          )}
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Section E — Remaining Allocatable Capacity
          </Typography>
          {usageSectionsLocked && (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              {usageBlockMessage}
            </Alert>
          )}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(180px, 1fr))" }, gap: 1.25, opacity: usageSectionsLocked ? 0.65 : 1, pointerEvents: usageSectionsLocked ? "none" : "auto" }}>
            <MetricCard label="Remaining Live" value={remainingPool?.remaining_allocatable_live ?? 0} help="Remaining platform live allocation available for org assignment." />
            <MetricCard label="Remaining Open" value={remainingPool?.remaining_allocatable_open ?? 0} help="Remaining platform open allocation available for org assignment." />
            <MetricCard label="Remaining Queued" value={remainingPool?.remaining_allocatable_queued ?? 0} help="Remaining platform queued-lot allocation available for org assignment." />
            <MetricCard label="Remaining Bidders" value={remainingPool?.remaining_allocatable_bidders ?? 0} help="Remaining platform bidder allocation available for org assignment." />
            <MetricCard label="Allocated Live" value={remainingPool?.total_allocated_live ?? 0} help="Total live allocation already assigned to orgs." />
            <MetricCard label="Allocated Open" value={remainingPool?.total_allocated_open ?? 0} help="Total open allocation already assigned to orgs." />
            <MetricCard label="Allocated Queued" value={remainingPool?.total_allocated_queued ?? 0} help="Total queued-lot allocation already assigned to orgs." />
            <MetricCard label="Allocated Bidders" value={remainingPool?.total_allocated_bidders ?? 0} help="Total bidder allocation already assigned to orgs." />
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Section F — Org Allocation Management
          </Typography>
          {orgSectionDisabled && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {usageBlockMessage}
            </Alert>
          )}
          {orgSaveError && <Alert severity="error" sx={{ mb: 2 }}>{orgSaveError}</Alert>}
          {orgSaveSuccess && <Alert severity="success" sx={{ mb: 2 }}>{orgSaveSuccess}</Alert>}
          {hasInvalidOrgRows && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              One or more org allocations exceed current effective platform capacity. Correct them before saving.
            </Alert>
          )}
          {hasOrgNumericErrors && (
            <Alert severity="error" sx={{ mb: 2 }}>
              One or more org allocation values are invalid. Ensure all values are zero or positive.
            </Alert>
          )}
          {orgAllocationSummary.messages.map((message) => (
            <Alert key={message} severity="error" sx={{ mb: 2 }}>
              {message}
            </Alert>
          ))}
          <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.5, mb: 2 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Allocation Summary
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={1}>
              <Chip color={orgAllocationSummary.exceeded.live ? "error" : "success"} label={`Live: ${orgAllocationSummary.allocatedLive} / ${platformMaxLive}`} />
              <Chip color={orgAllocationSummary.exceeded.open ? "error" : "success"} label={`Open: ${orgAllocationSummary.allocatedOpen} / ${platformMaxOpen}`} />
              <Chip color={orgAllocationSummary.exceeded.queued ? "error" : "success"} label={`Queued: ${orgAllocationSummary.allocatedQueued} / ${platformMaxQueued}`} />
              <Chip color={orgAllocationSummary.exceeded.bidders ? "error" : "success"} label={`Bidders: ${orgAllocationSummary.allocatedBidders} / ${platformMaxBidders}`} />
            </Stack>
          </Paper>
          <Alert severity="info" sx={{ mb: 2 }}>
            Org values cannot exceed platform limits. Effective mandi limits cascade below org allocation.
          </Alert>
          <Alert severity="info" sx={{ mb: 2 }}>
            Tier values are auto-applied based on selection.
          </Alert>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.5 }}>
            <Button variant="contained" onClick={handleSaveAllOrg} disabled={orgSaveDisabled || savingOrgId === "__ALL__"}>
              {savingOrgId === "__ALL__" ? "Saving..." : "Save Org Allocation"}
            </Button>
          </Stack>
          <Box sx={{ overflowX: "auto", opacity: orgSectionDisabled ? 0.65 : 1, pointerEvents: orgSectionDisabled ? "none" : "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Org Name</TableCell>
                  <TableCell><HeaderWithTooltip label="Tier" help="Optional service or allocation profile for the org. Tier values are derived from current physical capacity." /></TableCell>
                  <TableCell>Current Usage</TableCell>
                  <TableCell><HeaderWithTooltip label="Allocated Max Live" help="Maximum live lanes allowed for the org." /></TableCell>
                  <TableCell><HeaderWithTooltip label="Allocated Max Open" help="Maximum open lanes allowed for the org." /></TableCell>
                  <TableCell><HeaderWithTooltip label="Allocated Max Queued" help="Maximum queued lots allowed for the org." /></TableCell>
                  <TableCell><HeaderWithTooltip label="Concurrent Bidders" help="Maximum concurrent bidder load allocated to the org." /></TableCell>
                  <TableCell><HeaderWithTooltip label="Overflow" help="Whether overflow-type lanes are allowed for that org." /></TableCell>
                  <TableCell><HeaderWithTooltip label="Special Event" help="Whether special-event lanes are allowed for that org." /></TableCell>
                  <TableCell><HeaderWithTooltip label="Priority" help="Relative weighting for capacity allocation priority." /></TableCell>
                  <TableCell><HeaderWithTooltip label="Reserved" help="Whether reserved capacity is enabled for the org." /></TableCell>
                  <TableCell>Usage %</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {orgRows.map((row) => {
                  const tierSelected = Boolean(row.tier_code);
                  const tierIsCustom = String(row.tier_code || "").toUpperCase() === "CUSTOM";
                  const selectedPreset = tierSelected ? presetMap[String(row.tier_code || "").toUpperCase()] : null;
                  return (
                    <TableRow key={row.org_id}>
                      <TableCell>
                        <Stack spacing={0.25}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.org_name}</Typography>
                          <Typography variant="caption" color="text.secondary">{row.org_code || "—"}</Typography>
                          {row.allocation_invalid && row.allocation_warning ? (
                            <Typography variant="caption" color="warning.main">{row.allocation_warning}</Typography>
                          ) : null}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Stack spacing={0.5}>
                          <TextField
                            select
                            size="small"
                            value={row.tier_code || ""}
                            onChange={(e) => handleTierChange(row.org_id, e.target.value)}
                            sx={{ minWidth: 140 }}
                            disabled={orgSectionDisabled}
                          >
                            <MenuItem value="">-- Select Tier --</MenuItem>
                            {SECTION_F_TIER_OPTIONS.map((tierCode) => <MenuItem key={tierCode} value={tierCode}>{tierCode}</MenuItem>)}
                          </TextField>
                          {selectedPreset?.price_hint ? (
                            <Typography variant="caption" color="text.secondary">Price hint: {selectedPreset.price_hint}</Typography>
                          ) : null}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" display="block">Live {row.current_live_lanes}</Typography>
                        <Typography variant="caption" display="block">Open {row.current_open_lanes}</Typography>
                        <Typography variant="caption" display="block">Queued {row.current_queued_lots}</Typography>
                      </TableCell>
                      <TableCell><TextField size="small" type="number" value={num(row.allocated_max_live_lanes)} onChange={(e) => updateOrgNumericField(row.org_id, "allocated_max_live_lanes", e.target.value)} sx={{ width: 110 }} disabled={orgSectionDisabled || (tierSelected && !tierIsCustom)} error={orgAllocationSummary.exceeded.live} /></TableCell>
                      <TableCell><TextField size="small" type="number" value={num(row.allocated_max_open_lanes)} onChange={(e) => updateOrgNumericField(row.org_id, "allocated_max_open_lanes", e.target.value)} sx={{ width: 110 }} disabled={orgSectionDisabled || (tierSelected && !tierIsCustom)} error={orgAllocationSummary.exceeded.open} /></TableCell>
                      <TableCell><TextField size="small" type="number" value={num(row.allocated_max_queued_lots)} onChange={(e) => updateOrgNumericField(row.org_id, "allocated_max_queued_lots", e.target.value)} sx={{ width: 120 }} disabled={orgSectionDisabled || (tierSelected && !tierIsCustom)} error={orgAllocationSummary.exceeded.queued} /></TableCell>
                      <TableCell><TextField size="small" type="number" value={num(row.allocated_max_concurrent_bidders)} onChange={(e) => updateOrgNumericField(row.org_id, "allocated_max_concurrent_bidders", e.target.value)} sx={{ width: 120 }} disabled={orgSectionDisabled || (tierSelected && !tierIsCustom)} error={orgAllocationSummary.exceeded.bidders} /></TableCell>
                      <TableCell><Switch checked={Boolean(row.overflow_allowed)} onChange={(e) => updateOrgRow(row.org_id, { overflow_allowed: e.target.checked })} disabled={orgSectionDisabled || tierSelected} /></TableCell>
                      <TableCell><Switch checked={Boolean(row.special_event_allowed)} onChange={(e) => updateOrgRow(row.org_id, { special_event_allowed: e.target.checked })} disabled={orgSectionDisabled || tierSelected} /></TableCell>
                      <TableCell><TextField size="small" type="number" value={num(row.priority_weight)} onChange={(e) => updateOrgRow(row.org_id, { priority_weight: Number(e.target.value) || null })} sx={{ width: 100 }} disabled={orgSectionDisabled} /></TableCell>
                      <TableCell><Switch checked={Boolean(row.reserved_capacity_enabled)} onChange={(e) => updateOrgRow(row.org_id, { reserved_capacity_enabled: e.target.checked })} disabled={orgSectionDisabled || tierSelected} /></TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          color={Number(row.usage_percent || 0) >= 100 ? "error" : Number(row.usage_percent || 0) >= 80 ? "warning" : "success"}
                          label={`${Number(row.usage_percent || 0).toFixed(0)}%`}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button size="small" variant="outlined" onClick={() => handleSaveOrg(row)} disabled={orgSaveDisabled || savingOrgId === row.org_id || savingOrgId === "__ALL__" || Boolean(row.allocation_invalid)}>
                          {savingOrgId === row.org_id ? "Saving..." : "Save"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        </Paper>

        <Dialog open={plannerOpen} onClose={() => { setPlannerApplyMessage(null); setPlannerApplyError(null); setPlannerOpen(false); }} fullWidth maxWidth="lg">
          <DialogTitle>Capacity Planner</DialogTitle>
          <DialogContent dividers>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              This planner estimates organisation allocation from business numbers. It does not change physical server capacity.
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
              Section A is your current physical server. Section B is safe capacity calculated from Section A. Section C is the platform limit you allow. Section F is organisation allocation. This planner checks whether the selected organisation can fit into all of them.
            </Typography>
            <Alert severity="info" sx={{ mb: 1.5 }}>
              Section B shows maximum safe capacity from physical infrastructure. Section C shows how much of that safe capacity the platform is allowed to use. Section F must fit inside Section C.
            </Alert>
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.5 }}>
              Planner output updates automatically from the values above.
            </Typography>
            <Alert severity="info" sx={{ mb: 1.5 }}>
              This planner has two checks:
              <Typography variant="body2">1. Can your current servers support this organisation?</Typography>
              <Typography variant="body2">2. Can your remaining platform allocation accept this organisation now?</Typography>
            </Alert>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(220px, 1fr))" }, gap: 1.5, mb: 2 }}>
              <TextField
                select
                label="Select Organisation"
                value={planner.selected_org_id}
                onChange={(e) => setPlannerField("selected_org_id", String(e.target.value || ""))}
                fullWidth
                error={Boolean(plannerFieldErrors.selected_org_id)}
                helperText={plannerFieldErrors.selected_org_id || ""}
              >
                {orgRows.map((row) => (
                  <MenuItem key={row.org_id} value={row.org_id}>
                    {row.org_name}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                label="Number of mandis in this organisation"
                helperText={plannerFieldErrors.number_of_mandis || "Enter how many mandis are operated under this organisation."}
                type="number"
                value={planner.number_of_mandis}
                onChange={(e) => setPlannerField("number_of_mandis", toNonNegativeNumber(e.target.value))}
                fullWidth
                error={Boolean(plannerFieldErrors.number_of_mandis)}
              />
              <TextField
                label="Total farmers in this organisation"
                helperText={plannerFieldErrors.expected_farmers || "Enter total farmers served by this organisation, not per mandi. Impact: Mainly affects web/admin resource planning."}
                type="number"
                value={planner.expected_farmers}
                onChange={(e) => setPlannerField("expected_farmers", toNonNegativeNumber(e.target.value))}
                fullWidth
                error={Boolean(plannerFieldErrors.expected_farmers)}
              />
              <TextField
                label="Total registered traders in this organisation"
                helperText={plannerFieldErrors.expected_traders || "Enter total registered traders in this organisation, not per mandi. Impact: Mainly affects web/admin resource planning."}
                type="number"
                value={planner.expected_traders}
                onChange={(e) => setPlannerField("expected_traders", toNonNegativeNumber(e.target.value))}
                fullWidth
                error={Boolean(plannerFieldErrors.expected_traders)}
              />
              <TextField
                label="Peak traders bidding at the same time"
                helperText={plannerFieldErrors.peak_active_traders || "Enter the maximum traders expected to bid at the same time. Impact: Affects app server, WebSocket, bidder capacity, and DB persistence."}
                type="number"
                value={planner.peak_active_traders}
                onChange={(e) => setPlannerField("peak_active_traders", toNonNegativeNumber(e.target.value))}
                fullWidth
                error={Boolean(plannerFieldErrors.peak_active_traders)}
              />
              <TextField
                label="Peak lots waiting in queue"
                helperText={plannerFieldErrors.expected_peak_queued_lots || "Enter the maximum lots that may wait in auction queue during a busy period. Impact: Mainly affects DB RAM/vCPU and queued-lot capacity."}
                type="number"
                value={planner.expected_peak_queued_lots}
                onChange={(e) => setPlannerField("expected_peak_queued_lots", toNonNegativeNumber(e.target.value))}
                fullWidth
                error={Boolean(plannerFieldErrors.expected_peak_queued_lots)}
              />
              <TextField
                label="Total lots per day in this organisation"
                helperText={plannerFieldErrors.expected_lots_per_day || "Enter total lots across all mandis. Example: 10 mandis × 50 lots = 500 lots/day."}
                type="number"
                value={planner.expected_lots_per_day}
                onChange={(e) => setPlannerField("expected_lots_per_day", toNonNegativeNumber(e.target.value))}
                fullWidth
                error={Boolean(plannerFieldErrors.expected_lots_per_day)}
              />
              <TextField
                label="Peak concurrent auctions in this organisation"
                helperText={plannerFieldErrors.expected_concurrent_auctions || "Enter how many auctions may run at the same time across the organisation. Impact: Mainly affects app server RAM/vCPU and live lane allocation."}
                type="number"
                value={planner.expected_concurrent_auctions}
                onChange={(e) => setPlannerField("expected_concurrent_auctions", toNonNegativeNumber(e.target.value))}
                fullWidth
                error={Boolean(plannerFieldErrors.expected_concurrent_auctions)}
              />
              <TextField
                label="Growth buffer (%)"
                helperText={plannerFieldErrors.growth_buffer_percent || "Impact: Increases recommended resources for future load."}
                type="number"
                inputProps={{ min: 0, max: 100 }}
                value={planner.growth_buffer_percent}
                onChange={(e) => setPlannerField("growth_buffer_percent", toNonNegativeNumber(e.target.value))}
                fullWidth
                error={Boolean(plannerFieldErrors.growth_buffer_percent)}
              />
              <TextField
                select
                label="Usage Profile"
                value={planner.usage_profile}
                onChange={(e) => setPlannerField("usage_profile", e.target.value as PlannerState["usage_profile"])}
                fullWidth
              >
                {["TESTING", "SMALL", "NORMAL", "HEAVY", "PEAK_SEASON"].map((profile) => (
                  <MenuItem key={profile} value={profile}>{profile}</MenuItem>
                ))}
              </TextField>
            </Box>
            {(plannerTopErrors.length > 0 || plannerValidationError) && (
              <Alert severity="error" sx={{ mb: 1.5 }}>
                <Stack spacing={0.5}>
                  {(plannerTopErrors.length > 0 ? plannerTopErrors : [plannerValidationError]).map((message) => (
                    <Typography key={message} variant="body2">{message}</Typography>
                  ))}
                </Stack>
              </Alert>
            )}
            {!plannerResult && !plannerValidationError && plannerTopErrors.length === 0 && (
              <Alert severity="info" sx={{ mb: 1.5 }}>
                Enter business values to calculate a suggested allocation.
              </Alert>
            )}
            {plannerNoRemainingLiveCapacity && (
              <Alert severity="error" sx={{ mb: 1.5 }}>
                No remaining live auction capacity is available. Increase Section C capacity or reduce/remove another organisation allocation.
              </Alert>
            )}
            {plannerHasFullMetric && (
              <Alert severity="warning" sx={{ mb: 1.5 }}>
                You are using 100% of platform capacity for this metric. No further allocation will be possible.
              </Alert>
            )}
            {plannerResult?.warnings?.map((warning) => (
              <Alert key={warning} severity="warning" sx={{ mb: 1.5 }}>
                {warning}
              </Alert>
            ))}
            {plannerResult && (
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                  Planner Result Summary
                </Typography>
                {plannerResultStatus ? (
                  <Alert severity={plannerResultStatus.severity} sx={{ mb: 1.25 }}>
                    <Typography variant="body2">{plannerResultStatus.text}</Typography>
                  </Alert>
                ) : null}
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                  Business Demand Estimate
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(180px, 1fr))" }, gap: 1.25, mb: 1.25 }}>
                  <MetricCard label="Required live auctions" value={plannerResult.raw_suggested_live_lanes} help="Raw business demand before platform limits." />
                  <MetricCard label="Required open auctions" value={plannerResult.raw_suggested_open_lanes} help="Raw business demand before platform limits." />
                  <MetricCard label="Required queued lots" value={plannerResult.raw_suggested_queued_lots} help="Raw business demand before platform limits." />
                  <MetricCard label="Required concurrent bidders" value={plannerResult.raw_suggested_concurrent_bidders} help="Raw business demand before platform limits." />
                </Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                  Final Allocation Applied Now
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(180px, 1fr))" }, gap: 1.25, mb: 1 }}>
                  <MetricCard label="Applied live auctions" value={plannerResult.suggested_live_lanes} help="Final allocation that can be applied now." />
                  <MetricCard label="Applied open auctions" value={plannerResult.suggested_open_lanes} help="Final allocation that can be applied now." />
                  <MetricCard label="Applied queued lots" value={plannerResult.suggested_queued_lots} help="Final allocation that can be applied now." />
                  <MetricCard label="Applied concurrent bidders" value={plannerResult.suggested_concurrent_bidders} help="Final allocation that can be applied now." />
                  <MetricCard label="Allocation tier" value={plannerResult.suggested_tier_code || "N/A"} help="Final tier code for Section F apply." />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1.25 }}>
                  Remaining after apply is calculated as: available before apply - planner allocation to apply.
                </Typography>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                  Physical Resource Fit Check
                </Typography>
                <Box sx={{ p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1.25, mb: 1.25 }}>
                  {plannerPhysicalFitRows.map((row) => (
                    <Stack key={row.label} direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" sx={{ py: 0.5 }}>
                      <Typography variant="body2" sx={{ minWidth: 180 }}>{row.label}</Typography>
                      <Typography variant="body2">Required: {row.required} {row.unit}</Typography>
                      <Typography variant="body2">Current Section A: {row.current} {row.unit}</Typography>
                      <Chip size="small" color={row.ok ? "success" : "warning"} label={row.ok ? "OK" : "Needs upgrade"} />
                    </Stack>
                  ))}
                </Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                  Safe Capacity Fit Check
                </Typography>
                <Box sx={{ p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1.25, mb: 1.25 }}>
                  {plannerSafeCapacityRows.map((row) => (
                    <Stack key={row.label} direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" sx={{ py: 0.5 }}>
                      <Typography variant="body2" sx={{ minWidth: 180 }}>{row.label}</Typography>
                      <Typography variant="body2">Planner requirement: {row.required}</Typography>
                      <Typography variant="body2">Section B safe capacity: {row.safe}</Typography>
                      <Chip size="small" color={row.ok ? "success" : "error"} label={row.ok ? "OK" : "Not enough"} />
                    </Stack>
                  ))}
                </Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                  Platform Allocation Fit Check
                </Typography>
                <Box sx={{ p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1.25 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                    Available before apply | Planner allocation to apply | Remaining after apply | Status
                  </Typography>
                  {plannerPlatformFitRows.map((row) => (
                    <Stack key={row.label} direction={{ xs: "column", md: "row" }} spacing={1} justifyContent="space-between" sx={{ py: 0.5 }}>
                      <Typography variant="body2" sx={{ minWidth: 180 }}>{row.label}</Typography>
                      <Typography variant="body2">Available before apply: {row.availableBeforeApply}</Typography>
                      <Typography variant="body2">Planner allocation to apply: {row.plannerAllocationToApply}</Typography>
                      <Typography variant="body2">Remaining after apply: {row.remainingAfterApply}</Typography>
                      <Chip
                        size="small"
                        color={
                          row.status === "OK"
                            ? "success"
                            : row.status === "FULL" || row.status === "REDUCED"
                              ? "warning"
                              : "error"
                        }
                        label={
                          row.status === "OK"
                            ? "OK"
                            : row.status === "FULL"
                              ? "FULL"
                              : row.status === "REDUCED"
                                ? "REDUCED"
                                : "ERROR"
                        }
                      />
                    </Stack>
                  ))}
                </Box>
              </Paper>
            )}
            {plannerResult && plannerPhysicalResources && (
              <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Estimated Physical Resources Required
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  These are advisory server requirements based on the business inputs. They do not change Section A automatically.
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3, minmax(180px, 1fr))" }, gap: 1.25 }}>
                  <MetricCard label="Required App Server RAM (GB)" value={plannerPhysicalResources.required_app_server_ram_gb} help="Advisory estimate." />
                  <MetricCard label="Required App Server vCPU" value={plannerPhysicalResources.required_app_server_vcpu} help="Advisory estimate." />
                  <MetricCard label="Required DB Server RAM (GB)" value={plannerPhysicalResources.required_db_server_ram_gb} help="Advisory estimate." />
                  <MetricCard label="Required DB Server vCPU" value={plannerPhysicalResources.required_db_server_vcpu} help="Advisory estimate." />
                  <MetricCard label="Required Web Server RAM (GB)" value={plannerPhysicalResources.required_web_server_ram_gb} help="Advisory estimate." />
                  <MetricCard label="Required Web Server vCPU" value={plannerPhysicalResources.required_web_server_vcpu} help="Advisory estimate." />
                  <MetricCard label="Recommended OS Reserve %" value={plannerPhysicalResources.recommended_os_reserve_percent} help="Planning reserve." />
                  <MetricCard label="Recommended System Reserve %" value={plannerPhysicalResources.recommended_system_reserve_percent} help="Planning reserve." />
                  <MetricCard label="Recommended Web/Admin Reserve %" value={plannerPhysicalResources.recommended_web_admin_reserve_percent} help="Planning reserve." />
                </Box>
                <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.25, mt: 1.25 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.25 }}>
                    Resource Impact Breakdown
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                    This explains why the planner recommends the RAM and CPU values below.
                  </Typography>
                  <Stack spacing={0.75} sx={{ mb: 1.25 }}>
                    <Typography variant="body2">App Server RAM: Calculated from the strongest of live lanes, open lanes, and bidder load, then adjusted for reserves and rounded up.</Typography>
                    <Typography variant="body2">DB Server RAM: Calculated from the stronger of queued lots and bidder persistence load, then adjusted for reserves and rounded up.</Typography>
                    <Typography variant="body2">Web Server RAM: Base web/admin footprint plus user load, then adjusted for reserves and rounded up.</Typography>
                  </Stack>
                  <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(280px, 1fr))" }, gap: 1 }}>
                    <Paper variant="outlined" sx={{ p: 1 }}>
                      <Typography variant="subtitle2">App Server RAM breakdown</Typography>
                      <Typography variant="body2">Base app memory: {plannerPhysicalResources.breakdown.app_ram.base.toFixed(2)} GB</Typography>
                      <Typography variant="body2">Live auction impact: {plannerPhysicalResources.breakdown.app_ram.live.toFixed(2)} GB</Typography>
                      <Typography variant="body2">Open auction impact: {plannerPhysicalResources.breakdown.app_ram.open.toFixed(2)} GB</Typography>
                      <Typography variant="body2">Bidder impact: {plannerPhysicalResources.breakdown.app_ram.bidder.toFixed(2)} GB</Typography>
                      <Typography variant="body2">Driving requirement before reserve: {plannerPhysicalResources.breakdown.app_ram.selected.toFixed(2)} GB</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>Estimated: {plannerPhysicalResources.breakdown.app_ram.estimated.toFixed(2)} GB {"\u2192"} Recommended: {plannerPhysicalResources.breakdown.app_ram.recommended.toFixed(1)} GB</Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1 }}>
                      <Typography variant="subtitle2">App Server vCPU breakdown</Typography>
                      <Typography variant="body2">Base app CPU: {plannerPhysicalResources.breakdown.app_cpu.base.toFixed(2)} vCPU</Typography>
                      <Typography variant="body2">Live auction impact: {plannerPhysicalResources.breakdown.app_cpu.live.toFixed(2)} vCPU</Typography>
                      <Typography variant="body2">Open auction impact: {plannerPhysicalResources.breakdown.app_cpu.open.toFixed(2)} vCPU</Typography>
                      <Typography variant="body2">Bidder impact: {plannerPhysicalResources.breakdown.app_cpu.bidder.toFixed(2)} vCPU</Typography>
                      <Typography variant="body2">Driving requirement before reserve: {plannerPhysicalResources.breakdown.app_cpu.selected.toFixed(2)} vCPU</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>Estimated: {plannerPhysicalResources.breakdown.app_cpu.estimated.toFixed(2)} vCPU {"\u2192"} Recommended: {plannerPhysicalResources.breakdown.app_cpu.recommended.toFixed(0)} vCPU</Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1 }}>
                      <Typography variant="subtitle2">DB Server RAM breakdown</Typography>
                      <Typography variant="body2">Base DB memory: {plannerPhysicalResources.breakdown.db_ram.base.toFixed(2)} GB</Typography>
                      <Typography variant="body2">Queue impact: {plannerPhysicalResources.breakdown.db_ram.queue.toFixed(2)} GB</Typography>
                      <Typography variant="body2">Bidder persistence impact: {plannerPhysicalResources.breakdown.db_ram.bidder.toFixed(2)} GB</Typography>
                      <Typography variant="body2">Driving requirement before reserve: {plannerPhysicalResources.breakdown.db_ram.selected.toFixed(2)} GB</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>Estimated: {plannerPhysicalResources.breakdown.db_ram.estimated.toFixed(2)} GB {"\u2192"} Recommended: {plannerPhysicalResources.breakdown.db_ram.recommended.toFixed(1)} GB</Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1 }}>
                      <Typography variant="subtitle2">DB Server vCPU breakdown</Typography>
                      <Typography variant="body2">Base DB CPU: {plannerPhysicalResources.breakdown.db_cpu.base.toFixed(2)} vCPU</Typography>
                      <Typography variant="body2">Queue impact: {plannerPhysicalResources.breakdown.db_cpu.queue.toFixed(2)} vCPU</Typography>
                      <Typography variant="body2">Bidder persistence impact: {plannerPhysicalResources.breakdown.db_cpu.bidder.toFixed(2)} vCPU</Typography>
                      <Typography variant="body2">Driving requirement before reserve: {plannerPhysicalResources.breakdown.db_cpu.selected.toFixed(2)} vCPU</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>Estimated: {plannerPhysicalResources.breakdown.db_cpu.estimated.toFixed(2)} vCPU {"\u2192"} Recommended: {plannerPhysicalResources.breakdown.db_cpu.recommended.toFixed(0)} vCPU</Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1 }}>
                      <Typography variant="subtitle2">Web Server RAM breakdown</Typography>
                      <Typography variant="body2">Base web/admin memory: {plannerPhysicalResources.breakdown.web_ram.base.toFixed(2)} GB</Typography>
                      <Typography variant="body2">User count impact: {plannerPhysicalResources.breakdown.web_ram.users.toFixed(2)} GB</Typography>
                      <Typography variant="body2">Driving requirement before reserve: {plannerPhysicalResources.breakdown.web_ram.selected.toFixed(2)} GB</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>Estimated: {plannerPhysicalResources.breakdown.web_ram.estimated.toFixed(2)} GB {"\u2192"} Recommended: {plannerPhysicalResources.breakdown.web_ram.recommended.toFixed(1)} GB</Typography>
                    </Paper>
                    <Paper variant="outlined" sx={{ p: 1 }}>
                      <Typography variant="subtitle2">Web Server vCPU breakdown</Typography>
                      <Typography variant="body2">Base web/admin CPU: {plannerPhysicalResources.breakdown.web_cpu.base.toFixed(2)} vCPU</Typography>
                      <Typography variant="body2">User count impact: {plannerPhysicalResources.breakdown.web_cpu.users.toFixed(2)} vCPU</Typography>
                      <Typography variant="body2">Driving requirement before reserve: {plannerPhysicalResources.breakdown.web_cpu.selected.toFixed(2)} vCPU</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>Estimated: {plannerPhysicalResources.breakdown.web_cpu.estimated.toFixed(2)} vCPU {"\u2192"} Recommended: {plannerPhysicalResources.breakdown.web_cpu.recommended.toFixed(0)} vCPU</Typography>
                    </Paper>
                  </Box>
                </Paper>
                {plannerCapacityFromRecommendedInfra && (
                  <Paper variant="outlined" sx={{ p: 1.25, borderRadius: 1.25, mt: 1.25 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.75 }}>
                      Estimated capacity from recommended resources
                    </Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(180px, 1fr))" }, gap: 1.25 }}>
                      <MetricCard label="Estimated live lanes" value={plannerCapacityFromRecommendedInfra.final_safe_live_lanes} help="Derived by re-running Section B model on recommended infra." />
                      <MetricCard label="Estimated open lanes" value={plannerCapacityFromRecommendedInfra.final_safe_open_lanes} help="Derived by re-running Section B model on recommended infra." />
                      <MetricCard label="Estimated queued lots" value={plannerCapacityFromRecommendedInfra.final_safe_queued_lots} help="Derived by re-running Section B model on recommended infra." />
                      <MetricCard label="Estimated bidders" value={plannerCapacityFromRecommendedInfra.final_safe_concurrent_bidders} help="Derived by re-running Section B model on recommended infra." />
                    </Box>
                  </Paper>
                )}
                {plannerModelMismatch && (
                  <Alert severity="warning" sx={{ mt: 1.25 }}>
                    Planner resource estimate does not satisfy its own demand. Capacity model mismatch.
                  </Alert>
                )}
                <Alert severity="info" sx={{ mt: 1.25 }}>
                  Resource estimates are planning guidance. Final production sizing should be validated with real usage, monitoring, and load testing.
                </Alert>
              </Paper>
            )}
            {plannerApplyMessage && (
              <Alert severity="success" sx={{ mt: 1.5 }}>
                {plannerApplyMessage}
              </Alert>
            )}
            {plannerApplyError && (
              <Alert severity="error" sx={{ mt: 1.5 }}>
                {plannerApplyError}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => { setPlannerApplyMessage(null); setPlannerApplyError(null); setPlannerOpen(false); }}>Close</Button>
            <Button variant="outlined" onClick={handleCalculatePlanner} disabled={!canEditCapacityControl}>
              Calculate Capacity
            </Button>
            <Button variant="outlined" onClick={applyPlannerResourcesToSectionA} disabled={!canEditCapacityControl || !plannerResult || !plannerPhysicalResources}>
              Apply Resources to Section A
            </Button>
            <Button
              variant="contained"
              onClick={applyPlannerToSelectedOrg}
              disabled={
                !canEditCapacityControl
                || !planner.selected_org_id
                || !plannerResult
                || plannerHasErrorMetric
                || plannerNoRemainingLiveCapacity
                || !plannerFinalAllocationWithinAvailable
              }
            >
              Apply to Selected Organisation
            </Button>
          </DialogActions>
        </Dialog>
      </PageContainer>
    </StepUpGuard>
  );
};

export default SystemCapacityControlPage;
