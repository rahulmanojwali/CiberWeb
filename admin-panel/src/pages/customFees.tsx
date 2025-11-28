import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { GridColDef } from "@mui/x-data-grid";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../components/PageContainer";
import { ResponsiveDataGrid } from "../components/ResponsiveDataGrid";
import {
  getCustomFeeTemplates,
  upsertCustomFeeTemplate,
} from "../services/paymentConfigApi";
import { getCurrentAdminUsername } from "../utils/session";
import { useAdminUiConfig } from "../contexts/admin-ui-config";
import { can } from "../utils/adminUiConfig";

const defaultPayload = JSON.stringify(
  {
    custom_fee_code: "CUSTOM_TEMPLATE",
    label_i18n: {
      en: "Custom Fee",
    },
    visibility: ["ORG"],
    mode_allowed: ["PERCENT", "FIXED"],
    is_active: "Y",
  },
  null,
  2,
);

export const CustomFees: React.FC = () => {
  const { i18n } = useTranslation();
  const language = i18n.language || "en";
  const uiConfig = useAdminUiConfig();
  const [rows, setRows] = useState<any[]>([]);
  const [payloadJson, setPayloadJson] = useState(defaultPayload);
  const [loading, setLoading] = useState(false);
  const canUpdate = useMemo(
    () => can(uiConfig.resources, "custom_fee_templates.update", "UPDATE"),
    [uiConfig.resources],
  );

  const loadData = async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    setLoading(true);
    try {
      const resp = await getCustomFeeTemplates({
        username,
        language,
      });
      setRows(resp?.data?.list || []);
    } catch (error) {
      console.error("Failed to load custom fee templates:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [language]);

  const handleSave = async () => {
    const username = getCurrentAdminUsername();
    if (!username) return;
    try {
      const payload = JSON.parse(payloadJson);
      await upsertCustomFeeTemplate({ username, language, payload });
      loadData();
    } catch (error) {
      console.error("Failed to upsert custom fee template:", error);
      alert("Invalid payload.");
    }
  };

  const columns = useMemo<GridColDef<any>[]>(
    () => [
      { field: "custom_fee_code", headerName: "Code", width: 180 },
      { field: "label", headerName: "Label", flex: 1 },
      { field: "visibility", headerName: "Visibility", width: 200 },
      { field: "mode_allowed", headerName: "Modes", width: 180 },
      { field: "is_active", headerName: "Active", width: 120 },
    ],
    [],
  );

  const gridRows = rows.map((doc) => ({
    id: doc._id || doc.custom_fee_code,
    custom_fee_code: doc.custom_fee_code,
    label: doc.label_i18n?.en || doc.label_i18n?.default || doc.custom_fee_code,
    visibility: JSON.stringify(doc.visibility || []),
    mode_allowed: JSON.stringify(doc.mode_allowed || []),
    is_active: doc.is_active,
  }));

  return (
    <PageContainer>
      <Stack spacing={2}>
        <Typography variant="h5">Custom Fee Templates</Typography>
        <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
          <Stack spacing={1} flex={1}>
            <Typography variant="subtitle1">Editable payload</Typography>
            <TextField
              multiline
              minRows={10}
              value={payloadJson}
              onChange={(event) => setPayloadJson(event.target.value)}
              fullWidth
            />
            <Button variant="contained" disabled={!canUpdate} onClick={handleSave}>
              Save
            </Button>
          </Stack>
          <Stack spacing={1} flex={1}>
            <Typography variant="subtitle1">Existing templates</Typography>
            <Button variant="outlined" onClick={loadData}>
              Refresh
            </Button>
          </Stack>
        </Stack>
        <Box>
          <ResponsiveDataGrid
            columns={columns}
            rows={gridRows}
            loading={loading}
          />
        </Box>
      </Stack>
    </PageContainer>
  );
};
