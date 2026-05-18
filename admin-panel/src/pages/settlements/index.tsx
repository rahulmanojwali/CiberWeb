import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
  Box,
  LinearProgress,
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
import BusinessOutlinedIcon from "@mui/icons-material/BusinessOutlined";
import StorefrontIcon from "@mui/icons-material/Storefront";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import ConfirmationNumberOutlinedIcon from "@mui/icons-material/ConfirmationNumberOutlined";
import PersonOutlineIcon from "@mui/icons-material/PersonOutline";
import AgricultureOutlinedIcon from "@mui/icons-material/AgricultureOutlined";
import FilterListIcon from "@mui/icons-material/FilterList";
import { PageContainer } from "../../components/PageContainer";
import { FilterInputAdornment } from "../../components/ui/FilterInputAdornment";
import { listAuctionSettlements, updateAuctionSettlementStatus } from "../../api/settlements";
import { getCurrentAdminUsername } from "../../utils/session";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import { getAuctionSessions } from "../../services/auctionOpsApi";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { formatCurrencyINR, formatDateTime, formatMongoDecimal, safeText } from "../../utils/formatters";

const NEXT_BY_ACTION = {
  PAYMENT_REQUESTED: "PAYMENT_REQUESTED",
  CANCELLED: "CANCELLED",
  DISPUTED: "DISPUTED",
} as const;

const STATUS_CHOICES = [
  "PENDING",
  "PAYMENT_REQUESTED",
  "PAYMENT_INITIATED",
  "PAYMENT_PENDING_CONFIRMATION",
  "PAID",
  "VERIFIED",
  "SETTLED",
  "FAILED",
  "CANCELLED",
  "DISPUTED",
  "REFUNDED",
];

const PAYMENT_STATUS_CHOICES = [
  "NOT_REQUESTED",
  "REQUESTED",
  "INITIATED",
  "PENDING_CONFIRMATION",
  "PAID",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
];

type Option = { value: string; label: string };

const DEFAULT_FILTERS = {
  org_id: "",
  mandi_id: "",
  status: "",
  payment_status: "",
  session_id: "",
  lot_code: "",
  trader_username: "",
  farmer_username: "",
  date_from: "",
  date_to: "",
};

type SettlementRow = {
  id: string;
  _id: string;
  auction_result_id?: string;
  auction_lot_id?: string;
  lot_code?: string | null;
  session_code?: string | null;
  farmer_username?: string | null;
  trader_username?: string | null;
  final_amount?: any;
  final_rate_per_qtl?: any;
  quantity_kg?: any;
  quantity_qtl?: any;
  status?: string | null;
  payment_status?: string | null;
  dispute_status?: string | null;
  lifecycle_state_reason?: string | null;
  created_on?: string;
  updated_on?: string;
  created_by?: string;
  updated_by?: string;
};

function currentAdminUser(): any {
  try {
    const raw = localStorage.getItem("cd_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getSettlementStatusClass(status: any): string {
  const value = String(status || "").toUpperCase();
  if (["SETTLED", "VERIFIED", "PAID"].includes(value)) return "cm-status-success";
  if (["FAILED", "CANCELLED", "DISPUTED", "REFUNDED"].includes(value)) return "cm-status-danger";
  if (["PAYMENT_REQUESTED", "PAYMENT_INITIATED", "PAYMENT_PENDING_CONFIRMATION"].includes(value)) return "cm-status-info";
  return "cm-status-pending";
}

function getPaymentStatusClass(status: any): string {
  const value = String(status || "").toUpperCase();
  if (value === "PAID") return "cm-status-success";
  if (["FAILED", "REFUNDED", "CANCELLED"].includes(value)) return "cm-status-danger";
  if (["REQUESTED", "INITIATED", "PENDING_CONFIRMATION"].includes(value)) return "cm-status-info";
  return "cm-status-pending";
}

export const SettlementsPage: React.FC = () => {
  const uiConfig = useAdminUiConfig();
  const isSuperAdmin = uiConfig.role === "SUPER_ADMIN";
  const scopedOrgId = String(uiConfig.scope?.org_id || "").trim();
  const scopedOrgCode = String(uiConfig.scope?.org_code || "").trim();

  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalRecords, setTotalRecords] = useState(0);
  const [selected, setSelected] = useState<SettlementRow | null>(null);
  const [actionTarget, setActionTarget] = useState<SettlementRow | null>(null);

  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState("PAYMENT_REQUESTED");
  const [statusReason, setStatusReason] = useState("");

  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [orgOptions, setOrgOptions] = useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [sessionOptions, setSessionOptions] = useState<Option[]>([]);
  const [sessionSearchText, setSessionSearchText] = useState("");
  const [sessionDropdownEnabled, setSessionDropdownEnabled] = useState(true);

  const load = useCallback(async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp: any = await listAuctionSettlements({
        username,
        language: "en",
        filters: {
          ...filters,
          page,
          page_size: pageSize,
        },
      });
      const data = resp?.data || resp?.response?.data || {};
      const items = Array.isArray(data.items) ? data.items : [];
      setRows(items.map((x: any) => ({ ...x, id: String(x?._id || "") })));
      setTotalRecords(Number(data.total_records || 0));
    } catch (err) {
      console.error("[settlements][load]", err);
      setRows([]);
      setTotalRecords(0);
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    load();
  }, [load]);

  const loadOrgs = useCallback(async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    try {
      const resp: any = await fetchOrganisations({ username, language: "en" });
      const data = resp?.data || resp?.response?.data || {};
      const items = Array.isArray(data?.items)
        ? data.items
        : Array.isArray(data?.organisations)
          ? data.organisations
          : data?.rows || [];
      const nextOptions = (items || []).map((o: any) => ({
        value: String(o.org_id || o._id || ""),
        label: o.org_name || o.name || o.org_code || String(o.org_id || ""),
      })).filter((o: Option) => Boolean(o.value));
      if (!nextOptions.length && scopedOrgId) {
        const user = currentAdminUser();
        setOrgOptions([{ value: scopedOrgId, label: user?.org_name || scopedOrgCode || scopedOrgId }]);
        return;
      }
      setOrgOptions(nextOptions);
    } catch (err) {
      console.error("[settlements][loadOrgs]", err);
      if (scopedOrgId) {
        const user = currentAdminUser();
        setOrgOptions([{ value: scopedOrgId, label: user?.org_name || scopedOrgCode || scopedOrgId }]);
        return;
      }
      setOrgOptions([]);
    }
  }, [scopedOrgCode, scopedOrgId]);

  const loadMandis = useCallback(async () => {
    const username = getCurrentAdminUsername();
    const orgId = String(filters.org_id || scopedOrgId || "");
    if (!username || !orgId) {
      setMandiOptions([]);
      return;
    }
    try {
      const list = await getMandisForCurrentScope({ username, language: "en", org_id: orgId });
      const nextOptions = (list || []).map((m: any) => ({
        value: String(m.mandi_id ?? m.mandiId ?? ""),
        label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
      })).filter((m: Option) => Boolean(m.value));
      setMandiOptions(nextOptions);
      if (filters.mandi_id && !nextOptions.some((m: Option) => m.value === filters.mandi_id)) {
        setFilters((prev) => ({ ...prev, mandi_id: "", session_id: "" }));
      }
    } catch (err) {
      console.error("[settlements][loadMandis]", err);
      setMandiOptions([]);
    }
  }, [filters.mandi_id, filters.org_id, scopedOrgId]);

  const loadSessions = useCallback(async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    try {
      const resp: any = await getAuctionSessions({
        username,
        language: "en",
        filters: {
          org_id: filters.org_id || scopedOrgId || undefined,
          mandi_id: filters.mandi_id || undefined,
          page_size: 100,
        },
      });
      const items = resp?.data?.items || resp?.response?.data?.items || [];
      setSessionOptions(
        (items || []).map((m: any) => {
          const id = String(m?._id || m?.session_id || "");
          const code = String(m?.session_code || "").trim();
          const name = String(m?.session_name || "").trim();
          const label = [code, name].filter(Boolean).join(" - ") || id;
          return { value: id, label };
        }).filter((x: Option) => Boolean(x.value)),
      );
      setSessionDropdownEnabled(true);
    } catch (err) {
      console.error("[settlements][loadSessions]", err);
      setSessionDropdownEnabled(false);
      setSessionOptions([]);
    }
  }, [filters.mandi_id, filters.org_id, scopedOrgId]);

  useEffect(() => { loadOrgs(); }, [loadOrgs]);

  useEffect(() => {
    if (isSuperAdmin) return;
    if (!scopedOrgId) return;
    setFilters((prev) => (prev.org_id ? prev : { ...prev, org_id: scopedOrgId }));
  }, [isSuperAdmin, scopedOrgId]);

  useEffect(() => {
    if (isSuperAdmin) return;
    if (filters.org_id && filters.org_id !== scopedOrgId) {
      setFilters((prev) => ({ ...prev, org_id: scopedOrgId || prev.org_id }));
    }
  }, [filters.org_id, isSuperAdmin, scopedOrgId]);

  useEffect(() => { loadMandis(); }, [loadMandis]);

  useEffect(() => {
    setFilters((prev) => ({ ...prev, session_id: "" }));
    setSessionSearchText("");
  }, [filters.mandi_id]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const effectiveOrgId = String(filters.org_id || scopedOrgId || "");
  const orgDropdownDisabled = !isSuperAdmin || (!!scopedOrgId && orgOptions.length <= 1);
  const showAllOrganisationsOption = isSuperAdmin && orgOptions.length > 1;

  const submitStatus = useCallback(async () => {
    if (!actionTarget?._id || !targetStatus) return;
    const username = getCurrentAdminUsername();
    if (!username) return;
    const resp: any = await updateAuctionSettlementStatus({
      username,
      settlement_id: actionTarget._id,
      status: targetStatus,
      reason: statusReason,
    });
    const code = String(resp?.response?.responsecode || resp?.responsecode || "1");
    if (code !== "0") {
      alert(resp?.response?.description || "Status update failed");
      return;
    }
    setStatusDialogOpen(false);
    setActionTarget(null);
    setStatusReason("");
    await load();
  }, [actionTarget, targetStatus, statusReason, load]);

  const openActionDialog = useCallback((row: SettlementRow, status: string) => {
    setSelected(null);
    setActionTarget(row);
    setTargetStatus(status);
    setStatusDialogOpen(true);
  }, []);

  const totalPages = Math.max(1, Math.ceil((totalRecords || 0) / pageSize));
  const totalSettlements = rows.length;
  const pendingCount = rows.filter((x) => String(x.status || "").toUpperCase() === "PENDING").length;
  const paymentRequestedCount = rows.filter((x) => String(x.payment_status || "").toUpperCase() === "REQUESTED").length;
  const paidCount = rows.filter((x) => String(x.payment_status || "").toUpperCase() === "PAID").length;

  return (
    <PageContainer>
      <div className="cm-page">
        <div className="cm-page-header">
          <h1 className="cm-page-title">Settlement Lifecycle</h1>
          <div className="cm-page-subtitle">
            Track sold lots, farmer payable status, trader payments and manual settlement actions.
          </div>
        </div>

        <div className="cm-card cm-filter-card cm-premium-filters">
          <div className="cm-filter-title-row">
            <div className="cm-filter-title">
              <FilterListIcon fontSize="small" />
              Filters
            </div>
          </div>
          {loading && <LinearProgress sx={{ borderRadius: 1, mb: 1.5 }} />}
          <div className="cm-filter-row">
            <TextField
              select
              fullWidth
              size="small"
              label="Organisation"
              value={filters.org_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, org_id: String(e.target.value || "") }))}
              disabled={orgDropdownDisabled}
              InputProps={{
                startAdornment: <FilterInputAdornment icon={BusinessOutlinedIcon} />,
              }}
            >
              {showAllOrganisationsOption && <MenuItem value=""><em>All Organisations</em></MenuItem>}
              {orgOptions.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              size="small"
              label="Mandi"
              value={filters.mandi_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, mandi_id: String(e.target.value || "") }))}
              disabled={!effectiveOrgId}
              InputProps={{
                startAdornment: <FilterInputAdornment icon={StorefrontIcon} />,
              }}
            >
              <MenuItem value=""><em>All Mandis</em></MenuItem>
              {mandiOptions.map((m) => (
                <MenuItem key={m.value} value={m.value}>{m.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              size="small"
              label="Settlement Status"
              value={filters.status}
              onChange={(e) => setFilters((prev) => ({ ...prev, status: String(e.target.value || "") }))}
              InputProps={{
                startAdornment: <FilterInputAdornment icon={ReceiptLongOutlinedIcon} />,
              }}
            >
              <MenuItem value=""><em>All Statuses</em></MenuItem>
              {STATUS_CHOICES.map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              fullWidth
              size="small"
              label="Payment Status"
              value={filters.payment_status}
              onChange={(e) => setFilters((prev) => ({ ...prev, payment_status: String(e.target.value || "") }))}
              InputProps={{
                startAdornment: <FilterInputAdornment icon={PaymentsOutlinedIcon} />,
              }}
            >
              <MenuItem value=""><em>All Payment Statuses</em></MenuItem>
              {PAYMENT_STATUS_CHOICES.map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>

          </div>

          <div className="cm-filter-row">
            {sessionDropdownEnabled ? (
              <Autocomplete
                options={sessionOptions}
                value={sessionOptions.find((opt) => opt.value === filters.session_id) || null}
                inputValue={sessionSearchText}
                onInputChange={(_e, value) => setSessionSearchText(value)}
                onChange={(_e, option) => {
                  setFilters((prev) => ({ ...prev, session_id: option?.value || "" }));
                }}
                getOptionLabel={(option) => option.label}
                isOptionEqualToValue={(opt, val) => opt.value === val.value}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    fullWidth
                    size="small"
                    label="Auction Session"
                    InputProps={{
                      ...params.InputProps,
                      startAdornment: (
                        <>
                          <FilterInputAdornment icon={EventNoteOutlinedIcon} />
                          {params.InputProps.startAdornment}
                        </>
                      ),
                    }}
                  />
                )}
              />
            ) : (
              <TextField
                fullWidth
                size="small"
                label="Session Code / Session ID"
                value={filters.session_id}
                onChange={(e) => setFilters((prev) => ({ ...prev, session_id: e.target.value }))}
                InputProps={{
                  startAdornment: <FilterInputAdornment icon={EventNoteOutlinedIcon} />,
                }}
              />
            )}
            <TextField
              fullWidth
              size="small"
              label="Lot Code"
              value={filters.lot_code}
              onChange={(e) => setFilters((prev) => ({ ...prev, lot_code: e.target.value }))}
              InputProps={{
                startAdornment: <FilterInputAdornment icon={ConfirmationNumberOutlinedIcon} />,
              }}
            />

            <TextField
              fullWidth
              size="small"
              label="Trader Username"
              value={filters.trader_username}
              onChange={(e) => setFilters((prev) => ({ ...prev, trader_username: e.target.value }))}
              InputProps={{
                startAdornment: <FilterInputAdornment icon={PersonOutlineIcon} />,
              }}
            />

            <TextField
              fullWidth
              size="small"
              label="Farmer Username"
              value={filters.farmer_username}
              onChange={(e) => setFilters((prev) => ({ ...prev, farmer_username: e.target.value }))}
              InputProps={{
                startAdornment: <FilterInputAdornment icon={AgricultureOutlinedIcon} />,
              }}
            />
          </div>

          <div className="cm-filter-row">
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Date From"
              value={filters.date_from}
              InputLabelProps={{ shrink: true }}
              onChange={(e) => setFilters((prev) => ({ ...prev, date_from: e.target.value }))}
            />

            <TextField
              fullWidth
              size="small"
              type="date"
              label="Date To"
              value={filters.date_to}
              InputLabelProps={{ shrink: true }}
              onChange={(e) => setFilters((prev) => ({ ...prev, date_to: e.target.value }))}
            />

            <div className="cm-filter-field" />

            <div className="cm-filter-actions-inline">
              <button className="cm-btn" type="button" onClick={() => { setPage(1); load(); }}>Apply Filters</button>
              <button
                className="cm-btn cm-btn-secondary"
                type="button"
                onClick={() => {
                  setFilters(isSuperAdmin ? DEFAULT_FILTERS : { ...DEFAULT_FILTERS, org_id: scopedOrgId });
                  setSessionSearchText("");
                  setPage(1);
                }}
              >
                Clear Filters
              </button>
              <span className="cm-filter-record-count">{loading ? "Loading..." : `Showing ${rows.length} records`}</span>
            </div>
          </div>
        </div>

        <div className="cm-kpi-grid">
          <div className="cm-kpi-card"><div className="cm-kpi-label">Loaded Settlements</div><div className="cm-kpi-value">{totalSettlements}</div></div>
          <div className="cm-kpi-card"><div className="cm-kpi-label">Pending</div><div className="cm-kpi-value">{pendingCount}</div></div>
          <div className="cm-kpi-card"><div className="cm-kpi-label">Payment Requested</div><div className="cm-kpi-value">{paymentRequestedCount}</div></div>
          <div className="cm-kpi-card"><div className="cm-kpi-label">Paid</div><div className="cm-kpi-value">{paidCount}</div></div>
        </div>

        <div className="cm-card cm-table-card">
          <div className="cm-table-wrap">
            <table className="cm-table">
              <thead>
                <tr>
                  <th>Lot Code</th>
                  <th>Session Code</th>
                  <th>Farmer</th>
                  <th>Trader</th>
                  <th>Final Amount</th>
                  <th>Settlement Status</th>
                  <th>Payment Status</th>
                  <th>Created On</th>
                  <th>Updated On</th>
                  <th style={{ minWidth: 390 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>{safeText(row.lot_code)}</td>
                    <td>{safeText(row.session_code)}</td>
                    <td>{safeText(row.farmer_username)}</td>
                    <td>{safeText(row.trader_username)}</td>
                    <td><span className="cm-money">{formatCurrencyINR(row.final_amount)}</span></td>
                    <td>
                      <span className={`cm-status ${getSettlementStatusClass(row.status)}`}>
                        {safeText(row.status)}
                      </span>
                    </td>
                    <td>
                      <span className={`cm-status ${getPaymentStatusClass(row.payment_status)}`}>
                        {safeText(row.payment_status)}
                      </span>
                    </td>
                    <td>{formatDateTime(row.created_on)}</td>
                    <td>{formatDateTime(row.updated_on)}</td>
                    <td>
                      <div className="cm-row-actions">
                        <button className="cm-action-link" type="button" onClick={() => setSelected(row)}>View Details</button>
                        <button className="cm-action-link" type="button" onClick={() => openActionDialog(row, NEXT_BY_ACTION.PAYMENT_REQUESTED)}>Request Payment</button>
                        <button className="cm-action-link" type="button" onClick={() => openActionDialog(row, "PAYMENT_REQUESTED")}>Move Status</button>
                        <button className="cm-action-link cm-btn-danger" type="button" onClick={() => openActionDialog(row, NEXT_BY_ACTION.CANCELLED)}>Cancel</button>
                        <button className="cm-action-link cm-btn-danger" type="button" onClick={() => openActionDialog(row, NEXT_BY_ACTION.DISPUTED)}>Dispute</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={10} className="cm-muted" style={{ textAlign: "center" }}>
                      {loading ? "Loading settlements..." : "No settlement records found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="cm-actions-row" style={{ padding: 12, justifyContent: "space-between" }}>
            <Typography variant="body2" className="cm-muted">Page {page} of {totalPages} • Total {totalRecords}</Typography>
            <div className="cm-actions-row">
              <button className="cm-btn cm-btn-secondary" type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</button>
              <button className="cm-btn cm-btn-secondary" type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>Next</button>
            </div>
          </div>
        </div>
      </div>

      <Box>
        <Dialog
          open={Boolean(selected)}
          onClose={() => setSelected(null)}
          fullWidth
          maxWidth="md"
        >
          <DialogTitle>Settlement Detail</DialogTitle>
          <DialogContent>
            {selected && (
              <div className="cm-detail-grid" style={{ marginTop: 4 }}>
                <div className="cm-detail-label">Auction Result ID</div>
                <div className="cm-detail-value">{safeText(selected.auction_result_id)}</div>
                <div className="cm-detail-label">Auction Lot ID</div>
                <div className="cm-detail-value">{safeText(selected.auction_lot_id)}</div>
                <div className="cm-detail-label">Lot Code</div>
                <div className="cm-detail-value">{safeText(selected.lot_code)}</div>
                <div className="cm-detail-label">Session Code</div>
                <div className="cm-detail-value">{safeText(selected.session_code)}</div>
                <div className="cm-detail-label">Farmer</div>
                <div className="cm-detail-value">{safeText(selected.farmer_username)}</div>
                <div className="cm-detail-label">Trader</div>
                <div className="cm-detail-value">{safeText(selected.trader_username)}</div>
                <div className="cm-detail-label">Quantity KG</div>
                <div className="cm-detail-value">{formatMongoDecimal(selected.quantity_kg)}</div>
                <div className="cm-detail-label">Quantity QTL</div>
                <div className="cm-detail-value">{formatMongoDecimal(selected.quantity_qtl)}</div>
                <div className="cm-detail-label">Final Rate / QTL</div>
                <div className="cm-detail-value">{formatCurrencyINR(selected.final_rate_per_qtl)}</div>
                <div className="cm-detail-label">Final Amount</div>
                <div className="cm-detail-value">{formatCurrencyINR(selected.final_amount)}</div>
                <div className="cm-detail-label">Status</div>
                <div className="cm-detail-value">{safeText(selected.status)}</div>
                <div className="cm-detail-label">Payment Status</div>
                <div className="cm-detail-value">{safeText(selected.payment_status)}</div>
                <div className="cm-detail-label">Dispute Status</div>
                <div className="cm-detail-value">{safeText(selected.dispute_status)}</div>
                <div className="cm-detail-label">Lifecycle Reason</div>
                <div className="cm-detail-value cm-detail-value-long">{safeText(selected.lifecycle_state_reason)}</div>
                <div className="cm-detail-label">Created</div>
                <div className="cm-detail-value">{formatDateTime(selected.created_on)} by {safeText(selected.created_by)}</div>
                <div className="cm-detail-label">Updated</div>
                <div className="cm-detail-value">{formatDateTime(selected.updated_on)} by {safeText(selected.updated_by)}</div>
              </div>
            )}
          </DialogContent>
          <DialogActions>
            <button className="cm-btn cm-btn-secondary" type="button" onClick={() => setSelected(null)}>Close</button>
          </DialogActions>
        </Dialog>
      </Box>

      <Dialog
        open={statusDialogOpen}
        onClose={() => {
          setStatusDialogOpen(false);
          setActionTarget(null);
        }}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Move Settlement Status</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={targetStatus}
                onChange={(e) => setTargetStatus(String(e.target.value))}
              >
                {STATUS_CHOICES.map((s) => (<MenuItem key={s} value={s}>{s}</MenuItem>))}
              </Select>
            </FormControl>
            <TextField
              label="Reason"
              size="small"
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              multiline
              minRows={3}
              fullWidth
            />
            <Typography variant="body2" color="text.secondary">
              Transitions are validated by backend; invalid transitions are rejected.
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <button
            className="cm-btn cm-btn-secondary"
            type="button"
            onClick={() => {
              setStatusDialogOpen(false);
              setActionTarget(null);
            }}
          >
            Close
          </button>
          <button className="cm-btn" type="button" onClick={submitStatus}>Update</button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
