import React from "react";
import { Breadcrumb, Space, Typography } from "antd";
import type { BreadcrumbProps } from "antd";

const { Title, Text } = Typography;

type CmPageHeaderProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
  breadcrumbs?: BreadcrumbProps["items"];
  eyebrow?: React.ReactNode;
};

export const CmPageHeader: React.FC<CmPageHeaderProps> = ({
  title,
  subtitle,
  actions,
  breadcrumbs,
  eyebrow,
}) => (
  <header className="cm-ant-page-header">
    <div className="cm-ant-page-header-copy">
      {breadcrumbs && breadcrumbs.length > 0 && (
        <Breadcrumb className="cm-ant-page-breadcrumbs" items={breadcrumbs} />
      )}
      {eyebrow && <div className="cm-ant-page-eyebrow">{eyebrow}</div>}
      <Title level={1} className="cm-ant-page-title">
        {title}
      </Title>
      {subtitle && (
        <Text className="cm-ant-page-subtitle" type="secondary">
          {subtitle}
        </Text>
      )}
    </div>
    {actions && <Space className="cm-ant-page-actions" size={8} wrap>{actions}</Space>}
  </header>
);
