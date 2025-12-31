import * as React from "react";
import { Box, CircularProgress } from "@mui/material";

import { useStepUp } from "../security/stepup/useStepUp";

type StepUpGuardProps = {
  username?: string | null;
  resourceKey?: string;
  action?: string;
  children: React.ReactNode;
};


export const StepUpGuard: React.FC<StepUpGuardProps> = ({
  resourceKey,
  action = "VIEW",
  children,
}) => {
  const { ensureStepUp } = useStepUp();
  const [loading, setLoading] = React.useState(true);
  const [allowed, setAllowed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setAllowed(false);

    (async () => {
      const ok = await ensureStepUp(resourceKey, action, { source: "GUARD" });
      if (!active) return;
      setAllowed(ok);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [ensureStepUp, resourceKey, action]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
};
