import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import { type GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { ScreenHelpDrawer } from "../../components/ScreenHelpDrawer";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { fetchMandis } from "../../services/mandiApi";
import { getAuctionResults, listAuctionResultsBySession } from "../../services/auctionOpsApi";
import { subscribeAuctionSession } from "../../services/socketClient";

type ResultRow = {
  id: string;
  result_id: string | null;
  session_id?: string | null;
  session_code?: string | null;
  lot_id?: string | null;
  lot_code?: string | null;
  org_id?: string | null;
  org_name?: string | null;
  mandi_id?: number | null;
  mandi_name?: string | null;
  commodity_id?: string | null;
  commodity_name?: string | null;
  product_id?: string | null;
  product_name?: string | null;
  winning_trader_username?: string | null;
  winning_trader_name?: string | null;
  result_status?: string | null;
  qty_kg?: number | null;
  qty_qtl?: number | null;
  opening_price_per_qtl?: number | null;
  opening_price_per_kg?: number | null;
  opening_amount_lot?: number | null;
  final_amount_lot?: number | null;
  final_price_per_qtl?: number | null;
  final_price_per_kg?: number | null;
  final_rate_qtl?: number | null;
  final_rate_kg?: number | null;
  gain_over_opening?: number | null;
  gain_over_opening_pct?: number | null;
  bid_audit_trail?: BidAuditRow[];
  total_bid_count?: number | null;
  auction_duration_seconds?: number | null;
  bid_intervals_seconds?: number[] | null;
  finalized_on?: string | null;
  closure_mode?: string | null;
  session_method?: string | null;
  session_status?: string | null;
  lot_current_status?: string | null;
  settlement_status?: string | null;
};

type BidAuditRow = {
  bid_id?: string | null;
  bidder_id?: string | null;
  bidder_name?: string | null;
  trader_username?: string | null;
  bid_amount?: number | null;
  bid_rate_qtl?: number | null;
  created_at?: string | null;
  lot_id?: string | null;
  session_id?: string | null;
  is_winning_bid?: boolean;
};

type Option = { value: string; label: string };

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

function toNumber(value: any): number | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "object" && value.$numberDecimal !== undefined) {
    const parsed = Number(value.$numberDecimal);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value?.toString === "function") {
    const parsed = Number(value.toString());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString();
}

function formatDateTimeWithSeconds(value?: string | Date | null) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(d);
}

function formatNumber(value: any, digits = 2) {
  const num = toNumber(value);
  if (num == null) return "—";
  return num.toLocaleString("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function formatCurrency(value: any) {
  const num = toNumber(value);
  if (num == null) return "—";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(num);
}

function formatSignedCurrency(value: any) {
  const num = toNumber(value);
  if (num == null) return "—";
  const absText = formatCurrency(Math.abs(num));
  if (absText === "—") return "—";
  if (num > 0) return `+${absText}`;
  if (num < 0) return `-${absText}`;
  return absText;
}

function normalizeStatus(value?: string | null) {
  const raw = String(value || "").trim().toUpperCase();
  if (!raw) return "PENDING";
  if (raw === "CONFIRMED") return "SOLD";
  if (raw === "CANCELLED") return "UNSOLD";
  return raw;
}

function statusChip(statusRaw?: string | null) {
  const status = normalizeStatus(statusRaw);
  if (status === "SOLD") return { label: "SOLD", color: "success" as const, variant: "filled" as const };
  if (status === "UNSOLD") return { label: "UNSOLD", color: "warning" as const, variant: "outlined" as const };
  if (status === "CANCELLED") return { label: "CANCELLED", color: "error" as const, variant: "outlined" as const };
  return { label: status, color: "default" as const, variant: "outlined" as const };
}

function display(value: any) {
  const text = String(value ?? "").trim();
  if (!text || text.toLowerCase() === "null" || text.toLowerCase() === "undefined") return "—";
  if (text === "[object Object]") return "—";
  return text;
}

export const AuctionResults: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const [filters, setFilters] = useState({
    org_code: "",
    mandi_code: "",
    commodity: "",
    product: "",
    session_id: "",
    lot_id: "",
    result_status: "",
    date_from: "",
    date_to: "",
  });
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [orgOptions, setOrgOptions] = useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<ResultRow | null>(null);
  const [openHelp, setOpenHelp] = useState(false);

  const canMenu = useMemo(
    () => can(uiConfig.resources, "auction_results.menu", "VIEW") || can(uiConfig.resources, "auction_results.view", "VIEW"),
    [uiConfig.resources],
  );
  const canView = useMemo(() => can(uiConfig.resources, "auction_results.view", "VIEW"), [uiConfig.resources]);

  const columns = useMemo<GridColDef<ResultRow>[]>(
    () => [
      { field: "session_code", headerName: "Session", width: 160, valueGetter: (_v, row) => display(row.session_code || row.session_id) },
      { field: "lot_code", headerName: "Lot", width: 150, valueGetter: (_v, row) => display(row.lot_code || row.lot_id) },
      {
        field: "result_status",
        headerName: "Result",
        width: 130,
        renderCell: (params) => {
          const chip = statusChip(params.row.result_status);
          return <Chip size="small" label={chip.label} color={chip.color} variant={chip.variant} />;
        },
      },
      { field: "product_name", headerName: "Product", width: 150, valueGetter: (_v, row) => display(row.product_name || row.commodity_name || row.product_id || row.commodity_id) },
      {
        field: "winning_trader",
        headerName: "Winning Trader",
        width: 210,
        valueGetter: (_v, row) => display(row.winning_trader_name || row.winning_trader_username),
      },
      {
        field: "final_amount_lot",
        headerName: "Final Amount (Lot)",
        width: 190,
        valueGetter: (_v, row) => formatCurrency(row.final_amount_lot),
      },
      { field: "qty_kg", headerName: "Qty (kg)", width: 130, valueGetter: (_v, row) => formatNumber(row.qty_kg) },
      { field: "qty_qtl", headerName: "Qty (qtl)", width: 130, valueGetter: (_v, row) => formatNumber(row.qty_qtl, 4) },
      {
        field: "final_rate_qtl",
        headerName: "Final Rate (/qtl)",
        width: 150,
        valueGetter: (_v, row) => formatCurrency(row.final_rate_qtl),
      },
      {
        field: "final_rate_kg",
        headerName: "Final Rate (/kg)",
        width: 140,
        valueGetter: (_v, row) => formatCurrency(row.final_rate_kg),
      },
      { field: "finalized_on", headerName: "Finalized On", width: 190, valueGetter: (_v, row) => formatDate(row.finalized_on) },
      { field: "org_name", headerName: "Organisation", width: 170, valueGetter: (_v, row) => display(row.org_name || row.org_id) },
      { field: "mandi_name", headerName: "Mandi", width: 150, valueGetter: (_v, row) => display(row.mandi_name || row.mandi_id) },
      { field: "commodity_name", headerName: "Commodity", width: 150, valueGetter: (_v, row) => display(row.commodity_name || row.commodity_id) },
      { field: "result_id", headerName: "Result ID", width: 210, valueGetter: (_v, row) => display(row.result_id) },
    ],
    [],
  );

  const loadOrganisations = async () => {
    if (uiConfig.role !== "SUPER_ADMIN") return;
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchOrganisations({ username, language });
    const list = resp?.data?.organisations || resp?.response?.data?.organisations || [];
    setOrgOptions(
      list.map((org: any) => ({
        value: org.org_code || org._id || "",
        label: org.org_name ? `${org.org_name} (${org.org_code || org._id})` : org.org_code || org._id,
      })),
    );
  };

  const loadMandis = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchMandis({ username, language, filters: { is_active: true } });
    const list = resp?.data?.mandis || resp?.response?.data?.mandis || [];
    setMandiOptions(
      list.map((m: any) => ({
        value: m.mandi_slug || m.slug || String(m.mandi_id || ""),
        label: m?.name_i18n?.en || m.mandi_slug || String(m.mandi_id),
      })),
    );
  };

  const loadData = async () => {
    const username = currentUsername();
    if (!username || !canView) return;
    setLoading(true);
    setError(null);
    try {
      const statusFilter = normalizeStatus(filters.result_status || undefined);
      const backendStatusFilter =
        statusFilter === "SOLD" ? "SOLD"
        : statusFilter === "UNSOLD" ? "UNSOLD"
        : (filters.result_status || undefined);

      const response = filters.session_id
        ? await listAuctionResultsBySession({
            username,
            language,
            payload: {
              org_id: uiConfig.scope?.org_id || undefined,
              mandi_id: filters.mandi_code || undefined,
              session_id: filters.session_id,
              status: backendStatusFilter,
              page_size: 100,
            },
          })
        : await getAuctionResults({
            username,
            language,
            filters: {
              org_code: filters.org_code || undefined,
              mandi_code: filters.mandi_code || undefined,
              commodity: filters.commodity || undefined,
              product: filters.product || undefined,
              session_id: filters.session_id || undefined,
              lot_id: filters.lot_id || undefined,
              result_status: backendStatusFilter,
              date_from: filters.date_from || undefined,
              date_to: filters.date_to || undefined,
              page_size: 100,
            },
          });

      const list = response?.data?.items || response?.response?.data?.items || [];
      const mapped: ResultRow[] = list.map((item: any, idx: number) => ({
        id: String(item.result_id || item._id || `result-${idx}`),
        result_id: item.result_id ? String(item.result_id) : (item._id ? String(item._id) : null),
        session_id: item.session_id ? String(item.session_id) : null,
        session_code: item.session_code || null,
        lot_id: item.lot_id ? String(item.lot_id) : null,
        lot_code: item.lot_code || null,
        org_id: item.org_id ? String(item.org_id) : null,
        org_name: item.org_name || null,
        mandi_id: toNumber(item.mandi_id),
        mandi_name: item.mandi_name || null,
        commodity_id: item.commodity_id ? String(item.commodity_id) : null,
        commodity_name: item.commodity_name || null,
        product_id: item.product_id ? String(item.product_id) : null,
        product_name: item.product_name || null,
        winning_trader_username: item.winning_trader_username || null,
        winning_trader_name: item.winning_trader_name || null,
        result_status: normalizeStatus(item.result_status || item.status),
        qty_kg: toNumber(item.qty_kg),
        qty_qtl: toNumber(item.qty_qtl),
        opening_price_per_qtl: toNumber(item.opening_price_per_qtl),
        opening_price_per_kg: toNumber(item.opening_price_per_kg),
        opening_amount_lot: toNumber(item.opening_amount_lot),
        final_amount_lot: toNumber(item.final_amount_lot),
        final_price_per_qtl: toNumber(item.final_price_per_qtl),
        final_price_per_kg: toNumber(item.final_price_per_kg),
        final_rate_qtl: toNumber(item.final_price_per_qtl ?? item.final_rate_qtl),
        final_rate_kg: toNumber(item.final_price_per_kg ?? item.final_rate_kg),
        gain_over_opening: toNumber(item.gain_over_opening),
        gain_over_opening_pct: toNumber(item.gain_over_opening_pct),
        bid_audit_trail: Array.isArray(item.bid_audit_trail)
          ? item.bid_audit_trail.map((bid: any) => ({
              bid_id: bid?.bid_id ? String(bid.bid_id) : null,
              bidder_id: bid?.bidder_id ? String(bid.bidder_id) : null,
              bidder_name: bid?.bidder_name || null,
              trader_username: bid?.trader_username || null,
              bid_amount: toNumber(bid?.bid_amount),
              bid_rate_qtl: toNumber(bid?.bid_rate_qtl),
              created_at: bid?.created_at || null,
              lot_id: bid?.lot_id ? String(bid.lot_id) : null,
              session_id: bid?.session_id ? String(bid.session_id) : null,
              is_winning_bid: Boolean(bid?.is_winning_bid),
            }))
          : [],
        total_bid_count: toNumber(item.total_bid_count),
        auction_duration_seconds: toNumber(item.auction_duration_seconds),
        bid_intervals_seconds: Array.isArray(item.bid_intervals_seconds)
          ? item.bid_intervals_seconds.map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v))
          : [],
        finalized_on: item.finalized_on || null,
        closure_mode: item.closure_mode || null,
        session_method: item.session_method || null,
        session_status: item.session_status || null,
        lot_current_status: item.lot_current_status || null,
        settlement_status: item.settlement_status || null,
      }));

      setRows(mapped);
      setSelectedRow((prev) => mapped.find((row) => row.id === prev?.id) || null);
    } catch (err: any) {
      setError(err?.message || "Failed to load auction results.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganisations();
    loadMandis();
  }, [language, uiConfig.role]);

  useEffect(() => {
    loadData();
  }, [
    filters.org_code,
    filters.mandi_code,
    filters.commodity,
    filters.product,
    filters.session_id,
    filters.lot_id,
    filters.result_status,
    filters.date_from,
    filters.date_to,
    language,
    canView,
  ]);

  useEffect(() => {
    if (!canView || !filters.session_id) return;
    let unsubscribe: null | (() => void) = null;
    const reload = (payload: any) => {
      if (!payload?.session_id || String(payload.session_id) !== String(filters.session_id)) return;
      void loadData();
    };

    subscribeAuctionSession(
      { sessionId: filters.session_id, mandiId: filters.mandi_code || undefined },
      {
        "auction.result.finalized": reload,
        "auction.session.updated": reload,
        "auction.lot.updated": reload,
      },
    )
      .then((cleanup) => {
        unsubscribe = cleanup;
      })
      .catch((err) => {
        if (import.meta.env.DEV) console.debug("[auctionResults] realtime subscribe failed", err);
      });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [canView, filters.session_id, filters.mandi_code]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilters = () => {
    setFilters({
      org_code: "",
      mandi_code: "",
      commodity: "",
      product: "",
      session_id: "",
      lot_id: "",
      result_status: "",
      date_from: "",
      date_to: "",
    });
  };

  if (!canMenu || !canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view auction results.</Typography>
      </PageContainer>
    );
  }

  const selectedChip = statusChip(selectedRow?.result_status);
  const gainPctText = toNumber(selectedRow?.gain_over_opening_pct) != null ? `${formatNumber(selectedRow?.gain_over_opening_pct)}%` : "—";
  const gainValue = toNumber(selectedRow?.gain_over_opening);
  const gainColor = gainValue == null ? "text.secondary" : gainValue > 0 ? "success.main" : gainValue < 0 ? "error.main" : "text.primary";
  const selectedBidTrail = Array.isArray(selectedRow?.bid_audit_trail) ? selectedRow.bid_audit_trail : [];
  const selectedBidCount = toNumber(selectedRow?.total_bid_count) ?? selectedBidTrail.length;
  const auctionDurationText = toNumber(selectedRow?.auction_duration_seconds) != null
    ? `${formatNumber(selectedRow?.auction_duration_seconds, 0)} sec`
    : "—";
  const avgGapText = Array.isArray(selectedRow?.bid_intervals_seconds) && selectedRow.bid_intervals_seconds.length > 0
    ? `${formatNumber(
        selectedRow.bid_intervals_seconds.reduce((acc, n) => acc + n, 0) / selectedRow.bid_intervals_seconds.length,
        1,
      )} sec`
    : "—";

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">{t("menu.auctionResults", { defaultValue: "Auction Results" })}</Typography>
          <Typography variant="body2" color="text.secondary">
            Post-auction outcomes with lot/session context, pricing, and winner details.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <IconButton color="primary" onClick={() => setOpenHelp(true)} title="Help">
            <HelpOutlineIcon />
          </IconButton>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1} mb={2}>
          <Typography variant="subtitle2" color="text.secondary">
            Filter Auction Results
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="text" onClick={clearFilters}>Clear</Button>
            <Button size="small" variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading}>
              Apply / Refresh
            </Button>
          </Stack>
        </Stack>

        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(180px, 1fr))", lg: "repeat(4, minmax(180px, 1fr))" },
            gap: 1.5,
          }}
        >
          {uiConfig.role === "SUPER_ADMIN" && (
            <TextField select label="Organisation" size="small" value={filters.org_code} onChange={(e) => updateFilter("org_code", e.target.value)} fullWidth>
              <MenuItem value="">All</MenuItem>
              {orgOptions.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </TextField>
          )}

          <TextField select label="Mandi" size="small" value={filters.mandi_code} onChange={(e) => updateFilter("mandi_code", e.target.value)} fullWidth>
            <MenuItem value="">All</MenuItem>
            {mandiOptions.map((m) => (
              <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
            ))}
          </TextField>

          <TextField label="Session ID" size="small" value={filters.session_id} onChange={(e) => updateFilter("session_id", e.target.value)} fullWidth />
          <TextField label="Lot ID / Lot Code" size="small" value={filters.lot_id} onChange={(e) => updateFilter("lot_id", e.target.value)} fullWidth />
          <TextField label="Commodity" size="small" value={filters.commodity} onChange={(e) => updateFilter("commodity", e.target.value)} fullWidth />
          <TextField label="Product" size="small" value={filters.product} onChange={(e) => updateFilter("product", e.target.value)} fullWidth />

          <TextField select label="Result Status" size="small" value={filters.result_status} onChange={(e) => updateFilter("result_status", e.target.value)} fullWidth>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="SOLD">Sold</MenuItem>
            <MenuItem value="UNSOLD">Unsold</MenuItem>
            <MenuItem value="PENDING">Pending</MenuItem>
            <MenuItem value="CANCELLED">Cancelled</MenuItem>
          </TextField>

          <TextField label="Date From" type="date" size="small" value={filters.date_from} onChange={(e) => updateFilter("date_from", e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
          <TextField label="Date To" type="date" size="small" value={filters.date_to} onChange={(e) => updateFilter("date_to", e.target.value)} InputLabelProps={{ shrink: true }} fullWidth />
        </Box>
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: "hidden" }}>
        {loading && <LinearProgress />}
        <Box sx={{ p: 1.5, pb: 0 }}>
          <Typography variant="subtitle2" color="text.secondary">Auction Results List</Typography>
        </Box>
        <Box sx={{ px: 1.5, pb: 1.5 }}>
          <ResponsiveDataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            getRowId={(r) => r.id}
            disableRowSelectionOnClick
            pageSizeOptions={[25, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
            minWidth={1350}
            onRowClick={(params) => setSelectedRow(params.row as ResultRow)}
            sx={{
              "& .MuiDataGrid-row": { cursor: "pointer" },
              "& .MuiDataGrid-row:hover": { backgroundColor: "rgba(47,166,82,0.05)" },
              "& .MuiDataGrid-columnHeaders": { position: "sticky", top: 0, zIndex: 1 },
              "& .MuiDataGrid-cell": { display: "flex", alignItems: "center" },
            }}
          />
        </Box>
      </Paper>

      {!loading && rows.length === 0 && (
        <Paper variant="outlined" sx={{ mt: 2, p: 2, borderRadius: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
            No auction results found for the selected filters.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Try changing mandi/session/date filters or finalize an auction lot first.
          </Typography>
        </Paper>
      )}

      <Dialog open={Boolean(selectedRow)} onClose={() => setSelectedRow(null)} fullWidth maxWidth="md">
        <DialogTitle>
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
            <Typography variant="h6">Auction Result Detail</Typography>
            <Chip size="small" label={selectedChip.label} color={selectedChip.color} variant={selectedChip.variant} />
          </Stack>
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5, bgcolor: "rgba(47,166,82,0.03)" }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Outcome Snapshot</Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" }, gap: 1 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Result Status</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{display(selectedRow?.result_status)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Opening Amount</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatCurrency(selectedRow?.opening_amount_lot)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Final Amount</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{formatCurrency(selectedRow?.final_amount_lot)}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Gain/Loss</Typography>
                  <Typography variant="body2" sx={{ fontWeight: 700, color: gainColor }}>{formatSignedCurrency(selectedRow?.gain_over_opening)}</Typography>
                </Box>
              </Box>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Section A — Result Summary</Typography>
              <Typography variant="body2"><strong>Result ID:</strong> {display(selectedRow?.result_id)}</Typography>
              <Typography variant="body2"><strong>Result Status:</strong> {display(selectedRow?.result_status)}</Typography>
              <Typography variant="body2"><strong>Finalized On:</strong> {formatDate(selectedRow?.finalized_on)}</Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Section B — Session / Lot</Typography>
              <Typography variant="body2"><strong>Session Code:</strong> {display(selectedRow?.session_code || selectedRow?.session_id)}</Typography>
              <Typography variant="body2"><strong>Lot Code:</strong> {display(selectedRow?.lot_code || selectedRow?.lot_id)}</Typography>
              <Typography variant="body2"><strong>Method:</strong> {display(selectedRow?.session_method)}</Typography>
              <Typography variant="body2"><strong>Session Status:</strong> {display(selectedRow?.session_status)}</Typography>
              <Typography variant="body2"><strong>Mandi:</strong> {display(selectedRow?.mandi_name || selectedRow?.mandi_id)}</Typography>
              <Typography variant="body2"><strong>Organisation:</strong> {display(selectedRow?.org_name || selectedRow?.org_id)}</Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Section C — Commodity / Quantity</Typography>
              <Typography variant="body2"><strong>Commodity:</strong> {display(selectedRow?.commodity_name || selectedRow?.commodity_id)}</Typography>
              <Typography variant="body2"><strong>Product:</strong> {display(selectedRow?.product_name || selectedRow?.product_id)}</Typography>
              <Typography variant="body2"><strong>Qty (kg):</strong> {formatNumber(selectedRow?.qty_kg)}</Typography>
              <Typography variant="body2"><strong>Qty (qtl):</strong> {formatNumber(selectedRow?.qty_qtl, 4)}</Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Section D — Price / Outcome</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.4 }}>Opening</Typography>
              <Typography variant="body2"><strong>Opening Rate (/qtl):</strong> {formatCurrency(selectedRow?.opening_price_per_qtl)}</Typography>
              <Typography variant="body2"><strong>Opening Rate (/kg):</strong> {formatCurrency(selectedRow?.opening_price_per_kg)}</Typography>
              <Typography variant="body2"><strong>Opening Amount (Lot):</strong> {formatCurrency(selectedRow?.opening_amount_lot)}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, mt: 1.2, mb: 0.4 }}>Final</Typography>
              <Typography variant="body2"><strong>Final Rate (/qtl):</strong> {formatCurrency(selectedRow?.final_rate_qtl)}</Typography>
              <Typography variant="body2"><strong>Final Rate (/kg):</strong> {formatCurrency(selectedRow?.final_rate_kg)}</Typography>
              <Typography variant="body2"><strong>Final Amount (Lot):</strong> {formatCurrency(selectedRow?.final_amount_lot)}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, mt: 1.2, mb: 0.4 }}>Comparison</Typography>
              <Typography variant="body2"><strong>Gain Over Opening:</strong> <Box component="span" sx={{ color: gainColor, fontWeight: 700 }}>{formatSignedCurrency(selectedRow?.gain_over_opening)}</Box></Typography>
              <Typography variant="body2"><strong>Improvement (%):</strong> {gainPctText}</Typography>
              <Typography variant="body2"><strong>Winning Trader:</strong> {display(selectedRow?.winning_trader_name)}</Typography>
              <Typography variant="body2"><strong>Winning Trader Username:</strong> {display(selectedRow?.winning_trader_username)}</Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Section E — Lifecycle / Follow-up</Typography>
              <Typography variant="body2"><strong>Settlement Status:</strong> {display(selectedRow?.settlement_status)}</Typography>
              <Typography variant="body2"><strong>Lot Current Status:</strong> {display(selectedRow?.lot_current_status)}</Typography>
              <Typography variant="body2"><strong>Closure Mode:</strong> {display(selectedRow?.closure_mode)}</Typography>
            </Paper>

            <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 1.5 }}>
              <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                <Typography variant="subtitle2">Section F — Bidding Audit Trail</Typography>
                <Typography variant="caption" color="text.secondary">
                  Total Bids: {formatNumber(selectedBidCount, 0)} | Duration: {auctionDurationText} | Avg Gap: {avgGapText}
                </Typography>
              </Stack>
              <TableContainer sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1.25 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Bidder</TableCell>
                      <TableCell>Trader Username</TableCell>
                      <TableCell align="right">Bid Amount</TableCell>
                      <TableCell align="right">Bid Rate (/qtl)</TableCell>
                      <TableCell>Timestamp</TableCell>
                      <TableCell>Winner</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedBidTrail.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} sx={{ color: "text.secondary" }}>
                          No bids recorded for this lot.
                        </TableCell>
                      </TableRow>
                    ) : (
                      selectedBidTrail.map((bid, index) => (
                        <TableRow
                          key={bid.bid_id || `${bid.created_at || "na"}-${index}`}
                          sx={bid.is_winning_bid ? { bgcolor: "rgba(47,166,82,0.08)" } : undefined}
                        >
                          <TableCell>{display(bid.bidder_name)}</TableCell>
                          <TableCell>{display(bid.trader_username)}</TableCell>
                          <TableCell align="right">{formatCurrency(bid.bid_amount)}</TableCell>
                          <TableCell align="right">{formatCurrency(bid.bid_rate_qtl)}</TableCell>
                          <TableCell>{formatDateTimeWithSeconds(bid.created_at)}</TableCell>
                          <TableCell>
                            {bid.is_winning_bid ? (
                              <Chip size="small" color="success" label="WINNING BID" />
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Paper>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedRow(null)}>Close</Button>
        </DialogActions>
      </Dialog>
      <ScreenHelpDrawer
        open={openHelp}
        onClose={() => setOpenHelp(false)}
        route="/auction-results"
        language={language}
      />
    </PageContainer>
  );
};
