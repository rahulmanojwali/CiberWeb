import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Col,
  Dropdown,
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
  ApartmentOutlined,
  AuditOutlined,
  BankOutlined,
  ControlOutlined,
  DollarOutlined,
  DownOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  ShopOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Link as RouterLink, useNavigate } from "react-router-dom";
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

const getAlertSeverity = (item: any) =>
  String(item?.severity || item?.priority || item?.level || "NOTICE").trim().toUpperCase();

const isActionablePlatformAlert = (item: any) => {
  const severity = getAlertSeverity(item);
  const category = String(item?.category || item?.type || item?.domain || "").trim().toUpperCase();
  const status = String(item?.status || "").trim().toUpperCase();
  const explicitAction =
    item?.requires_action === true ||
    item?.action_required === true ||
    item?.requiresAction === true ||
    item?.escalated === true ||
    item?.is_escalated === true;

  const platformCategory = [
    "SECURITY",
    "PAYMENT",
    "PAYMENTS",
    "SETTLEMENT",
    "SETTLEMENTS",
    "MODERATION",
    "APPROVAL",
    "APPROVALS",
    "COMPLIANCE",
    "ORGANISATION",
    "ORGANIZATION",
    "OPERATIONAL_EXCEPTION",
    "SYSTEM",
    "PLATFORM",
  ].includes(category);

  return (
    explicitAction ||
    ["CRITICAL", "HIGH"].includes(severity) ||
    ["ESCALATED", "BLOCKED", "FAILED", "OVERDUE", "STUCK"].includes(status) ||
    platformCategory
  );
};

const getSafeDashboardError = (error: any) => {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("session") || message.includes("sign in")) {
    return "Your SUPER_ADMIN session is unavailable. Please sign in again.";
  }
  return "Choose an organisation above to load mandi-level metrics, operational activity, and scoped dashboard data.";
};

export const SuperadminDashboard: React.FC = () => {
  const { i18n } = useTranslation();
  const language = i18n.language || "en";
  const username = useMemo(() => getCurrentAdminUsername(), []);
  const navigate = useNavigate();

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
    if (!username) {
      setScopeError("No SUPER_ADMIN session was found. Please sign in again.");
      setOrganisations([]);
      return;
    }
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
    if (!username) {
      setScopeError("No SUPER_ADMIN session was found. Please sign in again.");
      setMandis([]);
      return;
    }

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
    setDashboardError(null);

    if (!username) {
      setDashboardError("No SUPER_ADMIN session was found. Please sign in again.");
      setSummary(null);
      return;
    }
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
      const resp = unwrapResponse(raw);
      if (String(resp?.responsecode ?? "0") !== "0") {
        throw new Error(resp?.description || "Unable to load platform dashboard.");
      }
      setSummary(raw?.data || resp?.data || null);
    } catch (error: any) {
      setDashboardError(getSafeDashboardError(error));
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
    loadMandis(selectedOrgId);
  }, [loadMandis, selectedOrgId]);

  const cards = summary?.cards || {};
  const alerts = Array.isArray(summary?.alerts) ? summary.alerts : [];
  const actionableAlerts = alerts.filter(isActionablePlatformAlert);
  const quickLinks = Array.isArray(summary?.quickLinks) ? summary.quickLinks : [];
  const charts = summary?.charts || {};

  const activeOrgCount = organisations.filter((org) => org.active !== false).length;
  const selectedOrg = organisations.find((org) => org.id === selectedOrgId);
  const selectedMandi = mandis.find((mandi) => mandi.id === selectedMandiId);
  const currentScopeLabel = selectedMandi?.name || selectedOrg?.name || "All Organisations";
  const hasSelectedOrgWithNoMandis = Boolean(selectedOrgId) && !scopeLoading && !scopeError && mandis.length === 0;

  const buildScopeQuery = useCallback((extra: Record<string, string> = {}) => {
    const params = new URLSearchParams();
    if (selectedOrgId) params.set("org_id", selectedOrgId);
    if (selectedOrg?.code) params.set("org_code", selectedOrg.code);
    if (selectedMandiId) params.set("mandi_id", selectedMandiId);
    if (selectedMandi?.slug) params.set("mandi_slug", selectedMandi.slug);
    Object.entries(extra).forEach(([key, value]) => {
      if (value) params.set(key, value);
    });
    const query = params.toString();
    return query ? `?${query}` : "";
  }, [selectedMandi?.slug, selectedMandiId, selectedOrg?.code, selectedOrgId]);

  const openAlert = useCallback((item: any) => {
    const target = item?.target_route || item?.route || item?.path || item?.target;
    if (typeof target === "string" && target.startsWith("/")) {
      navigate(target);
    }
  }, [navigate]);

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
            <Dropdown
              trigger={["click"]}
              menu={{
                selectedKeys: [selectedOrgId || "__all_orgs__"],
                items: [
                  { key: "__all_orgs__", label: "All organisations" },
                  ...organisations.map((org) => ({ key: org.id, label: org.name })),
                ],
                onClick: ({ key }) => {
                  setSelectedOrgId(key === "__all_orgs__" ? undefined : String(key));
                },
              }}
              overlayClassName="cm-superadmin-scope-menu"
            >
              <Button className="cm-superadmin-scope-trigger" loading={scopeLoading} block>
                <span className="cm-superadmin-scope-trigger-label">
                  {selectedOrg?.name || "All organisations"}
                </span>
                <DownOutlined className="cm-superadmin-scope-trigger-arrow" />
              </Button>
            </Dropdown>

            <Dropdown
              trigger={["click"]}
              disabled={!selectedOrgId}
              menu={{
                selectedKeys: [selectedMandiId || "__all_mandis__"],
                items: [
                  { key: "__all_mandis__", label: "All mandis" },
                  ...mandis.map((mandi) => ({ key: mandi.id, label: mandi.name })),
                ],
                onClick: ({ key }) => {
                  setSelectedMandiId(key === "__all_mandis__" ? undefined : String(key));
                },
              }}
              overlayClassName="cm-superadmin-scope-menu"
            >
              <Button
                className="cm-superadmin-scope-trigger"
                loading={scopeLoading && Boolean(selectedOrgId)}
                disabled={!selectedOrgId}
                block
              >
                <span className="cm-superadmin-scope-trigger-label">
                  {selectedOrgId
                    ? (selectedMandi?.name || (hasSelectedOrgWithNoMandis ? "No mandis available" : "All mandis"))
                    : "Select organisation first"}
                </span>
                <DownOutlined className="cm-superadmin-scope-trigger-arrow" />
              </Button>
            </Dropdown>
          </div>
        </div>
      </CmSectionCard>

      {scopeError && <Alert type="warning" showIcon message="Scope options could not be fully loaded" description={scopeError} />}
      {hasSelectedOrgWithNoMandis && (
        <Alert
          type="info"
          showIcon
          message="No mandis are mapped to this organisation"
          description="The dashboard remains scoped to the selected organisation."
        />
      )}
      {!selectedOrgId ? (
        <Alert
          type="info"
          showIcon
          message="Select an organisation to view live platform metrics"
          description="Choose an organisation above to load mandi-level metrics, operational activity, and scoped dashboard data."
          className="cm-superadmin-dashboard-guidance"
        />
      ) : selectedOrgId && dashboardError ? (
        <Alert
          type="error"
          showIcon
          message={`Live platform metrics could not be loaded for ${selectedOrg?.name || "the selected organisation"}`}
          description="The live dashboard request failed for the selected scope. Scope controls and administration shortcuts remain available."
          className="cm-superadmin-dashboard-guidance"
        />
      ) : null}

      {dashboardLoading && selectedOrgId && !summary ? (
        <CmSectionCard><Skeleton active paragraph={{ rows: 12 }} /></CmSectionCard>
      ) : selectedOrgId && !summary && !dashboardError ? (
        <CmSectionCard>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="No dashboard data was returned for the current scope"
          >
            <Button onClick={loadDashboard}>Refresh dashboard</Button>
          </Empty>
        </CmSectionCard>
      ) : (
        <div className="cm-superadmin-stack">
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} xl={6}>
              <CmStatCard
                label="Active Organisations"
                value={formatNumber(activeOrgCount)}
                helper={`Total loaded: ${formatNumber(organisations.length)}`}
                icon={<ApartmentOutlined />}
                tone="olive"
                onClick={() => navigate(`/orgs?status=ACTIVE${selectedOrgId ? `&org_id=${encodeURIComponent(selectedOrgId)}` : ""}`)}
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <CmStatCard
                label="Mandis in Scope"
                value={formatNumber(mandis.length)}
                helper={selectedOrg ? selectedOrg.name : "Across current platform scope"}
                icon={<ShopOutlined />}
                tone="neutral"
                onClick={() => navigate(`/mandis${buildScopeQuery()}`)}
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <CmStatCard
                label="Live Auctions"
                value={formatNumber(cards?.liveAuctions?.count)}
                helper={`Mandis: ${formatNumber(cards?.liveAuctions?.mandis_count, "0")}`}
                icon={<BankOutlined />}
                tone="amber"
                onClick={() => navigate(`/auction-sessions${buildScopeQuery({ status: "LIVE" })}`)}
              />
            </Col>
            <Col xs={24} sm={12} xl={6}>
              <CmStatCard
                label="Trade Value Today"
                value={formatMoney(cards?.todayTradeValue?.total_amount, cards?.todayTradeValue?.currency || "INR")}
                helper={`Lots: ${formatNumber(cards?.todayTradeValue?.lots_count, "0")}`}
                icon={<DollarOutlined />}
                tone="olive"
              />
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            <Col xs={24} xl={15}>
              <CmSectionCard className="cm-superadmin-attention-card">
                <div className="cm-superadmin-card-heading">
                  <div className="cm-superadmin-card-icon cm-superadmin-card-icon-warning"><AlertOutlined /></div>
                  <div>
                    <Title level={4}>Attention Required</Title>
                    <Text type="secondary">Only platform-level exceptions, escalations, overdue items, and high-severity issues that need SUPER_ADMIN attention.</Text>
                  </div>
                </div>
                {actionableAlerts.length ? (
                  <List
                    dataSource={actionableAlerts.slice(0, 6)}
                    renderItem={(item: any) => {
                      const severity = getAlertSeverity(item);
                      const organisation = item?.organisation_name || item?.org_name || item?.organisation || item?.org_code;
                      const mandi = item?.mandi_name || item?.mandi || item?.mandi_slug;
                      const owner = item?.owner || item?.assigned_to || item?.current_owner;
                      const stage = item?.stage || item?.current_stage || item?.status;
                      const metadata = [organisation, mandi, owner, stage].filter(Boolean);
                      const tagColor = ["CRITICAL", "HIGH"].includes(severity) ? "error" : severity === "MEDIUM" ? "warning" : "processing";

                      return (
                        <List.Item>
                          <div className="cm-superadmin-alert-row">
                            <div className="cm-superadmin-alert-content">
                              <Text strong>{item?.title || item?.message || "Platform exception"}</Text>
                              {item?.title && item?.message ? <Text type="secondary">{item.message}</Text> : null}
                              {metadata.length ? (
                                <div className="cm-superadmin-alert-meta">
                                  {metadata.map((value, index) => (
                                    <Text type="secondary" key={`${String(value)}-${index}`}>{String(value)}</Text>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                            <Space size={8}>
                              <Tag color={tagColor}>{severity}</Tag>
                              {(item?.target_route || item?.route || item?.path || item?.target) ? (
                                <Button size="small" type="link" onClick={() => openAlert(item)}>Open</Button>
                              ) : null}
                            </Space>
                          </div>
                        </List.Item>
                      );
                    }}
                  />
                ) : (
                  <Empty
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                    description="No critical platform issues require attention"
                  />
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
