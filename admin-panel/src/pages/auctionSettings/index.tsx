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
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import SettingsSuggestOutlinedIcon from "@mui/icons-material/SettingsSuggestOutlined";
import AutoModeOutlinedIcon from "@mui/icons-material/AutoModeOutlined";
import GavelOutlinedIcon from "@mui/icons-material/GavelOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import AdminPanelSettingsOutlinedIcon from "@mui/icons-material/AdminPanelSettingsOutlined";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import { getAuctionSettings, upsertAuctionSettings } from "../../services/auctionSettingsApi";

type Option = { value: string; label: string };

type AuctionSettingsState = {
  session_flow: { mode: string };
  lot_progression: { next_lot_mode: string; auto_start_delay_seconds: string };
  bid_handling: {
    close_mode: string;
    inactivity_timeout_seconds: string;
    extend_on_last_second_bid: boolean;
    extension_duration_seconds: string;
  };
  result_finalization: { mode: string };
  settlement: { mode: string };
  eligibility_validation: {
    only_eligible_verified_lots: boolean;
    skip_invalid_lots_automatically: boolean;
  };
  override_permissions: {
    admin_override_allowed: boolean;
    mandi_operator_override_allowed: boolean;
  };
};

const DEFAULT_SETTINGS: AuctionSettingsState = {
  session_flow: { mode: "MANUAL" },
  lot_progression: { next_lot_mode: "MANUAL", auto_start_delay_seconds: "15" },
  bid_handling: {
    close_mode: "MANUAL",
    inactivity_timeout_seconds: "30",
    extend_on_last_second_bid: true,
    extension_duration_seconds: "15",
  },
  result_finalization: { mode: "MANUAL" },
  settlement: { mode: "MANUAL" },
  eligibility_validation: {
    only_eligible_verified_lots: true,
    skip_invalid_lots_automatically: true,
  },
  override_permissions: {
    admin_override_allowed: true,
    mandi_operator_override_allowed: false,
  },
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

function toFormState(input: any): AuctionSettingsState {
  const source = input && typeof input === "object" ? input : {};
  return {
    session_flow: { mode: String(source?.session_flow?.mode || DEFAULT_SETTINGS.session_flow.mode).toUpperCase() },
    lot_progression: {
      next_lot_mode: String(source?.lot_progression?.next_lot_mode || DEFAULT_SETTINGS.lot_progression.next_lot_mode).toUpperCase(),
      auto_start_delay_seconds: String(source?.lot_progression?.auto_start_delay_seconds ?? DEFAULT_SETTINGS.lot_progression.auto_start_delay_seconds),
    },
    bid_handling: {
      close_mode: String(source?.bid_handling?.close_mode || DEFAULT_SETTINGS.bid_handling.close_mode).toUpperCase(),
      inactivity_timeout_seconds: String(source?.bid_handling?.inactivity_timeout_seconds ?? DEFAULT_SETTINGS.bid_handling.inactivity_timeout_seconds),
      extend_on_last_second_bid: Boolean(source?.bid_handling?.extend_on_last_second_bid ?? DEFAULT_SETTINGS.bid_handling.extend_on_last_second_bid),
      extension_duration_seconds: String(source?.bid_handling?.extension_duration_seconds ?? DEFAULT_SETTINGS.bid_handling.extension_duration_seconds),
    },
    result_finalization: { mode: String(source?.result_finalization?.mode || DEFAULT_SETTINGS.result_finalization.mode).toUpperCase() },
    settlement: { mode: String(source?.settlement?.mode || DEFAULT_SETTINGS.settlement.mode).toUpperCase() },
    eligibility_validation: {
      only_eligible_verified_lots: Boolean(source?.eligibility_validation?.only_eligible_verified_lots ?? DEFAULT_SETTINGS.eligibility_validation.only_eligible_verified_lots),
      skip_invalid_lots_automatically: Boolean(source?.eligibility_validation?.skip_invalid_lots_automatically ?? DEFAULT_SETTINGS.eligibility_validation.skip_invalid_lots_automatically),
    },
    override_permissions: {
      admin_override_allowed: Boolean(source?.override_permissions?.admin_override_allowed ?? DEFAULT_SETTINGS.override_permissions.admin_override_allowed),
      mandi_operator_override_allowed: Boolean(source?.override_permissions?.mandi_operator_override_allowed ?? DEFAULT_SETTINGS.override_permissions.mandi_operator_override_allowed),
    },
  };
}

function toPayload(settings: AuctionSettingsState) {
  return {
    session_flow: { mode: settings.session_flow.mode },
    lot_progression: {
      next_lot_mode: settings.lot_progression.next_lot_mode,
      auto_start_delay_seconds: Number(settings.lot_progression.auto_start_delay_seconds || 0),
    },
    bid_handling: {
      close_mode: settings.bid_handling.close_mode,
      inactivity_timeout_seconds: Number(settings.bid_handling.inactivity_timeout_seconds || 0),
      extend_on_last_second_bid: settings.bid_handling.extend_on_last_second_bid,
      extension_duration_seconds: Number(settings.bid_handling.extension_duration_seconds || 0),
    },
    result_finalization: { mode: settings.result_finalization.mode },
    settlement: { mode: settings.settlement.mode },
    eligibility_validation: {
      only_eligible_verified_lots: settings.eligibility_validation.only_eligible_verified_lots,
      skip_invalid_lots_automatically: settings.eligibility_validation.skip_invalid_lots_automatically,
    },
    override_permissions: {
      admin_override_allowed: settings.override_permissions.admin_override_allowed,
      mandi_operator_override_allowed: settings.override_permissions.mandi_operator_override_allowed,
    },
  };
}

const SectionCard: React.FC<{
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}> = ({ icon, title, subtitle, children }) => (
  <Card
    elevation={0}
    sx={{
      borderRadius: 3,
      border: "1px solid",
      borderColor: "divider",
      bgcolor: "common.white",
    }}
  >
    <CardContent sx={{ p: { xs: 2, md: 2.5 }, "&:last-child": { pb: { xs: 2, md: 2.5 } } }}>
      <Stack spacing={2}>
        <Stack direction="row" spacing={1.5} alignItems="flex-start">
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              display: "grid",
              placeItems: "center",
              bgcolor: "rgba(77, 107, 56, 0.08)",
              color: "success.dark",
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontSize: 17, fontWeight: 700 }}>
              {title}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {subtitle}
            </Typography>
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
  const [settings, setSettings] = useState<AuctionSettingsState>(DEFAULT_SETTINGS);
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
    if (!selectedMandi && options.length === 1) {
      setSelectedMandi(options[0].value);
    }
  }, [language, selectedMandi, uiConfig.scope?.org_id]);

  const loadSettings = useCallback(async () => {
    const username = currentUsername();
    const orgId = uiConfig.scope?.org_id || "";
    if (!username || !orgId || !selectedMandi) return;
    setLoading(true);
    try {
      const resp = await getAuctionSettings({
        username,
        language,
        filters: {
          org_id: orgId,
          mandi_id: selectedMandi,
        },
      });
      const data = resp?.data || resp?.response?.data || {};
      setSettings(toFormState(data?.settings?.workflow_policies?.auction));
    } finally {
      setLoading(false);
    }
  }, [language, selectedMandi, uiConfig.scope?.org_id]);

  useEffect(() => {
    if (canView) loadMandis();
  }, [canView, loadMandis]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const updateSettings = (updater: (prev: AuctionSettingsState) => AuctionSettingsState) => {
    setSettings((prev) => updater(prev));
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
      const resp = await upsertAuctionSettings({
        username,
        language,
        payload: {
          org_id: orgId,
          mandi_id: selectedMandi,
          workflow_policies: {
            auction: toPayload(settings),
          },
        },
      });
      const code = String(resp?.response?.responsecode ?? resp?.data?.responsecode ?? "");
      if (code !== "0") {
        enqueueSnackbar(resp?.response?.description || "Failed to save auction settings.", { variant: "error" });
        return;
      }
      enqueueSnackbar("Auction settings saved.", { variant: "success" });
      await loadSettings();
    } finally {
      setSaving(false);
    }
  };

  if (!canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view auction settings.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack spacing={1}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Auction Settings
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 920 }}>
          Configure how auction sessions, lot progression, bidding, result finalization, and settlement automation behave after session creation and lot assignment.
        </Typography>
      </Stack>

      <Alert severity="info" sx={{ borderRadius: 3 }}>
        These settings are stored per mandi and are intended to be read by auction session, lot, result, and settlement orchestration logic.
      </Alert>

      <Card elevation={0} sx={{ borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <CardContent sx={{ p: { xs: 2, md: 2.5 }, "&:last-child": { pb: { xs: 2, md: 2.5 } } }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }}>
            <TextField
              select
              label="Mandi"
              value={selectedMandi}
              onChange={(e) => setSelectedMandi(e.target.value)}
              sx={{ minWidth: { xs: "100%", md: 320 } }}
            >
              {mandiOptions.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" size="large" onClick={saveSettings} disabled={!canEdit || !selectedMandi || saving || loading}>
              {saving ? "Saving..." : "Save Settings"}
            </Button>
          </Stack>
        </CardContent>
      </Card>

      <SectionCard
        icon={<SettingsSuggestOutlinedIcon fontSize="small" />}
        title="Session Flow"
        subtitle="Choose how much of the auction lifecycle should be automated after setup."
      >
        <ToggleButtonGroup
          exclusive
          value={settings.session_flow.mode}
          onChange={(_, value) => value && updateSettings((prev) => ({ ...prev, session_flow: { mode: value } }))}
          color="success"
          sx={{ flexWrap: "wrap", gap: 1 }}
        >
          <ToggleButton value="MANUAL">Manual</ToggleButton>
          <ToggleButton value="SEMI_AUTOMATIC">Semi-Automatic</ToggleButton>
          <ToggleButton value="AUTOMATIC">Automatic</ToggleButton>
        </ToggleButtonGroup>
      </SectionCard>

      <SectionCard
        icon={<AutoModeOutlinedIcon fontSize="small" />}
        title="Lot Progression"
        subtitle="Control whether the next lot advances automatically and how long to wait between lots."
      >
        <Stack spacing={2}>
          <RadioGroup
            value={settings.lot_progression.next_lot_mode}
            onChange={(e) => updateSettings((prev) => ({
              ...prev,
              lot_progression: { ...prev.lot_progression, next_lot_mode: e.target.value },
            }))}
          >
            <FormControlLabel value="MANUAL" control={<Radio />} label="Start next lot manually" />
            <FormControlLabel value="SEMI_AUTOMATIC" control={<Radio />} label="Queue next lot for operator confirmation" />
            <FormControlLabel value="AUTOMATIC" control={<Radio />} label="Start next lot automatically" />
          </RadioGroup>
          <TextField
            label="Auto-start delay between lots (seconds)"
            type="number"
            value={settings.lot_progression.auto_start_delay_seconds}
            onChange={(e) => updateSettings((prev) => ({
              ...prev,
              lot_progression: { ...prev.lot_progression, auto_start_delay_seconds: e.target.value },
            }))}
            inputProps={{ min: 0, max: 3600 }}
            sx={{ maxWidth: 280 }}
          />
        </Stack>
      </SectionCard>

      <SectionCard
        icon={<GavelOutlinedIcon fontSize="small" />}
        title="Bid Handling"
        subtitle="Control lot closing behavior, inactivity thresholds, and extension rules near the close."
      >
        <Stack spacing={2}>
          <RadioGroup
            value={settings.bid_handling.close_mode}
            onChange={(e) => updateSettings((prev) => ({
              ...prev,
              bid_handling: { ...prev.bid_handling, close_mode: e.target.value },
            }))}
          >
            <FormControlLabel value="MANUAL" control={<Radio />} label="Close bidding manually" />
            <FormControlLabel value="AUTOMATIC" control={<Radio />} label="Close bidding automatically after inactivity" />
          </RadioGroup>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
            <TextField
              label="Inactivity timeout (seconds)"
              type="number"
              value={settings.bid_handling.inactivity_timeout_seconds}
              onChange={(e) => updateSettings((prev) => ({
                ...prev,
                bid_handling: { ...prev.bid_handling, inactivity_timeout_seconds: e.target.value },
              }))}
              inputProps={{ min: 5, max: 3600 }}
              sx={{ maxWidth: 260 }}
            />
            <TextField
              label="Extension duration (seconds)"
              type="number"
              value={settings.bid_handling.extension_duration_seconds}
              onChange={(e) => updateSettings((prev) => ({
                ...prev,
                bid_handling: { ...prev.bid_handling, extension_duration_seconds: e.target.value },
              }))}
              inputProps={{ min: 5, max: 600 }}
              sx={{ maxWidth: 260 }}
            />
          </Stack>
          <FormControlLabel
            control={
              <Switch
                checked={settings.bid_handling.extend_on_last_second_bid}
                onChange={(e) => updateSettings((prev) => ({
                  ...prev,
                  bid_handling: { ...prev.bid_handling, extend_on_last_second_bid: e.target.checked },
                }))}
              />
            }
            label="Extend the lot when a valid bid arrives in the last seconds"
          />
        </Stack>
      </SectionCard>

      <Stack direction={{ xs: "column", xl: "row" }} spacing={2}>
        <Box sx={{ flex: 1 }}>
          <SectionCard
            icon={<GavelOutlinedIcon fontSize="small" />}
            title="Result Finalization"
            subtitle="Decide whether results are finalized by an operator or from the highest valid bid automatically."
          >
            <RadioGroup
              value={settings.result_finalization.mode}
              onChange={(e) => updateSettings((prev) => ({
                ...prev,
                result_finalization: { mode: e.target.value },
              }))}
            >
              <FormControlLabel value="MANUAL" control={<Radio />} label="Finalize manually" />
              <FormControlLabel value="AUTO_FINALIZE_HIGHEST_VALID_BID" control={<Radio />} label="Auto-finalize highest valid bid" />
            </RadioGroup>
          </SectionCard>
        </Box>
        <Box sx={{ flex: 1 }}>
          <SectionCard
            icon={<AccountBalanceWalletOutlinedIcon fontSize="small" />}
            title="Settlement"
            subtitle="Control whether settlements are created by an operator or immediately after finalization."
          >
            <RadioGroup
              value={settings.settlement.mode}
              onChange={(e) => updateSettings((prev) => ({
                ...prev,
                settlement: { mode: e.target.value },
              }))}
            >
              <FormControlLabel value="MANUAL" control={<Radio />} label="Create settlement manually" />
              <FormControlLabel value="AUTO_CREATE_AFTER_FINALIZATION" control={<Radio />} label="Auto-create settlement after finalization" />
            </RadioGroup>
          </SectionCard>
        </Box>
      </Stack>

      <Stack direction={{ xs: "column", xl: "row" }} spacing={2}>
        <Box sx={{ flex: 1 }}>
          <SectionCard
            icon={<VerifiedUserOutlinedIcon fontSize="small" />}
            title="Eligibility & Validation"
            subtitle="Define which lots are allowed into auction and whether invalid lots should be skipped automatically."
          >
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.eligibility_validation.only_eligible_verified_lots}
                    onChange={(e) => updateSettings((prev) => ({
                      ...prev,
                      eligibility_validation: {
                        ...prev.eligibility_validation,
                        only_eligible_verified_lots: e.target.checked,
                      },
                    }))}
                  />
                }
                label="Only eligible and verified lots can enter auction"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.eligibility_validation.skip_invalid_lots_automatically}
                    onChange={(e) => updateSettings((prev) => ({
                      ...prev,
                      eligibility_validation: {
                        ...prev.eligibility_validation,
                        skip_invalid_lots_automatically: e.target.checked,
                      },
                    }))}
                  />
                }
                label="Skip invalid lots automatically"
              />
            </Stack>
          </SectionCard>
        </Box>
        <Box sx={{ flex: 1 }}>
          <SectionCard
            icon={<AdminPanelSettingsOutlinedIcon fontSize="small" />}
            title="Override Permissions"
            subtitle="Decide who can intervene when the configured flow needs an operational override."
          >
            <Stack spacing={1}>
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.override_permissions.admin_override_allowed}
                    onChange={(e) => updateSettings((prev) => ({
                      ...prev,
                      override_permissions: { ...prev.override_permissions, admin_override_allowed: e.target.checked },
                    }))}
                  />
                }
                label="Admin override allowed"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={settings.override_permissions.mandi_operator_override_allowed}
                    onChange={(e) => updateSettings((prev) => ({
                      ...prev,
                      override_permissions: {
                        ...prev.override_permissions,
                        mandi_operator_override_allowed: e.target.checked,
                      },
                    }))}
                  />
                }
                label="Mandi operator override allowed"
              />
            </Stack>
          </SectionCard>
        </Box>
      </Stack>
    </PageContainer>
  );
};
