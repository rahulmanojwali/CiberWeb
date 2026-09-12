import React from "react";
import { Card } from "antd";
import type { CardProps } from "antd";

type CmSectionCardProps = CardProps & {
  compact?: boolean;
};

export const CmSectionCard: React.FC<CmSectionCardProps> = ({
  compact = false,
  className,
  children,
  ...rest
}) => (
  <Card
    className={`cm-ant-section-card${compact ? " cm-ant-section-card-compact" : ""}${className ? ` ${className}` : ""}`}
    bordered
    {...rest}
  >
    {children}
  </Card>
);
