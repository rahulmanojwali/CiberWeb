import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Divider,
  Paper,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import { getMandiSettings, upsertMandiSettings } from "../../services/mandiSettingsApi";

type Option = { value: string; label: string };
const LOT_CREATION_OPTIONS = [
  { value: "", label: "Use Org Default" },
  { value: "STRICT_ADMIN_ONLY", label: "Strict Admin Only" },
  { value: "GATE_OPERATOR_ALLOWED", label: "Gate Operator Allowed" },
];
const MANDI_ASSOCIATION_APPROVAL_OPTIONS = [
  "MANUAL_APPROVAL",
  "AUTO_APPROVE",
  "AUTO_APPROVE_EXISTING_USER_ONLY",
  "MANDI_ADMIN_APPROVAL",
  "ORG_ADMIN_APPROVAL",
];
const PRELISTING_APPROVAL_OPTIONS = [
  { value: "AUTO", label: "Auto" },
  { value: "MANUAL", label: "Manual Review" },
  { value: "TRUST", label: "Trust Score Based" },
];
const APPROVAL_MODE_LABELS: Record<string, string> = {
  MANUAL_APPROVAL: "Manual Approval",
  AUTO_APPROVE: "Auto Approve",
  AUTO_APPROVE_EXISTING_USER_ONLY: "Auto Approve Existing Users Only",
  MANDI_ADMIN_APPROVAL: "Mandi Admin Approval",
  ORG_ADMIN_APPROVAL: "Organisation Admin Approval",
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

function labelFromEnum(value?: string | null) {
  const normalized = String(value || "").toUpperCase();
  return APPROVAL_MODE_LABELS[normalized] || normalized.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function SettingsCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <Paper sx={{ p: 2.5, borderRadius: 2 }}>
      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>{title}</Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      <Stack spacing={2}>{children}</Stack>
    </Paper>
  );
}

function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
      {children}
    </Box>
  );
}

function PolicyToggle({
  label,
  helper,
  checked,
  onChange,
}: {
  label: string;
  helper: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={2}
      sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, p: 1.5, minHeight: 86 }}
    >
      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
        <Typography variant="caption" color="text.secondary">{helper}</Typography>
      </Box>
      <Switch checked={checked} onChange={onChange} />
    </Stack>
  );
}

export const MandiSettings: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const { enqueueSnackbar } = useSnackbar();
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();

  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [selectedMandi, setSelectedMandi] = useState("");
  const [approvalMode, setApprovalMode] = useState("AUTO");
  const [trustMinScore, setTrustMinScore] = useState("");
  const [lotCreationMode, setLotCreationMode] = useState("");
  const [effectiveLotCreationMode, setEffectiveLotCreationMode] = useState("STRICT_ADMIN_ONLY");
  const [effectiveLotCreationSource, setEffectiveLotCreationSource] = useState("DEFAULT");
  const [maxLiveSessions, setMaxLiveSessions] = useState("");
  const [maxOpenSessions, setMaxOpenSessions] = useState("");
  const [maxQueuePerLane, setMaxQueuePerLane] = useState("");
  const [maxTotalQueuedLots, setMaxTotalQueuedLots] = useState("");
  const [allowOverflowLanes, setAllowOverflowLanes] = useState(true);
  const [farmerAssociationApprovalMode, setFarmerAssociationApprovalMode] = useState("MANUAL_APPROVAL");
  const [traderAssociationApprovalMode, setTraderAssociationApprovalMode] = useState("MANUAL_APPROVAL");
  const [allowFarmerMultiMandi, setAllowFarmerMultiMandi] = useState(true);
  const [allowTraderMultiMandi, setAllowTraderMultiMandi] = useState(true);
  const [requireFarmerDocuments, setRequireFarmerDocuments] = useState(false);
  const [requireTraderDocuments, setRequireTraderDocuments] = useState(false);
  const [allowFarmerGateTokenWithoutApproval, setAllowFarmerGateTokenWithoutApproval] = useState(false);
  const [allowTraderBidWithoutApproval, setAllowTraderBidWithoutApproval] = useState(false);
  const [maxPendingMandiRequests, setMaxPendingMandiRequests] = useState("5");
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const canView = useMemo(
    () => can("mandi_settings.menu", "VIEW"),
    [can],
  );
  const canEdit = useMemo(
    () => can("mandi_settings.edit", "UPDATE"),
    [can],
  );

  const loadMandis = useCallback(async () => {
    const username = currentUsername();
    const orgId = uiConfig.scope?.org_id || "";
    if (!username || !orgId) return;
    const list = await getMandisForCurrentScope({
      username,
      language,
      org_id: orgId,
    });
    setMandiOptions(
      (list || []).map((m: any) => ({
        value: String(m.mandi_id ?? m.mandiId ?? ""),
        label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
      })),
    );
  }, [language, uiConfig.scope?.org_id]);

  const loadSettings = useCallback(async () => {
    const username = currentUsername();
    const orgId = uiConfig.scope?.org_id || "";
    if (!username || !orgId || !selectedMandi) return;
    const resp = await getMandiSettings({
      username,
      language,
      filters: {
        org_id: orgId,
        mandi_id: selectedMandi,
      },
    });
    const data = resp?.data || resp?.response?.data || {};
    const settings = data?.settings || {};
    const mode = String(settings?.pre_listing?.approval_mode || "AUTO").toUpperCase();
    setApprovalMode(mode);
    setTrustMinScore(settings?.pre_listing?.trust_min_score?.toString?.() || "");
    setLotCreationMode(String(settings?.workflow_policies?.lot_creation_mode || "").toUpperCase());
    setEffectiveLotCreationMode(String(data?.effective_workflow_policies?.lot_creation_mode || "STRICT_ADMIN_ONLY").toUpperCase());
    setEffectiveLotCreationSource(String(data?.effective_workflow_policies?.source || "DEFAULT").toUpperCase());
    const capacity = settings?.workflow_policies?.auction?.capacity || {};
    setMaxLiveSessions(capacity?.max_live_sessions?.toString?.() || "");
    setMaxOpenSessions(capacity?.max_open_sessions?.toString?.() || "");
    setMaxQueuePerLane(capacity?.max_queue_per_lane?.toString?.() || "");
    setMaxTotalQueuedLots(capacity?.max_total_queued_lots?.toString?.() || "");
    setAllowOverflowLanes(capacity?.allow_overflow_lanes !== false);
    const association = settings?.workflow_policies?.mandi_association || {};
    setFarmerAssociationApprovalMode(String(settings?.farmer_mandi_approval_mode || association?.farmer_approval_mode || "MANUAL_APPROVAL").toUpperCase());
    setTraderAssociationApprovalMode(String(settings?.trader_mandi_approval_mode || association?.trader_approval_mode || "MANUAL_APPROVAL").toUpperCase());
    setAllowFarmerMultiMandi(association?.allow_farmer_multi_mandi !== false);
    setAllowTraderMultiMandi(association?.allow_trader_multi_mandi !== false);
    setRequireFarmerDocuments(association?.require_farmer_documents_for_mandi === true);
    setRequireTraderDocuments(association?.require_trader_documents_for_mandi === true);
    setAllowFarmerGateTokenWithoutApproval(association?.allow_farmer_gate_token_without_mandi_approval === true);
    setAllowTraderBidWithoutApproval(association?.allow_trader_bid_without_mandi_approval === true);
    setMaxPendingMandiRequests((settings?.max_pending_mandi_requests_per_user ?? association?.max_pending_mandi_requests_per_user ?? 5).toString());
    setIsDirty(false);
  }, [language, selectedMandi, uiConfig.scope?.org_id]);

  useEffect(() => {
    if (canView) loadMandis();
  }, [canView, loadMandis]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const markDirty = () => setIsDirty(true);

  const selectedMandiLabel = useMemo(
    () => mandiOptions.find((m) => m.value === selectedMandi)?.label || "No mandi selected",
    [mandiOptions, selectedMandi],
  );

  const onSave = async () => {
    const username = currentUsername();
    const orgId = uiConfig.scope?.org_id || "";
    if (!username || !orgId || !selectedMandi) {
      enqueueSnackbar("Please select a mandi.", { variant: "warning" });
      return;
    }
    setSaving(true);
    try {
      const resp = await upsertMandiSettings({
        username,
        language,
        payload: {
          org_id: orgId,
          mandi_id: selectedMandi,
          pre_listing: {
            approval_mode: approvalMode,
            trust_min_score: approvalMode === "TRUST" && trustMinScore ? Number(trustMinScore) : undefined,
          },
          farmer_mandi_approval_mode: farmerAssociationApprovalMode,
          trader_mandi_approval_mode: traderAssociationApprovalMode,
          max_pending_mandi_requests_per_user: maxPendingMandiRequests ? Number(maxPendingMandiRequests) : 5,
          workflow_policies: {
            lot_creation_mode: lotCreationMode || null,
            auction: {
              capacity: {
                max_live_sessions: maxLiveSessions ? Number(maxLiveSessions) : null,
                max_open_sessions: maxOpenSessions ? Number(maxOpenSessions) : null,
                max_queue_per_lane: maxQueuePerLane ? Number(maxQueuePerLane) : null,
                max_total_queued_lots: maxTotalQueuedLots ? Number(maxTotalQueuedLots) : null,
                allow_overflow_lanes: allowOverflowLanes,
              },
            },
            mandi_association: {
              farmer_approval_mode: farmerAssociationApprovalMode,
              trader_approval_mode: traderAssociationApprovalMode,
              allow_farmer_multi_mandi: allowFarmerMultiMandi,
              allow_trader_multi_mandi: allowTraderMultiMandi,
              require_farmer_documents_for_mandi: requireFarmerDocuments,
              require_trader_documents_for_mandi: requireTraderDocuments,
              allow_farmer_gate_token_without_mandi_approval: allowFarmerGateTokenWithoutApproval,
              allow_trader_bid_without_mandi_approval: allowTraderBidWithoutApproval,
              max_pending_mandi_requests_per_user: maxPendingMandiRequests ? Number(maxPendingMandiRequests) : 5,
            },
          },
        },
      });
      const code = String(resp?.response?.responsecode ?? resp?.data?.responsecode ?? "");
      if (code !== "0") {
        enqueueSnackbar(resp?.response?.description || "Failed to save settings.", { variant: "error" });
        return;
      }
      setIsDirty(false);
      enqueueSnackbar("Mandi settings saved successfully.", { variant: "success" });
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Failed to save settings.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view mandi settings.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack spacing={2}>
        <Paper sx={{ p: 2.5, borderRadius: 2 }}>
          <Typography variant="h5">Mandi Settings</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Configure approval, gate, lot and auction policies for a selected mandi.
          </Typography>
        </Paper>

        <SettingsCard
          title="Select Mandi"
          subtitle="Choose the mandi whose local policy overrides you want to review or edit."
        >
          <FieldGrid>
            <TextField
              select
              label="Mandi"
              value={selectedMandi}
              onChange={(e) => {
                setSelectedMandi(e.target.value);
                setIsDirty(false);
              }}
              helperText="Settings are loaded after a mandi is selected."
            >
              {mandiOptions.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, p: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Current Effective Policy Summary</Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1 }}>
                <Chip size="small" label={selectedMandiLabel} />
                <Chip size="small" label={`Lot: ${labelFromEnum(effectiveLotCreationMode)}`} color="primary" variant="outlined" />
                <Chip size="small" label={`Source: ${labelFromEnum(effectiveLotCreationSource)}`} variant="outlined" />
              </Stack>
            </Box>
          </FieldGrid>
        </SettingsCard>

        <SettingsCard title="Mandi Association Approval">
          <FieldGrid>
            <TextField
              select
              label="Farmer Approval Mode"
              value={farmerAssociationApprovalMode}
              onChange={(e) => {
                setFarmerAssociationApprovalMode(e.target.value);
                markDirty();
              }}
              helperText="Choose whether farmer mandi access is manually reviewed or auto-approved."
            >
              {MANDI_ASSOCIATION_APPROVAL_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {labelFromEnum(opt)}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Trader Approval Mode"
              value={traderAssociationApprovalMode}
              onChange={(e) => {
                setTraderAssociationApprovalMode(e.target.value);
                markDirty();
              }}
              helperText="Trader approval may require KYC, fees, deposits or mandi-level verification."
            >
              {MANDI_ASSOCIATION_APPROVAL_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {labelFromEnum(opt)}
                </MenuItem>
              ))}
            </TextField>
            <PolicyToggle label="Allow Farmer Multi Mandi" helper="Allow a farmer to be approved for more than one mandi." checked={allowFarmerMultiMandi} onChange={() => { setAllowFarmerMultiMandi((prev) => !prev); markDirty(); }} />
            <PolicyToggle label="Allow Trader Multi Mandi" helper="Allow a trader to be approved for more than one mandi." checked={allowTraderMultiMandi} onChange={() => { setAllowTraderMultiMandi((prev) => !prev); markDirty(); }} />
            <PolicyToggle label="Require Farmer Documents" helper="Require farmer documents before mandi approval." checked={requireFarmerDocuments} onChange={() => { setRequireFarmerDocuments((prev) => !prev); markDirty(); }} />
            <PolicyToggle label="Require Trader Documents" helper="Require trader documents before mandi approval." checked={requireTraderDocuments} onChange={() => { setRequireTraderDocuments((prev) => !prev); markDirty(); }} />
            <TextField
              label="Max Pending Requests Per User"
              type="number"
              value={maxPendingMandiRequests}
              onChange={(e) => {
                setMaxPendingMandiRequests(e.target.value);
                markDirty();
              }}
              inputProps={{ min: 1, max: 100 }}
              helperText="Maximum open association requests a user can keep pending."
            />
          </FieldGrid>
        </SettingsCard>

        <SettingsCard title="Access Before Approval">
          <FieldGrid>
            <PolicyToggle label="Farmer Gate Token Without Mandi Approval" helper="Recommended: No. Allows farmer to create gate tokens before approval." checked={allowFarmerGateTokenWithoutApproval} onChange={() => { setAllowFarmerGateTokenWithoutApproval((prev) => !prev); markDirty(); }} />
            <PolicyToggle label="Trader Bid Without Mandi Approval" helper="Recommended: No. Allows trader to bid before approval." checked={allowTraderBidWithoutApproval} onChange={() => { setAllowTraderBidWithoutApproval((prev) => !prev); markDirty(); }} />
          </FieldGrid>
        </SettingsCard>

        <SettingsCard title="Gate / Lot Policy">
          <FieldGrid>
            <TextField
              select
              label="Approval Mode"
              value={approvalMode}
              onChange={(e) => {
                setApprovalMode(e.target.value);
                markDirty();
              }}
              helperText="Controls approval for pre-market listing submissions."
            >
              {PRELISTING_APPROVAL_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </TextField>
            {approvalMode === "TRUST" ? (
              <TextField
                label="Trust Min Score"
                type="number"
                value={trustMinScore}
                onChange={(e) => {
                  setTrustMinScore(e.target.value);
                  markDirty();
                }}
                helperText="Minimum trust score required for automatic prelisting approval."
              />
            ) : null}
            <TextField
              select
              label="Lot Creation Mode"
              value={lotCreationMode}
              onChange={(e) => {
                setLotCreationMode(e.target.value);
                markDirty();
              }}
              helperText="Controls whether gate operators can create lots immediately after marking a token IN_YARD."
            >
              {LOT_CREATION_OPTIONS.map((opt) => (
                <MenuItem key={opt.value || "__inherit__"} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </TextField>
            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.5, p: 1.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Effective Value</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {labelFromEnum(effectiveLotCreationMode)} from {labelFromEnum(effectiveLotCreationSource)}.
              </Typography>
            </Box>
          </FieldGrid>
        </SettingsCard>

        <SettingsCard title="Auction Capacity Override" subtitle="These local mandi limits should stay within organisation allocation.">
          <FieldGrid>
            <TextField label="Max Live Sessions" type="number" value={maxLiveSessions} onChange={(e) => { setMaxLiveSessions(e.target.value); markDirty(); }} helperText="Maximum live auction sessions allowed at the same time." />
            <TextField label="Max Open Sessions" type="number" value={maxOpenSessions} onChange={(e) => { setMaxOpenSessions(e.target.value); markDirty(); }} helperText="Maximum open sessions that can accept lots." />
            <TextField label="Max Queue Per Lane" type="number" value={maxQueuePerLane} onChange={(e) => { setMaxQueuePerLane(e.target.value); markDirty(); }} helperText="Maximum queued lots per auction lane." />
            <TextField label="Max Total Queued Lots" type="number" value={maxTotalQueuedLots} onChange={(e) => { setMaxTotalQueuedLots(e.target.value); markDirty(); }} helperText="Maximum queued lots across all lanes." />
            <PolicyToggle label="Allow Overflow Lanes" helper="Allow temporary overflow lanes if configured capacity is exceeded." checked={allowOverflowLanes} onChange={() => { setAllowOverflowLanes((prev) => !prev); markDirty(); }} />
          </FieldGrid>
        </SettingsCard>

        <Paper sx={{ p: 2, borderRadius: 2, position: "sticky", bottom: 16, zIndex: 1 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ xs: "stretch", sm: "center" }} justifyContent="space-between">
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Save changes for this mandi</Typography>
              <Typography variant="caption" color="text.secondary">
                {isDirty ? "Unsaved changes are ready to save." : "No unsaved changes."}
              </Typography>
            </Box>
            <Divider flexItem orientation="vertical" sx={{ display: { xs: "none", sm: "block" } }} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button variant="outlined" onClick={loadSettings} disabled={!selectedMandi || saving || !isDirty}>
                Reset Changes
              </Button>
              {canEdit ? (
                <Button variant="contained" onClick={onSave} disabled={!selectedMandi || saving}>
                  {saving ? "Saving..." : "Save Mandi Settings"}
                </Button>
              ) : null}
            </Stack>
          </Stack>
        </Paper>

        {/* <SettingsCard title="E. Save Actions">
          {canEdit ? (
            <Button variant="contained" onClick={onSave}>
              Save Settings
            </Button>
          ) : null}
        </SettingsCard> */}
      </Stack>
    </PageContainer>
  );
};

// import React, { useCallback, useEffect, useMemo, useState } from "react";
// import {
//   Box,
//   Button,
//   MenuItem,
//   Stack,
//   TextField,
//   Typography,
// } from "@mui/material";
// import { useSnackbar } from "notistack";
// import { useTranslation } from "react-i18next";
// import { PageContainer } from "../../components/PageContainer";
// import { normalizeLanguageCode } from "../../config/languages";
// import { useAdminUiConfig } from "../../contexts/admin-ui-config";
// import { usePermissions } from "../../authz/usePermissions";
// import { getMandisForCurrentScope } from "../../services/mandiApi";
// import { getMandiSettings, upsertMandiSettings } from "../../services/mandiSettingsApi";

// type Option = { value: string; label: string };
// const LOT_CREATION_OPTIONS = [
//   { value: "", label: "Use Org Default" },
//   { value: "STRICT_ADMIN_ONLY", label: "Strict Admin Only" },
//   { value: "GATE_OPERATOR_ALLOWED", label: "Gate Operator Allowed" },
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

// export const MandiSettings: React.FC = () => {
//   const { i18n } = useTranslation();
//   const language = normalizeLanguageCode(i18n.language);
//   const { enqueueSnackbar } = useSnackbar();
//   const uiConfig = useAdminUiConfig();
//   const { can } = usePermissions();

//   const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
//   const [selectedMandi, setSelectedMandi] = useState("");
//   const [approvalMode, setApprovalMode] = useState("AUTO");
//   const [trustMinScore, setTrustMinScore] = useState("");
//   const [lotCreationMode, setLotCreationMode] = useState("");
//   const [effectiveLotCreationMode, setEffectiveLotCreationMode] = useState("STRICT_ADMIN_ONLY");
//   const [effectiveLotCreationSource, setEffectiveLotCreationSource] = useState("DEFAULT");

//   const canView = useMemo(
//     () => can("mandi_settings.menu", "VIEW"),
//     [can],
//   );
//   const canEdit = useMemo(
//     () => can("mandi_settings.edit", "UPDATE"),
//     [can],
//   );

//   const loadMandis = useCallback(async () => {
//     const username = currentUsername();
//     const orgId = uiConfig.scope?.org_id || "";
//     if (!username || !orgId) return;
//     const list = await getMandisForCurrentScope({
//       username,
//       language,
//       org_id: orgId,
//     });
//     setMandiOptions(
//       (list || []).map((m: any) => ({
//         value: String(m.mandi_id ?? m.mandiId ?? ""),
//         label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
//       })),
//     );
//   }, [language, uiConfig.scope?.org_id]);

//   const loadSettings = useCallback(async () => {
//     const username = currentUsername();
//     const orgId = uiConfig.scope?.org_id || "";
//     if (!username || !orgId || !selectedMandi) return;
//     const resp = await getMandiSettings({
//       username,
//       language,
//       filters: {
//         org_id: orgId,
//         mandi_id: selectedMandi,
//       },
//     });
//     const data = resp?.data || resp?.response?.data || {};
//     const settings = data?.settings || {};
//     const mode = String(settings?.pre_listing?.approval_mode || "AUTO").toUpperCase();
//     setApprovalMode(mode);
//     setTrustMinScore(settings?.pre_listing?.trust_min_score?.toString?.() || "");
//     setLotCreationMode(String(settings?.workflow_policies?.lot_creation_mode || "").toUpperCase());
//     setEffectiveLotCreationMode(String(data?.effective_workflow_policies?.lot_creation_mode || "STRICT_ADMIN_ONLY").toUpperCase());
//     setEffectiveLotCreationSource(String(data?.effective_workflow_policies?.source || "DEFAULT").toUpperCase());
//   }, [language, selectedMandi, uiConfig.scope?.org_id]);

//   useEffect(() => {
//     if (canView) loadMandis();
//   }, [canView, loadMandis]);

//   useEffect(() => {
//     loadSettings();
//   }, [loadSettings]);

//   const onSave = async () => {
//     const username = currentUsername();
//     const orgId = uiConfig.scope?.org_id || "";
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
//         pre_listing: {
//           approval_mode: approvalMode,
//           trust_min_score: approvalMode === "TRUST" && trustMinScore ? Number(trustMinScore) : undefined,
//         },
//         workflow_policies: {
//           lot_creation_mode: lotCreationMode || null,
//         },
//       },
//     });
//     const code = String(resp?.response?.responsecode ?? resp?.data?.responsecode ?? "");
//     if (code !== "0") {
//       enqueueSnackbar(resp?.response?.description || "Failed to save settings.", { variant: "error" });
//       return;
//     }
//     enqueueSnackbar("Settings saved.", { variant: "success" });
//   };

//   if (!canView) {
//     return (
//       <PageContainer>
//         <Typography variant="h6">Not authorized to view mandi settings.</Typography>
//       </PageContainer>
//     );
//   }

//   return (
//     <PageContainer>
//       <Stack spacing={0.5} mb={2}>
//         <Typography variant="h5">Mandi Settings</Typography>
//         <Typography variant="body2" color="text.secondary">
//           Configure prelisting approval mode per mandi.
//         </Typography>
//       </Stack>

//       <Box sx={{ maxWidth: 700 }}>
//         <Stack spacing={2}>
//           <TextField
//             select
//             label="Mandi"
//             value={selectedMandi}
//             onChange={(e) => setSelectedMandi(e.target.value)}
//           >
//             {mandiOptions.map((m) => (
//               <MenuItem key={m.value} value={m.value}>
//                 {m.label}
//               </MenuItem>
//             ))}
//           </TextField>
//           <TextField
//             select
//             label="Approval Mode"
//             value={approvalMode}
//             onChange={(e) => setApprovalMode(e.target.value)}
//           >
//             {["AUTO", "MANUAL", "TRUST"].map((opt) => (
//               <MenuItem key={opt} value={opt}>
//                 {opt}
//               </MenuItem>
//             ))}
//           </TextField>
//           {approvalMode === "TRUST" ? (
//             <TextField
//               label="Trust Min Score"
//               type="number"
//               value={trustMinScore}
//               onChange={(e) => setTrustMinScore(e.target.value)}
//             />
//           ) : null}
//           <TextField
//             select
//             label="Lot Creation Mode"
//             value={lotCreationMode}
//             onChange={(e) => setLotCreationMode(e.target.value)}
//             helperText="Controls whether gate operators can create lots immediately after marking a token IN_YARD."
//           >
//             {LOT_CREATION_OPTIONS.map((opt) => (
//               <MenuItem key={opt.value || "__inherit__"} value={opt.value}>
//                 {opt.label}
//               </MenuItem>
//             ))}
//           </TextField>
//           <Typography variant="body2" color="text.secondary">
//             Effective value: {effectiveLotCreationMode} ({effectiveLotCreationSource})
//           </Typography>
//           {canEdit ? (
//             <Button variant="contained" onClick={onSave}>
//               Save Settings
//             </Button>
//           ) : null}
//         </Stack>
//       </Box>
//     </PageContainer>
//   );
// };
