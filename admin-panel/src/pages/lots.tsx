import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { type GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../components/PageContainer";
import { ResponsiveDataGrid } from "../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../config/languages";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { can } from "../utils/adminUiConfig";
import { fetchLotDetail, fetchLots, mapLotToAuction, updateLotStatus } from "../services/lotsApi";

type LotRow = {
  id: string;
  token_code: string;
  mandi_name: string | number | null;
  gate_code: string | null;
  commodity_product_id: string | null;
  bags: number | null;
  weight_kg: number | null;
  status: string | null;
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

function normalizeStatus(value?: string | null) {
  return String(value || "").trim().toUpperCase();
}

const STATUS_OPTIONS = [
  "CREATED",
  "WEIGHMENT_LOCKED",
  "VERIFIED",
  "MAPPED_TO_AUCTION",
  "IN_AUCTION",
  "SOLD",
  "UNSOLD",
  "DISPATCHED",
  "CLOSED",
  "CANCELLED",
  "SETTLEMENT_PENDING",
  "SETTLED",
];

export const Lots: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const [rows, setRows] = useState<LotRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRow, setSelectedRow] = useState<LotRow | null>(null);
  const [detail, setDetail] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [auctionId, setAuctionId] = useState("");
  const [auctionCode, setAuctionCode] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [mandiFilter, setMandiFilter] = useState("");
  const [tokenFilter, setTokenFilter] = useState("");

  const canView = useMemo(
    () => can(uiConfig.resources, "lots.list", "VIEW"),
    [uiConfig.resources],
  );
  const canViewDetail = useMemo(
    () => can(uiConfig.resources, "lots.detail", "VIEW"),
    [uiConfig.resources],
  );
  const canUpdateStatus = useMemo(
    () => can(uiConfig.resources, "lots.update_status", "UPDATE"),
    [uiConfig.resources],
  );
  const canMapToAuction = useMemo(
    () => can(uiConfig.resources, "lots.map_to_auction", "UPDATE"),
    [uiConfig.resources],
  );

  const loadData = async () => {
    const username = currentUsername();
    if (!username || !canView) return;
    setLoading(true);
    try {
      const resp = await fetchLots({
        username,
        language,
        filters: {
          page_size: 100,
          status: statusFilter || undefined,
          mandi_id: mandiFilter || undefined,
          token_code: tokenFilter || undefined,
        },
      });
      const list = resp?.data?.items || resp?.response?.data?.items || [];
      const mapped: LotRow[] = list.map((item: any, idx: number) => ({
        id: item._id || item.lot_id || `${item.token_code || "lot"}-${idx}`,
        token_code: item.token_code || item.token || item.code || `token-${idx}`,
        mandi_name:
          item.mandi_name ||
          item.mandi ||
          item.mandi_slug ||
          item.mandi_id ||
          null,
        gate_code: item.gate_code || item.gate || null,
        commodity_product_id:
          item.commodity_product_id ||
          item.commodity_product_code ||
          item.product_id ||
          null,
        bags: item.bags ?? item.bags_count ?? null,
        weight_kg: item.weight_kg ?? item.net_weight ?? null,
        status: item.status ?? null,
        created_on: item.created_on || item.createdAt || null,
        raw: item,
      }));
      setRows(mapped);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDetail = useCallback(async (row: LotRow) => {
    const username = currentUsername();
    if (!username || !canViewDetail) return;
    setSelectedRow(row);
    setDetail(null);
    setDetailError(null);
    setActionError(null);
    setDetailLoading(true);
    try {
      const resp = await fetchLotDetail({
        username,
        language,
        lot_id: row.id,
        token_code: row.token_code,
      });
      const code = resp?.response?.responsecode || resp?.responsecode || "1";
      const desc = resp?.response?.description || resp?.description || "";
      if (code !== "0") {
        setDetailError(desc || "Unable to load lot detail.");
        setDetail(null);
      } else {
        const payload = resp?.data || resp?.response?.data || {};
        setDetail(payload?.lot || payload?.item || payload || row.raw || null);
      }
    } catch (err: any) {
      setDetailError(err?.message || "Unable to load lot detail.");
      setDetail(null);
    } finally {
      setDetailLoading(false);
    }
  }, [canViewDetail, language]);

  const columns = useMemo<GridColDef<LotRow>[]>(
    () => [
      { field: "token_code", headerName: "Token Code", width: 180 },
      { field: "mandi_name", headerName: "Mandi", width: 160 },
      { field: "gate_code", headerName: "Gate", width: 120 },
      { field: "commodity_product_id", headerName: "Commodity Product", width: 180 },
      { field: "bags", headerName: "Bags", width: 120 },
      { field: "weight_kg", headerName: "Weight (kg)", width: 140 },
      { field: "status", headerName: "Status", width: 140 },
      {
        field: "created_on",
        headerName: "Created On",
        width: 190,
        valueFormatter: (value) => formatDate(value),
      },
      {
        field: "details",
        headerName: "Details",
        width: 120,
        sortable: false,
        renderCell: (params) => (
          <Button
            size="small"
            onClick={() => handleOpenDetail(params.row)}
            disabled={!canViewDetail}
          >
            View
          </Button>
        ),
      },
    ],
    [canViewDetail, handleOpenDetail],
  );

  const refreshDetail = async () => {
    if (!selectedRow) return;
    await handleOpenDetail(selectedRow);
    await loadData();
  };

  const runStatusUpdate = async (toStatus: string, reason?: string) => {
    const username = currentUsername();
    if (!username || !selectedRow) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const resp = await updateLotStatus({
        username,
        language,
        lot_id: selectedRow.id,
        to_status: toStatus,
        reason,
      });
      const code = resp?.response?.responsecode || resp?.responsecode || "1";
      const desc = resp?.response?.description || resp?.description || "";
      if (code !== "0") {
        setActionError(desc || "Unable to update lot status.");
        return;
      }
      await refreshDetail();
    } finally {
      setActionLoading(false);
    }
  };

  const runMapToAuction = async () => {
    const username = currentUsername();
    if (!username || !selectedRow) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const resp = await mapLotToAuction({
        username,
        language,
        lot_id: selectedRow.id,
        auction_id: auctionId || undefined,
        auction_code: auctionCode || undefined,
      });
      const code = resp?.response?.responsecode || resp?.responsecode || "1";
      const desc = resp?.response?.description || resp?.description || "";
      if (code !== "0") {
        setActionError(desc || "Unable to map lot to auction.");
        return;
      }
      setMapDialogOpen(false);
      setAuctionId("");
      setAuctionCode("");
      await refreshDetail();
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [language, canView, statusFilter, mandiFilter, tokenFilter]);

  if (!canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view lots.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">{t("menu.lots", { defaultValue: "Lots" })}</Typography>
          <Typography variant="body2" color="text.secondary">
            Live lots linked to gate tokens (read-only).
          </Typography>
        </Stack>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              {STATUS_OPTIONS.map((status) => (
                <MenuItem key={status} value={status}>
                  {status}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <TextField
            label="Mandi ID"
            size="small"
            value={mandiFilter}
            onChange={(e) => setMandiFilter(e.target.value)}
          />
          <TextField
            label="Token Code"
            size="small"
            value={tokenFilter}
            onChange={(e) => setTokenFilter(e.target.value)}
          />
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <Box sx={{ width: "100%" }}>
        <ResponsiveDataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r.id || r.token_code}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
          minWidth={960}
        />
      </Box>

      <Dialog open={!!selectedRow} onClose={() => setSelectedRow(null)} maxWidth="md" fullWidth>
        <DialogTitle>Lot Details</DialogTitle>
        <DialogContent dividers>
          {detailLoading && <Typography>Loading...</Typography>}
          {detailError && <Typography color="error">{detailError}</Typography>}
          {!detailLoading && !detailError && (
            <Stack spacing={2}>
              {actionError && <Typography color="error">{actionError}</Typography>}
              <Stack direction="row" spacing={1} flexWrap="wrap">
                {detail && canUpdateStatus && normalizeStatus(detail.status) === "CREATED" && (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => runStatusUpdate("WEIGHMENT_LOCKED")}
                    disabled={actionLoading}
                  >
                    Lock Weighment
                  </Button>
                )}
                {detail && canUpdateStatus && normalizeStatus(detail.status) === "WEIGHMENT_LOCKED" && (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => runStatusUpdate("VERIFIED")}
                    disabled={actionLoading}
                  >
                    Verify
                  </Button>
                )}
                {detail && canMapToAuction && normalizeStatus(detail.status) === "VERIFIED" && (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => setMapDialogOpen(true)}
                    disabled={actionLoading}
                  >
                    Map to Auction
                  </Button>
                )}
                {detail && canUpdateStatus && normalizeStatus(detail.status) === "CREATED" && (
                  <Button
                    size="small"
                    variant="outlined"
                    color="error"
                    onClick={() => setCancelDialogOpen(true)}
                    disabled={actionLoading}
                  >
                    Cancel
                  </Button>
                )}
              </Stack>
              {detail && (
                <Box>
                  <Typography variant="subtitle1" gutterBottom>
                    Lot Detail
                  </Typography>
                  <Stack spacing={0.5}>
                    <Typography variant="body2">
                      Status: {detail.status || "N/A"}
                    </Typography>
                    <Typography variant="body2">
                      Token Code: {detail.token_code || "N/A"}
                    </Typography>
                    <Typography variant="body2">
                      Commodity: {detail.commodity_id || "N/A"}
                    </Typography>
                    <Typography variant="body2">
                      Commodity Product: {detail.commodity_product_id || "N/A"}
                    </Typography>
                    <Typography variant="body2">
                      Quantity: {detail?.quantity?.bags ?? "N/A"} bags / {detail?.quantity?.weight_kg ?? "N/A"} kg
                    </Typography>
                  </Stack>
                </Box>
              )}
              <Box>
                <Typography variant="subtitle1" gutterBottom>
                  Timeline
                </Typography>
                {(!detail?.events || detail.events.length === 0) && (
                  <Typography variant="body2" color="text.secondary">
                    No events yet.
                  </Typography>
                )}
                {detail?.events && detail.events.length > 0 && (
                  <Stack spacing={1}>
                    {detail.events.map((event: any, idx: number) => (
                      <Box key={event._id || idx} sx={{ p: 1, border: "1px solid", borderColor: "divider", borderRadius: 1 }}>
                        <Typography variant="body2">
                          {event.event_type || "EVENT"}: {event.from_status || ""} → {event.to_status || ""}
                        </Typography>
                        {event.reason && (
                          <Typography variant="body2" color="text.secondary">
                            Reason: {event.reason}
                          </Typography>
                        )}
                        {event.ts && (
                          <Typography variant="caption" color="text.secondary">
                            {formatDate(event.ts)}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                )}
              </Box>
              <Box
                component="pre"
                sx={{
                  p: 2,
                  bgcolor: "background.default",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "divider",
                  overflow: "auto",
                  fontSize: 12,
                }}
              >
                {JSON.stringify(detail || selectedRow?.raw || {}, null, 2)}
              </Box>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedRow(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Cancel Lot</DialogTitle>
        <DialogContent dividers>
          <TextField
            label="Reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            fullWidth
            multiline
            minRows={3}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelDialogOpen(false)}>Back</Button>
          <Button
            variant="contained"
            color="error"
            disabled={!cancelReason.trim() || actionLoading}
            onClick={async () => {
              setCancelDialogOpen(false);
              await runStatusUpdate("CANCELLED", cancelReason.trim());
              setCancelReason("");
            }}
          >
            Confirm Cancel
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={mapDialogOpen} onClose={() => setMapDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Map Lot to Auction</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <TextField
              label="Auction ID"
              value={auctionId}
              onChange={(e) => setAuctionId(e.target.value)}
              fullWidth
            />
            <TextField
              label="Auction Code"
              value={auctionCode}
              onChange={(e) => setAuctionCode(e.target.value)}
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMapDialogOpen(false)}>Back</Button>
          <Button
            variant="contained"
            disabled={actionLoading || (!auctionId.trim() && !auctionCode.trim())}
            onClick={runMapToAuction}
          >
            Map
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};

export default Lots;
