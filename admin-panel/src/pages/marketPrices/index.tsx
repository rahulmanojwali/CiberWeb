import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { type GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";

import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { getMandisForCurrentScope, fetchCommodityProducts } from "../../services/mandiApi";
import { fetchMarketPrices, generateMarketPriceSnapshots } from "../../services/marketPricesApi";

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

function currentUserCountry(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.country || parsed?.country_code || null;
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

function formatDate(value?: string | Date | null) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString();
}

type Option = { value: string; label: string };

type MarketRow = {
  id: string;
  snapshot_date?: string | null;
  commodity_product_id?: string | null;
  commodity_name?: string | null;
  avg_price?: number | null;
  min_price?: number | null;
  max_price?: number | null;
  trades_count?: number | null;
  total_qty_qtl?: number | null;
  raw?: any;
};

export const MarketPrices: React.FC = () => {
  const { i18n, t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();

  const canView = useMemo(() => can("market_prices.view", "VIEW"), [can]);
  const canGenerate = useMemo(() => can("market_prices.generate", "UPDATE"), [can]);

  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [commodityOptions, setCommodityOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<MarketRow[]>([]);

  const [filters, setFilters] = useState({
    mandi_id: "",
    from_date: todayLocal(),
    to_date: todayLocal(),
    commodity_product_id: "",
  });

  const [generateDate, setGenerateDate] = useState(todayLocal());
  const [generateLoading, setGenerateLoading] = useState(false);

  const columns = useMemo<GridColDef<MarketRow>[]>(
    () => [
      { field: "snapshot_date", headerName: "Date", width: 140, valueFormatter: (v) => formatDate(v) },
      { field: "commodity_name", headerName: "Commodity", width: 220 },
      { field: "commodity_product_id", headerName: "Product ID", width: 160 },
      { field: "avg_price", headerName: "Avg / Qtl", width: 140 },
      { field: "min_price", headerName: "Min / Qtl", width: 140 },
      { field: "max_price", headerName: "Max / Qtl", width: 140 },
      { field: "trades_count", headerName: "Trades", width: 120 },
      { field: "total_qty_qtl", headerName: "Total Qty (qtl)", width: 160 },
    ],
    [],
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
      const mapped = (list || []).map((m: any) => ({
        value: String(m.mandi_id ?? m.mandiId ?? ""),
        label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
      }));
      setMandiOptions(mapped);
      if (!filters.mandi_id && mapped.length === 1) {
        setFilters((prev) => ({ ...prev, mandi_id: mapped[0].value }));
      }
    } catch {
      setMandiOptions([]);
    }
  };

  const loadCommodityProducts = async () => {
    const username = currentUsername();
    if (!username) return;
    try {
      const resp = await fetchCommodityProducts({
        username,
        language,
        filters: { view: "IMPORTED", mandi_id: 0 },
      });
      const items = resp?.data?.items || resp?.response?.data?.items || resp?.data?.products || [];
      setCommodityOptions(
        (items || []).map((p: any) => ({
          value: String(p.product_id ?? p.product_code ?? p.commodity_product_id ?? p._id ?? ""),
          label: p.display_label || p.product_label || p.product_name || String(p.product_id || p._id || ""),
        })),
      );
    } catch {
      setCommodityOptions([]);
    }
  };

  const loadPrices = async () => {
    const username = currentUsername();
    const country = currentUserCountry();
    if (!username || !country || !canView) return;
    if (!filters.mandi_id || !filters.from_date || !filters.to_date) {
      enqueueSnackbar("Mandi and date range are required.", { variant: "warning" });
      return;
    }
    setLoading(true);
    try {
      const payload: Record<string, any> = {
        country,
        mandi_id: filters.mandi_id,
        from_date: filters.from_date,
        to_date: filters.to_date,
      };
      if (filters.commodity_product_id) payload.commodity_product_id = filters.commodity_product_id;

      const resp = await fetchMarketPrices({ username, language, filters: payload });
      const items = resp?.data?.items || resp?.response?.data?.items || [];
      const mapped: MarketRow[] = items.map((item: any, idx: number) => ({
        id: item._id || `${item.commodity_product_id || "item"}-${idx}`,
        snapshot_date: item.snapshot_date || null,
        commodity_product_id: item.commodity_product_id || null,
        commodity_name: item.commodity_name || "",
        avg_price: item.metrics?.avg_price_per_qtl ?? null,
        min_price: item.metrics?.min_price_per_qtl ?? null,
        max_price: item.metrics?.max_price_per_qtl ?? null,
        trades_count: item.metrics?.trades_count ?? null,
        total_qty_qtl: item.metrics?.total_qty_qtl ?? null,
        raw: item,
      }));
      setRows(mapped);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerate = async () => {
    const username = currentUsername();
    const country = currentUserCountry();
    if (!username || !country || !canGenerate) return;
    if (!filters.mandi_id || !generateDate) {
      enqueueSnackbar("Mandi and snapshot date are required.", { variant: "warning" });
      return;
    }
    setGenerateLoading(true);
    try {
      const payload: Record<string, any> = {
        country,
        org_id: uiConfig.scope?.org_id || "",
        mandi_id: filters.mandi_id,
        snapshot_date: generateDate,
      };
      if (filters.commodity_product_id) payload.commodity_product_id = filters.commodity_product_id;

      const resp = await generateMarketPriceSnapshots({ username, language, payload });
      const code = resp?.response?.responsecode || resp?.responsecode || "1";
      const desc = resp?.response?.description || resp?.description || "Failed to generate snapshots.";
      if (code !== "0") {
        enqueueSnackbar(desc, { variant: "error" });
        return;
      }
      enqueueSnackbar("Snapshots generated.", { variant: "success" });
      await loadPrices();
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Failed to generate snapshots.", { variant: "error" });
    } finally {
      setGenerateLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      loadMandis();
      loadCommodityProducts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  if (!canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view market prices.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">{t("menu.marketPrices", { defaultValue: "Market Prices" })}</Typography>
          <Typography variant="body2" color="text.secondary">
            Daily price snapshots by mandi and commodity.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadPrices} disabled={loading}>
            Refresh
          </Button>
          {canGenerate && (
            <Button variant="contained" onClick={handleGenerate} disabled={generateLoading}>
              Generate Snapshots
            </Button>
          )}
        </Stack>
      </Stack>

      <Box mb={2}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
          <TextField
            select
            label="Mandi"
            value={filters.mandi_id}
            onChange={(e) => setFilters((prev) => ({ ...prev, mandi_id: e.target.value }))}
            sx={{ minWidth: 180 }}
            required
          >
            <MenuItem value="">
              <em>Select</em>
            </MenuItem>
            {mandiOptions.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="From Date"
            type="date"
            value={filters.from_date}
            onChange={(e) => setFilters((prev) => ({ ...prev, from_date: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 170 }}
            required
          />
          <TextField
            label="To Date"
            type="date"
            value={filters.to_date}
            onChange={(e) => setFilters((prev) => ({ ...prev, to_date: e.target.value }))}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 170 }}
            required
          />
          <TextField
            select
            label="Commodity"
            value={filters.commodity_product_id}
            onChange={(e) => setFilters((prev) => ({ ...prev, commodity_product_id: e.target.value }))}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">
              <em>All</em>
            </MenuItem>
            {commodityOptions.map((c) => (
              <MenuItem key={c.value} value={c.value}>
                {c.label}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" onClick={loadPrices} disabled={loading}>
            Search
          </Button>
        </Stack>
      </Box>

      {canGenerate && (
        <Box mb={2}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
            <TextField
              label="Snapshot Date"
              type="date"
              value={generateDate}
              onChange={(e) => setGenerateDate(e.target.value)}
              InputLabelProps={{ shrink: true }}
              sx={{ minWidth: 170 }}
            />
            <Typography variant="body2" color="text.secondary">
              Generate for the selected mandi and optional commodity.
            </Typography>
          </Stack>
        </Box>
      )}

      <Box sx={{ width: "100%" }}>
        <ResponsiveDataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r.id}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
        />
      </Box>
    </PageContainer>
  );
};
