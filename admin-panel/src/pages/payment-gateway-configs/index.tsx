import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { getCurrentAdminUsername } from "../../utils/session";
import { getUserScope } from "../../utils/userScope";
import { postEncrypted } from "../../services/sharedEncryptedRequest";
import { API_ROUTES, API_TAGS } from "../../config/appConfig";
import {
  listPaymentGatewayConfigs,
  savePaymentGatewayConfig,
  setDefaultPaymentGatewayConfig,
  testPaymentGatewayConfig,
  togglePaymentGatewayConfig,
} from "../../api/paymentGatewayConfigs";

const PROVIDERS = ["PAYU", "CASHFREE", "RAZORPAY", "PHONEPE", "PAYTM", "CCAVENUE", "INSTAMOJO", "STRIPE_INDIA", "ZAAKPAY", "PAYONEER", "MANUAL"];
const MODES = ["TEST", "LIVE"];
const METHODS = ["UPI", "CARD", "NETBANKING"];
const FEE_BORNE_BY = ["TRADER", "PLATFORM", "MANDI"];
const PROVIDER_ORDER_CREATION_SUPPORT: Record<string, boolean> = {
  PAYU: true,
  CASHFREE: true,
  RAZORPAY: true,
  PHONEPE: true,
  PAYTM: true,
  CCAVENUE: true,
  INSTAMOJO: true,
  STRIPE_INDIA: true,
  ZAAKPAY: true,
  PAYONEER: false,
  MANUAL: false,
};
const CM_PRIMARY = "#55632C";
const CM_PRIMARY_LIGHT = "#EEF3E4";
const CM_SURFACE = "#FFFFFF";
const CM_BG = "#F6F1E8";
const CM_BORDER = "#D8D2C3";
const CM_TEXT = "#2F3325";
const CM_MUTED = "#6B6B6B";

type Row = {
  _id?: string;
  id: string;
  provider_code: string;
  provider_name?: string;
  owner_type?: "PLATFORM" | "ORG" | string;
  org_id?: string | null;
  org_name?: string | null;
  mandi_id?: number | null;
  mode: string;
  priority: number;
  is_default?: boolean;
  is_active: string;
  allowed_methods?: string[];
  fee_borne_by?: string;
  updated_on?: string;
  client_id?: string;
  return_url?: string;
  notify_url?: string;
  has_client_secret?: boolean;
  has_webhook_secret?: boolean;
  access_code?: string;
};

type OrgOption = {
  id: string;
  org_name: string;
  org_code?: string;
};

type TestResult = {
  type: "success" | "error";
  message: string;
  details?: {
    provider_code?: string;
    test_type?: string;
    order_id?: string | null;
    txnid?: string;
    payment_session_id_exists?: boolean;
    dashboard_visible?: boolean;
    dashboard_note?: string;
  };
} | null;

export const PaymentGatewayConfigsPage: React.FC = () => {
  const userScope = getUserScope("payment-gateway-configs");
  const isSuperAdmin = userScope.role === "SUPER_ADMIN";
  const canManageGateway = userScope.role === "SUPER_ADMIN" || userScope.role === "ORG_ADMIN";
  const orgOwnerName =
    userScope.rawUser?.org_name ||
    userScope.rawUser?.orgName ||
    userScope.rawUser?.org_code ||
    userScope.orgCode ||
    "Organisation";
  const [gatewayScope, setGatewayScope] = useState<"PLATFORM" | "ORG" | "ALL_ORGS">("PLATFORM");
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [orgOptions, setOrgOptions] = useState<OrgOption[]>([]);
  const selectedOrg = orgOptions.find((org) => org.id === selectedOrgId) || null;
  const effectiveScope = isSuperAdmin ? gatewayScope : "ORG";
  const scopeLabel = isSuperAdmin
    ? gatewayScope === "PLATFORM"
      ? "Showing Platform Gateway Configurations"
      : gatewayScope === "ORG"
        ? "Showing Organisation Gateway Configurations"
        : "Showing All Organisation Gateway Configurations"
    : "Organisation Payment Gateway Settings";
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [edit, setEdit] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);

  const loadOrgs = async () => {
    if (!isSuperAdmin) return;
    const username = getCurrentAdminUsername();
    if (!username) return;
    try {
      const resp: any = await postEncrypted(API_ROUTES.admin.getOrganisations, {
        api: API_TAGS.ORGS.list,
        username,
        language: "en",
      });
      const list = Array.isArray(resp?.response?.data?.organisations) ? resp.response.data.organisations : [];
      setOrgOptions(list.map((org: any) => ({
        id: String(org._id || org.org_id || org.id || ""),
        org_name: org.org_name || org.label || org.org_code || String(org._id || ""),
        org_code: org.org_code,
      })).filter((org: OrgOption) => org.id));
    } catch (err) {
      console.error("[payment-gateway-configs] org load failed", err);
    }
  };

  const load = async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    if (isSuperAdmin && effectiveScope === "ORG" && !selectedOrgId) {
      setRows([]);
      setErrorMsg("");
      return;
    }
    setLoading(true);
    setErrorMsg("");
    try {
      const payload: Record<string, any> = { scope: effectiveScope };
      if (isSuperAdmin && effectiveScope === "ORG") {
        payload.org_id = selectedOrgId;
      }
      const resp: any = await listPaymentGatewayConfigs({ username, payload });
      if (String(resp?.response?.responsecode || "1") !== "0") {
        throw new Error(resp?.response?.description || "Unable to load payment gateway configs.");
      }
      const list = Array.isArray(resp?.data?.configs) ? resp.data.configs : [];
      setRows(list.map((x: any) => ({ ...x, id: String(x._id || `${x.provider_code}-${x.org_id || "GLOBAL"}-${x.mandi_id ?? "ALL"}`) })));
    } catch (err: any) {
      setErrorMsg(err?.message || "Unable to load payment gateway configs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadOrgs(); }, [isSuperAdmin]);
  useEffect(() => { load(); }, [effectiveScope, selectedOrgId]);

  const createAddDraft = () => {
    const nextPriority = (rows.reduce((max, row) => Math.max(max, Number(row.priority || 0)), 0) || 0) + 1;
    return {
      is_new: true,
      provider_code: "",
      mode: "TEST",
      priority: String(nextPriority),
      is_active: "Y",
      client_id: "",
      client_secret: "",
      webhook_secret: "",
      access_code: "",
      return_url: "",
      notify_url: "",
      allowed_methods: ["UPI"],
      fee_borne_by: "TRADER",
      owner_type: effectiveScope === "ORG" ? "ORG" : "PLATFORM",
      org_id: effectiveScope === "ORG" ? selectedOrgId || null : null,
      org_name: effectiveScope === "ORG" ? selectedOrg?.org_name || null : null,
      mandi_id: null,
      has_client_secret: false,
      has_webhook_secret: false,
    };
  };

  const openAdd = () => {
    if (!canManageGateway || effectiveScope === "ALL_ORGS") return;
    if (isSuperAdmin && effectiveScope === "ORG" && !selectedOrgId) {
      setErrorMsg("Select an organisation before adding an organisation gateway.");
      return;
    }
    setEdit(createAddDraft());
    setTestResult(null);
    setTesting(false);
    setEditOpen(true);
  };

  const openEdit = (row: Row) => {
    if (!canManageGateway || effectiveScope === "ALL_ORGS") return;
    setEdit({
      is_new: false,
      provider_code: row.provider_code,
      mode: row.mode || "TEST",
      priority: String(row.priority || 1),
      is_active: row.is_active || "Y",
      client_id: row.client_id || "",
      client_secret: "",
      webhook_secret: "",
      access_code: row.access_code || "",
      return_url: row.return_url || "",
      notify_url: row.notify_url || "",
      allowed_methods: row.allowed_methods?.length ? row.allowed_methods : ["UPI"],
      fee_borne_by: row.fee_borne_by || "TRADER",
      owner_type: row.owner_type || (row.org_id ? "ORG" : "PLATFORM"),
      org_id: row.org_id ?? null,
      org_name: row.org_name ?? null,
      mandi_id: row.mandi_id ?? null,
      has_client_secret: Boolean(row.has_client_secret),
      has_webhook_secret: Boolean(row.has_webhook_secret),
    });
    setTestResult(null);
    setTesting(false);
    setEditOpen(true);
  };

  const onSave = async () => {
    const username = getCurrentAdminUsername();
    if (!username || !edit || !canManageGateway) return;
    setSaving(true);
    setErrorMsg("");
    try {
      if (!String(edit.provider_code || "").trim()) throw new Error("Provider is required.");
      if (!String(edit.mode || "").trim()) throw new Error("Mode is required.");
      if (!String(edit.priority || "").trim()) throw new Error("Priority is required.");
      if (isSuperAdmin && effectiveScope === "ORG" && !selectedOrgId) throw new Error("Organisation is required.");
      if (!String(edit.client_id || "").trim()) throw new Error("Merchant Key / App ID is required.");
      if (!String(edit.client_secret || "").trim() && !edit?.has_client_secret) throw new Error("Secret key/salt is required.");
      if (String(edit.provider_code || "").toUpperCase() === "CCAVENUE" && !String(edit.access_code || "").trim()) {
        throw new Error("Access Code is required for CCAvenue.");
      }

      const providerCode = String(edit.provider_code || "").toUpperCase();
      const supportsOrderCreation = PROVIDER_ORDER_CREATION_SUPPORT[providerCode] !== false;
      const isActivating = String(edit.is_active || "Y") === "Y";
      const generatedUrls = getProviderUrls(edit.provider_code || "", edit.mode || "TEST");
      const allowFutureSetup = isActivating && !supportsOrderCreation
        ? window.confirm(`${providerCode} does not support settlement order creation right now. Save for future setup anyway?`)
        : false;
      if (isActivating && !supportsOrderCreation && !allowFutureSetup) {
        setSaving(false);
        return;
      }

      const resp: any = await savePaymentGatewayConfig({
        username,
        payload: {
          provider_code: edit.provider_code,
          scope: effectiveScope,
          owner_type: effectiveScope === "ORG" ? "ORG" : "PLATFORM",
          org_id: effectiveScope === "ORG" ? (isSuperAdmin ? selectedOrgId : edit.org_id ?? null) : null,
          org_name: effectiveScope === "ORG" ? (isSuperAdmin ? selectedOrg?.org_name || null : edit.org_name ?? orgOwnerName) : null,
          mandi_id: edit.mandi_id ?? null,
          mode: edit.mode,
          priority: Number(edit.priority || 1),
          is_active: edit.is_active,
          client_id: edit.client_id,
          client_secret: edit.client_secret,
          access_code: edit.access_code,
          config: {
            access_code: edit.access_code,
          },
          webhook_secret: edit.webhook_secret,
          return_url: generatedUrls.return_url,
          notify_url: generatedUrls.notify_url,
          allowed_methods: edit.allowed_methods,
          fee_borne_by: edit.fee_borne_by,
          allow_future_setup: allowFutureSetup,
        },
      });
      if (String(resp?.response?.responsecode || "1") !== "0") {
        throw new Error(resp?.response?.description || "Unable to save payment gateway config.");
      }
      setEditOpen(false);
      setTestResult(null);
      await load();
    } catch (err: any) {
      setErrorMsg(err?.message || "Unable to save payment gateway config.");
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (row: Row) => {
    const username = getCurrentAdminUsername();
    if (!username || !canManageGateway || effectiveScope === "ALL_ORGS") return;
    const next = String(row.is_active || "Y") === "Y" ? "N" : "Y";
    const providerCode = String(row.provider_code || "").toUpperCase();
    const supportsOrderCreation = PROVIDER_ORDER_CREATION_SUPPORT[providerCode] !== false;
    const allowFutureSetup = next === "Y" && !supportsOrderCreation
      ? window.confirm(`${providerCode} does not support settlement order creation. Enable only for future setup?`)
      : false;
    if (next === "Y" && !supportsOrderCreation && !allowFutureSetup) return;

    const resp: any = await togglePaymentGatewayConfig({
      username,
      payload: {
        provider_code: row.provider_code,
        scope: effectiveScope,
        owner_type: row.owner_type || (row.org_id ? "ORG" : "PLATFORM"),
        org_id: row.org_id ?? null,
        mandi_id: row.mandi_id ?? null,
        mode: row.mode,
        is_active: next,
        allow_future_setup: allowFutureSetup,
      },
    });
    if (String(resp?.response?.responsecode || "1") !== "0") {
      setErrorMsg(resp?.response?.description || "Unable to toggle payment gateway config.");
      return;
    }
    await load();
  };

  const onSetDefault = async (row: Row) => {
    const username = getCurrentAdminUsername();
    if (!username || !canManageGateway || effectiveScope === "ALL_ORGS") return;
    const providerCode = String(row.provider_code || "").toUpperCase();
    const supportsOrderCreation = PROVIDER_ORDER_CREATION_SUPPORT[providerCode] !== false;
    const allowFutureSetup = !supportsOrderCreation
      ? window.confirm(`${providerCode} may not support settlement order creation yet. Set as default for future setup anyway?`)
      : false;
    if (!supportsOrderCreation && !allowFutureSetup) return;

    const resp: any = await setDefaultPaymentGatewayConfig({
      username,
      payload: {
        provider_code: row.provider_code,
        scope: effectiveScope,
        owner_type: row.owner_type || (row.org_id ? "ORG" : "PLATFORM"),
        org_id: row.org_id ?? null,
        mandi_id: row.mandi_id ?? null,
        mode: row.mode,
        allow_future_setup: allowFutureSetup,
      },
    });
    if (String(resp?.response?.responsecode || "1") !== "0") {
      setErrorMsg(resp?.response?.description || "Unable to set default payment gateway.");
      return;
    }
    await load();
  };

  const onTestConnection = async () => {
    const username = getCurrentAdminUsername();
    if (!username || !edit || !canManageGateway) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res: any = await testPaymentGatewayConfig({
        username,
        payload: {
          provider_code: edit.provider_code,
          scope: effectiveScope,
          owner_type: effectiveScope === "ORG" ? "ORG" : "PLATFORM",
          org_id: effectiveScope === "ORG" ? (isSuperAdmin ? selectedOrgId : edit.org_id ?? null) : null,
          org_name: effectiveScope === "ORG" ? (isSuperAdmin ? selectedOrg?.org_name || null : edit.org_name ?? orgOwnerName) : null,
          mandi_id: edit.mandi_id ?? null,
          mode: edit.mode,
          client_id: edit.client_id,
          client_secret: edit.client_secret,
          access_code: edit.access_code,
          config: {
            access_code: edit.access_code,
          },
          webhook_secret: edit.webhook_secret,
        },
      });
      if (String(res?.response?.responsecode || "1") === "0") {
        setTestResult({
          type: "success",
          message: res?.response?.description || "Gateway test completed successfully.",
          details: res?.data,
        });
      } else {
        setTestResult({
          type: "error",
          message: res?.response?.description || "Gateway test failed.",
        });
      }
    } catch (err: any) {
      setTestResult({
        type: "error",
        message: err?.message || "Gateway test failed.",
      });
    } finally {
      setTesting(false);
    }
  };

  const getProviderTestHelp = (providerCode: string) => {
    const provider = String(providerCode || "").toUpperCase();

    if (provider === "PAYU") {
      return "PayU test validates hash generation and configuration completeness. It does not create a PayU dashboard transaction.";
    }
    if (provider === "CASHFREE") {
      return "Cashfree test creates a ₹1 sandbox test order and confirms payment session generation.";
    }
    if (provider === "RAZORPAY") {
      return "Razorpay test creates a ₹1 test order using the configured key and secret.";
    }
    if (provider === "PHONEPE") {
      return "PhonePe test uses standard checkout validation; full connector behavior will be available once implemented.";
    }
    if (provider === "PAYTM") {
      return "Paytm test validates order API connectivity using configured MID and merchant key.";
    }
    if (provider === "CCAVENUE") {
      return "CCAvenue test validates encryption/hash setup; connector flow is provider-specific.";
    }
    if (provider === "INSTAMOJO") {
      return "Instamojo test validates payment request API credentials.";
    }
    if (provider === "STRIPE_INDIA") {
      return "Stripe India test validates payment intent creation with configured keys.";
    }
    if (provider === "ZAAKPAY") {
      return "Zaakpay test validates checksum/auth configuration for order flow.";
    }
    if (provider === "PAYONEER") {
      return "Payoneer connector is registered for future setup and does not support settlement order creation yet.";
    }
    if (provider === "MANUAL") {
      return "Manual payment mode does not require external gateway testing.";
    }
    return "Select a provider to see test behavior.";
  };

  const getProviderUrls = (providerCode: string, mode = "TEST") => {
    const provider = String(providerCode || "").trim().toLowerCase();
    const modeUpper = String(mode || "TEST").trim().toUpperCase();
    return {
      return_url:
        modeUpper === "LIVE"
          ? `https://cibermandi.ciberdukaan.com/payment-return/${provider}`
          : `https://cibermandi.ciberdukaan.com/payment-test-return/${provider}`,
      notify_url: `https://api.cibermandi.ciberdukaan.com/api/webhooks/${provider}/settlement-payment`,
    };
  };

  const renderGatewayTestDetails = (details: any) => {
    const provider = String(details?.provider_code || edit?.provider_code || "").toUpperCase();

    if (provider === "PAYU") {
      return (
        <Stack spacing={0.5}>
          <Typography variant="body2">Test Type: Hash Generation</Typography>
          <Typography variant="body2">Generated Test Txn ID: {details?.txnid || "-"}</Typography>
          <Typography variant="body2">Dashboard Visibility: Not visible in PayU dashboard because no payment/order is created.</Typography>
        </Stack>
      );
    }

    if (provider === "CASHFREE") {
      return (
        <Stack spacing={0.5}>
          <Typography variant="body2">Test Type: Create Test Order</Typography>
          <Typography variant="body2">Cashfree Order ID: {details?.order_id || "-"}</Typography>
          <Typography variant="body2">Payment Session Generated: {details?.payment_session_id_exists ? "Yes" : "No"}</Typography>
        </Stack>
      );
    }

    if (provider === "RAZORPAY") {
      return (
        <Stack spacing={0.5}>
          <Typography variant="body2">Test Type: Create Test Order</Typography>
          <Typography variant="body2">Razorpay Order ID: {details?.order_id || "-"}</Typography>
        </Stack>
      );
    }

    if (provider === "MANUAL") {
      return null;
    }

    return null;
  };

  const summary = useMemo(() => {
    const active = rows.filter((x) => String(x.is_active) === "Y");
    const defaultRow = active.slice().sort((a, b) => Number(a.priority || 999) - Number(b.priority || 999))[0];
    const testCount = active.filter((x) => String(x.mode).toUpperCase() === "TEST").length;
    const liveCount = active.filter((x) => String(x.mode).toUpperCase() === "LIVE").length;
    return {
      activeCount: active.length,
      defaultGateway: defaultRow?.provider_code || "-",
      testCount,
      liveCount,
    };
  }, [rows]);

  const columns = useMemo<GridColDef<Row>[]>(() => [
    { field: "owner_type", headerName: "Owner Type", width: 130, renderCell: (p) => <Chip size="small" label={String(p.value || (p.row.org_id ? "ORG" : "PLATFORM"))} /> },
    { field: "org_name", headerName: "Organisation", width: 180, renderCell: (p) => <>{p.row.owner_type === "ORG" ? (p.value || p.row.org_id || "-") : "Platform"}</> },
    { field: "provider_code", headerName: "Provider", width: 130 },
    { field: "mode", headerName: "Mode", width: 100, renderCell: (p) => <Chip size="small" label={String(p.value || "-")} /> },
    { field: "priority", headerName: "Priority", width: 90 },
    { field: "is_default", headerName: "Default", width: 100, renderCell: (p) => <Chip size="small" color={p.value ? "primary" : "default"} label={p.value ? "Yes" : "No"} /> },
    { field: "is_active", headerName: "Active", width: 90, renderCell: (p) => <Chip size="small" color={String(p.value) === "Y" ? "success" : "default"} label={String(p.value) === "Y" ? "Yes" : "No"} /> },
    { field: "has_client_secret", headerName: "Secret", width: 110, renderCell: (p) => <Chip size="small" color={p.value ? "info" : "default"} label={p.value ? "Saved" : "Not Set"} /> },
    { field: "allowed_methods", headerName: "Allowed Methods", width: 180, renderCell: (p) => <>{Array.isArray(p.value) ? p.value.join(", ") : "-"}</> },
    { field: "fee_borne_by", headerName: "Fee Borne By", width: 140 },
    { field: "updated_on", headerName: "Updated On", width: 190, renderCell: (p) => <>{p.value ? new Date(p.value).toLocaleString() : "-"}</> },
    {
      field: "actions",
      headerName: "Actions",
      width: 290,
      sortable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" onClick={() => openEdit(p.row)} disabled={!canManageGateway || effectiveScope === "ALL_ORGS"}>Edit</Button>
          <Button size="small" variant="contained" onClick={() => onSetDefault(p.row)} disabled={!canManageGateway || effectiveScope === "ALL_ORGS" || String(p.row.is_active) !== "Y" || PROVIDER_ORDER_CREATION_SUPPORT[String(p.row.provider_code || "").toUpperCase()] === false}>Set Default</Button>
          <Button size="small" variant="outlined" onClick={() => onToggle(p.row)} disabled={!canManageGateway || effectiveScope === "ALL_ORGS"}>{String(p.row.is_active) === "Y" ? "Disable" : "Enable"}</Button>
        </Stack>
      ),
    },
  ], [canManageGateway, effectiveScope]);

  const secretLabel = edit?.provider_code === "PAYU"
    ? "Salt"
    : edit?.provider_code === "CASHFREE"
      ? "Secret Key"
    : edit?.provider_code === "RAZORPAY"
      ? "Key Secret"
      : edit?.provider_code === "PHONEPE"
        ? "Salt Key / Client Secret"
        : edit?.provider_code === "PAYTM"
          ? "Merchant Key"
          : edit?.provider_code === "CCAVENUE"
            ? "Working Key"
            : edit?.provider_code === "INSTAMOJO"
              ? "Auth Token"
              : edit?.provider_code === "STRIPE_INDIA"
                ? "Secret Key"
                : edit?.provider_code === "ZAAKPAY"
                  ? "Secret Key"
                  : edit?.provider_code === "PAYONEER"
                    ? "Client Secret"
                    : "Secret Key";
  const clientIdLabel = edit?.provider_code === "PAYU"
    ? "Merchant Key"
    : edit?.provider_code === "CASHFREE"
      ? "App ID"
      : edit?.provider_code === "RAZORPAY"
        ? "Key ID"
        : edit?.provider_code === "PHONEPE"
          ? "Merchant ID"
          : edit?.provider_code === "PAYTM"
            ? "MID"
            : edit?.provider_code === "CCAVENUE"
              ? "Merchant ID"
              : edit?.provider_code === "INSTAMOJO"
                ? "API Key"
                : edit?.provider_code === "STRIPE_INDIA"
                  ? "Publishable Key"
                  : edit?.provider_code === "ZAAKPAY"
                    ? "Merchant Identifier"
                    : edit?.provider_code === "PAYONEER"
                      ? "Client ID"
                      : "Merchant Key / App ID";
  const isCcavenue = String(edit?.provider_code || "").toUpperCase() === "CCAVENUE";
  const gatewayFieldSx = {
    "& .MuiOutlinedInput-root": {
      height: 52,
      borderRadius: "12px",
      backgroundColor: "#FFFFFF",
      boxShadow: "none",
    },
    "& .MuiOutlinedInput-input": {
      height: "auto",
      padding: "13px 14px",
      fontSize: 14,
      boxSizing: "border-box",
    },
    "& .MuiInputLabel-root": {
      fontSize: 13,
      color: CM_MUTED,
    },
    "& .MuiInputLabel-root.Mui-focused": {
      color: CM_PRIMARY,
    },
    "& .MuiOutlinedInput-notchedOutline": {
      borderColor: CM_BORDER,
    },
    "& .MuiOutlinedInput-root:hover .MuiOutlinedInput-notchedOutline": {
      borderColor: CM_PRIMARY,
    },
    "& .MuiOutlinedInput-root.Mui-focused .MuiOutlinedInput-notchedOutline": {
      borderColor: CM_PRIMARY,
      borderWidth: 1.5,
    },
  };

  return (
    <PageContainer>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="h5">{isSuperAdmin ? "Payment Gateway Settings" : "Organisation Payment Gateway Settings"}</Typography>
            <Typography variant="body2" color="text.secondary">Configure settlement payment gateways used by trader payments.</Typography>
            {!isSuperAdmin ? <Chip size="small" label={`Owner: ${orgOwnerName}`} sx={{ mt: 1 }} /> : null}
          </Box>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={load} disabled={loading}>Refresh</Button>
            <Button
              variant="contained"
              onClick={openAdd}
              disabled={!canManageGateway || effectiveScope === "ALL_ORGS" || (isSuperAdmin && effectiveScope === "ORG" && !selectedOrgId)}
            >
              + Add Payment Gateway
            </Button>
          </Stack>
        </Stack>

        {errorMsg ? <Card><CardContent><Typography color="error">{errorMsg}</Typography></CardContent></Card> : null}

        {isSuperAdmin ? (
          <Card>
            <CardContent>
              <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ xs: "stretch", md: "center" }}>
                <FormControl size="small" sx={{ minWidth: 260 }}>
                  <InputLabel>Gateway Scope</InputLabel>
                  <Select
                    label="Gateway Scope"
                    value={gatewayScope}
                    onChange={(event) => setGatewayScope(event.target.value as "PLATFORM" | "ORG" | "ALL_ORGS")}
                  >
                    <MenuItem value="PLATFORM">Platform Gateways</MenuItem>
                    <MenuItem value="ORG">Organisation Gateways</MenuItem>
                    <MenuItem value="ALL_ORGS">All Organisation Gateways</MenuItem>
                  </Select>
                </FormControl>
                {gatewayScope === "ORG" ? (
                  <FormControl size="small" sx={{ minWidth: 320 }}>
                    <InputLabel>Organisation</InputLabel>
                    <Select
                      label="Organisation"
                      value={selectedOrgId}
                      onChange={(event) => setSelectedOrgId(String(event.target.value || ""))}
                    >
                      {orgOptions.map((org) => (
                        <MenuItem key={org.id} value={org.id}>
                          {org.org_name}{org.org_code ? ` (${org.org_code})` : ""}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                ) : null}
              </Stack>
            </CardContent>
          </Card>
        ) : null}

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Card sx={{ flex: 1 }}><CardContent><Typography variant="body2">Active Gateway</Typography><Typography variant="h6">{summary.activeCount}</Typography></CardContent></Card>
          <Card sx={{ flex: 1 }}><CardContent><Typography variant="body2">Default Gateway</Typography><Typography variant="h6">{summary.defaultGateway}</Typography></CardContent></Card>
          <Card sx={{ flex: 1 }}><CardContent><Typography variant="body2">Test Mode Gateways</Typography><Typography variant="h6">{summary.testCount}</Typography></CardContent></Card>
          <Card sx={{ flex: 1 }}><CardContent><Typography variant="body2">Live Mode Gateways</Typography><Typography variant="h6">{summary.liveCount}</Typography></CardContent></Card>
        </Stack>

        <Card>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              {scopeLabel}
            </Typography>
            {rows.length === 0 && !loading ? (
              <Stack spacing={1} sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">No gateway configs found in market DB.</Typography>
                <Typography variant="body2" color="text.secondary">Add a gateway configuration to get started.</Typography>
              </Stack>
            ) : null}
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <ResponsiveDataGrid rows={rows} columns={columns} loading={loading} />
            </Box>
          </CardContent>
        </Card>
      </Stack>

      <Dialog
        open={editOpen}
        onClose={() => { setEditOpen(false); setTestResult(null); setTesting(false); }}
        fullWidth
        maxWidth="lg"
        PaperProps={{
          sx: {
            borderRadius: "18px",
            overflow: "hidden",
            backgroundColor: CM_SURFACE,
            boxShadow: "0 18px 60px rgba(0,0,0,0.22)",
          },
        }}
      >
        <DialogTitle
          sx={{
            px: 3,
            py: 2,
            fontWeight: 800,
            color: CM_TEXT,
            borderBottom: `1px solid ${CM_BORDER}`,
            background: "linear-gradient(180deg, #FFFFFF 0%, #FBFAF6 100%)",
          }}
        >
          {edit?.is_new ? "Add Payment Gateway" : "Edit Payment Gateway"}
        </DialogTitle>
        <DialogContent sx={{ p: 3, backgroundColor: CM_BG }}>
          <Box sx={{ backgroundColor: CM_SURFACE, border: `1px solid ${CM_BORDER}`, borderRadius: "16px", p: 2.5 }}>
            <Grid container spacing={2}>
              <Grid item xs={12} md={4} sx={{ display: "flex", flexDirection: "column" }}>
                <FormControl fullWidth size="small" sx={gatewayFieldSx}>
                  <InputLabel>Provider Code</InputLabel>
                  <Select
                    label="Provider Code"
                    value={edit?.provider_code || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEdit((p: any) => ({ ...p, provider_code: value }));
                      setTestResult(null);
                    }}
                    disabled={!edit?.is_new}
                  >
                    {PROVIDERS.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
                  </Select>
                </FormControl>
                <Box sx={{ minHeight: 26, pt: 0.5 }} />
              </Grid>
              <Grid item xs={12} md={4} sx={{ display: "flex", flexDirection: "column" }}>
                <FormControl fullWidth size="small" sx={gatewayFieldSx}>
                  <InputLabel>Mode</InputLabel>
                  <Select label="Mode" value={edit?.mode || "TEST"} onChange={(e) => setEdit((p: any) => ({ ...p, mode: e.target.value }))}>
                    {MODES.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
                  </Select>
                </FormControl>
                <Box sx={{ minHeight: 26, pt: 0.5 }} />
              </Grid>
              <Grid item xs={12} md={4} sx={{ display: "flex", flexDirection: "column" }}>
                <TextField
                  type="number"
                  label="Priority"
                  size="small"
                  sx={{
                    ...gatewayFieldSx,
                    "& input[type=number]": {
                      MozAppearance: "textfield",
                    },
                    "& input[type=number]::-webkit-outer-spin-button": {
                      WebkitAppearance: "none",
                      margin: 0,
                    },
                    "& input[type=number]::-webkit-inner-spin-button": {
                      WebkitAppearance: "none",
                      margin: 0,
                    },
                  }}
                  value={edit?.priority || "1"}
                  onChange={(e) => setEdit((p: any) => ({ ...p, priority: e.target.value }))}
                  fullWidth
                />
                <Box sx={{ minHeight: 26, pt: 0.5 }} />
              </Grid>
              <Grid item xs={12} md={6} sx={{ display: "flex", flexDirection: "column" }}>
                <FormControl fullWidth size="small" sx={gatewayFieldSx}>
                  <InputLabel>Gateway Fee Borne By</InputLabel>
                  <Select label="Gateway Fee Borne By" value={edit?.fee_borne_by || "TRADER"} onChange={(e) => setEdit((p: any) => ({ ...p, fee_borne_by: e.target.value }))}>
                    {FEE_BORNE_BY.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
                  </Select>
                </FormControl>
                <Box sx={{ minHeight: 26, pt: 0.5 }} />
              </Grid>
              <Grid item xs={12} md={6} sx={{ display: "flex", flexDirection: "column" }}>
                <FormControl fullWidth size="small" sx={gatewayFieldSx}>
                  <InputLabel>Allowed Methods</InputLabel>
                  <Select multiple value={edit?.allowed_methods || []} onChange={(e) => setEdit((p: any) => ({ ...p, allowed_methods: e.target.value }))} input={<OutlinedInput label="Allowed Methods" />}>
                    {METHODS.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
                  </Select>
                </FormControl>
                <Box sx={{ minHeight: 26, pt: 0.5 }} />
              </Grid>
              <Grid item xs={12} md={4} sx={{ display: "flex", flexDirection: "column" }}>
                <TextField
                  label={clientIdLabel}
                  size="small"
                  sx={gatewayFieldSx}
                  value={edit?.client_id || ""}
                  onChange={(e) => setEdit((p: any) => ({ ...p, client_id: e.target.value }))}
                  fullWidth
                />
                <Box sx={{ minHeight: 26, pt: 0.5 }} />
              </Grid>
              <Grid item xs={12} md={4} sx={{ display: "flex", flexDirection: "column" }}>
                <TextField
                  label={secretLabel}
                  size="small"
                  sx={gatewayFieldSx}
                  type="password"
                  value={edit?.client_secret || ""}
                  onChange={(e) => setEdit((p: any) => ({ ...p, client_secret: e.target.value }))}
                  fullWidth
                />
                <Box sx={{ minHeight: 26, pt: 0.5 }}>
                  {edit?.has_client_secret ? (
                    <Chip
                      size="small"
                      label="Secret saved"
                      sx={{ height: 22, fontSize: 11, fontWeight: 700, color: "#075985", backgroundColor: "#E0F2FE" }}
                    />
                  ) : (
                    <Typography variant="caption" color="text.secondary">No secret saved yet.</Typography>
                  )}
                </Box>
              </Grid>
              {isCcavenue ? (
                <Grid item xs={12} md={4} sx={{ display: "flex", flexDirection: "column" }}>
                  <TextField
                    label="Access Code"
                    size="small"
                    sx={gatewayFieldSx}
                    value={edit?.access_code || ""}
                    onChange={(e) => setEdit((p: any) => ({ ...p, access_code: e.target.value }))}
                    fullWidth
                  />
                  <Box sx={{ minHeight: 26, pt: 0.5 }}>
                    <Typography variant="caption" color="text.secondary">Required for CCAvenue.</Typography>
                  </Box>
                </Grid>
              ) : null}
              <Grid item xs={12} md={4} sx={{ display: "flex", flexDirection: "column" }}>
                <TextField
                  label="Webhook Secret"
                  size="small"
                  sx={gatewayFieldSx}
                  type="password"
                  value={edit?.webhook_secret || ""}
                  onChange={(e) => setEdit((p: any) => ({ ...p, webhook_secret: e.target.value }))}
                  fullWidth
                />
                <Box sx={{ minHeight: 26, pt: 0.5 }}>
                  {edit?.has_webhook_secret ? (
                    <Chip
                      size="small"
                      label="Webhook secret saved"
                      sx={{ height: 22, fontSize: 11, fontWeight: 700, color: "#075985", backgroundColor: "#E0F2FE" }}
                    />
                  ) : (
                    <Typography variant="caption" color="text.secondary">Optional.</Typography>
                  )}
                </Box>
              </Grid>
              <Grid item xs={12} md={6} sx={{ display: "flex", flexDirection: "column" }}>
                <TextField
                  label="Return URL"
                  size="small"
                  disabled
                  InputProps={{ readOnly: true }}
                  multiline={false}
                  inputProps={{
                    style: {
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                  }}
                  sx={gatewayFieldSx}
                  value={getProviderUrls(edit?.provider_code || "", edit?.mode || "TEST").return_url}
                  fullWidth
                />
                <Box sx={{ minHeight: 26, pt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Auto-generated by CiberMandi. Copy this URL into your payment gateway dashboard. Do not modify.
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6} sx={{ display: "flex", flexDirection: "column" }}>
                <TextField
                  label="Notify URL"
                  size="small"
                  disabled
                  InputProps={{ readOnly: true }}
                  multiline={false}
                  inputProps={{
                    style: {
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                  }}
                  sx={gatewayFieldSx}
                  value={getProviderUrls(edit?.provider_code || "", edit?.mode || "TEST").notify_url}
                  fullWidth
                />
                <Box sx={{ minHeight: 26, pt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Auto-generated by CiberMandi. Copy this URL into your payment gateway dashboard. Do not modify.
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12}>
                <Box
                  sx={{
                    mt: 1,
                    p: 1.5,
                    borderRadius: "12px",
                    backgroundColor: CM_PRIMARY_LIGHT,
                    border: `1px solid ${CM_BORDER}`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <Box>
                    <Typography fontWeight={700}>Gateway Active</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Active gateways are eligible for settlement payment selection.
                    </Typography>
                  </Box>
                  <Switch checked={String(edit?.is_active || "Y") === "Y"} onChange={(e) => setEdit((p: any) => ({ ...p, is_active: e.target.checked ? "Y" : "N" }))} />
                </Box>
              </Grid>
            </Grid>
          </Box>
          <Box sx={{ mt: 2, p: 2, borderRadius: "16px", border: `1px solid ${CM_BORDER}`, backgroundColor: "#FFFFFF" }}>
            <Typography variant="caption" color="text.secondary">
              These credentials belong to your organisation&apos;s payment gateway merchant account. CiberMandi does not provide or share platform credentials for organisation settlement collection.
            </Typography>
            <Stack direction={{ xs: "column", md: "row" }} alignItems={{ xs: "stretch", md: "center" }} justifyContent="space-between" spacing={2}>
              <Box>
                <Typography fontWeight={800} color={CM_TEXT}>Test Gateway Connection</Typography>
                <Typography variant="body2" color="text.secondary">
                  {getProviderTestHelp(edit?.provider_code || "")}
                </Typography>
              </Box>
              <Button
                variant="contained"
                disabled={testing || !edit?.provider_code}
                onClick={onTestConnection}
                sx={{
                  minWidth: 180,
                  height: 44,
                  borderRadius: "12px",
                  textTransform: "none",
                  fontWeight: 800,
                  backgroundColor: CM_PRIMARY,
                  "&:hover": { backgroundColor: "#445021" },
                }}
              >
                {testing ? "Testing..." : "Test Connection"}
              </Button>
            </Stack>
            {testResult ? (
              <Alert
                severity={testResult.type === "success" ? "success" : "error"}
                sx={{ mt: 2, borderRadius: "12px", "& .MuiAlert-message": { width: "100%" } }}
              >
                <Typography variant="body2" fontWeight={800}>{testResult.message}</Typography>
                {testResult.type === "success" && testResult.details ? renderGatewayTestDetails(testResult.details) : null}
              </Alert>
            ) : null}
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${CM_BORDER}`, backgroundColor: "#FBFAF6" }}>
          <Button
            onClick={() => { setEditOpen(false); setTestResult(null); setTesting(false); }}
            sx={{ textTransform: "none", fontWeight: 700, color: CM_TEXT }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={onSave}
            disabled={saving}
            sx={{
              minWidth: 110,
              height: 42,
              borderRadius: "12px",
              textTransform: "none",
              fontWeight: 800,
              backgroundColor: CM_PRIMARY,
              "&:hover": { backgroundColor: "#445021" },
            }}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
