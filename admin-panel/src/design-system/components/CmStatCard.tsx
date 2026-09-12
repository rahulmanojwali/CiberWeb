import React from "react";
import { Card, Typography } from "antd";
import { ArrowRightOutlined } from "@ant-design/icons";

const { Text, Title } = Typography;

type CmStatCardProps = {
  label: React.ReactNode;
  value: React.ReactNode;
  helper?: React.ReactNode;
  icon?: React.ReactNode;
  onClick?: () => void;
  tone?: "olive" | "amber" | "neutral";
};

export const CmStatCard: React.FC<CmStatCardProps> = ({
  label,
  value,
  helper,
  icon,
  onClick,
  tone = "olive",
}) => (
  <Card
    className={`cm-ant-stat-card cm-ant-stat-card-${tone}${onClick ? " cm-ant-stat-card-clickable" : ""}`}
    bordered
    onClick={onClick}
  >
    <div className="cm-ant-stat-card-body">
      {icon && <div className="cm-ant-stat-card-icon">{icon}</div>}
      <div className="cm-ant-stat-card-copy">
        <Text className="cm-ant-stat-card-label">{label}</Text>
        <Title level={3} className="cm-ant-stat-card-value">{value}</Title>
        {helper && <Text className="cm-ant-stat-card-helper">{helper}</Text>}
      </div>
      {onClick && <ArrowRightOutlined className="cm-ant-stat-card-arrow" />}
    </div>
  </Card>
);
