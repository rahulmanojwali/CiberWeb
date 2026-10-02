import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  DatePicker,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  AreaChartOutlined,
  ReloadOutlined,
  RiseOutlined,
  SearchOutlined,
  ShopOutlined,
  TransactionOutlined,
} from "@ant-design/icons";
import dayjs, { type Dayjs } from "dayjs";
import { useTranslation } from "react-i18next";
import { useSnackbar } from "notistack";

import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { CmStatCard } from "../../design-system/components/CmStatCard";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { normalizeLanguageCode } from "../../config/languages";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import {
  fetchMarketPrices,
  generateMarketPriceSnapshots,
} from "../../services/marketPricesApi";
import "./mandiPrices.css";

const { Text } = Typography;
const { RangePicker } = DatePicker;

type Option = { value: string; label: string };

type PriceRow = {
  key: string;
  snapshot_date?: string | null;
  commodity_product_id?: string | number | null;
  commodity_name?: string | null;
  avg_price_per_qtl?: number | null;
  min_price_per_qtl?: number | null;
  max_price_per_qtl?: number | null;
  trades_count?: number | null;
  total_qty_qtl?: number | null;
};

function currentUser() {
  try {
    const raw = localStorage.getItem("cd_user");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function formatNumber(value?: number | null, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "—";
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  }).format(Number(value));
}

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD MMM YYYY") : "—";
}

export const MandiPrices: React.FC = () => {
  const { i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();
  const language = normalizeLanguageCode(i18n.language);

  const user = useMemo(() => currentUser(), []);
  const username = String(user?.username || "").trim();
  const country = String(user?.country || user?.country_code || "IN").trim().toUpperCase();
  const orgId = String(uiConfig.scope?.org_id || "").trim();
  const orgLabel = String(
    uiConfig.scope?.org_code || "Current organisation",
  ).trim();

  const canView = useMemo(
    () => can("mandi_prices.list", "VIEW") || can("market_prices.view", "VIEW"),
    [can],
  );
  const canGenerate = useMemo(
    () => can("mandi_prices.generate", "CREATE") || can("market_prices.generate", "CREATE"),
    [can],
  );

  const [mandis, setMandis] = useState<Option[]>([]);
  const [selectedMandiId, setSelectedMandiId] = useState("");
  const [dates, setDates] = useState<[Dayjs, Dayjs]>([dayjs(), dayjs()]);
  const [query, setQuery] = useState("");
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [mandiLoading, setMandiLoading] = useState(false);

  const loadMandis = async () => {
    if (!username || !orgId) return;
    setMandiLoading(true);
    try {
      const list = await getMandisForCurrentScope({
        username,
        language,
        org_id: orgId,
      });
      const mapped = (Array.isArray(list) ? list : [])
        .map((item: any) => ({
          value: String(item?.mandi_id ?? ""),
          label: String(item?.mandi_name || item?.mandi_slug || item?.mandi_code || item?.mandi_id || ""),
        }))
        .filter((item: Option) => item.value && item.label);
      setMandis(mapped);
      setSelectedMandiId((previous) => {
        if (previous && mapped.some((item: Option) => item.value === previous)) return previous;
        return mapped.length === 1 ? mapped[0].value : "";
      });
    } catch (err: any) {
      setMandis([]);
      enqueueSnackbar(err?.message || "Unable to load mandis.", { variant: "error" });
    } finally {
      setMandiLoading(false);
    }
  };

  const loadPrices = async () => {
    if (!canView || !username || !selectedMandiId || !dates[0] || !dates[1]) return;
    setLoading(true);
    try {
      const resp = await fetchMarketPrices({
        username,
        language,
        filters: {
          country,
          org_id: orgId,
          mandi_id: Number(selectedMandiId),
          from_date: dates[0].format("YYYY-MM-DD"),
          to_date: dates[1].format("YYYY-MM-DD"),
        },
      });
      const code = String(resp?.response?.responsecode ?? resp?.responsecode ?? "1");
      const description = resp?.response?.description || resp?.description || "Unable to load mandi prices.";
      if (code !== "0") {
        setRows([]);
        enqueueSnackbar(description, { variant: "error" });
        return;
      }
      const items = resp?.data?.items || resp?.response?.data?.items || [];
      setRows(
        (Array.isArray(items) ? items : []).map((item: any, index: number) => ({
          key: String(item?._id || `${item?.snapshot_date || "date"}-${item?.commodity_product_id ?? index}`),
          snapshot_date: item?.snapshot_date || null,
          commodity_product_id: item?.commodity_product_id ?? null,
          commodity_name: item?.commodity_name || null,
          avg_price_per_qtl: item?.metrics?.avg_price_per_qtl ?? null,
          min_price_per_qtl: item?.metrics?.min_price_per_qtl ?? null,
          max_price_per_qtl: item?.metrics?.max_price_per_qtl ?? null,
          trades_count: item?.metrics?.trades_count ?? 0,
          total_qty_qtl: item?.metrics?.total_qty_qtl ?? 0,
        })),
      );
    } catch (err: any) {
      setRows([]);
      enqueueSnackbar(err?.message || "Unable to load mandi prices.", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const generateSnapshot = async () => {
    if (!canGenerate || !username || !selectedMandiId) return;
    setGenerating(true);
    try {
      const resp = await generateMarketPriceSnapshots({
        username,
        language,
        payload: {
          country,
          org_id: orgId,
          mandi_id: Number(selectedMandiId),
          snapshot_date: dates[1].format("YYYY-MM-DD"),
        },
      });
      const code = String(resp?.response?.responsecode ?? resp?.responsecode ?? "1");
      const description = resp?.response?.description || resp?.description || "Unable to generate price snapshot.";
      if (code !== "0") {
        enqueueSnackbar(description, { variant: "error" });
        return;
      }
      const generated = resp?.data?.generated ?? resp?.response?.data?.generated ?? 0;
      enqueueSnackbar(
        generated > 0 ? `${generated} mandi price snapshot${generated === 1 ? "" : "s"} generated.` : "No completed trade data was available for that date.",
        { variant: generated > 0 ? "success" : "info" },
      );
      await loadPrices();
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Unable to generate price snapshot.", { variant: "error" });
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (canView) void loadMandis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, orgId, language]);

  useEffect(() => {
    setRows([]);
  }, [selectedMandiId]);

  const filteredRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      [row.commodity_name, row.commodity_product_id]
        .some((value) => String(value ?? "").toLowerCase().includes(needle)),
    );
  }, [query, rows]);

  const stats = useMemo(() => {
    const averages = rows
      .map((row) => Number(row.avg_price_per_qtl))
      .filter((value) => Number.isFinite(value));
    return {
      snapshots: rows.length,
      trades: rows.reduce((sum, row) => sum + Number(row.trades_count || 0), 0),
      quantity: rows.reduce((sum, row) => sum + Number(row.total_qty_qtl || 0), 0),
      average: averages.length ? averages.reduce((sum, value) => sum + value, 0) / averages.length : null,
    };
  }, [rows]);

  const columns: ColumnsType<PriceRow> = [
    {
      title: "Snapshot",
      dataIndex: "snapshot_date",
      width: 140,
      render: (value) => formatDate(value),
    },
    {
      title: "Commodity / Product",
      dataIndex: "commodity_name",
      render: (_, row) => (
        <div className="cm-mandi-prices-product">
          <Text strong>{row.commodity_name || `Product ${row.commodity_product_id ?? "—"}`}</Text>
          {row.commodity_product_id !== null && row.commodity_product_id !== undefined && (
            <Text type="secondary">ID {String(row.commodity_product_id)}</Text>
          )}
        </div>
      ),
    },
    {
      title: "Average / Qtl",
      dataIndex: "avg_price_per_qtl",
      align: "right",
      render: (value) => <Text strong>₹{formatNumber(value)}</Text>,
    },
    {
      title: "Min / Qtl",
      dataIndex: "min_price_per_qtl",
      align: "right",
      render: (value) => `₹${formatNumber(value)}`,
    },
    {
      title: "Max / Qtl",
      dataIndex: "max_price_per_qtl",
      align: "right",
      render: (value) => `₹${formatNumber(value)}`,
    },
    {
      title: "Trades",
      dataIndex: "trades_count",
      width: 100,
      align: "right",
      render: (value) => formatNumber(Number(value || 0), 0),
    },
    {
      title: "Quantity",
      dataIndex: "total_qty_qtl",
      width: 120,
      align: "right",
      render: (value) => `${formatNumber(Number(value || 0))} qtl`,
    },
  ];

  if (!canView) {
    return (
      <PageContainer className="cm-mandi-prices-page">
        <Alert
          type="warning"
          showIcon
          message="Mandi price access is not enabled for this role."
          description="Grant VIEW permission for mandi_prices.list or market_prices.view in Role Permission Manager."
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="cm-mandi-prices-page">
      <CmPageHeader
        eyebrow="MANDI MARKET DATA"
        title="Mandi Prices"
        subtitle="Review price snapshots derived from completed market trades for the current organisation and permitted mandi scope."
        actions={(
          <Button icon={<ReloadOutlined />} onClick={loadPrices} loading={loading} disabled={!selectedMandiId}>
            Refresh
          </Button>
        )}
      />

      <CmSectionCard className="cm-mandi-prices-scope-card">
        <div className="cm-mandi-prices-scope">
          <div>
            <Text className="cm-mandi-prices-eyebrow">WORKING SCOPE</Text>
            <div><Text strong>{orgLabel}</Text></div>
            <Text type="secondary">Price visibility remains locked to the current organisation and permitted mandi scope.</Text>
          </div>
          <Tag color="green">ORG SCOPED</Tag>
        </div>
      </CmSectionCard>

      <div className="cm-mandi-prices-stats">
        <CmStatCard label="Snapshots" value={stats.snapshots} helper="Rows in selected range" icon={<AreaChartOutlined />} />
        <CmStatCard label="Trades" value={stats.trades} helper="Underlying completed trades" icon={<TransactionOutlined />} />
        <CmStatCard label="Quantity" value={`${formatNumber(stats.quantity)} qtl`} helper="Total traded quantity" icon={<ShopOutlined />} tone="neutral" />
        <CmStatCard label="Average Price" value={stats.average === null ? "—" : `₹${formatNumber(stats.average)}`} helper="Average of snapshot averages / qtl" icon={<RiseOutlined />} tone="amber" />
      </div>

      <CmSectionCard>
        <div className="cm-mandi-prices-toolbar">
          <Select
            className="cm-mandi-prices-select cm-mandi-prices-mandi"
            placeholder="Select mandi"
            value={selectedMandiId || undefined}
            options={mandis}
            loading={mandiLoading}
            onChange={setSelectedMandiId}
            showSearch
            optionFilterProp="label"
          />
          <RangePicker
            className="cm-mandi-prices-range"
            value={dates}
            onChange={(value) => {
              if (value?.[0] && value?.[1]) setDates([value[0], value[1]]);
            }}
            allowClear={false}
            format="DD MMM YYYY"
          />
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search commodity or product ID"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <Space wrap>
            <Button type="primary" onClick={loadPrices} loading={loading} disabled={!selectedMandiId}>
              Load prices
            </Button>
            {canGenerate && (
              <Button onClick={generateSnapshot} loading={generating} disabled={!selectedMandiId}>
                Generate {dates[1].format("DD MMM")} snapshot
              </Button>
            )}
          </Space>
        </div>

        {!selectedMandiId ? (
          <Empty className="cm-mandi-prices-empty" description="Select a mandi to view market price snapshots." />
        ) : (
          <Table<PriceRow>
            rowKey="key"
            columns={columns}
            dataSource={filteredRows}
            loading={loading}
            size="middle"
            scroll={{ x: 980 }}
            locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No price snapshots found for this range." /> }}
            pagination={{
              defaultPageSize: 20,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              showTotal: (total) => `${total} snapshot${total === 1 ? "" : "s"}`,
            }}
          />
        )}
      </CmSectionCard>
    </PageContainer>
  );
};
