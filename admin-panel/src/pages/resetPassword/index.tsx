import React, { useMemo, useState } from "react";
import { Link as RouterLink, useSearchParams } from "react-router-dom";
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
  ArrowRightOutlined,
  CheckCircleOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";
import { useTranslation } from "react-i18next";

import { confirmAdminPasswordReset } from "../../services/adminUsersApi";
import {
  BRAND_ASSETS,
  DEFAULT_COUNTRY,
  DEFAULT_LANGUAGE,
} from "../../config/appConfig";

const MIN_PASSWORD_LENGTH = 8;

type ResetStatus = "idle" | "success" | "error";

export const ResetPasswordPage: React.FC = () => {
  const { t } = useTranslation();
  const { token: themeToken } = theme.useToken();
  const [searchParams] = useSearchParams();
  const token = (searchParams.get("token") || "").trim();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<ResetStatus>("idle");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const hasMinimumLength = password.length >= MIN_PASSWORD_LENGTH;
  const passwordsMatch = Boolean(password && confirmPassword && password === confirmPassword);

  const canSubmit = useMemo(
    () => Boolean(token && hasMinimumLength && passwordsMatch && status !== "success"),
    [token, hasMinimumLength, passwordsMatch, status],
  );

  const handleSubmit = async () => {
    if (!token) {
      setStatus("error");
      setMessage(t("resetPasswordPage.messages.invalidToken"));
      return;
    }
    if (!hasMinimumLength) {
      setStatus("error");
      setMessage(t("resetPasswordPage.messages.passwordTooShort", { min: MIN_PASSWORD_LENGTH }));
      return;
    }
    if (!passwordsMatch) {
      setStatus("error");
      setMessage(t("resetPasswordPage.messages.passwordMismatch"));
      return;
    }

    try {
      setLoading(true);
      setStatus("idle");
      setMessage("");
      const res = await confirmAdminPasswordReset({
        token,
        new_password: password,
        language: DEFAULT_LANGUAGE,
        country: DEFAULT_COUNTRY,
      });
      const resp = res?.response || {};

      if (String(resp.responsecode ?? "") !== "0") {
        setStatus("error");
        setMessage(resp.description || t("resetPasswordPage.messages.invalidToken"));
      } else {
        setStatus("success");
        setMessage(t("resetPasswordPage.messages.success"));
      }
    } catch (err: any) {
      setStatus("error");
      setMessage(err?.message || t("resetPasswordPage.messages.unexpectedError"));
    } finally {
      setLoading(false);
    }
  };

  const requirementRow = (met: boolean, text: string) => (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        color: met ? themeToken.colorSuccess : themeToken.colorTextSecondary,
        fontSize: 13,
      }}
    >
      <CheckCircleOutlined />
      <span>{text}</span>
    </div>
  );

  return (
    <div
      className="cm-reset-password-page"
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
                Secure password reset
              </Tag>
              <Typography.Title level={2} style={{ margin: 0, fontSize: 27 }}>
                {t("resetPasswordPage.title")}
              </Typography.Title>
              <Typography.Paragraph
                type="secondary"
                style={{ margin: "8px 0 0", fontSize: 15, lineHeight: 1.6 }}
              >
                {t("resetPasswordPage.subtitle")}
              </Typography.Paragraph>
            </div>

            {!token && (
              <Alert
                type="error"
                showIcon
                message={t("resetPasswordPage.messages.invalidToken")}
                description={t("resetPasswordPage.messages.requestNewLink", {
                  defaultValue: "Request a new reset link from the sign-in page or contact your administrator.",
                })}
              />
            )}

            {status !== "idle" && token && (
              <Alert
                type={status === "success" ? "success" : "error"}
                showIcon
                message={message}
                description={
                  status === "success"
                    ? t("resetPasswordPage.messages.successDetail", {
                        defaultValue: "Your new password is active. You can now return to sign in.",
                      })
                    : undefined
                }
              />
            )}

            {status !== "success" && (
              <>
                <div>
                  <Typography.Text strong>
                    {t("resetPasswordPage.fields.newPassword")}
                  </Typography.Text>
                  <Input.Password
                    className="cm-reset-password-input"
                    prefix={<LockOutlined />}
                    size="large"
                    autoComplete="new-password"
                    placeholder={t("resetPasswordPage.fields.newPasswordPlaceholder", {
                      defaultValue: "Enter a new password",
                    })}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (status === "error") {
                        setStatus("idle");
                        setMessage("");
                      }
                    }}
                    disabled={!token || loading}
                    style={{ marginTop: 7 }}
                  />
                </div>

                <div>
                  <Typography.Text strong>
                    {t("resetPasswordPage.fields.confirmPassword")}
                  </Typography.Text>
                  <Input.Password
                    className="cm-reset-password-input"
                    prefix={<LockOutlined />}
                    size="large"
                    autoComplete="new-password"
                    placeholder={t("resetPasswordPage.fields.confirmPasswordPlaceholder", {
                      defaultValue: "Re-enter the new password",
                    })}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (status === "error") {
                        setStatus("idle");
                        setMessage("");
                      }
                    }}
                    disabled={!token || loading}
                    status={confirmPassword && !passwordsMatch ? "error" : undefined}
                    onPressEnter={() => {
                      if (canSubmit && !loading) void handleSubmit();
                    }}
                    style={{ marginTop: 7 }}
                  />
                </div>

                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 10,
                    background: themeToken.colorFillAlter,
                    border: `1px solid ${themeToken.colorBorderSecondary}`,
                  }}
                >
                  <Space direction="vertical" size={7}>
                    <Typography.Text strong style={{ fontSize: 13 }}>
                      Password requirements
                    </Typography.Text>
                    {requirementRow(
                      hasMinimumLength,
                      t("resetPasswordPage.requirements.minimumLength", {
                        defaultValue: `At least ${MIN_PASSWORD_LENGTH} characters`,
                        min: MIN_PASSWORD_LENGTH,
                      }),
                    )}
                    {requirementRow(
                      passwordsMatch,
                      t("resetPasswordPage.requirements.passwordsMatch", {
                        defaultValue: "Both password entries match",
                      }),
                    )}
                  </Space>
                </div>

                <Button
                  type="primary"
                  size="large"
                  block
                  loading={loading}
                  disabled={!canSubmit}
                  onClick={() => void handleSubmit()}
                  icon={<SafetyCertificateOutlined />}
                >
                  {t("resetPasswordPage.actions.submit")}
                </Button>
              </>
            )}

            {status === "success" && (
              <RouterLink to="/login" style={{ display: "block" }}>
                <Button
                  type="primary"
                  size="large"
                  block
                  icon={<ArrowRightOutlined />}
                >
                  {t("resetPasswordPage.actions.goToLogin")}
                </Button>
              </RouterLink>
            )}

            <Divider style={{ margin: "2px 0" }} />

            <div style={{ textAlign: "center" }}>
              <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
                {t("resetPasswordPage.securityNote", {
                  defaultValue: "For your security, reset links expire and can be used only once.",
                })}
              </Typography.Text>
            </div>
          </Space>
        </Card>
      </div>
    </div>
  );
};
