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
  const sameMachine = String(
    infraProfile?.same_machine_or_separate || infraProfile?.same_machine || "",
  ).trim();
  return required.every((value) => Number(value) > 0) && Boolean(sameMachine);
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
      setOrgAllocationAllowed(Boolean(data.org_allocation_allowed));
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
      const resp: any = await updateAuctionCapacityControl({
        username,
        payload: {
          deployment_profile_name: systemConfig.deployment_profile_name,
          auction_capacity: systemConfig.auction_capacity,
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
    setSavingSystem(true);
    setPlatformSaveError(null);
    setPlatformSaveSuccess(null);
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
  const sectionAReadyToContinue = infraFormReady && !infraDirty;
  const platformSectionDisabled = !canEditCapacityControl || !sectionAReadyToContinue;
  const orgSectionDisabled = !canEditCapacityControl || !orgAllocationAllowed || !sectionAReadyToContinue;
  const usageSectionsLocked = !sectionAReadyToContinue;
  const isHealthBlockedByInfra = !derivedSafeCapacity?.infra_ready
    && Number(derivedSafeCapacity?.derived_safe_max_live_lanes || 0) === 0;
  const platformValid = (
    Number(systemConfig?.auction_capacity?.max_total_live_lanes || 0) <= Number(derivedSafeCapacity?.final_safe_max_live_lanes ?? derivedSafeCapacity?.derived_safe_max_live_lanes ?? 0)
    && Number(systemConfig?.auction_capacity?.max_total_open_lanes || 0) <= Number(derivedSafeCapacity?.final_safe_max_open_lanes ?? derivedSafeCapacity?.derived_safe_max_open_lanes ?? 0)
    && Number(systemConfig?.auction_capacity?.max_total_queued_lots || 0) <= Number(derivedSafeCapacity?.final_safe_max_total_queued_lots ?? derivedSafeCapacity?.derived_safe_max_total_queued_lots ?? 0)
    && Number(systemConfig?.auction_capacity?.max_total_concurrent_bidders || 0) <= Number(derivedSafeCapacity?.final_safe_max_concurrent_bidders ?? derivedSafeCapacity?.derived_safe_max_concurrent_bidders ?? 0)
  );
  const allocationValid = (
    Number(remainingPool?.remaining_allocatable_live ?? 0) >= 0
    && Number(remainingPool?.remaining_allocatable_open ?? 0) >= 0
    && Number(remainingPool?.remaining_allocatable_queued ?? 0) >= 0
    && Number(remainingPool?.remaining_allocatable_bidders ?? 0) >= 0
  );

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
            <Typography variant="caption">Infra Ready: {infraFormReady ? "Yes" : "No"}</Typography>
            <Typography variant="caption">Derived Capacity: {infraDirty ? "Stale" : "Fresh"}</Typography>
            <Typography variant="caption">Platform Valid: {platformValid ? "Yes" : "No"}</Typography>
            <Typography variant="caption">Allocation Valid: {allocationValid ? "Yes" : "No"}</Typography>
          </Stack>
        </Paper>
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
            <TextField label="Cloud Provider / Deployment Type" helperText="Hosting provider or infra label, for example OCI, AWS, or On-Prem." placeholder="OCI / AWS / On-Prem" value={systemConfig.infra_profile?.cloud_provider || systemConfig.infra_profile?.provider_name || ""} onChange={(e) => setInfraField("cloud_provider", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Deployment Type" helperText="Shared, Dedicated, Hybrid, or another hosting arrangement." placeholder="Shared / Dedicated" value={systemConfig.infra_profile?.deployment_type || ""} onChange={(e) => setInfraField("deployment_type", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Same Machine or Separate" helperText="Whether app, web, and database run on the same server or are split." placeholder="Same / Separate" value={systemConfig.infra_profile?.same_machine_or_separate || systemConfig.infra_profile?.same_machine || ""} onChange={(e) => setInfraField("same_machine_or_separate", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="App Server RAM (GB)" helperText="Required physical memory for the application tier." type="number" value={num(systemConfig.infra_profile?.app_server_ram_gb)} onChange={(e) => setInfraField("app_server_ram_gb", e.target.value)} fullWidth disabled={!canEditCapacityControl} required />
            <TextField label="App Server vCPU" helperText="Required compute capacity for the application tier." type="number" value={num(systemConfig.infra_profile?.app_server_vcpu)} onChange={(e) => setInfraField("app_server_vcpu", e.target.value)} fullWidth disabled={!canEditCapacityControl} required />
            <TextField label="DB Server RAM (GB)" helperText="Required memory capacity for the database tier." type="number" value={num(systemConfig.infra_profile?.db_server_ram_gb)} onChange={(e) => setInfraField("db_server_ram_gb", e.target.value)} fullWidth disabled={!canEditCapacityControl} required />
            <TextField label="DB Server vCPU" helperText="Required compute capacity for the database tier." type="number" value={num(systemConfig.infra_profile?.db_server_vcpu)} onChange={(e) => setInfraField("db_server_vcpu", e.target.value)} fullWidth disabled={!canEditCapacityControl} required />
            <TextField label="Web Server RAM (GB)" helperText="Required memory for web and admin delivery." type="number" value={num(systemConfig.infra_profile?.web_server_ram_gb)} onChange={(e) => setInfraField("web_server_ram_gb", e.target.value)} fullWidth disabled={!canEditCapacityControl} required />
            <TextField label="Web Server vCPU" helperText="Required compute for web and admin delivery." type="number" value={num(systemConfig.infra_profile?.web_server_vcpu)} onChange={(e) => setInfraField("web_server_vcpu", e.target.value)} fullWidth disabled={!canEditCapacityControl} required />
            <TextField label="OS Reserve %" helperText="Capacity reserved for operating system overhead." type="number" value={num(systemConfig.infra_profile?.os_reserve_percent)} onChange={(e) => setInfraField("os_reserve_percent", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="System Reserve %" helperText="Additional platform reserve kept outside allocatable auction load." type="number" value={num(systemConfig.infra_profile?.system_reserve_percent)} onChange={(e) => setInfraField("system_reserve_percent", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Web/Admin Reserve %" helperText="Reserved capacity for admin and web traffic not directly tied to auction lanes." type="number" value={num(systemConfig.infra_profile?.web_admin_reserve_percent)} onChange={(e) => setInfraField("web_admin_reserve_percent", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="WebSocket Shared or Separate" helperText="Whether websocket load is shared with app servers or isolated." value={systemConfig.infra_profile?.websocket_shared_or_separate || "SHARED"} onChange={(e) => setInfraField("websocket_shared_or_separate", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
            <TextField label="Notes" helperText="Any infra-specific operational notes." value={systemConfig.infra_profile?.notes || ""} onChange={(e) => setInfraField("notes", e.target.value)} multiline minRows={3} fullWidth sx={{ gridColumn: { md: "1 / -1" } }} disabled={!canEditCapacityControl} />
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
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(220px, 1fr))" }, gap: 1.5 }}>
            <TextField label="Deployment / Profile Name" helperText="Friendly name of the current platform capacity profile." value={systemConfig.deployment_profile_name || ""} onChange={(e) => setSystemConfig((prev) => ({ ...prev, deployment_profile_name: e.target.value }))} fullWidth disabled={platformSectionDisabled} />
            <TextField select label="Guard Enabled" helperText="Turns backend capacity enforcement on or off." value={systemConfig.auction_capacity?.guard_enabled ? "true" : "false"} onChange={(e) => setAuctionField("guard_enabled", e.target.value === "true")} fullWidth disabled={platformSectionDisabled}>
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </TextField>
            <TextField label="Max Total Live Lanes" helperText="Maximum number of auction lanes that can be live across the platform." type="number" value={num(systemConfig.auction_capacity?.max_total_live_lanes)} onChange={(e) => setAuctionField("max_total_live_lanes", e.target.value)} fullWidth disabled={platformSectionDisabled} />
            <TextField label="Max Total Open Lanes" helperText="Maximum number of lanes that can exist in open, planned, or live state across the platform." type="number" value={num(systemConfig.auction_capacity?.max_total_open_lanes)} onChange={(e) => setAuctionField("max_total_open_lanes", e.target.value)} fullWidth disabled={platformSectionDisabled} />
            <TextField label="Max Total Queued Lots" helperText="Maximum number of queued lots allowed across all lanes." type="number" value={num(systemConfig.auction_capacity?.max_total_queued_lots)} onChange={(e) => setAuctionField("max_total_queued_lots", e.target.value)} fullWidth disabled={platformSectionDisabled} />
            <TextField label="Max Total Concurrent Bidders" helperText="Maximum simultaneous bidder participation the platform should support." type="number" value={num(systemConfig.auction_capacity?.max_total_concurrent_bidders)} onChange={(e) => setAuctionField("max_total_concurrent_bidders", e.target.value)} fullWidth disabled={platformSectionDisabled} />
            <TextField label="CPU Warning Threshold %" helperText="Warning threshold for CPU usage before the platform should be treated as stressed." type="number" value={num(systemConfig.auction_capacity?.cpu_warning_threshold_percent)} onChange={(e) => setAuctionField("cpu_warning_threshold_percent", e.target.value)} fullWidth disabled={platformSectionDisabled} />
            <TextField label="Memory Warning Threshold %" helperText="Warning threshold for memory usage before the platform should be treated as stressed." type="number" value={num(systemConfig.auction_capacity?.memory_warning_threshold_percent)} onChange={(e) => setAuctionField("memory_warning_threshold_percent", e.target.value)} fullWidth disabled={platformSectionDisabled} />
            <TextField label="Default Org Max Live Lanes" helperText="Default live-lane quota assigned to a new org if no custom allocation is set." type="number" value={num(systemConfig.auction_capacity?.default_org_max_live_lanes)} onChange={(e) => setAuctionField("default_org_max_live_lanes", e.target.value)} fullWidth disabled={platformSectionDisabled} />
            <TextField label="Default Org Max Open Lanes" helperText="Default open-lane quota assigned to a new org." type="number" value={num(systemConfig.auction_capacity?.default_org_max_open_lanes)} onChange={(e) => setAuctionField("default_org_max_open_lanes", e.target.value)} fullWidth disabled={platformSectionDisabled} />
            <TextField label="Default Org Max Total Queued Lots" helperText="Default total queued-lot quota assigned to a new org." type="number" value={num(systemConfig.auction_capacity?.default_org_max_total_queued_lots)} onChange={(e) => setAuctionField("default_org_max_total_queued_lots", e.target.value)} fullWidth disabled={platformSectionDisabled} />
            <TextField label="Default Org Max Concurrent Bidders" helperText="Default concurrent bidder quota assigned to a new org." type="number" value={num(systemConfig.auction_capacity?.default_org_max_concurrent_bidders)} onChange={(e) => setAuctionField("default_org_max_concurrent_bidders", e.target.value)} fullWidth disabled={platformSectionDisabled} />
            <TextField label="Default Mandi Max Live Lanes" helperText="Default mandi live-lane limit when mandi override is not set." type="number" value={num(systemConfig.auction_capacity?.default_mandi_max_live_lanes)} onChange={(e) => setAuctionField("default_mandi_max_live_lanes", e.target.value)} fullWidth disabled={platformSectionDisabled} />
            <TextField label="Default Mandi Max Open Lanes" helperText="Default mandi open-lane limit when mandi override is not set." type="number" value={num(systemConfig.auction_capacity?.default_mandi_max_open_lanes)} onChange={(e) => setAuctionField("default_mandi_max_open_lanes", e.target.value)} fullWidth disabled={platformSectionDisabled} />
            <TextField label="Default Mandi Max Queue Per Lane" helperText="Default number of queued lots allowed in one mandi lane." type="number" value={num(systemConfig.auction_capacity?.default_mandi_max_queue_per_lane)} onChange={(e) => setAuctionField("default_mandi_max_queue_per_lane", e.target.value)} fullWidth disabled={platformSectionDisabled} />
            <TextField label="Default Mandi Max Total Queued Lots" helperText="Default total queued lots allowed for one mandi." type="number" value={num(systemConfig.auction_capacity?.default_mandi_max_total_queued_lots)} onChange={(e) => setAuctionField("default_mandi_max_total_queued_lots", e.target.value)} fullWidth disabled={platformSectionDisabled} />
          </Box>
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 1.5 }}>
            <Button variant="contained" onClick={handleSaveSystem} disabled={platformSectionDisabled || savingSystem || loading}>
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
              Complete and save Section A to continue.
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
              Complete and save Section A to continue.
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
              Complete and save Section A to continue.
            </Alert>
          )}
          {orgSaveError && <Alert severity="error" sx={{ mb: 2 }}>{orgSaveError}</Alert>}
          {orgSaveSuccess && <Alert severity="success" sx={{ mb: 2 }}>{orgSaveSuccess}</Alert>}
          <Alert severity="info" sx={{ mb: 2 }}>
            Org values cannot exceed platform limits. Effective mandi limits cascade below org allocation.
          </Alert>
          <Alert severity="info" sx={{ mb: 2 }}>
            Tier values are auto-applied based on selection.
          </Alert>
          <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1.5 }}>
            <Button variant="contained" onClick={handleSaveAllOrg} disabled={orgSectionDisabled || savingOrgId === "__ALL__"}>
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
                        <Button size="small" variant="outlined" onClick={() => handleSaveOrg(row)} disabled={orgSectionDisabled || savingOrgId === row.org_id || savingOrgId === "__ALL__"}>
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
