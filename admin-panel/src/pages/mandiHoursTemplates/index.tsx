import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { useCrudPermissions } from "../../utils/useCrudPermissions";
import {
  fetchMandiHoursTemplates,
  createMandiHoursTemplate,
  updateMandiHoursTemplate,
  deactivateMandiHoursTemplate,
  getMandisForCurrentScope,
} from "../../services/mandiApi";

type MandiOption = {
  mandi_id: number;
  label?: string;
  name_i18n?: Record<string, string>;
  mandi_slug?: string;
};

type HoursRow = {
  id: string;
  mandi_id: number;
  timezone: string;
  is_active: "Y" | "N";
  effective_from?: string | null;
  effective_to?: string | null;
  open_days?: string[];
  day_hours?: any[];
  exclusions?: {
    exclude_day_of_month?: number[];
    exclude_dates?: string[];
  };
};

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1));

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

function formatSummary(openDays: string[] = [], dayHours: any[] = []) {
  if (!openDays.length || !dayHours.length) return "No schedule";
  const times = dayHours.flatMap((entry: any) => {
    if (Array.isArray(entry?.windows)) {
      return entry.windows.map(
        (w: any) => `${w.open_time || w.open}-${w.close_time || w.close}`,
      );
    }
    return [`${entry.open_time || entry.open}-${entry.close_time || entry.close}`];
  }).filter(Boolean);
  return `${openDays.join(", ")} ${times.join(", ")}`;
}

export const MandiHoursTemplates: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const orgId = uiConfig?.scope?.org_id ? String(uiConfig.scope.org_id) : "";

  const { canCreate, canEdit, canDeactivate } = useCrudPermissions("mandi_hours");

  const [mandis, setMandis] = useState<MandiOption[]>([]);
  const [selectedMandiId, setSelectedMandiId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Y" | "N">("ALL");
  const [rows, setRows] = useState<HoursRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [effectiveFrom, setEffectiveFrom] = useState<string>("");
  const [effectiveTo, setEffectiveTo] = useState<string>("");
  const [useEndDate, setUseEndDate] = useState(false);
  const [timezone, setTimezone] = useState<string>("Asia/Kolkata");
  const [openDays, setOpenDays] = useState<string[]>([]);
  const [openAllDays, setOpenAllDays] = useState(false);
  const [dayHours, setDayHours] = useState<Record<string, { open: string; close: string; note?: string }[]>>({});
  const [closedOnMonthlyDay, setClosedOnMonthlyDay] = useState(false);
  const [monthlyDays, setMonthlyDays] = useState<string[]>([]);
  const [closedOnDates, setClosedOnDates] = useState(false);
  const [closedDates, setClosedDates] = useState<string[]>([]);

  const loadMandis = useCallback(async () => {
    const username = currentUsername();
    if (!username || !orgId) return;
    const resp = await getMandisForCurrentScope({
      username,
      language,
      org_id: orgId,
      filters: { page: 1, pageSize: 200 },
    });
    setMandis(Array.isArray(resp) ? resp : []);
  }, [language, orgId]);

  const loadTemplates = useCallback(async () => {
    const username = currentUsername();
    if (!username || !selectedMandiId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetchMandiHoursTemplates({
        username,
        language,
        filters: {
          mandi_id: Number(selectedMandiId),
          is_active: statusFilter === "ALL" ? undefined : statusFilter,
        },
      });
      const list = resp?.data?.items || resp?.response?.data?.items || [];
      setRows(
        list.map((item: any) => ({
          id: String(item.template_id || item._id),
          mandi_id: Number(item.mandi_id || 0),
          timezone: item.timezone || "Asia/Kolkata",
          is_active: item.is_active || "Y",
          effective_from: item.effective_from || null,
          effective_to: item.effective_to || null,
          open_days: item.open_days || [],
          day_hours: item.day_hours || [],
          exclusions: item.exclusions || undefined,
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [language, selectedMandiId, statusFilter]);

  useEffect(() => {
    loadMandis();
  }, [loadMandis]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const resetForm = useCallback(() => {
    setEffectiveFrom("");
    setEffectiveTo("");
    setUseEndDate(false);
    setTimezone("Asia/Kolkata");
    setOpenDays([]);
    setOpenAllDays(false);
    setDayHours({});
    setClosedOnMonthlyDay(false);
    setMonthlyDays([]);
    setClosedOnDates(false);
    setClosedDates([]);
  }, []);

  const openCreate = () => {
    setIsEdit(false);
    setEditId(null);
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (row: HoursRow) => {
    setIsEdit(true);
    setEditId(row.id);
    setEffectiveFrom(row.effective_from ? String(row.effective_from).slice(0, 10) : "");
    setEffectiveTo(row.effective_to ? String(row.effective_to).slice(0, 10) : "");
    setUseEndDate(Boolean(row.effective_to));
    setTimezone(row.timezone || "Asia/Kolkata");
    setOpenDays(row.open_days || []);
    const nextDayHours: Record<string, { open: string; close: string; note?: string }[]> = {};
    (row.day_hours || []).forEach((w: any) => {
      const day = w.day || "MON";
      if (Array.isArray(w.windows)) {
        w.windows.forEach((win: any) => {
          if (!nextDayHours[day]) nextDayHours[day] = [];
          nextDayHours[day].push({
            open: win.open_time || win.open || "",
            close: win.close_time || win.close || "",
            note: win.note || "",
          });
        });
      } else {
        if (!nextDayHours[day]) nextDayHours[day] = [];
        nextDayHours[day].push({
          open: w.open_time || w.open || "",
          close: w.close_time || w.close || "",
          note: w.note || "",
        });
      }
    });
    setDayHours(nextDayHours);
    const excludeDayOfMonth = row.exclusions?.exclude_day_of_month || [];
    const excludeDates = row.exclusions?.exclude_dates || [];
    setClosedOnMonthlyDay(excludeDayOfMonth.length > 0);
    setMonthlyDays(excludeDayOfMonth.map((d) => String(d)));
    setClosedOnDates(excludeDates.length > 0);
    setClosedDates(excludeDates.map((d) => String(d).slice(0, 10)));
    setDialogOpen(true);
  };

  const toggleDay = (day: string) => {
    setOpenDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day],
    );
    setDayHours((prev) => {
      if (prev[day]) return prev;
      return { ...prev, [day]: [{ open: "09:00", close: "17:00" }] };
    });
  };

  const updateWindow = (day: string, index: number, field: "open" | "close" | "note", value: string) => {
    setDayHours((prev) => {
      const next = { ...prev };
      const list = [...(next[day] || [])];
      const row = { ...list[index], [field]: value };
      list[index] = row;
      next[day] = list;
      return next;
    });
  };

  const addWindow = (day: string) => {
    setDayHours((prev) => ({
      ...prev,
      [day]: [...(prev[day] || []), { open: "09:00", close: "17:00" }],
    }));
  };

  const removeWindow = (day: string, index: number) => {
    setDayHours((prev) => {
      const list = [...(prev[day] || [])];
      list.splice(index, 1);
      return { ...prev, [day]: list };
    });
  };

  useEffect(() => {
    setOpenAllDays(openDays.length === DAYS.length);
  }, [openDays]);

  const handleToggleAllDays = (checked: boolean) => {
    setOpenAllDays(checked);
    if (checked) {
      setOpenDays(DAYS);
      setDayHours((prev) => {
        const next = { ...prev };
        DAYS.forEach((day) => {
          if (!next[day] || next[day].length === 0) {
            next[day] = [{ open: "09:00", close: "17:00" }];
          }
        });
        return next;
      });
    }
  };

  const addClosedDate = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    setClosedDates((prev) => (prev.includes(trimmed) ? prev : [...prev, trimmed]));
  };

  const removeClosedDate = (value: string) => {
    setClosedDates((prev) => prev.filter((item) => item !== value));
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username || !selectedMandiId) return;
    const compiledHours = openDays.map((day) => ({
      day,
      windows: (dayHours[day] || []).map((w) => ({
        open_time: w.open,
        close_time: w.close,
        note: w.note || undefined,
      })),
    }));
    const effectiveFromValue =
      effectiveFrom || new Date().toISOString().slice(0, 10);
    const payload: any = {
      mandi_id: Number(selectedMandiId),
      timezone,
      open_days: openDays,
      day_hours: compiledHours,
      effective_from: effectiveFromValue,
      effective_to: useEndDate ? effectiveTo || undefined : null,
      is_active: "Y",
    };
    if (isEdit && editId) {
      const exclusionDays = closedOnMonthlyDay
        ? monthlyDays.map((value) => Number(value)).filter((value) => Number.isInteger(value))
        : [];
      const exclusionDates = closedOnDates ? closedDates : [];
      payload.exclusions = {
        exclude_day_of_month: exclusionDays,
        exclude_dates: exclusionDates,
      };
      payload.template_id = editId;
      await updateMandiHoursTemplate({ username, language, payload });
    } else {
      const exclusionDays = closedOnMonthlyDay
        ? monthlyDays.map((value) => Number(value)).filter((value) => Number.isInteger(value))
        : [];
      const exclusionDates = closedOnDates ? closedDates : [];
      if (exclusionDays.length || exclusionDates.length) {
        payload.exclusions = {
          exclude_day_of_month: exclusionDays,
          exclude_dates: exclusionDates,
        };
      }
      await createMandiHoursTemplate({ username, language, payload });
    }
    setDialogOpen(false);
    await loadTemplates();
  };

  const handleDeactivate = async (row: HoursRow) => {
    const username = currentUsername();
    if (!username || !selectedMandiId) return;
    await deactivateMandiHoursTemplate({
      username,
      language,
      payload: {
        mandi_id: Number(selectedMandiId),
        template_id: row.id,
        is_active: "N",
      },
    });
    await loadTemplates();
  };

  const columns = useMemo<GridColDef<HoursRow>[]>(
    () => [
      { field: "mandi_id", headerName: "Mandi", width: 120 },
      {
        field: "summary",
        headerName: "Schedule",
        flex: 1,
        minWidth: 260,
        valueGetter: (_, row) => formatSummary(row.open_days, row.day_hours),
      },
      {
        field: "effective_from",
        headerName: "Effective From",
        width: 150,
        valueGetter: (_, row) => (row.effective_from ? String(row.effective_from).slice(0, 10) : ""),
      },
      {
        field: "effective_to",
        headerName: "Effective To",
        width: 150,
        valueGetter: (_, row) => (row.effective_to ? String(row.effective_to).slice(0, 10) : ""),
      },
      { field: "is_active", headerName: "Status", width: 120 },
      {
        field: "actions",
        headerName: "Actions",
        width: 180,
        sortable: false,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            {canEdit && (
              <Button size="small" startIcon={<EditIcon />} onClick={() => openEdit(params.row)}>
                Edit
              </Button>
            )}
            {canDeactivate && (
              <Button
                size="small"
                color="error"
                startIcon={<BlockIcon />}
                onClick={() => handleDeactivate(params.row)}
              >
                Deactivate
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [canDeactivate, canEdit],
  );

  return (
    <PageContainer title="Mandi Hours Templates">
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems="center" sx={{ mb: 2 }}>
            <TextField
              label="Mandi"
              size="small"
              select
              value={selectedMandiId}
              onChange={(event) => setSelectedMandiId(String(event.target.value))}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="">Select mandi</MenuItem>
              {mandis.map((mandi) => (
                <MenuItem key={mandi.mandi_id} value={String(mandi.mandi_id)}>
                  {mandi.label || mandi.name_i18n?.en || mandi.mandi_slug || mandi.mandi_id}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Status"
              size="small"
              select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "ALL" | "Y" | "N")}
              sx={{ minWidth: 140 }}
            >
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="Y">Active</MenuItem>
              <MenuItem value="N">Inactive</MenuItem>
            </TextField>
            <Box sx={{ flex: 1 }} />
            {canCreate && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate} disabled={!selectedMandiId}>
                Create Template
              </Button>
            )}
          </Stack>

          {!selectedMandiId && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select a mandi to view hours templates.
            </Typography>
          )}

          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <ResponsiveDataGrid
              rows={rows}
              columns={columns}
              loading={loading}
              pageSizeOptions={[10, 25, 50]}
              paginationMode="client"
              autoHeight
              disableRowSelectionOnClick
            />
          </Box>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>{isEdit ? "Edit Template" : "Create Template"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Effective From"
                type="date"
                value={effectiveFrom}
                onChange={(event) => setEffectiveFrom(event.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            </Stack>
            <FormControlLabel
              control={
                <Switch
                  checked={useEndDate}
                  onChange={(event) => {
                    const checked = event.target.checked;
                    setUseEndDate(checked);
                    if (!checked) setEffectiveTo("");
                  }}
                />
              }
              label="Set end date"
            />
            {useEndDate && (
              <TextField
                label="Effective To"
                type="date"
                value={effectiveTo}
                onChange={(event) => setEffectiveTo(event.target.value)}
                InputLabelProps={{ shrink: true }}
                fullWidth
              />
            )}
            <TextField
              label="Timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={openAllDays}
                  onChange={(event) => handleToggleAllDays(event.target.checked)}
                />
              }
              label="Open all days"
            />
            <Stack direction="row" spacing={1} flexWrap="wrap">
              {DAYS.map((day) => (
                <Button
                  key={day}
                  variant={openDays.includes(day) ? "contained" : "outlined"}
                  size="small"
                  onClick={() => toggleDay(day)}
                >
                  {day}
                </Button>
              ))}
            </Stack>
            {openDays.map((day) => (
              <Box key={day} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
                <Typography sx={{ fontWeight: 700, mb: 1 }}>{day}</Typography>
                <Stack spacing={1}>
                  {(dayHours[day] || []).map((window, index) => (
                    <Stack key={`${day}-${index}`} direction={{ xs: "column", sm: "row" }} spacing={2}>
                      <TextField
                        label="Open"
                        type="time"
                        value={window.open}
                        onChange={(event) => updateWindow(day, index, "open", event.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                      <TextField
                        label="Close"
                        type="time"
                        value={window.close}
                        onChange={(event) => updateWindow(day, index, "close", event.target.value)}
                        InputLabelProps={{ shrink: true }}
                      />
                      <TextField
                        label="Note"
                        value={window.note || ""}
                        onChange={(event) => updateWindow(day, index, "note", event.target.value)}
                        fullWidth
                      />
                      <Button onClick={() => removeWindow(day, index)}>Remove</Button>
                    </Stack>
                  ))}
                  <Button variant="outlined" onClick={() => addWindow(day)}>
                    Add Window
                  </Button>
                </Stack>
              </Box>
            ))}
            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, p: 2 }}>
              <Typography sx={{ fontWeight: 700, mb: 1 }}>Exceptions (Optional)</Typography>
              <Typography variant="caption" color="text.secondary">
                Exceptions override weekly schedule.
              </Typography>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={closedOnMonthlyDay}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setClosedOnMonthlyDay(checked);
                        if (checked && monthlyDays.length === 0) {
                          setMonthlyDays(["1"]);
                        }
                      }}
                    />
                  }
                  label="Closed on a day every month"
                />
                {closedOnMonthlyDay && (
                  <TextField
                    label="Day of month"
                    select
                    SelectProps={{ multiple: true }}
                    value={monthlyDays}
                    onChange={(event) => setMonthlyDays(event.target.value as string[])}
                    fullWidth
                  >
                    {MONTH_DAYS.map((day) => (
                      <MenuItem key={day} value={day}>
                        {day}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                <FormControlLabel
                  control={
                    <Switch
                      checked={closedOnDates}
                      onChange={(event) => {
                        const checked = event.target.checked;
                        setClosedOnDates(checked);
                        if (!checked) setClosedDates([]);
                      }}
                    />
                  }
                  label="Closed on specific dates"
                />
                {closedOnDates && (
                  <Stack spacing={1}>
                    <TextField
                      label="Add date"
                      type="date"
                      InputLabelProps={{ shrink: true }}
                      onChange={(event) => addClosedDate(event.target.value)}
                    />
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      {closedDates.map((date) => (
                        <Chip
                          key={date}
                          label={date}
                          onDelete={() => removeClosedDate(date)}
                          size="small"
                        />
                      ))}
                    </Stack>
                  </Stack>
                )}
              </Stack>
            </Box>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!selectedMandiId || !openDays.length}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
