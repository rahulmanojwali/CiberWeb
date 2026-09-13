import * as React from "react";
import { Link as RouterLink } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  Divider,
  Input,
  Space,
  Tag,
  Typography,
  theme,
} from "antd";
import {
  ArrowLeftOutlined,
  MailOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  UserOutlined,
} from "@ant-design/icons";

import {
  BRAND_ASSETS,
  DEFAULT_COUNTRY,
  DEFAULT_LANGUAGE,
  APP_STRINGS,
} from "../../config/appConfig";
import { requestAdminPasswordReset } from "../../services/adminUsersApi";

export const ForgotPassword: React.FC = () => {
  const { token: themeToken } = theme.useToken();
  const [username, setUsername] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    document.title = `${APP_STRINGS.title} – Forgot Password`;
  }, []);

  const handleSubmit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (loading || submitted) return;

    setError(null);
    const target = username.trim();
    if (!target) {
      setError("Enter your administrator username.");
      return;
    }

    setLoading(true);
    try {
      await requestAdminPasswordReset({
        username: target,
        target_username: target,
        language: DEFAULT_LANGUAGE,
        country: DEFAULT_COUNTRY,
      });
      setSubmitted(true);
    } catch (err: any) {
      // Do not reveal whether a username exists. Only transport/unexpected failures
      // are surfaced as a generic retry message.
      console.error("Failed to send forgot password request", err);
      setError("We could not submit the request right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const startAgain = () => {
    setSubmitted(false);
    setError(null);
    setUsername("");
  };

  return (
    <div
      className="cm-forgot-password-page"
      style={{
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${themeToken.colorBgLayout} 0%, #F7F5EF 100%)`,
        padding: "32px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 470 }}>
        <div style={{ textAlign: "center", marginBottom: 18 }}>
          <img
            src={BRAND_ASSETS.logo}
            alt="CiberMandi"
            style={{ height: 48, width: "auto", marginBottom: 10 }}
          />
          <Typography.Text
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: themeToken.colorTextSecondary,
            }}
          >
            CiberMandi Operations Console
          </Typography.Text>
        </div>

        <Card
          bordered
          styles={{ body: { padding: 28 } }}
          style={{
            borderRadius: 18,
            boxShadow: "0 18px 45px rgba(31, 41, 55, 0.10)",
            borderColor: themeToken.colorBorderSecondary,
          }}
        >
          <Space direction="vertical" size={18} style={{ width: "100%" }}>
            <div>
              <Tag
                icon={<SafetyCertificateOutlined />}
                color="success"
                style={{ marginBottom: 12, borderRadius: 999, paddingInline: 10 }}
              >
                Secure account recovery
              </Tag>

              <Typography.Title level={2} style={{ margin: 0, fontSize: 27 }}>
                {submitted ? "Check your email" : "Forgot your password?"}
              </Typography.Title>

              <Typography.Paragraph
                type="secondary"
                style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.6 }}
              >
                {submitted
                  ? "If the username matches an active administrator account, a secure reset link has been sent to the registered email address."
                  : "Enter your administrator username and we’ll send a one-time password reset link to the registered email address."}
              </Typography.Paragraph>
            </div>

            {submitted ? (
              <>
                <Alert
                  type="success"
                  showIcon
                  message="Reset request received"
                  description="For security, we do not confirm whether a username exists. Please check the registered inbox and spam folder for the reset email."
                />

                <div
                  style={{
                    padding: "13px 14px",
                    borderRadius: 10,
                    background: themeToken.colorFillAlter,
                    border: `1px solid ${themeToken.colorBorderSecondary}`,
                  }}
                >
                  <Space align="start" size={10}>
                    <MailOutlined style={{ color: themeToken.colorPrimary, marginTop: 3 }} />
                    <div>
                      <Typography.Text strong style={{ display: "block", fontSize: 13 }}>
                        What happens next
                      </Typography.Text>
                      <Typography.Text type="secondary" style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                        Open the email, choose the secure reset link, and create a new password. Reset links expire and can be used only once.
                      </Typography.Text>
                    </div>
                  </Space>
                </div>

                <RouterLink to="/login" style={{ display: "block" }}>
                  <Button type="primary" size="large" block icon={<ArrowLeftOutlined />}>
                    Back to sign in
                  </Button>
                </RouterLink>

                <Button type="text" block onClick={startAgain}>
                  Use another username
                </Button>
              </>
            ) : (
              <form onSubmit={(event) => void handleSubmit(event)} noValidate>
                <Space direction="vertical" size={16} style={{ width: "100%" }}>
                  <div>
                    <Typography.Text strong>Administrator username</Typography.Text>
                    <Input
                      className="cm-forgot-password-input"
                      size="large"
                      value={username}
                      onChange={(event) => {
                        setUsername(event.target.value);
                        if (error) setError(null);
                      }}
                      disabled={loading}
                      autoFocus
                      autoComplete="username"
                      placeholder="Enter your username"
                      prefix={<UserOutlined />}
                      status={error ? "error" : undefined}
                      onPressEnter={() => {
                        if (!loading) void handleSubmit();
                      }}
                      style={{ marginTop: 7 }}
                    />
                  </div>

                  {error && <Alert type="error" showIcon message={error} />}

                  <Button
                    htmlType="submit"
                    type="primary"
                    size="large"
                    block
                    loading={loading}
                    icon={<SendOutlined />}
                  >
                    Send secure reset link
                  </Button>
                </Space>
              </form>
            )}

            <Divider style={{ margin: "2px 0" }} />

            <div style={{ textAlign: "center" }}>
              {!submitted && (
                <RouterLink to="/login">
                  <Typography.Link>
                    <ArrowLeftOutlined style={{ marginRight: 6 }} />
                    Back to sign in
                  </Typography.Link>
                </RouterLink>
              )}
              <Typography.Text
                type="secondary"
                style={{ display: "block", marginTop: submitted ? 0 : 10, fontSize: 12.5 }}
              >
                Your account remains protected. CiberMandi never sends passwords by email.
              </Typography.Text>
            </div>
          </Space>
        </Card>
      </div>
    </div>
  );
};
