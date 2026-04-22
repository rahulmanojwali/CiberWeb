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

const TIER_PRESETS: Record<string, Partial<OrgAllocation>> = {
  STARTER: { tier_code: "STARTER", allocated_max_live_lanes: 2, allocated_max_open_lanes: 4, allocated_max_queued_lots: 50, allocated_max_concurrent_bidders: 300, overflow_allowed: false, special_event_allowed: false, priority_weight: 50 },
  STANDARD: { tier_code: "STANDARD", allocated_max_live_lanes: 4, allocated_max_open_lanes: 8, allocated_max_queued_lots: 120, allocated_max_concurrent_bidders: 800, overflow_allowed: true, special_event_allowed: false, priority_weight: 100 },
  PREMIUM: { tier_code: "PREMIUM", allocated_max_live_lanes: 8, allocated_max_open_lanes: 16, allocated_max_queued_lots: 300, allocated_max_concurrent_bidders: 2000, overflow_allowed: true, special_event_allowed: true, priority_weight: 150 },
  ENTERPRISE: { tier_code: "ENTERPRISE", allocated_max_live_lanes: 16, allocated_max_open_lanes: 32, allocated_max_queued_lots: 800, allocated_max_concurrent_bidders: 5000, overflow_allowed: true, special_event_allowed: true, priority_weight: 250 },
  DEDICATED: { tier_code: "DEDICATED", allocated_max_live_lanes: 32, allocated_max_open_lanes: 64, allocated_max_queued_lots: 2000, allocated_max_concurrent_bidders: 12000, overflow_allowed: true, special_event_allowed: true, priority_weight: 500, reserved_capacity_enabled: true },
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

const UsageMetric: React.FC<{ label: string; value: React.ReactNode; help: string }> = ({
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
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    deployment_profile_name: "",
    auction_capacity: {},
    infra_profile: {},
  });
  const [platformUsage, setPlatformUsage] = useState<any>(null);
  const [orgRows, setOrgRows] = useState<OrgAllocation[]>([]);

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

  const handleApplyPreset = (orgId: string, presetKey: string) => {
    const preset = TIER_PRESETS[presetKey];
    if (!preset) return;
    updateOrgRow(orgId, preset);
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
          Section B — Current Platform Usage
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, minmax(180px, 1fr))" }, gap: 1.25 }}>
          <UsageMetric label="Current Live Lanes" value={platformUsage?.current_live_lanes ?? 0} help="Number of lanes currently running live." />
          <UsageMetric label="Current Open Lanes" value={platformUsage?.current_open_lanes ?? 0} help="Number of planned, open, or live lanes currently present." />
          <UsageMetric label="Current Queued Lots" value={platformUsage?.current_queued_lots ?? 0} help="Number of lots currently waiting in lane queues." />
          <UsageMetric label="Remaining Live Capacity" value={platformUsage?.remaining_live_capacity ?? 0} help="Platform live-lane balance still available." />
          <UsageMetric label="Remaining Open Capacity" value={platformUsage?.remaining_open_capacity ?? 0} help="Platform open-lane balance still available." />
          <UsageMetric label="Remaining Queue Capacity" value={platformUsage?.remaining_queue_capacity ?? 0} help="Platform queued-lot balance still available." />
          <UsageMetric label="Guard State" value={platformUsage?.guard_state || "GREEN"} help="Health status based on configured capacity thresholds." />
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
          Section C — Optional Infra Profile Metadata
        </Typography>
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(220px, 1fr))" }, gap: 1.5 }}>
          <TextField label="Cloud Provider / Deployment Type" helperText="Hosting provider or infra label, for example OCI, AWS, or On-Prem." placeholder="OCI / AWS / On-Prem" value={systemConfig.infra_profile?.cloud_provider || ""} onChange={(e) => setInfraField("cloud_provider", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
          <TextField label="Deployment Type" helperText="Shared, Dedicated, Hybrid, or another hosting arrangement." placeholder="Shared / Dedicated" value={systemConfig.infra_profile?.deployment_type || ""} onChange={(e) => setInfraField("deployment_type", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
          <TextField label="App Server RAM (GB)" helperText="Application runtime memory capacity." type="number" value={num(systemConfig.infra_profile?.app_server_ram_gb)} onChange={(e) => setInfraField("app_server_ram_gb", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
          <TextField label="App Server vCPU" helperText="Application runtime compute capacity." type="number" value={num(systemConfig.infra_profile?.app_server_vcpu)} onChange={(e) => setInfraField("app_server_vcpu", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
          <TextField label="DB Server RAM (GB)" helperText="Database machine memory capacity." type="number" value={num(systemConfig.infra_profile?.db_server_ram_gb)} onChange={(e) => setInfraField("db_server_ram_gb", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
          <TextField label="DB Server vCPU" helperText="Database machine compute capacity." type="number" value={num(systemConfig.infra_profile?.db_server_vcpu)} onChange={(e) => setInfraField("db_server_vcpu", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
          <TextField label="Web Server RAM (GB)" helperText="Web or admin frontend serving memory capacity." type="number" value={num(systemConfig.infra_profile?.web_server_ram_gb)} onChange={(e) => setInfraField("web_server_ram_gb", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
          <TextField label="Web Server vCPU" helperText="Web or admin frontend serving compute capacity." type="number" value={num(systemConfig.infra_profile?.web_server_vcpu)} onChange={(e) => setInfraField("web_server_vcpu", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
          <TextField label="Same Machine or Separate" helperText="Whether app, web, and database run on the same server or are split." placeholder="Same / Separate" value={systemConfig.infra_profile?.same_machine_or_separate || ""} onChange={(e) => setInfraField("same_machine_or_separate", e.target.value)} fullWidth disabled={!canEditCapacityControl} />
          <TextField label="Notes" helperText="Any infra-specific operational notes." value={systemConfig.infra_profile?.notes || ""} onChange={(e) => setInfraField("notes", e.target.value)} multiline minRows={3} fullWidth sx={{ gridColumn: { md: "1 / -1" } }} disabled={!canEditCapacityControl} />
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
          Org Allocation Management
        </Typography>
        <Alert severity="info" sx={{ mb: 2 }}>
          Org values cannot exceed platform limits. Effective mandi limits cascade below org allocation.
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
                <TableCell>Preset</TableCell>
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
                    <TextField select size="small" value={row.tier_code || ""} onChange={(e) => updateOrgRow(row.org_id, { tier_code: e.target.value })} sx={{ minWidth: 120 }} disabled={!canEditCapacityControl}>
                      <MenuItem value="">Custom</MenuItem>
                      {Object.keys(TIER_PRESETS).map((preset) => <MenuItem key={preset} value={preset}>{preset}</MenuItem>)}
                    </TextField>
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" display="block">Live {row.current_live_lanes}</Typography>
                    <Typography variant="caption" display="block">Open {row.current_open_lanes}</Typography>
                    <Typography variant="caption" display="block">Queued {row.current_queued_lots}</Typography>
                  </TableCell>
                  <TableCell><TextField size="small" type="number" value={num(row.allocated_max_live_lanes)} onChange={(e) => updateOrgRow(row.org_id, { allocated_max_live_lanes: Number(e.target.value) || null })} sx={{ width: 110 }} disabled={!canEditCapacityControl} /></TableCell>
                  <TableCell><TextField size="small" type="number" value={num(row.allocated_max_open_lanes)} onChange={(e) => updateOrgRow(row.org_id, { allocated_max_open_lanes: Number(e.target.value) || null })} sx={{ width: 110 }} disabled={!canEditCapacityControl} /></TableCell>
                  <TableCell><TextField size="small" type="number" value={num(row.allocated_max_queued_lots)} onChange={(e) => updateOrgRow(row.org_id, { allocated_max_queued_lots: Number(e.target.value) || null })} sx={{ width: 120 }} disabled={!canEditCapacityControl} /></TableCell>
                  <TableCell><TextField size="small" type="number" value={num(row.allocated_max_concurrent_bidders)} onChange={(e) => updateOrgRow(row.org_id, { allocated_max_concurrent_bidders: Number(e.target.value) || null })} sx={{ width: 120 }} disabled={!canEditCapacityControl} /></TableCell>
                  <TableCell><Switch checked={Boolean(row.overflow_allowed)} onChange={(e) => updateOrgRow(row.org_id, { overflow_allowed: e.target.checked })} disabled={!canEditCapacityControl} /></TableCell>
                  <TableCell><Switch checked={Boolean(row.special_event_allowed)} onChange={(e) => updateOrgRow(row.org_id, { special_event_allowed: e.target.checked })} disabled={!canEditCapacityControl} /></TableCell>
                  <TableCell><TextField size="small" type="number" value={num(row.priority_weight)} onChange={(e) => updateOrgRow(row.org_id, { priority_weight: Number(e.target.value) || null })} sx={{ width: 100 }} disabled={!canEditCapacityControl} /></TableCell>
                  <TableCell><Switch checked={Boolean(row.reserved_capacity_enabled)} onChange={(e) => updateOrgRow(row.org_id, { reserved_capacity_enabled: e.target.checked })} disabled={!canEditCapacityControl} /></TableCell>
                  <TableCell>
                    <TextField select size="small" value="" onChange={(e) => handleApplyPreset(row.org_id, e.target.value)} sx={{ minWidth: 130 }} disabled={!canEditCapacityControl}>
                      <MenuItem value="">Apply preset</MenuItem>
                      {Object.keys(TIER_PRESETS).map((preset) => <MenuItem key={preset} value={preset}>{preset}</MenuItem>)}
                    </TextField>
                  </TableCell>
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
