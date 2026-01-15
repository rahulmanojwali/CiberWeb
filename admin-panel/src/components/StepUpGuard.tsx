import * as React from "react";
import { Box, CircularProgress, Typography } from "@mui/material";

import { useStepUp } from "../security/stepup/useStepUp";
import { resolveLockedStepupKey } from "../security/stepup/resolveLockedStepupKey";

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
  const { ensureStepUp, isLocked } = useStepUp();
  const [loading, setLoading] = React.useState(true);
  const [allowed, setAllowed] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    setLoading(true);
    setAllowed(false);

    (async () => {
      const stepupKey = resolveLockedStepupKey(resourceKey, isLocked) || resourceKey;
      const route = typeof window !== "undefined" ? window.location.pathname : "";
      console.log("[STEPUP_NAV]", `route=${route}`, `key=${resourceKey || "none"}`, `locked=${Boolean(stepupKey)}`);
      console.log("[REQUIRE_SETUP]", `called=true configured=${Boolean(stepupKey)}`, `key=${stepupKey || "none"}`);
      const ok = await ensureStepUp(stepupKey, action, { source: "GUARD" });
      if (!active) return;
      setAllowed(ok);
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [ensureStepUp, isLocked, resourceKey, action]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  if (!allowed) {
    return (
      <Box
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 2,
          p: 3,
          mt: 2,
        }}
      >
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Forbidden</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          You don’t have permission to view this module.
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Required: {resourceKey || "unknown"} · Action: {action}
        </Typography>
      </Box>
    );
  }

  return <>{children}</>;
};


// import * as React from "react";
// import { Box, CircularProgress } from "@mui/material";

// import { useStepUp } from "../security/stepup/useStepUp";

// type StepUpGuardProps = {
//   username?: string | null;
//   resourceKey?: string;
//   action?: string;
//   children: React.ReactNode;
// };


// export const StepUpGuard: React.FC<StepUpGuardProps> = ({
//   resourceKey,
//   action = "VIEW",
//   children,
// }) => {
//   const { ensureStepUp } = useStepUp();
//   const [loading, setLoading] = React.useState(true);
//   const [allowed, setAllowed] = React.useState(false);

//   React.useEffect(() => {
//     let active = true;
//     setLoading(true);
//     setAllowed(false);

//     (async () => {
//       const ok = await ensureStepUp(resourceKey, action, { source: "GUARD" });
//       if (!active) return;
//       setAllowed(ok);
//       setLoading(false);
//     })();

//     return () => {
//       active = false;
//     };
//   }, [ensureStepUp, resourceKey, action]);

//   if (loading) {
//     return (
//       <Box display="flex" justifyContent="center" py={6}>
//         <CircularProgress />
//       </Box>
//     );
//   }

//   if (!allowed) {
//     return null;
//   }

//   return <>{children}</>;
// };
