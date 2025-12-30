// STEPUP-POLICY-PROOF 2025-12-31T00:00:00Z
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import OutlinedInput from "@mui/material/OutlinedInput";
import ListItemText from "@mui/material/ListItemText";
import Checkbox from "@mui/material/Checkbox";
import { useSnackbar } from "notistack";
import { fetchStepupPolicies, saveStepupPolicyRule } from "../../../services/stepupPoliciesApi";
import { DEFAULT_COUNTRY, DEFAULT_LANGUAGE } from "../../../config/appConfig";

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

type StepupFormState = {
  isActive: "Y" | "N";
  requireStepup: "Y" | "N";
  priority: number;
  subjectTypes: string[];
  matchValuesText: string;
  matchActionsText: string;
};

const STEPUP_STATUS_LABELS: Record<string, string> = {
  Y: "Enabled",
  N: "Disabled",
};

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const SubjectMenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 260,
    },
  },
};

const defaultFormState: StepupFormState = {
  isActive: "Y",
  requireStepup: "Y",
  priority: 1,
  subjectTypes: [],
  matchValuesText: "",
  matchActionsText: "",
};

const StepUpPoliciesPage: React.FC = () => {
  const [rules, setRules] = useState<StepupRule[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string>("");
  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState("ALL");
  const [username, setUsername] = useState("");

  const [editOpen, setEditOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<StepupRule | null>(null);
  const [formState, setFormState] = useState<StepupFormState>(defaultFormState);
  const [modalError, setModalError] = useState("");
  const [saving, setSaving] = useState(false);

  const { enqueueSnackbar } = useSnackbar();

  const parseStoredUsername = useCallback(() => {
    if (typeof window === "undefined") return "";
    const raw = window.localStorage.getItem("cd_user");
    if (!raw) return "";
    try {
      const parsed = JSON.parse(raw);
      return String(parsed?.username || parsed?.user_name || "").trim();
    } catch (err: any) {
      console.error("[StepUpPolicies] parse user failed", err);
      return "";
    }
  }, []);

  const loadPolicies = useCallback(() => {
    if (!username) return;
    setStatus("loading");
    setError("");
    fetchStepupPolicies({ username, language: DEFAULT_LANGUAGE, country: DEFAULT_COUNTRY })
      .then((resp) => {
        const list = Array.isArray(resp?.rules) ? resp.rules : [];
        setRules(list);
        setStatus("ready");
      })
      .catch((err: any) => {
        console.error("[StepUpPolicies] fetch error:", err);
        const message =
          err?.response?.data?.response?.description || "Unable to load step-up policies.";
        setError(message);
        setStatus("error");
      });
  }, [username]);

  useEffect(() => {
    const resolved = parseStoredUsername();
    if (!resolved) {
      setError("Unable to resolve admin username.");
      setStatus("error");
      return;
    }

    setUsername(resolved);
  }, [parseStoredUsername]);

  useEffect(() => {
    if (username) {
      loadPolicies();
    }
  }, [username, loadPolicies]);

  const formatDate = (value: string) => (value ? new Date(value).toLocaleString() : "—");

  const subjects = useMemo(() => {
    const set = new Set<string>();
    rules.forEach((rule) => {
      (rule.subject_types || []).forEach((sub) => set.add(sub));
    });
    return ["ALL", ...Array.from(set).sort()];
  }, [rules]);

  const subjectOptions = useMemo(() => {
    const set = new Set<string>();
    rules.forEach((rule) => {
      (rule.subject_types || []).forEach((subject) => set.add(subject));
    });
    return Array.from(set).sort();
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

  const handleOpenEdit = (rule: StepupRule) => {
    setEditingRule(rule);
    setFormState({
      isActive: rule.is_active === "Y" ? "Y" : "N",
      requireStepup: rule.require_stepup === "Y" ? "Y" : "N",
      priority: rule.priority || 1,
      subjectTypes: rule.subject_types || [],
      matchValuesText: (rule.match?.values || []).join("\n"),
      matchActionsText: (rule.match?.actions || []).join("\n"),
    });
    setModalError("");
    setEditOpen(true);
  };

  const handleCloseEdit = () => {
    setEditOpen(false);
    setEditingRule(null);
    setModalError("");
    setFormState(defaultFormState);
  };

  const parseListText = (value: string) =>
    value
      .split(/[\n,]+/)
      .map((item) => item.trim())
      .filter(Boolean);

  const handleSaveRule = async () => {
    if (!editingRule) return;
    if (!formState.subjectTypes.length) {
      setModalError("Select at least one subject type.");
      return;
    }
    const matchValues = parseListText(formState.matchValuesText);
    if (!matchValues.length) {
      setModalError("Match values must contain at least one entry.");
      return;
    }
    const matchActions = parseListText(formState.matchActionsText);
    setSaving(true);
    setModalError("");
    try {
      await saveStepupPolicyRule({
        username,
        rule: {
          rule_key: editingRule.rule_key,
          is_active: formState.isActive,
          require_stepup: formState.requireStepup,
          priority: Number(formState.priority) || 1,
          subject_types: formState.subjectTypes,
          match: {
            type: editingRule.match?.type || "RESOURCE_KEY_PREFIX",
            values: matchValues,
            actions: matchActions.length ? matchActions : null,
          },
        },
      });
      enqueueSnackbar("Step-up policy saved.", { variant: "success" });
      handleCloseEdit();
      loadPolicies();
    } catch (err: any) {
      console.error("[StepUpPolicies] save error:", err);
      const message =
        err?.response?.data?.response?.description || "Unable to save step-up policy.";
      setModalError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ pb: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h4" component="h1">
          Step-up Policies
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Policies defined here determine which actions trigger step-up authentication.
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
          <Alert severity="error">{error || "Failed to fetch step-up policies."}</Alert>
        )}

        {status === "ready" && !filteredRules.length && (
          <Alert severity="info">No policies match the filters.</Alert>
        )}

        {filteredRules.map((rule) => (
          <Paper key={String(rule._id || rule.rule_key)} variant="outlined" sx={{ p: 2 }}>
            <Stack direction="row" alignItems="center" spacing={2} flexWrap="wrap">
              <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                {rule.rule_key}
              </Typography>
              <Chip
                size="small"
                label={STEPUP_STATUS_LABELS[rule.is_active] || rule.is_active}
                color={rule.is_active === "Y" ? "success" : "default"}
              />
              <Chip size="small" label={`Require step-up: ${rule.require_stepup === "Y" ? "Yes" : "No"}`} />
              <Chip size="small" label={`Priority ${rule.priority || 0}`} />
              <Button size="small" variant="outlined" onClick={() => handleOpenEdit(rule)}>
                Edit
              </Button>
            </Stack>
            <Divider sx={{ my: 1 }} />
            <Typography variant="body2">Subjects: {rule.subject_types.join(", ") || "—"}</Typography>
            <Typography variant="body2">Match type: {rule.match?.type || "—"}</Typography>
            <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
              {(rule.match?.values || []).map((value) => (
                <Chip key={value} size="small" label={value} variant="outlined" />
              ))}
            </Stack>
            {rule.match?.actions && rule.match.actions.length > 0 && (
              <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                {rule.match.actions.map((action) => (
                  <Chip key={action} label={action} size="small" color="primary" />
                ))}
              </Stack>
            )}
            <Divider sx={{ my: 1 }} />
            <Stack direction="row" spacing={3} flexWrap="wrap">
              <Typography variant="caption">Updated on: {formatDate(rule.updated_on)}</Typography>
              <Typography variant="caption">Updated by: {rule.updated_by || "system"}</Typography>
              <Typography variant="caption">Version: {rule.version || 1}</Typography>
            </Stack>
          </Paper>
        ))}
      </Stack>

      <Dialog open={editOpen} onClose={handleCloseEdit} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Step-up Policy</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="subtitle2">Rule key: {editingRule?.rule_key || "—"}</Typography>
            <FormControlLabel
              control={
                <Switch
                  checked={formState.isActive === "Y"}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      isActive: event.target.checked ? "Y" : "N",
                    }))
                  }
                />
              }
              label="Active"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={formState.requireStepup === "Y"}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      requireStepup: event.target.checked ? "Y" : "N",
                    }))
                  }
                />
              }
              label="Require step-up when matched"
            />
            <TextField
              label="Priority"
              type="number"
              size="small"
              value={formState.priority}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  priority: Number(event.target.value) || 1,
                }))
              }
            />
            <FormControl fullWidth>
              <InputLabel id="subject-types-label">Subject types</InputLabel>
              <Select
                labelId="subject-types-label"
                multiple
                value={formState.subjectTypes}
                onChange={(event) =>
                  setFormState((prev) => ({
                    ...prev,
                    subjectTypes: typeof event.target.value === "string"
                      ? event.target.value.split(",").map((val) => val.trim())
                      : event.target.value,
                  }))
                }
                input={<OutlinedInput label="Subject types" />}
                renderValue={(selected) => (selected as string[]).join(", ")}
                MenuProps={SubjectMenuProps}
              >
                {subjectOptions.map((subject) => (
                  <MenuItem key={subject} value={subject}>
                    <Checkbox checked={formState.subjectTypes.indexOf(subject) > -1} />
                    <ListItemText primary={subject} />
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Match values (newline or comma separated)"
              multiline
              minRows={3}
              value={formState.matchValuesText}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  matchValuesText: event.target.value,
                }))
              }
            />
            <TextField
              label="Match actions (optional, newline or comma separated)"
              multiline
              minRows={2}
              value={formState.matchActionsText}
              onChange={(event) =>
                setFormState((prev) => ({
                  ...prev,
                  matchActionsText: event.target.value,
                }))
              }
            />
            {modalError && <Alert severity="error">{modalError}</Alert>}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseEdit} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSaveRule} disabled={saving} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default StepUpPoliciesPage;
