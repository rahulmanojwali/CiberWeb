import React, { ChangeEvent, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  Paper,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useSnackbar } from "notistack";
import { StepUpGuard } from "../../../components/StepUpGuard";
import {
  getStepupPolicyScreens,
  saveStepupPolicySelection,
} from "../../../services/security/stepupPolicyService";
import {
  getSecuritySwitches,
  updateSecuritySwitches,
} from "../../../services/security/securitySwitchService";

type StepupScreen = {
  label: string;
  route: string;
  group: string;
  resource_key: string;
  locked?: boolean;
};

type RawStepupScreen = {
  label?: string;
  route?: string;
  group?: string;
  resource_key?: string;
};

const normalizeKey = (value: string | null | undefined) =>
  String(value || "").trim().toLowerCase();

const normalizeStringArray = (values: unknown[]): string[] =>
  Array.from(
    new Set(
      values
        .map((value) => normalizeKey(typeof value === "string" ? value : String(value || "")))
        .filter(Boolean)
    )
  );

const getResponseCandidates = (resp: any) => [
  resp,
  resp?.data,
  resp?.response,
  resp?.data?.data,
  resp?.response?.data,
  resp?.response?.response,
];

const pickArrayField = (resp: any, field: string): unknown[] => {
  for (const candidate of getResponseCandidates(resp)) {
    if (candidate && Array.isArray(candidate[field])) {
      return candidate[field];
    }
  }
  return [];
};

const getResponseMatchField = (resp: any) => {
  for (const candidate of getResponseCandidates(resp)) {
    if (candidate && candidate.match && typeof candidate.match === "object") {
      return candidate.match;
    }
  }
  return null;
};

const buildPrefixesFromKeys = (keys: string[]) => {
  const prefixes = new Set<string>();
  for (const raw of keys || []) {
    const key = normalizeKey(raw);
    if (!key) continue;
    const lastDot = key.lastIndexOf(".");
    if (lastDot <= 0) continue;
    const prefix = key.slice(0, lastDot + 1);
    if (prefix) {
      prefixes.add(prefix);
    }
  }
  return Array.from(prefixes);
};

const matchesWithRuleValue = (matchType: string, values: string[], resourceKey: string) => {
  if (!resourceKey || !values.length) return false;
  if (matchType === "RESOURCE_KEY_PREFIX") {
    return values.some((prefix) => resourceKey.startsWith(prefix));
  }
  return values.includes(resourceKey);
};

const getResponseObject = (resp: any) => {
  for (const candidate of getResponseCandidates(resp)) {
    if (candidate && typeof candidate === "object" && candidate.response) {
      return candidate.response;
    }
  }
  return null;
};

function resolveUsername(): string {
  if (typeof window === "undefined") return "";
  const raw = window.localStorage.getItem("cd_user");
  if (!raw) return "";
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    return String(parsed?.username || parsed?.user_name || "").trim();
  } catch (error) {
    console.error("[StepUpPolicies] parse username failed", error);
    return "";
  }
}

const StepUpPoliciesPage: React.FC = () => {
  const [screens, setScreens] = useState<StepupScreen[]>([]);
  const [lockedDefaults, setLockedDefaults] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [bindingSwitch, setBindingSwitch] = useState<"Y" | "N">("N");
  const [bindingLoading, setBindingLoading] = useState(false);
  const [bindingSaving, setBindingSaving] = useState(false);
  const [bindingError, setBindingError] = useState("");

  const { enqueueSnackbar } = useSnackbar();
  const username = useMemo(() => resolveUsername(), []);

  useEffect(() => {
    if (!username) {
      setStatus("error");
      setError("Unable to resolve admin username.");
      return;
    }

    setStatus("loading");
    setError("");

    getStepupPolicyScreens({ username })
      .then((resp) => {
        const fetchedScreens = pickArrayField(resp, "screens") as RawStepupScreen[];
        const normalizedScreens = fetchedScreens
          .map((screen) => ({
            label: String(screen?.label || screen?.resource_key || "Untitled screen"),
            route: String(screen?.route || ""),
            group: String(screen?.group || "General"),
            resource_key: normalizeKey(screen?.resource_key),
          }))
          .filter((screen) => screen.resource_key && screen.route);

        const locked = normalizeStringArray(pickArrayField(resp, "locked_defaults"));
        const matchData = getResponseMatchField(resp);
        const matchType = String((matchData?.type || "RESOURCE_KEY_PREFIX")).trim().toUpperCase();
        const matchValues =
          Array.isArray(matchData?.values) ? normalizeStringArray(matchData.values) : [];
        const derivedSelected = normalizedScreens
          .filter((screen) =>
            matchesWithRuleValue(matchType, matchValues, screen.resource_key)
          )
          .map((screen) => screen.resource_key);

        setScreens(normalizedScreens);
        setLockedDefaults(locked);
        setSelected(Array.from(new Set([...derivedSelected, ...locked])));
        setStatus("ready");
      })
      .catch((err) => {
        console.error("[StepUpPolicies] fetch error:", err);
        const message =
          err?.response?.data?.response?.description ||
          err?.message ||
          "Unable to load step-up screens.";
        setError(message);
        setStatus("error");
      });
  }, [username]);

  useEffect(() => {
    if (!username) return;
    setBindingLoading(true);
    setBindingError("");
    getSecuritySwitches({ username })
      .then((resp) => {
        const value =
          resp?.switches?.STEPUP_BROWSER_SESSION_BINDING ||
          resp?.data?.switches?.STEPUP_BROWSER_SESSION_BINDING ||
          resp?.response?.switches?.STEPUP_BROWSER_SESSION_BINDING;
        setBindingSwitch(value === "Y" ? "Y" : "N");
      })
      .catch((err) => {
        console.error("[StepUpPolicies] fetch switch error:", err);
        setBindingError("Unable to load browser session switch.");
      })
      .finally(() => {
        setBindingLoading(false);
      });
  }, [username]);

  useEffect(() => {
    if (!username) return;
    setBindingLoading(true);
    setBindingError("");
    getSecuritySwitches({ username })
      .then((resp) => {
        const value =
          resp?.switches?.STEPUP_BROWSER_SESSION_BINDING ||
          resp?.data?.switches?.STEPUP_BROWSER_SESSION_BINDING ||
          resp?.switches?.STEPUP_BROWSER_SESSION_BINDING;
        setBindingSwitch(value === "Y" ? "Y" : "N");
      })
      .catch((err) => {
        console.error("[StepUpPolicies] fetch switch error:", err);
        setBindingError("Unable to load browser session switch.");
      })
      .finally(() => {
        setBindingLoading(false);
      });
  }, [username]);

  const lockedSet = useMemo(() => new Set(lockedDefaults), [lockedDefaults]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const availableResourceKeys = useMemo(
    () => new Set(screens.map((screen) => screen.resource_key)),
    [screens],
  );

  const handleToggle = (resourceKey: string) => {
    const normalized = normalizeKey(resourceKey);
    if (!normalized || lockedSet.has(normalized)) return;

    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(normalized)) {
        next.delete(normalized);
      } else {
        next.add(normalized);
      }
      return Array.from(next);
    });
  };

  const handleSave = async () => {
    if (!username) return;
    setSaving(true);
    try {
      const candidateKeys = Array.from(
        new Set([...selected, ...lockedDefaults])
      );
      const filteredSelection = candidateKeys.filter((key) =>
        availableResourceKeys.has(key),
      );
      const toSave = filteredSelection;
      if (!toSave.length) {
        enqueueSnackbar("No valid step-up screens selected.", { variant: "error" });
        return;
      }
      const prefixesToSave = buildPrefixesFromKeys(toSave);
      if (!prefixesToSave.length) {
        enqueueSnackbar("Unable to compute step-up prefixes.", { variant: "error" });
        return;
      }
      const resp = await saveStepupPolicySelection({ username, selected: prefixesToSave });
      const responseObj = getResponseObject(resp);
      const responseCode = responseObj?.responsecode;
      const responseDescription = responseObj?.description;
      if (responseCode !== "0") {
        enqueueSnackbar(responseDescription || "Unable to save step-up selection.", {
          variant: "error",
        });
        return;
      }
      const lockedFromResponse = normalizeStringArray(
        pickArrayField(resp, "locked_defaults")
      );
      const selectedKeys = normalizeStringArray(pickArrayField(resp, "selected"));
      const normalizedSelected = Array.from(
        new Set([
          ...(selectedKeys.length ? selectedKeys : toSave),
          ...lockedFromResponse,
        ])
      );
      setLockedDefaults(lockedFromResponse);
      setSelected(normalizedSelected);
      enqueueSnackbar("Step-up screen selection saved.", { variant: "success" });
    } catch (err: any) {
      console.error("[StepUpPolicies] save error:", err);
      const message =
        err?.response?.data?.response?.description || err?.message ||
        "Unable to save step-up selection.";
      enqueueSnackbar(message, { variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleSwitchToggle = async (event: ChangeEvent<HTMLInputElement>) => {
    if (!username) return;
    setBindingSaving(true);
    try {
      const targetValue = event.target.checked ? "Y" : "N";
      const resp = await updateSecuritySwitches({
        username,
        switches: {
          STEPUP_BROWSER_SESSION_BINDING: targetValue,
        },
      });
      const updated =
        resp?.switches?.STEPUP_BROWSER_SESSION_BINDING ||
        resp?.data?.switches?.STEPUP_BROWSER_SESSION_BINDING ||
        resp?.response?.switches?.STEPUP_BROWSER_SESSION_BINDING ||
        targetValue;
      const normalized = updated === "Y" ? "Y" : "N";
      setBindingSwitch(normalized);
      enqueueSnackbar(
        `Browser session binding ${normalized === "Y" ? "enabled" : "disabled"}.`,
        { variant: "success" },
      );
    } catch (err: any) {
      console.error("[StepUpPolicies] update switch error:", err);
      const message =
        err?.response?.data?.response?.description ||
        err?.message ||
        "Unable to update browser session binding.";
      enqueueSnackbar(message, { variant: "error" });
    } finally {
      setBindingSaving(false);
    }
  };

  if (!username) {
    return <Typography>Please log in.</Typography>;
  }

  const actionBarSx = {
    p: 2,
    position: "sticky" as const,
    top: 0,
    zIndex: 3,
    bgcolor: "background.paper",
    borderBottom: (theme: any) => `1px solid ${theme.palette.divider}`,
    boxShadow: 1,
  };

  const selectedCount = selectedSet.size;
  const totalLocked = lockedDefaults.length;

  const handleResetDefaults = () => {
    setSelected(Array.from(new Set(lockedDefaults)));
    enqueueSnackbar("Selection reset to locked defaults.", {
      variant: "info",
    });
  };

  return (
    <StepUpGuard username={username} resourceKey="stepup_policy.view">
      <Stack spacing={2}>
        <Paper sx={actionBarSx}>
          <Stack
            direction={{ xs: "column", sm: "row" }}
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={2}
          >
            <Box>
              <Typography variant="h5">Step-Up Policy Manager</Typography>
              <Typography variant="body2" color="text.secondary">
                Toggle screen-level enforcement for SUPER_ADMIN screens.
              </Typography>
            </Box>
            <Box
              display="flex"
              flexDirection="column"
              alignItems={{ xs: "flex-start", sm: "flex-end" }}
              gap={0.25}
            >
              <Typography variant="caption" color="text.secondary">
                Selected locked screens: {selectedCount}
              </Typography>
              <FormControlLabel
                control={
                  <Switch
                    checked={bindingSwitch === "Y"}
                    onChange={handleSwitchToggle}
                    disabled={
                      bindingLoading ||
                      bindingSaving ||
                      status === "loading" ||
                      saving
                    }
                  />
                }
                label="Bind step-up to browser session"
              />
              <Typography variant="caption" color="text.secondary">
                When enabled, closing a tab/window forces a new OTP.
              </Typography>
              {(bindingLoading || bindingSaving) && (
                <Typography variant="caption" color="text.secondary">
                  {bindingLoading ? "Loading switch…" : "Updating…"}
                </Typography>
              )}
              {bindingError && (
                <Typography variant="caption" color="error">
                  {bindingError}
                </Typography>
              )}
            </Box>
            <Box display="flex" gap={1}>
              <Button
                variant="outlined"
                onClick={handleResetDefaults}
                disabled={totalLocked === 0 || saving || status === "loading"}
              >
                Reset to defaults
              </Button>
              <Button
                variant="contained"
                onClick={handleSave}
                disabled={status === "loading" || saving || !screens.length}
              >
                {saving ? <CircularProgress size={20} /> : "Save selection"}
              </Button>
            </Box>
          </Stack>
        </Paper>

        {error && (
          <Paper sx={{ p: 2 }}>
            <Alert severity="error">{error}</Alert>
          </Paper>
        )}

        {lockedDefaults.length > 0 && (
          <Paper sx={{ p: 2 }}>
            <Alert severity="info">
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                Locked by default (always enforced)
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, wordBreak: "break-word" }}>
                {lockedDefaults.join(", ")}
              </Typography>
            </Alert>
          </Paper>
        )}

        <Paper sx={{ p: 2 }}>
          {status === "loading" ? (
            <Stack alignItems="center" py={6}>
              <CircularProgress />
            </Stack>
          ) : !screens.length ? (
            <Typography>No screens available.</Typography>
          ) : (
            <Box
              sx={{
                maxHeight: "calc(100vh - 420px)",
                overflowY: "auto",
                width: "100%",
              }}
            >
              <Table size="small" sx={{ minWidth: 720 }}>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        position: "sticky",
                        top: 0,
                        bgcolor: "background.paper",
                        zIndex: 2,
                      }}
                    >
                      Screen
                    </TableCell>
                    <TableCell
                      sx={{
                        position: "sticky",
                        top: 0,
                        bgcolor: "background.paper",
                        zIndex: 2,
                      }}
                    >
                      Route
                    </TableCell>
                    <TableCell
                      sx={{
                        position: "sticky",
                        top: 0,
                        bgcolor: "background.paper",
                        zIndex: 2,
                      }}
                    >
                      Module / Group
                    </TableCell>
                    <TableCell
                      align="center"
                      sx={{
                        position: "sticky",
                        top: 0,
                        bgcolor: "background.paper",
                        zIndex: 2,
                      }}
                    >
                      Step-up
                    </TableCell>
                  </TableRow>
                </TableHead>
              <TableBody>
                {screens.map((screen) => {
                  const checked =
                    lockedSet.has(screen.resource_key) || selectedSet.has(screen.resource_key);
                  return (
                    <TableRow key={screen.resource_key}>
                      <TableCell>
                        <Stack spacing={0.3}>
                          <Typography variant="subtitle2">
                            {screen.label || screen.resource_key}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {screen.resource_key}
                          </Typography>
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {screen.route}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">{screen.group || "-"}</Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Stack alignItems="center" spacing={0.5}>
                          <Checkbox
                            checked={checked}
                            disabled={lockedSet.has(screen.resource_key)}
                            onChange={() => handleToggle(screen.resource_key)}
                          />
                          {lockedSet.has(screen.resource_key) && (
                            <Typography variant="caption" color="text.secondary">
                              Locked
                            </Typography>
                          )}
                          {screen.locked && (
                            <Typography variant="caption" color="text.secondary">
                              This screen is always protected.
                            </Typography>
                          )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              </Table>
            </Box>
          )}
        </Paper>
      </Stack>
    </StepUpGuard>
  );
};

export default StepUpPoliciesPage;
