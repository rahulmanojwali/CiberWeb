import Chip, { type ChipProps } from "@mui/material/Chip";
import type { FC } from "react";

type CMStatusChipProps = Omit<ChipProps, "label"> & {
  label: string;
  tone?: "success" | "warning" | "danger" | "neutral" | "info";
};

const toneClass = {
  success: "cm-status-success",
  warning: "cm-status-warning",
  danger: "cm-status-danger",
  neutral: "cm-status-muted",
  info: "cm-status-info",
};

export const CMStatusChip: FC<CMStatusChipProps> = ({ label, tone = "neutral", className = "", ...props }) => {
  return <Chip size="small" label={label} className={`cm-status ${toneClass[tone]} ${className}`.trim()} {...props} />;
};
