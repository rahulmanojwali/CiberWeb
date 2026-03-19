import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Box, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from "@mui/material";
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

const ORG_OPTIONS = [
  { value: "STRICT_ADMIN_ONLY", label: "Strict Admin Only" },
  { value: "GATE_OPERATOR_ALLOWED", label: "Gate Operator Allowed" },
];

const MANDI_OPTIONS = [
  { value: "", label: "Use Org Default" },
  ...ORG_OPTIONS,
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

export const WorkflowPolicies: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const { enqueueSnackbar } = useSnackbar();
  const uiConfig = useAdminUiConfig();
  const { can, authContext } = usePermissions();

  const [loading, setLoading] = useState(false);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [selectedMandi, setSelectedMandi] = useState("");
  const [orgLotCreationMode, setOrgLotCreationMode] = useState("STRICT_ADMIN_ONLY");
  const [mandiLotCreationMode, setMandiLotCreationMode] = useState("");
  const [effectiveMandiLotCreationMode, setEffectiveMandiLotCreationMode] = useState("STRICT_ADMIN_ONLY");
  const [effectiveMandiSource, setEffectiveMandiSource] = useState("DEFAULT");
  const [mandiLoadError, setMandiLoadError] = useState("");

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
        setMandiLoadError("No mandis are available for this org.");
      }
    } catch (error) {
      console.error("[workflowPolicies] failed to load mandis", error);
      setMandiOptions([]);
      setMandiLoadError("Unable to load mandi list right now.");
    }
  }, [language, orgId, selectedMandi]);

  const loadOrgPolicy = useCallback(async () => {
    const username = currentUsername();
    if (!username || !orgId) return;
    const resp = await getOrgSettings({ username, language, payload: { org_id: orgId } });
    const settings = resp?.data?.settings || resp?.response?.data?.settings || {};
    setOrgLotCreationMode(String(settings?.workflow_policies?.lot_creation_mode || "STRICT_ADMIN_ONLY").toUpperCase());
  }, [language, orgId]);

  const loadMandiPolicy = useCallback(async () => {
    const username = currentUsername();
    if (!username || !orgId || !selectedMandi) return;
    const resp = await getMandiSettings({
      username,
      language,
      filters: { org_id: orgId, mandi_id: selectedMandi },
    });
    const data = resp?.data || resp?.response?.data || {};
    const settings = data?.settings || {};
    setMandiLotCreationMode(String(settings?.workflow_policies?.lot_creation_mode || "").toUpperCase());
    setEffectiveMandiLotCreationMode(
      String(data?.effective_workflow_policies?.lot_creation_mode || "STRICT_ADMIN_ONLY").toUpperCase(),
    );
    setEffectiveMandiSource(String(data?.effective_workflow_policies?.source || "DEFAULT").toUpperCase());
  }, [language, orgId, selectedMandi]);

  useEffect(() => {
    if (!canViewPage) return;
    setLoading(true);
    Promise.all([loadMandis(), loadOrgPolicy()]).finally(() => setLoading(false));
  }, [canViewPage, loadMandis, loadOrgPolicy]);

  useEffect(() => {
    if (!canViewMandi || !selectedMandi) return;
    loadMandiPolicy();
  }, [canViewMandi, selectedMandi, loadMandiPolicy]);

  const saveOrgPolicy = async () => {
    const username = currentUsername();
    if (!username || !orgId) return;
    const resp = await upsertOrgSettings({
      username,
      language,
      payload: {
        org_id: orgId,
        workflow_policies: {
          lot_creation_mode: orgLotCreationMode,
        },
      },
    });
    const code = String(resp?.response?.responsecode ?? "");
    if (code !== "0") {
      enqueueSnackbar(resp?.response?.description || "Failed to save org workflow policy.", { variant: "error" });
      return;
    }
    enqueueSnackbar("Org workflow policy saved.", { variant: "success" });
    loadOrgPolicy();
    if (selectedMandi) loadMandiPolicy();
  };

  const saveMandiPolicy = async () => {
    const username = currentUsername();
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
        workflow_policies: {
          lot_creation_mode: mandiLotCreationMode || null,
        },
      },
    });
    const code = String(resp?.response?.responsecode ?? "");
    if (code !== "0") {
      enqueueSnackbar(resp?.response?.description || "Failed to save mandi workflow policy.", { variant: "error" });
      return;
    }
    enqueueSnackbar("Mandi workflow policy saved.", { variant: "success" });
    loadMandiPolicy();
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
          Controls whether gate operators can create lots immediately after marking a token IN_YARD.
        </Typography>
      </Stack>

      <Stack spacing={2}>
        {canViewOrg ? (
          <Card>
            <CardContent>
              <Stack spacing={2}>
                <Typography variant="h6">Org Default</Typography>
                <TextField
                  select
                  label="Lot Creation Mode"
                  value={orgLotCreationMode}
                  onChange={(e) => setOrgLotCreationMode(e.target.value)}
                  disabled={loading || !canEditOrg}
                >
                  {ORG_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
                {canEditOrg ? (
                  <Box>
                    <Button variant="contained" onClick={saveOrgPolicy}>
                      Save Org Default
                    </Button>
                  </Box>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        {canViewMandi ? (
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
                    Select a mandi to configure override.
                  </Typography>
                ) : null}
                {mandiLoadError ? (
                  <Typography variant="body2" color="error">
                    {mandiLoadError}
                  </Typography>
                ) : null}
                <TextField
                  select
                  label="Lot Creation Mode Override"
                  value={mandiLotCreationMode}
                  onChange={(e) => setMandiLotCreationMode(e.target.value)}
                  disabled={!selectedMandi || !canEditMandi}
                >
                  {MANDI_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value || "__inherit__"} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </TextField>
                <Typography variant="body2" color="text.secondary">
                  Effective value: {effectiveMandiLotCreationMode} ({effectiveMandiSource})
                </Typography>
                {canEditMandi ? (
                  <Box>
                    <Button variant="contained" onClick={saveMandiPolicy} disabled={!selectedMandi}>
                      Save Mandi Override
                    </Button>
                  </Box>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ) : null}
      </Stack>
    </PageContainer>
  );
};
