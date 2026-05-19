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
  listPaymentGatewaySettings,
  savePaymentGatewaySettings,
  setDefaultPaymentGateway,
  togglePaymentGatewaySettings,
} from "../../api/paymentGatewaySettings";

const METHODS = ["UPI", "CARD", "NETBANKING"];
const MODES = ["TEST", "LIVE"];
const FEE_BORNE_BY = ["TRADER", "PLATFORM", "MANDI"];

type GatewayRow = {
  id: string;
  config_id: string | null;
  provider_code: string;
  provider_name: string;
  mode: string;
  priority: number;
  is_active: string;
  is_default: boolean;
  allowed_methods: string[];
  fee_borne_by: string;
  updated_on: string | null;
  client_id: string;
  client_secret_masked: string;
  webhook_secret_masked: string;
  return_url: string;
  notify_url: string;
};

export const PaymentGatewaySettingsPage: React.FC = () => {
  const [rows, setRows] = useState<GatewayRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [openEdit, setOpenEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [edit, setEdit] = useState<any>(null);

  const load = async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    setLoading(true);
    setErrorMsg("");
    try {
      const resp: any = await listPaymentGatewaySettings({ username, payload: {} });
      const code = String(resp?.response?.responsecode || "1");
      if (code !== "0") throw new Error(resp?.response?.description || "Unable to fetch gateway settings.");
      const list = Array.isArray(resp?.data?.items) ? resp.data.items : [];
      setRows(list.map((x: any) => ({ ...x, id: x.config_id || x.provider_code })));
    } catch (err: any) {
      setErrorMsg(err?.message || "Unable to load payment gateway settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openEditor = (row: GatewayRow) => {
    setEdit({
      provider_code: row.provider_code,
      mode: row.mode || "TEST",
      priority: String(row.priority || 1),
      is_active: row.is_active || "Y",
      client_id: row.client_id || "",
      client_secret: "",
      webhook_secret: "",
      return_url: row.return_url || "",
      notify_url: row.notify_url || "",
      allowed_methods: Array.isArray(row.allowed_methods) && row.allowed_methods.length ? row.allowed_methods : ["UPI"],
      fee_borne_by: row.fee_borne_by || "TRADER",
      config_id: row.config_id || null,
    });
    setOpenEdit(true);
  };

  const saveEdit = async () => {
    const username = getCurrentAdminUsername();
    if (!username || !edit) return;
    setSaving(true);
    setErrorMsg("");
    try {
      const resp: any = await savePaymentGatewaySettings({
        username,
        payload: {
          provider_code: edit.provider_code,
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
        throw new Error(resp?.response?.description || "Unable to save payment gateway settings.");
      }
      setOpenEdit(false);
      await load();
    } catch (err: any) {
      setErrorMsg(err?.message || "Unable to save payment gateway settings.");
    } finally {
      setSaving(false);
    }
  };

  const onToggle = async (row: GatewayRow) => {
    const username = getCurrentAdminUsername();
    if (!username || !row.config_id) return;
    const next = String(row.is_active || "Y") === "Y" ? "N" : "Y";
    const resp: any = await togglePaymentGatewaySettings({ username, payload: { config_id: row.config_id, is_active: next } });
    if (String(resp?.response?.responsecode || "1") !== "0") {
      setErrorMsg(resp?.response?.description || "Unable to toggle gateway.");
      return;
    }
    await load();
  };

  const onSetDefault = async (row: GatewayRow) => {
    const username = getCurrentAdminUsername();
    if (!username || !row.config_id) return;
    const resp: any = await setDefaultPaymentGateway({ username, payload: { config_id: row.config_id } });
    if (String(resp?.response?.responsecode || "1") !== "0") {
      setErrorMsg(resp?.response?.description || "Unable to set default gateway.");
      return;
    }
    await load();
  };

  const columns = useMemo<GridColDef<GatewayRow>[]>(() => [
    { field: "provider_name", headerName: "Gateway", width: 180 },
    { field: "mode", headerName: "Mode", width: 110 },
    { field: "priority", headerName: "Priority", width: 90 },
    {
      field: "is_active",
      headerName: "Active",
      width: 95,
      renderCell: (p) => <Chip size="small" color={String(p.value) === "Y" ? "success" : "default"} label={String(p.value) === "Y" ? "Yes" : "No"} />,
    },
    {
      field: "is_default",
      headerName: "Default",
      width: 100,
      renderCell: (p) => <Chip size="small" color={p.value ? "primary" : "default"} label={p.value ? "Yes" : "No"} />,
    },
    {
      field: "allowed_methods",
      headerName: "Allowed Methods",
      width: 220,
      renderCell: (p) => <>{(p.value || []).join(", ")}</>,
    },
    { field: "fee_borne_by", headerName: "Fee Borne By", width: 140 },
    {
      field: "updated_on",
      headerName: "Updated On",
      width: 190,
      renderCell: (p) => <>{p.value ? new Date(p.value).toLocaleString() : "-"}</>,
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 300,
      sortable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" onClick={() => openEditor(p.row)}>Edit</Button>
          <Button size="small" variant="outlined" onClick={() => onToggle(p.row)} disabled={!p.row.config_id}>
            {String(p.row.is_active) === "Y" ? "Disable" : "Enable"}
          </Button>
          <Button size="small" variant="contained" onClick={() => onSetDefault(p.row)} disabled={!p.row.config_id || String(p.row.is_active) !== "Y"}>
            Set Default
          </Button>
        </Stack>
      ),
    },
  ], []);

  return (
    <PageContainer>
      <Stack spacing={2}>
        <Typography variant="h5">Payment Gateway Settings</Typography>
        <Typography variant="body2" color="text.secondary">Manage gateway mode, priority, secrets, allowed methods, and default order.</Typography>

        {errorMsg ? (
          <Card>
            <CardContent>
              <Typography color="error">{errorMsg}</Typography>
            </CardContent>
          </Card>
        ) : null}

        <Card>
          <CardContent>
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <ResponsiveDataGrid rows={rows} columns={columns} loading={loading} />
            </Box>
          </CardContent>
        </Card>
      </Stack>

      <Dialog open={openEdit} onClose={() => setOpenEdit(false)} fullWidth maxWidth="md">
        <DialogTitle>Edit Gateway</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Provider Code" value={edit?.provider_code || ""} disabled fullWidth size="small" />
            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField select label="Mode" value={edit?.mode || "TEST"} onChange={(e) => setEdit((p: any) => ({ ...p, mode: e.target.value }))} size="small" fullWidth>
                {MODES.map((mode) => <MenuItem key={mode} value={mode}>{mode}</MenuItem>)}
              </TextField>
              <TextField label="Priority" type="number" value={edit?.priority || "1"} onChange={(e) => setEdit((p: any) => ({ ...p, priority: e.target.value }))} size="small" fullWidth />
              <FormControl fullWidth size="small">
                <InputLabel>Fee Borne By</InputLabel>
                <Select label="Fee Borne By" value={edit?.fee_borne_by || "TRADER"} onChange={(e) => setEdit((p: any) => ({ ...p, fee_borne_by: e.target.value }))}>
                  {FEE_BORNE_BY.map((fee) => <MenuItem key={fee} value={fee}>{fee}</MenuItem>)}
                </Select>
              </FormControl>
            </Stack>

            <FormControl size="small" fullWidth>
              <InputLabel>Allowed Methods</InputLabel>
              <Select
                multiple
                value={edit?.allowed_methods || []}
                onChange={(e) => setEdit((p: any) => ({ ...p, allowed_methods: e.target.value }))}
                input={<OutlinedInput label="Allowed Methods" />}
              >
                {METHODS.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
              </Select>
            </FormControl>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField label="Merchant Key / App ID" value={edit?.client_id || ""} onChange={(e) => setEdit((p: any) => ({ ...p, client_id: e.target.value }))} size="small" fullWidth />
              <TextField label="Secret Key" type="password" value={edit?.client_secret || ""} onChange={(e) => setEdit((p: any) => ({ ...p, client_secret: e.target.value }))} size="small" fullWidth />
              <TextField label="Webhook Secret" type="password" value={edit?.webhook_secret || ""} onChange={(e) => setEdit((p: any) => ({ ...p, webhook_secret: e.target.value }))} size="small" fullWidth />
            </Stack>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              <TextField label="Return URL" value={edit?.return_url || ""} onChange={(e) => setEdit((p: any) => ({ ...p, return_url: e.target.value }))} size="small" fullWidth />
              <TextField label="Notify URL" value={edit?.notify_url || ""} onChange={(e) => setEdit((p: any) => ({ ...p, notify_url: e.target.value }))} size="small" fullWidth />
            </Stack>

            <Stack direction="row" alignItems="center" spacing={1}>
              <Switch checked={String(edit?.is_active || "Y") === "Y"} onChange={(e) => setEdit((p: any) => ({ ...p, is_active: e.target.checked ? "Y" : "N" }))} />
              <Typography variant="body2">Active</Typography>
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEdit(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit} disabled={saving}>Save</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
