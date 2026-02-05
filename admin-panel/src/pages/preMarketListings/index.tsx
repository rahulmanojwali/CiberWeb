import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  MenuItem,
  Stack,
  TextField,
  Typography,
  Chip,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import { type GridColDef } from "@mui/x-data-grid";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import { fetchPreMarketListings } from "../../services/preMarketListingsApi";

type ListingRow = {
  id: string;
  listing_id: string;
  market_date?: string | null;
  farmer_name?: string | null;
  farmer_mobile?: string | null;
  commodity?: string | null;
  bags?: number | null;
  weight_per_bag?: number | null;
  status?: string | null;
  created_on?: string | null;
  raw?: any;
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

function formatDate(value?: string | Date | null) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

function todayLocal(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function oidToString(value: any): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (value.$oid) return String(value.$oid);
  try {
    return String(value.toString());
  } catch {
    return "";
  }
}

export const PreMarketListings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const navigate = useNavigate();
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();

  const [rows, setRows] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [commodityOptions, setCommodityOptions] = useState<Option[]>([]);

  const [filters, setFilters] = useState({
    market_date: todayLocal(),
    mandi_id: "",
    status: "",
    farmer_mobile: "",
    commodity_product_id: "",
  });

  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });

  const canView = useMemo(
    () => can("pre_market_listings.list", "VIEW"),
    [can],
  );
  const canCreate = useMemo(
    () => can("pre_market_listings.create", "CREATE"),
    [can],
  );

  const statusOptions = [
    { value: "", label: "All" },
    { value: "PRE_LISTED", label: "PRE_LISTED" },
    { value: "ARRIVED", label: "ARRIVED" },
    { value: "LOT_CREATED", label: "LOT_CREATED" },
    { value: "SOLD", label: "SOLD" },
    { value: "UNSOLD", label: "UNSOLD" },
    { value: "CANCELLED", label: "CANCELLED" },
  ];

  const columns = useMemo<GridColDef<ListingRow>[]>(
    () => [
      { field: "listing_id", headerName: "Listing ID", width: 200 },
      { field: "market_date", headerName: "Market Date", width: 140 },
      { field: "farmer_name", headerName: "Farmer", width: 200 },
      { field: "farmer_mobile", headerName: "Mobile", width: 140 },
      { field: "commodity", headerName: "Commodity", width: 180 },
      { field: "bags", headerName: "Bags", width: 110 },
      { field: "weight_per_bag", headerName: "Weight/Bag", width: 130 },
      {
        field: "status",
        headerName: "Status",
        width: 140,
        renderCell: (params) => (
          <Chip size="small" label={params.value || "-"} />
        ),
      },
      {
        field: "created_on",
        headerName: "Created On",
        width: 190,
        valueFormatter: (value) => formatDate(value),
      },
      {
        field: "actions",
        headerName: "Actions",
        sortable: false,
        filterable: false,
        width: 140,
        renderCell: (params) => (
          <Button
            size="small"
            startIcon={<VisibilityOutlinedIcon fontSize="small" />}
            onClick={() => navigate(`/pre-market-listings/${encodeURIComponent(params.row.listing_id)}`)}
          >
            View
          </Button>
        ),
      },
    ],
    [navigate],
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

  const loadListings = async () => {
    const username = currentUsername();
    if (!username || !canView) return;
    if (!filters.market_date) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const orgId = uiConfig.scope?.org_id || "";
      const payload: Record<string, any> = {
        market_date: filters.market_date,
        page: pagination.page + 1,
        limit: pagination.pageSize,
      };
      if (filters.mandi_id) payload.mandi_id = filters.mandi_id;
      if (filters.status) payload.status = filters.status;
      if (filters.farmer_mobile) payload.farmer_mobile = filters.farmer_mobile;
      if (filters.commodity_product_id) payload.commodity_product_id = filters.commodity_product_id;
      if (orgId) payload.org_id = orgId;

      const resp = await fetchPreMarketListings({
        username,
        language,
        filters: payload,
      });
      const items = resp?.data?.items || resp?.response?.data?.items || [];
      const total = resp?.data?.total_records ?? resp?.response?.data?.total_records ?? items.length;
      const mapped: ListingRow[] = items.map((item: any, idx: number) => {
        const listingId = item.listing_id || item._id || item.id || `${idx}`;
        const farmer = item.farmer || {};
        const produce = item.produce || {};
        return {
          id: oidToString(listingId) || `${idx}`,
          listing_id: oidToString(listingId) || `${idx}`,
          market_date: item?.market_day?.date || item.market_date || null,
          farmer_name: farmer.name || farmer.full_name || farmer.display_name || farmer.farmer_name || null,
          farmer_mobile: farmer.mobile || farmer.phone || farmer.username || null,
          commodity: produce.commodity_product_name || produce.commodity_name || produce.product_name || produce.name || null,
          bags: produce.quantity?.bags ?? produce.bags ?? produce.bags_count ?? item.bags ?? null,
          weight_per_bag:
            produce.quantity?.weight_per_bag_kg ?? produce.weight_per_bag ?? item.weight_per_bag ?? null,
          status: item.status || null,
          created_on: item.created_on || null,
          raw: item,
        };
      });
      setRows(mapped);
      const uniqMap = new Map<string, Option>();
      items.forEach((item: any) => {
        const produce = item.produce || {};
        const pid = String(produce.commodity_product_id || "");
        if (!pid) return;
        if (!uniqMap.has(pid)) {
          const label =
            produce.commodity_product_name ||
            produce.commodity_name ||
            produce.product_name ||
            produce.name ||
            pid;
          uniqMap.set(pid, { value: pid, label });
        }
      });
      setCommodityOptions(Array.from(uniqMap.values()));
      setTotalCount(Number(total) || 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) {
      loadMandis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, uiConfig.scope?.org_id, language]);

  useEffect(() => {
    loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.pageSize, filters.market_date, filters.mandi_id, filters.status, filters.farmer_mobile, filters.commodity_product_id]);

  if (!canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view pre-market listings.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">{t("menu.preMarketListings", { defaultValue: "Pre-Market Listings" })}</Typography>
          <Typography variant="body2" color="text.secondary">
            Pre-listed arrivals captured before gate entry.
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1}>
          {canCreate ? (
            <Button variant="contained" onClick={() => navigate("/pre-market-listings/create")}>
              Create
            </Button>
          ) : null}
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadListings} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Box mb={2}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
          <TextField
            label="Market Date"
            type="date"
            value={filters.market_date}
            onChange={(e) => setFilters((prev) => ({ ...prev, market_date: e.target.value }))}
            required
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 180 }}
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
            sx={{ minWidth: 170 }}
          >
            {statusOptions.map((s) => (
              <MenuItem key={s.value} value={s.value}>
                {s.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Farmer Mobile"
            value={filters.farmer_mobile}
            onChange={(e) => setFilters((prev) => ({ ...prev, farmer_mobile: e.target.value }))}
            sx={{ minWidth: 170 }}
          />
          <TextField
            select
            label="Commodity Product"
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
          <Button variant="contained" onClick={loadListings}>
            Search
          </Button>
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
    </PageContainer>
  );
};
