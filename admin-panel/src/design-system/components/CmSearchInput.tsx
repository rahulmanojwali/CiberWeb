import React from "react";
import { Input } from "antd";
import { SearchOutlined } from "@ant-design/icons";

export type CmSearchInputProps = {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  width?: number | string;
  disabled?: boolean;
  className?: string;
  ariaLabel?: string;
};

export const CmSearchInput: React.FC<CmSearchInputProps> = ({
  value,
  onChange,
  placeholder = "Search records",
  width = 380,
  disabled = false,
  className = "",
  ariaLabel = "Search",
}) => (
  <div className={`cm-command-search ${className}`.trim()} style={{ width, maxWidth: "100%" }}>
    <span className="cm-command-search__icon"><SearchOutlined /></span>
    <Input
      variant="borderless"
      allowClear
      value={value}
      onChange={(event) => onChange?.(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      aria-label={ariaLabel}
      className="cm-command-search__input"
    />
    <span className="cm-command-search__hint">Search</span>
  </div>
);

export default CmSearchInput;
