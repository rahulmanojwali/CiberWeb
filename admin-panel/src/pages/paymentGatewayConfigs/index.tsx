import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Card, CardContent, Grid, MenuItem, Stack, TextField, Typography } from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { getCurrentAdminUsername } from "../../utils/session";
import { listPaymentGatewayConfigs, savePaymentGatewayConfig, togglePaymentGatewayConfig } from "../../api/paymentGatewayConfigs";

const PROVIDERS = ["CASHFREE", "MANUAL"];
const MODES = ["SANDBOX", "PRODUCTION"];

export const PaymentGatewayConfigsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [filters, setFilters] = useState({ provider_code: "", mode: "", org_id: "", mandi_id: "", is_active: "" });
  const [form, setForm] = useState({
    provider_code: "MANUAL",
    mode: "SANDBOX",
    org_id: "",
    mandi_id: "",
    is_active: "Y",
    priority: "1",
    client_id: "",
    client_secret: "",
    webhook_secret: "",
    return_url: "",
    notify_url: "",
  });

  const load = async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp: any = await listPaymentGatewayConfigs({ username, payload: filters });
      const data = resp?.data || resp?.response?.data || {};
      const list = Array.isArray(data.items) ? data.items : [];
      setRows(list.map((x: any) => ({ ...x, id: String(x._id || `${x.provider_code}-${x.org_id || "GLOBAL"}-${x.mandi_id || "ALL"}`) })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    await savePaymentGatewayConfig({
      username,
      payload: {
        ...form,
        org_id: form.org_id || null,
        mandi_id: form.mandi_id ? Number(form.mandi_id) : null,
        priority: Number(form.priority || 1),
      },
    });
    setForm((prev) => ({ ...prev, client_secret: "", webhook_secret: "" }));
    await load();
  };

  const toggle = async (row: any) => {
    const username = getCurrentAdminUsername();
    if (!username || !row?._id) return;
    const next = String(row.is_active || "Y").toUpperCase() === "Y" ? "N" : "Y";
    await togglePaymentGatewayConfig({ username, payload: { config_id: row._id, is_active: next } });
    await load();
  };

  const columns = useMemo<GridColDef<any>[]>(() => [
    { field: "provider_code", headerName: "Provider", width: 120 },
    { field: "mode", headerName: "Mode", width: 120 },
    { field: "org_id", headerName: "Org", width: 170 },
    { field: "mandi_id", headerName: "Mandi", width: 100 },
    { field: "is_active", headerName: "Active", width: 90 },
    { field: "priority", headerName: "Priority", width: 90 },
    { field: "client_id", headerName: "Client ID", width: 180 },
    { field: "has_client_secret", headerName: "Secret Configured", width: 150, renderCell: (p) => <>{p.row.has_client_secret ? "Yes" : "No"}</> },
    { field: "has_webhook_secret", headerName: "Webhook Secret Configured", width: 190, renderCell: (p) => <>{p.row.has_webhook_secret ? "Yes" : "No"}</> },
    { field: "return_url", headerName: "Return URL", width: 220 },
    { field: "notify_url", headerName: "Notify URL", width: 220 },
    { field: "actions", headerName: "Actions", width: 130, sortable: false, renderCell: (p) => <Button size="small" onClick={() => toggle(p.row)}>{String(p.row.is_active || "Y") === "Y" ? "Disable" : "Enable"}</Button> },
  ], []);

  return (
    <PageContainer>
      <Stack spacing={2}>
        <Typography variant="h5">Payment Gateway Configs</Typography>

        <Card>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={2}><TextField select fullWidth size="small" label="Provider" value={filters.provider_code} onChange={(e) => setFilters((p) => ({ ...p, provider_code: e.target.value }))}><MenuItem value="">Any</MenuItem>{PROVIDERS.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField></Grid>
              <Grid item xs={12} md={2}><TextField select fullWidth size="small" label="Mode" value={filters.mode} onChange={(e) => setFilters((p) => ({ ...p, mode: e.target.value }))}><MenuItem value="">Any</MenuItem>{MODES.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField></Grid>
              <Grid item xs={12} md={2}><TextField fullWidth size="small" label="Org" value={filters.org_id} onChange={(e) => setFilters((p) => ({ ...p, org_id: e.target.value }))} /></Grid>
              <Grid item xs={12} md={2}><TextField fullWidth size="small" label="Mandi" value={filters.mandi_id} onChange={(e) => setFilters((p) => ({ ...p, mandi_id: e.target.value }))} /></Grid>
              <Grid item xs={12} md={2}><TextField select fullWidth size="small" label="Active" value={filters.is_active} onChange={(e) => setFilters((p) => ({ ...p, is_active: e.target.value }))}><MenuItem value="">Any</MenuItem><MenuItem value="Y">Y</MenuItem><MenuItem value="N">N</MenuItem></TextField></Grid>
              <Grid item xs={12} md={2}><Button variant="outlined" fullWidth onClick={load}>Load</Button></Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <ResponsiveDataGrid rows={rows} columns={columns} loading={loading} />
            </Box>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 2 }}>Save / Update Config</Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}><TextField select fullWidth size="small" label="Provider" value={form.provider_code} onChange={(e) => setForm((p) => ({ ...p, provider_code: e.target.value }))}>{PROVIDERS.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField></Grid>
              <Grid item xs={12} md={3}><TextField select fullWidth size="small" label="Mode" value={form.mode} onChange={(e) => setForm((p) => ({ ...p, mode: e.target.value }))}>{MODES.map((x) => <MenuItem key={x} value={x}>{x}</MenuItem>)}</TextField></Grid>
              <Grid item xs={12} md={3}><TextField fullWidth size="small" label="Org" value={form.org_id} onChange={(e) => setForm((p) => ({ ...p, org_id: e.target.value }))} /></Grid>
              <Grid item xs={12} md={3}><TextField fullWidth size="small" label="Mandi" value={form.mandi_id} onChange={(e) => setForm((p) => ({ ...p, mandi_id: e.target.value }))} /></Grid>
              <Grid item xs={12} md={2}><TextField fullWidth size="small" label="Active" value={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.value }))} /></Grid>
              <Grid item xs={12} md={2}><TextField fullWidth size="small" label="Priority" value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Client ID" value={form.client_id} onChange={(e) => setForm((p) => ({ ...p, client_id: e.target.value }))} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Client Secret" type="password" value={form.client_secret} onChange={(e) => setForm((p) => ({ ...p, client_secret: e.target.value }))} /></Grid>
              <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Webhook Secret" type="password" value={form.webhook_secret} onChange={(e) => setForm((p) => ({ ...p, webhook_secret: e.target.value }))} /></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Return URL" value={form.return_url} onChange={(e) => setForm((p) => ({ ...p, return_url: e.target.value }))} /></Grid>
              <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Notify URL" value={form.notify_url} onChange={(e) => setForm((p) => ({ ...p, notify_url: e.target.value }))} /></Grid>
              <Grid item xs={12}><Button variant="contained" onClick={save}>Save Config</Button></Grid>
            </Grid>
          </CardContent>
        </Card>
      </Stack>
    </PageContainer>
  );
};
