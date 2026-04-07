import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Divider,
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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RefreshIcon from "@mui/icons-material/Refresh";
import { type GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../components/PageContainer";
import { ResponsiveDataGrid } from "../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../config/languages";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { can } from "../utils/adminUiConfig";
import { fetchLotDetail, fetchLots, updateLotStatus, verifyLot } from "../services/lotsApi";
import { getAuctionResultByLot } from "../services/auctionOpsApi";
import { generateSettlementForLot, getSettlementDetail } from "../services/settlementsApi";

type LotRow = {
  id: string;
  token_code: string;
  lot_code?: string | null;
  mandi_name: string | number | null;
  org_name?: string | null;
  gate_code: string | null;
  gate_label?: string | null;
  party_username?: string | null;
  commodity_name?: string | null;
  commodity_product_id: string | null;
  commodity_product_name?: string | null;
  bags: number | null;
  weight_kg: number | null;
  quality_grade?: string | null;
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

function displayValue(value: any, fallback = "—") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  if (!text || text.toLowerCase() === "null" || text.toLowerCase() === "undefined") return fallback;
  return text;
}

function formatNumber(value: any) {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return displayValue(value);
  return num.toLocaleString();
}

function titleCaseLabel(value: any) {
  const text = displayValue(value, "");
  if (!text) return "—";
  return text
    .split(/\s+/)
    .map((part) => {
      if (!part) return part;
      const clean = part.replace(/_/g, " ");
      return clean
        .split(" ")
        .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase() : word))
        .join(" ");
    })
    .join(" ");
}

function humanizePartyKind(value: any) {
  const key = displayValue(value, "").toUpperCase();
  if (key === "CM_USER") return "Registered User";
  if (key === "WALKIN") return "Walk-in";
  return displayValue(value);
}

function humanizePartyType(value: any) {
  const key = displayValue(value, "").toUpperCase();
  if (key === "FARMER") return "Farmer";
  if (key === "TRADER") return "Trader";
  return displayValue(value);
}

function humanizeLotStatus(value: any) {
  const key = displayValue(value, "").toUpperCase();
  if (key === "CREATED") return "Created";
  if (key === "WEIGHMENT_LOCKED") return "Weighment Locked";
  if (key === "VERIFIED") return "Verified";
  if (key === "CANCELLED") return "Cancelled";
  if (!key || key === "—") return "Status not available";
  return key
    .split("_")
    .map((part) => part.charAt(0) + part.slice(1).toLowerCase())
    .join(" ");
}

function derivePartyLabel(item: any) {
  return (
    item?.party_display_name ||
    item?.party?.username ||
    item?.party_username ||
    item?.party_ref ||
    item?.party_name ||
    item?.party?.walkin?.name ||
    null
  );
}

function derivePartyMeta(item: any) {
  return (
    item?.party_contact ||
    item?.party_mobile ||
    item?.party?.walkin?.mobile ||
    null
  );
}

function FieldRow({ label, value }: { label: string; value: any }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "160px 1fr" },
        gap: 1,
        py: 0.75,
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2">{displayValue(value)}</Typography>
    </Box>
  );
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
  const [settlementDialogOpen, setSettlementDialogOpen] = useState(false);
  const [settlementActionLoading, setSettlementActionLoading] = useState(false);
  const [settlementActionError, setSettlementActionError] = useState<string | null>(null);
  const [settlementPreview, setSettlementPreview] = useState<any>(null);
  const [settlementPreviewLoading, setSettlementPreviewLoading] = useState(false);
  const [settlementPreviewError, setSettlementPreviewError] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState("UPI");
  const [settlementRemarks, setSettlementRemarks] = useState("");
  const [auctionResult, setAuctionResult] = useState<any>(null);
  const [auctionResultError, setAuctionResultError] = useState<string | null>(null);
  const [settlementDetail, setSettlementDetail] = useState<any>(null);
  const [settlementDetailError, setSettlementDetailError] = useState<string | null>(null);
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
  const canVerify = useMemo(
    () => can(uiConfig.resources, "lots.verify", "UPDATE"),
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
        lot_code: item.lot_code || null,
        token_code: item.token_code || item.token || item.code || `token-${idx}`,
        mandi_name:
          item.mandi_name ||
          item.mandi_name_en ||
          item.mandi ||
          item.mandi_slug ||
          item.mandi_id ||
          null,
        org_name: item.org_name || item.org_name_en || item.org_code || null,
        gate_code: item.gate_code || item.gate || null,
        gate_label: item.gate_label || item.gate_name || item.gate_code || item.gate || null,
        party_username: derivePartyLabel(item),
        commodity_name: titleCaseLabel(item.commodity_name || item.commodity_name_en || item.commodity_id || null),
        commodity_product_id:
          item.commodity_product_id ||
          item.commodity_product_code ||
          item.product_id ||
          null,
        commodity_product_name:
          titleCaseLabel(
            item.commodity_product_name ||
            item.product_name ||
            item.product_name_en ||
            item.commodity_product_name_en ||
            item.commodity_product_id ||
            item.product_id ||
            null,
          ),
        bags: item.bags ?? item.bags_count ?? null,
        weight_kg: item.weight_kg ?? item.net_weight ?? null,
        quality_grade: item.quality_grade ?? null,
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
      { field: "mandi_name", headerName: "Mandi", width: 180 },
      { field: "gate_label", headerName: "Gate", width: 180 },
      { field: "party_username", headerName: "Party", width: 180 },
      { field: "commodity_name", headerName: "Commodity", width: 180 },
      { field: "commodity_product_name", headerName: "Product", width: 180 },
      { field: "bags", headerName: "Bags", width: 110, valueFormatter: (value) => formatNumber(value) },
      { field: "weight_kg", headerName: "Weight (kg)", width: 140, valueFormatter: (value) => formatNumber(value) },
      { field: "quality_grade", headerName: "Quality Grade", width: 150, valueFormatter: (value) => displayValue(value) },
      { field: "status", headerName: "Status", width: 140 },
      {
        field: "created_on",
        headerName: "Created On",
        width: 190,
        valueFormatter: (value) => formatDate(value) || "—",
      },
    ],
    [],
  );

  const detailLot = detail || selectedRow?.raw || null;
  const detailParty = detailLot?.party && typeof detailLot.party === "object" ? detailLot.party : null;
  const detailWalkin = detailParty?.walkin && typeof detailParty.walkin === "object" ? detailParty.walkin : null;
  const detailPartyDisplay = derivePartyLabel(detailLot);
  const detailPartyMeta = derivePartyMeta(detailLot);
  const detailBags = detailLot?.bags ?? detailLot?.quantity?.bags ?? null;
  const detailWeightKg = detailLot?.weight_kg ?? detailLot?.quantity?.weight_kg ?? null;
  const detailWeightPerBagKg = detailLot?.weight_per_bag_kg ?? detailLot?.quantity?.weight_per_bag_kg ?? null;
  const detailCommodityName = titleCaseLabel(
    detailLot?.commodity_name ||
      detailLot?.commodity_name_en ||
      detailLot?.commodity_id ||
      null,
  );
  const detailProductName = titleCaseLabel(
    detailLot?.commodity_product_name ||
      detailLot?.product_name ||
      detailLot?.product_name_en ||
      detailLot?.commodity_product_name_en ||
      detailLot?.commodity_product_id ||
      null,
  );
  const detailGateLabel =
    detailLot?.gate_label ||
    detailLot?.gate_name ||
    detailLot?.gate_code ||
    null;
  const usernameMobileCombined = [detailParty?.username, detailPartyMeta].filter(Boolean).join(" / ");
  const shouldShowPartyRow =
    Boolean(detailPartyDisplay) &&
    String(detailPartyDisplay).trim() !== String(usernameMobileCombined || "").trim();
  const detailStatus = normalizeStatus(detailLot?.status);
  const canLockWeighmentAction = Boolean(detailLot && canUpdateStatus && detailStatus === "CREATED");
  const canVerifyAction = Boolean(detailLot && canVerify && detailStatus === "WEIGHMENT_LOCKED");
  const canCancelAction = Boolean(detailLot && canUpdateStatus && (detailStatus === "CREATED" || detailStatus === "WEIGHMENT_LOCKED"));
  const isWorkflowReadOnly = Boolean(detailLot) && !canLockWeighmentAction && !canVerifyAction && !canCancelAction;
  const canGenerateSettlement = Boolean(detailLot && detailStatus === "SOLD" && !detailLot?.settlement_id);
  const resultDoc = auctionResult?.result || null;
  const resultWinner = resultDoc?.winning_bidder_username || resultDoc?.winner_code || resultDoc?.winning_bidder || null;
  const resultAmount = resultDoc?.final_sold_amount_lot || resultDoc?.winning_bid_amount || null;
  const resultSessionCode = detailLot?.session_code || detailLot?.auction_session_code || detailLot?.session_code_label || null;
  const settlementHeader = settlementDetail?.header || null;
  const settlementStatus = settlementHeader?.status || detailLot?.settlement_status || detailLot?.payment_status || null;
  const settlementCode = settlementHeader?.settlement_code || detailLot?.settlement_code || null;

  const refreshDetail = async () => {
    if (!selectedRow) return;
    await handleOpenDetail(selectedRow);
    await loadData();
  };

  const loadAuctionResult = useCallback(async () => {
    const username = currentUsername();
    if (!username || !detailLot) return;
    const orgId = detailLot?.org_id || detailLot?.orgId;
    const mandiId = detailLot?.mandi_id ?? detailLot?.mandiId;
    const sessionId = detailLot?.session_id || detailLot?.auction_session_id || detailLot?.links?.session_id;
    const lotId = detailLot?._id || detailLot?.lot_id || detailLot?.lotId;
    const lotCode = detailLot?.lot_code || detailLot?.lotCode;
    const tokenCode = detailLot?.token_code || detailLot?.tokenCode;
    if (!orgId || !lotId || mandiId == null) return;
    try {
      setAuctionResultError(null);
      const resp = await getAuctionResultByLot({
        username,
        language,
        payload: {
          org_id: orgId,
          mandi_id: mandiId,
          session_id: sessionId,
          lot_id: lotId,
          lot_code: lotCode,
          token_code: tokenCode,
        },
      });
      const code = resp?.response?.responsecode ?? resp?.responsecode ?? "1";
      if (String(code) !== "0") {
        setAuctionResult(null);
        setAuctionResultError(resp?.response?.description || "Unable to load auction result.");
        return;
      }
      setAuctionResult(resp?.data || null);
    } catch (err: any) {
      setAuctionResult(null);
      setAuctionResultError(err?.message || "Unable to load auction result.");
    }
  }, [detailLot, language]);

  const loadSettlementDetail = useCallback(async () => {
    const username = currentUsername();
    if (!username || !detailLot?.settlement_id) return;
    try {
      setSettlementDetailError(null);
      const resp = await getSettlementDetail({
        username,
        language,
        payload: { settlement_id: detailLot.settlement_id },
      });
      const code = resp?.response?.responsecode ?? resp?.responsecode ?? "1";
      if (String(code) !== "0") {
        setSettlementDetail(null);
        setSettlementDetailError(resp?.response?.description || "Unable to load settlement detail.");
        return;
      }
      setSettlementDetail(resp?.data || null);
    } catch (err: any) {
      setSettlementDetail(null);
      setSettlementDetailError(err?.message || "Unable to load settlement detail.");
    }
  }, [detailLot, language]);

  useEffect(() => {
    if (!detailLot) return;
    void loadAuctionResult();
    void loadSettlementDetail();
  }, [detailLot, loadAuctionResult, loadSettlementDetail]);

  const loadSettlementPreview = useCallback(async () => {
    const username = currentUsername();
    if (!username || !detailLot) return;
    const orgId = detailLot?.org_id || detailLot?.orgId;
    const mandiId = detailLot?.mandi_id ?? detailLot?.mandiId;
    const lotId = detailLot?._id || detailLot?.lot_id || detailLot?.lotId;
    if (!lotId) return;
    setSettlementPreviewLoading(true);
    setSettlementPreviewError(null);
    try {
      const resp = await generateSettlementForLot({
        username,
        language,
        payload: {
          lot_id: lotId,
          lot_code: detailLot?.lot_code,
          org_id: orgId,
          mandi_id: mandiId,
          payment_mode: paymentMode,
          preview_only: "Y",
        },
      });
      const code = resp?.response?.responsecode ?? resp?.responsecode ?? "1";
      if (String(code) !== "0") {
        setSettlementPreview(null);
        setSettlementPreviewError(resp?.response?.description || "Unable to load payout preview.");
      } else {
        setSettlementPreview(resp?.response?.data || resp?.data || null);
      }
    } catch (err: any) {
      setSettlementPreview(null);
      setSettlementPreviewError(err?.message || "Unable to load payout preview.");
    } finally {
      setSettlementPreviewLoading(false);
    }
  }, [detailLot, language, paymentMode]);

  useEffect(() => {
    if (!settlementDialogOpen) return;
    if (paymentMode.toUpperCase() === "UPI") {
      void loadSettlementPreview();
    } else {
      setSettlementPreview(null);
      setSettlementPreviewError(null);
    }
  }, [paymentMode, settlementDialogOpen, loadSettlementPreview]);

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

  const runVerifyLot = async () => {
    const username = currentUsername();
    if (!username || !selectedRow) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const resp = await verifyLot({
        username,
        language,
        lot_id: selectedRow.id,
      });
      const code = resp?.response?.responsecode || resp?.responsecode || "1";
      const desc = resp?.response?.description || resp?.description || "";
      if (code !== "0") {
        setActionError(desc || "Unable to verify lot.");
        return;
      }
      await refreshDetail();
    } finally {
      setActionLoading(false);
    }
  };

  const openSettlementDialog = () => {
    setSettlementRemarks("");
    setSettlementActionError(null);
    setPaymentMode("UPI");
    setSettlementDialogOpen(true);
  };

  const handleGenerateSettlement = async () => {
    const username = currentUsername();
    if (!username || !detailLot) return;
    const orgId = detailLot?.org_id || detailLot?.orgId;
    const mandiId = detailLot?.mandi_id ?? detailLot?.mandiId;
    const lotId = detailLot?._id || detailLot?.lot_id || detailLot?.lotId;
    if (!lotId) return;
    setSettlementActionLoading(true);
    setSettlementActionError(null);
    try {
      const resp = await generateSettlementForLot({
        username,
        language,
        payload: {
          lot_id: lotId,
          lot_code: detailLot?.lot_code,
          org_id: orgId,
          mandi_id: mandiId,
          payment_mode: paymentMode,
          remarks: settlementRemarks || undefined,
        },
      });
      const code = resp?.response?.responsecode ?? resp?.responsecode ?? "1";
      const desc = resp?.response?.description || resp?.description || "Unable to generate settlement.";
      if (String(code) !== "0") {
        setSettlementActionError(desc);
        return;
      }
      setSettlementDialogOpen(false);
      await refreshDetail();
    } finally {
      setSettlementActionLoading(false);
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
          onRowClick={(params) => handleOpenDetail(params.row as LotRow)}
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
                {canLockWeighmentAction && (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => runStatusUpdate("WEIGHMENT_LOCKED")}
                    disabled={actionLoading}
                  >
                    Lock Weighment
                  </Button>
                )}
                {canVerifyAction && (
                  <Button
                    size="small"
                    variant="contained"
                    onClick={runVerifyLot}
                    disabled={actionLoading}
                  >
                    Verify
                  </Button>
                )}
                {canCancelAction && (
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
              {(canLockWeighmentAction || canVerifyAction || canCancelAction) && (
                <Typography variant="caption" color="text.secondary">
                  {[
                    canLockWeighmentAction ? "Lock Weighment: Finalize bags and total weight" : null,
                    canVerifyAction ? "Verify: Approve this lot for auction workflow" : null,
                    canCancelAction ? "Cancel: Cancel this lot" : null,
                  ].filter(Boolean).join(" • ")}
                </Typography>
              )}
              {isWorkflowReadOnly && (
                <Typography variant="caption" color="text.secondary">
                  This lot is read-only in its current lifecycle stage.
                </Typography>
              )}
              {detail && (
                <Stack spacing={2}>
                  <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1}>
                      <Box>
                        <Typography variant="subtitle1">{displayValue(detailLot?.lot_code, "Lot")}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Token {displayValue(detailLot?.token_code)}
                        </Typography>
                      </Box>
                      <Chip label={humanizeLotStatus(detailLot?.status)} color="primary" variant="outlined" />
                    </Stack>
                  </Box>

                  <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                    <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1} alignItems={{ sm: "center" }}>
                      <Box>
                        <Typography variant="subtitle1">Settlement</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {settlementStatus ? `Status: ${settlementStatus}` : "Status: Not available"}
                        </Typography>
                      </Box>
                      {canGenerateSettlement && (
                        <Button size="small" variant="contained" onClick={openSettlementDialog} disabled={actionLoading}>
                          Generate Settlement
                        </Button>
                      )}
                    </Stack>
                    {settlementDetailError && (
                      <Typography variant="body2" color="error" sx={{ mt: 1 }}>
                        {settlementDetailError}
                      </Typography>
                    )}
                    <Box sx={{ mt: 1 }}>
                      <FieldRow label="Settlement Code" value={settlementCode} />
                      <FieldRow label="Payment Mode" value={detailLot?.payment_mode || settlementHeader?.payment_mode} />
                      <FieldRow label="Winner" value={resultWinner} />
                      <FieldRow label="Final Amount" value={resultAmount} />
                      <FieldRow label="Session Code" value={resultSessionCode} />
                    </Box>
                    {auctionResultError && (
                      <Typography variant="caption" color="text.secondary">
                        {auctionResultError}
                      </Typography>
                    )}
                  </Box>

                  <Box>
                    <Typography variant="subtitle1" gutterBottom>Lot Summary</Typography>
                    <FieldRow label="Lot Code" value={detailLot?.lot_code} />
                    <FieldRow label="Status" value={humanizeLotStatus(detailLot?.status)} />
                    <FieldRow label="Token Code" value={detailLot?.token_code} />
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle1" gutterBottom>Context</Typography>
                    <FieldRow label="Org" value={detailLot?.org_name || detailLot?.org_name_en || detailLot?.org_code} />
                    <FieldRow label="Mandi" value={detailLot?.mandi_name || detailLot?.mandi_name_en || detailLot?.mandi_id} />
                    <FieldRow label="Gate" value={detailGateLabel} />
                    <FieldRow label="Vehicle" value={detailLot?.vehicle_no} />
                    <FieldRow label="Reason Label" value={detailLot?.reason_label} />
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle1" gutterBottom>Party</Typography>
                    <FieldRow label="Party Kind" value={humanizePartyKind(detailParty?.kind || detailLot?.party_kind)} />
                    <FieldRow label="Party Type" value={humanizePartyType(detailParty?.party_type || detailLot?.party_type)} />
                    {shouldShowPartyRow && <FieldRow label="Party" value={detailPartyDisplay} />}
                    <FieldRow label="Username / Mobile" value={usernameMobileCombined} />
                    <FieldRow label="Walk-in Name" value={detailWalkin?.name} />
                    <FieldRow label="Walk-in Mobile" value={detailWalkin?.mobile} />
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle1" gutterBottom>Commodity</Typography>
                    <FieldRow label="Commodity" value={detailCommodityName} />
                    <FieldRow label="Product" value={detailProductName} />
                    <FieldRow label="Quality Grade" value={detailLot?.quality_grade} />
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle1" gutterBottom>Quantity</Typography>
                    <FieldRow label="Bags" value={formatNumber(detailBags)} />
                    <FieldRow label="Weight per bag (kg)" value={formatNumber(detailWeightPerBagKg)} />
                    <FieldRow label="Total weight (kg)" value={formatNumber(detailWeightKg)} />
                  </Box>
                  <Divider />
                  <Box>
                    <Typography variant="subtitle1" gutterBottom>Audit</Typography>
                    <FieldRow label="Created By" value={detailLot?.created_by} />
                    <FieldRow label="Updated By" value={detailLot?.updated_by} />
                    <FieldRow label="Created On" value={formatDate(detailLot?.created_on) || "—"} />
                    <FieldRow label="Updated On" value={formatDate(detailLot?.updated_on) || "—"} />
                  </Box>
                </Stack>
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
              <Accordion disableGutters>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">Debug Data</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
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
                </AccordionDetails>
              </Accordion>
            </Stack>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedRow(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={settlementDialogOpen} onClose={() => setSettlementDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Generate Settlement</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {settlementActionError && <Typography color="error">{settlementActionError}</Typography>}
            <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
              <Typography variant="subtitle2" gutterBottom>Lot Details</Typography>
              <FieldRow label="Lot Code" value={detailLot?.lot_code} />
              <FieldRow label="Session Code" value={resultSessionCode} />
              <FieldRow label="Commodity" value={detailCommodityName} />
              <FieldRow label="Product" value={detailProductName} />
              <FieldRow label="Farmer" value={detailPartyDisplay} />
              <FieldRow label="Trader Winner" value={resultWinner} />
              <FieldRow label="Final Amount" value={resultAmount} />
            </Box>

            <FormControl size="small" fullWidth>
              <InputLabel>Payment Mode</InputLabel>
              <Select
                label="Payment Mode"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                <MenuItem value="UPI">UPI</MenuItem>
                <MenuItem value="CASH">Cash</MenuItem>
                <MenuItem value="BANK_TRANSFER">Bank Transfer</MenuItem>
              </Select>
            </FormControl>

            {paymentMode === "UPI" && (
              <Box sx={{ p: 2, border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
                <Typography variant="subtitle2" gutterBottom>Payout Preview</Typography>
                {settlementPreviewLoading && <Typography variant="body2">Loading payout details…</Typography>}
                {settlementPreviewError && (
                  <Typography variant="body2" color="error">{settlementPreviewError}</Typography>
                )}
                {!settlementPreviewLoading && !settlementPreviewError && (
                  <>
                    <FieldRow label="Payee Name" value={settlementPreview?.payout_destination?.payee_name} />
                    <FieldRow label="UPI ID" value={settlementPreview?.payout_destination?.upi_id} />
                    {!settlementPreview?.payout_destination && (
                      <Typography variant="body2" color="text.secondary">
                        Farmer default UPI is not configured.
                      </Typography>
                    )}
                  </>
                )}
              </Box>
            )}

            <TextField
              label="Remarks (optional)"
              value={settlementRemarks}
              onChange={(e) => setSettlementRemarks(e.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettlementDialogOpen(false)}>Back</Button>
          <Button
            variant="contained"
            onClick={handleGenerateSettlement}
            disabled={settlementActionLoading || (paymentMode === "UPI" && settlementPreview?.payout_missing === "Y")}
          >
            Generate
          </Button>
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
    </PageContainer>
  );
};

export default Lots;
