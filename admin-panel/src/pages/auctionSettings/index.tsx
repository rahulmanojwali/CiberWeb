import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import HandshakeOutlinedIcon from "@mui/icons-material/HandshakeOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import { getAuctionSettings, upsertAuctionSettings } from "../../services/auctionSettingsApi";

type Option = { value: string; label: string };

type WorkflowPoliciesState = {
  lot_creation_mode: string;
  auction: Record<string, any>;
  msp: Record<string, any>;
  direct: Record<string, any>;
  contract: Record<string, any>;
  haat: Record<string, any>;
};

const DEFAULT_WORKFLOW_POLICIES: WorkflowPoliciesState = {
  lot_creation_mode: "STRICT_ADMIN_ONLY",
  auction: {
    enabled: true,
    lot_creation_mode: "STRICT_ADMIN_ONLY",
    approval_mode: "MANUAL",
    lot_assignment_mode: "MANUAL",
  },
  msp: {
    enabled: false,
    intake_creation_mode: "ADMIN_ONLY",
    approval_mode: "MANUAL",
    farmer_request_allowed: false,
    rate_source: "MSP",
  },
  direct: {
    enabled: false,
    listing_creation_mode: "ADMIN_ONLY",
    approval_mode: "MANUAL",
    negotiation_allowed: true,
  },
  contract: {
    enabled: false,
    contract_creation_mode: "ADMIN_ONLY",
    approval_mode: "MANUAL",
    farmer_acceptance_required: true,
  },
  haat: {
    enabled: false,
    listing_creation_mode: "ADMIN_ONLY",
    approval_mode: "MANUAL",
    event_window_required: true,
  },
};

const LOT_CREATION_OPTIONS = [
  { value: "STRICT_ADMIN_ONLY", label: "Strict Admin Only" },
  { value: "GATE_OPERATOR_ALLOWED", label: "Gate Operator Allowed" },
  { value: "FARMER_ALLOWED", label: "Farmer Allowed" },
];
const APPROVAL_OPTIONS = [
  { value: "MANUAL", label: "Manual" },
  { value: "AUTO", label: "Automatic" },
];
const ASSIGNMENT_OPTIONS = [
  { value: "MANUAL", label: "Manual" },
  { value: "AUTO", label: "Automatic" },
];
const LISTING_OPTIONS = [
  { value: "ADMIN_ONLY", label: "Admin Only" },
  { value: "FARMER_ALLOWED", label: "Farmer Allowed" },
];
const RATE_SOURCE_OPTIONS = [
  { value: "MSP", label: "MSP" },
  { value: "MANDI", label: "Mandi" },
  { value: "MANUAL", label: "Manual" },
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

function withDefaults(input: any): WorkflowPoliciesState {
  const source = input && typeof input === "object" ? input : {};
  const auction = source.auction && typeof source.auction === "object" ? source.auction : {};
  return {
    lot_creation_mode: String(source.lot_creation_mode || auction.lot_creation_mode || DEFAULT_WORKFLOW_POLICIES.lot_creation_mode).toUpperCase(),
    auction: {
      ...source.auction,
      ...DEFAULT_WORKFLOW_POLICIES.auction,
      ...auction,
      enabled: Boolean(auction.enabled ?? DEFAULT_WORKFLOW_POLICIES.auction.enabled),
      lot_creation_mode: String(auction.lot_creation_mode || source.lot_creation_mode || DEFAULT_WORKFLOW_POLICIES.auction.lot_creation_mode).toUpperCase(),
      approval_mode: String(auction.approval_mode || DEFAULT_WORKFLOW_POLICIES.auction.approval_mode).toUpperCase(),
      lot_assignment_mode: String(auction.lot_assignment_mode || DEFAULT_WORKFLOW_POLICIES.auction.lot_assignment_mode).toUpperCase(),
    },
    msp: {
      ...DEFAULT_WORKFLOW_POLICIES.msp,
      ...(source.msp || {}),
      enabled: Boolean(source?.msp?.enabled ?? DEFAULT_WORKFLOW_POLICIES.msp.enabled),
      intake_creation_mode: String(source?.msp?.intake_creation_mode || DEFAULT_WORKFLOW_POLICIES.msp.intake_creation_mode).toUpperCase(),
      approval_mode: String(source?.msp?.approval_mode || DEFAULT_WORKFLOW_POLICIES.msp.approval_mode).toUpperCase(),
      farmer_request_allowed: Boolean(source?.msp?.farmer_request_allowed ?? DEFAULT_WORKFLOW_POLICIES.msp.farmer_request_allowed),
      rate_source: String(source?.msp?.rate_source || DEFAULT_WORKFLOW_POLICIES.msp.rate_source).toUpperCase(),
    },
    direct: {
      ...DEFAULT_WORKFLOW_POLICIES.direct,
      ...(source.direct || {}),
      enabled: Boolean(source?.direct?.enabled ?? DEFAULT_WORKFLOW_POLICIES.direct.enabled),
      listing_creation_mode: String(source?.direct?.listing_creation_mode || DEFAULT_WORKFLOW_POLICIES.direct.listing_creation_mode).toUpperCase(),
      approval_mode: String(source?.direct?.approval_mode || DEFAULT_WORKFLOW_POLICIES.direct.approval_mode).toUpperCase(),
      negotiation_allowed: Boolean(source?.direct?.negotiation_allowed ?? DEFAULT_WORKFLOW_POLICIES.direct.negotiation_allowed),
    },
    contract: {
      ...DEFAULT_WORKFLOW_POLICIES.contract,
      ...(source.contract || {}),
      enabled: Boolean(source?.contract?.enabled ?? DEFAULT_WORKFLOW_POLICIES.contract.enabled),
      contract_creation_mode: String(source?.contract?.contract_creation_mode || DEFAULT_WORKFLOW_POLICIES.contract.contract_creation_mode).toUpperCase(),
      approval_mode: String(source?.contract?.approval_mode || DEFAULT_WORKFLOW_POLICIES.contract.approval_mode).toUpperCase(),
      farmer_acceptance_required: Boolean(source?.contract?.farmer_acceptance_required ?? DEFAULT_WORKFLOW_POLICIES.contract.farmer_acceptance_required),
    },
    haat: {
      ...DEFAULT_WORKFLOW_POLICIES.haat,
      ...(source.haat || {}),
      enabled: Boolean(source?.haat?.enabled ?? DEFAULT_WORKFLOW_POLICIES.haat.enabled),
      listing_creation_mode: String(source?.haat?.listing_creation_mode || DEFAULT_WORKFLOW_POLICIES.haat.listing_creation_mode).toUpperCase(),
      approval_mode: String(source?.haat?.approval_mode || DEFAULT_WORKFLOW_POLICIES.haat.approval_mode).toUpperCase(),
      event_window_required: Boolean(source?.haat?.event_window_required ?? DEFAULT_WORKFLOW_POLICIES.haat.event_window_required),
    },
  };
}

const SectionCard: React.FC<{ icon: React.ReactNode; title: string; subtitle: string; children: React.ReactNode }> = ({ icon, title, subtitle, children }) => (
  <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "common.white" }}>
    <CardContent sx={{ p: { xs: 2, md: 2.5 }, "&:last-child": { pb: { xs: 2, md: 2.5 } } }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box sx={{ width: 40, height: 40, borderRadius: 2, display: "grid", placeItems: "center", bgcolor: "rgba(77, 107, 56, 0.08)", color: "success.dark", flexShrink: 0 }}>
            {icon}
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontSize: 17, fontWeight: 700 }}>{title}</Typography>
            <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
          </Box>
        </Stack>
        <Divider />
        {children}
      </Stack>
    </CardContent>
  </Card>
);

export const AuctionSettings: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const { enqueueSnackbar } = useSnackbar();
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [selectedMandi, setSelectedMandi] = useState("");
  const [workflowPolicies, setWorkflowPolicies] = useState<WorkflowPoliciesState>(DEFAULT_WORKFLOW_POLICIES);
  const [effectivePolicies, setEffectivePolicies] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const canView = useMemo(() => can("mandi_settings.menu", "VIEW"), [can]);
  const canEdit = useMemo(() => can("mandi_settings.edit", "UPDATE"), [can]);

  const loadMandis = useCallback(async () => {
    const username = currentUsername();
    const orgId = uiConfig.scope?.org_id || "";
    if (!username || !orgId) return;
    const list = await getMandisForCurrentScope({ username, language, org_id: orgId });
    const options = (list || []).map((m: any) => ({
      value: String(m.mandi_id ?? m.mandiId ?? ""),
      label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
    }));
    setMandiOptions(options);
    if (!selectedMandi && options.length === 1) setSelectedMandi(options[0].value);
  }, [language, selectedMandi, uiConfig.scope?.org_id]);

  const loadSettings = useCallback(async () => {
    const username = currentUsername();
    const orgId = uiConfig.scope?.org_id || "";
    if (!username || !orgId || !selectedMandi) return;
    setLoading(true);
    try {
      const resp = await getAuctionSettings({ username, language, filters: { org_id: orgId, mandi_id: selectedMandi } });
      const data = resp?.data || resp?.response?.data || {};
      setWorkflowPolicies(withDefaults(data?.settings?.workflow_policies));
      setEffectivePolicies(data?.effective_workflow_policies || null);
    } finally {
      setLoading(false);
    }
  }, [language, selectedMandi, uiConfig.scope?.org_id]);

  useEffect(() => { if (canView) loadMandis(); }, [canView, loadMandis]);
  useEffect(() => { loadSettings(); }, [loadSettings]);

  const updateMode = (mode: keyof WorkflowPoliciesState, key: string, value: any) => {
    setWorkflowPolicies((prev) => ({
      ...prev,
      [mode]: {
        ...(prev[mode] as Record<string, any>),
        [key]: value,
      },
    }));
  };

  const saveSettings = async () => {
    const username = currentUsername();
    const orgId = uiConfig.scope?.org_id || "";
    if (!username || !orgId || !selectedMandi) {
      enqueueSnackbar("Please select a mandi.", { variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...workflowPolicies,
        lot_creation_mode: workflowPolicies.auction.lot_creation_mode,
        auction: { ...workflowPolicies.auction, lot_creation_mode: workflowPolicies.auction.lot_creation_mode },
      };
      const resp = await upsertAuctionSettings({
        username,
        language,
        payload: {
          org_id: orgId,
          mandi_id: selectedMandi,
          workflow_policies: payload,
        },
      });
      const code = String(resp?.response?.responsecode ?? resp?.data?.responsecode ?? "");
      if (code !== "0") {
        enqueueSnackbar(resp?.response?.description || "Failed to save workflow settings.", { variant: "error" });
        return;
      }
      enqueueSnackbar("Workflow settings saved.", { variant: "success" });
      await loadSettings();
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return <PageContainer><Alert severity="warning">You are not authorized to view workflow settings.</Alert></PageContainer>;
  }

  return (
    <PageContainer>
      <Stack spacing={1} mb={2}>
        <Typography variant="h5">Workflow Settings</Typography>
        <Typography variant="body2" color="text.secondary">
          Configure mode-specific workflow policies for auction, MSP, direct, contract, and haat.
        </Typography>
      </Stack>

      <Stack spacing={2}>
        <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
          <CardContent>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
              <TextField select label="Mandi" value={selectedMandi} onChange={(e) => setSelectedMandi(e.target.value)} sx={{ minWidth: 280 }}>
                {mandiOptions.map((m) => <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>)}
              </TextField>
              <Box flex={1} />
              <Button variant="contained" onClick={saveSettings} disabled={!canEdit || saving || loading || !selectedMandi}>
                Save Settings
              </Button>
            </Stack>
            {effectivePolicies ? (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                Effective auction lot creation mode: {String(effectivePolicies?.auction?.lot_creation_mode || effectivePolicies?.lot_creation_mode || "STRICT_ADMIN_ONLY")}
              </Typography>
            ) : null}
          </CardContent>
        </Card>

        <SectionCard icon={<GavelOutlinedIcon fontSize="small" />} title="Auction" subtitle="Controls lot creation, approval, assignment, and existing auction automation.">
          <Stack spacing={2}>
            <FormControlLabel control={<Switch checked={Boolean(workflowPolicies.auction.enabled)} onChange={(e) => updateMode("auction", "enabled", e.target.checked)} />} label="Enabled" />
            <TextField select label="Lot Creation Mode" value={workflowPolicies.auction.lot_creation_mode} onChange={(e) => updateMode("auction", "lot_creation_mode", e.target.value)}>
              {LOT_CREATION_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
            </TextField>
            <TextField select label="Approval Mode" value={workflowPolicies.auction.approval_mode} onChange={(e) => updateMode("auction", "approval_mode", e.target.value)}>
              {APPROVAL_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
            </TextField>
            <TextField select label="Lot Assignment Mode" value={workflowPolicies.auction.lot_assignment_mode} onChange={(e) => updateMode("auction", "lot_assignment_mode", e.target.value)}>
              {ASSIGNMENT_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
            </TextField>
          </Stack>
        </SectionCard>

        <SectionCard icon={<AccountBalanceWalletOutlinedIcon fontSize="small" />} title="MSP" subtitle="Controls intake creation and approval for MSP operations.">
          <Stack spacing={2}>
            <FormControlLabel control={<Switch checked={Boolean(workflowPolicies.msp.enabled)} onChange={(e) => updateMode("msp", "enabled", e.target.checked)} />} label="Enabled" />
            <TextField select label="Intake Creation Mode" value={workflowPolicies.msp.intake_creation_mode} onChange={(e) => updateMode("msp", "intake_creation_mode", e.target.value)}>
              {LISTING_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
            </TextField>
            <TextField select label="Approval Mode" value={workflowPolicies.msp.approval_mode} onChange={(e) => updateMode("msp", "approval_mode", e.target.value)}>
              {APPROVAL_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
            </TextField>
            <FormControlLabel control={<Switch checked={Boolean(workflowPolicies.msp.farmer_request_allowed)} onChange={(e) => updateMode("msp", "farmer_request_allowed", e.target.checked)} />} label="Farmer Request Allowed" />
            <TextField select label="Rate Source" value={workflowPolicies.msp.rate_source} onChange={(e) => updateMode("msp", "rate_source", e.target.value)}>
              {RATE_SOURCE_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
            </TextField>
          </Stack>
        </SectionCard>

        <SectionCard icon={<StorefrontOutlinedIcon fontSize="small" />} title="Direct" subtitle="Controls direct listing creation and negotiation behavior.">
          <Stack spacing={2}>
            <FormControlLabel control={<Switch checked={Boolean(workflowPolicies.direct.enabled)} onChange={(e) => updateMode("direct", "enabled", e.target.checked)} />} label="Enabled" />
            <TextField select label="Listing Creation Mode" value={workflowPolicies.direct.listing_creation_mode} onChange={(e) => updateMode("direct", "listing_creation_mode", e.target.value)}>
              {LISTING_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
            </TextField>
            <TextField select label="Approval Mode" value={workflowPolicies.direct.approval_mode} onChange={(e) => updateMode("direct", "approval_mode", e.target.value)}>
              {APPROVAL_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
            </TextField>
            <FormControlLabel control={<Switch checked={Boolean(workflowPolicies.direct.negotiation_allowed)} onChange={(e) => updateMode("direct", "negotiation_allowed", e.target.checked)} />} label="Negotiation Allowed" />
          </Stack>
        </SectionCard>

        <SectionCard icon={<HandshakeOutlinedIcon fontSize="small" />} title="Contract" subtitle="Controls contract creation and farmer acceptance requirements.">
          <Stack spacing={2}>
            <FormControlLabel control={<Switch checked={Boolean(workflowPolicies.contract.enabled)} onChange={(e) => updateMode("contract", "enabled", e.target.checked)} />} label="Enabled" />
            <TextField select label="Contract Creation Mode" value={workflowPolicies.contract.contract_creation_mode} onChange={(e) => updateMode("contract", "contract_creation_mode", e.target.value)}>
              {LISTING_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
            </TextField>
            <TextField select label="Approval Mode" value={workflowPolicies.contract.approval_mode} onChange={(e) => updateMode("contract", "approval_mode", e.target.value)}>
              {APPROVAL_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
            </TextField>
            <FormControlLabel control={<Switch checked={Boolean(workflowPolicies.contract.farmer_acceptance_required)} onChange={(e) => updateMode("contract", "farmer_acceptance_required", e.target.checked)} />} label="Farmer Acceptance Required" />
          </Stack>
        </SectionCard>

        <SectionCard icon={<EventOutlinedIcon fontSize="small" />} title="Haat" subtitle="Controls haat listing creation and event window requirements.">
          <Stack spacing={2}>
            <FormControlLabel control={<Switch checked={Boolean(workflowPolicies.haat.enabled)} onChange={(e) => updateMode("haat", "enabled", e.target.checked)} />} label="Enabled" />
            <TextField select label="Listing Creation Mode" value={workflowPolicies.haat.listing_creation_mode} onChange={(e) => updateMode("haat", "listing_creation_mode", e.target.value)}>
              {LISTING_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
            </TextField>
            <TextField select label="Approval Mode" value={workflowPolicies.haat.approval_mode} onChange={(e) => updateMode("haat", "approval_mode", e.target.value)}>
              {APPROVAL_OPTIONS.map((opt) => <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>)}
            </TextField>
            <FormControlLabel control={<Switch checked={Boolean(workflowPolicies.haat.event_window_required)} onChange={(e) => updateMode("haat", "event_window_required", e.target.checked)} />} label="Event Window Required" />
          </Stack>
        </SectionCard>
      </Stack>
    </PageContainer>
  );
};
