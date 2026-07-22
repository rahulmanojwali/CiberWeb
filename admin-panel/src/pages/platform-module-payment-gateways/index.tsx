import React, { useEffect, useMemo, useState } from "react";
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, FormControl, Grid, InputLabel, MenuItem, OutlinedInput, Select, Stack, Switch,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography
} from "@mui/material";
import { PageContainer } from "../../components/PageContainer";
import { getCurrentAdminUsername } from "../../utils/session";
import { getUserScope } from "../../utils/userScope";
import {
  listPlatformModuleGatewayConfigs, savePlatformModuleGatewayConfig,
  setDefaultPlatformModuleGatewayConfig, testPlatformModuleGatewayConfig,
  togglePlatformModuleGatewayConfig
} from "../../api/platformModulePaymentGatewayConfigs";

const GREEN = "#55632C";
const LIGHT = "#F6F8F0";
const BORDER = "#DDE4D0";
const MODULES = ["DIRECT_TRADE", "CONTRACT_FARMING", "WEEKLY_HAAT"];
const PROVIDERS = ["CASHFREE", "PAYU", "RAZORPAY", "PHONEPE", "PAYTM", "CCAVENUE", "INSTAMOJO", "STRIPE_INDIA", "ZAAKPAY", "PAYONEER", "MANUAL"];
const MODES = ["TEST", "LIVE"];
const METHODS = ["UPI", "CARD", "NETBANKING"];

type Row = {
  _id?: string; module_code: string; provider_code: string; provider_name?: string; mode: string;
  priority: number; is_default?: boolean | string; is_active: string; allowed_methods?: string[];
  fee_borne_by?: string; updated_on?: string; client_id?: string; has_client_secret?: boolean;
  has_webhook_secret?: boolean; return_url?: string; notify_url?: string; access_code?: string;
};

type Draft = Row & { client_secret?: string; webhook_secret?: string };
const blank = (): Draft => ({ module_code: "DIRECT_TRADE", provider_code: "CASHFREE", mode: "TEST", priority: 1, is_default: false, is_active: "Y", allowed_methods: ["UPI"], fee_borne_by: "TRADER", client_id: "", client_secret: "", webhook_secret: "", return_url: "", notify_url: "", access_code: "" });
const label = (value: string): string => value.replace(/_/g, " ").replace(/\b\w/g, (match: string) => match.toUpperCase());

const PROVIDER_FIELDS: Record<string, { clientId: string; secret: string; webhook?: string; accessCode?: boolean; credentialsRequired?: boolean; note: string }> = {
  CASHFREE: { clientId: "App ID", secret: "Secret Key", webhook: "Webhook Secret", note: "Use the Cashfree App ID (x-client-id) and Secret Key (x-client-secret) from Developers > API Keys." },
  PAYU: { clientId: "Merchant Key", secret: "Salt", webhook: "Webhook Secret", note: "Use the PayU Merchant Key and Salt issued for the selected TEST/LIVE environment." },
  RAZORPAY: { clientId: "Key ID", secret: "Key Secret", webhook: "Webhook Secret", note: "Use the Razorpay Key ID and Key Secret. Configure the webhook secret separately when webhooks are enabled." },
  PHONEPE: { clientId: "Merchant ID", secret: "Salt Key / Client Secret", webhook: "Webhook Username / Secret", note: "Use the PhonePe Merchant ID and the configured Salt Key or Client Secret for the selected integration version." },
  PAYTM: { clientId: "MID", secret: "Merchant Key", webhook: "Webhook Secret", note: "Use the Paytm Merchant ID (MID) and Merchant Key for the selected environment." },
  CCAVENUE: { clientId: "Merchant ID", secret: "Working Key", webhook: "Webhook Secret", accessCode: true, note: "CCAvenue requires Merchant ID, Working Key and Access Code." },
  INSTAMOJO: { clientId: "API Key", secret: "Auth Token", webhook: "Webhook Secret", note: "Use the Instamojo API Key and Auth Token." },
  STRIPE_INDIA: { clientId: "Publishable Key", secret: "Secret Key", webhook: "Webhook Signing Secret", note: "Use the Stripe publishable key, secret key and webhook signing secret." },
  ZAAKPAY: { clientId: "Merchant Identifier", secret: "Secret Key", webhook: "Webhook Secret", note: "Use the Zaakpay Merchant Identifier and Secret Key." },
  PAYONEER: { clientId: "Client ID", secret: "Client Secret", webhook: "Webhook Secret", note: "Payoneer is available for future payout integration and may not support checkout order creation." },
  MANUAL: { clientId: "Reference Prefix", secret: "Not Required", webhook: "Not Required", credentialsRequired: false, note: "Manual payment does not require external gateway API credentials." },
};

const getProviderFields = (providerCode: string) => PROVIDER_FIELDS[String(providerCode || "").toUpperCase()] || {
  clientId: "Client ID",
  secret: "Client Secret",
  webhook: "Webhook Secret",
  note: "Enter the credentials issued by the selected payment provider.",
};

const getProviderUrls = (providerCode: string, mode = "TEST") => {
  const provider = String(providerCode || "").trim().toLowerCase();
  const live = String(mode || "TEST").toUpperCase() === "LIVE";
  return {
    return_url: live
      ? `https://cibermandi.ciberdukaan.com/payment-return/${provider}`
      : `https://cibermandi.ciberdukaan.com/payment-test-return/${provider}`,
    notify_url: `https://api.cibermandi.ciberdukaan.com/api/webhooks/${provider}/settlement-payment`,
  };
};

export function PlatformModulePaymentGatewayConfigsPage() {
  const scope = getUserScope("platform-module-payment-gateways");
  const isSuperAdmin = scope.role === "SUPER_ADMIN";
  const [rows, setRows] = useState<Row[]>([]);
  const [moduleFilter, setModuleFilter] = useState("DIRECT_TRADE");
  const [modeFilter, setModeFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ severity: "success" | "error"; text: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(blank());
  const providerFields = getProviderFields(draft.provider_code);
  const credentialsRequired = providerFields.credentialsRequired !== false;

  const filtered = useMemo(() => rows.filter((r) => (!moduleFilter || r.module_code === moduleFilter) && (!modeFilter || r.mode === modeFilter)), [rows, moduleFilter, modeFilter]);
  const active = filtered.filter((r) => r.is_active === "Y").length;
  const isDefaultGateway = (row: Row): boolean => row.is_default === true || String(row.is_default || "").toUpperCase() === "Y";
  const def = filtered.find(isDefaultGateway)?.provider_name || filtered.find(isDefaultGateway)?.provider_code || "Not set";
  const testCount = filtered.filter((r) => r.mode === "TEST").length;
  const liveCount = filtered.filter((r) => r.mode === "LIVE").length;

  const load = async (preserveMessage = false) => {
    const username = getCurrentAdminUsername();
    if (!username || !isSuperAdmin) return;
    setLoading(true); if (!preserveMessage) setMessage(null);
    try {
      const resp: any = await listPlatformModuleGatewayConfigs({ username, payload: {} });
      if (String(resp?.response?.responsecode || "1") !== "0") throw new Error(resp?.response?.description || "Unable to load gateway settings.");
      setRows(Array.isArray(resp?.data?.configs) ? resp.data.configs : []);
    } catch (e: any) { setMessage({ severity: "error", text: e?.message || "Unable to load gateway settings." }); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [isSuperAdmin]);

  const save = async () => {
    const username = getCurrentAdminUsername(); if (!username) return;
    try {
      if (!String(draft.module_code || "").trim()) throw new Error("Module is required.");
      if (!String(draft.provider_code || "").trim()) throw new Error("Provider is required.");
      if (!String(draft.mode || "").trim()) throw new Error("Mode is required.");
      if (!Number.isFinite(Number(draft.priority)) || Number(draft.priority) < 1) throw new Error("Priority must be 1 or greater.");
      if (credentialsRequired && !String(draft.client_id || "").trim()) throw new Error(`${providerFields.clientId} is required for ${draft.provider_code}.`);
      if (credentialsRequired && !String(draft.client_secret || "").trim() && !draft.has_client_secret) throw new Error(`${providerFields.secret} is required for ${draft.provider_code}.`);
      if (providerFields.accessCode && !String(draft.access_code || "").trim()) throw new Error("Access Code is required for CCAvenue.");
      const generatedUrls = getProviderUrls(draft.provider_code, draft.mode);
      const payload: Draft = { ...draft, ...generatedUrls };
      const resp: any = await savePlatformModuleGatewayConfig({ username, payload });
      if (String(resp?.response?.responsecode || "1") !== "0") throw new Error(resp?.response?.description || "Save failed.");

      const hasDefaultForScope = rows.some((row) =>
        row.module_code === draft.module_code &&
        row.mode === draft.mode &&
        isDefaultGateway(row)
      );

      if (!hasDefaultForScope && draft.is_active === "Y") {
        const defaultResp: any = await setDefaultPlatformModuleGatewayConfig({
          username,
          payload: {
            module_code: draft.module_code,
            provider_code: draft.provider_code,
            mode: draft.mode,
          },
        });
        if (String(defaultResp?.response?.responsecode || "1") !== "0") {
          throw new Error(defaultResp?.response?.description || "Gateway saved, but default gateway could not be set.");
        }
      }

      setOpen(false);
      await load(true);
      setMessage({ severity: "success", text: hasDefaultForScope ? "Platform module gateway saved successfully." : "Platform module gateway saved and set as default." });
    } catch (e: any) { setMessage({ severity: "error", text: e?.message || "Save failed." }); }
  };
  const mutate = async (fn: any, row: Row, payload: Record<string, any>, success: string) => {
    const username = getCurrentAdminUsername(); if (!username) return;
    try {
      const resp: any = await fn({ username, payload: { module_code: row.module_code, provider_code: row.provider_code, mode: row.mode, ...payload } });
      if (String(resp?.response?.responsecode || "1") !== "0") throw new Error(resp?.response?.description || "Operation failed.");
      await load(true); setMessage({ severity: "success", text: success });
    } catch (e: any) { setMessage({ severity: "error", text: e?.message || "Operation failed." }); }
  };

  if (!isSuperAdmin) return <PageContainer title="Platform Module Gateway Settings"><Alert severity="error">This page is available only to CiberMandi SUPER_ADMIN.</Alert></PageContainer>;

  return (
    <PageContainer
      title="Platform Module Gateway Settings"
      subtitle="Configure gateways used by CiberMandi-owned modules. Organisation and mandi gateways are not used here."
      actions={<Stack direction="row" spacing={1}><Button variant="outlined" onClick={() => load()}>Refresh</Button><Button variant="contained" sx={{ bgcolor: GREEN }} onClick={() => { setDraft({ ...blank(), module_code: moduleFilter || "DIRECT_TRADE" }); setOpen(true); }}>+ Add Gateway</Button></Stack>}
      sx={{ bgcolor: "#FBFAF6" }}
    >
      {message && <Alert severity={message.severity} onClose={() => setMessage(null)}>{message.text}</Alert>}
      <Card variant="outlined" sx={{ borderColor: BORDER, boxShadow: "none" }}><CardContent>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}><FormControl fullWidth size="small"><InputLabel>Module</InputLabel><Select label="Module" value={moduleFilter} onChange={(e) => setModuleFilter(String(e.target.value))}>{MODULES.map((m) => <MenuItem key={m} value={m}>{label(m)}</MenuItem>)}</Select></FormControl></Grid>
          <Grid item xs={12} md={3}><FormControl fullWidth size="small"><InputLabel>Mode</InputLabel><Select label="Mode" value={modeFilter} onChange={(e) => setModeFilter(String(e.target.value))}><MenuItem value="">All</MenuItem>{MODES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}</Select></FormControl></Grid>
        </Grid>
      </CardContent></Card>

      <Grid container spacing={2}>
        {[['Active Gateways', active], ['Default Gateway', def], ['Test Gateways', testCount], ['Live Gateways', liveCount]].map(([t, v]) => <Grid item key={String(t)} xs={12} sm={6} md={3}><Card variant="outlined" sx={{ borderColor: BORDER, boxShadow: "none", bgcolor: "white" }}><CardContent><Typography variant="body2" color="text.secondary">{t}</Typography><Typography variant="h5" sx={{ mt: 1, color: GREEN }}>{String(v)}</Typography></CardContent></Card></Grid>)}
      </Grid>

      <TableContainer component={Card} variant="outlined" sx={{ borderColor: BORDER, boxShadow: "none" }}>
        <Table size="small"><TableHead><TableRow sx={{ bgcolor: LIGHT }}>{['Module','Provider','Mode','Priority','Default','Active','Allowed Methods','Fee Borne By','Secret','Updated On','Actions'].map((h) => <TableCell key={h} sx={{ fontWeight: 700 }}>{h}</TableCell>)}</TableRow></TableHead>
          <TableBody>{filtered.map((r) => <TableRow key={`${r.module_code}-${r.provider_code}-${r.mode}`} hover>
            <TableCell>{label(r.module_code)}</TableCell><TableCell>{r.provider_name || r.provider_code}</TableCell>
            <TableCell><Chip size="small" label={r.mode} sx={{ bgcolor: r.mode === 'TEST' ? '#FFF4D6' : '#E9F6EA' }} /></TableCell>
            <TableCell>{r.priority}</TableCell><TableCell>{isDefaultGateway(r) ? <Chip size="small" label="Current Default" color="success" /> : <Chip size="small" label="No" variant="outlined" />}</TableCell>
            <TableCell><Switch size="small" checked={r.is_active === 'Y'} onChange={(_, checked) => mutate(togglePlatformModuleGatewayConfig, r, { is_active: checked ? 'Y' : 'N' }, 'Gateway status updated.')} /></TableCell>
            <TableCell>{(r.allowed_methods || []).join(', ') || '—'}</TableCell><TableCell>{r.fee_borne_by || 'TRADER'}</TableCell>
            <TableCell><Chip size="small" label={r.has_client_secret ? 'Saved' : 'Missing'} color={r.has_client_secret ? 'info' : 'warning'} /></TableCell>
            <TableCell>{r.updated_on ? new Date(r.updated_on).toLocaleString() : '—'}</TableCell>
            <TableCell><Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" onClick={() => { setDraft({ ...r, client_secret: '', webhook_secret: '', ...getProviderUrls(r.provider_code, r.mode) }); setOpen(true); }}>Edit</Button>
              {isDefaultGateway(r) ? (
                <Chip size="small" label="Current Default" color="success" />
              ) : (
                <Button size="small" variant="contained" sx={{ bgcolor: GREEN }} disabled={r.is_active !== 'Y'} onClick={() => mutate(setDefaultPlatformModuleGatewayConfig, r, {}, 'Default gateway updated.')}>Make Default</Button>
              )}
              <Button size="small" variant="outlined" onClick={async () => {
                const username = getCurrentAdminUsername();
                if (!username) return;
                setMessage(null);
                try {
                  const resp: any = await testPlatformModuleGatewayConfig({
                    username,
                    payload: {
                      module_code: r.module_code,
                      provider_code: r.provider_code,
                      mode: r.mode,
                    },
                  });
                  if (String(resp?.response?.responsecode || "1") !== "0" || resp?.data?.ok !== true) {
                    throw new Error(resp?.response?.description || resp?.data?.message || "Gateway test failed.");
                  }
                  const details = [
                    resp?.data?.message || "Gateway test completed successfully.",
                    resp?.data?.order_id ? `Order ID: ${resp.data.order_id}` : "",
                    resp?.data?.payment_session_id_exists ? "Payment session created." : "",
                  ].filter(Boolean).join(" ");
                  setMessage({ severity: "success", text: details });
                } catch (e: any) {
                  setMessage({ severity: "error", text: e?.message || "Gateway test failed." });
                }
              }}>Test Connection</Button>
            </Stack></TableCell>
          </TableRow>)}</TableBody>
        </Table>
        {!loading && filtered.length === 0 && <Box p={4} textAlign="center"><Typography color="text.secondary">No platform module gateways configured.</Typography></Box>}
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{draft._id ? 'Edit Platform Module Gateway' : 'Add Platform Module Gateway'}</DialogTitle>
        <DialogContent dividers><Grid container spacing={2} sx={{ pt: 1 }}>
          <Grid item xs={12} md={4}><FormControl fullWidth><InputLabel>Module</InputLabel><Select label="Module" value={draft.module_code} onChange={(e) => setDraft({ ...draft, module_code: String(e.target.value) })}>{MODULES.map((m) => <MenuItem key={m} value={m}>{label(m)}</MenuItem>)}</Select></FormControl></Grid>
          <Grid item xs={12} md={4}><FormControl fullWidth><InputLabel>Provider</InputLabel><Select label="Provider" value={draft.provider_code} onChange={(e) => { const provider_code = String(e.target.value); setDraft({ ...draft, provider_code, client_id: "", client_secret: "", webhook_secret: "", access_code: "", ...getProviderUrls(provider_code, draft.mode) }); }}>{PROVIDERS.map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}</Select></FormControl></Grid>
          <Grid item xs={12} md={4}><FormControl fullWidth><InputLabel>Mode</InputLabel><Select label="Mode" value={draft.mode} onChange={(e) => { const mode = String(e.target.value); setDraft({ ...draft, mode, ...getProviderUrls(draft.provider_code, mode) }); }}>{MODES.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}</Select></FormControl></Grid>
          <Grid item xs={12}>
            <Alert severity={draft.provider_code === "MANUAL" ? "info" : "success"}>{providerFields.note}</Alert>
          </Grid>
          {credentialsRequired && <Grid item xs={12} md={4}><TextField fullWidth label={providerFields.clientId} value={draft.client_id || ''} onChange={(e) => setDraft({ ...draft, client_id: e.target.value })} /></Grid>}
          {credentialsRequired && <Grid item xs={12} md={4}><TextField fullWidth type="password" label={providerFields.secret} helperText={draft.has_client_secret ? 'Leave blank to keep saved secret.' : ''} value={draft.client_secret || ''} onChange={(e) => setDraft({ ...draft, client_secret: e.target.value })} /></Grid>}
          {providerFields.accessCode && <Grid item xs={12} md={4}><TextField fullWidth label="Access Code" value={draft.access_code || ''} onChange={(e) => setDraft({ ...draft, access_code: e.target.value })} /></Grid>}
          {credentialsRequired && <Grid item xs={12} md={4}><TextField fullWidth type="password" label={providerFields.webhook || "Webhook Secret"} helperText={draft.has_webhook_secret ? 'Leave blank to keep saved webhook secret.' : 'Optional unless required by the provider webhook setup.'} value={draft.webhook_secret || ''} onChange={(e) => setDraft({ ...draft, webhook_secret: e.target.value })} /></Grid>}
          <Grid item xs={12} md={6}><TextField fullWidth label="Return URL" value={draft.return_url || ''} disabled InputLabelProps={{ shrink: true }} InputProps={{ readOnly: true }} helperText="Auto-generated by CiberMandi. Copy this URL into the provider dashboard." /></Grid>
          <Grid item xs={12} md={6}><TextField fullWidth label="Notify / Webhook URL" value={draft.notify_url || ''} disabled InputLabelProps={{ shrink: true }} InputProps={{ readOnly: true }} helperText="Auto-generated by CiberMandi. Copy this URL into the provider dashboard." /></Grid>
          <Grid item xs={12} md={3}><TextField fullWidth type="number" label="Priority" value={draft.priority} onChange={(e) => setDraft({ ...draft, priority: Number(e.target.value) })} /></Grid>
          <Grid item xs={12} md={3}><FormControl fullWidth><InputLabel>Fee Borne By</InputLabel><Select label="Fee Borne By" value={draft.fee_borne_by || 'TRADER'} onChange={(e) => setDraft({ ...draft, fee_borne_by: String(e.target.value) })}><MenuItem value="TRADER">Trader</MenuItem><MenuItem value="PLATFORM">Platform</MenuItem></Select></FormControl></Grid>
          <Grid item xs={12} md={6}><FormControl fullWidth><InputLabel>Allowed Methods</InputLabel><Select multiple value={draft.allowed_methods || []} input={<OutlinedInput label="Allowed Methods" />} onChange={(e) => setDraft({ ...draft, allowed_methods: typeof e.target.value === 'string' ? e.target.value.split(',') : e.target.value as string[] })}>{METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}</Select></FormControl></Grid>
        </Grid></DialogContent>
        <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button variant="contained" sx={{ bgcolor: GREEN }} onClick={save}>Save</Button></DialogActions>
      </Dialog>
    </PageContainer>
  );
}

export default PlatformModulePaymentGatewayConfigsPage;
