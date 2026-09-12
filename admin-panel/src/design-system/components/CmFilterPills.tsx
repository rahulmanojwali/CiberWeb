import React from "react";
import { Segmented } from "antd";

export type CmFilterPillOption = {
  label: React.ReactNode;
  value: string;
};

export const CmFilterPills: React.FC<{
  value: string;
  options: CmFilterPillOption[];
  onChange: (value: string) => void;
  className?: string;
}> = ({ value, options, onChange, className = "" }) => (
  <Segmented
    value={value}
    options={options}
    onChange={(next) => onChange(String(next))}
    className={`cm-filter-pills ${className}`.trim()}
  />
);

export default CmFilterPills;
