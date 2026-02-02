import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { useSnackbar } from "notistack";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { getMandisForCurrentScope, fetchCommodityProducts } from "../../services/mandiApi";
import { fetchPreMarketListings, createPreMarketListing } from "../../services/preMarketListingsApi";
import { getStoredAdminUser } from "../../utils/session";

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
  const { enqueueSnackbar } = useSnackbar();

  const [rows, setRows] = useState<ListingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
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
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    market_date: todayLocal(),
    mandi_id: "",
    farmer_name: "",
    farmer_mobile: "",
    commodity_product_id: "",
    commodity_name: "",
    bags: "",
    weight_per_bag_kg: "",
    expected_price: "",
  });

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

  const loadCommodities = async () => {
    const username = currentUsername();
    if (!username) return;
    try {
      const resp = await fetchCommodityProducts({ username, language, filters: { is_active: "Y" } });
      const list = resp?.data?.items || resp?.response?.data?.items || [];
      setCommodityOptions(
        list.map((p: any) => ({
          value: String(p.commodity_product_id ?? p.product_id ?? p.id ?? ""),
          label: p.product_name || p.product_name_en || p.name_en || p.commodity_product_name || String(p.commodity_product_id || ""),
        })),
      );
    } catch {
      setCommodityOptions([]);
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
          bags: produce.bags ?? produce.bags_count ?? item.bags ?? null,
          weight_per_bag: produce.weight_per_bag ?? item.weight_per_bag ?? null,
          status: item.status || null,
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

  const onCreateClick = () => {
    console.log("PRE_MARKET_CREATE_CLICKED");
    setCreateOpen(true);
  };

  const resetCreateForm = () => {
    setCreateForm({
      market_date: todayLocal(),
      mandi_id: "",
      farmer_name: "",
      farmer_mobile: "",
      commodity_product_id: "",
      commodity_name: "",
      bags: "",
      weight_per_bag_kg: "",
      expected_price: "",
    });
  };

  const submitCreate = async () => {
    const username = currentUsername();
    const orgId = uiConfig.scope?.org_id || "";
    const country = getStoredAdminUser()?.country || "IN";
    if (!username || !orgId) {
      enqueueSnackbar("Session missing. Please login again.", { variant: "error" });
      return;
    }

    const missing: string[] = [];
    if (!createForm.market_date) missing.push("Market Date");
    if (!createForm.mandi_id) missing.push("Mandi");
    if (!createForm.farmer_name) missing.push("Farmer Name");
    if (!createForm.farmer_mobile) missing.push("Farmer Mobile");
    if (!createForm.commodity_product_id) missing.push("Commodity Product");
    if (!createForm.bags) missing.push("Bags");
    if (!createForm.weight_per_bag_kg) missing.push("Weight/Bag");

    if (missing.length) {
      enqueueSnackbar(`Missing: ${missing.join(", ")}`, { variant: "warning" });
      return;
    }

    setCreating(true);
    try {
      const selectedCommodity = commodityOptions.find(
        (c) => c.value === createForm.commodity_product_id,
      );
      const payload = {
        username,
        language,
        country,
        org_id: orgId,
        mandi_id: createForm.mandi_id,
        market_day: { date: createForm.market_date },
        farmer: {
          name: createForm.farmer_name,
          mobile: createForm.farmer_mobile,
        },
        produce: {
          commodity_product_id: createForm.commodity_product_id,
          commodity_name: createForm.commodity_name || selectedCommodity?.label || "",
          quantity: {
            bags: Number(createForm.bags),
            weight_per_bag_kg: Number(createForm.weight_per_bag_kg),
          },
          expected_price: createForm.expected_price
            ? Number(createForm.expected_price)
            : undefined,
        },
      };

      const resp = await createPreMarketListing(payload);
      const code = String(resp?.response?.responsecode ?? resp?.data?.responsecode ?? "");
      if (code !== "0") {
        const desc =
          resp?.response?.description ||
          resp?.data?.description ||
          "Failed to create listing.";
        enqueueSnackbar(desc, { variant: "error" });
        return;
      }
      enqueueSnackbar("Pre-market listing created.", { variant: "success" });
      setCreateOpen(false);
      resetCreateForm();
      loadListings();
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (canView) {
      loadMandis();
      loadCommodities();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, uiConfig.scope?.org_id, language]);

  useEffect(() => {
    loadListings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.pageSize]);

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
            <Button variant="contained" onClick={onCreateClick}>
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

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Create Pre-Market Listing</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Market Date"
            type="date"
            value={createForm.market_date}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, market_date: e.target.value }))}
            required
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            select
            label="Mandi"
            value={createForm.mandi_id}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, mandi_id: e.target.value }))}
            required
          >
            {mandiOptions.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Farmer Name"
            value={createForm.farmer_name}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, farmer_name: e.target.value }))}
            required
          />
          <TextField
            label="Farmer Mobile"
            value={createForm.farmer_mobile}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, farmer_mobile: e.target.value }))}
            required
          />
          <TextField
            select
            label="Commodity Product"
            value={createForm.commodity_product_id}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, commodity_product_id: e.target.value }))}
            required
          >
            {commodityOptions.map((c) => (
              <MenuItem key={c.value} value={c.value}>
                {c.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Bags"
            type="number"
            value={createForm.bags}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, bags: e.target.value }))}
            required
          />
          <TextField
            label="Weight per Bag (kg)"
            type="number"
            value={createForm.weight_per_bag_kg}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, weight_per_bag_kg: e.target.value }))}
            required
          />
          <TextField
            label="Expected Price (optional)"
            type="number"
            value={createForm.expected_price}
            onChange={(e) => setCreateForm((prev) => ({ ...prev, expected_price: e.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)} disabled={creating}>
            Cancel
          </Button>
          <Button variant="contained" onClick={submitCreate} disabled={creating}>
            {creating ? "Saving..." : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
