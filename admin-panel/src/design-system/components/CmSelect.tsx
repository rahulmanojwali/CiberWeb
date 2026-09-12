import React from "react";
import { Select } from "antd";
import type { SelectProps } from "antd";

export type CmSelectOption = { label: React.ReactNode; value: string | number; disabled?: boolean };
export type CmSelectProps = Omit<SelectProps, "options" | "onChange"> & {
  label?: React.ReactNode;
  help?: React.ReactNode;
  options: CmSelectOption[];
  onChange?: (value: any) => void;
  fullWidth?: boolean;
};

export const CmSelect: React.FC<CmSelectProps> = ({ label, help, options, onChange, fullWidth = true, className, ...rest }) => (
  <label className={fullWidth ? "cm-field cm-field-full" : "cm-field"}>
    {label != null && <span className="cm-field-label">{label}</span>}
    <Select
      {...rest}
      className={["cm-select", className || ""].filter(Boolean).join(" ")}
      options={options}
      onChange={onChange}
      popupMatchSelectWidth={false}
      style={{ width: fullWidth ? "100%" : rest.style?.width, ...rest.style }}
    />
    {help != null && <span className="cm-field-help">{help}</span>}
  </label>
);

export default CmSelect;
