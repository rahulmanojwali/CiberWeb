import React, { useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Divider, Input, Modal, Radio, Space, Spin, Tag, Typography, message } from "antd";
import { KeyOutlined, ReloadOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { enableStepUp, getStepUpSetup, getStepUpStatus, rotateStepUp } from "../../../services/adminUsersApi";
import { getStoredAdminUser } from "../../../utils/session";

const { Paragraph, Text, Title } = Typography;

type SetupPayload = {
  provisioning_uri: string;
  secret_base32: string;
  challenge_id: string;
};

const TwoFactorSettings: React.FC = () => {
  const username = useMemo(() => getStoredAdminUser()?.username || "", []);
  const [setup, setSetup] = useState<SetupPayload | null>(null);
  const [otp, setOtp] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [statusInfo, setStatusInfo] = useState({ enabled: "N", enforcement_mode: "OPTIONAL", last_verified_on: null as string | null });
  const [error, setError] = useState("");
  const [rotateOpen, setRotateOpen] = useState(false);
  const [rotateMode, setRotateMode] = useState<"otp" | "backup">("otp");
  const [rotateCode, setRotateCode] = useState("");

  const loadStatus = async () => {
    if (!username) return;
    setLoading(true);
    setError("");
    try {
      const resp: any = await getStepUpStatus({ username });
      const response = resp?.response || resp?.data?.response;
      if (response?.responsecode && response.responsecode !== "0") throw new Error(response.description || "Unable to load 2FA status.");
      const payload = resp?.stepup?.stepup || resp?.stepup || resp?.data?.stepup || {};
      const flag = payload.enabled === "Y" ? "Y" : "N";
      setEnabled(flag === "Y");
      setStatusInfo({
        enabled: flag,
        enforcement_mode: payload.enforcement_mode || "OPTIONAL",
        last_verified_on: payload.last_verified_on || null,
      });
    } catch (err: any) {
      setError(err?.message || "Unable to load 2FA status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadStatus(); }, [username]);

  const startSetup = async () => {
    setWorking(true);
    try {
      const resp: any = await getStepUpSetup({ username, target_username: username });
      const response = resp?.response || resp?.data?.response;
      if (response?.responsecode !== "0") throw new Error(response?.description || "Unable to start 2FA setup.");
      const payload = resp?.stepup || resp?.setup || resp?.data?.stepup || null;
      if (!payload?.challenge_id || !payload?.provisioning_uri) throw new Error("2FA setup response is incomplete.");
      setSetup(payload);
      setOtp("");
      setBackupCodes([]);
    } catch (err: any) {
      message.error(err?.message || "Unable to start 2FA setup.");
    } finally {
      setWorking(false);
    }
  };

  const enable = async () => {
    if (!setup || otp.length !== 6) return;
    setWorking(true);
    try {
      const resp: any = await enableStepUp({ username, challenge_id: setup.challenge_id, otp });
      const response = resp?.response || resp?.data?.response;
      if (response?.responsecode !== "0") throw new Error(response?.description || "OTP verification failed.");
      const codes = resp?.stepup?.backup_codes || resp?.backup_codes || resp?.data?.backup_codes || [];
      setBackupCodes(Array.isArray(codes) ? codes : []);
      setSetup(null);
      setOtp("");
      message.success("Two-factor authentication enabled.");
      await loadStatus();
    } catch (err: any) {
      message.error(err?.message || "OTP verification failed.");
    } finally {
      setWorking(false);
    }
  };

  const rotate = async () => {
    setWorking(true);
    try {
      const sessionId = typeof window !== "undefined" ? localStorage.getItem("cm_stepup_session_id") || undefined : undefined;
      if (!sessionId) throw new Error("A valid step-up session is required before reconfiguring 2FA.");
      const resp: any = await rotateStepUp({
        username,
        session_id: sessionId,
        otp: rotateMode === "otp" ? rotateCode : undefined,
        backup_code: rotateMode === "backup" ? rotateCode : undefined,
      });
      const response = resp?.response || resp?.data?.response;
      if (response?.responsecode !== "0") throw new Error(response?.description || "Unable to reconfigure 2FA.");
      const payload = resp?.stepup?.stepup || resp?.stepup || null;
      setRotateOpen(false);
      setRotateCode("");
      setSetup(payload);
      setEnabled(false);
      setBackupCodes([]);
      message.success("2FA reconfiguration started. Complete setup with the new authenticator secret.");
      await loadStatus();
    } catch (err: any) {
      message.error(err?.message || "Unable to reconfigure 2FA.");
    } finally {
      setWorking(false);
    }
  };

  if (!username) return <Alert type="warning" showIcon message="Please log in." />;

  const qrSrc = setup
    ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(setup.provisioning_uri)}`
    : "";

  return (
    <div className="cm-page">
      <div className="cm-page-header">
        <h1 className="cm-page-title">Two-Factor Authentication (2FA)</h1>
        <div className="cm-page-subtitle">Authenticator-based verification for sensitive administrative operations.</div>
      </div>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 16 }} />}

      <Spin spinning={loading}>
        <Space direction="vertical" size={16} style={{ width: "100%" }}>
          <Card className="cm-card" bordered={false}>
            <Space style={{ width: "100%", justifyContent: "space-between", flexWrap: "wrap" }} align="start">
              <Space align="start">
                <SafetyCertificateOutlined style={{ fontSize: 22 }} />
                <div>
                  <Title level={5} style={{ margin: 0 }}>Current status</Title>
                  <Text type="secondary">Enforcement: {statusInfo.enforcement_mode}</Text>
                  <br />
                  <Text type="secondary">Last verified: {statusInfo.last_verified_on ? new Date(statusInfo.last_verified_on).toLocaleString() : "Never"}</Text>
                </div>
              </Space>
              <Tag color={enabled ? "green" : "orange"}>{enabled ? "Enabled" : "Not configured"}</Tag>
            </Space>
            <Divider />
            <Space wrap>
              {!enabled && <Button type="primary" icon={<KeyOutlined />} loading={working} onClick={startSetup}>Start setup</Button>}
              {enabled && <Button icon={<ReloadOutlined />} loading={working} onClick={() => setRotateOpen(true)}>Reconfigure 2FA</Button>}
              <Button onClick={() => void loadStatus()} disabled={working}>Refresh status</Button>
            </Space>
          </Card>

          {setup && (
            <Card className="cm-card" bordered={false} title="Complete authenticator setup">
              <Space direction="vertical" size={16} style={{ width: "100%" }}>
                <Alert type="warning" showIcon message="Store the authenticator secret securely. Do not share it." />
                <div style={{ display: "grid", gridTemplateColumns: "minmax(220px, auto) 1fr", gap: 24, alignItems: "start" }}>
                  <div>
                    <img src={qrSrc} width={220} height={220} alt="Authenticator QR code" style={{ display: "block", maxWidth: "100%" }} />
                  </div>
                  <Space direction="vertical" size={12} style={{ width: "100%" }}>
                    <div><Text strong>Manual setup key</Text><Paragraph copyable code style={{ marginTop: 6 }}>{setup.secret_base32}</Paragraph></div>
                    <div>
                      <Text strong>6-digit authenticator code</Text>
                      <Input
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        maxLength={6}
                        inputMode="numeric"
                        placeholder="Enter 6-digit code"
                        style={{ maxWidth: 260, marginTop: 6 }}
                      />
                    </div>
                    <Button type="primary" onClick={enable} loading={working} disabled={otp.length !== 6}>Verify and enable</Button>
                  </Space>
                </div>
              </Space>
            </Card>
          )}

          {backupCodes.length > 0 && (
            <Card className="cm-card" bordered={false} title="Backup codes">
              <Alert type="success" showIcon message="2FA is enabled. Save these one-time backup codes now." style={{ marginBottom: 12 }} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
                {backupCodes.map((code) => <Text key={code} copyable code>{code}</Text>)}
              </div>
            </Card>
          )}
        </Space>
      </Spin>

      <Modal
        open={rotateOpen}
        title="Reconfigure two-factor authentication"
        onCancel={() => { if (!working) { setRotateOpen(false); setRotateCode(""); } }}
        onOk={rotate}
        okText="Continue"
        confirmLoading={working}
        okButtonProps={{ disabled: rotateMode === "otp" ? rotateCode.length !== 6 : !rotateCode.trim() }}
        destroyOnClose
      >
        <Alert type="warning" showIcon message="This starts rotation of your current authenticator configuration." style={{ marginBottom: 16 }} />
        <Radio.Group value={rotateMode} onChange={(e) => { setRotateMode(e.target.value); setRotateCode(""); }}>
          <Radio.Button value="otp">Authenticator code</Radio.Button>
          <Radio.Button value="backup">Backup code</Radio.Button>
        </Radio.Group>
        <div style={{ marginTop: 16 }}>
          <Input
            value={rotateCode}
            onChange={(e) => setRotateCode(rotateMode === "otp" ? e.target.value.replace(/\D/g, "").slice(0, 6) : e.target.value)}
            maxLength={rotateMode === "otp" ? 6 : undefined}
            placeholder={rotateMode === "otp" ? "6-digit authenticator code" : "One-time backup code"}
          />
        </div>
      </Modal>
    </div>
  );
};

export default TwoFactorSettings;
