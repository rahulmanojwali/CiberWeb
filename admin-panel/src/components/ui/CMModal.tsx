import Dialog, { type DialogProps } from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import type { FC, ReactNode } from "react";

type CMModalProps = DialogProps & {
  title?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
};

export const CMModal: FC<CMModalProps> = ({ title, footer, children, ...props }) => {
  return (
    <Dialog fullWidth maxWidth="sm" {...props}>
      {title ? <DialogTitle>{title}</DialogTitle> : null}
      <DialogContent>{children}</DialogContent>
      {footer ? <DialogActions>{footer}</DialogActions> : null}
    </Dialog>
  );
};
