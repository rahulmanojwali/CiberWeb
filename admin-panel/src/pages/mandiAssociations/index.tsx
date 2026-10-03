import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Empty,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  LinkOutlined,
  ReloadOutlined,
  StopOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { CmStatCard } from "../../design-system/components/CmStatCard";
import { normalizeLanguageCode } from "../../config/languages";
import { fetchOrganisations } from "../../services/adminUsersApi";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import {
  fetchMandiAssociationRequests,
  updateMandiAssociationRequest,
} from "../../services/mandiAssociationsApi";
import { usePermissions } from "../../authz/usePermissions";
import "./mandiAssociations.css";

const { Text } = Typography;
const { Search, TextArea } = Input;

type StatusFlag = "REQUESTED" | "TEMP_APPROVED" | "APPROVED" | "REJECTED" | "EXPIRED" | string;

type AssociationRow = {
  id: string;
  org_id?: string | null;
  mandi_id?: number | string | null;
  party_type?: string | null;
  party_ref?: string | null;
  user_ref?: {
    username?: string | null;
    mobile?: string | null;
    walkin?: {
      name?: string | null;
      mobile?: string | null;
    } | null;
  } | null;
  walkin_name?: string | null;
  walkin_mobile?: string | null;
  status?: StatusFlag | null;
  org_name?: string | null;
  org_code?: string | null;
  mandi_name?: string | null;
  mandi_code?: string | null;
  username?: string | null;
  display_name?: string | null;
  user_name?: string | null;
  mobile?: string | null;
  requested_on?: string | null;
  created_on?: string | null;
};

type SelectOption = { value: string; label: string };

type StatusCounts = {
  REQUESTED: number;
  TEMP_APPROVED: number;
  APPROVED: number;
  REJECTED: number;
};

const DEFAULT_COUNTS: StatusCounts = {
  REQUESTED: 0,
  TEMP_APPROVED: 0,
  APPROVED: 0,
  REJECTED: 0,
};

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function statusLabel(status?: string | null) {
  const normalized = String(status || "").trim().toUpperCase();
  if (!normalized) return "Unknown";
  return normalized
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function statusTag(status?: string | null) {
  const normalized = String(status || "").trim().toUpperCase();
  if (normalized === "APPROVED") return <Tag color="success">Approved</Tag>;
  if (normalized === "TEMP_APPROVED") return <Tag color="warning">Temp approved</Tag>;
  if (normalized === "REJECTED") return <Tag color="error">Rejected</Tag>;
  if (normalized === "EXPIRED") return <Tag>Expired</Tag>;
  return <Tag color="processing">Requested</Tag>;
}

function numericFilterValue(value: string) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export const MandiAssociations: React.FC = () => {
  const { i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { can, authContext, isSuper } = usePermissions();
  const language = normalizeLanguageCode(i18n.language);

  const canView = useMemo(() => can("mandi_associations.view", "VIEW"), [can]);
  const canUpdate = useMemo(() => can("mandi_associations.update", "UPDATE"), [can]);

  const [rows, setRows] = useState<AssociationRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusCounts, setStatusCounts] = useState<StatusCounts>(DEFAULT_COUNTS);
  const [totalRecords, setTotalRecords] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [orgOptions, setOrgOptions] = useState<SelectOption[]>([]);
  const [mandiOptions, setMandiOptions] = useState<SelectOption[]>([]);

  const [orgId, setOrgId] = useState("");
  const [mandiId, setMandiId] = useState("");
  const [partyType, setPartyType] = useState("");
  const [status, setStatus] = useState("REQUESTED");
  const [mobileSearch, setMobileSearch] = useState("");
  const [appliedMobileSearch, setAppliedMobileSearch] = useState("");

  const [approveOpen, setApproveOpen] = useState(false);
  const [tempOpen, setTempOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<AssociationRow | null>(null);
  const [tempHours, setTempHours] = useState<number>(8);
  const [rejectReason, setRejectReason] = useState("");
  const [saving, setSaving] = useState(false);

  const effectiveOrgId = isSuper ? orgId : authContext.org_id || "";

  const displayUser = (row?: AssociationRow | null) =>
    row?.display_name ||
    row?.user_name ||
    row?.user_ref?.walkin?.name ||
    row?.walkin_name ||
    row?.user_ref?.username ||
    row?.party_ref ||
    "—";

  const displayUsername = (row?: AssociationRow | null) =>
    row?.username || row?.user_ref?.username || row?.party_ref || row?.mobile || "—";

  const displayMobile = (row?: AssociationRow | null) =>
    row?.mobile ||
    row?.user_ref?.mobile ||
    row?.user_ref?.walkin?.mobile ||
    row?.walkin_mobile ||
    row?.user_ref?.username ||
    row?.party_ref ||
    "—";

  const displayMandi = (row?: AssociationRow | null) =>
    row?.mandi_name || row?.mandi_code || (row?.mandi_id != null ? String(row.mandi_id) : "Unknown mandi");

  const loadOrganisations = useCallback(async () => {
    if (!isSuper) return;
    const username = currentUsername();
    if (!username) return;
    try {
      const response = await fetchOrganisations({ username, language });
      const list = response?.data?.organisations || response?.response?.data?.organisations || [];
      const options: SelectOption[] = (Array.isArray(list) ? list : []).map((org: any) => ({
        value: String(org._id || org.org_id || org.org_code || ""),
        label: org.org_name
          ? `${org.org_name}${org.org_code ? ` · ${org.org_code}` : ""}`
          : String(org.org_code || org._id || "Organisation"),
      }));
      setOrgOptions(options.filter((item) => item.value));
      if (!orgId && options.length === 1) setOrgId(options[0].value);
    } catch (error) {
      console.error("[MandiAssociations] organisation load failed", error);
      enqueueSnackbar("Unable to load organisations.", { variant: "error" });
    }
  }, [enqueueSnackbar, isSuper, language, orgId]);

  const loadMandis = useCallback(async () => {
    const username = currentUsername();
    if (!username || !effectiveOrgId) {
      setMandiOptions([]);
      setMandiId("");
      return;
    }
    try {
      const list = await getMandisForCurrentScope({
        username,
        language,
        org_id: effectiveOrgId,
        filters: { page: 1, pageSize: 200 },
      });
      const options: SelectOption[] = (Array.isArray(list) ? list : []).map((mandi: any) => ({
        value: String(mandi.mandi_id ?? mandi.id ?? mandi._id ?? mandi.mandi_code ?? ""),
        label:
          mandi.mandi_name ||
          mandi.display_name ||
          mandi.label ||
          mandi?.name_i18n?.[language] ||
          mandi?.name_i18n?.en ||
          mandi.mandi_code ||
          String(mandi.mandi_id ?? "Mandi"),
      }));
      setMandiOptions(options.filter((item) => item.value));
      if (mandiId && !options.some((item) => item.value === mandiId)) setMandiId("");
    } catch (error) {
      console.error("[MandiAssociations] mandi load failed", error);
      setMandiOptions([]);
      enqueueSnackbar("Unable to load mandis for this scope.", { variant: "error" });
    }
  }, [effectiveOrgId, enqueueSnackbar, language, mandiId]);

  const loadData = useCallback(async () => {
    const username = currentUsername();
    if (!username || !canView) return;
    if (isSuper && !effectiveOrgId) {
      setRows([]);
      setTotalRecords(0);
      setStatusCounts(DEFAULT_COUNTS);
      return;
    }

    setLoading(true);
    try {
      const response = await fetchMandiAssociationRequests({
        username,
        language,
        filters: {
          org_id: effectiveOrgId || undefined,
          mandi_id: numericFilterValue(mandiId),
          party_type: partyType || undefined,
          status: status || undefined,
          user_ref_username: appliedMobileSearch.trim() || undefined,
          page,
          page_size: pageSize,
        },
      });
      const code = response?.response?.responsecode || response?.responsecode || "1";
      const description = response?.response?.description || response?.description || "Unable to load association requests.";
      if (code !== "0") {
        setRows([]);
        setTotalRecords(0);
        enqueueSnackbar(description, { variant: "error" });
        return;
      }

      const data = response?.data || response?.response?.data || {};
      const list = Array.isArray(data.items) ? data.items : [];
      const counts = data.status_counts || {};
      setRows(list.map((item: any) => ({ id: String(item._id || item.id), ...item })));
      setTotalRecords(Number(data.total_records || 0));
      setStatusCounts({
        REQUESTED: Number(counts.REQUESTED || 0),
        TEMP_APPROVED: Number(counts.TEMP_APPROVED || 0),
        APPROVED: Number(counts.APPROVED || 0),
        REJECTED: Number(counts.REJECTED || 0),
      });
    } catch (error: any) {
      console.error("[MandiAssociations] request load failed", error);
      setRows([]);
      setTotalRecords(0);
      enqueueSnackbar(error?.message || "Unable to load association requests.", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [appliedMobileSearch, canView, effectiveOrgId, enqueueSnackbar, isSuper, language, mandiId, page, pageSize, partyType, status]);

  const updateRequest = useCallback(
    async (row: AssociationRow, extra: Record<string, any>) => {
      if (!canUpdate) return;
      const username = currentUsername();
      if (!username) return;

      setSaving(true);
      try {
        const response = await updateMandiAssociationRequest({
          username,
          language,
          request_id: row.id,
          org_id: row.org_id,
          mandi_id: row.mandi_id,
          ...extra,
        });
        const code = response?.response?.responsecode || response?.responsecode || "1";
        const description = response?.response?.description || response?.description || "Update failed.";
        if (code !== "0") {
          enqueueSnackbar(description, { variant: "error" });
          return;
        }
        enqueueSnackbar("Mandi association request updated.", { variant: "success" });
        await loadData();
      } catch (error: any) {
        enqueueSnackbar(error?.message || "Unable to update association request.", { variant: "error" });
      } finally {
        setSaving(false);
      }
    },
    [canUpdate, enqueueSnackbar, language, loadData],
  );

  const openApprove = (row: AssociationRow) => {
    setSelectedRow(row);
    setApproveOpen(true);
  };

  const openTempApprove = (row: AssociationRow) => {
    setSelectedRow(row);
    setTempHours(8);
    setTempOpen(true);
  };

  const openReject = (row: AssociationRow) => {
    setSelectedRow(row);
    setRejectReason("");
    setRejectOpen(true);
  };

  const columns = useMemo<TableColumnsType<AssociationRow>>(
    () => [
      {
        title: "Participant",
        key: "participant",
        width: 220,
        render: (_, row) => (
          <div className="cm-associations-primary-cell">
            <Text strong>{displayUser(row)}</Text>
            <Text type="secondary">{displayUsername(row)}</Text>
          </div>
        ),
      },
      {
        title: "Mobile",
        key: "mobile",
        width: 145,
        render: (_, row) => displayMobile(row),
      },
      {
        title: "Party",
        dataIndex: "party_type",
        key: "party_type",
        width: 100,
        render: (value) => <Tag>{String(value || "—")}</Tag>,
      },
      ...(isSuper
        ? [
            {
              title: "Organisation",
              key: "organisation",
              width: 190,
              render: (_: unknown, row: AssociationRow) => row.org_name || row.org_code || "—",
            },
          ]
        : []),
      {
        title: "Mandi",
        key: "mandi",
        width: 190,
        render: (_, row) => (
          <div className="cm-associations-primary-cell">
            <Text strong>{displayMandi(row)}</Text>
            {row.mandi_code ? <Text type="secondary">{row.mandi_code}</Text> : null}
          </div>
        ),
      },
      {
        title: "Requested",
        key: "requested",
        width: 180,
        render: (_, row) => formatDate(row.requested_on || row.created_on),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 130,
        render: (value) => statusTag(value),
      },
      {
        title: "Actions",
        key: "actions",
        width: 250,
        fixed: "right",
        render: (_, row) => {
          const requested = String(row.status || "").toUpperCase() === "REQUESTED";
          if (!canUpdate) return <Text type="secondary">View only</Text>;
          return (
            <Space size={6} wrap>
              <Button size="small" type="primary" disabled={!requested} onClick={() => openApprove(row)}>
                Approve
              </Button>
              <Button size="small" disabled={!requested} onClick={() => openTempApprove(row)}>
                Temp approve
              </Button>
              <Button size="small" danger disabled={!requested} onClick={() => openReject(row)}>
                Reject
              </Button>
            </Space>
          );
        },
      },
    ],
    [canUpdate, isSuper],
  );

  useEffect(() => {
    void loadOrganisations();
  }, [loadOrganisations]);

  useEffect(() => {
    void loadMandis();
  }, [loadMandis]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!canView) {
    return (
      <PageContainer className="cm-associations-page">
        <Alert type="error" showIcon message="Forbidden" description="You do not have permission to view mandi association requests." />
      </PageContainer>
    );
  }

  const scopeTitle = isSuper
    ? orgOptions.find((item) => item.value === orgId)?.label || "Select an organisation"
    : authContext.org_code || "Organisation scope";

  return (
    <PageContainer className="cm-associations-page">
      <CmPageHeader
        eyebrow="MANDI OPERATIONS"
        title="Mandi Associations"
        subtitle="Review farmer and trader requests to operate in organisation mandis, with approval actions locked to your current role scope."
        actions={
          <Button icon={<ReloadOutlined />} onClick={() => void loadData()} loading={loading}>
            Refresh
          </Button>
        }
      />

      <CmSectionCard className="cm-associations-scope-card" compact>
        <div className="cm-associations-scope-grid">
          <div>
            <Text className="cm-associations-kicker">WORKING SCOPE</Text>
            <div className="cm-associations-scope-title">{scopeTitle}</div>
            <Text type="secondary">
              Association approvals remain constrained by organisation and mandi scope enforced by the API.
            </Text>
          </div>
          {isSuper ? (
            <Select
              className="cm-associations-select"
              value={orgId || undefined}
              placeholder="Select organisation"
              options={orgOptions}
              showSearch
              optionFilterProp="label"
              onChange={(value) => {
                setOrgId(String(value || ""));
                setMandiId("");
                setPage(1);
              }}
            />
          ) : (
            <Alert type="info" showIcon message={`Organisation scope: ${authContext.org_code || authContext.org_id || "Assigned organisation"}`} />
          )}
        </div>
      </CmSectionCard>

      <div className="cm-associations-stats">
        <CmStatCard
          label="Requested"
          value={statusCounts.REQUESTED}
          helper="Awaiting decision"
          icon={<TeamOutlined />}
          onClick={() => {
            setStatus("REQUESTED");
            setPage(1);
          }}
        />
        <CmStatCard
          label="Temp approved"
          value={statusCounts.TEMP_APPROVED}
          helper="Time-limited access"
          icon={<ClockCircleOutlined />}
          tone="amber"
          onClick={() => {
            setStatus("TEMP_APPROVED");
            setPage(1);
          }}
        />
        <CmStatCard
          label="Approved"
          value={statusCounts.APPROVED}
          helper="Active mandi memberships"
          icon={<CheckCircleOutlined />}
          onClick={() => {
            setStatus("APPROVED");
            setPage(1);
          }}
        />
        <CmStatCard
          label="Rejected"
          value={statusCounts.REJECTED}
          helper="Declined requests"
          icon={<StopOutlined />}
          tone="neutral"
          onClick={() => {
            setStatus("REJECTED");
            setPage(1);
          }}
        />
      </div>

      <CmSectionCard className="cm-associations-list-card" compact>
        <div className="cm-associations-toolbar">
          <Select
            className="cm-associations-select cm-associations-filter"
            value={mandiId || undefined}
            placeholder="All mandis"
            allowClear
            options={mandiOptions}
            showSearch
            optionFilterProp="label"
            disabled={!effectiveOrgId}
            onChange={(value) => {
              setMandiId(String(value || ""));
              setPage(1);
            }}
          />
          <Select
            className="cm-associations-select cm-associations-filter"
            value={partyType || undefined}
            placeholder="All parties"
            allowClear
            options={[
              { value: "FARMER", label: "Farmer" },
              { value: "TRADER", label: "Trader" },
            ]}
            onChange={(value) => {
              setPartyType(String(value || ""));
              setPage(1);
            }}
          />
          <Select
            className="cm-associations-select cm-associations-filter"
            value={status || undefined}
            placeholder="All statuses"
            allowClear
            options={[
              { value: "REQUESTED", label: "Requested" },
              { value: "TEMP_APPROVED", label: "Temp approved" },
              { value: "APPROVED", label: "Approved" },
              { value: "REJECTED", label: "Rejected" },
              { value: "EXPIRED", label: "Expired" },
            ]}
            onChange={(value) => {
              setStatus(String(value || ""));
              setPage(1);
            }}
          />
          <Search
            className="cm-associations-search"
            value={mobileSearch}
            placeholder="Search mobile or username"
            allowClear
            enterButton="Search"
            onChange={(event) => setMobileSearch(event.target.value)}
            onSearch={(value) => {
              setAppliedMobileSearch(String(value || "").trim());
              setPage(1);
            }}
          />
        </div>

        <Table<AssociationRow>
          rowKey="id"
          columns={columns}
          dataSource={rows}
          loading={loading}
          scroll={{ x: 1180 }}
          locale={{
            emptyText: (
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  isSuper && !effectiveOrgId
                    ? "Select an organisation to review association requests."
                    : "No association requests match the current filters."
                }
              />
            ),
          }}
          pagination={{
            current: page,
            pageSize,
            total: totalRecords,
            showSizeChanger: true,
            pageSizeOptions: [20, 50, 100],
            showTotal: (total) => `${total} requests`,
            onChange: (nextPage, nextPageSize) => {
              setPage(nextPageSize !== pageSize ? 1 : nextPage);
              setPageSize(nextPageSize);
            },
          }}
        />
      </CmSectionCard>

      <Modal
        rootClassName="cm-associations-modal"
        title="Approve mandi association"
        open={approveOpen}
        onCancel={() => setApproveOpen(false)}
        okText="Approve"
        confirmLoading={saving}
        onOk={async () => {
          if (!selectedRow) return;
          await updateRequest(selectedRow, { status: "APPROVED" });
          setApproveOpen(false);
        }}
      >
        <p>
          Approve <strong>{displayUser(selectedRow)}</strong> to operate in <strong>{displayMandi(selectedRow)}</strong>?
        </p>
      </Modal>

      <Modal
        rootClassName="cm-associations-modal"
        title="Temporary approval"
        open={tempOpen}
        onCancel={() => setTempOpen(false)}
        okText="Approve temporarily"
        confirmLoading={saving}
        onOk={async () => {
          if (!selectedRow) return;
          const hours = Math.max(1, Math.min(72, Number(tempHours) || 8));
          await updateRequest(selectedRow, {
            status: "TEMP_APPROVED",
            status_note: `TEMP_APPROVED_${hours}H`,
            expires_in_hours: hours,
          });
          setTempOpen(false);
        }}
      >
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Text>Temporary access duration</Text>
          <InputNumber
            min={1}
            max={72}
            value={tempHours}
            onChange={(value) => setTempHours(Number(value || 8))}
            addonAfter="hours"
            style={{ width: "100%" }}
          />
          <Text type="secondary">Allowed range: 1–72 hours.</Text>
        </Space>
      </Modal>

      <Modal
        rootClassName="cm-associations-modal"
        title="Reject mandi association"
        open={rejectOpen}
        onCancel={() => setRejectOpen(false)}
        okText="Reject request"
        okButtonProps={{ danger: true }}
        confirmLoading={saving}
        onOk={async () => {
          if (!selectedRow) return;
          await updateRequest(selectedRow, {
            status: "REJECTED",
            decision_note: rejectReason.trim() || null,
          });
          setRejectOpen(false);
        }}
      >
        <Space direction="vertical" size={8} style={{ width: "100%" }}>
          <Text>Reason</Text>
          <TextArea
            rows={4}
            maxLength={500}
            showCount
            value={rejectReason}
            placeholder="Enter a clear rejection reason"
            onChange={(event) => setRejectReason(event.target.value)}
          />
        </Space>
      </Modal>
    </PageContainer>
  );
};

export default MandiAssociations;
