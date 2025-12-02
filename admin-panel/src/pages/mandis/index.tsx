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
  Grid,
  MenuItem,
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
  Pagination,
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
import { fetchMandis, createMandi, updateMandi, deactivateMandi } from "../../services/mandiApi";
import { fetchStatesDistrictsByPincode } from "../../services/mastersApi";

type MandiRow = {
  mandi_id: number;
  name: string;
  state_code: string;
  district_name_en: string;
  pincode: string;
  is_active: boolean;
  address_line?: string;
  contact_number?: string | null;
  remarks?: string | null;
  district_id?: string | null;
};

const defaultForm = {
  mandi_id: "" as string | number,
  name_en: "",
  state_code: "",
  district_name_en: "",
  district_id: "",
  address_line: "",
  pincode: "",
  contact_number: "",
  remarks: "",
  is_active: true,
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

export const Mandis: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const theme = useTheme();
  const fullScreenDialog = useMediaQuery(theme.breakpoints.down("sm"));
  const isSmallScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [rows, setRows] = useState<MandiRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0); // 0-based for grid/mobile controls
  const [pageSize, setPageSize] = useState(20);
  const [rowCount, setRowCount] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [filters, setFilters] = useState({ state_code: "", district: "", status: "ALL" as "ALL" | "ACTIVE" | "INACTIVE" });
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pincodeError, setPincodeError] = useState<string | null>(null);
  const [isPincodeResolving, setIsPincodeResolving] = useState(false);
  const [isPincodeValid, setIsPincodeValid] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const canCreate = useMemo(() => can(uiConfig.resources, "mandis.create", "CREATE"), [uiConfig.resources]);
  const canEdit = useMemo(() => can(uiConfig.resources, "mandis.edit", "UPDATE"), [uiConfig.resources]);
  const canDeactivate = useMemo(() => can(uiConfig.resources, "mandis.deactivate", "DEACTIVATE"), [uiConfig.resources]);
  const isReadOnly = useMemo(() => isEdit && !canEdit, [isEdit, canEdit]);

  const columns = useMemo<GridColDef<MandiRow>[]>(
    () => [
      { field: "mandi_id", headerName: "ID", width: 90 },
      { field: "name", headerName: "Name", flex: 1 },
      { field: "state_code", headerName: "State", width: 100 },
      { field: "district_name_en", headerName: "District", flex: 1 },
      { field: "pincode", headerName: "Pincode", width: 110 },
      { field: "address_line", headerName: "Address", flex: 1.5 },
      {
        field: "is_active",
        headerName: "Active",
        width: 110,
        valueFormatter: (value) => (value ? "Y" : "N"),
      },
      {
        field: "actions",
        headerName: "Actions",
        width: 140,
        sortable: false,
        renderCell: (params) => (
          <Stack direction="row" spacing={1}>
            {canEdit && (
              <Button
                size="small"
                startIcon={<EditIcon />}
                onClick={() => openEdit(params.row)}
              >
                Edit
              </Button>
            )}
            {canDeactivate && (
              <Button
                size="small"
                color="error"
                startIcon={<BlockIcon />}
                onClick={() => handleDeactivate(params.row.mandi_id)}
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
      const orgCode = uiConfig.scope?.org_code || undefined;
      const viewScope = orgCode ? "ALL" : "ALL";
      const resp = await fetchMandis({
        username,
        language,
        filters: {
          org_code: orgCode,
          view_scope: viewScope,
          page: page + 1, // API expects 1-based
          pageSize,
          search: debouncedSearch || undefined,
          state_code: filters.state_code || undefined,
          district_name_en: filters.district || undefined,
          is_active: filters.status === "ALL" ? undefined : filters.status === "ACTIVE",
        },
      });
      const data = resp?.data || resp?.response?.data || {};
      const list = data?.mandis || [];
      const total = Number.isFinite(Number(data?.totalCount)) ? Number(data.totalCount) : list.length;
      setRowCount(total);
      setRows(
        list.map((m: any) => ({
          mandi_id: m.mandi_id,
          name: m?.name_i18n?.en || m.mandi_slug || String(m.mandi_id),
          state_code: m.state_code || "",
          district_name_en: m.district_name_en || "",
          pincode: m.pincode || "",
          is_active: Boolean(m.is_active),
          address_line: m.address_line || "",
          contact_number: m.contact_number || "",
          remarks: m.remarks || "",
          district_id: m.district_id || null,
        })),
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchText), 400);
    return () => clearTimeout(handle);
  }, [searchText]);

  useEffect(() => {
    loadData();
  }, [language, filters.state_code, filters.district, filters.status, page, pageSize, debouncedSearch]);

  const openCreate = () => {
    if (!canCreate) return;
    setIsEdit(false);
    setForm(defaultForm);
    setPincodeError(null);
    setIsPincodeValid(false);
    setIsPincodeResolving(false);
    setSelectedId(null);
    setDialogOpen(true);
  };

  const openEdit = (row: MandiRow) => {
    if (!canEdit) return;
    setIsEdit(true);
    setSelectedId(row.mandi_id);
    setPincodeError(null);
    setIsPincodeResolving(false);
    setIsPincodeValid(Boolean(row.pincode && row.state_code && row.district_name_en));
    setForm({
      mandi_id: row.mandi_id,
      name_en: row.name,
      state_code: row.state_code,
      district_name_en: row.district_name_en,
      district_id: row.district_id || "",
      address_line: row.address_line || "",
      pincode: row.pincode,
      contact_number: row.contact_number || "",
      remarks: row.remarks || "",
      is_active: row.is_active,
    });
    setDialogOpen(true);
  };

  const handlePincodeLookup = async (pincode: string) => {
    const username = currentUsername();
    if (!username) return;
    if (!pincode || pincode.trim().length !== 6) {
      setPincodeError(pincode ? "Enter a 6-digit pincode" : null);
      setForm((f) => ({ ...f, state_code: "", district_name_en: "" }));
      setIsPincodeValid(false);
      return;
    }
    try {
      setIsPincodeResolving(true);
      const resp = await fetchStatesDistrictsByPincode({
        username,
        language,
        pincode: pincode.trim(),
        country: "IN",
      });
      const directData = resp?.response?.data || resp?.data;
      const statesArray = directData?.states || resp?.response?.data?.states || resp?.states || [];

      let stateCode: string | undefined;
      let districtName: string | undefined;
       let districtId: string | null | undefined;

      if (directData?.state_code && (directData?.district_name_en || directData?.district_name)) {
        stateCode = directData.state_code;
        districtName = directData.district_name_en || directData.district_name;
        districtId = directData.district_id || null;
      } else if (Array.isArray(statesArray) && statesArray[0]?.state_code && statesArray[0]?.districts?.[0]?.district_name) {
        stateCode = statesArray[0].state_code;
        districtName = statesArray[0].districts[0].district_name;
        districtId = statesArray[0].districts[0].district_id || null;
      }

      if (stateCode && districtName) {
        setForm((f) => ({
          ...f,
          state_code: stateCode,
          district_name_en: districtName,
          district_id: districtId || "",
        }));
        setPincodeError(null);
        setIsPincodeValid(true);
      } else {
        setForm((f) => ({ ...f, state_code: "", district_name_en: "" }));
        setPincodeError("Pincode not found");
        setIsPincodeValid(false);
      }
    } catch (err) {
      console.error("[mandis] pincode lookup", err);
      setForm((f) => ({ ...f, state_code: "", district_name_en: "" }));
      setPincodeError("Pincode lookup failed");
      setIsPincodeValid(false);
    } finally {
      setIsPincodeResolving(false);
    }
  };

  const handlePincodeChange = (value: string) => {
    const numeric = value.replace(/\D/g, "").slice(0, 6);
    setForm((f) => ({ ...f, pincode: numeric, state_code: numeric.length === 6 ? f.state_code : "", district_name_en: numeric.length === 6 ? f.district_name_en : "" }));
    if (numeric.length < 6) {
      setIsPincodeValid(false);
      setPincodeError(numeric ? "Enter a 6-digit pincode" : null);
      setIsPincodeResolving(false);
      return;
    }
    setIsPincodeResolving(true);
    handlePincodeLookup(numeric);
  };

  const isCreateDisabled = () => {
    const hasRequired =
      form.name_en.trim().length > 0 &&
      form.pincode.trim().length === 6 &&
      isPincodeValid &&
      form.state_code &&
      form.district_name_en &&
      form.address_line.trim().length > 0;
    return (
      !canSubmit ||
      isReadOnly ||
      isPincodeResolving ||
      !hasRequired
    );
  };

  const handleSave = async () => {
    const username = currentUsername();
    if (!username) return;
    const orgCode = uiConfig.scope?.org_code || "";
    const payload: any = {
      name_i18n: { en: form.name_en },
      state_code: form.state_code,
      district_name_en: form.district_name_en,
      district_id: form.district_id || undefined,
      address_line: form.address_line,
      pincode: form.pincode,
      contact_number: form.contact_number || null,
      remarks: form.remarks || null,
      is_active: form.is_active,
      org_code: orgCode || undefined,
    };
    try {
      let resp;
      if (isEdit && selectedId) {
        payload.mandi_id = selectedId;
        resp = await updateMandi({ username, language, payload });
      } else {
        resp = await createMandi({ username, language, payload });
      }
      const responseCode = resp?.response?.responsecode || resp?.responsecode || resp?.responseCode;
      const description = resp?.response?.description || resp?.description || "";
      if (String(responseCode) === "0") {
        setDialogOpen(false);
        await loadData();
      } else {
        alert(description || "Operation failed.");
      }
    } catch (err: any) {
      alert(err?.message || "Operation failed.");
    }
  };

  const handleDeactivate = async (mandi_id: number) => {
    const username = currentUsername();
    if (!username) return;
    await deactivateMandi({ username, language, mandi_id });
    await loadData();
  };

  const canSubmit = isEdit ? canEdit : canCreate;

  return (
    <PageContainer>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems="flex-start"
        spacing={2}
      >
        <Stack spacing={0.5}>
          <Typography variant="h5">{t("menu.mandis", { defaultValue: "Mandis" })}</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage mandis across the network with filters and actions.
          </Typography>
        </Stack>
        {canCreate && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>
            {t("actions.create", { defaultValue: "Create" })}
          </Button>
        )}
      </Stack>

      <Card sx={{ mt: 2, mb: 2 }}>
        <CardContent>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <TextField
                label="Search code/name/pincode"
                size="small"
                value={searchText}
                onChange={(e) => {
                  setPage(0);
                  setSearchText(e.target.value);
                }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="State"
                size="small"
                value={filters.state_code}
                onChange={(e) => {
                  setPage(0);
                  setFilters((f) => ({ ...f, state_code: e.target.value }));
                }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="District"
                size="small"
                value={filters.district}
                onChange={(e) => {
                  setPage(0);
                  setFilters((f) => ({ ...f, district: e.target.value }));
                }}
                fullWidth
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                select
                label="Status"
                size="small"
                value={filters.status}
                onChange={(e) => {
                  setPage(0);
                  setFilters((f) => ({ ...f, status: e.target.value as any }));
                }}
                fullWidth
              >
                <MenuItem value="ALL">All</MenuItem>
                <MenuItem value="ACTIVE">Active</MenuItem>
                <MenuItem value="INACTIVE">Inactive</MenuItem>
              </TextField>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {isSmallScreen ? (
        <Stack spacing={1.5} sx={{ maxWidth: 640, mx: "auto", width: "100%" }}>
          {rows.map((row) => (
            <Card key={row.mandi_id} variant="outlined" sx={{ borderRadius: 2, px: 2, py: 1.5, boxShadow: 1 }}>
              <Stack spacing={1}>
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Typography variant="body1" sx={{ fontWeight: 600, fontSize: "0.95rem" }}>
                    {row.name}
                  </Typography>
                  <Typography variant="caption" sx={{ color: "text.secondary" }}>
                    {row.is_active ? "Active" : "Inactive"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.75rem" }}>
                    Mandi ID
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                    {row.mandi_id}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.75rem" }}>
                    State / District
                  </Typography>
                  <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                    {row.state_code} {row.district_name_en ? `• ${row.district_name_en}` : ""}
                  </Typography>
                </Box>
                <Box>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.75rem" }}>
                Pincode
              </Typography>
              <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                {row.pincode || "-"}
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary", display: "block", fontSize: "0.75rem", mt: 0.5 }}>
                Address
              </Typography>
              <Typography variant="body2" sx={{ fontSize: "0.85rem" }}>
                {row.address_line || "-"}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 1, pt: 0.5 }}>
              {canEdit && (
                <Button size="small" variant="text" onClick={() => openEdit(row)} sx={{ textTransform: "none" }}>
                  Edit
                    </Button>
                  )}
                  {canDeactivate && (
                    <Button
                      size="small"
                      color="error"
                      variant="text"
                      onClick={() => handleDeactivate(row.mandi_id)}
                      sx={{ textTransform: "none" }}
                    >
                      Deactivate
                    </Button>
                  )}
                </Box>
              </Stack>
            </Card>
          ))}
          {!rows.length && (
            <Typography variant="body2" color="text.secondary">
              No mandis found.
            </Typography>
          )}
          {rowCount > pageSize && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
              <Pagination
                count={Math.max(1, Math.ceil(rowCount / pageSize))}
                page={page + 1}
                onChange={(_, newPage) => setPage(newPage - 1)}
                color="primary"
              />
            </Box>
          )}
        </Stack>
      ) : (
        <Card>
          <CardContent>
            <Box sx={{ width: "100%", overflowX: "auto" }}>
              <ResponsiveDataGrid
                columns={columns}
                rows={rows}
                loading={loading}
                getRowId={(r) => r.mandi_id}
                paginationMode="server"
                rowCount={rowCount}
                paginationModel={{ page, pageSize }}
                onPaginationModelChange={(model) => {
                  setPage(model.page);
                  if (model.pageSize !== pageSize) {
                    setPageSize(model.pageSize);
                    setPage(0);
                  }
                }}
                pageSizeOptions={[20, 50, 100]}
              />
            </Box>
          </CardContent>
        </Card>
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        fullWidth
        maxWidth="sm"
        fullScreen={fullScreenDialog}
        scroll="paper"
        PaperProps={{
          sx: {
            height: fullScreenDialog ? "100vh" : "90vh",
            maxHeight: "100vh",
            display: "flex",
            flexDirection: "column",
          },
        }}
      >
        <DialogTitle>{isEdit ? "Edit Mandi" : "Create Mandi"}</DialogTitle>

        <DialogContent
          sx={{
            p: 2,
            pt: 2, // ensure first label is clearly visible under the title
            pb: 0,
            flex: 1,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <Box
            sx={{
              flex: 1,
              overflowY: "auto",
              pr: 1,
              pb: 1,
              pt: 0.5,
            }}
          >
            <Grid container spacing={1.5}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Mandi Name"
                  value={form.name_en}
                  onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
                  fullWidth
                  disabled={isReadOnly}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Pincode"
                  value={form.pincode}
                  onChange={(e) => handlePincodeChange(e.target.value)}
                  fullWidth
                  disabled={isReadOnly}
                  helperText={pincodeError || (isPincodeResolving ? "Resolving location..." : undefined)}
                  error={Boolean(pincodeError)}
                  inputProps={{ inputMode: "numeric", pattern: "[0-9]*", maxLength: 6 }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="State Code"
                  value={form.state_code}
                  fullWidth
                  disabled
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="District"
                  value={form.district_name_en}
                  fullWidth
                  disabled
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  label="Address"
                  value={form.address_line}
                  onChange={(e) => setForm((f) => ({ ...f, address_line: e.target.value }))}
                  fullWidth
                  multiline
                  minRows={3}
                  disabled={isReadOnly || isPincodeResolving || !isPincodeValid}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Contact Number"
                  value={form.contact_number}
                  onChange={(e) => setForm((f) => ({ ...f, contact_number: e.target.value }))}
                  fullWidth
                  disabled={isReadOnly}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Remarks"
                  value={form.remarks}
                  onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
                  fullWidth
                  disabled={isReadOnly}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  select
                  label="Active"
                  value={form.is_active ? "Y" : "N"}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.value === "Y" }))}
                  fullWidth
                  disabled={isReadOnly || isPincodeResolving || !isPincodeValid}
                >
                  <MenuItem value="Y">Yes</MenuItem>
                  <MenuItem value="N">No</MenuItem>
                </TextField>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>

        <DialogActions
          sx={{
            px: 2,
            py: 1,
          }}
        >
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          {canSubmit && (
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={isCreateDisabled()}
            >
              {isEdit ? "Update" : "Create"}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
