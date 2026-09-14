import React from 'react';
import { Alert, Button, Card, Col, Row, Space, Spin, Typography } from 'antd';
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  InboxOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '../../components/PageContainer';
import { getPlatformOperationsOverview } from '../../services/directTradeOrdersApi';
import './platformOperationsOverview.css';

const { Text, Title } = Typography;

type OverviewData = {
  approvals?: {
    pending_approval?: number;
    needs_attention?: number;
    published_today?: number;
  };
  orders?: {
    total?: number;
    picked_up?: number;
    completed?: number;
    cancelled?: number;
  };
  generated_at?: string;
};

function currentUser() {
  try {
    return JSON.parse(localStorage.getItem('cd_user') || '{}');
  } catch {
    return {};
  }
}

function formatTime(value?: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

type SummaryCardProps = {
  title: string;
  value: number;
  description: string;
  tone: 'pending' | 'attention' | 'success' | 'info' | 'neutral' | 'danger';
  icon: React.ReactNode;
  onClick: () => void;
};

function SummaryCard({ title, value, description, tone, icon, onClick }: SummaryCardProps) {
  return (
    <Card
      className={`cm-po-summary-card cm-po-summary-card-${tone}`}
      hoverable
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
    >
      <div className="cm-po-summary-card-head">
        <Text className="cm-po-summary-card-title">{title}</Text>
        <span className="cm-po-summary-card-icon">{icon}</span>
      </div>
      <Title level={2} className="cm-po-summary-card-value">{Number(value || 0).toLocaleString('en-IN')}</Title>
      <Text className="cm-po-summary-card-description">{description}</Text>
    </Card>
  );
}

export default function PlatformOperationsOverviewPage() {
  const navigate = useNavigate();
  const user = React.useMemo(() => currentUser(), []);
  const username = String(user?.username || user?.user_name || '').trim();

  const [data, setData] = React.useState<OverviewData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    if (!username) {
      setError('Signed-in administrator could not be identified.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await getPlatformOperationsOverview({ username });
      setData(response || {});
    } catch (err: any) {
      setData(null);
      setError(err?.message || 'Unable to load Platform Operations overview.');
    } finally {
      setLoading(false);
    }
  }, [username]);

  React.useEffect(() => {
    load();
  }, [load]);

  const approvals = data?.approvals || {};
  const orders = data?.orders || {};

  return (
    <PageContainer title="Platform Operations">
      <div className="cm-platform-operations-overview">
        <div className="cm-po-header">
          <div>
            <Title level={2} className="cm-po-title">Platform Operations Overview</Title>
            <Text type="secondary">
              Direct Trade approval workload and order fulfilment at a glance.
            </Text>
          </div>
          <Space>
            {data?.generated_at ? (
              <Text type="secondary" className="cm-po-updated">Updated {formatTime(data.generated_at)}</Text>
            ) : null}
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
          </Space>
        </div>

        {error ? (
          <Alert
            type="error"
            showIcon
            message="Platform Operations overview could not be loaded"
            description={error}
            action={<Button size="small" onClick={load}>Retry</Button>}
          />
        ) : null}

        <Spin spinning={loading}>
          <section className="cm-po-section">
            <div className="cm-po-section-heading">
              <div>
                <Title level={4}>Direct Trade Approvals</Title>
                <Text type="secondary">Listings requiring platform review and approval.</Text>
              </div>
              <Button type="link" onClick={() => navigate('/direct-trade/approvals')}>Open approvals</Button>
            </div>
            <Row gutter={[14, 14]}>
              <Col xs={24} md={8}>
                <SummaryCard
                  title="Pending Approval"
                  value={Number(approvals.pending_approval || 0)}
                  description="Listings waiting for platform review."
                  tone="pending"
                  icon={<ClockCircleOutlined />}
                  onClick={() => navigate('/direct-trade/approvals?status=PENDING_APPROVAL')}
                />
              </Col>
              <Col xs={24} md={8}>
                <SummaryCard
                  title="Needs Attention"
                  value={Number(approvals.needs_attention || 0)}
                  description="Rejected or change-requested listings."
                  tone="attention"
                  icon={<ExclamationCircleOutlined />}
                  onClick={() => navigate('/direct-trade/approvals?status=NEEDS_ATTENTION')}
                />
              </Col>
              <Col xs={24} md={8}>
                <SummaryCard
                  title="Published Today"
                  value={Number(approvals.published_today || 0)}
                  description="Listings fully approved today (India time)."
                  tone="success"
                  icon={<CheckCircleOutlined />}
                  onClick={() => navigate('/direct-trade/approvals?status=APPROVED')}
                />
              </Col>
            </Row>
          </section>

          <section className="cm-po-section">
            <div className="cm-po-section-heading">
              <div>
                <Title level={4}>Direct Trade Orders</Title>
                <Text type="secondary">Current Direct Trade order fulfilment snapshot.</Text>
              </div>
              <Button type="link" onClick={() => navigate('/direct-trade/orders')}>Open orders</Button>
            </div>
            <Row gutter={[14, 14]}>
              <Col xs={24} sm={12} xl={6}>
                <SummaryCard
                  title="Total Orders"
                  value={Number(orders.total || 0)}
                  description="All Direct Trade inquiry orders."
                  tone="neutral"
                  icon={<ShoppingCartOutlined />}
                  onClick={() => navigate('/direct-trade/orders?status=ALL')}
                />
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <SummaryCard
                  title="Picked Up"
                  value={Number(orders.picked_up || 0)}
                  description="Orders currently marked picked up."
                  tone="info"
                  icon={<InboxOutlined />}
                  onClick={() => navigate('/direct-trade/orders?status=PICKED_UP')}
                />
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <SummaryCard
                  title="Completed"
                  value={Number(orders.completed || 0)}
                  description="Successfully completed Direct Trade orders."
                  tone="success"
                  icon={<CheckCircleOutlined />}
                  onClick={() => navigate('/direct-trade/orders?status=COMPLETED')}
                />
              </Col>
              <Col xs={24} sm={12} xl={6}>
                <SummaryCard
                  title="Cancelled"
                  value={Number(orders.cancelled || 0)}
                  description="Cancelled Direct Trade orders."
                  tone="danger"
                  icon={<CloseCircleOutlined />}
                  onClick={() => navigate('/direct-trade/orders?status=CANCELLED')}
                />
              </Col>
            </Row>
          </section>
        </Spin>
      </div>
    </PageContainer>
  );
}
