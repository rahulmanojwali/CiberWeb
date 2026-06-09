import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  MenuItem,
  Stack,
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

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
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
  }, [language, selectedMandi, uiConfig.scope?.org_id]);

  useEffect(() => {
    if (canView) loadMandis();
  }, [canView, loadMandis]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const onSave = async () => {
    const username = currentUsername();
    const orgId = uiConfig.scope?.org_id || "";
    if (!username || !orgId || !selectedMandi) {
      enqueueSnackbar("Please select a mandi.", { variant: "warning" });
      return;
    }
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
    enqueueSnackbar("Settings saved.", { variant: "success" });
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
      <Stack spacing={0.5} mb={2}>
        <Typography variant="h5">Mandi Settings</Typography>
        <Typography variant="body2" color="text.secondary">
          Configure prelisting approval mode per mandi.
        </Typography>
      </Stack>

      <Box sx={{ maxWidth: 700 }}>
        <Stack spacing={2}>
          <TextField
            select
            label="Mandi"
            value={selectedMandi}
            onChange={(e) => setSelectedMandi(e.target.value)}
          >
            {mandiOptions.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Approval Mode"
            value={approvalMode}
            onChange={(e) => setApprovalMode(e.target.value)}
          >
            {["AUTO", "MANUAL", "TRUST"].map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          {approvalMode === "TRUST" ? (
            <TextField
              label="Trust Min Score"
              type="number"
              value={trustMinScore}
              onChange={(e) => setTrustMinScore(e.target.value)}
            />
          ) : null}
          <TextField
            select
            label="Lot Creation Mode"
            value={lotCreationMode}
            onChange={(e) => setLotCreationMode(e.target.value)}
            helperText="Controls whether gate operators can create lots immediately after marking a token IN_YARD."
          >
            {LOT_CREATION_OPTIONS.map((opt) => (
              <MenuItem key={opt.value || "__inherit__"} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2" color="text.secondary">
            Effective value: {effectiveLotCreationMode} ({effectiveLotCreationSource})
          </Typography>
          <Typography variant="subtitle2">Mandi Association Approval</Typography>
          <TextField
            select
            label="farmer_mandi_approval_mode"
            value={farmerAssociationApprovalMode}
            onChange={(e) => setFarmerAssociationApprovalMode(e.target.value)}
          >
            {MANDI_ASSOCIATION_APPROVAL_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="trader_mandi_approval_mode"
            value={traderAssociationApprovalMode}
            onChange={(e) => setTraderAssociationApprovalMode(e.target.value)}
          >
            {MANDI_ASSOCIATION_APPROVAL_OPTIONS.map((opt) => (
              <MenuItem key={opt} value={opt}>
                {opt}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography>Allow Farmer Multi Mandi</Typography>
            <Button variant="text" onClick={() => setAllowFarmerMultiMandi((prev) => !prev)}>
              {allowFarmerMultiMandi ? "Yes" : "No"}
            </Button>
          </Stack>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography>Allow Trader Multi Mandi</Typography>
            <Button variant="text" onClick={() => setAllowTraderMultiMandi((prev) => !prev)}>
              {allowTraderMultiMandi ? "Yes" : "No"}
            </Button>
          </Stack>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography>Require Farmer Documents for Mandi</Typography>
            <Button variant="text" onClick={() => setRequireFarmerDocuments((prev) => !prev)}>
              {requireFarmerDocuments ? "Yes" : "No"}
            </Button>
          </Stack>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography>Require Trader Documents for Mandi</Typography>
            <Button variant="text" onClick={() => setRequireTraderDocuments((prev) => !prev)}>
              {requireTraderDocuments ? "Yes" : "No"}
            </Button>
          </Stack>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography>Farmer Gate Token Without Mandi Approval</Typography>
            <Button variant="text" onClick={() => setAllowFarmerGateTokenWithoutApproval((prev) => !prev)}>
              {allowFarmerGateTokenWithoutApproval ? "Yes" : "No"}
            </Button>
          </Stack>
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography>Trader Bid Without Mandi Approval</Typography>
            <Button variant="text" onClick={() => setAllowTraderBidWithoutApproval((prev) => !prev)}>
              {allowTraderBidWithoutApproval ? "Yes" : "No"}
            </Button>
          </Stack>
          <TextField
            label="max_pending_mandi_requests_per_user"
            type="number"
            value={maxPendingMandiRequests}
            onChange={(e) => setMaxPendingMandiRequests(e.target.value)}
            inputProps={{ min: 1, max: 100 }}
          />
          <Typography variant="subtitle2">Auction Capacity Override</Typography>
          <Typography variant="body2" color="text.secondary">
            These local mandi limits should stay within organisation allocation.
          </Typography>
          <TextField
            label="Max Live Sessions"
            type="number"
            value={maxLiveSessions}
            onChange={(e) => setMaxLiveSessions(e.target.value)}
          />
          <TextField
            label="Max Open Sessions"
            type="number"
            value={maxOpenSessions}
            onChange={(e) => setMaxOpenSessions(e.target.value)}
          />
          <TextField
            label="Max Queue Per Lane"
            type="number"
            value={maxQueuePerLane}
            onChange={(e) => setMaxQueuePerLane(e.target.value)}
          />
          <TextField
            label="Max Total Queued Lots"
            type="number"
            value={maxTotalQueuedLots}
            onChange={(e) => setMaxTotalQueuedLots(e.target.value)}
          />
          <Stack direction="row" alignItems="center" justifyContent="space-between">
            <Typography>Allow Overflow Lanes</Typography>
            <Button variant="text" onClick={() => setAllowOverflowLanes((prev) => !prev)}>
              {allowOverflowLanes ? "Yes" : "No"}
            </Button>
          </Stack>
          {canEdit ? (
            <Button variant="contained" onClick={onSave}>
              Save Settings
            </Button>
          ) : null}
        </Stack>
      </Box>
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
