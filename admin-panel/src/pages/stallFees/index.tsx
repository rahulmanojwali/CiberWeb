import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { type GridColDef } from "@mui/x-data-grid";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import { fetchStallFees, refundStallFee } from "../../services/stallFeesApi";
import { useTranslation } from "react-i18next";

const STATUS_OPTIONS = [
  { value: "", label: "All" },
  { value: "PAID", label: "PAID" },
  { value: "UNPAID", label: "UNPAID" },
  { value: "REFUNDED", label: "REFUNDED" },
  { value: "CANCELLED", label: "CANCELLED" },
];

const PAYER_TYPES = [
  { value: "", label: "All" },
  { value: "FARMER", label: "FARMER" },
  { value: "TRADER", label: "TRADER" },
  { value: "VENDOR", label: "VENDOR" },
];

type Option = { value: string; label: string };

type StallRow = {
  id: string;
  market_date?: string | null;
  payer?: string | null;
  amount?: number | null;
  method?: string | null;
  status?: string | null;
  created_on?: string | null;
  raw?: any;
};

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

function formatDate(value?: string | Date | null) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function toYmd(value?: string | Date | null) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export const StallFees: React.FC = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();

  const [rows, setRows] = useState<StallRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);

  const [filters, setFilters] = useState({
    from_date: "",
    to_date: "",
    mandi_id: "",
    status: "",
    payer_type: "",
    payer_mobile: "",
  });
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });

  const [refundOpen, setRefundOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refundTarget, setRefundTarget] = useState<any | null>(null);

  const canView = useMemo(() => can("stall_fees.list", "VIEW"), [can]);
  const canRefund = useMemo(() => can("stall_fees.refund", "UPDATE"), [can]);
  const canCollect = useMemo(() => can("stall_fees.collect", "CREATE"), [can]);

  const columns = useMemo<GridColDef<StallRow>[]>(
    () => [
      { field: "id", headerName: "Receipt ID", width: 200 },
      {
        field: "market_date",
        headerName: "Market Date",
        width: 140,
        valueFormatter: (value) => toYmd(value),
      },
      { field: "payer", headerName: "Payer", width: 220 },
      { field: "amount", headerName: "Amount", width: 120 },
      { field: "method", headerName: "Method", width: 120 },
      {
        field: "status",
        headerName: "Status",
        width: 140,
        renderCell: (params) => <Chip size="small" label={params.value || "-"} />,
      },
      {
        field: "created_on",
        headerName: "Created On",
        width: 180,
        valueFormatter: (value) => formatDate(value),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 160,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            <Button size="small" onClick={() => navigate("/stall-fees/report")}>View</Button>
            {canRefund && params.row.status === "PAID" && (
              <Button
                size="small"
                color="error"
                onClick={() => {
                  setRefundTarget(params.row.raw);
                  setRefundReason("");
                  setRefundOpen(true);
                }}
              >
                Refund
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [canRefund, navigate],
  );

  const loadMandis = async () => {
    const username = currentUsername();
    const orgId = uiConfig.scope?.org_id || "";
    if (!username || !orgId) return;
    try {
      const list = await getMandisForCurrentScope({
        username,
        language,
        org_id: orgId,
      });
      setMandiOptions(
        (list || []).map((m: any) => ({
          value: String(m.mandi_id ?? m.mandiId ?? ""),
          label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
        })),
      );
    } catch {
      setMandiOptions([]);
    }
  };

  const loadFees = async () => {
    const username = currentUsername();
    if (!username || !canView) return;
    setLoading(true);
    try {
      const orgId = uiConfig.scope?.org_id || "";
      const payload: Record<string, any> = {
        page: pagination.page + 1,
        limit: pagination.pageSize,
      };
      if (filters.from_date) payload.from_date = filters.from_date;
      if (filters.to_date) payload.to_date = filters.to_date;
      if (filters.mandi_id) payload.mandi_id = filters.mandi_id;
      if (filters.status) payload.status = filters.status;
      if (filters.payer_type) payload.payer_type = filters.payer_type;
      if (filters.payer_mobile) payload.payer_mobile = filters.payer_mobile;
      if (orgId) payload.org_id = orgId;

      const resp = await fetchStallFees({ username, language, filters: payload });
      const items = resp?.data?.items || resp?.response?.data?.items || [];
      const total = resp?.data?.total_records ?? resp?.response?.data?.total_records ?? items.length;

      const mapped: StallRow[] = items.map((item: any, idx: number) => {
        const payer = item.payer || {};
        const payerLabel = `${payer.payer_type || ""} ${payer.name || ""} ${payer.mobile ? `(${payer.mobile})` : ""}`.trim();
        return {
          id: String(item._id || idx),
          market_date: item.market_date || null,
          payer: payerLabel || "-",
          amount: item.amount ?? null,
          method: item.payment?.method || "-",
          status: item.status || "-",
          created_on: item.created_on || null,
          raw: item,
        };
      });

      setRows(mapped);
      setTotalCount(Number(total) || 0);
    } finally {
      setLoading(false);
    }
  };

  const handleRefund = async () => {
    const username = currentUsername();
    if (!username || !refundTarget) return;
    if (!refundReason.trim()) {
      enqueueSnackbar("Refund reason required.", { variant: "warning" });
      return;
    }
    try {
      const resp = await refundStallFee({
        username,
        language,
        payload: {
          receipt_id: refundTarget._id,
          reason: refundReason.trim(),
          org_id: uiConfig.scope?.org_id || "",
          mandi_id: refundTarget.mandi_id,
        },
      });
      const code = resp?.response?.responsecode || resp?.responsecode || "1";
      const desc = resp?.response?.description || resp?.description || "Refund failed.";
      if (code !== "0") {
        enqueueSnackbar(desc, { variant: "error" });
        return;
      }
      enqueueSnackbar("Refund processed.", { variant: "success" });
      setRefundOpen(false);
      await loadFees();
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Refund failed.", { variant: "error" });
    }
  };

  useEffect(() => {
    if (canView) {
      loadMandis();
      loadFees();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  useEffect(() => {
    loadFees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.pageSize]);

  if (!canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view stall fees.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">Stall Fees</Typography>
          <Typography variant="body2" color="text.secondary">
            Collect and review stall fee receipts.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadFees} disabled={loading}>
            Refresh
          </Button>
          {canCollect && (
            <Button variant="contained" onClick={() => navigate("/stall-fees/collect")}>
              Collect Fee
            </Button>
          )}
          <Button variant="outlined" onClick={() => navigate("/stall-fees/report")}>Report</Button>
        </Stack>
      </Stack>

      <Box mb={2}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
          <TextField
            label="From Date"
            type="date"
            value={filters.from_date}
            onChange={(e) => setFilters((prev) => ({ ...prev, from_date: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 170 }}
          />
          <TextField
            label="To Date"
            type="date"
            value={filters.to_date}
            onChange={(e) => setFilters((prev) => ({ ...prev, to_date: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 170 }}
          />
          <TextField
            select
            label="Mandi"
            value={filters.mandi_id}
            onChange={(e) => setFilters((prev) => ({ ...prev, mandi_id: e.target.value }))}
            sx={{ minWidth: 180 }}
          >
            <MenuItem value="">
              <em>All</em>
            </MenuItem>
            {mandiOptions.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Status"
            value={filters.status}
            onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))}
            sx={{ minWidth: 140 }}
          >
            {STATUS_OPTIONS.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {s.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Payer Type"
            value={filters.payer_type}
            onChange={(e) => setFilters((prev) => ({ ...prev, payer_type: e.target.value }))}
            sx={{ minWidth: 160 }}
          >
            {PAYER_TYPES.map((p) => (
              <MenuItem key={p.value} value={p.value}>
                {p.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Mobile"
            value={filters.payer_mobile}
            onChange={(e) => setFilters((prev) => ({ ...prev, payer_mobile: e.target.value }))}
            sx={{ minWidth: 160 }}
          />
          <Button variant="contained" onClick={loadFees}>Search</Button>
        </Stack>
      </Box>

      <Box sx={{ width: "100%" }}>
        <ResponsiveDataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r.id}
          disableRowSelectionOnClick
          paginationMode="server"
          rowCount={totalCount}
          paginationModel={pagination}
          onPaginationModelChange={(model) => setPagination(model)}
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </Box>

      <Dialog open={refundOpen} onClose={() => setRefundOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Refund Stall Fee</DialogTitle>
        <DialogContent>
          <TextField
            label="Reason"
            value={refundReason}
            onChange={(e) => setRefundReason(e.target.value)}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRefundOpen(false)}>Close</Button>
          <Button variant="contained" color="error" onClick={handleRefund}>Refund</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
