import React from "react";
import { Typography } from "@mui/material";
import { usePermissions } from "../authz/usePermissions";
import { PageContainer } from "./PageContainer";

type Props = {
  resourceKey: string;
  action?: string;
  children: React.ReactNode;
};

export const ProtectedRoute: React.FC<Props> = ({
  resourceKey,
  action = "VIEW",
  children,
}) => {
  const { can } = usePermissions();
  if (!can(resourceKey, action)) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view this page.</Typography>
      </PageContainer>
    );
  }
  return <>{children}</>;
};
