import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
  IconButton,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { PageContainer } from "../components/PageContainer";
import { ScreenHelpDrawer } from "../components/ScreenHelpDrawer";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { usePermissions } from "../authz/usePermissions";
import { fetchOrganisations } from "../services/adminUsersApi";
import { getMandisForCurrentScope } from "../services/mandiApi";
import { getAdminUsersWithRoles } from "../services/roles";
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
  charge_owner?: "CIBERMANDI" | "ORG" | "MANDI";
  editable_by_org?: boolean;
  locked_reason?: string | null;
  sort_order: number;
};
type ScopeType =
  | "CIBERMANDI_GLOBAL"
  | "CIBERMANDI_ORG_SPECIFIC"
  | "CIBERMANDI_MANDI_SPECIFIC"
  | "ORG_ALL_MANDIS"
  | "ORG_MANDI_SPECIFIC";

type FormState = {
  scope_type: ScopeType;
  org_id: string;
  mandi_id: string;
  provider_code: string;
  rounding_rule: RoundingRule;
  charge_lines: ChargeLine[];
  is_active: boolean;
};
type Option = { value: string; label: string };

const amountRegex = /^(?:\d+|\d*\.\d{1,2})$/;

function getUsername() {
  try {
    return JSON.parse(localStorage.getItem("cd_user") || "{}").username || "";
  } catch {
    return "";
  }
}
function toCode(raw: string) {
  return String(raw || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/__+/g, "_");
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
  const chargeCode = master?.charge_code || "OTHER_CHARGE";
  return {
    charge_code: chargeCode,
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

function extractArrayCandidates(resp: any, keys: string[]) {
  for (const key of keys) {
    const parts = key.split(".");
    let cur = resp;
    let ok = true;
    for (const p of parts) {
      if (!cur || typeof cur !== "object" || !(p in cur)) {
        ok = false;
        break;
      }
      cur = cur[p];
    }
    if (ok && Array.isArray(cur)) return cur;
  }
  return [];
}

function rootKeys(raw: any) {
  if (!raw || typeof raw !== "object") return [];
  try {
    return Object.keys(raw);
  } catch {
    return [];
  }
}

function mapOrgOption(raw: any): Option | null {
  const value = String(
    raw?.org_id ?? raw?._id ?? raw?.id ?? raw?.organisation_id ?? raw?.organization_id ?? raw?.org_code ?? raw?.code ?? ""
  ).trim();
  if (!value) return null;
  const label = String(
    raw?.org_name ?? raw?.organisation_name ?? raw?.organization_name ?? raw?.name ?? raw?.display_name ?? raw?.org_code ?? raw?.code ?? value
  ).trim();
  return { value, label: label || value };
}

function mapMandiOption(raw: any): Option | null {
  const value = String(raw?.mandi_id ?? raw?._id ?? raw?.id ?? raw?.mandi_code ?? raw?.code ?? "").trim();
  if (!value) return null;
  const label = String(raw?.mandi_name ?? raw?.name ?? raw?.display_name ?? raw?.mandi_slug ?? raw?.mandi_code ?? raw?.code ?? value).trim();
  return { value, label: label || value };
}

function getScopeSelectionMessage(scopeType: ScopeType, orgId: string, mandiId: string) {
  if (scopeType === "CIBERMANDI_GLOBAL") return "";
  if (scopeType === "CIBERMANDI_ORG_SPECIFIC") return orgId ? "" : "Please select organisation/mandi to load charge settings.";
  if (scopeType === "CIBERMANDI_MANDI_SPECIFIC") return orgId && mandiId ? "" : "Please select organisation/mandi to load charge settings.";
  if (scopeType === "ORG_ALL_MANDIS") return orgId ? "" : "Please select organisation/mandi to load charge settings.";
  if (scopeType === "ORG_MANDI_SPECIFIC") return orgId && mandiId ? "" : "Please select organisation/mandi to load charge settings.";
  return "";
}
function normalizeScopePayloadValues(scopeType: ScopeType, orgId: string, mandiId: string) {
  if (scopeType === "CIBERMANDI_GLOBAL") {
    return { org_id: null as string | null, mandi_id: null as number | null, applies_to_all_orgs: true, applies_to_all_mandis: true };
  }
  if (scopeType === "CIBERMANDI_ORG_SPECIFIC") {
    return { org_id: orgId || null, mandi_id: null as number | null, applies_to_all_orgs: false, applies_to_all_mandis: true };
  }
  if (scopeType === "CIBERMANDI_MANDI_SPECIFIC") {
    return { org_id: orgId || null, mandi_id: mandiId === "" ? null : Number(mandiId), applies_to_all_orgs: false, applies_to_all_mandis: false };
  }
  if (scopeType === "ORG_ALL_MANDIS") {
    return { org_id: orgId || null, mandi_id: null as number | null, applies_to_all_orgs: false, applies_to_all_mandis: true };
  }
  return { org_id: orgId || null, mandi_id: mandiId === "" ? null : Number(mandiId), applies_to_all_orgs: false, applies_to_all_mandis: false };
}

function normalizeOrgScopeLabel(line: ChargeLine, scopeType: ScopeType): string {
  if (scopeType === "ORG_ALL_MANDIS" && String(line.charge_owner || "").toUpperCase() === "ORG") {
    if (line.charge_code === "ORG_PLATFORM_FEE") return "Organisation Platform Fee";
    if (line.charge_code === "ORG_GATEWAY_FEE") return "Organisation Gateway Fee";
    if (line.charge_code === "ORG_MANDI_FEE") return "Organisation Mandi Fee";
    if (line.charge_code === "ORG_LABOUR_CHARGE") return "Organisation Labour Charge";
    if (line.charge_code === "ORG_LOADING_CHARGE") return "Organisation Loading Charge";
  }
  if (scopeType === "ORG_MANDI_SPECIFIC" && String(line.charge_owner || "").toUpperCase() === "MANDI") {
    if (line.charge_code === "MANDI_GATEWAY_FEE") return "Mandi Gateway Fee";
    if (line.charge_code === "MANDI_FEE") return "Mandi Fee";
    if (line.charge_code === "MANDI_LABOUR_CHARGE") return "Mandi Labour Charge";
    if (line.charge_code === "MANDI_LOADING_CHARGE") return "Mandi Loading Charge";
  }
  return line.charge_label;
}

export const SettlementChargeSettingsPage: React.FC = () => {
  const { can } = usePermissions();
  const uiConfig = useAdminUiConfig();
  const canView = useMemo(
    () => can("settlement_charge_settings.menu", "VIEW") || can("settlement_charge_settings.view", "VIEW"),
    [can],
  );
  const canEdit = useMemo(() => can("settlement_charge_settings.update", "UPDATE"), [can]);
  const canSuperEdit = useMemo(() => can("settlement_charge_settings.super_admin_update", "UPDATE"), [can]);
  const role = String(uiConfig.role || "").toUpperCase();
  const isSuperAdmin = role === "SUPER_ADMIN";
  const ownOrgId = String(uiConfig.scope?.org_id || "");
  const ownOrgCode = String((uiConfig.scope as any)?.org_code || ownOrgId || "");

  const [loading, setLoading] = useState(false);
  const [masters, setMasters] = useState<Master[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [openHelp, setOpenHelp] = useState(false);
  const language = "en";
  const [orgOptions, setOrgOptions] = useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [ciberMandiReadonlyLines, setCiberMandiReadonlyLines] = useState<ChargeLine[]>([]);
  const [orgLoadWarning, setOrgLoadWarning] = useState("");
  const [apiError, setApiError] = useState<string>("");
  const mastersCacheRef = useRef<Master[] | null>(null);
  const lastLoadKeyRef = useRef<string>("");
  const inflightLoadKeyRef = useRef<string>("");
  const orgFetchDoneRef = useRef<boolean>(false);
  const orgFallbackDoneRef = useRef<boolean>(false);
  const mandiFetchOrgRef = useRef<string>("");
  const [form, setForm] = useState<FormState>({
    scope_type: isSuperAdmin ? "CIBERMANDI_GLOBAL" : "ORG_ALL_MANDIS",
    org_id: String(uiConfig.scope?.org_id || ""),
    mandi_id: String(uiConfig.scope?.mandi_id ?? ""),
    provider_code: "DEFAULT",
    rounding_rule: "NONE",
    charge_lines: [],
    is_active: true,
  });
  const isCiberScope = form.scope_type.startsWith("CIBERMANDI");
  const canEditCurrentScope = isCiberScope ? canSuperEdit : canEdit;
  const showOrgSelector = form.scope_type !== "CIBERMANDI_GLOBAL";
  const showMandiSelector = form.scope_type === "CIBERMANDI_MANDI_SPECIFIC" || form.scope_type === "ORG_MANDI_SPECIFIC";
  const orgRequired = form.scope_type === "CIBERMANDI_ORG_SPECIFIC" || form.scope_type === "CIBERMANDI_MANDI_SPECIFIC" || form.scope_type === "ORG_ALL_MANDIS" || form.scope_type === "ORG_MANDI_SPECIFIC";
  const mandiRequired = form.scope_type === "CIBERMANDI_MANDI_SPECIFIC" || form.scope_type === "ORG_MANDI_SPECIFIC";
  const scopeSelectionMessage = useMemo(
    () => getScopeSelectionMessage(form.scope_type, form.org_id, form.mandi_id),
    [form.scope_type, form.org_id, form.mandi_id],
  );
  const selectedOrgLabel = useMemo(() => {
    if (!form.org_id) return "N/A";
    const m = orgOptions.find((o) => o.value === form.org_id);
    return m?.label || ownOrgCode || form.org_id;
  }, [form.org_id, orgOptions, ownOrgCode]);
  const selectedMandiLabel = useMemo(() => {
    if (!form.mandi_id) return "N/A";
    const m = mandiOptions.find((o) => o.value === form.mandi_id);
    return m?.label || form.mandi_id;
  }, [form.mandi_id, mandiOptions]);
  const editingBanner = useMemo(() => {
    if (form.scope_type === "CIBERMANDI_GLOBAL") return "Currently Editing: CiberMandi Global Charges";
    if (form.scope_type === "CIBERMANDI_ORG_SPECIFIC") return `Currently Editing: CiberMandi Charges for Organisation: ${selectedOrgLabel}`;
    if (form.scope_type === "CIBERMANDI_MANDI_SPECIFIC") return `Currently Editing: CiberMandi Charges for Organisation + Mandi: ${selectedOrgLabel} / ${selectedMandiLabel}`;
    if (form.scope_type === "ORG_ALL_MANDIS") return `Currently Editing: Organisation Charges: ${selectedOrgLabel}`;
    return `Currently Editing: Organisation + Mandi Charges: ${selectedOrgLabel} / ${selectedMandiLabel}`;
  }, [form.scope_type, selectedOrgLabel, selectedMandiLabel]);

  const isSuccessResponse = (resp: any) => {
    const code = String(resp?.response?.responsecode ?? resp?.responsecode ?? "");
    return code === "0" || code === "00";
  };

  const load = async (force = false) => {
    const username = getUsername();
    if (!username) return;
    if (getScopeSelectionMessage(form.scope_type, form.org_id, form.mandi_id)) return;
    const loadKey = JSON.stringify({
      scope_type: form.scope_type,
      org_id: form.org_id || null,
      mandi_id: form.mandi_id || null,
      provider_code: form.provider_code || "DEFAULT",
      country: (uiConfig.scope as any)?.country || "IN",
    });
    if (!force && inflightLoadKeyRef.current === loadKey) return;
    if (!force && lastLoadKeyRef.current === loadKey) return;
    inflightLoadKeyRef.current = loadKey;
    setLoading(true);
    setApiError("");
    try {
      const mastersPromise = mastersCacheRef.current
        ? Promise.resolve({ charge_masters: mastersCacheRef.current })
        : getSettlementChargeMasters({ username, payload: {} });

      const [mastersResp, settingsResp] = await Promise.all([
        mastersPromise,
        getSettlementChargeSettings({
          username,
          payload: {
            scope_type: form.scope_type,
            org_id: form.org_id || null,
            mandi_id: form.mandi_id === "" ? null : Number(form.mandi_id),
            country: (uiConfig.scope as any)?.country || "IN",
            provider_code: form.provider_code || "DEFAULT",
          },
        }),
      ]);

      if (!isSuccessResponse(settingsResp)) {
        setApiError(String(settingsResp?.response?.description || "Unable to load settlement charge settings."));
        return;
      }

      if (!mastersCacheRef.current && isSuccessResponse(mastersResp)) {
        const cached = (mastersResp?.charge_masters || mastersResp?.data?.charge_masters || []) as Master[];
        mastersCacheRef.current = cached;
      }

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
            charged_to: (["TRADER", "FARMER", "PLATFORM"].includes(String(r.charged_to || "").toUpperCase())
              ? String(r.charged_to).toUpperCase()
              : "TRADER") as ChargedTo,
            beneficiary_account_type: String(r.beneficiary_account_type || "PLATFORM").toUpperCase(),
            charge_owner: (["CIBERMANDI", "ORG", "MANDI"].includes(String(r.charge_owner || "").toUpperCase())
              ? String(r.charge_owner).toUpperCase()
              : "ORG") as "CIBERMANDI" | "ORG" | "MANDI",
            editable_by_org: r.editable_by_org !== false,
            locked_reason: r.locked_reason || null,
            sort_order: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : idx + 1,
          }))
        : [];
      const scopedNormalizedLines = loadedLines.map((line: ChargeLine) => ({
        ...line,
        charge_label: normalizeOrgScopeLabel(line, (settings.scope_type || form.scope_type) as ScopeType),
      }));
      const cmLines = Array.isArray(settings.ciber_mandi_charge_lines)
        ? settings.ciber_mandi_charge_lines.map((r: any, idx: number) => ({
            charge_code: toCode(r.charge_code || r.code || "") || `CM_CHARGE_${idx + 1}`,
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
            charged_to: (["TRADER", "FARMER", "PLATFORM"].includes(String(r.charged_to || "").toUpperCase())
              ? String(r.charged_to).toUpperCase()
              : "TRADER") as ChargedTo,
            beneficiary_account_type: String(r.beneficiary_account_type || "PLATFORM").toUpperCase(),
            charge_owner: "CIBERMANDI" as const,
            editable_by_org: false,
            locked_reason: r.locked_reason || "Managed by CiberMandi. Contact platform admin to change this fee.",
            sort_order: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : idx + 1,
          }))
        : [];

      setForm({
        scope_type: (settings.scope_type || (isSuperAdmin ? "CIBERMANDI_GLOBAL" : "ORG_ALL_MANDIS")) as ScopeType,
        org_id: String(settings.org_id || form.org_id || uiConfig.scope?.org_id || ""),
        mandi_id: settings.mandi_id === null || settings.mandi_id === undefined ? "" : String(settings.mandi_id),
        provider_code: "DEFAULT",
        rounding_rule: (["NONE", "NEAREST_RUPEE", "ROUND_UP", "ROUND_DOWN"].includes(
          String(settings.rounding_rule || "").toUpperCase(),
        )
          ? String(settings.rounding_rule).toUpperCase()
          : "NONE") as RoundingRule,
        charge_lines: scopedNormalizedLines,
        is_active: settings.is_active !== false,
      });
      setCiberMandiReadonlyLines(cmLines);
      setErrors({});
      lastLoadKeyRef.current = loadKey;
    } finally {
      inflightLoadKeyRef.current = "";
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView) return;
    if (scopeSelectionMessage) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, form.scope_type, form.org_id, form.mandi_id, form.provider_code, scopeSelectionMessage]);

  useEffect(() => {
    const username = getUsername();
    if (!username || !isSuperAdmin) return;
    if (orgFetchDoneRef.current) return;
    orgFetchDoneRef.current = true;
    fetchOrganisations({ username, language: "en" })
      .then((resp: any) => {
        const items = extractArrayCandidates(resp, [
          "items",
          "organisations",
          "organizations",
          "orgs",
          "data.items",
          "data.organisations",
          "data.organizations",
          "response.items",
          "response.data.organisations",
          "response.data.organizations",
          "response.data.items",
          "response.organisations",
          "response.organizations",
          "response.response.items",
          "response.response.data.items",
          "response.response.organisations",
          "response.response.organizations",
        ]);
        const mapped = items.map(mapOrgOption).filter(Boolean) as Option[];
        console.log("[SettlementChargeSettings][orgOptionsLoaded]", {
          rawKeys: rootKeys(resp),
          count: mapped.length,
          firstOption: mapped[0] || null,
        });
        if (mapped.length > 0) {
          setOrgOptions(mapped);
          setOrgLoadWarning("");
          return;
        }
        if (orgFallbackDoneRef.current) return;
        orgFallbackDoneRef.current = true;
        getAdminUsersWithRoles({ username, language: "en" })
          .then((fallbackResp: any) => {
            const fallbackList = extractArrayCandidates(fallbackResp, [
              "data.organisations",
              "response.data.organisations",
              "response.response.data.organisations",
              "organisations",
            ]);
            const fallbackMapped = fallbackList.map(mapOrgOption).filter(Boolean) as Option[];
            setOrgOptions(fallbackMapped);
            setOrgLoadWarning(
              fallbackMapped.length > 0
                ? ""
                : "Organisation list could not be loaded. Please refresh or check permissions.",
            );
          })
          .catch(() => {
            setOrgOptions([]);
            setOrgLoadWarning("Organisation list could not be loaded. Please refresh or check permissions.");
          });
      })
      .catch(() => {
        setOrgOptions([]);
        setOrgLoadWarning("Organisation list could not be loaded. Please refresh or check permissions.");
      });
  }, [isSuperAdmin]);

  useEffect(() => {
    const username = getUsername();
    if (!username || !form.org_id) {
      setMandiOptions([]);
      mandiFetchOrgRef.current = "";
      return;
    }
    if (mandiFetchOrgRef.current === form.org_id) return;
    mandiFetchOrgRef.current = form.org_id;
    getMandisForCurrentScope({ username, language: "en", org_id: form.org_id })
      .then((resp: any) => {
        const list = Array.isArray(resp) ? resp : extractArrayCandidates(resp, [
          "items",
          "mandis",
          "data",
          "data.items",
          "data.mandis",
          "response.items",
          "response.data",
          "response.data.items",
          "response.mandis",
        ]);
        const mapped = (list || []).map(mapMandiOption).filter(Boolean) as Option[];
        console.log("[SettlementChargeSettings][mandiOptionsLoaded]", {
          rawKeys: rootKeys(resp),
          count: mapped.length,
          firstOption: mapped[0] || null,
        });
        setMandiOptions(mapped);
      })
      .catch(() => setMandiOptions([]));
  }, [form.org_id]);

  useEffect(() => {
    setForm((prev) => {
      const currentOrg = ownOrgId;
      if (prev.scope_type === "CIBERMANDI_GLOBAL") {
        return { ...prev, org_id: "", mandi_id: "" };
      }
      if (prev.scope_type === "CIBERMANDI_ORG_SPECIFIC") {
        return { ...prev, org_id: isSuperAdmin ? prev.org_id : currentOrg, mandi_id: "" };
      }
      if (prev.scope_type === "CIBERMANDI_MANDI_SPECIFIC") {
        return { ...prev, org_id: isSuperAdmin ? prev.org_id : currentOrg };
      }
      if (prev.scope_type === "ORG_ALL_MANDIS") {
        return { ...prev, org_id: isSuperAdmin ? prev.org_id : currentOrg, mandi_id: "" };
      }
      if (prev.scope_type === "ORG_MANDI_SPECIFIC") {
        return { ...prev, org_id: isSuperAdmin ? prev.org_id : currentOrg };
      }
      return prev;
    });
  }, [form.scope_type, isSuperAdmin, ownOrgId]);

  useEffect(() => {
    if (!isSuperAdmin && ownOrgId) {
      setOrgOptions([{ value: ownOrgId, label: ownOrgCode }]);
      setForm((prev) => ({ ...prev, org_id: ownOrgId }));
    }
  }, [isSuperAdmin, ownOrgId, ownOrgCode]);

  const setLine = (idx: number, patch: Partial<ChargeLine>) => {
    setForm((s) => ({ ...s, charge_lines: s.charge_lines.map((r, i) => (i === idx ? { ...r, ...patch } : r)) }));
  };

  const addLine = () => {
    const master = masters.find((x) => x.charge_code === "OTHER_CHARGE");
    const owner = form.scope_type.startsWith("CIBERMANDI") ? "CIBERMANDI" : form.scope_type === "ORG_MANDI_SPECIFIC" ? "MANDI" : "ORG";
    const editable = !form.scope_type.startsWith("CIBERMANDI");
    const newLine = { ...defaultLine(master, form.charge_lines.length + 1), charge_owner: owner as any, editable_by_org: editable, locked_reason: editable ? null : "Managed by CiberMandi and applied globally." };
    setForm((s) => ({ ...s, charge_lines: [...s.charge_lines, newLine] }));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    form.charge_lines.forEach((r, idx) => {
      if (!toCode(r.charge_code)) e[`code.${idx}`] = "Charge code is required.";
      if (!String(r.charge_label || "").trim()) e[`label.${idx}`] = "Charge label is required.";
      if (!["FIXED", "PERCENTAGE"].includes(r.charge_type)) e[`type.${idx}`] = "Invalid charge type.";
      if (!isAmount(r.fixed_amount)) e[`fixed.${idx}`] = "Amount must be numeric with up to 2 decimals.";
      if (!isPct(r.percentage)) e[`pct.${idx}`] = "Percentage must be between 0 and 100.";
      if (!isAmount(r.min_amount)) e[`min.${idx}`] = "Amount must be numeric with up to 2 decimals.";
      if (!isAmount(r.max_amount)) e[`max.${idx}`] = "Amount must be numeric with up to 2 decimals.";
      if (!isPct(r.tax_percentage)) e[`tax.${idx}`] = "Tax % must be between 0 and 100.";
      if (!["TRADER", "FARMER", "PLATFORM"].includes(String(r.charged_to || "").toUpperCase())) {
        e[`charged_to.${idx}`] = "Charged To is required.";
      }
    });
    return e;
  };

  const hasValidationErrors = useMemo(() => Object.keys(validate()).length > 0, [form]);

  const save = async () => {
    const username = getUsername();
    if (!username) return;
    const e = validate();
    const scopeMessage = getScopeSelectionMessage(form.scope_type, form.org_id, form.mandi_id);
    if (scopeMessage) {
      setApiError(scopeMessage);
      return;
    }
    setErrors(e);
    if (Object.keys(e).length) return;
    const scopedPayload = normalizeScopePayloadValues(form.scope_type, form.org_id, form.mandi_id);

    const sourceLines = form.charge_lines.filter((row) => {
      if (form.scope_type === "ORG_ALL_MANDIS") return String(row.charge_owner || "ORG").toUpperCase() === "ORG";
      if (form.scope_type === "ORG_MANDI_SPECIFIC") return String(row.charge_owner || "MANDI").toUpperCase() === "MANDI";
      if (form.scope_type.startsWith("CIBERMANDI")) return String(row.charge_owner || "CIBERMANDI").toUpperCase() === "CIBERMANDI";
      return true;
    });
    const payload = {
      scope_type: form.scope_type,
      org_id: scopedPayload.org_id,
      mandi_id: scopedPayload.mandi_id,
      applies_to_all_orgs: scopedPayload.applies_to_all_orgs,
      applies_to_all_mandis: scopedPayload.applies_to_all_mandis,
      country: (uiConfig.scope as any)?.country || "IN",
      provider_code: "DEFAULT",
      rounding_rule: form.rounding_rule,
      is_active: form.is_active,
      charge_lines: sourceLines.map((r, idx) => ({
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
        charge_owner: r.charge_owner || "ORG",
        editable_by_org: r.editable_by_org !== false,
        locked_reason: r.locked_reason || null,
        sort_order: Number.isFinite(Number(r.sort_order)) ? Number(r.sort_order) : idx + 1,
      })),
    };

    setLoading(true);
    setApiError("");
    try {
      const upsertResp = await upsertSettlementChargeSettings({ username, payload });
      if (!isSuccessResponse(upsertResp)) {
        setApiError(String(upsertResp?.response?.description || "Unable to save settlement charge settings."));
        return;
      }
      lastLoadKeyRef.current = "";
      await load(true);
    } finally {
      setLoading(false);
    }
  };

  if (!canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">Settlement Charge Settings</Typography>
          <Typography variant="body2" color="text.secondary">
            Configure scoped settlement charges for CiberMandi, organisation and mandi.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <IconButton color="primary" size="small" onClick={() => setOpenHelp(true)} title="Help">
            <HelpOutlineIcon fontSize="small" />
          </IconButton>
          <Button variant="outlined" onClick={() => load(true)} disabled={loading}>
            Refresh
          </Button>
          <Button variant="contained" onClick={save} disabled={loading || hasValidationErrors || !canEditCurrentScope || !!scopeSelectionMessage}>
            Save Settings
          </Button>
        </Stack>
      </Stack>

      <Card className="cm-card">
        <CardContent>
          <Alert severity="info" sx={{ mb: 1.5 }}>
            {editingBanner}
          </Alert>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
              gap: 1.5,
              alignItems: "center",
            }}
          >
            <TextField
              select
              size="small"
              label="Charge Scope"
              value={form.scope_type}
              onChange={(e) => setForm((s) => ({ ...s, scope_type: e.target.value as ScopeType }))}
            >
              {isSuperAdmin ? (
                [
                  ["CIBERMANDI_GLOBAL", "CiberMandi Global"],
                  ["CIBERMANDI_ORG_SPECIFIC", "CiberMandi for Specific Org"],
                  ["CIBERMANDI_MANDI_SPECIFIC", "CiberMandi for Specific Mandi"],
                  ["ORG_ALL_MANDIS", "Org Charges"],
                  ["ORG_MANDI_SPECIFIC", "Mandi Charges"],
                ].map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)
              ) : (
                [
                  ["ORG_ALL_MANDIS", "All Mandis in My Org"],
                  ["ORG_MANDI_SPECIFIC", "Individual Mandi"],
                ].map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)
              )}
            </TextField>
            <TextField
              select
              size="small"
              label="Organisation"
              value={form.org_id}
              required={orgRequired}
              sx={{ display: showOrgSelector ? "block" : "none" }}
              disabled={
                form.scope_type === "CIBERMANDI_GLOBAL" ||
                (!isSuperAdmin && !!uiConfig.scope?.org_id)
              }
              onChange={(e) => setForm((s) => ({ ...s, org_id: String(e.target.value), mandi_id: "" }))}
            >
              {(isSuperAdmin ? orgOptions : [{ value: String(uiConfig.scope?.org_id || ""), label: String((uiConfig.scope as any)?.org_code || uiConfig.scope?.org_id || "") }])
                .filter((x) => Boolean(x.value))
                .map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
            <TextField
              select
              size="small"
              label="Mandi"
              value={form.mandi_id}
              required={mandiRequired}
              sx={{ display: showMandiSelector ? "block" : "none" }}
              disabled={!showMandiSelector}
              onChange={(e) => setForm((s) => ({ ...s, mandi_id: String(e.target.value) }))}
            >
              <MenuItem value="">Select Mandi</MenuItem>
              {mandiOptions.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}
            </TextField>
            <TextField size="small" label="Provider" value="DEFAULT (Fixed)" disabled />
            <TextField
              select
              size="small"
              label="Rounding Rule"
              value={form.rounding_rule}
              disabled={!canEditCurrentScope}
              onChange={(e) => setForm((s) => ({ ...s, rounding_rule: e.target.value as RoundingRule }))}
            >
              <MenuItem value="NONE">NONE</MenuItem>
              <MenuItem value="NEAREST_RUPEE">NEAREST_RUPEE</MenuItem>
              <MenuItem value="ROUND_UP">ROUND_UP</MenuItem>
              <MenuItem value="ROUND_DOWN">ROUND_DOWN</MenuItem>
            </TextField>
            <FormControlLabel
              control={
                <Switch
                  checked={form.is_active}
                  disabled={!canEditCurrentScope}
                  onChange={(e) => setForm((s) => ({ ...s, is_active: e.target.checked }))}
                />
              }
              label="Active"
            />
          </Box>
          {!!orgLoadWarning && <Alert severity="warning" sx={{ mt: 1.5 }}>{orgLoadWarning}</Alert>}
        </CardContent>
      </Card>

      {!!scopeSelectionMessage && <Alert severity="info">{scopeSelectionMessage}</Alert>}
      {!!apiError && <Alert severity="error">{apiError}</Alert>}

      <Alert severity="info" sx={{ borderRadius: 1.5 }}>
        Dynamic charge-line mode is active. Charges configured here are used to calculate trader total payable and farmer payout.
      </Alert>
      {!isSuperAdmin && ciberMandiReadonlyLines.length > 0 && (
        <Card className="cm-card">
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>CiberMandi Charges - Managed by CiberMandi</Typography>
            <Stack spacing={1}>
              {ciberMandiReadonlyLines.map((row, idx) => (
                <Box key={`cm-ro-${idx}`} sx={{ p: 1.2, border: "1px solid var(--cm-border-muted)", borderRadius: 1 }}>
                  <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                    <Chip size="small" label={row.charge_label} />
                    <Chip size="small" label="Owner: CIBERMANDI" />
                    <Chip size="small" label="Editable: No" />
                    <Chip size="small" label={`Type: ${row.charge_type}`} />
                    <Chip size="small" label={row.enabled ? "Enabled" : "Disabled"} />
                  </Stack>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      )}

      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" alignItems={{ xs: "flex-start", md: "center" }}>
        <Typography variant="h6">{!isSuperAdmin ? "Organisation Charges" : "Charge Rules"}</Typography>
        <Button startIcon={<AddIcon />} onClick={addLine} disabled={!canEditCurrentScope}>
          Add Charge
        </Button>
      </Stack>

      {scopeSelectionMessage || form.charge_lines.length === 0 ? (
        <Card className="cm-card">
          <CardContent>
            <Stack spacing={1.2} alignItems="flex-start">
              {scopeSelectionMessage ? (
                <Typography fontWeight={700}>Please select organisation/mandi to load charge settings.</Typography>
              ) : (
                <>
                  <Typography fontWeight={700}>No settlement charges configured yet.</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Add charges such as platform fee, gateway fee, mandi fee, labour charge, loading charge, etc.
                  </Typography>
                  <Button variant="outlined" startIcon={<AddIcon />} onClick={addLine} disabled={!canEditCurrentScope}>
                    Add Charge
                  </Button>
                </>
              )}
            </Stack>
          </CardContent>
        </Card>
      ) : (
        <Box sx={{ display: "grid", gap: 2 }}>
          {form.charge_lines.map((row, idx) => {
            const codeErr = errors[`code.${idx}`];
            const labelErr = errors[`label.${idx}`];
            const rowLockedForCurrentUser = row.charge_owner === "CIBERMANDI" && !isSuperAdmin;
            const editableForCurrentUser = canEditCurrentScope && !rowLockedForCurrentUser;
            return (
              <Card
                key={`line-${idx}`}
                className="cm-card"
                sx={{
                  borderRadius: "var(--cm-radius-lg)",
                  opacity: row.enabled ? 1 : 0.72,
                  transition: "opacity 0.2s ease",
                }}
              >
                <CardContent>
                  <Stack spacing={2}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5}>
                      <Stack spacing={0.75}>
                        <Typography variant="h6" sx={{ fontSize: 18 }}>{row.charge_label || "Untitled Charge"}</Typography>
                        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                          <Chip size="small" label={row.charge_category || "OTHER"} sx={{ bgcolor: "var(--cm-primary-soft)", color: "var(--cm-primary-dark)", fontWeight: 700 }} />
                          <Chip size="small" label={`Charged To: ${row.charged_to}`} variant="outlined" />
                          <Chip size="small" label={`Owner: ${row.charge_owner || "ORG"}`} variant="outlined" />
                          <Chip size="small" label={`Editable: ${editableForCurrentUser ? "Yes" : "No"}`} variant="outlined" />
                          <Chip
                            size="small"
                            label={row.enabled ? "Active" : "Disabled"}
                            sx={row.enabled
                              ? { bgcolor: "var(--cm-success-soft)", color: "var(--cm-success)", fontWeight: 700 }
                              : { bgcolor: "var(--cm-warning-soft)", color: "var(--cm-warning)", fontWeight: 700 }}
                          />
                        </Stack>
                      </Stack>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <FormControlLabel
                          control={<Switch checked={row.enabled} disabled={!canEditCurrentScope || rowLockedForCurrentUser} onChange={(e) => setLine(idx, { enabled: e.target.checked })} />}
                          label="Enabled"
                        />
                      </Stack>
                    </Stack>
                    {!isSuperAdmin && rowLockedForCurrentUser && (
                      <Alert severity="info">{row.locked_reason || "Managed by CiberMandi. Contact platform admin to change this fee."}</Alert>
                    )}

                    <Box
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" },
                        gap: 1.5,
                      }}
                    >
                      <TextField
                        select
                        size="small"
                        label="Charge Selector"
                        value={row.charge_code}
                        disabled={!canEditCurrentScope || rowLockedForCurrentUser}
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
                        error={!!codeErr}
                        helperText={codeErr || " "}
                      >
                        {masters.map((m) => (
                          <MenuItem key={m.charge_code} value={m.charge_code}>
                            {m.charge_label}
                          </MenuItem>
                        ))}
                        <MenuItem value="OTHER_CHARGE">Other / Custom</MenuItem>
                      </TextField>

                      <TextField
                        size="small"
                        label="Custom Label"
                        value={row.charge_label}
                        disabled={!canEditCurrentScope || rowLockedForCurrentUser}
                        onChange={(e) => {
                          const label = e.target.value;
                          const patch: Partial<ChargeLine> = { charge_label: label };
                          if (row.charge_code === "OTHER_CHARGE" || row.charge_code.startsWith("CUSTOM_")) {
                            patch.charge_code = toCode(label) || row.charge_code;
                          }
                          setLine(idx, patch);
                        }}
                        error={!!labelErr}
                        helperText={labelErr || " "}
                      />

                      <TextField
                        select
                        size="small"
                        label="Charge Type"
                        value={row.charge_type}
                        disabled={!canEditCurrentScope || rowLockedForCurrentUser}
                        onChange={(e) => setLine(idx, { charge_type: e.target.value as ChargeType })}
                        error={!!errors[`type.${idx}`]}
                        helperText={errors[`type.${idx}`] || " "}
                      >
                        <MenuItem value="FIXED">FIXED</MenuItem>
                        <MenuItem value="PERCENTAGE">PERCENTAGE</MenuItem>
                      </TextField>

                      <TextField
                        size="small"
                        label="Fixed Amount"
                        value={row.fixed_amount}
                        disabled={!canEditCurrentScope || rowLockedForCurrentUser}
                        onChange={(e) => setLine(idx, { fixed_amount: sanitizeNumeric(e.target.value) })}
                        onBlur={() => setLine(idx, { fixed_amount: normalize2(row.fixed_amount) })}
                        error={!!errors[`fixed.${idx}`]}
                        helperText={errors[`fixed.${idx}`] || " "}
                      />

                      <TextField
                        size="small"
                        label="Percentage"
                        value={row.percentage}
                        disabled={!canEditCurrentScope || rowLockedForCurrentUser}
                        onChange={(e) => setLine(idx, { percentage: sanitizeNumeric(e.target.value) })}
                        onBlur={() => setLine(idx, { percentage: normalize2(row.percentage) })}
                        error={!!errors[`pct.${idx}`]}
                        helperText={errors[`pct.${idx}`] || " "}
                      />

                      <TextField
                        size="small"
                        label="Min Amount"
                        value={row.min_amount}
                        disabled={!canEditCurrentScope || rowLockedForCurrentUser}
                        onChange={(e) => setLine(idx, { min_amount: sanitizeNumeric(e.target.value) })}
                        onBlur={() => setLine(idx, { min_amount: normalize2(row.min_amount) })}
                        error={!!errors[`min.${idx}`]}
                        helperText={errors[`min.${idx}`] || " "}
                      />

                      <TextField
                        size="small"
                        label="Max Amount"
                        value={row.max_amount}
                        disabled={!canEditCurrentScope || rowLockedForCurrentUser}
                        onChange={(e) => setLine(idx, { max_amount: sanitizeNumeric(e.target.value) })}
                        onBlur={() => setLine(idx, { max_amount: normalize2(row.max_amount) })}
                        error={!!errors[`max.${idx}`]}
                        helperText={errors[`max.${idx}`] || " "}
                      />

                      <TextField
                        size="small"
                        label="Tax %"
                        value={row.tax_percentage}
                        disabled={!canEditCurrentScope || rowLockedForCurrentUser}
                        onChange={(e) => setLine(idx, { tax_percentage: sanitizeNumeric(e.target.value) })}
                        onBlur={() => setLine(idx, { tax_percentage: normalize2(row.tax_percentage) })}
                        error={!!errors[`tax.${idx}`]}
                        helperText={errors[`tax.${idx}`] || " "}
                      />

                      <TextField
                        select
                        size="small"
                        label="Charged To"
                        value={row.charged_to}
                        disabled={!canEditCurrentScope || rowLockedForCurrentUser}
                        onChange={(e) => setLine(idx, { charged_to: e.target.value as ChargedTo })}
                        error={!!errors[`charged_to.${idx}`]}
                        helperText={errors[`charged_to.${idx}`] || " "}
                      >
                        <MenuItem value="TRADER">TRADER</MenuItem>
                        <MenuItem value="FARMER">FARMER</MenuItem>
                        <MenuItem value="PLATFORM">PLATFORM</MenuItem>
                      </TextField>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      )}
      <ScreenHelpDrawer
        open={openHelp}
        onClose={() => setOpenHelp(false)}
        route="/admin/settlement-charge-settings"
        language={language}
        title="Settlement Charge Settings — Help"
      />
    </PageContainer>
  );
};
