import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Col,
  Empty,
  List,
  Row,
  Select,
  Skeleton,
  Space,
  Tag,
  Typography,
} from "antd";
import {
  AlertOutlined,
  ApartmentOutlined,
  AuditOutlined,
  BankOutlined,
  ControlOutlined,
  DollarOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Link as RouterLink } from "react-router-dom";
import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { CmStatCard } from "../../design-system/components/CmStatCard";
import { getDashboardSummary } from "../../services/dashboardApi";
import { fetchOrganisations, fetchOrgMandis } from "../../services/adminUsersApi";
import { getCurrentAdminUsername } from "../../utils/session";
import { useTranslation } from "react-i18next";

const { Text, Title } = Typography;

type OrgOption = {
  id: string;
  code: string;
  name: string;
  active?: boolean;
};

type MandiOption = {
  id: string;
  name: string;
  slug?: string;
};

const unwrapResponse = (value: any) => value?.response ?? value;

const formatNumber = (value: unknown, fallback = "—") => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-IN") : fallback;
};

const formatMoney = (value: unknown, currency = "INR") => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (String(currency).toUpperCase() === "INR") return `₹${n.toLocaleString("en-IN")}`;
  return `${n.toLocaleString("en-IN")} ${currency}`;
};

export const SuperadminDashboard: React.FC = () => {
  const { i18n } = useTranslation();
  const language = i18n.language || "en";
  const username = useMemo(() => getCurrentAdminUsername(), []);

  const [organisations, setOrganisations] = useState<OrgOption[]>([]);
  const [mandis, setMandis] = useState<MandiOption[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | undefined>();
  const [selectedMandiId, setSelectedMandiId] = useState<string | undefined>();
  const [summary, setSummary] = useState<any>(null);
  const [scopeLoading, setScopeLoading] = useState(false);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [scopeError, setScopeError] = useState<string | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const loadOrganisations = useCallback(async () => {
    if (!username) return;
    setScopeLoading(true);
    setScopeError(null);
    try {
      const raw = await fetchOrganisations({ username, language });
      const resp = unwrapResponse(raw);
      if (String(resp?.responsecode ?? "0") !== "0") {
        throw new Error(resp?.description || "Unable to load organisations.");
      }
      const list = raw?.data?.organisations || resp?.data?.organisations || [];
      const mapped = (Array.isArray(list) ? list : []).map((o: any) => ({
        id: String(o?._id || o?.org_id || o?.org_code || ""),
        code: String(o?.org_code || ""),
        name: String(o?.org_name || o?.org_code || "Organisation"),
        active: String(o?.is_active || "Y").toUpperCase() === "Y",
      })).filter((o: OrgOption) => Boolean(o.id));
      setOrganisations(mapped);
    } catch (error: any) {
      setScopeError(error?.message || "Unable to load organisations.");
      setOrganisations([]);
    } finally {
      setScopeLoading(false);
    }
  }, [language, username]);

  const loadMandis = useCallback(async (orgId?: string) => {
    if (!username) return;

    // getOrgMandis is an organisation-scoped API and requires org_id.
    // SUPER_ADMIN's initial "All Organisations" scope must not call it without one.
    if (!orgId) {
      setMandis([]);
      setSelectedMandiId(undefined);
      return;
    }

    setScopeLoading(true);
    setScopeError(null);
    try {
      const raw = await fetchOrgMandis({ username, org_id: orgId, language });
      const resp = unwrapResponse(raw);
      if (String(resp?.responsecode ?? "0") !== "0") {
        throw new Error(resp?.description || "Unable to load mandis.");
      }
      const list = raw?.data?.items || resp?.data?.items || [];
      const mapped = (Array.isArray(list) ? list : []).map((m: any) => ({
        id: String(m?.mandi_id ?? m?._id ?? m?.id ?? ""),
        name: String(m?.label || m?.mandi_name || m?.name_i18n?.en || m?.mandi_slug || "Mandi"),
        slug: String(m?.mandi_slug || ""),
      })).filter((m: MandiOption) => Boolean(m.id));
      setMandis(mapped);
    } catch (error: any) {
      setScopeError(error?.message || "Unable to load mandis.");
      setMandis([]);
    } finally {
      setScopeLoading(false);
    }
  }, [language, username]);

  const loadDashboard = useCallback(async () => {
    if (!username) return;
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const payload: Record<string, any> = {
        date_range: {
          from_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          to_date: new Date().toISOString(),
        },
      };
      if (selectedOrgId || selectedMandiId) {
        payload.scope = {
          org_id: selectedOrgId || null,
          mandi_ids: selectedMandiId ? [Number.isFinite(Number(selectedMandiId)) ? Number(selectedMandiId) : selectedMandiId] : [],
        };
      }
      const raw = await getDashboardSummary({ username, language, payload });
      setSummary(raw?.data || raw?.response?.data || null);
    } catch (error: any) {
      setDashboardError(error?.message || "Unable to load platform dashboard.");
      setSummary(null);
    } finally {
      setDashboardLoading(false);
    }
  }, [language, selectedMandiId, selectedOrgId, username]);

  useEffect(() => {
    loadOrganisations();
  }, [loadOrganisations]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    setSelectedMandiId(undefined);
    if (selectedOrgId) {
      loadMandis(selectedOrgId);
    } else {
      setMandis([]);
    }
  }, [loadMandis, selectedOrgId]);

  const cards = summary?.cards || {};
  const alerts = Array.isArray(summary?.alerts) ? summary.alerts : [];
  const quickLinks = Array.isArray(summary?.quickLinks) ? summary.quickLinks : [];
  const charts = summary?.charts || {};

  const activeOrgCount = organisations.filter((org) => org.active !== false).length;
  const selectedOrg = organisations.find((org) => org.id === selectedOrgId);
  const selectedMandi = mandis.find((mandi) => mandi.id === selectedMandiId);
  const currentScopeLabel = selectedMandi?.name || selectedOrg?.name || "All Organisations";

  return (
    <PageContainer className="cm-superadmin-dashboard">
      <CmPageHeader
        eyebrow="SUPER_ADMIN · GLOBAL PLATFORM SCOPE"
        title="Platform Command Centre"
        subtitle="Monitor CiberMandi across organisations and mandis, surface exceptions, and enter platform administration without losing scope context."
        actions={
          <Button icon={<ReloadOutlined />} onClick={() => { loadOrganisations(); loadMandis(selectedOrgId); loadDashboard(); }} loading={dashboardLoading || scopeLoading}>
            Refresh
          </Button>
        }
      />

      <CmSectionCard className="cm-superadmin-scope-card" compact>
        <div className="cm-superadmin-scope-row">
          <div>
            <Text className="cm-superadmin-scope-kicker">Global scope</Text>
            <Title level={5} className="cm-superadmin-scope-title">{currentScopeLabel}</Title>
          </div>
          <div className="cm-superadmin-scope-controls">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              value={selectedOrgId}
              placeholder="All organisations"
              loading={scopeLoading}
              onChange={(value) => setSelectedOrgId(value)}
              options={organisations.map((org) => ({ value: org.id, label: org.name }))}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              value={selectedMandiId}
              placeholder={selectedOrgId ? "All mandis" : "Select organisation first"}
              disabled={!selectedOrgId}
              loading={scopeLoading}
              onChange={(value) => setSelectedMandiId(value)}
              options={mandis.map((mandi) => ({ value: mandi.id, label: mandi.name }))}
            />
          </div>
        </div>
      </CmSectionCard>

      {scopeError && <Alert type="warning" showIcon message="Scope options could not be fully loaded" description={scopeError} />}
      {dashboardError && <Alert type="error" showIcon message="Platform dashboard could not be loaded" description={dashboardError} action={<Button size="small" onClick={loadDashboard}>Retry</Button>} />}

      {dashboardLoading && !summary ? (
        <CmSectionCard><Skeleton active paragraph={{ rows: 12 }} /></CmSectionCard>
      ) : (
        <div className="cm-superadmin-stack">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} xl={6}>
              <CmStatCard label="Active Organisations" value={formatNumber(activeOrgCount)} helper={`Total loaded: ${formatNumber(organisations.length)}`} icon={<ApartmentOutlined />} tone="olive" />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <CmStatCard label="Mandis in Scope" value={formatNumber(mandis.length)} helper={selectedOrg ? selectedOrg.name : "Across current platform scope"} icon={<ShopOutlined />} tone="neutral" />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <CmStatCard label="Live Auctions" value={formatNumber(cards?.liveAuctions?.count)} helper={`Mandis: ${formatNumber(cards?.liveAuctions?.mandis_count, "0")}`} icon={<BankOutlined />} tone="amber" />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <CmStatCard label="Trade Value Today" value={formatMoney(cards?.todayTradeValue?.total_amount, cards?.todayTradeValue?.currency || "INR")} helper={`Lots: ${formatNumber(cards?.todayTradeValue?.lots_count, "0")}`} icon={<DollarOutlined />} tone="olive" />
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={15}>
              <CmSectionCard className="cm-superadmin-attention-card">
                <div className="cm-superadmin-card-heading">
                  <div className="cm-superadmin-card-icon cm-superadmin-card-icon-warning"><AlertOutlined /></div>
                  <div>
                    <Title level={4}>Attention Required</Title>
                    <Text type="secondary">Platform and operational exceptions returned by the live dashboard API.</Text>
                  </div>
                </div>
                {alerts.length ? (
                  <List
                    dataSource={alerts.slice(0, 6)}
                    renderItem={(item: any) => (
                      <List.Item>
                        <div className="cm-superadmin-alert-row">
                          <div>
                            <Text strong>{item?.title || item?.message || "Platform alert"}</Text>
                            {item?.title && item?.message ? <Text type="secondary">{item.message}</Text> : null}
                          </div>
                          <Tag color={String(item?.severity || "").toUpperCase() === "HIGH" ? "error" : "warning"}>{item?.severity || "NOTICE"}</Tag>
                        </div>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No urgent items returned for the current scope" />
                )}
              </CmSectionCard>
            </Col>

            <Col xs={24} xl={9}>
              <CmSectionCard title="Security & Governance" className="cm-superadmin-governance-card">
                <Space direction="vertical" size={12} className="cm-superadmin-link-stack">
                  <RouterLink to="/system/security"><Button block icon={<SafetyCertificateOutlined />}>System Security</Button></RouterLink>
                  <RouterLink to="/system/role-policy-manager"><Button block icon={<TeamOutlined />}>Roles & Permissions</Button></RouterLink>
                  <RouterLink to="/system/resource-registry"><Button block icon={<AuditOutlined />}>Resource Registry</Button></RouterLink>
                  <RouterLink to="/system/platform-control-center"><Button block icon={<ControlOutlined />}>Platform Control Center</Button></RouterLink>
                </Space>
              </CmSectionCard>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={12}>
              <CmSectionCard title="Platform Operations" extra={<RouterLink to="/direct-trade/approvals">Open approvals</RouterLink>}>
                <div className="cm-superadmin-metrics-list">
                  <div><Text type="secondary">Settlement outstanding</Text><Text strong>{formatMoney(cards?.settlements?.total_outstanding)}</Text></div>
                  <div><Text type="secondary">Settlement overdue</Text><Text strong>{formatMoney(cards?.settlements?.total_overdue)}</Text></div>
                  <div><Text type="secondary">Subscription MRR</Text><Text strong>{formatMoney(cards?.subscriptions?.mrr)}</Text></div>
                  <div><Text type="secondary">Subscription ARR</Text><Text strong>{formatMoney(cards?.subscriptions?.arr)}</Text></div>
                </div>
              </CmSectionCard>
            </Col>

            <Col xs={24} xl={12}>
              <CmSectionCard title="Organisation Performance" extra={<RouterLink to="/orgs">View organisations</RouterLink>}>
                {Array.isArray(charts?.tradeByDay) && charts.tradeByDay.length ? (
                  <List
                    dataSource={charts.tradeByDay.slice(-6)}
                    renderItem={(entry: any) => (
                      <List.Item>
                        <Text type="secondary">{entry?.date || "—"}</Text>
                        <Text strong>{formatMoney(entry?.amount)}</Text>
                      </List.Item>
                    )}
                  />
                ) : (
                  <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No performance series returned for this scope" />
                )}
              </CmSectionCard>
            </Col>
          </Row>

          <CmSectionCard title="Quick Administration" className="cm-superadmin-quick-admin">
            <Space size={[10, 10]} wrap>
              <RouterLink to="/orgs"><Button icon={<ApartmentOutlined />}>Organisations</Button></RouterLink>
              <RouterLink to="/mandis"><Button icon={<ShopOutlined />}>Mandis</Button></RouterLink>
              <RouterLink to="/admin-users"><Button icon={<TeamOutlined />}>Admin Users</Button></RouterLink>
              <RouterLink to="/system/platform-users"><Button icon={<TeamOutlined />}>CiberMandi Users</Button></RouterLink>
              {quickLinks.slice(0, 4).map((link: any, index: number) => (
                <RouterLink key={`${link?.target_route || link?.label}-${index}`} to={link?.target_route || "#"}>
                  <Button>{link?.label || "Open"}</Button>
                </RouterLink>
              ))}
            </Space>
          </CmSectionCard>
        </div>
      )}
    </PageContainer>
  );
};
