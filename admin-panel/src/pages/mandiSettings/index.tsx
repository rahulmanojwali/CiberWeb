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
