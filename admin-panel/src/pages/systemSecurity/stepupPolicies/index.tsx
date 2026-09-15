import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Checkbox, Input, Space, Spin, Switch, Table, Tag, Typography, message } from "antd";
import { ReloadOutlined, SaveOutlined } from "@ant-design/icons";
import { StepUpGuard } from "../../../components/StepUpGuard";
import { getStepupPolicyScreens, saveStepupPolicySelection } from "../../../services/security/stepupPolicyService";
import { getSecuritySwitches, updateSecuritySwitches } from "../../../services/security/securitySwitchService";
import { getStoredAdminUser } from "../../../utils/session";

const { Text, Title } = Typography;

type StepupScreen = { label: string; route: string; group: string; resource_key: string };

const normalize = (v: unknown) => String(v || "").trim().toLowerCase();
const arrays = (resp: any, field: string): any[] => {
  const candidates = [resp, resp?.data, resp?.response, resp?.data?.data, resp?.response?.data];
  for (const c of candidates) if (c && Array.isArray(c[field])) return c[field];
  return [];
};
const matchObj = (resp: any) => {
  const candidates = [resp, resp?.data, resp?.response, resp?.data?.data, resp?.response?.data];
  for (const c of candidates) if (c?.match && typeof c.match === "object") return c.match;
  return null;
};
const unique = (values: string[]) => Array.from(new Set(values.map(normalize).filter(Boolean)));

const StepUpPoliciesPage: React.FC = () => {
  const username = useMemo(() => getStoredAdminUser()?.username || "", []);
  const [screens, setScreens] = useState<StepupScreen[]>([]);
  const [locked, setLocked] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [binding, setBinding] = useState<"Y" | "N">("N");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bindingSaving, setBindingSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    setError("");
    try {
      const [policyResp, switchResp]: any[] = await Promise.all([
        getStepupPolicyScreens({ username }),
        getSecuritySwitches({ username }),
      ]);
      const response = policyResp?.response || policyResp?.data?.response;
      if (response?.responsecode && response.responsecode !== "0") throw new Error(response.description || "Unable to load step-up policies.");

      const normalizedScreens: StepupScreen[] = arrays(policyResp, "screens")
        .map((s: any) => ({
          label: String(s?.label || s?.resource_key || "Untitled"),
          route: String(s?.route || ""),
          group: String(s?.group || "General"),
          resource_key: normalize(s?.resource_key),
        }))
        .filter((s: StepupScreen) => s.resource_key && s.route);
      const lockedKeys = unique(arrays(policyResp, "locked_defaults"));
      const match = matchObj(policyResp);
      const matchType = String(match?.type || "RESOURCE_KEY_PREFIX").toUpperCase();
      const matchValues = unique(Array.isArray(match?.values) ? match.values : []);
      const selectedKeys = normalizedScreens
        .filter((s) => matchType === "RESOURCE_KEY_PREFIX" ? matchValues.some((p) => s.resource_key.startsWith(p)) : matchValues.includes(s.resource_key))
        .map((s) => s.resource_key);
      setScreens(normalizedScreens);
      setLocked(lockedKeys);
      setSelected(unique([...selectedKeys, ...lockedKeys]));

      const switchValue =
        switchResp?.switches?.STEPUP_BROWSER_SESSION_BINDING ||
        switchResp?.data?.switches?.STEPUP_BROWSER_SESSION_BINDING ||
        switchResp?.response?.switches?.STEPUP_BROWSER_SESSION_BINDING;
      setBinding(switchValue === "Y" ? "Y" : "N");
    } catch (err: any) {
      setError(err?.message || "Unable to load step-up policies.");
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => { void load(); }, [load]);

  const lockedSet = useMemo(() => new Set(locked), [locked]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return screens;
    return screens.filter((s) => [s.label, s.route, s.group, s.resource_key].some((v) => v.toLowerCase().includes(q)));
  }, [screens, search]);

  const toggle = (key: string) => {
    if (lockedSet.has(key)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return Array.from(next);
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const all = unique([...selected, ...locked]);
      const valid = new Set(screens.map((s) => s.resource_key));
      locked.forEach((k) => valid.add(k));
      const resourceKeys = unique(all.filter((k) => valid.has(k)));
      if (!resourceKeys.length) throw new Error("No valid step-up resources selected.");
      // The API validates exact resource keys, then derives RESOURCE_KEY_PREFIX values internally.
      // Sending prefixes here (for example `admin_users.`) causes INVALID_KEYS because those are
      // not actual cm_ui_resources.resource_key values.
      const resp: any = await saveStepupPolicySelection({ username, selected: resourceKeys });
      const response = resp?.response || resp?.data?.response;
      if (response?.responsecode !== "0") throw new Error(response?.description || "Unable to save step-up policy.");
      message.success("Step-up policy saved.");
      await load();
    } catch (err: any) {
      message.error(err?.message || "Unable to save step-up policy.");
    } finally {
      setSaving(false);
    }
  };

  const toggleBinding = async (checked: boolean) => {
    setBindingSaving(true);
    try {
      const next: "Y" | "N" = checked ? "Y" : "N";
      const resp: any = await updateSecuritySwitches({ username, switches: { STEPUP_BROWSER_SESSION_BINDING: next } });
      const response = resp?.response || resp?.data?.response;
      if (response?.responsecode !== "0") throw new Error(response?.description || "Unable to update browser-session binding.");
      setBinding(next);
      message.success("Browser-session binding updated.");
    } catch (err: any) {
      message.error(err?.message || "Unable to update browser-session binding.");
      await load();
    } finally {
      setBindingSaving(false);
    }
  };

  if (!username) return <Alert type="warning" showIcon message="Please log in." />;

  return (
    <StepUpGuard username={username} resourceKey="stepup_policy.view">
      <div className="cm-page">
        <div className="cm-page-header">
          <h1 className="cm-page-title">Step-up Policies</h1>
          <div className="cm-page-subtitle">Choose which sensitive admin screens always require recent verification.</div>
        </div>

        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}
        <Spin spinning={loading}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card className="cm-card" bordered={false}>
              <Space style={{ width: "100%", justifyContent: "space-between" }} align="start">
                <div>
                  <Title level={5} style={{ margin: 0 }}>Browser-session binding</Title>
                  <Text type="secondary">When enabled, step-up approval is valid only for the current browser session.</Text>
                </div>
                <Switch checked={binding === "Y"} onChange={toggleBinding} loading={bindingSaving} disabled={bindingSaving} />
              </Space>
            </Card>

            <Card className="cm-card" bordered={false}>
              <Space direction="vertical" size={12} style={{ width: "100%" }}>
                <Space style={{ width: "100%", justifyContent: "space-between", flexWrap: "wrap" }}>
                  <Space>
                    <Tag color="blue">{selected.length} protected</Tag>
                    <Tag>{locked.length} locked defaults</Tag>
                  </Space>
                  <Space wrap>
                    <Input
                      placeholder="Search screen, route or resource"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      style={{ width: 320 }}
                    />
                    <Button icon={<ReloadOutlined />} onClick={() => void load()}>Refresh</Button>
                    <Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>Save policy</Button>
                  </Space>
                </Space>

                <Alert type="info" showIcon message="Locked defaults cannot be removed" description="Core administrative screens remain protected even if they are not manually selected." />

                <Table
                  rowKey="resource_key"
                  dataSource={filtered}
                  pagination={{ pageSize: 25, showSizeChanger: false }}
                  columns={[
                    { title: "Screen", dataIndex: "label", key: "label", render: (v, r: StepupScreen) => <div><Text strong>{v}</Text><br/><Text type="secondary">{r.resource_key}</Text></div> },
                    { title: "Group", dataIndex: "group", key: "group", width: 180 },
                    { title: "Route", dataIndex: "route", key: "route", ellipsis: true },
                    {
                      title: "Require step-up",
                      key: "selected",
                      width: 160,
                      align: "center" as const,
                      render: (_: unknown, r: StepupScreen) => (
                        <Space direction="vertical" size={2} align="center">
                          <Checkbox checked={selectedSet.has(r.resource_key)} disabled={lockedSet.has(r.resource_key)} onChange={() => toggle(r.resource_key)} />
                          {lockedSet.has(r.resource_key) && <Text type="secondary">Locked</Text>}
                        </Space>
                      ),
                    },
                  ]}
                />
              </Space>
            </Card>
          </Space>
        </Spin>
      </div>
    </StepUpGuard>
  );
};

export default StepUpPoliciesPage;
