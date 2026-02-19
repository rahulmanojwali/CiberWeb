import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { type GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { fetchMandis } from "../../services/mandiApi";
import { getAuctionLots, getAuctionSessions } from "../../services/auctionOpsApi";
import { getLotList } from "../../services/lotsApi";
import { postEncrypted } from "../../services/sharedEncryptedRequest";

type LotRow = {
  id: string;
  lot_id: string;
  session_id?: string | null;
  org_code?: string | null;
  mandi_code?: string | null;
  commodity?: string | null;
  product?: string | null;
  quantity?: number | null;
  status?: string | null;
  base_price?: number | null;
  created_on?: string | null;
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

export const AuctionLots: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const [openCreate, setOpenCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [sessionOptions, setSessionOptions] = useState<Option[]>([]);
  const [lotOptions, setLotOptions] = useState<Option[]>([]);
  const [createForm, setCreateForm] = useState({
    session_id: "",
    lot_id: "",
    base_price: "",
  });

  const [filters, setFilters] = useState({
    org_code: "",
    mandi_code: "",
    commodity: "",
    product: "",
    session_id: "",
    lot_status: "",
    date_from: "",
    date_to: "",
  });
  const [rows, setRows] = useState<LotRow[]>([]);
  const [orgOptions, setOrgOptions] = useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);

  const canMenu = useMemo(
    () => can(uiConfig.resources, "auction_lots.menu", "VIEW") || can(uiConfig.resources, "auction_lots.view", "VIEW"),
    [uiConfig.resources],
  );
  const canView = useMemo(() => can(uiConfig.resources, "auction_lots.view", "VIEW"), [uiConfig.resources]);
  const canCreate = useMemo(
    () => can(uiConfig.resources, "auction_lots.create", "CREATE"),
    [uiConfig.resources],
  );

  const columns = useMemo<GridColDef<LotRow>[]>(
    () => [
      { field: "lot_id", headerName: "Lot ID", width: 140 },
      { field: "session_id", headerName: "Session", width: 140 },
      { field: "org_code", headerName: "Org", width: 110 },
      { field: "mandi_code", headerName: "Mandi", width: 140 },
      { field: "commodity", headerName: "Commodity", width: 150 },
      { field: "product", headerName: "Product", width: 150 },
      { field: "quantity", headerName: "Qty", width: 110 },
      { field: "base_price", headerName: "Base Price", width: 130 },
      { field: "status", headerName: "Status", width: 140 },
      {
        field: "created_on",
        headerName: "Created On",
        width: 180,
        valueFormatter: (value) => formatDate(value),
      },
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

  const isObjectId = (v: string) => /^[a-f\d]{24}$/i.test(v);
  const isIntString = (v: string) => /^\d+$/.test(v);
  const parseDecimal = (v: any): string | number | null => {
    if (v == null) return null;
    if (typeof v === "number") return v;
    if (typeof v === "string") {
      const n = Number(v);
      return Number.isFinite(n) ? v : null;
    }
    if (typeof v === "object" && v.$numberDecimal) {
      return String(v.$numberDecimal);
    }
    return null;
  };

  const loadData = async () => {
    const username = currentUsername();
    if (!username || !canView) return;
    setLoading(true);
    try {
      const resp = await getAuctionLots({
        username,
        language,
        filters: {
          org_id: filters.org_code && isObjectId(filters.org_code) ? filters.org_code : undefined,
          org_code: filters.org_code && !isObjectId(filters.org_code) ? filters.org_code : undefined,
          mandi_id:
            filters.mandi_code && isIntString(filters.mandi_code)
              ? Number(filters.mandi_code)
              : undefined,
          mandi_code:
            filters.mandi_code && !isIntString(filters.mandi_code)
              ? filters.mandi_code
              : undefined,
          commodity: filters.commodity || undefined,
          product: filters.product || undefined,
          session_id: filters.session_id || undefined,
          lot_status: filters.lot_status || undefined,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
          page_size: 100,
        },
      });
      const list = resp?.data?.items || resp?.response?.data?.items || [];
      const mapped: LotRow[] = list.map((item: any, idx: number) => ({
        id: item._id || item.lot_code || item.lot_id || `lot-${idx}`,
        lot_id: item.lot_code || item.lot_id || item._id || `lot-${idx}`,
        session_id: item.session_id || null,
        org_code: item.org_code || item.org_id || null,
        mandi_code: item.mandi_code ?? item.mandi_id ?? null,
        commodity: item.commodity_name_en || item.commodity || item.commodity_code || null,
        product: item.product_name_en || item.product || item.product_code || null,
        quantity: item.estimated_qty_kg ?? item.quantity ?? null,
        base_price: parseDecimal(item.start_price_per_qtl) ?? item.base_price ?? null,
        status: item.status || null,
        created_on: item.created_on || item.createdAt || null,
      }));
      if (import.meta.env.DEV) {
        console.debug("[AUCTION_LOTS_DEBUG] sample_item", list[0]);
        console.debug("[AUCTION_LOTS_DEBUG] sample_row", mapped[0]);
      }
      setRows(mapped);
    } finally {
      setLoading(false);
    }
  };

  const loadCreateOptions = async () => {
    const username = currentUsername();
    if (!username) return;
    setCreateError(null);
    try {
      const [sessionsResp, lotsResp] = await Promise.all([
        getAuctionSessions({ username, language, filters: { page_size: 100 } }),
        getLotList({ username, language, filters: { status: "CREATED", page_size: 100 } }),
      ]);
      const sessions = sessionsResp?.data?.items || sessionsResp?.response?.data?.items || [];
      const lots = lotsResp?.data?.items || lotsResp?.response?.data?.items || [];

      setSessionOptions(
        sessions
          .map((s: any) => ({
            value: s._id || s.session_id || "",
            label: s.session_code || s._id || s.session_id || "",
          }))
          .filter((s: Option) => s.value),
      );

      setLotOptions(
        lots
          .map((l: any) => ({
            value: l._id || l.lot_id || "",
            label: l.lot_code || l.token_code || l._id || l.lot_id || "",
          }))
          .filter((l: Option) => l.value),
      );
    } catch (err: any) {
      setCreateError(err?.message || "Failed to load sessions/lots.");
    }
  };

  const handleCreateSubmit = async () => {
    const username = currentUsername();
    if (!username) return;
    if (!createForm.session_id || !createForm.lot_id || !createForm.base_price) {
      setCreateError("Session, lot, and base price are required.");
      return;
    }
    setCreateLoading(true);
    setCreateError(null);
    try {
      const resp: any = await postEncrypted("/admin/mapLotToAuctionSession", {
        api: "mapLotToAuctionSession",
        username,
        language,
        lot_id: createForm.lot_id,
        session_id: createForm.session_id,
        start_price_per_qtl: createForm.base_price,
      });
      const rc = resp?.response?.responsecode ?? resp?.responsecode;
      const desc = resp?.response?.description ?? resp?.description;
      if (String(rc) !== "0") {
        setCreateError(desc || "Failed to create auction lot.");
        return;
      }
      setOpenCreate(false);
      setCreateForm({ session_id: "", lot_id: "", base_price: "" });
      await loadData();
    } catch (err: any) {
      setCreateError(err?.message || "Failed to create auction lot.");
    } finally {
      setCreateLoading(false);
    }
  };

  useEffect(() => {
    loadOrganisations();
    loadMandis();
  }, [language, uiConfig.role]);

  useEffect(() => {
    loadData();
  }, [filters.org_code, filters.mandi_code, filters.commodity, filters.product, filters.session_id, filters.lot_status, filters.date_from, filters.date_to, language, canView]);

  useEffect(() => {
    if (openCreate) {
      loadCreateOptions();
    }
  }, [openCreate, language]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  if (!canMenu || !canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view auction lots.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">{t("menu.auctionLots", { defaultValue: "Auction Lots" })}</Typography>
          <Typography variant="body2" color="text.secondary">
            Auction lots and linked sessions (read-only).
          </Typography>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          {canCreate && (
            <Button variant="contained" size="small" onClick={() => setOpenCreate(true)}>
              {t("actions.create", { defaultValue: "Create" })}
            </Button>
          )}
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        mb={2}
        alignItems={{ xs: "flex-start", md: "center" }}
        flexWrap="wrap"
      >
        {uiConfig.role === "SUPER_ADMIN" && (
          <TextField
            select
            label="Organisation"
            size="small"
            sx={{ minWidth: 200 }}
            value={filters.org_code}
            onChange={(e) => updateFilter("org_code", e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {orgOptions.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        )}

        <TextField
          select
          label="Mandi"
          size="small"
          sx={{ minWidth: 180 }}
          value={filters.mandi_code}
          onChange={(e) => updateFilter("mandi_code", e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          {mandiOptions.map((m) => (
            <MenuItem key={m.value} value={m.value}>
              {m.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          label="Session ID"
          size="small"
          value={filters.session_id}
          onChange={(e) => updateFilter("session_id", e.target.value)}
        />

        <TextField
          label="Commodity"
          size="small"
          value={filters.commodity}
          onChange={(e) => updateFilter("commodity", e.target.value)}
        />

        <TextField
          label="Product"
          size="small"
          value={filters.product}
          onChange={(e) => updateFilter("product", e.target.value)}
        />

        <TextField
          select
          label="Lot Status"
          size="small"
          sx={{ minWidth: 150 }}
          value={filters.lot_status}
          onChange={(e) => updateFilter("lot_status", e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="CREATED">Created</MenuItem>
          <MenuItem value="PUBLISHED">Published</MenuItem>
          <MenuItem value="SOLD">Sold</MenuItem>
          <MenuItem value="CANCELLED">Cancelled</MenuItem>
        </TextField>

        <TextField
          label="Date From"
          type="date"
          size="small"
          value={filters.date_from}
          onChange={(e) => updateFilter("date_from", e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Date To"
          type="date"
          size="small"
          value={filters.date_to}
          onChange={(e) => updateFilter("date_to", e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Stack>

      <Box sx={{ width: "100%" }}>
        <ResponsiveDataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r.id}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
          minWidth={960}
        />
      </Box>

      {openCreate && (
        <Dialog open={openCreate} onClose={() => setOpenCreate(false)} fullWidth maxWidth="sm">
          <DialogTitle>Create Auction Lot</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <TextField
                select
                label="Auction Session"
                size="small"
                value={createForm.session_id}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, session_id: e.target.value }))}
              >
                <MenuItem value="">Select</MenuItem>
                {sessionOptions.map((s) => (
                  <MenuItem key={s.value} value={s.value}>
                    {s.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Available Lot"
                size="small"
                value={createForm.lot_id}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, lot_id: e.target.value }))}
              >
                <MenuItem value="">Select</MenuItem>
                {lotOptions.map((l) => (
                  <MenuItem key={l.value} value={l.value}>
                    {l.label}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                label="Base Price"
                size="small"
                type="number"
                value={createForm.base_price}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, base_price: e.target.value }))}
              />

              {createError && (
                <Typography variant="body2" color="error">
                  {createError}
                </Typography>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenCreate(false)} disabled={createLoading}>Close</Button>
            <Button variant="contained" onClick={handleCreateSubmit} disabled={createLoading}>
              {createLoading ? "Submitting..." : "Submit"}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </PageContainer>
  );
};
