import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  Card,
  Checkbox,
  Dropdown,
  Space,
  Spin,
  Switch,
  Table,
  Tag,
  Tooltip,
  Typography,
  message,
} from "antd";
import {
  DownOutlined,
  ReloadOutlined,
  SaveOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { StepUpGuard } from "../../../components/StepUpGuard";
import { getStepupPolicyScreens, saveStepupPolicySelection } from "../../../services/security/stepupPolicyService";
import { getSecuritySwitches, updateSecuritySwitches } from "../../../services/security/securitySwitchService";
import { getStoredAdminUser } from "../../../utils/session";
import "./stepupPolicies.css";

const { Text, Title } = Typography;

type StepupScreen = {
  label: string;
  route: string;
  group: string;
  resource_key: string;
};

const normalize = (value: unknown) => String(value || "").trim().toLowerCase();

const arrays = (resp: any, field: string): any[] => {
  const candidates = [resp, resp?.data, resp?.response, resp?.data?.data, resp?.response?.data];
  for (const candidate of candidates) {
    if (candidate && Array.isArray(candidate[field])) return candidate[field];
  }
  return [];
};

const matchObj = (resp: any) => {
  const candidates = [resp, resp?.data, resp?.response, resp?.data?.data, resp?.response?.data];
  for (const candidate of candidates) {
    if (candidate?.match && typeof candidate.match === "object") return candidate.match;
  }
  return null;
};

const unique = (values: string[]) =>
  Array.from(new Set(values.map(normalize).filter(Boolean)));

const sameKeySet = (a: string[], b: string[]) => {
  const left = new Set(a);
  const right = new Set(b);
  if (left.size !== right.size) return false;
  for (const key of left) if (!right.has(key)) return false;
  return true;
};

const StepUpPoliciesPage: React.FC = () => {
  const username = useMemo(() => getStoredAdminUser()?.username || "", []);
  const [screens, setScreens] = useState<StepupScreen[]>([]);
  const [locked, setLocked] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [baselineSelected, setBaselineSelected] = useState<string[]>([]);
  const [binding, setBinding] = useState<"Y" | "N">("N");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bindingSaving, setBindingSaving] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [protectedOnly, setProtectedOnly] = useState(false);

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
      if (response?.responsecode && response.responsecode !== "0") {
        throw new Error(response.description || "Unable to load step-up policies.");
      }

      const normalizedScreens: StepupScreen[] = arrays(policyResp, "screens")
        .map((screen: any) => ({
          label: String(screen?.label || screen?.resource_key || "Untitled"),
          route: String(screen?.route || ""),
          group: String(screen?.group || "General"),
          resource_key: normalize(screen?.resource_key),
        }))
        .filter((screen: StepupScreen) => screen.resource_key && screen.route)
        .sort((a, b) => {
          const groupCompare = a.group.localeCompare(b.group);
          return groupCompare !== 0 ? groupCompare : a.label.localeCompare(b.label);
        });

      const lockedKeys = unique(arrays(policyResp, "locked_defaults"));
      const match = matchObj(policyResp);
      const matchType = String(match?.type || "RESOURCE_KEY_PREFIX").toUpperCase();
      const matchValues = unique(Array.isArray(match?.values) ? match.values : []);
      const selectedKeys = normalizedScreens
        .filter((screen) =>
          matchType === "RESOURCE_KEY_PREFIX"
            ? matchValues.some((prefix) => screen.resource_key.startsWith(prefix))
            : matchValues.includes(screen.resource_key),
        )
        .map((screen) => screen.resource_key);

      const normalizedSelection = unique([...selectedKeys, ...lockedKeys]);
      setScreens(normalizedScreens);
      setLocked(lockedKeys);
      setSelected(normalizedSelection);
      setBaselineSelected(normalizedSelection);

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

  useEffect(() => {
    void load();
  }, [load]);

  const lockedSet = useMemo(() => new Set(locked), [locked]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const groups = useMemo(() => {
    const values = Array.from(new Set(screens.map((screen) => screen.group).filter(Boolean)));
    return values.sort((a, b) => a.localeCompare(b));
  }, [screens]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return screens.filter((screen) => {
      if (groupFilter !== "ALL" && screen.group !== groupFilter) return false;
      if (protectedOnly && !selectedSet.has(screen.resource_key)) return false;
      if (!query) return true;
      return [screen.label, screen.route, screen.group, screen.resource_key]
        .some((value) => value.toLowerCase().includes(query));
    });
  }, [screens, search, groupFilter, protectedOnly, selectedSet]);

  const optionalProtectedCount = useMemo(
    () => selected.filter((key) => !lockedSet.has(key)).length,
    [selected, lockedSet],
  );

  const unprotectedCount = Math.max(0, screens.length - selectedSet.size);
  const dirty = useMemo(
    () => !sameKeySet(selected, baselineSelected),
    [selected, baselineSelected],
  );

  const changedCount = useMemo(() => {
    const before = new Set(baselineSelected);
    const after = new Set(selected);
    let count = 0;
    before.forEach((key) => { if (!after.has(key)) count += 1; });
    after.forEach((key) => { if (!before.has(key)) count += 1; });
    return count;
  }, [selected, baselineSelected]);

  const toggle = (key: string) => {
    if (lockedSet.has(key)) return;
    setSelected((previous) => {
      const next = new Set(previous);
      next.has(key) ? next.delete(key) : next.add(key);
      return Array.from(next);
    });
  };

  const protectVisible = () => {
    setSelected((previous) => unique([...previous, ...filtered.map((screen) => screen.resource_key)]));
  };

  const clearOptionalVisible = () => {
    const visible = new Set(filtered.map((screen) => screen.resource_key));
    setSelected((previous) => previous.filter((key) => lockedSet.has(key) || !visible.has(key)));
  };

  const discardChanges = () => {
    setSelected(baselineSelected);
  };

  const save = async () => {
    setSaving(true);
    try {
      const all = unique([...selected, ...locked]);
      const valid = new Set(screens.map((screen) => screen.resource_key));
      locked.forEach((key) => valid.add(key));
      const resourceKeys = unique(all.filter((key) => valid.has(key)));
      if (!resourceKeys.length) throw new Error("No valid step-up resources selected.");

      const resp: any = await saveStepupPolicySelection({ username, selected: resourceKeys });
      const response = resp?.response || resp?.data?.response;
      if (response?.responsecode !== "0") {
        throw new Error(response?.description || "Unable to save step-up policy.");
      }
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
      const resp: any = await updateSecuritySwitches({
        username,
        switches: { STEPUP_BROWSER_SESSION_BINDING: next },
      });
      const response = resp?.response || resp?.data?.response;
      if (response?.responsecode !== "0") {
        throw new Error(response?.description || "Unable to update browser-session binding.");
      }
      setBinding(next);
      message.success(checked ? "Browser-session binding enabled." : "Browser-session binding disabled.");
    } catch (err: any) {
      message.error(err?.message || "Unable to update browser-session binding.");
      await load();
    } finally {
      setBindingSaving(false);
    }
  };

  const groupMenuItems = [
    { key: "ALL", label: "All groups" },
    ...groups.map((group) => ({ key: group, label: group })),
  ];

  if (!username) return <Alert type="warning" showIcon message="Please log in." />;

  return (
    <StepUpGuard username={username} resourceKey="stepup_policy.view">
      <div className="cm-page cm-stepup-page">
        <div className="cm-page-header cm-stepup-header">
          <div>
            <h1 className="cm-page-title">Step-up Policies</h1>
            <div className="cm-page-subtitle">
              Require recent verification before an administrator can open sensitive screens.
            </div>
          </div>
          <Button icon={<ReloadOutlined />} onClick={() => void load()} disabled={loading || saving}>
            Refresh
          </Button>
        </div>

        <Alert
          className="cm-stepup-intro"
          type="info"
          showIcon
          icon={<SafetyCertificateOutlined />}
          message="How this works"
          description="Selected screens require a recent step-up verification. Locked defaults are protected by the platform and cannot be removed. Changes below are not applied until you save the policy."
        />

        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

        <Spin spinning={loading}>
          <Space direction="vertical" size={16} style={{ width: "100%" }}>
            <Card className="cm-card cm-stepup-binding-card" bordered={false}>
              <div className="cm-stepup-binding-row">
                <div>
                  <Space size={8} align="center" wrap>
                    <Title level={5} style={{ margin: 0 }}>Bind verification to this browser session</Title>
                    <Tag color={binding === "Y" ? "green" : "default"}>
                      {binding === "Y" ? "Enabled" : "Disabled"}
                    </Tag>
                  </Space>
                  <Text type="secondary">
                    When enabled, a successful step-up verification is valid only in the browser session where it was completed.
                  </Text>
                </div>
                <Switch
                  checked={binding === "Y"}
                  onChange={toggleBinding}
                  loading={bindingSaving}
                  disabled={bindingSaving}
                />
              </div>
            </Card>

            <div className="cm-stepup-summary-grid">
              <Card className="cm-card cm-stepup-summary-card" bordered={false}>
                <Text type="secondary">Protected screens</Text>
                <div className="cm-stepup-summary-value">{selectedSet.size}</div>
                <Text type="secondary">of {screens.length} available</Text>
              </Card>
              <Card className="cm-card cm-stepup-summary-card" bordered={false}>
                <Text type="secondary">Locked defaults</Text>
                <div className="cm-stepup-summary-value">{locked.length}</div>
                <Text type="secondary">always protected</Text>
              </Card>
              <Card className="cm-card cm-stepup-summary-card" bordered={false}>
                <Text type="secondary">Optional protections</Text>
                <div className="cm-stepup-summary-value">{optionalProtectedCount}</div>
                <Text type="secondary">selected by administrator</Text>
              </Card>
              <Card className="cm-card cm-stepup-summary-card" bordered={false}>
                <Text type="secondary">Not protected</Text>
                <div className="cm-stepup-summary-value">{unprotectedCount}</div>
                <Text type="secondary">screens without step-up</Text>
              </Card>
            </div>

            <Card className="cm-card" bordered={false}>
              <Space direction="vertical" size={14} style={{ width: "100%" }}>
                <div className="cm-stepup-toolbar">
                  <div className="cm-stepup-search-shell">
                    <SearchOutlined className="cm-stepup-search-icon" />
                    <input
                      className="cm-stepup-search-input"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search screen, route or resource"
                      aria-label="Search step-up policy screens"
                    />
                  </div>

                  <Space wrap>
                    <Dropdown
                      menu={{
                        items: groupMenuItems,
                        selectable: true,
                        selectedKeys: [groupFilter],
                        onClick: ({ key }) => setGroupFilter(String(key)),
                      }}
                      trigger={["click"]}
                    >
                      <Button>
                        {groupFilter === "ALL" ? "All groups" : groupFilter} <DownOutlined />
                      </Button>
                    </Dropdown>

                    <Tooltip title="Show only screens that currently require step-up verification">
                      <Button
                        type={protectedOnly ? "primary" : "default"}
                        onClick={() => setProtectedOnly((value) => !value)}
                      >
                        {protectedOnly ? "Showing protected" : "Protected only"}
                      </Button>
                    </Tooltip>
                  </Space>
                </div>

                <div className="cm-stepup-bulkbar">
                  <Space wrap>
                    <Button onClick={protectVisible} disabled={!filtered.length}>
                      Protect all in current view
                    </Button>
                    <Button onClick={clearOptionalVisible} disabled={!filtered.length}>
                      Clear optional in current view
                    </Button>
                  </Space>
                  <Text type="secondary">
                    {filtered.length} screen{filtered.length === 1 ? "" : "s"} in current view
                  </Text>
                </div>

                <Table
                  rowKey="resource_key"
                  dataSource={filtered}
                  pagination={{ pageSize: 25, showSizeChanger: false, hideOnSinglePage: filtered.length <= 25 }}
                  columns={[
                    {
                      title: "Screen",
                      dataIndex: "label",
                      key: "label",
                      render: (value, row: StepupScreen) => (
                        <div>
                          <Text strong>{value}</Text>
                          <div className="cm-stepup-route">{row.route}</div>
                          <Tooltip title={row.resource_key}>
                            <Text type="secondary" className="cm-stepup-resource-key">{row.resource_key}</Text>
                          </Tooltip>
                        </div>
                      ),
                    },
                    {
                      title: "Area",
                      dataIndex: "group",
                      key: "group",
                      width: 190,
                      render: (value: string) => <Tag>{value}</Tag>,
                    },
                    {
                      title: "Protection",
                      key: "selected",
                      width: 210,
                      render: (_: unknown, row: StepupScreen) => {
                        const isLocked = lockedSet.has(row.resource_key);
                        const isSelected = selectedSet.has(row.resource_key);
                        return (
                          <div className="cm-stepup-protection-cell">
                            <Checkbox
                              checked={isSelected}
                              disabled={isLocked}
                              onChange={() => toggle(row.resource_key)}
                            >
                              Require step-up
                            </Checkbox>
                            {isLocked && <Tag color="blue">Locked default</Tag>}
                            {!isLocked && isSelected && <Tag color="green">Protected</Tag>}
                            {!isLocked && !isSelected && <Tag>Optional</Tag>}
                          </div>
                        );
                      },
                    },
                  ]}
                />

                <div className="cm-stepup-savebar">
                  <div>
                    {dirty ? (
                      <Space size={8} wrap>
                        <Tag color="orange">Unsaved changes</Tag>
                        <Text>{changedCount} screen{changedCount === 1 ? "" : "s"} changed</Text>
                      </Space>
                    ) : (
                      <Text type="secondary">Policy is up to date.</Text>
                    )}
                  </div>
                  <Space>
                    <Button onClick={discardChanges} disabled={!dirty || saving}>
                      Discard changes
                    </Button>
                    <Button
                      type="primary"
                      icon={<SaveOutlined />}
                      loading={saving}
                      disabled={!dirty}
                      onClick={save}
                    >
                      Save policy
                    </Button>
                  </Space>
                </div>
              </Space>
            </Card>
          </Space>
        </Spin>
      </div>
    </StepUpGuard>
  );
};

export default StepUpPoliciesPage;
