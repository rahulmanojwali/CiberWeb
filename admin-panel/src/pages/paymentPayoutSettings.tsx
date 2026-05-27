import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, CardContent, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import { PageContainer } from "../components/PageContainer";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { usePermissions } from "../authz/usePermissions";
import { useTranslation } from "react-i18next";
import { normalizeLanguageCode } from "../config/languages";
import { getPaymentPayoutSettings, upsertPaymentPayoutSettings } from "../services/paymentPayoutSettingsApi";

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

export const PaymentPayoutSettingsPage: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();
  const canView = useMemo(() => can("payment_payout_settings.menu", "VIEW"), [can]);
  const canEdit = useMemo(() => can("payment_payout_settings.update", "UPDATE"), [can]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<any>({
    upi_max_transaction_amount: "100000.00",
    upi_daily_limit_amount: "100000.00",
    allow_upi_payout: true,
    allow_bank_payout: true,
    allow_cash_payout: false,
    allow_split_upi_payout: false,
    default_payout_mode: "AUTO",
    require_bank_details_above_amount: "100000.00",
    require_farmer_bank_before_auction: true,
    require_farmer_upi_verification: false,
    is_active: true,
  });

  const load = async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp = await getPaymentPayoutSettings({
        username,
        language,
        payload: {
          org_id: uiConfig.scope?.org_id || null,
          mandi_id: uiConfig.scope?.mandi_id ?? null,
          country: uiConfig.scope?.country || "IN",
        },
      });
      const data = resp?.data || resp?.response?.data || {};
      setForm((prev: any) => ({ ...prev, ...data }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, uiConfig.scope?.org_id, uiConfig.scope?.mandi_id, language]);

  const save = async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
      await upsertPaymentPayoutSettings({
        username,
        language,
        payload: {
          org_id: uiConfig.scope?.org_id || null,
          mandi_id: uiConfig.scope?.mandi_id ?? null,
          country: uiConfig.scope?.country || "IN",
          ...form,
        },
      });
      await load();
    } finally {
      setLoading(false);
    }
  };

  if (!canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view payment & payout settings.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">Payment & Payout Settings</Typography>
          <Typography variant="body2" color="text.secondary">
            Configure trader collection and farmer payout guardrails per org/mandi scope.
          </Typography>
        </Stack>
        <Button variant="contained" onClick={save} disabled={!canEdit || loading}>Save</Button>
      </Stack>

      <Alert severity="warning" sx={{ mb: 2 }}>
        UPI limits vary by bank, PSP app, merchant category and NPCI/RBI rules. Keep this configurable.
      </Alert>

      <Card>
        <CardContent>
          <Stack spacing={2}>
            <TextField
              label="UPI max transaction amount"
              value={form.upi_max_transaction_amount}
              onChange={(e) => setForm((s: any) => ({ ...s, upi_max_transaction_amount: e.target.value }))}
            />
            <TextField
              label="UPI daily limit amount"
              value={form.upi_daily_limit_amount}
              onChange={(e) => setForm((s: any) => ({ ...s, upi_daily_limit_amount: e.target.value }))}
            />
            <TextField
              label="Require bank details above amount"
              value={form.require_bank_details_above_amount}
              onChange={(e) => setForm((s: any) => ({ ...s, require_bank_details_above_amount: e.target.value }))}
            />
            <TextField
              select
              label="Default payout mode"
              value={form.default_payout_mode}
              onChange={(e) => setForm((s: any) => ({ ...s, default_payout_mode: e.target.value }))}
            >
              <MenuItem value="AUTO">AUTO</MenuItem>
              <MenuItem value="BANK">BANK</MenuItem>
              <MenuItem value="UPI">UPI</MenuItem>
              <MenuItem value="MANUAL">MANUAL</MenuItem>
              <MenuItem value="CASH">CASH</MenuItem>
            </TextField>

            <FormControlLabel control={<Switch checked={!!form.allow_upi_payout} onChange={(e) => setForm((s: any) => ({ ...s, allow_upi_payout: e.target.checked }))} />} label="Allow UPI payout" />
            <FormControlLabel control={<Switch checked={!!form.allow_bank_payout} onChange={(e) => setForm((s: any) => ({ ...s, allow_bank_payout: e.target.checked }))} />} label="Allow bank payout" />
            <FormControlLabel control={<Switch checked={!!form.allow_cash_payout} onChange={(e) => setForm((s: any) => ({ ...s, allow_cash_payout: e.target.checked }))} />} label="Allow cash payout" />
            <FormControlLabel control={<Switch checked={!!form.allow_split_upi_payout} onChange={(e) => setForm((s: any) => ({ ...s, allow_split_upi_payout: e.target.checked }))} />} label="Allow split UPI payout" />
            <FormControlLabel control={<Switch checked={!!form.require_farmer_bank_before_auction} onChange={(e) => setForm((s: any) => ({ ...s, require_farmer_bank_before_auction: e.target.checked }))} />} label="Require farmer bank before auction" />
            <FormControlLabel control={<Switch checked={!!form.require_farmer_upi_verification} onChange={(e) => setForm((s: any) => ({ ...s, require_farmer_upi_verification: e.target.checked }))} />} label="Require farmer UPI verification" />
          </Stack>
        </CardContent>
      </Card>
    </PageContainer>
  );
};

