import React, { useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import { fetchStepupPolicies } from "../../../services/stepupPoliciesApi";

type StepupRule = {
  _id: string;
  rule_key: string;
  is_active: string;
  priority: number;
  subject_types: string[];
  match: { type: string; values: string[]; actions?: string[] | null };
  require_stepup: string;
  updated_on: string;
  updated_by: string;
  version: number;
};

const STEPUP_STATUS_LABELS: Record<string, string> = {
  Y: "Enabled",
  N: "Disabled",
};

const StepUpPoliciesPage: React.FC = () => {
  const [rules, setRules] = useState<StepupRule[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const usernameRaw =
      typeof window !== "undefined" ? localStorage.getItem("cd_user") : null;
    let username = "";
    if (usernameRaw) {
      try {
        const parsed = JSON.parse(usernameRaw);
        username = parsed?.username || parsed?.user_name || "";
      } catch (err) {
        console.error("[StepUpPolicies] Unable to parse stored user:", err);
      }
    }
    if (!username) {
      setError("Unable to resolve admin username.");
      setStatus("error");
      return;
    }

    fetchStepupPolicies({ username })
      .then((resp) => {
        const list = Array.isArray(resp?.rules) ? resp.rules : [];
        setRules(list);
      })
      .catch((err) => {
        console.error("[StepUpPolicies] fetch error:", err);
        const message =
          err?.response?.data?.response?.description ||
          "Unable to load step-up policies.";
        setError(message);
        setStatus("error");
      })
      .finally(() => {
        setStatus("ready");
      });
  }, []);

  const formatDate = (value: string) =>
    value ? new Date(value).toLocaleString() : "—";

  return (
    <Box sx={{ pb: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h4" component="h1">
          Step-up Policies
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Policies defined here determine which sensitive screens/actions
          trigger two-factor verification for SUPER_ADMIN or other privileged
          roles. The list below is read-only.
        </Typography>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Status
          </Typography>
          <Typography variant="body2">
            The API returns {rules.length} policy
            {rules.length !== 1 ? " items" : " item"}.
          </Typography>
        </Paper>

        {status === "loading" && (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        )}

        {status === "error" && (
          <Alert severity="error">
            {error || "Failed to fetch step-up policies."}
          </Alert>
        )}

        {status === "ready" && !rules.length && (
          <Alert severity="info">No step-up policies configured yet.</Alert>
        )}

        {rules.map((rule) => (
          <Paper key={String(rule._id || rule.rule_key)} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
              <Typography variant="subtitle1">{rule.rule_key}</Typography>
              <Chip
                size="small"
                label={STEPUP_STATUS_LABELS[rule.is_active] || rule.is_active}
                color={rule.is_active === "Y" ? "success" : "default"}
              />
              <Chip
                size="small"
                label={`Require step-up: ${
                  rule.require_stepup === "Y" ? "Yes" : "No"
                }`}
              />
            </Stack>
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Priority: {rule.priority || 0}
            </Typography>
            <Typography variant="body2">Subjects: {rule.subject_types.join(", ") || "—"}</Typography>
            <Typography variant="body2">
              Match type: {rule.match?.type || "—"}
            </Typography>
            <Typography variant="body2">
              Match values: {rule.match?.values?.join(", ") || "—"}
            </Typography>
            {rule.match?.actions && rule.match.actions.length > 0 && (
              <Typography variant="body2">
                Actions: {rule.match.actions.join(", ")}
              </Typography>
            )}
            <Divider sx={{ my: 1 }} />
            <Stack direction="row" spacing={3} flexWrap="wrap">
              <Typography variant="caption">
                Updated on: {formatDate(rule.updated_on)}
              </Typography>
              <Typography variant="caption">
                Updated by: {rule.updated_by || "system"}
              </Typography>
              <Typography variant="caption">Version: {rule.version || 1}</Typography>
            </Stack>
          </Paper>
        ))}
      </Stack>
    </Box>
  );
};

export default StepUpPoliciesPage;
