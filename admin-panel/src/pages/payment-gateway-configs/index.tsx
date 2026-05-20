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
  org_id?: string | null;
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
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [edit, setEdit] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>(null);

  const load = async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const resp: any = await listPaymentGatewayConfigs({ username, payload: {} });
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

  useEffect(() => { load(); }, []);

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
      return_url: "",
      notify_url: "",
      allowed_methods: ["UPI"],
      fee_borne_by: "TRADER",
      org_id: null,
      mandi_id: null,
      has_client_secret: false,
      has_webhook_secret: false,
    };
  };

  const openAdd = () => {
    setEdit(createAddDraft());
    setTestResult(null);
    setTesting(false);
    setEditOpen(true);
  };

  const openEdit = (row: Row) => {
    setEdit({
      is_new: false,
      provider_code: row.provider_code,
      mode: row.mode || "TEST",
      priority: String(row.priority || 1),
      is_active: row.is_active || "Y",
      client_id: row.client_id || "",
      client_secret: "",
      webhook_secret: "",
      return_url: row.return_url || "",
      notify_url: row.notify_url || "",
      allowed_methods: row.allowed_methods?.length ? row.allowed_methods : ["UPI"],
      fee_borne_by: row.fee_borne_by || "TRADER",
      org_id: row.org_id ?? null,
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
    if (!username || !edit) return;
    setSaving(true);
    setErrorMsg("");
    try {
      const providerCode = String(edit.provider_code || "").toUpperCase();
      const supportsOrderCreation = PROVIDER_ORDER_CREATION_SUPPORT[providerCode] !== false;
      const isActivating = String(edit.is_active || "Y") === "Y";
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
          org_id: edit.org_id ?? null,
          mandi_id: edit.mandi_id ?? null,
          mode: edit.mode,
          priority: Number(edit.priority || 1),
          is_active: edit.is_active,
          client_id: edit.client_id,
          client_secret: edit.client_secret,
          webhook_secret: edit.webhook_secret,
          return_url: edit.return_url,
          notify_url: edit.notify_url,
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
    if (!username) return;
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
        org_id: row.org_id ?? null,
        mandi_id: row.mandi_id ?? null,
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
    if (!username) return;
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
        org_id: row.org_id ?? null,
        mandi_id: row.mandi_id ?? null,
        allow_future_setup: allowFutureSetup,
      },
    });
    if (String(resp?.response?.responsecode || "1") !== "0") {
      setErrorMsg(resp?.response?.description || "Unable to set default payment gateway.");
      return;
    }
    await load();
  };

  const seedDefaults = () => {
    setErrorMsg("Run backend script: node scripts/seed_payment_gateway_configs_market.js");
  };

  const onTestConnection = async () => {
    const username = getCurrentAdminUsername();
    if (!username || !edit) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res: any = await testPaymentGatewayConfig({
        username,
        payload: {
          provider_code: edit.provider_code,
          org_id: edit.org_id ?? null,
          mandi_id: edit.mandi_id ?? null,
          mode: edit.mode,
          client_id: edit.client_id,
          client_secret: edit.client_secret,
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

  const getProviderUrls = (providerCode: string) => {
    const provider = String(providerCode || "").toUpperCase();
    const baseReturn = "https://cibermandi.ciberdukaan.com/payment-test-return";
    const baseNotify = "https://api.cibermandi.ciberdukaan.com/api/webhooks";
    const urls: Record<string, { return_url: string; notify_url: string }> = {
      PAYU: { return_url: `${baseReturn}/payu`, notify_url: `${baseNotify}/payu` },
      CASHFREE: { return_url: `${baseReturn}/cashfree?order_id={order_id}`, notify_url: `${baseNotify}/cashfree` },
      RAZORPAY: { return_url: `${baseReturn}/razorpay`, notify_url: `${baseNotify}/razorpay` },
      PHONEPE: { return_url: `${baseReturn}/phonepe`, notify_url: `${baseNotify}/phonepe` },
      PAYTM: { return_url: `${baseReturn}/paytm`, notify_url: `${baseNotify}/paytm` },
      CCAVENUE: { return_url: `${baseReturn}/ccavenue`, notify_url: `${baseNotify}/ccavenue` },
      INSTAMOJO: { return_url: `${baseReturn}/instamojo`, notify_url: `${baseNotify}/instamojo` },
      STRIPE_INDIA: { return_url: `${baseReturn}/stripe-india`, notify_url: `${baseNotify}/stripe-india` },
      ZAAKPAY: { return_url: `${baseReturn}/zaakpay`, notify_url: `${baseNotify}/zaakpay` },
      PAYONEER: { return_url: `${baseReturn}/payoneer`, notify_url: `${baseNotify}/payoneer` },
      MANUAL: { return_url: `${baseReturn}/manual`, notify_url: `${baseNotify}/manual` },
    };
    return urls[provider] || { return_url: baseReturn, notify_url: baseNotify };
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
          <Button size="small" variant="outlined" onClick={() => openEdit(p.row)}>Edit</Button>
          <Button size="small" variant="contained" onClick={() => onSetDefault(p.row)} disabled={String(p.row.is_active) !== "Y" || PROVIDER_ORDER_CREATION_SUPPORT[String(p.row.provider_code || "").toUpperCase()] === false}>Set Default</Button>
          <Button size="small" variant="outlined" onClick={() => onToggle(p.row)}>{String(p.row.is_active) === "Y" ? "Disable" : "Enable"}</Button>
        </Stack>
      ),
    },
  ], []);

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
            <Typography variant="h5">Payment Gateway Settings</Typography>
            <Typography variant="body2" color="text.secondary">Configure settlement payment gateways used by trader payments.</Typography>
          </Box>
          <Button variant="contained" onClick={openAdd}>+ Add Payment Gateway</Button>
        </Stack>

        {errorMsg ? <Card><CardContent><Typography color="error">{errorMsg}</Typography></CardContent></Card> : null}

        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Card sx={{ flex: 1 }}><CardContent><Typography variant="body2">Active Gateway</Typography><Typography variant="h6">{summary.activeCount}</Typography></CardContent></Card>
          <Card sx={{ flex: 1 }}><CardContent><Typography variant="body2">Default Gateway</Typography><Typography variant="h6">{summary.defaultGateway}</Typography></CardContent></Card>
          <Card sx={{ flex: 1 }}><CardContent><Typography variant="body2">Test Mode Gateways</Typography><Typography variant="h6">{summary.testCount}</Typography></CardContent></Card>
          <Card sx={{ flex: 1 }}><CardContent><Typography variant="body2">Live Mode Gateways</Typography><Typography variant="h6">{summary.liveCount}</Typography></CardContent></Card>
        </Stack>

        <Card>
          <CardContent>
            {rows.length === 0 && !loading ? (
              <Stack spacing={1} sx={{ mb: 2 }}>
                <Typography variant="body2" color="text.secondary">No gateway configs found in market DB.</Typography>
                <Typography variant="body2" color="text.secondary">Use Seed Defaults or add a gateway.</Typography>
                <Box><Button variant="outlined" onClick={seedDefaults}>Seed Default Gateways</Button></Box>
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
                  multiline={false}
                  inputProps={{
                    style: {
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                  }}
                  sx={gatewayFieldSx}
                  value={edit?.return_url || ""}
                  onChange={(e) => setEdit((p: any) => ({ ...p, return_url: e.target.value }))}
                  fullWidth
                />
                <Box sx={{ minHeight: 26, pt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Suggested: {getProviderUrls(edit?.provider_code || "").return_url}
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={6} sx={{ display: "flex", flexDirection: "column" }}>
                <TextField
                  label="Notify URL"
                  size="small"
                  multiline={false}
                  inputProps={{
                    style: {
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                  }}
                  sx={gatewayFieldSx}
                  value={edit?.notify_url || ""}
                  onChange={(e) => setEdit((p: any) => ({ ...p, notify_url: e.target.value }))}
                  fullWidth
                />
                <Box sx={{ minHeight: 26, pt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    Suggested: {getProviderUrls(edit?.provider_code || "").notify_url}
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
