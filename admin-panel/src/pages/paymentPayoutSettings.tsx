import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { PageContainer } from "../components/PageContainer";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { usePermissions } from "../authz/usePermissions";
import { useTranslation } from "react-i18next";
import { normalizeLanguageCode } from "../config/languages";
import { getPaymentPayoutSettings, upsertPaymentPayoutSettings } from "../services/paymentPayoutSettingsApi";

const AMOUNT_FIELDS = {
  upi_max_transaction_amount: "UPI Max Transaction Amount",
  upi_daily_limit_amount: "UPI Daily Limit Amount",
  require_bank_details_above_amount: "Bank Details Required Above Amount",
} as const;

type AmountFieldKey = keyof typeof AMOUNT_FIELDS;

type ValidationErrors = Partial<Record<AmountFieldKey, string>>;

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

function sanitizeAmountTyping(value: string): string {
  let cleaned = String(value || "").replace(/[^\d.]/g, "");
  const dotIndex = cleaned.indexOf(".");
  if (dotIndex !== -1) {
    const intPart = cleaned.slice(0, dotIndex);
    const decimalPart = cleaned.slice(dotIndex + 1).replace(/\./g, "").slice(0, 2);
    cleaned = `${intPart}.${decimalPart}`;
  }
  return cleaned;
}

function isValidAmountShape(value: string): boolean {
  return /^(?:\d+|\d*\.\d{1,2})$/.test(String(value || "").trim());
}

function formatAmountOnBlur(value: string): string {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (!isValidAmountShape(trimmed)) return trimmed;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return trimmed;
  return n.toFixed(2);
}

function normalizeLoadedAmount(value: any, fallback = "100000.00"): string {
  const sanitized = sanitizeAmountTyping(String(value ?? "").trim());
  if (!sanitized) return fallback;
  if (!isValidAmountShape(sanitized)) return fallback;
  const n = Number(sanitized);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return n.toFixed(2);
}

function validateAmountField(label: string, raw: string): string {
  const value = String(raw || "").trim();
  if (!value) return `${label} is required.`;
  if (!isValidAmountShape(value)) return `${label} must be a valid amount with up to 2 decimals.`;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return `${label} must be greater than 0.`;
  return "";
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
  const [errors, setErrors] = useState<ValidationErrors>({});

  const validateAllAmounts = (): ValidationErrors => {
    const nextErrors: ValidationErrors = {};
    (Object.keys(AMOUNT_FIELDS) as AmountFieldKey[]).forEach((key) => {
      const err = validateAmountField(AMOUNT_FIELDS[key], form[key]);
      if (err) nextErrors[key] = err;
    });
    return nextErrors;
  };

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
      setForm((prev: any) => ({
        ...prev,
        ...data,
        upi_max_transaction_amount: normalizeLoadedAmount(data?.upi_max_transaction_amount, prev.upi_max_transaction_amount),
        upi_daily_limit_amount: normalizeLoadedAmount(data?.upi_daily_limit_amount, prev.upi_daily_limit_amount),
        require_bank_details_above_amount: normalizeLoadedAmount(
          data?.require_bank_details_above_amount,
          prev.require_bank_details_above_amount,
        ),
      }));
      setErrors({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, uiConfig.scope?.org_id, uiConfig.scope?.mandi_id, language]);

  const handleAmountChange = (key: AmountFieldKey, value: string) => {
    const sanitized = sanitizeAmountTyping(value);
    setForm((s: any) => ({ ...s, [key]: sanitized }));
    if (errors[key]) {
      const err = validateAmountField(AMOUNT_FIELDS[key], sanitized);
      setErrors((prev) => ({ ...prev, [key]: err || undefined }));
    }
  };

  const handleAmountBlur = (key: AmountFieldKey) => {
    const formatted = formatAmountOnBlur(form[key]);
    setForm((s: any) => ({ ...s, [key]: formatted }));
    const err = validateAmountField(AMOUNT_FIELDS[key], formatted);
    setErrors((prev) => ({ ...prev, [key]: err || undefined }));
  };

  const save = async () => {
    const username = currentUsername();
    if (!username) return;

    const validationErrors = validateAllAmounts();
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) return;

    const normalizedAmounts = {
      upi_max_transaction_amount: formatAmountOnBlur(form.upi_max_transaction_amount),
      upi_daily_limit_amount: formatAmountOnBlur(form.upi_daily_limit_amount),
      require_bank_details_above_amount: formatAmountOnBlur(form.require_bank_details_above_amount),
    };

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
          ...normalizedAmounts,
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
            Configure UPI limits, payout modes, and farmer payout requirements.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={load} disabled={loading}>
            Refresh
          </Button>
          <Button variant="contained" onClick={save} disabled={!canEdit || loading}>
            Save Settings
          </Button>
        </Stack>
      </Stack>

      <Alert severity="warning" sx={{ mb: 2, borderRadius: 1.5 }}>
        UPI limits vary by bank, PSP app, merchant category and NPCI/RBI rules. Keep these settings updated.
      </Alert>

      <Card>
        <CardContent>
          <Stack spacing={2.2}>
            <TextField
              label="UPI Max Transaction Amount"
              size="small"
              value={form.upi_max_transaction_amount}
              onChange={(e) => handleAmountChange("upi_max_transaction_amount", e.target.value)}
              onBlur={() => handleAmountBlur("upi_max_transaction_amount")}
              error={Boolean(errors.upi_max_transaction_amount)}
              helperText={errors.upi_max_transaction_amount || "Amount in INR. Example: 100000.00"}
              inputProps={{ inputMode: "decimal", autoComplete: "off" }}
              fullWidth
            />
            <TextField
              label="UPI Daily Limit Amount"
              size="small"
              value={form.upi_daily_limit_amount}
              onChange={(e) => handleAmountChange("upi_daily_limit_amount", e.target.value)}
              onBlur={() => handleAmountBlur("upi_daily_limit_amount")}
              error={Boolean(errors.upi_daily_limit_amount)}
              helperText={errors.upi_daily_limit_amount || "Amount in INR. Example: 100000.00"}
              inputProps={{ inputMode: "decimal", autoComplete: "off" }}
              fullWidth
            />
            <TextField
              label="Bank Details Required Above Amount"
              size="small"
              value={form.require_bank_details_above_amount}
              onChange={(e) => handleAmountChange("require_bank_details_above_amount", e.target.value)}
              onBlur={() => handleAmountBlur("require_bank_details_above_amount")}
              error={Boolean(errors.require_bank_details_above_amount)}
              helperText={errors.require_bank_details_above_amount || "Amount in INR. Example: 100000.00"}
              inputProps={{ inputMode: "decimal", autoComplete: "off" }}
              fullWidth
            />
            <TextField
              select
              size="small"
              label="Default Payout Mode"
              value={form.default_payout_mode}
              onChange={(e) => setForm((s: any) => ({ ...s, default_payout_mode: e.target.value }))}
              fullWidth
            >
              <MenuItem value="AUTO">AUTO</MenuItem>
              <MenuItem value="BANK">BANK</MenuItem>
              <MenuItem value="UPI">UPI</MenuItem>
              <MenuItem value="MANUAL">MANUAL</MenuItem>
              <MenuItem value="CASH">CASH</MenuItem>
            </TextField>

            <FormControlLabel control={<Switch checked={!!form.allow_upi_payout} onChange={(e) => setForm((s: any) => ({ ...s, allow_upi_payout: e.target.checked }))} />} label="Allow UPI Payout" />
            <FormControlLabel control={<Switch checked={!!form.allow_bank_payout} onChange={(e) => setForm((s: any) => ({ ...s, allow_bank_payout: e.target.checked }))} />} label="Allow Bank Payout" />
            <FormControlLabel control={<Switch checked={!!form.allow_cash_payout} onChange={(e) => setForm((s: any) => ({ ...s, allow_cash_payout: e.target.checked }))} />} label="Allow Cash Payout" />
            <FormControlLabel control={<Switch checked={!!form.allow_split_upi_payout} onChange={(e) => setForm((s: any) => ({ ...s, allow_split_upi_payout: e.target.checked }))} />} label="Allow Split UPI Payout" />
            <FormControlLabel control={<Switch checked={!!form.require_farmer_bank_before_auction} onChange={(e) => setForm((s: any) => ({ ...s, require_farmer_bank_before_auction: e.target.checked }))} />} label="Require Farmer Bank Before Auction" />
            <FormControlLabel control={<Switch checked={!!form.require_farmer_upi_verification} onChange={(e) => setForm((s: any) => ({ ...s, require_farmer_upi_verification: e.target.checked }))} />} label="Require Farmer UPI Verification" />
          </Stack>
        </CardContent>
      </Card>
    </PageContainer>
  );
};
