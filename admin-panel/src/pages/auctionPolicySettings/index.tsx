import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { PageContainer } from "../../components/PageContainer";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import {
  getAuctionPolicySettings,
  updateAuctionPolicySettings,
} from "../../services/auctionPolicySettingsApi";
import { fetchOrganisations } from "../../services/adminUsersApi";

type Policy = Record<string, any>;

type SectionProps = {
  title: string;
  subtitle: string;
  children: React.ReactNode;
};

const Section: React.FC<SectionProps> = ({ title, subtitle, children }) => (
  <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
    <CardContent>
      <Stack spacing={2}>
        <Stack spacing={1}>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
          <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
        </Stack>
        {children}
      </Stack>
    </CardContent>
  </Card>
);

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

function currentRoleSlug(): string {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return String(parsed?.role_code || parsed?.role_slug || "").toUpperCase();
  } catch {
    return "";
  }
}

const enumOptions = {
  start_mode: ["TIME_WINDOW", "QUEUE", "MANUAL"],
  no_bid_result: ["UNSOLD", "CANCELLED", "WITHDRAWN"],
  cm_lot_status_after_unsold: ["VERIFIED", "OPEN", "READY", "IN_AUCTION"],
  close_mode: ["AUTO", "MANUAL"],
};

const booleanFields = [
  "one_lane_per_commodity",
  "reuse_existing_lane_if_available",
  "allow_overflow_lanes",
  "queue_position_blocks_start",
  "lane_window_enforced",
  "product_window_enforced",
  "product_end_time_hard_stop",
  "block_same_farmer_parallel_live",
  "block_same_product_parallel_live",
  "release_cancelled_source_lot",
  "release_withdrawn_source_lot",
  "auto_close_enabled",
  "auto_close_empty_lanes",
  "close_empty_lane_when_no_live_or_queued",
];

const numberFields = ["max_live_lots_per_lane"];

const labelMap: Record<string, string> = {
  one_lane_per_commodity: "One lane per commodity",
  reuse_existing_lane_if_available: "Reuse existing lane if available",
  allow_overflow_lanes: "Allow overflow lanes",
  queue_position_blocks_start: "Queue position blocks start",
  lane_window_enforced: "Enforce lane time window",
  product_window_enforced: "Enforce product time window",
  product_end_time_hard_stop: "Hard stop on product end time",
  block_same_farmer_parallel_live: "Block same farmer parallel live",
  block_same_product_parallel_live: "Block same product parallel live",
  release_cancelled_source_lot: "Release source lot on cancelled",
  release_withdrawn_source_lot: "Release source lot on withdrawn",
  auto_close_enabled: "Auto close enabled",
  auto_close_empty_lanes: "Auto close empty lanes",
  close_empty_lane_when_no_live_or_queued: "Close lane when no live/queued lots",
  max_live_lots_per_lane: "Max live lots per lane",
  start_mode: "Start mode",
  no_bid_result: "No bid result",
  cm_lot_status_after_unsold: "CM lot status after unsold",
  close_mode: "Close mode",
};

function renderSwitchField(
  key: string,
  policy: Policy,
  readOnly: boolean,
  setPolicy: React.Dispatch<React.SetStateAction<Policy>>,
) {
  return (
    <FormControlLabel
      key={key}
      control={(
        <Switch
          checked={Boolean(policy[key])}
          onChange={(e) => setPolicy((prev) => ({ ...prev, [key]: e.target.checked }))}
          disabled={readOnly}
        />
      )}
      label={labelMap[key] || key}
    />
  );
}

function renderNumberField(
  key: string,
  policy: Policy,
  readOnly: boolean,
  setPolicy: React.Dispatch<React.SetStateAction<Policy>>,
) {
  return (
    <TextField
      key={key}
      type="number"
      size="small"
      label={labelMap[key] || key}
      value={policy[key] ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        setPolicy((prev) => ({
          ...prev,
          [key]: raw === "" ? "" : Number(raw),
        }));
      }}
      disabled={readOnly}
      fullWidth
    />
  );
}

function renderEnumField(
  key: keyof typeof enumOptions,
  policy: Policy,
  readOnly: boolean,
  setPolicy: React.Dispatch<React.SetStateAction<Policy>>,
) {
  const options = enumOptions[key];
  return (
    <FormControl key={key} size="small" fullWidth>
      <InputLabel>{labelMap[key]}</InputLabel>
      <Select
        label={labelMap[key]}
        value={String(policy[key] ?? options[0])}
        disabled={readOnly}
        onChange={(e) => setPolicy((prev) => ({ ...prev, [key]: e.target.value }))}
      >
        {options.map((option) => (
          <MenuItem key={option} value={option}>{option}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

export const AuctionPolicySettingsPage: React.FC = () => {
  const uiConfig = useAdminUiConfig();

  const canMenu = useMemo(
    () => can(uiConfig.resources, "auction_policy_settings.menu", "VIEW"),
    [uiConfig.resources],
  );
  const canView = useMemo(
    () => can(uiConfig.resources, "auction_policy_settings.view", "VIEW") || canMenu,
    [uiConfig.resources, canMenu],
  );
  const canEdit = useMemo(
    () => can(uiConfig.resources, "auction_policy_settings.edit", "UPDATE"),
    [uiConfig.resources],
  );

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [policy, setPolicy] = useState<Policy>({});
  const [scope, setScope] = useState<"PLATFORM" | "ORG">("PLATFORM");
  const [orgId, setOrgId] = useState("");
  const [orgOptions, setOrgOptions] = useState<Array<{ id: string; label: string }>>([]);

  const readOnly = !canEdit;
  const roleSlug = String(uiConfig.role || currentRoleSlug()).toUpperCase();
  const isSuperAdmin = roleSlug === "SUPER_ADMIN";
  const isOrgAdmin = roleSlug === "ORG_ADMIN";
  const scopedOrgId = String(uiConfig.scope?.org_id || "").trim();
  const scopedOrgCode = String(uiConfig.scope?.org_code || "").trim();

  const load = async (opts?: { nextScope?: "PLATFORM" | "ORG"; nextOrgId?: string }) => {
    const username = currentUsername();
    if (!username) {
      setError("Missing login context.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const effectiveScope = opts?.nextScope || scope;
      const effectiveOrgId = (opts?.nextOrgId ?? orgId).trim();
      const requestedOrgId = effectiveScope === "ORG" ? effectiveOrgId || undefined : undefined;
      const resp = await getAuctionPolicySettings({ username, org_id: requestedOrgId });
      if (resp?.response?.responsecode !== "0") {
        throw new Error(resp?.response?.description || "Failed to load policy settings.");
      }
      const data = resp?.data || {};
      setPolicy(data.effective_policy || {});
      if (isOrgAdmin) {
        setScope("ORG");
      } else if (opts?.nextScope) {
        setScope(opts.nextScope);
      } else if (isSuperAdmin) {
        setScope((data.org_policy ? "ORG" : "PLATFORM") as "PLATFORM" | "ORG");
      }
    } catch (err: any) {
      setError(err?.message || "Failed to load policy settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canMenu || !canView) return;
    if (isOrgAdmin) {
      const ownOrgId = scopedOrgId || String((JSON.parse(localStorage.getItem("cd_user") || "{}")?.org_id || "")).trim();
      setScope("ORG");
      setOrgId(ownOrgId);
      if (ownOrgId) {
        load({ nextScope: "ORG", nextOrgId: ownOrgId });
      } else {
        setError("Unable to resolve organisation scope for current user.");
      }
      return;
    }
    if (isSuperAdmin) {
      setScope("PLATFORM");
      load({ nextScope: "PLATFORM" });
      return;
    }
    load();
  }, [canMenu, canView, isOrgAdmin, isSuperAdmin, scopedOrgId]);

  useEffect(() => {
    const loadOrgOptions = async () => {
      if (!isSuperAdmin) return;
      const username = currentUsername();
      if (!username) return;
      try {
        const resp = await fetchOrganisations({ username });
        const list = resp?.response?.data?.organisations || resp?.data?.organisations || [];
        const normalized = (list || []).map((o: any) => ({
          id: String(o.org_id || o._id || "").trim(),
          label: o.org_name || o.org_code || String(o.org_id || ""),
        })).filter((o: any) => o.id);
        setOrgOptions(normalized);
      } catch (_) {
        setOrgOptions([]);
      }
    };
    loadOrgOptions();
  }, [isSuperAdmin]);

  const handleSave = async () => {
    const username = currentUsername();
    if (!username) {
      setError("Missing login context.");
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (!isSuperAdmin && scope !== "ORG") {
        setError("Org admins can update only organisation policy.");
        return;
      }
      if (scope === "ORG" && !orgId.trim()) {
        setError("Organisation is required for ORG policy.");
        return;
      }
      const payloadPolicy = { ...policy };
      booleanFields.forEach((key) => {
        if (payloadPolicy[key] !== undefined) payloadPolicy[key] = Boolean(payloadPolicy[key]);
      });
      numberFields.forEach((key) => {
        if (payloadPolicy[key] !== undefined && payloadPolicy[key] !== "") {
          payloadPolicy[key] = Number(payloadPolicy[key]);
        }
      });

      const resp = await updateAuctionPolicySettings({
        username,
        payload: {
          policy_scope: isOrgAdmin ? "ORG" : scope,
          org_id: (isOrgAdmin ? orgId : (scope === "ORG" ? orgId : "")).trim() || undefined,
          policy: payloadPolicy,
        },
      });

      if (resp?.response?.responsecode !== "0") {
        throw new Error(resp?.response?.description || "Failed to save policy settings.");
      }
      setSuccess(resp?.response?.description || "Policy settings saved successfully.");
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to save policy settings.");
    } finally {
      setSaving(false);
    }
  };

  if (!canMenu || !canView) {
    return (
      <PageContainer title="Auction Policy Settings">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Platform default + organisation-level auction rule configuration.
        </Typography>
        <Alert severity="warning">You do not have permission to view Auction Policy Settings.</Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Auction Policy Settings">
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Platform default + organisation-level auction rule configuration.
        </Typography>

        {readOnly && <Alert severity="info">Read-only mode. You do not have update permission.</Alert>}
        {error && <Alert severity="error">{error}</Alert>}
        {success && <Alert severity="success">{success}</Alert>}

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} alignItems="center">
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Policy Scope</InputLabel>
            <Select
              label="Policy Scope"
              value={scope}
              onChange={(e) => setScope(e.target.value as "PLATFORM" | "ORG")}
              disabled={readOnly || !isSuperAdmin || isOrgAdmin}
            >
              {isSuperAdmin ? <MenuItem value="PLATFORM">PLATFORM</MenuItem> : null}
              <MenuItem value="ORG">ORG</MenuItem>
            </Select>
          </FormControl>
          {isSuperAdmin && scope === "ORG" && (
            <FormControl size="small" sx={{ minWidth: 280 }}>
              <InputLabel>Organisation</InputLabel>
              <Select
                label="Organisation"
                value={orgId}
                onChange={(e) => setOrgId(String(e.target.value || ""))}
                disabled={readOnly}
              >
                {orgOptions.map((org) => (
                  <MenuItem key={org.id} value={org.id}>{org.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          {isOrgAdmin && (
            <TextField
              size="small"
              label="Organisation"
              value={scopedOrgCode || "Current Organisation"}
              disabled
              sx={{ minWidth: 280 }}
            />
          )}
          <Button
            variant="outlined"
            onClick={() => load({ nextScope: scope, nextOrgId: orgId })}
            disabled={loading || saving || (scope === "ORG" && !orgId.trim())}
          >
            Load
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" onClick={handleSave} disabled={readOnly || saving || loading}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </Stack>

        <Divider />

        {loading ? (
          <Stack alignItems="center" py={4}><CircularProgress size={24} /></Stack>
        ) : (
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
            <Section title="Lane Creation Policy" subtitle="Lane reuse, overflow lane creation, and one-lane-per-commodity controls.">
              <Stack>
                {renderSwitchField("one_lane_per_commodity", policy, readOnly, setPolicy)}
                {renderSwitchField("reuse_existing_lane_if_available", policy, readOnly, setPolicy)}
                {renderSwitchField("allow_overflow_lanes", policy, readOnly, setPolicy)}
              </Stack>
            </Section>

            <Section title="Auction Start Policy" subtitle="Start mode and queue/start constraints.">
              <Stack spacing={2}>
                {renderEnumField("start_mode", policy, readOnly, setPolicy)}
                {renderSwitchField("queue_position_blocks_start", policy, readOnly, setPolicy)}
              </Stack>
            </Section>

            <Section title="Farmer Conflict Policy" subtitle="Parallel-lot restrictions for the same farmer.">
              <Stack>
                {renderSwitchField("block_same_farmer_parallel_live", policy, readOnly, setPolicy)}
              </Stack>
            </Section>

            <Section title="Product Conflict Policy" subtitle="Parallel-lot restrictions for the same product.">
              <Stack>
                {renderSwitchField("block_same_product_parallel_live", policy, readOnly, setPolicy)}
              </Stack>
            </Section>

            <Section title="Time Window Policy" subtitle="Lane/product scheduling windows and hard-stop rules.">
              <Stack>
                {renderSwitchField("lane_window_enforced", policy, readOnly, setPolicy)}
                {renderSwitchField("product_window_enforced", policy, readOnly, setPolicy)}
                {renderSwitchField("product_end_time_hard_stop", policy, readOnly, setPolicy)}
              </Stack>
            </Section>

            <Section title="Queue Policy" subtitle="Queue capacity and lane concurrency behavior.">
              <Stack spacing={2}>
                {renderNumberField("max_live_lots_per_lane", policy, readOnly, setPolicy)}
              </Stack>
            </Section>

            <Section title="Result / Unsold Policy" subtitle="Lot status and source lot release behavior for no-bid/unsold outcomes.">
              <Stack spacing={2}>
                {renderEnumField("no_bid_result", policy, readOnly, setPolicy)}
                {renderEnumField("cm_lot_status_after_unsold", policy, readOnly, setPolicy)}
                {renderSwitchField("release_cancelled_source_lot", policy, readOnly, setPolicy)}
                {renderSwitchField("release_withdrawn_source_lot", policy, readOnly, setPolicy)}
              </Stack>
            </Section>

            <Section title="Auto Close Policy" subtitle="Auto-close controls for lots and empty lanes.">
              <Stack spacing={2}>
                {renderEnumField("close_mode", policy, readOnly, setPolicy)}
                {renderSwitchField("auto_close_enabled", policy, readOnly, setPolicy)}
                {renderSwitchField("auto_close_empty_lanes", policy, readOnly, setPolicy)}
                {renderSwitchField("close_empty_lane_when_no_live_or_queued", policy, readOnly, setPolicy)}
              </Stack>
            </Section>

            <Section title="UI Behaviour Policy" subtitle="Presentation and operational guardrails used by admin UI.">
              <Stack>
                <Typography variant="body2" color="text.secondary">
                  UI behaviour uses the same effective policy values shown above.
                </Typography>
              </Stack>
            </Section>
          </Box>
        )}
      </Stack>
    </PageContainer>
  );
};

export default AuctionPolicySettingsPage;
