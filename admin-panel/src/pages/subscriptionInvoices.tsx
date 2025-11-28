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
import {
  getSubscriptionInvoiceDetail,
  getSubscriptionInvoices,
} from "../services/subscriptionsApi";
import { getCurrentAdminUsername } from "../utils/session";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { can } from "../utils/adminUiConfig";

const SUBJECT_TYPES = ["ORG", "MANDI", "TRADER", "FPO"];
const PAYMENT_STATUS = ["PENDING", "PARTIAL", "PAID", "CANCELLED"];

export const SubscriptionInvoices: React.FC = () => {
  const { i18n } = useTranslation();
  const language = i18n.language || "en";
  const uiConfig = useAdminUiConfig();
  const canView = useMemo(() => can(uiConfig.resources, "subscription_invoices.list", "LIST"), [uiConfig.resources]);
  const [filters, setFilters] = useState({
    subject_type: "",
    org_id: "",
    mandi_id: "",
    payment_status: "",
    from_date: "",
    to_date: "",
  });
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailData, setDetailData] = useState<any>(null);

  const loadData = async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp = await getSubscriptionInvoices({
        username,
        language,
        filters,
      });
      setRows(
        (resp?.data?.items || []).map((row: any) => ({
          id: row._id,
          invoice_code: row.invoice_code,
          subject_type: row.subject_type,
          org_code: row.org_code || "",
          mandi_name: row.mandi_name || "",
          payer_username: row.payer_username || "",
          amount_gross: row.amount_gross,
          payment_status: row.payment_status,
          period_start: row.period_start ? new Date(row.period_start).toLocaleDateString() : "",
          period_end: row.period_end ? new Date(row.period_end).toLocaleDateString() : "",
          paid_on: row.paid_on ? new Date(row.paid_on).toLocaleDateString() : "",
        })),
      );
    } catch (error) {
      console.error("Failed to load invoices:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      loadData();
    }
  }, [language, filters, canView]);

  const columns = useMemo<GridColDef<any>[]>(
    () => [
      { field: "invoice_code", headerName: "Invoice Code", width: 180 },
      { field: "subject_type", headerName: "Subject", width: 120 },
      { field: "org_code", headerName: "Org", width: 140 },
      { field: "mandi_name", headerName: "Mandi", width: 140 },
      { field: "payer_username", headerName: "Payer", width: 140 },
      { field: "amount_gross", headerName: "Amount", width: 120 },
      { field: "payment_status", headerName: "Status", width: 120 },
      { field: "period_start", headerName: "Period Start", width: 140 },
      { field: "period_end", headerName: "Period End", width: 140 },
      { field: "paid_on", headerName: "Paid On", width: 140 },
    ],
    [],
  );

  const openDetail = async (invoiceId: string) => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    try {
      const resp = await getSubscriptionInvoiceDetail({
        username,
        language,
        payload: { invoice_id: invoiceId },
      });
      setDetailData(resp?.data || null);
      setDetailOpen(true);
    } catch (error) {
      console.error("Failed to load invoice detail:", error);
    }
  };

  const paymentRows = detailData?.payments || [];

  return (
    <PageContainer>
      <Stack spacing={2}>
        <Typography variant="h5">Subscription Invoices</Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} flexWrap="wrap">
          <TextField
            label="Subject Type"
            size="small"
            select
            value={filters.subject_type}
            onChange={(event) => setFilters((prev) => ({ ...prev, subject_type: event.target.value }))}
          >
            <MenuItem value="">Any</MenuItem>
            {SUBJECT_TYPES.map((type) => (
              <MenuItem key={type} value={type}>
                {type}
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
            label="Payment Status"
            size="small"
            select
            value={filters.payment_status}
            onChange={(event) => setFilters((prev) => ({ ...prev, payment_status: event.target.value }))}
          >
            <MenuItem value="">Any</MenuItem>
            {PAYMENT_STATUS.map((status) => (
              <MenuItem key={status} value={status}>
                {status}
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
          <Button variant="outlined" onClick={loadData}>
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
        <DialogTitle>Invoice Detail</DialogTitle>
        <DialogContent>
          <Stack spacing={2}>
            <Typography variant="subtitle1">Invoice</Typography>
            <Typography variant="body2">
              Code: {detailData?.invoice?.invoice_code} &nbsp;|&nbsp; Status: {detailData?.invoice?.payment_status}
            </Typography>
            <Typography variant="body2">
              Amount: {detailData?.invoice?.amount_gross} &nbsp;|&nbsp; Period: {detailData?.invoice?.period_start} -{" "}
              {detailData?.invoice?.period_end}
            </Typography>
            <Typography variant="subtitle1">Payments</Typography>
            {paymentRows.length ? (
              paymentRows.map((payment: any) => (
                <Box key={payment.payment_code} sx={{ borderBottom: "1px solid #eee", py: 1 }}>
                  <Typography variant="body2">
                    {payment.payment_code} — {payment.amount} ({payment.method})
                  </Typography>
                  <Typography variant="caption">
                    Status: {payment.status} | Ref: {payment.payment_ref}
                  </Typography>
                </Box>
              ))
            ) : (
              <Typography variant="body2">No payments recorded yet.</Typography>
            )}
          </Stack>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
};
