import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
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
import {
  approveFarmerForMandis,
  listFarmerApprovalRequests,
  rejectFarmerApproval,
  requestMoreInfoFarmer,
} from "../../services/farmerApprovalsApi";

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

export const FarmerApprovals: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [orgOptions, setOrgOptions] = useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [filters, setFilters] = useState({
    status: "ALL",
    org_id: "",
    mandi_id: "",
    farmer_username: "",
    requested_from: "",
    requested_to: "",
  });

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [selectedMandiId, setSelectedMandiId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoReason, setInfoReason] = useState("");

  const canList = useMemo(() => can("farmer_approvals.list", "VIEW"), [can]);
  const canApprove = useMemo(() => can("farmer_approvals.approve", "APPROVE"), [can]);
  const canReject = useMemo(() => can("farmer_approvals.reject", "REJECT"), [can]);
  const canRequestInfo = useMemo(() => can("farmer_approvals.request_more_info", "REQUEST_MORE_INFO"), [can]);

  const mandiMap = useMemo(() => {
    const map = new Map<string, string>();
    mandiOptions.forEach((m) => {
      if (m.value) map.set(String(m.value), m.label);
    });
    return map;
  }, [mandiOptions]);

  const mandiStatusLabel = (row: any) => {
    const orgStatus = String(row?.approval_status || "").toUpperCase();
    if (orgStatus === "SUSPENDED") return "SUSPENDED";
    const mandiStatus = String(row?.mandi_approval_status || "").toUpperCase();
    if (mandiStatus === "APPROVED") {
      return String(row?.is_active || "").toUpperCase() === "Y" ? "LINKED" : "UNLINKED";
    }
    if (mandiStatus === "MORE_INFO") return "MORE INFO";
    if (mandiStatus === "REJECTED") return "REJECTED";
    if (mandiStatus === "PENDING") return "PENDING";
    return mandiStatus || "PENDING";
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
    if (!filters.org_id && uiConfig.scope?.org_id) {
      setFilters((prev) => ({ ...prev, org_id: String(uiConfig.scope?.org_id) }));
    }
  };

  const loadMandis = async () => {
    const username = currentUsername();
    const orgId = filters.org_id || uiConfig.scope?.org_id || "";
    if (!username || !orgId) return;
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
    const orgId = filters.org_id || uiConfig.scope?.org_id || "";
    if (!username || !orgId || !canList) return;
    setLoading(true);
    try {
      const resp = await listFarmerApprovalRequests({
        username,
        language,
        filters: {
          org_id: orgId,
          mandi_approval_status: filters.status === "ALL" ? undefined : filters.status,
          mandi_id: filters.mandi_id || undefined,
          farmer_username: filters.farmer_username || undefined,
          requested_from: filters.requested_from || undefined,
          requested_to: filters.requested_to || undefined,
        },
      });
      const data = resp?.data || resp?.response?.data || {};
      setRows(Array.isArray(data?.rows) ? data.rows : []);
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
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.mandi_id, filters.farmer_username, filters.org_id, filters.requested_from, filters.requested_to]);

  useEffect(() => {
    loadMandis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.org_id]);

  const columns = useMemo<GridColDef<any>[]>(
    () => [
      { field: "farmer_username", headerName: "Farmer", width: 200 },
      { field: "farmer_name", headerName: "Name", width: 200 },
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
        valueGetter: (value, row) => mandiStatusLabel(row),
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
        width: 160,
        sortable: false,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
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
        <Typography variant="h6">Not authorized to view farmer approvals.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">Farmer Approvals</Typography>
          <Typography variant="body2" color="text.secondary">
            Approve or reject farmer requests for mandis.
          </Typography>
        </Stack>
      </Stack>

      <Box mb={2}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            {["ALL", "PENDING", "MORE_INFO", "APPROVED", "REJECTED", "SUSPENDED"].map((s) => (
            <Chip
              key={s}
              label={s}
              color={filters.status === s ? "primary" : "default"}
              onClick={() => setFilters((prev) => ({ ...prev, status: s }))}
              variant={filters.status === s ? "filled" : "outlined"}
            />
            ))}
            <TextField
              select
              label="Org"
              value={filters.org_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, org_id: String(e.target.value || "") }))}
              sx={{ minWidth: 220 }}
            >
              <MenuItem value="">
                <em>All Orgs</em>
              </MenuItem>
              {orgOptions.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Mandi"
              value={filters.mandi_id}
              onChange={(e) => setFilters((prev) => ({ ...prev, mandi_id: e.target.value }))}
              sx={{ minWidth: 200 }}
          >
            <MenuItem value="">
              <em>All Mandis</em>
            </MenuItem>
            {mandiOptions.map((m) => (
              <MenuItem key={m.value} value={m.value}>
                {m.label}
              </MenuItem>
            ))}
          </TextField>
            <TextField
              label="Farmer Mobile/Username"
              value={filters.farmer_username}
              onChange={(e) => setFilters((prev) => ({ ...prev, farmer_username: e.target.value }))}
              sx={{ minWidth: 220 }}
            />
            <TextField
              label="From"
              type="date"
              value={filters.requested_from}
              onChange={(e) => setFilters((prev) => ({ ...prev, requested_from: e.target.value }))}
              sx={{ minWidth: 170 }}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="To"
              type="date"
              value={filters.requested_to}
              onChange={(e) => setFilters((prev) => ({ ...prev, requested_to: e.target.value }))}
              sx={{ minWidth: 170 }}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </Box>

      <Box sx={{ width: "100%" }}>
        <ResponsiveDataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r._id || `${r.org_id}-${r.farmer_username}`}
          disableRowSelectionOnClick
          pageSizeOptions={[10, 25, 50, 100]}
        />
      </Box>

      <Dialog open={approveOpen} onClose={() => setApproveOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Approve Farmer</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Typography variant="body2">
              Mandi: <strong>{mandiMap.get(String(selectedMandiId)) || selectedMandiId}</strong>
            </Typography>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={async () => {
              const username = currentUsername();
              const orgId = uiConfig.scope?.org_id || "";
              if (!username || !orgId || !selectedRow) return;
              await approveFarmerForMandis({
                username,
                language,
                payload: {
                  org_id: orgId,
                  farmer_username: selectedRow.farmer_username,
                  mandi_id: selectedRow.mandi_id,
                },
              });
              setApproveOpen(false);
              loadData();
            }}
          >
            Approve
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Reject Farmer</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Typography variant="body2">
              Mandi: <strong>{mandiMap.get(String(selectedMandiId)) || selectedMandiId}</strong>
            </Typography>
            <TextField
              label="Reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              multiline
              minRows={3}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={async () => {
              const username = currentUsername();
              const orgId = uiConfig.scope?.org_id || "";
              if (!username || !orgId || !selectedRow) return;
              await rejectFarmerApproval({
                username,
                language,
                payload: {
                  org_id: orgId,
                  farmer_username: selectedRow.farmer_username,
                  mandi_id: selectedRow.mandi_id,
                  reason: rejectReason,
                },
              });
              setRejectOpen(false);
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
              Farmer: <strong>{selectedRow?.farmer_username}</strong>
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
            disabled={!selectedRow || !infoReason}
            onClick={async () => {
              const username = currentUsername();
              const orgId = uiConfig.scope?.org_id || "";
              if (!username || !selectedRow || !orgId) return;
              await requestMoreInfoFarmer({
                username,
                language,
                payload: {
                  org_id: orgId,
                  farmer_username: selectedRow.farmer_username,
                  mandi_id: selectedRow.mandi_id,
                  reason: infoReason,
                },
              });
              setInfoOpen(false);
              setSelectedRow(null);
              setInfoReason("");
              loadData();
            }}
          >
            Send
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={viewOpen} onClose={() => setViewOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Farmer Request Details</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Typography variant="body2">
              Farmer: <strong>{selectedRow?.farmer_username}</strong>
            </Typography>
            <Typography variant="body2">
              Mandi: <strong>{selectedRow?.mandi_name || selectedRow?.mandi_id}</strong>
            </Typography>
            <Typography variant="body2">
              Status: <strong>{mandiStatusLabel(selectedRow)}</strong>
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
              {canApprove && ["PENDING", "MORE_INFO"].includes(String(selectedRow?.mandi_approval_status || "").toUpperCase()) && (
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
              {canReject && ["PENDING", "MORE_INFO"].includes(String(selectedRow?.mandi_approval_status || "").toUpperCase()) && (
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
              {canRequestInfo && ["PENDING", "MORE_INFO"].includes(String(selectedRow?.mandi_approval_status || "").toUpperCase()) && (
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
