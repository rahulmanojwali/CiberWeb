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
  IconButton,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import CheckIcon from "@mui/icons-material/CheckCircleOutline";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useCrudPermissions } from "../../utils/useCrudPermissions";
import {
  editGateVehicleTypeUser,
  fetchGateVehicleTypesMaster,
  fetchGateVehicleTypesUser,
  importGateVehicleTypes,
  toggleGateVehicleTypeUser,
} from "../../services/gateApi";

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

type UserVehicleRow = {
  id: string;
  vehicle_type_code: string;
  display_label: string;
  label_i18n?: Record<string, string>;
  is_active: "Y" | "N";
  mandi_id?: number | null;
  notes?: string | null;
  sort_order?: number | null;
};

type MasterVehicleRow = {
  id: string;
  vehicle_type_code: string;
  name_i18n?: Record<string, string>;
};

type MandiOption = {
  mandi_id: number;
  label?: string;
  name_i18n?: Record<string, string>;
  mandi_slug?: string;
};

type EditFormState = {
  display_label: string;
  label_en: string;
  notes: string;
  sort_order: string;
};

const defaultEditForm: EditFormState = {
  display_label: "",
  label_en: "",
  notes: "",
  sort_order: "",
};

export const GateVehicleTypes: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);

  const { canCreate, canEdit, canDeactivate } = useCrudPermissions("gate_vehicle_types_masters");

  const [rows, setRows] = useState<UserVehicleRow[]>([]);
  const [mandis, setMandis] = useState<MandiOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState<"ALL" | "Y" | "N">("ALL");
  const [mandiFilter, setMandiFilter] = useState<"ALL" | number>("ALL");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  const [importOpen, setImportOpen] = useState(false);
  const [masterRows, setMasterRows] = useState<MasterVehicleRow[]>([]);
  const [masterSearch, setMasterSearch] = useState("");
  const [masterSelection, setMasterSelection] = useState<string[]>([]);
  const [masterLoading, setMasterLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editRow, setEditRow] = useState<UserVehicleRow | null>(null);
  const [editForm, setEditForm] = useState<EditFormState>(defaultEditForm);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [status, mandiFilter, language]);

  const mandiLookup = useMemo(() => {
    const map = new Map<number, string>();
    mandis.forEach((m) => {
      const label = m?.label || m?.name_i18n?.en || m?.mandi_slug || String(m?.mandi_id || "");
      if (typeof m?.mandi_id === "number") map.set(m.mandi_id, label);
    });
    return map;
  }, [mandis]);

  const loadUserData = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
      const payload: Record<string, any> = {
        username,
        language,
        page,
        pageSize,
      };
      if (debouncedSearch) payload.q = debouncedSearch;
      if (status !== "ALL") payload.is_active = status;
      if (mandiFilter !== "ALL") payload.mandi_id = mandiFilter;

      const resp = await fetchGateVehicleTypesUser(payload);
      const data = resp?.data || resp?.response?.data || {};
      const list = data?.vehicle_types || [];
      const meta = data?.meta || {};
      setRows(
        list.map((item: any, index: number) => ({
          id: String(item?._id || item?.id || `${item?.vehicle_type_code || "row"}-${index}`),
          vehicle_type_code: item?.vehicle_type_code || "",
          display_label: item?.display_label || item?.label || item?.vehicle_type_code || "",
          label_i18n: item?.label_i18n || undefined,
          is_active: item?.is_active || "Y",
          mandi_id: item?.mandi_id ?? null,
          notes: item?.notes || "",
          sort_order: item?.sort_order ?? null,
        })),
      );
      setMandis(Array.isArray(data?.filters?.mandis) ? data.filters.mandis : []);
      setTotalCount(Number(meta.totalCount || list.length || 0));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, language, mandiFilter, page, pageSize, status]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const loadMasterList = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    setMasterLoading(true);
    try {
      const payload: Record<string, any> = {
        username,
        language,
        page: 1,
        pageSize: 200,
      };
      if (masterSearch.trim()) payload.q = masterSearch.trim();
      const resp = await fetchGateVehicleTypesMaster(payload);
      const data = resp?.data || resp?.response?.data || {};
      const list = data?.vehicle_types || [];
      setMasterRows(
        list.map((item: any, index: number) => ({
          id: String(item?._id || item?.id || `${item?.vehicle_type_code || "master"}-${index}`),
          vehicle_type_code: item?.vehicle_type_code || "",
          name_i18n: item?.name_i18n || {},
        })),
      );
    } finally {
      setMasterLoading(false);
    }
  }, [language, masterSearch]);

  useEffect(() => {
    if (!importOpen) return;
    const timer = setTimeout(() => {
      loadMasterList();
    }, 350);
    return () => clearTimeout(timer);
  }, [importOpen, loadMasterList]);

  const openImport = () => {
    setMasterSelection([]);
    setMasterSearch("");
    setImportOpen(true);
  };

  const closeImport = () => {
    setImportOpen(false);
  };

  const handleImport = async () => {
    const username = currentUsername();
    if (!username || masterSelection.length === 0) return;
    const mandi_id = mandiFilter === "ALL" ? 0 : Number(mandiFilter);
    await importGateVehicleTypes({
      username,
      language,
      mandi_id,
      master_ids: masterSelection,
    });
    closeImport();
    loadUserData();
  };

  const openEdit = (row: UserVehicleRow) => {
    setEditRow(row);
    setEditForm({
      display_label: row.display_label || "",
      label_en: row.label_i18n?.en || "",
      notes: row.notes || "",
      sort_order: row.sort_order === null || row.sort_order === undefined ? "" : String(row.sort_order),
    });
    setEditOpen(true);
  };

  const closeEdit = () => {
    setEditOpen(false);
    setEditRow(null);
    setEditForm(defaultEditForm);
  };

  const handleEditSave = async () => {
    const username = currentUsername();
    if (!username || !editRow) return;
    const payload: Record<string, any> = {
      username,
      language,
      id: editRow.id,
      display_label: editForm.display_label,
      notes: editForm.notes,
    };
    if (editForm.label_en.trim()) {
      payload.label_i18n = { en: editForm.label_en.trim() };
    }
    if (editForm.sort_order.trim()) {
      payload.sort_order = Number(editForm.sort_order);
    }
    await editGateVehicleTypeUser(payload);
    closeEdit();
    loadUserData();
  };

  const handleToggle = async (row: UserVehicleRow) => {
    const username = currentUsername();
    if (!username) return;
    const nextStatus = row.is_active === "Y" ? "N" : "Y";
    await toggleGateVehicleTypeUser({
      username,
      language,
      id: row.id,
      is_active: nextStatus,
    });
    setRows((prev) =>
      prev.map((item) =>
        item.id === row.id ? { ...item, is_active: nextStatus } : item,
      ),
    );
  };

  const columns = useMemo<GridColDef<UserVehicleRow>[]>(
    () => [
      { field: "vehicle_type_code", headerName: "Code", width: 160 },
      {
        field: "display_label",
        headerName: "Label",
        flex: 1,
        minWidth: 220,
      },
      {
        field: "mandi_id",
        headerName: "Mandi",
        width: 160,
        valueGetter: (params: any) => {
          const mandiId = params?.row?.mandi_id;
          if (typeof mandiId !== "number") return "All";
          return mandiLookup.get(mandiId) || String(mandiId);
        },
      },
      {
        field: "is_active",
        headerName: "Status",
        width: 120,
        renderCell: (params: any) => (
          <Chip
            size="small"
            variant="outlined"
            color={params?.row?.is_active === "Y" ? "success" : "default"}
            label={params?.row?.is_active === "Y" ? "Active" : "Inactive"}
          />
        ),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 140,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            {canEdit && (
              <Tooltip title="Edit">
                <IconButton size="small" onClick={() => openEdit(params.row)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canDeactivate && (
              <Tooltip title={params.row.is_active === "Y" ? "Deactivate" : "Activate"}>
                <IconButton size="small" onClick={() => handleToggle(params.row)}>
                  {params.row.is_active === "Y" ? (
                    <BlockIcon fontSize="small" />
                  ) : (
                    <CheckIcon fontSize="small" />
                  )}
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        ),
      },
    ],
    [canDeactivate, canEdit, mandiLookup],
  );

  const masterColumns = useMemo<GridColDef<MasterVehicleRow>[]>(
    () => [
      { field: "vehicle_type_code", headerName: "Code", width: 160 },
      {
        field: "name_i18n",
        headerName: "Name",
        flex: 1,
        minWidth: 220,
        valueGetter: (params: any) => params?.row?.name_i18n?.en || params?.row?.vehicle_type_code,
      },
    ],
    [],
  );

  return (
    <PageContainer title={t("gateVehicleTypes:title", "Gate Vehicle Types")}>
      <Card>
        <CardContent>
          <Stack direction={{ xs: "column", md: "row" }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="Search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              size="small"
              sx={{ minWidth: 220 }}
            />
            <TextField
              label="Status"
              value={status}
              onChange={(event) => setStatus(event.target.value as "ALL" | "Y" | "N")}
              size="small"
              select
              sx={{ minWidth: 160 }}
            >
              <MenuItem value="ALL">All</MenuItem>
              <MenuItem value="Y">Active</MenuItem>
              <MenuItem value="N">Inactive</MenuItem>
            </TextField>
            <TextField
              label="Mandi"
              value={mandiFilter}
              onChange={(event) => {
                const value = event.target.value;
                setMandiFilter(value === "ALL" ? "ALL" : Number(value));
              }}
              size="small"
              select
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="ALL">All Mandis</MenuItem>
              {mandis.map((mandi) => (
                <MenuItem key={mandi.mandi_id} value={mandi.mandi_id}>
                  {mandi.label || mandi.name_i18n?.en || mandi.mandi_slug || mandi.mandi_id}
                </MenuItem>
              ))}
            </TextField>
            <Box sx={{ flex: 1 }} />
            {canCreate && (
              <Button variant="contained" startIcon={<AddIcon />} onClick={openImport}>
                Import
              </Button>
            )}
          </Stack>

          <ResponsiveDataGrid
            rows={rows}
            columns={columns}
            loading={loading}
            pageSizeOptions={[10, 25, 50, 100]}
            paginationMode="server"
            rowCount={totalCount}
            paginationModel={{ page: page - 1, pageSize }}
            onPaginationModelChange={(model) => {
              setPage(model.page + 1);
              setPageSize(model.pageSize);
            }}
            autoHeight
          />
        </CardContent>
      </Card>

      <Dialog open={importOpen} onClose={closeImport} fullWidth maxWidth="md">
        <DialogTitle>Import Vehicle Types</DialogTitle>
        <DialogContent>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2} sx={{ mb: 2 }}>
            <TextField
              label="Search master"
              value={masterSearch}
              onChange={(event) => setMasterSearch(event.target.value)}
              size="small"
              sx={{ minWidth: 240 }}
            />
            <Typography sx={{ color: "text.secondary", alignSelf: "center" }}>
              Selected: {masterSelection.length}
            </Typography>
          </Stack>
          <ResponsiveDataGrid
            rows={masterRows}
            columns={masterColumns}
            loading={masterLoading}
            checkboxSelection
            onRowSelectionModelChange={(selection) => setMasterSelection(selection as string[])}
            rowSelectionModel={masterSelection}
            pageSizeOptions={[25, 50, 100, 200]}
            autoHeight
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={closeImport}>Cancel</Button>
          <Button variant="contained" onClick={handleImport} disabled={masterSelection.length === 0}>
            Import Selected
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={closeEdit} fullWidth maxWidth="sm">
        <DialogTitle>Edit Vehicle Type</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Display label"
              value={editForm.display_label}
              onChange={(event) =>
                setEditForm((prev) => ({ ...prev, display_label: event.target.value }))
              }
              fullWidth
            />
            <TextField
              label="Label (English)"
              value={editForm.label_en}
              onChange={(event) => setEditForm((prev) => ({ ...prev, label_en: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Sort order"
              value={editForm.sort_order}
              onChange={(event) => setEditForm((prev) => ({ ...prev, sort_order: event.target.value }))}
              fullWidth
            />
            <TextField
              label="Notes"
              value={editForm.notes}
              onChange={(event) => setEditForm((prev) => ({ ...prev, notes: event.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEdit}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSave}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
