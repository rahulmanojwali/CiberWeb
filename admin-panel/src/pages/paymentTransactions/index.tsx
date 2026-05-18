import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Card, CardContent, Grid, Stack, TextField, Typography } from "@mui/material";
import type { GridColDef } from "@mui/x-data-grid";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { getCurrentAdminUsername } from "../../utils/session";
import { listPaymentTransactions } from "../../api/paymentTransactions";
import { formatCurrencyINR, formatDateTime } from "../../utils/formatters";

export const PaymentTransactionsPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [filters, setFilters] = useState({ settlement_id: "", provider_code: "", status: "" });

  const load = async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp: any = await listPaymentTransactions({ username, payload: filters });
      const data = resp?.data || resp?.response?.data || {};
      const list = Array.isArray(data.items) ? data.items : [];
      setRows(list.map((x: any) => ({ ...x, id: String(x._id || "") })));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const cols = useMemo<GridColDef<any>[]>(() => [
    { field: "_id", headerName: "Transaction ID", width: 220 },
    { field: "settlement_id", headerName: "Settlement ID", width: 220 },
    { field: "provider_code", headerName: "Provider", width: 120 },
    { field: "mode", headerName: "Mode", width: 120 },
    { field: "amount", headerName: "Amount", width: 130, renderCell: (p) => <>{formatCurrencyINR(p.row.amount)}</> },
    { field: "status", headerName: "Status", width: 140 },
    { field: "gateway_order_id", headerName: "Gateway Order ID", width: 180 },
    { field: "gateway_payment_id", headerName: "Gateway Payment ID", width: 180 },
    { field: "created_on", headerName: "Created On", width: 190, renderCell: (p) => <>{formatDateTime(p.row.created_on)}</> },
    { field: "updated_on", headerName: "Updated On", width: 190, renderCell: (p) => <>{formatDateTime(p.row.updated_on)}</> },
  ], []);

  return (
    <PageContainer>
      <Stack spacing={2}>
        <Typography variant="h5">Payment Transactions</Typography>

        <Card>
          <CardContent>
            <Grid container spacing={2}>
              <Grid item xs={12} md={3}><TextField fullWidth size="small" label="Settlement ID" value={filters.settlement_id} onChange={(e) => setFilters((p) => ({ ...p, settlement_id: e.target.value }))} /></Grid>
              <Grid item xs={12} md={3}><TextField fullWidth size="small" label="Provider" value={filters.provider_code} onChange={(e) => setFilters((p) => ({ ...p, provider_code: e.target.value }))} /></Grid>
              <Grid item xs={12} md={3}><TextField fullWidth size="small" label="Status" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} /></Grid>
              <Grid item xs={12} md={3}><Button variant="outlined" fullWidth onClick={load}>Load</Button></Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <ResponsiveDataGrid rows={rows} columns={cols} loading={loading} />
            </Box>
          </CardContent>
        </Card>
      </Stack>
    </PageContainer>
  );
};
