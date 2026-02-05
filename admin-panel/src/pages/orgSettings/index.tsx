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
    </PageContainer>
  );
};
