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
type DirectoryRow = Record<string, any>;

type Props = {
  title: string;
  subtitle: string;
  partyLabel: "Trader" | "Farmer";
  idField: "trader_id" | "farmer_id";
  resourcePrefix: "traders" | "farmers";
  language: string;
  getData: (args: { username: string; language: string; filters: Record<string, any> }) => Promise<any>;
  updateStatus: (args: { username: string; language: string; payload: Record<string, any> }) => Promise<any>;
};

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch { return null; }
}

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true });
}

function membershipTag(value: unknown) {
  const status = String(value || "REGISTERED").toUpperCase();
  const color = status === "APPROVED" ? "green" : status === "REJECTED" ? "red" : status === "MORE_INFO" ? "gold" : "blue";
  return <Tag color={color}>{status.replace(/_/g, " ")}</Tag>;
}

export const ParticipantDirectoryPage: React.FC<Props> = ({ title, subtitle, partyLabel, idField, resourcePrefix, language, getData, updateStatus }) => {
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();
  const isSuperAdmin = uiConfig.role === "SUPER_ADMIN";
  const canList = can(`${resourcePrefix}.list`, "VIEW");
  const canUpdate = can(`${resourcePrefix}.update_status`, "UPDATE");
  const [rows, setRows] = React.useState<DirectoryRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);
  const [total, setTotal] = React.useState(0);
  const [orgOptions, setOrgOptions] = React.useState<Option[]>([]);
  const [mandiOptions, setMandiOptions] = React.useState<Option[]>([]);
  const [selected, setSelected] = React.useState<DirectoryRow | null>(null);
  const [filters, setFilters] = React.useState({
    org_id: isSuperAdmin ? "ALL" : String(uiConfig.scope?.org_id || ""),
    mandi_id: "",
    status: "ALL",
    identity: "",
  });

  const effectiveOrgId = isSuperAdmin && filters.org_id === "ALL" ? "" : filters.org_id || String(uiConfig.scope?.org_id || "");

  const loadOrgs = React.useCallback(async () => {
    const username = currentUsername(); if (!username) return;
    try {
      const resp = await fetchOrganisations({ username, language });
      const data = resp?.data || resp?.response?.data || {};
      const list = data?.items || data?.rows || data?.organisations || [];
      setOrgOptions((Array.isArray(list) ? list : []).map((org: any) => ({ value: String(org.org_id || org._id || org.org_code || ""), label: org.org_name || org.name || org.org_code || String(org._id || "") })).filter((o: Option) => o.value));
    } catch { /* row data still contains organisation labels */ }
  }, [language]);

  const loadMandis = React.useCallback(async () => {
    const username = currentUsername();
    if (!username || !effectiveOrgId) { setMandiOptions([]); return; }
    try {
      const list = await getMandisForCurrentScope({ username, language, org_id: effectiveOrgId });
      setMandiOptions((list || []).map((m: any) => ({ value: String(m.mandi_id ?? m.mandiId ?? ""), label: m.mandi_name || m.label || m?.name_i18n?.en || m.mandi_slug || String(m.mandi_id || "") })).filter((o: Option) => o.value));
    } catch { setMandiOptions([]); }
  }, [effectiveOrgId, language]);

  const loadData = React.useCallback(async () => {
    const username = currentUsername(); if (!username || !canList) return;
    setLoading(true); setError(null);
    try {
      const resp = await getData({ username, language, filters: {
        org_id: effectiveOrgId || undefined,
        mandi_id: filters.mandi_id || undefined,
        status: filters.status === "ALL" ? undefined : filters.status,
        [idField]: filters.identity.trim() || undefined,
        page,
        page_size: pageSize,
      }});
      const response = resp?.response || {};
      if (String(response.responsecode ?? "0") !== "0") throw new Error(response.description || `Unable to load ${partyLabel.toLowerCase()} directory.`);
      const data = resp?.data || response?.data || {};
      const list = data?.items || data?.rows || [];
      setRows(Array.isArray(list) ? list : []);
      setTotal(Number(data?.total_records || 0));
    } catch (e: any) {
      setRows([]); setTotal(0); setError(e?.message || `Unable to load ${partyLabel.toLowerCase()} directory.`);
    } finally { setLoading(false); }
  }, [canList, effectiveOrgId, filters.identity, filters.mandi_id, filters.status, getData, idField, language, page, pageSize, partyLabel]);

  React.useEffect(() => { loadOrgs(); }, [loadOrgs]);
  React.useEffect(() => { loadMandis(); }, [loadMandis]);
  React.useEffect(() => { loadData(); }, [loadData]);

  const changeAccountStatus = (row: DirectoryRow, nextStatus: "ACTIVE" | "INACTIVE") => {
    Modal.confirm({
      title: `${nextStatus === "ACTIVE" ? "Activate" : "Deactivate"} ${partyLabel} Account`,
      content: `${row.name || row[idField] || "This participant"} will be ${nextStatus.toLowerCase()}. This changes the account status, not the membership approval history.`,
      okText: nextStatus === "ACTIVE" ? "Activate" : "Deactivate",
      okButtonProps: { danger: nextStatus === "INACTIVE" },
      onOk: async () => {
        const username = currentUsername(); if (!username) return;
        await updateStatus({ username, language, payload: { [idField]: row[idField], status: nextStatus, org_id: row.org_id || effectiveOrgId || undefined } });
        await loadData();
      },
    });
  };

  const columns = React.useMemo<TableColumnsType<DirectoryRow>>(() => [
    { title: partyLabel, key: "name", width: 200, render: (_, r) => <Space direction="vertical" size={0}><Text strong>{r.name || r.display_name || r[idField] || "—"}</Text><Text type="secondary">{r[idField] || "—"}</Text></Space> },
    { title: "Mobile", dataIndex: "mobile", width: 140, render: (v) => v || "—" },
    { title: "Organisation", key: "org", width: 190, render: (_, r) => r.org_name || r.org_code || "—" },
    { title: "Mandi", key: "mandi", width: 210, render: (_, r) => Array.isArray(r.mandi_names) && r.mandi_names.length ? <Space size={[0, 4]} wrap>{r.mandi_names.slice(0, 3).map((name: string) => <Tag key={name}>{name}</Tag>)}{r.mandi_names.length > 3 && <Tag>+{r.mandi_names.length - 3}</Tag>}</Space> : r.mandi_name || "—" },
    { title: "Membership", key: "membership", width: 130, render: (_, r) => membershipTag(r.approval_status || r.status) },
    { title: "Account", key: "account", width: 115, render: (_, r) => <Tag color={String(r.account_status).toUpperCase() === "ACTIVE" ? "green" : "default"}>{String(r.account_status || "INACTIVE").toUpperCase()}</Tag> },
    { title: "Updated", dataIndex: "updated_on", width: 165, render: (v) => formatDate(v) },
    { title: "Actions", key: "actions", fixed: "right", width: 180, render: (_, r) => <Space size={4}><Button size="small" onClick={() => setSelected(r)}>View</Button>{canUpdate && (String(r.account_status).toUpperCase() === "ACTIVE" ? <Button danger size="small" onClick={() => changeAccountStatus(r, "INACTIVE")}>Deactivate</Button> : <Button size="small" type="primary" onClick={() => changeAccountStatus(r, "ACTIVE")}>Activate</Button>)}</Space> },
  ], [canUpdate, idField, partyLabel]);

  return <PageContainer title={title} subtitle={subtitle} actions={<Button icon={<ReloadOutlined />} onClick={loadData}>Refresh</Button>}>
    <div className="cm-participant-page">
    {!canList && <Alert type="warning" showIcon message={`You do not have permission to view ${title.toLowerCase()}.`} />}
    {error && <Alert type="error" showIcon closable message={error} onClose={() => setError(null)} style={{ marginBottom: 12 }} />}
    <Card size="small" className="cm-participant-filter-card" style={{ marginBottom: 12 }}>
      <Row gutter={[10, 10]}>
        <Col xs={24} sm={12} lg={5}><ParticipantFilterDropdown value={filters.org_id || undefined} disabled={!isSuperAdmin} options={[...(isSuperAdmin ? [{ value: "ALL", label: "All Organisations" }] : []), ...orgOptions]} placeholder="Organisation" onChange={(v) => { setFilters((f) => ({ ...f, org_id: v, mandi_id: "" })); setPage(1); }} /></Col>
        <Col xs={24} sm={12} lg={5}><ParticipantFilterDropdown value={filters.mandi_id || undefined} allowClear clearLabel="All Mandis" options={mandiOptions} placeholder="All Mandis" onChange={(v) => { setFilters((f) => ({ ...f, mandi_id: v })); setPage(1); }} /></Col>
        <Col xs={24} sm={12} lg={4}><ParticipantFilterDropdown value={filters.status} options={[
          { value: "ALL", label: "All Statuses" }, { value: "APPROVED", label: "Approved membership" }, { value: "PENDING", label: "Pending membership" }, { value: "ACTIVE", label: "Active account" }, { value: "INACTIVE", label: "Inactive account" },
        ]} placeholder="Status" onChange={(v) => { setFilters((f) => ({ ...f, status: v })); setPage(1); }} /></Col>
        <Col xs={24} sm={12} lg={7}><Input className="cm-participant-search-input" value={filters.identity} onChange={(e) => setFilters((f) => ({ ...f, identity: e.target.value }))} onPressEnter={() => { setPage(1); loadData(); }} placeholder={`Search ${partyLabel.toLowerCase()} name, username or mobile`} /></Col>
        <Col xs={24} lg={3}><Button className="cm-participant-search-button" type="primary" block onClick={() => { setPage(1); loadData(); }}>Search</Button></Col>
      </Row>
    </Card>
    <Card size="small" className="cm-participant-table-card">
      <Table<DirectoryRow> rowKey={(r) => String(r._id || `${r[idField]}-${r.org_id || ""}`)} columns={columns} dataSource={rows} loading={loading} scroll={{ x: 1240 }} locale={{ emptyText: loading ? "Loading…" : `No ${partyLabel.toLowerCase()} memberships found.` }} pagination={{ current: page, pageSize, total, showSizeChanger: true, pageSizeOptions: [25, 50, 100], showTotal: (v) => `${v} records`, onChange: (p, s) => { setPage(p); if (s !== pageSize) { setPageSize(s); setPage(1); } } }} />
    </Card>
    <Modal className="cm-participant-modal" title={`${partyLabel} Details`} open={Boolean(selected)} onCancel={() => setSelected(null)} footer={<Button onClick={() => setSelected(null)}>Close</Button>} width={720}>
      <Descriptions bordered size="small" column={1}>
        <Descriptions.Item label={`${partyLabel} name`}>{selected?.name || "—"}</Descriptions.Item>
        <Descriptions.Item label={`${partyLabel} username`}>{selected?.[idField] || "—"}</Descriptions.Item>
        <Descriptions.Item label="Mobile">{selected?.mobile || "—"}</Descriptions.Item>
        <Descriptions.Item label="Organisation">{selected?.org_name || selected?.org_code || "—"}</Descriptions.Item>
        <Descriptions.Item label="Mandis">{Array.isArray(selected?.mandi_names) && selected.mandi_names.length ? selected.mandi_names.join(", ") : selected?.mandi_name || "—"}</Descriptions.Item>
        <Descriptions.Item label="Membership">{membershipTag(selected?.approval_status || selected?.status)}</Descriptions.Item>
        <Descriptions.Item label="Account"><Tag color={String(selected?.account_status).toUpperCase() === "ACTIVE" ? "green" : "default"}>{String(selected?.account_status || "INACTIVE").toUpperCase()}</Tag></Descriptions.Item>
        <Descriptions.Item label="Created on">{formatDate(selected?.created_on)}</Descriptions.Item>
        <Descriptions.Item label="Updated on">{formatDate(selected?.updated_on)}</Descriptions.Item>
      </Descriptions>
    </Modal>
    </div>
  </PageContainer>;
};
