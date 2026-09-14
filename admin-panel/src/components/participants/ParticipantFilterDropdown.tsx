import React from "react";
import { Button, Dropdown } from "antd";
import type { MenuProps } from "antd";
import { DownOutlined } from "@ant-design/icons";

export type ParticipantFilterOption = {
  value: string;
  label: string;
};

type Props = {
  value?: string;
  options: ParticipantFilterOption[];
  placeholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  allowClear?: boolean;
  clearLabel?: string;
};

export const ParticipantFilterDropdown: React.FC<Props> = ({
  value,
  options,
  placeholder,
  disabled = false,
  onChange,
  allowClear = false,
  clearLabel,
}) => {
  const selected = options.find((item) => item.value === value);

  const items: MenuProps["items"] = [
    ...(allowClear
      ? [{ key: "__CLEAR__", label: clearLabel || placeholder }]
      : []),
    ...options.map((item) => ({ key: item.value, label: item.label })),
  ];

  return (
    <Dropdown
      disabled={disabled}
      trigger={["click"]}
      placement="bottomLeft"
      menu={{
        items,
        selectable: true,
        selectedKeys: value ? [value] : allowClear ? ["__CLEAR__"] : [],
        onClick: ({ key }) => onChange(key === "__CLEAR__" ? "" : String(key)),
      }}
      getPopupContainer={(triggerNode) => triggerNode.parentElement || document.body}
    >
      <Button
        type="default"
        className="cm-participant-dropdown-trigger"
        disabled={disabled}
      >
        <span className={selected ? "cm-participant-dropdown-value" : "cm-participant-dropdown-placeholder"}>
          {selected?.label || placeholder}
        </span>
        <DownOutlined className="cm-participant-dropdown-arrow" />
      </Button>
    </Dropdown>
  );
};
