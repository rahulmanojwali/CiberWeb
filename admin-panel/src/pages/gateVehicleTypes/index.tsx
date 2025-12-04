import React, { useEffect, useMemo, useState } from "react";
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
  Typography,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/EditOutlined";
import BlockIcon from "@mui/icons-material/BlockOutlined";
import DirectionsCarFilledIcon from "@mui/icons-material/DirectionsCarFilled";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { useCrudPermissions } from "../../utils/useCrudPermissions";
import {
  fetchGateVehicleTypes,
  createGateVehicleType,
  updateGateVehicleType,
  deactivateGateVehicleType,
} from "../../services/gateApi";
import { useTheme } from "@mui/material/styles";
import useMediaQuery from "@mui/material/useMediaQuery";

function currentUsername(): string | null {
  try {
    const raw = localStorage.getItem("cd_user");
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.username || null;
  } catch {
    return null;
  }
}

type VehicleRow = {
  vehicle_type_code: string;
  name_i18n: Record<string, string>;
  is_active: "Y" | "N";
  is_allowed: "Y" | "N";
  requires_permit: "Y" | "N";
  axle_count: number | null;
  max_gvw_tonnes: number | null;
};

const defaultForm = {
  vehicle_type_code: "",
  name_en: "",
  name_hi: "",
  is_active: "Y" as "Y" | "N",
  is_allowed: "Y" as "Y" | "N",
  requires_permit: "N" as "Y" | "N",
  axle_count: "" as number | "" | null,
  max_gvw_tonnes: "" as number | "" | null,
  max_dims_m: { length: "", width: "", height: "" } as Record<string, number | "" | null>,
};

export const GateVehicleTypes: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));

  const [rows, setRows] = useState<VehicleRow[]>([]);
  const [status, setStatus] = useState("ALL" as "ALL" | "Y" | "N");
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [editCode, setEditCode] = useState<string | null>(null);

  const { canCreate, canEdit, canDeactivate } = useCrudPermissions("gate_vehicle_types_masters");

  const columns = useMemo<GridColDef<VehicleRow>[]>(
    () => [
      { field: "vehicle_type_code", headerName: "Code", width: 150 },
      {
        field: "name_i18n",
        headerName: "Name",
        flex: 1,
        valueGetter: (params: any) => params.row?.name_i18n?.en || params.row.vehicle_type_code,
      },
      {
        field: "is_allowed",
        headerName: "Allowed",
        width: 120,
        valueGetter: (params: any) => (params.row?.is_allowed === "Y" ? "Yes" : "No"),
      },
      {
        field: "requires_permit",
        headerName: "Permit",
        width: 120,
        valueGetter: (params: any) => (params.row?.requires_permit === "Y" ? "Required" : "No"),
      },
      {
        field: "is_active",
        headerName: "Active",
        width: 110,
        valueGetter: (params: any) => (params.row?.is_active === "Y" ? "Yes" : "No"),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 180,
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
                onClick={() => handleDeactivate(params.row.vehicle_type_code)}
              >
                Deactivate
              </Button>
            )}
          </Stack>
        ),
      },
    ],
    [canEdit, canDeactivate],
  );

  const loadData = async () => {
    const username = currentUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp = await fetchGateVehicleTypes({
        username,
        language,
        filters: { is_active: status === "ALL" ? undefined : status },
      });
      const list = resp?.data?.vehicle_types || resp?.response?.data?.vehicle_types || [];
      setRows(
        list
          .map((v: any) => {
            const code = v?.vehicle_type_code || v?.code;
            if (!code) return null;
            return {
              vehicle_type_code: code,
              name_i18n: v?.name_i18n || { en: v?.name_en || code },
              is_active: v?.is_active || "Y",
              is_allowed: v?.is_allowed || "Y",
              requires_permit: v?.requires_permit || "N",
              axle_count: v?.axle_count ?? null,
              max_gvw_tonnes: v?.max_gvw_tonnes ?? null,
            } as VehicleRow;
          })
          .filter(Boolean) as VehicleRow[],
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [status, language]);

  const openCreate = () => {
    setIsEdit(false);
    setEditCode(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const openEdit = (row: VehicleRow) => {
    setIsEdit(true);
    setEditCode(row.vehicle_type_code);
    setForm({
      vehicle_type_code: row.vehicle_type_code,
      name_en: row.name_i18n?.en || "",
      name_hi: row.name_i18n?.hi || "",
      is_active: row.is_active,
      is_allowed: row.is_allowed || "Y",
      requires_permit: row.requires_permit || "N",
      axle_count: row.axle_count ?? "",
      max_gvw_tonnes: row.max_gvw_tonnes ?? "",
      max_dims_m: { length: "", width: "", height: "" },
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username) return;
    const payload: any = {
      vehicle_type_code: form.vehicle_type_code,
      name_en: form.name_en,
      is_active: form.is_active,
      is_allowed: form.is_allowed,
      requires_permit: form.requires_permit,
    };
    if (form.name_hi) payload.name_hi = form.name_hi;
    if (form.axle_count !== "" && form.axle_count !== null) payload.axle_count = Number(form.axle_count);
    if (form.max_gvw_tonnes !== "" && form.max_gvw_tonnes !== null) payload.max_gvw_tonnes = Number(form.max_gvw_tonnes);
    const dims = form.max_dims_m || {};
    if (dims.length || dims.width || dims.height) {
      payload.max_dims_m = {
        length: dims.length === "" ? null : Number(dims.length),
        width: dims.width === "" ? null : Number(dims.width),
        height: dims.height === "" ? null : Number(dims.height),
      };
    }
    if (isEdit && editCode) {
      await updateGateVehicleType({ username, language, payload });
    } else {
      await createGateVehicleType({ username, language, payload });
    }
    setDialogOpen(false);
    await loadData();
  };

  const handleDeactivate = async (vehicle_type_code: string) => {
    const username = currentUsername();
    if (!username) return;
    await deactivateGateVehicleType({ username, language, vehicle_type_code });
    await loadData();
  };

  return (
    <PageContainer>
      <Stack direction={{ xs: "column", md: "row" }} justifyContent="space-between" spacing={2} mb={2}>
        <Typography variant="h5" sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <DirectionsCarFilledIcon fontSize="small" />
          {t("menu.gateVehicleTypes", { defaultValue: "Gate Vehicle Types" })}
        </Typography>
        <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }} width={{ xs: "100%", sm: "auto" }}>
          <TextField
            select
            label="Status"
            size="small"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
            fullWidth
            sx={{ minWidth: { sm: 140 } }}
          >
            <MenuItem value="ALL">All</MenuItem>
            <MenuItem value="Y">Active</MenuItem>
            <MenuItem value="N">Inactive</MenuItem>
          </TextField>
          {canCreate && (
            <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={openCreate} fullWidth>
              {t("actions.create", { defaultValue: "Create" })}
            </Button>
          )}
        </Stack>
      </Stack>

      <Card>
        <CardContent>
          <Box sx={{ width: "100%" }}>
            <ResponsiveDataGrid
              columns={columns}
              rows={rows}
              loading={loading}
              getRowId={(r) => r.vehicle_type_code}
              autoHeight
            />
          </Box>
        </CardContent>
      </Card>

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="md"
        fullScreen={fullScreen}
        PaperProps={{
          sx: {
            display: "flex",
            flexDirection: "column",
            maxHeight: fullScreen ? "100vh" : "90vh",
          },
        }}
      >
        <DialogTitle>{isEdit ? "Edit Vehicle Type" : "Create Vehicle Type"}</DialogTitle>
        <DialogContent
          sx={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            gap: 2,
          }}
        >
          <TextField
            label="Type Code"
            value={form.vehicle_type_code}
            onChange={(e) => setForm((f) => ({ ...f, vehicle_type_code: e.target.value }))}
            fullWidth
            disabled={isEdit}
          />
          <TextField
            label="Name (EN)"
            value={form.name_en}
            onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
            fullWidth
          />
          <TextField
            label="Name (HI)"
            value={form.name_hi}
            onChange={(e) => setForm((f) => ({ ...f, name_hi: e.target.value }))}
            fullWidth
          />
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Axle Count"
              type="number"
              value={form.axle_count}
              onChange={(e) => setForm((f) => ({ ...f, axle_count: e.target.value === "" ? "" : Number(e.target.value) }))}
              fullWidth
            />
            <TextField
              label="Max GVW (tonnes)"
              type="number"
              value={form.max_gvw_tonnes}
              onChange={(e) =>
                setForm((f) => ({ ...f, max_gvw_tonnes: e.target.value === "" ? "" : Number(e.target.value) }))
              }
              fullWidth
            />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              label="Length (m)"
              type="number"
              value={form.max_dims_m.length}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  max_dims_m: { ...f.max_dims_m, length: e.target.value === "" ? "" : Number(e.target.value) },
                }))
              }
              fullWidth
            />
            <TextField
              label="Width (m)"
              type="number"
              value={form.max_dims_m.width}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  max_dims_m: { ...f.max_dims_m, width: e.target.value === "" ? "" : Number(e.target.value) },
                }))
              }
              fullWidth
            />
            <TextField
              label="Height (m)"
              type="number"
              value={form.max_dims_m.height}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  max_dims_m: { ...f.max_dims_m, height: e.target.value === "" ? "" : Number(e.target.value) },
                }))
              }
              fullWidth
            />
          </Stack>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
            <TextField
              select
              label="Allowed"
              value={form.is_allowed}
              onChange={(e) => setForm((f) => ({ ...f, is_allowed: e.target.value as "Y" | "N" }))}
              fullWidth
            >
              <MenuItem value="Y">Yes</MenuItem>
              <MenuItem value="N">No</MenuItem>
            </TextField>
            <TextField
              select
              label="Permit Required"
              value={form.requires_permit}
              onChange={(e) => setForm((f) => ({ ...f, requires_permit: e.target.value as "Y" | "N" }))}
              fullWidth
            >
              <MenuItem value="Y">Yes</MenuItem>
              <MenuItem value="N">No</MenuItem>
            </TextField>
            <TextField
              select
              label="Active"
              value={form.is_active}
              onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value as "Y" | "N" }))}
              fullWidth
            >
              <MenuItem value="Y">Yes</MenuItem>
              <MenuItem value="N">No</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!form.vehicle_type_code || !form.name_en}>
            {isEdit ? "Update" : "Create"}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
