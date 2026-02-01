import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useNavigate } from "react-router-dom";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";

import { PageContainer } from "../../components/PageContainer";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import { fetchStallFeeReport } from "../../services/stallFeesApi";

type Option = { value: string; label: string };

type BreakdownRow = { label: string; total_count: number; total_amount: number };

type ReportState = {
  total_count: number;
  total_amount: number;
  breakdown: {
    payer_type: { payer_type: string | null; total_count: number; total_amount: number }[];
    method: { method: string | null; total_count: number; total_amount: number }[];
    status: { status: string | null; total_count: number; total_amount: number }[];
  };
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

function todayLocal(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatAmount(value?: number | null) {
  if (!value) return "0";
  return Number(value).toLocaleString();
}

export const StallFeeReport: React.FC = () => {
  const navigate = useNavigate();
  const { enqueueSnackbar } = useSnackbar();
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();

  const canView = useMemo(() => can("stall_fees.report", "VIEW"), [can]);

  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    from_date: todayLocal(),
    to_date: todayLocal(),
    mandi_id: "",
  });

  const [report, setReport] = useState<ReportState>({
    total_count: 0,
    total_amount: 0,
    breakdown: { payer_type: [], method: [], status: [] },
  });

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

  const loadReport = async () => {
    const username = currentUsername();
    if (!username || !canView) return;
    setLoading(true);
    try {
      const payload: Record<string, any> = {
        from_date: filters.from_date,
        to_date: filters.to_date,
        org_id: uiConfig.scope?.org_id || "",
      };
      if (filters.mandi_id) payload.mandi_id = filters.mandi_id;

      const resp = await fetchStallFeeReport({ username, language, filters: payload });
      const data = resp?.data || resp?.response?.data || {};
      setReport({
        total_count: data.total_count || 0,
        total_amount: data.total_amount || 0,
        breakdown: {
          payer_type: data.breakdown?.payer_type || [],
          method: data.breakdown?.method || [],
          status: data.breakdown?.status || [],
        },
      });
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Failed to load report.", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      loadMandis();
      loadReport();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  if (!canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view stall fee report.</Typography>
      </PageContainer>
    );
  }

  const payerRows: BreakdownRow[] = report.breakdown.payer_type.map((row) => ({
    label: row.payer_type || "Unknown",
    total_count: row.total_count,
    total_amount: row.total_amount,
  }));

  const methodRows: BreakdownRow[] = report.breakdown.method.map((row) => ({
    label: row.method || "Unknown",
    total_count: row.total_count,
    total_amount: row.total_amount,
  }));

  const statusRows: BreakdownRow[] = report.breakdown.status.map((row) => ({
    label: row.status || "Unknown",
    total_count: row.total_count,
    total_amount: row.total_amount,
  }));

  const renderTable = (title: string, rows: BreakdownRow[]) => (
    <Paper sx={{ p: 2, flex: 1, minWidth: 240 }}>
      <Typography variant="subtitle1" mb={1}>
        {title}
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>Label</TableCell>
            <TableCell align="right">Count</TableCell>
            <TableCell align="right">Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.length ? (
            rows.map((row, idx) => (
              <TableRow key={`${title}-${idx}`}>
                <TableCell>{row.label}</TableCell>
                <TableCell align="right">{row.total_count}</TableCell>
                <TableCell align="right">{formatAmount(row.total_amount)}</TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={3} align="center">
                No data
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Paper>
  );

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">Stall Fee Report</Typography>
          <Typography variant="body2" color="text.secondary">
            Summary totals by payer, payment method, and status.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<ArrowBackIosNewIcon />}
            onClick={() => navigate("/stall-fees")}
          >
            Back
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={loadReport}
            disabled={loading}
          >
            Refresh
          </Button>
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
          <Button variant="contained" onClick={loadReport} disabled={loading}>
            Run Report
          </Button>
        </Stack>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="subtitle1">Totals</Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={3} mt={1}>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Total Count
            </Typography>
            <Typography variant="h6">{report.total_count}</Typography>
          </Box>
          <Box>
            <Typography variant="body2" color="text.secondary">
              Total Amount
            </Typography>
            <Typography variant="h6">{formatAmount(report.total_amount)}</Typography>
          </Box>
        </Stack>
      </Paper>

      <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
        {renderTable("By Payer Type", payerRows)}
        {renderTable("By Method", methodRows)}
        {renderTable("By Status", statusRows)}
      </Stack>
    </PageContainer>
  );
};
