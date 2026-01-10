import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import DownloadIcon from "@mui/icons-material/Download";
import EditIcon from "@mui/icons-material/EditOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import CheckIcon from "@mui/icons-material/CheckCircleOutline";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { useCrudPermissions } from "../../utils/useCrudPermissions";
import {
  fetchMandiFacilitiesMasters,
  fetchMandiFacilities,
  createMandiFacility,
  updateMandiFacility,
  deactivateMandiFacility,
  getMandisForCurrentScope,
} from "../../services/mandiApi";

type MandiOption = {
  mandi_id: number;
  label?: string;
  name_i18n?: Record<string, string>;
  mandi_slug?: string;
};

type MasterFacility = {
  facility_code: string;
  label: string;
  is_active: string;
};

type FacilityRow = {
  id: string;
  facility_code: string;
  facility_label: string;
  capacity_num?: number | null;
  capacity_unit?: string | null;
  notes?: string | null;
  is_active: "Y" | "N";
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

export const MandiFacilities: React.FC = () => {
  const { i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const orgId = uiConfig?.scope?.org_id ? String(uiConfig.scope.org_id) : "";
  const theme = useTheme();
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const { canCreate, canEdit, canDeactivate } = useCrudPermissions("mandi_facilities");

  const [mandis, setMandis] = useState<MandiOption[]>([]);
  const [masters, setMasters] = useState<MasterFacility[]>([]);
  const [rows, setRows] = useState<FacilityRow[]>([]);
  const [loading, setLoading] = useState(false);

  const [selectedMandiId, setSelectedMandiId] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "Y" | "N">("ALL");
  const [search, setSearch] = useState<string>("");

  const [createOpen, setCreateOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const [createFacilityCode, setCreateFacilityCode] = useState<string>("");
  const [createCapacityNum, setCreateCapacityNum] = useState<string>("");
  const [createCapacityUnit, setCreateCapacityUnit] = useState<string>("");
  const [createNotes, setCreateNotes] = useState<string>("");

  const [bulkSelection, setBulkSelection] = useState<string[]>([]);

  const [editRow, setEditRow] = useState<FacilityRow | null>(null);
  const [editCapacityNum, setEditCapacityNum] = useState<string>("");
  const [editCapacityUnit, setEditCapacityUnit] = useState<string>("");
  const [editNotes, setEditNotes] = useState<string>("");

  const masterMap = useMemo(() => {
    const map = new Map<string, MasterFacility>();
    masters.forEach((m) => map.set(m.facility_code, m));
    return map;
  }, [masters]);

  const mappedCodes = useMemo(() => new Set(rows.map((r) => r.facility_code)), [rows]);

  const availableMasters = useMemo(
    () => masters.filter((m) => !mappedCodes.has(m.facility_code)),
    [masters, mappedCodes],
  );

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((row) => {
      const label = row.facility_label.toLowerCase();
      return label.includes(needle) || row.facility_code.toLowerCase().includes(needle);
    });
  }, [rows, search]);

  const loadMasters = useCallback(async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchMandiFacilitiesMasters({ username, language });
    const list = resp?.data?.items || resp?.response?.data?.items || [];
    setMasters(
      list
        .filter((item: any) => item?.is_active !== "N")
        .map((item: any) => ({
          facility_code: String(item.facility_code),
          label: String(item.label_i18n?.en || item.label_i18n?.hi || item.facility_code),
          is_active: item.is_active || "Y",
        })),
    );
  }, [language]);

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

  const loadFacilities = useCallback(async () => {
    const username = currentUsername();
    if (!username || !selectedMandiId) {
      setRows([]);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetchMandiFacilities({
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
          id: String(item._id || `${item.mandi_id}-${item.facility_code}`),
          facility_code: String(item.facility_code),
          facility_label:
            masterMap.get(String(item.facility_code))?.label || String(item.facility_code),
          capacity_num: item.capacity_num ?? null,
          capacity_unit: item.capacity_unit ?? null,
          notes: item.notes ?? null,
          is_active: item.is_active || "Y",
        })),
      );
    } finally {
      setLoading(false);
    }
  }, [language, masterMap, selectedMandiId, statusFilter]);

  useEffect(() => {
    loadMasters();
    loadMandis();
  }, [loadMandis, loadMasters]);

  useEffect(() => {
    loadFacilities();
  }, [loadFacilities]);

  const handleCreate = useCallback(async () => {
    const username = currentUsername();
    if (!username || !selectedMandiId || !createFacilityCode) return;
    await createMandiFacility({
      username,
      language,
      payload: {
        mandi_id: Number(selectedMandiId),
        facility_code: createFacilityCode,
        capacity_num: createCapacityNum ? Number(createCapacityNum) : undefined,
        capacity_unit: createCapacityUnit || undefined,
        notes: createNotes || undefined,
      },
    });
    setCreateFacilityCode("");
    setCreateCapacityNum("");
    setCreateCapacityUnit("");
    setCreateNotes("");
    setCreateOpen(false);
    await loadFacilities();
  }, [createCapacityNum, createCapacityUnit, createFacilityCode, createNotes, language, loadFacilities, selectedMandiId]);

  const handleBulkCreate = useCallback(async () => {
    const username = currentUsername();
    if (!username || !selectedMandiId || !bulkSelection.length) return;
    await createMandiFacility({
      username,
      language,
      payload: {
        mandi_id: Number(selectedMandiId),
        facility_codes: bulkSelection,
      },
    });
    setBulkSelection([]);
    setBulkOpen(false);
    await loadFacilities();
  }, [bulkSelection, language, loadFacilities, selectedMandiId]);

  const openEdit = useCallback((row: FacilityRow) => {
    setEditRow(row);
    setEditCapacityNum(row.capacity_num !== null && row.capacity_num !== undefined ? String(row.capacity_num) : "");
    setEditCapacityUnit(row.capacity_unit || "");
    setEditNotes(row.notes || "");
    setEditOpen(true);
  }, []);

  const handleEditSave = useCallback(async () => {
    const username = currentUsername();
    if (!username || !selectedMandiId || !editRow) return;
    await updateMandiFacility({
      username,
      language,
      payload: {
        mandi_id: Number(selectedMandiId),
        facility_code: editRow.facility_code,
        capacity_num: editCapacityNum ? Number(editCapacityNum) : undefined,
        capacity_unit: editCapacityUnit || undefined,
        notes: editNotes || undefined,
      },
    });
    setEditOpen(false);
    setEditRow(null);
    await loadFacilities();
  }, [editCapacityNum, editCapacityUnit, editNotes, editRow, language, loadFacilities, selectedMandiId]);

  const handleToggle = useCallback(
    async (row: FacilityRow) => {
      const username = currentUsername();
      if (!username || !selectedMandiId) return;
      const nextState = row.is_active === "Y" ? "N" : "Y";
      await deactivateMandiFacility({
        username,
        language,
        payload: {
          mandi_id: Number(selectedMandiId),
          facility_code: row.facility_code,
          is_active: nextState,
        },
      });
      setRows((prev) =>
        prev.map((item) => (item.id === row.id ? { ...item, is_active: nextState } : item)),
      );
    },
    [language, selectedMandiId],
  );

  const columns = useMemo<GridColDef<FacilityRow>[]>(
    () => [
      { field: "facility_label", headerName: "Facility", flex: 1, minWidth: 180 },
      { field: "facility_code", headerName: "Code", width: 140 },
      {
        field: "capacity",
        headerName: "Capacity",
        width: 140,
        valueGetter: (_, row) => {
          const num = row.capacity_num || "";
          const unit = row.capacity_unit || "";
          return num ? `${num}${unit ? ` ${unit}` : ""}` : "";
        },
      },
      {
        field: "is_active",
        headerName: "Status",
        width: 120,
        valueGetter: (_, row) => (row.is_active === "Y" ? "Active" : "Inactive"),
      },
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
                color={params.row.is_active === "Y" ? "error" : "success"}
                startIcon={params.row.is_active === "Y" ? <BlockIcon /> : <CheckIcon />}
                onClick={() => handleToggle(params.row)}
              >
                {params.row.is_active === "Y" ? "Deactivate" : "Activate"}
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [canDeactivate, canEdit, handleToggle, openEdit],
  );

  return (
    <PageContainer title="Mandi Facilities">
      <Typography sx={{ color: "text.secondary", mt: -1 }}>
        Manage mandi facilities for the selected mandi.
      </Typography>
      <Card>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            spacing={2}
            alignItems={{ xs: "stretch", md: "center" }}
            sx={{ mb: 2 }}
          >
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
            <TextField
              label="Search"
              size="small"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              sx={{ minWidth: 200 }}
            />
            <Box sx={{ flex: 1 }} />
            {canCreate && (
              <Stack direction={{ xs: "column", sm: "row" }} spacing={1}>
                <Tooltip title={!selectedMandiId ? "Select mandi first" : ""}>
                  <span>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => setCreateOpen(true)}
                      disabled={!selectedMandiId}
                      sx={{ alignSelf: isSmallScreen ? "stretch" : "center" }}
                    >
                      Add Facility
                    </Button>
                  </span>
                </Tooltip>
                <Button
                  variant="contained"
                  startIcon={<DownloadIcon />}
                  onClick={() => setBulkOpen(true)}
                  disabled={!selectedMandiId}
                  sx={{ alignSelf: isSmallScreen ? "stretch" : "center" }}
                >
                  Bulk Add
                </Button>
              </Stack>
            )}
          </Stack>

          {!selectedMandiId && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Select a mandi to view facilities.
            </Typography>
          )}

          <Box sx={{ width: "100%", overflowX: "auto" }}>
            <ResponsiveDataGrid
              rows={filteredRows}
              columns={columns}
              loading={loading}
              pageSizeOptions={[10, 25, 50]}
              paginationMode="client"
              autoHeight
              disableRowSelectionOnClick
              sx={{
                "& .MuiDataGrid-columnHeaders": {
                  position: "sticky",
                  top: 0,
                  zIndex: 2,
                  backgroundColor: theme.palette.background.paper,
                  borderBottom: `1px solid ${theme.palette.divider}`,
                },
              }}
            />
          </Box>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Add Facility</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              select
              label="Facility"
              value={createFacilityCode}
              onChange={(event) => setCreateFacilityCode(String(event.target.value))}
              fullWidth
            >
              <MenuItem value="">Select facility</MenuItem>
              {availableMasters.map((facility) => (
                <MenuItem key={facility.facility_code} value={facility.facility_code}>
                  {facility.label}
                </MenuItem>
              ))}
            </TextField>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Capacity"
                value={createCapacityNum}
                onChange={(event) => setCreateCapacityNum(event.target.value)}
                fullWidth
              />
              <TextField
                label="Unit"
                value={createCapacityUnit}
                onChange={(event) => setCreateCapacityUnit(event.target.value)}
                fullWidth
              />
            </Stack>
            <TextField
              label="Notes"
              value={createNotes}
              onChange={(event) => setCreateNotes(event.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreate} disabled={!createFacilityCode || !selectedMandiId}>
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={bulkOpen} onClose={() => setBulkOpen(false)} fullWidth maxWidth="md">
        <DialogTitle>Bulk Add Facilities</DialogTitle>
        <DialogContent>
          <Box sx={{ height: 520, mt: 1 }}>
            <ResponsiveDataGrid
              rows={availableMasters}
              columns={[
                { field: "facility_code", headerName: "Code", width: 140 },
                { field: "label", headerName: "Facility", flex: 1 },
              ]}
              getRowId={(row) => row.facility_code}
              checkboxSelection
              rowSelectionModel={bulkSelection}
              onRowSelectionModelChange={(selection) =>
                setBulkSelection((selection as (string | number)[]).map(String))
              }
              disableRowSelectionOnClick
              pageSizeOptions={[25, 50, 100]}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            startIcon={<DownloadIcon />}
            onClick={handleBulkCreate}
            disabled={!bulkSelection.length}
          >
            Add Selected {bulkSelection.length ? `(${bulkSelection.length})` : ""}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Edit Facility</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography>{editRow?.facility_label}</Typography>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField
                label="Capacity"
                value={editCapacityNum}
                onChange={(event) => setEditCapacityNum(event.target.value)}
                fullWidth
              />
              <TextField
                label="Unit"
                value={editCapacityUnit}
                onChange={(event) => setEditCapacityUnit(event.target.value)}
                fullWidth
              />
            </Stack>
            <TextField
              label="Notes"
              value={editNotes}
              onChange={(event) => setEditNotes(event.target.value)}
              fullWidth
              multiline
              minRows={2}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleEditSave} disabled={!editRow}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
