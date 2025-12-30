import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Paper,
  Stack,
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
  String(value || "").trim();

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
        const incoming = normalizeStringArray(pickArrayField(resp, "selected"));

        setScreens(normalizedScreens);
        setLockedDefaults(locked);
        setSelected(Array.from(new Set([...incoming, ...locked])));
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

  const lockedSet = useMemo(() => new Set(lockedDefaults), [lockedDefaults]);
  const selectedSet = useMemo(() => new Set(selected), [selected]);

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
      const toSave = Array.from(new Set([...selected, ...lockedDefaults]));
      const resp = await saveStepupPolicySelection({ username, selected: toSave });
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

  if (!username) {
    return <Typography>Please log in.</Typography>;
  }

  return (
    <StepUpGuard username={username} resourceKey="system.security.stepup_policies">
      <Stack spacing={2}>
        <Paper sx={{ p: 2 }}>
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
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={status === "loading" || saving || !screens.length}
          >
            {saving ? <CircularProgress size={20} /> : "Save selection"}
          </Button>
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
            Locked defaults (always enforced): {lockedDefaults.join(", ")}
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
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Screen</TableCell>
                <TableCell>Route</TableCell>
                <TableCell>Module / Group</TableCell>
                <TableCell align="center">Step-up</TableCell>
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
        )}
      </Paper>
      </Stack>
    </StepUpGuard>
  );
};

export default StepUpPoliciesPage;
