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
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import { fetchTransportIntents, matchTransportIntent } from "../../services/transportIntentsApi";

const STATUS_TABS = ["OPEN", "MATCHED", "COMPLETED", "CANCELLED"] as const;
const INTENT_TYPES = [
  { value: "", label: "All" },
  { value: "FARMER_REQUEST", label: "FARMER_REQUEST" },
  { value: "DRIVER_OFFER", label: "DRIVER_OFFER" },
];

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

type Option = { value: string; label: string };

type TransportRow = {
  id: string;
  intent_type: string;
  market_date?: string | null;
  from_village?: string | null;
  participants?: string | null;
  capacity?: string | null;
  status?: string | null;
  raw?: any;
};

export const TransportIntents: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const { i18n } = useTranslation();
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();
  const language = normalizeLanguageCode(i18n.language);

  const [rows, setRows] = useState<TransportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);

  const [filters, setFilters] = useState({
    market_date: "",
    mandi_id: "",
    status: "OPEN",
    intent_type: "",
  });
  const [pagination, setPagination] = useState({ page: 0, pageSize: 25 });

  const [matchOpen, setMatchOpen] = useState(false);
  const [matchDriver, setMatchDriver] = useState<any | null>(null);
  const [matchRequests, setMatchRequests] = useState<any[]>([]);
  const [matchSelected, setMatchSelected] = useState<Record<string, boolean>>({});
  const [pickupTime, setPickupTime] = useState("");
  const [matchNotes, setMatchNotes] = useState("");
  const [matchLoading, setMatchLoading] = useState(false);

  const canView = useMemo(() => can("transport_intents.list", "VIEW"), [can]);
  const canMatch = useMemo(() => can("transport_intents.match", "UPDATE"), [can]);

  const columns = useMemo<GridColDef<TransportRow>[]>(
    () => [
      { field: "id", headerName: "Intent ID", width: 200 },
      { field: "intent_type", headerName: "Type", width: 160 },
      {
        field: "market_date",
        headerName: "Market Date",
        width: 140,
        valueFormatter: (value) => toYmd(value),
      },
      { field: "from_village", headerName: "From (Village)", width: 160 },
      { field: "participants", headerName: "Participants", width: 220 },
      { field: "capacity", headerName: "Capacity", width: 200 },
      {
        field: "status",
        headerName: "Status",
        width: 140,
        renderCell: (params) => <Chip size="small" label={params.value || "-"} />,
      },
      {
        field: "actions",
        headerName: "Actions",
        sortable: false,
        filterable: false,
        width: 140,
        renderCell: (params) =>
          canMatch && params.row.status === "OPEN" && params.row.intent_type === "DRIVER_OFFER" ? (
            <Button size="small" variant="contained" onClick={() => openMatch(params.row.raw)}>
              Match
            </Button>
          ) : (
            <Button size="small" disabled>
              View
            </Button>
          ),
      },
    ],
    [canMatch],
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

  const loadIntents = async () => {
    const username = currentUsername();
    if (!username || !canView) return;
    setLoading(true);
    try {
      const orgId = uiConfig.scope?.org_id || "";
      const payload: Record<string, any> = {
        page: pagination.page + 1,
        limit: pagination.pageSize,
      };
      if (filters.market_date) payload.market_date = filters.market_date;
      if (filters.mandi_id) payload.mandi_id = filters.mandi_id;
      if (filters.status) payload.status = filters.status;
      if (filters.intent_type) payload.intent_type = filters.intent_type;
      if (orgId) payload.org_id = orgId;

      const resp = await fetchTransportIntents({ username, language, filters: payload });
      const items = resp?.data?.items || resp?.response?.data?.items || [];
      const total = resp?.data?.total_records ?? resp?.response?.data?.total_records ?? items.length;

      const mapped: TransportRow[] = items.map((item: any, idx: number) => {
        const participants = Array.isArray(item.participants)
          ? item.participants
              .map((p: any) => {
                const name = p.name || p.display_name || "";
                const mobile = p.mobile || p.phone || p.username || "";
                return `${name}${mobile ? ` (${mobile})` : ""}`.trim();
              })
              .filter(Boolean)
              .join(", ")
          : "";
        const capacity = item.capacity
          ? `${item.capacity.vehicle_type || ""}${item.capacity.max_bags ? ` / ${item.capacity.max_bags} bags` : ""}${item.capacity.max_weight_kg ? ` / ${item.capacity.max_weight_kg}kg` : ""}`
          : "";
        return {
          id: String(item._id || idx),
          intent_type: item.intent_type || "",
          market_date: item.market_date || null,
          from_village: item?.from?.village || "",
          participants: participants || "-",
          capacity: capacity || "-",
          status: item.status || "",
          raw: item,
        };
      });

      setRows(mapped);
      setTotalCount(Number(total) || 0);
    } finally {
      setLoading(false);
    }
  };

  const openMatch = async (driverOffer: any) => {
    if (!driverOffer) return;
    setMatchDriver(driverOffer);
    setMatchSelected({});
    setMatchNotes("");
    setPickupTime("");
    setMatchRequests([]);
    setMatchOpen(true);

    const username = currentUsername();
    if (!username) return;
    try {
      setMatchLoading(true);
      const resp = await fetchTransportIntents({
        username,
        language,
        filters: {
          intent_type: "FARMER_REQUEST",
          status: "OPEN",
          mandi_id: driverOffer.mandi_id,
          market_date: toYmd(driverOffer.market_date),
          org_id: uiConfig.scope?.org_id || "",
          limit: 200,
        },
      });
      const items = resp?.data?.items || resp?.response?.data?.items || [];
      setMatchRequests(items || []);
    } finally {
      setMatchLoading(false);
    }
  };

  const toggleRequest = (id: string) => {
    setMatchSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCreateMatch = async () => {
    const username = currentUsername();
    if (!username || !matchDriver) return;
    const selectedIds = Object.entries(matchSelected)
      .filter(([, v]) => v)
      .map(([k]) => k);
    if (selectedIds.length === 0) {
      enqueueSnackbar("Select at least one farmer request.", { variant: "warning" });
      return;
    }
    if (!pickupTime) {
      enqueueSnackbar("Pickup time is required.", { variant: "warning" });
      return;
    }
    try {
      const resp = await matchTransportIntent({
        username,
        language,
        payload: {
          driver_offer_id: matchDriver._id,
          farmer_request_ids: selectedIds,
          pickup_time: pickupTime,
          notes: matchNotes || undefined,
          org_id: uiConfig.scope?.org_id || "",
          mandi_id: matchDriver.mandi_id,
        },
      });
      const code = resp?.response?.responsecode || resp?.responsecode || "1";
      const desc = resp?.response?.description || resp?.description || "Match failed.";
      if (code !== "0") {
        enqueueSnackbar(desc, { variant: "error" });
        return;
      }
      const matchId = resp?.data?.match_id || resp?.response?.data?.match_id || "";
      enqueueSnackbar(`Match created: ${matchId}`, { variant: "success" });
      setMatchOpen(false);
      await loadIntents();
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Match failed.", { variant: "error" });
    }
  };

  useEffect(() => {
    if (canView) {
      loadMandis();
      loadIntents();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  useEffect(() => {
    loadIntents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.pageSize]);

  if (!canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view transport intents.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">Transport Intents</Typography>
          <Typography variant="body2" color="text.secondary">
            Manual pooling of farmer requests and driver offers.
          </Typography>
        </Stack>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadIntents} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} mb={2} flexWrap="wrap">
        {STATUS_TABS.map((status) => (
          <Chip
            key={status}
            label={status}
            color={filters.status === status ? "primary" : "default"}
            onClick={() => setFilters((prev) => ({ ...prev, status }))}
          />
        ))}
      </Stack>

      <Box mb={2}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center">
          <TextField
            label="Market Date"
            type="date"
            value={filters.market_date}
            onChange={(e) => setFilters((prev) => ({ ...prev, market_date: e.target.value }))}
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
            label="Intent Type"
            value={filters.intent_type}
            onChange={(e) => setFilters((prev) => ({ ...prev, intent_type: e.target.value }))}
            sx={{ minWidth: 200 }}
          >
            {INTENT_TYPES.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" onClick={loadIntents}>Search</Button>
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

      <Dialog open={matchOpen} onClose={() => setMatchOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Match Transport Intents</DialogTitle>
        <DialogContent>
          {matchDriver && (
            <Box mb={2}>
              <Typography variant="body2">Driver Offer: {matchDriver._id}</Typography>
              <Typography variant="body2">Market Date: {toYmd(matchDriver.market_date)}</Typography>
              <Typography variant="body2">Mandi: {matchDriver.mandi_id}</Typography>
            </Box>
          )}
          <TextField
            label="Pickup Time"
            type="datetime-local"
            value={pickupTime}
            onChange={(e) => setPickupTime(e.target.value)}
            InputLabelProps={{ shrink: true }}
            fullWidth
            sx={{ mb: 2 }}
          />
          <TextField
            label="Notes"
            value={matchNotes}
            onChange={(e) => setMatchNotes(e.target.value)}
            fullWidth
            sx={{ mb: 2 }}
          />
          <Typography variant="subtitle2" gutterBottom>Farmer Requests (OPEN)</Typography>
          {matchLoading ? (
            <Typography variant="body2">Loading...</Typography>
          ) : (
            <Stack spacing={1}>
              {matchRequests.map((req: any) => {
                const id = String(req._id);
                const participants = Array.isArray(req.participants)
                  ? req.participants
                      .map((p: any) => `${p.name || ""}${p.mobile ? ` (${p.mobile})` : ""}`.trim())
                      .filter(Boolean)
                      .join(", ")
                  : "";
                return (
                  <Box key={id} p={1.5} sx={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 1 }}>
                    <Stack direction={{ xs: "column", md: "row" }} spacing={2} justifyContent="space-between" alignItems="center">
                      <Box>
                        <Typography variant="body2">{id}</Typography>
                        <Typography variant="body2">From: {req?.from?.village || "-"}</Typography>
                        <Typography variant="body2">Participants: {participants || "-"}</Typography>
                      </Box>
                      <Button
                        size="small"
                        variant={matchSelected[id] ? "contained" : "outlined"}
                        onClick={() => toggleRequest(id)}
                      >
                        {matchSelected[id] ? "Selected" : "Select"}
                      </Button>
                    </Stack>
                  </Box>
                );
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMatchOpen(false)}>Close</Button>
          <Button variant="contained" onClick={handleCreateMatch}>Create Match</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
