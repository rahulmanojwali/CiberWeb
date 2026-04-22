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
  updateAuctionCapacityControl,
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
};

type DerivedSafeCapacity = {
  derived_safe_max_live_lanes: number;
  derived_safe_max_open_lanes: number;
  derived_safe_max_total_queued_lots: number;
  derived_safe_max_concurrent_bidders: number;
  derived_safe_max_socket_mobile_connections: number;
  derived_safe_max_bidders_per_lane: number;
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

const TIER_PRESET_FALLBACK: TierPreset[] = [
  {
    tier_code: "STARTER",
    max_live_sessions: 1,
    max_open_sessions: 2,
    max_total_queued_lots: 25,
    max_concurrent_bidders: 50,
    allow_overflow_lanes: false,
    allow_special_event_lanes: false,
    reserved_capacity_enabled: false,
  },
  {
    tier_code: "STANDARD",
    max_live_sessions: 2,
    max_open_sessions: 4,
    max_total_queued_lots: 60,
    max_concurrent_bidders: 120,
    allow_overflow_lanes: false,
    allow_special_event_lanes: false,
    reserved_capacity_enabled: false,
  },
  {
    tier_code: "PREMIUM",
    max_live_sessions: 3,
    max_open_sessions: 6,
    max_total_queued_lots: 100,
    max_concurrent_bidders: 200,
    allow_overflow_lanes: true,
    allow_special_event_lanes: false,
    reserved_capacity_enabled: false,
  },
  {
    tier_code: "ENTERPRISE",
    max_live_sessions: 6,
    max_open_sessions: 12,
    max_total_queued_lots: 250,
    max_concurrent_bidders: 500,
    allow_overflow_lanes: true,
    allow_special_event_lanes: true,
    reserved_capacity_enabled: true,
  },
  {
    tier_code: "DEDICATED",
    max_live_sessions: 10,
    max_open_sessions: 20,
    max_total_queued_lots: 500,
    max_concurrent_bidders: 1000,
    allow_overflow_lanes: true,
    allow_special_event_lanes: true,
    reserved_capacity_enabled: true,
  },
];

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

const headerHelpIconSx = {
  ml: 0.5,
  fontSize: 16,
  verticalAlign: "middle",
  color: "text.secondary",
};

const HeaderWithTooltip: React.FC<{ label: string; help: string }> = ({ label, help }) => (
  <Box component="span" sx={{ display: "inline-flex", alignItems: "center" }}>
    <span>{label}</span>
    <Tooltip title={help} arrow>
      <HelpOutlineIcon sx={headerHelpIconSx} />
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

const SystemCapacityControlPage: React.FC = () => {
  const username = useMemo(() => currentUsername(), []);
  const { can } = usePermissions();
  const canViewCapacityControl = can("capacity_control.view", "VIEW");
  const canEditCapacityControl = can("capacity_control.edit", "UPDATE");
  const [loading, setLoading] = useState(false);
  const [savingSystem, setSavingSystem] = useState(false);
  const [savingOrgId, setSavingOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    deployment_profile_name: "",
    auction_capacity: {},
    infra_profile: {},
  });
  const [platformUsage, setPlatformUsage] = useState<any>(null);
  const [derivedSafeCapacity, setDerivedSafeCapacity] = useState<DerivedSafeCapacity | null>(null);
  const [remainingPool, setRemainingPool] = useState<RemainingAllocatablePool | null>(null);
  const [tierPresets, setTierPresets] = useState<TierPreset[]>(TIER_PRESET_FALLBACK);
  const [availableTiers, setAvailableTiers] = useState<string[]>(TIER_PRESET_FALLBACK.map((item) => item.tier_code));
  const [orgRows, setOrgRows] = useState<OrgAllocation[]>([]);

  const presetMap = useMemo(() => buildPresetMap(tierPresets), [tierPresets]);

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
      setPlatformUsage(data.platform_usage_summary || null);
      setDerivedSafeCapacity(data.derived_safe_capacity || null);
      setRemainingPool(data.remaining_allocatable_pool || null);
      setTierPresets(Array.isArray(data.tier_presets) && data.tier_presets.length ? data.tier_presets : TIER_PRESET_FALLBACK);
      setAvailableTiers(
        Array.isArray(data.available_tiers) && data.available_tiers.length
          ? data.available_tiers
          : (Array.isArray(data.tier_presets) && data.tier_presets.length
            ? data.tier_presets.map((preset: TierPreset) => preset.tier_code)
            : TIER_PRESET_FALLBACK.map((item) => item.tier_code))
      );
      setWarnings(Array.isArray(data.warnings) ? data.warnings.filter(Boolean) : []);
      setOrgRows(Array.isArray(data.org_allocations) ? data.org_allocations : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load system capacity control.");
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
  };

  const updateOrgRow = (orgId: string, patch: Partial<OrgAllocation>) => {
    setOrgRows((prev) => prev.map((row) => (row.org_id === orgId ? { ...row, ...patch } : row)));
  };

  const handleTierChange = (orgId: string, tierCode: string) => {
    const normalizedTier = String(tierCode || "").trim().toUpperCase();
    const preset = presetMap[normalizedTier] || null;
    setOrgRows((prev) => prev.map((row) => {
      if (row.org_id !== orgId) return row;
      if (!preset) return { ...row, tier_code: normalizedTier || null };
      return applyPreset(row, preset);
    }));
  };

  const handleSaveSystem = async () => {
    if (!username) return;
    setSavingSystem(true);
    setError(null);
    setSuccess(null);
    try {
      const resp: any = await updateAuctionCapacityControl({
        username,
        payload: {
          deployment_profile_name: systemConfig.deployment_profile_name,
          auction_capacity: systemConfig.auction_capacity,
          infra_profile: systemConfig.infra_profile,
        },
      });
      if (String(resp?.response?.responsecode || "") !== "0") {
        setError(resp?.response?.description || "Failed to save platform capacity.");
        return;
      }
      setSuccess(resp?.response?.description || "Platform auction capacity saved successfully.");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to save platform capacity.");
    } finally {
      setSavingSystem(false);
    }
  };

  const handleSaveOrg = async (row: OrgAllocation) => {
    if (!username) return;
    setSavingOrgId(row.org_id);
    setError(null);
    setSuccess(null);
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
        setError(resp?.response?.description || "Failed to save organisation allocation.");
        setRemainingPool(resp?.data?.remaining_allocatable_pool || remainingPool);
        return;
      }
      setSuccess(resp?.response?.description || "Organisation auction capacity allocation saved successfully.");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to save organisation allocation.");
    } finally {
      setSavingOrgId(null);
    }
  };

  const systemTotalsWarning = platformUsage?.allocation_warning || null;
  const showDerivedCapacityWarning = warnings.length > 0;

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
              Configure platform auction ceilings, allocate org quotas, and monitor current shared capacity usage.
            </Typography>
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading || savingSystem || !!savingOrgId}>
              Refresh
            </Button>
            <Button variant="contained" onClick={handleSaveSystem} disabled={!canEditCapacityControl || savingSystem || loading}>
              {savingSystem ? "Saving..." : "Save Platform Capacity"}
            </Button>
          </Stack>
        </Stack>

        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}
        {systemTotalsWarning && <Alert severity="warning" sx={{ mb: 2 }}>{systemTotalsWarning}</Alert>}
        {!canEditCapacityControl && (
          <Alert severity="info" sx={{ mb: 2 }}>
            You do not have permission to edit Capacity Control.
          </Alert>
        )}
        {showDerivedCapacityWarning && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>
              Configured platform values exceed infra-derived safe capacity.
            </Typography>
            {warnings.map((warning, idx) => (
              <Typography key={`${warning}-${idx}`} variant="body2">{warning}</Typography>
            ))}
          </Alert>
        )}

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Section A — Platform Capacity Profile
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(220px, 1fr))" }, gap: 1.5 }}>
            <TextField label="Deployment / Profile Name" helperText="Friendly name of the current platform capacity profile." value={systemConfig.deployment_profile_name || ""} onChange={(e) => setSystemConfig((prev) => ({ ...prev, deployment_profile_name: e.target.value }))} fullWidth disabled={!canEditCapacityControl} />
            <TextField select label="Guard Enabled" helperText="Turns backend capacity enforcement on or off." value={systemConfig.auction_capacity?.guard_enabled ? "true" : "false"} onChange={(e) => setAuctionField("guard_enabled", e.target.value === "true")} fullWidth disabled={!canEditCapacityControl}>
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </TextField>
            <TextField label="Max Total Live Lanes" helperText="Maximum number of auction lanes that can be live across the platform." type="number" value={num(systemConfig.auction_capacity?.max_total_live_lanes)} onChange={(e) => setAuctionField("max_total_live_lanes", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Max Total Open Lanes" helperText="Maximum number of lanes that can exist in open, planned, or live state across the platform." type="number" value={num(systemConfig.auction_capacity?.max_total_open_lanes)} onChange={(e) => setAuctionField("max_total_open_lanes", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Max Total Queued Lots" helperText="Maximum number of queued lots allowed across all lanes." type="number" value={num(systemConfig.auction_capacity?.max_total_queued_lots)} onChange={(e) => setAuctionField("max_total_queued_lots", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Max Total Concurrent Bidders" helperText="Maximum simultaneous bidder participation the platform should support." type="number" value={num(systemConfig.auction_capacity?.max_total_concurrent_bidders)} onChange={(e) => setAuctionField("max_total_concurrent_bidders", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="CPU Warning Threshold %" helperText="Warning threshold for CPU usage before the platform should be treated as stressed." type="number" value={num(systemConfig.auction_capacity?.cpu_warning_threshold_percent)} onChange={(e) => setAuctionField("cpu_warning_threshold_percent", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Memory Warning Threshold %" helperText="Warning threshold for memory usage before the platform should be treated as stressed." type="number" value={num(systemConfig.auction_capacity?.memory_warning_threshold_percent)} onChange={(e) => setAuctionField("memory_warning_threshold_percent", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Default Org Max Live Lanes" helperText="Default live-lane quota assigned to a new org if no custom allocation is set." type="number" value={num(systemConfig.auction_capacity?.default_org_max_live_lanes)} onChange={(e) => setAuctionField("default_org_max_live_lanes", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Default Org Max Open Lanes" helperText="Default open-lane quota assigned to a new org." type="number" value={num(systemConfig.auction_capacity?.default_org_max_open_lanes)} onChange={(e) => setAuctionField("default_org_max_open_lanes", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Default Org Max Total Queued Lots" helperText="Default total queued-lot quota assigned to a new org." type="number" value={num(systemConfig.auction_capacity?.default_org_max_total_queued_lots)} onChange={(e) => setAuctionField("default_org_max_total_queued_lots", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Default Org Max Concurrent Bidders" helperText="Default concurrent bidder quota assigned to a new org." type="number" value={num(systemConfig.auction_capacity?.default_org_max_concurrent_bidders)} onChange={(e) => setAuctionField("default_org_max_concurrent_bidders", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Default Mandi Max Live Lanes" helperText="Default mandi live-lane limit when mandi override is not set." type="number" value={num(systemConfig.auction_capacity?.default_mandi_max_live_lanes)} onChange={(e) => setAuctionField("default_mandi_max_live_lanes", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Default Mandi Max Open Lanes" helperText="Default mandi open-lane limit when mandi override is not set." type="number" value={num(systemConfig.auction_capacity?.default_mandi_max_open_lanes)} onChange={(e) => setAuctionField("default_mandi_max_open_lanes", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Default Mandi Max Queue Per Lane" helperText="Default number of queued lots allowed in one mandi lane." type="number" value={num(systemConfig.auction_capacity?.default_mandi_max_queue_per_lane)} onChange={(e) => setAuctionField("default_mandi_max_queue_per_lane", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Default Mandi Max Total Queued Lots" helperText="Default total queued lots allowed for one mandi." type="number" value={num(systemConfig.auction_capacity?.default_mandi_max_total_queued_lots)} onChange={(e) => setAuctionField("default_mandi_max_total_queued_lots", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Derived Safe Capacity
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(180px, 1fr))" }, gap: 1.25 }}>
            <MetricCard label="Safe Live Lanes" value={derivedSafeCapacity?.derived_safe_max_live_lanes ?? 0} help="Infra-derived safe live-lane ceiling after applying reserve and bottleneck checks." />
            <MetricCard label="Safe Open Lanes" value={derivedSafeCapacity?.derived_safe_max_open_lanes ?? 0} help="Infra-derived safe open-lane ceiling." />
            <MetricCard label="Safe Queued Lots" value={derivedSafeCapacity?.derived_safe_max_total_queued_lots ?? 0} help="Infra-derived safe queued-lot ceiling." />
            <MetricCard label="Safe Concurrent Bidders" value={derivedSafeCapacity?.derived_safe_max_concurrent_bidders ?? 0} help="Infra-derived safe bidder concurrency ceiling." />
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Section B — Current Platform Usage
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(180px, 1fr))" }, gap: 1.25 }}>
            <MetricCard label="Current Live Lanes" value={platformUsage?.current_live_lanes ?? 0} help="Number of lanes currently running live." />
            <MetricCard label="Current Open Lanes" value={platformUsage?.current_open_lanes ?? 0} help="Number of planned, open, or live lanes currently present." />
            <MetricCard label="Current Queued Lots" value={platformUsage?.current_queued_lots ?? 0} help="Number of lots currently waiting in lane queues." />
            <MetricCard label="Remaining Live Capacity" value={platformUsage?.remaining_live_capacity ?? 0} help="Platform live-lane balance still available against configured capacity." />
            <MetricCard label="Remaining Open Capacity" value={platformUsage?.remaining_open_capacity ?? 0} help="Platform open-lane balance still available against configured capacity." />
            <MetricCard label="Remaining Queue Capacity" value={platformUsage?.remaining_queue_capacity ?? 0} help="Platform queued-lot balance still available against configured capacity." />
            <MetricCard label="Guard State" value={platformUsage?.guard_state || "GREEN"} help="Health status based on configured capacity thresholds." />
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Section C — Optional Infra Profile Metadata
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(220px, 1fr))" }, gap: 1.5 }}>
            <TextField label="Cloud Provider / Deployment Type" helperText="Hosting provider or infra label, for example OCI, AWS, or On-Prem." placeholder="OCI / AWS / On-Prem" value={systemConfig.infra_profile?.cloud_provider || systemConfig.infra_profile?.provider_name || ""} onChange={(e) => setInfraField("cloud_provider", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Deployment Type" helperText="Shared, Dedicated, Hybrid, or another hosting arrangement." placeholder="Shared / Dedicated" value={systemConfig.infra_profile?.deployment_type || ""} onChange={(e) => setInfraField("deployment_type", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="App Server RAM (GB)" helperText="Application runtime memory capacity." type="number" value={num(systemConfig.infra_profile?.app_server_ram_gb)} onChange={(e) => setInfraField("app_server_ram_gb", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="App Server vCPU" helperText="Application runtime compute capacity." type="number" value={num(systemConfig.infra_profile?.app_server_vcpu)} onChange={(e) => setInfraField("app_server_vcpu", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="DB Server RAM (GB)" helperText="Database machine memory capacity." type="number" value={num(systemConfig.infra_profile?.db_server_ram_gb)} onChange={(e) => setInfraField("db_server_ram_gb", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="DB Server vCPU" helperText="Database machine compute capacity." type="number" value={num(systemConfig.infra_profile?.db_server_vcpu)} onChange={(e) => setInfraField("db_server_vcpu", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Web Server RAM (GB)" helperText="Web or admin frontend serving memory capacity." type="number" value={num(systemConfig.infra_profile?.web_server_ram_gb)} onChange={(e) => setInfraField("web_server_ram_gb", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Web Server vCPU" helperText="Web or admin frontend serving compute capacity." type="number" value={num(systemConfig.infra_profile?.web_server_vcpu)} onChange={(e) => setInfraField("web_server_vcpu", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Same Machine or Separate" helperText="Whether app, web, and database run on the same server or are split." placeholder="Same / Separate" value={systemConfig.infra_profile?.same_machine_or_separate || systemConfig.infra_profile?.same_machine || ""} onChange={(e) => setInfraField("same_machine_or_separate", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Notes" helperText="Any infra-specific operational notes." value={systemConfig.infra_profile?.notes || ""} onChange={(e) => setInfraField("notes", e.target.value)} multiline minRows={3} fullWidth sx={{ gridColumn: { md: "1 / -1" } }} disabled={!canEditCapacityControl} />
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Remaining Allocatable Capacity
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(180px, 1fr))" }, gap: 1.25 }}>
            <MetricCard label="Remaining Live" value={remainingPool?.remaining_allocatable_live ?? 0} help="Remaining platform live allocation available for org assignment." />
            <MetricCard label="Remaining Open" value={remainingPool?.remaining_allocatable_open ?? 0} help="Remaining platform open allocation available for org assignment." />
            <MetricCard label="Remaining Queued" value={remainingPool?.remaining_allocatable_queued ?? 0} help="Remaining platform queued-lot allocation available for org assignment." />
            <MetricCard label="Remaining Bidders" value={remainingPool?.remaining_allocatable_bidders ?? 0} help="Remaining platform bidder allocation available for org assignment." />
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
            Org Allocation Management
          </Typography>
          <Alert severity="info" sx={{ mb: 2 }}>
            Org values cannot exceed platform limits. Effective mandi limits cascade below org allocation.
          </Alert>
          <Alert severity="info" sx={{ mb: 2 }}>
            Tier values are auto-applied based on selection.
          </Alert>
          <Box sx={{ overflowX: "auto" }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Org Name</TableCell>
                  <TableCell><HeaderWithTooltip label="Tier" help="Optional service or allocation profile for the org." /></TableCell>
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
                {orgRows.map((row) => (
                  <TableRow key={row.org_id}>
                    <TableCell>
                      <Stack spacing={0.25}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{row.org_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.org_code || "—"}</Typography>
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <TextField
                        select
                        size="small"
                        value={row.tier_code || ""}
                        onChange={(e) => handleTierChange(row.org_id, e.target.value)}
                        sx={{ minWidth: 120 }}
                        disabled={!canEditCapacityControl}
                      >
                        <MenuItem value="">Custom</MenuItem>
                        {availableTiers.map((tierCode) => <MenuItem key={tierCode} value={tierCode}>{tierCode}</MenuItem>)}
                      </TextField>
                    </TableCell>
                    <TableCell>
                      <Typography variant="caption" display="block">Live {row.current_live_lanes}</Typography>
                      <Typography variant="caption" display="block">Open {row.current_open_lanes}</Typography>
                      <Typography variant="caption" display="block">Queued {row.current_queued_lots}</Typography>
                    </TableCell>
                    <TableCell><TextField size="small" type="number" value={num(row.allocated_max_live_lanes)} onChange={(e) => updateOrgRow(row.org_id, { allocated_max_live_lanes: Number(e.target.value) || null })} sx={{ width: 110 }} disabled={!canEditCapacityControl || Boolean(row.tier_code)} /></TableCell>
                    <TableCell><TextField size="small" type="number" value={num(row.allocated_max_open_lanes)} onChange={(e) => updateOrgRow(row.org_id, { allocated_max_open_lanes: Number(e.target.value) || null })} sx={{ width: 110 }} disabled={!canEditCapacityControl || Boolean(row.tier_code)} /></TableCell>
                    <TableCell><TextField size="small" type="number" value={num(row.allocated_max_queued_lots)} onChange={(e) => updateOrgRow(row.org_id, { allocated_max_queued_lots: Number(e.target.value) || null })} sx={{ width: 120 }} disabled={!canEditCapacityControl || Boolean(row.tier_code)} /></TableCell>
                    <TableCell><TextField size="small" type="number" value={num(row.allocated_max_concurrent_bidders)} onChange={(e) => updateOrgRow(row.org_id, { allocated_max_concurrent_bidders: Number(e.target.value) || null })} sx={{ width: 120 }} disabled={!canEditCapacityControl || Boolean(row.tier_code)} /></TableCell>
                    <TableCell><Switch checked={Boolean(row.overflow_allowed)} onChange={(e) => updateOrgRow(row.org_id, { overflow_allowed: e.target.checked })} disabled={!canEditCapacityControl || Boolean(row.tier_code)} /></TableCell>
                    <TableCell><Switch checked={Boolean(row.special_event_allowed)} onChange={(e) => updateOrgRow(row.org_id, { special_event_allowed: e.target.checked })} disabled={!canEditCapacityControl || Boolean(row.tier_code)} /></TableCell>
                    <TableCell><TextField size="small" type="number" value={num(row.priority_weight)} onChange={(e) => updateOrgRow(row.org_id, { priority_weight: Number(e.target.value) || null })} sx={{ width: 100 }} disabled={!canEditCapacityControl} /></TableCell>
                    <TableCell><Switch checked={Boolean(row.reserved_capacity_enabled)} onChange={(e) => updateOrgRow(row.org_id, { reserved_capacity_enabled: e.target.checked })} disabled={!canEditCapacityControl} /></TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={Number(row.usage_percent || 0) >= 100 ? "error" : Number(row.usage_percent || 0) >= 80 ? "warning" : "success"}
                        label={`${Number(row.usage_percent || 0).toFixed(0)}%`}
                      />
                    </TableCell>
                    <TableCell align="right">
                      <Button size="small" variant="contained" onClick={() => handleSaveOrg(row)} disabled={!canEditCapacityControl || savingOrgId === row.org_id}>
                        {savingOrgId === row.org_id ? "Saving..." : "Save"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        </Paper>
      </PageContainer>
    </StepUpGuard>
  );
};

export default SystemCapacityControlPage;
