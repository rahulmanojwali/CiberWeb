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
  Typography,
} from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../components/PageContainer";
import { ResponsiveDataGrid } from "../components/ResponsiveDataGrid";
import {
  getSubscriptions,
  upsertSubscription,
} from "../services/subscriptionsApi";
import { getCurrentAdminUsername } from "../utils/session";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { can } from "../utils/adminUiConfig";

const SUBJECT_TYPES = ["ORG", "MANDI", "TRADER", "FPO"];
const STATUS_OPTIONS = ["ACTIVE", "SUSPENDED", "CANCELLED"];

const defaultForm = {
  subject_type: "ORG",
  org_id: "",
  mandi_id: "",
  party_code: "",
  payer_username: "",
  billing_cycle: "MONTHLY",
  amount_base: "",
  max_discount_percent: "",
  status: "ACTIVE",
  next_due_on: "",
};

export const SubscriptionsPage: React.FC = () => {
  const { i18n } = useTranslation();
  const language = i18n.language || "en";
  const uiConfig = useAdminUiConfig();
  const canCreate = useMemo(() => can(uiConfig.resources, "subscriptions.create", "CREATE"), [uiConfig.resources]);
  const canEdit = useMemo(() => can(uiConfig.resources, "subscriptions.update", "UPDATE"), [uiConfig.resources]);
  const [filters, setFilters] = useState({
    subject_type: "",
    org_id: "",
    mandi_id: "",
    status: "",
    payer_username: "",
  });
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, pageSize: 25, total: 0 });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...defaultForm });

  const loadData = async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp = await getSubscriptions({
        username,
        language,
        filters: {
          ...filters,
          page: pagination.page,
          pageSize: pagination.pageSize,
        },
      });
      const list = resp?.data?.items || [];
      const sanitized = list.map((row: any) => ({
        id: row._id,
        subject_type: row.subject_type,
        org_code: row.org_code || row.org_id || "",
        mandi_name: row.mandi_name || row.mandi_id || "",
        party_code: row.party_code,
        payer_username: row.payer_username,
        billing_cycle: row.billing_cycle,
        amount_base: row.amount_base,
        status: row.status,
        next_due_on: row.next_due_on ? new Date(row.next_due_on).toLocaleDateString() : "",
      }));
      setRows(sanitized);
      const paginationData = resp?.data?.pagination || {};
      setPagination((prev) => ({
        page: paginationData.page || prev.page,
        pageSize: paginationData.pageSize || prev.pageSize,
        total: paginationData.total || prev.total,
      }));
    } catch (error) {
      console.error("Failed to load subscriptions:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [language, filters, pagination.page]);

  const handleSave = async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    try {
      await upsertSubscription({
        username,
        language,
        payload: {
          subject_type: form.subject_type,
          org_id: form.org_id,
          mandi_id: form.mandi_id || undefined,
          party_code: form.party_code || undefined,
          payer_username: form.payer_username || undefined,
          billing_cycle: form.billing_cycle,
          amount_base: Number(form.amount_base),
          max_discount_percent: form.max_discount_percent ? Number(form.max_discount_percent) : undefined,
          status: form.status,
          next_due_on: form.next_due_on || undefined,
        },
      });
      setDialogOpen(false);
      setForm({ ...defaultForm });
      loadData();
    } catch (error) {
      console.error("Failed to save subscription:", error);
      alert("Unable to save subscription.");
    }
  };

  const columns = useMemo<GridColDef<any>[]>(
    () => [
      { field: "subject_type", headerName: "Subject Type", width: 140 },
      { field: "org_code", headerName: "Org", width: 150 },
      { field: "mandi_name", headerName: "Mandi", width: 150 },
      { field: "party_code", headerName: "Party Code", width: 150 },
      { field: "payer_username", headerName: "Payer", width: 150 },
      { field: "billing_cycle", headerName: "Cycle", width: 130 },
      { field: "amount_base", headerName: "Amount", width: 130 },
      { field: "status", headerName: "Status", width: 120 },
      { field: "next_due_on", headerName: "Next Due", width: 140 },
    ],
    [],
  );

  const openDialog = (row?: any) => {
    if (row) {
      setForm({
        subject_type: row.subject_type,
        org_id: row.org_code || "",
        mandi_id: row.mandi_name || "",
        party_code: row.party_code || "",
        payer_username: row.payer_username || "",
        billing_cycle: row.billing_cycle || "MONTHLY",
        amount_base: row.amount_base || "",
        max_discount_percent: "",
        status: row.status || "ACTIVE",
        next_due_on: row.next_due_on ? row.next_due_on.split("/").reverse().join("-") : "",
      });
    } else {
      setForm({ ...defaultForm });
    }
    setDialogOpen(true);
  };

  return (
    <PageContainer>
      <Stack spacing={2}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Typography variant="h5">Subscriptions</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            <TextField
              label="Subject Type"
              select
              size="small"
              value={filters.subject_type}
              onChange={(event) => setFilters((prev) => ({ ...prev, subject_type: event.target.value }))}
            >
              <MenuItem value="">Any</MenuItem>
              {SUBJECT_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Org ID"
              size="small"
              value={filters.org_id}
              onChange={(event) => setFilters((prev) => ({ ...prev, org_id: event.target.value }))}
            />
            <TextField
              label="Mandi ID"
              size="small"
              value={filters.mandi_id}
              onChange={(event) => setFilters((prev) => ({ ...prev, mandi_id: event.target.value }))}
            />
            <TextField
              label="Status"
              select
              size="small"
              value={filters.status}
              onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
            >
              <MenuItem value="">Any</MenuItem>
              {STATUS_OPTIONS.map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Payer Username"
              size="small"
              value={filters.payer_username}
              onChange={(event) => setFilters((prev) => ({ ...prev, payer_username: event.target.value }))}
            />
            <Button variant="outlined" onClick={() => setPagination((prev) => ({ ...prev, page: 1 }))}>
              Apply
            </Button>
          </Stack>
          {canCreate && (
            <Button variant="contained" onClick={() => openDialog()} sx={{ alignSelf: "flex-start" }}>
              New Subscription
            </Button>
          )}
        </Stack>
        <Box>
          <ResponsiveDataGrid
            columns={columns}
            rows={rows}
            loading={loading}
            onRowClick={(params) => canEdit && openDialog(params.row)}
          />
        </Box>
      </Stack>
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{canEdit ? "Create / Update Subscription" : "Create Subscription"}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} mt={1}>
            <TextField
              label="Subject Type"
              select
              fullWidth
              value={form.subject_type}
              onChange={(event) => setForm((prev) => ({ ...prev, subject_type: event.target.value }))}
            >
              {SUBJECT_TYPES.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Org ID"
              fullWidth
              value={form.org_id}
              onChange={(event) => setForm((prev) => ({ ...prev, org_id: event.target.value }))}
            />
            <TextField
              label="Mandi ID"
              fullWidth
              value={form.mandi_id}
              onChange={(event) => setForm((prev) => ({ ...prev, mandi_id: event.target.value }))}
            />
            <TextField
              label="Party Code"
              fullWidth
              value={form.party_code}
              onChange={(event) => setForm((prev) => ({ ...prev, party_code: event.target.value }))}
            />
            <TextField
              label="Payer Username"
              fullWidth
              value={form.payer_username}
              onChange={(event) => setForm((prev) => ({ ...prev, payer_username: event.target.value }))}
            />
            <TextField
              label="Billing Cycle"
              fullWidth
              select
              value={form.billing_cycle}
              onChange={(event) => setForm((prev) => ({ ...prev, billing_cycle: event.target.value }))}
            >
              {["MONTHLY", "QUARTERLY", "YEARLY"].map((cycle) => (
                <MenuItem key={cycle} value={cycle}>
                  {cycle}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Amount Base"
              type="number"
              fullWidth
              value={form.amount_base}
              onChange={(event) => setForm((prev) => ({ ...prev, amount_base: event.target.value }))}
            />
            <TextField
              label="Max Discount %"
              type="number"
              fullWidth
              value={form.max_discount_percent}
              onChange={(event) => setForm((prev) => ({ ...prev, max_discount_percent: event.target.value }))}
            />
            <TextField
              label="Status"
              select
              fullWidth
              value={form.status}
              onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value }))}
            >
              {STATUS_OPTIONS.map((value) => (
                <MenuItem key={value} value={value}>
                  {value}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Next Due On"
              type="date"
              fullWidth
              value={form.next_due_on}
              onChange={(event) => setForm((prev) => ({ ...prev, next_due_on: event.target.value }))}
              InputLabelProps={{ shrink: true }}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={!canCreate && !canEdit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
};
