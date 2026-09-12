import React from "react";
import { Card, Space, Typography } from "antd";
import type { CardProps } from "antd";

type CmSectionCardProps = CardProps & {
  compact?: boolean;
  subtitle?: React.ReactNode;
};

export const CmSectionCard: React.FC<CmSectionCardProps> = ({
  compact = false,
  className,
  children,
  title,
  subtitle,
  ...rest
}) => (
  <Card
    className={`cm-ant-section-card${compact ? " cm-ant-section-card-compact" : ""}${className ? ` ${className}` : ""}`}
    bordered
    title={
      subtitle ? (
        <Space direction="vertical" size={0}>
          <span>{title}</span>
          <Typography.Text type="secondary" style={{ fontWeight: 400 }}>
            {subtitle}
          </Typography.Text>
        </Space>
      ) : (
        title
      )
    }
    {...rest}
  >
    {children}
  </Card>
);
