import React, { type ElementType, type FC } from "react";
import { Input, Select } from "antd";
import { CM_COLORS } from "../../design-system/theme/tokens";

type ChangeLike = { target: { value: any } };

type CMFilterFieldProps = {
  icon?: ElementType;
  select?: boolean;
  label?: React.ReactNode;
  value?: any;
  onChange?: (event: ChangeLike) => void;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
  type?: string;
  placeholder?: string;
  fullWidth?: boolean;
  required?: boolean;
  inputProps?: Record<string, any>;
  InputLabelProps?: Record<string, any>;
  InputProps?: Record<string, any>;
  sx?: any;
  [key: string]: any;
};

function childOptions(children: React.ReactNode) {
  return React.Children.toArray(children)
    .filter(React.isValidElement)
    .map((child: any) => ({
      value: child.props.value,
      label: child.props.children,
      disabled: Boolean(child.props.disabled),
    }));
}

export const CMFilterField: FC<CMFilterFieldProps> = ({
  icon: Icon,
  select,
  label,
  value,
  onChange,
  children,
  className = "",
  disabled,
  type = "text",
  placeholder,
  inputProps,
  InputLabelProps: _inputLabelProps,
  InputProps: _inputProps,
  sx: _sx,
  ...rest
}) => {
  const prefix = Icon ? <Icon style={{ color: CM_COLORS.textMuted, fontSize: 16 }} /> : undefined;
  const cls = `cm-filter-field-ant ${className}`.trim();

  return (
    <label className="cm-field cm-filter-field-wrap">
      {label != null && <span className="cm-field-label">{label}</span>}
      {select ? (
        <Select
          className={cls}
          value={value === "" ? "" : value}
          disabled={disabled}
          options={childOptions(children)}
          onChange={(next) => onChange?.({ target: { value: next } })}
          popupMatchSelectWidth={false}
          style={{ width: "100%" }}
          {...rest}
        />
      ) : (
        <Input
          className={cls}
          value={value ?? ""}
          disabled={disabled}
          type={type}
          placeholder={placeholder}
          prefix={prefix}
          onChange={(event) => onChange?.({ target: { value: event.target.value } })}
          {...inputProps}
          {...rest}
        />
      )}
    </label>
  );
};
