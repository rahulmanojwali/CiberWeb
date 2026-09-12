import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Avatar,
  Button,
  Card,
  Col,
  Empty,
  Row,
  Space,
  Table,
  Tag,
  Tooltip,
  Typography,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  EyeOutlined,
  LockOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  UserAddOutlined,
  UserOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";

import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSearchInput } from "../../design-system/components/CmSearchInput";
import { CmFilterPills } from "../../design-system/components/CmFilterPills";
import { usePermissions } from "../../authz/usePermissions";
import { getCurrentAdminUsername } from "../../utils/session";
import { normalizeLanguageCode } from "../../config/languages";
import { fetchAdminUsers } from "../../services/adminUsersApi";

const { Text } = Typography;

const OPERATIONAL_ROLES = [
  "GATE_OPERATOR",
  "WEIGHBRIDGE_OPERATOR",
  "AUCTIONEER",
  "YARD_SUPERVISOR",
  "LOADING_SUPERVISOR",
] as const;

type OperationalRole = (typeof OPERATIONAL_ROLES)[number];
type StationFilter = "ALL" | "GATE" | "WEIGHBRIDGE" | "AUCTION" | "YARD" | "LOADING";

type StaffRow = {
  key: string;
  username: string;
  name: string;
  initials: string;
  role: OperationalRole;
  station: string;
  status: "ACTIVE" | "INACTIVE";
  lastActive: string;
  access: string;
  raw: any;
};

const responseItems = (resp: any): any[] => {
  const data = resp?.data || resp?.response?.data || {};
  return Array.isArray(data?.items) ? data.items : [];
};

const humanize = (value: string) =>
  String(value || "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());

const roleToStation = (role: string) => {
  if (role === "GATE_OPERATOR") return "Gate";
  if (role === "WEIGHBRIDGE_OPERATOR") return "Weighbridge";
  if (role === "AUCTIONEER") return "Auction";
  if (role === "YARD_SUPERVISOR") return "Yard";
  if (role === "LOADING_SUPERVISOR") return "Loading";
  return "—";
};

const initials = (name: string) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "U").slice(0, 2);
};

const relativeTime = (value: unknown) => {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  const diffMinutes = Math.max(0, Math.floor((Date.now() - d.getTime()) / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes} min${diffMinutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

const normalizeRow = (item: any, index: number): StaffRow | null => {
  const rawRole = String(item?.role_slug || item?.role_code || (Array.isArray(item?.roles) ? item.roles[0] : "") || "").toUpperCase();
  if (!OPERATIONAL_ROLES.includes(rawRole as OperationalRole)) return null;
  const name = String(item?.display_name || item?.full_name || item?.username || "Staff Member");
  return {
    key: String(item?._id || item?.username || `${rawRole}-${index}`),
    username: String(item?.username || ""),
    name,
    initials: initials(name),
    role: rawRole as OperationalRole,
    station: roleToStation(rawRole),
    status: String(item?.is_active || "Y").toUpperCase() === "N" ? "INACTIVE" : "ACTIVE",
    lastActive: relativeTime(item?.last_login_on),
    access: "Standard",
    raw: item,
  };
};

export const MandiManagerStaff: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const { can } = usePermissions();
  const canList = can("admin_users.list", "VIEW");
  const canCreateSemantic = can("mandi_staff.create", "CREATE");

  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [station, setStation] = useState<StationFilter>("ALL");

  const load = useCallback(async () => {
    const username = getCurrentAdminUsername();
    if (!username || !canList) return;
    setLoading(true);
    setError(null);
    try {
      const calls = OPERATIONAL_ROLES.map((role) =>
        fetchAdminUsers({
          username,
          language,
          filters: { role_slug: role, page: 1, page_size: 25 },
        }),
      );
      const results = await Promise.allSettled(calls);
      const collected: StaffRow[] = [];
      results.forEach((result) => {
        if (result.status !== "fulfilled") return;
        responseItems(result.value).forEach((item, index) => {
          const normalized = normalizeRow(item, index);
          if (normalized) collected.push(normalized);
        });
      });
      const deduped = Array.from(new Map(collected.map((row) => [row.username || row.key, row])).values());
      setRows(deduped.sort((a, b) => a.name.localeCompare(b.name)));
      if (results.every((result) => result.status === "rejected")) {
        throw new Error("Unable to load operational staff.");
      }
    } catch (err: any) {
      console.error("[MandiManagerStaff] load failed", err);
      setError(err?.message || "Unable to load operational staff.");
    } finally {
      setLoading(false);
    }
  }, [canList, language]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const stationMatch = station === "ALL" || row.station.toUpperCase() === station;
      const searchMatch = !query || [row.name, row.username, row.role, row.station].some((value) => String(value).toLowerCase().includes(query));
      return stationMatch && searchMatch;
    });
  }, [rows, search, station]);

  const activeCount = rows.filter((row) => row.status === "ACTIVE").length;
  const inactiveCount = rows.filter((row) => row.status === "INACTIVE").length;
  const recentlyActive = rows.filter((row) => row.raw?.last_login_on && Date.now() - new Date(row.raw.last_login_on).getTime() <= 12 * 60 * 60 * 1000).length;

  const columns: TableColumnsType<StaffRow> = [
    {
      title: "Name",
      key: "name",
      width: 220,
      render: (_, row) => (
        <Space size={10}>
          <Avatar className="cm-staff-avatar">{row.initials}</Avatar>
          <div>
            <div className="cm-staff-name">{row.name}</div>
            <Text type="secondary" className="cm-staff-username">{row.username}</Text>
          </div>
        </Space>
      ),
    },
    { title: "Role", dataIndex: "role", key: "role", width: 190, render: (value) => humanize(value) },
    {
      title: "Assigned Station",
      dataIndex: "station",
      key: "station",
      width: 150,
      render: (value) => <Tag className={`cm-station-tag cm-station-tag--${String(value).toLowerCase()}`}>{value}</Tag>,
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 120,
      render: (value) => <Tag color={value === "ACTIVE" ? "success" : "default"}>{value === "ACTIVE" ? "Active" : "Inactive"}</Tag>,
    },
    { title: "Last Active", dataIndex: "lastActive", key: "lastActive", width: 140 },
    { title: "Access", dataIndex: "access", key: "access", width: 110, render: (value) => <Tag color="blue">{value}</Tag> },
    {
      title: "Actions",
      key: "actions",
      width: 150,
      fixed: "right",
      render: () => (
        <Space>
          <Button size="small" icon={<EyeOutlined />}>View</Button>
          <Tooltip title="Staff mutations will be enabled after the scoped mandi_staff API is enforced server-side.">
            <Button size="small" disabled icon={<LockOutlined />}>Manage</Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <PageContainer>
      <CmPageHeader
        title="Staff & Operations Team"
        subtitle="Manage and monitor operational staff within your authorised mandi scope."
        actions={(
          <Space>
            <Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>
            <Tooltip title={canCreateSemantic ? "Add operational staff" : "Requires scoped mandi_staff.create backend permission"}>
              <Button type="primary" icon={<UserAddOutlined />} disabled={!canCreateSemantic}>Add Staff</Button>
            </Tooltip>
          </Space>
        )}
      />

      {error && <Alert type="error" showIcon message={error} className="cm-page-alert" />}

      <Row gutter={[14, 14]} className="cm-staff-kpis">
        <Col xs={24} md={8}>
          <Card className="cm-staff-kpi-card">
            <div className="cm-staff-kpi-icon"><TeamOutlined /></div>
            <div><Text type="secondary">Active Staff</Text><div className="cm-staff-kpi-value">{activeCount}</div><Text type="secondary">Out of {rows.length} loaded staff</Text></div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="cm-staff-kpi-card">
            <div className="cm-staff-kpi-icon"><UserOutlined /></div>
            <div><Text type="secondary">Recently Active</Text><div className="cm-staff-kpi-value">{recentlyActive}</div><Text type="secondary">Activity in the last 12 hours</Text></div>
          </Card>
        </Col>
        <Col xs={24} md={8}>
          <Card className="cm-staff-kpi-card cm-staff-kpi-card--attention">
            <div className="cm-staff-kpi-icon"><SafetyCertificateOutlined /></div>
            <div><Text type="secondary">Inactive / Attention</Text><div className="cm-staff-kpi-value">{inactiveCount}</div><Text type="secondary">Require administrator review</Text></div>
          </Card>
        </Col>
      </Row>

      <Card className="cm-staff-table-card">
        <div className="cm-staff-toolbar">
          <div className="cm-staff-toolbar__filters">
            <Text strong>Filter by Station:</Text>
            <CmFilterPills
              value={station}
              onChange={(value) => setStation(value as StationFilter)}
              options={[
                { label: "All", value: "ALL" },
                { label: "Gate", value: "GATE" },
                { label: "Weighbridge", value: "WEIGHBRIDGE" },
                { label: "Auction", value: "AUCTION" },
                { label: "Yard", value: "YARD" },
                { label: "Loading", value: "LOADING" },
              ]}
            />
          </div>
          <CmSearchInput value={search} onChange={setSearch} placeholder="Search staff by name, role or station…" width={340} />
        </div>

        <Table<StaffRow>
          rowKey="key"
          columns={columns}
          dataSource={filteredRows}
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{ pageSize: 10, showSizeChanger: false, showTotal: (total) => `${total} staff member${total === 1 ? "" : "s"}` }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No operational staff found in this scope" /> }}
          className="cm-premium-table"
        />
      </Card>

      <Alert
        className="cm-staff-security-note"
        type="warning"
        showIcon
        icon={<LockOutlined />}
        message="Managers cannot create peer or higher administrative roles."
        description="Only operational roles are valid here: Gate Operator, Weighbridge Operator, Auctioneer, Yard Supervisor and Loading Supervisor. Mutation controls remain locked until the scoped server-side mandi_staff API is enforced."
      />
    </PageContainer>
  );
};

export default MandiManagerStaff;
