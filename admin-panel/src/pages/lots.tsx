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
  InputAdornment,
  InputLabel,
  LinearProgress,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import Inventory2OutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import LocalShippingOutlinedIcon from "@mui/icons-material/LocalShippingOutlined";
import MapOutlinedIcon from "@mui/icons-material/MapOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import VerifiedOutlinedIcon from "@mui/icons-material/VerifiedOutlined";
import { type GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../components/PageContainer";
import { ResponsiveDataGrid } from "../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../config/languages";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { can } from "../utils/adminUiConfig";
import { usePermissions } from "../authz/usePermissions";
import { useNavigate } from "react-router-dom";
import { fetchLotDetail, fetchLots, updateLotStatus, updateLotWeight, verifyLot } from "../services/lotsApi";
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

type SettlementDisplayState =
  | "PRE_AUCTION"
  | "NOT_APPLICABLE"
  | "AWAITING_RESULT"
  | "IN_AUCTION"
  | "HAS_RESULT"
  | "HAS_SETTLEMENT"
  | "ERROR_PERMISSION"
  | "ERROR_UNKNOWN";

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

function normalizeRoleSlug(value: any): string | null {
  const normalized = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "_");
  if (!normalized) return null;
  if (normalized === "SUPERADMIN") return "SUPER_ADMIN";
  if (normalized === "ORGADMIN") return "ORG_ADMIN";
  if (normalized === "MANDIADMIN") return "MANDI_ADMIN";
  return normalized;
}

function currentRoleSlug(preferredRole?: string | null): string | null {
  try {
    const preferred = normalizeRoleSlug(preferredRole);
    if (preferred) return preferred;
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    const roleCandidate =
      parsed?.default_role_code ||
      parsed?.role_slug ||
      parsed?.role_code ||
      parsed?.role ||
      null;
    return normalizeRoleSlug(roleCandidate);
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

const PRE_AUCTION_STATUSES = new Set(["CREATED", "WEIGHMENT_LOCKED", "VERIFIED"]);
const AUCTION_STAGE_OR_LATER_STATUSES = new Set([
  "MAPPED_TO_AUCTION",
  "IN_AUCTION",
  "SOLD",
  "UNSOLD",
  "SETTLEMENT_PENDING",
  "SETTLED",
  "DISPATCHED",
  "CLOSED",
]);
const LOCK_WEIGHMENT_ALLOWED_ROLES = new Set([
  "ORG_ADMIN",
  "MANDI_ADMIN",
  "MANDI_MANAGER",
  "WEIGHBRIDGE_OPERATOR",
  "SUPER_ADMIN",
]);
const VERIFY_ALLOWED_ROLES = new Set(["ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "SUPER_ADMIN"]);
const CANCEL_ALLOWED_ROLES = new Set(["ORG_ADMIN", "MANDI_ADMIN", "MANDI_MANAGER", "SUPER_ADMIN"]);

function isPermissionDeniedMessage(message: any) {
  const text = displayValue(message, "").toUpperCase();
  if (!text) return false;
  return (
    text.includes("NO_PERMISSION") ||
    text.includes("FORBIDDEN") ||
    text.includes("YOU DO NOT HAVE PERMISSION")
  );
}

function isAuctionNotFoundMessage(message: any) {
  const text = displayValue(message, "").toLowerCase();
  return (
    text === "auction lot not found." ||
    text === "auction result not found." ||
    text === "auction lot not found" ||
    text === "auction result not found"
  );
}

type SettlementUiState =
  | "PRE_AUCTION"
  | "AUCTION_IN_PROGRESS"
  | "SOLD_PENDING_SETTLEMENT"
  | "SETTLED"
  | "UNSOLD"
  | "CANCELLED"
  | "POST_DISPATCH"
  | "ERROR_PERMISSION"
  | "ERROR_UNKNOWN";

function deriveLotDetailUiState(
  detailLot: any,
  auctionResult: any,
  settlementDetail: any,
  auctionResultError: string | null,
  settlementDetailError: string | null,
) {
  const lot = detailLot;
  const status = normalizeStatus(lot?.status);
  const isPreAuction = PRE_AUCTION_STATUSES.has(status);
  const hasSettlementSignals = Boolean(
    lot?.settlement_id ||
      lot?.settlement_code ||
      lot?.settlement_status ||
      lot?.payment_status ||
      lot?.payment_mode
  );

  const weightEditAllowed = Boolean(lot?.workflow?.weight_edit_allowed);
  const canEditWeight = Boolean(isPreAuction && weightEditAllowed && !hasSettlementSignals);

  const resultDoc = auctionResult?.result || null;
  const winner = resultDoc?.winning_bidder_username || resultDoc?.winner_code || resultDoc?.winning_bidder || null;
  const amount = resultDoc?.final_sold_amount_lot || resultDoc?.winning_bid_amount || null;

  const settlementHeader = settlementDetail?.header || null;
  const settlementStatus = settlementHeader?.status || lot?.settlement_status || lot?.payment_status || null;
  const settlementCode = settlementHeader?.settlement_code || lot?.settlement_code || null;
  const paymentMode = lot?.payment_mode || settlementHeader?.payment_mode || null;
  const hasSettlement = Boolean(lot?.settlement_id || settlementHeader?._id);

  const hasSettlementSummary = Boolean(
    settlementCode || settlementStatus || settlementHeader?._id || paymentMode || winner || amount
  );

  let settlementUiState: SettlementUiState = "ERROR_UNKNOWN";
  let settlementHelperText: string | null = null;

  if (isPreAuction) {
    settlementUiState = "PRE_AUCTION";
    settlementHelperText = "Auction not started yet for this lot.";
  } else if (status === "CANCELLED") {
    settlementUiState = "CANCELLED";
    settlementHelperText = "Settlement not applicable for cancelled lots.";
  } else if (status === "UNSOLD") {
    settlementUiState = "UNSOLD";
    settlementHelperText = "Settlement not applicable for unsold lots.";
  } else if (status === "IN_AUCTION") {
    settlementUiState = "AUCTION_IN_PROGRESS";
    settlementHelperText = "Auction is in progress for this lot.";
  } else if (settlementStatus && String(settlementStatus).toUpperCase().includes("SETTLED")) {
    settlementUiState = "SETTLED";
  } else if (status === "DISPATCHED" || status === "CLOSED") {
    settlementUiState = "POST_DISPATCH";
  } else if (
    status === "SOLD" ||
    status === "SETTLEMENT_PENDING" ||
    hasSettlementSignals ||
    hasSettlementSummary
  ) {
    settlementUiState = "SOLD_PENDING_SETTLEMENT";
  } else if (status === "MAPPED_TO_AUCTION") {
    settlementUiState = "SOLD_PENDING_SETTLEMENT";
    if (!resultDoc && (isAuctionNotFoundMessage(auctionResultError) || !auctionResultError)) {
      settlementUiState = "SOLD_PENDING_SETTLEMENT";
      settlementHelperText = "Awaiting auction result.";
    }
  }

  // Error display rules: only show NO_PERMISSION when it is truly permission-related and no fallback exists.
  const permissionDenied = isPermissionDeniedMessage(settlementDetailError) || isPermissionDeniedMessage(auctionResultError);
  const shouldShowPermissionError = Boolean(permissionDenied && !hasSettlementSummary);
  const shouldShowUnknownError = Boolean(!shouldShowPermissionError && !hasSettlementSummary && (settlementDetailError || (!isAuctionNotFoundMessage(auctionResultError) && auctionResultError)));

  if (shouldShowPermissionError) settlementUiState = "ERROR_PERMISSION";
  else if (shouldShowUnknownError) settlementUiState = "ERROR_UNKNOWN";

  const shouldFetchAuctionResult = Boolean(!isPreAuction && status !== "CANCELLED" && status !== "UNSOLD" && (AUCTION_STAGE_OR_LATER_STATUSES.has(status) || hasSettlementSignals));
  const shouldFetchSettlementDetail = Boolean(
    !isPreAuction &&
      status !== "CANCELLED" &&
      status !== "UNSOLD" &&
      Boolean(lot?.settlement_id) &&
      ["SOLD", "SETTLEMENT_PENDING", "SETTLED", "DISPATCHED", "CLOSED"].includes(status)
  );

  const settlementFields = (() => {
    const sessionCode =
      lot?.session_code || lot?.auction_session_code || lot?.session_code_label || null;

    if (settlementUiState === "PRE_AUCTION") {
      return {
        statusText: "Not available",
        settlementCode: "—",
        paymentMode: "—",
        winner: "—",
        amount: "—",
        sessionCode: "—",
      };
    }
    if (settlementUiState === "AUCTION_IN_PROGRESS") {
      return {
        statusText: "Not available",
        settlementCode: settlementCode || "—",
        paymentMode: paymentMode || "—",
        winner: winner || "—",
        amount: amount || "—",
        sessionCode: sessionCode || "—",
      };
    }
    if (settlementUiState === "UNSOLD") {
      return {
        statusText: "Not applicable",
        settlementCode: "—",
        paymentMode: "—",
        winner: "—",
        amount: "—",
        sessionCode: sessionCode || "—",
      };
    }
    if (settlementUiState === "CANCELLED") {
      return {
        statusText: "Not applicable",
        settlementCode: "—",
        paymentMode: "—",
        winner: "—",
        amount: "—",
        sessionCode: sessionCode || "—",
      };
    }

    return {
      statusText: settlementStatus || "Not available",
      settlementCode: settlementCode || "—",
      paymentMode: paymentMode || "—",
      winner: winner || "—",
      amount: amount || "—",
      sessionCode: sessionCode || "—",
    };
  })();

  const settlementDisplayState: SettlementDisplayState = (() => {
    if (settlementUiState === "PRE_AUCTION") return "PRE_AUCTION";
    if (settlementUiState === "CANCELLED" || settlementUiState === "UNSOLD") return "NOT_APPLICABLE";
    if (status === "MAPPED_TO_AUCTION" && !resultDoc) return "AWAITING_RESULT";
    if (status === "IN_AUCTION") return "IN_AUCTION";
    if (hasSettlement) return "HAS_SETTLEMENT";
    if (resultDoc) return "HAS_RESULT";
    if (settlementUiState === "ERROR_PERMISSION") return "ERROR_PERMISSION";
    if (settlementUiState === "ERROR_UNKNOWN") return "ERROR_UNKNOWN";
    return "HAS_RESULT";
  })();

  let showSettlementPermissionError = shouldShowPermissionError;
  let showSettlementUnknownError = shouldShowUnknownError;
  let showNoPermission = Boolean(shouldShowPermissionError && !hasSettlementSummary);

  // Make display state mutually exclusive: for PRE_AUCTION / NOT_APPLICABLE / AWAITING_RESULT / IN_AUCTION,
  // suppress any auxiliary-call permission/error noise.
  if (["PRE_AUCTION", "NOT_APPLICABLE", "AWAITING_RESULT", "IN_AUCTION"].includes(settlementDisplayState)) {
    showSettlementPermissionError = false;
    showSettlementUnknownError = false;
    showNoPermission = false;
  } else {
    // Only show NO_PERMISSION when the resolved state is explicitly permission-related.
    if (settlementDisplayState !== "ERROR_PERMISSION") showNoPermission = false;
  }

  const canLockWeighment = status === "CREATED";
  const canCancel = status === "CREATED" || status === "WEIGHMENT_LOCKED";

  return {
    status,
    isPreAuction,
    canEditWeight,
    shouldFetchAuctionResult,
    shouldFetchSettlementDetail,
    settlementUiState,
    settlementDisplayState,
    settlementHelperText,
    settlementFields,
    hasSettlementSummary,
    showSettlementPermissionError,
    showSettlementUnknownError,
    showNoPermission,
    canLockWeighment,
    canCancel,
  };
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

function formatWeight(value: any, decimals = 3) {
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return Number(num).toFixed(decimals);
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
        gridTemplateColumns: { xs: "1fr", sm: "170px 1fr" },
        gap: 1.25,
        py: 0.6,
        alignItems: "baseline",
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ letterSpacing: 0.2 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {displayValue(value)}
      </Typography>
    </Box>
  );
}

function SectionCard({
  title,
  right,
  helper,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  helper?: React.ReactNode;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Box
      sx={{
        p: 2,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        bgcolor: alpha(theme.palette.background.paper, 0.95),
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2} sx={{ mb: 1 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
            {title}
          </Typography>
          {helper && (
            <Typography variant="caption" color="text.secondary">
              {helper}
            </Typography>
          )}
        </Box>
        {right}
      </Stack>
      {children}
    </Box>
  );
}

function buildStatusChipSx(theme: any, status: string) {
  const key = normalizeStatus(status);
  const base = {
    fontWeight: 700,
    borderWidth: 1,
    height: 28,
  } as const;
  if (key === "CREATED" || key === "WEIGHMENT_LOCKED") {
    return { ...base, borderColor: alpha(theme.palette.success.main, 0.35), bgcolor: alpha(theme.palette.success.main, 0.08), color: theme.palette.success.dark };
  }
  if (key === "VERIFIED") {
    return { ...base, borderColor: alpha(theme.palette.success.main, 0.45), bgcolor: alpha(theme.palette.success.main, 0.12), color: theme.palette.success.dark };
  }
  if (key === "CANCELLED") {
    return { ...base, borderColor: alpha(theme.palette.error.main, 0.35), bgcolor: alpha(theme.palette.error.main, 0.08), color: theme.palette.error.dark };
  }
  if (key === "MAPPED_TO_AUCTION" || key === "IN_AUCTION") {
    return { ...base, borderColor: alpha(theme.palette.info.main, 0.35), bgcolor: alpha(theme.palette.info.main, 0.08), color: theme.palette.info.dark };
  }
  if (key === "SETTLED" || key === "CLOSED" || key === "DISPATCHED") {
    return { ...base, borderColor: alpha(theme.palette.success.main, 0.25), bgcolor: alpha(theme.palette.success.main, 0.06), color: theme.palette.success.dark };
  }
  return { ...base, borderColor: "divider", bgcolor: alpha(theme.palette.text.primary, 0.04) };
}

function buildSettlementStateChip(theme: any, uiState: any) {
  const state = String(uiState?.settlementDisplayState || "").toUpperCase();
  const lotStatus = String(uiState?.status || "").toUpperCase();
  const base = {
    height: 24,
    fontWeight: 800,
    borderWidth: 1,
  } as const;

  if (state === "PRE_AUCTION") {
    return {
      label: "Not Available",
      sx: { ...base, borderColor: "divider", bgcolor: alpha(theme.palette.text.primary, 0.03), color: theme.palette.text.secondary },
    };
  }
  if (state === "NOT_APPLICABLE") {
    return {
      label: "Not Applicable",
      sx: { ...base, borderColor: "divider", bgcolor: alpha(theme.palette.text.primary, 0.02), color: theme.palette.text.secondary },
    };
  }
  if (state === "AWAITING_RESULT") {
    return {
      label: "Awaiting Result",
      sx: { ...base, borderColor: alpha(theme.palette.info.main, 0.28), bgcolor: alpha(theme.palette.info.main, 0.06), color: theme.palette.info.dark },
    };
  }
  if (state === "IN_AUCTION") {
    return {
      label: "In Auction",
      sx: { ...base, borderColor: alpha(theme.palette.info.main, 0.32), bgcolor: alpha(theme.palette.info.main, 0.08), color: theme.palette.info.dark },
    };
  }
  if (state === "ERROR_PERMISSION") {
    return {
      label: "Permission Required",
      sx: { ...base, borderColor: alpha(theme.palette.warning.main, 0.35), bgcolor: alpha(theme.palette.warning.main, 0.08), color: theme.palette.warning.dark },
    };
  }
  if (state === "ERROR_UNKNOWN") {
    return {
      label: "Unavailable",
      sx: { ...base, borderColor: alpha(theme.palette.warning.main, 0.25), bgcolor: alpha(theme.palette.warning.main, 0.05), color: theme.palette.warning.dark },
    };
  }

  if (lotStatus === "DISPATCHED") {
    return {
      label: "Dispatched",
      sx: { ...base, borderColor: alpha(theme.palette.success.main, 0.22), bgcolor: alpha(theme.palette.success.main, 0.05), color: theme.palette.success.dark },
    };
  }
  if (lotStatus === "CLOSED") {
    return {
      label: "Closed",
      sx: { ...base, borderColor: alpha(theme.palette.success.main, 0.22), bgcolor: alpha(theme.palette.success.main, 0.05), color: theme.palette.success.dark },
    };
  }
  if (lotStatus === "SETTLED" || String(uiState?.settlementFields?.statusText || "").toUpperCase().includes("SETTLED")) {
    return {
      label: "Settled",
      sx: { ...base, borderColor: alpha(theme.palette.success.main, 0.28), bgcolor: alpha(theme.palette.success.main, 0.08), color: theme.palette.success.dark },
    };
  }
  if (
    lotStatus === "SOLD" ||
    lotStatus === "SETTLEMENT_PENDING" ||
    String(uiState?.settlementFields?.statusText || "").toUpperCase().includes("PENDING")
  ) {
    return {
      label: "Settlement Pending",
      sx: { ...base, borderColor: alpha(theme.palette.success.main, 0.22), bgcolor: alpha(theme.palette.success.main, 0.06), color: theme.palette.success.dark },
    };
  }

  return {
    label: "Status",
    sx: { ...base, borderColor: "divider", bgcolor: alpha(theme.palette.text.primary, 0.03), color: theme.palette.text.secondary },
  };
}

function getSettlementHelperText(uiState: any) {
  const state = String(uiState?.settlementDisplayState || "").toUpperCase();
  const lotStatus = String(uiState?.status || "").toUpperCase();
  if (state === "PRE_AUCTION") return "Auction not started yet for this lot.";
  if (state === "NOT_APPLICABLE") {
    if (lotStatus === "CANCELLED") return "Settlement not applicable for cancelled lots.";
    if (lotStatus === "UNSOLD") return "Settlement not applicable for unsold lots.";
    return "Settlement not applicable for this lot.";
  }
  if (state === "AWAITING_RESULT") return "Awaiting auction result.";
  if (state === "IN_AUCTION") return "Auction is in progress for this lot.";
  if (state === "ERROR_PERMISSION") return "Permission required to view settlement details.";
  if (state === "ERROR_UNKNOWN") return "Settlement details are temporarily unavailable.";
  if (lotStatus === "DISPATCHED" || lotStatus === "CLOSED") return "Lot processing is complete.";
  if (lotStatus === "SETTLED") return "Settlement completed successfully.";
  if (lotStatus === "SOLD" || lotStatus === "SETTLEMENT_PENDING") return "Settlement has been generated and is pending payment.";
  const statusText = String(uiState?.settlementFields?.statusText || "").toUpperCase();
  if (statusText.includes("PENDING")) return "Settlement has been generated and is pending payment.";
  if (statusText.includes("SETTLED")) return "Settlement completed successfully.";
  return null;
}

function DashboardMetricCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <Paper
      elevation={0}
      sx={{
        p: 1.5,
        borderRadius: 2,
        border: "1px solid",
        borderColor: alpha(theme.palette.success.main, 0.18),
        bgcolor: alpha(theme.palette.success.light, 0.08),
        minWidth: { xs: "100%", sm: 180 },
        flex: 1,
      }}
    >
      <Stack direction="row" spacing={1.5} alignItems="center">
        <Box
          sx={{
            width: 32,
            height: 32,
            borderRadius: 1.5,
            display: "grid",
            placeItems: "center",
            bgcolor: alpha(theme.palette.success.main, 0.16),
            color: theme.palette.success.dark,
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography variant="h6" sx={{ lineHeight: 1.1, fontWeight: 800 }}>
            {formatNumber(value)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
        </Box>
      </Stack>
    </Paper>
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
  const { can: canPermission } = usePermissions();
  const navigate = useNavigate();
  const theme = useTheme();

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
  const [weightDialogOpen, setWeightDialogOpen] = useState(false);
  const [weightNewValue, setWeightNewValue] = useState("");
  const [weightReason, setWeightReason] = useState("");
  const [weightActionError, setWeightActionError] = useState<string | null>(null);
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
  const [auctionResultLoading, setAuctionResultLoading] = useState(false);
  const [settlementDetail, setSettlementDetail] = useState<any>(null);
  const [settlementDetailError, setSettlementDetailError] = useState<string | null>(null);
  const [settlementDetailLoading, setSettlementDetailLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [mandiFilter, setMandiFilter] = useState("");
  const [tokenFilter, setTokenFilter] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);

  const canView = useMemo(
    () => can(uiConfig.resources, "lots.list", "VIEW"),
    [uiConfig.resources],
  );
  const canViewDetail = useMemo(
    () => can(uiConfig.resources, "lots.detail", "VIEW"),
    [uiConfig.resources],
  );
  const canCreateLot = useMemo(
    () => canPermission("lots.create", "CREATE"),
    [canPermission],
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
      setLastRefreshedAt(new Date());
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
      {
        field: "token_code",
        headerName: "Token Code",
        width: 220,
        renderCell: (params) => (
          <Stack spacing={0.2} sx={{ py: 0.5 }}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: 700,
                fontFamily: '"Roboto Mono", "Source Code Pro", monospace',
                color: "text.primary",
              }}
            >
              {displayValue(params.row.token_code)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {displayValue(params.row.lot_code)}
            </Typography>
          </Stack>
        ),
      },
      { field: "mandi_name", headerName: "Mandi", width: 180 },
      { field: "gate_label", headerName: "Gate", width: 180 },
      {
        field: "party_username",
        headerName: "Party",
        width: 220,
        renderCell: (params) => (
          <Stack spacing={0.2} sx={{ py: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {displayValue(params.row.party_username)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {displayValue(params.row.raw?.party_type || params.row.raw?.party?.party_type)}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "commodity_name",
        headerName: "Commodity / Product",
        width: 240,
        renderCell: (params) => (
          <Stack spacing={0.2} sx={{ py: 0.5 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {displayValue(params.row.commodity_name)}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {displayValue(params.row.commodity_product_name)}
            </Typography>
          </Stack>
        ),
      },
      {
        field: "bags",
        headerName: "Bags",
        width: 110,
        align: "right",
        headerAlign: "right",
        valueFormatter: (value) => formatNumber(value),
      },
      {
        field: "weight_kg",
        headerName: "Weight (kg)",
        width: 140,
        align: "right",
        headerAlign: "right",
        valueFormatter: (value) => formatNumber(value),
      },
      { field: "quality_grade", headerName: "Quality Grade", width: 150, valueFormatter: (value) => displayValue(value) },
      {
        field: "status",
        headerName: "Status",
        width: 180,
        renderCell: (params) => (
            <Chip
              size="small"
              variant="outlined"
              label={humanizeLotStatus(params.row.status)}
              sx={buildStatusChipSx(theme, params.row.status || "")}
            />
        ),
      },
      {
        field: "created_on",
        headerName: "Created On",
        width: 190,
        valueFormatter: (value) => formatDate(value) || "—",
      },
    ],
    [theme],
  );

  const dashboardMetrics = useMemo(() => {
    const summary = {
      total: rows.length,
      created: 0,
      verified: 0,
      mapped: 0,
      settlementPending: 0,
    };
    for (const item of rows) {
      const key = normalizeStatus(item.status);
      if (key === "CREATED") summary.created += 1;
      if (key === "VERIFIED") summary.verified += 1;
      if (key === "MAPPED_TO_AUCTION") summary.mapped += 1;
      if (key === "SETTLEMENT_PENDING") summary.settlementPending += 1;
    }
    return summary;
  }, [rows]);

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
  const currentRole = useMemo(() => currentRoleSlug(uiConfig.role), [uiConfig.role]);
  const uiState = useMemo(
    () => deriveLotDetailUiState(detailLot, auctionResult, settlementDetail, auctionResultError, settlementDetailError),
    [detailLot, auctionResult, settlementDetail, auctionResultError, settlementDetailError],
  );
  const isPreAuctionLot = uiState.isPreAuction;
  const canLockWeighmentAction = Boolean(
    detailLot &&
      canUpdateStatus &&
      uiState.canLockWeighment &&
      LOCK_WEIGHMENT_ALLOWED_ROLES.has(String(currentRole || ""))
  );
  const canVerifyAction = Boolean(
    detailLot &&
      canVerify &&
      detailStatus === "WEIGHMENT_LOCKED" &&
      VERIFY_ALLOWED_ROLES.has(String(currentRole || ""))
  );
  const canCancelAction = Boolean(
    detailLot &&
      canUpdateStatus &&
      uiState.canCancel &&
      CANCEL_ALLOWED_ROLES.has(String(currentRole || ""))
  );
  const weightEditAllowed = Boolean(detailLot?.workflow?.weight_edit_allowed);
  const canEditWeightAction = Boolean(detailLot && canUpdateStatus && uiState.canEditWeight);
  const isWorkflowReadOnly = Boolean(detailLot) && !canLockWeighmentAction && !canVerifyAction && !canCancelAction && !canEditWeightAction;
  const settlementHeader = settlementDetail?.header || null;
  const hasSettlement = Boolean(detailLot?.settlement_id || settlementHeader?._id);
  const resultDoc = auctionResult?.result || null;
  const resultWinner = resultDoc?.winning_bidder_username || resultDoc?.winner_code || resultDoc?.winning_bidder || null;
  const resultAmount = resultDoc?.final_sold_amount_lot || resultDoc?.winning_bid_amount || null;
  const hasResultWinner = Boolean(resultWinner && String(resultWinner).trim());
  const numericResultAmount = Number(resultAmount || 0);
  const hasResultAmount = Number.isFinite(numericResultAmount) && numericResultAmount > 0;
  const canGenerateSettlement = Boolean(detailLot && !hasSettlement && hasResultWinner && hasResultAmount);
  const resultSessionCode = uiState.settlementFields.sessionCode;
  const settlementCode = uiState.settlementFields.settlementCode;
  const settlementStatusText = uiState.settlementFields.statusText;
  const settlementPaymentMode = uiState.settlementFields.paymentMode;
  const settlementWinner = uiState.settlementFields.winner;
  const settlementAmount = uiState.settlementFields.amount;
  const settlementErrorText =
    uiState.settlementDisplayState === "ERROR_PERMISSION"
      ? "Permission required to view settlement details."
      : "Settlement details are temporarily unavailable.";
  const isDetailBusy = Boolean(
    detailLoading ||
      actionLoading ||
      settlementActionLoading ||
      settlementPreviewLoading ||
      auctionResultLoading ||
      settlementDetailLoading
  );

  useEffect(() => {
    if (!detailLot || !import.meta.env.DEV) return;
    console.log("[lots/detail][action_gating]", {
      username: currentUsername(),
      role: currentRole,
      status: detailStatus,
      canLockWeighment: canLockWeighmentAction,
      canEditWeight: canEditWeightAction,
    });
  }, [detailLot, currentRole, detailStatus, canLockWeighmentAction, canEditWeightAction]);

  const refreshDetail = async () => {
    if (!selectedRow) return;
    await handleOpenDetail(selectedRow);
    await loadData();
  };

  const openWeightDialog = () => {
    setWeightActionError(null);
    setWeightReason("");
    setWeightNewValue(detailWeightKg !== null && detailWeightKg !== undefined ? String(detailWeightKg) : "");
    setWeightDialogOpen(true);
  };

  const detailBagsNumber = Number(detailBags);
  const hasValidBagsForWeightEdit = Number.isFinite(detailBagsNumber) && detailBagsNumber > 0;
  const currentTotalWeightNumber = Number(detailWeightKg);
  const currentPerBagWeightNumber = Number(detailWeightPerBagKg);
  const parsedNewWeightNumber = Number(weightNewValue);
  const hasValidNewWeightInput = Number.isFinite(parsedNewWeightNumber) && parsedNewWeightNumber > 0;
  const computedNewPerBagWeight = hasValidBagsForWeightEdit && hasValidNewWeightInput
    ? Number((parsedNewWeightNumber / detailBagsNumber).toFixed(3))
    : null;
  const hasWeightChange =
    hasValidNewWeightInput &&
    Number.isFinite(currentTotalWeightNumber) &&
    Number(parsedNewWeightNumber.toFixed(3)) !== Number(currentTotalWeightNumber.toFixed(3));
  const weightReasonRequired = hasWeightChange;
  const canSubmitWeightEdit = Boolean(
    hasValidBagsForWeightEdit &&
      hasValidNewWeightInput &&
      hasWeightChange &&
      weightReason.trim()
  );

  const runUpdateWeight = async () => {
    const username = currentUsername();
    if (!username || !detailLot) return;
    setWeightActionError(null);
    const parsed = Number(weightNewValue);
    if (!hasValidBagsForWeightEdit) {
      setWeightActionError("Lot bags must be greater than zero for recalculation.");
      return;
    }
    if (!Number.isFinite(parsed) || parsed <= 0) {
      setWeightActionError("New total weight must be greater than zero.");
      return;
    }
    if (
      Number.isFinite(currentTotalWeightNumber) &&
      Number(parsed.toFixed(3)) === Number(currentTotalWeightNumber.toFixed(3))
    ) {
      setWeightActionError("No changes detected.");
      return;
    }
    if (hasWeightChange && !weightReason.trim()) {
      setWeightActionError("Reason is required when changing lot weight.");
      return;
    }
    setActionLoading(true);
    try {
      const resp = await updateLotWeight({
        username,
        language,
        lot_id: detailLot._id || detailLot.lot_id,
        new_weight_kg: parsed,
        reason: weightReason.trim(),
        client_request_id: `${username}-${Date.now()}-weight`,
      });
      const rc = resp?.response?.responsecode || resp?.responsecode || "1";
      if (String(rc) !== "0") {
        const msg = resp?.response?.description || resp?.description || "Unable to update weight.";
        setWeightActionError(msg);
        return;
      }
      setWeightDialogOpen(false);
      await refreshDetail();
    } catch (err: any) {
      setWeightActionError(err?.message || "Unable to update weight.");
    } finally {
      setActionLoading(false);
    }
  };

  const loadAuctionResult = useCallback(async () => {
    const username = currentUsername();
    if (!username || !detailLot) return;
    if (!uiState.shouldFetchAuctionResult) {
      setAuctionResultLoading(false);
      setAuctionResult(null);
      setAuctionResultError(null);
      return;
    }
    const orgId = detailLot?.org_id || detailLot?.orgId;
    const mandiId = detailLot?.mandi_id ?? detailLot?.mandiId;
    const sessionId = detailLot?.session_id || detailLot?.auction_session_id || detailLot?.links?.session_id;
    const lotId = detailLot?._id || detailLot?.lot_id || detailLot?.lotId;
    const lotCode = detailLot?.lot_code || detailLot?.lotCode;
    const tokenCode = detailLot?.token_code || detailLot?.tokenCode;
    if (!orgId || !lotId || mandiId == null) return;
    try {
      setAuctionResultLoading(true);
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
        const desc = String(resp?.response?.description || "").trim();
        // For pre-auction and mapped/auction-in-progress stages, "not found" is a normal empty state.
        if (isAuctionNotFoundMessage(desc)) {
          const currentStatus = normalizeStatus(detailLot?.status);
          if (PRE_AUCTION_STATUSES.has(currentStatus) || currentStatus === "MAPPED_TO_AUCTION" || currentStatus === "IN_AUCTION") {
            setAuctionResult(null);
            setAuctionResultError(null);
            return;
          }
        }
        setAuctionResult(null);
        setAuctionResultError(resp?.response?.description || "Unable to load auction result.");
        return;
      }
      setAuctionResult(resp?.data || null);
    } catch (err: any) {
      setAuctionResult(null);
      setAuctionResultError(err?.message || "Unable to load auction result.");
    } finally {
      setAuctionResultLoading(false);
    }
  }, [detailLot, language, uiState.shouldFetchAuctionResult]);

  const loadSettlementDetail = useCallback(async () => {
    const username = currentUsername();
    if (!username || !detailLot?.settlement_id) return;
    if (!uiState.shouldFetchSettlementDetail) {
      setSettlementDetailLoading(false);
      setSettlementDetail(null);
      setSettlementDetailError(null);
      return;
    }
    try {
      setSettlementDetailLoading(true);
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
    } finally {
      setSettlementDetailLoading(false);
    }
  }, [detailLot, language, uiState.shouldFetchSettlementDetail]);

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
      <Stack spacing={2.2}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, md: 2.5 },
            border: "1px solid",
            borderColor: alpha(theme.palette.success.main, 0.18),
            borderRadius: 2.5,
            bgcolor: alpha(theme.palette.success.light, 0.06),
          }}
        >
          <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={1.5}>
            <Stack spacing={0.5}>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {t("menu.lots", { defaultValue: "Lots" })}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Live operations view for gate-linked lots, status progress, and settlement readiness.
              </Typography>
            </Stack>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ color: "text.secondary" }}>
              <RefreshIcon fontSize="small" />
              <Typography variant="caption">
                Last refreshed: {lastRefreshedAt ? formatDate(lastRefreshedAt) : "—"}
              </Typography>
            </Stack>
          </Stack>
        </Paper>

        {loading && rows.length === 0 ? (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25}>
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} variant="rounded" height={74} sx={{ flex: 1, borderRadius: 2 }} />
            ))}
          </Stack>
        ) : (
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.25} flexWrap="wrap">
            <DashboardMetricCard label="Total Lots" value={dashboardMetrics.total} icon={<Inventory2OutlinedIcon fontSize="small" />} />
            <DashboardMetricCard label="Created" value={dashboardMetrics.created} icon={<LocalShippingOutlinedIcon fontSize="small" />} />
            <DashboardMetricCard label="Verified" value={dashboardMetrics.verified} icon={<VerifiedOutlinedIcon fontSize="small" />} />
            <DashboardMetricCard label="Mapped To Auction" value={dashboardMetrics.mapped} icon={<MapOutlinedIcon fontSize="small" />} />
            <DashboardMetricCard label="Settlement Pending" value={dashboardMetrics.settlementPending} icon={<PendingActionsOutlinedIcon fontSize="small" />} />
          </Stack>
        )}

        <Paper
          elevation={0}
          sx={{
            p: { xs: 1.5, md: 2 },
            borderRadius: 2.5,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: alpha(theme.palette.background.paper, 0.98),
          }}
        >
          <Stack direction={{ xs: "column", lg: "row" }} spacing={1.25} alignItems={{ lg: "center" }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 170 }}>
              <FilterAltOutlinedIcon fontSize="small" sx={{ color: "text.secondary" }} />
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Filters
              </Typography>
            </Stack>

            <FormControl size="small" sx={{ minWidth: { xs: "100%", sm: 170 } }}>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <MenuItem value="">All</MenuItem>
                {STATUS_OPTIONS.map((status) => (
                  <MenuItem key={status} value={status}>
                    {humanizeLotStatus(status)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Mandi ID"
              size="small"
              value={mandiFilter}
              onChange={(e) => setMandiFilter(e.target.value)}
              sx={{ minWidth: { xs: "100%", sm: 150 } }}
            />

            <TextField
              label="Token Code"
              size="small"
              value={tokenFilter}
              onChange={(e) => setTokenFilter(e.target.value)}
              sx={{ minWidth: { xs: "100%", sm: 220 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            <Box sx={{ flex: 1 }} />
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
              <Button
                variant="outlined"
                onClick={() => {
                  setStatusFilter("");
                  setMandiFilter("");
                  setTokenFilter("");
                }}
                disabled={loading || (!statusFilter && !mandiFilter && !tokenFilter)}
              >
                Clear
              </Button>
              <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading}>
                Refresh
              </Button>
              {canCreateLot && (
                <Button variant="contained" onClick={() => navigate("/lots/create")}>
                  {t("actions.createLot", { defaultValue: "Create Lot" })}
                </Button>
              )}
            </Stack>
          </Stack>
        </Paper>

        <Paper
          elevation={0}
          sx={{
            p: 1,
            borderRadius: 2.5,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: alpha(theme.palette.background.paper, 0.98),
            overflow: "hidden",
          }}
        >
          {loading && <LinearProgress sx={{ borderRadius: 1, mb: 1 }} />}
          {!loading && rows.length === 0 && (
            <Box
              sx={{
                mb: 1,
                p: 2,
                borderRadius: 2,
                border: "1px dashed",
                borderColor: alpha(theme.palette.success.main, 0.3),
                bgcolor: alpha(theme.palette.success.light, 0.06),
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                No lots found for the current filters
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Try clearing one or more filters, or refresh to load the latest lots.
              </Typography>
            </Box>
          )}
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
              sx={{
                bgcolor: "transparent",
                "& .MuiDataGrid-columnHeaders": {
                  position: "sticky",
                  top: 0,
                  zIndex: 1,
                  bgcolor: alpha(theme.palette.success.light, 0.14),
                  borderBottom: "1px solid",
                  borderColor: alpha(theme.palette.success.main, 0.22),
                  backdropFilter: "blur(2px)",
                },
                "& .MuiDataGrid-columnHeaderTitle": {
                  fontWeight: 800,
                  color: "text.primary",
                  letterSpacing: 0.15,
                },
                "& .MuiDataGrid-cell": {
                  borderBottomColor: alpha(theme.palette.text.primary, 0.08),
                  py: 0.7,
                },
                "& .MuiDataGrid-row": {
                  cursor: "pointer",
                  transition: "background-color 120ms ease",
                },
                "& .MuiDataGrid-row:hover": {
                  bgcolor: alpha(theme.palette.success.main, 0.08),
                },
                "& .MuiDataGrid-row.Mui-selected, & .MuiDataGrid-row.Mui-selected:hover": {
                  bgcolor: alpha(theme.palette.success.main, 0.12),
                },
                "& .MuiDataGrid-footerContainer": {
                  borderTop: "1px solid",
                  borderColor: alpha(theme.palette.text.primary, 0.12),
                  minHeight: 52,
                  px: 0.5,
                  bgcolor: alpha(theme.palette.background.default, 0.7),
                },
              }}
            />
          </Box>
        </Paper>
      </Stack>

      <Dialog
        open={!!selectedRow}
        onClose={() => setSelectedRow(null)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            overflow: "hidden",
            boxShadow: `0 10px 30px ${alpha(theme.palette.common.black, 0.12)}`,
            bgcolor: "background.default",
          },
        }}
      >
        <DialogTitle
          sx={{
            position: "sticky",
            top: 0,
            zIndex: 2,
            bgcolor: "background.paper",
            borderBottom: "1px solid",
            borderColor: "divider",
            pb: 1.5,
          }}
        >
          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={1.5} alignItems={{ sm: "center" }}>
            <Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                {displayValue(detailLot?.lot_code, "Lot Details")}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Token {displayValue(detailLot?.token_code)}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
              <Chip
                label={humanizeLotStatus(detailLot?.status)}
                variant="outlined"
                sx={buildStatusChipSx(theme, detailLot?.status)}
              />
              <Button
                size="small"
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={refreshDetail}
                disabled={detailLoading || actionLoading}
              >
                Refresh
              </Button>
            </Stack>
          </Stack>
          {isDetailBusy && <LinearProgress sx={{ mt: 1 }} />}
        </DialogTitle>

        <DialogContent sx={{ bgcolor: "background.default" }}>
          {detailLoading && <Typography variant="body2" color="text.secondary">Loading lot detail…</Typography>}
          {detailError && <Typography variant="body2" color="error">{detailError}</Typography>}
          {!detailLoading && !detailError && (
            <Stack spacing={2.5}>
              <SectionCard
                title="Actions"
                helper={
                  isWorkflowReadOnly
                    ? "This lot is read-only in its current lifecycle stage."
                    : "Use actions to progress the workflow."
                }
              >
                {actionError && (
                  <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                    {actionError}
                  </Typography>
                )}
                <Stack direction={{ xs: "column", sm: "row" }} spacing={1} flexWrap="wrap" alignItems={{ sm: "center" }}>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {canLockWeighmentAction && (
                      <Button size="small" variant="contained" onClick={() => runStatusUpdate("WEIGHMENT_LOCKED")} disabled={actionLoading}>
                        Lock Weighment
                      </Button>
                    )}
                    {canVerifyAction && (
                      <Button size="small" variant="contained" onClick={runVerifyLot} disabled={actionLoading}>
                        Verify
                      </Button>
                    )}
                    {detailLot && canEditWeightAction && (
                      <Button size="small" variant="outlined" onClick={openWeightDialog} disabled={actionLoading || !uiState.canEditWeight}>
                        Edit Weight
                      </Button>
                    )}
                  </Stack>
                  <Box sx={{ flex: 1 }} />
                  {canCancelAction && (
                    <Button size="small" variant="outlined" color="error" onClick={() => setCancelDialogOpen(true)} disabled={actionLoading}>
                      Cancel
                    </Button>
                  )}
                </Stack>
              </SectionCard>

              <SectionCard
                title="Settlement"
                right={
                  <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" justifyContent="flex-end">
                    <Chip
                      size="small"
                      variant="outlined"
                      label={buildSettlementStateChip(theme, uiState).label}
                      sx={buildSettlementStateChip(theme, uiState).sx}
                    />
                    {canGenerateSettlement && (
                      <Button size="small" variant="contained" onClick={openSettlementDialog} disabled={actionLoading}>
                        Generate Settlement
                      </Button>
                    )}
                  </Stack>
                }
              >
                {(uiState.settlementDisplayState === "ERROR_PERMISSION" || uiState.settlementDisplayState === "ERROR_UNKNOWN") && (
                  <Typography variant="body2" color="error" sx={{ mb: 1 }}>
                    {settlementErrorText}
                  </Typography>
                )}
                <Box>
                  <FieldRow label="Settlement Code" value={settlementCode} />
                  <FieldRow label="Payment Mode" value={settlementPaymentMode} />
                  <FieldRow label="Winner" value={settlementWinner} />
                  <FieldRow label="Final Amount" value={settlementAmount} />
                  <FieldRow label="Session Code" value={resultSessionCode} />
                </Box>
                {getSettlementHelperText(uiState) && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                    {getSettlementHelperText(uiState)}
                  </Typography>
                )}
              </SectionCard>

              <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
                <Stack spacing={2} sx={{ flex: 1 }}>
                  <SectionCard title="Lot Summary">
                    <FieldRow label="Lot Code" value={detailLot?.lot_code} />
                    <FieldRow label="Status" value={humanizeLotStatus(detailLot?.status)} />
                    <FieldRow label="Token Code" value={detailLot?.token_code} />
                  </SectionCard>

                  <SectionCard title="Context">
                    <FieldRow label="Org" value={detailLot?.org_name || detailLot?.org_name_en || detailLot?.org_code} />
                    <FieldRow label="Mandi" value={detailLot?.mandi_name || detailLot?.mandi_name_en || detailLot?.mandi_id} />
                    <FieldRow label="Gate" value={detailGateLabel} />
                    <FieldRow label="Vehicle" value={detailLot?.vehicle_no} />
                    <FieldRow label="Reason Label" value={detailLot?.reason_label} />
                  </SectionCard>

                  <SectionCard title="Party">
                    <FieldRow label="Party Kind" value={humanizePartyKind(detailParty?.kind || detailLot?.party_kind)} />
                    <FieldRow label="Party Type" value={humanizePartyType(detailParty?.party_type || detailLot?.party_type)} />
                    {shouldShowPartyRow && <FieldRow label="Party" value={detailPartyDisplay} />}
                    <FieldRow label="Username / Mobile" value={usernameMobileCombined} />
                    <FieldRow label="Walk-in Name" value={detailWalkin?.name} />
                    <FieldRow label="Walk-in Mobile" value={detailWalkin?.mobile} />
                  </SectionCard>
                </Stack>

                <Stack spacing={2} sx={{ flex: 1 }}>
                  <SectionCard title="Commodity">
                    <FieldRow label="Commodity" value={detailCommodityName} />
                    <FieldRow label="Product" value={detailProductName} />
                    <FieldRow label="Quality Grade" value={detailLot?.quality_grade} />
                  </SectionCard>

                  <SectionCard
                    title="Quantity"
                    helper={
                      !weightEditAllowed
                        ? `Weight edit blocked: ${detailLot?.workflow?.weight_edit_block_reason || "Not allowed"}.`
                        : null
                    }
                  >
                    <FieldRow label="Bags" value={formatNumber(detailBags)} />
                    <FieldRow label="Weight per bag (kg)" value={formatNumber(detailWeightPerBagKg)} />
                    <FieldRow label="Total weight (kg)" value={formatNumber(detailWeightKg)} />
                    <Divider sx={{ my: 1 }} />
                    <FieldRow label="Gross weight (kg)" value={formatNumber(detailLot?.gross_weight_kg)} />
                    <FieldRow label="Net weight (kg)" value={formatNumber(detailLot?.net_weight_kg)} />
                    <FieldRow label="Auctionable weight (kg)" value={formatNumber(detailLot?.auctionable_weight_kg)} />
                    <FieldRow label="Settlement weight (kg)" value={formatNumber(detailLot?.settlement_weight_kg)} />
                    <FieldRow label="Authoritative weight (kg)" value={formatNumber(detailLot?.authoritative_weight_kg)} />
                    <FieldRow label="Authoritative stage" value={detailLot?.authoritative_weight_stage} />
                  </SectionCard>

                  <SectionCard title="Audit">
                    <FieldRow label="Created By" value={detailLot?.created_by} />
                    <FieldRow label="Updated By" value={detailLot?.updated_by} />
                    <FieldRow label="Created On" value={formatDate(detailLot?.created_on) || "—"} />
                    <FieldRow label="Updated On" value={formatDate(detailLot?.updated_on) || "—"} />
                  </SectionCard>
                </Stack>
              </Stack>

              <SectionCard title="Timeline" helper="Recent events and edits">
                {(!detailLot?.history || detailLot.history.length === 0) && (
                  <Typography variant="body2" color="text.secondary">
                    No events yet.
                  </Typography>
                )}
                {detailLot?.history && detailLot.history.length > 0 && (
                  <Stack spacing={1.25}>
                    {detailLot.history.map((event: any, idx: number) => (
                      <Box
                        key={event._id || idx}
                        sx={{
                          p: 1.25,
                          border: "1px solid",
                          borderColor: "divider",
                          borderRadius: 2,
                          bgcolor: alpha(theme.palette.background.paper, 0.9),
                        }}
                      >
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5, flexWrap: "wrap" }}>
                          <Chip
                            size="small"
                            label={displayValue(event.event_type || "EVENT")}
                            variant="outlined"
                            sx={{ height: 22, fontWeight: 700, bgcolor: alpha(theme.palette.text.primary, 0.04) }}
                          />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {displayValue(event.from_status || "")} → {displayValue(event.to_status || "")}
                          </Typography>
                        </Stack>

                        {event.event_type === "FIELDS_UPDATED" && event.diff?.quantity && (
                          <Box sx={{ mt: 0.25 }}>
                            {event.diff.quantity.weight_per_bag_kg && (
                              <Typography variant="body2" color="text.secondary">
                                Weight per bag: {formatNumber(event.diff.quantity.weight_per_bag_kg.from)} →{" "}
                                <Box component="span" sx={{ color: "text.primary", fontWeight: 700 }}>
                                  {formatNumber(event.diff.quantity.weight_per_bag_kg.to)}
                                </Box>
                              </Typography>
                            )}
                            {event.diff.quantity.weight_kg && (
                              <Typography variant="body2" color="text.secondary">
                                Total weight: {formatNumber(event.diff.quantity.weight_kg.from)} →{" "}
                                <Box component="span" sx={{ color: "text.primary", fontWeight: 700 }}>
                                  {formatNumber(event.diff.quantity.weight_kg.to)}
                                </Box>
                              </Typography>
                            )}
                          </Box>
                        )}

                        {event.reason && (
                          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                            Reason: {event.reason}
                          </Typography>
                        )}
                        {event.created_on && (
                          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                            {formatDate(event.created_on)} • {event.created_by || ""}
                          </Typography>
                        )}
                      </Box>
                    ))}
                  </Stack>
                )}
              </SectionCard>

              <Accordion disableGutters sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Typography variant="subtitle2">Debug Data</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ bgcolor: "background.paper" }}>
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      p: 2,
                      bgcolor: "background.default",
                      borderRadius: 2,
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
        <DialogActions sx={{ bgcolor: "background.paper", borderTop: "1px solid", borderColor: "divider" }}>
          <Button onClick={() => setSelectedRow(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={weightDialogOpen} onClose={() => setWeightDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Lot Weight</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            {weightActionError && <Typography color="error">{weightActionError}</Typography>}
            <Typography variant="body2" color="text.secondary">
              Bags will remain unchanged. Weight per bag will be recalculated automatically.
            </Typography>
            <TextField
              label="Bags"
              size="small"
              value={hasValidBagsForWeightEdit ? String(detailBagsNumber) : "—"}
              fullWidth
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="Current Weight Per Bag (kg)"
              size="small"
              value={Number.isFinite(currentPerBagWeightNumber) ? formatWeight(currentPerBagWeightNumber) : "—"}
              fullWidth
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="Current Total Weight (kg)"
              size="small"
              value={Number.isFinite(currentTotalWeightNumber) ? formatWeight(currentTotalWeightNumber) : "—"}
              fullWidth
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="New Total Weight (kg)"
              size="small"
              value={weightNewValue}
              onChange={(e) => setWeightNewValue(e.target.value)}
              type="number"
              inputProps={{ min: 0, step: 0.1 }}
              fullWidth
              disabled={actionLoading}
            />
            <TextField
              label="New Weight Per Bag (kg)"
              size="small"
              value={computedNewPerBagWeight !== null ? formatWeight(computedNewPerBagWeight) : "—"}
              fullWidth
              InputProps={{ readOnly: true }}
            />
            <TextField
              label="Reason"
              size="small"
              value={weightReason}
              onChange={(e) => setWeightReason(e.target.value)}
              fullWidth
              disabled={actionLoading}
              required={weightReasonRequired}
              helperText={weightReasonRequired ? "Reason is required for weight changes." : "Reason is required when changing total weight."}
            />
            {hasValidBagsForWeightEdit && Number.isFinite(currentTotalWeightNumber) && computedNewPerBagWeight !== null && (
              <Box sx={{ p: 1.25, borderRadius: 1.5, border: "1px dashed", borderColor: "divider" }}>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                  Before
                </Typography>
                <Typography variant="body2">
                  Bags: {detailBagsNumber} · Weight/Bag: {formatWeight(currentPerBagWeightNumber)} · Total: {formatWeight(currentTotalWeightNumber)}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1, mb: 0.5 }}>
                  After
                </Typography>
                <Typography variant="body2">
                  Bags: {detailBagsNumber} · Weight/Bag: {formatWeight(computedNewPerBagWeight)} · Total: {hasValidNewWeightInput ? formatWeight(parsedNewWeightNumber) : "—"}
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWeightDialogOpen(false)} disabled={actionLoading}>Cancel</Button>
          <Button variant="contained" onClick={runUpdateWeight} disabled={actionLoading || !canSubmitWeightEdit}>
            Save
          </Button>
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
