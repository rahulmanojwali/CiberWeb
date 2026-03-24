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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { getOrgSettings, upsertOrgSettings } from "../../services/orgSettingsApi";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import { getMandiSettings, upsertMandiSettings } from "../../services/mandiSettingsApi";

type Option = { value: string; label: string };

type AuctionPolicy = {
  enabled: boolean;
  lot_creation_mode: string;
  approval_mode: string;
  lot_assignment_mode: string;
};

type MspPolicy = {
  enabled: boolean;
  intake_creation_mode: string;
  approval_mode: string;
  farmer_request_allowed: boolean;
  rate_source: string;
};

type DirectPolicy = {
  enabled: boolean;
  listing_creation_mode: string;
  approval_mode: string;
  negotiation_allowed: boolean;
};

type ContractPolicy = {
  enabled: boolean;
  contract_creation_mode: string;
  approval_mode: string;
  farmer_acceptance_required: boolean;
};

type HaatPolicy = {
  enabled: boolean;
  listing_creation_mode: string;
  approval_mode: string;
  event_window_required: boolean;
};

type WorkflowPoliciesState = {
  auction: AuctionPolicy;
  msp: MspPolicy;
  direct: DirectPolicy;
  contract: ContractPolicy;
  haat: HaatPolicy;
};

type EffectivePoliciesResponse = Partial<WorkflowPoliciesState> & {
  lot_creation_mode?: string;
  source?: string;
  sources?: Record<string, string>;
};

type MandiOverrideSummary = {
  mandiId: string;
  mandiName: string;
  auctionMode: string;
  effectiveAuctionMode: string;
  source: string;
};

const LOT_CREATION_OPTIONS: Option[] = [
  { value: "STRICT_ADMIN_ONLY", label: "Strict Admin Only" },
  { value: "GATE_OPERATOR_ALLOWED", label: "Gate Operator Allowed" },
];

const APPROVAL_OPTIONS: Option[] = [
  { value: "MANUAL", label: "Manual" },
  { value: "AUTO", label: "Auto" },
  { value: "TRUST", label: "Trust" },
];

const AUCTION_ASSIGNMENT_OPTIONS: Option[] = [
  { value: "MANDI_ASSIGNS", label: "Mandi Assigns" },
  { value: "AUTO_ASSIGN", label: "Auto Assign" },
  { value: "OPERATOR_ASSIGNS", label: "Operator Assigns" },
];

const MSP_INTAKE_OPTIONS: Option[] = [
  { value: "PROCUREMENT_ADMIN_ONLY", label: "Procurement Admin Only" },
  { value: "MANDI_OPERATOR_ALLOWED", label: "Mandi Operator Allowed" },
  { value: "GOVT_CONTROLLED", label: "Government Controlled" },
];

const LISTING_CREATION_OPTIONS: Option[] = [
  { value: "ADMIN_ONLY", label: "Admin Only" },
  { value: "FARMER_ALLOWED", label: "Farmer Allowed" },
  { value: "ASSISTED_OPERATOR", label: "Assisted Operator" },
];

const CONTRACT_CREATION_OPTIONS: Option[] = [
  { value: "ADMIN_ONLY", label: "Admin Only" },
  { value: "ORG_OR_BUYER_ONLY", label: "Org Or Buyer Only" },
];

const RATE_SOURCE_OPTIONS: Option[] = [
  { value: "GOVT_DECLARED", label: "Government Declared" },
  { value: "ORG_DECLARED", label: "Org Declared" },
  { value: "MANDI_DECLARED", label: "Mandi Declared" },
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

function createDefaultWorkflowPolicies(): WorkflowPoliciesState {
  return {
    auction: {
      enabled: true,
      lot_creation_mode: "STRICT_ADMIN_ONLY",
      approval_mode: "MANUAL",
      lot_assignment_mode: "MANDI_ASSIGNS",
    },
    msp: {
      enabled: false,
      intake_creation_mode: "PROCUREMENT_ADMIN_ONLY",
      approval_mode: "MANUAL",
      farmer_request_allowed: true,
      rate_source: "GOVT_DECLARED",
    },
    direct: {
      enabled: false,
      listing_creation_mode: "FARMER_ALLOWED",
      approval_mode: "AUTO",
      negotiation_allowed: true,
    },
    contract: {
      enabled: false,
      contract_creation_mode: "ORG_OR_BUYER_ONLY",
      approval_mode: "MANUAL",
      farmer_acceptance_required: true,
    },
    haat: {
      enabled: false,
      listing_creation_mode: "FARMER_ALLOWED",
      approval_mode: "AUTO",
      event_window_required: true,
    },
  };
}

function normalizeBoolean(value: any, fallback = false): boolean {
  if (value === true || value === "true" || value === "Y" || value === "y" || value === 1 || value === "1") {
    return true;
  }
  if (value === false || value === "false" || value === "N" || value === "n" || value === 0 || value === "0") {
    return false;
  }
  return fallback;
}

function toUpperString(value: any, fallback: string): string {
  const v = String(value ?? "").trim().toUpperCase();
  return v || fallback;
}

function normalizeWorkflowPolicies(source: any): WorkflowPoliciesState {
  const defaults = createDefaultWorkflowPolicies();
  const raw = source && typeof source === "object" ? source : {};

  return {
    auction: {
      enabled: normalizeBoolean(raw?.auction?.enabled, defaults.auction.enabled),
      lot_creation_mode: toUpperString(
        raw?.auction?.lot_creation_mode ?? raw?.lot_creation_mode,
        defaults.auction.lot_creation_mode,
      ),
      approval_mode: toUpperString(raw?.auction?.approval_mode, defaults.auction.approval_mode),
      lot_assignment_mode: toUpperString(raw?.auction?.lot_assignment_mode, defaults.auction.lot_assignment_mode),
    },
    msp: {
      enabled: normalizeBoolean(raw?.msp?.enabled, defaults.msp.enabled),
      intake_creation_mode: toUpperString(raw?.msp?.intake_creation_mode, defaults.msp.intake_creation_mode),
      approval_mode: toUpperString(raw?.msp?.approval_mode, defaults.msp.approval_mode),
      farmer_request_allowed: normalizeBoolean(raw?.msp?.farmer_request_allowed, defaults.msp.farmer_request_allowed),
      rate_source: toUpperString(raw?.msp?.rate_source, defaults.msp.rate_source),
    },
    direct: {
      enabled: normalizeBoolean(raw?.direct?.enabled, defaults.direct.enabled),
      listing_creation_mode: toUpperString(raw?.direct?.listing_creation_mode, defaults.direct.listing_creation_mode),
      approval_mode: toUpperString(raw?.direct?.approval_mode, defaults.direct.approval_mode),
      negotiation_allowed: normalizeBoolean(raw?.direct?.negotiation_allowed, defaults.direct.negotiation_allowed),
    },
    contract: {
      enabled: normalizeBoolean(raw?.contract?.enabled, defaults.contract.enabled),
      contract_creation_mode: toUpperString(raw?.contract?.contract_creation_mode, defaults.contract.contract_creation_mode),
      approval_mode: toUpperString(raw?.contract?.approval_mode, defaults.contract.approval_mode),
      farmer_acceptance_required: normalizeBoolean(raw?.contract?.farmer_acceptance_required, defaults.contract.farmer_acceptance_required),
    },
    haat: {
      enabled: normalizeBoolean(raw?.haat?.enabled, defaults.haat.enabled),
      listing_creation_mode: toUpperString(raw?.haat?.listing_creation_mode, defaults.haat.listing_creation_mode),
      approval_mode: toUpperString(raw?.haat?.approval_mode, defaults.haat.approval_mode),
      event_window_required: normalizeBoolean(raw?.haat?.event_window_required, defaults.haat.event_window_required),
    },
  };
}

function buildPayload(state: WorkflowPoliciesState) {
  return {
    auction: {
      enabled: state.auction.enabled,
      lot_creation_mode: state.auction.lot_creation_mode,
      approval_mode: state.auction.approval_mode,
      lot_assignment_mode: state.auction.lot_assignment_mode,
    },
    msp: {
      enabled: state.msp.enabled,
      intake_creation_mode: state.msp.intake_creation_mode,
      approval_mode: state.msp.approval_mode,
      farmer_request_allowed: state.msp.farmer_request_allowed,
      rate_source: state.msp.rate_source,
    },
    direct: {
      enabled: state.direct.enabled,
      listing_creation_mode: state.direct.listing_creation_mode,
      approval_mode: state.direct.approval_mode,
      negotiation_allowed: state.direct.negotiation_allowed,
    },
    contract: {
      enabled: state.contract.enabled,
      contract_creation_mode: state.contract.contract_creation_mode,
      approval_mode: state.contract.approval_mode,
      farmer_acceptance_required: state.contract.farmer_acceptance_required,
    },
    haat: {
      enabled: state.haat.enabled,
      listing_creation_mode: state.haat.listing_creation_mode,
      approval_mode: state.haat.approval_mode,
      event_window_required: state.haat.event_window_required,
    },
  };
}

function modeSourceLabel(sources: Record<string, string> | undefined, key: keyof WorkflowPoliciesState): string {
  return String(sources?.[key] || "DEFAULT").toUpperCase();
}

type PolicySectionProps = {
  title: string;
  helper?: string;
  state: WorkflowPoliciesState;
  setState: React.Dispatch<React.SetStateAction<WorkflowPoliciesState>>;
  disabled?: boolean;
  readOnly?: boolean;
  effectiveSources?: Record<string, string>;
};

const PolicySection: React.FC<PolicySectionProps> = ({
  title,
  helper,
  state,
  setState,
  disabled = false,
  readOnly = false,
  effectiveSources,
}) => {
  const updateAuction = (patch: Partial<AuctionPolicy>) =>
    setState((prev) => ({ ...prev, auction: { ...prev.auction, ...patch } }));
  const updateMsp = (patch: Partial<MspPolicy>) =>
    setState((prev) => ({ ...prev, msp: { ...prev.msp, ...patch } }));
  const updateDirect = (patch: Partial<DirectPolicy>) =>
    setState((prev) => ({ ...prev, direct: { ...prev.direct, ...patch } }));
  const updateContract = (patch: Partial<ContractPolicy>) =>
    setState((prev) => ({ ...prev, contract: { ...prev.contract, ...patch } }));
  const updateHaat = (patch: Partial<HaatPolicy>) =>
    setState((prev) => ({ ...prev, haat: { ...prev.haat, ...patch } }));

  return (
    <Card>
      <CardContent>
        <Stack spacing={3}>
          <Stack spacing={0.5}>
            <Typography variant="h6">{title}</Typography>
            {helper ? (
              <Typography variant="body2" color="text.secondary">
                {helper}
              </Typography>
            ) : null}
          </Stack>

          <Stack spacing={2}>
            <Box>
              <Typography variant="subtitle1" fontWeight={600} mb={1}>
                Auction
              </Typography>
              <Stack spacing={2}>
                {effectiveSources ? (
                  <Typography variant="body2" color="text.secondary">
                    Source: {modeSourceLabel(effectiveSources, "auction")}
                  </Typography>
                ) : null}
                <FormControlLabel
                  control={
                    <Switch
                      checked={state.auction.enabled}
                      onChange={(e) => updateAuction({ enabled: e.target.checked })}
                      disabled={disabled || readOnly}
                    />
                  }
                  label="Auction enabled"
                />
                <TextField
                  select
                  label="Lot Creation Mode"
                  value={state.auction.lot_creation_mode}
                  onChange={(e) => updateAuction({ lot_creation_mode: e.target.value })}
                  disabled={disabled || readOnly}
                >
                  {LOT_CREATION_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Approval Mode"
                  value={state.auction.approval_mode}
                  onChange={(e) => updateAuction({ approval_mode: e.target.value })}
                  disabled={disabled || readOnly}
                >
                  {APPROVAL_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Lot Assignment Mode"
                  value={state.auction.lot_assignment_mode}
                  onChange={(e) => updateAuction({ lot_assignment_mode: e.target.value })}
                  disabled={disabled || readOnly}
                >
                  {AUCTION_ASSIGNMENT_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle1" fontWeight={600} mb={1}>
                MSP / Procurement
              </Typography>
              <Stack spacing={2}>
                {effectiveSources ? (
                  <Typography variant="body2" color="text.secondary">
                    Source: {modeSourceLabel(effectiveSources, "msp")}
                  </Typography>
                ) : null}
                <FormControlLabel
                  control={
                    <Switch
                      checked={state.msp.enabled}
                      onChange={(e) => updateMsp({ enabled: e.target.checked })}
                      disabled={disabled || readOnly}
                    />
                  }
                  label="MSP enabled"
                />
                <TextField
                  select
                  label="Intake Creation Mode"
                  value={state.msp.intake_creation_mode}
                  onChange={(e) => updateMsp({ intake_creation_mode: e.target.value })}
                  disabled={disabled || readOnly}
                >
                  {MSP_INTAKE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Approval Mode"
                  value={state.msp.approval_mode}
                  onChange={(e) => updateMsp({ approval_mode: e.target.value })}
                  disabled={disabled || readOnly}
                >
                  {APPROVAL_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Rate Source"
                  value={state.msp.rate_source}
                  onChange={(e) => updateMsp({ rate_source: e.target.value })}
                  disabled={disabled || readOnly}
                >
                  {RATE_SOURCE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
                <FormControlLabel
                  control={
                    <Switch
                      checked={state.msp.farmer_request_allowed}
                      onChange={(e) => updateMsp({ farmer_request_allowed: e.target.checked })}
                      disabled={disabled || readOnly}
                    />
                  }
                  label="Farmer request allowed"
                />
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle1" fontWeight={600} mb={1}>
                Direct
              </Typography>
              <Stack spacing={2}>
                {effectiveSources ? (
                  <Typography variant="body2" color="text.secondary">
                    Source: {modeSourceLabel(effectiveSources, "direct")}
                  </Typography>
                ) : null}
                <FormControlLabel
                  control={
                    <Switch
                      checked={state.direct.enabled}
                      onChange={(e) => updateDirect({ enabled: e.target.checked })}
                      disabled={disabled || readOnly}
                    />
                  }
                  label="Direct enabled"
                />
                <TextField
                  select
                  label="Listing Creation Mode"
                  value={state.direct.listing_creation_mode}
                  onChange={(e) => updateDirect({ listing_creation_mode: e.target.value })}
                  disabled={disabled || readOnly}
                >
                  {LISTING_CREATION_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Approval Mode"
                  value={state.direct.approval_mode}
                  onChange={(e) => updateDirect({ approval_mode: e.target.value })}
                  disabled={disabled || readOnly}
                >
                  {APPROVAL_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
                <FormControlLabel
                  control={
                    <Switch
                      checked={state.direct.negotiation_allowed}
                      onChange={(e) => updateDirect({ negotiation_allowed: e.target.checked })}
                      disabled={disabled || readOnly}
                    />
                  }
                  label="Negotiation allowed"
                />
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle1" fontWeight={600} mb={1}>
                Contract
              </Typography>
              <Stack spacing={2}>
                {effectiveSources ? (
                  <Typography variant="body2" color="text.secondary">
                    Source: {modeSourceLabel(effectiveSources, "contract")}
                  </Typography>
                ) : null}
                <FormControlLabel
                  control={
                    <Switch
                      checked={state.contract.enabled}
                      onChange={(e) => updateContract({ enabled: e.target.checked })}
                      disabled={disabled || readOnly}
                    />
                  }
                  label="Contract enabled"
                />
                <TextField
                  select
                  label="Contract Creation Mode"
                  value={state.contract.contract_creation_mode}
                  onChange={(e) => updateContract({ contract_creation_mode: e.target.value })}
                  disabled={disabled || readOnly}
                >
                  {CONTRACT_CREATION_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Approval Mode"
                  value={state.contract.approval_mode}
                  onChange={(e) => updateContract({ approval_mode: e.target.value })}
                  disabled={disabled || readOnly}
                >
                  {APPROVAL_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
                <FormControlLabel
                  control={
                    <Switch
                      checked={state.contract.farmer_acceptance_required}
                      onChange={(e) => updateContract({ farmer_acceptance_required: e.target.checked })}
                      disabled={disabled || readOnly}
                    />
                  }
                  label="Farmer acceptance required"
                />
              </Stack>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle1" fontWeight={600} mb={1}>
                Haat
              </Typography>
              <Stack spacing={2}>
                {effectiveSources ? (
                  <Typography variant="body2" color="text.secondary">
                    Source: {modeSourceLabel(effectiveSources, "haat")}
                  </Typography>
                ) : null}
                <FormControlLabel
                  control={
                    <Switch
                      checked={state.haat.enabled}
                      onChange={(e) => updateHaat({ enabled: e.target.checked })}
                      disabled={disabled || readOnly}
                    />
                  }
                  label="Haat enabled"
                />
                <TextField
                  select
                  label="Listing Creation Mode"
                  value={state.haat.listing_creation_mode}
                  onChange={(e) => updateHaat({ listing_creation_mode: e.target.value })}
                  disabled={disabled || readOnly}
                >
                  {LISTING_CREATION_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  select
                  label="Approval Mode"
                  value={state.haat.approval_mode}
                  onChange={(e) => updateHaat({ approval_mode: e.target.value })}
                  disabled={disabled || readOnly}
                >
                  {APPROVAL_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
                <FormControlLabel
                  control={
                    <Switch
                      checked={state.haat.event_window_required}
                      onChange={(e) => updateHaat({ event_window_required: e.target.checked })}
                      disabled={disabled || readOnly}
                    />
                  }
                  label="Event window required"
                />
              </Stack>
            </Box>
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
};

export const WorkflowPolicies: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const { enqueueSnackbar } = useSnackbar();
  const uiConfig = useAdminUiConfig();
  const { can, authContext } = usePermissions();

  const [loading, setLoading] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);
  const [savingMandi, setSavingMandi] = useState(false);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [selectedMandi, setSelectedMandi] = useState("");
  const [orgPolicies, setOrgPolicies] = useState<WorkflowPoliciesState>(createDefaultWorkflowPolicies());
  const [mandiPolicies, setMandiPolicies] = useState<WorkflowPoliciesState>(createDefaultWorkflowPolicies());
  const [effectivePolicies, setEffectivePolicies] = useState<WorkflowPoliciesState>(createDefaultWorkflowPolicies());
  const [effectiveSources, setEffectiveSources] = useState<Record<string, string>>({});
  const [mandiLoadError, setMandiLoadError] = useState("");
  const [overridesLoading, setOverridesLoading] = useState(false);
  const [mandiOverrides, setMandiOverrides] = useState<MandiOverrideSummary[]>([]);
  const [infoMessage, setInfoMessage] = useState("");

  const canViewPage = useMemo(
    () =>
      can("workflow_policies.menu", "VIEW") ||
      can("workflow_policies.view", "VIEW") ||
      can("org_settings.menu", "VIEW") ||
      can("mandi_settings.menu", "VIEW"),
    [can],
  );
  const canViewOrg = useMemo(
    () =>
      can("org_settings.menu", "VIEW") ||
      can("workflow_policies.menu", "VIEW") ||
      can("workflow_policies.view", "VIEW"),
    [can],
  );
  const canEditOrg = useMemo(
    () => can("org_settings.edit", "UPDATE") || can("workflow_policies.edit", "UPDATE"),
    [can],
  );
  const isOrgAdmin = useMemo(() => authContext.role === "ORG_ADMIN", [authContext.role]);
  const canViewMandi = useMemo(
    () =>
      can("mandi_settings.menu", "VIEW") ||
      can("workflow_policies.menu", "VIEW") ||
      can("workflow_policies.view", "VIEW") ||
      isOrgAdmin,
    [can, isOrgAdmin],
  );
  const canEditMandi = useMemo(
    () => can("mandi_settings.edit", "UPDATE") || can("workflow_policies.edit", "UPDATE") || isOrgAdmin,
    [can, isOrgAdmin],
  );

  const orgId = uiConfig.scope?.org_id || "";

  const loadMandis = useCallback(async () => {
    const username = currentUsername();
    if (!username || !orgId) return;
    setMandiLoadError("");
    try {
      const list = await getMandisForCurrentScope({ username, language, org_id: orgId });
      const next = (list || []).map((m: any) => ({
        value: String(m.mandi_id ?? m.mandiId ?? ""),
        label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
      }));
      setMandiOptions(next);
      if (!selectedMandi && next.length === 1) {
        setSelectedMandi(next[0].value);
      }
      if (!next.length) {
        setMandiLoadError("No mandis are available for this organisation.");
      }
    } catch (error) {
      console.error("[workflowPolicies] failed to load mandis", error);
      setMandiOptions([]);
      setMandiLoadError("Unable to load mandi list right now.");
    }
  }, [language, orgId, selectedMandi]);

  const loadOrgPolicies = useCallback(async () => {
    const username = currentUsername();
    if (!username || !orgId) return;
    const resp = await getOrgSettings({ username, language, payload: { org_id: orgId } });
    const settings = resp?.data?.settings || resp?.response?.data?.settings || {};
    setOrgPolicies(normalizeWorkflowPolicies(settings?.workflow_policies));
  }, [language, orgId]);

  const loadSelectedMandi = useCallback(async () => {
    const username = currentUsername();
    if (!username || !orgId || !selectedMandi) return;
    const resp = await getMandiSettings({
      username,
      language,
      filters: { org_id: orgId, mandi_id: selectedMandi },
    });
    const data = resp?.data || resp?.response?.data || {};
    const settings = data?.settings || {};
    const effective = (data?.effective_workflow_policies || {}) as EffectivePoliciesResponse;

    setMandiPolicies(normalizeWorkflowPolicies(settings?.workflow_policies));
    setEffectivePolicies(normalizeWorkflowPolicies(effective));
    setEffectiveSources(effective?.sources || {});
    setInfoMessage(
      `Auction source: ${String(effective?.source || effective?.sources?.auction || "DEFAULT").toUpperCase()}`,
    );
  }, [language, orgId, selectedMandi]);

  const loadMandiOverridesSummary = useCallback(async () => {
    const username = currentUsername();
    if (!username || !orgId || !mandiOptions.length || !canViewMandi) {
      setMandiOverrides([]);
      return;
    }
    setOverridesLoading(true);
    try {
      const rows = await Promise.all(
        mandiOptions.map(async (mandi) => {
          const resp = await getMandiSettings({
            username,
            language,
            filters: { org_id: orgId, mandi_id: mandi.value },
          });
          const data = resp?.data || resp?.response?.data || {};
          const settings = data?.settings || {};
          const effective = (data?.effective_workflow_policies || {}) as EffectivePoliciesResponse;
          const auctionMode = String(
            settings?.workflow_policies?.auction?.lot_creation_mode ||
              settings?.workflow_policies?.lot_creation_mode ||
              "",
          )
            .trim()
            .toUpperCase();
          if (!auctionMode) return null;
          return {
            mandiId: mandi.value,
            mandiName: mandi.label,
            auctionMode,
            effectiveAuctionMode: String(
              effective?.auction?.lot_creation_mode || effective?.lot_creation_mode || "STRICT_ADMIN_ONLY",
            )
              .trim()
              .toUpperCase(),
            source: String(effective?.sources?.auction || effective?.source || "DEFAULT").toUpperCase(),
          } as MandiOverrideSummary;
        }),
      );
      setMandiOverrides(rows.filter(Boolean) as MandiOverrideSummary[]);
    } catch (error) {
      console.error("[workflowPolicies] failed to load mandi override summary", error);
      setMandiOverrides([]);
    } finally {
      setOverridesLoading(false);
    }
  }, [canViewMandi, language, mandiOptions, orgId]);

  useEffect(() => {
    if (!canViewPage) return;
    setLoading(true);
    Promise.all([loadMandis(), loadOrgPolicies()]).finally(() => setLoading(false));
  }, [canViewPage, loadMandis, loadOrgPolicies]);

  useEffect(() => {
    if (!canViewMandi || !selectedMandi) return;
    loadSelectedMandi();
  }, [canViewMandi, selectedMandi, loadSelectedMandi]);

  useEffect(() => {
    if (!canViewMandi) return;
    loadMandiOverridesSummary();
  }, [canViewMandi, loadMandiOverridesSummary]);

  const saveOrgPolicies = async () => {
    const username = currentUsername();
    if (!username || !orgId) return;
    setSavingOrg(true);
    try {
      const resp = await upsertOrgSettings({
        username,
        language,
        payload: {
          org_id: orgId,
          workflow_policies: buildPayload(orgPolicies),
        },
      });
      const code = String(resp?.response?.responsecode ?? "");
      if (code !== "0") {
        enqueueSnackbar(resp?.response?.description || "Failed to save org settings.", { variant: "error" });
        return;
      }
      enqueueSnackbar("Org settings saved.", { variant: "success" });
      await loadOrgPolicies();
      if (selectedMandi) {
        await loadSelectedMandi();
      }
      await loadMandiOverridesSummary();
    } finally {
      setSavingOrg(false);
    }
  };

  const saveMandiPolicies = async () => {
    const username = currentUsername();
    if (!username || !orgId || !selectedMandi) {
      enqueueSnackbar("Please select a mandi.", { variant: "warning" });
      return;
    }
    setSavingMandi(true);
    try {
      const resp = await upsertMandiSettings({
        username,
        language,
        payload: {
          org_id: orgId,
          mandi_id: selectedMandi,
          workflow_policies: buildPayload(mandiPolicies),
        },
      });
      const code = String(resp?.response?.responsecode ?? "");
      if (code !== "0") {
        enqueueSnackbar(resp?.response?.description || "Failed to save mandi settings.", { variant: "error" });
        return;
      }
      enqueueSnackbar("Mandi settings saved.", { variant: "success" });
      await loadSelectedMandi();
      await loadMandiOverridesSummary();
    } finally {
      setSavingMandi(false);
    }
  };

  const loadOrgValuesIntoMandiForm = () => {
    setMandiPolicies(JSON.parse(JSON.stringify(orgPolicies)));
    setInfoMessage("Loaded current org defaults into the mandi form. Save to create mandi-specific override.");
  };

  if (!canViewPage) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view workflow policies.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack spacing={0.5} mb={2}>
        <Typography variant="h5">Workflow Policies</Typography>
        <Typography variant="body2" color="text.secondary">
          Configure organisation defaults and mandi-specific overrides for auction, MSP, direct, contract and haat.
        </Typography>
      </Stack>

      <Stack spacing={2}>
        {canViewOrg ? (
          <>
            <PolicySection
              title="Org Default Policies"
              helper="These values act as the base configuration for all mandis in the organisation."
              state={orgPolicies}
              setState={setOrgPolicies}
              disabled={loading || savingOrg}
              readOnly={!canEditOrg}
            />
            {canEditOrg ? (
              <Box>
                <Button variant="contained" onClick={saveOrgPolicies} disabled={loading || savingOrg}>
                  Save Org Defaults
                </Button>
              </Box>
            ) : null}
          </>
        ) : null}

        {canViewMandi ? (
          <>
            <Card>
              <CardContent>
                <Stack spacing={2}>
                  <Typography variant="h6">Mandi Override</Typography>
                  <TextField
                    select
                    label="Mandi"
                    value={selectedMandi}
                    onChange={(e) => setSelectedMandi(e.target.value)}
                    disabled={loading || !mandiOptions.length}
                  >
                    {mandiOptions.map((m) => (
                      <MenuItem key={m.value} value={m.value}>
                        {m.label}
                      </MenuItem>
                    ))}
                  </TextField>

                  {!selectedMandi ? (
                    <Typography variant="body2" color="text.secondary">
                      Select a mandi to edit its override settings.
                    </Typography>
                  ) : null}

                  {mandiLoadError ? (
                    <Typography variant="body2" color="error">
                      {mandiLoadError}
                    </Typography>
                  ) : null}

                  {infoMessage ? <Alert severity="info">{infoMessage}</Alert> : null}

                  <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                    <Button
                      variant="outlined"
                      onClick={loadOrgValuesIntoMandiForm}
                      disabled={!selectedMandi || loading || savingMandi}
                    >
                      Load Org Defaults Into Form
                    </Button>
                    {selectedMandi ? (
                      <Typography variant="body2" color="text.secondary" sx={{ alignSelf: "center" }}>
                        Effective auction mode: {effectivePolicies.auction.lot_creation_mode} (
                        {modeSourceLabel(effectiveSources, "auction")})
                      </Typography>
                    ) : null}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>

            <PolicySection
              title="Mandi Override Policies"
              helper="These values are saved against the selected mandi. Leave the page untouched if you only want to inherit organisation defaults."
              state={mandiPolicies}
              setState={setMandiPolicies}
              disabled={!selectedMandi || loading || savingMandi}
              readOnly={!canEditMandi}
              effectiveSources={effectiveSources}
            />

            {canEditMandi ? (
              <Box>
                <Button
                  variant="contained"
                  onClick={saveMandiPolicies}
                  disabled={!selectedMandi || loading || savingMandi}
                >
                  Save Mandi Override
                </Button>
              </Box>
            ) : null}

            <Card>
              <CardContent>
                <Stack spacing={1}>
                  <Typography variant="subtitle1">Current Mandi Auction Overrides</Typography>
                  <Typography variant="body2" color="text.secondary">
                    This table helps you quickly identify which mandis currently override auction lot creation mode.
                  </Typography>

                  {overridesLoading ? (
                    <Typography variant="body2" color="text.secondary">
                      Loading current mandi overrides...
                    </Typography>
                  ) : mandiOverrides.length ? (
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Mandi Name</TableCell>
                          <TableCell>Auction Override</TableCell>
                          <TableCell>Effective Auction Mode</TableCell>
                          <TableCell>Source</TableCell>
                          <TableCell align="right">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {mandiOverrides.map((row) => (
                          <TableRow key={row.mandiId}>
                            <TableCell>{row.mandiName}</TableCell>
                            <TableCell>{row.auctionMode}</TableCell>
                            <TableCell>{row.effectiveAuctionMode}</TableCell>
                            <TableCell>{row.source}</TableCell>
                            <TableCell align="right">
                              <Button size="small" onClick={() => setSelectedMandi(row.mandiId)}>
                                Edit
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No mandi overrides saved yet.
                    </Typography>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </>
        ) : null}
      </Stack>
    </PageContainer>
  );
};
// import React, { useCallback, useEffect, useMemo, useState } from "react";
// import {
//   Box,
//   Button,
//   Card,
//   CardContent,
//   MenuItem,
//   Stack,
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableRow,
//   TextField,
//   Typography,
// } from "@mui/material";
// import { useSnackbar } from "notistack";
// import { useTranslation } from "react-i18next";
// import { PageContainer } from "../../components/PageContainer";
// import { normalizeLanguageCode } from "../../config/languages";
// import { useAdminUiConfig } from "../../contexts/admin-ui-config";
// import { usePermissions } from "../../authz/usePermissions";
// import { getOrgSettings, upsertOrgSettings } from "../../services/orgSettingsApi";
// import { getMandisForCurrentScope } from "../../services/mandiApi";
// import { getMandiSettings, upsertMandiSettings } from "../../services/mandiSettingsApi";

// type Option = { value: string; label: string };
// type MandiOverrideSummary = {
//   mandiId: string;
//   mandiName: string;
//   overrideValue: string;
//   effectiveValue: string;
// };

// const ORG_OPTIONS = [
//   { value: "STRICT_ADMIN_ONLY", label: "Strict Admin Only" },
//   { value: "GATE_OPERATOR_ALLOWED", label: "Gate Operator Allowed" },
// ];

// const MANDI_OPTIONS = [
//   { value: "", label: "Use Org Default" },
//   ...ORG_OPTIONS,
// ];

// function currentUsername(): string | null {
//   try {
//     const raw = localStorage.getItem("cd_user");
//     const parsed = raw ? JSON.parse(raw) : null;
//     return parsed?.username || null;
//   } catch {
//     return null;
//   }
// }

// export const WorkflowPolicies: React.FC = () => {
//   const { i18n } = useTranslation();
//   const language = normalizeLanguageCode(i18n.language);
//   const { enqueueSnackbar } = useSnackbar();
//   const uiConfig = useAdminUiConfig();
//   const { can, authContext } = usePermissions();

//   const [loading, setLoading] = useState(false);
//   const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
//   const [selectedMandi, setSelectedMandi] = useState("");
//   const [orgLotCreationMode, setOrgLotCreationMode] = useState("STRICT_ADMIN_ONLY");
//   const [mandiLotCreationMode, setMandiLotCreationMode] = useState("");
//   const [effectiveMandiLotCreationMode, setEffectiveMandiLotCreationMode] = useState("STRICT_ADMIN_ONLY");
//   const [effectiveMandiSource, setEffectiveMandiSource] = useState("DEFAULT");
//   const [mandiLoadError, setMandiLoadError] = useState("");
//   const [overridesLoading, setOverridesLoading] = useState(false);
//   const [mandiOverrides, setMandiOverrides] = useState<MandiOverrideSummary[]>([]);

//   const canViewPage = useMemo(
//     () =>
//       can("workflow_policies.menu", "VIEW") ||
//       can("workflow_policies.view", "VIEW") ||
//       can("org_settings.menu", "VIEW") ||
//       can("mandi_settings.menu", "VIEW"),
//     [can],
//   );
//   const canViewOrg = useMemo(
//     () =>
//       can("org_settings.menu", "VIEW") ||
//       can("workflow_policies.menu", "VIEW") ||
//       can("workflow_policies.view", "VIEW"),
//     [can],
//   );
//   const canEditOrg = useMemo(
//     () => can("org_settings.edit", "UPDATE") || can("workflow_policies.edit", "UPDATE"),
//     [can],
//   );
//   const isOrgAdmin = useMemo(() => authContext.role === "ORG_ADMIN", [authContext.role]);
//   const canViewMandi = useMemo(
//     () =>
//       can("mandi_settings.menu", "VIEW") ||
//       can("workflow_policies.menu", "VIEW") ||
//       can("workflow_policies.view", "VIEW") ||
//       isOrgAdmin,
//     [can, isOrgAdmin],
//   );
//   const canEditMandi = useMemo(
//     () => can("mandi_settings.edit", "UPDATE") || can("workflow_policies.edit", "UPDATE") || isOrgAdmin,
//     [can, isOrgAdmin],
//   );

//   const orgId = uiConfig.scope?.org_id || "";
//   const selectedMandiLabel = useMemo(
//     () => mandiOptions.find((item) => item.value === selectedMandi)?.label || "",
//     [mandiOptions, selectedMandi],
//   );
//   const effectivePreview = useMemo(
//     () => (mandiLotCreationMode || orgLotCreationMode || "STRICT_ADMIN_ONLY").toUpperCase(),
//     [mandiLotCreationMode, orgLotCreationMode],
//   );

//   const loadMandis = useCallback(async () => {
//     const username = currentUsername();
//     if (!username || !orgId) return;
//     setMandiLoadError("");
//     try {
//       const list = await getMandisForCurrentScope({ username, language, org_id: orgId });
//       const next = (list || []).map((m: any) => ({
//         value: String(m.mandi_id ?? m.mandiId ?? ""),
//         label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
//       }));
//       setMandiOptions(next);
//       if (!selectedMandi && next.length === 1) {
//         setSelectedMandi(next[0].value);
//       }
//       if (!next.length) {
//         setMandiLoadError("No mandis are available for this org.");
//       }
//     } catch (error) {
//       console.error("[workflowPolicies] failed to load mandis", error);
//       setMandiOptions([]);
//       setMandiLoadError("Unable to load mandi list right now.");
//     }
//   }, [language, orgId, selectedMandi]);

//   const loadOrgPolicy = useCallback(async () => {
//     const username = currentUsername();
//     if (!username || !orgId) return;
//     const resp = await getOrgSettings({ username, language, payload: { org_id: orgId } });
//     const settings = resp?.data?.settings || resp?.response?.data?.settings || {};
//     setOrgLotCreationMode(String(settings?.workflow_policies?.lot_creation_mode || "STRICT_ADMIN_ONLY").toUpperCase());
//   }, [language, orgId]);

//   const loadMandiPolicy = useCallback(async () => {
//     const username = currentUsername();
//     if (!username || !orgId || !selectedMandi) return;
//     const resp = await getMandiSettings({
//       username,
//       language,
//       filters: { org_id: orgId, mandi_id: selectedMandi },
//     });
//     const data = resp?.data || resp?.response?.data || {};
//     const settings = data?.settings || {};
//     setMandiLotCreationMode(String(settings?.workflow_policies?.lot_creation_mode || "").toUpperCase());
//     setEffectiveMandiLotCreationMode(
//       String(data?.effective_workflow_policies?.lot_creation_mode || "STRICT_ADMIN_ONLY").toUpperCase(),
//     );
//     setEffectiveMandiSource(String(data?.effective_workflow_policies?.source || "DEFAULT").toUpperCase());
//   }, [language, orgId, selectedMandi]);

//   const loadMandiOverridesSummary = useCallback(async () => {
//     const username = currentUsername();
//     if (!username || !orgId || !mandiOptions.length || !canViewMandi) {
//       setMandiOverrides([]);
//       return;
//     }
//     setOverridesLoading(true);
//     try {
//       const rows = await Promise.all(
//         mandiOptions.map(async (mandi) => {
//           const resp = await getMandiSettings({
//             username,
//             language,
//             filters: { org_id: orgId, mandi_id: mandi.value },
//           });
//           const data = resp?.data || resp?.response?.data || {};
//           const overrideValue = String(data?.settings?.workflow_policies?.lot_creation_mode || "").toUpperCase();
//           const effectiveValue = String(
//             data?.effective_workflow_policies?.lot_creation_mode || orgLotCreationMode || "STRICT_ADMIN_ONLY",
//           ).toUpperCase();
//           if (!overrideValue) return null;
//           return {
//             mandiId: mandi.value,
//             mandiName: mandi.label,
//             overrideValue,
//             effectiveValue,
//           } as MandiOverrideSummary;
//         }),
//       );
//       setMandiOverrides(rows.filter(Boolean) as MandiOverrideSummary[]);
//     } catch (error) {
//       console.error("[workflowPolicies] failed to load mandi override summary", error);
//       setMandiOverrides([]);
//     } finally {
//       setOverridesLoading(false);
//     }
//   }, [canViewMandi, language, mandiOptions, orgId, orgLotCreationMode]);

//   useEffect(() => {
//     if (!canViewPage) return;
//     setLoading(true);
//     Promise.all([loadMandis(), loadOrgPolicy()]).finally(() => setLoading(false));
//   }, [canViewPage, loadMandis, loadOrgPolicy]);

//   useEffect(() => {
//     if (!canViewMandi || !selectedMandi) return;
//     loadMandiPolicy();
//   }, [canViewMandi, selectedMandi, loadMandiPolicy]);

//   useEffect(() => {
//     if (!canViewMandi) return;
//     loadMandiOverridesSummary();
//   }, [canViewMandi, loadMandiOverridesSummary]);

//   const saveOrgPolicy = async () => {
//     const username = currentUsername();
//     if (!username || !orgId) return;
//     const resp = await upsertOrgSettings({
//       username,
//       language,
//       payload: {
//         org_id: orgId,
//         workflow_policies: {
//           lot_creation_mode: orgLotCreationMode,
//         },
//       },
//     });
//     const code = String(resp?.response?.responsecode ?? "");
//     if (code !== "0") {
//       enqueueSnackbar(resp?.response?.description || "Failed to save org workflow policy.", { variant: "error" });
//       return;
//     }
//     enqueueSnackbar("Org workflow policy saved.", { variant: "success" });
//     loadOrgPolicy();
//     if (selectedMandi) loadMandiPolicy();
//     loadMandiOverridesSummary();
//   };

//   const saveMandiPolicy = async () => {
//     const username = currentUsername();
//     if (!username || !orgId || !selectedMandi) {
//       enqueueSnackbar("Please select a mandi.", { variant: "warning" });
//       return;
//     }
//     const resp = await upsertMandiSettings({
//       username,
//       language,
//       payload: {
//         org_id: orgId,
//         mandi_id: selectedMandi,
//         workflow_policies: {
//           lot_creation_mode: mandiLotCreationMode || null,
//         },
//       },
//     });
//     const code = String(resp?.response?.responsecode ?? "");
//     if (code !== "0") {
//       enqueueSnackbar(resp?.response?.description || "Failed to save mandi workflow policy.", { variant: "error" });
//       return;
//     }
//     enqueueSnackbar("Mandi workflow policy saved.", { variant: "success" });
//     loadMandiPolicy();
//     loadMandiOverridesSummary();
//   };

//   const clearMandiOverride = async (mandiId: string) => {
//     const username = currentUsername();
//     if (!username || !orgId || !mandiId) return;
//     const resp = await upsertMandiSettings({
//       username,
//       language,
//       payload: {
//         org_id: orgId,
//         mandi_id: mandiId,
//         workflow_policies: {
//           lot_creation_mode: null,
//         },
//       },
//     });
//     const code = String(resp?.response?.responsecode ?? "");
//     if (code !== "0") {
//       enqueueSnackbar(resp?.response?.description || "Failed to clear mandi workflow policy.", { variant: "error" });
//       return;
//     }
//     enqueueSnackbar("Mandi override cleared.", { variant: "success" });
//     if (selectedMandi === mandiId) {
//       setMandiLotCreationMode("");
//       setEffectiveMandiLotCreationMode(orgLotCreationMode);
//       setEffectiveMandiSource("ORG_DEFAULT");
//       loadMandiPolicy();
//     }
//     loadMandiOverridesSummary();
//   };

//   if (!canViewPage) {
//     return (
//       <PageContainer>
//         <Typography variant="h6">Not authorized to view workflow policies.</Typography>
//       </PageContainer>
//     );
//   }

//   return (
//     <PageContainer>
//       <Stack spacing={0.5} mb={2}>
//         <Typography variant="h5">Workflow Policies</Typography>
//         <Typography variant="body2" color="text.secondary">
//           Controls whether gate operators can create lots immediately after marking a token IN_YARD.
//         </Typography>
//       </Stack>

//       <Stack spacing={2}>
//         {canViewOrg ? (
//           <Card>
//             <CardContent>
//               <Stack spacing={2}>
//                 <Typography variant="h6">Org Default</Typography>
//                 <TextField
//                   select
//                   label="Lot Creation Mode"
//                   value={orgLotCreationMode}
//                   onChange={(e) => setOrgLotCreationMode(e.target.value)}
//                   disabled={loading || !canEditOrg}
//                 >
//                   {ORG_OPTIONS.map((opt) => (
//                     <MenuItem key={opt.value} value={opt.value}>
//                       {opt.label}
//                     </MenuItem>
//                   ))}
//                 </TextField>
//                 {canEditOrg ? (
//                   <Box>
//                     <Button variant="contained" onClick={saveOrgPolicy}>
//                       Save Org Default
//                     </Button>
//                   </Box>
//                 ) : null}
//               </Stack>
//             </CardContent>
//           </Card>
//         ) : null}

//         {canViewMandi ? (
//           <Card>
//             <CardContent>
//               <Stack spacing={2}>
//                 <Typography variant="h6">Mandi Override</Typography>
//                 <TextField
//                   select
//                   label="Mandi"
//                   value={selectedMandi}
//                   onChange={(e) => setSelectedMandi(e.target.value)}
//                   disabled={loading || !mandiOptions.length}
//                 >
//                   {mandiOptions.map((m) => (
//                     <MenuItem key={m.value} value={m.value}>
//                       {m.label}
//                     </MenuItem>
//                   ))}
//                 </TextField>
//                 {!selectedMandi ? (
//                   <Typography variant="body2" color="text.secondary">
//                     Select a mandi to configure override.
//                   </Typography>
//                 ) : null}
//                 {mandiLoadError ? (
//                   <Typography variant="body2" color="error">
//                     {mandiLoadError}
//                   </Typography>
//                 ) : null}
//                 <TextField
//                   select
//                   label="Lot Creation Mode Override"
//                   value={mandiLotCreationMode}
//                   onChange={(e) => setMandiLotCreationMode(e.target.value)}
//                   disabled={!selectedMandi || !canEditMandi}
//                 >
//                   {MANDI_OPTIONS.map((opt) => (
//                     <MenuItem key={opt.value || "__inherit__"} value={opt.value}>
//                       {opt.label}
//                     </MenuItem>
//                   ))}
//                 </TextField>
//                 <Stack spacing={0.5}>
//                   <Typography variant="body2" color="text.secondary">
//                     Org Default: {orgLotCreationMode}
//                   </Typography>
//                   <Typography variant="body2" color="text.secondary">
//                     Mandi Override: {mandiLotCreationMode || "Use Org Default"}
//                   </Typography>
//                   <Typography variant="body2" color="text.secondary">
//                     Effective Value: {selectedMandi ? effectivePreview : effectiveMandiLotCreationMode} (
//                     {selectedMandi ? (mandiLotCreationMode ? "MANDI_OVERRIDE" : "ORG_DEFAULT") : effectiveMandiSource})
//                   </Typography>
//                 </Stack>
//                 {canEditMandi ? (
//                   <Box>
//                     <Button variant="contained" onClick={saveMandiPolicy} disabled={!selectedMandi}>
//                       Save Mandi Override
//                     </Button>
//                   </Box>
//                 ) : null}
//                 <Stack spacing={1}>
//                   <Typography variant="subtitle1">Current Mandi Overrides</Typography>
//                   {overridesLoading ? (
//                     <Typography variant="body2" color="text.secondary">
//                       Loading current mandi overrides...
//                     </Typography>
//                   ) : mandiOverrides.length ? (
//                     <Table size="small">
//                       <TableHead>
//                         <TableRow>
//                           <TableCell>Mandi Name</TableCell>
//                           <TableCell>Override Value</TableCell>
//                           <TableCell>Effective Value</TableCell>
//                           <TableCell align="right">Action</TableCell>
//                         </TableRow>
//                       </TableHead>
//                       <TableBody>
//                         {mandiOverrides.map((row) => (
//                           <TableRow key={row.mandiId}>
//                             <TableCell>{row.mandiName}</TableCell>
//                             <TableCell>{row.overrideValue}</TableCell>
//                             <TableCell>{row.effectiveValue}</TableCell>
//                             <TableCell align="right">
//                               <Stack direction="row" spacing={1} justifyContent="flex-end">
//                                 <Button
//                                   size="small"
//                                   onClick={() => {
//                                     setSelectedMandi(row.mandiId);
//                                     setMandiLotCreationMode(row.overrideValue);
//                                     setEffectiveMandiLotCreationMode(row.effectiveValue);
//                                     setEffectiveMandiSource("MANDI_OVERRIDE");
//                                   }}
//                                 >
//                                   Edit
//                                 </Button>
//                                 {canEditMandi ? (
//                                   <Button
//                                     size="small"
//                                     color="inherit"
//                                     onClick={() => clearMandiOverride(row.mandiId)}
//                                   >
//                                     Clear Override
//                                   </Button>
//                                 ) : null}
//                               </Stack>
//                             </TableCell>
//                           </TableRow>
//                         ))}
//                       </TableBody>
//                     </Table>
//                   ) : (
//                     <Typography variant="body2" color="text.secondary">
//                       No mandi overrides saved yet.
//                     </Typography>
//                   )}
//                 </Stack>
//               </Stack>
//             </CardContent>
//           </Card>
//         ) : null}
//       </Stack>
//     </PageContainer>
//   );
// };

