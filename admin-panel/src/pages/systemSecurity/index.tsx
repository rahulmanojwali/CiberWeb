import React, { useMemo } from "react";
import { Alert, Button, Card, Space, Typography } from "antd";
import {
  KeyOutlined,
  SafetyCertificateOutlined,
  SecurityScanOutlined,
} from "@ant-design/icons";
import { Link } from "react-router-dom";

import { getStoredAdminUser } from "../../utils/session";

const { Text, Title } = Typography;

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
  const storedUser = useMemo(() => getStoredAdminUser(), []);
  if (!storedUser?.username) {
    return <Alert type="warning" showIcon message="Please log in." />;
  }

  return (
    <div className="cm-page">
      <div className="cm-page-header">
        <h1 className="cm-page-title">Security &amp; Access</h1>
        <div className="cm-page-subtitle">
          Central entry point for platform security controls.
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


      </Space>


    </div>
  );
};

export default SystemSecurityPage;
