import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  Col,
  Empty,
  Input,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CalendarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SwapOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { CmStatCard } from "../../design-system/components/CmStatCard";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { fetchOrganisations } from "../../services/adminUsersApi";
import {
  fetchGateEntryTokenAnalytics,
  fetchGateEntryTokens,
  fetchGatePassTokens,
} from "../../services/gateOpsApi";
import { fetchMandiGates, getMandisForCurrentScope } from "../../services/mandiApi";
import { usePermissions } from "../../authz/usePermissions";
import { formatBusinessDateTime } from "../../utils/formatters";
import "./gateTokens.css";

type TokenRow = {
  id: string;
  token_code: string;
  token_type: "PASS" | "ENTRY";
  mandi: string | number | null;
  mandi_name?: string | null;
  gate_code: string | null;
  device_code?: string | null;
  vehicle_no?: string | null;
  reason_code?: string | null;
  status: string | null;
  last_step?: string | null;
  created_on?: string | null;
  updated_on?: string | null;
  updated_by?: string | null;
};

type Option = { value: string; label: string };

type AnalyticsPoint = {
  date: string;
  label: string;
  issued: number;
  entered: number;
};

type AnalyticsData = {
  month: string;
  timezone?: string;
  summary: {
    issued: number;
    entered: number;
    active: number;
    expired: number;
    cancelled: number;
  };
  daily: AnalyticsPoint[];
  insight?: {
    peak_date?: string | null;
    peak_label?: string | null;
    peak_total?: number;
  };
};

const PAGE_SIZE_OPTIONS = [20, 50, 100];
const ACTIVE_STATUSES = new Set([
  "ISSUED",
  "CREATED",
  "SCANNED",
  "VERIFIED",
  "IN_YARD",
  "LOT_CREATED",
  "LOTS_CLOSED",
  "WEIGH_IN",
  "WEIGH_OUT",
]);

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function responseData(payload: any) {
  return payload?.data || payload?.response?.data || {};
}

function responseSucceeded(payload: any) {
  return payload?.response?.responsecode === "0" || payload?.responsecode === "0";
}

function statusTone(status?: string | null): string {
  const value = String(status || "").toUpperCase();
  if (value === "EXITED" || value === "IN_YARD" || value === "VERIFIED") return "success";
  if (value === "CANCELLED" || value === "EXPIRED") return "error";
  if (value === "ISSUED" || value === "CREATED") return "processing";
  if (ACTIVE_STATUSES.has(value)) return "warning";
  return "default";
}

export const GateTokens: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();
  const navigate = useNavigate();
  const [messageApi, contextHolder] = message.useMessage();

  const canViewPass = can("gate_pass_tokens.view", "VIEW");
  const canViewEntry = can("gate_entry_tokens.list", "VIEW");
  const canCreateEntry = can("gate_entry_tokens.create", "CREATE");
  const canUpdateEntry = can("gate_entry_tokens.update", "UPDATE");
  const canCreatePass = can("gate_pass_tokens.create", "CREATE");

  const [rows, setRows] = useState<TokenRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [orgOptions, setOrgOptions] = useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = useState<Option[]>([]);
  const [gateOptions, setGateOptions] = useState<Option[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  const [filters, setFilters] = useState({
    org_id: uiConfig.role === "SUPER_ADMIN" ? "" : String(uiConfig.scope?.org_id || ""),
    mandi_id: "",
    gate_code: "",
    token_type: "ALL" as "ALL" | "PASS" | "ENTRY",
    status: "",
    date_from: "",
    date_to: "",
    search: "",
    month: currentMonth(),
  });

  useEffect(() => {
    if (uiConfig.role !== "SUPER_ADMIN" && uiConfig.scope?.org_id) {
      setFilters((prev) => ({ ...prev, org_id: String(uiConfig.scope?.org_id || "") }));
    }
  }, [uiConfig.role, uiConfig.scope?.org_id]);

  useEffect(() => {
    setFilters((prev) => {
      if (prev.token_type === "PASS" && !canViewPass && canViewEntry) return { ...prev, token_type: "ENTRY" };
      if (prev.token_type === "ENTRY" && !canViewEntry && canViewPass) return { ...prev, token_type: "PASS" };
      if (prev.token_type === "ALL") {
        if (!canViewPass && canViewEntry) return { ...prev, token_type: "ENTRY" };
        if (!canViewEntry && canViewPass) return { ...prev, token_type: "PASS" };
      }
      return prev;
    });
  }, [canViewEntry, canViewPass]);

  const tokenTypeOptions = useMemo(() => {
    const options: Option[] = [];
    if (canViewPass && canViewEntry) options.push({ value: "ALL", label: "All token types" });
    if (canViewEntry) options.push({ value: "ENTRY", label: "Entry tokens" });
    if (canViewPass) options.push({ value: "PASS", label: "Pass tokens" });
    return options;
  }, [canViewEntry, canViewPass]);

  const loadOrganisations = useCallback(async () => {
    if (uiConfig.role !== "SUPER_ADMIN") return;
    const username = currentUsername();
    if (!username) return;
    try {
      const payload = await fetchOrganisations({ username, language });
      const list = responseData(payload)?.organisations || [];
      setOrgOptions(
        list.map((org: any) => ({
          value: String(org._id || org.org_id || org.org_code || ""),
          label: org.org_name
            ? `${org.org_name}${org.org_code ? ` · ${org.org_code}` : ""}`
            : String(org.org_code || org._id || ""),
        })),
      );
    } catch (error) {
      console.error("[GateTokens] organisations", error);
    }
  }, [language, uiConfig.role]);

  const loadMandis = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    if (uiConfig.role === "SUPER_ADMIN" && !filters.org_id) {
      setMandiOptions([]);
      return;
    }
    const effectiveOrgId = filters.org_id || String(uiConfig.scope?.org_id || "");
    if (!effectiveOrgId) {
      setMandiOptions([]);
      return;
    }
    try {
      const list = await getMandisForCurrentScope({
        username,
        language,
        org_id: effectiveOrgId,
        filters: { page: 1, pageSize: 200 },
      });
      setMandiOptions(
        list.map((mandi: any) => ({
          value: String(mandi.mandi_id || mandi.slug || mandi.mandi_slug || ""),
          label: mandi?.name_i18n?.[language] || mandi?.name_i18n?.en || mandi.mandi_name || mandi.mandi_slug || String(mandi.mandi_id),
        })),
      );
    } catch (error) {
      console.error("[GateTokens] mandis", error);
      setMandiOptions([]);
    }
  }, [filters.org_id, language, uiConfig.role, uiConfig.scope?.org_id]);

  const loadGates = useCallback(async () => {
    const username = currentUsername();
    if (!username || !filters.mandi_id) {
      setGateOptions([]);
      return;
    }
    try {
      const payload = await fetchMandiGates({
        username,
        language,
        filters: {
          org_id: filters.org_id || undefined,
          mandi_id: Number(filters.mandi_id),
          is_active: "Y",
        },
      });
      const list = responseData(payload)?.items || [];
      setGateOptions(
        list.map((gate: any) => ({
          value: String(gate.gate_code || gate.code || gate.slug || ""),
          label: gate.gate_name || gate.gate_code || gate.code || gate.slug || "Gate",
        })),
      );
    } catch (error) {
      console.error("[GateTokens] gates", error);
      setGateOptions([]);
    }
  }, [filters.mandi_id, filters.org_id, language]);

  const loadAnalytics = useCallback(async () => {
    if (!canViewEntry) {
      setAnalytics(null);
      return;
    }
    const username = currentUsername();
    if (!username) return;
    setAnalyticsLoading(true);
    try {
      const payload = await fetchGateEntryTokenAnalytics({
        username,
        language,
        filters: {
          org_id: filters.org_id || undefined,
          mandi_id: filters.mandi_id ? Number(filters.mandi_id) : undefined,
          gate_code: filters.gate_code || undefined,
          month: filters.month,
        },
      });
      if (!responseSucceeded(payload)) {
        throw new Error(payload?.response?.description || "Unable to load token analytics");
      }
      setAnalytics(responseData(payload) as AnalyticsData);
    } catch (error: any) {
      console.error("[GateTokens] analytics", error);
      messageApi.error(error?.message || "Unable to load gate token analytics");
      setAnalytics(null);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [canViewEntry, filters.gate_code, filters.mandi_id, filters.month, filters.org_id, language, messageApi]);

  const loadData = useCallback(async () => {
    const username = currentUsername();
    if (!username || (!canViewPass && !canViewEntry)) return;
    setLoading(true);
    try {
      const commonFilters: Record<string, any> = {
        org_id: filters.org_id || undefined,
        mandi_id: filters.mandi_id ? Number(filters.mandi_id) : undefined,
        gate_code: filters.gate_code || undefined,
        status: filters.status || undefined,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
        token_code: filters.search.trim() || undefined,
        page,
        page_size: pageSize,
      };

      const requests: Array<Promise<{ kind: "PASS" | "ENTRY"; payload: any }>> = [];
      if (canViewPass && filters.token_type !== "ENTRY") {
        requests.push(fetchGatePassTokens({ username, language, filters: commonFilters }).then((payload) => ({ kind: "PASS", payload })));
      }
      if (canViewEntry && filters.token_type !== "PASS") {
        requests.push(fetchGateEntryTokens({ username, language, filters: commonFilters }).then((payload) => ({ kind: "ENTRY", payload })));
      }

      const results = await Promise.all(requests);
      const combined: TokenRow[] = [];
      let total = 0;
      results.forEach(({ kind, payload }) => {
        const data = responseData(payload);
        const list = data?.items || [];
        if (typeof data?.total_records === "number") total += data.total_records;
        list.forEach((item: any, index: number) => {
          const code = item.token_code || item.code || `${kind}-${index}`;
          combined.push({
            id: String(item._id || `${kind}-${code}-${index}`),
            token_code: code,
            token_type: kind,
            mandi: item.mandi_id ?? item.mandi ?? item.mandi_slug ?? null,
            mandi_name: item.mandi_name || item.mandi_label || item.mandi_slug || null,
            gate_code: item.gate_code || item.gate || null,
            device_code: item.device_code || null,
            vehicle_no: item.vehicle_no || item.extra_data?.vehicle_no || null,
            reason_code: item.reason_code || item.reason || null,
            status: item.status || null,
            last_step: item.last_step || item.last_movement_step || item.movement_step || null,
            created_on: item.created_on || item.createdAt || null,
            updated_on: item.updated_on || item.updatedAt || null,
            updated_by: item.updated_by || item.updatedBy || null,
          });
        });
      });
      combined.sort((a, b) => new Date(b.updated_on || b.created_on || 0).getTime() - new Date(a.updated_on || a.created_on || 0).getTime());
      setRows(combined);
      setTotalCount(total || combined.length);
    } catch (error: any) {
      console.error("[GateTokens] list", error);
      messageApi.error(error?.message || "Unable to load gate tokens");
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [canViewEntry, canViewPass, filters, language, messageApi, page, pageSize]);

  useEffect(() => { loadOrganisations(); }, [loadOrganisations]);
  useEffect(() => { loadMandis(); }, [loadMandis]);
  useEffect(() => { loadGates(); }, [loadGates]);
  useEffect(() => { loadAnalytics(); }, [loadAnalytics]);
  useEffect(() => { loadData(); }, [loadData]);

  const updateFilter = (key: keyof typeof filters, value: string) => {
    setPage(1);
    setFilters((prev) => {
      if (key === "org_id") return { ...prev, org_id: value, mandi_id: "", gate_code: "" };
      if (key === "mandi_id") return { ...prev, mandi_id: value, gate_code: "" };
      return { ...prev, [key]: value };
    });
  };

  const columns = useMemo<ColumnsType<TokenRow>>(() => [
    {
      title: "Token",
      dataIndex: "token_code",
      key: "token_code",
      width: 190,
      fixed: "left",
      render: (value: string, row) => (
        <div className="cm-token-primary-cell">
          <Typography.Text strong>{value || "—"}</Typography.Text>
          <Typography.Text type="secondary">{row.token_type === "ENTRY" ? "Entry token" : "Pass token"}</Typography.Text>
        </div>
      ),
    },
    { title: "Vehicle", dataIndex: "vehicle_no", key: "vehicle_no", width: 145, render: (value) => value || "—" },
    { title: "Reason", dataIndex: "reason_code", key: "reason_code", width: 150, render: (value) => value || "—" },
    {
      title: "Mandi / Gate",
      key: "location",
      width: 190,
      render: (_, row) => (
        <div className="cm-token-primary-cell">
          <Typography.Text>{row.mandi_name || row.mandi || "—"}</Typography.Text>
          <Typography.Text type="secondary">{row.gate_code || "No gate"}</Typography.Text>
        </div>
      ),
    },
    { title: "Device", dataIndex: "device_code", key: "device_code", width: 155, render: (value) => value || "—" },
    { title: "Last step", dataIndex: "last_step", key: "last_step", width: 130, render: (value) => value ? <Tag>{String(value).split("_").join(" ")}</Tag> : "—" },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 135,
      render: (value) => <Tag className="cm-token-status-tag" color={statusTone(value)}>{value || "UNKNOWN"}</Tag>,
    },
    {
      title: "Created",
      dataIndex: "created_on",
      key: "created_on",
      width: 175,
      render: (value) => formatBusinessDateTime(value) || "—",
    },
    {
      title: "Actions",
      key: "actions",
      width: canUpdateEntry ? 145 : 100,
      fixed: "right",
      render: (_, row) => (
        <Space size={4}>
          <Tooltip title="View token">
            <Button type="text" icon={<EyeOutlined />} onClick={() => navigate(`/gate-tokens/${encodeURIComponent(row.token_code)}`)} />
          </Tooltip>
          <Tooltip title="Movements">
            <Button type="text" icon={<SwapOutlined />} onClick={() => navigate(`/gate-tokens/${encodeURIComponent(row.token_code)}#movements`)} />
          </Tooltip>
          {canUpdateEntry && row.token_type === "ENTRY" && (
            <Tooltip title="Update entry token">
              <Button type="text" icon={<SafetyCertificateOutlined />} onClick={() => navigate(`/gate-tokens/${encodeURIComponent(row.token_code)}?mode=edit`)} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ], [canUpdateEntry, navigate]);

  if (!canViewPass && !canViewEntry) {
    return (
      <PageContainer className="cm-gate-tokens-page">
        <Card><Empty description="You are not authorised to view gate tokens." /></Card>
      </PageContainer>
    );
  }

  const summary = analytics?.summary || { issued: 0, entered: 0, active: 0, expired: 0, cancelled: 0 };
  const monthLabel = filters.month
    ? new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(new Date(`${filters.month}-01T00:00:00`))
    : "Selected month";

  return (
    <PageContainer className="cm-gate-tokens-page">
      {contextHolder}
      <CmPageHeader
        eyebrow="GATE & YARD"
        title={t("menu.gateTokens", { defaultValue: "Gate Entry Tokens" })}
        subtitle="Monitor token issuance, actual gate entries and token lifecycle across organisations, mandis and gates."
        actions={
          <Space wrap>
            {(canCreateEntry || canCreatePass) && (
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate("/gate-entries/create")}>Create token</Button>
            )}
            <Button icon={<ReloadOutlined />} loading={loading || analyticsLoading} onClick={() => Promise.all([loadData(), loadAnalytics()])}>Refresh</Button>
          </Space>
        }
      />

      <CmSectionCard compact className="cm-gate-token-scope-card" title="Operational scope" subtitle="The chart and token list honour the same role, organisation, mandi and gate scope.">
        <div className="cm-gate-token-scope-grid">
          {uiConfig.role === "SUPER_ADMIN" && (
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="All organisations"
              value={filters.org_id || undefined}
              options={orgOptions}
              onChange={(value) => updateFilter("org_id", value || "")}
            />
          )}
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder={uiConfig.role === "SUPER_ADMIN" && !filters.org_id ? "Select organisation for mandi" : "All mandis"}
            value={filters.mandi_id || undefined}
            options={mandiOptions}
            disabled={uiConfig.role === "SUPER_ADMIN" && !filters.org_id}
            onChange={(value) => updateFilter("mandi_id", value || "")}
          />
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            placeholder="All gates"
            value={filters.gate_code || undefined}
            options={gateOptions}
            disabled={!filters.mandi_id}
            onChange={(value) => updateFilter("gate_code", value || "")}
          />
          <Input
            className="cm-month-input"
            type="month"
            value={filters.month}
            max="2100-12"
            onChange={(event) => updateFilter("month", event.target.value || currentMonth())}
            prefix={<CalendarOutlined />}
            aria-label="Analytics month"
          />
        </div>
      </CmSectionCard>

      {canViewEntry && (
        <>
          <Row gutter={[12, 12]} className="cm-gate-token-stats">
            <Col xs={24} sm={12} xl={5}><CmStatCard label="Tokens issued" value={summary.issued} helper={monthLabel} icon={<TagsOutlined />} tone="olive" /></Col>
            <Col xs={24} sm={12} xl={5}><CmStatCard label="Gate entries" value={summary.entered} helper="Actual ENTRY movements" icon={<CheckCircleOutlined />} tone="olive" /></Col>
            <Col xs={24} sm={12} xl={5}><CmStatCard label="Active" value={summary.active} helper="Issued-month tokens still in flow" icon={<ClockCircleOutlined />} tone="neutral" /></Col>
            <Col xs={24} sm={12} xl={5}><CmStatCard label="Expired" value={summary.expired} helper="Issued-month tokens" icon={<CloseCircleOutlined />} tone="amber" /></Col>
            <Col xs={24} sm={12} xl={4}><CmStatCard label="Cancelled" value={summary.cancelled} helper="Issued-month tokens" icon={<CloseCircleOutlined />} tone="amber" /></Col>
          </Row>

          <CmSectionCard
            className="cm-gate-token-chart-card"
            title="Monthly gate token activity"
            subtitle={`Daily tokens issued versus actual gate entries · ${monthLabel}${analytics?.timezone ? ` · ${analytics.timezone}` : ""}`}
            extra={analytics?.insight?.peak_label ? <Tag color="processing">Peak activity: {analytics.insight.peak_label} · {analytics.insight.peak_total || 0}</Tag> : null}
            loading={analyticsLoading}
          >
            {analytics?.daily?.length ? (
              <div className="cm-gate-token-chart-wrap">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.daily} margin={{ top: 8, right: 16, left: -12, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" minTickGap={18} tickLine={false} axisLine={false} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} />
                    <RechartsTooltip />
                    <Legend />
                    <Line type="monotone" dataKey="issued" name="Tokens issued" stroke="var(--cm-primary, #55632C)" strokeWidth={3} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="entered" name="Gate entries" stroke="var(--cm-accent, #C57A35)" strokeWidth={3} dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No gate-entry activity for the selected month and scope." />
            )}
          </CmSectionCard>
        </>
      )}

      <CmSectionCard className="cm-gate-token-list-card" title="Token register" subtitle="Search and inspect individual pass and entry tokens without affecting the monthly analytics period.">
        <div className="cm-gate-token-filter-grid">
          <Input.Search
            allowClear
            placeholder="Search exact token code"
            value={filters.search}
            onChange={(event) => updateFilter("search", event.target.value)}
            onSearch={() => loadData()}
          />
          <Select value={filters.token_type} options={tokenTypeOptions} onChange={(value) => updateFilter("token_type", value)} />
          <Select
            allowClear
            placeholder="All statuses"
            value={filters.status || undefined}
            onChange={(value) => updateFilter("status", value || "")}
            options={[
              "ISSUED", "CREATED", "SCANNED", "VERIFIED", "IN_YARD", "LOT_CREATED", "LOTS_CLOSED", "WEIGH_IN", "WEIGH_OUT", "EXITED", "CANCELLED", "EXPIRED",
            ].map((value) => ({ value, label: value.split("_").join(" ") }))}
          />
          <Input type="date" value={filters.date_from} onChange={(event) => updateFilter("date_from", event.target.value)} aria-label="Date from" />
          <Input type="date" value={filters.date_to} onChange={(event) => updateFilter("date_to", event.target.value)} aria-label="Date to" />
        </div>

        <Table<TokenRow>
          className="cm-gate-token-table"
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          scroll={{ x: 1450 }}
          pagination={{
            current: page,
            pageSize,
            total: totalCount,
            showSizeChanger: true,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            showTotal: (total) => `${total} token${total === 1 ? "" : "s"}`,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPageSize !== pageSize ? 1 : nextPage);
              setPageSize(nextPageSize);
            },
          }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No tokens match this scope and filter." /> }}
        />
      </CmSectionCard>
    </PageContainer>
  );
};

export default GateTokens;
