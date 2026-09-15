import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Space, Spin, Switch, Tag, Typography, message } from "antd";
import { ReloadOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { getSecuritySwitches, updateSecuritySwitches } from "../../services/security/securitySwitchService";
import { getStoredAdminUser } from "../../utils/session";
import { usePermissions } from "../../authz/usePermissions";
import { StepUpGuard } from "../../components/StepUpGuard";

const { Paragraph, Text, Title } = Typography;

const SecuritySwitchesPage: React.FC = () => {
  const [bindingState, setBindingState] = useState<"Y" | "N">("N");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [meta, setMeta] = useState<{ version?: number; updated_on?: string | null; updated_by?: string | null }>({});
  const { can } = usePermissions();
  const canUpdate = can("security_switches.update", "UPDATE");
  const canView = can("security_switches.view", "VIEW");
  const username = useMemo(() => getStoredAdminUser()?.username || "", []);

  const load = useCallback(async () => {
    if (!username) return;
    setLoading(true);
    setError("");
    try {
      const resp: any = await getSecuritySwitches({ username });
      const response = resp?.response || resp?.data?.response;
      if (response?.responsecode && response.responsecode !== "0") {
        throw new Error(response.description || "Unable to load security switches.");
      }
      const value =
        resp?.switches?.STEPUP_BROWSER_SESSION_BINDING ||
        resp?.data?.switches?.STEPUP_BROWSER_SESSION_BINDING ||
        resp?.response?.switches?.STEPUP_BROWSER_SESSION_BINDING ||
        "N";
      const metadata =
        resp?.metadata?.STEPUP_BROWSER_SESSION_BINDING ||
        resp?.data?.metadata?.STEPUP_BROWSER_SESSION_BINDING ||
        {};
      setBindingState(value === "Y" ? "Y" : "N");
      setMeta(metadata);
    } catch (err: any) {
      setError(err?.message || "Unable to load security switches.");
    } finally {
      setLoading(false);
    }
  }, [username]);

  useEffect(() => { void load(); }, [load]);

  const update = async (checked: boolean) => {
    if (!username || !canUpdate) return;
    const next: "Y" | "N" = checked ? "Y" : "N";
    setSaving(true);
    try {
      const resp: any = await updateSecuritySwitches({
        username,
        switches: { STEPUP_BROWSER_SESSION_BINDING: next },
      });
      const response = resp?.response || resp?.data?.response;
      if (response?.responsecode !== "0") {
        throw new Error(response?.description || "Unable to update security switch.");
      }
      setBindingState(next);
      message.success("Security switch updated.");
      await load();
    } catch (err: any) {
      message.error(err?.message || "Unable to update security switch.");
      await load();
    } finally {
      setSaving(false);
    }
  };

  if (!username) return <Alert type="warning" showIcon message="Please log in." />;
  if (!canView) return <Alert type="error" showIcon message="You do not have permission to view Security Switches." />;

  return (
    <StepUpGuard username={username} resourceKey="security_switches.menu">
      <div className="cm-page">
        <div className="cm-page-header">
          <h1 className="cm-page-title">Security Switches</h1>
          <div className="cm-page-subtitle">Platform-wide enforcement controls. Changes require permission and step-up verification.</div>
        </div>

        {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

        <Card className="cm-card" bordered={false}>
          <Spin spinning={loading}>
            <Space direction="vertical" size={16} style={{ width: "100%" }}>
              <Space style={{ width: "100%", justifyContent: "space-between" }} align="start">
                <Space align="start">
                  <SafetyCertificateOutlined style={{ fontSize: 22 }} />
                  <div>
                    <Title level={5} style={{ margin: 0 }}>Bind Step-Up to Browser Session</Title>
                    <Paragraph type="secondary" style={{ margin: "4px 0 0" }}>
                      When enabled, a valid step-up session is bound to the current browser session. Closing or changing the browser session requires fresh verification.
                    </Paragraph>
                  </div>
                </Space>
                <Tag color={bindingState === "Y" ? "green" : "default"}>{bindingState === "Y" ? "Enabled" : "Disabled"}</Tag>
              </Space>

              <Space style={{ width: "100%", justifyContent: "space-between" }}>
                <div>
                  <Text strong>Enforcement</Text>
                  <br />
                  <Text type="secondary">
                    {canUpdate ? "Toggle requires a valid step-up session and is audited." : "You have view-only access."}
                  </Text>
                </div>
                <Switch checked={bindingState === "Y"} onChange={update} loading={saving} disabled={loading || saving || !canUpdate} />
              </Space>

              {(meta.version || meta.updated_on || meta.updated_by) && (
                <Text type="secondary">
                  Version {meta.version || "—"} · Updated {meta.updated_on ? new Date(meta.updated_on).toLocaleString() : "—"} by {meta.updated_by || "—"}
                </Text>
              )}

              <div>
                <Button icon={<ReloadOutlined />} onClick={() => void load()} disabled={loading || saving}>Refresh status</Button>
              </div>
            </Space>
          </Spin>
        </Card>
      </div>
    </StepUpGuard>
  );
};

export default SecuritySwitchesPage;
