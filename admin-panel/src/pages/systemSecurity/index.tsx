import React, { useMemo, useState } from "react";
import { Alert, Button, Card, Modal, Space, Tag, Typography, message } from "antd";
import {
  BuildOutlined,
  KeyOutlined,
  SafetyCertificateOutlined,
  SecurityScanOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";

import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { repairSuperAdminPermissions } from "../../services/permissionRepairApi";
import { getStoredAdminUser } from "../../utils/session";
import { getUserRoleFromStorage } from "../../utils/roles";

const { Text, Title } = Typography;

function normalizeRole(role?: string | null) {
  const normalized = String(role || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
  return normalized === "SUPERADMIN" ? "SUPER_ADMIN" : normalized;
}

const SECURITY_AREAS = [
  {
    title: "Two-Factor Security",
    description: "Configure and verify Super Admin two-factor authentication settings.",
    path: "/system/security/2fa",
    icon: <KeyOutlined />,
  },
  {
    title: "Security Switches",
    description: "Control platform-wide security feature switches.",
    path: "/system/security/switches",
    icon: <SafetyCertificateOutlined />,
  },
  {
    title: "Step-up Policies",
    description: "Define which sensitive administrative actions require step-up verification.",
    path: "/system/security/stepup-policies",
    icon: <SecurityScanOutlined />,
  },
] as const;

const SystemSecurityPage: React.FC = () => {
  const adminUiConfig = useAdminUiConfig();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  const storedUser = useMemo(() => getStoredAdminUser(), []);
  const storageRole = getUserRoleFromStorage("SystemSecurity");
  const currentRole = normalizeRole(adminUiConfig.role || storageRole);
  const canRepair = currentRole === "SUPER_ADMIN";

  const handleRepair = async () => {
    if (!storedUser?.username || !canRepair || saving) return;
    setSaving(true);
    try {
      const response: any = await repairSuperAdminPermissions({
        username: storedUser.username,
        role: currentRole,
        country: storedUser.country,
        language: storedUser.language,
      });
      const resp = response?.response || response || {};
      if (String(resp?.responsecode ?? "") !== "0") {
        throw new Error(resp?.description || "Unable to repair permissions.");
      }
      messageApi.success(resp?.description || "Permissions repaired successfully.");
      await adminUiConfig.refresh?.({ invalidate: true });
      setConfirmOpen(false);
    } catch (err: any) {
      messageApi.error(err?.message || "Unable to repair permissions.");
    } finally {
      setSaving(false);
    }
  };

  if (!storedUser?.username) {
    return <Alert type="warning" showIcon message="Please log in." />;
  }

  return (
    <div className="cm-page">
      {contextHolder}
      <div className="cm-page-header">
        <h1 className="cm-page-title">Security &amp; Access</h1>
        <div className="cm-page-subtitle">
          Central entry point for platform security controls and Super Admin access repair.
        </div>
      </div>

      <Space direction="vertical" size={16} style={{ width: "100%" }}>
        <Alert
          type="info"
          showIcon
          message="System security controls"
          description="Use these controls for 2FA, platform security switches and step-up policies. They remain separate protected routes but no longer clutter the main System menu."
        />

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
            gap: 12,
          }}
        >
          {SECURITY_AREAS.map((area) => (
            <Card key={area.path} className="cm-card" size="small">
              <Space direction="vertical" size={10} style={{ width: "100%" }}>
                <Space>
                  {area.icon}
                  <Title level={5} style={{ margin: 0 }}>{area.title}</Title>
                </Space>
                <Text type="secondary">{area.description}</Text>
                <Link to={area.path}>
                  <Button>Open</Button>
                </Link>
              </Space>
            </Card>
          ))}
        </div>

        <Card className="cm-card" size="small">
          <Space direction="vertical" size={12} style={{ width: "100%" }}>
            <Space wrap>
              <BuildOutlined />
              <Title level={5} style={{ margin: 0 }}>RBAC Permission Repair</Title>
              <Tag>{currentRole || "UNKNOWN"}</Tag>
            </Space>
            <Text type="secondary">
              Emergency repair for Super Admin System-menu and core RBAC permissions. This is a recovery tool, not a normal role-management workflow.
            </Text>
            {!canRepair && (
              <Alert type="warning" showIcon message="Permission repair is available only to Super Admin." />
            )}
            <div>
              <Button
                type="primary"
                icon={<BuildOutlined />}
                disabled={!canRepair}
                loading={saving}
                onClick={() => setConfirmOpen(true)}
              >
                Repair Super Admin Permissions
              </Button>
            </div>
          </Space>
        </Card>
      </Space>

      <Modal
        title="Repair Super Admin Permissions?"
        open={confirmOpen}
        onCancel={() => !saving && setConfirmOpen(false)}
        okText="Repair Permissions"
        cancelText="Cancel"
        confirmLoading={saving}
        okButtonProps={{ disabled: !canRepair }}
        maskClosable={!saving}
        closable={!saving}
        onOk={handleRepair}
      >
        <Text type="secondary">
          This restores the required System Security, role-policy, resource-registry, mobile-dashboard and capacity-control permissions for the Super Admin role.
        </Text>
      </Modal>
    </div>
  );
};

export default SystemSecurityPage;
