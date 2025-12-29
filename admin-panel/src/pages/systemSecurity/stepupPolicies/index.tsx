import React, { useEffect, useMemo, useState } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Alert from "@mui/material/Alert";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import SearchIcon from "@mui/icons-material/Search";
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
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState("ALL");

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

  const subjects = useMemo(() => {
    const set = new Set<string>();
    rules.forEach((rule) => {
      (rule.subject_types || []).forEach((sub) => set.add(sub));
    });
    return ["ALL", ...Array.from(set).sort()];
  }, [rules]);

  const filteredRules = useMemo(() => {
    return rules.filter((rule) => {
      if (activeOnly && rule.is_active !== "Y") return false;
      if (subjectFilter !== "ALL" && !rule.subject_types.includes(subjectFilter)) return false;
      const lowerSearch = search.trim().toLowerCase();
      if (lowerSearch) {
        return rule.rule_key.toLowerCase().includes(lowerSearch);
      }
      return true;
    });
  }, [rules, search, activeOnly, subjectFilter]);

  return (
    <Box sx={{ pb: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h4" component="h1">
          Step-up Policies
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Policies defined here determine which actions trigger step-up
          authentication. Data is read-only.
        </Typography>

        <Paper variant="outlined" sx={{ p: 3 }}>
          <Stack
            direction="row"
            spacing={2}
            alignItems="center"
            flexWrap="wrap"
            sx={{ minHeight: 48 }}
          >
            <TextField
              label="Search rule key"
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Subject type"
              size="small"
              select
              value={subjectFilter}
              onChange={(event) => setSubjectFilter(event.target.value)}
              sx={{ minWidth: 180 }}
            >
              {subjects.map((subject) => (
                <MenuItem key={subject} value={subject}>
                  {subject === "ALL" ? "All subjects" : subject}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Active only"
              size="small"
              select
              value={activeOnly ? "Y" : "N"}
              onChange={(event) => setActiveOnly(event.target.value === "Y")}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="N">All</MenuItem>
              <MenuItem value="Y">Active</MenuItem>
            </TextField>
            <Typography variant="body2" color="text.secondary">
              {filteredRules.length} / {rules.length} policies shown
            </Typography>
          </Stack>
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

        {status === "ready" && !filteredRules.length && (
          <Alert severity="info">No policies match the filters.</Alert>
        )}

        {filteredRules.map((rule) => (
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
              <Chip size="small" label={`Priority ${rule.priority || 0}`} />
            </Stack>
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2">Subjects: {rule.subject_types.join(", ") || "—"}</Typography>
            <Typography variant="body2">
              Match type: {rule.match?.type || "—"}
            </Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
              {(rule.match?.values || []).map((value) => (
                <Chip key={value} size="small" label={value} variant="outlined" />
              ))}
            </Stack>
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
