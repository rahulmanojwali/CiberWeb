import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Col,
  Drawer,
  Input,
  Modal,
  Row,
  Space,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  CloudDownloadOutlined,
  DiffOutlined,
  HistoryOutlined,
  ReloadOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { StepUpGuard } from "../../components/StepUpGuard";
import { useStepUp } from "../../security/stepup/useStepUp";
import {
  compareResourceHealthSnapshot,
  createResourceHealthSnapshot,
  fetchResourceHealth,
  fetchResourceHealthSnapshots,
  restoreResourceHealthSnapshot,
} from "../../services/resourceHealthApi";
import "./resourceHealth.css";

const { Text, Title } = Typography;

function storedUser() {
  try { return JSON.parse(localStorage.getItem("cd_user") || "{}"); } catch { return {}; }
}
function ok(resp: any) { return String(resp?.response?.responsecode ?? "1") === "0"; }
function dataOf(resp: any) { return resp?.response?.data || resp?.data || {}; }
function prettyDate(value?: string) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleString();
}

type HealthRow = {
  key: string;
  resource_key: string;
  ui_action?: string;
  registry_actions?: string[];
  reason?: string;
  module?: string | null;
};

type SnapshotRow = {
  snapshot_id: string;
  source?: string;
  reason?: string;
  created_on?: string;
  created_by?: string;
  registry_count?: number;
  ui_resource_count?: number;
  checksum?: string;
  health_summary?: Record<string, number>;
};

export default function ResourceHealthPage() {
  const user = useMemo(storedUser, []);
  const username = String(user?.username || user?.email || "").trim().toLowerCase();
  const { ensureStepUp } = useStepUp();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [informationalOpen, setInformationalOpen] = useState(false);
  const [health, setHealth] = useState<any>({ summary: {}, missing_registry: [], action_mismatches: [], registry_only: [] });

  const [historyOpen, setHistoryOpen] = useState(false);
  const [snapshots, setSnapshots] = useState<SnapshotRow[]>([]);
  const [snapLoading, setSnapLoading] = useState(false);
  const [snapPage, setSnapPage] = useState(1);
  const [snapTotal, setSnapTotal] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [createReason, setCreateReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareData, setCompareData] = useState<any>(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [selectedSnapshot, setSelectedSnapshot] = useState<SnapshotRow | null>(null);
  const [restoreOpen, setRestoreOpen] = useState(false);
  const [restoreReason, setRestoreReason] = useState("");

  const loadHealth = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    setError("");
    try {
      const resp = await fetchResourceHealth({ username });
      if (!ok(resp)) throw new Error(resp?.response?.description || "Unable to load Resource Health.");
      setHealth(dataOf(resp));
    } catch (err: any) {
      setError(err?.message || "Unable to load Resource Health.");
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => { loadHealth(); }, [loadHealth]);

  const loadSnapshots = useCallback(async (page = snapPage) => {
    if (!username) return;
    setSnapLoading(true);
    try {
      const resp = await fetchResourceHealthSnapshots({ username, page, pageSize: 10 });
      if (!ok(resp)) throw new Error(resp?.response?.description || "Unable to load snapshots.");
      const data = dataOf(resp);
      setSnapshots(data.snapshots || []);
      setSnapTotal(Number(data.pagination?.total || 0));
      setSnapPage(Number(data.pagination?.page || page));
    } catch (err: any) {
      setError(err?.message || "Unable to load snapshots.");
    } finally {
      setSnapLoading(false);
    }
  }, [snapPage, username]);

  const openHistory = async () => {
    setHistoryOpen(true);
    await loadSnapshots(1);
  };

  const createSnapshot = async () => {
    const reason = createReason.trim();
    if (reason.length < 5) return;
    setSaving(true);
    try {
      const verified = await ensureStepUp("resource_health.menu", "VIEW", { source: "GUARD", force: true });
      if (!verified) throw new Error("Step-up verification is required.");
      const resp = await createResourceHealthSnapshot({ username, reason });
      if (!ok(resp)) throw new Error(resp?.response?.description || "Unable to create snapshot.");
      setCreateOpen(false);
      setCreateReason("");
      await Promise.all([loadHealth(), loadSnapshots(1)]);
    } catch (err: any) {
      setError(err?.message || "Unable to create snapshot.");
    } finally {
      setSaving(false);
    }
  };

  const compareSnapshot = async (row: SnapshotRow) => {
    setSelectedSnapshot(row);
    setCompareOpen(true);
    setCompareLoading(true);
    setCompareData(null);
    try {
      const resp = await compareResourceHealthSnapshot({ username, snapshotId: row.snapshot_id });
      if (!ok(resp)) throw new Error(resp?.response?.description || "Unable to compare snapshot.");
      setCompareData(dataOf(resp));
    } catch (err: any) {
      setError(err?.message || "Unable to compare snapshot.");
    } finally {
      setCompareLoading(false);
    }
  };

  const restoreSnapshot = async () => {
    if (!selectedSnapshot || restoreReason.trim().length < 5) return;
    setSaving(true);
    try {
      const verified = await ensureStepUp("resource_health.menu", "VIEW", { source: "GUARD", force: true });
      if (!verified) throw new Error("Step-up verification is required.");
      const resp = await restoreResourceHealthSnapshot({
        username,
        snapshotId: selectedSnapshot.snapshot_id,
        reason: restoreReason.trim(),
      });
      if (!ok(resp)) throw new Error(resp?.response?.description || "Unable to restore snapshot.");
      setRestoreOpen(false);
      setRestoreReason("");
      setCompareOpen(false);
      await Promise.all([loadHealth(), loadSnapshots(1)]);
    } catch (err: any) {
      setError(err?.message || "Unable to restore snapshot.");
    } finally {
      setSaving(false);
    }
  };

  const filterRows = useCallback((rows: HealthRow[]) => {
    const q = query.trim().toLowerCase();
    if (!q) return rows || [];
    return (rows || []).filter((row) =>
      String(row.resource_key || "").toLowerCase().includes(q) ||
      String(row.module || "").toLowerCase().includes(q) ||
      String(row.ui_action || "").toLowerCase().includes(q)
    );
  }, [query]);

  const missing = filterRows(health.missing_registry || []);
  const mismatches = filterRows(health.action_mismatches || []);
  const registryOnly = filterRows(health.registry_only || []);
  const summary = health.summary || {};

  const issueColumns: ColumnsType<HealthRow> = [
    { title: "Resource Key", dataIndex: "resource_key", key: "resource_key", render: (v) => <Text strong>{v}</Text> },
    { title: "UI Action", dataIndex: "ui_action", key: "ui_action", width: 150, render: (v) => v ? <Tag>{v}</Tag> : "—" },
    { title: "Registry Actions", dataIndex: "registry_actions", key: "registry_actions", render: (actions) => <Space size={[4, 4]} wrap>{(actions || []).map((a: string) => <Tag key={a}>{a}</Tag>)}</Space> },
    { title: "Reason", dataIndex: "reason", key: "reason" },
  ];

  const registryOnlyColumns: ColumnsType<HealthRow> = [
    { title: "Resource Key", dataIndex: "resource_key", key: "resource_key", render: (v) => <Text strong>{v}</Text> },
    { title: "Module", dataIndex: "module", key: "module", width: 210, render: (v) => v || "—" },
    { title: "Allowed Actions", dataIndex: "registry_actions", key: "registry_actions", render: (actions) => <Space size={[4, 4]} wrap>{(actions || []).map((a: string) => <Tag key={a}>{a}</Tag>)}</Space> },
  ];

  const snapshotColumns: ColumnsType<SnapshotRow> = [
    { title: "Created", dataIndex: "created_on", key: "created_on", width: 180, render: prettyDate },
    { title: "Created By", dataIndex: "created_by", key: "created_by", width: 150 },
    { title: "Reason", dataIndex: "reason", key: "reason", ellipsis: true },
    { title: "Registry", dataIndex: "registry_count", key: "registry_count", width: 90 },
    { title: "UI", dataIndex: "ui_resource_count", key: "ui_resource_count", width: 70 },
    {
      title: "Action", key: "action", width: 110,
      render: (_, row) => <Button size="small" icon={<DiffOutlined />} onClick={() => compareSnapshot(row)}>Compare</Button>,
    },
  ];

  if (!username) return <Alert type="warning" showIcon message="Please log in." />;

  return (
    <StepUpGuard username={username} resourceKey="resource_health.menu">
      <div className="cm-page cm-resource-health-page">
        <div className="cm-page-header cm-resource-health-header">
          <div>
            <h1 className="cm-page-title">Resource Health</h1>
            <div className="cm-page-subtitle">Authoritative server-side validation of UI permissions against the Resource Registry.</div>
          </div>
          <Space wrap>
            <Button icon={<ReloadOutlined />} onClick={loadHealth} loading={loading}>Refresh</Button>
            <Button icon={<HistoryOutlined />} onClick={openHistory}>Snapshot History</Button>
            <Button type="primary" icon={<CloudDownloadOutlined />} onClick={() => setCreateOpen(true)}>Create Snapshot</Button>
          </Space>
        </div>

        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          {error && <Alert type="error" showIcon message={error} closable onClose={() => setError("")} />}

          <Row gutter={[12, 12]}>
            <Col xs={24} md={6}><Card><Statistic title="Blocking Issues" value={Number(summary.blocking_issues || 0)} /></Card></Col>
            <Col xs={24} md={6}><Card><Statistic title="Active UI Resources" value={Number(summary.active_ui_resources || 0)} /></Card></Col>
            <Col xs={24} md={6}><Card><Statistic title="Active Registry" value={Number(summary.active_registry_resources || 0)} /></Card></Col>
            <Col xs={24} md={6}><Card><Statistic title="Registry-only" value={Number(summary.registry_only_informational || 0)} /></Card></Col>
          </Row>

          {Number(summary.blocking_issues || 0) === 0 ? (
            <Alert type="success" showIcon message="Resource health is clean" description="No active UI resource is missing from the Registry and no active UI action conflicts with its Registry definition." />
          ) : (
            <Alert type="warning" showIcon message={`${summary.blocking_issues} blocking issue(s) found`} description="Review the blocking sections below before changing role policies." />
          )}

          <Card className="cm-resource-health-search-card">
            <div className="cm-resource-health-search-control">
              <SearchOutlined className="cm-resource-health-search-icon" />
              <input
                className="cm-resource-health-search-input"
                type="search"
                placeholder="Search resource key, module or action"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-label="Search resource health results"
              />
              {query ? (
                <button
                  type="button"
                  className="cm-resource-health-search-clear"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                >
                  ×
                </button>
              ) : null}
            </div>
          </Card>

          <Card title={`UI keys missing in Registry (${missing.length})`}>
            <Table size="small" rowKey="key" columns={issueColumns} dataSource={missing} pagination={{ pageSize: 10, showSizeChanger: false }} loading={loading} locale={{ emptyText: "No missing Registry definitions." }} />
          </Card>

          <Card title={`Action mismatches (${mismatches.length})`}>
            <Table size="small" rowKey="key" columns={issueColumns} dataSource={mismatches} pagination={{ pageSize: 10, showSizeChanger: false }} loading={loading} locale={{ emptyText: "No action mismatches." }} />
          </Card>

          <Card className="cm-resource-health-informational-card">
            <div className="cm-resource-health-informational-heading">
              <div>
                <Text strong>Registry-only resources</Text>
                <div className="cm-resource-health-informational-subtitle">
                  {registryOnly.length} informational resource{registryOnly.length === 1 ? "" : "s"}. These do not count as health failures.
                </div>
              </div>
              <Button type="link" onClick={() => setInformationalOpen((open) => !open)}>
                {informationalOpen ? "Hide informational resources" : "Show informational resources"}
              </Button>
            </div>
            {informationalOpen ? (
              <>
                <Alert
                  type="info"
                  showIcon
                  message="Registry is intentionally a superset of visible UI resources"
                  description="Authorization-only, backend-only, or non-menu resources may legitimately exist in the Registry without a visible UI entry. Review these only when a specific regression is suspected."
                  style={{ marginBottom: 12 }}
                />
                <Table
                  size="small"
                  rowKey="key"
                  columns={registryOnlyColumns}
                  dataSource={registryOnly}
                  pagination={{ pageSize: 15, showSizeChanger: false }}
                  loading={loading}
                  locale={{ emptyText: query ? "No informational resources match the search." : "No Registry-only resources." }}
                />
              </>
            ) : null}
          </Card>
        </Space>

        <Drawer title="Resource Health Snapshot History" width={920} open={historyOpen} onClose={() => setHistoryOpen(false)}>
          <Alert type="info" showIcon message="Snapshots back up Resource Registry + UI resource configuration only." description="Role-policy recovery remains in Role Policy Manager History. Restores are non-destructive: resources added after a snapshot are not deleted." style={{ marginBottom: 16 }} />
          <Table
            rowKey="snapshot_id"
            columns={snapshotColumns}
            dataSource={snapshots}
            loading={snapLoading}
            pagination={{ current: snapPage, pageSize: 10, total: snapTotal, showSizeChanger: false, onChange: (page) => loadSnapshots(page) }}
          />
        </Drawer>

        <Modal title="Create Resource Health Snapshot" open={createOpen} onCancel={() => setCreateOpen(false)} onOk={createSnapshot} okText="Create Snapshot" confirmLoading={saving} okButtonProps={{ disabled: createReason.trim().length < 5 }}>
          <Alert type="info" showIcon message="This is a configuration snapshot, not a database backup." style={{ marginBottom: 12 }} />
          <Text strong>Reason</Text>
          <Input.TextArea rows={4} maxLength={500} showCount value={createReason} onChange={(e) => setCreateReason(e.target.value)} placeholder="Why are you taking this snapshot?" />
        </Modal>

        <Drawer title="Compare Resource Health Snapshot" width={920} open={compareOpen} onClose={() => setCompareOpen(false)}>
          {compareLoading ? <Card loading /> : compareData ? (
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Alert type="info" showIcon message={`Snapshot ${compareData.snapshot?.snapshot_id || ""}`} description={`${prettyDate(compareData.snapshot?.created_on)} · ${compareData.snapshot?.reason || "No reason"}`} />
              <Row gutter={[12, 12]}>
                <Col span={8}><Card><Statistic title="Registry Changed" value={Number(compareData.summary?.registry_changed || 0)} /></Card></Col>
                <Col span={8}><Card><Statistic title="Registry Missing Now" value={Number(compareData.summary?.registry_missing_now || 0)} /></Card></Col>
                <Col span={8}><Card><Statistic title="Registry Added Later" value={Number(compareData.summary?.registry_added_after_snapshot || 0)} /></Card></Col>
                <Col span={8}><Card><Statistic title="UI Changed" value={Number(compareData.summary?.ui_changed || 0)} /></Card></Col>
                <Col span={8}><Card><Statistic title="UI Missing Now" value={Number(compareData.summary?.ui_missing_now || 0)} /></Card></Col>
                <Col span={8}><Card><Statistic title="UI Added Later" value={Number(compareData.summary?.ui_added_after_snapshot || 0)} /></Card></Col>
              </Row>
              <Card title="Changed Registry Resources"><Text>{(compareData.registry?.changed || []).join(", ") || "None"}</Text></Card>
              <Card title="Registry Resources Missing Now"><Text>{(compareData.registry?.missing_now || []).join(", ") || "None"}</Text></Card>
              <Card title="Changed UI Resources"><Text>{(compareData.ui_resources?.changed || []).join(", ") || "None"}</Text></Card>
              <Alert type="warning" showIcon message="Restore is non-destructive" description="The selected snapshot can restore changed or missing snapshot entries, but it will not delete resources created after the snapshot." />
              <Button danger icon={<SafetyCertificateOutlined />} onClick={() => setRestoreOpen(true)}>Restore This Snapshot</Button>
            </Space>
          ) : null}
        </Drawer>

        <Modal title="Restore Resource Health Snapshot" open={restoreOpen} onCancel={() => setRestoreOpen(false)} onOk={restoreSnapshot} okText="Restore Snapshot" okButtonProps={{ danger: true, disabled: restoreReason.trim().length < 5 }} confirmLoading={saving}>
          <Alert type="warning" showIcon message="A safety snapshot will be created automatically before restore." description="Restore requires step-up verification and is audit logged. Resources created after the selected snapshot will not be deleted." style={{ marginBottom: 12 }} />
          <Title level={5}>{selectedSnapshot?.snapshot_id}</Title>
          <Text strong>Restore reason</Text>
          <Input.TextArea rows={4} maxLength={500} showCount value={restoreReason} onChange={(e) => setRestoreReason(e.target.value)} placeholder="Why are you restoring this snapshot?" />
        </Modal>
      </div>
    </StepUpGuard>
  );
}
