import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider, MenuItem, Paper, Stack, TextField, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { type GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import { readAuctionScope, writeAuctionScope } from "../../utils/auctionScope";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { fetchMandis } from "../../services/mandiApi";
import { closeAuctionSession, getAuctionSessions, startAuctionSession } from "../../services/auctionOpsApi";

type SessionRow = {
  id: string;
  session_id: string;
  session_code?: string | null;
  org_code?: string | null;
  mandi_code?: string | null;
  method?: string | null;
  round?: string | null;
  status?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  closure_mode?: string | null;
  scheduled_start_time?: string | null;
  scheduled_end_time?: string | null;
  auto_close_enabled?: boolean;
  closed_by_type?: string | null;
  close_reason?: string | null;
  closed_by_username?: string | null;
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
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

function deriveDisplayStatus(session: SessionRow, nowMs: number) {
  const base = String(session.status || "PLANNED").trim().toUpperCase();
  if (base === "PLANNED" && session.scheduled_end_time) {
    const scheduledEnd = new Date(session.scheduled_end_time);
    if (!Number.isNaN(scheduledEnd.getTime()) && nowMs > scheduledEnd.getTime()) return "EXPIRED";
  }
  return base;
}

function displayValue(value?: string | null) {
  const text = String(value || "").trim();
  return text || "—";
}

function closureModeLabel(mode?: string | null) {
  const normalized = String(mode || "").trim().toUpperCase();
  if (normalized === "MANUAL_ONLY") return "Manual";
  if (normalized === "AUTO_AT_END_TIME") return "Auto";
  if (normalized === "MANUAL_OR_AUTO") return "Manual + Auto";
  return displayValue(mode);
}

function sessionStatusHelperText(status?: string | null) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "PLANNED") return "This session is created but not started yet. Bidding should remain blocked until the session is started.";
  if (normalized === "EXPIRED") return "This session was never started and its scheduled end time has already passed.";
  if (normalized === "LIVE") return "This session is currently active.";
  if (normalized === "PAUSED") return "This session is currently paused.";
  if (normalized === "CLOSED") return "This session has ended.";
  if (normalized === "CANCELLED") return "This session was cancelled.";
  return "Session status is currently unavailable.";
}

const DetailField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <Stack spacing={0.35}>
    <Typography variant="caption" sx={{ color: "text.secondary", letterSpacing: 0.2 }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ color: "text.primary", fontWeight: 600 }}>
      {value}
    </Typography>
  </Stack>
);

export const AuctionSessions: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const persistedScope = readAuctionScope();
  const [filters, setFilters] = useState({
    org_code: persistedScope.org_code || "",
    mandi_code: persistedScope.mandi_code || "",
    status: "",
    method: "",
    round: "",
    date_from: "",
    date_to: "",
  });
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [orgOptions, setOrgOptions] = useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDetail, setOpenDetail] = useState(false);
  const [selectedSession, setSelectedSession] = useState<SessionRow | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const scopedMandiCodes = useMemo(() => (Array.isArray(uiConfig.scope?.mandi_codes) ? uiConfig.scope?.mandi_codes.filter(Boolean) : []), [uiConfig.scope?.mandi_codes]);
  const defaultOrgCode = uiConfig.role === "SUPER_ADMIN" ? "" : uiConfig.scope?.org_code || "";
  const defaultMandiCode = useMemo(() => {
    if (scopedMandiCodes.length > 0) return String(scopedMandiCodes[0]);
    if (mandiOptions.length === 1) return mandiOptions[0].value;
    return "";
  }, [scopedMandiCodes, mandiOptions]);

  const canMenu = useMemo(
    () => can(uiConfig.resources, "auction_sessions.menu", "VIEW") || can(uiConfig.resources, "auction_sessions.list", "VIEW"),
    [uiConfig.resources],
  );
  const canView = useMemo(() => can(uiConfig.resources, "auction_sessions.list", "VIEW"), [uiConfig.resources]);

  const statusColor = (status?: string | null) => {
    const s = String(status || "").toUpperCase();
    if (s === "LIVE") return "success";
    if (s === "EXPIRED" || s === "CANCELLED") return "error";
    if (s === "PAUSED" || s === "PLANNED") return "warning";
    if (s === "CLOSED") return "default";
    return "default";
  };

  const columns = useMemo<GridColDef<SessionRow>[]>(
    () => [
      { field: "session_code", headerName: "Session Code", width: 170, valueGetter: (_v, row) => row.session_code || row.session_id },
      { field: "session_id", headerName: "Session ID", width: 150 },
      { field: "org_code", headerName: "Org", width: 120 },
      { field: "mandi_code", headerName: "Mandi", width: 140 },
      { field: "method", headerName: "Method", width: 130 },
      { field: "round", headerName: "Round", width: 120 },
      {
        field: "status",
        headerName: "Status",
        width: 190,
        renderCell: (params) => {
          const row = params.row as SessionRow;
          const derivedStatus = deriveDisplayStatus(row, nowMs);
          return <Chip size="small" label={derivedStatus} color={statusColor(derivedStatus)} />;
        },
      },
      { field: "closure_mode", headerName: "Closure Mode", width: 170, valueGetter: (v) => v || "MANUAL_OR_AUTO" },
      {
        field: "scheduled_end_time",
        headerName: "Scheduled End",
        width: 180,
        valueFormatter: (value) => formatDate(value) || "—",
      },
      {
        field: "start_time",
        headerName: "Start",
        width: 180,
        valueFormatter: (value) => formatDate(value) || "—",
      },
      {
        field: "end_time",
        headerName: "End",
        width: 180,
        valueFormatter: (value) => formatDate(value) || "—",
      },
    ],
    [nowMs],
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
    try {
      const resp = await getAuctionSessions({
        username,
        language,
        filters: {
          org_code: filters.org_code || undefined,
          mandi_code: filters.mandi_code || undefined,
          status: filters.status || undefined,
          method: filters.method || undefined,
          round: filters.round || undefined,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
          page_size: 100,
        },
      });
      const list = resp?.data?.items || resp?.response?.data?.items || [];
      const mapped: SessionRow[] = list.map((item: any, idx: number) => ({
        id: item._id || item.session_id || `session-${idx}`,
        session_id: item.session_id || item._id || `session-${idx}`,
        session_code: item.session_code || null,
        org_code: item.org_code || null,
        mandi_code: item.mandi_code || null,
        method: item.method || item.method_code || null,
        round: item.round || item.round_code || null,
        status: item.status || null,
        start_time: item.start_time || item.start || null,
        end_time: item.end_time || item.end || null,
        closure_mode: item.closure_mode || "MANUAL_OR_AUTO",
        scheduled_start_time: item.scheduled_start_time || null,
        scheduled_end_time: item.scheduled_end_time || null,
        auto_close_enabled: Boolean(item.auto_close_enabled),
        closed_by_type: item.closed_by_type || null,
        close_reason: item.close_reason || null,
        closed_by_username: item.closed_by_username || null,
      }));
      setRows(mapped);
      if (selectedSession) {
        const updated = mapped.find((r) => r.id === selectedSession.id || r.session_id === selectedSession.session_id);
        if (updated) setSelectedSession(updated);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganisations();
    loadMandis();
  }, [language, uiConfig.role]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    setFilters((prev) => {
      const next = { ...prev };
      let changed = false;
      if (!next.org_code && defaultOrgCode) {
        next.org_code = defaultOrgCode;
        changed = true;
      }
      if (!next.mandi_code && defaultMandiCode) {
        next.mandi_code = defaultMandiCode;
        changed = true;
      }
      if (changed && import.meta.env.DEV) {
        console.debug("[AUCTION_SESSIONS_INIT] resolved defaults", {
          default_mandi_id: defaultMandiCode || null,
          initial_api_call_fired: true,
          appliedFilters: next,
        });
      }
      return changed ? next : prev;
    });
  }, [defaultOrgCode, defaultMandiCode]);

  useEffect(() => {
    writeAuctionScope({ org_code: filters.org_code, mandi_code: filters.mandi_code });
  }, [filters.org_code, filters.mandi_code]);

  useEffect(() => {
    if (import.meta.env.DEV) {
      console.debug("[AUCTION_SESSIONS_INIT] loadData effect", {
        default_mandi_id: defaultMandiCode || null,
        initial_api_call_fired: Boolean(filters.mandi_code || uiConfig.role === "SUPER_ADMIN"),
        appliedFilters: filters,
      });
    }
    loadData();
  }, [filters.org_code, filters.mandi_code, filters.status, filters.method, filters.round, filters.date_from, filters.date_to, language, canView]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    if (import.meta.env.DEV && key === "mandi_code") {
      console.debug("[AUCTION_SESSIONS_INIT] current selected mandi_id", value || null);
    }
  };

  if (!canMenu || !canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view auction sessions.</Typography>
      </PageContainer>
    );
  }

  const handleStart = async () => {
    const username = currentUsername();
    if (!username || !selectedSession) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const resp: any = await startAuctionSession({
        username,
        language,
        session_id: selectedSession.session_id,
      });
      const rc = resp?.response?.responsecode ?? resp?.responsecode;
      const desc = resp?.response?.description ?? resp?.description;
      if (String(rc) !== "0") {
        setDetailError(desc || "Failed to start session.");
        return;
      }
      await loadData();
    } catch (err: any) {
      setDetailError(err?.message || "Failed to start session.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleClose = async () => {
    const username = currentUsername();
    if (!username || !selectedSession) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const resp: any = await closeAuctionSession({
        username,
        language,
        session_id: selectedSession.session_id,
      });
      const rc = resp?.response?.responsecode ?? resp?.responsecode;
      const desc = resp?.response?.description ?? resp?.description;
      if (String(rc) !== "0") {
        setDetailError(desc || "Failed to close session.");
        return;
      }
      await loadData();
    } catch (err: any) {
      setDetailError(err?.message || "Failed to close session.");
    } finally {
      setDetailLoading(false);
    }
  };

  const selectedSessionDisplayStatus = selectedSession ? deriveDisplayStatus(selectedSession, nowMs) : "PLANNED";
  const isExpiredPlanned = selectedSessionDisplayStatus === "EXPIRED";

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">{t("menu.auctionSessions", { defaultValue: "Auction Sessions" })}</Typography>
          <Typography variant="body2" color="text.secondary">
            Live/archived auction sessions overview (read-only).
          </Typography>
          {!filters.mandi_code && uiConfig.role !== "SUPER_ADMIN" && (
            <Typography variant="body2" color="text.secondary">
              Showing sessions across your allowed mandis. Use the mandi dropdown to narrow the list.
            </Typography>
          )}
        </Stack>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1} mb={2}>
          <Typography variant="subtitle2" color="text.secondary">
            Filter Sessions
          </Typography>
        </Stack>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(190px, 1fr))", lg: "repeat(4, minmax(190px, 1fr))" },
            gap: 1.5,
          }}
        >
          {uiConfig.role === "SUPER_ADMIN" && (
            <TextField
              select
              label="Organisation"
              size="small"
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
            select
            label="Status"
            size="small"
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="PLANNED">Planned</MenuItem>
            <MenuItem value="LIVE">Live</MenuItem>
            <MenuItem value="PAUSED">Paused</MenuItem>
            <MenuItem value="CLOSED">Closed</MenuItem>
            <MenuItem value="CANCELLED">Cancelled</MenuItem>
          </TextField>

          <TextField
            label="Method"
            size="small"
            value={filters.method}
            onChange={(e) => updateFilter("method", e.target.value)}
          />

          <TextField
            label="Round"
            size="small"
            value={filters.round}
            onChange={(e) => updateFilter("round", e.target.value)}
          />

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
        </Box>
      </Paper>

      <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
        <Box sx={{ width: "100%" }}>
        <ResponsiveDataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r.id}
          disableRowSelectionOnClick
          onRowClick={(params: any) => {
            setSelectedSession(params.row as SessionRow);
            setDetailError(null);
            setOpenDetail(true);
          }}
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
          minWidth={960}
          sx={{
            "& .MuiDataGrid-cell": { alignItems: "center", py: 0.6 },
            "& .MuiDataGrid-columnHeaders": { borderBottom: "1px solid", borderColor: "divider" },
            "& .MuiDataGrid-row:hover": { backgroundColor: "action.hover", cursor: "pointer" },
          }}
        />
        </Box>
        {!loading && rows.length === 0 && (
          <Box sx={{ py: 4, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              No auction sessions found for selected filters.
            </Typography>
          </Box>
        )}
      </Paper>

      {openDetail && selectedSession && (
        <Dialog open={openDetail} onClose={() => setOpenDetail(false)} fullWidth maxWidth="md">
          <DialogTitle sx={{ pb: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={2}>
              <Stack spacing={0.4}>
                <Typography variant="h6">Auction Session Detail</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {displayValue(selectedSession.session_code)}
                </Typography>
              </Stack>
              <Chip
                size="small"
                label={selectedSessionDisplayStatus}
                color={statusColor(selectedSessionDisplayStatus)}
                sx={{ alignSelf: "center", fontWeight: 700 }}
              />
            </Stack>
          </DialogTitle>
          <Divider />
          <DialogContent sx={{ bgcolor: "#f7f8f3", py: 2.5 }}>
            <Stack spacing={2}>
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2, bgcolor: "background.paper" }}>
                <Typography variant="subtitle2" sx={{ mb: 1.4, fontWeight: 700 }}>
                  Session Identity
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
                  <DetailField label="Session ID" value={displayValue(selectedSession.session_id)} />
                  <DetailField label="Session Code" value={displayValue(selectedSession.session_code)} />
                  <DetailField label="Organisation" value={displayValue(selectedSession.org_code)} />
                  <DetailField label="Mandi" value={displayValue(selectedSession.mandi_code)} />
                  <DetailField label="Method" value={displayValue(selectedSession.method)} />
                  <DetailField label="Round(s)" value={displayValue(selectedSession.round)} />
                </Box>
              </Box>

              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2, bgcolor: "background.paper" }}>
                <Typography variant="subtitle2" sx={{ mb: 1.4, fontWeight: 700 }}>
                  Session Timing
                </Typography>
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" }, gap: 1.5 }}>
                  <DetailField label="Start Time" value={displayValue(formatDate(selectedSession.start_time))} />
                  <DetailField label="End Time" value={displayValue(formatDate(selectedSession.end_time))} />
                  <DetailField label="Scheduled End" value={displayValue(formatDate(selectedSession.scheduled_end_time))} />
                  <DetailField label="Closure Mode" value={closureModeLabel(selectedSession.closure_mode || "MANUAL_OR_AUTO")} />
                  <DetailField label="Closed By Type" value={displayValue(selectedSession.closed_by_type)} />
                  <DetailField label="Close Reason" value={displayValue(selectedSession.close_reason)} />
                  <DetailField label="Closed By Username" value={displayValue(selectedSession.closed_by_username)} />
                </Box>
                {selectedSession.scheduled_end_time && ["PLANNED", "LIVE"].includes(String(selectedSession.status || "").toUpperCase()) && (
                  <Chip
                    size="small"
                    variant="outlined"
                    label={`Scheduled to end at ${formatDate(selectedSession.scheduled_end_time)}`}
                    sx={{ mt: 1.5 }}
                  />
                )}
              </Box>

              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2, bgcolor: "background.paper" }}>
                <Typography variant="subtitle2" sx={{ mb: 0.8, fontWeight: 700 }}>
                  Session Progress
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {sessionStatusHelperText(selectedSessionDisplayStatus)}
                </Typography>
                {isExpiredPlanned && (
                  <Typography variant="body2" sx={{ mt: 0.8 }} color="text.secondary">
                    Start unavailable: scheduled end time already passed.
                  </Typography>
                )}
              </Box>

              {detailError && (
                <Typography variant="body2" color="error">
                  {detailError}
                </Typography>
              )}
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 1.75 }}>
            <Button onClick={() => setOpenDetail(false)} disabled={detailLoading} color="inherit">
              Close
            </Button>
            {String(selectedSession.status || "").toUpperCase() === "PLANNED" && !isExpiredPlanned && (
              <Button variant="contained" onClick={handleStart} disabled={detailLoading} sx={{ minWidth: 140 }}>
                {detailLoading ? "Starting..." : "Start Auction"}
              </Button>
            )}
            {String(selectedSession.status || "").toUpperCase() === "LIVE" && (
              <Button variant="contained" onClick={handleClose} disabled={detailLoading} sx={{ minWidth: 140 }}>
                {detailLoading ? "Closing..." : "Close Auction"}
              </Button>
            )}
          </DialogActions>
        </Dialog>
      )}
    </PageContainer>
  );
};
