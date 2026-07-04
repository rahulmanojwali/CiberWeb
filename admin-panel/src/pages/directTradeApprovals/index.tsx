import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import PublishedWithChangesOutlinedIcon from "@mui/icons-material/PublishedWithChangesOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import BrokenImageOutlinedIcon from "@mui/icons-material/BrokenImageOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import ChangeCircleOutlinedIcon from "@mui/icons-material/ChangeCircleOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import { useSnackbar } from "notistack";
import { PageContainer } from "../../components/PageContainer";
import {
  getDirectTradeApprovalDetails,
  listDirectTradeApprovalQueue,
  updateDirectTradeApprovalStatus,
} from "../../services/directTradeApprovalsApi";

const STATUS_OPTIONS = [
  { value: "PENDING_APPROVAL", label: "Pending Approval" },
  { value: "RESUBMITTED", label: "Resubmitted" },
  { value: "CHANGE_REQUEST", label: "Change Requested" },
  { value: "REJECTED", label: "Rejected" },
  { value: "APPROVED", label: "Approved" },
  { value: "PUBLISHED", label: "Published" },
  { value: "ALL", label: "All" },
];

const MEDIA_FILTERS = [
  { value: "ALL", label: "All Media" },
  { value: "MISSING_PHOTO", label: "Missing Images" },
  { value: "MISSING_VIDEO", label: "Missing Video" },
];

const LOCAL_REASONS = [
  "Wrong product image",
  "Poor image quality",
  "Image does not match product",
  "Video does not match product",
  "Video not clear",
  "Duplicate media",
  "Inappropriate media",
  "Location mismatch",
  "Product details mismatch",
  "Media deleted / removed",
  "Media corrupted",
  "Upload failed",
  "Under moderation",
  "Other",
];

function getStoredUser() {
  try {
    const raw = localStorage.getItem("cd_user");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function normalizeRole(role?: string | null) {
  return String(role || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function fmtDate(value: any) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString();
}

function money(price: any) {
  if (!price) return "-";
  const amount = price.amount ?? price.expected_rate_qtl ?? price.value;
  const unit = price.per_unit || price.unit || "unit";
  return amount !== undefined && amount !== null ? `₹${amount} / ${unit}` : "-";
}

function qty(quantity: any) {
  if (!quantity) return "-";
  const value = quantity.value ?? quantity.quantity ?? quantity.weight_kg;
  const unit = quantity.unit || quantity.unit_name || "";
  return value !== undefined && value !== null ? `${value} ${unit}`.trim() : "-";
}

function responseOk(resp: any) {
  const code = String(resp?.response?.responsecode ?? resp?.responsecode ?? "1");
  return code === "0" || code === "00";
}

function responseMessage(resp: any, fallback: string) {
  return resp?.response?.description || resp?.description || fallback;
}

const MediaThumb: React.FC<{ media: any; onClick: () => void }> = ({ media, onClick }) => {
  const isVideo = String(media?.type).toUpperCase() === "VIDEO";
  const thumb = media?.thumbnail_url || media?.url;
  return (
    <Box
      onClick={onClick}
      sx={{
        width: 86,
        height: 70,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 1.5,
        overflow: "hidden",
        position: "relative",
        cursor: "pointer",
        bgcolor: "background.default",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {thumb ? (
        <Box component="img" src={thumb} alt={media?.media_id || "media"} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <BrokenImageOutlinedIcon color="disabled" />
      )}
      {isVideo && (
        <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", bgcolor: "rgba(0,0,0,.18)" }}>
          <PlayCircleOutlineIcon sx={{ color: "white", fontSize: 34 }} />
        </Box>
      )}
    </Box>
  );
};

const DirectTradeApprovalsPage: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();
  const user = getStoredUser();
  const username = user?.username || "";
  const role = normalizeRole(user?.default_role_code || user?.role_slug || user?.role_code || user?.role);
  const [rows, setRows] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState("PENDING_APPROVAL");
  const [mediaType, setMediaType] = useState("ALL");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [details, setDetails] = useState<any | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<any | null>(null);
  const [actionOpen, setActionOpen] = useState<null | "APPROVE" | "REJECT" | "REQUEST_CHANGES">(null);
  const [remarks, setRemarks] = useState("");
  const [actionBusy, setActionBusy] = useState(false);
  const [missingPhotoReason, setMissingPhotoReason] = useState("MEDIA_DELETED");
  const [missingVideoReason, setMissingVideoReason] = useState("MEDIA_DELETED");

  const roleCopy = useMemo(() => {
    if (role === "PLATFORM_APPROVER") {
      return {
        title: "Final Approval Queue",
        description: "Review Level-1 verified Direct Trade listings and publish or reject them after final validation.",
        stage: "Level 2 Approval",
      };
    }
    if (role === "PLATFORM_SUPERVISOR" || role === "PLATFORM_OPERATIONS_MANAGER") {
      return {
        title: "Operations Approval Queue",
        description: "Monitor Direct Trade approvals, escalations, pending reviews, final approvals and rejected listings.",
        stage: "Operations Control",
      };
    }
    return {
      title: "Pending Review Queue",
      description: "Review newly submitted Direct Trade listings, check product/media/location details and mark them ready for final approval.",
      stage: "Level 1 Review",
    };
  }, [role]);

  async function loadQueue(nextPage = page, nextLimit = limit) {
    if (!username) return;
    setLoading(true);
    try {
      const data = await listDirectTradeApprovalQueue({
        username,
        filters: {
          page: nextPage + 1,
          limit: nextLimit,
          status,
          search,
          media_type: mediaType === "ALL" ? "" : mediaType,
        },
      });
      setRows(Array.isArray(data?.items) ? data.items : []);
      setCounts(data?.counts || {});
      setTotal(Number(data?.total || 0));
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Failed to load Direct Trade approvals", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function openDetails(row: any) {
    setSelected(row);
    setDetails(null);
    setDetailsLoading(true);
    try {
      const data = await getDirectTradeApprovalDetails({ username, listing_id: row.listing_id });
      setDetails(data);
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Failed to load listing details", { variant: "error" });
    } finally {
      setDetailsLoading(false);
    }
  }

  async function submitAction() {
    const listingId = details?.listing?.listing_id || selected?.listing_id;
    if (!listingId || !actionOpen) return;
    if ((actionOpen === "REJECT" || actionOpen === "REQUEST_CHANGES") && !remarks.trim()) {
      enqueueSnackbar("Remarks are required for reject/request changes.", { variant: "warning" });
      return;
    }
    setActionBusy(true);
    try {
      const resp = await updateDirectTradeApprovalStatus({
        username,
        listing_id: listingId,
        approval_action: actionOpen,
        remarks,
      });
      if (responseOk(resp)) {
        enqueueSnackbar(responseMessage(resp, "Approval updated"), { variant: "success" });
        setActionOpen(null);
        setRemarks("");
        setSelected(null);
        setDetails(null);
        await loadQueue();
      } else {
        enqueueSnackbar(responseMessage(resp, "Unable to update approval"), { variant: "error" });
      }
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Unable to update approval", { variant: "error" });
    } finally {
      setActionBusy(false);
    }
  }

  useEffect(() => {
    loadQueue(0, limit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, status, mediaType]);

  const currentMedia = details?.media || details?.listing?.media || [];
  const issueReasons = (details?.issue_reasons || []).map((r: any) => r.label || r.code).filter(Boolean);
  const reasons = issueReasons.length ? issueReasons : LOCAL_REASONS;
  const detailListing = details?.listing || selected;

  return (
    <PageContainer title="Direct Trade Approvals" subtitle="CiberMandi internal review and approval workspace for Direct Trade listings.">
      <Stack spacing={2}>
        <Alert severity="info">
          You are signed in as <strong>{username || "platform user"}</strong>. Role: <strong>{role || "PLATFORM"}</strong>. Pending listings, images and videos are now loaded from the Direct Trade approval APIs.
        </Alert>

        <Card>
          <CardContent>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} justifyContent="space-between">
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <AssignmentTurnedInOutlinedIcon color="primary" />
                  <Typography variant="h5" fontWeight={700}>{roleCopy.title}</Typography>
                </Stack>
                <Typography color="text.secondary">{roleCopy.description}</Typography>
              </Box>
              <Stack direction="row" spacing={1}>
                <Chip color="primary" label={roleCopy.stage} />
                <Button startIcon={<RefreshOutlinedIcon />} onClick={() => loadQueue()} disabled={loading}>Refresh</Button>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card><CardContent><Stack direction="row" spacing={1} alignItems="center"><FactCheckOutlinedIcon color="warning" /><Typography variant="h6">Pending</Typography></Stack><Typography variant="h4" sx={{ mt: 2 }}>{counts.PENDING_APPROVAL || 0}</Typography><Typography color="text.secondary">Listings waiting for review.</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card><CardContent><Stack direction="row" spacing={1} alignItems="center"><PublishedWithChangesOutlinedIcon color="success" /><Typography variant="h6">Published / Approved</Typography></Stack><Typography variant="h4" sx={{ mt: 2 }}>{(counts.PUBLISHED || 0) + (counts.APPROVED || 0)}</Typography><Typography color="text.secondary">Listings already cleared.</Typography></CardContent></Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card><CardContent><Stack direction="row" spacing={1} alignItems="center"><AssignmentTurnedInOutlinedIcon color="error" /><Typography variant="h6">Needs Attention</Typography></Stack><Typography variant="h4" sx={{ mt: 2 }}>{(counts.REJECTED || 0) + (counts.CHANGE_REQUEST || 0)}</Typography><Typography color="text.secondary">Rejected or change-requested listings.</Typography></CardContent></Card>
          </Grid>
        </Grid>

        <Card>
          <CardContent>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} md={4}>
                <TextField fullWidth label="Search listing / farmer / product / location" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { setPage(0); loadQueue(0, limit); } }} />
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth><InputLabel>Status</InputLabel><Select label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}>{STATUS_OPTIONS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}</Select></FormControl>
              </Grid>
              <Grid item xs={12} md={3}>
                <FormControl fullWidth><InputLabel>Media</InputLabel><Select label="Media" value={mediaType} onChange={(e) => { setMediaType(e.target.value); setPage(0); }}>{MEDIA_FILTERS.map((o) => <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>)}</Select></FormControl>
              </Grid>
              <Grid item xs={12} md={2}>
                <Button fullWidth variant="contained" onClick={() => { setPage(0); loadQueue(0, limit); }} disabled={loading}>Apply</Button>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        <Card>
          {loading && <Box sx={{ p: 2, display: "flex", justifyContent: "center" }}><CircularProgress size={26} /></Box>}
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Media</TableCell>
                  <TableCell>Listing / Product</TableCell>
                  <TableCell>Farmer</TableCell>
                  <TableCell>Qty / Price</TableCell>
                  <TableCell>Pickup</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Submitted</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {!loading && rows.length === 0 && <TableRow><TableCell colSpan={8} align="center">No Direct Trade listings found for this filter.</TableCell></TableRow>}
                {rows.map((row) => {
                  const missingPhoto = Number(row?.media_summary?.missing_photo_count || 0);
                  const missingVideo = Number(row?.media_summary?.missing_video_count || 0);
                  return (
                    <TableRow key={row.listing_id} hover>
                      <TableCell sx={{ minWidth: 160 }}>
                        <Stack direction="row" spacing={1} flexWrap="wrap">
                          {(row.media || []).slice(0, 3).map((m: any) => <MediaThumb key={m.media_id} media={m} onClick={() => setMediaPreview(m)} />)}
                          {(!row.media || row.media.length === 0) && <Box sx={{ width: 86, height: 70, border: "1px dashed", borderColor: "divider", borderRadius: 1.5, display: "flex", alignItems: "center", justifyContent: "center" }}><ImageOutlinedIcon color="disabled" /></Box>}
                        </Stack>
                        <Stack direction="row" spacing={0.5} sx={{ mt: 1 }} flexWrap="wrap">
                          <Chip size="small" label={`${row.media_summary?.actual_photo_count || 0} photos`} />
                          <Chip size="small" label={`${row.media_summary?.actual_video_count || 0} videos`} />
                          {missingPhoto > 0 && <Chip color="warning" size="small" label={`${missingPhoto} image missing`} />}
                          {missingVideo > 0 && <Chip color="warning" size="small" label={`${missingVideo} video missing`} />}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography fontWeight={700}>{row.product_name || row.commodity_name || "Direct Trade Listing"}</Typography>
                        <Typography variant="body2" color="text.secondary">{row.commodity_name} {row.variety_name ? `• ${row.variety_name}` : ""} {row.grade_name ? `• ${row.grade_name}` : ""}</Typography>
                        <Typography variant="caption" color="text.secondary">{row.listing_no || row.listing_id}</Typography>
                      </TableCell>
                      <TableCell><Typography>{row.farmer_name}</Typography><Typography variant="caption" color="text.secondary">{row.farmer_mobile || row.farmer_username}</Typography></TableCell>
                      <TableCell><Typography>{qty(row.quantity)}</Typography><Typography variant="caption" color="text.secondary">{money(row.price)}</Typography></TableCell>
                      <TableCell><Typography>{row.pickup?.district || "-"}, {row.pickup?.state || row.pickup?.state_code || ""}</Typography><Stack direction="row" spacing={0.5} sx={{ mt: 0.5 }}><Chip size="small" color={row.gps_verified ? "success" : "default"} label={row.gps_verified ? "GPS verified" : "GPS pending"} /></Stack></TableCell>
                      <TableCell><Chip size="small" color={row.status === "PENDING_APPROVAL" ? "warning" : row.status === "REJECTED" ? "error" : row.status === "PUBLISHED" ? "success" : "default"} label={row.status} /></TableCell>
                      <TableCell>{fmtDate(row.submitted_on)}</TableCell>
                      <TableCell align="right"><Tooltip title="Open review workspace"><IconButton onClick={() => openDetails(row)}><VisibilityOutlinedIcon /></IconButton></Tooltip></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
          <TablePagination component="div" count={total} page={page} onPageChange={(_, p) => { setPage(p); loadQueue(p, limit); }} rowsPerPage={limit} onRowsPerPageChange={(e) => { const next = parseInt(e.target.value, 10); setLimit(next); setPage(0); loadQueue(0, next); }} rowsPerPageOptions={[10, 20, 50, 100]} />
        </Card>
      </Stack>

      <Dialog open={Boolean(selected)} onClose={() => setSelected(null)} maxWidth="lg" fullWidth>
        <DialogTitle>Direct Trade Review Workspace</DialogTitle>
        <DialogContent dividers>
          {detailsLoading && <Box sx={{ p: 4, textAlign: "center" }}><CircularProgress /></Box>}
          {!detailsLoading && detailListing && (
            <Grid container spacing={2}>
              <Grid item xs={12} md={8}>
                <Stack spacing={2}>
                  <Card variant="outlined"><CardContent><Typography variant="h6" gutterBottom>Product Information</Typography><Grid container spacing={1}><Grid item xs={6}><Typography color="text.secondary">Commodity</Typography><Typography fontWeight={700}>{detailListing.commodity_name || "-"}</Typography></Grid><Grid item xs={6}><Typography color="text.secondary">Product</Typography><Typography fontWeight={700}>{detailListing.product_name || "-"}</Typography></Grid><Grid item xs={6}><Typography color="text.secondary">Variety / Grade</Typography><Typography>{detailListing.variety_name || "-"} {detailListing.grade_name ? `• ${detailListing.grade_name}` : ""}</Typography></Grid><Grid item xs={6}><Typography color="text.secondary">Quantity / Price</Typography><Typography>{qty(detailListing.quantity)} • {money(detailListing.price)}</Typography></Grid><Grid item xs={12}><Typography color="text.secondary">Description / Remarks</Typography><Typography>{detailListing.remarks || "-"}</Typography></Grid></Grid></CardContent></Card>
                  <Card variant="outlined"><CardContent><Typography variant="h6" gutterBottom>Pickup & GPS Verification</Typography><Grid container spacing={1}><Grid item xs={6}><Typography color="text.secondary">Address</Typography><Typography>{detailListing.pickup?.address_line || detailListing.pickup?.manual_address || "-"}</Typography></Grid><Grid item xs={6}><Typography color="text.secondary">District / State / Pincode</Typography><Typography>{detailListing.pickup?.district || "-"}, {detailListing.pickup?.state || detailListing.pickup?.state_code || "-"} - {detailListing.pickup?.pincode || "-"}</Typography></Grid><Grid item xs={12}><Chip color={detailListing.gps_verified ? "success" : "warning"} label={detailListing.gps_verified ? "GPS captured / verified" : "GPS needs verification"} /></Grid></Grid></CardContent></Card>
                  <Card variant="outlined"><CardContent><Stack direction="row" justifyContent="space-between" alignItems="center"><Typography variant="h6">Media Review</Typography><Stack direction="row" spacing={1}><Chip size="small" label={`${currentMedia.filter((m: any) => m.type === "PHOTO").length} photos`} /><Chip size="small" label={`${currentMedia.filter((m: any) => m.type === "VIDEO").length} videos`} /></Stack></Stack><Divider sx={{ my: 2 }} /><Grid container spacing={2}>{currentMedia.map((m: any) => (<Grid item xs={12} sm={6} md={4} key={m.media_id}><Card variant="outlined"><Box sx={{ p: 1 }}><MediaThumb media={m} onClick={() => setMediaPreview(m)} /></Box><CardContent sx={{ pt: 0 }}><Stack spacing={1}><Typography variant="body2" fontWeight={700}>{m.type} • {m.moderation_status || m.status}</Typography><FormControl size="small" fullWidth><InputLabel>Media decision</InputLabel><Select label="Media decision" defaultValue="APPROVED"><MenuItem value="APPROVED">Approved</MenuItem><MenuItem value="REJECTED">Reject</MenuItem><MenuItem value="NEEDS_CHANGE">Needs Change</MenuItem></Select></FormControl><FormControl size="small" fullWidth><InputLabel>Reason</InputLabel><Select label="Reason" defaultValue="OTHER">{reasons.map((r: string) => <MenuItem key={r} value={r}>{r}</MenuItem>)}</Select></FormControl></Stack></CardContent></Card></Grid>))}{currentMedia.length === 0 && <Grid item xs={12}><Alert severity="warning">No media found for this listing. Select a missing media reason below before requesting changes.</Alert></Grid>}</Grid><Grid container spacing={2} sx={{ mt: 1 }}>{Number(detailListing.media_summary?.missing_photo_count || 0) > 0 && <Grid item xs={12} md={6}><FormControl fullWidth size="small"><InputLabel>Missing image reason</InputLabel><Select label="Missing image reason" value={missingPhotoReason} onChange={(e) => setMissingPhotoReason(e.target.value)}>{reasons.map((r: string) => <MenuItem key={r} value={r}>{r}</MenuItem>)}</Select></FormControl></Grid>}{Number(detailListing.media_summary?.missing_video_count || 0) > 0 && <Grid item xs={12} md={6}><FormControl fullWidth size="small"><InputLabel>Missing video reason</InputLabel><Select label="Missing video reason" value={missingVideoReason} onChange={(e) => setMissingVideoReason(e.target.value)}>{reasons.map((r: string) => <MenuItem key={r} value={r}>{r}</MenuItem>)}</Select></FormControl></Grid>}</Grid></CardContent></Card>
                </Stack>
              </Grid>
              <Grid item xs={12} md={4}>
                <Stack spacing={2}>
                  <Card variant="outlined"><CardContent><Typography variant="h6" gutterBottom>Listing Decision</Typography><Stack spacing={1}><Button variant="contained" color="success" startIcon={<CheckCircleOutlineIcon />} onClick={() => setActionOpen("APPROVE")}>Approve / Move Next Level</Button><Button variant="outlined" color="warning" startIcon={<ChangeCircleOutlinedIcon />} onClick={() => setActionOpen("REQUEST_CHANGES")}>Request Changes</Button><Button variant="outlined" color="error" startIcon={<CancelOutlinedIcon />} onClick={() => setActionOpen("REJECT")}>Reject</Button></Stack></CardContent></Card>
                  <Card variant="outlined"><CardContent><Typography variant="h6" gutterBottom>Audit Timeline</Typography><Stack spacing={1}>{(details?.history || []).length === 0 && <Typography color="text.secondary">No history found.</Typography>}{(details?.history || []).map((h: any) => (<Box key={h.history_id} sx={{ borderLeft: "3px solid", borderColor: "primary.main", pl: 1.5 }}><Typography fontWeight={700}>{h.action}</Typography><Typography variant="caption" color="text.secondary">{fmtDate(h.action_on)} • {h.actor_username}</Typography><Typography variant="body2">{h.remarks || "-"}</Typography></Box>))}</Stack></CardContent></Card>
                </Stack>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setSelected(null)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(mediaPreview)} onClose={() => setMediaPreview(null)} maxWidth="md" fullWidth>
        <DialogTitle>{mediaPreview?.type === "VIDEO" ? "Video Preview" : "Image Preview"}</DialogTitle>
        <DialogContent dividers>
          {mediaPreview?.type === "VIDEO" ? (
            <Box component="video" src={mediaPreview?.url} controls autoPlay sx={{ width: "100%", maxHeight: "70vh", bgcolor: "black" }} />
          ) : (
            <Box component="img" src={mediaPreview?.url || mediaPreview?.thumbnail_url} alt="media preview" sx={{ width: "100%", maxHeight: "70vh", objectFit: "contain" }} />
          )}
        </DialogContent>
        <DialogActions><Button onClick={() => setMediaPreview(null)}>Close</Button></DialogActions>
      </Dialog>

      <Dialog open={Boolean(actionOpen)} onClose={() => setActionOpen(null)} maxWidth="sm" fullWidth>
        <DialogTitle>{actionOpen === "APPROVE" ? "Approve Listing" : actionOpen === "REJECT" ? "Reject Listing" : "Request Changes"}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Alert severity={actionOpen === "APPROVE" ? "success" : actionOpen === "REJECT" ? "error" : "warning"}>
              {actionOpen === "APPROVE" ? "This will move the listing to the next approval level or publish it if this is the final level." : "Remarks will be visible in the approval history and should clearly explain what the farmer must fix."}
            </Alert>
            <TextField label={actionOpen === "APPROVE" ? "Remarks" : "Remarks *"} multiline minRows={4} value={remarks} onChange={(e) => setRemarks(e.target.value)} fullWidth />
          </Stack>
        </DialogContent>
        <DialogActions><Button onClick={() => setActionOpen(null)} disabled={actionBusy}>Cancel</Button><Button variant="contained" onClick={submitAction} disabled={actionBusy}>{actionBusy ? "Saving..." : "Submit"}</Button></DialogActions>
      </Dialog>
    </PageContainer>
  );
};

export default DirectTradeApprovalsPage;
