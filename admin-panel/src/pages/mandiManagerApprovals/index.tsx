import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Empty,
  Input,
  Modal,
  Row,
  Space,
  Table,
  Tag,
  Typography,
  message,
} from "antd";
import type { TableColumnsType } from "antd";
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  EyeOutlined,
  InfoCircleOutlined,
  ReloadOutlined,
  ShopOutlined,
  SyncOutlined,
  TeamOutlined,
  WarningOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";

import { PageContainer } from "../../components/PageContainer";
import { CmPageHeader } from "../../design-system/components/CmPageHeader";
import { CmSectionCard } from "../../design-system/components/CmSectionCard";
import { CmSearchInput } from "../../design-system/components/CmSearchInput";
import { CmFilterPills } from "../../design-system/components/CmFilterPills";
import { usePermissions } from "../../authz/usePermissions";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { normalizeLanguageCode } from "../../config/languages";
import { getCurrentAdminUsername } from "../../utils/session";
import {
  approveFarmerForMandis,
  listFarmerApprovalRequests,
  rejectFarmerApproval,
  requestMoreInfoFarmer,
} from "../../services/farmerApprovalsApi";
import {
  approveTrader,
  getTraderApprovals,
  rejectTrader,
  requestMoreInfoForTrader,
} from "../../services/traderApprovalsApi";

const { Text, Title } = Typography;

type ApprovalKind = "FARMER" | "TRADER";
type ApprovalBucket = "PENDING" | "IN_REVIEW" | "COMPLETED";

type ApprovalRow = {
  key: string;
  kind: ApprovalKind;
  username: string;
  name: string;
  reference: string;
  mandiId: string;
  mandiName: string;
  orgId: string;
  status: string;
  submittedOn: string;
  raw: any;
};

const getItems = (resp: any) => {
  const data = resp?.data || resp?.response?.data || {};
  return Array.isArray(data?.items) ? data.items : Array.isArray(data?.rows) ? data.rows : [];
};

const getTotal = (resp: any, fallback = 0) => {
  const data = resp?.data || resp?.response?.data || {};
  const total = Number(data?.total_records ?? data?.total ?? fallback);
  return Number.isFinite(total) ? total : fallback;
};

const fmtDate = (value: unknown) => {
  if (!value) return "—";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
};

const normalizeStatus = (value: unknown) => String(value || "PENDING").toUpperCase();

const bucketToApiStatus = (bucket: ApprovalBucket) => {
  if (bucket === "PENDING") return "PENDING";
  if (bucket === "IN_REVIEW") return "MORE_INFO";
  return undefined;
};

const isCompleted = (status: string) => ["APPROVED", "REJECTED", "LINKED", "UNLINKED"].includes(normalizeStatus(status));

const statusColor = (status: string) => {
  const s = normalizeStatus(status);
  if (["APPROVED", "LINKED"].includes(s)) return "success";
  if (["REJECTED"].includes(s)) return "error";
  if (["MORE_INFO", "IN_REVIEW"].includes(s)) return "processing";
  return "warning";
};

const statusLabel = (status: string) => {
  const s = normalizeStatus(status);
  if (s === "MORE_INFO") return "More Info";
  return s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase());
};

const toFarmerRow = (item: any, index: number): ApprovalRow => ({
  key: String(item?._id || item?.membership_id || item?.farmer_username || `farmer-${index}`),
  kind: "FARMER",
  username: String(item?.farmer_username || item?.username || ""),
  name: String(item?.farmer_name || item?.display_name || item?.name || item?.farmer_username || "—"),
  reference: String(item?.request_id || item?.membership_id || item?._id || item?.farmer_username || "—"),
  mandiId: String(item?.mandi_id ?? ""),
  mandiName: String(item?.mandi_name || item?.mandi_slug || item?.mandi_id || "—"),
  orgId: String(item?.org_id || ""),
  status: String(item?.mandi_approval_status || item?.status || "PENDING"),
  submittedOn: String(item?.requested_on || item?.created_on || item?.updated_on || ""),
  raw: item,
});

const toTraderRow = (item: any, index: number): ApprovalRow => ({
  key: String(item?._id || item?.membership_id || item?.trader_username || `trader-${index}`),
  kind: "TRADER",
  username: String(item?.trader_username || item?.username || ""),
  name: String(item?.trader_name || item?.display_name || item?.name || item?.trader_username || "—"),
  reference: String(item?.request_id || item?.membership_id || item?._id || item?.trader_username || "—"),
  mandiId: String(item?.mandi_id ?? ""),
  mandiName: String(item?.mandi_name || item?.mandi_slug || item?.mandi_id || "—"),
  orgId: String(item?.org_id || ""),
  status: String(item?.mandi_approval_status || item?.status || "PENDING"),
  submittedOn: String(item?.requested_on || item?.created_on || item?.updated_on || ""),
  raw: item,
});

export const MandiManagerApprovals: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const { can } = usePermissions();

  const canFarmerList = can("farmer_approvals.list", "VIEW");
  const canTraderList = can("trader_approvals.list", "VIEW");
  const canFarmerApprove = can("farmer_approvals.approve", "APPROVE");
  const canFarmerReject = can("farmer_approvals.reject", "REJECT");
  const canFarmerInfo = can("farmer_approvals.request_more_info", "REQUEST_MORE_INFO");
  const canTraderApprove = can("trader_approvals.approve", "APPROVE");
  const canTraderReject = can("trader_approvals.reject", "REJECT");
  const canTraderInfo = can("trader_approvals.request_more_info", "REQUEST_MORE_INFO");

  const [bucket, setBucket] = useState<ApprovalBucket>("PENDING");
  const [rows, setRows] = useState<ApprovalRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [farmerTotal, setFarmerTotal] = useState(0);
  const [traderTotal, setTraderTotal] = useState(0);
  const [selected, setSelected] = useState<ApprovalRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [reasonOpen, setReasonOpen] = useState<"INFO" | "REJECT" | null>(null);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;

    setLoading(true);
    setError(null);
    const apiStatus = bucketToApiStatus(bucket);
    const orgId = String(uiConfig.scope?.org_id || "");

    try {
      const [farmerResult, traderResult] = await Promise.allSettled([
        canFarmerList
          ? listFarmerApprovalRequests({
              username,
              language,
              filters: {
                org_id: orgId || undefined,
                mandi_approval_status: apiStatus,
                page: 1,
                limit: 25,
              },
            })
          : Promise.resolve(null),
        canTraderList
          ? getTraderApprovals({
              username,
              language,
              filters: {
                org_id: orgId || undefined,
                mandi_approval_status: apiStatus,
                page: 1,
                limit: 25,
              },
            })
          : Promise.resolve(null),
      ]);

      const farmerResp = farmerResult.status === "fulfilled" ? farmerResult.value : null;
      const traderResp = traderResult.status === "fulfilled" ? traderResult.value : null;

      let farmerRows = getItems(farmerResp).map(toFarmerRow);
      let traderRows = getItems(traderResp).map(toTraderRow);

      if (bucket === "COMPLETED") {
        farmerRows = farmerRows.filter((row) => isCompleted(row.status));
        traderRows = traderRows.filter((row) => isCompleted(row.status));
      }

      setFarmerTotal(bucket === "COMPLETED" ? farmerRows.length : getTotal(farmerResp, farmerRows.length));
      setTraderTotal(bucket === "COMPLETED" ? traderRows.length : getTotal(traderResp, traderRows.length));
      setRows(
        [...farmerRows, ...traderRows].sort(
          (a, b) => new Date(b.submittedOn || 0).getTime() - new Date(a.submittedOn || 0).getTime(),
        ),
      );

      if (farmerResult.status === "rejected" && traderResult.status === "rejected") {
        throw new Error("Unable to load approval queues.");
      }
    } catch (err: any) {
      console.error("[MandiManagerApprovals] load failed", err);
      setError(err?.message || "Unable to load approval queues.");
    } finally {
      setLoading(false);
    }
  }, [bucket, canFarmerList, canTraderList, language, uiConfig.scope?.org_id]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.reference, row.name, row.username, row.kind, row.mandiName, row.status].some((v) =>
        String(v).toLowerCase().includes(q),
      ),
    );
  }, [rows, search]);

  const openReview = (row: ApprovalRow) => {
    setSelected(row);
    setDrawerOpen(true);
  };

  const canApproveSelected = selected?.kind === "FARMER" ? canFarmerApprove : canTraderApprove;
  const canRejectSelected = selected?.kind === "FARMER" ? canFarmerReject : canTraderReject;
  const canInfoSelected = selected?.kind === "FARMER" ? canFarmerInfo : canTraderInfo;

  const approveSelected = async () => {
    const username = getCurrentAdminUsername();
    if (!username || !selected || !selected.mandiId) return;
    setActionBusy(true);
    try {
      if (selected.kind === "FARMER") {
        await approveFarmerForMandis({
          username,
          language,
          payload: {
            org_id: selected.orgId || uiConfig.scope?.org_id,
            farmer_username: selected.username,
            mandi_id: selected.mandiId,
          },
        });
      } else {
        await approveTrader({
          username,
          language,
          trader_username: selected.username,
          org_id: selected.orgId || uiConfig.scope?.org_id || undefined,
          mandi_id: selected.mandiId,
        });
      }
      message.success(`${selected.kind === "FARMER" ? "Farmer" : "Trader"} approved.`);
      setDrawerOpen(false);
      setSelected(null);
      await load();
    } catch (err: any) {
      message.error(err?.message || "Approval failed.");
    } finally {
      setActionBusy(false);
    }
  };

  const submitReasonAction = async () => {
    const username = getCurrentAdminUsername();
    if (!username || !selected || !reason.trim() || !selected.mandiId || !reasonOpen) return;
    setActionBusy(true);
    try {
      if (selected.kind === "FARMER") {
        const payload = {
          org_id: selected.orgId || uiConfig.scope?.org_id,
          farmer_username: selected.username,
          mandi_id: selected.mandiId,
          reason: reason.trim(),
        };
        if (reasonOpen === "INFO") {
          await requestMoreInfoFarmer({ username, language, payload });
        } else {
          await rejectFarmerApproval({ username, language, payload });
        }
      } else if (reasonOpen === "INFO") {
        await requestMoreInfoForTrader({
          username,
          language,
          trader_username: selected.username,
          reason: reason.trim(),
          mandi_id: selected.mandiId,
          org_id: selected.orgId || uiConfig.scope?.org_id || undefined,
        });
      } else {
        await rejectTrader({
          username,
          language,
          trader_username: selected.username,
          reason: reason.trim(),
          status: "REJECTED",
          mandi_id: selected.mandiId,
          org_id: selected.orgId || uiConfig.scope?.org_id || undefined,
        });
      }

      message.success(reasonOpen === "INFO" ? "More information requested." : "Request rejected.");
      setReasonOpen(null);
      setReason("");
      setDrawerOpen(false);
      setSelected(null);
      await load();
    } catch (err: any) {
      message.error(err?.message || "Action failed.");
    } finally {
      setActionBusy(false);
    }
  };

  const columns = useMemo<TableColumnsType<ApprovalRow>>(
    () => [
      {
        title: "Ref No.",
        dataIndex: "reference",
        key: "reference",
        width: 180,
        ellipsis: true,
      },
      {
        title: "Applicant",
        dataIndex: "name",
        key: "name",
        width: 210,
        render: (_value, row) => (
          <div className="cm-approvals-person">
            <Text strong>{row.name}</Text>
            <Text type="secondary">{row.username || "—"}</Text>
          </div>
        ),
      },
      {
        title: "Type",
        dataIndex: "kind",
        key: "kind",
        width: 110,
        render: (value: ApprovalKind) => <Tag color={value === "FARMER" ? "green" : "blue"}>{value === "FARMER" ? "Farmer" : "Trader"}</Tag>,
      },
      { title: "Mandi", dataIndex: "mandiName", key: "mandiName", width: 180, ellipsis: true },
      {
        title: "Submitted",
        dataIndex: "submittedOn",
        key: "submittedOn",
        width: 170,
        render: (value: string) => fmtDate(value),
      },
      {
        title: "Status",
        dataIndex: "status",
        key: "status",
        width: 130,
        render: (value: string) => <Tag color={statusColor(value)}>{statusLabel(value)}</Tag>,
      },
      {
        title: "Actions",
        key: "actions",
        width: 130,
        fixed: "right",
        render: (_value, row) => (
          <Button type="primary" ghost size="small" icon={<EyeOutlined />} onClick={() => openReview(row)}>
            Review
          </Button>
        ),
      },
    ],
    [],
  );

  if (!canFarmerList && !canTraderList) {
    return (
      <PageContainer>
        <Alert showIcon type="warning" message="You are not authorised to view approval queues." />
      </PageContainer>
    );
  }

  const currentTotal = farmerTotal + traderTotal;

  return (
    <PageContainer className="cm-approvals-page">
      <CmPageHeader
        title="Approval Centre"
        subtitle="Review farmer and trader membership requests for your assigned mandi scope."
        actions={<Button icon={<ReloadOutlined />} onClick={load} loading={loading}>Refresh</Button>}
      />

      {error && (
        <Alert
          showIcon
          type="error"
          message="Approval data could not be fully loaded"
          description={error}
          action={<Button size="small" onClick={load}>Retry</Button>}
        />
      )}

      <Row gutter={[12, 12]} className="cm-approvals-summary-grid">
        <Col xs={24} sm={12} xl={6}>
          <Card className="cm-approval-summary-card cm-approval-summary-card-active" bordered>
            <div className="cm-approval-summary-icon"><TeamOutlined /></div>
            <div><Text strong>Farmer Membership</Text><Title level={2}>{farmerTotal}</Title><Text type="secondary">{bucket === "PENDING" ? "Pending" : bucket === "IN_REVIEW" ? "In review" : "Completed scope"}</Text></div>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="cm-approval-summary-card" bordered>
            <div className="cm-approval-summary-icon"><ShopOutlined /></div>
            <div><Text strong>Trader Membership</Text><Title level={2}>{traderTotal}</Title><Text type="secondary">{bucket === "PENDING" ? "Pending" : bucket === "IN_REVIEW" ? "In review" : "Completed scope"}</Text></div>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="cm-approval-summary-card" bordered>
            <div className="cm-approval-summary-icon"><WarningOutlined /></div>
            <div><Text strong>Operational Exceptions</Text><Title level={2}>—</Title><Text type="secondary">API not enabled</Text></div>
          </Card>
        </Col>
        <Col xs={24} sm={12} xl={6}>
          <Card className="cm-approval-summary-card" bordered>
            <div className="cm-approval-summary-icon"><SyncOutlined /></div>
            <div><Text strong>Re-open Requests</Text><Title level={2}>—</Title><Text type="secondary">API not enabled</Text></div>
          </Card>
        </Col>
      </Row>

      <CmSectionCard className="cm-approvals-worklist-card">
        <div className="cm-approvals-toolbar">
          <CmFilterPills
            value={bucket}
            onChange={(value) => setBucket(value as ApprovalBucket)}
            options={[
              { label: "Pending", value: "PENDING" },
              { label: "In Review", value: "IN_REVIEW" },
              { label: "Completed", value: "COMPLETED" },
            ]}
          />
          <CmSearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search name, mobile, reference, mandi…"
            width={360}
          />
        </div>

        <div className="cm-approvals-table-meta">
          <Text type="secondary">{currentTotal} server record{currentTotal === 1 ? "" : "s"} reported for this status · showing a bounded combined queue.</Text>
        </div>

        <Table<ApprovalRow>
          className="cm-approvals-table"
          rowKey="key"
          loading={loading}
          columns={columns}
          dataSource={visibleRows}
          pagination={{ pageSize: 10, showSizeChanger: false, hideOnSinglePage: false }}
          scroll={{ x: 1120 }}
          locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="No approval requests in this scope" /> }}
        />
      </CmSectionCard>

      <Drawer
        title="Approval Review"
        open={drawerOpen}
        onClose={() => {
          setDrawerOpen(false);
          setSelected(null);
        }}
        width={520}
        className="cm-approval-review-drawer"
        extra={selected && <Tag color={selected.kind === "FARMER" ? "green" : "blue"}>{selected.kind}</Tag>}
      >
        {selected ? (
          <div className="cm-approval-review-content">
            <div className="cm-approval-review-hero">
              <Title level={4}>{selected.name}</Title>
              <Text type="secondary">{selected.username || "—"}</Text>
            </div>

            <div className="cm-approval-detail-grid">
              <div><Text type="secondary">Reference</Text><Text strong>{selected.reference}</Text></div>
              <div><Text type="secondary">Mandi</Text><Text strong>{selected.mandiName}</Text></div>
              <div><Text type="secondary">Status</Text><Tag color={statusColor(selected.status)}>{statusLabel(selected.status)}</Tag></div>
              <div><Text type="secondary">Submitted</Text><Text strong>{fmtDate(selected.submittedOn)}</Text></div>
            </div>

            {(selected.raw?.request_more_info_reason || selected.raw?.rejection_reason) && (
              <Alert
                type="info"
                showIcon
                message={selected.raw?.request_more_info_reason ? "More information requested" : "Rejection reason"}
                description={selected.raw?.request_more_info_reason || selected.raw?.rejection_reason}
              />
            )}

            <Space direction="vertical" size={10} className="cm-approval-review-actions">
              <Button
                block
                type="primary"
                icon={<CheckCircleOutlined />}
                disabled={!canApproveSelected || isCompleted(selected.status)}
                loading={actionBusy}
                onClick={approveSelected}
              >
                Approve
              </Button>
              <Button
                block
                icon={<InfoCircleOutlined />}
                disabled={!canInfoSelected || isCompleted(selected.status)}
                onClick={() => {
                  setReason("");
                  setReasonOpen("INFO");
                }}
              >
                Request More Information
              </Button>
              <Button
                block
                danger
                icon={<CloseCircleOutlined />}
                disabled={!canRejectSelected || isCompleted(selected.status)}
                onClick={() => {
                  setReason("");
                  setReasonOpen("REJECT");
                }}
              >
                Reject
              </Button>
            </Space>

            <Text type="secondary" className="cm-approval-scope-note">
              Actions use the existing farmer/trader approval APIs and remain subject to backend organisation/mandi scope enforcement.
            </Text>
          </div>
        ) : null}
      </Drawer>

      <Modal
        title={reasonOpen === "INFO" ? "Request More Information" : "Reject Request"}
        open={Boolean(reasonOpen)}
        okText={reasonOpen === "INFO" ? "Send Request" : "Reject"}
        okButtonProps={{ danger: reasonOpen === "REJECT", disabled: !reason.trim(), loading: actionBusy }}
        onOk={submitReasonAction}
        onCancel={() => {
          setReasonOpen(null);
          setReason("");
        }}
      >
        <Space direction="vertical" size={12} style={{ width: "100%" }}>
          <Text type="secondary">{reasonOpen === "INFO" ? "Tell the applicant exactly what information is required." : "Provide a clear reason for rejection."}</Text>
          <Input.TextArea
            className="cm-premium-textarea"
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter reason…"
            maxLength={1000}
            showCount
          />
        </Space>
      </Modal>
    </PageContainer>
  );
};

export default MandiManagerApprovals;
