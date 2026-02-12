import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { useTranslation } from "react-i18next";
import { normalizeLanguageCode } from "../../config/languages";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { approveTrader, getTraderApprovals, rejectTrader, requestMoreInfoForTrader } from "../../services/traderApprovalsApi";

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

export const TraderApprovals: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();
  const isSuperAdmin = uiConfig.role === "SUPER_ADMIN";

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [orgOptions, setOrgOptions] = useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [filters, setFilters] = useState({
    status: "PENDING",
    org_id: "",
    mandi_id: "",
    trader_username: "",
    requested_from: "",
    requested_to: "",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalRecords, setTotalRecords] = useState(0);

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [selectedMandiId, setSelectedMandiId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoReason, setInfoReason] = useState("");

  const canList = useMemo(() => can("trader_approvals.list", "VIEW"), [can]);
  const canApprove = useMemo(() => can("trader_approvals.approve", "APPROVE"), [can]);
  const canReject = useMemo(() => can("trader_approvals.reject", "REJECT"), [can]);
  const canRequestInfo = useMemo(() => can("trader_approvals.request_more_info", "REQUEST_MORE_INFO"), [can]);

  const selectedOrgLabel = useMemo(() => {
    if (isSuperAdmin && filters.org_id === "ALL") return "All";
    const match = orgOptions.find((o) => o.value === String(filters.org_id || ""));
    if (match?.label) return match.label;
    const rowMatch = rows.find((r) => String(r?.org_id || "") === String(filters.org_id || ""));
    return rowMatch?.org_name || String(filters.org_id || uiConfig.scope?.org_id || "");
  }, [filters.org_id, isSuperAdmin, orgOptions, rows, uiConfig.scope?.org_id]);

  const displayOrgLabel = useMemo(() => {
    const rawId = String(filters.org_id || uiConfig.scope?.org_id || "");
    if (!selectedOrgLabel) return "—";
    if (selectedOrgLabel === rawId && rawId.length >= 12) return "—";
    return selectedOrgLabel;
  }, [filters.org_id, selectedOrgLabel, uiConfig.scope?.org_id]);

  const mandiMap = useMemo(() => {
    const map = new Map<string, string>();
    mandiOptions.forEach((m) => {
      if (m.value) map.set(String(m.value), m.label);
    });
    return map;
  }, [mandiOptions]);

  const getMandiStatusLabel = (mandi: any) => {
    const mandiStatus = String(mandi?.mandi_approval_status || "PENDING").toUpperCase();
    if (mandiStatus === "MORE_INFO") return "MORE INFO";
    if (mandiStatus === "REJECTED") return "REJECTED";
    if (mandiStatus === "APPROVED") return "APPROVED";
    return "PENDING";
  };

  const linkStateLabel = (row: any) => {
    const status = String(row?.mandi_approval_status || "").toUpperCase();
    if (status !== "APPROVED") return "-";
    const active = String(row?.is_active || "").toUpperCase();
    if (active === "Y" || active === "TRUE") return "LINKED";
    if (active === "N" || active === "FALSE") return "UNLINKED";
    return "UNLINKED";
  };

  const loadOrgs = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchOrganisations({ username, language });
    const data = resp?.data || resp?.response?.data || {};
    const rows = Array.isArray(data?.items) ? data.items : data?.rows || [];
    const options = (rows || []).map((o: any) => ({
      value: String(o.org_id || o._id || ""),
      label: o.org_name || o.name || String(o.org_id || ""),
    }));
    setOrgOptions(options);
    if (!filters.org_id) {
      if (isSuperAdmin) {
        setFilters((prev) => ({ ...prev, org_id: "ALL" }));
      } else if (uiConfig.scope?.org_id) {
        setFilters((prev) => ({ ...prev, org_id: String(uiConfig.scope?.org_id) }));
      }
    }
  };

  const loadMandis = async () => {
    const username = currentUsername();
    const orgIdRaw = filters.org_id || uiConfig.scope?.org_id || "";
    const orgId = isSuperAdmin && orgIdRaw === "ALL" ? "" : orgIdRaw;
    if (!username || !orgId) {
      setMandiOptions([]);
      return;
    }
    const list = await getMandisForCurrentScope({ username, language, org_id: orgId });
    setMandiOptions(
      (list || []).map((m: any) => ({
        value: String(m.mandi_id ?? m.mandiId ?? ""),
        label: m.mandi_name || m.mandi_slug || String(m.mandi_id || ""),
      })),
    );
  };

  const loadData = async () => {
    const username = currentUsername();
    const orgIdRaw = filters.org_id || uiConfig.scope?.org_id || "";
    const orgId = isSuperAdmin && orgIdRaw === "ALL" ? "" : orgIdRaw;
    if (!username || (!orgId && !(isSuperAdmin && orgIdRaw === "ALL")) || !canList) return;
    setLoading(true);
    try {
      const requestedFrom =
        filters.requested_from && filters.requested_from.trim()
          ? `${filters.requested_from}T00:00:00.000Z`
          : undefined;
      const requestedTo =
        filters.requested_to && filters.requested_to.trim()
          ? `${filters.requested_to}T23:59:59.999Z`
          : undefined;
      const resp = await getTraderApprovals({
        username,
        language,
        filters: {
          org_id: orgId || undefined,
          mandi_approval_status: filters.status === "ALL" ? undefined : filters.status || undefined,
          mandi_id: filters.mandi_id || undefined,
          trader_username: filters.trader_username || undefined,
          requested_from: requestedFrom,
          requested_to: requestedTo,
          page,
          limit: pageSize,
        },
      });
      const data = resp?.data || resp?.response?.data || {};
      const nextRows = Array.isArray(data?.items) ? data.items : [];
      const total = Number(data?.total_records || 0);
      if (!orgOptions.length && nextRows.length && !isSuperAdmin) {
        const orgId = String(nextRows[0]?.org_id || "");
        const orgName = nextRows[0]?.org_name || orgId;
        if (orgId) {
          setOrgOptions([{ value: orgId, label: orgName }]);
        }
      }
      setRows(nextRows);
      setTotalRecords(Number.isFinite(total) ? total : 0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canList) {
      loadOrgs();
      loadMandis();
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canList, uiConfig.scope?.org_id, language]);

  useEffect(() => {
    console.log("[TraderApprovals] canList =", canList);
    console.log("[TraderApprovals] org_id =", filters.org_id, "scope org_id =", uiConfig.scope?.org_id);
  }, [canList, filters.org_id, uiConfig.scope?.org_id]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.mandi_id, filters.trader_username, filters.org_id, filters.requested_from, filters.requested_to, page, pageSize]);

  useEffect(() => {
    loadMandis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.org_id]);

  const columns = useMemo<GridColDef<any>[]>(
    () => [
      { field: "trader_username", headerName: "Trader", width: 200 },
      { field: "trader_name", headerName: "Name", width: 200 },
      {
        field: "org_name",
        headerName: "Org",
        width: 220,
        valueGetter: (value, row) => row?.org_name || row?.org_id || "-",
      },
      {
        field: "mandis",
        headerName: "Mandi",
        width: 220,
        valueGetter: (value, row) => row?.mandi_name || mandiMap.get(String(row?.mandi_id)) || row?.mandi_id || "-",
      },
      {
        field: "mandi_approval_status",
        headerName: "Status",
        width: 140,
        valueGetter: (value, row) => getMandiStatusLabel(row),
      },
      {
        field: "link_state",
        headerName: "Link",
        width: 120,
        valueGetter: (value, row) => linkStateLabel(row),
      },
      {
        field: "requested_on",
        headerName: "Requested On",
        width: 180,
        valueFormatter: (value) => formatDate(value),
      },
      {
        field: "updated_on",
        headerName: "Updated On",
        width: 180,
        valueFormatter: (value) => formatDate(value),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 260,
        sortable: false,
        renderCell: (params) => (
          <Stack direction="row" spacing={1} alignItems="center">
            <Button
              size="small"
              onClick={() => {
                setSelectedRow(params.row);
                setSelectedMandiId(String(params.row?.mandi_id || ""));
                setViewOpen(true);
              }}
            >
              View
            </Button>
          </Stack>
        ),
      },
    ],
    [canApprove, canReject, canRequestInfo, mandiMap],
  );

  if (!canList) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view trader approvals.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">Trader Approvals</Typography>
          <Typography variant="body2" color="text.secondary">
            Approve or reject trader requests for mandis.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Organization: {displayOrgLabel}
          </Typography>
        </Stack>
      </Stack>

      <Box mb={2}>
      <Stack direction={{ xs: "column", md: "row" }} spacing={1} alignItems="center" flexWrap="wrap">
          <TextField
            label="Org"
            select
            size="small"
            value={filters.org_id}
            onChange={(event) => {
              setFilters((prev) => ({
                ...prev,
                org_id: String(event.target.value || ""),
                mandi_id: "",
              }));
              setPage(1);
            }}
            sx={{ minWidth: 220 }}
            disabled={!isSuperAdmin}
          >
            {isSuperAdmin && <MenuItem value="ALL">All Orgs</MenuItem>}
            {orgOptions.map((option: Option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Mandi"
            select
            size="small"
            value={filters.mandi_id}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, mandi_id: event.target.value }));
              setPage(1);
            }}
            sx={{ minWidth: 200 }}
          >
            <MenuItem value="">All</MenuItem>
            {mandiOptions.map((option: Option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Approval Status"
            select
            size="small"
            value={filters.status}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, status: String(event.target.value || "ALL") }));
              setPage(1);
            }}
            sx={{ minWidth: 190 }}
          >
            {["ALL", "PENDING", "MORE_INFO", "APPROVED", "REJECTED"].map((s) => (
              <MenuItem key={s} value={s}>
                {s === "ALL" ? "All" : s}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Trader"
            size="small"
            value={filters.trader_username}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, trader_username: event.target.value }));
              setPage(1);
            }}
            sx={{ minWidth: 200 }}
          />
          <TextField
            label="From"
            type="date"
            size="small"
            value={filters.requested_from}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, requested_from: event.target.value }));
              setPage(1);
            }}
            sx={{ minWidth: 170 }}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="To"
            type="date"
            size="small"
            value={filters.requested_to}
            onChange={(event) => {
              setFilters((prev) => ({ ...prev, requested_to: event.target.value }));
              setPage(1);
            }}
            sx={{ minWidth: 170 }}
            InputLabelProps={{ shrink: true }}
          />
          <Button variant="outlined" onClick={loadData} sx={{ minWidth: 120 }}>
            Refresh
          </Button>
        </Stack>
      </Box>

      <ResponsiveDataGrid
        autoHeight
        rows={rows}
        columns={columns}
        loading={loading}
        getRowId={(row) => `${row?._id || "row"}_${row?.mandi_id || "mandi"}`}
        paginationMode="server"
        rowCount={totalRecords}
        paginationModel={{ page: page - 1, pageSize }}
        onPaginationModelChange={(model) => {
          const nextPage = model.page + 1;
          setPage(nextPage);
          setPageSize(model.pageSize);
        }}
        pageSizeOptions={[10, 25, 50, 100]}
      />

      <Dialog open={approveOpen} onClose={() => setApproveOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Approve Trader</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Typography variant="body2">
              Trader: <strong>{selectedRow?.trader_username}</strong>
            </Typography>
            <Typography variant="body2">
              Mandi: <strong>{mandiMap.get(String(selectedMandiId)) || selectedMandiId}</strong>
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            disabled={!selectedRow || !selectedMandiId}
            onClick={async () => {
              const username = currentUsername();
              if (!username || !selectedRow) return;
              await approveTrader({
                username,
                language,
                trader_username: selectedRow.trader_username,
                org_id: selectedRow?.org_id || uiConfig.scope?.org_id || undefined,
                mandi_id: selectedMandiId,
              });
              setApproveOpen(false);
              setSelectedRow(null);
              setSelectedMandiId("");
              loadData();
            }}
          >
            Approve
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Reject Trader</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Typography variant="body2">
              Trader: <strong>{selectedRow?.trader_username}</strong>
            </Typography>
            <Typography variant="body2">
              Mandi: <strong>{mandiMap.get(String(selectedMandiId)) || selectedMandiId}</strong>
            </Typography>
            <TextField
              label="Reason"
              fullWidth
              minRows={3}
              multiline
              value={rejectReason}
              onChange={(event) => setRejectReason(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            disabled={!selectedRow || !rejectReason || !selectedMandiId}
            onClick={async () => {
              const username = currentUsername();
              if (!username || !selectedRow) return;
              await rejectTrader({
                username,
                language,
                trader_username: selectedRow.trader_username,
                reason: rejectReason,
                status: "REJECTED",
                mandi_id: selectedMandiId,
                org_id: selectedRow?.org_id || uiConfig.scope?.org_id || undefined,
              });
              setRejectOpen(false);
              setSelectedRow(null);
              setRejectReason("");
              setSelectedMandiId("");
              loadData();
            }}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={infoOpen} onClose={() => setInfoOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Request More Info</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Typography variant="body2">
              Trader: <strong>{selectedRow?.trader_username}</strong>
            </Typography>
            <Typography variant="body2">
              Mandi: <strong>{mandiMap.get(String(selectedMandiId)) || selectedMandiId}</strong>
            </Typography>
            <TextField
              label="Reason"
              fullWidth
              minRows={3}
              multiline
              value={infoReason}
              onChange={(event) => setInfoReason(event.target.value)}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setInfoOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="warning"
            disabled={!selectedRow || !infoReason || !selectedMandiId}
            onClick={async () => {
              const username = currentUsername();
              if (!username || !selectedRow) return;
              await requestMoreInfoForTrader({
                username,
                language,
                trader_username: selectedRow.trader_username,
                reason: infoReason,
                mandi_id: selectedMandiId,
                org_id: selectedRow?.org_id || uiConfig.scope?.org_id || undefined,
              });
              setInfoOpen(false);
              setSelectedRow(null);
              setInfoReason("");
              setSelectedMandiId("");
              loadData();
            }}
          >
            Send
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Trader Request Details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Typography variant="body2">
              Trader: <strong>{selectedRow?.trader_username}</strong>
            </Typography>
            <Typography variant="body2">
              Mandi: <strong>{selectedRow?.mandi_name || selectedRow?.mandi_id}</strong>
            </Typography>
            <Typography variant="body2">
              Status: <strong>{getMandiStatusLabel(selectedRow)}</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Requested: {formatDate(selectedRow?.requested_on)} {selectedRow?.requested_by ? `by ${selectedRow.requested_by}` : ""}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Approved: {formatDate(selectedRow?.approved_on)} {selectedRow?.approved_by ? `by ${selectedRow.approved_by}` : ""}
            </Typography>
            {selectedRow?.request_more_info_reason && (
              <Typography variant="body2" color="text.secondary">
                More Info: {selectedRow.request_more_info_reason} {selectedRow.request_more_info_by ? `by ${selectedRow.request_more_info_by}` : ""}
              </Typography>
            )}
            {selectedRow?.rejection_reason && (
              <Typography variant="body2" color="text.secondary">
                Rejected: {selectedRow.rejection_reason} {selectedRow.rejected_by ? `by ${selectedRow.rejected_by}` : ""}
              </Typography>
            )}
            <Stack direction="row" spacing={1}>
              {canApprove &&
                String(selectedRow?.approval_status || "").toUpperCase() !== "SUSPENDED" &&
                ["PENDING", "MORE_INFO"].includes(String(selectedRow?.mandi_approval_status || "").toUpperCase()) && (
                <Button
                  size="small"
                  color="success"
                  onClick={() => {
                    setApproveOpen(true);
                  }}
                >
                  Approve
                </Button>
              )}
              {canReject &&
                String(selectedRow?.approval_status || "").toUpperCase() !== "SUSPENDED" &&
                ["PENDING", "MORE_INFO"].includes(String(selectedRow?.mandi_approval_status || "").toUpperCase()) && (
                <Button
                  size="small"
                  color="error"
                  onClick={() => {
                    setRejectReason("");
                    setRejectOpen(true);
                  }}
                >
                  Reject
                </Button>
              )}
              {canRequestInfo &&
                String(selectedRow?.approval_status || "").toUpperCase() !== "SUSPENDED" &&
                ["PENDING", "MORE_INFO"].includes(String(selectedRow?.mandi_approval_status || "").toUpperCase()) && (
                <Button
                  size="small"
                  color="warning"
                  onClick={() => {
                    setInfoReason("");
                    setInfoOpen(true);
                  }}
                >
                  More Info
                </Button>
              )}
            </Stack>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

    </PageContainer>
  );
};
