import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  IconButton,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { PageContainer } from "../../components/PageContainer";
import { usePermissions } from "../../authz/usePermissions";
import {
  listPlatformModuleSettlementCharges,
  savePlatformModuleSettlementCharges,
} from "../../api/platformModuleSettlementCharges";

type Line = {
  charge_code: string;
  charge_label: string;
  charge_category: string;
  enabled: boolean;
  charge_type: "FIXED" | "PERCENTAGE";
  fixed_amount: number;
  percentage: number;
  min_amount: number;
  max_amount: number | null;
  tax_percentage: number;
  charged_to: "TRADER" | "FARMER" | "PLATFORM";
  beneficiary_account_type: string;
  sort_order: number;
  is_custom?: boolean;
};

const builtInDefaults: Line[] = [
  { charge_code: "PLATFORM_FEE", charge_label: "Platform Fee", charge_category: "PLATFORM", enabled: false, charge_type: "PERCENTAGE", fixed_amount: 0, percentage: 0, min_amount: 0, max_amount: null, tax_percentage: 18, charged_to: "TRADER", beneficiary_account_type: "PLATFORM", sort_order: 10 },
  { charge_code: "PAYMENT_GATEWAY_FEE", charge_label: "Payment Gateway Fee", charge_category: "GATEWAY", enabled: false, charge_type: "PERCENTAGE", fixed_amount: 0, percentage: 0, min_amount: 0, max_amount: null, tax_percentage: 18, charged_to: "TRADER", beneficiary_account_type: "GATEWAY", sort_order: 20 },
  { charge_code: "SETTLEMENT_PROCESSING_FEE", charge_label: "Settlement Processing Fee", charge_category: "SETTLEMENT", enabled: false, charge_type: "FIXED", fixed_amount: 0, percentage: 0, min_amount: 0, max_amount: null, tax_percentage: 18, charged_to: "FARMER", beneficiary_account_type: "PLATFORM", sort_order: 30 },
  { charge_code: "REFUND_PROCESSING_FEE", charge_label: "Refund Processing Fee", charge_category: "REFUND", enabled: false, charge_type: "FIXED", fixed_amount: 0, percentage: 0, min_amount: 0, max_amount: null, tax_percentage: 18, charged_to: "TRADER", beneficiary_account_type: "PLATFORM", sort_order: 40 },
];

const freshDefaults = (): Line[] => builtInDefaults.map((line) => ({ ...line }));

function username(): string {
  try {
    return JSON.parse(localStorage.getItem("cd_user") || "{}").username || "";
  } catch {
    return "";
  }
}

function normaliseCode(value: string): string {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function createCustomLine(index: number): Line {
  return {
    charge_code: `CUSTOM_CHARGE_${index}`,
    charge_label: `Custom Charge ${index}`,
    charge_category: "CUSTOM",
    enabled: true,
    charge_type: "FIXED",
    fixed_amount: 0,
    percentage: 0,
    min_amount: 0,
    max_amount: null,
    tax_percentage: 0,
    charged_to: "TRADER",
    beneficiary_account_type: "PLATFORM",
    sort_order: 100 + index,
    is_custom: true,
  };
}

export default function PlatformModuleSettlementChargesPage() {
  const { can } = usePermissions();
  const [moduleCode, setModuleCode] = useState("DIRECT_TRADE");
  const [provider, setProvider] = useState("DEFAULT");
  const [rounding, setRounding] = useState("NONE");
  const [lines, setLines] = useState<Line[]>(freshDefaults());
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const canSave = can("platform_module_settlement_charges.save", "UPDATE");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const response: any = await listPlatformModuleSettlementCharges(username(), {
        module_code: moduleCode,
        provider_code: provider,
      });
      if (String(response?.response?.responsecode || "1") !== "0") {
        throw new Error(response?.response?.description || "Unable to load charge settings.");
      }
      const row = response?.data?.settings?.[0] || response?.settings?.[0];
      if (row) {
        setLines(Array.isArray(row.charge_lines) && row.charge_lines.length ? row.charge_lines : freshDefaults());
        setRounding(row.rounding_rule || "NONE");
        setActive(row.is_active !== "N");
      } else {
        setLines(freshDefaults());
        setRounding("NONE");
        setActive(true);
      }
    } catch (e: any) {
      const responseMessage = e?.response?.data?.response?.description || e?.response?.data?.data?.message;
      setError(responseMessage || e?.message || "Unable to load charge settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [moduleCode, provider]);

  const update = (index: number, key: keyof Line, value: any) => {
    setLines((current) => current.map((line, itemIndex) => itemIndex === index ? { ...line, [key]: value } : line));
  };

  const addCustomCharge = () => {
    const customCount = lines.filter((line) => line.is_custom || line.charge_category === "CUSTOM").length + 1;
    setLines((current) => [...current, createCustomLine(customCount)]);
  };

  const removeCustomCharge = (index: number) => {
    setLines((current) => current.filter((_, itemIndex) => itemIndex !== index));
  };

  const validate = () => {
    const seen = new Set<string>();
    for (const line of lines) {
      const code = normaliseCode(line.charge_code);
      if (!code) throw new Error("Every charge must have a charge code.");
      if (seen.has(code)) throw new Error(`Duplicate charge code: ${code}`);
      seen.add(code);
      if (!String(line.charge_label || "").trim()) throw new Error(`Charge label is required for ${code}.`);
      if (line.charge_type === "PERCENTAGE" && (Number(line.percentage) < 0 || Number(line.percentage) > 100)) {
        throw new Error(`Percentage for ${line.charge_label} must be between 0 and 100.`);
      }
      if (Number(line.fixed_amount) < 0 || Number(line.min_amount) < 0 || Number(line.tax_percentage) < 0) {
        throw new Error(`Negative amounts are not allowed for ${line.charge_label}.`);
      }
      if (line.max_amount !== null && Number(line.max_amount) < Number(line.min_amount)) {
        throw new Error(`Maximum amount cannot be less than minimum amount for ${line.charge_label}.`);
      }
    }
  };

  const save = async () => {
    setLoading(true);
    setError("");
    setMessage("");
    try {
      validate();
      const normalisedLines = lines.map((line, index) => ({
        ...line,
        charge_code: normaliseCode(line.charge_code),
        charge_label: String(line.charge_label || "").trim(),
        charge_category: String(line.charge_category || "CUSTOM").trim().toUpperCase(),
        sort_order: Number(line.sort_order || (index + 1) * 10),
      }));
      const response: any = await savePlatformModuleSettlementCharges(username(), {
        module_code: moduleCode,
        provider_code: provider,
        rounding_rule: rounding,
        is_active: active ? "Y" : "N",
        charge_lines: normalisedLines,
      });
      if (String(response?.response?.responsecode || "1") !== "0") {
        throw new Error(response?.response?.description || "Unable to save charge settings.");
      }
      setMessage(response?.data?.message || "Platform module settlement charges saved successfully.");
      await load();
    } catch (e: any) {
      const responseMessage = e?.response?.data?.response?.description || e?.response?.data?.data?.message;
      setError(responseMessage || e?.message || "Unable to save charge settings.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography variant="h4" fontWeight={700}>Platform Module Settlement Charge Settings</Typography>
            <Typography color="text.secondary">Configure built-in and custom CiberMandi charges for Direct Trade, Contract Farming and Weekly Haat.</Typography>
          </Box>
          <Button
            variant="outlined"
            startIcon={<AddCircleOutlineIcon />}
            onClick={addCustomCharge}
            disabled={loading}
            sx={{ alignSelf: { xs: "stretch", md: "center" } }}
          >
            Add Custom Charge
          </Button>
        </Stack>

        {error && <Alert severity="error" onClose={() => setError("")}>{error}</Alert>}
        {message && <Alert severity="success" onClose={() => setMessage("")}>{message}</Alert>}

        <Card variant="outlined">
          <CardContent>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField select label="Module" value={moduleCode} onChange={(e) => setModuleCode(e.target.value)} sx={{ minWidth: 220 }}>
                <MenuItem value="DIRECT_TRADE">Direct Trade</MenuItem>
                <MenuItem value="CONTRACT_FARMING">Contract Farming</MenuItem>
                <MenuItem value="WEEKLY_HAAT">Weekly Haat</MenuItem>
              </TextField>
              <TextField label="Provider" value={provider} onChange={(e) => setProvider(e.target.value.toUpperCase())} sx={{ minWidth: 220 }} helperText="Use DEFAULT for module-wide charges or a gateway code for provider-specific charges." />
              <TextField select label="Rounding" value={rounding} onChange={(e) => setRounding(e.target.value)} sx={{ minWidth: 220 }}>
                <MenuItem value="NONE">No rounding</MenuItem>
                <MenuItem value="NEAREST_RUPEE">Nearest rupee</MenuItem>
                <MenuItem value="ROUND_UP">Round up</MenuItem>
                <MenuItem value="ROUND_DOWN">Round down</MenuItem>
              </TextField>
              <FormControlLabel control={<Switch checked={active} onChange={(e) => setActive(e.target.checked)} />} label="Active" />
            </Stack>
          </CardContent>
        </Card>

        {lines.map((line, index) => {
          const custom = Boolean(line.is_custom || line.charge_category === "CUSTOM");
          return (
            <Card key={`${line.charge_code}-${index}`} variant="outlined">
              <CardContent>
                <Stack spacing={2}>
                  <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
                    <Box sx={{ flex: 1 }}>
                      {custom ? (
                        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
                          <TextField fullWidth label="Charge label" value={line.charge_label} onChange={(e) => update(index, "charge_label", e.target.value)} />
                          <TextField fullWidth label="Charge code" value={line.charge_code} onChange={(e) => update(index, "charge_code", normaliseCode(e.target.value))} helperText="Stable language-neutral code" />
                          <TextField fullWidth label="Category" value={line.charge_category} onChange={(e) => update(index, "charge_category", normaliseCode(e.target.value))} />
                        </Stack>
                      ) : (
                        <>
                          <Typography fontWeight={700}>{line.charge_label}</Typography>
                          <Chip size="small" label={line.charge_code} sx={{ mt: 0.5 }} />
                        </>
                      )}
                    </Box>
                    <Stack direction="row" alignItems="center">
                      <Switch checked={line.enabled} onChange={(e) => update(index, "enabled", e.target.checked)} />
                      {custom && (
                        <Tooltip title="Remove custom charge">
                          <IconButton color="error" onClick={() => removeCustomCharge(index)} aria-label="Remove custom charge">
                            <DeleteOutlineIcon />
                          </IconButton>
                        </Tooltip>
                      )}
                    </Stack>
                  </Stack>

                  <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                    <TextField select label="Type" value={line.charge_type} onChange={(e) => update(index, "charge_type", e.target.value)} sx={{ minWidth: 150 }}>
                      <MenuItem value="FIXED">Fixed</MenuItem>
                      <MenuItem value="PERCENTAGE">Percentage</MenuItem>
                    </TextField>
                    <TextField
                      label={line.charge_type === "FIXED" ? "Fixed amount (₹)" : "Percentage (%)"}
                      type="number"
                      value={line.charge_type === "FIXED" ? line.fixed_amount : line.percentage}
                      onChange={(e) => update(index, line.charge_type === "FIXED" ? "fixed_amount" : "percentage", Number(e.target.value))}
                    />
                    <TextField label="Tax (GST %)" type="number" value={line.tax_percentage} onChange={(e) => update(index, "tax_percentage", Number(e.target.value))} />
                    <TextField select label="Charged to" value={line.charged_to} onChange={(e) => update(index, "charged_to", e.target.value)} sx={{ minWidth: 150 }}>
                      <MenuItem value="TRADER">Trader</MenuItem>
                      <MenuItem value="FARMER">Farmer</MenuItem>
                      <MenuItem value="PLATFORM">Platform</MenuItem>
                    </TextField>
                    <TextField label="Minimum (₹)" type="number" value={line.min_amount} onChange={(e) => update(index, "min_amount", Number(e.target.value))} />
                    <TextField label="Maximum (₹)" type="number" value={line.max_amount ?? ""} onChange={(e) => update(index, "max_amount", e.target.value === "" ? null : Number(e.target.value))} />
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          );
        })}

        <Box display="flex" justifyContent="flex-end">
          <Button variant="contained" disabled={!canSave || loading} onClick={save} sx={{ backgroundColor: "#4f6726", minWidth: 180 }}>
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </Box>
      </Stack>
    </PageContainer>
  );
}
