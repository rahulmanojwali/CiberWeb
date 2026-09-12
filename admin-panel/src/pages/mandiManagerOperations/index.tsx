import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Row,
  Skeleton,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  AlertOutlined,
  ArrowRightOutlined,
  CarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ContainerOutlined,
  DollarOutlined,
  ReloadOutlined,
  ShopOutlined,
  ShoppingOutlined,
  ThunderboltOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { CmStatCard } from "../../design-system/components/CmStatCard";
import { CmSearchInput } from "../../design-system/components/CmSearchInput";
import { CmFilterPills } from "../../design-system/components/CmFilterPills";
import { usePermissions } from "../../authz/usePermissions";
import { getCurrentAdminUsername } from "../../utils/session";
import { fetchGateEntryTokens, fetchGatePassTokens, fetchWeighmentTickets } from "../../services/gateOpsApi";
import { fetchLots } from "../../services/lotsApi";
import { getAuctionSessions } from "../../services/auctionOpsApi";
import { getSettlements } from "../../services/settlementsApi";

const { Text, Title } = Typography;

type QueueKey = "arrivals" | "weighment" | "auction" | "dispatch";
type OperationsTab = "gate" | "lots" | "auction" | "fulfilment";

type OpsRow = {
  key: string;
  reference: string;
  party: string;
  commodity: string;
  quantity: string;
  time: string;
  status: string;
  route?: string;
};

type LoadState = {
  arrivals: any[];
  weighments: any[];
  lots: any[];
  auctions: any[];
  settlements: any[];
};

const initialData: LoadState = {
  arrivals: [],
  weighments: [],
  lots: [],
  auctions: [],
  settlements: [],
};

const responseItems = (resp: any) => resp?.data?.items || resp?.response?.data?.items || [];
const responseTotal = (resp: any, fallback: number) => {
  const total = resp?.data?.total_records ?? resp?.response?.data?.total_records ?? resp?.data?.total ?? resp?.response?.data?.total;
  return Number.isFinite(Number(total)) ? Number(total) : fallback;
};

const display = (value: unknown, fallback = "—") => {
  if (value === null || value === undefined || value === "") return fallback;
  return String(value);
};

const formatDateTime = (value: unknown) => {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const humanize = (value: unknown) =>
  display(value)
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (m) => m.toUpperCase());

const statusColor = (status: string) => {
  const s = String(status || "").toUpperCase();
  if (["LIVE", "ONLINE", "VERIFIED", "SOLD", "SETTLED", "COMPLETED", "IN_YARD"].some((v) => s.includes(v))) return "success";
  if (["PENDING", "PLANNED", "QUEUED", "CREATED", "OPEN", "READY"].some((v) => s.includes(v))) return "warning";
  if (["ERROR", "REJECTED", "CANCELLED", "FAILED", "MISMATCH", "OVERDUE"].some((v) => s.includes(v))) return "error";
  return "default";
};

const safeNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

export const MandiManagerOperations: React.FC = () => {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const language = i18n.language || "en";
  const { can } = usePermissions();

  const canGatePass = can("gate_pass_tokens.view", "VIEW");
  const canGateEntry = can("gate_entry_tokens.list", "VIEW");
  const canGate = canGatePass || canGateEntry;
  const canWeighment = can("weighment_tickets.view", "VIEW");
  const canLots = can("lots.list", "VIEW") || can("lots.view", "VIEW");
  const canAuctions = can("auction_sessions.list", "VIEW");
  const canSettlements = can("settlements.list", "VIEW");

  const [data, setData] = useState<LoadState>(initialData);
  const [totals, setTotals] = useState({ arrivals: 0, weighments: 0, lots: 0, auctions: 0, settlements: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<OperationsTab>("gate");
  const [queue, setQueue] = useState<QueueKey>("arrivals");
  const [search, setSearch] = useState("");
  const [timeScope, setTimeScope] = useState<"today" | "all">("today");

  const load = useCallback(async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;

    setLoading(true);
    setError(null);

    const today = new Date();
    const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
    const common = {
      page: 1,
      page_size: 25,
      date_from: timeScope === "today" ? start : undefined,
      date_to: timeScope === "today" ? today.toISOString() : undefined,
    };

    try {
      const tasks = await Promise.allSettled([
        canGate
          ? Promise.all([
              canGatePass ? fetchGatePassTokens({ username, language, filters: common }) : Promise.resolve(null),
              canGateEntry ? fetchGateEntryTokens({ username, language, filters: common }) : Promise.resolve(null),
            ])
          : Promise.resolve([null, null]),
        canWeighment ? fetchWeighmentTickets({ username, language, filters: common }) : Promise.resolve(null),
        canLots ? fetchLots({ username, language, filters: common }) : Promise.resolve(null),
        canAuctions ? getAuctionSessions({ username, language, filters: common }) : Promise.resolve(null),
        canSettlements ? getSettlements({ username, language, filters: common }) : Promise.resolve(null),
      ]);

      const gatePair = tasks[0].status === "fulfilled" ? tasks[0].value : [null, null];
      const passRows = responseItems(gatePair?.[0]);
      const entryRows = responseItems(gatePair?.[1]);
      const arrivals = [...entryRows, ...passRows].sort((a, b) =>
        new Date(b?.updated_on || b?.created_on || 0).getTime() - new Date(a?.updated_on || a?.created_on || 0).getTime(),
      );

      const weighments = tasks[1].status === "fulfilled" ? responseItems(tasks[1].value) : [];
      const lots = tasks[2].status === "fulfilled" ? responseItems(tasks[2].value) : [];
      const auctions = tasks[3].status === "fulfilled" ? responseItems(tasks[3].value) : [];
      const settlements = tasks[4].status === "fulfilled" ? responseItems(tasks[4].value) : [];

      setData({ arrivals, weighments, lots, auctions, settlements });
      setTotals({
        arrivals:
          responseTotal(gatePair?.[0], passRows.length) + responseTotal(gatePair?.[1], entryRows.length),
        weighments: tasks[1].status === "fulfilled" ? responseTotal(tasks[1].value, weighments.length) : 0,
        lots: tasks[2].status === "fulfilled" ? responseTotal(tasks[2].value, lots.length) : 0,
        auctions: tasks[3].status === "fulfilled" ? responseTotal(tasks[3].value, auctions.length) : 0,
        settlements: tasks[4].status === "fulfilled" ? responseTotal(tasks[4].value, settlements.length) : 0,
      });

      const rejected = tasks.filter((task) => task.status === "rejected");
      if (rejected.length && rejected.length === tasks.length) {
        throw new Error("Unable to load operations data.");
      }
    } catch (err: any) {
      console.error("[MandiManagerOperations] load failed", err);
      setError(err?.message || "Unable to load operations data.");
    } finally {
      setLoading(false);
    }
  }, [canGate, canGatePass, canGateEntry, canWeighment, canLots, canAuctions, canSettlements, language, timeScope]);

  useEffect(() => {
    load();
  }, [load]);

  const liveAuctionCount = useMemo(
    () => data.auctions.filter((row) => ["LIVE", "IN_AUCTION"].includes(String(row?.status || row?.derived_status || "").toUpperCase())).length,
    [data.auctions],
  );
  const dispatchedCount = useMemo(
    () => data.lots.filter((row) => ["DISPATCHED", "CLOSED"].includes(String(row?.status || "").toUpperCase())).length,
    [data.lots],
  );
  const pendingWeighmentCount = useMemo(
    () => data.lots.filter((row) => ["CREATED", "WEIGHMENT_PENDING", "PENDING_WEIGHMENT"].includes(String(row?.status || "").toUpperCase())).length,
    [data.lots],
  );

  const queueRows = useMemo<OpsRow[]>(() => {
    let rows: OpsRow[] = [];
    if (queue === "arrivals") {
      rows = data.arrivals.map((item, idx) => ({
        key: item?._id || item?.token_code || `arrival-${idx}`,
        reference: display(item?.vehicle_no || item?.token_code),
        party: display(item?.party_name || item?.farmer_name || item?.trader_name || item?.party_username),
        commodity: display(item?.commodity_name || item?.commodity),
        quantity: display(item?.expected_qty_mt ?? item?.expected_quantity ?? item?.quantity),
        time: formatDateTime(item?.arrival_time || item?.updated_on || item?.created_on),
        status: display(item?.status),
        route: item?.token_code ? `/gate-tokens/${encodeURIComponent(item.token_code)}` : "/gate-tokens",
      }));
    } else if (queue === "weighment") {
      rows = data.weighments.map((item, idx) => ({
        key: item?._id || item?.ticket_code || `weigh-${idx}`,
        reference: display(item?.ticket_code || item?.vehicle_no),
        party: display(item?.party_name || item?.farmer_name || item?.trader_name),
        commodity: display(item?.commodity_name || item?.commodity),
        quantity: item?.net_weight != null ? `${safeNumber(item.net_weight).toLocaleString("en-IN")} kg` : "—",
        time: formatDateTime(item?.created_on || item?.updated_on),
        status: display(item?.status),
        route: "/weighment-tickets",
      }));
    } else if (queue === "auction") {
      rows = data.auctions.map((item, idx) => ({
        key: item?._id || item?.session_id || `auction-${idx}`,
        reference: display(item?.session_code || item?.session_name),
        party: display(item?.auctioneer_username),
        commodity: display(item?.commodity_group || item?.commodity_group_code),
        quantity: item?.queued_count != null ? `${safeNumber(item.queued_count)} queued` : "—",
        time: formatDateTime(item?.scheduled_start_time || item?.start_time || item?.actual_start),
        status: display(item?.derived_status || item?.status),
        route: "/auction-sessions",
      }));
    } else {
      rows = data.lots
        .filter((item) => ["SETTLEMENT_PENDING", "SETTLED", "DISPATCHED", "CLOSED"].includes(String(item?.status || "").toUpperCase()))
        .map((item, idx) => ({
          key: item?._id || item?.lot_id || `dispatch-${idx}`,
          reference: display(item?.lot_code || item?.token_code),
          party: display(item?.party_username || item?.party?.username || item?.party_name),
          commodity: display(item?.commodity_name || item?.product_name),
          quantity: item?.weight_kg != null ? `${safeNumber(item.weight_kg).toLocaleString("en-IN")} kg` : "—",
          time: formatDateTime(item?.updated_on || item?.created_on),
          status: display(item?.status),
          route: "/lots",
        }));
    }

    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => [row.reference, row.party, row.commodity, row.status].some((v) => String(v).toLowerCase().includes(q)));
  }, [queue, data, search]);

  const columns = useMemo<TableColumnsType<OpsRow>>(
    () => [
      { title: "Reference", dataIndex: "reference", key: "reference", width: 170 },
      { title: "Farmer / Trader", dataIndex: "party", key: "party", width: 190 },
      { title: "Commodity", dataIndex: "commodity", key: "commodity", width: 170 },
      { title: "Quantity", dataIndex: "quantity", key: "quantity", width: 130 },
      { title: "Time", dataIndex: "time", key: "time", width: 150 },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 140,
        render: (value: string) => <Tag color={statusColor(value)}>{humanize(value)}</Tag>,
      },
      {
        title: "Actions",
        key: "actions",
        width: 100,
        fixed: "right",
        render: (_: unknown, row: OpsRow) => (
          <Button type="link" icon={<ArrowRightOutlined />} onClick={() => navigate(row.route || "/dashboard")}>View</Button>
        ),
      },
    ],
    [navigate],
  );

  const activeQueueCount = queue === "arrivals" ? totals.arrivals : queue === "weighment" ? totals.weighments : queue === "auction" ? totals.auctions : dispatchedCount;

  const tabItems = [
    { key: "gate", label: <Space><CarOutlined />Gate & Arrivals</Space> },
    { key: "lots", label: <Space><ShoppingOutlined />Lots & Weighment</Space> },
    { key: "auction", label: <Space><ThunderboltOutlined />Auctions</Space> },
    { key: "fulfilment", label: <Space><ContainerOutlined />Fulfilment</Space> },
  ];

  return (
    <PageContainer className="cm-operations-page">
      <CmPageHeader
        title="Operations Control Centre"
        subtitle="Real-time supervisory visibility across gate, weighment, auction and fulfilment operations."
        actions={<Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>}
      />

      {error && <Alert showIcon type="error" message="Operations data could not be fully loaded" description={error} action={<Button size="small" onClick={load}>Retry</Button>} />}

      <Tabs
        className="cm-operations-domain-tabs"
        activeKey={activeTab}
        onChange={(key) => {
          const next = key as OperationsTab;
          setActiveTab(next);
          setQueue(next === "gate" ? "arrivals" : next === "lots" ? "weighment" : next === "auction" ? "auction" : "dispatch");
        }}
        items={tabItems}
      />

      {loading && !data.arrivals.length && !data.lots.length && !data.auctions.length ? (
        <Skeleton active paragraph={{ rows: 12 }} />
      ) : (
        <div className="cm-operations-stack">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} xl={6}>
              <CmStatCard label="Vehicles Arrived" value={totals.arrivals.toLocaleString("en-IN")} helper={timeScope === "today" ? "Today" : "Loaded scope"} icon={<CarOutlined />} tone="olive" />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <CmStatCard label="Lots Created" value={totals.lots.toLocaleString("en-IN")} helper={`Pending weighment: ${pendingWeighmentCount}`} icon={<ShoppingOutlined />} tone="olive" />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <CmStatCard label="Live Auctions" value={liveAuctionCount.toLocaleString("en-IN")} helper={`Sessions loaded: ${totals.auctions}`} icon={<ThunderboltOutlined />} tone="amber" />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <CmStatCard label="Lots Dispatched" value={dispatchedCount.toLocaleString("en-IN")} helper={`Settlements loaded: ${totals.settlements}`} icon={<ContainerOutlined />} tone="neutral" />
            </Col>
          </Row>

          <Row gutter={[16, 16]} align="stretch">
            <Col xs={24} xxl={18}>
              <CmSectionCard className="cm-operations-queue-card">
                <div className="cm-operations-section-head">
                  <div>
                    <Title level={4}>Operational Queue</Title>
                    <Text type="secondary">Live, bounded supervisory view of key activities in the assigned scope.</Text>
                  </div>
                  <Space wrap>
                    <CmSearchInput
                      value={search}
                      onChange={setSearch}
                      placeholder="Search reference, party, commodity…"
                      width={360}
                    />
                    <CmFilterPills
                      value={timeScope}
                      onChange={(value) => setTimeScope(value as "today" | "all")}
                      options={[{ label: "Today", value: "today" }, { label: "Loaded", value: "all" }]}
                    />
                  </Space>
                </div>

                <Tabs
                  activeKey={queue}
                  onChange={(key) => setQueue(key as QueueKey)}
                  items={[
                    { key: "arrivals", label: `Arrivals Queue (${totals.arrivals})` },
                    { key: "weighment", label: `Weighment Queue (${totals.weighments})` },
                    { key: "auction", label: `Auction Queue (${totals.auctions})` },
                    { key: "dispatch", label: `Dispatch Queue (${dispatchedCount})` },
                  ]}
                />

                <Table<OpsRow>
                  className="cm-operations-table"
                  rowKey="key"
                  columns={columns}
                  dataSource={queueRows}
                  pagination={{ pageSize: 10, showSizeChanger: false, showTotal: () => `${activeQueueCount} server record${activeQueueCount === 1 ? "" : "s"} in scope` }}
                  scroll={{ x: 1050 }}
                  size="small"
                  locale={{ emptyText: <div className="cm-operations-empty-inline"><Text type="secondary">No {queue} records in the loaded scope</Text></div> }}
                />
              </CmSectionCard>
            </Col>

            <Col xs={24} xxl={6}>
              <div className="cm-operations-side-stack">
                <CmSectionCard title="Station Health" className="cm-operations-side-card">
                  <Space direction="vertical" size={10} className="cm-operations-health-list">
                    <Card size="small" className="cm-operations-health-item"><Space><ShopOutlined /><div><Text strong>Gate Operations</Text><div><Tag color={canGate ? "success" : "default"}>{canGate ? "Available" : "No access"}</Tag></div></div></Space></Card>
                    <Card size="small" className="cm-operations-health-item"><Space><ShoppingOutlined /><div><Text strong>Weighbridge</Text><div><Tag color={canWeighment ? "success" : "default"}>{canWeighment ? "Available" : "No access"}</Tag></div></div></Space></Card>
                    <Card size="small" className="cm-operations-health-item"><Space><ThunderboltOutlined /><div><Text strong>Auction Operations</Text><div><Tag color={canAuctions ? "success" : "default"}>{canAuctions ? "Available" : "No access"}</Tag></div></div></Space></Card>
                  </Space>
                  <Text type="secondary" className="cm-operations-health-note">Availability reflects authorised API visibility. Device telemetry will be shown when a dedicated station-health API is available.</Text>
                </CmSectionCard>

                <CmSectionCard title="Exceptions Requiring Review" className="cm-operations-side-card cm-operations-exception-card">
                  <div className="cm-operations-compact-placeholder">
                    <AlertOutlined />
                    <div><Text strong>No exception feed yet</Text><Text type="secondary">Scoped exception API will populate this area.</Text></div>
                  </div>
                </CmSectionCard>

                <CmSectionCard title="Manager Actions" className="cm-operations-side-card">
                  <Row gutter={[8, 8]}>
                    <Col span={8}><Button block icon={<CheckCircleOutlined />} onClick={() => navigate("/lots")}>View</Button></Col>
                    <Col span={8}><Button block icon={<AlertOutlined />} disabled>Review</Button></Col>
                    <Col span={8}><Button block icon={<ArrowRightOutlined />} disabled>Escalate</Button></Col>
                  </Row>
                  <Text type="secondary" className="cm-operations-action-note">Review and escalation remain disabled until explicit exception resources/API actions are introduced.</Text>
                </CmSectionCard>
              </div>
            </Col>
          </Row>

          <CmSectionCard title="Recent Activities" className="cm-operations-recent-card">
            {queueRows.length ? (
              <div className="cm-operations-activity-list">
                {queueRows.slice(0, 5).map((row) => (
                  <div className="cm-operations-activity-row" key={`recent-${row.key}`}>
                    <ClockCircleOutlined />
                    <div className="cm-operations-activity-copy"><Text strong>{row.reference}</Text><Text type="secondary">{row.commodity} · {row.party}</Text></div>
                    <Tag color={statusColor(row.status)}>{humanize(row.status)}</Tag>
                  </div>
                ))}
              </div>
            ) : <div className="cm-operations-empty-inline"><Text type="secondary">No recent activities in the loaded scope</Text></div>}
          </CmSectionCard>
        </div>
      )}
    </PageContainer>
  );
};

export default MandiManagerOperations;
