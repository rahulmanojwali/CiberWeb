import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from "@mui/material";
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
import { closeAuctionSession, getAuctionSessions, startAuctionSession } from "../../services/auctionOpsApi";

type SessionRow = {
  id: string;
  session_id: string;
  org_code?: string | null;
  mandi_code?: string | null;
  method?: string | null;
  round?: string | null;
  status?: string | null;
  start_time?: string | null;
  end_time?: string | null;
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

export const AuctionSessions: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const [filters, setFilters] = useState({
    org_code: "",
    mandi_code: "",
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

  const canMenu = useMemo(
    () => can(uiConfig.resources, "auction_sessions.menu", "VIEW") || can(uiConfig.resources, "auction_sessions.list", "VIEW"),
    [uiConfig.resources],
  );
  const canView = useMemo(() => can(uiConfig.resources, "auction_sessions.list", "VIEW"), [uiConfig.resources]);

  const columns = useMemo<GridColDef<SessionRow>[]>(
    () => [
      { field: "session_id", headerName: "Session ID", width: 150 },
      { field: "org_code", headerName: "Org", width: 120 },
      { field: "mandi_code", headerName: "Mandi", width: 140 },
      { field: "method", headerName: "Method", width: 130 },
      { field: "round", headerName: "Round", width: 120 },
      { field: "status", headerName: "Status", width: 140 },
      {
        field: "start_time",
        headerName: "Start",
        width: 180,
        valueFormatter: (value) => formatDate(value),
      },
      {
        field: "end_time",
        headerName: "End",
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
        org_code: item.org_code || null,
        mandi_code: item.mandi_code || null,
        method: item.method || item.method_code || null,
        round: item.round || item.round_code || null,
        status: item.status || null,
        start_time: item.start_time || item.start || null,
        end_time: item.end_time || item.end || null,
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
    loadData();
  }, [filters.org_code, filters.mandi_code, filters.status, filters.method, filters.round, filters.date_from, filters.date_to, language, canView]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
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

  const statusColor = (status?: string | null) => {
    const s = String(status || "").toUpperCase();
    if (s === "LIVE") return "success";
    if (s === "CLOSED") return "default";
    return "warning";
  };

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">{t("menu.auctionSessions", { defaultValue: "Auction Sessions" })}</Typography>
          <Typography variant="body2" color="text.secondary">
            Live/archived auction sessions overview (read-only).
          </Typography>
        </Stack>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading}>
          Refresh
        </Button>
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
          select
          label="Status"
          size="small"
          sx={{ minWidth: 150 }}
          value={filters.status}
          onChange={(e) => updateFilter("status", e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="PLANNED">Planned</MenuItem>
          <MenuItem value="LIVE">Live</MenuItem>
          <MenuItem value="COMPLETED">Completed</MenuItem>
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
      </Stack>

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
        />
      </Box>

      {openDetail && selectedSession && (
        <Dialog open={openDetail} onClose={() => setOpenDetail(false)} fullWidth maxWidth="sm">
          <DialogTitle>Auction Session Detail</DialogTitle>
          <DialogContent>
            <Stack spacing={1.5} mt={1}>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle2">Status</Typography>
                <Chip
                  size="small"
                  label={(selectedSession.status || "PLANNED").toUpperCase()}
                  color={statusColor(selectedSession.status)}
                />
              </Stack>
              <Typography variant="body2">
                <strong>Session ID:</strong> {selectedSession.session_id}
              </Typography>
              <Typography variant="body2">
                <strong>Org:</strong> {selectedSession.org_code || "-"}
              </Typography>
              <Typography variant="body2">
                <strong>Mandi:</strong> {selectedSession.mandi_code || "-"}
              </Typography>
              <Typography variant="body2">
                <strong>Method:</strong> {selectedSession.method || "-"}
              </Typography>
              <Typography variant="body2">
                <strong>Round:</strong> {selectedSession.round || "-"}
              </Typography>
              <Typography variant="body2">
                <strong>Start:</strong> {formatDate(selectedSession.start_time)}
              </Typography>
              <Typography variant="body2">
                <strong>End:</strong> {formatDate(selectedSession.end_time)}
              </Typography>
              {detailError && (
                <Typography variant="body2" color="error">
                  {detailError}
                </Typography>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDetail(false)} disabled={detailLoading}>
              Close
            </Button>
            {String(selectedSession.status || "").toUpperCase() === "PLANNED" && (
              <Button variant="contained" onClick={handleStart} disabled={detailLoading}>
                {detailLoading ? "Starting..." : "Start Auction"}
              </Button>
            )}
            {String(selectedSession.status || "").toUpperCase() === "LIVE" && (
              <Button variant="contained" color="error" onClick={handleClose} disabled={detailLoading}>
                {detailLoading ? "Closing..." : "Close Auction"}
              </Button>
            )}
          </DialogActions>
        </Dialog>
      )}
    </PageContainer>
  );
};
