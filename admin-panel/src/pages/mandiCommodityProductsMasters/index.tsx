import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Col,
  Empty,
  Form,
  Modal,
  Row,
  Select,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  ImportOutlined,
  LinkOutlined,
  ReloadOutlined,
  ShopOutlined,
  StopOutlined,
  TagsOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { CmStatCard } from "../../design-system/components/CmStatCard";
import { normalizeLanguageCode } from "../../config/languages";
import { DEFAULT_LANGUAGE } from "../../config/appConfig";
import { usePermissions } from "../../authz/usePermissions";
import { fetchOrganisations } from "../../services/adminUsersApi";
import {
  createMandiCommodityProduct,
  deactivateMandiCommodityProduct,
  fetchCommodityProducts,
  fetchCommodities,
  fetchMandiCommodityProducts,
  getMandisForCurrentScope,
} from "../../services/mandiApi";
import "./mandiCommodityProducts.css";

const { Text } = Typography;

type StatusFlag = "Y" | "N";
type StatusFilter = "ALL" | "Y" | "N";
type TradeType = "PROCUREMENT" | "SALES" | "BOTH";

type OrganisationOption = { value: string; label: string; orgCode: string };
type MandiOption = { value: string; label: string };
type CommodityOption = { value: string; label: string };
type ProductOption = { product_id: number; label: string; unit?: string | null };
type MappingRow = {
  id: string;
  mandi_id: number;
  commodity_id: number;
  product_id: number;
  trade_type: TradeType;
  is_active: StatusFlag;
  notes?: string | null;
};

type MappingSummary = {
  total: number;
  active: number;
  inactive: number;
  procurement: number;
  sales: number;
  both: number;
};

const EMPTY_SUMMARY: MappingSummary = {
  total: 0,
  active: 0,
  inactive: 0,
  procurement: 0,
  sales: 0,
  both: 0,
};

function currentUsername(): string {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return String(parsed?.username || "");
  } catch {
    return "";
  }
}

function responseData(raw: any): any {
  return raw?.data || raw?.response?.data || raw || {};
}

function responseMeta(raw: any): { code: string; description: string } {
  const response = raw?.response || raw?.data?.response || raw;
  return {
    code: String(response?.responsecode ?? raw?.responsecode ?? raw?.responseCode ?? "0"),
    description: String(response?.description ?? raw?.description ?? ""),
  };
}

function localizedLabel(row: any, language: string): string {
  return String(
    row?.display_label ||
      row?.name_i18n?.[language] ||
      row?.label_i18n?.[language] ||
      row?.name_i18n?.en ||
      row?.label_i18n?.en ||
      row?.mandi_name ||
      row?.mandi_slug ||
      row?.product_slug ||
      row?.commodity_slug ||
      row?.product_id ||
      row?.commodity_id ||
      row?.mandi_id ||
      "",
  );
}

export const MandiCommodityProductsMasters: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const username = currentUsername();
  const [searchParams] = useSearchParams();
  const { authContext, can, isSuper } = usePermissions();
  const [messageApi, messageContextHolder] = message.useMessage();

  const canCreate = can("mandi_commodity_products_masters.create", "CREATE");
  const canDeactivate = can("mandi_commodity_products_masters.deactivate", "DEACTIVATE");

  const requestedOrgId = String(searchParams.get("org_id") || "").trim();
  const [selectedSuperOrgId, setSelectedSuperOrgId] = useState<string>(isSuper ? requestedOrgId : "");
  const [organisationOptions, setOrganisationOptions] = useState<OrganisationOption[]>([]);
  const [organisationsLoading, setOrganisationsLoading] = useState(false);
  const orgId = isSuper ? selectedSuperOrgId : String(authContext.org_id || "");
  const selectedOrg = organisationOptions.find((option) => option.value === selectedSuperOrgId);

  const [mandis, setMandis] = useState<MandiOption[]>([]);
  const [mandisLoading, setMandisLoading] = useState(false);
  const [selectedMandiId, setSelectedMandiId] = useState<string>("");

  const [commodities, setCommodities] = useState<CommodityOption[]>([]);
  const [commoditiesLoading, setCommoditiesLoading] = useState(false);
  const [selectedCommodityId, setSelectedCommodityId] = useState<string>("");

  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [rows, setRows] = useState<MappingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState<MappingSummary>(EMPTY_SUMMARY);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm] = Form.useForm<{ product_id: number; trade_type: TradeType }>();

  const [importOpen, setImportOpen] = useState(false);
  const [importSelection, setImportSelection] = useState<React.Key[]>([]);
  const [importTradeType, setImportTradeType] = useState<TradeType>("BOTH");
  const [importSubmitting, setImportSubmitting] = useState(false);

  useEffect(() => {
    if (!isSuper || !username) return;
    let cancelled = false;
    const load = async () => {
      setOrganisationsLoading(true);
      try {
        const raw = await fetchOrganisations({ username, language: DEFAULT_LANGUAGE });
        if (cancelled) return;
        const data = responseData(raw);
        const organisations = data?.organisations || raw?.response?.data?.organisations || [];
        const options: OrganisationOption[] = (Array.isArray(organisations) ? organisations : [])
          .filter((org: any) => org?._id && org?.org_code)
          .map((org: any) => ({
            value: String(org._id),
            label: String(org.org_name || org.org_code),
            orgCode: String(org.org_code),
          }));
        setOrganisationOptions(options);
        if (!selectedSuperOrgId && options.length === 1) setSelectedSuperOrgId(options[0].value);
      } catch (err: any) {
        if (!cancelled) messageApi.error(err?.message || "Failed to load organisations");
      } finally {
        if (!cancelled) setOrganisationsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isSuper, messageApi, selectedSuperOrgId, username]);

  useEffect(() => {
    setSelectedMandiId("");
    setSelectedCommodityId("");
    setRows([]);
    setSummary(EMPTY_SUMMARY);
    setTotalCount(0);
  }, [orgId]);

  const loadMandis = useCallback(async () => {
    if (!username || !orgId) {
      setMandis([]);
      return;
    }
    setMandisLoading(true);
    try {
      const raw = await getMandisForCurrentScope({
        username,
        language,
        org_id: orgId,
        filters: { page: 1, pageSize: 500, status: "ALL" },
      });
      const data = responseData(raw);
      const list = Array.isArray(raw) ? raw : data?.rows || data?.mandis || [];
      setMandis(
        (Array.isArray(list) ? list : []).map((item: any) => ({
          value: String(item.mandi_id),
          label: localizedLabel(item, language),
        })),
      );
    } catch (err: any) {
      messageApi.error(err?.message || "Failed to load mandis");
      setMandis([]);
    } finally {
      setMandisLoading(false);
    }
  }, [language, messageApi, orgId, username]);

  useEffect(() => {
    void loadMandis();
  }, [loadMandis]);

  const loadCommodities = useCallback(async () => {
    if (!username || !orgId) {
      setCommodities([]);
      return;
    }
    setCommoditiesLoading(true);
    try {
      const raw = await fetchCommodities({
        username,
        language,
        filters: { view: "IMPORTED", org_id: orgId, mandi_id: 0, is_active: "Y", page: 1, pageSize: 500 },
      });
      const data = responseData(raw);
      const list = data?.rows || data?.imported || [];
      setCommodities(
        (Array.isArray(list) ? list : [])
          .filter((item: any) => item?.is_active !== "N")
          .map((item: any) => ({ value: String(item.commodity_id), label: localizedLabel(item, language) })),
      );
    } catch (err: any) {
      messageApi.error(err?.message || "Failed to load commodities");
      setCommodities([]);
    } finally {
      setCommoditiesLoading(false);
    }
  }, [language, messageApi, orgId, username]);

  useEffect(() => {
    void loadCommodities();
  }, [loadCommodities]);

  useEffect(() => {
    setSelectedCommodityId("");
    setRows([]);
    setSummary(EMPTY_SUMMARY);
    setTotalCount(0);
  }, [selectedMandiId]);

  const loadProducts = useCallback(async () => {
    if (!username || !orgId || !selectedCommodityId) {
      setProducts([]);
      return;
    }
    setProductsLoading(true);
    try {
      const raw = await fetchCommodityProducts({
        username,
        language,
        filters: {
          view: "IMPORTED",
          org_id: orgId,
          commodity_id: Number(selectedCommodityId),
          is_active: "Y",
          page: 1,
          pageSize: 500,
        },
      });
      const data = responseData(raw);
      const list = data?.rows || [];
      setProducts(
        (Array.isArray(list) ? list : []).map((p: any) => ({
          product_id: Number(p.product_id),
          label: localizedLabel(p, language),
          unit: p.unit || null,
        })),
      );
    } catch (err: any) {
      messageApi.error(err?.message || "Failed to load products");
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, [language, messageApi, orgId, selectedCommodityId, username]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const loadMappings = useCallback(async () => {
    if (!username || !orgId || !selectedMandiId || !selectedCommodityId) {
      setRows([]);
      setSummary(EMPTY_SUMMARY);
      setTotalCount(0);
      return;
    }
    setLoading(true);
    try {
      const raw = await fetchMandiCommodityProducts({
        username,
        language,
        filters: {
          org_id: orgId,
          mandi_id: Number(selectedMandiId),
          commodity_id: Number(selectedCommodityId),
          is_active: statusFilter === "ALL" ? undefined : statusFilter,
          page,
          pageSize,
        },
      });
      const meta = responseMeta(raw);
      if (meta.code && meta.code !== "0") throw new Error(meta.description || "Failed to load mappings");
      const data = responseData(raw);
      const list = Array.isArray(data?.rows) ? data.rows : [];
      setRows(
        list.map((item: any, index: number) => ({
          id: String(item?._id || item?.id || `${item?.mandi_id}-${item?.product_id}-${index}`),
          mandi_id: Number(item?.mandi_id || 0),
          commodity_id: Number(item?.commodity_id || 0),
          product_id: Number(item?.product_id || 0),
          trade_type: (item?.trade_type || "BOTH") as TradeType,
          is_active: (item?.is_active || "Y") as StatusFlag,
          notes: item?.notes || null,
        })),
      );
      setTotalCount(Number(data?.totalCount ?? list.length));
      setSummary({
        total: Number(data?.summary?.total ?? data?.totalCount ?? list.length),
        active: Number(data?.summary?.active ?? list.filter((r: any) => r?.is_active !== "N").length),
        inactive: Number(data?.summary?.inactive ?? list.filter((r: any) => r?.is_active === "N").length),
        procurement: Number(data?.summary?.procurement ?? list.filter((r: any) => r?.trade_type === "PROCUREMENT").length),
        sales: Number(data?.summary?.sales ?? list.filter((r: any) => r?.trade_type === "SALES").length),
        both: Number(data?.summary?.both ?? list.filter((r: any) => r?.trade_type === "BOTH").length),
      });
    } catch (err: any) {
      messageApi.error(err?.message || "Failed to load mandi product mappings");
      setRows([]);
      setSummary(EMPTY_SUMMARY);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [language, messageApi, orgId, page, pageSize, selectedCommodityId, selectedMandiId, statusFilter, username]);

  useEffect(() => {
    void loadMappings();
  }, [loadMappings]);

  const mappedProductIds = useMemo(() => new Set(rows.map((row) => row.product_id)), [rows]);
  const availableProducts = useMemo(
    () => products.filter((product) => !mappedProductIds.has(product.product_id)),
    [mappedProductIds, products],
  );

  const productLabel = useCallback(
    (productId: number) => products.find((p) => p.product_id === productId)?.label || String(productId),
    [products],
  );

  const handleCreate = useCallback(async () => {
    if (!username || !orgId || !selectedMandiId || !selectedCommodityId) return;
    try {
      const values = await createForm.validateFields();
      setCreateSubmitting(true);
      const raw = await createMandiCommodityProduct({
        username,
        language,
        payload: {
          org_id: orgId,
          mandi_id: Number(selectedMandiId),
          commodity_id: Number(selectedCommodityId),
          product_ids: [Number(values.product_id)],
          trade_type: values.trade_type,
        },
      });
      const meta = responseMeta(raw);
      if (meta.code && meta.code !== "0") throw new Error(meta.description || "Failed to create mapping");
      messageApi.success("Mandi product mapping saved.");
      setCreateOpen(false);
      createForm.resetFields();
      await loadMappings();
    } catch (err: any) {
      if (err?.errorFields) return;
      messageApi.error(err?.message || "Failed to create mapping");
    } finally {
      setCreateSubmitting(false);
    }
  }, [createForm, language, loadMappings, messageApi, orgId, selectedCommodityId, selectedMandiId, username]);

  const handleImport = useCallback(async () => {
    if (!username || !orgId || !selectedMandiId || !selectedCommodityId || !importSelection.length) return;
    setImportSubmitting(true);
    try {
      const raw = await createMandiCommodityProduct({
        username,
        language,
        payload: {
          org_id: orgId,
          mandi_id: Number(selectedMandiId),
          commodity_id: Number(selectedCommodityId),
          product_ids: importSelection.map((id) => Number(id)),
          trade_type: importTradeType,
        },
      });
      const meta = responseMeta(raw);
      if (meta.code && meta.code !== "0") throw new Error(meta.description || "Failed to import mappings");
      messageApi.success("Selected products mapped to the mandi.");
      setImportSelection([]);
      setImportOpen(false);
      await loadMappings();
    } catch (err: any) {
      messageApi.error(err?.message || "Failed to import mappings");
    } finally {
      setImportSubmitting(false);
    }
  }, [importSelection, importTradeType, language, loadMappings, messageApi, orgId, selectedCommodityId, selectedMandiId, username]);

  const handleToggle = useCallback(async (row: MappingRow) => {
    if (!username) return;
    const nextState: StatusFlag = row.is_active === "Y" ? "N" : "Y";
    try {
      const raw = await deactivateMandiCommodityProduct({
        username,
        language,
        mapping_id: row.id,
        is_active: nextState,
      });
      const meta = responseMeta(raw);
      if (meta.code && meta.code !== "0") throw new Error(meta.description || "Failed to update mapping");
      messageApi.success(nextState === "Y" ? "Mapping activated." : "Mapping deactivated.");
      await loadMappings();
    } catch (err: any) {
      messageApi.error(err?.message || "Failed to update mapping");
    }
  }, [language, loadMappings, messageApi, username]);

  const columns: TableColumnsType<MappingRow> = [
    {
      title: "Product",
      dataIndex: "product_id",
      key: "product_id",
      minWidth: 220,
      render: (value: number) => (
        <Space direction="vertical" size={0}>
          <Text strong>{productLabel(value)}</Text>
          <Text type="secondary" className="cm-mcp-muted">Product ID {value}</Text>
        </Space>
      ),
    },
    {
      title: "Trade type",
      dataIndex: "trade_type",
      key: "trade_type",
      width: 150,
      render: (value: TradeType) => {
        const color = value === "PROCUREMENT" ? "blue" : value === "SALES" ? "gold" : "purple";
        return <Tag color={color}>{value === "BOTH" ? "Both" : value === "PROCUREMENT" ? "Procurement" : "Sales"}</Tag>;
      },
    },
    {
      title: "Status",
      dataIndex: "is_active",
      key: "is_active",
      width: 120,
      render: (value: StatusFlag) => <Tag color={value === "Y" ? "success" : "default"}>{value === "Y" ? "Active" : "Inactive"}</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 130,
      align: "right",
      render: (_, row) => canDeactivate ? (
        <Button
          type="text"
          danger={row.is_active === "Y"}
          icon={row.is_active === "Y" ? <StopOutlined /> : <CheckCircleOutlined />}
          onClick={() => void handleToggle(row)}
        >
          {row.is_active === "Y" ? "Deactivate" : "Activate"}
        </Button>
      ) : <Text type="secondary">—</Text>,
    },
  ];

  const scopeReady = Boolean(orgId);
  const mappingReady = Boolean(selectedMandiId && selectedCommodityId);

  return (
    <PageContainer title="Mandi Commodity Products">
      {messageContextHolder}
      <div className="cm-mcp-page">
        <CmPageHeader
          eyebrow="MANDI MASTER DATA"
          title="Mandi Commodity Products"
          subtitle="Control which organisation products are available at each mandi, with role-aware scope, trade direction and activation status."
          actions={
            <Button icon={<ReloadOutlined />} onClick={() => { void loadMandis(); void loadCommodities(); void loadProducts(); void loadMappings(); }}>
              Refresh
            </Button>
          }
        />

        <CmSectionCard compact className="cm-mcp-scope-card">
          <Row gutter={[16, 12]} align="middle">
            <Col xs={24} lg={11}>
              <Text className="cm-mcp-eyebrow">WORKING SCOPE</Text>
              <div className="cm-mcp-scope-title">
                {isSuper ? (selectedOrg?.label || "Choose organisation") : (authContext.org_code || "Current organisation")}
              </div>
              <Text type="secondary">Mappings are created only from products already enabled for the selected organisation.</Text>
            </Col>
            <Col xs={24} lg={13}>
              {isSuper ? (
                <Select
                  className="cm-mcp-select"
                  value={selectedSuperOrgId || undefined}
                  placeholder="Select organisation"
                  loading={organisationsLoading}
                  options={organisationOptions.map((option) => ({ value: option.value, label: `${option.label} · ${option.orgCode}` }))}
                  onChange={setSelectedSuperOrgId}
                  showSearch
                  optionFilterProp="label"
                  style={{ width: "100%" }}
                />
              ) : (
                <Alert type="info" showIcon message="Organisation scope is fixed by your signed-in role." />
              )}
            </Col>
          </Row>
        </CmSectionCard>

        <Row gutter={[12, 12]} className="cm-mcp-stats">
          <Col xs={12} md={6}><CmStatCard label="Mappings" value={summary.total} helper="For selected mandi + commodity" icon={<LinkOutlined />} /></Col>
          <Col xs={12} md={6}><CmStatCard label="Active" value={summary.active} helper="Available downstream" icon={<CheckCircleOutlined />} /></Col>
          <Col xs={12} md={6}><CmStatCard label="Inactive" value={summary.inactive} helper="Retained, not deleted" icon={<StopOutlined />} tone="neutral" /></Col>
          <Col xs={12} md={6}><CmStatCard label="Trade modes" value={`${summary.procurement}/${summary.sales}/${summary.both}`} helper="Procurement / Sales / Both" icon={<TagsOutlined />} tone="amber" /></Col>
        </Row>

        <CmSectionCard compact>
          <div className="cm-mcp-toolbar">
            <Select
              className="cm-mcp-select"
              value={selectedMandiId || undefined}
              placeholder="Select mandi"
              loading={mandisLoading}
              options={mandis}
              onChange={(value) => setSelectedMandiId(String(value))}
              showSearch
              optionFilterProp="label"
              disabled={!scopeReady}
            />
            <Select
              className="cm-mcp-select"
              value={selectedCommodityId || undefined}
              placeholder="Select commodity"
              loading={commoditiesLoading}
              options={commodities}
              onChange={(value) => setSelectedCommodityId(String(value))}
              showSearch
              optionFilterProp="label"
              disabled={!scopeReady}
            />
            <Select
              className="cm-mcp-select cm-mcp-status-select"
              value={statusFilter}
              onChange={(value) => setStatusFilter(value as StatusFilter)}
              options={[
                { value: "ALL", label: "All statuses" },
                { value: "Y", label: "Active" },
                { value: "N", label: "Inactive" },
              ]}
            />
            <div className="cm-mcp-toolbar-spacer" />
            {canCreate && (
              <Space wrap>
                <Button
                  icon={<AppstoreOutlined />}
                  disabled={!mappingReady || availableProducts.length === 0}
                  onClick={() => { createForm.setFieldsValue({ trade_type: "BOTH" }); setCreateOpen(true); }}
                >
                  Add mapping
                </Button>
                <Button
                  type="primary"
                  icon={<ImportOutlined />}
                  disabled={!mappingReady || availableProducts.length === 0}
                  onClick={() => setImportOpen(true)}
                >
                  Bulk map products
                </Button>
              </Space>
            )}
          </div>

          {!scopeReady && isSuper && <Alert type="info" showIcon message="Select an organisation to begin." />}
          {scopeReady && !selectedMandiId && <Alert type="info" showIcon message="Select a mandi, then choose an organisation commodity." />}
          {scopeReady && selectedMandiId && !selectedCommodityId && <Alert type="info" showIcon message="Select a commodity to load its mandi-level product mappings." />}
          {mappingReady && !productsLoading && products.length === 0 && <Alert type="warning" showIcon message="No active organisation products exist for this commodity. Add/import products first in Commodity Products." />}

          <Table<MappingRow>
            className="cm-mcp-table"
            rowKey="id"
            loading={loading}
            columns={columns}
            dataSource={mappingReady ? rows : []}
            locale={{ emptyText: mappingReady ? <Empty description="No mandi product mappings found" /> : <Empty description="Choose mandi and commodity" /> }}
            scroll={{ x: 760 }}
            pagination={{
              current: page,
              pageSize,
              total: totalCount,
              showSizeChanger: true,
              pageSizeOptions: [10, 20, 50, 100],
              showTotal: (total) => `${total} mappings`,
              onChange: (nextPage, nextPageSize) => { setPage(nextPage); setPageSize(nextPageSize); },
            }}
          />
        </CmSectionCard>
      </div>

      <Modal
        className="cm-mcp-modal"
        title="Add mandi product mapping"
        open={createOpen}
        onCancel={() => setCreateOpen(false)}
        onOk={() => void handleCreate()}
        okText="Save mapping"
        confirmLoading={createSubmitting}
        destroyOnHidden
      >
        <Alert type="info" showIcon message="Only active products already enabled for this organisation can be mapped to the mandi." />
        <Form form={createForm} layout="vertical" className="cm-mcp-form">
          <Form.Item name="product_id" label="Product" rules={[{ required: true, message: "Select a product" }]}>
            <Select
              className="cm-mcp-select"
              placeholder="Select product"
              showSearch
              optionFilterProp="label"
              options={availableProducts.map((product) => ({
                value: product.product_id,
                label: product.unit ? `${product.label} · ${product.unit}` : product.label,
              }))}
            />
          </Form.Item>
          <Form.Item name="trade_type" label="Trade type" rules={[{ required: true }]} initialValue="BOTH">
            <Select
              className="cm-mcp-select"
              options={[
                { value: "PROCUREMENT", label: "Procurement" },
                { value: "SALES", label: "Sales" },
                { value: "BOTH", label: "Both" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        className="cm-mcp-modal"
        title="Bulk map products"
        open={importOpen}
        onCancel={() => setImportOpen(false)}
        onOk={() => void handleImport()}
        okText={`Map ${importSelection.length || "selected"}`}
        okButtonProps={{ disabled: importSelection.length === 0 }}
        confirmLoading={importSubmitting}
        width={760}
        destroyOnHidden
      >
        <div className="cm-mcp-import-head">
          <div>
            <Text strong>Available organisation products</Text><br />
            <Text type="secondary">Products already mapped to this mandi are excluded.</Text>
          </div>
          <Select
            className="cm-mcp-select cm-mcp-trade-select"
            value={importTradeType}
            onChange={(value) => setImportTradeType(value as TradeType)}
            options={[
              { value: "PROCUREMENT", label: "Procurement" },
              { value: "SALES", label: "Sales" },
              { value: "BOTH", label: "Both" },
            ]}
          />
        </div>
        <div className="cm-mcp-import-list">
          {availableProducts.length === 0 ? (
            <Empty description="All active products are already mapped" />
          ) : (
            availableProducts.map((product) => (
              <label key={product.product_id} className="cm-mcp-import-row">
                <Checkbox
                  checked={importSelection.includes(product.product_id)}
                  onChange={(event) => {
                    setImportSelection((prev) => event.target.checked
                      ? [...prev, product.product_id]
                      : prev.filter((id) => id !== product.product_id));
                  }}
                />
                <span className="cm-mcp-import-copy">
                  <Text strong>{product.label}</Text>
                  <Text type="secondary">{product.unit || `Product ID ${product.product_id}`}</Text>
                </span>
              </label>
            ))
          )}
        </div>
      </Modal>
    </PageContainer>
  );
};

export default MandiCommodityProductsMasters;
