import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Col,
  Dropdown,
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
import type { MenuProps, TableColumnsType } from "antd";
import {
  AppstoreOutlined,
  CheckCircleOutlined,
  DownOutlined,
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
import { createCommodity, fetchCommodities, updateCommodity } from "../../services/mandiApi";
import "./commodities.css";

const { Text } = Typography;

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

type CommodityStatus = "Y" | "N";
type StatusFilter = "ALL" | "ACTIVE" | "INACTIVE";

type OrganisationOption = {
  value: string;
  label: string;
  orgCode: string;
};

type CommodityRow = {
  commodity_id: number;
  display_label: string;
  commodity_slug?: string | null;
  commodity_group?: string | null;
  is_active: CommodityStatus;
  source?: string | null;
  is_master_import?: boolean;
};

type MasterCommodityRow = {
  commodity_id: number;
  display_label: string;
  commodity_slug?: string | null;
  commodity_group?: string | null;
  is_active: boolean;
  already_imported?: boolean;
  org_is_active?: CommodityStatus | null;
};

type CommoditySummary = {
  total: number;
  active: number;
  inactive: number;
  master_import: number;
  manual: number;
};

const EMPTY_SUMMARY: CommoditySummary = {
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

function localizedName(row: any, language: string): string {
  return String(
    row?.display_label ||
      row?.name_i18n?.[language] ||
      row?.label_i18n?.[language] ||
      row?.name_i18n?.en ||
      row?.label_i18n?.en ||
      row?.commodity_slug ||
      row?.slug ||
      row?.commodity_id ||
      "",
  );
}

export const Commodities: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const username = currentUsername();
  const [searchParams] = useSearchParams();
  const { authContext, can, isSuper } = usePermissions();
  const [messageApi, messageContextHolder] = message.useMessage();

  const canCreate = can("commodities_masters.create", "CREATE");
  const canUpdate = can("commodities_masters.edit", "UPDATE");
  const canDeactivate = can("commodities_masters.deactivate", "DEACTIVATE");

  const requestedOrgId = String(searchParams.get("org_id") || "").trim();
  const [selectedSuperOrgId, setSelectedSuperOrgId] = useState<string>(isSuper ? requestedOrgId : "");
  const [organisationOptions, setOrganisationOptions] = useState<OrganisationOption[]>([]);
  const [organisationsLoading, setOrganisationsLoading] = useState(false);
  const orgId = isSuper ? selectedSuperOrgId : String(authContext.org_id || "");
  const selectedOrg = organisationOptions.find((option) => option.value === selectedSuperOrgId);

  const [rows, setRows] = useState<CommodityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState<CommoditySummary>(EMPTY_SUMMARY);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm] = Form.useForm<{ display_label: string; is_active: CommodityStatus }>();

  const [importOpen, setImportOpen] = useState(false);
  const [masterRows, setMasterRows] = useState<MasterCommodityRow[]>([]);
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
  }, [debouncedSearch, statusFilter, orgId]);

  useEffect(() => {
    setMasterPage(1);
    setMasterSelection([]);
  }, [masterDebouncedSearch, orgId]);

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
        const options = (Array.isArray(organisations) ? organisations : [])
          .filter((org: any) => org?._id && org?.org_code)
          .map((org: any) => ({
            value: String(org._id),
            label: String(org.org_name || org.org_code),
            orgCode: String(org.org_code),
          }));
        setOrganisationOptions(options);
      } catch (error: any) {
        if (!cancelled) {
          setOrganisationOptions([]);
          messageApi.error(error?.message || "Failed to load organisations.");
        }
      } finally {
        if (!cancelled) setOrganisationsLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [isSuper, language, messageApi, username]);

  const loadImported = useCallback(async () => {
    if (!username) return;
    if (isSuper && !orgId) {
      setRows([]);
      setTotalCount(0);
      setSummary(EMPTY_SUMMARY);
      return;
    }

    setLoading(true);
    try {
      const raw = await fetchCommodities({
        username,
        language,
        filters: {
          view: "IMPORTED",
          org_id: orgId || undefined,
          mandi_id: 0,
          is_active: statusFilter === "ALL" ? undefined : statusFilter === "ACTIVE" ? "Y" : "N",
          search: debouncedSearch || undefined,
          page,
          pageSize,
        },
      });
      const meta = responseMeta(raw);
      if (meta.code && meta.code !== "0") throw new Error(meta.description || "Failed to load commodities.");
      const data = responseData(raw);
      const list = Array.isArray(data?.rows) ? data.rows : [];
      setRows(
        list.map((row: any) => ({
          commodity_id: Number(row.commodity_id),
          display_label: localizedName(row, language),
          commodity_slug: row.commodity_slug || null,
          commodity_group: row.commodity_group || null,
          is_active: row.is_active === "N" ? "N" : "Y",
          source: row.source || null,
          is_master_import: Boolean(row.is_master_import || row.source === "MASTER_IMPORT"),
        })),
      );
      setTotalCount(Number(data?.totalCount ?? list.length));
      setSummary({ ...EMPTY_SUMMARY, ...(data?.summary || {}) });
    } catch (error: any) {
      setRows([]);
      setTotalCount(0);
      messageApi.error(error?.message || "Failed to load commodities.");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, isSuper, language, messageApi, orgId, page, pageSize, statusFilter, username]);

  const loadMasters = useCallback(async () => {
    if (!username || !importOpen) return;
    if (isSuper && !orgId) return;

    setMasterLoading(true);
    try {
      const raw = await fetchCommodities({
        username,
        language,
        filters: {
          view: "MASTER",
          org_id: orgId || undefined,
          is_active: "Y",
          search: masterDebouncedSearch || undefined,
          page: masterPage,
          pageSize: masterPageSize,
        },
      });
      const meta = responseMeta(raw);
      if (meta.code && meta.code !== "0") throw new Error(meta.description || "Failed to load master catalogue.");
      const data = responseData(raw);
      const list = Array.isArray(data?.rows) ? data.rows : [];
      setMasterRows(
        list.map((row: any) => ({
          commodity_id: Number(row.commodity_id),
          display_label: localizedName(row, language),
          commodity_slug: row.commodity_slug || row.slug || null,
          commodity_group: row.commodity_group || row.commodity_category || null,
          is_active: row.is_active !== false,
          already_imported: Boolean(row.already_imported),
          org_is_active: row.org_is_active === "N" ? "N" : row.org_is_active === "Y" ? "Y" : null,
        })),
      );
      setMasterTotal(Number(data?.totalCount ?? list.length));
    } catch (error: any) {
      setMasterRows([]);
      setMasterTotal(0);
      messageApi.error(error?.message || "Failed to load master catalogue.");
    } finally {
      setMasterLoading(false);
    }
  }, [importOpen, isSuper, language, masterDebouncedSearch, masterPage, masterPageSize, messageApi, orgId, username]);

  useEffect(() => {
    void loadImported();
  }, [loadImported]);

  useEffect(() => {
    void loadMasters();
  }, [loadMasters]);

  const handleToggle = useCallback(
    async (row: CommodityRow) => {
      if (!username || !orgId) return;
      const nextStatus: CommodityStatus = row.is_active === "Y" ? "N" : "Y";
      try {
        const raw = await updateCommodity({
          username,
          language,
          payload: { org_id: orgId, commodity_id: row.commodity_id, is_active: nextStatus },
        });
        const meta = responseMeta(raw);
        if (meta.code !== "0") throw new Error(meta.description || "Commodity status update failed.");
        messageApi.success(nextStatus === "Y" ? "Commodity activated." : "Commodity deactivated.");
        await loadImported();
      } catch (error: any) {
        messageApi.error(error?.message || "Commodity status update failed.");
      }
    },
    [language, loadImported, messageApi, orgId, username],
  );

  const handleCreate = async () => {
    if (!username || !orgId) return;
    try {
      const values = await createForm.validateFields();
      setCreateSubmitting(true);
      const raw = await createCommodity({
        username,
        language,
        payload: {
          org_id: orgId,
          display_label: values.display_label.trim(),
          is_active: values.is_active || "Y",
        },
      });
      const meta = responseMeta(raw);
      if (meta.code !== "0") throw new Error(meta.description || "Commodity creation failed.");
      messageApi.success("Organisation commodity created.");
      createForm.resetFields();
      setCreateOpen(false);
      await loadImported();
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(error?.message || "Commodity creation failed.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleImport = async () => {
    if (!username || !orgId || !masterSelection.length) return;
    setImportSubmitting(true);
    try {
      const raw = await createCommodity({
        username,
        language,
        payload: { org_id: orgId, commodity_ids: masterSelection.map((value) => Number(value)) },
      });
      const meta = responseMeta(raw);
      if (meta.code !== "0") throw new Error(meta.description || "Commodity import failed.");
      messageApi.success(`${masterSelection.length} commodit${masterSelection.length === 1 ? "y" : "ies"} imported.`);
      setMasterSelection([]);
      await Promise.all([loadImported(), loadMasters()]);
    } catch (error: any) {
      messageApi.error(error?.message || "Commodity import failed.");
    } finally {
      setImportSubmitting(false);
    }
  };

  const importedColumns = useMemo<TableColumnsType<CommodityRow>>(
    () => [
      {
        title: "Commodity",
        dataIndex: "display_label",
        key: "display_label",
        render: (value: string, row) => (
          <div className="cm-commodities-name-cell">
            <Text strong>{value}</Text>
            <Text type="secondary" className="cm-commodities-code-text">{row.commodity_slug || `ID ${row.commodity_id}`}</Text>
          </div>
        ),
      },
      {
        title: "ID",
        dataIndex: "commodity_id",
        key: "commodity_id",
        width: 110,
        responsive: ["md"],
      },
      {
        title: "Group",
        dataIndex: "commodity_group",
        key: "commodity_group",
        width: 180,
        responsive: ["lg"],
        render: (value) => value || <Text type="secondary">—</Text>,
      },
      {
        title: "Source",
        dataIndex: "source",
        key: "source",
        width: 150,
        responsive: ["lg"],
        render: (value, row) => (
          <Tag bordered={false} color={row.is_master_import ? "blue" : "gold"}>
            {row.is_master_import ? "Master" : value === "MANUAL" ? "Organisation" : value || "Organisation"}
          </Tag>
        ),
      },
      {
        title: "Status",
        dataIndex: "is_active",
        key: "is_active",
        width: 120,
        render: (value: CommodityStatus) => (
          <Tag bordered={false} color={value === "Y" ? "success" : "default"} icon={value === "Y" ? <CheckCircleOutlined /> : <StopOutlined />}>
            {value === "Y" ? "Active" : "Inactive"}
          </Tag>
        ),
      },
      {
        title: "Actions",
        key: "actions",
        width: 150,
        align: "right",
        render: (_, row) => {
          const items: MenuProps["items"] = [];
          if ((row.is_active === "Y" ? canDeactivate : canUpdate) && orgId) {
            items.push({
              key: "toggle",
              danger: row.is_active === "Y",
              icon: row.is_active === "Y" ? <StopOutlined /> : <CheckCircleOutlined />,
              label: row.is_active === "Y" ? "Deactivate" : "Activate",
              onClick: () => void handleToggle(row),
            });
          }
          if (!items.length) return <Text type="secondary">View only</Text>;
          return (
            <Dropdown menu={{ items }} trigger={["click"]}>
              <Button type="text" size="small">Actions <DownOutlined /></Button>
            </Dropdown>
          );
        },
      },
    ],
    [canDeactivate, canUpdate, handleToggle, orgId],
  );

  const masterColumns = useMemo<TableColumnsType<MasterCommodityRow>>(
    () => [
      {
        title: "Master commodity",
        dataIndex: "display_label",
        key: "display_label",
        render: (value: string, row) => (
          <div className="cm-commodities-name-cell">
            <Text strong>{value}</Text>
            <Text type="secondary" className="cm-commodities-code-text">{row.commodity_slug || `ID ${row.commodity_id}`}</Text>
          </div>
        ),
      },
      {
        title: "Group",
        dataIndex: "commodity_group",
        key: "commodity_group",
        width: 180,
        responsive: ["md"],
        render: (value) => value || <Text type="secondary">—</Text>,
      },
      {
        title: "Organisation status",
        key: "org_status",
        width: 170,
        render: (_, row) => {
          if (!row.already_imported) return <Tag bordered={false}>Available</Tag>;
          if (row.org_is_active === "N") return <Tag bordered={false} color="warning">Inactive · can reactivate</Tag>;
          return <Tag bordered={false} color="success">Already added</Tag>;
        },
      },
    ],
    [],
  );

  const scopeLabel = isSuper
    ? selectedOrg?.label || "Select an organisation"
    : authContext.org_code || authContext.org_id || "Organisation scope";

  return (
    <PageContainer>
      {messageContextHolder}
      <div className="cm-commodities-page">
        <CmPageHeader
          eyebrow={<Tag color="gold">Mandi Master Data</Tag>}
          title={t("menu.commodities", { defaultValue: "Commodities" })}
          subtitle="Control the organisation commodity catalogue from the protected platform master, with role-aware activation and local additions."
          actions={
            <Button icon={<ReloadOutlined />} onClick={() => void loadImported()} loading={loading}>
              Refresh
            </Button>
          }
        />

        <CmSectionCard compact className="cm-commodities-scope-card">
          <div className="cm-commodities-scope-layout">
            <div>
              <Text className="cm-commodities-scope-kicker">Working scope</Text>
              <div className="cm-commodities-scope-title">{scopeLabel}</div>
              <Text type="secondary">
                {isSuper
                  ? "Choose the organisation whose commodity catalogue you want to manage. Platform master commodities remain global."
                  : "Your organisation scope is enforced by backend RBAC. Mandi-scoped roles use the organisation catalogue only when their policy permits it."}
              </Text>
            </div>
            {isSuper && (
              <Select
                className="cm-commodities-org-select"
                value={selectedSuperOrgId || undefined}
                placeholder="Select organisation"
                loading={organisationsLoading}
                showSearch
                optionFilterProp="label"
                options={organisationOptions}
                onChange={(value) => {
                  setSelectedSuperOrgId(value);
                  setMasterSelection([]);
                }}
              />
            )}
          </div>
        </CmSectionCard>

        {isSuper && !orgId ? (
          <Alert
            type="info"
            showIcon
            message="Select an organisation to manage commodities"
            description="The commodity master is platform-wide, but activation, imports and custom commodities belong to an organisation."
          />
        ) : (
          <>
            <Row gutter={[12, 12]}>
              <Col xs={12} sm={12} lg={6}>
                <CmStatCard label="Catalogue" value={summary.total.toLocaleString("en-IN")} helper="Organisation commodities" icon={<AppstoreOutlined />} tone="olive" />
              </Col>
              <Col xs={12} sm={12} lg={6}>
                <CmStatCard label="Active" value={summary.active.toLocaleString("en-IN")} helper="Available for downstream use" icon={<CheckCircleOutlined />} tone="olive" />
              </Col>
              <Col xs={12} sm={12} lg={6}>
                <CmStatCard label="Inactive" value={summary.inactive.toLocaleString("en-IN")} helper="Retained, not deleted" icon={<StopOutlined />} tone="neutral" />
              </Col>
              <Col xs={12} sm={12} lg={6}>
                <CmStatCard label="Master / Local" value={`${summary.master_import} / ${summary.manual}`} helper="Source mix" icon={<TagsOutlined />} tone="amber" />
              </Col>
            </Row>

            <CmSectionCard className="cm-commodities-table-card">
              <div className="cm-commodities-toolbar">
                <div className="cm-commodities-toolbar-search">
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(event) => setSearchText(event.target.value)}
                    placeholder="Search commodity name or code"
                  />
                  <Select<StatusFilter>
                    value={statusFilter}
                    onChange={setStatusFilter}
                    options={[
                      { value: "ALL", label: "All statuses" },
                      { value: "ACTIVE", label: "Active" },
                      { value: "INACTIVE", label: "Inactive" },
                    ]}
                  />
                </div>
                <Space wrap>
                  {canCreate && (
                    <Button icon={<PlusOutlined />} onClick={() => { createForm.setFieldsValue({ display_label: "", is_active: "Y" }); setCreateOpen(true); }}>
                      Add organisation commodity
                    </Button>
                  )}
                  {canCreate && (
                    <Button type="primary" icon={<ImportOutlined />} onClick={() => { setImportOpen(true); setMasterSelection([]); }}>
                      Import from master
                    </Button>
                  )}
                </Space>
              </div>

              <Table<CommodityRow>
                className="cm-commodities-table"
                rowKey="commodity_id"
                columns={importedColumns}
                dataSource={rows}
                loading={loading}
                locale={{
                  emptyText: (
                    <Empty
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                      description={debouncedSearch || statusFilter !== "ALL" ? "No commodities match the current filters." : "No organisation commodities yet. Import from the platform master to begin."}
                    />
                  ),
                }}
                pagination={{
                  current: page,
                  pageSize,
                  total: totalCount,
                  showSizeChanger: true,
                  pageSizeOptions: PAGE_SIZE_OPTIONS,
                  showTotal: (total) => `${total.toLocaleString("en-IN")} commodities`,
                  onChange: (nextPage, nextSize) => {
                    setPage(nextSize !== pageSize ? 1 : nextPage);
                    setPageSize(nextSize);
                  },
                }}
                scroll={{ x: 760 }}
              />
            </CmSectionCard>
          </>
        )}
      </div>

      <Modal
        rootClassName="cm-commodities-modal"
        open={createOpen}
        title="Add organisation commodity"
        okText="Create commodity"
        confirmLoading={createSubmitting}
        onOk={() => void handleCreate()}
        onCancel={() => { setCreateOpen(false); createForm.resetFields(); }}
        destroyOnHidden
      >
        <Alert
          className="cm-commodities-modal-alert"
          type="info"
          showIcon
          message="Use this only when the commodity does not exist in the platform master."
        />
        <Form form={createForm} layout="vertical" initialValues={{ is_active: "Y" }} requiredMark="optional">
          <Form.Item
            name="display_label"
            label="Commodity name"
            rules={[{ required: true, whitespace: true, message: "Enter the commodity name." }]}
          >
            <Input maxLength={120} placeholder="e.g. Local speciality crop" />
          </Form.Item>
          <Form.Item name="is_active" label="Initial status">
            <Select options={[{ value: "Y", label: "Active" }, { value: "N", label: "Inactive" }]} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        rootClassName="cm-commodities-modal"
        open={importOpen}
        title="Import from platform commodity master"
        width={920}
        onCancel={() => { setImportOpen(false); setMasterSelection([]); setMasterSearch(""); }}
        footer={[
          <Button key="close" onClick={() => { setImportOpen(false); setMasterSelection([]); setMasterSearch(""); }}>
            Close
          </Button>,
          <Button
            key="import"
            type="primary"
            icon={<ImportOutlined />}
            disabled={!masterSelection.length}
            loading={importSubmitting}
            onClick={() => void handleImport()}
          >
            Import selected{masterSelection.length ? ` (${masterSelection.length})` : ""}
          </Button>,
        ]}
      >
        <div className="cm-commodities-import-toolbar">
          <Input
            allowClear
            prefix={<SearchOutlined />}
            value={masterSearch}
            onChange={(event) => setMasterSearch(event.target.value)}
            placeholder="Search platform commodity master"
          />
          <Text type="secondary">Active master records only</Text>
        </div>
        <Table<MasterCommodityRow>
          rowKey="commodity_id"
          columns={masterColumns}
          dataSource={masterRows}
          loading={masterLoading}
          rowSelection={{
            selectedRowKeys: masterSelection,
            preserveSelectedRowKeys: true,
            onChange: setMasterSelection,
            getCheckboxProps: (record) => ({
              disabled: record.already_imported && record.org_is_active === "Y",
            }),
          }}
          pagination={{
            current: masterPage,
            pageSize: masterPageSize,
            total: masterTotal,
            showSizeChanger: true,
            pageSizeOptions: PAGE_SIZE_OPTIONS,
            showTotal: (total) => `${total.toLocaleString("en-IN")} master commodities`,
            onChange: (nextPage, nextSize) => {
              setMasterPage(nextSize !== masterPageSize ? 1 : nextPage);
              setMasterPageSize(nextSize);
            },
          }}
          scroll={{ x: 650, y: 430 }}
        />
      </Modal>
    </PageContainer>
  );
};

export default Commodities;
