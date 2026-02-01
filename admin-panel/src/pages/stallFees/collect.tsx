import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import SaveIcon from "@mui/icons-material/Save";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";

import { PageContainer } from "../../components/PageContainer";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import { collectStallFee } from "../../services/stallFeesApi";

const PAYER_TYPES = [
  { value: "", label: "Select" },
  { value: "FARMER", label: "FARMER" },
  { value: "TRADER", label: "TRADER" },
  { value: "VENDOR", label: "VENDOR" },
];

const PAYMENT_METHODS = [
  { value: "", label: "UNPAID" },
  { value: "CASH", label: "CASH" },
  { value: "UPI", label: "UPI" },
  { value: "OTHER", label: "OTHER" },
];

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

function currentUserCountry(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.country || parsed?.country_code || null;
  } catch {
    return null;
  }
}

function todayLocal(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export const StallFeeCollect: React.FC = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();

  const canCollect = useMemo(() => can("stall_fees.collect", "CREATE"), [can]);

  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    market_date: todayLocal(),
    mandi_id: "",
    payer_type: "",
    payer_id: "",
    payer_name: "",
    payer_mobile: "",
    amount: "",
    currency: "INR",
    method: "CASH",
    txn_id: "",
  });

  const loadMandis = async () => {
    const username = currentUsername();
    const orgId = uiConfig.scope?.org_id || "";
    if (!username || !orgId) return;
    try {
      const list = await getMandisForCurrentScope({
        username,
        language,
        org_id: orgId,
      });
      const mapped = (list || []).map((m: any) => ({
        value: String(m.mandi_id ?? m.mandiId ?? ""),
        label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
      }));
      setMandiOptions(mapped);
      if (!form.mandi_id && mapped.length === 1) {
        setForm((prev) => ({ ...prev, mandi_id: mapped[0].value }));
      }
    } catch {
      setMandiOptions([]);
    }
  };

  const handleSubmit = async () => {
    if (!canCollect) return;
    const username = currentUsername();
    const country = currentUserCountry();
    if (!username || !country) return;

    if (!form.market_date || !form.mandi_id || !form.payer_type || !form.payer_id || !form.amount) {
      enqueueSnackbar("Please fill all required fields.", { variant: "warning" });
      return;
    }

    const amount = Number(form.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      enqueueSnackbar("Amount must be a valid number.", { variant: "warning" });
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        username,
        language,
        country,
        org_id: uiConfig.scope?.org_id || "",
        mandi_id: form.mandi_id,
        market_date: form.market_date,
        payer: {
          payer_type: form.payer_type,
          payer_id: form.payer_id,
          name: form.payer_name || undefined,
          mobile: form.payer_mobile || undefined,
        },
        amount,
        currency: form.currency || "INR",
      };

      if (form.method) {
        payload.payment = {
          method: form.method,
          txn_id: form.txn_id || undefined,
        };
      }

      const resp = await collectStallFee(payload);
      const code = resp?.response?.responsecode || resp?.responsecode || "1";
      const desc = resp?.response?.description || resp?.description || "Failed to collect stall fee.";
      if (code !== "0") {
        enqueueSnackbar(desc, { variant: "error" });
        return;
      }

      enqueueSnackbar("Stall fee collected.", { variant: "success" });
      navigate("/stall-fees");
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Failed to collect stall fee.", { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (canCollect) {
      loadMandis();
    }
    if (!form.mandi_id && uiConfig.scope?.mandi_id) {
      setForm((prev) => ({ ...prev, mandi_id: String(uiConfig.scope?.mandi_id || "") }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canCollect]);

  if (!canCollect) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to collect stall fees.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">Collect Stall Fee</Typography>
          <Typography variant="body2" color="text.secondary">
            Create a stall fee receipt for a payer.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIosNewIcon />}
            onClick={() => navigate("/stall-fees")}
          >
            Back
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSubmit}
            disabled={saving}
          >
            Save
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ maxWidth: 720 }}>
        <Stack spacing={2}>
          <TextField
            label="Market Date"
            type="date"
            value={form.market_date}
            onChange={(e) => setForm((prev) => ({ ...prev, market_date: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            required
          />
          <TextField
            select
            label="Mandi"
            value={form.mandi_id}
            onChange={(e) => setForm((prev) => ({ ...prev, mandi_id: e.target.value }))}
            required
          >
            <MenuItem value="">
              <em>Select</em>
            </MenuItem>
            {mandiOptions.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Payer Type"
            value={form.payer_type}
            onChange={(e) => setForm((prev) => ({ ...prev, payer_type: e.target.value }))}
            required
          >
            {PAYER_TYPES.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Payer ID"
            value={form.payer_id}
            onChange={(e) => setForm((prev) => ({ ...prev, payer_id: e.target.value }))}
            required
          />
          <TextField
            label="Payer Name"
            value={form.payer_name}
            onChange={(e) => setForm((prev) => ({ ...prev, payer_name: e.target.value }))}
          />
          <TextField
            label="Payer Mobile"
            value={form.payer_mobile}
            onChange={(e) => setForm((prev) => ({ ...prev, payer_mobile: e.target.value }))}
          />
          <TextField
            label="Amount"
            type="number"
            value={form.amount}
            onChange={(e) => setForm((prev) => ({ ...prev, amount: e.target.value }))}
            required
          />
          <TextField
            label="Currency"
            value={form.currency}
            onChange={(e) => setForm((prev) => ({ ...prev, currency: e.target.value }))}
          />
          <TextField
            select
            label="Payment Method"
            value={form.method}
            onChange={(e) => {
              const method = e.target.value;
              setForm((prev) => ({ ...prev, method, txn_id: method === "UPI" ? prev.txn_id : "" }));
            }}
          >
            {PAYMENT_METHODS.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>
          {form.method === "UPI" && (
            <TextField
              label="UPI Transaction ID"
              value={form.txn_id}
              onChange={(e) => setForm((prev) => ({ ...prev, txn_id: e.target.value }))}
            />
          )}
        </Stack>
      </Box>
    </PageContainer>
  );
};
