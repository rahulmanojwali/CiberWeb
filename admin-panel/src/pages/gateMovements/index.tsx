import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, MenuItem, Stack, TextField, Typography } from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import { type GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { fetchGateMovements } from "../../services/gateOpsApi";
import { fetchMandiGates, getMandisForCurrentScope } from "../../services/mandiApi";

type MovementRow = {
  id: string;
  token_code: string;
  mandi: string | number | null;
  gate: string | null;
  movement_type: string | null;
  actor: string | null;
  event_time?: string | null;
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

export const GateMovements: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const [rows, setRows] = useState<MovementRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [orgOptions, setOrgOptions] = useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [gateOptions, setGateOptions] = useState<Option[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [filters, setFilters] = useState({
    org_id: "",
    mandi_id: "",
    gate_code: "",
    token_code: "",
    token_id: "",
    date_from: "",
    date_to: "",
  });

  const canView = useMemo(
    () => can(uiConfig.resources, "gate_movements_log.view", "VIEW"),
    [uiConfig.resources],
  );

  const columns = useMemo<GridColDef<MovementRow>[]>(
    () => [
      { field: "token_code", headerName: "Token Code", width: 180 },
      { field: "mandi", headerName: "Mandi", width: 140 },
      { field: "gate", headerName: "Gate", width: 140 },
      { field: "movement_type", headerName: "Movement", width: 180 },
      { field: "actor", headerName: "Actor / Source", width: 180 },
      {
        field: "event_time",
        headerName: "Timestamp",
        width: 200,
        valueFormatter: (value) => formatDate(value),
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
    const orgId = filters.org_id;
    if (!orgId) {
      setMandiOptions([]);
      return;
    }
    try {
      const list = await getMandisForCurrentScope({
        username,
        language,
        org_id: orgId,
        filters: {
          page: 1,
          pageSize: 200,
        },
      });
      setMandiOptions(
        list.map((m: any) => ({
          value: String(m.mandi_id || m.slug || m.mandi_slug || ""),
          label: m?.name_i18n?.en || m.mandi_slug || String(m.mandi_id),
        })),
      );
    } catch (err) {
      console.error("[GateMovements] loadMandis error", err);
      setMandiOptions([]);
    }
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
    if (!username || !canView) return;
    setLoading(true);
    try {
      const resp = await fetchGateMovements({
        username,
        language,
        filters: {
          org_id: filters.org_id || undefined,
          mandi_id: filters.mandi_id ? Number(filters.mandi_id) : undefined,
          gate: filters.gate_code || undefined,
          gate_code: filters.gate_code || undefined,
          token_code: filters.token_code || undefined,
          token_id: filters.token_id || undefined,
          date_from: filters.date_from || undefined,
          date_to: filters.date_to || undefined,
          page_size: 100,
        },
      });

      const list = resp?.data?.items || resp?.response?.data?.items || [];
      const total = resp?.data?.total_records ?? resp?.response?.data?.total_records;

      const mapped: MovementRow[] = list.map((item: any, idx: number) => ({
        id: item._id || `${item.token_code || "movement"}-${idx}`,
        token_code: item.token_code || item.token_id || `token-${idx}`,
        mandi: item.mandi || item.mandi_slug || item.mandi_id || null,
        gate: item.gate_code || item.gate || null,
        movement_type: item.movement_type || item.event || item.event_type || item.action || null,
        actor: item.actor || item.source || item.performed_by || item.username || null,
        event_time: item.event_time || item.created_on || item.createdAt || null,
      }));

      mapped.sort((a, b) => {
        const ad = a.event_time || "";
        const bd = b.event_time || "";
        return new Date(bd).getTime() - new Date(ad).getTime();
      });

      setRows(mapped);
      setTotalCount(typeof total === "number" ? total : mapped.length);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrganisations();
  }, [language, uiConfig.role]);

  useEffect(() => {
    if (!filters.org_id) {
      setMandiOptions([]);
      return;
    }
    loadMandis();
  }, [filters.org_id, language]);

  useEffect(() => {
    loadGates(filters.mandi_id);
  }, [filters.mandi_id, language]);

  useEffect(() => {
    loadData();
  }, [
    filters.org_id,
    filters.mandi_id,
    filters.gate_code,
    filters.token_code,
    filters.token_id,
    filters.date_from,
    filters.date_to,
    language,
    canView,
  ]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  if (!canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view gate movements.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Stack spacing={0.5}>
          <Typography variant="h5">{t("menu.gateMovements", { defaultValue: "Gate Movements" })}</Typography>
          <Typography variant="body2" color="text.secondary">
            Live movement log from gates and devices (read-only).
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

        <TextField
          label="Token Code"
          size="small"
          sx={{ minWidth: 180 }}
          value={filters.token_code}
          onChange={(e) => updateFilter("token_code", e.target.value)}
        />

        <TextField
          label="Token ID"
          size="small"
          sx={{ minWidth: 180 }}
          value={filters.token_id}
          onChange={(e) => updateFilter("token_id", e.target.value)}
        />

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
          getRowId={(r) => r.id || r.token_code}
          disableRowSelectionOnClick
          pageSizeOptions={[25, 50, 100]}
          initialState={{ pagination: { paginationModel: { pageSize: 25, page: 0 } } }}
          minWidth={960}
        />
      </Box>
    </PageContainer>
  );
};
