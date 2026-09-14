import React from "react";
import "./participants.css";
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Input,
  Modal,
  Row,
  Space,
  Table,
  Tag,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { PageContainer } from "../PageContainer";
import { ParticipantFilterDropdown } from "./ParticipantFilterDropdown";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { usePermissions } from "../../authz/usePermissions";
import { getMandisForCurrentScope } from "../../services/mandiApi";
import { fetchOrganisations } from "../../services/adminUsersApi";

const { Text } = Typography;

type Option = { value: string; label: string };

type ApprovalRow = Record<string, any> & { _id?: string; org_id?: string; mandi_id?: string | number };

type ApprovalApi = {
  list: (args: { username: string; language: string; filters: Record<string, any> }) => Promise<any>;
  approve: (args: { username: string; language: string; row: ApprovalRow; mandiId: string }) => Promise<any>;
  reject: (args: { username: string; language: string; row: ApprovalRow; mandiId: string; reason: string }) => Promise<any>;
  requestInfo: (args: { username: string; language: string; row: ApprovalRow; mandiId: string; reason: string }) => Promise<any>;
};

type Props = {
  title: string;
  subtitle: string;
  partyLabel: "Trader" | "Farmer";
  usernameField: "trader_username" | "farmer_username";
  nameField: "trader_name" | "farmer_name";
  resourcePrefix: "trader_approvals" | "farmer_approvals";
  language: string;
  api: ApprovalApi;
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
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function statusTag(value: unknown) {
  const status = String(value || "PENDING").toUpperCase();
  const color = status === "APPROVED" ? "green" : status === "REJECTED" ? "red" : status === "MORE_INFO" ? "gold" : "blue";
  return <Tag color={color}>{status.replace(/_/g, " ")}</Tag>;
}

export const ParticipantApprovalPage: React.FC<Props> = ({
  title,
  subtitle,
  partyLabel,
  usernameField,
  nameField,
  resourcePrefix,
  language,
  api,
}) => {
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();
  const isSuperAdmin = uiConfig.role === "SUPER_ADMIN";

  const canList = can(`${resourcePrefix}.list`, "VIEW");
  const canApprove = can(`${resourcePrefix}.approve`, "APPROVE");
  const canReject = can(`${resourcePrefix}.reject`, "REJECT");
  const canRequestInfo = can(`${resourcePrefix}.request_more_info`, "REQUEST_MORE_INFO");

  const [rows, setRows] = React.useState<ApprovalRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [orgOptions, setOrgOptions] = React.useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = React.useState<Option[]>([]);
  const [filters, setFilters] = React.useState({
    status: "PENDING",
    org_id: isSuperAdmin ? "ALL" : String(uiConfig.scope?.org_id || ""),
    mandi_id: "",
    identity: "",
  });
  const [selected, setSelected] = React.useState<ApprovalRow | null>(null);
  const [viewOpen, setViewOpen] = React.useState(false);
  const [actionMode, setActionMode] = React.useState<"APPROVE" | "REJECT" | "INFO" | null>(null);
  const [reason, setReason] = React.useState("");
  const [selectedMandiId, setSelectedMandiId] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  const loadOrgs = React.useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    try {
      const resp = await fetchOrganisations({ username, language });
      const data = resp?.data || resp?.response?.data || {};
      const list = data?.items || data?.rows || data?.organisations || [];
      const options = (Array.isArray(list) ? list : []).map((org: any) => ({
        value: String(org.org_id || org._id || org.org_code || ""),
        label: org.org_name || org.name || org.org_code || String(org._id || ""),
      })).filter((o: Option) => o.value);
      setOrgOptions(options);
    } catch {
      // Listing remains usable because rows also carry organisation names.
    }
  }, [language]);

  const effectiveOrgId = isSuperAdmin && filters.org_id === "ALL" ? "" : filters.org_id || String(uiConfig.scope?.org_id || "");

  const loadMandis = React.useCallback(async () => {
    const username = currentUsername();
    if (!username || !effectiveOrgId) {
      setMandiOptions([]);
      return;
    }
    try {
      const list = await getMandisForCurrentScope({ username, language, org_id: effectiveOrgId });
      setMandiOptions((list || []).map((m: any) => ({
        value: String(m.mandi_id ?? m.mandiId ?? ""),
        label: m.mandi_name || m.label || m?.name_i18n?.en || m.mandi_slug || String(m.mandi_id || ""),
      })).filter((o: Option) => o.value));
    } catch {
      setMandiOptions([]);
    }
  }, [effectiveOrgId, language]);

  const loadData = React.useCallback(async () => {
    const username = currentUsername();
    if (!username || !canList) return;
    setLoading(true);
    setError(null);
    try {
      const resp = await api.list({
        username,
        language,
        filters: {
          org_id: effectiveOrgId || undefined,
          mandi_id: filters.mandi_id || undefined,
          mandi_approval_status: filters.status === "ALL" ? undefined : filters.status,
          [usernameField]: filters.identity.trim() || undefined,
          page,
          limit: pageSize,
        },
      });
      const response = resp?.response || {};
      if (String(response.responsecode ?? "0") !== "0") throw new Error(response.description || "Unable to load approval requests.");
      const data = resp?.data || response?.data || {};
      const nextRows = data?.items || data?.rows || [];
      setRows(Array.isArray(nextRows) ? nextRows : []);
      setTotal(Number(data?.total_records || 0));
    } catch (e: any) {
      setRows([]);
      setTotal(0);
      setError(e?.message || "Unable to load approval requests.");
    } finally {
      setLoading(false);
    }
  }, [api, canList, effectiveOrgId, filters.identity, filters.mandi_id, filters.status, language, page, pageSize, usernameField]);

  React.useEffect(() => { loadOrgs(); }, [loadOrgs]);
  React.useEffect(() => { loadMandis(); }, [loadMandis]);
  React.useEffect(() => { loadData(); }, [loadData]);

  const openAction = (mode: "APPROVE" | "REJECT" | "INFO", row: ApprovalRow) => {
    setSelected(row);
    setSelectedMandiId(String(row.mandi_id ?? ""));
    setReason("");
    setActionMode(mode);
  };

  const submitAction = async () => {
    const username = currentUsername();
    if (!username || !selected || !actionMode || !selectedMandiId) return;
    if ((actionMode === "REJECT" || actionMode === "INFO") && !reason.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      if (actionMode === "APPROVE") await api.approve({ username, language, row: selected, mandiId: selectedMandiId });
      if (actionMode === "REJECT") await api.reject({ username, language, row: selected, mandiId: selectedMandiId, reason: reason.trim() });
      if (actionMode === "INFO") await api.requestInfo({ username, language, row: selected, mandiId: selectedMandiId, reason: reason.trim() });
      setActionMode(null);
      setSelected(null);
      await loadData();
    } catch (e: any) {
      setError(e?.message || "Action could not be completed.");
    } finally {
      setSubmitting(false);
    }
  };

  const columns = React.useMemo<TableColumnsType<ApprovalRow>>(() => [
    {
      title: partyLabel,
      key: "party",
      width: 210,
      render: (_, row) => (
        <Space direction="vertical" size={0}>
          <Text strong>{row[nameField] || row[usernameField] || "—"}</Text>
          <Text type="secondary">{row[usernameField] || "—"}</Text>
        </Space>
      ),
    },
    { title: "Organisation", key: "org", width: 190, render: (_, row) => row.org_name || orgOptions.find((o) => o.value === String(row.org_id || ""))?.label || "—" },
    { title: "Mandi", key: "mandi", width: 190, render: (_, row) => row.mandi_name || mandiOptions.find((o) => o.value === String(row.mandi_id || ""))?.label || "—" },
    { title: "Status", key: "status", width: 130, render: (_, row) => statusTag(row.mandi_approval_status || row.approval_status) },
    { title: "Requested On", dataIndex: "requested_on", width: 175, render: (v) => formatDate(v) },
    {
      title: "Actions",
      key: "actions",
      fixed: "right",
      width: 250,
      render: (_, row) => (
        <Space wrap size={4}>
          <Button size="small" onClick={() => { setSelected(row); setViewOpen(true); }}>View</Button>
          {canApprove && <Button size="small" type="primary" onClick={() => openAction("APPROVE", row)}>Approve</Button>}
          {canRequestInfo && <Button size="small" onClick={() => openAction("INFO", row)}>More info</Button>}
          {canReject && <Button size="small" danger onClick={() => openAction("REJECT", row)}>Reject</Button>}
        </Space>
      ),
    },
  ], [canApprove, canReject, canRequestInfo, mandiOptions, nameField, orgOptions, partyLabel, usernameField]);

  return (
    <PageContainer title={title} subtitle={subtitle} actions={<Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>}>
      <div className="cm-participant-page">
      {!canList && <Alert type="warning" showIcon message={`You do not have permission to view ${title.toLowerCase()}.`} />}
      {error && <Alert type="error" showIcon closable message={error} onClose={() => setError(null)} style={{ marginBottom: 12 }} />}
      <Card size="small" className="cm-participant-filter-card" style={{ marginBottom: 12 }}>
        <Row gutter={[10, 10]}>
          <Col xs={24} sm={12} lg={5}>
            <ParticipantFilterDropdown
              value={filters.org_id || undefined}
              disabled={!isSuperAdmin}
              options={[...(isSuperAdmin ? [{ value: "ALL", label: "All Organisations" }] : []), ...orgOptions]}
              placeholder="Organisation"
              onChange={(v) => { setFilters((f) => ({ ...f, org_id: v, mandi_id: "" })); setPage(1); }}
            />
          </Col>
          <Col xs={24} sm={12} lg={5}>
            <ParticipantFilterDropdown value={filters.mandi_id || undefined} allowClear clearLabel="All Mandis" options={mandiOptions} placeholder="All Mandis" onChange={(v) => { setFilters((f) => ({ ...f, mandi_id: v })); setPage(1); }} />
          </Col>
          <Col xs={24} sm={12} lg={4}>
            <ParticipantFilterDropdown value={filters.status} options={[
              { value: "ALL", label: "All Statuses" },
              { value: "PENDING", label: "Pending" },
              { value: "MORE_INFO", label: "More Info" },
              { value: "APPROVED", label: "Approved" },
              { value: "REJECTED", label: "Rejected" },
            ]} placeholder="Status" onChange={(v) => { setFilters((f) => ({ ...f, status: v })); setPage(1); }} />
          </Col>
          <Col xs={24} sm={12} lg={7}>
            <Input className="cm-participant-search-input" value={filters.identity} onChange={(e) => setFilters((f) => ({ ...f, identity: e.target.value }))} onPressEnter={() => { setPage(1); loadData(); }} placeholder={`Search ${partyLabel.toLowerCase()} username`} />
          </Col>
          <Col xs={24} lg={3}><Button className="cm-participant-search-button" type="primary" block onClick={() => { setPage(1); loadData(); }}>Search</Button></Col>
        </Row>
      </Card>

      <Card size="small" className="cm-participant-table-card">
        <Table<ApprovalRow>
          rowKey={(row) => String(row._id || `${row[usernameField]}-${row.mandi_id || ""}`)}
          columns={columns}
          dataSource={rows}
          loading={loading}
          scroll={{ x: 1180 }}
          locale={{ emptyText: loading ? "Loading…" : "No approval requests found." }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            pageSizeOptions: [25, 50, 100],
            showTotal: (value) => `${value} records`,
            onChange: (nextPage, nextSize) => { setPage(nextPage); if (nextSize !== pageSize) { setPageSize(nextSize); setPage(1); } },
          }}
        />
      </Card>

      <Modal className="cm-participant-modal" title={`${partyLabel} Membership Request`} open={viewOpen} onCancel={() => setViewOpen(false)} footer={<Button onClick={() => setViewOpen(false)}>Close</Button>} width={720}>
        <Descriptions bordered size="small" column={1}>
          <Descriptions.Item label={`${partyLabel} name`}>{selected?.[nameField] || "—"}</Descriptions.Item>
          <Descriptions.Item label={`${partyLabel} username`}>{selected?.[usernameField] || "—"}</Descriptions.Item>
          <Descriptions.Item label="Organisation">{selected?.org_name || "—"}</Descriptions.Item>
          <Descriptions.Item label="Mandi">{selected?.mandi_name || "—"}</Descriptions.Item>
          <Descriptions.Item label="Status">{statusTag(selected?.mandi_approval_status || selected?.approval_status)}</Descriptions.Item>
          <Descriptions.Item label="Requested on">{formatDate(selected?.requested_on)}</Descriptions.Item>
          <Descriptions.Item label="More-info reason">{selected?.request_more_info_reason || "—"}</Descriptions.Item>
          <Descriptions.Item label="Rejection reason">{selected?.rejection_reason || "—"}</Descriptions.Item>
        </Descriptions>
      </Modal>

      <Modal
        className="cm-participant-modal"
        title={actionMode === "APPROVE" ? `Approve ${partyLabel} Membership` : actionMode === "REJECT" ? `Reject ${partyLabel} Membership` : `Request More Information`}
        open={Boolean(actionMode)}
        onCancel={() => setActionMode(null)}
        confirmLoading={submitting}
        onOk={submitAction}
        okButtonProps={{ disabled: !selectedMandiId || ((actionMode === "REJECT" || actionMode === "INFO") && !reason.trim()), danger: actionMode === "REJECT" }}
        okText={actionMode === "APPROVE" ? "Approve" : actionMode === "REJECT" ? "Reject" : "Send Request"}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Text>{selected?.[nameField] || selected?.[usernameField]}</Text>
          <ParticipantFilterDropdown value={selectedMandiId || undefined} onChange={setSelectedMandiId} options={mandiOptions.length ? mandiOptions : selected?.mandi_id ? [{ value: String(selected.mandi_id), label: selected.mandi_name || String(selected.mandi_id) }] : []} placeholder="Select Mandi" />
          {(actionMode === "REJECT" || actionMode === "INFO") && <Input.TextArea className="cm-participant-textarea" rows={4} maxLength={500} showCount value={reason} onChange={(e) => setReason(e.target.value)} placeholder={actionMode === "REJECT" ? "Reason for rejection" : "Information required from participant"} />}
        </Space>
      </Modal>
      </div>
    </PageContainer>
  );
};
