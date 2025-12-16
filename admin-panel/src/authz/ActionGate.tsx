import React from "react";
import { usePermissions } from "./usePermissions";
import { useRecordLock } from "./isRecordLocked";

type Props = {
  resourceKey: string;
  action: string;
  record?: any;
  hideIfLocked?: boolean;
  children: React.ReactNode;
};

export const ActionGate: React.FC<Props> = ({ resourceKey, action, record, hideIfLocked = true, children }) => {
  const { can, authContext, isSuper } = usePermissions();
  const { isRecordLocked } = useRecordLock();

  const allowed = can(resourceKey, action);
  if (!allowed) return null;

  if (record && hideIfLocked) {
    const { locked } = isRecordLocked(record, { ...authContext, isSuper });
    if (locked) return null;
  }

  return <>{children}</>;
};
