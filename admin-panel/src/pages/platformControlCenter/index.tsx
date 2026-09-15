import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Input, Space, Switch, Table, Tabs, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import { ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { DEFAULT_COUNTRY, DEFAULT_LANGUAGE } from "../../config/appConfig";
import {
  getPlatformControlCenter,
  type PlatformControlOperation,
  updatePlatformControlCenter,
} from "../../services/platformControlCenterApi";
import { useStepUp } from "../../security/stepup/useStepUp";
import { isDbActive } from "../../utils/adminUiConfig";
import "./platformControlCenter.css";
import "../../styles/systemAdmin.css";

const TABS = [
  { key: "MODULES", label: "Module Control" },
  { key: "MENUS", label: "Menu Control" },
  { key: "MOBILE", label: "Mobile Dashboard Control" },
  { key: "WORKFLOW", label: "Workflow Control" },
  { key: "API", label: "API Feature Control" },
];

function storedUser() {
  try { return JSON.parse(localStorage.getItem("cd_user") || "{}"); } catch { return {}; }
}
function normalizeRole(role?: string | null) {
  const raw = String(role || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return raw === "SUPERADMIN" ? "SUPER_ADMIN" : raw;
}
function ok(resp: any) { return String(resp?.response?.responsecode ?? "1") === "0"; }
function dataOf(resp: any) { return resp?.response?.data || resp?.data || {}; }
function active(v: any) { return isDbActive(v); }

export default function PlatformControlCenterPage() {
  const uiConfig = useAdminUiConfig();
  const { ensureStepUp } = useStepUp();
  const user = useMemo(storedUser, []);
  const username = String(user?.username || user?.email || "").trim().toLowerCase();
  const country = String(user?.country || DEFAULT_COUNTRY).trim().toUpperCase();
  const role = normalizeRole(uiConfig.role || user?.role_slug || user?.default_role_code);
  const isSuperAdmin = role === "SUPER_ADMIN";
  const base = useMemo(() => ({ username, country, language: DEFAULT_LANGUAGE, role }), [country, role, username]);

  const [tab, setTab] = useState("MODULES");
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState("");
  const [targetModule, setTargetModule] = useState("");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const load = useCallback(async (section = tab) => {
    if (!username || !isSuperAdmin) return;
    setLoading(true);
    setMessage(null);
    try {
      const resp = await getPlatformControlCenter({ ...base, section });
      if (!ok(resp)) throw new Error(resp?.response?.description || "Unable to load Platform Controls.");
      setData(dataOf(resp));
    } catch (err: any) {
      setData({});
      setMessage({ type: "error", text: err?.message || "Unable to load Platform Controls." });
    } finally {
      setLoading(false);
    }
  }, [base, isSuperAdmin, tab, username]);

  useEffect(() => { load(tab); }, [tab]);

  const saveOperation = async (operation: PlatformControlOperation, label: string) => {
    if (!username || !isSuperAdmin) return;
    setSavingKey(label);
    setMessage(null);
    try {
      const verified = await ensureStepUp("platform_control_center.update", "UPDATE", { source: "GUARD", force: true });
      if (!verified) throw new Error("Step-up verification is required before saving.");
      const resp = await updatePlatformControlCenter({ ...base, operations: [operation] });
      if (!ok(resp)) throw new Error(resp?.response?.description || "Unable to save change.");
      setMessage({ type: "success", text: "Platform control updated." });
      await uiConfig.refresh({ invalidate: true });
      window.dispatchEvent(new Event("platform-menu-controls-updated"));
      await load(tab);
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Unable to save change." });
    } finally {
      setSavingKey("");
    }
  };

  if (!isSuperAdmin) return <Alert type="error" showIcon message="Only Super Admin can access Platform Controls." />;

  const modules = data.modules || [];
  const unassigned = data.unassigned_resources || [];
  const menus = data.menus || [];
  const widgets = data.mobile_widgets || [];
  const workflow = data.workflow_controls || [];
  const apiFeatures = data.api_features || [];
  const resources = data.resources || [];

  const switchColumn = (type: PlatformControlOperation["type"], keyFn: (row: any) => string, checkedFn: (row: any) => boolean): ColumnsType<any>[number] => ({
    title: "Status",
    key: "status",
    width: 90,
    render: (_: any, row: any) => {
      const key = keyFn(row);
      return <Switch checked={checkedFn(row)} loading={savingKey === `${type}:${key}`} disabled={Boolean(savingKey)} onChange={(checked) => {
        const op: any = { type, is_active: checked };
        if (type === "MODULE") op.module = key;
        else if (type === "MENU_VISIBILITY" || type === "RESOURCE") op.resource_key = key;
        else if (type === "MOBILE_WIDGET") op.id = key;
        else if (type === "WORKFLOW_CONTROL") { op.id = row._id; op.key = row.rule_key; }
        else if (type === "API_FEATURE") op.key = key;
        saveOperation(op, `${type}:${key}`);
      }} />;
    },
  });

  const genericTable = (rows: any[], cols: ColumnsType<any>, rowKey: (row: any) => string) => (
    <Table dataSource={rows} columns={cols} rowKey={rowKey} loading={loading} pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [10, 20, 50, 100] }} scroll={{ x: 900 }} />
  );

  const tabContent = () => {
    if (tab === "MODULES") {
      const cols: ColumnsType<any> = [
        switchColumn("MODULE", (r) => r.module, (r) => Number(r.active || 0) > 0),
        { title: "Module", dataIndex: "module", key: "module" },
        { title: "Resources", dataIndex: "total", key: "total", width: 110 },
        { title: "Active", dataIndex: "active", key: "active", width: 100 },
      ];
      return <Space direction="vertical" size={14} style={{ width: "100%" }}>
        <Card bordered={false} className="cm-system-table-card" title="Module Control">{genericTable(modules, cols, (r) => r.module)}</Card>
        <Card bordered={false} className="cm-system-table-card" title={`Unassigned Resources (${Number(data.unassigned_resource_count || unassigned.length)})`} extra={<Space><Input value={targetModule} onChange={(e) => setTargetModule(e.target.value)} placeholder="Target module" style={{ width: 220 }} /><Button type="primary" icon={<SaveOutlined />} disabled={!targetModule.trim() || !unassigned.length || Boolean(savingKey)} onClick={() => saveOperation({ type: "BULK_REASSIGN_MODULE", resource_keys: unassigned.map((r: any) => r.resource_key), target_module: targetModule.trim(), is_active: true }, "module-reassign").then(() => setTargetModule(""))}>Reassign All</Button></Space>}>
          {genericTable(unassigned, [
            { title: "Resource", dataIndex: "resource_key", key: "resource_key" },
            { title: "Description", dataIndex: "description", key: "description" },
            { title: "Allowed actions", dataIndex: "allowed_actions", key: "allowed_actions", render: (v: string[]) => <Space size={[4,4]} wrap>{(v || []).map((a) => <Tag key={a}>{a}</Tag>)}</Space> },
          ], (r) => r.resource_key)}
        </Card>
      </Space>;
    }
    if (tab === "MENUS") return <Card bordered={false} className="cm-system-table-card" title="Menu Control">{genericTable(menus, [
      switchColumn("MENU_VISIBILITY", (r) => r.resource_key, (r) => active(r.is_active)),
      { title: "Menu", dataIndex: "display_name", key: "display_name", render: (v, r) => v || r.resource_key },
      { title: "Resource", dataIndex: "resource_key", key: "resource_key" },
      { title: "Parent", dataIndex: "parent_menu", key: "parent_menu" },
      { title: "Route", dataIndex: "route", key: "route" },
    ], (r) => r.resource_key)}</Card>;
    if (tab === "MOBILE") return <Card bordered={false} className="cm-system-table-card" title="Mobile Dashboard Control">{genericTable(widgets, [
      switchColumn("MOBILE_WIDGET", (r) => r._id, (r) => active(r.is_active)),
      { title: "Role", dataIndex: "role_code", key: "role_code" },
      { title: "Widget", dataIndex: "widget_key", key: "widget_key" },
      { title: "Title", dataIndex: "title_en", key: "title_en" },
      { title: "Route", dataIndex: "route", key: "route" },
    ], (r) => r._id || `${r.role_code}-${r.widget_key}`)}</Card>;
    if (tab === "WORKFLOW") return <Card bordered={false} className="cm-system-table-card" title="Workflow Control">{genericTable(workflow, [
      switchColumn("WORKFLOW_CONTROL", (r) => r._id || r.rule_key, (r) => active(r.is_active)),
      { title: "Rule", dataIndex: "rule_key", key: "rule_key" },
      { title: "Name", dataIndex: "name", key: "name" },
      { title: "Step-up", dataIndex: "require_stepup", key: "require_stepup", render: (v) => v ? <Tag color="orange">Required</Tag> : <Tag>Not required</Tag> },
    ], (r) => r._id || r.rule_key)}</Card>;
    if (tab === "API") return <Space direction="vertical" size={14} style={{ width: "100%" }}>
      <Card bordered={false} className="cm-system-table-card" title="API Feature Control">{genericTable(apiFeatures, [
        switchColumn("API_FEATURE", (r) => r.key, (r) => active(r.enabled)),
        { title: "Feature", dataIndex: "key", key: "key" },
        { title: "Note", dataIndex: "note", key: "note" },
      ], (r) => r.key)}</Card>
      <Card bordered={false} className="cm-system-table-card" title="Resource Feature Controls">{genericTable(resources, [
        switchColumn("RESOURCE", (r) => r.resource_key, (r) => active(r.is_active)),
        { title: "Resource", dataIndex: "resource_key", key: "resource_key" },
        { title: "Module", dataIndex: "module", key: "module" },
        { title: "Actions", dataIndex: "allowed_actions", key: "allowed_actions", render: (v: string[]) => <Space size={[4,4]} wrap>{(v || []).map((a) => <Tag key={a}>{a}</Tag>)}</Space> },
      ], (r) => r.resource_key)}</Card>
    </Space>;
    return null;
  };

  return <div className="cm-page cm-platform-controls-page">
    <div className="cm-page-header cm-system-page-header"><div><h1 className="cm-page-title">Platform Controls</h1><div className="cm-page-subtitle">Sensitive platform switches grouped by function. Only the selected tab is loaded to keep the screen fast.</div></div><Button icon={<ReloadOutlined />} onClick={() => load(tab)} disabled={loading}>Refresh</Button></div>
    {message ? <Alert className="cm-system-inline-alert" type={message.type} showIcon message={message.text} closable onClose={() => setMessage(null)} /> : null}
    <Card bordered={false} className="cm-platform-controls-tabs"><Tabs type="card" activeKey={tab} onChange={setTab} items={TABS.map((t) => ({ key: t.key, label: t.label }))} /></Card>
    <div className="cm-platform-controls-content">{tabContent()}</div>
  </div>;
}
