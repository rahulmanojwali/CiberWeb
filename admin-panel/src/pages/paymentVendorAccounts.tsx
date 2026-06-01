import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  FormControl,
  FormControlLabel,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { PageContainer } from "../components/PageContainer";
import { getCurrentAdminUsername } from "../utils/session";
import { getUserScope } from "../utils/userScope";
import { getPaymentVendorAccount, resolvePaymentVendorsForSettlement, upsertPaymentVendorAccount } from "../api/paymentVendorAccounts";
import { usePermissions } from "../authz/usePermissions";

const PARTY_TYPES = ["FARMER", "ORG", "MANDI", "CIBERMANDI"];
const GATEWAYS = ["CASHFREE", "RAZORPAY", "PAYU", "PHONEPE"];
const STATUS = ["PENDING", "ACTIVE", "FAILED", "DISABLED"];

const partyTypeHelperText: Record<string, string> = {
  CIBERMANDI: "CIBERMANDI vendor account receives platform split settlement.",
  ORG: "ORG vendor account receives organisation-level split settlement.",
  MANDI: "MANDI vendor account receives mandi-level split settlement when separate mapping is enabled.",
  FARMER: "FARMER vendor account receives farmer payout settlement.",
};

const initialForm = {
  party_type: "CIBERMANDI",
  party_ref_id: "",
  party_display_name: "",
  country: "IN",
  org_id: "",
  mandi_id: "",
  gateway_code: "CASHFREE",
  gateway_vendor_id: "",
  gateway_vendor_status: "PENDING",
  kyc_status: "",
  upi_id: "",
  bank_account_masked: "",
  ifsc_masked: "",
  account_holder_name: "",
  is_default: true,
  is_active: true,
};

export default function PaymentVendorAccountsPage() {
  const { can } = usePermissions();
  const username = getCurrentAdminUsername();
  const scope = getUserScope("payment-vendor-accounts");
  const [form, setForm] = useState<any>(initialForm);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [lastResponse, setLastResponse] = useState<any>(null);
  const [resolveOutput, setResolveOutput] = useState<any>(null);

  const isSuperAdmin = scope.role === "SUPER_ADMIN";
  const isOrgAdmin = scope.role === "ORG_ADMIN";
  const isMandiManager = scope.role === "MANDI_MANAGER";
  const isMandiAdmin = scope.role === "MANDI_ADMIN";
  const canView = can("payment_vendor_accounts.menu", "VIEW") || can("payment_vendor_accounts.view", "VIEW");
  const canUpdate = can("payment_vendor_accounts.update", "UPDATE");
  const canResolve = can("payment_vendor_accounts.resolve", "VIEW") || can("payment_vendor_accounts.resolve", "UPDATE");
  const canDemoSeed = can("payment_vendor_accounts.demo_seed", "CREATE") || can("payment_vendor_accounts.demo_seed", "UPDATE");
  const isViewOnly = !canUpdate && !canResolve && !canDemoSeed;

  const scopeMandiId = useMemo(() => {
    const raw = scope.rawUser || {};
    const mandiCandidate =
      raw?.mandi_id ??
      raw?.mandiId ??
      raw?.scope?.mandi_id ??
      raw?.scope?.mandiId ??
      null;
    if (mandiCandidate !== null && mandiCandidate !== undefined && String(mandiCandidate).trim() !== "") {
      return String(mandiCandidate).trim();
    }
    if (Array.isArray(scope.allowedMandis) && scope.allowedMandis.length > 0) return scope.allowedMandis[0];
    return "";
  }, [scope.allowedMandis, scope.rawUser]);

  const roleConfig = useMemo(() => {
    if (isSuperAdmin) return { defaultPartyType: "CIBERMANDI", allowedPartyTypes: PARTY_TYPES };
    if (isOrgAdmin || isMandiAdmin) return { defaultPartyType: "ORG", allowedPartyTypes: ["ORG", "MANDI", "FARMER"] };
    if (isMandiManager) return { defaultPartyType: "MANDI", allowedPartyTypes: ["MANDI", "FARMER"] };
    return { defaultPartyType: "FARMER", allowedPartyTypes: ["FARMER"] };
  }, [isMandiAdmin, isMandiManager, isOrgAdmin, isSuperAdmin, scope.role]);

  const allowedPartyTypes = roleConfig.allowedPartyTypes;
  const orgIdReadOnly = !isSuperAdmin || isViewOnly || isOrgAdmin || isMandiAdmin || isMandiManager;
  const mandiIdReadOnly = isViewOnly || isMandiManager;

  const blockedCiberMandi = !isSuperAdmin && form.party_type === "CIBERMANDI";

  const onChange = (key: string, value: any) => {
    setForm((prev: any) => ({ ...prev, [key]: value }));
  };

  useEffect(() => {
    setForm((prev: any) => {
      const nextPartyType = allowedPartyTypes.includes(prev.party_type)
        ? prev.party_type
        : roleConfig.defaultPartyType;
      return {
        ...prev,
        party_type: nextPartyType,
        org_id: (isOrgAdmin || isMandiAdmin || isMandiManager) ? String(scope.orgCode || prev.org_id || "") : prev.org_id,
        mandi_id: isMandiManager ? String(scopeMandiId || prev.mandi_id || "") : prev.mandi_id,
      };
    });
  }, [allowedPartyTypes, isMandiAdmin, isMandiManager, isOrgAdmin, roleConfig.defaultPartyType, scope.orgCode, scopeMandiId]);

  const withScopeDefaults = (payload: Record<string, any>) => {
    if (isSuperAdmin) return payload;
    const scopedOrgId = String(scope.orgCode || "").trim();
    const scopedMandiId = String(scopeMandiId || "").trim();
    return {
      ...payload,
      org_id: (isOrgAdmin || isMandiAdmin || isMandiManager) ? scopedOrgId : (payload.org_id || scopedOrgId || ""),
      mandi_id: isMandiManager
        ? (scopedMandiId ? Number(scopedMandiId) : null)
        : payload.mandi_id,
    };
  };

  const show = (type: "success" | "error" | "info", text: string) => {
    setMessageType(type);
    setMessage(text);
  };

  const onGet = async () => {
    if (!canView) {
      show("error", "You are not authorized to view vendor mappings.");
      return;
    }
    if (!username) return;
    setLoading(true);
    setResolveOutput(null);
    try {
      const payload = withScopeDefaults({
        party_type: form.party_type,
        party_ref_id: form.party_ref_id,
        gateway_code: form.gateway_code,
        country: form.country,
        org_id: form.org_id,
        mandi_id: form.mandi_id ? Number(form.mandi_id) : null,
      });
      const resp: any = await getPaymentVendorAccount({ username, payload });
      if (String(resp?.response?.responsecode || "1") !== "0") {
        throw new Error(resp?.response?.description || "Vendor mapping not found.");
      }
      const row = resp?.data || {};
      setLastResponse(row);
      setForm((prev: any) => ({ ...prev, ...row }));
      show("success", "Vendor mapping loaded.");
    } catch (err: any) {
      show("error", err?.message || "Unable to fetch vendor mapping.");
    } finally {
      setLoading(false);
    }
  };

  const onUpsert = async () => {
    if (!canUpdate) {
      show("error", "You are not authorized to update vendor mappings.");
      return;
    }
    if (!username) return;
    if (blockedCiberMandi) {
      show("error", "Org admin cannot manage CIBERMANDI vendor accounts.");
      return;
    }
    setLoading(true);
    setResolveOutput(null);
    try {
      const payload = withScopeDefaults({
        ...form,
        mandi_id: form.mandi_id ? Number(form.mandi_id) : null,
      });
      const resp: any = await upsertPaymentVendorAccount({ username, payload });
      if (String(resp?.response?.responsecode || "1") !== "0") {
        throw new Error(resp?.response?.description || "Unable to save vendor mapping.");
      }
      setLastResponse(resp?.data || null);
      show("success", "Vendor mapping saved.");
    } catch (err: any) {
      show("error", err?.message || "Unable to save vendor mapping.");
    } finally {
      setLoading(false);
    }
  };

  const onResolve = async () => {
    if (!canResolve) {
      show("error", "You are not authorized to resolve settlement split vendors.");
      return;
    }
    if (!username) return;
    setLoading(true);
    try {
      const payload = withScopeDefaults({
        gateway_code: form.gateway_code,
        gateway_mode: "SANDBOX",
        org_id: form.org_id || scope.orgCode || "",
        mandi_id: form.mandi_id ? Number(form.mandi_id) : null,
        org_party_ref_id: form.org_id || scope.orgCode || "PLATFORM_OPS_INDIA",
        cibermandi_party_ref_id: "CIBERMANDI_PLATFORM",
        farmer_details: { farmer_mobile: form.party_ref_id },
        payment_breakup: {
          farmer_amount: "142500.00",
          charge_lines: [
            { charge_owner: "CIBERMANDI", amount: "15.00" },
            { charge_owner: "ORG", amount: "3.00" }
          ]
        }
      });
      const resp: any = await resolvePaymentVendorsForSettlement({ username, payload });
      if (String(resp?.response?.responsecode || "1") !== "0") {
        throw new Error(resp?.response?.description || "Unable to resolve split vendors.");
      }
      setResolveOutput(resp?.data || null);
      show("success", "Split vendor lines resolved.");
    } catch (err: any) {
      show("error", err?.message || "Unable to resolve split vendors.");
    } finally {
      setLoading(false);
    }
  };

  const createDemoVendorAccounts = async () => {
    if (!canDemoSeed) {
      show("error", "You are not authorized to run demo seed.");
      return;
    }
    if (!username) return;
    const orgRef = String(form.org_id || scope.orgCode || "").trim();
    const farmerRef = String(form.party_ref_id || "").trim();
    if (!orgRef || !farmerRef) {
      show("error", "Enter org_id and farmer mobile/party_ref_id before demo setup.");
      return;
    }
    setLoading(true);
    try {
      const entries = [
        { party_type: "CIBERMANDI", party_ref_id: "CIBERMANDI_PLATFORM", party_display_name: "CIBERMANDI Platform" },
        { party_type: "ORG", party_ref_id: orgRef, party_display_name: `ORG ${orgRef}` },
        { party_type: "FARMER", party_ref_id: farmerRef, party_display_name: `FARMER ${farmerRef}` },
      ].filter((row) => isSuperAdmin || row.party_type !== "CIBERMANDI");

      for (const entry of entries) {
        const resp: any = await upsertPaymentVendorAccount({
          username,
          payload: withScopeDefaults({
            ...entry,
            gateway_code: "CASHFREE",
            gateway_vendor_status: "ACTIVE",
            kyc_status: "DEMO_VERIFIED",
            country: form.country || "IN",
            org_id: orgRef,
            mandi_id: form.mandi_id ? Number(form.mandi_id) : null,
            is_default: true,
            is_active: true,
            trigger_adapter_onboarding: "Y",
          })
        });
        if (String(resp?.response?.responsecode || "1") !== "0") {
          throw new Error(resp?.response?.description || `Failed for ${entry.party_type}`);
        }
      }
      show("success", "Demo vendor accounts created for selected entities.");
    } catch (err: any) {
      show("error", err?.message || "Unable to create demo vendor accounts.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageContainer title="Payment Vendor Accounts" subtitle="Manage payout receiver/vendor mappings used for settlement split payments.">
      <Stack spacing={2}>
        {!canView && <Alert severity="error">You do not have permission to view this screen.</Alert>}
        {message ? <Alert severity={messageType}>{message}</Alert> : null}
        {isViewOnly && <Alert severity="info">View-only access. Update/resolve/demo actions are disabled.</Alert>}
        <Alert severity="info">
          Settlement Charge Settings decides how much to charge. Vendor Accounts decides where each split amount is settled.
        </Alert>
        {isSuperAdmin && (
          <Alert severity="info">
            Farmer payout accounts are normally created from farmer mobile/profile. Use this only for admin correction/demo.
          </Alert>
        )}
        {!isSuperAdmin && (isOrgAdmin || isMandiAdmin || isMandiManager) && (
          <Alert severity="info">
            Org Admin scope: manage own ORG/MANDI/FARMER mappings. CIBERMANDI mapping is restricted.
          </Alert>
        )}
        <Card>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Party Type</InputLabel>
                  <Select value={form.party_type} label="Party Type" onChange={(e) => onChange("party_type", e.target.value)} disabled={isViewOnly}>
                    {allowedPartyTypes.map((pt) => (<MenuItem key={pt} value={pt}>{pt}</MenuItem>))}
                  </Select>
                </FormControl>
                <Typography variant="caption" color="text.secondary">
                  {partyTypeHelperText[form.party_type] || ""}
                </Typography>
              </Grid>
              <Grid item xs={12} md={3}><TextField fullWidth label="Party Ref ID" value={form.party_ref_id} onChange={(e) => onChange("party_ref_id", e.target.value)} disabled={isViewOnly} /></Grid>
              <Grid item xs={12} md={3}><TextField fullWidth label="Display Name" value={form.party_display_name} onChange={(e) => onChange("party_display_name", e.target.value)} disabled={isViewOnly} /></Grid>
              <Grid item xs={12} md={3}><TextField fullWidth label="Country" value={form.country} onChange={(e) => onChange("country", e.target.value)} disabled={isViewOnly} /></Grid>

              <Grid item xs={12} md={3}><TextField fullWidth label="Org ID" value={form.org_id} onChange={(e) => onChange("org_id", e.target.value)} disabled={orgIdReadOnly} /></Grid>
              <Grid item xs={12} md={3}><TextField fullWidth label="Mandi ID" value={form.mandi_id} onChange={(e) => onChange("mandi_id", e.target.value)} disabled={mandiIdReadOnly} /></Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Gateway Code</InputLabel>
                  <Select value={form.gateway_code} label="Gateway Code" onChange={(e) => onChange("gateway_code", e.target.value)} disabled={isViewOnly}>
                    {GATEWAYS.map((g) => (<MenuItem key={g} value={g}>{g}</MenuItem>))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}><TextField fullWidth label="Gateway Vendor ID" value={form.gateway_vendor_id} onChange={(e) => onChange("gateway_vendor_id", e.target.value)} disabled={isViewOnly} /></Grid>

              <Grid item xs={12} md={3}>
                <FormControl fullWidth>
                  <InputLabel>Vendor Status</InputLabel>
                  <Select value={form.gateway_vendor_status} label="Vendor Status" onChange={(e) => onChange("gateway_vendor_status", e.target.value)} disabled={isViewOnly}>
                    {STATUS.map((s) => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} md={3}><TextField fullWidth label="KYC Status" value={form.kyc_status} onChange={(e) => onChange("kyc_status", e.target.value)} disabled={isViewOnly} /></Grid>
              <Grid item xs={12} md={3}><TextField fullWidth label="UPI ID" value={form.upi_id} onChange={(e) => onChange("upi_id", e.target.value)} disabled={isViewOnly} /></Grid>
              <Grid item xs={12} md={3}><TextField fullWidth label="Account Holder Name" value={form.account_holder_name} onChange={(e) => onChange("account_holder_name", e.target.value)} disabled={isViewOnly} /></Grid>

              <Grid item xs={12} md={3}><TextField fullWidth label="Bank Account Masked" value={form.bank_account_masked} onChange={(e) => onChange("bank_account_masked", e.target.value)} disabled={isViewOnly} /></Grid>
              <Grid item xs={12} md={3}><TextField fullWidth label="IFSC Masked" value={form.ifsc_masked} onChange={(e) => onChange("ifsc_masked", e.target.value)} disabled={isViewOnly} /></Grid>
              <Grid item xs={12} md={3}><FormControlLabel control={<Checkbox checked={Boolean(form.is_default)} onChange={(e) => onChange("is_default", e.target.checked)} disabled={isViewOnly} />} label="Default" /></Grid>
              <Grid item xs={12} md={3}><FormControlLabel control={<Checkbox checked={Boolean(form.is_active)} onChange={(e) => onChange("is_active", e.target.checked)} disabled={isViewOnly} />} label="Active" /></Grid>
            </Grid>

            <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} sx={{ mt: 2 }}>
              <Button variant="outlined" disabled={loading || !canView} onClick={onGet}>Get Mapping</Button>
              <Button variant="contained" disabled={loading || !canUpdate || isViewOnly} onClick={onUpsert}>Upsert Mapping</Button>
              <Button variant="outlined" disabled={loading || !canResolve || isViewOnly} onClick={onResolve}>Resolve For Settlement</Button>
              <Button variant="contained" color="secondary" disabled={loading || !canDemoSeed || isViewOnly} onClick={createDemoVendorAccounts}>Create Demo Vendor Accounts</Button>
            </Stack>
          </CardContent>
        </Card>

        {resolveOutput && (
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>Resolved Split Lines</Typography>
              <Box component="pre" sx={{ m: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {JSON.stringify(resolveOutput, null, 2)}
              </Box>
            </CardContent>
          </Card>
        )}

        {lastResponse && (
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 1 }}>Last Saved/Loaded Vendor Mapping</Typography>
              <Box component="pre" sx={{ m: 0, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                {JSON.stringify(lastResponse, null, 2)}
              </Box>
            </CardContent>
          </Card>
        )}
      </Stack>
    </PageContainer>
  );
}
