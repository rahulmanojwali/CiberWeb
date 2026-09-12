import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Col,
  Empty,
  List,
  Row,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  AlertOutlined,
  ArrowRightOutlined,
  BarChartOutlined,
  BellOutlined,
  DollarOutlined,
  LineChartOutlined,
  ReloadOutlined,
  RiseOutlined,
  ShopOutlined,
} from "@ant-design/icons";
import { Link as RouterLink } from "react-router-dom";
import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { CmStatCard } from "../../design-system/components/CmStatCard";
import { getDashboardSummary } from "../../services/dashboardApi";
import { getCurrentAdminUsername } from "../../utils/session";
import { getUserRoleFromStorage } from "../../utils/roles";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import { useTranslation } from "react-i18next";
import { SuperadminDashboard } from "./SuperadminDashboard";

const { Text, Title } = Typography;

const defaultPayload = {
  scope: { org_id: null, mandi_ids: [] },
  date_range: {
    from_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    to_date: new Date().toISOString(),
  },
};

const formatNumber = (value: unknown, fallback = "0") => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-IN") : fallback;
};

const formatPercent = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? `${n.toFixed(2)}%` : "—";
};

const getStoredDisplayName = () => {
  try {
    const raw = localStorage.getItem("cd_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.display_name || parsed?.name || parsed?.username || null;
  } catch {
    return null;
  }
};

const roleLabel = (role: string | null | undefined) =>
  role ? role.toLowerCase().split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ") : "Admin User";

const StandardDashboard: React.FC = () => {
  const { i18n } = useTranslation();
  const language = i18n.language || "en";
  const uiConfig = useAdminUiConfig();
  const canView = useMemo(() => can(uiConfig.resources, "dashboard.view", "VIEW"), [uiConfig.resources]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentRole = useMemo(() => String(uiConfig.role || getUserRoleFromStorage("Dashboard") || "").toUpperCase(), [uiConfig.role]);
  const isMandiManager = currentRole === "MANDI_MANAGER";
  const displayName = useMemo(() => getStoredDisplayName(), []);


  const fetchSummary = async () => {
    const username = getCurrentAdminUsername();
    if (!username || !canView) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await getDashboardSummary({
        username,
        language,
        payload: defaultPayload,
      });
      setSummary(resp?.data || null);
    } catch (err: any) {
      console.error("Dashboard load error:", err);
      setError(err?.message || "Unable to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [language, canView]);

  const cards = summary?.cards ?? {};
  const charts = summary?.charts ?? {};
  const ticker = Array.isArray(summary?.ticker) ? summary.ticker : [];
  const alerts = Array.isArray(summary?.alerts) ? summary.alerts : [];
  const quickLinks = Array.isArray(summary?.quickLinks) ? summary.quickLinks : [];

  const pageTitle = isMandiManager ? "Mandi Manager Dashboard" : "CiberMandi Command Center";
  const pageSubtitle = isMandiManager
    ? "Overview of today’s mandi operations and items that need attention."
    : "Live operations overview across auctions, settlements, trade and alerts.";

  const tradeAmount = cards.todayTradeValue?.total_amount;
  const tradeCurrency = cards.todayTradeValue?.currency || "INR";
  const priceVsMsp = formatPercent(cards.todayTradeValue?.price_vs_msp_percent);

  return (
    <PageContainer className="cm-dashboard-page">
      <CmPageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        actions={
          <Button icon={<ReloadOutlined />} onClick={fetchSummary} disabled={!canView || loading}>
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert
          className="cm-dashboard-error"
          type="error"
          showIcon
          message="Dashboard could not be loaded"
          description={error}
          action={<Button size="small" onClick={fetchSummary}>Try again</Button>}
        />
      )}

      {loading && !summary ? (
        <div className="cm-dashboard-loading">
          <Skeleton active paragraph={{ rows: 10 }} />
        </div>
      ) : (
        <div className="cm-dashboard-stack">
          <Row gutter={[16, 16]}>
            <Col xs={24} xl={16}>
              <CmSectionCard className="cm-dashboard-attention-card">
                <div className="cm-dashboard-section-heading-row">
                  <div className="cm-dashboard-section-title-wrap">
                    <div className="cm-dashboard-section-icon cm-dashboard-section-icon-warning">
                      <AlertOutlined />
                    </div>
                    <div>
                      <Title level={4} className="cm-dashboard-card-title">Attention Required</Title>
                      <Text type="secondary">
                        {alerts.length ? `${alerts.length} item${alerts.length === 1 ? "" : "s"} need your review and action` : "No urgent items require action"}
                      </Text>
                    </div>
                  </div>
                </div>

                {alerts.length ? (
                  <List
                    className="cm-dashboard-alert-list"
                    dataSource={alerts.slice(0, 5)}
                    renderItem={(alert: any) => (
                      <List.Item>
                        <div className="cm-dashboard-alert-row">
                          <span className="cm-dashboard-alert-dot" />
                          <Text className="cm-dashboard-alert-message">{alert?.message || "Alert"}</Text>
                          <Tag color={String(alert?.severity || "").toUpperCase() === "HIGH" ? "error" : "warning"}>
                            {alert?.severity || "NOTICE"}
                          </Tag>
                        </div>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Nothing needs immediate attention" />
                )}
              </CmSectionCard>
            </Col>

            <Col xs={24} xl={8}>
              <CmSectionCard className="cm-dashboard-welcome-card">
                <Text className="cm-dashboard-welcome-kicker">Good to see you</Text>
                <Title level={3} className="cm-dashboard-welcome-name">{displayName || "CiberMandi Admin"}</Title>
                <Text type="secondary">{roleLabel(currentRole)}</Text>
                <div className="cm-dashboard-welcome-divider" />
                <Space size={[8, 8]} wrap>
                  <Tag icon={<ShopOutlined />}>Operations</Tag>
                  <Tag icon={<BellOutlined />}>Live alerts</Tag>
                  <Tag icon={<RiseOutlined />}>Market visibility</Tag>
                </Space>
              </CmSectionCard>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} xl={6}>
              <CmStatCard
                label="Today's Trade Value"
                value={`${formatNumber(tradeAmount, "—")} ${tradeCurrency}`}
                helper={`Lots: ${formatNumber(cards.todayTradeValue?.lots_count)} · Price vs MSP: ${priceVsMsp}`}
                icon={<DollarOutlined />}
                tone="olive"
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <CmStatCard
                label="Live Auctions"
                value={formatNumber(cards.liveAuctions?.count)}
                helper={`Mandis: ${formatNumber(cards.liveAuctions?.mandis_count)}`}
                icon={<BarChartOutlined />}
                tone="amber"
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <CmStatCard
                label="Settlement Outstanding"
                value={formatNumber(cards.settlements?.total_outstanding)}
                helper={`Overdue: ${formatNumber(cards.settlements?.total_overdue)}`}
                icon={<DollarOutlined />}
                tone="neutral"
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <CmStatCard
                label="Subscription MRR"
                value={`₹${formatNumber(cards.subscriptions?.mrr)}`}
                helper={`ARR ₹${formatNumber(cards.subscriptions?.arr)}`}
                icon={<RiseOutlined />}
                tone="olive"
              />
            </Col>
          </Row>

          {ticker.length > 0 && (
            <CmSectionCard title="Market Pulse" className="cm-dashboard-market-pulse">
              <div className="cm-dashboard-ticker">
                {ticker.slice(0, 8).map((item: any, index: number) => {
                  const change = Number(item?.change_percent);
                  const isPositive = Number.isFinite(change) && change >= 0;
                  return (
                    <div className="cm-dashboard-ticker-item" key={`${item?.commodity_id}-${item?.mandi_id}-${index}`}>
                      <Text className="cm-dashboard-ticker-name">{item?.commodity_name || "Commodity"}</Text>
                      <Text type="secondary" className="cm-dashboard-ticker-mandi">{item?.mandi_name || "Mandi"}</Text>
                      <div className="cm-dashboard-ticker-value-row">
                        <Text strong>{item?.last_price ?? "—"}</Text>
                        <Tag color={isPositive ? "success" : "error"}>{formatPercent(item?.change_percent)}</Tag>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CmSectionCard>
          )}

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={14}>
              <CmSectionCard
                title="Mandi Price Snapshot"
                extra={<Text type="secondary">Latest API values</Text>}
                className="cm-dashboard-chart-card"
              >
                {charts.mandiPriceHeatmap?.cells?.length ? (
                  <div className="cm-dashboard-heatmap-grid">
                    {charts.mandiPriceHeatmap.cells.slice(0, 12).map((cell: any, idx: number) => {
                      const diff = Number(cell?.diff_percent);
                      return (
                        <div className="cm-dashboard-heatmap-cell" key={`${cell?.commodity_id}-${cell?.mandi_id}-${idx}`}>
                          <Text type="secondary" className="cm-dashboard-heatmap-label">
                            {cell?.commodity_name || cell?.commodity_id || "Commodity"}
                          </Text>
                          <Text strong className="cm-dashboard-heatmap-price">{cell?.price ?? "—"}</Text>
                          <Text className={Number.isFinite(diff) && diff < 0 ? "cm-value-negative" : "cm-value-positive"}>
                            {formatPercent(diff)}
                          </Text>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No mandi price data returned" />
                )}
              </CmSectionCard>
            </Col>

            <Col xs={24} xl={10}>
              <CmSectionCard title="Auctions by Commodity" className="cm-dashboard-chart-card">
                {Array.isArray(charts.auctionByCommodity) && charts.auctionByCommodity.length ? (
                  <List
                    className="cm-dashboard-metric-list"
                    dataSource={charts.auctionByCommodity.slice(0, 7)}
                    renderItem={(item: any) => (
                      <List.Item>
                        <Text>{item?.commodity_name || "Commodity"}</Text>
                        <Text strong>{formatNumber(item?.auctions)} auctions</Text>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No auction commodity data returned" />
                )}
              </CmSectionCard>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <CmSectionCard title="Trade by Day" className="cm-dashboard-chart-card">
                {Array.isArray(charts.tradeByDay) && charts.tradeByDay.length ? (
                  <List
                    className="cm-dashboard-metric-list"
                    dataSource={charts.tradeByDay.slice(-7)}
                    renderItem={(entry: any) => (
                      <List.Item>
                        <Text type="secondary">{entry?.date || "—"}</Text>
                        <Text strong>{formatNumber(entry?.amount, "—")}</Text>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No daily trade data returned" />
                )}
              </CmSectionCard>
            </Col>

            <Col xs={24} lg={12}>
              <CmSectionCard title="Gate Traffic by Hour" className="cm-dashboard-chart-card">
                {Array.isArray(charts.gateTrafficByHour) && charts.gateTrafficByHour.length ? (
                  <List
                    className="cm-dashboard-metric-list"
                    dataSource={charts.gateTrafficByHour.slice(0, 10)}
                    renderItem={(entry: any) => (
                      <List.Item>
                        <Text type="secondary">{entry?.hour !== undefined ? `${entry.hour}:00` : "—"}</Text>
                        <Text strong>{formatNumber(entry?.vehicles)} vehicles</Text>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No gate traffic data returned" />
                )}
              </CmSectionCard>
            </Col>
          </Row>

          <CmSectionCard title="Quick Actions" className="cm-dashboard-quick-actions">
            {quickLinks.length ? (
              <Space size={[10, 10]} wrap>
                {quickLinks.map((link: any, index: number) => (
                  <RouterLink key={`${link?.label}-${index}`} to={link?.target_route || "#"}>
                    <Button icon={<ArrowRightOutlined />} iconPosition="end">
                      {link?.label || "Open"}
                    </Button>
                  </RouterLink>
                ))}
              </Space>
            ) : (
              <Text type="secondary">No quick actions are available for your current permissions.</Text>
            )}
          </CmSectionCard>

          {!summary && !loading && !error && (
            <Alert
              icon={<LineChartOutlined />}
              type="info"
              showIcon
              message="No dashboard data returned"
              description="The dashboard API completed without returning summary content for the current scope."
            />
          )}
        </div>
      )}
    </PageContainer>
  );
};


export const Dashboard: React.FC = () => {
  const uiConfig = useAdminUiConfig();
  const currentRole = useMemo(
    () => String(uiConfig.role || getUserRoleFromStorage("Dashboard") || "").toUpperCase(),
    [uiConfig.role],
  );

  return currentRole === "SUPER_ADMIN" ? <SuperadminDashboard /> : <StandardDashboard />;
};
