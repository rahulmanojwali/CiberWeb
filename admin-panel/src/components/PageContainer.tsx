import React, { type FC, type ReactNode } from "react";
import { CmPageHeader } from "../design-system/components/CmPageHeader";

type PageContainerProps = Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & {
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
};

export const PageContainer: FC<PageContainerProps> = ({
  title,
  subtitle,
  actions,
  children,
  className,
  ...rest
}) => (
  <main className={`cm-page${className ? ` ${className}` : ""}`} {...rest}>
    {(title || subtitle || actions) && (
      <CmPageHeader title={title || ""} subtitle={subtitle} actions={actions} />
    )}
    {children}
  </main>
);
