import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../components/PageContainer";
import { ResponsiveDataGrid } from "../components/ResponsiveDataGrid";
import { getSettlements, getSettlementDetail, rejectSettlementPayment, verifySettlementPayment } from "../services/settlementsApi";
import { getCurrentAdminUsername } from "../utils/session";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { can } from "../utils/adminUiConfig";

const PARTY_ROLES = ["FARMER", "TRADER", "ORG", "MANDI"];
const STATUS_OPTIONS = ["PENDING", "PAID", "PARTIAL", "CANCELLED", "PENDING_PAYMENT", "PAYMENT_SUBMITTED", "PAYMENT_CONFIRMED", "PAYMENT_REJECTED"];

export const SettlementsPage: React.FC = () => {
  const { i18n } = useTranslation();
  const language = i18n.language || "en";
  const uiConfig = useAdminUiConfig();
  const theme = useTheme();
  const fullScreenDialog = useMediaQuery(theme.breakpoints.down("sm"));
  const canView = useMemo(() => can(uiConfig.resources, "settlements.list", "LIST"), [uiConfig.resources]);
  const [filters, setFilters] = useState({
    org_id: "",
    mandi_id: "",
    party_role: "",
    party_code: "",
    status: "",
    from_date: "",
    to_date: "",
  });
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);
  const [detailActionLoading, setDetailActionLoading] = useState(false);

  const columns = useMemo<GridColDef<any>[]>(
    () => [
      { field: "settlement_code", headerName: "Code", width: 160 },
      { field: "org_code", headerName: "Org", width: 140 },
      { field: "mandi_name", headerName: "Mandi", width: 140 },
      { field: "party_role", headerName: "Role", width: 120 },
      { field: "party_code", headerName: "Party Code", width: 140 },
      { field: "total_amount", headerName: "Total", width: 120 },
      { field: "paid_amount", headerName: "Paid", width: 120 },
      { field: "balance", headerName: "Balance", width: 120 },
      { field: "payment_status", headerName: "Payment Status", width: 160 },
      { field: "settlement_date", headerName: "Date", width: 140 },
    ],
    [],
  );

  const loadSettlements = async () => {
    if (!canView) return;
    const username = getCurrentAdminUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp = await getSettlements({
        username,
        language,
        filters,
      });
      setRows(
        (resp?.data?.items || []).map((settlement: any) => ({
          ...settlement,
          id: settlement._id,
          payment_status: settlement.payment_status || settlement.status,
          settlement_date: settlement.settlement_date ? new Date(settlement.settlement_date).toLocaleDateString() : "",
        })),
      );
    } catch (error) {
      console.error("Failed to load settlements:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettlements();
  }, [language, filters, canView]);

  const openDetail = async (settlementId: string) => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    try {
      const resp = await getSettlementDetail({
        username,
        language,
        payload: { settlement_id: settlementId },
      });
      setDetailData(resp?.data || null);
      setDetailOpen(true);
    } catch (error) {
      console.error("Failed to load settlement detail:", error);
    }
  };

  const handleVerifyPayment = async () => {
    const username = getCurrentAdminUsername();
    const settlementId = detailData?.header?._id;
    if (!username || !settlementId) return;
    setDetailActionLoading(true);
    try {
      const resp = await verifySettlementPayment({
        username,
        language,
        payload: { settlement_id: settlementId },
      });
      const rc = resp?.response?.responsecode ?? resp?.responsecode;
      if (String(rc) === "0") {
        await openDetail(settlementId);
        await loadSettlements();
      }
    } finally {
      setDetailActionLoading(false);
    }
  };

  const handleRejectPayment = async () => {
    const username = getCurrentAdminUsername();
    const settlementId = detailData?.header?._id;
    if (!username || !settlementId) return;
    setDetailActionLoading(true);
    try {
      const resp = await rejectSettlementPayment({
        username,
        language,
        payload: {
          settlement_id: settlementId,
          rejection_reason: "Proof rejected by admin",
        },
      });
      const rc = resp?.response?.responsecode ?? resp?.responsecode;
      if (String(rc) === "0") {
        await openDetail(settlementId);
        await loadSettlements();
      }
    } finally {
      setDetailActionLoading(false);
    }
  };

  return (
    <PageContainer>
      <Stack
        direction={{ xs: "column", md: "row" }}
        alignItems={{ xs: "flex-start", md: "center" }}
        justifyContent="space-between"
        spacing={2}
        sx={{ mb: 2 }}
      >
        <Stack spacing={0.5}>
          <Typography variant="h5">Settlements</Typography>
          <Typography variant="body2" color="text.secondary">
            Review settlement balances and payouts.
          </Typography>
        </Stack>
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <TextField
                label="Org ID"
                size="small"
                value={filters.org_id}
                onChange={(event) => setFilters((prev) => ({ ...prev, org_id: event.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Mandi ID"
                size="small"
                value={filters.mandi_id}
                onChange={(event) => setFilters((prev) => ({ ...prev, mandi_id: event.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Party Role"
                size="small"
                select
                value={filters.party_role}
                onChange={(event) => setFilters((prev) => ({ ...prev, party_role: event.target.value }))}
                fullWidth
              >
                <MenuItem value="">Any</MenuItem>
                {PARTY_ROLES.map((role) => (
                  <MenuItem key={role} value={role}>
                    {role}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Party Code"
                size="small"
                value={filters.party_code}
                onChange={(event) => setFilters((prev) => ({ ...prev, party_code: event.target.value }))}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="Status"
                size="small"
                select
                value={filters.status}
                onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
                fullWidth
              >
                <MenuItem value="">Any</MenuItem>
                {STATUS_OPTIONS.map((status) => (
                  <MenuItem key={status} value={status}>
                    {status}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="From"
                size="small"
                type="date"
                value={filters.from_date}
                onChange={(event) => setFilters((prev) => ({ ...prev, from_date: event.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <TextField
                label="To"
                size="small"
                type="date"
                value={filters.to_date}
                onChange={(event) => setFilters((prev) => ({ ...prev, to_date: event.target.value }))}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Button variant="outlined" onClick={() => loadSettlements()} fullWidth>
                Refresh
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : (
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <ResponsiveDataGrid
                columns={columns}
                rows={rows}
                loading={loading}
                onRowClick={(params) => openDetail(params.row.id)}
              />
            </Box>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        fullWidth
        maxWidth="lg"
        fullScreen={fullScreenDialog}
      >
        <DialogTitle>Settlement Detail</DialogTitle>
        <DialogContent>
          {detailData?.header ? (
            <Stack spacing={2}>
              <Typography variant="subtitle1">
                {detailData.header.settlement_code} — {detailData.header.status}
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2">
                    Org: {detailData.header.org_code} / {detailData.header.mandi_name}
                  </Typography>
                  <Typography variant="body2">Party: {detailData.header.party_role} {detailData.header.party_code}</Typography>
                  <Typography variant="body2">Lot: {detailData.header.lot_code || "—"}</Typography>
                  <Typography variant="body2">Trader: {detailData.header.trader_username || detailData.header.winning_bidder_username || "—"}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2">Total: {detailData.header.total_amount}</Typography>
                  <Typography variant="body2">Paid: {detailData.header.paid_amount}</Typography>
                  <Typography variant="body2">Balance: {detailData.header.balance}</Typography>
                  <Typography variant="body2">Payment Status: {detailData.header.payment_status || detailData.header.status || "—"}</Typography>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2">UPI Txn ID: {detailData.header.upi_txn_id || "—"}</Typography>
                  <Typography variant="body2">RRN: {detailData.header.upi_rrn || "—"}</Typography>
                  <Typography variant="body2">Paid On: {detailData.header.upi_paid_on || "—"}</Typography>
                  <Typography variant="body2">
                    Screenshot: {detailData.header.upi_screenshot_url ? <a href={detailData.header.upi_screenshot_url} target="_blank" rel="noreferrer">View</a> : "—"}
                  </Typography>
                </Grid>
              </Grid>
              {detailData.header.payment_status === "PAYMENT_SUBMITTED" ? (
                <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                  <Button variant="contained" onClick={handleVerifyPayment} disabled={detailActionLoading}>
                    Verify Payment
                  </Button>
                  <Button variant="outlined" color="error" onClick={handleRejectPayment} disabled={detailActionLoading}>
                    Reject Payment
                  </Button>
                </Stack>
              ) : null}
              <Typography variant="subtitle2">Settlement Lines</Typography>
              {detailData.lines?.length ? (
                detailData.lines.map((line: any) => (
                  <Box key={`${line._id}-${line.lot_id}`} sx={{ borderBottom: "1px dashed #ddd", py: 1 }}>
                    <Typography variant="body2">
                      Lot {line.lot_id || line.lot_code}: {line.quantity} × {line.rate} = {line.amount}
                    </Typography>
                  </Box>
                ))
              ) : (
                <Typography variant="body2">No lines found.</Typography>
              )}
              <Typography variant="subtitle2">Core Payments</Typography>
              {detailData.payments_core?.length ? (
                detailData.payments_core.map((payment: any) => (
                  <Typography key={payment._id} variant="body2">
                    {payment.payment_code}: {payment.amount} ({payment.method})
                  </Typography>
                ))
              ) : (
                <Typography variant="body2">No core payments.</Typography>
              )}
              <Typography variant="subtitle2">Payment Log</Typography>
              {detailData.payments_log?.length ? (
                detailData.payments_log.map((payment: any) => (
                  <Typography key={payment._id} variant="body2">
                    {payment.payment_code}: {payment.amount} ({payment.method})
                  </Typography>
                ))
              ) : (
                <Typography variant="body2">No logged payments.</Typography>
              )}
            </Stack>
          ) : (
            <Typography variant="body2">Select a settlement to view details.</Typography>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
};
