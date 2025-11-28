import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../components/PageContainer";
import { ResponsiveDataGrid } from "../components/ResponsiveDataGrid";
import { getPaymentDetail, getPaymentsLog } from "../services/paymentsLogApi";
import { getCurrentAdminUsername } from "../utils/session";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { can } from "../utils/adminUiConfig";

const SOURCE_OPTIONS = ["SUBSCRIPTION", "SETTLEMENT", "OTHER"];
const STATUS_OPTIONS = ["SUCCESS", "FAILED", "PENDING"];
const METHOD_OPTIONS = ["UPI", "CARD", "BANK_TRANSFER", "CASH", "OTHER"];

export const PaymentsLog: React.FC = () => {
  const { i18n } = useTranslation();
  const language = i18n.language || "en";
  const uiConfig = useAdminUiConfig();
  const canView = useMemo(() => can(uiConfig.resources, "payments_log.list", "VIEW"), [uiConfig.resources]);
  const [filters, setFilters] = useState({
    source: "",
    org_id: "",
    mandi_id: "",
    payer_username: "",
    party_code: "",
    status: "",
    method: "",
    from_date: "",
    to_date: "",
  });
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);

  const columns = useMemo<GridColDef<any>[]>(
    () => [
      { field: "payment_code", headerName: "Payment Code", width: 160 },
      { field: "source", headerName: "Source", width: 110 },
      { field: "org_id", headerName: "Org", width: 120 },
      { field: "mandi_id", headerName: "Mandi", width: 110 },
      { field: "payer_username", headerName: "Payer", width: 140 },
      { field: "party_code", headerName: "Party Code", width: 140 },
      { field: "amount", headerName: "Amount", width: 120 },
      { field: "method", headerName: "Method", width: 120 },
      { field: "status", headerName: "Status", width: 120 },
      { field: "ts", headerName: "Timestamp", width: 160 },
    ],
    [],
  );

  const loadPayments = async () => {
    if (!canView) return;
    const username = getCurrentAdminUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp = await getPaymentsLog({
        username,
        language,
        filters,
      });
      setRows(
        (resp?.data?.items || []).map((payment: any) => ({
          ...payment,
          id: payment._id,
          ts: payment.ts ? new Date(payment.ts).toLocaleString() : "",
        })),
      );
    } catch (error) {
      console.error("Failed to load payments log:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
  }, [language, filters, canView]);

  const openDetail = async (paymentId: string) => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    try {
      const resp = await getPaymentDetail({
        username,
        language,
        payload: { payment_id: paymentId },
      });
      setDetailData(resp?.data || null);
      setDetailOpen(true);
    } catch (error) {
      console.error("Failed to load payment detail:", error);
    }
  };

  return (
    <PageContainer>
      <Stack spacing={2}>
        <Typography variant="h5">Payments Log</Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} flexWrap="wrap">
          <TextField
            label="Source"
            size="small"
            select
            value={filters.source}
            onChange={(event) => setFilters((prev) => ({ ...prev, source: event.target.value }))}
          >
            <MenuItem value="">Any</MenuItem>
            {SOURCE_OPTIONS.map((source) => (
              <MenuItem key={source} value={source}>
                {source}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Org ID"
            size="small"
            value={filters.org_id}
            onChange={(event) => setFilters((prev) => ({ ...prev, org_id: event.target.value }))}
          />
          <TextField
            label="Mandi ID"
            size="small"
            value={filters.mandi_id}
            onChange={(event) => setFilters((prev) => ({ ...prev, mandi_id: event.target.value }))}
          />
          <TextField
            label="Payer Username"
            size="small"
            value={filters.payer_username}
            onChange={(event) => setFilters((prev) => ({ ...prev, payer_username: event.target.value }))}
          />
          <TextField
            label="Party Code"
            size="small"
            value={filters.party_code}
            onChange={(event) => setFilters((prev) => ({ ...prev, party_code: event.target.value }))}
          />
          <TextField
            label="Status"
            size="small"
            select
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <MenuItem value="">Any</MenuItem>
            {STATUS_OPTIONS.map((status) => (
              <MenuItem key={status} value={status}>
                {status}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Method"
            size="small"
            select
            value={filters.method}
            onChange={(event) => setFilters((prev) => ({ ...prev, method: event.target.value }))}
          >
            <MenuItem value="">Any</MenuItem>
            {METHOD_OPTIONS.map((method) => (
              <MenuItem key={method} value={method}>
                {method}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="From"
            size="small"
            type="date"
            value={filters.from_date}
            onChange={(event) => setFilters((prev) => ({ ...prev, from_date: event.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To"
            size="small"
            type="date"
            value={filters.to_date}
            onChange={(event) => setFilters((prev) => ({ ...prev, to_date: event.target.value }))}
            InputLabelProps={{ shrink: true }}
          />
          <Button variant="outlined" onClick={() => loadPayments()}>
            Refresh
          </Button>
        </Stack>
        <Box>
          <ResponsiveDataGrid
            columns={columns}
            rows={rows}
            loading={loading}
            onRowClick={(params) => openDetail(params.row.id)}
          />
        </Box>
      </Stack>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Payment Detail</DialogTitle>
        <DialogContent>
          {detailData?.payment ? (
            <Stack spacing={2}>
              <Typography variant="subtitle1">
                {detailData.payment.payment_code} — {detailData.payment.status}
              </Typography>
              <Typography variant="body2">
                Amount: {detailData.payment.amount} | Method: {detailData.payment.method} | Source: {detailData.payment.source}
              </Typography>
              <Typography variant="body2">Payer: {detailData.payment.payer_username}</Typography>
              <Typography variant="subtitle2">Linked</Typography>
              {detailData.linked ? (
                <Typography variant="body2">
                  {detailData.linked.invoice_code || detailData.linked.settlement_code} (
                  {detailData.linked.status})
                </Typography>
              ) : (
                <Typography variant="body2">No linked record.</Typography>
              )}
            </Stack>
          ) : (
            <Typography variant="body2">Select a payment to view details.</Typography>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
};
