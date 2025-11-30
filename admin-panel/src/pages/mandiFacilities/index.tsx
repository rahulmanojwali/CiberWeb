import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
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
import { can } from "../../utils/adminUiConfig";
import {
  fetchMandiFacilitiesMasters,
  createMandiFacilityMaster,
  updateMandiFacilityMaster,
  deactivateMandiFacilityMaster,
  fetchMandiFacilities,
  createMandiFacility,
  updateMandiFacility,
  deactivateMandiFacility,
  fetchMandis,
} from "../../services/mandiApi";

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

type MasterRow = {
  id: string;
  facility_code: string;
  name: string;
  is_active: string;
};

type FacilityRow = {
  id: string;
  mandi_id: number;
  facility_code: string;
  is_active: string;
};

const masterDefault = { facility_code: "", name_en: "", is_active: "Y" };
const facilityDefault = { facility_code: "", is_active: "Y" };

export const MandiFacilities: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();

  const [masters, setMasters] = useState<MasterRow[]>([]);
  const [facilities, setFacilities] = useState<FacilityRow[]>([]);
  const [mandiOptions, setMandiOptions] = useState<any[]>([]);
  const [selectedMandi, setSelectedMandi] = useState<string>("");
  const [masterDialog, setMasterDialog] = useState(false);
  const [facilityDialog, setFacilityDialog] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [masterForm, setMasterForm] = useState(masterDefault);
  const [facilityForm, setFacilityForm] = useState(facilityDefault);
  const [masterEditId, setMasterEditId] = useState<string | null>(null);
  const [facilityEditId, setFacilityEditId] = useState<string | null>(null);
  const [masterStatus, setMasterStatus] = useState("ALL" as "ALL" | "Y" | "N");
  const [facilityStatus, setFacilityStatus] = useState("ALL" as "ALL" | "Y" | "N");

  const canCreateMaster = useMemo(
    () => can(uiConfig.resources, "mandi_facilities_masters.create", "CREATE"),
    [uiConfig.resources],
  );
  const canEditMaster = useMemo(
    () => can(uiConfig.resources, "mandi_facilities_masters.edit", "UPDATE"),
    [uiConfig.resources],
  );
  const canDeactivateMaster = useMemo(
    () => can(uiConfig.resources, "mandi_facilities_masters.deactivate", "DEACTIVATE"),
    [uiConfig.resources],
  );

  const canCreateMandiFacility = useMemo(
    () => can(uiConfig.resources, "mandi_facilities.create", "CREATE"),
    [uiConfig.resources],
  );
  const canEditFacility = useMemo(
    () => can(uiConfig.resources, "mandi_facilities.edit", "UPDATE"),
    [uiConfig.resources],
  );
  const canDeactivateFacility = useMemo(
    () => can(uiConfig.resources, "mandi_facilities.deactivate", "DEACTIVATE"),
    [uiConfig.resources],
  );

  const masterColumns = useMemo<GridColDef<MasterRow>[]>(
    () => [
      { field: "facility_code", headerName: "Facility Code", width: 160 },
      { field: "name", headerName: "Name", flex: 1 },
      { field: "is_active", headerName: "Active", width: 100 },
      {
        field: "actions",
        headerName: "Actions",
        width: 170,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            {canEditMaster && (
              <Button size="small" startIcon={<EditIcon />} onClick={() => openMasterEdit(params.row)}>
                Edit
              </Button>
            )}
            {canDeactivateMaster && (
              <Button
                size="small"
                color="error"
                startIcon={<BlockIcon />}
                onClick={() => handleMasterDeactivate(params.row.id)}
              >
                Deactivate
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [canEditMaster, canDeactivateMaster],
  );

  const facilityColumns = useMemo<GridColDef<FacilityRow>[]>(
    () => [
      { field: "mandi_id", headerName: "Mandi ID", width: 110 },
      { field: "facility_code", headerName: "Facility", width: 150 },
      { field: "is_active", headerName: "Active", width: 100 },
      {
        field: "actions",
        headerName: "Actions",
        width: 170,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            {canEditFacility && (
              <Button size="small" startIcon={<EditIcon />} onClick={() => openFacilityEdit(params.row)}>
                Edit
              </Button>
            )}
            {canDeactivateFacility && (
              <Button
                size="small"
                color="error"
                startIcon={<BlockIcon />}
                onClick={() => handleFacilityDeactivate(params.row.id)}
              >
                Deactivate
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [canEditFacility, canDeactivateFacility],
  );

  const loadMasters = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchMandiFacilitiesMasters({ username, language });
    const list = resp?.data?.items || resp?.data || resp?.response?.data?.items || [];
    const filtered = masterStatus === "ALL" ? list : list.filter((m: any) => m.is_active === masterStatus);
    setMasters(
      filtered.map((m: any) => ({
        id: m._id,
        facility_code: m.facility_code,
        name: m?.name_i18n?.en || m.facility_code,
        is_active: m.is_active,
      })),
    );
  };

  const loadMandis = async () => {
    const username = currentUsername();
    if (!username) return;
    const resp = await fetchMandis({ username, language, filters: { is_active: true } });
    const mandis = resp?.data?.mandis || [];
    setMandiOptions(mandis);
    if (!selectedMandi && mandis.length) setSelectedMandi(String(mandis[0].mandi_id));
  };

  const loadFacilities = async () => {
    const username = currentUsername();
    if (!username || !selectedMandi) return;
    const resp = await fetchMandiFacilities({
      username,
      language,
      filters: {
        mandi_id: Number(selectedMandi),
        is_active: facilityStatus === "ALL" ? undefined : facilityStatus,
      },
    });
    const list = resp?.data?.items || [];
    setFacilities(
      list.map((f: any) => ({
        id: f._id,
        mandi_id: f.mandi_id,
        facility_code: f.facility_code,
        is_active: f.is_active,
      })),
    );
  };

  useEffect(() => {
    loadMasters();
    loadMandis();
  }, []);

  useEffect(() => {
    loadMasters();
  }, [masterStatus]);

  useEffect(() => {
    loadFacilities();
  }, [selectedMandi, facilityStatus]);

  const openMasterCreate = () => {
    setMasterEditId(null);
    setMasterForm(masterDefault);
    setMasterDialog(true);
  };

  const openMasterEdit = (row: MasterRow) => {
    setMasterEditId(row.id);
    setMasterForm({ facility_code: row.facility_code, name_en: row.name, is_active: row.is_active });
    setMasterDialog(true);
  };

  const saveMaster = async () => {
    const username = currentUsername();
    if (!username) return;
    const payload: any = {
      facility_code: masterForm.facility_code,
      name_i18n: { en: masterForm.name_en },
      is_active: masterForm.is_active,
    };
    if (masterEditId) {
      payload._id = masterEditId;
      await updateMandiFacilityMaster({ username, language, payload });
    } else {
      await createMandiFacilityMaster({ username, language, payload });
    }
    setMasterDialog(false);
    await loadMasters();
  };

  const handleMasterDeactivate = async (id: string) => {
    const username = currentUsername();
    if (!username) return;
    await deactivateMandiFacilityMaster({ username, language, _id: id });
    await loadMasters();
  };

  const openFacilityCreate = () => {
    setFacilityEditId(null);
    setFacilityForm({ facility_code: "", is_active: "Y" });
    setFacilityDialog(true);
  };

  const handleOpenCreate = () => {
    setCreateOpen(true);
    openFacilityCreate();
  };

  const handleCloseCreate = () => {
    setCreateOpen(false);
    setFacilityDialog(false);
  };

  const openFacilityEdit = (row: FacilityRow) => {
    setCreateOpen(false);
    setFacilityEditId(row.id);
    setFacilityForm({ facility_code: row.facility_code, is_active: row.is_active });
    setFacilityDialog(true);
  };

  const saveFacility = async () => {
    const username = currentUsername();
    if (!username || !selectedMandi) return;
    const payload: any = {
      mandi_id: Number(selectedMandi),
      facility_code: facilityForm.facility_code,
      is_active: facilityForm.is_active,
    };
    if (facilityEditId) {
      payload._id = facilityEditId;
      await updateMandiFacility({ username, language, payload });
    } else {
      await createMandiFacility({ username, language, payload });
    }
    handleCloseCreate();
    await loadFacilities();
  };

  const handleFacilityDeactivate = async (id: string) => {
    const username = currentUsername();
    if (!username) return;
    await deactivateMandiFacility({ username, language, _id: id });
    await loadFacilities();
  };

  return (
    <PageContainer
      title={t("mandiFacilities.title", { defaultValue: "Mandi Facilities" })}
      actions={
        canCreateMandiFacility && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={createOpen}
            onClick={handleOpenCreate}
          >
            {t("mandiFacilities.actions.add", { defaultValue: "Add facility" })}
          </Button>
        )
      }
    >

      {/* Facility masters */}
      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
        <TextField
          select
          label="Status"
          size="small"
          value={masterStatus}
          onChange={(e) => setMasterStatus(e.target.value as any)}
          sx={{ width: 140 }}
        >
          <MenuItem value="ALL">All</MenuItem>
          <MenuItem value="Y">Active</MenuItem>
          <MenuItem value="N">Inactive</MenuItem>
        </TextField>
        {canCreateMaster && (
          <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openMasterCreate}>
            Add Facility Type
          </Button>
        )}
      </Stack>
      <Box sx={{ height: 320, mb: 3 }}>
        <ResponsiveDataGrid columns={masterColumns} rows={masters} loading={false} getRowId={(r) => r.id} />
      </Box>

      {/* Facilities for mandi */}
      <Stack direction="row" spacing={1} alignItems="center" mb={1}>
        <TextField
          select
          label="Mandi"
          size="small"
          value={selectedMandi}
          onChange={(e) => setSelectedMandi(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          {mandiOptions.map((m: any) => (
            <MenuItem key={m.mandi_id} value={m.mandi_id}>
              {m?.name_i18n?.en || m.mandi_slug || m.mandi_id}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Status"
          size="small"
          value={facilityStatus}
          onChange={(e) => setFacilityStatus(e.target.value as any)}
          sx={{ width: 140 }}
        >
          <MenuItem value="ALL">All</MenuItem>
          <MenuItem value="Y">Active</MenuItem>
          <MenuItem value="N">Inactive</MenuItem>
        </TextField>
      </Stack>
      <Box sx={{ height: 360 }}>
        <ResponsiveDataGrid columns={facilityColumns} rows={facilities} loading={false} getRowId={(r) => r.id} />
      </Box>

      {/* Master dialog */}
      <Dialog open={masterDialog} onClose={() => setMasterDialog(false)} fullWidth maxWidth="sm">
        <DialogTitle>{masterEditId ? "Edit Facility Type" : "Add Facility Type"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="Facility Code"
            value={masterForm.facility_code}
            onChange={(e) => setMasterForm((f) => ({ ...f, facility_code: e.target.value }))}
            fullWidth
            disabled={!!masterEditId}
          />
          <TextField
            label="Name (EN)"
            value={masterForm.name_en}
            onChange={(e) => setMasterForm((f) => ({ ...f, name_en: e.target.value }))}
            fullWidth
          />
          <TextField
            select
            label="Active"
            value={masterForm.is_active}
            onChange={(e) => setMasterForm((f) => ({ ...f, is_active: e.target.value }))}
            fullWidth
          >
            <MenuItem value="Y">Yes</MenuItem>
            <MenuItem value="N">No</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setMasterDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveMaster}>
            {masterEditId ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Facility dialog */}
      <Dialog open={facilityDialog} onClose={handleCloseCreate} fullWidth maxWidth="sm">
        <DialogTitle>{facilityEditId ? "Edit Facility" : "Add Facility"}</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            select
            label="Facility Code"
            value={facilityForm.facility_code}
            onChange={(e) => setFacilityForm((f) => ({ ...f, facility_code: e.target.value }))}
            fullWidth
          >
            {masters.map((m) => (
              <MenuItem key={m.facility_code} value={m.facility_code}>
                {m.facility_code} - {m.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Active"
            value={facilityForm.is_active}
            onChange={(e) => setFacilityForm((f) => ({ ...f, is_active: e.target.value }))}
            fullWidth
          >
            <MenuItem value="Y">Yes</MenuItem>
            <MenuItem value="N">No</MenuItem>
          </TextField>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCreate}>Cancel</Button>
          <Button variant="contained" onClick={saveFacility}>
            {facilityEditId ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
