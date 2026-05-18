import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { PageContainer } from "../../components/PageContainer";
import { listAuctionSettlements, updateAuctionSettlementStatus } from "../../api/settlements";
import { getCurrentAdminUsername } from "../../utils/session";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import { getAuctionSessions } from "../../services/auctionOpsApi";

const NEXT_BY_ACTION = {
  PAYMENT_REQUESTED: "PAYMENT_REQUESTED",
  CANCELLED: "CANCELLED",
  DISPUTED: "DISPUTED",
} as const;

const STATUS_CHOICES = [
  "PENDING",
  "PAYMENT_REQUESTED",
  "PAYMENT_INITIATED",
  "PAYMENT_PENDING_CONFIRMATION",
  "PAID",
  "VERIFIED",
  "SETTLED",
  "FAILED",
  "CANCELLED",
  "DISPUTED",
  "REFUNDED",
];

const PAYMENT_STATUS_CHOICES = [
  "NOT_REQUESTED",
  "REQUESTED",
  "INITIATED",
  "PENDING_CONFIRMATION",
  "PAID",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
];

type Option = { value: string; label: string };

const DEFAULT_FILTERS = {
  org_id: "",
  mandi_id: "",
  status: "",
  payment_status: "",
  session_id: "",
  lot_code: "",
  trader_username: "",
  farmer_username: "",
  date_from: "",
  date_to: "",
};

type SettlementRow = {
  id: string;
  _id: string;
  auction_result_id?: string;
  auction_lot_id?: string;
  lot_code?: string | null;
  session_code?: string | null;
  farmer_username?: string | null;
  trader_username?: string | null;
  final_amount?: any;
  final_rate_per_qtl?: any;
  quantity_kg?: any;
  quantity_qtl?: any;
  status?: string | null;
  payment_status?: string | null;
  dispute_status?: string | null;
  lifecycle_state_reason?: string | null;
  created_on?: string;
  updated_on?: string;
  created_by?: string;
  updated_by?: string;
};

function asText(v: any): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  if (typeof v?.toString === "function") return v.toString();
  return "";
}

function money(v: any): string {
  const raw = asText(v);
  const n = Number(raw);
  return Number.isFinite(n) ? n.toFixed(2) : raw || "-";
}

function date(v: any): string {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

export const SettlementsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selected, setSelected] = useState<SettlementRow | null>(null);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState("PAYMENT_REQUESTED");
  const [statusReason, setStatusReason] = useState("");

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [orgOptions, setOrgOptions] = useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [sessionOptions, setSessionOptions] = useState<Option[]>([]);
  const [sessionSearchText, setSessionSearchText] = useState("");
  const [sessionDropdownEnabled, setSessionDropdownEnabled] = useState(true);

  const load = useCallback(async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp: any = await listAuctionSettlements({
        username,
        language: "en",
        filters: {
          ...filters,
          page,
          page_size: pageSize,
        },
      });
      const data = resp?.data || resp?.response?.data || {};
      const items = Array.isArray(data.items) ? data.items : [];
      setRows(items.map((x: any) => ({ ...x, id: String(x?._id || "") })));
      setTotalRecords(Number(data.total_records || 0));
    } catch (err) {
      console.error("[settlements][load]", err);
      setRows([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const loadOrgs = useCallback(async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    try {
      const resp: any = await fetchOrganisations({ username, language: "en" });
      const data = resp?.data || resp?.response?.data || {};
      const items = Array.isArray(data?.items) ? data.items : data?.rows || [];
      setOrgOptions(
        (items || []).map((o: any) => ({
          value: String(o.org_id || o._id || ""),
          label: o.org_name || o.name || String(o.org_id || ""),
        })),
      );
    } catch (err) {
      console.error("[settlements][loadOrgs]", err);
      setOrgOptions([]);
    }
  }, []);

  const loadMandis = useCallback(async () => {
    const username = getCurrentAdminUsername();
    const orgId = String(filters.org_id || "");
    if (!username || !orgId) {
      setMandiOptions([]);
      return;
    }
    try {
      const list = await getMandisForCurrentScope({ username, language: "en", org_id: orgId });
      setMandiOptions(
        (list || []).map((m: any) => ({
          value: String(m.mandi_id ?? m.mandiId ?? ""),
          label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
        })),
      );
    } catch (err) {
      console.error("[settlements][loadMandis]", err);
      setMandiOptions([]);
    }
  }, [filters.org_id]);

  const loadSessions = useCallback(async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    try {
      const resp: any = await getAuctionSessions({
        username,
        language: "en",
        filters: {
          org_id: filters.org_id || undefined,
          mandi_id: filters.mandi_id || undefined,
          page_size: 100,
        },
      });
      const items = resp?.data?.items || resp?.response?.data?.items || [];
      setSessionOptions(
        (items || []).map((s: any) => {
          const id = String(s?._id || s?.session_id || "");
          const code = String(s?.session_code || "").trim();
          const name = String(s?.session_name || "").trim();
          const label = [code, name].filter(Boolean).join(" - ") || id;
          return { value: id, label };
        }),
      );
      setSessionDropdownEnabled(true);
    } catch (err) {
      console.error("[settlements][loadSessions]", err);
      setSessionDropdownEnabled(false);
      setSessionOptions([]);
    }
  }, [filters.org_id, filters.mandi_id]);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  useEffect(() => {
    loadMandis();
    setFilters((prev) => ({ ...prev, mandi_id: "", session_id: "" }));
    setSessionSearchText("");
  }, [filters.org_id, loadMandis]);

  useEffect(() => {
    loadSessions();
    setFilters((prev) => ({ ...prev, session_id: "" }));
    setSessionSearchText("");
  }, [filters.mandi_id, loadSessions]);

  const submitStatus = useCallback(async () => {
    if (!selected?._id || !targetStatus) return;
    const username = getCurrentAdminUsername();
    if (!username) return;
    const resp: any = await updateAuctionSettlementStatus({
      username,
      settlement_id: selected._id,
      status: targetStatus,
      reason: statusReason,
    });
    const code = String(resp?.response?.responsecode || resp?.responsecode || "1");
    if (code !== "0") {
      alert(resp?.response?.description || "Status update failed");
      return;
    }
    setStatusDialogOpen(false);
    setStatusReason("");
    await load();
  }, [selected, targetStatus, statusReason, load]);

  const columns = useMemo<GridColDef<SettlementRow>[]>(() => [
    { field: "lot_code", headerName: "Lot Code", width: 130 },
    { field: "session_code", headerName: "Session Code", width: 140 },
    { field: "farmer_username", headerName: "Farmer", width: 150 },
    { field: "trader_username", headerName: "Trader", width: 150 },
    {
      field: "final_amount",
      headerName: "Final Amount",
      width: 120,
      renderCell: (p) => <>{money(p.row.final_amount)}</>,
    },
    {
      field: "status",
      headerName: "Settlement Status",
      width: 170,
      renderCell: (p) => <Chip size="small" label={p.row.status || "-"} color={p.row.status === "SETTLED" ? "success" : "default"} />,
    },
    { field: "payment_status", headerName: "Payment Status", width: 180 },
    {
      field: "created_on",
      headerName: "Created On",
      width: 170,
      renderCell: (p) => <>{date(p.row.created_on)}</>,
    },
    {
      field: "updated_on",
      headerName: "Updated On",
      width: 170,
      renderCell: (p) => <>{date(p.row.updated_on)}</>,
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 360,
      sortable: false,
      filterable: false,
      renderCell: (p) => (
        <Stack direction="row" spacing={1}>
          <Button size="small" variant="outlined" onClick={() => setSelected(p.row)}>View Details</Button>
          <Button
            size="small"
            color="success"
            onClick={() => {
              setSelected(p.row);
              setTargetStatus(NEXT_BY_ACTION.PAYMENT_REQUESTED);
              setStatusDialogOpen(true);
            }}
          >
            Request Payment
          </Button>
          <Button
            size="small"
            onClick={() => {
              setSelected(p.row);
              setTargetStatus(NEXT_BY_ACTION.PAYMENT_REQUESTED);
              setStatusDialogOpen(true);
            }}
          >
            Move Status
          </Button>
          <Button
            size="small"
            color="warning"
            onClick={() => {
              setSelected(p.row);
              setTargetStatus(NEXT_BY_ACTION.CANCELLED);
              setStatusDialogOpen(true);
            }}
          >
            Cancel
          </Button>
          <Button
            size="small"
            color="error"
            onClick={() => {
              setSelected(p.row);
              setTargetStatus(NEXT_BY_ACTION.DISPUTED);
              setStatusDialogOpen(true);
            }}
          >
            Dispute
          </Button>
        </Stack>
      ),
    },
  ], []);

  return (
    <PageContainer>
      <Stack spacing={2}>
        <Typography variant="h5">Settlement Lifecycle</Typography>

        <Card>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Organisation"
                  value={filters.org_id}
                  onChange={(e) => setFilters((prev) => ({ ...prev, org_id: String(e.target.value || "") }))}
                >
                  <MenuItem value=""><em>All Organisations</em></MenuItem>
                  {orgOptions.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Mandi"
                  value={filters.mandi_id}
                  onChange={(e) => setFilters((prev) => ({ ...prev, mandi_id: String(e.target.value || "") }))}
                  disabled={!filters.org_id}
                >
                  <MenuItem value=""><em>All Mandis</em></MenuItem>
                  {mandiOptions.map((m) => (
                    <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Settlement Status"
                  value={filters.status}
                  onChange={(e) => setFilters((prev) => ({ ...prev, status: String(e.target.value || "") }))}
                >
                  <MenuItem value=""><em>All Statuses</em></MenuItem>
                  {STATUS_CHOICES.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  select
                  fullWidth
                  size="small"
                  label="Payment Status"
                  value={filters.payment_status}
                  onChange={(e) => setFilters((prev) => ({ ...prev, payment_status: String(e.target.value || "") }))}
                >
                  <MenuItem value=""><em>All Payment Statuses</em></MenuItem>
                  {PAYMENT_STATUS_CHOICES.map((s) => (
                    <MenuItem key={s} value={s}>{s}</MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                {sessionDropdownEnabled ? (
                  <Autocomplete
                    options={sessionOptions}
                    value={sessionOptions.find((opt) => opt.value === filters.session_id) || null}
                    inputValue={sessionSearchText}
                    onInputChange={(_e, value) => setSessionSearchText(value)}
                    onChange={(_e, option) => {
                      setFilters((prev) => ({ ...prev, session_id: option?.value || "" }));
                    }}
                    getOptionLabel={(option) => option.label}
                    isOptionEqualToValue={(opt, val) => opt.value === val.value}
                    renderInput={(params) => <TextField {...params} fullWidth size="small" label="Auction Session" />}
                  />
                ) : (
                  <TextField
                    fullWidth
                    size="small"
                    label="Session Code / Session ID"
                    value={filters.session_id}
                    onChange={(e) => setFilters((prev) => ({ ...prev, session_id: e.target.value }))}
                  />
                )}
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Lot Code"
                  value={filters.lot_code}
                  onChange={(e) => setFilters((prev) => ({ ...prev, lot_code: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Trader Username"
                  value={filters.trader_username}
                  onChange={(e) => setFilters((prev) => ({ ...prev, trader_username: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  label="Farmer Username"
                  value={filters.farmer_username}
                  onChange={(e) => setFilters((prev) => ({ ...prev, farmer_username: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Date From"
                  value={filters.date_from}
                  InputLabelProps={{ shrink: true }}
                  onChange={(e) => setFilters((prev) => ({ ...prev, date_from: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <TextField
                  fullWidth
                  size="small"
                  type="date"
                  label="Date To"
                  value={filters.date_to}
                  InputLabelProps={{ shrink: true }}
                  onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))}
                />
              </Grid>
              <Grid item xs={12}>
                <Stack direction="row" spacing={1}>
                  <Button variant="contained" onClick={() => { setPage(1); load(); }}>Apply Filters</Button>
                  <Button
                    variant="outlined"
                    onClick={() => {
                      setFilters(DEFAULT_FILTERS);
                      setSessionSearchText("");
                      setPage(1);
                    }}
                  >
                    Clear Filters
                  </Button>
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <ResponsiveDataGrid
                rows={rows}
                columns={columns}
                loading={loading}
                rowCount={totalRecords}
                paginationMode="server"
                paginationModel={{ page: Math.max(page - 1, 0), pageSize }}
                onPaginationModelChange={(model: any) => {
                  setPage(Number(model.page || 0) + 1);
                  setPageSize(Number(model.pageSize || 20));
                }}
                onRowClick={(params: any) => setSelected(params.row)}
              />
            </Box>
          </CardContent>
        </Card>
      </Stack>

      <Drawer
        anchor="right"
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
      >
        <Box sx={{ width: 480, p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>Settlement Detail</Typography>
          {selected && (
            <Stack spacing={1.2}>
              <Typography><b>Auction Result ID:</b> {asText(selected.auction_result_id) || "-"}</Typography>
              <Typography><b>Auction Lot ID:</b> {asText(selected.auction_lot_id) || "-"}</Typography>
              <Typography><b>Lot Code:</b> {asText(selected.lot_code) || "-"}</Typography>
              <Typography><b>Session Code:</b> {asText(selected.session_code) || "-"}</Typography>
              <Typography><b>Farmer:</b> {asText(selected.farmer_username) || "-"}</Typography>
              <Typography><b>Trader:</b> {asText(selected.trader_username) || "-"}</Typography>
              <Typography><b>Quantity KG:</b> {money(selected.quantity_kg)}</Typography>
              <Typography><b>Quantity QTL:</b> {money(selected.quantity_qtl)}</Typography>
              <Typography><b>Final Rate / QTL:</b> {money(selected.final_rate_per_qtl)}</Typography>
              <Typography><b>Final Amount:</b> {money(selected.final_amount)}</Typography>
              <Typography><b>Status:</b> {asText(selected.status) || "-"}</Typography>
              <Typography><b>Payment Status:</b> {asText(selected.payment_status) || "-"}</Typography>
              <Typography><b>Dispute Status:</b> {asText(selected.dispute_status) || "-"}</Typography>
              <Typography><b>Lifecycle Reason:</b> {asText(selected.lifecycle_state_reason) || "-"}</Typography>
              <Typography><b>Created:</b> {date(selected.created_on)} by {asText(selected.created_by) || "-"}</Typography>
              <Typography><b>Updated:</b> {date(selected.updated_on)} by {asText(selected.updated_by) || "-"}</Typography>
            </Stack>
          )}
        </Box>
      </Drawer>

      <Dialog open={statusDialogOpen} onClose={() => setStatusDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Move Settlement Status</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={targetStatus}
                onChange={(e) => setTargetStatus(String(e.target.value))}
              >
                {STATUS_CHOICES.map((s) => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
              </Select>
            </FormControl>
            <TextField
              label="Reason"
              size="small"
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              multiline
              minRows={3}
              fullWidth
            />
            <Typography variant="body2" color="text.secondary">
              Transitions are validated by backend; invalid transitions are rejected.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setStatusDialogOpen(false)}>Close</Button>
          <Button variant="contained" onClick={submitStatus}>Update</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
