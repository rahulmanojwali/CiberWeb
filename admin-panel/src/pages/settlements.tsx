import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogContent,
  DialogTitle,
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../components/PageContainer";
import { ResponsiveDataGrid } from "../components/ResponsiveDataGrid";
import { getSettlements, getSettlementDetail } from "../services/settlementsApi";
import { getCurrentAdminUsername } from "../utils/session";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { can } from "../utils/adminUiConfig";

const PARTY_ROLES = ["FARMER", "TRADER", "ORG", "MANDI"];
const STATUS_OPTIONS = ["PENDING", "PAID", "PARTIAL", "CANCELLED"];

export const SettlementsPage: React.FC = () => {
  const { i18n } = useTranslation();
  const language = i18n.language || "en";
  const uiConfig = useAdminUiConfig();
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
      { field: "status", headerName: "Status", width: 120 },
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

  return (
    <PageContainer>
      <Stack spacing={2}>
        <Typography variant="h5">Settlements</Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1} flexWrap="wrap">
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
            label="Party Role"
            size="small"
            select
            value={filters.party_role}
            onChange={(event) => setFilters((prev) => ({ ...prev, party_role: event.target.value }))}
          >
            <MenuItem value="">Any</MenuItem>
            {PARTY_ROLES.map((role) => (
              <MenuItem key={role} value={role}>
                {role}
              </MenuItem>
            ))}
          </TextField>
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
          <Button variant="outlined" onClick={() => loadSettlements()}>
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

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} fullWidth maxWidth="lg">
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
                </Grid>
                <Grid item xs={12} md={4}>
                  <Typography variant="body2">Total: {detailData.header.total_amount}</Typography>
                  <Typography variant="body2">Paid: {detailData.header.paid_amount}</Typography>
                  <Typography variant="body2">Balance: {detailData.header.balance}</Typography>
                </Grid>
              </Grid>
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
