import Button, { type ButtonProps } from "@mui/material/Button";
import type { FC } from "react";

type CMActionButtonProps = ButtonProps;

export const CMActionButton: FC<CMActionButtonProps> = ({ className = "", size = "small", ...props }) => {
  return <Button size={size} className={`cm-btn ${className}`.trim()} {...props} />;
};
