/*
 Author : CiberMandi Development Team
 Date : 2026-09-14
 Description : Platform Operations read-only Direct Trade Orders monitoring screen.
*/
import React from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Dropdown,
  Empty,
  Input,
  Modal,
  Pagination,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import type { MenuProps, TableColumnsType } from 'antd';
import {
  DownOutlined,
  ReloadOutlined,
  SearchOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { PageContainer } from '../../components/PageContainer';
import {
  getDirectTradeOrderDetails,
  listDirectTradeOrders,
} from '../../services/directTradeOrdersApi';
import './directTradeOrders.css';

const { Text } = Typography;

type AnyRecord = Record<string, any>;

type OrderRow = {
  order_id: string;
  listing_id?: string;
  inquiry_id?: string;
  commodity_name?: string;
  product_name?: string;
  farmer_username?: string;
  farmer_name?: string;
  trader_username?: string;
  trader_name?: string;
  quantity?: { value?: number | string; unit?: string };
  price?: { amount?: number | string; currency?: string; per_unit?: string };
  total_amount?: number | string;
  currency?: string;
  payment_status?: string;
  settlement_status?: string;
  fulfillment_status?: string;
  updated_on?: string;
  created_on?: string;
};

const STATUS_OPTIONS = [
  'ALL',
  'AWAITING_FARMER_ACKNOWLEDGEMENT',
  'PREPARING',
  'READY_FOR_PICKUP',
  'PICKED_UP',
  'IN_TRANSIT',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
] as const;

function currentUser() {
  try {
    return JSON.parse(localStorage.getItem('cd_user') || '{}');
  } catch {
    return {};
  }
}

function humanize(value?: unknown) {
  const text = String(value || '').trim();
  if (!text) return '—';
  return text
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatDateTime(value?: unknown) {
  if (!value) return '—';
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

function quantityLabel(value?: AnyRecord) {
  if (!value || value.value === undefined || value.value === null) return '—';
  return `${value.value}${value.unit ? ` ${value.unit}` : ''}`;
}

function currencySymbol(currency?: string) {
  const code = String(currency || 'INR').toUpperCase();
  return code === 'INR' ? '₹' : `${code} `;
}

function moneyLabel(order?: AnyRecord) {
  if (!order) return '—';
  const amount = order?.amounts?.total_amount ?? order?.total_amount;
  const currency = order?.amounts?.currency ?? order?.currency ?? order?.price?.currency ?? 'INR';
  if (amount !== undefined && amount !== null && amount !== '') {
    return `${currencySymbol(currency)}${Number(amount).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
  const unitPrice = order?.price?.amount;
  if (unitPrice === undefined || unitPrice === null || unitPrice === '') return '—';
  const suffix = order?.price?.per_unit ? ` / ${order.price.per_unit}` : '';
  return `${currencySymbol(order?.price?.currency)}${Number(unitPrice).toLocaleString('en-IN', { maximumFractionDigits: 2 })}${suffix}`;
}

function statusColor(status?: string) {
  switch (String(status || '').toUpperCase()) {
    case 'COMPLETED':
    case 'DELIVERED':
    case 'PAID':
    case 'SETTLED':
      return 'green';
    case 'READY_FOR_PICKUP':
      return 'cyan';
    case 'IN_TRANSIT':
    case 'PICKED_UP':
      return 'blue';
    case 'PREPARING':
      return 'gold';
    case 'CANCELLED':
    case 'FAILED':
    case 'REFUNDED':
      return 'red';
    case 'AWAITING_FARMER_ACKNOWLEDGEMENT':
    case 'PENDING':
      return 'orange';
    default:
      return 'default';
  }
}

function StatusTag({ value }: { value?: string }) {
  return <Tag color={statusColor(value)}>{humanize(value)}</Tag>;
}

export default function DirectTradeOrdersPage() {
  const user = React.useMemo(() => currentUser(), []);
  const username = String(user?.username || user?.user_name || '');

  const [rows, setRows] = React.useState<OrderRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [total, setTotal] = React.useState(0);
  const [status, setStatus] = React.useState<string>('ALL');
  const [search, setSearch] = React.useState('');
  const [appliedSearch, setAppliedSearch] = React.useState('');

  const [detailOpen, setDetailOpen] = React.useState(false);
  const [detailLoading, setDetailLoading] = React.useState(false);
  const [detailError, setDetailError] = React.useState<string | null>(null);
  const [detail, setDetail] = React.useState<AnyRecord | null>(null);
  const [selectedOrderId, setSelectedOrderId] = React.useState('');
  const [auditPage, setAuditPage] = React.useState(1);
  const [auditPageSize] = React.useState(20);

  const loadOrders = React.useCallback(async () => {
    if (!username) {
      setError('Signed-in administrator could not be identified.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await listDirectTradeOrders({
        username,
        page,
        limit: pageSize,
        status,
        search: appliedSearch,
      });
      setRows(Array.isArray(data?.items) ? data.items : []);
      setTotal(Number(data?.total || 0));
    } catch (err: any) {
      setRows([]);
      setTotal(0);
      setError(err?.message || 'Unable to load Direct Trade orders.');
    } finally {
      setLoading(false);
    }
  }, [username, page, pageSize, status, appliedSearch]);

  React.useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const loadDetails = React.useCallback(async (orderId: string, requestedAuditPage = 1) => {
    if (!username || !orderId) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const data = await getDirectTradeOrderDetails({
        username,
        order_id: orderId,
        audit_page: requestedAuditPage,
        audit_limit: auditPageSize,
      });
      setDetail(data || null);
    } catch (err: any) {
      setDetailError(err?.message || 'Unable to load order details.');
    } finally {
      setDetailLoading(false);
    }
  }, [username, auditPageSize]);

  const openDetails = React.useCallback((orderId: string) => {
    setSelectedOrderId(orderId);
    setDetail(null);
    setAuditPage(1);
    setDetailOpen(true);
    loadDetails(orderId, 1);
  }, [loadDetails]);

  const closeDetails = React.useCallback(() => {
    setDetailOpen(false);
    setDetail(null);
    setDetailError(null);
    setSelectedOrderId('');
    setAuditPage(1);
  }, []);

  const applySearch = React.useCallback(() => {
    setPage(1);
    setAppliedSearch(search.trim());
  }, [search]);

  const statusMenuItems: MenuProps['items'] = STATUS_OPTIONS.map((value) => ({
    key: value,
    label: value === 'ALL' ? 'All fulfilment statuses' : humanize(value),
  }));

  const columns: TableColumnsType<OrderRow> = React.useMemo(() => [
    {
      title: 'Order',
      dataIndex: 'order_id',
      key: 'order_id',
      width: 190,
      render: (value, row) => (
        <div>
          <span className="cm-dt-order-id">{value || '—'}</span>
          {row.listing_id ? <span className="cm-dt-order-secondary">Listing: {row.listing_id}</span> : null}
        </div>
      ),
    },
    {
      title: 'Product',
      key: 'product',
      width: 170,
      render: (_, row) => row.product_name || row.commodity_name || '—',
    },
    {
      title: 'Farmer',
      key: 'farmer',
      width: 160,
      render: (_, row) => (
        <div>
          <span>{row.farmer_name || row.farmer_username || '—'}</span>
          {row.farmer_name && row.farmer_username ? <span className="cm-dt-order-secondary">{row.farmer_username}</span> : null}
        </div>
      ),
    },
    {
      title: 'Trader',
      key: 'trader',
      width: 160,
      render: (_, row) => (
        <div>
          <span>{row.trader_name || row.trader_username || '—'}</span>
          {row.trader_name && row.trader_username ? <span className="cm-dt-order-secondary">{row.trader_username}</span> : null}
        </div>
      ),
    },
    {
      title: 'Quantity',
      key: 'quantity',
      width: 110,
      render: (_, row) => quantityLabel(row.quantity),
    },
    {
      title: 'Amount',
      key: 'amount',
      width: 125,
      render: (_, row) => moneyLabel(row),
    },
    {
      title: 'Fulfilment',
      dataIndex: 'fulfillment_status',
      key: 'fulfillment_status',
      width: 185,
      render: (value) => <StatusTag value={value} />,
    },
    {
      title: 'Payment',
      dataIndex: 'payment_status',
      key: 'payment_status',
      width: 110,
      render: (value) => <StatusTag value={value} />,
    },
    {
      title: 'Updated',
      dataIndex: 'updated_on',
      key: 'updated_on',
      width: 165,
      render: (value) => formatDateTime(value),
    },
    {
      title: 'Actions',
      key: 'actions',
      fixed: 'right',
      width: 90,
      render: (_, row) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => openDetails(row.order_id)}>
          View
        </Button>
      ),
    },
  ], [openDetails]);

  const order = detail?.order || null;
  const auditItems = Array.isArray(detail?.audit?.items) ? detail.audit.items : [];
  const auditTotal = Number(detail?.audit?.total || 0);
  const pickup = order?.pickup || {};
  const farmer = order?.party_snapshot?.farmer || {};
  const trader = order?.party_snapshot?.trader || {};
  const timeline = Array.isArray(order?.timeline) ? order.timeline : [];

  return (
    <PageContainer
      className="cm-dt-orders-page"
      title="Direct Trade Orders"
      subtitle="Monitor Direct Trade order fulfilment, payment status and audit history."
      actions={<Button icon={<ReloadOutlined />} onClick={loadOrders} loading={loading}>Refresh</Button>}
    >
      {error ? <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} /> : null}

      <Card size="small" className="cm-dt-orders-filter-card" style={{ marginBottom: 12 }}>
        <Row gutter={[10, 10]} className="cm-dt-orders-filter-row">
          <Col xs={24} lg={7}>
            <Dropdown
              trigger={['click']}
              menu={{
                items: statusMenuItems,
                selectedKeys: [status],
                onClick: ({ key }) => {
                  setStatus(String(key));
                  setPage(1);
                },
              }}
            >
              <Button className="cm-dt-orders-status-button">
                <span>{status === 'ALL' ? 'All fulfilment statuses' : humanize(status)}</span>
                <DownOutlined />
              </Button>
            </Dropdown>
          </Col>
          <Col xs={24} lg={17}>
            <div className="cm-dt-orders-search-group">
              <Input
                className="cm-dt-orders-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onPressEnter={applySearch}
                placeholder="Search exact order/listing ID or product, farmer, trader"
              />
              <Button
                className="cm-dt-orders-search-button"
                type="primary"
                icon={<SearchOutlined />}
                onClick={applySearch}
              >
                Search
              </Button>
            </div>
          </Col>
        </Row>
      </Card>

      <Card size="small" className="cm-dt-orders-table-card">
        <Table<OrderRow>
          rowKey="order_id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          scroll={{ x: 1480 }}
          locale={{
            emptyText: loading ? 'Loading…' : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No Direct Trade orders found." />,
          }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [25, 50, 100],
            showTotal: (value) => `${value} orders`,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPageSize !== pageSize ? 1 : nextPage);
              setPageSize(nextPageSize);
            },
          }}
        />
      </Card>

      <Modal
        className="cm-dt-order-modal"
        title={order?.order_id ? `Direct Trade Order · ${order.order_id}` : 'Direct Trade Order'}
        open={detailOpen}
        onCancel={closeDetails}
        width={1080}
        footer={<Button onClick={closeDetails}>Close</Button>}
        loading={detailLoading}
      >
        {detailError ? <Alert type="error" showIcon message={detailError} style={{ marginBottom: 12 }} /> : null}

        {order ? (
          <>
            <Space wrap style={{ marginBottom: 12 }}>
              <StatusTag value={order.fulfillment_status} />
              <StatusTag value={order.payment_status} />
              {order.settlement_status ? <StatusTag value={order.settlement_status} /> : null}
            </Space>

            <div className="cm-dt-detail-panel">
              <div className="cm-dt-detail-title">Order summary</div>
              <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
              <Descriptions.Item label="Order ID">{order.order_id || '—'}</Descriptions.Item>
              <Descriptions.Item label="Listing ID">{order.listing_id || '—'}</Descriptions.Item>
              <Descriptions.Item label="Product">{order.product_name || order.commodity_name || '—'}</Descriptions.Item>
              <Descriptions.Item label="Quantity">{quantityLabel(order.quantity)}</Descriptions.Item>
              <Descriptions.Item label="Unit price">{order?.price?.amount !== undefined ? `${currencySymbol(order?.price?.currency)}${Number(order.price.amount).toLocaleString('en-IN')} / ${order.price.per_unit || order.quantity?.unit || ''}` : '—'}</Descriptions.Item>
              <Descriptions.Item label="Order amount">{moneyLabel(order)}</Descriptions.Item>
              <Descriptions.Item label="Created on">{formatDateTime(order.created_on)}</Descriptions.Item>
              <Descriptions.Item label="Updated on">{formatDateTime(order.updated_on)}</Descriptions.Item>
              </Descriptions>
            </div>

            <div className="cm-dt-detail-section cm-dt-detail-panel">
              <div className="cm-dt-detail-title">Parties</div>
              <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="Farmer">{farmer.name || order.farmer_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Farmer mobile">{farmer.mobile || order.farmer_username || '—'}</Descriptions.Item>
                <Descriptions.Item label="Trader">{trader.name || order.trader_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Trader mobile">{trader.mobile || order.trader_username || '—'}</Descriptions.Item>
                {trader.business_name ? <Descriptions.Item label="Trader business" span={2}>{trader.business_name}</Descriptions.Item> : null}
              </Descriptions>
            </div>

            <div className="cm-dt-detail-section cm-dt-detail-panel">
              <div className="cm-dt-detail-title">Pickup</div>
              <Descriptions bordered size="small" column={{ xs: 1, sm: 2 }}>
                <Descriptions.Item label="Address" span={2}>{pickup.address || pickup.full_address || pickup.address_line || '—'}</Descriptions.Item>
                <Descriptions.Item label="District">{pickup.district || pickup.district_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="State">{pickup.state || pickup.state_name || '—'}</Descriptions.Item>
                <Descriptions.Item label="Pincode">{pickup.pincode || '—'}</Descriptions.Item>
                <Descriptions.Item label="Inventory">{humanize(order.inventory_status)}</Descriptions.Item>
              </Descriptions>
            </div>

            <div className="cm-dt-detail-section cm-dt-detail-panel">
              <div className="cm-dt-detail-title">Order timeline</div>
              {timeline.length ? timeline.map((item: AnyRecord, index: number) => (
                <div className="cm-dt-audit-item" key={item.event_id || `${item.status}-${index}`}>
                  <Space wrap>
                    <StatusTag value={item.status} />
                    <Text strong>{humanize(item.event_code || item.status)}</Text>
                  </Space>
                  <div className="cm-dt-order-secondary">
                    {item.actor_username || 'System'}{item.actor_role ? ` · ${humanize(item.actor_role)}` : ''}{item.occurred_on ? ` · ${formatDateTime(item.occurred_on)}` : ''}
                  </div>
                </div>
              )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No order timeline events available." />}
            </div>

            <div className="cm-dt-detail-section cm-dt-detail-panel">
              <div className="cm-dt-detail-title">Audit activity</div>
              {auditItems.length ? auditItems.map((item: AnyRecord, index: number) => (
                <div className="cm-dt-audit-item" key={item.activity_id || `${item.action}-${index}`}>
                  <Text strong>{humanize(item.action || item.event_code)}</Text>
                  <div className="cm-dt-order-secondary">
                    {item.username || item.user_id || 'System'}{item.role ? ` · ${humanize(item.role)}` : ''}{item.time ? ` · ${formatDateTime(item.time)}` : ''}
                  </div>
                </div>
              )) : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No audit activity recorded for this order." />}

              {auditTotal > auditPageSize ? (
                <div className="cm-dt-modal-pagination">
                  <Pagination
                    size="small"
                    current={auditPage}
                    pageSize={auditPageSize}
                    total={auditTotal}
                    showSizeChanger={false}
                    onChange={(nextPage) => {
                      setAuditPage(nextPage);
                      loadDetails(selectedOrderId, nextPage);
                    }}
                  />
                </div>
              ) : null}
            </div>
          </>
        ) : null}
      </Modal>
    </PageContainer>
  );
}
