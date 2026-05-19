import React, { useEffect, useMemo, useState } from "react";
import {
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
  togglePaymentGatewayConfig,
} from "../../api/paymentGatewayConfigs";

const PROVIDERS = ["PAYU", "CASHFREE", "RAZORPAY", "MANUAL"];
const MODES = ["TEST", "LIVE"];
const METHODS = ["UPI", "CARD", "NETBANKING"];
const FEE_BORNE_BY = ["TRADER", "PLATFORM", "MANDI"];

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

export const PaymentGatewayConfigsPage: React.FC = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [edit, setEdit] = useState<any>(null);

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
    setEditOpen(true);
  };

  const onSave = async () => {
    const username = getCurrentAdminUsername();
    if (!username || !edit) return;
    setSaving(true);
    setErrorMsg("");
    try {
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
        },
      });
      if (String(resp?.response?.responsecode || "1") !== "0") {
        throw new Error(resp?.response?.description || "Unable to save payment gateway config.");
      }
      setEditOpen(false);
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
    const resp: any = await togglePaymentGatewayConfig({
      username,
      payload: {
        provider_code: row.provider_code,
        org_id: row.org_id ?? null,
        mandi_id: row.mandi_id ?? null,
        is_active: next,
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
    const resp: any = await setDefaultPaymentGatewayConfig({
      username,
      payload: {
        provider_code: row.provider_code,
        org_id: row.org_id ?? null,
        mandi_id: row.mandi_id ?? null,
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
          <Button size="small" variant="contained" onClick={() => onSetDefault(p.row)} disabled={String(p.row.is_active) !== "Y"}>Set Default</Button>
          <Button size="small" variant="outlined" onClick={() => onToggle(p.row)}>{String(p.row.is_active) === "Y" ? "Disable" : "Enable"}</Button>
        </Stack>
      ),
    },
  ], []);

  const secretLabel = edit?.provider_code === "PAYU"
    ? "Salt"
    : edit?.provider_code === "RAZORPAY"
      ? "Key Secret"
      : "Secret Key";

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

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{edit?.is_new ? "Add Payment Gateway" : "Edit Payment Gateway"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                select
                label="Provider Code"
                size="small"
                value={edit?.provider_code || ""}
                onChange={(e) => setEdit((p: any) => ({ ...p, provider_code: e.target.value }))}
                fullWidth
                disabled={!edit?.is_new}
              >
                {PROVIDERS.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
              </TextField>
              <TextField select label="Mode" size="small" value={edit?.mode || "TEST"} onChange={(e) => setEdit((p: any) => ({ ...p, mode: e.target.value }))} fullWidth>
                {MODES.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
              </TextField>
              <TextField type="number" label="Priority" size="small" value={edit?.priority || "1"} onChange={(e) => setEdit((p: any) => ({ ...p, priority: e.target.value }))} fullWidth />
            </Stack>

            <FormControl fullWidth size="small">
              <InputLabel>Gateway Fee Borne By</InputLabel>
              <Select label="Gateway Fee Borne By" value={edit?.fee_borne_by || "TRADER"} onChange={(e) => setEdit((p: any) => ({ ...p, fee_borne_by: e.target.value }))}>
                {FEE_BORNE_BY.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
              </Select>
            </FormControl>

            <FormControl fullWidth size="small">
              <InputLabel>Allowed Methods</InputLabel>
              <Select multiple value={edit?.allowed_methods || []} onChange={(e) => setEdit((p: any) => ({ ...p, allowed_methods: e.target.value }))} input={<OutlinedInput label="Allowed Methods" />}>
                {METHODS.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}
              </Select>
            </FormControl>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField
                label={edit?.provider_code === "PAYU" ? "Merchant Key" : edit?.provider_code === "CASHFREE" ? "App ID" : edit?.provider_code === "RAZORPAY" ? "Key ID" : "Merchant Key / App ID"}
                size="small"
                value={edit?.client_id || ""}
                onChange={(e) => setEdit((p: any) => ({ ...p, client_id: e.target.value }))}
                fullWidth
              />
              <TextField
                label={secretLabel}
                size="small"
                type="password"
                value={edit?.client_secret || ""}
                onChange={(e) => setEdit((p: any) => ({ ...p, client_secret: e.target.value }))}
                fullWidth
                helperText="Existing secret is saved. Leave blank to keep unchanged."
              />
              <TextField
                label="Webhook Secret"
                size="small"
                type="password"
                value={edit?.webhook_secret || ""}
                onChange={(e) => setEdit((p: any) => ({ ...p, webhook_secret: e.target.value }))}
                fullWidth
                helperText="Existing secret is saved. Leave blank to keep unchanged."
              />
            </Stack>

            <Stack direction="row" spacing={1}>
              {edit?.has_client_secret ? <Chip size="small" color="info" label="Secret saved" /> : null}
              {edit?.has_webhook_secret ? <Chip size="small" color="info" label="Webhook secret saved" /> : null}
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField label="Return URL" size="small" value={edit?.return_url || ""} onChange={(e) => setEdit((p: any) => ({ ...p, return_url: e.target.value }))} fullWidth />
              <TextField label="Notify URL" size="small" value={edit?.notify_url || ""} onChange={(e) => setEdit((p: any) => ({ ...p, notify_url: e.target.value }))} fullWidth />
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={String(edit?.is_active || "Y") === "Y"} onChange={(e) => setEdit((p: any) => ({ ...p, is_active: e.target.checked ? "Y" : "N" }))} />
              <Typography variant="body2">Active</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={onSave} disabled={saving}>Save</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
