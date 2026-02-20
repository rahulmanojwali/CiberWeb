import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem, Stack, TextField, Typography } from "@mui/material";
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
type LotOption = { value: string; label: string; shortCode?: string; lot: any };

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

const toNumber = (v: any): number | null => {
  if (v === undefined || v === null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const buildLotLabel = (lot: any) => {
  const partyDisplay =
    lot?.party_display_name ||
    `${lot?.party_type || ""} ${lot?.party_ref || ""}`.trim() ||
    "";

  const commodity =
    lot?.commodity_name_en ||
    lot?.commodity_name ||
    lot?.commodity ||
    lot?.commodity_code ||
    lot?.commodity_id ||
    "Commodity";
  const product =
    lot?.product_name_en ||
    lot?.commodity_product_name_en ||
    lot?.product ||
    lot?.product_code ||
    lot?.commodity_product_id ||
    "Product";

  const bags = toNumber(lot?.quantity?.bags ?? lot?.bags) ?? null;
  const weightPerBag = toNumber(lot?.quantity?.weight_per_bag_kg ?? lot?.weight_per_bag_kg) ?? null;
  const totalWeight =
    toNumber(lot?.quantity?.net_kg) ??
    toNumber(lot?.quantity?.gross_kg) ??
    toNumber(lot?.quantity?.total_kg) ??
    toNumber(lot?.quantity?.estimated_kg) ??
    toNumber(lot?.quantity?.weight_kg) ??
    toNumber(lot?.weight_kg) ??
    (bags !== null && weightPerBag !== null ? bags * weightPerBag : null) ??
    null;

  const gateCode = lot?.gate_code || lot?.gate?.code || lot?.gate || "-";
  const lotSeq = lot?.lot_seq || lot?.lot_sequence || lot?.lot_no || lot?.lot_number || "-";

  const qtyPart =
    bags !== null && weightPerBag !== null
      ? `${bags}x${weightPerBag}kg (${totalWeight ?? "-"}kg)`
      : totalWeight !== null
      ? `${totalWeight}kg`
      : "-";

  const label = `${partyDisplay} \u2022 ${commodity}/${product} \u2022 ${qtyPart} \u2022 Gate ${gateCode} \u2022 Lot#${lotSeq}`;
  const lotCode = lot?.lot_code || lot?.token_code || lot?._id || "";
  const shortCode = lotCode ? String(lotCode).slice(-6) : "";
  return { label, shortCode };
};

const buildSessionCode = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const min = String(now.getMinutes()).padStart(2, "0");
  return `SESS_${yyyy}${mm}${dd}_${hh}${min}`;
};

export const AuctionLots: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const [openCreate, setOpenCreate] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createOptionsLoading, setCreateOptionsLoading] = useState(false);
  const [sessionItems, setSessionItems] = useState<any[]>([]);
  const [sessionOptions, setSessionOptions] = useState<Option[]>([]);
  const [lotOptions, setLotOptions] = useState<LotOption[]>([]);
  const [selectedLot, setSelectedLot] = useState<any | null>(null);
  const [openCreateSession, setOpenCreateSession] = useState(false);
  const [createSessionLoading, setCreateSessionLoading] = useState(false);
  const [createSessionError, setCreateSessionError] = useState<string | null>(null);
  const [createSessionForm, setCreateSessionForm] = useState({
    method_code: "OPEN_OUTCRY",
    rounds_enabled: ["ROUND1"],
    status: "PLANNED",
    session_code: buildSessionCode(),
  });
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
  const canSessionsList = useMemo(
    () => can(uiConfig.resources, "auction_sessions.list", "VIEW"),
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

  const buildSessionOptionsForLot = (lot: any, sessions: any[]) => {
    if (!lot) return [];
    const orgId = lot?.org_id ? String(lot.org_id) : null;
    const orgCode = lot?.org_code ? String(lot.org_code) : null;
    const mandiId = lot?.mandi_id !== undefined && lot?.mandi_id !== null ? Number(lot.mandi_id) : null;
    const mandiCode = lot?.mandi_code ? String(lot.mandi_code) : null;
    const allowedStatuses = new Set(["PLANNED", "LIVE"]);

    return sessions
      .filter((s) => {
        const status = String(s?.status || "").toUpperCase();
        if (!allowedStatuses.has(status)) return false;
        const sOrgId = s?.org_id ? String(s.org_id) : null;
        const sOrgCode = s?.org_code ? String(s.org_code) : null;
        const sMandiId = s?.mandi_id !== undefined && s?.mandi_id !== null ? Number(s.mandi_id) : null;
        const sMandiCode = s?.mandi_code ? String(s.mandi_code) : null;

        const orgMatch = orgId ? sOrgId === orgId : orgCode ? sOrgCode === orgCode : true;
        const mandiMatch = mandiId !== null ? sMandiId === mandiId : mandiCode ? sMandiCode === mandiCode : true;
        return orgMatch && mandiMatch;
      })
      .map((s: any) => ({
        value: s._id || s.session_id || "",
        label: s.mandi_name ? `${s.mandi_name} (${s.session_code || s._id || s.session_id || ""})` : (s.session_code || s._id || s.session_id || ""),
      }))
      .filter((s: Option) => s.value);
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
    setCreateOptionsLoading(true);
    try {
      const [sessionsResp, lotsResp] = await Promise.all([
        canSessionsList ? getAuctionSessions({ username, language, filters: { page_size: 100 } }) : Promise.resolve(null),
        getLotList({ username, language, filters: { status: "CREATED", page_size: 100 } }),
      ]);
      const sessions = sessionsResp?.data?.items || sessionsResp?.response?.data?.items || [];
      const lots = lotsResp?.data?.items || lotsResp?.response?.data?.items || [];

      setSessionItems(sessions);
      const lotMapped: LotOption[] = lots
        .map((l: any) => {
          const { label, shortCode } = buildLotLabel(l);
          return {
            value: l._id || l.lot_id || "",
            label,
            shortCode,
            lot: l,
          };
        })
        .filter((l: LotOption) => l.value);
      setLotOptions(lotMapped);

      if (selectedLot) {
        setSessionOptions(buildSessionOptionsForLot(selectedLot, sessions));
      } else if (lotMapped.length > 0) {
        setSessionOptions(buildSessionOptionsForLot(lotMapped[0].lot, sessions));
      } else {
        setSessionOptions([]);
      }
    } catch (err: any) {
      setCreateError(err?.message || "Failed to load sessions/lots.");
    } finally {
      setCreateOptionsLoading(false);
    }
  };

  const loadSessionsForDropdown = async () => {
    const username = currentUsername();
    if (!username || !selectedLot) return;
    if (!canSessionsList) return;
    setCreateOptionsLoading(true);
    try {
      const resp = await getAuctionSessions({
        username,
        language,
        filters: {
          org_id: selectedLot?.org_id || undefined,
          mandi_id: selectedLot?.mandi_id ?? undefined,
          page_size: 100,
        },
      });
      const sessions = resp?.data?.items || resp?.response?.data?.items || [];
      setSessionItems(sessions);
      setSessionOptions(buildSessionOptionsForLot(selectedLot, sessions));
    } catch (err: any) {
      setCreateError(err?.message || "Failed to load sessions.");
    } finally {
      setCreateOptionsLoading(false);
    }
  };

  const handleCreateSubmit = async () => {
    const username = currentUsername();
    if (!username) return;
    const sessionMatch = sessionItems.find(
      (s: any) => String(s._id || s.session_id || "") === String(createForm.session_id || "")
    );
    const sessionStatus = String(sessionMatch?.status || "").toUpperCase();
    if (sessionStatus === "LIVE" || sessionStatus === "CLOSED") {
      setCreateError("Cannot map lots to a LIVE or CLOSED session.");
      return;
    }
    const basePriceRaw = String(createForm.base_price || "").trim();
    if (!createForm.session_id || !createForm.lot_id || !basePriceRaw) {
      setCreateError("Session, lot, and opening price are required.");
      return;
    }
    if (!/^\d+(\.\d{1,2})?$/.test(basePriceRaw)) {
      setCreateError("Opening price must be a number with up to 2 decimals.");
      return;
    }
    const basePriceNum = Number(basePriceRaw);
    if (!Number.isFinite(basePriceNum) || basePriceNum <= 0) {
      setCreateError("Opening price must be greater than 0.");
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
        start_price_per_qtl: basePriceRaw,
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

  const handleCreateSession = async () => {
    const username = currentUsername();
    if (!username || !selectedLot) return;
    setCreateSessionLoading(true);
    setCreateSessionError(null);
    try {
      const orgId = selectedLot?.org_id ? String(selectedLot.org_id) : "";
      const mandiId = selectedLot?.mandi_id !== undefined && selectedLot?.mandi_id !== null ? Number(selectedLot.mandi_id) : null;
      if (!orgId || mandiId === null) {
        setCreateSessionError("Lot does not have org/mandi context.");
        return;
      }
      const payload = {
        api: "createAuctionSession",
        username,
        language,
        org_id: orgId,
        mandi_id: mandiId,
        method_code: createSessionForm.method_code || "OPEN_OUTCRY",
        rounds_enabled: createSessionForm.rounds_enabled?.length ? createSessionForm.rounds_enabled : ["ROUND1"],
        status: createSessionForm.status || "PLANNED",
      };

      const resp: any = await postEncrypted("/admin/createAuctionSession", payload);
      const rc = resp?.response?.responsecode ?? resp?.responsecode;
      const desc = resp?.response?.description ?? resp?.description;
      if (String(rc) !== "0") {
        setCreateSessionError(desc || "Failed to create session.");
        return;
      }
      const newSessionId = resp?.data?.session_id || resp?.response?.data?.session_id || "";
      await loadCreateOptions();
      if (newSessionId) {
        setCreateForm((prev) => ({ ...prev, session_id: newSessionId }));
      }
      setOpenCreateSession(false);
    } catch (err: any) {
      setCreateSessionError(err?.message || "Failed to create session.");
    } finally {
      setCreateSessionLoading(false);
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
      setCreateForm({ session_id: "", lot_id: "", base_price: "" });
      setSelectedLot(null);
      setSessionOptions([]);
      setCreateSessionForm({
        method_code: "OPEN_OUTCRY",
        rounds_enabled: ["ROUND1"],
        status: "PLANNED",
        session_code: buildSessionCode(),
      });
      loadCreateOptions();
    }
  }, [openCreate, language]);

  useEffect(() => {
    if (selectedLot) {
      setSessionOptions(buildSessionOptionsForLot(selectedLot, sessionItems));
      setCreateForm((prev) => ({ ...prev, session_id: "" }));
    }
  }, [selectedLot, sessionItems]);

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
            {createOptionsLoading && <LinearProgress sx={{ mb: 2 }} />}
            <Stack spacing={2} mt={1}>
              <TextField
                select
                label="Available Lot"
                size="small"
                value={createForm.lot_id}
                onChange={(e) => {
                  const value = e.target.value;
                  setCreateForm((prev) => ({ ...prev, lot_id: value }));
                  const next = lotOptions.find((l) => l.value === value);
                  setSelectedLot(next?.lot || null);
                }}
              >
                <MenuItem value="">Select</MenuItem>
                {lotOptions.map((l) => (
                  <MenuItem key={l.value} value={l.value}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ width: "100%" }}>
                      <Typography variant="body2" sx={{ flex: 1 }}>
                        {l.label}
                      </Typography>
                      {l.shortCode && (
                        <Typography variant="caption" color="text.secondary">
                          #{l.shortCode}
                        </Typography>
                      )}
                    </Stack>
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="Auction Session"
                size="small"
                value={createForm.session_id}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, session_id: e.target.value }))}
                SelectProps={{ onOpen: loadSessionsForDropdown }}
                onClick={loadSessionsForDropdown}
              >
                <MenuItem value="">Select</MenuItem>
                {sessionOptions.map((s) => (
                  <MenuItem key={s.value} value={s.value}>
                    {s.label}
                  </MenuItem>
                ))}
              </TextField>

              {selectedLot && sessionOptions.length === 0 && (
                <Box>
                  <Typography variant="body2" color="text.secondary" mb={1}>
                    No active sessions for this org/mandi.
                  </Typography>
                  <Button variant="outlined" size="small" onClick={() => setOpenCreateSession(true)}>
                    Create Session (1 minute)
                  </Button>
                </Box>
              )}

              {selectedLot && (
                <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 1, p: 1.5 }}>
                  <Typography variant="subtitle2" mb={1}>
                    Lot Details
                  </Typography>
                  <Stack spacing={0.5}>
                    <Typography variant="body2">
                      <strong>Party:</strong>{" "}
                      {selectedLot?.party?.type || selectedLot?.party_type || selectedLot?.party_role || "Party"}{" "}
                      {selectedLot?.party?.ref ||
                        selectedLot?.party?.username ||
                        selectedLot?.party_username ||
                        selectedLot?.party_ref ||
                        selectedLot?.farmer_username ||
                        selectedLot?.trader_username ||
                        "-"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Token:</strong> {selectedLot?.token_code || selectedLot?.token || "-"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Commodity/Product:</strong>{" "}
                      {selectedLot?.commodity_name_en ||
                        selectedLot?.commodity_name ||
                        selectedLot?.commodity ||
                        selectedLot?.commodity_code ||
                        selectedLot?.commodity_id ||
                        "-"}{" "}
                      /{" "}
                      {selectedLot?.product_name_en ||
                        selectedLot?.commodity_product_name_en ||
                        selectedLot?.product ||
                        selectedLot?.product_code ||
                        selectedLot?.commodity_product_id ||
                        "-"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Bags:</strong>{" "}
                      {selectedLot?.quantity?.bags ?? selectedLot?.bags ?? "-"} | <strong>Weight/Bag:</strong>{" "}
                      {selectedLot?.quantity?.weight_per_bag_kg ?? selectedLot?.weight_per_bag_kg ?? "-"} kg |{" "}
                      <strong>Total:</strong>{" "}
                      {selectedLot?.quantity?.net_kg ??
                        selectedLot?.quantity?.gross_kg ??
                        selectedLot?.quantity?.total_kg ??
                        selectedLot?.quantity?.estimated_kg ??
                        selectedLot?.quantity?.weight_kg ??
                        selectedLot?.weight_kg ??
                        "-"}{" "}
                      kg
                    </Typography>
                    <Typography variant="body2">
                      <strong>Gate:</strong> {selectedLot?.gate_code || selectedLot?.gate?.code || "-"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Mandi:</strong>{" "}
                      {selectedLot?.mandi_name || selectedLot?.mandi_name_en || selectedLot?.mandi_code || selectedLot?.mandi_id || "-"}
                    </Typography>
                    <Typography variant="body2">
                      <strong>Org:</strong>{" "}
                      {selectedLot?.org_name || selectedLot?.org_name_en || selectedLot?.org_code || selectedLot?.org_id || "-"}
                    </Typography>
                  </Stack>
                </Box>
              )}

              <TextField
                label="Opening Price (₹/qtl)"
                size="small"
                type="number"
                value={createForm.base_price}
                onChange={(e) => setCreateForm((prev) => ({ ...prev, base_price: e.target.value }))}
                helperText="Starting bid price for this lot."
                inputProps={{ step: "0.01", min: "0" }}
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
            <Button
              variant="contained"
              onClick={handleCreateSubmit}
              disabled={
                createLoading ||
                (String(
                  sessionItems.find((s: any) => String(s._id || s.session_id || "") === String(createForm.session_id || ""))?.status || ""
                ).toUpperCase() === "LIVE") ||
                (String(
                  sessionItems.find((s: any) => String(s._id || s.session_id || "") === String(createForm.session_id || ""))?.status || ""
                ).toUpperCase() === "CLOSED")
              }
            >
              {createLoading ? "Submitting..." : "Submit"}
            </Button>
          </DialogActions>
        </Dialog>
      )}

      {openCreateSession && (
        <Dialog open={openCreateSession} onClose={() => setOpenCreateSession(false)} fullWidth maxWidth="sm">
          <DialogTitle>Create Session</DialogTitle>
          <DialogContent>
            <Stack spacing={2} mt={1}>
              <TextField
                label="Organisation"
                size="small"
                value={selectedLot?.org_name || selectedLot?.org_name_en || selectedLot?.org_code || selectedLot?.org_id || ""}
                InputProps={{ readOnly: true }}
              />
              <TextField
                label="Mandi"
                size="small"
                value={selectedLot?.mandi_name || selectedLot?.mandi_name_en || selectedLot?.mandi_code || selectedLot?.mandi_id || ""}
                InputProps={{ readOnly: true }}
              />
              <TextField
                select
                label="Method"
                size="small"
                value={createSessionForm.method_code}
                onChange={(e) => setCreateSessionForm((prev) => ({ ...prev, method_code: e.target.value }))}
              >
                <MenuItem value="OPEN_OUTCRY">OPEN_OUTCRY</MenuItem>
                <MenuItem value="E_AUCTION">E_AUCTION</MenuItem>
              </TextField>
              <TextField
                select
                label="Rounds Enabled"
                size="small"
                SelectProps={{
                  multiple: true,
                  value: createSessionForm.rounds_enabled,
                  onChange: (e) => {
                    const value = e.target.value;
                    setCreateSessionForm((prev) => ({
                      ...prev,
                      rounds_enabled: Array.isArray(value) ? value : String(value).split(","),
                    }));
                  },
                }}
              >
                <MenuItem value="PREVIEW">PREVIEW</MenuItem>
                <MenuItem value="ROUND1">ROUND1</MenuItem>
                <MenuItem value="ROUND2">ROUND2</MenuItem>
                <MenuItem value="FINAL">FINAL</MenuItem>
              </TextField>
              <TextField
                select
                label="Status"
                size="small"
                value={createSessionForm.status}
                onChange={(e) => setCreateSessionForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                <MenuItem value="PLANNED">PLANNED</MenuItem>
                <MenuItem value="LIVE">LIVE</MenuItem>
                <MenuItem value="PAUSED">PAUSED</MenuItem>
                <MenuItem value="CLOSED">CLOSED</MenuItem>
                <MenuItem value="CANCELLED">CANCELLED</MenuItem>
              </TextField>
              <TextField
                label="Session Code"
                size="small"
                value={createSessionForm.session_code}
                onChange={(e) => setCreateSessionForm((prev) => ({ ...prev, session_code: e.target.value }))}
              />

              {createSessionError && (
                <Typography variant="body2" color="error">
                  {createSessionError}
                </Typography>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenCreateSession(false)} disabled={createSessionLoading}>
              Close
            </Button>
            <Button variant="contained" onClick={handleCreateSession} disabled={createSessionLoading}>
              {createSessionLoading ? "Creating..." : "Create Session"}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </PageContainer>
  );
};
