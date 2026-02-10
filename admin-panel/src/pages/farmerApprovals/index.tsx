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
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [filters, setFilters] = useState({ status: "PENDING", mandi_id: "", farmer_username: "" });

  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
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

  const requestedMandisOptions = useMemo<Option[]>(() => {
    if (!selectedRow || !Array.isArray(selectedRow.mandis)) return [];
    return selectedRow.mandis.map((m: any) => {
      const value = String(m?.mandi_id ?? "");
      const label = mandiMap.get(value) || value;
      return { value, label };
    });
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
      const resp = await listFarmerApprovalRequests({
        username,
        language,
        filters: {
          org_id: orgId,
          approval_status: filters.status,
          mandi_id: filters.mandi_id || undefined,
          farmer_username: filters.farmer_username || undefined,
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
  }, [filters.status, filters.mandi_id, filters.farmer_username]);

  const columns = useMemo<GridColDef<any>[]>(
    () => [
      { field: "farmer_username", headerName: "Farmer", width: 200 },
      { field: "farmer_name", headerName: "Name", width: 200 },
      {
        field: "mandis",
        headerName: "Mandis",
        flex: 1,
        valueGetter: (value, row) => {
          const active = Array.isArray(row?.mandis)
            ? row.mandis.filter((m: any) => String(m.is_active).toUpperCase() === "Y")
            : [];
          if (!active.length) return "-";
          return active
            .map((m: any) => mandiMap.get(String(m.mandi_id)) || String(m.mandi_id))
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
          <Stack direction="row" spacing={1}>
            {canApprove && (
              <Button
                size="small"
                color="success"
                onClick={() => {
                  setSelectedRow(params.row);
                  const first = Array.isArray(params.row?.mandis) && params.row.mandis.length
                    ? String(params.row.mandis[0].mandi_id ?? "")
                    : "";
                  setSelectedMandiId(first);
                  setApproveOpen(true);
                }}
              >
                Approve
              </Button>
            )}
            {canRequestInfo && (
              <Button
                size="small"
                color="warning"
                onClick={() => {
                  setSelectedRow(params.row);
                  setInfoReason("");
                  const first = Array.isArray(params.row?.mandis) && params.row.mandis.length
                    ? String(params.row.mandis[0].mandi_id ?? "")
                    : "";
                  setSelectedMandiId(first);
                  setInfoOpen(true);
                }}
              >
                More Info
              </Button>
            )}
            {canReject && (
              <Button
                size="small"
                color="error"
                onClick={() => {
                  setSelectedRow(params.row);
                  setRejectReason("");
                  const first = Array.isArray(params.row?.mandis) && params.row.mandis.length
                    ? String(params.row.mandis[0].mandi_id ?? "")
                    : "";
                  setSelectedMandiId(first);
                  setRejectOpen(true);
                }}
              >
                Reject
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
          {["PENDING", "APPROVED", "REJECTED"].map((s) => (
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
            <TextField
              select
              label="Mandi"
              value={selectedMandiId}
              onChange={(e) => setSelectedMandiId(String(e.target.value || ""))}
            >
              {requestedMandisOptions.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
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
                  mandi_id: selectedMandiId,
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
            <TextField
              select
              label="Mandi"
              value={selectedMandiId}
              onChange={(e) => setSelectedMandiId(String(e.target.value || ""))}
            >
              {requestedMandisOptions.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
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
                  mandi_id: selectedMandiId,
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
            <TextField
              select
              label="Mandi"
              value={selectedMandiId}
              onChange={(e) => setSelectedMandiId(String(e.target.value || ""))}
            >
              {requestedMandisOptions.map((m) => (
                <MenuItem key={m.value} value={m.value}>
                  {m.label}
                </MenuItem>
              ))}
            </TextField>
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
                  mandi_id: selectedMandiId,
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
    </PageContainer>
  );
};
