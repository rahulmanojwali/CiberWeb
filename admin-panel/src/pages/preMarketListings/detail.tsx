import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { PageContainer } from "../../components/PageContainer";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { normalizeLanguageCode } from "../../config/languages";
import { useTranslation } from "react-i18next";
import {
  fetchPreMarketListingDetail,
  markPreMarketArrival,
  linkLotToPreMarketListing,
  cancelPreMarketListing,
} from "../../services/preMarketListingsApi";

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

export const PreMarketListingDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { enqueueSnackbar } = useSnackbar();
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();

  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [arriveOpen, setArriveOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);

  const [tokenId, setTokenId] = useState("");
  const [tokenCode, setTokenCode] = useState("");
  const [lotId, setLotId] = useState("");
  const [cancelReason, setCancelReason] = useState("");

  const canView = useMemo(() => can("pre_market_listings.detail", "VIEW"), [can]);
  const canArrive = useMemo(() => can("pre_market_listings.arrive", "UPDATE"), [can]);
  const canLink = useMemo(() => can("pre_market_listings.link", "UPDATE"), [can]);
  const canCancel = useMemo(() => can("pre_market_listings.cancel", "UPDATE"), [can]);

  const status = String(detail?.status || "").toUpperCase();

  const loadDetail = async () => {
    if (!id) return;
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await fetchPreMarketListingDetail({
        username,
        language,
        listing_id: id,
        org_id: uiConfig.scope?.org_id || undefined,
      });
      const code = resp?.response?.responsecode || resp?.responsecode || "1";
      if (code !== "0") {
        setError(resp?.response?.description || "Unable to load listing.");
        setDetail(null);
      } else {
        const payload = resp?.data?.listing || resp?.response?.data?.listing || null;
        setDetail(payload);
      }
    } catch (err: any) {
      setError(err?.message || "Unable to load listing.");
      setDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canView) loadDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, canView]);

  const handleArrive = async () => {
    const username = currentUsername();
    if (!username || !id) return;
    if (!tokenId.trim() && !tokenCode.trim()) {
      enqueueSnackbar("Provide token id or token code.", { variant: "warning" });
      return;
    }
    try {
      const resp = await markPreMarketArrival({
        username,
        language,
        payload: {
          listing_id: id,
          token_id: tokenId.trim() || undefined,
          token_code: tokenCode.trim() || undefined,
          org_id: uiConfig.scope?.org_id || undefined,
        },
      });
      const code = resp?.response?.responsecode || resp?.responsecode || "1";
      const desc = resp?.response?.description || resp?.description || "Failed to mark arrival.";
      if (code !== "0") {
        enqueueSnackbar(desc, { variant: "error" });
        return;
      }
      enqueueSnackbar("Marked arrived.", { variant: "success" });
      setArriveOpen(false);
      setTokenId("");
      setTokenCode("");
      await loadDetail();
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Failed to mark arrival.", { variant: "error" });
    }
  };

  const handleLinkLot = async () => {
    const username = currentUsername();
    if (!username || !id) return;
    if (!lotId.trim()) {
      enqueueSnackbar("Provide lot id.", { variant: "warning" });
      return;
    }
    try {
      const resp = await linkLotToPreMarketListing({
        username,
        language,
        payload: {
          listing_id: id,
          lot_id: lotId.trim(),
          org_id: uiConfig.scope?.org_id || undefined,
        },
      });
      const code = resp?.response?.responsecode || resp?.responsecode || "1";
      const desc = resp?.response?.description || resp?.description || "Failed to link lot.";
      if (code !== "0") {
        enqueueSnackbar(desc, { variant: "error" });
        return;
      }
      enqueueSnackbar("Lot linked.", { variant: "success" });
      setLinkOpen(false);
      setLotId("");
      await loadDetail();
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Failed to link lot.", { variant: "error" });
    }
  };

  const handleCancel = async () => {
    const username = currentUsername();
    if (!username || !id) return;
    try {
      const resp = await cancelPreMarketListing({
        username,
        language,
        payload: {
          listing_id: id,
          cancel_reason: cancelReason.trim() || undefined,
          org_id: uiConfig.scope?.org_id || undefined,
        },
      });
      const code = resp?.response?.responsecode || resp?.responsecode || "1";
      const desc = resp?.response?.description || resp?.description || "Failed to cancel.";
      if (code !== "0") {
        enqueueSnackbar(desc, { variant: "error" });
        return;
      }
      enqueueSnackbar("Listing cancelled.", { variant: "success" });
      setCancelOpen(false);
      setCancelReason("");
      await loadDetail();
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Failed to cancel.", { variant: "error" });
    }
  };

  if (!canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Forbidden: You do not have permission.</Typography>
      </PageContainer>
    );
  }

  if (loading) {
    return (
      <PageContainer>
        <Typography variant="body2">Loading...</Typography>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <Typography variant="body2" color="error">{error}</Typography>
      </PageContainer>
    );
  }

  if (!detail) {
    return (
      <PageContainer>
        <Typography variant="body2">No listing found.</Typography>
      </PageContainer>
    );
  }

  const farmer = detail.farmer || {};
  const produce = detail.produce || {};
  const links = detail.links || {};

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">{t("menu.preMarketListings", { defaultValue: "Pre-Market Listings" })}</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">Listing ID:</Typography>
            <Typography variant="body2">{detail.listing_id || detail._id || id}</Typography>
          </Stack>
        </Stack>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip label={status || "-"} />
          {status === "PRE_LISTED" && canArrive && (
            <Button variant="contained" onClick={() => setArriveOpen(true)}>Mark Arrived</Button>
          )}
          {status === "ARRIVED" && canLink && (
            <Button variant="contained" onClick={() => setLinkOpen(true)}>Link Lot</Button>
          )}
          {status === "PRE_LISTED" && canCancel && (
            <Button variant="outlined" color="error" onClick={() => setCancelOpen(true)}>Cancel</Button>
          )}
        </Stack>
      </Stack>

      <Stack spacing={2}>
        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>Farmer Info</Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1}>
              <Typography variant="body2">Name: {farmer.name || farmer.full_name || farmer.display_name || "-"}</Typography>
              <Typography variant="body2">Mobile: {farmer.mobile || farmer.phone || farmer.username || "-"}</Typography>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>Produce Info</Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1}>
              <Typography variant="body2">Commodity: {produce.commodity_product_name || produce.commodity_name || produce.product_name || "-"}</Typography>
              <Typography variant="body2">Bags: {produce.bags ?? produce.bags_count ?? detail.bags ?? "-"}</Typography>
              <Typography variant="body2">Weight/Bag: {produce.weight_per_bag ?? detail.weight_per_bag ?? "-"}</Typography>
              <Typography variant="body2">Market Date: {detail?.market_day?.date || detail.market_date || "-"}</Typography>
            </Stack>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom>Status & Links</Typography>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1}>
              <Typography variant="body2">Status: {status || "-"}</Typography>
              <Typography variant="body2">Token ID: {links.token_id || "-"}</Typography>
              <Typography variant="body2">Token Code: {links.token_code || "-"}</Typography>
              <Typography variant="body2">Lot ID: {links.lot_id || "-"}</Typography>
              <Typography variant="body2">Created On: {formatDate(detail.created_on)}</Typography>
              <Typography variant="body2">Updated On: {formatDate(detail.updated_on)}</Typography>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      <Dialog open={arriveOpen} onClose={() => setArriveOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Mark Arrived</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Token ID"
              value={tokenId}
              onChange={(e) => setTokenId(e.target.value)}
              placeholder="ObjectId"
              fullWidth
            />
            <TextField
              label="Token Code"
              value={tokenCode}
              onChange={(e) => setTokenCode(e.target.value)}
              placeholder="Token code"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setArriveOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleArrive}>Confirm</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={linkOpen} onClose={() => setLinkOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Link Lot</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Lot ID"
              value={lotId}
              onChange={(e) => setLotId(e.target.value)}
              placeholder="ObjectId"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setLinkOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleLinkLot}>Link</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={cancelOpen} onClose={() => setCancelOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cancel Listing</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Reason"
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Optional reason"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCancelOpen(false)}>Close</Button>
          <Button variant="contained" color="error" onClick={handleCancel}>Cancel Listing</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
