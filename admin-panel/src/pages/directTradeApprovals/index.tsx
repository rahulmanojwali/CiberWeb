/**
 * Author: CiberMandi Development Team
 * Date: 2026-09-14
 * Description: Platform Operations Direct Trade approval workspace.
 * XML/Android rules are not applicable here; this is Web Admin.
 */
import React from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Dropdown,
  Empty,
  Input,
  Modal,
  Pagination,
  Row,
  Space,
  Spin,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { MenuProps, TableColumnsType } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  DownOutlined,
  EyeOutlined,
  LeftOutlined,
  ReloadOutlined,
  RightOutlined,
  SearchOutlined,
  SyncOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { useSnackbar } from 'notistack';
import { PageContainer } from '../../components/PageContainer';
import {
  imagePreviewUrl,
  mediaTypeOf,
  thumbnailCandidates,
  videoEmbedUrl,
  videoPlaybackUrl,
} from '../../utils/mediaUrl';
import {
  getDirectTradeApprovalDetails,
  listDirectTradeApprovalQueue,
  listDirectTradeApprovalRemarkTemplates,
  updateDirectTradeApprovalStatus,
  type DirectTradeApprovalRemarkTemplate,
} from '../../services/directTradeApprovalsApi';
import './directTradeApprovals.css';

const { Text, Title } = Typography;
type AnyRecord = Record<string, any>;

type ApprovalAction = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';

const STATUS_OPTIONS = [
  { value: 'PENDING_APPROVAL', label: 'Pending Approval' },
  { value: 'RESUBMITTED', label: 'Resubmitted' },
  { value: 'NEEDS_ATTENTION', label: 'Needs Attention' },
  { value: 'APPROVED', label: 'Approved / Published' },
  { value: 'ALL', label: 'All' },
];

const MEDIA_FILTERS = [
  { value: 'ALL', label: 'All Media' },
  { value: 'MISSING_PHOTO', label: 'Missing Images' },
  { value: 'MISSING_VIDEO', label: 'Missing Video' },
];

const MEDIA_DECISIONS = [
  { value: 'PENDING', label: 'Pending Review' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REQUEST_REPLACEMENT', label: 'Request Replacement' },
  { value: 'REJECTED', label: 'Reject' },
  { value: 'REMOVED', label: 'Removed' },
];

const LOCAL_REASONS = [
  'Wrong product image',
  'Poor image quality',
  'Image does not match product',
  'Video does not match product',
  'Video not clear',
  'Duplicate media',
  'Inappropriate media',
  'Location mismatch',
  'Product details mismatch',
  'Media deleted / removed',
  'Media corrupted',
  'Upload failed',
  'Under moderation',
  'Other',
];

const FALLBACK_REMARK_TEMPLATES: DirectTradeApprovalRemarkTemplate[] = [
  { code: 'APPROVE_DETAILS_VERIFIED', action: 'APPROVE', label: 'Details verified', message: 'Product, quantity, price, pickup and media details have been verified.', sort_order: 10 },
  { code: 'APPROVE_MEDIA_VERIFIED', action: 'APPROVE', label: 'Media verified', message: 'All submitted photos and videos are clear, relevant and approved.', sort_order: 20 },
  { code: 'APPROVE_FINAL', action: 'APPROVE', label: 'Approved for publication', message: 'Listing meets Direct Trade requirements and is approved for publication.', sort_order: 30 },
  { code: 'CHANGE_PRODUCT_DETAILS', action: 'REQUEST_CHANGES', label: 'Correct product details', message: 'Please correct the product, grade, quantity, price or remarks and resubmit the listing.', sort_order: 10 },
  { code: 'CHANGE_MEDIA', action: 'REQUEST_CHANGES', label: 'Replace or improve media', message: 'Please replace unclear, incorrect or incomplete product photos/videos and resubmit.', sort_order: 20 },
  { code: 'CHANGE_PICKUP', action: 'REQUEST_CHANGES', label: 'Correct pickup details', message: 'Please correct the pickup address or GPS verification details and resubmit.', sort_order: 30 },
  { code: 'REJECT_INVALID_PRODUCT', action: 'REJECT', label: 'Invalid or prohibited product', message: 'The listing cannot be approved because the product is invalid, prohibited or outside Direct Trade policy.', sort_order: 10 },
  { code: 'REJECT_MISLEADING', action: 'REJECT', label: 'Misleading listing', message: 'The listing has been rejected because the submitted information or media is misleading or unverifiable.', sort_order: 20 },
  { code: 'REJECT_POLICY', action: 'REJECT', label: 'Policy violation', message: 'The listing has been rejected because it does not comply with CiberMandi Direct Trade policy.', sort_order: 30 },
];

function currentUser() {
  try {
    return JSON.parse(localStorage.getItem('cd_user') || '{}');
  } catch {
    return {};
  }
}

function normalizeRole(value?: unknown) {
  return String(value || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
}

function humanize(value?: unknown) {
  const text = String(value || '').trim();
  if (!text) return '—';
  return text.toLowerCase().split('_').filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function formatDateTime(value?: unknown) {
  if (!value) return '—';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true,
  });
}

function compactAddress(parts: any[] = []) {
  return parts.map((part) => String(part || '').trim()).filter(Boolean)
    .filter((part, index, arr) => arr.findIndex((v) => v.toLowerCase() === part.toLowerCase()) === index)
    .join(', ');
}

function farmerEnteredPickupAddress(pickup: AnyRecord = {}) {
  return compactAddress([
    pickup.address_line_1 || pickup.address_line || pickup.manual_address,
    pickup.address_line_2,
    pickup.locality || pickup.village,
    pickup.district,
    pickup.state || pickup.state_code,
    pickup.pincode,
  ]);
}

function gpsVerifiedPickupAddress(pickup: AnyRecord = {}) {
  const gps = pickup.gps || {};
  return compactAddress([
    gps.address || pickup.gps_address,
    gps.district,
    gps.state || gps.state_code,
    gps.pincode || pickup.gps_pincode,
  ]);
}

function gpsCoords(pickup: AnyRecord = {}) {
  const gps = pickup.gps || {};
  const lat = gps.lat ?? pickup.lat ?? pickup.gps_lat;
  const lng = gps.lng ?? pickup.lng ?? pickup.gps_lng;
  return lat === undefined || lat === null || lng === undefined || lng === null ? '—' : `${lat}, ${lng}`;
}

function quantityLabel(quantity?: AnyRecord) {
  if (!quantity) return '—';
  const value = quantity.value ?? quantity.quantity ?? quantity.weight_kg;
  const unit = quantity.unit || quantity.unit_name || '';
  return value === undefined || value === null ? '—' : `${value}${unit ? ` ${unit}` : ''}`;
}

function moneyLabel(price?: AnyRecord) {
  if (!price) return '—';
  const amount = price.amount ?? price.expected_rate_qtl ?? price.value;
  if (amount === undefined || amount === null) return '—';
  const unit = price.per_unit || price.unit || 'unit';
  return `₹${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })} / ${unit}`;
}

function statusColor(value?: unknown) {
  switch (String(value || '').toUpperCase()) {
    case 'PUBLISHED':
    case 'APPROVED': return 'green';
    case 'PENDING_APPROVAL':
    case 'PENDING_REVIEW': return 'gold';
    case 'RESUBMITTED': return 'blue';
    case 'CHANGE_REQUEST':
    case 'CHANGE_REQUESTED': return 'orange';
    case 'REJECTED': return 'red';
    default: return 'default';
  }
}

function decisionColor(value?: unknown) {
  switch (String(value || '').toUpperCase()) {
    case 'APPROVED': return 'green';
    case 'REQUEST_REPLACEMENT': return 'orange';
    case 'REJECTED': return 'red';
    case 'REMOVED': return 'default';
    default: return 'gold';
  }
}

function responseOk(resp: any) {
  const code = String(resp?.response?.responsecode ?? resp?.responsecode ?? '1');
  return code === '0' || code === '00';
}

function responseMessage(resp: any, fallback: string) {
  return resp?.response?.description || resp?.description || fallback;
}

function normalizeDecision(value: any) {
  const v = String(value || 'PENDING').trim().toUpperCase().replace(/\s+/g, '_');
  if (['PENDING', 'APPROVED', 'REJECTED', 'REQUEST_REPLACEMENT', 'REMOVED'].includes(v)) return v;
  if (['NEEDS_CHANGE', 'REQUEST_CHANGE', 'CHANGE_REQUESTED'].includes(v)) return 'REQUEST_REPLACEMENT';
  return 'PENDING';
}

function decisionFromMedia(media: AnyRecord) {
  return normalizeDecision(media?.review_decision || media?.decision || media?.moderation_status || 'PENDING');
}

function mediaLocked(media: AnyRecord, decisions: Record<string, string>) {
  return normalizeDecision(decisions[media?.media_id] || decisionFromMedia(media)) === 'APPROVED' && Boolean(media?.review_locked || media?.locked || media?.moderation_status === 'APPROVED');
}

function needsReason(decision: string) {
  return ['REQUEST_REPLACEMENT', 'REJECTED', 'REMOVED'].includes(normalizeDecision(decision));
}

function buildReviewPayload(media: AnyRecord[], decisions: Record<string, string>, reasons: Record<string, string>) {
  const mediaReviews = (media || []).map((item) => ({
    media_id: item.media_id,
    media_type: item.media_type || item.type,
    decision: normalizeDecision(decisions[item.media_id] || decisionFromMedia(item)),
    reason_code: reasons[item.media_id] || item.review_reason || item.review_reason_code || item.reason_code || '',
  }));
  return {
    media_reviews: mediaReviews,
    all_items_approved: mediaReviews.length > 0 && mediaReviews.every((item) => item.decision === 'APPROVED'),
  };
}

function SingleShellDropdown({
  value,
  options,
  onChange,
  className = '',
  disabled = false,
}: {
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
  className?: string;
  disabled?: boolean;
}) {
  const selected = options.find((item) => item.value === value);
  const items: MenuProps['items'] = options.map((item) => ({ key: item.value, label: item.label }));
  return (
    <Dropdown
      disabled={disabled}
      trigger={['click']}
      overlayClassName="cm-dta-dropdown-overlay"
      menu={{ items, selectedKeys: [value], onClick: ({ key }) => onChange(String(key)) }}
    >
      <Button className={`cm-dta-dropdown-button ${className}`} disabled={disabled}>
        <span>{selected?.label || 'Select'}</span>
        <DownOutlined />
      </Button>
    </Dropdown>
  );
}

function MediaThumb({ media, onOpen }: { media: AnyRecord; onOpen: () => void }) {
  const isVideo = mediaTypeOf(media) === 'VIDEO';
  const [failed, setFailed] = React.useState(false);
  const src = thumbnailCandidates(media)[0] || imagePreviewUrl(media) || '';

  React.useEffect(() => { setFailed(false); }, [media?.media_id, src]);

  return (
    <button type="button" className="cm-dta-media-thumb" onClick={onOpen} aria-label="Open media preview">
      {src && !failed ? (
        <img
          src={src}
          alt={media?.media_id || 'Direct Trade media'}
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="cm-dta-media-placeholder">{isVideo ? 'Video preview' : 'Image preview'}</div>
      )}
      {isVideo ? <span className="cm-dta-video-badge">▶</span> : null}
    </button>
  );
}


function MediaPreview({ media }: { media: AnyRecord }) {
  const type = mediaTypeOf(media);
  const [imageFailed, setImageFailed] = React.useState(false);
  const embedUrl = videoEmbedUrl(media);
  const playbackUrl = videoPlaybackUrl(media);
  const imageUrl = imagePreviewUrl(media);

  React.useEffect(() => { setImageFailed(false); }, [media?.media_id, imageUrl]);

  if (type === 'VIDEO') {
    if (embedUrl) {
      return (
        <div className="cm-dta-video-embed-wrap">
          <iframe
            className="cm-dta-video-embed"
            src={embedUrl}
            title={`Direct Trade video ${media?.media_id || ''}`}
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
          />
        </div>
      );
    }
    if (playbackUrl) {
      return <video className="cm-dta-video-preview" controls playsInline preload="metadata" src={playbackUrl} />;
    }
    return <Alert type="warning" showIcon message="Video preview is not available for this item." />;
  }

  if (!imageUrl || imageFailed) {
    return <Alert type="warning" showIcon message="Image preview is not available for this item." />;
  }

  return (
    <div className="cm-dta-image-preview">
      <img src={imageUrl} alt="Direct Trade media preview" onError={() => setImageFailed(true)} />
    </div>
  );
}

function MediaStack({ media = [], summary = {}, onOpen }: { media?: AnyRecord[]; summary?: AnyRecord; onOpen: (index: number) => void }) {
  const visible = media.slice(0, 3);
  const extra = Math.max(0, media.length - visible.length);
  const photoCount = Number(summary?.actual_photo_count ?? summary?.photo_count ?? media.filter((m) => mediaTypeOf(m) !== 'VIDEO').length ?? 0);
  const videoCount = Number(summary?.actual_video_count ?? summary?.video_count ?? media.filter((m) => mediaTypeOf(m) === 'VIDEO').length ?? 0);
  return (
    <div className="cm-dta-media-stack-wrap">
      <div className="cm-dta-media-stack">
        {visible.map((item, index) => <MediaThumb key={item.media_id || index} media={item} onOpen={() => onOpen(index)} />)}
        {extra > 0 ? <button type="button" className="cm-dta-media-extra" onClick={() => onOpen(visible.length)}>+{extra}</button> : null}
      </div>
      <span className="cm-dta-media-count">{photoCount} photo{photoCount === 1 ? '' : 's'} · {videoCount} video{videoCount === 1 ? '' : 's'}</span>
    </div>
  );
}

export default function DirectTradeApprovalsPage() {
  const { enqueueSnackbar } = useSnackbar();
  const user = React.useMemo(() => currentUser(), []);
  const username = String(user?.username || user?.user_name || '');
  const role = normalizeRole(user?.role_slug || user?.role_code || user?.role);
  const language = String(user?.language || localStorage.getItem('language') || 'en');

  const [rows, setRows] = React.useState<AnyRecord[]>([]);
  const [counts, setCounts] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(20);
  const [total, setTotal] = React.useState(0);
  const [status, setStatus] = React.useState('PENDING_APPROVAL');
  const [mediaType, setMediaType] = React.useState('ALL');
  const [search, setSearch] = React.useState('');
  const [appliedSearch, setAppliedSearch] = React.useState('');

  const [selected, setSelected] = React.useState<AnyRecord | null>(null);
  const [details, setDetails] = React.useState<AnyRecord | null>(null);
  const [detailsLoading, setDetailsLoading] = React.useState(false);
  const [detailsError, setDetailsError] = React.useState<string | null>(null);
  const [mediaPreview, setMediaPreview] = React.useState<{ items: AnyRecord[]; index: number } | null>(null);

  const [actionOpen, setActionOpen] = React.useState<ApprovalAction | null>(null);
  const [remarkCode, setRemarkCode] = React.useState('');
  const [remarks, setRemarks] = React.useState('');
  const [remarkTemplates, setRemarkTemplates] = React.useState<DirectTradeApprovalRemarkTemplate[]>([]);
  const [remarkTemplatesLoading, setRemarkTemplatesLoading] = React.useState(false);
  const [usingRemarkFallback, setUsingRemarkFallback] = React.useState(false);
  const [actionBusy, setActionBusy] = React.useState(false);
  const actionSubmitLockRef = React.useRef(false);
  const [mediaDecisions, setMediaDecisions] = React.useState<Record<string, string>>({});
  const [mediaReasons, setMediaReasons] = React.useState<Record<string, string>>({});

  const loadQueue = React.useCallback(async () => {
    if (!username) {
      setError('Signed-in administrator could not be identified.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await listDirectTradeApprovalQueue({
        username,
        language,
        filters: {
          page,
          limit: pageSize,
          status,
          search: appliedSearch,
          media_type: mediaType === 'ALL' ? '' : mediaType,
        },
      });
      setRows(Array.isArray(data?.items) ? data.items : []);
      setCounts(data?.counts || {});
      setTotal(Number(data?.total || 0));
    } catch (err: any) {
      setRows([]);
      setTotal(0);
      setError(err?.message || 'Unable to load Direct Trade approvals.');
    } finally {
      setLoading(false);
    }
  }, [username, language, page, pageSize, status, appliedSearch, mediaType]);

  React.useEffect(() => { loadQueue(); }, [loadQueue]);

  const openDetails = React.useCallback(async (row: AnyRecord) => {
    setSelected(row);
    setDetails(null);
    setDetailsError(null);
    setDetailsLoading(true);
    try {
      const data = await getDirectTradeApprovalDetails({ username, language, listing_id: row.listing_id });
      setDetails(data || null);
      const media = data?.media || data?.listing?.media || [];
      const nextDecisions: Record<string, string> = {};
      const nextReasons: Record<string, string> = {};
      media.forEach((item: AnyRecord) => {
        if (!item?.media_id) return;
        nextDecisions[item.media_id] = decisionFromMedia(item);
        nextReasons[item.media_id] = item.review_reason || item.review_reason_code || item.reason_code || '';
      });
      setMediaDecisions(nextDecisions);
      setMediaReasons(nextReasons);
    } catch (err: any) {
      setDetailsError(err?.message || 'Unable to load approval details.');
    } finally {
      setDetailsLoading(false);
    }
  }, [username, language]);

  const closeDetails = React.useCallback(() => {
    setSelected(null);
    setDetails(null);
    setDetailsError(null);
    setMediaDecisions({});
    setMediaReasons({});
  }, []);

  const currentMedia = details?.media || details?.listing?.media || [];
  const reviewPayload = React.useMemo(() => buildReviewPayload(currentMedia, mediaDecisions, mediaReasons), [currentMedia, mediaDecisions, mediaReasons]);
  const workflow = details?.workflow || {};
  const canSubmitApprove = !workflow.read_only && reviewPayload.all_items_approved;
  const detailListing = details?.listing || selected || {};
  const issueReasons = (details?.issue_reasons || []).map((item: AnyRecord) => item.label || item.code).filter(Boolean);
  const mediaReasonOptions = issueReasons.length ? issueReasons : LOCAL_REASONS;

  const loadRemarkTemplates = React.useCallback(async (action: ApprovalAction) => {
    setRemarkTemplatesLoading(true);
    setUsingRemarkFallback(false);
    setRemarkTemplates([]);
    setRemarkCode('');
    setRemarks('');
    try {
      const items = await listDirectTradeApprovalRemarkTemplates({ username, language, action });
      if (items.length) {
        setRemarkTemplates(items);
      } else {
        setUsingRemarkFallback(true);
        setRemarkTemplates(FALLBACK_REMARK_TEMPLATES.filter((item) => item.action === action));
      }
    } catch {
      setUsingRemarkFallback(true);
      setRemarkTemplates(FALLBACK_REMARK_TEMPLATES.filter((item) => item.action === action));
    } finally {
      setRemarkTemplatesLoading(false);
    }
  }, [username, language]);

  const openAction = React.useCallback((action: ApprovalAction) => {
    if (actionBusy || actionSubmitLockRef.current) return;
    setActionOpen(action);
    void loadRemarkTemplates(action);
  }, [actionBusy, loadRemarkTemplates]);

  const submitAction = React.useCallback(async () => {
    if (actionSubmitLockRef.current) return;
    if (!actionOpen || !detailListing?.listing_id || !remarkCode) return;
    if (usingRemarkFallback) {
      enqueueSnackbar('Approval templates are unavailable. Please retry when the template service is available.', { variant: 'warning' });
      return;
    }
    actionSubmitLockRef.current = true;
    setActionBusy(true);
    try {
      const resp = await updateDirectTradeApprovalStatus({
        username,
        language,
        listing_id: detailListing.listing_id,
        approval_action: actionOpen,
        remarks,
        remark_code: remarkCode,
        review_payload: reviewPayload,
        media_reviews: reviewPayload.media_reviews,
      });
      if (!responseOk(resp)) {
        enqueueSnackbar(responseMessage(resp, 'Unable to update approval.'), { variant: 'error' });
        return;
      }
      enqueueSnackbar(responseMessage(resp, 'Approval updated successfully.'), { variant: 'success' });
      setActionOpen(null);
      setRemarkCode('');
      setRemarks('');
      closeDetails();
      await loadQueue();
    } catch (err: any) {
      enqueueSnackbar(err?.message || 'Unable to update approval.', { variant: 'error' });
    } finally {
      actionSubmitLockRef.current = false;
      setActionBusy(false);
    }
  }, [actionOpen, detailListing?.listing_id, remarkCode, usingRemarkFallback, username, language, remarks, reviewPayload, enqueueSnackbar, closeDetails, loadQueue]);

  const columns: TableColumnsType<AnyRecord> = React.useMemo(() => [
    {
      title: 'Media', key: 'media', width: 150,
      render: (_, row) => <MediaStack media={row.media || []} summary={row.media_summary || {}} onOpen={(index) => setMediaPreview({ items: row.media || [], index })} />,
    },
    {
      title: 'Listing / Product', key: 'listing', width: 250,
      render: (_, row) => (
        <div>
          <Text strong className="cm-dta-primary-text">{row.product_name || row.commodity_name || 'Direct Trade Listing'}</Text>
          <span className="cm-dta-secondary-text">{[row.commodity_name, row.variety_name, row.grade_name].filter(Boolean).join(' · ') || '—'}</span>
          <span className="cm-dta-secondary-text">{row.listing_no || row.listing_id || '—'}</span>
        </div>
      ),
    },
    {
      title: 'Farmer', key: 'farmer', width: 170,
      render: (_, row) => (
        <div>
          <Text strong className="cm-dta-primary-text">{row.farmer_name || '—'}</Text>
          <span className="cm-dta-secondary-text">{row.farmer_mobile || row.farmer_username || '—'}</span>
        </div>
      ),
    },
    {
      title: 'Qty / Price', key: 'commercial', width: 145,
      render: (_, row) => (
        <div>
          <Text strong>{quantityLabel(row.quantity)}</Text>
          <span className="cm-dta-secondary-text">{moneyLabel(row.price)}</span>
        </div>
      ),
    },
    {
      title: 'Pickup', key: 'pickup', width: 180,
      render: (_, row) => (
        <div>
          <Text>{compactAddress([row.pickup?.district, row.pickup?.state || row.pickup?.state_code]) || '—'}</Text>
          <span className="cm-dta-secondary-text">{row.gps_verified ? 'GPS verified' : 'GPS pending'}</span>
        </div>
      ),
    },
    {
      title: 'Status', dataIndex: 'status', key: 'status', width: 145,
      render: (value) => <Tag color={statusColor(value)}>{humanize(value)}</Tag>,
    },
    {
      title: 'Submitted', key: 'submitted', width: 145,
      render: (_, row) => formatDateTime(row.submitted_on || row.updated_on || row.created_on),
    },
    {
      title: 'Actions', key: 'actions', width: 80, fixed: 'right',
      render: (_, row) => <Button type="link" icon={<EyeOutlined />} onClick={() => openDetails(row)}>View</Button>,
    },
  ], [openDetails]);

  const pendingCount = Number(counts.PENDING_APPROVAL || 0) + Number(counts.PENDING_REVIEW || 0);
  const approvedCount = Number(counts.PUBLISHED || 0) + Number(counts.APPROVED || 0);
  const attentionCount = Number(counts.REJECTED || 0) + Number(counts.CHANGE_REQUEST || 0) + Number(counts.CHANGE_REQUESTED || 0);
  const previewItems = mediaPreview?.items || [];
  const previewIndex = mediaPreview?.index || 0;
  const previewMedia = previewItems[previewIndex];

  return (
    <PageContainer title="Direct Trade Approvals" subtitle="Review and approve Direct Trade listings, verified media and pickup details.">
      <div className="cm-dta-page">
        <Alert
          className="cm-dta-role-alert"
          showIcon
          type="info"
          message={<span>Signed in as <strong>{username || 'platform user'}</strong>{role ? <> · <strong>{humanize(role)}</strong></> : null}</span>}
          description="Platform Operations approval workspace. Review listing information, media and GPS verification before taking an approval decision."
        />

        <Row gutter={[12, 12]} className="cm-dta-kpi-row">
          <Col xs={24} md={8}>
            <Card className="cm-dta-kpi-card cm-dta-kpi-pending"><Text type="secondary">Pending Review</Text><Title level={3}>{pendingCount}</Title><Text>Listings waiting for review.</Text></Card>
          </Col>
          <Col xs={24} md={8}>
            <Card className="cm-dta-kpi-card cm-dta-kpi-approved"><Text type="secondary">Approved / Published</Text><Title level={3}>{approvedCount}</Title><Text>Listings already cleared.</Text></Card>
          </Col>
          <Col xs={24} md={8}>
            <Card className="cm-dta-kpi-card cm-dta-kpi-attention"><Text type="secondary">Needs Attention</Text><Title level={3}>{attentionCount}</Title><Text>Rejected or change-requested listings.</Text></Card>
          </Col>
        </Row>

        <Card className="cm-dta-filter-card">
          <Row gutter={[10, 10]} align="middle">
            <Col xs={24} lg={10}>
              <div className="cm-dta-search-group">
                <Input
                  className="cm-dta-search-input"
                  value={search}
                  maxLength={80}
                  placeholder="Search listing ID, farmer, product or location"
                  onChange={(event) => setSearch(event.target.value)}
                  onPressEnter={() => { setPage(1); setAppliedSearch(search.trim()); }}
                />
                <Button type="primary" className="cm-dta-search-button" icon={<SearchOutlined />} onClick={() => { setPage(1); setAppliedSearch(search.trim()); }}>Search</Button>
              </div>
            </Col>
            <Col xs={24} sm={12} lg={5}>
              <SingleShellDropdown value={status} options={STATUS_OPTIONS} onChange={(value) => { setStatus(value); setPage(1); }} />
            </Col>
            <Col xs={24} sm={12} lg={5}>
              <SingleShellDropdown value={mediaType} options={MEDIA_FILTERS} onChange={(value) => { setMediaType(value); setPage(1); }} />
            </Col>
            <Col xs={24} lg={4}>
              <Button block icon={<ReloadOutlined />} loading={loading} onClick={() => loadQueue()}>Refresh</Button>
            </Col>
          </Row>
        </Card>

        {error ? <Alert showIcon type="error" message="Unable to load Direct Trade approvals" description={error} /> : null}

        <Card className="cm-dta-table-card">
          <Table
            rowKey={(row) => row.listing_id}
            columns={columns}
            dataSource={rows}
            loading={loading}
            pagination={false}
            scroll={{ x: 1260 }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No Direct Trade listings found for this filter." /> }}
          />
          <div className="cm-dta-pagination-wrap">
            <Pagination
              current={page}
              pageSize={pageSize}
              total={total}
              showSizeChanger
              pageSizeOptions={[10, 20, 50, 100]}
              showTotal={(value) => `${value} listing${value === 1 ? '' : 's'}`}
              onChange={(nextPage, nextSize) => {
                setPage(nextSize !== pageSize ? 1 : nextPage);
                setPageSize(nextSize);
              }}
            />
          </div>
        </Card>
      </div>

      <Modal
        className="cm-dta-review-modal"
        open={Boolean(selected)}
        onCancel={closeDetails}
        width={1180}
        title={
          <div>
            <div>Direct Trade Review Workspace</div>
            <Text type="secondary" className="cm-dta-modal-subtitle">{detailListing.listing_no || detailListing.listing_id || ''}</Text>
          </div>
        }
        footer={<Button onClick={closeDetails}>Close</Button>}
        destroyOnHidden
        zIndex={1200}
      >
        {detailsLoading ? <div className="cm-dta-modal-loading"><Spin /></div> : null}
        {!detailsLoading && detailsError ? <Alert showIcon type="error" message="Unable to load listing details" description={detailsError} /> : null}
        {!detailsLoading && !detailsError && selected ? (
          <div className="cm-dta-review-content">
            <Card size="small" className="cm-dta-detail-panel" title="Product Information">
              <Descriptions className="cm-dta-flat-descriptions" size="small" column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="Commodity">{detailListing.commodity_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Product">{detailListing.product_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Variety / Grade">{[detailListing.variety_name, detailListing.grade_name].filter(Boolean).join(' · ') || '—'}</Descriptions.Item>
                <Descriptions.Item label="Quantity / Price">{quantityLabel(detailListing.quantity)} · {moneyLabel(detailListing.price)}</Descriptions.Item>
                <Descriptions.Item label="Farmer">{detailListing.farmer_name || detailListing.farmer_username || '—'}</Descriptions.Item>
                <Descriptions.Item label="Status"><Tag color={statusColor(detailListing.status)}>{humanize(detailListing.status)}</Tag></Descriptions.Item>
                <Descriptions.Item label="Remarks" span={2}>{detailListing.remarks || '—'}</Descriptions.Item>
              </Descriptions>
            </Card>

            <Card size="small" className="cm-dta-detail-panel" title="Pickup & GPS Verification">
              <Descriptions className="cm-dta-flat-descriptions" size="small" column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="Farmer Entered Address">{farmerEnteredPickupAddress(detailListing.pickup) || '—'}</Descriptions.Item>
                <Descriptions.Item label="GPS Verified Address">{gpsVerifiedPickupAddress(detailListing.pickup) || '—'}</Descriptions.Item>
                <Descriptions.Item label="District / State / Pincode">{compactAddress([detailListing.pickup?.district, detailListing.pickup?.state || detailListing.pickup?.state_code, detailListing.pickup?.pincode]) || '—'}</Descriptions.Item>
                <Descriptions.Item label="GPS Coordinates">{gpsCoords(detailListing.pickup)}</Descriptions.Item>
                <Descriptions.Item label="Verification" span={2}><Tag color={detailListing.gps_verified ? 'green' : 'gold'}>{detailListing.gps_verified ? 'GPS Verified' : 'GPS Pending'}</Tag></Descriptions.Item>
              </Descriptions>
            </Card>

            <Card
              size="small"
              className="cm-dta-detail-panel"
              title="Media Review"
              extra={<Space><Tag>{currentMedia.filter((m: AnyRecord) => mediaTypeOf(m) !== 'VIDEO').length} Photos</Tag><Tag>{currentMedia.filter((m: AnyRecord) => mediaTypeOf(m) === 'VIDEO').length} Videos</Tag></Space>}
            >
              {currentMedia.length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No media available for review." /> : (
                <Row gutter={[12, 12]}>
                  {currentMedia.map((item: AnyRecord, index: number) => {
                    const currentDecision = mediaDecisions[item.media_id] || decisionFromMedia(item);
                    const locked = mediaLocked(item, mediaDecisions);
                    return (
                      <Col xs={24} md={12} xl={8} key={item.media_id || index}>
                        <div className="cm-dta-media-review-card">
                          <MediaThumb media={item} onOpen={() => setMediaPreview({ items: currentMedia, index })} />
                          <div className="cm-dta-media-review-body">
                            <Space size={6} wrap>
                              <Text strong>{humanize(mediaTypeOf(item))}</Text>
                              <Tag color={decisionColor(currentDecision)}>{humanize(currentDecision)}</Tag>
                              {locked ? <Tag color="green">Locked</Tag> : null}
                            </Space>
                            <div className="cm-dta-field-label">Media decision</div>
                            <SingleShellDropdown
                              value={currentDecision}
                              options={MEDIA_DECISIONS}
                              disabled={Boolean(workflow.read_only) || locked}
                              onChange={(value) => setMediaDecisions((prev) => ({ ...prev, [item.media_id]: value }))}
                            />
                            {needsReason(currentDecision) ? (
                              <>
                                <div className="cm-dta-field-label">Reason</div>
                                <SingleShellDropdown
                                  value={mediaReasons[item.media_id] || mediaReasonOptions[0] || 'Other'}
                                  options={mediaReasonOptions.map((value: string) => ({ value, label: value }))}
                                  disabled={Boolean(workflow.read_only) || locked}
                                  onChange={(value) => setMediaReasons((prev) => ({ ...prev, [item.media_id]: value }))}
                                />
                              </>
                            ) : null}
                          </div>
                        </div>
                      </Col>
                    );
                  })}
                </Row>
              )}
            </Card>

            <Card size="small" className="cm-dta-detail-panel" title="Approval Actions">
              <Space wrap>
                {workflow.can_approve !== false && !workflow.read_only ? (
                  <Button type="primary" icon={<CheckCircleOutlined />} disabled={!canSubmitApprove} onClick={() => openAction('APPROVE')}>Approve</Button>
                ) : null}
                {workflow.can_request_changes !== false && !workflow.read_only ? (
                  <Button icon={<SyncOutlined />} onClick={() => openAction('REQUEST_CHANGES')}>Request Changes</Button>
                ) : null}
                {workflow.can_reject !== false && !workflow.read_only ? (
                  <Button danger icon={<CloseCircleOutlined />} onClick={() => openAction('REJECT')}>Reject</Button>
                ) : null}
                {workflow.stage_label ? <Tag color="blue">{workflow.stage_label}</Tag> : null}
                {!canSubmitApprove && !workflow.read_only ? <Text type="secondary">Approve becomes available after all media is approved.</Text> : null}
              </Space>
            </Card>

            <Card size="small" className="cm-dta-detail-panel" title="Audit Timeline">
              {(details?.history || []).length === 0 ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No approval history found." /> : (
                <div className="cm-dta-timeline">
                  {(details?.history || []).map((item: AnyRecord) => (
                    <div className="cm-dta-timeline-item" key={item.history_id || `${item.action_on}-${item.action}`}>
                      <div className="cm-dta-timeline-dot" />
                      <div>
                        <Text strong>{humanize(item.action)}</Text>
                        <span className="cm-dta-secondary-text">{formatDateTime(item.action_on)} · {item.actor_username || '—'}</span>
                        <div>{item.remarks || '—'}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ) : null}
      </Modal>

      <Modal
        className="cm-dta-media-modal"
        open={Boolean(mediaPreview)}
        onCancel={() => setMediaPreview(null)}
        width={920}
        title={previewMedia ? `${humanize(mediaTypeOf(previewMedia))} Preview · ${previewIndex + 1} of ${previewItems.length}` : 'Media Preview'}
        zIndex={2000}
        footer={
          <div className="cm-dta-media-footer">
            <Button icon={<LeftOutlined />} disabled={previewIndex <= 0} onClick={() => setMediaPreview((prev) => prev ? { ...prev, index: prev.index - 1 } : prev)}>Previous</Button>
            <Button onClick={() => setMediaPreview(null)}>Close</Button>
            <Button icon={<RightOutlined />} disabled={previewIndex >= previewItems.length - 1} onClick={() => setMediaPreview((prev) => prev ? { ...prev, index: prev.index + 1 } : prev)}>Next</Button>
          </div>
        }
      >
        {previewMedia ? <MediaPreview media={previewMedia} /> : null}
      </Modal>

      <Modal
        className="cm-dta-action-modal"
        open={Boolean(actionOpen)}
        onCancel={() => { if (!actionBusy) { setActionOpen(null); setRemarkCode(''); setRemarks(''); } }}
        title={actionOpen === 'APPROVE' ? 'Approve Listing' : actionOpen === 'REJECT' ? 'Reject Listing' : 'Request Changes'}
        zIndex={1800}
        footer={[
          <Button key="cancel" disabled={actionBusy} onClick={() => { setActionOpen(null); setRemarkCode(''); setRemarks(''); }}>Cancel</Button>,
          <Button key="submit" type="primary" danger={actionOpen === 'REJECT'} loading={actionBusy} disabled={remarkTemplatesLoading || !remarkCode || usingRemarkFallback || (actionOpen === 'APPROVE' && !canSubmitApprove)} onClick={() => void submitAction()}>Submit</Button>,
        ]}
      >
        <Space direction="vertical" size={14} style={{ width: '100%' }}>
          <Alert
            showIcon
            type={actionOpen === 'APPROVE' ? 'success' : actionOpen === 'REJECT' ? 'error' : 'warning'}
            icon={actionOpen === 'REJECT' ? <WarningOutlined /> : undefined}
            message={actionOpen === 'APPROVE'
              ? 'This moves the listing to the next approval level or publishes it at the final level.'
              : 'The selected controlled message will be recorded in approval history and shown to the farmer.'}
          />
          <div>
            <div className="cm-dta-field-label">Controlled review message</div>
            {remarkTemplatesLoading ? <Spin size="small" /> : (
              <SingleShellDropdown
                value={remarkCode}
                options={remarkTemplates.map((item) => ({ value: item.code, label: item.label }))}
                onChange={(code) => {
                  const template = remarkTemplates.find((item) => item.code === code);
                  setRemarkCode(code);
                  setRemarks(template?.message || '');
                }}
              />
            )}
          </div>
          {remarks ? <div className="cm-dta-message-preview"><Text type="secondary">Message to farmer</Text><div>{remarks}</div></div> : null}
          {usingRemarkFallback ? <Alert showIcon type="warning" message="Template service is unavailable. Submission is disabled until controlled localized templates are available." /> : null}
          <Text type="secondary">Decision recorded against {username || 'current user'}{role ? ` (${humanize(role)})` : ''}.</Text>
        </Space>
      </Modal>
    </PageContainer>
  );
}
