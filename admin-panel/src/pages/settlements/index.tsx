import React, { useCallback, useEffect, useMemo, useState } from "react";
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

const NEXT_BY_ACTION = {
  PAYMENT_REQUESTED: "PAYMENT_REQUESTED",
  CANCELLED: "CANCELLED",
  DISPUTED: "DISPUTED",
} as const;

const STATUS_CHOICES = [
  "NOT_REQUIRED",
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

  const [filters, setFilters] = useState({
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
  });

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
              {Object.keys(filters).map((k) => (
                <Grid item xs={12} md={3} key={k}>
                  <TextField
                    fullWidth
                    size="small"
                    type={k.startsWith("date_") ? "date" : "text"}
                    label={k}
                    value={(filters as any)[k]}
                    InputLabelProps={k.startsWith("date_") ? { shrink: true } : undefined}
                    onChange={(e) => setFilters((prev) => ({ ...prev, [k]: e.target.value }))}
                  />
                </Grid>
              ))}
              <Grid item xs={12}>
                <Button variant="contained" onClick={() => { setPage(1); load(); }}>Apply Filters</Button>
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
