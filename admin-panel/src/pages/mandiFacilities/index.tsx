import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Col,
  Empty,
  Form,
  Input,
  InputNumber,
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
  EditOutlined,
  ImportOutlined,
  PlusOutlined,
  ReloadOutlined,
  SearchOutlined,
  StopOutlined,
  ToolOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { CmStatCard } from "../../design-system/components/CmStatCard";
import { normalizeLanguageCode } from "../../config/languages";
import { usePermissions } from "../../authz/usePermissions";
import { fetchOrganisations } from "../../services/adminUsersApi";
import {
  createMandiFacility,
  deactivateMandiFacility,
  fetchMandiFacilitiesBootstrap,
  updateMandiFacility,
} from "../../services/mandiApi";
import "./mandiFacilities.css";

const { Text, Paragraph } = Typography;
const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

type StatusFlag = "Y" | "N";
type StatusFilter = "ALL" | "Y" | "N";

type OrganisationOption = {
  value: string;
  label: string;
  orgCode: string;
};

type MandiOption = {
  value: string;
  label: string;
  stateCode?: string | null;
  district?: string | null;
};

type MasterFacility = {
  facility_code: string;
  label: string;
  name_i18n?: Record<string, string>;
  is_active: StatusFlag;
  default_capacity_num?: number | null;
  default_capacity_unit?: string | null;
  default_notes?: string | null;
};

type FacilityRow = {
  id: string;
  facility_code: string;
  facility_label: string;
  facility_name_i18n?: Record<string, string>;
  capacity_num?: number | null;
  capacity_unit?: string | null;
  notes?: string | null;
  is_active: StatusFlag;
};

type UnitOption = { value: string; label: string };

type FacilitySummary = {
  total: number;
  active: number;
  inactive: number;
  with_capacity: number;
};

const EMPTY_SUMMARY: FacilitySummary = { total: 0, active: 0, inactive: 0, with_capacity: 0 };

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
    row?.label ||
      row?.display_label ||
      row?.name_i18n?.[language] ||
      row?.label_i18n?.[language] ||
      row?.name_i18n?.en ||
      row?.label_i18n?.en ||
      row?.mandi_slug ||
      row?.facility_code ||
      row?.mandi_id ||
      "",
  );
}

export const MandiFacilities: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const username = currentUsername();
  const [searchParams] = useSearchParams();
  const { authContext, can, isSuper } = usePermissions();
  const [messageApi, messageContextHolder] = message.useMessage();

  const canCreate = can("mandi_facilities.create", "CREATE");
  const canUpdate = can("mandi_facilities.update", "UPDATE");
  const canDeactivate = can("mandi_facilities.deactivate", "DEACTIVATE");

  const requestedOrgId = String(searchParams.get("org_id") || "").trim();
  const [selectedSuperOrgId, setSelectedSuperOrgId] = useState<string>(isSuper ? requestedOrgId : "");
  const [organisationOptions, setOrganisationOptions] = useState<OrganisationOption[]>([]);
  const [organisationsLoading, setOrganisationsLoading] = useState(false);
  const orgId = isSuper ? selectedSuperOrgId : String(authContext.org_id || "");
  const selectedOrg = organisationOptions.find((item) => item.value === selectedSuperOrgId);

  const [mandis, setMandis] = useState<MandiOption[]>([]);
  const [masters, setMasters] = useState<MasterFacility[]>([]);
  const [units, setUnits] = useState<UnitOption[]>([]);
  const [rows, setRows] = useState<FacilityRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMandiId, setSelectedMandiId] = useState<string>(String(searchParams.get("mandi_id") || ""));
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [searchText, setSearchText] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createForm] = Form.useForm<{
    facility_code: string;
    capacity_num?: number;
    capacity_unit?: string;
    notes?: string;
  }>();

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkSelection, setBulkSelection] = useState<React.Key[]>([]);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<FacilityRow | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editForm] = Form.useForm<{
    capacity_num?: number;
    capacity_unit?: string;
    notes?: string;
  }>();

  useEffect(() => {
    if (!isSuper || !username) return;
    let cancelled = false;
    const load = async () => {
      setOrganisationsLoading(true);
      try {
        const raw = await fetchOrganisations({ username, language });
        const data = responseData(raw);
        const organisations = Array.isArray(data?.items)
          ? data.items
          : Array.isArray(data?.organisations)
            ? data.organisations
            : Array.isArray(data)
              ? data
              : [];
        const options: OrganisationOption[] = organisations
          .map((item: any) => ({
            value: String(item?._id || item?.org_id || ""),
            label: String(item?.org_name || item?.name || item?.org_code || item?._id || ""),
            orgCode: String(item?.org_code || ""),
          }))
          .filter((item: OrganisationOption) => item.value && item.label);
        if (!cancelled) {
          setOrganisationOptions(options);
          if (selectedSuperOrgId && !options.some((item) => item.value === selectedSuperOrgId)) {
            setSelectedSuperOrgId("");
          }
        }
      } catch (error: any) {
        if (!cancelled) messageApi.error(error?.message || "Unable to load organisations.");
      } finally {
        if (!cancelled) setOrganisationsLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [isSuper, language, messageApi, selectedSuperOrgId, username]);

  const loadFacilities = useCallback(async () => {
    if (!username || !orgId) {
      setMandis([]);
      setMasters([]);
      setUnits([]);
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const filters: Record<string, any> = { org_id: orgId };
      if (selectedMandiId) filters.mandi_id = Number(selectedMandiId);
      if (selectedMandiId && statusFilter !== "ALL") filters.is_active = statusFilter;
      const raw = await fetchMandiFacilitiesBootstrap({ username, language, filters });
      const meta = responseMeta(raw);
      if (meta.code !== "0") throw new Error(meta.description || "Unable to load mandi facilities.");
      const data = responseData(raw);

      const mandiOptions: MandiOption[] = (Array.isArray(data?.mandis) ? data.mandis : [])
        .map((item: any) => ({
          value: String(item?.mandi_id || ""),
          label: localizedLabel(item, language),
          stateCode: item?.state_code || null,
          district: item?.district_name || null,
        }))
        .filter((item: MandiOption) => item.value && item.label);
      setMandis(mandiOptions);
      if (selectedMandiId && !mandiOptions.some((item) => item.value === selectedMandiId)) {
        setSelectedMandiId("");
      }

      const masterRows: MasterFacility[] = (Array.isArray(data?.facilityMasters) ? data.facilityMasters : [])
        .filter((item: any) => String(item?.is_active || "Y").toUpperCase() !== "N")
        .map((item: any) => ({
          facility_code: String(item?.facility_code || ""),
          label: localizedLabel(item, language),
          name_i18n: item?.name_i18n || item?.label_i18n || undefined,
          is_active: String(item?.is_active || "Y").toUpperCase() === "N" ? "N" : "Y",
          default_capacity_num: item?.default_capacity_num ?? null,
          default_capacity_unit: item?.default_capacity_unit ?? null,
          default_notes: item?.default_notes ?? null,
        }))
        .filter((item: MasterFacility) => item.facility_code);
      setMasters(masterRows);

      setUnits(
        (Array.isArray(data?.units) ? data.units : [])
          .map((item: any) => ({
            value: String(item?.unit_code || item?.code || ""),
            label: String(item?.label_i18n?.[language] || item?.label_i18n?.en || item?.display_label || item?.label || item?.unit_code || item?.code || ""),
          }))
          .filter((item: UnitOption) => item.value),
      );

      const masterMap = new Map(masterRows.map((item) => [item.facility_code, item]));
      setRows(
        (Array.isArray(data?.items) ? data.items : []).map((item: any) => {
          const code = String(item?.facility_code || "");
          return {
            id: String(item?._id || `${item?.mandi_id || selectedMandiId}-${code}`),
            facility_code: code,
            facility_label: masterMap.get(code)?.label || localizedLabel(item, language) || code,
            facility_name_i18n: masterMap.get(code)?.name_i18n,
            capacity_num: item?.capacity_num ?? null,
            capacity_unit: item?.capacity_unit || item?.unit_code || null,
            notes: item?.notes ?? null,
            is_active: String(item?.is_active || "Y").toUpperCase() === "N" ? "N" : "Y",
          } as FacilityRow;
        }),
      );
    } catch (error: any) {
      messageApi.error(error?.message || "Unable to load mandi facilities.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [language, messageApi, orgId, selectedMandiId, statusFilter, username]);

  useEffect(() => {
    void loadFacilities();
  }, [loadFacilities]);

  useEffect(() => {
    setSelectedMandiId("");
    setRows([]);
    setPage(1);
  }, [orgId]);

  useEffect(() => setPage(1), [statusFilter, searchText, selectedMandiId]);

  const masterMap = useMemo(() => new Map(masters.map((item) => [item.facility_code, item])), [masters]);
  const mappedCodes = useMemo(() => new Set(rows.map((item) => item.facility_code)), [rows]);
  const availableMasters = useMemo(() => masters.filter((item) => !mappedCodes.has(item.facility_code)), [masters, mappedCodes]);
  const selectedMandi = mandis.find((item) => item.value === selectedMandiId);

  const filteredRows = useMemo(() => {
    const needle = searchText.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) =>
      row.facility_label.toLowerCase().includes(needle) ||
      row.facility_code.toLowerCase().includes(needle) ||
      String(row.notes || "").toLowerCase().includes(needle),
    );
  }, [rows, searchText]);

  const summary = useMemo<FacilitySummary>(() => ({
    total: rows.length,
    active: rows.filter((row) => row.is_active === "Y").length,
    inactive: rows.filter((row) => row.is_active === "N").length,
    with_capacity: rows.filter((row) => row.capacity_num !== null && row.capacity_num !== undefined).length,
  }), [rows]);

  const openCreate = () => {
    createForm.resetFields();
    setCreateOpen(true);
  };

  const handleCreateFacilityChange = (facilityCode: string) => {
    const master = masterMap.get(facilityCode);
    createForm.setFieldsValue({
      facility_code: facilityCode,
      capacity_num: master?.default_capacity_num ?? undefined,
      capacity_unit: master?.default_capacity_unit || undefined,
      notes: master?.default_notes || undefined,
    });
  };

  const handleCreate = async () => {
    if (!selectedMandiId || !orgId) return;
    const values = await createForm.validateFields();
    setCreateSubmitting(true);
    try {
      const master = masterMap.get(values.facility_code);
      const raw = await createMandiFacility({
        username,
        language,
        payload: {
          org_id: orgId,
          mandi_id: Number(selectedMandiId),
          facility_code: values.facility_code,
          facility_name_i18n: master?.name_i18n,
          ...(values.capacity_num !== undefined ? { capacity_num: values.capacity_num } : {}),
          ...(values.capacity_unit ? { capacity_unit: values.capacity_unit } : {}),
          ...(values.notes?.trim() ? { notes: values.notes.trim() } : {}),
        },
      });
      const meta = responseMeta(raw);
      if (meta.code !== "0") throw new Error(meta.description || "Unable to add facility.");
      messageApi.success("Facility added.");
      setCreateOpen(false);
      createForm.resetFields();
      await loadFacilities();
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(error?.message || "Unable to add facility.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleBulkCreate = async () => {
    if (!selectedMandiId || !orgId || !bulkSelection.length) return;
    setBulkSubmitting(true);
    try {
      const raw = await createMandiFacility({
        username,
        language,
        payload: {
          org_id: orgId,
          mandi_id: Number(selectedMandiId),
          facility_codes: bulkSelection.map(String),
        },
      });
      const meta = responseMeta(raw);
      if (meta.code !== "0") throw new Error(meta.description || "Unable to add facilities.");
      messageApi.success(`${bulkSelection.length} facility selection(s) processed.`);
      setBulkSelection([]);
      setBulkOpen(false);
      await loadFacilities();
    } catch (error: any) {
      messageApi.error(error?.message || "Unable to add facilities.");
    } finally {
      setBulkSubmitting(false);
    }
  };

  const openEdit = (row: FacilityRow) => {
    setEditRow(row);
    editForm.setFieldsValue({
      capacity_num: row.capacity_num ?? undefined,
      capacity_unit: row.capacity_unit || undefined,
      notes: row.notes || undefined,
    });
    setEditOpen(true);
  };

  const handleEdit = async () => {
    if (!selectedMandiId || !orgId || !editRow) return;
    const values = await editForm.validateFields();
    setEditSubmitting(true);
    try {
      const raw = await updateMandiFacility({
        username,
        language,
        payload: {
          org_id: orgId,
          mandi_id: Number(selectedMandiId),
          facility_code: editRow.facility_code,
          ...(values.capacity_num !== undefined ? { capacity_num: values.capacity_num } : { capacity_num: null }),
          ...(values.capacity_unit ? { capacity_unit: values.capacity_unit } : { capacity_unit: "" }),
          notes: values.notes?.trim() || "",
        },
      });
      const meta = responseMeta(raw);
      if (meta.code !== "0") throw new Error(meta.description || "Unable to update facility.");
      messageApi.success("Facility updated.");
      setEditOpen(false);
      setEditRow(null);
      await loadFacilities();
    } catch (error: any) {
      if (error?.errorFields) return;
      messageApi.error(error?.message || "Unable to update facility.");
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleToggle = async (row: FacilityRow) => {
    if (!selectedMandiId || !orgId) return;
    const nextState: StatusFlag = row.is_active === "Y" ? "N" : "Y";
    try {
      const raw = await deactivateMandiFacility({
        username,
        language,
        payload: {
          org_id: orgId,
          mandi_id: Number(selectedMandiId),
          facility_code: row.facility_code,
          is_active: nextState,
        },
      });
      const meta = responseMeta(raw);
      if (meta.code !== "0") throw new Error(meta.description || "Unable to change facility status.");
      messageApi.success(nextState === "Y" ? "Facility activated." : "Facility deactivated.");
      await loadFacilities();
    } catch (error: any) {
      messageApi.error(error?.message || "Unable to change facility status.");
    }
  };

  const columns = useMemo<TableColumnsType<FacilityRow>>(() => [
    {
      title: "Facility",
      key: "facility",
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.facility_label}</Text>
          <Text type="secondary" className="cm-facility-code">{row.facility_code}</Text>
        </Space>
      ),
    },
    {
      title: "Capacity",
      key: "capacity",
      width: 170,
      render: (_, row) => row.capacity_num !== null && row.capacity_num !== undefined
        ? `${row.capacity_num}${row.capacity_unit ? ` ${row.capacity_unit}` : ""}`
        : "—",
    },
    {
      title: "Notes",
      dataIndex: "notes",
      width: 260,
      ellipsis: true,
      render: (value) => value || "—",
    },
    {
      title: "Status",
      dataIndex: "is_active",
      width: 120,
      render: (value: StatusFlag) => value === "Y" ? <Tag color="success">Active</Tag> : <Tag>Inactive</Tag>,
    },
    {
      title: "Actions",
      key: "actions",
      width: 210,
      align: "right",
      render: (_, row) => (
        <Space>
          {canUpdate && <Button type="text" icon={<EditOutlined />} onClick={() => openEdit(row)}>Edit</Button>}
          {canDeactivate && (
            <Button type="text" danger={row.is_active === "Y"} onClick={() => void handleToggle(row)}>
              {row.is_active === "Y" ? "Deactivate" : "Activate"}
            </Button>
          )}
          {!canUpdate && !canDeactivate && <Text type="secondary">View only</Text>}
        </Space>
      ),
    },
  ], [canDeactivate, canUpdate]);

  const masterColumns = useMemo<TableColumnsType<MasterFacility>>(() => [
    {
      title: "Facility",
      key: "facility",
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row.label}</Text>
          <Text type="secondary" className="cm-facility-code">{row.facility_code}</Text>
        </Space>
      ),
    },
    {
      title: "Default capacity",
      key: "capacity",
      width: 190,
      render: (_, row) => row.default_capacity_num !== null && row.default_capacity_num !== undefined
        ? `${row.default_capacity_num}${row.default_capacity_unit ? ` ${row.default_capacity_unit}` : ""}`
        : "—",
    },
  ], []);

  const noScope = isSuper && !orgId;

  return (
    <PageContainer>
      {messageContextHolder}
      <div className="cm-mandi-facilities-page">
        <CmPageHeader
          eyebrow="MANDI OPERATIONS"
          title={t("menu.mandiFacilities", { defaultValue: "Mandi Facilities" })}
          subtitle="Configure the operational facilities available at each mandi, including capacity, units and activation status."
          actions={<Button icon={<ReloadOutlined />} onClick={() => void loadFacilities()}>Refresh</Button>}
        />

        <CmSectionCard compact className="cm-facility-scope-card">
          <Row gutter={[16, 12]} align="middle">
            <Col xs={24} lg={12}>
              <div className="cm-facility-scope-copy">
                <Text className="cm-facility-scope-kicker">WORKING SCOPE</Text>
                <Text strong className="cm-facility-scope-title">
                  {isSuper ? selectedOrg?.label || "Select an organisation" : authContext.org_code || "Organisation"}
                </Text>
                <Text type="secondary">Facilities are configured at mandi level and cannot cross the organisation or mandi scope assigned to the current role.</Text>
              </div>
            </Col>
            <Col xs={24} lg={12}>
              {isSuper ? (
                <Select
                  className="cm-facility-select"
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
                <div className="cm-facility-scope-lock">{authContext.org_code || "Organisation scope locked by role"}</div>
              )}
            </Col>
          </Row>
        </CmSectionCard>

        {noScope && <Alert type="info" showIcon message="Select an organisation to load its mandis and facilities." />}

        <Row gutter={[12, 12]}>
          <Col xs={24} sm={12} xl={6}><CmStatCard label="Configured" value={summary.total} helper={selectedMandi?.label || "Select a mandi"} icon={<AppstoreOutlined />} tone="olive" /></Col>
          <Col xs={24} sm={12} xl={6}><CmStatCard label="Active" value={summary.active} helper="Operationally available" icon={<CheckCircleOutlined />} tone="olive" /></Col>
          <Col xs={24} sm={12} xl={6}><CmStatCard label="Inactive" value={summary.inactive} helper="Retained, not deleted" icon={<StopOutlined />} tone="neutral" /></Col>
          <Col xs={24} sm={12} xl={6}><CmStatCard label="Capacity defined" value={summary.with_capacity} helper="Facilities with capacity values" icon={<ToolOutlined />} tone="amber" /></Col>
        </Row>

        <CmSectionCard compact className="cm-facility-catalogue-card">
          <div className="cm-facility-toolbar">
            <div className="cm-facility-toolbar-left">
              <Select
                className="cm-facility-select cm-facility-mandi-select"
                value={selectedMandiId || undefined}
                placeholder="Select mandi"
                showSearch
                optionFilterProp="label"
                options={mandis}
                disabled={noScope}
                onChange={(value) => setSelectedMandiId(String(value))}
              />
              <Select
                className="cm-facility-select cm-facility-status-select"
                value={statusFilter}
                options={[
                  { value: "ALL", label: "All statuses" },
                  { value: "Y", label: "Active" },
                  { value: "N", label: "Inactive" },
                ]}
                disabled={!selectedMandiId}
                onChange={(value) => setStatusFilter(value as StatusFilter)}
              />
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder="Search facility, code or notes"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
                className="cm-facility-search"
                disabled={!selectedMandiId}
              />
            </div>
            {canCreate && (
              <Space wrap>
                <Button icon={<PlusOutlined />} disabled={!selectedMandiId || !availableMasters.length} onClick={openCreate}>Add facility</Button>
                <Button type="primary" icon={<ImportOutlined />} disabled={!selectedMandiId || !availableMasters.length} onClick={() => setBulkOpen(true)}>Bulk add</Button>
              </Space>
            )}
          </div>

          {!selectedMandiId ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={noScope ? "Select an organisation first." : "Select a mandi to manage its facilities."} />
          ) : (
            <Table<FacilityRow>
              rowKey="id"
              columns={columns}
              dataSource={filteredRows}
              loading={loading}
              size="middle"
              scroll={{ x: 880 }}
              locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No facilities found for this mandi." /> }}
              pagination={{
                current: page,
                pageSize,
                total: filteredRows.length,
                showSizeChanger: true,
                pageSizeOptions: PAGE_SIZE_OPTIONS,
                showTotal: (total) => `${total} facilities`,
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
          rootClassName="cm-facility-modal"
          title={`Add facility${selectedMandi ? ` · ${selectedMandi.label}` : ""}`}
          open={createOpen}
          onCancel={() => setCreateOpen(false)}
          okText="Add facility"
          confirmLoading={createSubmitting}
          onOk={() => void handleCreate()}
          destroyOnClose
        >
          <Alert type="info" showIcon message="Choose from the protected facility master. Default capacity, unit and notes are loaded automatically when available." />
          <Form form={createForm} layout="vertical" className="cm-facility-form">
            <Form.Item name="facility_code" label="Facility" rules={[{ required: true, message: "Select a facility." }]}>
              <Select
                className="cm-facility-select"
                placeholder="Select facility"
                showSearch
                optionFilterProp="label"
                options={availableMasters.map((item) => ({ value: item.facility_code, label: item.label }))}
                onChange={handleCreateFacilityChange}
              />
            </Form.Item>
            <Row gutter={12}>
              <Col xs={24} sm={12}>
                <Form.Item name="capacity_num" label="Capacity (optional)">
                  <InputNumber min={0} precision={3} style={{ width: "100%" }} placeholder="e.g. 250" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="capacity_unit" label="Unit (optional)">
                  <Select className="cm-facility-select" allowClear placeholder="Select unit" options={units} showSearch optionFilterProp="label" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="notes" label="Notes (optional)">
              <Input.TextArea rows={3} maxLength={500} showCount placeholder="Operational notes for this mandi facility" />
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          rootClassName="cm-facility-modal"
          title={`Bulk add facilities${selectedMandi ? ` · ${selectedMandi.label}` : ""}`}
          open={bulkOpen}
          width={820}
          onCancel={() => { setBulkOpen(false); setBulkSelection([]); }}
          footer={[
            <Button key="cancel" onClick={() => { setBulkOpen(false); setBulkSelection([]); }}>Cancel</Button>,
            <Button key="add" type="primary" icon={<ImportOutlined />} loading={bulkSubmitting} disabled={!bulkSelection.length} onClick={() => void handleBulkCreate()}>
              Add selected{bulkSelection.length ? ` (${bulkSelection.length})` : ""}
            </Button>,
          ]}
        >
          <Alert type="info" showIcon message="Only facilities not yet configured for this mandi are listed." />
          <Table<MasterFacility>
            rowKey="facility_code"
            columns={masterColumns}
            dataSource={availableMasters}
            size="middle"
            scroll={{ x: 580 }}
            rowSelection={{ selectedRowKeys: bulkSelection, onChange: setBulkSelection }}
            pagination={{ pageSize: 10, showSizeChanger: true, pageSizeOptions: [10, 25, 50, 100] }}
          />
        </Modal>

        <Modal
          rootClassName="cm-facility-modal"
          title={`Edit facility${editRow ? ` · ${editRow.facility_label}` : ""}`}
          open={editOpen}
          onCancel={() => { setEditOpen(false); setEditRow(null); }}
          okText="Save changes"
          confirmLoading={editSubmitting}
          onOk={() => void handleEdit()}
          destroyOnClose
        >
          {editRow && <Paragraph type="secondary">Facility code: {editRow.facility_code}</Paragraph>}
          <Form form={editForm} layout="vertical" className="cm-facility-form">
            <Row gutter={12}>
              <Col xs={24} sm={12}>
                <Form.Item name="capacity_num" label="Capacity (optional)">
                  <InputNumber min={0} precision={3} style={{ width: "100%" }} placeholder="e.g. 250" />
                </Form.Item>
              </Col>
              <Col xs={24} sm={12}>
                <Form.Item name="capacity_unit" label="Unit (optional)">
                  <Select className="cm-facility-select" allowClear placeholder="Select unit" options={units} showSearch optionFilterProp="label" />
                </Form.Item>
              </Col>
            </Row>
            <Form.Item name="notes" label="Notes (optional)">
              <Input.TextArea rows={3} maxLength={500} showCount placeholder="Operational notes for this mandi facility" />
            </Form.Item>
          </Form>
        </Modal>
      </div>
    </PageContainer>
  );
};
