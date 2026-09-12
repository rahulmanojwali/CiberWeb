import React from "react";
import { Input } from "antd";
import type { InputProps, TextAreaProps } from "antd/es/input";

export type CmInputProps = Omit<InputProps, "onChange"> & {
  label?: React.ReactNode;
  help?: React.ReactNode;
  value?: string | number | null;
  onChange?: (value: string) => void;
  multiline?: boolean;
  rows?: number;
  error?: boolean;
};

export const CmInput: React.FC<CmInputProps> = ({ label, help, value, onChange, multiline, rows = 3, error, className, ...rest }) => {
  const controlClass = ["cm-control", error ? "cm-control-error" : "", className || ""].filter(Boolean).join(" ");
  return (
    <label className="cm-field">
      {label != null && <span className="cm-field-label">{label}</span>}
      {multiline ? (
        <Input.TextArea
          {...(rest as TextAreaProps)}
          className={controlClass}
          value={value == null ? "" : String(value)}
          rows={rows}
          onChange={(e) => onChange?.(e.target.value)}
        />
      ) : (
        <Input
          {...rest}
          className={controlClass}
          value={value == null ? "" : String(value)}
          onChange={(e) => onChange?.(e.target.value)}
        />
      )}
      {help != null && <span className={error ? "cm-field-help cm-field-help-error" : "cm-field-help"}>{help}</span>}
    </label>
  );
};

export default CmInput;
