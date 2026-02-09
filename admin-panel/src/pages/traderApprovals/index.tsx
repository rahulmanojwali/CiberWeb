import React, { useEffect, useMemo, useState } from "react";
import {
  Autocomplete,
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
import { approveTrader, getTraderApprovals, reactivateTrader, rejectTrader, requestMoreInfoForTrader } from "../../services/traderApprovalsApi";

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

  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [filters, setFilters] = useState({ status: "ALL", mandi_id: "", trader_username: "" });

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [reactivateOpen, setReactivateOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<any>(null);
  const [selectedMandis, setSelectedMandis] = useState<string[]>([]);
  const [rejectReason, setRejectReason] = useState("");
  const [infoOpen, setInfoOpen] = useState(false);
  const [infoReason, setInfoReason] = useState("");
  const [actionMode, setActionMode] = useState<"REJECT" | "SUSPEND">("REJECT");

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

  const requestedMandisOptions = useMemo(() => {
    const list = Array.isArray(selectedRow?.mandis) ? selectedRow.mandis : [];
    return list.map((m: any) => ({
      value: String(m.mandi_id),
      label: mandiMap.get(String(m.mandi_id)) || m.mandi_name || String(m.mandi_id),
    }));
  }, [selectedRow, mandiMap]);

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

  const hasInactiveMandis = (row: any) =>
    Array.isArray(row?.mandis) && row.mandis.some((m: any) => String(m.is_active).toUpperCase() === "N");

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
              const status = String(m.is_active).toUpperCase() === "N" ? "Inactive" : "Active";
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
            {canApprove && params.row.approval_status === "PENDING" && (
              <Button
                size="small"
                color="success"
                onClick={() => {
                  setSelectedRow(params.row);
                  const requested = Array.isArray(params.row?.mandis)
                    ? params.row.mandis.map((m: any) => String(m.mandi_id))
                    : [];
                  setSelectedMandis(requested);
                  setApproveOpen(true);
                }}
              >
                Approve
              </Button>
            )}
            
            {canRequestInfo && params.row.approval_status === "PENDING" && (
              <Button
                size="small"
                color="warning"
                onClick={() => {
                  setSelectedRow(params.row);
                  setInfoReason("");
                  setInfoOpen(true);
                }}
              >
                More Info
              </Button>
            )}
            {canReject && params.row.approval_status === "PENDING" && (
              <Button
                size="small"
                color="error"
                onClick={() => {
                  setSelectedRow(params.row);
                  setRejectReason("");
                  setActionMode("REJECT");
                  setRejectOpen(true);
                }}
              >
                Reject
              </Button>
            )}
            {canReject && params.row.approval_status === "APPROVED" && (
              <Button
                size="small"
                color="warning"
                onClick={() => {
                  setSelectedRow(params.row);
                  const active = Array.isArray(params.row?.mandis)
                    ? params.row.mandis
                        .filter((m: any) => String(m.is_active).toUpperCase() === "Y")
                        .map((m: any) => String(m.mandi_id))
                    : [];
                  setSelectedMandis(active);
                  setRejectReason("");
                  setActionMode("SUSPEND");
                  setRejectOpen(true);
                }}
              >
                Suspend
              </Button>
            )}
            {canApprove && params.row.approval_status === "APPROVED" && hasInactiveMandis(params.row) && (
              <Button
                size="small"
                color="success"
                onClick={() => {
                  setSelectedRow(params.row);
                  const inactive = Array.isArray(params.row?.mandis)
                    ? params.row.mandis
                        .filter((m: any) => String(m.is_active).toUpperCase() === "N")
                        .map((m: any) => String(m.mandi_id))
                    : [];
                  setSelectedMandis(inactive);
                  setReactivateOpen(true);
                }}
              >
                Activate
              </Button>
            )}
            {canApprove && params.row.approval_status === "SUSPENDED" && (
              <Button
                size="small"
                color="success"
                onClick={() => {
                  setSelectedRow(params.row);
                  const inactive = Array.isArray(params.row?.mandis)
                    ? params.row.mandis
                        .filter((m: any) => String(m.is_active).toUpperCase() === "N")
                        .map((m: any) => String(m.mandi_id))
                    : [];
                  setSelectedMandis(inactive);
                  setReactivateOpen(true);
                }}
              >
                Activate
              </Button>
            )}
            {canApprove && params.row.approval_status === "REJECTED" && (
              <Button
                size="small"
                color="success"
                onClick={() => {
                  setSelectedRow(params.row);
                  const requested = Array.isArray(params.row?.mandis)
                    ? params.row.mandis.map((m: any) => String(m.mandi_id))
                    : [];
                  setSelectedMandis(requested);
                  setApproveOpen(true);
                }}
              >
                Re-Approve
              </Button>
            )}
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
          {["ALL", "PENDING", "APPROVED", "REJECTED", "SUSPENDED"].map((s) => (
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
            {mandiOptions.map((option) => (
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
            <Autocomplete
              multiple
              options={requestedMandisOptions}
              disableCloseOnSelect={false}
              getOptionLabel={(option) => option.label}
              value={requestedMandisOptions.filter((o: Option) => selectedMandis.includes(o.value))}
              onChange={(_, newValue) => setSelectedMandis(newValue.map((v) => v.value))}
              renderInput={(params) => <TextField {...params} label="Mandis" fullWidth />}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApproveOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            disabled={!selectedRow || selectedMandis.length === 0}
            onClick={async () => {
              const username = currentUsername();
              if (!username || !selectedRow) return;
              await approveTrader({
                username,
                language,
                trader_username: selectedRow.trader_username,
                org_id: uiConfig.scope?.org_id || undefined,
                mandis: selectedMandis,
              });
              setApproveOpen(false);
              setSelectedRow(null);
              setSelectedMandis([]);
              loadData();
            }}
          >
            Approve
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={rejectOpen} onClose={() => setRejectOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{actionMode === "SUSPEND" ? "Suspend Trader" : "Reject Trader"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Typography variant="body2">
              Trader: <strong>{selectedRow?.trader_username}</strong>
            </Typography>
            {actionMode === "SUSPEND" && (
              <TextField
                label="Mandis to suspend"
                select
                SelectProps={{ multiple: true }}
                value={selectedMandis}
                onChange={(event) =>
                  setSelectedMandis(
                    typeof event.target.value === "string" ? event.target.value.split(",") : event.target.value
                  )
                }
                fullWidth
              >
                {requestedMandisOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </TextField>
            )}
            <TextField
              label={actionMode === "SUSPEND" ? "Reason for suspension" : "Reason"}
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
            color={actionMode === "SUSPEND" ? "warning" : "error"}
            disabled={!selectedRow || !rejectReason || (actionMode === "SUSPEND" && selectedMandis.length === 0)}
            onClick={async () => {
              const username = currentUsername();
              if (!username || !selectedRow) return;
              await rejectTrader({
                username,
                language,
                trader_username: selectedRow.trader_username,
                reason: rejectReason,
                status: actionMode === "SUSPEND" ? "SUSPENDED" : "REJECTED",
                mandis: actionMode === "SUSPEND" ? selectedMandis : undefined,
                org_id: uiConfig.scope?.org_id || undefined,
              });
              setRejectOpen(false);
              setSelectedRow(null);
              setRejectReason("");
              loadData();
            }}
          >
            {actionMode === "SUSPEND" ? "Suspend" : "Reject"}
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
              if (!username || !selectedRow) return;
              await requestMoreInfoForTrader({
                username,
                language,
                trader_username: selectedRow.trader_username,
                reason: infoReason,
                org_id: uiConfig.scope?.org_id || undefined,
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

      <Dialog open={reactivateOpen} onClose={() => setReactivateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Activate Mandis</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <Typography variant="body2">
              Trader: <strong>{selectedRow?.trader_username}</strong>
            </Typography>
            <TextField
              label="Mandis"
              select
              SelectProps={{ multiple: true }}
              value={selectedMandis}
              onChange={(event) =>
                setSelectedMandis(typeof event.target.value === "string" ? event.target.value.split(",") : event.target.value)
              }
              fullWidth
            >
              {requestedMandisOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReactivateOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            disabled={!selectedRow || selectedMandis.length === 0}
            onClick={async () => {
              const username = currentUsername();
              if (!username || !selectedRow) return;
              await reactivateTrader({
                username,
                language,
                trader_username: selectedRow.trader_username,
                mandis: selectedMandis,
                org_id: uiConfig.scope?.org_id || undefined,
              });
              setReactivateOpen(false);
              setSelectedRow(null);
              setSelectedMandis([]);
              loadData();
            }}
          >
            Activate
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
