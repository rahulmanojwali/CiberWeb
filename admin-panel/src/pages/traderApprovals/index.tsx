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
import { approveTrader, getTraderApprovals, rejectTrader, requestMoreInfoForTrader } from "../../services/traderApprovalsApi";

type Option = { value: string; label: string };
type MandiOption = { value: string; label: string; status?: string };

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

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [filters, setFilters] = useState({ status: "ALL", mandi_id: "", trader_username: "" });

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

  const mandiMap = useMemo(() => {
    const map = new Map<string, string>();
    mandiOptions.forEach((m) => {
      if (m.value) map.set(String(m.value), m.label);
    });
    return map;
  }, [mandiOptions]);

  const requestedMandisOptions = useMemo<MandiOption[]>(() => {
    const list = Array.isArray(selectedRow?.mandis) ? selectedRow.mandis : [];
    return list.map((m: any) => ({
      value: String(m.mandi_id),
      label: mandiMap.get(String(m.mandi_id)) || m.mandi_name || String(m.mandi_id),
      status: String(m.mandi_approval_status || "").toUpperCase(),
    }));
  }, [selectedRow, mandiMap]);

  const getMandiStatusLabel = (mandi: any, rowStatus?: string) => {
    const orgStatus = String(rowStatus || "").toUpperCase();
    if (orgStatus === "SUSPENDED") return "SUSPENDED";
    if (orgStatus === "REJECTED") return "REJECTED";
    if (orgStatus === "PENDING") return "PENDING";
    const mandiStatus = String(mandi?.mandi_approval_status || "").toUpperCase();
    if (mandiStatus === "APPROVED") {
      return String(mandi?.is_active || "").toUpperCase() === "Y" ? "LINKED" : "UNLINKED";
    }
    if (mandiStatus === "MORE_INFO") return "MORE INFO";
    if (mandiStatus === "REJECTED") return "REJECTED";
    return mandiStatus || "PENDING";
  };

  const loadMandis = async () => {
    const username = currentUsername();
    const orgId = uiConfig.scope?.org_id || "";
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
    const orgId = uiConfig.scope?.org_id || "";
    if (!username || !orgId || !canList) return;
    setLoading(true);
    try {
      const resp = await getTraderApprovals({
        username,
        language,
        filters: {
          org_id: orgId,
          approval_status: filters.status === "ALL" ? undefined : filters.status || undefined,
          mandi_id: filters.mandi_id || undefined,
          trader_username: filters.trader_username || undefined,
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
      loadMandis();
      loadData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canList, uiConfig.scope?.org_id, language]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.mandi_id, filters.trader_username]);

  const columns = useMemo<GridColDef<any>[]>(
    () => [
      { field: "trader_username", headerName: "Trader", width: 200 },
      { field: "trader_name", headerName: "Name", width: 200 },
      {
        field: "mandis",
        headerName: "Mandis",
        flex: 1,
        valueGetter: (value, row) => {
          const list = Array.isArray(row?.mandis) ? row.mandis : [];
          if (!list.length) return "-";
          return list
            .map((m: any) => {
              const name = mandiMap.get(String(m.mandi_id)) || m.mandi_name || String(m.mandi_id);
              const status = getMandiStatusLabel(m, row?.approval_status);
              return `${name} (${status})`;
            })
            .join(", ");
        },
      },
      { field: "approval_status", headerName: "Status", width: 140 },
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
              size="small"
            />
          ))}
          <TextField
            label="Mandi"
            select
            size="small"
            value={filters.mandi_id}
            onChange={(event) => setFilters((prev) => ({ ...prev, mandi_id: event.target.value }))}
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
            label="Trader"
            size="small"
            value={filters.trader_username}
            onChange={(event) => setFilters((prev) => ({ ...prev, trader_username: event.target.value }))}
            sx={{ minWidth: 200 }}
          />
        </Stack>
      </Box>

      <ResponsiveDataGrid
        autoHeight
        rows={rows}
        columns={columns}
        loading={loading}
        getRowId={(row) => row._id || row.trader_username || `${row.trader_username || Math.random()}`}
        pageSizeOptions={[10, 25, 50]}
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
                org_id: uiConfig.scope?.org_id || undefined,
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
                org_id: uiConfig.scope?.org_id || undefined,
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
                org_id: uiConfig.scope?.org_id || undefined,
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
        <DialogTitle>Trader Mandis</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Typography variant="body2">
              Trader: <strong>{selectedRow?.trader_username}</strong>
            </Typography>
            <Stack spacing={1}>
              {(Array.isArray(selectedRow?.mandis) ? selectedRow.mandis : []).map((m: any) => {
                const mandiId = String(m?.mandi_id ?? "");
                const status = getMandiStatusLabel(m, selectedRow?.approval_status);
                const canAct = ["PENDING", "MORE_INFO"].includes(String(m?.mandi_approval_status || "").toUpperCase());
                return (
                  <Box
                    key={mandiId}
                    sx={{ border: "1px solid #e0e0e0", borderRadius: 1, p: 1.5, display: "flex", flexDirection: "column", gap: 0.5 }}
                  >
                    <Typography variant="subtitle2">
                      {mandiMap.get(mandiId) || mandiId} <Chip size="small" label={status} sx={{ ml: 1 }} />
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Requested: {formatDate(m.requested_on)} {m.requested_by ? `by ${m.requested_by}` : ""}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Approved: {formatDate(m.approved_on)} {m.approved_by ? `by ${m.approved_by}` : ""}
                    </Typography>
                    {m.request_more_info_reason && (
                      <Typography variant="body2" color="text.secondary">
                        More Info: {m.request_more_info_reason} {m.request_more_info_by ? `by ${m.request_more_info_by}` : ""}
                      </Typography>
                    )}
                    {m.rejection_reason && (
                      <Typography variant="body2" color="text.secondary">
                        Rejected: {m.rejection_reason} {m.rejected_by ? `by ${m.rejected_by}` : ""}
                      </Typography>
                    )}
                    <Stack direction="row" spacing={1} mt={0.5}>
                      {canApprove && canAct && (
                        <Button
                          size="small"
                          color="success"
                          onClick={() => {
                            setSelectedMandiId(mandiId);
                            setApproveOpen(true);
                          }}
                        >
                          Approve
                        </Button>
                      )}
                      {canReject && canAct && (
                        <Button
                          size="small"
                          color="error"
                          onClick={() => {
                            setSelectedMandiId(mandiId);
                            setRejectReason("");
                            setRejectOpen(true);
                          }}
                        >
                          Reject
                        </Button>
                      )}
                      {canRequestInfo && canAct && (
                        <Button
                          size="small"
                          color="warning"
                          onClick={() => {
                            setSelectedMandiId(mandiId);
                            setInfoReason("");
                            setInfoOpen(true);
                          }}
                        >
                          More Info
                        </Button>
                      )}
                    </Stack>
                  </Box>
                );
              })}
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
