import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Stack, Typography } from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import { fetchMandiFacilities } from "../../services/mandiApi";

type FacilityRow = {
  id: string;
  mandi_id: number;
  facility_code: string;
  is_active: string;
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
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const [rows, setRows] = useState<FacilityRow[]>([]);
  const [loading, setLoading] = useState(false);

  const canCreate = useMemo(
    () => can(uiConfig.resources, "mandi_facilities.create", "CREATE"),
    [uiConfig.resources],
  );

  const columns = useMemo<GridColDef<FacilityRow>[]>(
    () => [
      { field: "mandi_id", headerName: "Mandi ID", width: 110 },
      { field: "facility_code", headerName: "Facility", flex: 1 },
      {
        field: "is_active",
        headerName: "Active",
        width: 110,
        valueFormatter: (params) => params.value || "",
      },
    ],
    [],
  );

  useEffect(() => {
    const username = currentUsername();
    if (!username) return;
    (async () => {
      setLoading(true);
      try {
        const res = await fetchMandiFacilities({ username, language });
        const list = res?.data?.items || [];
        setRows(
          list.map((f: any) => ({
            id: f._id || `${f.mandi_id}-${f.facility_code}`,
            mandi_id: f.mandi_id,
            facility_code: f.facility_code,
            is_active: f.is_active,
          })),
        );
      } catch (e) {
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [language]);

  return (
    <PageContainer>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">
          {t("menu.mandiFacilitiesMasters", { defaultValue: "Mandi Facilities" })}
        </Typography>
        <Button variant="contained" size="small" startIcon={<AddIcon />} disabled={!canCreate}>
          {t("actions.create", { defaultValue: "Create" })}
        </Button>
      </Stack>
      <Box sx={{ height: 520 }}>
        <ResponsiveDataGrid
          columns={columns}
          rows={rows}
          loading={loading}
          getRowId={(r) => r.id}
        />
      </Box>
    </PageContainer>
  );
};
