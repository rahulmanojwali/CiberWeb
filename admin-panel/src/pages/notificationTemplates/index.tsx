import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RefreshIcon from "@mui/icons-material/Refresh";
import SendIcon from "@mui/icons-material/Send";
import VisibilityIcon from "@mui/icons-material/Visibility";
import { type GridColDef } from "@mui/x-data-grid";
import { useSnackbar } from "notistack";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { usePermissions } from "../../authz/usePermissions";
import {
  fetchNotificationTemplates,
  previewNotificationTemplate,
  saveNotificationTemplate,
  testSendNotificationTemplate,
  validateNotificationTemplatesEnglish,
} from "../../services/notificationTemplatesApi";

type TemplateRow = {
  _id?: string;
  id: string;
  event_key: string;
  channel: "in_app" | "push" | "both";
  language: string;
  title_template: string;
  body_template: string;
  variables: string[];
  is_active: boolean;
  updated_on?: string;
};

const EMPTY_FORM = {
  _id: "",
  event_key: "",
  channel: "both",
  language: "en",
  title_template: "",
  body_template: "",
  variables: "",
  is_active: true,
};

const LANGUAGE_OPTIONS = [
  { value: "en", label: "en - English" },
  { value: "hi", label: "hi - Hindi" },
  { value: "mr", label: "mr - Marathi" },
  { value: "gu", label: "gu - Gujarati" },
  { value: "pa", label: "pa - Punjabi" },
  { value: "bn", label: "bn - Bengali" },
  { value: "ta", label: "ta - Tamil" },
  { value: "te", label: "te - Telugu" },
  { value: "kn", label: "kn - Kannada" },
  { value: "ml", label: "ml - Malayalam" },
  { value: "or", label: "or - Odia" },
  { value: "as", label: "as - Assamese" },
  { value: "ur", label: "ur - Urdu" },
];

const compactFieldSx = {
  "& .MuiOutlinedInput-root": {
    minHeight: 40,
    backgroundColor: "#fff",
  },
};

const cleanMultilineFieldSx = {
  "& .MuiOutlinedInput-root": {
    backgroundColor: "#fff",
    alignItems: "flex-start",
    padding: "10px 12px",
  },
  "& .MuiOutlinedInput-input": {
    padding: "0 !important",
  },
  "& textarea": {
    border: "0 !important",
    outline: "0 !important",
    boxShadow: "none !important",
    background: "transparent !important",
    resize: "vertical",
  },
  "& textarea:focus": {
    border: "0 !important",
    outline: "0 !important",
    boxShadow: "none !important",
  },
};

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

function parseJsonObject(raw: string) {
  if (!raw.trim()) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Sample variables must be a JSON object.");
  return parsed;
}

export const NotificationTemplates: React.FC = () => {
  const { i18n } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const { can } = usePermissions();
  const language = normalizeLanguageCode(i18n.language);
  const canView = useMemo(() => can("notification_templates.view", "VIEW"), [can]);
  const canUpdate = useMemo(() => can("notification_templates.update", "UPDATE"), [can]);
  const canTest = useMemo(() => can("notification_templates.test", "CREATE"), [can]);

  const [rows, setRows] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ event_key: "", language: "", channel: "", status: "" });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [sampleVariables, setSampleVariables] = useState('{"party_type":"FARMER","org_name":"Demo Org","mandi_name":"Demo Mandi"}');
  const [preview, setPreview] = useState({ title: "", body: "" });
  const [testTarget, setTestTarget] = useState("");
  const [englishValidation, setEnglishValidation] = useState<string>("");

  const loadData = useCallback(async () => {
    const username = currentUsername();
    if (!username || !canView) return;
    setLoading(true);
    try {
      const resp = await fetchNotificationTemplates({
        username,
        language,
        filters: {
          event_key: filters.event_key || undefined,
          language: filters.language || undefined,
          channel: filters.channel || undefined,
          is_active: filters.status === "" ? undefined : filters.status === "active",
        },
      });
      const list = resp?.data?.items || resp?.response?.data?.items || [];
      setRows(list.map((item: any) => ({ id: item._id || `${item.event_key}-${item.language}`, ...item })));
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Unable to load notification templates.", { variant: "error" });
    } finally {
      setLoading(false);
    }
  }, [canView, enqueueSnackbar, filters.channel, filters.event_key, filters.language, filters.status, language]);

  const openAdd = () => {
    setForm(EMPTY_FORM);
    setPreview({ title: "", body: "" });
    setDialogOpen(true);
  };

  const openEdit = (row: TemplateRow) => {
    setForm({
      _id: row._id || row.id || "",
      event_key: row.event_key || "",
      channel: row.channel || "both",
      language: row.language || "en",
      title_template: row.title_template || "",
      body_template: row.body_template || "",
      variables: Array.isArray(row.variables) ? row.variables.join(", ") : "",
      is_active: row.is_active !== false,
    });
    setPreview({ title: "", body: "" });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username || !canUpdate) return;
    try {
      const resp = await saveNotificationTemplate({
        ...form,
        username,
        language,
        template_language: form.language,
      });
      const code = resp?.response?.responsecode || "1";
      const desc = resp?.response?.description || "Save failed.";
      if (code !== "0") {
        enqueueSnackbar(desc, { variant: "error" });
        return;
      }
      enqueueSnackbar("Template saved.", { variant: "success" });
      setDialogOpen(false);
      loadData();
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Save failed.", { variant: "error" });
    }
  };

  const handlePreview = async () => {
    const username = currentUsername();
    if (!username) return;
    try {
      const sample = parseJsonObject(sampleVariables);
      const resp = await previewNotificationTemplate({
        username,
        language,
        title_template: form.title_template,
        body_template: form.body_template,
        sample_variables: sample,
      });
      setPreview(resp?.data || resp?.response?.data || { title: "", body: "" });
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Preview failed.", { variant: "error" });
    }
  };

  const handleTestSend = async () => {
    const username = currentUsername();
    if (!username || !canTest) return;
    try {
      const sample = parseJsonObject(sampleVariables);
      const resp = await testSendNotificationTemplate({
        username,
        language,
        event_key: form.event_key,
        template_language: form.language,
        target_username: testTarget,
        target_mobile: testTarget,
        sample_variables: sample,
      });
      const code = resp?.response?.responsecode || "1";
      enqueueSnackbar(code === "0" ? "Test notification submitted." : resp?.response?.description || "Test send failed.", {
        variant: code === "0" ? "success" : "error",
      });
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Test send failed.", { variant: "error" });
    }
  };

  const handleValidateEnglish = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await validateNotificationTemplatesEnglish({ username, language });
    const data = resp?.data || resp?.response?.data || {};
    const missing = data?.missing || [];
    setEnglishValidation(data.valid ? "All event keys have English templates." : `Missing English templates: ${missing.map((m: any) => m.event_key).join(", ")}`);
  };

  const columns = useMemo<GridColDef<TemplateRow>[]>(
    () => [
      { field: "event_key", headerName: "Event Key", width: 250 },
      { field: "language", headerName: "Lang", width: 90 },
      { field: "channel", headerName: "Channel", width: 120 },
      {
        field: "title_template",
        headerName: "Title",
        width: 260,
      },
      {
        field: "variables",
        headerName: "Variables",
        width: 220,
        renderCell: (params) => Array.isArray(params.row.variables) ? params.row.variables.join(", ") : "",
      },
      {
        field: "is_active",
        headerName: "Status",
        width: 110,
        renderCell: (params) => <Chip size="small" color={params.value ? "success" : "default"} label={params.value ? "Active" : "Inactive"} />,
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 120,
        sortable: false,
        renderCell: (params) => (
          <Button size="small" variant="outlined" onClick={() => openEdit(params.row)} disabled={!canUpdate}>
            Edit
          </Button>
        ),
      },
    ],
    [canUpdate],
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!canView) {
    return (
      <PageContainer>
        <Typography variant="h6">Forbidden: You do not have permission.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack spacing={2}>
        <Paper sx={{ p: 2.5 }}>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5">Notification Templates</Typography>
              <Typography variant="body2" color="text.secondary">Manage in-app and push notification copy by event and language.</Typography>
            </Box>
            <Button variant="outlined" startIcon={<VisibilityIcon />} onClick={handleValidateEnglish}>Validate English</Button>
            <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd} disabled={!canUpdate}>Add Template</Button>
          </Stack>
          {englishValidation ? <Typography variant="body2" sx={{ mt: 1 }}>{englishValidation}</Typography> : null}
        </Paper>

        <Paper sx={{ p: 2 }}>
          <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
            <TextField size="small" label="Event Key" value={filters.event_key} onChange={(e) => setFilters((p) => ({ ...p, event_key: e.target.value }))} />
            <TextField select size="small" label="Language" value={filters.language} onChange={(e) => setFilters((p) => ({ ...p, language: e.target.value }))} sx={{ minWidth: 170 }}>
              <MenuItem value="">All</MenuItem>
              {LANGUAGE_OPTIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
              ))}
            </TextField>
            <TextField select size="small" label="Channel" value={filters.channel} onChange={(e) => setFilters((p) => ({ ...p, channel: e.target.value }))} sx={{ minWidth: 150 }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="in_app">In App</MenuItem>
              <MenuItem value="push">Push</MenuItem>
              <MenuItem value="both">Both</MenuItem>
            </TextField>
            <TextField select size="small" label="Status" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} sx={{ minWidth: 150 }}>
              <MenuItem value="">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
            <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading}>Refresh</Button>
          </Stack>
        </Paper>

        <Paper sx={{ p: 2 }}>
          <ResponsiveDataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            autoHeight
            getRowId={(row) => row.id}
            pageSizeOptions={[20, 50, 100]}
            initialState={{ pagination: { paginationModel: { pageSize: 20, page: 0 } } }}
            minWidth={1120}
          />
        </Paper>
      </Stack>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{form._id ? "Edit Template" : "Add Template"}</DialogTitle>
        <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
          <Stack spacing={2.25}>
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 180px 220px" }, gap: 2 }}>
              <TextField size="small" variant="outlined" label="Event Key" value={form.event_key} onChange={(e) => setForm((p) => ({ ...p, event_key: e.target.value.toUpperCase() }))} fullWidth required sx={compactFieldSx} />
              <TextField select size="small" variant="outlined" label="Channel" value={form.channel} onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))} fullWidth sx={compactFieldSx}>
                <MenuItem value="in_app">In App</MenuItem>
                <MenuItem value="push">Push</MenuItem>
                <MenuItem value="both">Both</MenuItem>
              </TextField>
              <TextField select size="small" variant="outlined" label="Language" value={form.language} onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))} fullWidth required sx={compactFieldSx}>
                {LANGUAGE_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                ))}
              </TextField>
            </Box>
            <TextField size="small" variant="outlined" label="Title Template" value={form.title_template} onChange={(e) => setForm((p) => ({ ...p, title_template: e.target.value }))} fullWidth required sx={compactFieldSx} />
            <TextField
              variant="outlined"
              label="Body Template"
              value={form.body_template}
              onChange={(e) => setForm((p) => ({ ...p, body_template: e.target.value }))}
              fullWidth
              multiline
              minRows={4}
              required
              sx={cleanMultilineFieldSx}
              inputProps={{ spellCheck: false }}
            />
            <TextField size="small" variant="outlined" label="Variables" value={form.variables} onChange={(e) => setForm((p) => ({ ...p, variables: e.target.value }))} helperText="Comma-separated variable names. Template placeholders like {{party_type}}, {{mandi_name}}, {{org_name}} are preserved." fullWidth sx={compactFieldSx} />
            <Stack direction="row" spacing={1} alignItems="center" sx={{ minHeight: 36 }}>
              <Switch size="small" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
              <Typography variant="body2">Active</Typography>
            </Stack>
            <TextField
              variant="outlined"
              label="Sample Variables JSON"
              value={sampleVariables}
              onChange={(e) => setSampleVariables(e.target.value)}
              fullWidth
              multiline
              minRows={4}
              sx={cleanMultilineFieldSx}
              inputProps={{ spellCheck: false }}
            />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "auto minmax(220px, 1fr) auto" }, gap: 1, alignItems: "center" }}>
              <Button variant="outlined" startIcon={<VisibilityIcon />} onClick={handlePreview} sx={{ minHeight: 40 }}>Preview</Button>
              <TextField label="Test username/mobile" value={testTarget} onChange={(e) => setTestTarget(e.target.value)} size="small" variant="outlined" fullWidth sx={compactFieldSx} />
              <Button variant="outlined" startIcon={<SendIcon />} onClick={handleTestSend} disabled={!canTest || !testTarget || !form.event_key} sx={{ minHeight: 40 }}>Test Send</Button>
            </Box>
            {(preview.title || preview.body) ? (
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2">{preview.title}</Typography>
                <Typography variant="body2" sx={{ mt: 0.5 }}>{preview.body}</Typography>
              </Paper>
            ) : null}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!canUpdate}>Save</Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};

export default NotificationTemplates;

// import React, { useCallback, useEffect, useMemo, useState } from "react";
// import {
//   Box,
//   Button,
//   Chip,
//   Dialog,
//   DialogActions,
//   DialogContent,
//   DialogTitle,
//   MenuItem,
//   Paper,
//   Stack,
//   Switch,
//   TextField,
//   Typography,
// } from "@mui/material";
// import AddIcon from "@mui/icons-material/Add";
// import RefreshIcon from "@mui/icons-material/Refresh";
// import SendIcon from "@mui/icons-material/Send";
// import VisibilityIcon from "@mui/icons-material/Visibility";
// import { type GridColDef } from "@mui/x-data-grid";
// import { useSnackbar } from "notistack";
// import { useTranslation } from "react-i18next";
// import { PageContainer } from "../../components/PageContainer";
// import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
// import { normalizeLanguageCode } from "../../config/languages";
// import { usePermissions } from "../../authz/usePermissions";
// import {
//   fetchNotificationTemplates,
//   previewNotificationTemplate,
//   saveNotificationTemplate,
//   testSendNotificationTemplate,
//   validateNotificationTemplatesEnglish,
// } from "../../services/notificationTemplatesApi";

// type TemplateRow = {
//   _id?: string;
//   id: string;
//   event_key: string;
//   channel: "in_app" | "push" | "both";
//   language: string;
//   title_template: string;
//   body_template: string;
//   variables: string[];
//   is_active: boolean;
//   updated_on?: string;
// };

// const EMPTY_FORM = {
//   _id: "",
//   event_key: "",
//   channel: "both",
//   language: "en",
//   title_template: "",
//   body_template: "",
//   variables: "",
//   is_active: true,
// };

// const LANGUAGE_OPTIONS = [
//   { value: "en", label: "en - English" },
//   { value: "hi", label: "hi - Hindi" },
//   { value: "mr", label: "mr - Marathi" },
//   { value: "gu", label: "gu - Gujarati" },
//   { value: "pa", label: "pa - Punjabi" },
//   { value: "bn", label: "bn - Bengali" },
//   { value: "ta", label: "ta - Tamil" },
//   { value: "te", label: "te - Telugu" },
//   { value: "kn", label: "kn - Kannada" },
//   { value: "ml", label: "ml - Malayalam" },
//   { value: "or", label: "or - Odia" },
//   { value: "as", label: "as - Assamese" },
//   { value: "ur", label: "ur - Urdu" },
// ];

// const compactFieldSx = {
//   "& .MuiOutlinedInput-root": {
//     minHeight: 40,
//   },
// };

// const bodyTemplateFieldSx = {
//   "& textarea": {
//     border: 0,
//     outline: 0,
//     boxShadow: "none",
//     background: "transparent",
//   },
// };

// function currentUsername(): string | null {
//   try {
//     const raw = localStorage.getItem("cd_user");
//     const parsed = raw ? JSON.parse(raw) : null;
//     return parsed?.username || null;
//   } catch {
//     return null;
//   }
// }

// function parseJsonObject(raw: string) {
//   if (!raw.trim()) return {};
//   const parsed = JSON.parse(raw);
//   if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Sample variables must be a JSON object.");
//   return parsed;
// }

// export const NotificationTemplates: React.FC = () => {
//   const { i18n } = useTranslation();
//   const { enqueueSnackbar } = useSnackbar();
//   const { can } = usePermissions();
//   const language = normalizeLanguageCode(i18n.language);
//   const canView = useMemo(() => can("notification_templates.view", "VIEW"), [can]);
//   const canUpdate = useMemo(() => can("notification_templates.update", "UPDATE"), [can]);
//   const canTest = useMemo(() => can("notification_templates.test", "CREATE"), [can]);

//   const [rows, setRows] = useState<TemplateRow[]>([]);
//   const [loading, setLoading] = useState(false);
//   const [filters, setFilters] = useState({ event_key: "", language: "", channel: "", status: "" });
//   const [dialogOpen, setDialogOpen] = useState(false);
//   const [form, setForm] = useState(EMPTY_FORM);
//   const [sampleVariables, setSampleVariables] = useState('{"party_type":"FARMER","org_name":"Demo Org","mandi_name":"Demo Mandi"}');
//   const [preview, setPreview] = useState({ title: "", body: "" });
//   const [testTarget, setTestTarget] = useState("");
//   const [englishValidation, setEnglishValidation] = useState<string>("");

//   const loadData = useCallback(async () => {
//     const username = currentUsername();
//     if (!username || !canView) return;
//     setLoading(true);
//     try {
//       const resp = await fetchNotificationTemplates({
//         username,
//         language,
//         filters: {
//           event_key: filters.event_key || undefined,
//           language: filters.language || undefined,
//           channel: filters.channel || undefined,
//           is_active: filters.status === "" ? undefined : filters.status === "active",
//         },
//       });
//       const list = resp?.data?.items || resp?.response?.data?.items || [];
//       setRows(list.map((item: any) => ({ id: item._id || `${item.event_key}-${item.language}`, ...item })));
//     } catch (err: any) {
//       enqueueSnackbar(err?.message || "Unable to load notification templates.", { variant: "error" });
//     } finally {
//       setLoading(false);
//     }
//   }, [canView, enqueueSnackbar, filters.channel, filters.event_key, filters.language, filters.status, language]);

//   const openAdd = () => {
//     setForm(EMPTY_FORM);
//     setPreview({ title: "", body: "" });
//     setDialogOpen(true);
//   };

//   const openEdit = (row: TemplateRow) => {
//     setForm({
//       _id: row._id || row.id || "",
//       event_key: row.event_key || "",
//       channel: row.channel || "both",
//       language: row.language || "en",
//       title_template: row.title_template || "",
//       body_template: row.body_template || "",
//       variables: Array.isArray(row.variables) ? row.variables.join(", ") : "",
//       is_active: row.is_active !== false,
//     });
//     setPreview({ title: "", body: "" });
//     setDialogOpen(true);
//   };

//   const handleSave = async () => {
//     const username = currentUsername();
//     if (!username || !canUpdate) return;
//     try {
//       const resp = await saveNotificationTemplate({
//         ...form,
//         username,
//         language,
//         template_language: form.language,
//       });
//       const code = resp?.response?.responsecode || "1";
//       const desc = resp?.response?.description || "Save failed.";
//       if (code !== "0") {
//         enqueueSnackbar(desc, { variant: "error" });
//         return;
//       }
//       enqueueSnackbar("Template saved.", { variant: "success" });
//       setDialogOpen(false);
//       loadData();
//     } catch (err: any) {
//       enqueueSnackbar(err?.message || "Save failed.", { variant: "error" });
//     }
//   };

//   const handlePreview = async () => {
//     const username = currentUsername();
//     if (!username) return;
//     try {
//       const sample = parseJsonObject(sampleVariables);
//       const resp = await previewNotificationTemplate({
//         username,
//         language,
//         title_template: form.title_template,
//         body_template: form.body_template,
//         sample_variables: sample,
//       });
//       setPreview(resp?.data || resp?.response?.data || { title: "", body: "" });
//     } catch (err: any) {
//       enqueueSnackbar(err?.message || "Preview failed.", { variant: "error" });
//     }
//   };

//   const handleTestSend = async () => {
//     const username = currentUsername();
//     if (!username || !canTest) return;
//     try {
//       const sample = parseJsonObject(sampleVariables);
//       const resp = await testSendNotificationTemplate({
//         username,
//         language,
//         event_key: form.event_key,
//         template_language: form.language,
//         target_username: testTarget,
//         target_mobile: testTarget,
//         sample_variables: sample,
//       });
//       const code = resp?.response?.responsecode || "1";
//       enqueueSnackbar(code === "0" ? "Test notification submitted." : resp?.response?.description || "Test send failed.", {
//         variant: code === "0" ? "success" : "error",
//       });
//     } catch (err: any) {
//       enqueueSnackbar(err?.message || "Test send failed.", { variant: "error" });
//     }
//   };

//   const handleValidateEnglish = async () => {
//     const username = currentUsername();
//     if (!username) return;
//     const resp = await validateNotificationTemplatesEnglish({ username, language });
//     const data = resp?.data || resp?.response?.data || {};
//     const missing = data?.missing || [];
//     setEnglishValidation(data.valid ? "All event keys have English templates." : `Missing English templates: ${missing.map((m: any) => m.event_key).join(", ")}`);
//   };

//   const columns = useMemo<GridColDef<TemplateRow>[]>(
//     () => [
//       { field: "event_key", headerName: "Event Key", width: 250 },
//       { field: "language", headerName: "Lang", width: 90 },
//       { field: "channel", headerName: "Channel", width: 120 },
//       {
//         field: "title_template",
//         headerName: "Title",
//         width: 260,
//       },
//       {
//         field: "variables",
//         headerName: "Variables",
//         width: 220,
//         renderCell: (params) => Array.isArray(params.row.variables) ? params.row.variables.join(", ") : "",
//       },
//       {
//         field: "is_active",
//         headerName: "Status",
//         width: 110,
//         renderCell: (params) => <Chip size="small" color={params.value ? "success" : "default"} label={params.value ? "Active" : "Inactive"} />,
//       },
//       {
//         field: "actions",
//         headerName: "Actions",
//         width: 120,
//         sortable: false,
//         renderCell: (params) => (
//           <Button size="small" variant="outlined" onClick={() => openEdit(params.row)} disabled={!canUpdate}>
//             Edit
//           </Button>
//         ),
//       },
//     ],
//     [canUpdate],
//   );

//   useEffect(() => {
//     loadData();
//   }, [loadData]);

//   if (!canView) {
//     return (
//       <PageContainer>
//         <Typography variant="h6">Forbidden: You do not have permission.</Typography>
//       </PageContainer>
//     );
//   }

//   return (
//     <PageContainer>
//       <Stack spacing={2}>
//         <Paper sx={{ p: 2.5 }}>
//           <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5} alignItems={{ sm: "center" }}>
//             <Box sx={{ flex: 1 }}>
//               <Typography variant="h5">Notification Templates</Typography>
//               <Typography variant="body2" color="text.secondary">Manage in-app and push notification copy by event and language.</Typography>
//             </Box>
//             <Button variant="outlined" startIcon={<VisibilityIcon />} onClick={handleValidateEnglish}>Validate English</Button>
//             <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd} disabled={!canUpdate}>Add Template</Button>
//           </Stack>
//           {englishValidation ? <Typography variant="body2" sx={{ mt: 1 }}>{englishValidation}</Typography> : null}
//         </Paper>

//         <Paper sx={{ p: 2 }}>
//           <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
//             <TextField size="small" label="Event Key" value={filters.event_key} onChange={(e) => setFilters((p) => ({ ...p, event_key: e.target.value }))} />
//             <TextField select size="small" label="Language" value={filters.language} onChange={(e) => setFilters((p) => ({ ...p, language: e.target.value }))} sx={{ minWidth: 170 }}>
//               <MenuItem value="">All</MenuItem>
//               {LANGUAGE_OPTIONS.map((opt) => (
//                 <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
//               ))}
//             </TextField>
//             <TextField select size="small" label="Channel" value={filters.channel} onChange={(e) => setFilters((p) => ({ ...p, channel: e.target.value }))} sx={{ minWidth: 150 }}>
//               <MenuItem value="">All</MenuItem>
//               <MenuItem value="in_app">In App</MenuItem>
//               <MenuItem value="push">Push</MenuItem>
//               <MenuItem value="both">Both</MenuItem>
//             </TextField>
//             <TextField select size="small" label="Status" value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} sx={{ minWidth: 150 }}>
//               <MenuItem value="">All</MenuItem>
//               <MenuItem value="active">Active</MenuItem>
//               <MenuItem value="inactive">Inactive</MenuItem>
//             </TextField>
//             <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadData} disabled={loading}>Refresh</Button>
//           </Stack>
//         </Paper>

//         <Paper sx={{ p: 2 }}>
//           <ResponsiveDataGrid
//             rows={rows}
//             columns={columns}
//             loading={loading}
//             autoHeight
//             getRowId={(row) => row.id}
//             pageSizeOptions={[20, 50, 100]}
//             initialState={{ pagination: { paginationModel: { pageSize: 20, page: 0 } } }}
//             minWidth={1120}
//           />
//         </Paper>
//       </Stack>

//       <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
//         <DialogTitle>{form._id ? "Edit Template" : "Add Template"}</DialogTitle>
//         <DialogContent dividers sx={{ px: 3, py: 2.5 }}>
//           <Stack spacing={2.25}>
//             <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 180px 220px" }, gap: 2 }}>
//               <TextField size="small" variant="outlined" label="Event Key" value={form.event_key} onChange={(e) => setForm((p) => ({ ...p, event_key: e.target.value.toUpperCase() }))} fullWidth required sx={compactFieldSx} />
//               <TextField select size="small" variant="outlined" label="Channel" value={form.channel} onChange={(e) => setForm((p) => ({ ...p, channel: e.target.value }))} fullWidth sx={compactFieldSx}>
//                 <MenuItem value="in_app">In App</MenuItem>
//                 <MenuItem value="push">Push</MenuItem>
//                 <MenuItem value="both">Both</MenuItem>
//               </TextField>
//               <TextField select size="small" variant="outlined" label="Language" value={form.language} onChange={(e) => setForm((p) => ({ ...p, language: e.target.value }))} fullWidth required sx={compactFieldSx}>
//                 {LANGUAGE_OPTIONS.map((opt) => (
//                   <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
//                 ))}
//               </TextField>
//             </Box>
//             <TextField size="small" variant="outlined" label="Title Template" value={form.title_template} onChange={(e) => setForm((p) => ({ ...p, title_template: e.target.value }))} fullWidth required sx={compactFieldSx} />
//             <TextField variant="outlined" label="Body Template" value={form.body_template} onChange={(e) => setForm((p) => ({ ...p, body_template: e.target.value }))} fullWidth multiline minRows={4} required sx={bodyTemplateFieldSx} />
//             <TextField size="small" variant="outlined" label="Variables" value={form.variables} onChange={(e) => setForm((p) => ({ ...p, variables: e.target.value }))} helperText="Comma-separated variable names. Template placeholders like {{party_type}}, {{mandi_name}}, {{org_name}} are preserved." fullWidth sx={compactFieldSx} />
//             <Stack direction="row" spacing={1} alignItems="center" sx={{ minHeight: 36 }}>
//               <Switch size="small" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
//               <Typography variant="body2">Active</Typography>
//             </Stack>
//             <TextField variant="outlined" label="Sample Variables JSON" value={sampleVariables} onChange={(e) => setSampleVariables(e.target.value)} fullWidth multiline minRows={4} />
//             <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "auto minmax(220px, 1fr) auto" }, gap: 1, alignItems: "center" }}>
//               <Button variant="outlined" startIcon={<VisibilityIcon />} onClick={handlePreview} sx={{ minHeight: 40 }}>Preview</Button>
//               <TextField label="Test username/mobile" value={testTarget} onChange={(e) => setTestTarget(e.target.value)} size="small" variant="outlined" fullWidth sx={compactFieldSx} />
//               <Button variant="outlined" startIcon={<SendIcon />} onClick={handleTestSend} disabled={!canTest || !testTarget || !form.event_key} sx={{ minHeight: 40 }}>Test Send</Button>
//             </Box>
//             {(preview.title || preview.body) ? (
//               <Paper variant="outlined" sx={{ p: 2 }}>
//                 <Typography variant="subtitle2">{preview.title}</Typography>
//                 <Typography variant="body2" sx={{ mt: 0.5 }}>{preview.body}</Typography>
//               </Paper>
//             ) : null}
//           </Stack>
//         </DialogContent>
//         <DialogActions>
//           <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
//           <Button variant="contained" onClick={handleSave} disabled={!canUpdate}>Save</Button>
//         </DialogActions>
//       </Dialog>
//     </PageContainer>
//   );
// };

// export default NotificationTemplates;
