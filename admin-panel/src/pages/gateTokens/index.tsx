import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { type GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { fetchGatePassTokens, fetchGateEntryTokens } from "../../services/gateOpsApi";
import { fetchMandis, fetchMandiGates } from "../../services/mandiApi";

type TokenRow = {
  id: string;
  token_code: string;
  token_type: "PASS" | "ENTRY";
  mandi: string | number | null;
  gate_code: string | null;
  device_code?: string | null;
  vehicle_no?: string | null;
  reason_code?: string | null;
  status: string | null;
  created_on?: string | null;
  updated_on?: string | null;
  updated_by?: string | null;
};

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

export const GateTokens: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const [rows, setRows] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [orgOptions, setOrgOptions] = useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [gateOptions, setGateOptions] = useState<Option[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selected, setSelected] = useState<TokenRow | null>(null);

  const [filters, setFilters] = useState({
    org_id: "",
    mandi_id: "",
    gate_code: "",
    token_type: "ALL" as "ALL" | "PASS" | "ENTRY",
    status: "",
    date_from: "",
    date_to: "",
  });

  const canViewPass = useMemo(
    () => can(uiConfig.resources, "gate_pass_tokens.view", "VIEW"),
    [uiConfig.resources],
  );
  const canViewEntry = useMemo(
    () => can(uiConfig.resources, "gate_entry_tokens.view", "VIEW"),
    [uiConfig.resources],
  );

  useEffect(() => {
    setFilters((prev) => {
      if (prev.token_type === "PASS" && !canViewPass && canViewEntry) {
        return { ...prev, token_type: "ENTRY" };
      }
      if (prev.token_type === "ENTRY" && !canViewEntry && canViewPass) {
        return { ...prev, token_type: "PASS" };
      }
      if (prev.token_type === "ALL") {
        if (!canViewPass && canViewEntry) return { ...prev, token_type: "ENTRY" };
        if (!canViewEntry && canViewPass) return { ...prev, token_type: "PASS" };
      }
      return prev;
    });
  }, [canViewPass, canViewEntry]);

  const tokenTypeOptions = useMemo(() => {
    const opts: Option[] = [];
    if (canViewPass && canViewEntry) opts.push({ value: "ALL", label: "All" });
    if (canViewPass) opts.push({ value: "PASS", label: "Pass Tokens" });
    if (canViewEntry) opts.push({ value: "ENTRY", label: "Entry Tokens" });
    return opts;
  }, [canViewEntry, canViewPass]);

  const columns = useMemo<GridColDef<TokenRow>[]>(
    () => [
      { field: "token_code", headerName: "Token Code", width: 180 },
      { field: "token_type", headerName: "Type", width: 110 },
      { field: "vehicle_no", headerName: "Vehicle", width: 140 },
      { field: "reason_code", headerName: "Reason", width: 150 },
      { field: "gate_code", headerName: "Gate", width: 120 },
      { field: "device_code", headerName: "Device", width: 140 },
      {
        field: "status",
        headerName: "Status",
        width: 140,
        renderCell: (params) => (
          <Chip
            size="small"
            label={params.value || "-"}
            color={params.value === "SCANNED" ? "success" : params.value === "CREATED" ? "info" : "default"}
          />
        ),
      },
      {
        field: "created_on",
        headerName: "Created On",
        width: 190,
        valueFormatter: (value) => formatDate(value),
      },
      {
        field: "updated_on",
        headerName: "Updated On",
        width: 190,
        valueFormatter: (value) => formatDate(value),
      },
      { field: "updated_by", headerName: "Updated By", width: 140 },
      {
        field: "actions",
        headerName: "Actions",
        sortable: false,
        filterable: false,
        width: 140,
        renderCell: (params) => (
          <Button
            size="small"
            startIcon={<VisibilityOutlinedIcon fontSize="small" />}
            onClick={() => handleView(params.row)}
          >
            View
          </Button>
        ),
      },
    ],
    [],
  );

  const loadOrganisations = async () => {
    if (uiConfig.role !== "SUPER_ADMIN") return;
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchOrganisations({ username, language });
    const list = resp?.data?.organisations || resp?.response?.data?.organisations || [];
    setOrgOptions(
      list.map((org: any) => ({
        value: org._id || org.org_id || org.org_code,
        label: org.org_name ? `${org.org_name} (${org.org_code || org._id})` : org.org_code || org._id,
      })),
    );
  };

  const loadMandis = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchMandis({ username, language, filters: { is_active: true } });
    const list = resp?.data?.mandis || resp?.response?.data?.mandis || [];
    setMandiOptions(
      list.map((m: any) => ({
        value: String(m.mandi_id || m.slug || m.mandi_slug || ""),
        label: m?.name_i18n?.en || m.mandi_slug || String(m.mandi_id),
      })),
    );
  };

  const loadGates = async (mandiId?: string) => {
    const username = currentUsername();
    if (!username || !mandiId) {
      setGateOptions([]);
      return;
    }
    const resp = await fetchMandiGates({
      username,
      language,
      filters: { mandi_id: Number(mandiId), is_active: "Y" },
    });
    const list = resp?.data?.items || resp?.response?.data?.items || [];
    setGateOptions(
      list.map((g: any) => ({
        value: g.gate_code || g.code || g.slug || "",
        label: g.gate_name || g.gate_code || g.code || g.slug || "",
      })),
    );
  };

  const loadData = async () => {
    const username = currentUsername();
    if (!username || (!canViewPass && !canViewEntry)) return;
    setLoading(true);
    try {
      const commonFilters: Record<string, any> = {
        org_id: filters.org_id || undefined,
        mandi_id: filters.mandi_id ? Number(filters.mandi_id) : undefined,
        gate: filters.gate_code || undefined,
        gate_code: filters.gate_code || undefined,
        status: filters.status || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        page_size: 100,
      };

      const requests: Array<Promise<{ kind: "PASS" | "ENTRY"; payload: any }>> = [];
      if (canViewPass && filters.token_type !== "ENTRY") {
        requests.push(
          fetchGatePassTokens({ username, language, filters: commonFilters }).then((payload) => ({
            kind: "PASS",
            payload,
          })),
        );
      }
      if (canViewEntry && filters.token_type !== "PASS") {
        requests.push(
          fetchGateEntryTokens({ username, language, filters: commonFilters }).then((payload) => ({
            kind: "ENTRY",
            payload,
          })),
        );
      }

      const results = await Promise.all(requests);
      const combined: TokenRow[] = [];
      let total = 0;

      results.forEach(({ kind, payload }) => {
        const list = payload?.data?.items || payload?.response?.data?.items || [];
        const totalRecords = payload?.data?.total_records ?? payload?.response?.data?.total_records;
        if (typeof totalRecords === "number") total += totalRecords;

        list.forEach((item: any, idx: number) => {
          const code = item.token_code || item.code || `${kind}-${idx}`;
          combined.push({
            id: item._id || `${kind}-${code}-${idx}`,
            token_code: code,
            token_type: kind,
            mandi: item.mandi || item.mandi_slug || item.mandi_id || null,
            gate_code: item.gate_code || item.gate || null,
            device_code: item.device_code || null,
            vehicle_no: item.vehicle_no || null,
            reason_code: item.reason_code || item.reason || null,
            status: item.status || null,
            created_on: item.created_on || item.createdAt || null,
            updated_on: item.updated_on || item.updatedAt || null,
            updated_by: item.updated_by || item.updatedBy || null,
          });
        });
      });

      combined.sort((a, b) => {
        const ad = a.updated_on || a.created_on || "";
        const bd = b.updated_on || b.created_on || "";
        return new Date(bd).getTime() - new Date(ad).getTime();
      });

      setRows(combined);
      setTotalCount(total || combined.length);
    } finally {
      setLoading(false);
    }
  };

  const handleView = (row: TokenRow) => {
    setSelected(row);
    setDetailOpen(true);
  };

  const closeDetail = () => {
    setDetailOpen(false);
    setSelected(null);
  };

  useEffect(() => {
    loadOrganisations();
    loadMandis();
  }, [language, uiConfig.role]);

  useEffect(() => {
    loadGates(filters.mandi_id);
  }, [filters.mandi_id, language]);

  useEffect(() => {
    loadData();
  }, [
    filters.org_id,
    filters.mandi_id,
    filters.gate_code,
    filters.status,
    filters.token_type,
    filters.date_from,
    filters.date_to,
    language,
    canViewPass,
    canViewEntry,
  ]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  if (!canViewPass && !canViewEntry) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view gate tokens.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">{t("menu.gateTokens", { defaultValue: "Gate Tokens" })}</Typography>
          <Typography variant="body2" color="text.secondary">
            Combined view of gate pass and entry tokens (read-only).
          </Typography>
        </Stack>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading}>
          Refresh
        </Button>
      </Stack>

      <Stack
        direction={{ xs: "column", md: "row" }}
        spacing={2}
        mb={2}
        alignItems={{ xs: "flex-start", md: "center" }}
        flexWrap="wrap"
      >
        {uiConfig.role === "SUPER_ADMIN" && (
          <TextField
            select
            label="Organisation"
            size="small"
            sx={{ minWidth: 220 }}
            value={filters.org_id}
            onChange={(e) => updateFilter("org_id", e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {orgOptions.map((o) => (
              <MenuItem key={o.value} value={o.value}>
                {o.label}
              </MenuItem>
            ))}
          </TextField>
        )}

        <TextField
          select
          label="Mandi"
          size="small"
          sx={{ minWidth: 180 }}
          value={filters.mandi_id}
          onChange={(e) => updateFilter("mandi_id", e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          {mandiOptions.map((m) => (
            <MenuItem key={m.value} value={m.value}>
              {m.label}
            </MenuItem>
          ))}
        </TextField>

        <TextField
          select
          label="Gate"
          size="small"
          sx={{ minWidth: 160 }}
          value={filters.gate_code}
          onChange={(e) => updateFilter("gate_code", e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          {gateOptions.map((g) => (
            <MenuItem key={g.value} value={g.value}>
              {g.label}
            </MenuItem>
          ))}
        </TextField>

        {tokenTypeOptions.length > 0 && (
          <TextField
            select
            label="Token Type"
            size="small"
            sx={{ minWidth: 150 }}
            value={filters.token_type}
            onChange={(e) => updateFilter("token_type", e.target.value as any)}
          >
            {tokenTypeOptions.map((opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.label}
              </MenuItem>
            ))}
          </TextField>
        )}

        <TextField
          select
          label="Status"
          size="small"
          sx={{ minWidth: 150 }}
          value={filters.status}
          onChange={(e) => updateFilter("status", e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          <MenuItem value="CREATED">Created</MenuItem>
          <MenuItem value="SCANNED">Scanned</MenuItem>
          <MenuItem value="IN_YARD">In Yard</MenuItem>
          <MenuItem value="EXITED">Exited</MenuItem>
          <MenuItem value="CANCELLED">Cancelled</MenuItem>
        </TextField>

        <TextField
          label="Date From"
          type="date"
          size="small"
          value={filters.date_from}
          onChange={(e) => updateFilter("date_from", e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Date To"
          type="date"
          size="small"
          value={filters.date_to}
          onChange={(e) => updateFilter("date_to", e.target.value)}
          InputLabelProps={{ shrink: true }}
        />
      </Stack>

      <Box sx={{ width: "100%" }}>
        <Typography variant="body2" color="text.secondary" mb={1}>
          Showing {rows.length} records{totalCount ? ` (server total: ${totalCount})` : ""}.
        </Typography>
        <ResponsiveDataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r.id || `${r.token_type}-${r.token_code}`}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
          minWidth={960}
        />
      </Box>

      <Dialog open={detailOpen} onClose={closeDetail} fullWidth maxWidth="sm">
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="h6">Gate Token</Typography>
          <IconButton aria-label="close" onClick={closeDetail}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {!selected ? (
            <Typography color="text.secondary">No data</Typography>
          ) : (
            <Stack spacing={2}>
              <TextField
                label="Token Code"
                value={selected?.token_code ?? ""}
                size="small"
                InputProps={{ readOnly: true }}
                fullWidth
              />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Type"
                  value={selected?.token_type ?? ""}
                  size="small"
                  InputProps={{ readOnly: true }}
                  fullWidth
                />
                <TextField
                  label="Status"
                  value={selected?.status ?? ""}
                  size="small"
                  InputProps={{ readOnly: true }}
                  fullWidth
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Vehicle"
                  value={selected?.vehicle_no ?? ""}
                  size="small"
                  InputProps={{ readOnly: true }}
                  fullWidth
                />
                <TextField
                  label="Reason"
                  value={selected?.reason_code ?? ""}
                  size="small"
                  InputProps={{ readOnly: true }}
                  fullWidth
                />
              </Stack>
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Gate"
                  value={selected?.gate_code ?? ""}
                  size="small"
                  InputProps={{ readOnly: true }}
                  fullWidth
                />
                <TextField
                  label="Device"
                  value={selected?.device_code ?? ""}
                  size="small"
                  InputProps={{ readOnly: true }}
                  fullWidth
                />
              </Stack>
              <Divider />
              <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
                <TextField
                  label="Updated On"
                  value={formatDate(selected?.updated_on)}
                  size="small"
                  InputProps={{ readOnly: true }}
                  fullWidth
                />
                <TextField
                  label="Updated By"
                  value={selected?.updated_by ?? ""}
                  size="small"
                  InputProps={{ readOnly: true }}
                  fullWidth
                />
              </Stack>
              <TextField
                label="Created On"
                value={formatDate(selected?.created_on)}
                size="small"
                InputProps={{ readOnly: true }}
                fullWidth
              />
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
};
