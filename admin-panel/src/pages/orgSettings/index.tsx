import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Card, CardContent, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import { PageContainer } from "../../components/PageContainer";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { useTranslation } from "react-i18next";
import { normalizeLanguageCode } from "../../config/languages";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import { getOrgSettings, upsertOrgSettings } from "../../services/orgSettingsApi";

type Option = { value: string; label: string };
const LOT_CREATION_OPTIONS = [
  { value: "STRICT_ADMIN_ONLY", label: "Strict Admin Only" },
  { value: "GATE_OPERATOR_ALLOWED", label: "Gate Operator Allowed" },
  { value: "FARMER_ALLOWED", label: "Farmer Allowed" },
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

export const OrgSettings: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();

  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState<any>(null);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [defaultMandis, setDefaultMandis] = useState<string[]>([]);
  const [autoApproveFarmers, setAutoApproveFarmers] = useState(false);
  const [autoApproveTraders, setAutoApproveTraders] = useState(false);
  const [lotCreationMode, setLotCreationMode] = useState("STRICT_ADMIN_ONLY");
  const [tierCode, setTierCode] = useState("");
  const [maxLiveSessions, setMaxLiveSessions] = useState("");
  const [maxOpenSessions, setMaxOpenSessions] = useState("");
  const [maxTotalQueuedLots, setMaxTotalQueuedLots] = useState("");
  const [maxConcurrentBidders, setMaxConcurrentBidders] = useState("");
  const [allowOverflowLanes, setAllowOverflowLanes] = useState(true);
  const [allowSpecialEventLanes, setAllowSpecialEventLanes] = useState(false);
  const [priorityWeight, setPriorityWeight] = useState("");
  const [reservedCapacityEnabled, setReservedCapacityEnabled] = useState(false);

  const canView = useMemo(() => can("org_settings.menu", "VIEW"), [can]);
  const canEdit = useMemo(() => can("org_settings.edit", "UPDATE"), [can]);

  const loadMandis = async () => {
    const username = currentUsername();
    const orgId = uiConfig.scope?.org_id || "";
    if (!username || !orgId) return;
    const list = await getMandisForCurrentScope({ username, language, org_id: orgId });
    setMandiOptions(
      (list || []).map((m: any) => ({
        value: String(m.mandi_id ?? m.mandiId ?? ""),
        label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
      })),
    );
  };

  const loadSettings = async () => {
    const username = currentUsername();
    const orgId = uiConfig.scope?.org_id || "";
    if (!username || !orgId) return;
    setLoading(true);
    try {
      const resp = await getOrgSettings({ username, language, payload: { org_id: orgId } });
      const data = resp?.data?.settings || resp?.response?.data?.settings || null;
      setSettings(data);
      setAutoApproveFarmers(String(data?.auto_approve_farmers_on_registration || "N") === "Y");
      setAutoApproveTraders(String(data?.auto_approve_traders_on_registration || "N") === "Y");
      setDefaultMandis(Array.isArray(data?.default_mandi_ids_for_auto_approval) ? data.default_mandi_ids_for_auto_approval.map(String) : []);
      setLotCreationMode(String(data?.workflow_policies?.auction?.lot_creation_mode || data?.workflow_policies?.lot_creation_mode || "STRICT_ADMIN_ONLY").toUpperCase());
      const capacity = data?.workflow_policies?.auction?.capacity || {};
      setTierCode(String(capacity?.tier_code || ""));
      setMaxLiveSessions(capacity?.max_live_sessions?.toString?.() || "");
      setMaxOpenSessions(capacity?.max_open_sessions?.toString?.() || "");
      setMaxTotalQueuedLots(capacity?.max_total_queued_lots?.toString?.() || "");
      setMaxConcurrentBidders(capacity?.max_concurrent_bidders?.toString?.() || "");
      setAllowOverflowLanes(capacity?.allow_overflow_lanes !== false);
      setAllowSpecialEventLanes(capacity?.allow_special_event_lanes === true);
      setPriorityWeight(capacity?.priority_weight?.toString?.() || capacity?.capacity_weight?.toString?.() || "");
      setReservedCapacityEnabled(Boolean(capacity?.reserved_capacity_enabled));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      loadMandis();
      loadSettings();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, uiConfig.scope?.org_id, language]);

  const handleSave = async () => {
    const username = currentUsername();
    const orgId = uiConfig.scope?.org_id || "";
    if (!username || !orgId) return;
    await upsertOrgSettings({
      username,
      language,
      payload: {
        org_id: orgId,
        auto_approve_farmers_on_registration: autoApproveFarmers ? "Y" : "N",
        auto_approve_traders_on_registration: autoApproveTraders ? "Y" : "N",
        default_mandi_ids_for_auto_approval: defaultMandis,
        workflow_policies: {
          lot_creation_mode: lotCreationMode,
          auction: {
            lot_creation_mode: lotCreationMode,
            capacity: {
              tier_code: tierCode || null,
              max_live_sessions: maxLiveSessions ? Number(maxLiveSessions) : null,
              max_open_sessions: maxOpenSessions ? Number(maxOpenSessions) : null,
              max_total_queued_lots: maxTotalQueuedLots ? Number(maxTotalQueuedLots) : null,
              max_concurrent_bidders: maxConcurrentBidders ? Number(maxConcurrentBidders) : null,
              allow_overflow_lanes: allowOverflowLanes,
              allow_special_event_lanes: allowSpecialEventLanes,
              priority_weight: priorityWeight ? Number(priorityWeight) : null,
              reserved_capacity_enabled: reservedCapacityEnabled,
            },
          },
        },
      },
    });
    loadSettings();
  };

  if (!canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view org settings.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">Org Settings</Typography>
          <Typography variant="body2" color="text.secondary">
            Configure auto-approval behavior for farmer/trader registrations.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="contained" onClick={handleSave} disabled={!canEdit || loading}>
            Save
          </Button>
        </Stack>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Auto approve farmers on registration</Typography>
              <Switch checked={autoApproveFarmers} onChange={(e) => setAutoApproveFarmers(e.target.checked)} />
            </Stack>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Auto approve traders on registration</Typography>
              <Switch checked={autoApproveTraders} onChange={(e) => setAutoApproveTraders(e.target.checked)} />
            </Stack>
            <Box>
              <TextField
                select
                label="Lot Creation Mode"
                value={lotCreationMode}
                onChange={(e) => setLotCreationMode(e.target.value)}
                fullWidth
                helperText="Controls whether gate operators can create lots immediately after marking a token IN_YARD."
              >
                {LOT_CREATION_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
            <Box>
              <TextField
                select
                label="Default Mandis for Auto Approval"
                SelectProps={{ multiple: true }}
                value={defaultMandis}
                onChange={(e) =>
                  setDefaultMandis(
                    typeof e.target.value === "string" ? e.target.value.split(",") : (e.target.value as string[]),
                  )
                }
                fullWidth
              >
                {mandiOptions.map((m) => (
                  <MenuItem key={m.value} value={m.value}>
                    {m.label}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Auction Capacity Allocation</Typography>
            <Typography variant="body2" color="text.secondary">
              These values set the organisation-level auction quota that mandi overrides must stay within.
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                select
                label="Tier Code"
                value={tierCode}
                onChange={(e) => setTierCode(e.target.value)}
                fullWidth
              >
                <MenuItem value="">Custom</MenuItem>
                {["STARTER", "STANDARD", "PREMIUM", "ENTERPRISE", "DEDICATED"].map((tier) => (
                  <MenuItem key={tier} value={tier}>{tier}</MenuItem>
                ))}
              </TextField>
              <TextField label="Max Live Lanes" type="number" value={maxLiveSessions} onChange={(e) => setMaxLiveSessions(e.target.value)} fullWidth />
              <TextField label="Max Open Lanes" type="number" value={maxOpenSessions} onChange={(e) => setMaxOpenSessions(e.target.value)} fullWidth />
            </Stack>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField label="Max Total Queued Lots" type="number" value={maxTotalQueuedLots} onChange={(e) => setMaxTotalQueuedLots(e.target.value)} fullWidth />
              <TextField label="Max Concurrent Bidders" type="number" value={maxConcurrentBidders} onChange={(e) => setMaxConcurrentBidders(e.target.value)} fullWidth />
              <TextField label="Priority Weight" type="number" value={priorityWeight} onChange={(e) => setPriorityWeight(e.target.value)} fullWidth />
            </Stack>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Overflow Lanes Allowed</Typography>
              <Switch checked={allowOverflowLanes} onChange={(e) => setAllowOverflowLanes(e.target.checked)} />
            </Stack>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Special Event Lanes Allowed</Typography>
              <Switch checked={allowSpecialEventLanes} onChange={(e) => setAllowSpecialEventLanes(e.target.checked)} />
            </Stack>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Typography>Reserved Capacity Enabled</Typography>
              <Switch checked={reservedCapacityEnabled} onChange={(e) => setReservedCapacityEnabled(e.target.checked)} />
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </PageContainer>
  );
};

// import React, { useEffect, useMemo, useState } from "react";
// import { Box, Button, Card, CardContent, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
// import { PageContainer } from "../../components/PageContainer";
// import { useAdminUiConfig } from "../../contexts/admin-ui-config";
// import { usePermissions } from "../../authz/usePermissions";
// import { useTranslation } from "react-i18next";
// import { normalizeLanguageCode } from "../../config/languages";
// import { getMandisForCurrentScope } from "../../services/mandiApi";
// import { getOrgSettings, upsertOrgSettings } from "../../services/orgSettingsApi";

// type Option = { value: string; label: string };
// const LOT_CREATION_OPTIONS = [
//   { value: "STRICT_ADMIN_ONLY", label: "Strict Admin Only" },
//   { value: "GATE_OPERATOR_ALLOWED", label: "Gate Operator Allowed" },
//   { value: "FARMER_ALLOWED", label: "Farmer Allowed" },
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

// export const OrgSettings: React.FC = () => {
//   const { i18n } = useTranslation();
//   const language = normalizeLanguageCode(i18n.language);
//   const uiConfig = useAdminUiConfig();
//   const { can } = usePermissions();

//   const [loading, setLoading] = useState(false);
//   const [settings, setSettings] = useState<any>(null);
//   const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
//   const [defaultMandis, setDefaultMandis] = useState<string[]>([]);
//   const [autoApproveFarmers, setAutoApproveFarmers] = useState(false);
//   const [autoApproveTraders, setAutoApproveTraders] = useState(false);
//   const [lotCreationMode, setLotCreationMode] = useState("STRICT_ADMIN_ONLY");

//   const canView = useMemo(() => can("org_settings.menu", "VIEW"), [can]);
//   const canEdit = useMemo(() => can("org_settings.edit", "UPDATE"), [can]);

//   const loadMandis = async () => {
//     const username = currentUsername();
//     const orgId = uiConfig.scope?.org_id || "";
//     if (!username || !orgId) return;
//     const list = await getMandisForCurrentScope({ username, language, org_id: orgId });
//     setMandiOptions(
//       (list || []).map((m: any) => ({
//         value: String(m.mandi_id ?? m.mandiId ?? ""),
//         label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
//       })),
//     );
//   };

//   const loadSettings = async () => {
//     const username = currentUsername();
//     const orgId = uiConfig.scope?.org_id || "";
//     if (!username || !orgId) return;
//     setLoading(true);
//     try {
//       const resp = await getOrgSettings({ username, language, payload: { org_id: orgId } });
//       const data = resp?.data?.settings || resp?.response?.data?.settings || null;
//       setSettings(data);
//       setAutoApproveFarmers(String(data?.auto_approve_farmers_on_registration || "N") === "Y");
//       setAutoApproveTraders(String(data?.auto_approve_traders_on_registration || "N") === "Y");
//       setDefaultMandis(Array.isArray(data?.default_mandi_ids_for_auto_approval) ? data.default_mandi_ids_for_auto_approval.map(String) : []);
//       setLotCreationMode(String(data?.workflow_policies?.auction?.lot_creation_mode || data?.workflow_policies?.lot_creation_mode || "STRICT_ADMIN_ONLY").toUpperCase());
//     } finally {
//       setLoading(false);
//     }
//   };

//   useEffect(() => {
//     if (canView) {
//       loadMandis();
//       loadSettings();
//     }
//     // eslint-disable-next-line react-hooks/exhaustive-deps
//   }, [canView, uiConfig.scope?.org_id, language]);

//   const handleSave = async () => {
//     const username = currentUsername();
//     const orgId = uiConfig.scope?.org_id || "";
//     if (!username || !orgId) return;
//     await upsertOrgSettings({
//       username,
//       language,
//       payload: {
//         org_id: orgId,
//         auto_approve_farmers_on_registration: autoApproveFarmers ? "Y" : "N",
//         auto_approve_traders_on_registration: autoApproveTraders ? "Y" : "N",
//         default_mandi_ids_for_auto_approval: defaultMandis,
//         workflow_policies: {
//           lot_creation_mode: lotCreationMode,
//           auction: {
//             lot_creation_mode: lotCreationMode,
//           },
//         },
//       },
//     });
//     loadSettings();
//   };

//   if (!canView) {
//     return (
//       <PageContainer>
//         <Typography variant="h6">Not authorized to view org settings.</Typography>
//       </PageContainer>
//     );
//   }

//   return (
//     <PageContainer>
//       <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
//         <Stack spacing={0.5}>
//           <Typography variant="h5">Org Settings</Typography>
//           <Typography variant="body2" color="text.secondary">
//             Configure auto-approval behavior for farmer/trader registrations.
//           </Typography>
//         </Stack>
//         <Stack direction="row" spacing={1}>
//           <Button variant="contained" onClick={handleSave} disabled={!canEdit || loading}>
//             Save
//           </Button>
//         </Stack>
//       </Stack>

//       <Card sx={{ mb: 2 }}>
//         <CardContent>
//           <Stack spacing={2}>
//             <Stack direction="row" alignItems="center" justifyContent="space-between">
//               <Typography>Auto approve farmers on registration</Typography>
//               <Switch checked={autoApproveFarmers} onChange={(e) => setAutoApproveFarmers(e.target.checked)} />
//             </Stack>
//             <Stack direction="row" alignItems="center" justifyContent="space-between">
//               <Typography>Auto approve traders on registration</Typography>
//               <Switch checked={autoApproveTraders} onChange={(e) => setAutoApproveTraders(e.target.checked)} />
//             </Stack>
//             <Box>
//               <TextField
//                 select
//                 label="Lot Creation Mode"
//                 value={lotCreationMode}
//                 onChange={(e) => setLotCreationMode(e.target.value)}
//                 fullWidth
//                 helperText="Controls whether gate operators can create lots immediately after marking a token IN_YARD."
//               >
//                 {LOT_CREATION_OPTIONS.map((opt) => (
//                   <MenuItem key={opt.value} value={opt.value}>
//                     {opt.label}
//                   </MenuItem>
//                 ))}
//               </TextField>
//             </Box>
//             <Box>
//               <TextField
//                 select
//                 label="Default Mandis for Auto Approval"
//                 SelectProps={{ multiple: true }}
//                 value={defaultMandis}
//                 onChange={(e) =>
//                   setDefaultMandis(
//                     typeof e.target.value === "string" ? e.target.value.split(",") : (e.target.value as string[]),
//                   )
//                 }
//                 fullWidth
//               >
//                 {mandiOptions.map((m) => (
//                   <MenuItem key={m.value} value={m.value}>
//                     {m.label}
//                   </MenuItem>
//                 ))}
//               </TextField>
//             </Box>
//           </Stack>
//         </CardContent>
//       </Card>
//     </PageContainer>
//   );
// };
