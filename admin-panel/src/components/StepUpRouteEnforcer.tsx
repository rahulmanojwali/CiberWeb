import * as React from "react";
import { Box, CircularProgress } from "@mui/material";
import { useLocation, useNavigate } from "react-router-dom";

import { canonicalizeResourceKey, type UiResource } from "../utils/adminUiConfig";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { useStepUp } from "../security/stepup/useStepUp";

const normalizePath = (value?: string | null) => {
  if (!value) return "";
  const sanitized = value.split("?")[0].replace(/\\+/g, "/");
  return sanitized === "/" ? "/" : sanitized.replace(/\/+$/, "");
};

const matchesRoutePattern = (pattern?: string | null, target?: string) => {
  if (!pattern || !target) return false;
  const normalizedPattern = normalizePath(pattern);
  const normalizedTarget = normalizePath(target);
  if (!normalizedPattern || !normalizedTarget) return false;
  if (normalizedPattern === normalizedTarget) return true;
  if (
    normalizedPattern !== "/" &&
    normalizedTarget.startsWith(`${normalizedPattern}/`)
  ) {
    return true;
  }

  const patternSegments = normalizedPattern.split("/").filter(Boolean);
  const targetSegments = normalizedTarget.split("/").filter(Boolean);

  // NOTE: your original logic required equal segment lengths.
  // Keep it unchanged to avoid breaking existing SUPER_ADMIN behavior.
  if (patternSegments.length !== targetSegments.length) {
    return false;
  }

  return patternSegments.every((segment, index) => {
    if (!segment) return false;
    if (segment.startsWith(":")) return true;
    return segment === targetSegments[index];
  });
};

const resolveResourceKeyForPath = (pathname: string, resources: UiResource[]) => {
  const cleanedPath = normalizePath(pathname);
  if (!cleanedPath) return null;

  const matchExact = resources.find((resource) => {
    const route = normalizePath(resource.route || undefined);
    return route === cleanedPath;
  });
  if (matchExact) {
    return canonicalizeResourceKey(matchExact.resource_key);
  }

  const matchPattern = resources.find((resource) =>
    matchesRoutePattern(resource.route, cleanedPath),
  );
  if (matchPattern) {
    return canonicalizeResourceKey(matchPattern.resource_key);
  }

  return null;
};

// ✅ NEW: If route key is *.menu, try Step-Up against likely screen keys
const resolveStepupKeyVariant = (
  resolvedKey: string | null,
  isLocked: (key: string) => boolean,
) => {
  if (!resolvedKey) return null;

  const key = canonicalizeResourceKey(resolvedKey);
  if (!key) return null;

  // direct lock match
  if (isLocked(key)) return key;

  // fallback: menu -> list/view/detail/create/edit
  if (key.endsWith(".menu")) {
    const candidates = [
      key.replace(/\.menu$/, ".list"),
      key.replace(/\.menu$/, ".view"),
      key.replace(/\.menu$/, ".detail"),
      key.replace(/\.menu$/, ".create"),
      key.replace(/\.menu$/, ".edit"),
      key.replace(/\.menu$/, ".deactivate"),
    ];

    for (const candidate of candidates) {
      const normalizedCandidate = canonicalizeResourceKey(candidate);
      if (normalizedCandidate && isLocked(normalizedCandidate)) {
        return normalizedCandidate;
      }
    }
  }

  return null;
};

export const StepUpRouteEnforcer: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { ui_resources, resources: compatResources } = useAdminUiConfig();

  const resources = React.useMemo<UiResource[]>(
    () => {
      if (Array.isArray(ui_resources) && ui_resources.length) {
        return ui_resources;
      }
      return Array.isArray(compatResources) ? compatResources : [];
    },
    [ui_resources, compatResources],
  );

  const { isLocked, ensureStepUp } = useStepUp();
  const [ready, setReady] = React.useState(true);

  React.useEffect(() => {
    let active = true;

    const baseKey = resolveResourceKeyForPath(location.pathname, resources);
    const stepupKey = resolveStepupKeyVariant(baseKey, isLocked);
    const locked = Boolean(stepupKey);

    console.info("[STEPUP_UI]", {
      path: location.pathname,
      base_key: baseKey || "unknown",
      stepup_key: stepupKey || "none",
      locked,
      source: "ROUTE",
    });

    if (!stepupKey || !locked) {
      setReady(true);
      return;
    }

    setReady(false);
    (async () => {
      const ok = await ensureStepUp(stepupKey, "VIEW", { source: "ROUTE" });
      if (!active) return;
      setReady(true);
      if (!ok) {
        console.warn("[STEPUP_UI] step-up blocked route, staying on current path");
      }
    })();

    return () => {
      active = false;
    };
  }, [location.pathname, resources, isLocked, ensureStepUp, navigate]);

  if (!ready) {
    return (
      <Box display="flex" justifyContent="center" py={6}>
        <CircularProgress />
      </Box>
    );
  }

  return <>{children}</>;
};

// import * as React from "react";
// import { Box, CircularProgress } from "@mui/material";
// import { useLocation } from "react-router-dom";

// import { canonicalizeResourceKey, type UiResource } from "../utils/adminUiConfig";
// import { useAdminUiConfig } from "../contexts/admin-ui-config";
// import { useStepUp } from "../security/stepup/useStepUp";

// const normalizePath = (value?: string | null) => {
//   if (!value) return "";
//   const sanitized = value.split("?")[0].replace(/\\+/g, "/");
//   return sanitized === "/" ? "/" : sanitized.replace(/\/+$/, "");
// };

// const matchesRoutePattern = (pattern?: string | null, target?: string) => {
//   if (!pattern || !target) return false;
//   const normalizedPattern = normalizePath(pattern);
//   const normalizedTarget = normalizePath(target);
//   if (!normalizedPattern || !normalizedTarget) return false;
//   if (normalizedPattern === normalizedTarget) return true;
//   if (
//     normalizedPattern !== "/" &&
//     normalizedTarget.startsWith(`${normalizedPattern}/`)
//   ) {
//     return true;
//   }

//   const patternSegments = normalizedPattern
//     .split("/")
//     .filter(Boolean);
//   const targetSegments = normalizedTarget
//     .split("/")
//     .filter(Boolean);
//   if (patternSegments.length !== targetSegments.length) {
//     return false;
//   }
//   return patternSegments.every((segment, index) => {
//     if (!segment) return false;
//     if (segment.startsWith(":")) {
//       return true;
//     }
//     return segment === targetSegments[index];
//   });
// };

// const resolveResourceKeyForPath = (
//   pathname: string,
//   resources: UiResource[],
// ) => {
//   const cleanedPath = normalizePath(pathname);
//   if (!cleanedPath) return null;

//   const matchExact = resources.find((resource) => {
//     const route = normalizePath(resource.route || undefined);
//     return route === cleanedPath;
//   });
//   if (matchExact) {
//     return canonicalizeResourceKey(matchExact.resource_key);
//   }

//   const matchPattern = resources.find((resource) =>
//     matchesRoutePattern(resource.route, cleanedPath),
//   );
//   if (matchPattern) {
//     return canonicalizeResourceKey(matchPattern.resource_key);
//   }

//   return null;
// };

// export const StepUpRouteEnforcer: React.FC<{ children: React.ReactNode }> = ({
//   children,
// }) => {
//   const location = useLocation();
//   const { ui_resources, resources: compatResources } = useAdminUiConfig();
//   const resources = React.useMemo<UiResource[]>(
//     () => {
//       if (Array.isArray(ui_resources) && ui_resources.length) {
//         return ui_resources;
//       }
//       return Array.isArray(compatResources) ? compatResources : [];
//     },
//     [ui_resources, compatResources],
//   );

//   const { isLocked, ensureStepUp } = useStepUp();
//   const [ready, setReady] = React.useState(true);

//   React.useEffect(() => {
//     let active = true;
//     const resolvedKey = resolveResourceKeyForPath(location.pathname, resources);
//     const locked = Boolean(resolvedKey && isLocked(resolvedKey));
//     console.info("[STEPUP_UI]", {
//       resource_key: resolvedKey || "unknown",
//       locked,
//       source: "ROUTE",
//     });

//     if (!resolvedKey || !locked) {
//       setReady(true);
//       return;
//     }

//     setReady(false);
//     (async () => {
//       const ok = await ensureStepUp(resolvedKey, "VIEW", { source: "ROUTE" });
//       if (!active) return;
//       setReady(ok);
//     })();

//     return () => {
//       active = false;
//     };
//   }, [location.pathname, resources, isLocked, ensureStepUp]);

//   if (!ready) {
//     return (
//       <Box display="flex" justifyContent="center" py={6}>
//         <CircularProgress />
//       </Box>
//     );
//   }

//   return <>{children}</>;
// };
