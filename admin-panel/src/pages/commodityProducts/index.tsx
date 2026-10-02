import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Col,
  Empty,
  Form,
  Input,
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
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
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
  createCommodityProduct,
  fetchCommodities,
  fetchCommodityProducts,
  fetchUnits,
  updateCommodityProduct,
} from "../../services/mandiApi";
import "./commodityProducts.css";

const { Text } = Typography;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

type StatusFlag = "Y" | "N";
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

type OrganisationOption = {
  value: string;
  label: string;
  orgCode: string;
};

type CommodityOption = {
  value: string;
  label: string;
  is_active?: StatusFlag;
};

type ProductRow = {
  product_id: number;
  commodity_id: number;
  display_label: string;
  product_slug?: string | null;
  unit?: string | null;
  is_active: StatusFlag;
  source?: string | null;
  notes?: string | null;
};

type MasterProductRow = ProductRow & {
  already_imported?: boolean;
  org_is_active?: StatusFlag | null;
};

type UnitOption = { value: string; label: string };

type ProductSummary = {
  total: number;
  active: number;
  inactive: number;
  master_import: number;
  manual: number;
};

const EMPTY_SUMMARY: ProductSummary = {
  total: 0,
  active: 0,
  inactive: 0,
  master_import: 0,
  manual: 0,
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
      row?.product_slug ||
      row?.commodity_slug ||
      row?.product_id ||
      row?.commodity_id ||
      "",
  );
}

export const CommodityProducts: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const username = currentUsername();
  const [searchParams] = useSearchParams();
  const { authContext, can, isSuper } = usePermissions();
  const [messageApi, messageContextHolder] = message.useMessage();

  const canCreate = can("commodity_products_masters.create", "CREATE");
  const canUpdate = can("commodity_products_masters.edit", "UPDATE");
  const canDeactivate = can("commodity_products_masters.deactivate", "DEACTIVATE");

  const requestedOrgId = String(searchParams.get("org_id") || "").trim();
  const [selectedSuperOrgId, setSelectedSuperOrgId] = useState<string>(isSuper ? requestedOrgId : "");
  const [organisationOptions, setOrganisationOptions] = useState<OrganisationOption[]>([]);
  const [organisationsLoading, setOrganisationsLoading] = useState(false);
  const orgId = isSuper ? selectedSuperOrgId : String(authContext.org_id || "");
  const selectedOrg = organisationOptions.find((option) => option.value === selectedSuperOrgId);

  const [commodities, setCommodities] = useState<CommodityOption[]>([]);
  const [commodityLoading, setCommodityLoading] = useState(false);
  const [selectedCommodityId, setSelectedCommodityId] = useState<string>("");

  const [rows, setRows] = useState<ProductRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState<ProductSummary>(EMPTY_SUMMARY);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [units, setUnits] = useState<UnitOption[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm] = Form.useForm<{
    display_label: string;
    unit: string;
    notes?: string;
    is_active: StatusFlag;
  }>();

  const [importOpen, setImportOpen] = useState(false);
  const [masterRows, setMasterRows] = useState<MasterProductRow[]>([]);
  const [masterLoading, setMasterLoading] = useState(false);
  const [masterPage, setMasterPage] = useState(1);
  const [masterPageSize, setMasterPageSize] = useState(20);
  const [masterTotal, setMasterTotal] = useState(0);
  const [masterSearch, setMasterSearch] = useState("");
  const [masterDebouncedSearch, setMasterDebouncedSearch] = useState("");
  const [masterSelection, setMasterSelection] = useState<React.Key[]>([]);
  const [importSubmitting, setImportSubmitting] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchText.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [searchText]);

  useEffect(() => {
    const timer = window.setTimeout(() => setMasterDebouncedSearch(masterSearch.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [masterSearch]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, selectedCommodityId, orgId]);

  useEffect(() => {
    setMasterPage(1);
    setMasterSelection([]);
  }, [masterDebouncedSearch, selectedCommodityId, orgId]);

  useEffect(() => {
    setSelectedCommodityId("");
    setRows([]);
    setTotalCount(0);
    setSummary(EMPTY_SUMMARY);
  }, [orgId]);

  useEffect(() => {
    if (!isSuper || !username) return;
    let cancelled = false;
    const load = async () => {
      setOrganisationsLoading(true);
      try {
        const raw = await fetchOrganisations({ username, language: DEFAULT_LANGUAGE });
        if (cancelled) return;
        const meta = responseMeta(raw);
        if (meta.code && meta.code !== "0") throw new Error(meta.description || "Failed to load organisations.");
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
      } catch (error: any) {
        if (!cancelled) messageApi.error(error?.message || "Failed to load organisations.");
      } finally {
        if (!cancelled) setOrganisationsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isSuper, language, messageApi, username]);

  const loadCommodities = useCallback(async () => {
    if (!username || (isSuper && !orgId)) {
      setCommodities([]);
      return;
    }
    setCommodityLoading(true);
    try {
      const raw = await fetchCommodities({
        username,
        language,
        filters: {
          view: "IMPORTED",
          mandi_id: 0,
          org_id: orgId || undefined,
          is_active: "Y",
          page: 1,
          pageSize: 500,
        },
      });
      const meta = responseMeta(raw);
      if (meta.code && meta.code !== "0") throw new Error(meta.description || "Failed to load commodities.");
      const data = responseData(raw);
      const list = data?.rows || data?.imported || data?.org_selected || [];
      const options: CommodityOption[] = (Array.isArray(list) ? list : [])
        .filter((item: any) => item?.is_active !== "N")
        .map((item: any): CommodityOption => ({
          value: String(item.commodity_id),
          label: localizedLabel(item, language),
          is_active: item?.is_active === "N" ? "N" : "Y",
        }));
      setCommodities(options);
      if (selectedCommodityId && !options.some((item: CommodityOption) => item.value === selectedCommodityId)) {
        setSelectedCommodityId("");
      }
    } catch (error: any) {
      setCommodities([]);
      messageApi.error(error?.message || "Failed to load commodities.");
    } finally {
      setCommodityLoading(false);
    }
  }, [isSuper, language, messageApi, orgId, selectedCommodityId, username]);

  useEffect(() => {
    void loadCommodities();
  }, [loadCommodities]);

  const loadUnits = useCallback(async () => {
    if (!username) return;
    try {
      const raw = await fetchUnits({ username, language });
      const data = responseData(raw);
      const list = Array.isArray(data?.rows) ? data.rows : [];
      setUnits(
        list.map((unit: any) => ({
          value: String(unit.unit_code),
          label: String(unit.display_label || unit?.name_i18n?.[language] || unit?.name_i18n?.en || unit.unit_code),
        })),
      );
    } catch {
      setUnits([]);
    }
  }, [language, username]);

  useEffect(() => {
    void loadUnits();
  }, [loadUnits]);

  const loadProducts = useCallback(async () => {
    if (!username || !selectedCommodityId || (isSuper && !orgId)) {
      setRows([]);
      setTotalCount(0);
      setSummary(EMPTY_SUMMARY);
      return;
    }
    setLoading(true);
    try {
      const raw = await fetchCommodityProducts({
        username,
        language,
        filters: {
          view: "IMPORTED",
          org_id: orgId || undefined,
          commodity_id: Number(selectedCommodityId),
          is_active: statusFilter === "ALL" ? undefined : statusFilter === "ACTIVE" ? "Y" : "N",
          search: debouncedSearch || undefined,
          page,
          pageSize,
        },
      });
      const meta = responseMeta(raw);
      if (meta.code && meta.code !== "0") throw new Error(meta.description || "Failed to load commodity products.");
      const data = responseData(raw);
      const list = Array.isArray(data?.rows) ? data.rows : [];
      setRows(
        list.map((item: any) => ({
          product_id: Number(item.product_id),
          commodity_id: Number(item.commodity_id),
          display_label: localizedLabel(item, language),
          product_slug: item.product_slug || "",
          unit: item.unit || null,
          is_active: item.is_active === "N" ? "N" : "Y",
          source: item.source || null,
          notes: item.notes || null,
        })),
      );
      setTotalCount(Number(data?.totalCount || 0));
      setSummary({ ...EMPTY_SUMMARY, ...(data?.summary || {}) });
    } catch (error: any) {
      setRows([]);
      setTotalCount(0);
      setSummary(EMPTY_SUMMARY);
      messageApi.error(error?.message || "Failed to load commodity products.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, isSuper, language, messageApi, orgId, page, pageSize, selectedCommodityId, statusFilter, username]);

  useEffect(() => {
    void loadProducts();
  }, [loadProducts]);

  const loadMasterProducts = useCallback(async () => {
    if (!username || !selectedCommodityId || (isSuper && !orgId)) return;
    setMasterLoading(true);
    try {
      const raw = await fetchCommodityProducts({
        username,
        language,
        filters: {
          view: "MASTER",
          org_id: orgId || undefined,
          commodity_id: Number(selectedCommodityId),
          search: masterDebouncedSearch || undefined,
          page: masterPage,
          pageSize: masterPageSize,
        },
      });
      const meta = responseMeta(raw);
      if (meta.code && meta.code !== "0") throw new Error(meta.description || "Failed to load product master.");
      const data = responseData(raw);
      const list = Array.isArray(data?.rows) ? data.rows : [];
      setMasterRows(
        list.map((item: any) => ({
          product_id: Number(item.product_id),
          commodity_id: Number(item.commodity_id),
          display_label: localizedLabel(item, language),
          product_slug: item.product_slug || item.slug || "",
          unit: item.unit || null,
          is_active: item.is_active === false || item.is_active === "N" ? "N" : "Y",
          source: "MASTER",
          already_imported: Boolean(item.already_imported),
          org_is_active: item.org_is_active === "N" ? "N" : item.org_is_active === "Y" ? "Y" : null,
        })),
      );
      setMasterTotal(Number(data?.totalCount || 0));
    } catch (error: any) {
      setMasterRows([]);
      setMasterTotal(0);
      messageApi.error(error?.message || "Failed to load product master.");
    } finally {
      setMasterLoading(false);
    }
  }, [isSuper, language, masterDebouncedSearch, masterPage, masterPageSize, messageApi, orgId, selectedCommodityId, username]);

  useEffect(() => {
    if (importOpen) void loadMasterProducts();
  }, [importOpen, loadMasterProducts]);

  const handleImport = useCallback(async () => {
    if (!username || !selectedCommodityId || !masterSelection.length) return;
    setImportSubmitting(true);
    try {
      const raw = await createCommodityProduct({
        username,
        language,
        payload: {
          org_id: orgId || undefined,
          commodity_id: Number(selectedCommodityId),
          product_ids: masterSelection.map((key) => Number(key)),
        },
      });
      const meta = responseMeta(raw);
      if (meta.code && meta.code !== "0") throw new Error(meta.description || "Product import failed.");
      messageApi.success(`${masterSelection.length} product${masterSelection.length === 1 ? "" : "s"} imported or reactivated.`);
      setMasterSelection([]);
      setImportOpen(false);
      await loadProducts();
    } catch (error: any) {
      messageApi.error(error?.message || "Product import failed.");
    } finally {
      setImportSubmitting(false);
    }
  }, [language, loadProducts, masterSelection, messageApi, orgId, selectedCommodityId, username]);

  const handleCreate = useCallback(async () => {
    if (!username || !selectedCommodityId) return;
    try {
      const values = await createForm.validateFields();
      setCreateSubmitting(true);
      const raw = await createCommodityProduct({
        username,
        language,
        payload: {
          org_id: orgId || undefined,
          commodity_id: Number(selectedCommodityId),
          display_label: values.display_label.trim(),
          unit: values.unit,
          notes: values.notes?.trim() || null,
          is_active: values.is_active,
        },
      });
      const meta = responseMeta(raw);
      if (meta.code && meta.code !== "0") throw new Error(meta.description || "Failed to create product.");
      messageApi.success("Organisation product created.");
      setCreateOpen(false);
      createForm.resetFields();
      await loadProducts();
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(error?.message || "Failed to create product.");
    } finally {
      setCreateSubmitting(false);
    }
  }, [createForm, language, loadProducts, messageApi, orgId, selectedCommodityId, username]);

  const handleToggle = useCallback(
    async (row: ProductRow) => {
      if (!username) return;
      const nextStatus: StatusFlag = row.is_active === "Y" ? "N" : "Y";
      try {
        const raw = await updateCommodityProduct({
          username,
          language,
          payload: {
            org_id: orgId || undefined,
            product_id: row.product_id,
            commodity_id: row.commodity_id,
            is_active: nextStatus,
          },
        });
        const meta = responseMeta(raw);
        if (meta.code && meta.code !== "0") throw new Error(meta.description || "Failed to update product.");
        messageApi.success(nextStatus === "Y" ? "Product activated." : "Product deactivated.");
        await loadProducts();
      } catch (error: any) {
        messageApi.error(error?.message || "Failed to update product.");
      }
    },
    [language, loadProducts, messageApi, orgId, username],
  );

  const selectedCommodityLabel = useMemo(
    () => commodities.find((item) => item.value === selectedCommodityId)?.label || "No commodity selected",
    [commodities, selectedCommodityId],
  );

  const columns = useMemo<TableColumnsType<ProductRow>>(
    () => [
      {
        title: "Product",
        key: "product",
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <Text strong>{row.display_label}</Text>
            <Text type="secondary" className="cm-product-slug">{row.product_slug || `ID ${row.product_id}`}</Text>
          </Space>
        ),
      },
      { title: "ID", dataIndex: "product_id", width: 100, responsive: ["md"] },
      { title: "Unit", dataIndex: "unit", width: 110, render: (value) => value || "—" },
      {
        title: "Source",
        dataIndex: "source",
        width: 150,
        responsive: ["lg"],
        render: (value) => (
          <Tag color={String(value || "").toUpperCase() === "MASTER_IMPORT" ? "blue" : "gold"}>
            {String(value || "MANUAL").toUpperCase() === "MASTER_IMPORT" ? "Master" : "Organisation"}
          </Tag>
        ),
      },
      {
        title: "Status",
        dataIndex: "is_active",
        width: 120,
        render: (value: StatusFlag) => <Tag color={value === "Y" ? "success" : "default"}>{value === "Y" ? "Active" : "Inactive"}</Tag>,
      },
      {
        title: "Actions",
        key: "actions",
        width: 150,
        align: "right",
        render: (_, row) =>
          canUpdate || canDeactivate ? (
            <Button type="text" danger={row.is_active === "Y"} onClick={() => void handleToggle(row)}>
              {row.is_active === "Y" ? "Deactivate" : "Activate"}
            </Button>
          ) : (
            <Text type="secondary">View only</Text>
          ),
      },
    ],
    [canDeactivate, canUpdate, handleToggle],
  );

  const masterColumns = useMemo<TableColumnsType<MasterProductRow>>(
    () => [
      {
        title: "Product",
        key: "product",
        render: (_, row) => (
          <Space direction="vertical" size={0}>
            <Text strong>{row.display_label}</Text>
            <Text type="secondary" className="cm-product-slug">{row.product_slug || `ID ${row.product_id}`}</Text>
          </Space>
        ),
      },
      { title: "Unit", dataIndex: "unit", width: 120, render: (value) => value || "—" },
      {
        title: "Organisation status",
        key: "imported",
        width: 180,
        render: (_, row) => {
          if (!row.already_imported) return <Tag>Available</Tag>;
          if (row.org_is_active === "N") return <Tag color="warning">Inactive · can reactivate</Tag>;
          return <Tag color="success">Already added</Tag>;
        },
      },
    ],
    [],
  );

  const noScope = isSuper && !orgId;

  return (
    <PageContainer>
      {messageContextHolder}
      <div className="cm-commodity-products-page">
        <CmPageHeader
          eyebrow="MANDI MASTER DATA"
          title={t("menu.commodityProducts", { defaultValue: "Commodity Products" })}
          subtitle="Build the organisation product catalogue only from commodities already enabled for this organisation, while retaining controlled local additions."
          actions={<Button icon={<ReloadOutlined />} onClick={() => { void loadCommodities(); void loadProducts(); }}>Refresh</Button>}
        />

        <CmSectionCard compact className="cm-product-scope-card">
          <Row gutter={[16, 12]} align="middle">
            <Col xs={24} lg={12}>
              <div className="cm-product-scope-copy">
                <Text className="cm-product-scope-kicker">WORKING SCOPE</Text>
                <Text strong className="cm-product-scope-title">
                  {isSuper ? selectedOrg?.label || "Select an organisation" : authContext.org_code || "Organisation"}
                </Text>
                <Text type="secondary">Products can only be managed under an organisation commodity that has already been imported and activated.</Text>
              </div>
            </Col>
            <Col xs={24} lg={12}>
              {isSuper ? (
                <Select
                  className="cm-product-select"
                  value={selectedSuperOrgId || undefined}
                  placeholder="Select organisation"
                  loading={organisationsLoading}
                  showSearch
                  optionFilterProp="label"
                  options={organisationOptions}
                  onChange={setSelectedSuperOrgId}
                  style={{ width: "100%" }}
                />
              ) : (
                <div className="cm-product-scope-lock">{authContext.org_code || "Organisation scope locked by role"}</div>
              )}
            </Col>
          </Row>
        </CmSectionCard>

        {noScope && <Alert type="info" showIcon message="Select an organisation to load its commodity and product catalogue." />}

        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} xl={6}><CmStatCard label="Catalogue" value={summary.total} helper={selectedCommodityId ? selectedCommodityLabel : "Select a commodity"} icon={<AppstoreOutlined />} tone="olive" /></Col>
          <Col xs={24} sm={12} xl={6}><CmStatCard label="Active" value={summary.active} helper="Available for downstream use" icon={<CheckCircleOutlined />} tone="olive" /></Col>
          <Col xs={24} sm={12} xl={6}><CmStatCard label="Inactive" value={summary.inactive} helper="Retained, not deleted" icon={<StopOutlined />} tone="neutral" /></Col>
          <Col xs={24} sm={12} xl={6}><CmStatCard label="Master / Local" value={`${summary.master_import} / ${summary.manual}`} helper="Source mix" icon={<TagsOutlined />} tone="amber" /></Col>
        </Row>

        <CmSectionCard compact className="cm-product-catalogue-card">
          <div className="cm-product-toolbar">
            <div className="cm-product-toolbar-left">
              <Select
                className="cm-product-select cm-product-commodity-select"
                value={selectedCommodityId || undefined}
                placeholder="Select commodity"
                loading={commodityLoading}
                showSearch
                optionFilterProp="label"
                options={commodities}
                onChange={(value) => setSelectedCommodityId(String(value))}
                disabled={noScope}
              />
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Search product name or code"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                disabled={!selectedCommodityId}
                className="cm-product-search"
              />
              <Select
                className="cm-product-select cm-product-status-select"
                value={statusFilter}
                options={[
                  { value: "ALL", label: "All statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
                onChange={(value) => setStatusFilter(value as StatusFilter)}
                disabled={!selectedCommodityId}
              />
            </div>
            <Space wrap>
              {canCreate && (
                <Button icon={<PlusOutlined />} disabled={!selectedCommodityId} onClick={() => {
                  createForm.setFieldsValue({ unit: units.some((u) => u.value === "kg") ? "kg" : units[0]?.value, is_active: "Y" });
                  setCreateOpen(true);
                }}>
                  Add organisation product
                </Button>
              )}
              {canCreate && (
                <Button type="primary" icon={<ImportOutlined />} disabled={!selectedCommodityId} onClick={() => setImportOpen(true)}>
                  Import from master
                </Button>
              )}
            </Space>
          </div>

          {!selectedCommodityId ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={noScope ? "Select an organisation first." : "Select an imported commodity to manage its products."} />
          ) : (
            <Table<ProductRow>
              rowKey="product_id"
              columns={columns}
              dataSource={rows}
              loading={loading}
              size="middle"
              scroll={{ x: 760 }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No products found for this commodity." /> }}
              pagination={{
                current: page,
                pageSize,
                total: totalCount,
                showSizeChanger: true,
                pageSizeOptions: PAGE_SIZE_OPTIONS,
                showTotal: (total) => `${total} products`,
                onChange: (nextPage, nextSize) => {
                  setPage(nextPage);
                  if (nextSize !== pageSize) {
                    setPageSize(nextSize);
                    setPage(1);
                  }
                },
              }}
            />
          )}
        </CmSectionCard>

        <Modal
          rootClassName="cm-product-modal"
          title={`Import products · ${selectedCommodityLabel}`}
          open={importOpen}
          width={920}
          onCancel={() => { setImportOpen(false); setMasterSelection([]); }}
          footer={[
            <Button key="close" onClick={() => { setImportOpen(false); setMasterSelection([]); }}>Close</Button>,
            <Button key="import" type="primary" icon={<ImportOutlined />} loading={importSubmitting} disabled={!masterSelection.length} onClick={() => void handleImport()}>
              Import selected{masterSelection.length ? ` (${masterSelection.length})` : ""}
            </Button>,
          ]}
        >
          <Alert type="info" showIcon message="Only products from the protected platform master for the selected organisation commodity are shown. Already active products cannot be selected again; inactive products may be reactivated." />
          <Input
            allowClear
            prefix={<SearchOutlined />}
            placeholder="Search master products"
            value={masterSearch}
            onChange={(event) => setMasterSearch(event.target.value)}
            className="cm-product-modal-search"
          />
          <Table<MasterProductRow>
            rowKey="product_id"
            columns={masterColumns}
            dataSource={masterRows}
            loading={masterLoading}
            size="middle"
            scroll={{ x: 680 }}
            rowSelection={{
              selectedRowKeys: masterSelection,
              onChange: setMasterSelection,
              getCheckboxProps: (row) => ({ disabled: Boolean(row.already_imported && row.org_is_active === "Y") }),
            }}
            pagination={{
              current: masterPage,
              pageSize: masterPageSize,
              total: masterTotal,
              showSizeChanger: true,
              pageSizeOptions: [20, 50, 100, 200],
              onChange: (nextPage, nextSize) => {
                setMasterPage(nextPage);
                if (nextSize !== masterPageSize) {
                  setMasterPageSize(nextSize);
                  setMasterPage(1);
                }
              },
            }}
          />
        </Modal>

        <Modal
          rootClassName="cm-product-modal"
          title={`Add organisation product · ${selectedCommodityLabel}`}
          open={createOpen}
          confirmLoading={createSubmitting}
          okText="Create product"
          onOk={() => void handleCreate()}
          onCancel={() => { setCreateOpen(false); createForm.resetFields(); }}
        >
          <Alert type="info" showIcon message="Use this only when the product does not exist in the protected platform master." />
          <Form form={createForm} layout="vertical" className="cm-product-form" initialValues={{ is_active: "Y" }}>
            <Form.Item name="display_label" label="Product name" rules={[{ required: true, message: "Enter the product name." }, { max: 160, message: "Keep the name within 160 characters." }]}>
              <Input placeholder="e.g. Local speciality product" maxLength={160} />
            </Form.Item>
            <Form.Item name="unit" label="Unit" rules={[{ required: true, message: "Select a unit." }]}>
              <Select className="cm-product-select" showSearch optionFilterProp="label" options={units} placeholder="Select unit" />
            </Form.Item>
            <Form.Item name="notes" label="Notes">
              <Input.TextArea rows={3} maxLength={500} showCount placeholder="Optional internal notes" />
            </Form.Item>
            <Form.Item name="is_active" label="Initial status" rules={[{ required: true }]}>
              <Select className="cm-product-select" options={[{ value: "Y", label: "Active" }, { value: "N", label: "Inactive" }]} />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </PageContainer>
  );
};
