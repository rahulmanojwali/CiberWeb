import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
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

  const presetMap = useMemo(() => buildPresetMap(tierPresets), [tierPresets]);
  const infraFormReady = useMemo(() => isInfraFormReady(systemConfig.infra_profile || {}), [systemConfig.infra_profile]);
  const safeMaxLive = Number(derivedSafeCapacity?.final_safe_max_live_lanes ?? derivedSafeCapacity?.derived_safe_max_live_lanes ?? 0);
  const safeMaxOpen = Number(derivedSafeCapacity?.final_safe_max_open_lanes ?? derivedSafeCapacity?.derived_safe_max_open_lanes ?? 0);
  const safeMaxQueued = Number(derivedSafeCapacity?.final_safe_max_total_queued_lots ?? derivedSafeCapacity?.derived_safe_max_total_queued_lots ?? 0);
  const safeMaxBidders = Number(derivedSafeCapacity?.final_safe_max_concurrent_bidders ?? derivedSafeCapacity?.derived_safe_max_concurrent_bidders ?? 0);

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

  const setAuctionField = (key: string, value: any) => {
    setSystemConfig((prev) => ({
      ...prev,
      auction_capacity: {
        ...(prev.auction_capacity || {}),
        [key]: value,
      },
    }));
  };

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

  const updateOrgRow = (orgId: string, patch: Partial<OrgAllocation>) => {
    setOrgRows((prev) => prev.map((row) => (row.org_id === orgId ? { ...row, ...patch } : row)));
  };

  const handleTierChange = (orgId: string, tierCode: string) => {
    const normalizedTier = String(tierCode || "").trim().toUpperCase();
    const preset = presetMap[normalizedTier] || null;
    setOrgRows((prev) => prev.map((row) => {
      if (row.org_id !== orgId) return row;
      if (!normalizedTier) {
        return { ...row, tier_code: null };
      }
      return applyPreset(row, preset || { tier_code: normalizedTier } as TierPreset);
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
          {platformSectionDisabled && (
            <Alert severity="info" sx={{ mb: 1.5 }}>
              Complete and save Section A to continue.
            </Alert>
          )}
          {platformSaveError && <Alert severity="error" sx={{ mb: 1.5 }}>{platformSaveError}</Alert>}
          {platformSaveSuccess && <Alert severity="success" sx={{ mb: 1.5 }}>{platformSaveSuccess}</Alert>}
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
          <Alert severity="info" sx={{ mb: 2 }}>
            Org values cannot exceed platform limits. Effective mandi limits cascade below org allocation.
          </Alert>
          <Alert severity="info" sx={{ mb: 2 }}>
            Tier values are auto-applied based on selection.
          </Alert>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.5 }}>
            <Button variant="contained" onClick={handleSaveAllOrg} disabled={orgSectionDisabled || savingOrgId === "__ALL__" || hasInvalidOrgRows}>
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
                            <MenuItem value="">Custom</MenuItem>
                            {availableTiers.map((tierCode) => <MenuItem key={tierCode} value={tierCode}>{tierCode}</MenuItem>)}
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
                      <TableCell><TextField size="small" type="number" value={num(row.allocated_max_live_lanes)} onChange={(e) => updateOrgRow(row.org_id, { allocated_max_live_lanes: Number(e.target.value) || null })} sx={{ width: 110 }} disabled={orgSectionDisabled || tierSelected} /></TableCell>
                      <TableCell><TextField size="small" type="number" value={num(row.allocated_max_open_lanes)} onChange={(e) => updateOrgRow(row.org_id, { allocated_max_open_lanes: Number(e.target.value) || null })} sx={{ width: 110 }} disabled={orgSectionDisabled || tierSelected} /></TableCell>
                      <TableCell><TextField size="small" type="number" value={num(row.allocated_max_queued_lots)} onChange={(e) => updateOrgRow(row.org_id, { allocated_max_queued_lots: Number(e.target.value) || null })} sx={{ width: 120 }} disabled={orgSectionDisabled || tierSelected} /></TableCell>
                      <TableCell><TextField size="small" type="number" value={num(row.allocated_max_concurrent_bidders)} onChange={(e) => updateOrgRow(row.org_id, { allocated_max_concurrent_bidders: Number(e.target.value) || null })} sx={{ width: 120 }} disabled={orgSectionDisabled || tierSelected} /></TableCell>
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
                        <Button size="small" variant="outlined" onClick={() => handleSaveOrg(row)} disabled={orgSectionDisabled || savingOrgId === row.org_id || savingOrgId === "__ALL__" || Boolean(row.allocation_invalid)}>
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
      </PageContainer>
    </StepUpGuard>
  );
};

export default SystemCapacityControlPage;
