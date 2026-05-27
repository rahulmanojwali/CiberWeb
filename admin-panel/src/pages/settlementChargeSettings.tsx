import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  CardContent,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { PageContainer } from "../components/PageContainer";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { usePermissions } from "../authz/usePermissions";
import {
  getSettlementChargeMasters,
  getSettlementChargeSettings,
  upsertSettlementChargeSettings,
} from "../services/settlementChargeSettingsApi";

type ChargeType = "FIXED" | "PERCENTAGE";
type ChargedTo = "TRADER" | "FARMER" | "PLATFORM";
type RoundingRule = "NONE" | "NEAREST_RUPEE" | "ROUND_UP" | "ROUND_DOWN";

type Master = {
  charge_code: string;
  charge_label: string;
  charge_category: string;
  default_charge_type: ChargeType;
  default_charged_to: ChargedTo;
  sort_order?: number;
};

type ChargeLine = {
  charge_code: string;
  charge_label: string;
  charge_category: string;
  provider_code: string;
  enabled: boolean;
  charge_type: ChargeType;
  fixed_amount: string;
  percentage: string;
  min_amount: string;
  max_amount: string;
  tax_percentage: string;
  charged_to: ChargedTo;
  beneficiary_account_type: string;
  sort_order: number;
};

type FormState = {
  provider_code: string;
  rounding_rule: RoundingRule;
  charge_lines: ChargeLine[];
  is_active: boolean;
};

const amountRegex = /^(?:\d+|\d*\.\d{1,2})$/;

function getUsername() {
  try { return JSON.parse(localStorage.getItem("cd_user") || "{}").username || ""; } catch { return ""; }
}
function toCode(raw: string) {
  return String(raw || "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").replace(/__+/g, "_");
}
function sanitizeNumeric(raw: string) {
  let v = String(raw || "").replace(/[^\d.]/g, "");
  const dot = v.indexOf(".");
  if (dot >= 0) v = `${v.slice(0, dot)}.${v.slice(dot + 1).replace(/\./g, "").slice(0, 2)}`;
  return v;
}
function normalize2(raw: string) {
  let v = String(raw || "").trim();
  if (!v) return "0.00";
  if (v.startsWith(".")) v = `0${v}`;
  if (!amountRegex.test(v)) return v;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return v;
  return n.toFixed(2);
}
function isAmount(v: string) {
  const n = normalize2(v);
  return amountRegex.test(n) && Number(n) >= 0;
}
function isPct(v: string) {
  if (!isAmount(v)) return false;
  const n = Number(normalize2(v));
  return n >= 0 && n <= 100;
}

function defaultLine(master?: Master, idx = 1): ChargeLine {
  return {
    charge_code: master?.charge_code || `CUSTOM_CHARGE_${idx}`,
    charge_label: master?.charge_label || `Custom Charge ${idx}`,
    charge_category: master?.charge_category || "OTHER",
    provider_code: "DEFAULT",
    enabled: true,
    charge_type: (master?.default_charge_type || "FIXED") as ChargeType,
    fixed_amount: "0.00",
    percentage: "0.00",
    min_amount: "0.00",
    max_amount: "0.00",
    tax_percentage: "0.00",
    charged_to: (master?.default_charged_to || "TRADER") as ChargedTo,
    beneficiary_account_type: "PLATFORM",
    sort_order: master?.sort_order || idx,
  };
}

export const SettlementChargeSettingsPage: React.FC = () => {
  const { can } = usePermissions();
  const uiConfig = useAdminUiConfig();
  const canView = useMemo(() => can("settlement_charge_settings.menu", "VIEW") || can("settlement_charge_settings.view", "VIEW"), [can]);
  const canEdit = useMemo(() => can("settlement_charge_settings.update", "UPDATE"), [can]);

  const [loading, setLoading] = useState(false);
  const [masters, setMasters] = useState<Master[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<FormState>({
    provider_code: "DEFAULT",
    rounding_rule: "NONE",
    charge_lines: [],
    is_active: true,
  });

  const load = async () => {
    const username = getUsername();
    if (!username) return;
    setLoading(true);
    try {
      const [mastersResp, settingsResp] = await Promise.all([
        getSettlementChargeMasters({ username, payload: {} }),
        getSettlementChargeSettings({
          username,
          payload: {
            org_id: uiConfig.scope?.org_id || null,
            mandi_id: uiConfig.scope?.mandi_id ?? null,
            country: (uiConfig.scope as any)?.country || "IN",
            provider_code: form.provider_code || "DEFAULT",
          },
        }),
      ]);

      const mList = (mastersResp?.charge_masters || mastersResp?.data?.charge_masters || []) as Master[];
      setMasters(mList);

      const settings = (settingsResp?.settings || settingsResp?.data?.settings || {}) as any;
      const loadedLines = Array.isArray(settings.charge_lines)
        ? settings.charge_lines.map((r: any, idx: number) => ({
            charge_code: toCode(r.charge_code || r.code || "") || `CUSTOM_CHARGE_${idx + 1}`,
            charge_label: String(r.charge_label || r.label || "").trim(),
            charge_category: String(r.charge_category || "OTHER").toUpperCase(),
            provider_code: String(r.provider_code || settings.provider_code || "DEFAULT").toUpperCase(),
            enabled: !!r.enabled,
            charge_type: String(r.charge_type || "FIXED").toUpperCase() === "PERCENTAGE" ? "PERCENTAGE" : "FIXED",
            fixed_amount: normalize2(sanitizeNumeric(String(r.fixed_amount ?? "0"))),
            percentage: normalize2(sanitizeNumeric(String(r.percentage ?? "0"))),
            min_amount: normalize2(sanitizeNumeric(String(r.min_amount ?? "0"))),
            max_amount: normalize2(sanitizeNumeric(String(r.max_amount ?? "0"))),
            tax_percentage: normalize2(sanitizeNumeric(String(r.tax_percentage ?? "0"))),
            charged_to: (["TRADER", "FARMER", "PLATFORM"].includes(String(r.charged_to || "").toUpperCase()) ? String(r.charged_to).toUpperCase() : "TRADER") as ChargedTo,
            beneficiary_account_type: String(r.beneficiary_account_type || "PLATFORM").toUpperCase(),
            sort_order: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : idx + 1,
          }))
        : [];

      setForm({
        provider_code: String(settings.provider_code || "DEFAULT").toUpperCase(),
        rounding_rule: (["NONE", "NEAREST_RUPEE", "ROUND_UP", "ROUND_DOWN"].includes(String(settings.rounding_rule || "").toUpperCase())
          ? String(settings.rounding_rule).toUpperCase()
          : "NONE") as RoundingRule,
        charge_lines: loadedLines,
        is_active: settings.is_active !== false,
      });
      setErrors({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) load();
  }, [canView, uiConfig.scope?.org_id, uiConfig.scope?.mandi_id]);

  const setLine = (idx: number, patch: Partial<ChargeLine>) => {
    setForm((s) => ({ ...s, charge_lines: s.charge_lines.map((r, i) => (i === idx ? { ...r, ...patch } : r)) }));
  };

  const addLine = () => {
    const m = masters.find((x) => x.charge_code === "OTHER_CHARGE");
    setForm((s) => ({ ...s, charge_lines: [...s.charge_lines, defaultLine(m, s.charge_lines.length + 1)] }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    form.charge_lines.forEach((r, idx) => {
      if (!toCode(r.charge_code)) e[`code.${idx}`] = "Code required";
      if (!String(r.charge_label || "").trim()) e[`label.${idx}`] = "Label required";
      if (!["FIXED", "PERCENTAGE"].includes(r.charge_type)) e[`type.${idx}`] = "Invalid type";
      if (!isAmount(r.fixed_amount)) e[`fixed.${idx}`] = "Invalid amount";
      if (!isPct(r.percentage)) e[`pct.${idx}`] = "Invalid %";
      if (!isAmount(r.min_amount)) e[`min.${idx}`] = "Invalid amount";
      if (!isAmount(r.max_amount)) e[`max.${idx}`] = "Invalid amount";
      if (!isPct(r.tax_percentage)) e[`tax.${idx}`] = "Invalid %";
    });
    return e;
  };

  const save = async () => {
    const username = getUsername();
    if (!username) return;
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;

    const payload = {
      org_id: uiConfig.scope?.org_id || null,
      mandi_id: uiConfig.scope?.mandi_id ?? null,
      country: (uiConfig.scope as any)?.country || "IN",
      provider_code: form.provider_code,
      rounding_rule: form.rounding_rule,
      is_active: form.is_active,
      charge_lines: form.charge_lines.map((r, idx) => ({
        charge_code: toCode(r.charge_code) || toCode(r.charge_label) || `CUSTOM_CHARGE_${idx + 1}`,
        charge_label: String(r.charge_label || "").trim(),
        charge_category: String(r.charge_category || "OTHER").toUpperCase(),
        provider_code: String(r.provider_code || form.provider_code || "DEFAULT").toUpperCase(),
        enabled: !!r.enabled,
        charge_type: r.charge_type,
        fixed_amount: normalize2(r.fixed_amount),
        percentage: normalize2(r.percentage),
        min_amount: normalize2(r.min_amount),
        max_amount: normalize2(r.max_amount),
        tax_percentage: normalize2(r.tax_percentage),
        charged_to: r.charged_to,
        beneficiary_account_type: String(r.beneficiary_account_type || "PLATFORM").toUpperCase(),
        sort_order: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : idx + 1,
      })),
    };

    setLoading(true);
    try {
      await upsertSettlementChargeSettings({ username, payload });
      await load();
    } finally {
      setLoading(false);
    }
  };

  if (!canView) {
    return <PageContainer><Typography variant="h6">Not authorized.</Typography></PageContainer>;
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Typography variant="h5">Settlement Charge Settings</Typography>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" onClick={load} disabled={loading}>Refresh</Button>
          <Button variant="contained" onClick={save} disabled={!canEdit || loading}>Save Settings</Button>
        </Stack>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField select size="small" label="Provider" value={form.provider_code} onChange={(e) => setForm((s) => ({ ...s, provider_code: String(e.target.value).toUpperCase() }))}>
              <MenuItem value="DEFAULT">DEFAULT</MenuItem>
              <MenuItem value="CASHFREE">CASHFREE</MenuItem>
              <MenuItem value="RAZORPAY">RAZORPAY</MenuItem>
              <MenuItem value="PHONEPE">PHONEPE</MenuItem>
              <MenuItem value="PAYU">PAYU</MenuItem>
              <MenuItem value="CCAVENUE">CCAVENUE</MenuItem>
            </TextField>
            <TextField select size="small" label="Rounding Rule" value={form.rounding_rule} onChange={(e) => setForm((s) => ({ ...s, rounding_rule: e.target.value as RoundingRule }))}>
              <MenuItem value="NONE">NONE</MenuItem>
              <MenuItem value="NEAREST_RUPEE">NEAREST_RUPEE</MenuItem>
              <MenuItem value="ROUND_UP">ROUND_UP</MenuItem>
              <MenuItem value="ROUND_DOWN">ROUND_DOWN</MenuItem>
            </TextField>
            <FormControlLabel control={<Switch checked={form.is_active} onChange={(e) => setForm((s) => ({ ...s, is_active: e.target.checked }))} />} label="Active" />
            <Button startIcon={<AddIcon />} onClick={addLine}>Add Charge</Button>
          </Stack>
        </CardContent>
      </Card>

      <Alert severity="info" sx={{ mb: 2 }}>Dynamic charge-lines mode is active. SLAB type is disabled in UI for safe release.</Alert>

      <Card>
        <CardContent sx={{ overflowX: "auto" }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Enabled</TableCell>
                <TableCell>Charge</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Fixed</TableCell>
                <TableCell>%</TableCell>
                <TableCell>Min</TableCell>
                <TableCell>Max</TableCell>
                <TableCell>Tax %</TableCell>
                <TableCell>Charged To</TableCell>
                <TableCell>Delete</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {form.charge_lines.map((row, idx) => {
                const codeErr = errors[`code.${idx}`];
                const labelErr = errors[`label.${idx}`];
                return (
                  <TableRow key={`line-${idx}`}>
                    <TableCell><Switch checked={row.enabled} onChange={(e) => setLine(idx, { enabled: e.target.checked })} /></TableCell>
                    <TableCell>
                      <Stack spacing={0.8}>
                        <TextField
                          select
                          size="small"
                          value={row.charge_code}
                          onChange={(e) => {
                            const code = String(e.target.value);
                            const m = masters.find((x) => x.charge_code === code);
                            if (m) {
                              setLine(idx, {
                                charge_code: m.charge_code,
                                charge_label: m.charge_label,
                                charge_category: m.charge_category,
                                charge_type: m.default_charge_type,
                                charged_to: m.default_charged_to,
                                sort_order: m.sort_order || row.sort_order,
                              });
                            } else {
                              setLine(idx, { charge_code: toCode(code) });
                            }
                          }}
                        >
                          {masters.map((m) => <MenuItem key={m.charge_code} value={m.charge_code}>{m.charge_label}</MenuItem>)}
                          <MenuItem value="OTHER_CHARGE">Other / Custom</MenuItem>
                        </TextField>
                        <TextField
                          size="small"
                          label="Label"
                          value={row.charge_label}
                          onChange={(e) => {
                            const label = e.target.value;
                            const patch: Partial<ChargeLine> = { charge_label: label };
                            if (row.charge_code === "OTHER_CHARGE" || row.charge_code.startsWith("CUSTOM_")) patch.charge_code = toCode(label) || row.charge_code;
                            setLine(idx, patch);
                          }}
                          error={!!(codeErr || labelErr)}
                          helperText={codeErr || labelErr || ""}
                        />
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <TextField select size="small" value={row.charge_type} onChange={(e) => setLine(idx, { charge_type: e.target.value as ChargeType })}>
                        <MenuItem value="FIXED">FIXED</MenuItem>
                        <MenuItem value="PERCENTAGE">PERCENTAGE</MenuItem>
                      </TextField>
                    </TableCell>
                    <TableCell><TextField size="small" value={row.fixed_amount} onChange={(e) => setLine(idx, { fixed_amount: sanitizeNumeric(e.target.value) })} onBlur={() => setLine(idx, { fixed_amount: normalize2(row.fixed_amount) })} error={!!errors[`fixed.${idx}`]} /></TableCell>
                    <TableCell><TextField size="small" value={row.percentage} onChange={(e) => setLine(idx, { percentage: sanitizeNumeric(e.target.value) })} onBlur={() => setLine(idx, { percentage: normalize2(row.percentage) })} error={!!errors[`pct.${idx}`]} /></TableCell>
                    <TableCell><TextField size="small" value={row.min_amount} onChange={(e) => setLine(idx, { min_amount: sanitizeNumeric(e.target.value) })} onBlur={() => setLine(idx, { min_amount: normalize2(row.min_amount) })} error={!!errors[`min.${idx}`]} /></TableCell>
                    <TableCell><TextField size="small" value={row.max_amount} onChange={(e) => setLine(idx, { max_amount: sanitizeNumeric(e.target.value) })} onBlur={() => setLine(idx, { max_amount: normalize2(row.max_amount) })} error={!!errors[`max.${idx}`]} /></TableCell>
                    <TableCell><TextField size="small" value={row.tax_percentage} onChange={(e) => setLine(idx, { tax_percentage: sanitizeNumeric(e.target.value) })} onBlur={() => setLine(idx, { tax_percentage: normalize2(row.tax_percentage) })} error={!!errors[`tax.${idx}`]} /></TableCell>
                    <TableCell>
                      <TextField select size="small" value={row.charged_to} onChange={(e) => setLine(idx, { charged_to: e.target.value as ChargedTo })}>
                        <MenuItem value="TRADER">TRADER</MenuItem>
                        <MenuItem value="FARMER">FARMER</MenuItem>
                        <MenuItem value="PLATFORM">PLATFORM</MenuItem>
                      </TextField>
                    </TableCell>
                    <TableCell><IconButton onClick={() => setForm((s) => ({ ...s, charge_lines: s.charge_lines.filter((_, i) => i !== idx) }))}><DeleteOutlineIcon /></IconButton></TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageContainer>
  );
};
