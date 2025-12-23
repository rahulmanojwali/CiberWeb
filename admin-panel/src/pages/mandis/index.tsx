import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  FormControlLabel,
  Pagination,
  Stack,
  Tab,
  Tabs,
  TextField,
  Checkbox,
  Typography,
  MenuItem,
} from "@mui/material";
import { type GridColDef } from "@mui/x-data-grid";
import RefreshIcon from "@mui/icons-material/Refresh";
import { PageContainer } from "../../components/PageContainer";
import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
import { usePermissions } from "../../authz/usePermissions";
import {
  fetchOrgMandisLite,
  fetchSystemMandisByState,
  importSystemMandisToOrg,
} from "../../services/mandiApi";
import { useSnackbar } from "notistack";
import { DEFAULT_LANGUAGE } from "../../config/appConfig";

type MandiLite = {
  mandi_id: number;
  mandi_slug?: string;
  name_i18n?: { en?: string };
  state_code?: string;
  district_name?: string;
  district_name_en?: string;
  pincode?: string;
};

const PAGE_SIZES = [10, 20, 50];
const STATE_OPTIONS = [
  "AP",
  "AR",
  "AS",
  "BR",
  "CH",
  "CT",
  "DL",
  "GA",
  "GJ",
  "HR",
  "HP",
  "JH",
  "JK",
  "KA",
  "KL",
  "LA",
  "LD",
  "MH",
  "ML",
  "MN",
  "MP",
  "MZ",
  "NL",
  "OR",
  "PB",
  "PY",
  "RJ",
  "SK",
  "TN",
  "TS",
  "TR",
  "UP",
  "UT",
  "WB",
];

export const Mandis: React.FC = () => {
  const { authContext } = usePermissions();
  const { enqueueSnackbar } = useSnackbar();
  const username =
    (() => {
      try {
        const raw = localStorage.getItem("cd_user");
        const parsed = raw ? JSON.parse(raw) : null;
        return parsed?.username || null;
      } catch {
        return null;
      }
    })() || "";

  const orgId = authContext.org_id || "";

  const [activeTab, setActiveTab] = useState<"MY" | "IMPORT">("MY");

  // My Mandis state
  const [myState, setMyState] = useState<string>("");
  const [mySearch, setMySearch] = useState("");
  const [myDebounced, setMyDebounced] = useState("");
  const [myPage, setMyPage] = useState(1);
  const [myPageSize, setMyPageSize] = useState(10);
  const [myRows, setMyRows] = useState<MandiLite[]>([]);
  const [myTotal, setMyTotal] = useState(0);
  const [myLoading, setMyLoading] = useState(false);

  // Import tab state
  const [impState, setImpState] = useState<string>("");
  const [impSearch, setImpSearch] = useState("");
  const [impDebounced, setImpDebounced] = useState("");
  const [impPage, setImpPage] = useState(1);
  const [impPageSize, setImpPageSize] = useState(10);
  const [impRows, setImpRows] = useState<MandiLite[]>([]);
  const [impTotal, setImpTotal] = useState(0);
  const [impLoading, setImpLoading] = useState(false);
  const [selection, setSelection] = useState<number[]>([]);

  // Abort / dedupe
  const myReqRef = useRef<AbortController | null>(null);
  const impReqRef = useRef<AbortController | null>(null);

  // Debounce search
  useEffect(() => {
    const h = setTimeout(() => setMyDebounced(mySearch), 500);
    return () => clearTimeout(h);
  }, [mySearch]);

  useEffect(() => {
    const h = setTimeout(() => setImpDebounced(impSearch), 500);
    return () => clearTimeout(h);
  }, [impSearch]);

  const myColumns: GridColDef<MandiLite>[] = useMemo(
    () => [
      {
        field: "name",
        headerName: "Name",
        flex: 1,
        valueGetter: (p: any) => p?.row?.name_i18n?.en || p?.row?.mandi_slug || p?.row?.mandi_id,
      },
      { field: "state_code", headerName: "State", width: 110 },
      {
        field: "district_name",
        headerName: "District",
        flex: 1,
        valueGetter: (p: any) => p?.row?.district_name || p?.row?.district_name_en || "",
      },
      { field: "pincode", headerName: "Pincode", width: 120 },
      { field: "mandi_id", headerName: "ID", width: 110 },
    ],
    [],
  );

  const impColumns: GridColDef<MandiLite & { checked?: boolean }>[] = useMemo(() => {
    return [
      {
        field: "checked",
        headerName: "",
        width: 60,
        renderCell: (params) => {
          const mid = (params.row as MandiLite).mandi_id;
          const checked = selection.includes(mid);
          return (
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={checked}
                  onChange={(e) => {
                    if (e.target.checked && selection.length >= 25) {
                      enqueueSnackbar("You can import 25 mandis at a time.", { variant: "warning" });
                      return;
                    }
                    setSelection((prev) =>
                      e.target.checked ? [...prev, mid] : prev.filter((id) => id !== mid),
                    );
                  }}
                />
              }
              label=""
            />
          );
        },
      },
      {
        field: "name",
        headerName: "Name",
        flex: 1,
        valueGetter: (p: any) => p?.row?.name_i18n?.en || p?.row?.mandi_slug || p?.row?.mandi_id,
      },
      {
        field: "district_name",
        headerName: "District",
        flex: 1,
        valueGetter: (p: any) => p?.row?.district_name || p?.row?.district_name_en || "",
      },
      { field: "pincode", headerName: "Pincode", width: 120 },
      { field: "mandi_id", headerName: "ID", width: 110 },
    ];
  }, [selection, enqueueSnackbar]);

  // Fetch helpers with abort/dedupe
  const fetchMyMandis = React.useCallback(async () => {
    if (!orgId) return;
    if (myReqRef.current) myReqRef.current.abort();
    const controller = new AbortController();
    myReqRef.current = controller;
    setMyLoading(true);
    const payload = {
      api: "getOrgMandis",
      org_id: orgId,
      state_code: myState || undefined,
      q: myDebounced || undefined,
      page: myPage,
      pageSize: myPageSize,
    };
    console.log("[MyMandis] fetch", { page: myPage, pageSize: myPageSize, state: myState, q: myDebounced });
    try {
      const resp = await fetchOrgMandisLite({
        username,
        language: DEFAULT_LANGUAGE,
        org_id: orgId,
        filters: {
          state_code: payload.state_code,
          q: payload.q,
          page: payload.page,
          pageSize: payload.pageSize,
        },
      });
      if (controller.signal.aborted) return;
      const data = resp?.data || resp?.response?.data || {};
      setMyRows(data.items || []);
      setMyTotal(Number(data.meta?.totalCount) || 0);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      enqueueSnackbar(err?.message || "Failed to load mandis", { variant: "error" });
      setMyRows([]);
      setMyTotal(0);
    } finally {
      if (!controller.signal.aborted) setMyLoading(false);
    }
  }, [orgId, myState, myDebounced, myPage, myPageSize, username, enqueueSnackbar]);

  const fetchSystemMandis = React.useCallback(async () => {
    if (!impState) return;
    if (impReqRef.current) impReqRef.current.abort();
    const controller = new AbortController();
    impReqRef.current = controller;
    setImpLoading(true);
    console.log("[ImportMandis] fetch", { state: impState, page: impPage, pageSize: impPageSize, q: impDebounced });
    try {
      const resp = await fetchSystemMandisByState({
        username,
        language: DEFAULT_LANGUAGE,
        state_code: impState,
        filters: {
          q: impDebounced || undefined,
          page: impPage,
          pageSize: impPageSize,
        },
      });
      if (controller.signal.aborted) return;
      const data = resp?.data || resp?.response?.data || {};
      setImpRows(data.items || []);
      setImpTotal(Number(data.meta?.totalCount) || 0);
    } catch (err: any) {
      if (controller.signal.aborted) return;
      enqueueSnackbar(err?.message || "Failed to load system mandis", { variant: "error" });
      setImpRows([]);
      setImpTotal(0);
    } finally {
      if (!controller.signal.aborted) setImpLoading(false);
    }
  }, [impState, impPage, impPageSize, impDebounced, username, enqueueSnackbar]);

  // Effects
  // Debounce triggers
  useEffect(() => {
    if (activeTab === "MY") fetchMyMandis();
  }, [myDebounced, myState, myPage, myPageSize, fetchMyMandis, activeTab]);

  useEffect(() => {
    if (activeTab === "IMPORT" && impState) fetchSystemMandis();
  }, [impDebounced, impState, impPage, impPageSize, fetchSystemMandis, activeTab]);

  const resetMy = () => {
    setMyPage(1);
    fetchMyMandis();
  };

  const resetImport = () => {
    setSelection([]);
    setImpPage(1);
  };

  const handleImport = async () => {
    if (!orgId) {
      enqueueSnackbar("Organisation not found", { variant: "error" });
      return;
    }
    if (selection.length === 0) return;
    console.log("[ImportMandis] import", { count: selection.length });
    try {
      const resp = await importSystemMandisToOrg({
        username,
        language: DEFAULT_LANGUAGE,
        org_id: orgId,
        mandi_ids: selection.slice(0, 25),
      });
      const data = resp?.data || resp?.response?.data || {};
      enqueueSnackbar(
        `Imported ${data.imported || 0}, skipped ${data.skipped_existing || 0}`,
        { variant: "success" },
      );
      setActiveTab("MY");
      setSelection([]);
      setMyPage(1);
      fetchMyMandis();
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Import failed", { variant: "error" });
    }
  };

  const renderMyMandis = () => (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
        <TextField
          select
          label="State"
          size="small"
          value={myState}
          onChange={(e) => {
            setMyState(e.target.value);
            setMyPage(1);
          }}
          sx={{ minWidth: 160 }}
        >
          <MenuItem value="">All States</MenuItem>
          {STATE_OPTIONS.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Search"
          size="small"
          value={mySearch}
          onChange={(e) => {
            setMySearch(e.target.value);
            setMyPage(1);
          }}
          sx={{ minWidth: 200 }}
        />
        <TextField
          select
          label="Page Size"
          size="small"
          value={myPageSize}
          onChange={(e) => {
            setMyPageSize(Number(e.target.value));
            setMyPage(1);
          }}
          sx={{ width: 140 }}
        >
          {PAGE_SIZES.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={resetMy}>
          Refresh
        </Button>
      </Stack>
      <Card>
        <CardContent>
          <ResponsiveDataGrid
            autoHeight
            rows={myRows.map((r) => ({ id: r.mandi_id, ...r }))}
            columns={myColumns}
            loading={myLoading}
            paginationMode="server"
            rowCount={myTotal}
            pageSizeOptions={PAGE_SIZES}
            paginationModel={{ page: myPage - 1, pageSize: myPageSize }}
            onPaginationModelChange={(m) => {
              setMyPage(m.page + 1);
              setMyPageSize(m.pageSize);
            }}
          />
        </CardContent>
      </Card>
    </Stack>
  );

  const renderImportMandis = () => (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }}>
        <TextField
          select
          required
          label="State"
          size="small"
          value={impState}
          onChange={(e) => {
            setImpState(e.target.value);
            setImpPage(1);
            setSelection([]);
          }}
          sx={{ minWidth: 180 }}
          helperText={!impState ? "Select state to load mandis" : ""}
        >
          <MenuItem value="">Select state</MenuItem>
          {STATE_OPTIONS.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Search"
          size="small"
          value={impSearch}
          onChange={(e) => {
            setImpSearch(e.target.value);
            setImpPage(1);
          }}
          sx={{ minWidth: 200 }}
          disabled={!impState}
        />
        <TextField
          select
          label="Page Size"
          size="small"
          value={impPageSize}
          onChange={(e) => {
            setImpPageSize(Number(e.target.value));
            setImpPage(1);
          }}
          sx={{ width: 140 }}
          disabled={!impState}
        >
          {PAGE_SIZES.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => impState && fetchSystemMandis()} disabled={!impState}>
          Refresh
        </Button>
      </Stack>

      <Card>
        <CardContent>
          {!impState ? (
            <Typography variant="body2" color="text.secondary">
              Select a state to load system mandis.
            </Typography>
          ) : (
            <ResponsiveDataGrid
              autoHeight
              rows={impRows.map((r) => ({ id: r.mandi_id, ...r }))}
              columns={impColumns}
              loading={impLoading}
              paginationMode="server"
              rowCount={impTotal}
              pageSizeOptions={PAGE_SIZES}
              paginationModel={{ page: impPage - 1, pageSize: impPageSize }}
              onPaginationModelChange={(m) => {
                setImpPage(m.page + 1);
                setImpPageSize(m.pageSize);
              }}
            />
          )}
        </CardContent>
      </Card>

      <Stack direction="row" spacing={2} alignItems="center">
        <Typography variant="body2">Selected: {selection.length} (max 25)</Typography>
        <Button variant="contained" disabled={!selection.length || !impState} onClick={handleImport}>
          Import Selected
        </Button>
      </Stack>
    </Stack>
  );

  return (
    <PageContainer>
      <Stack spacing={2}>
        <Typography variant="h5">Mandis</Typography>
        <Tabs
          value={activeTab}
          onChange={(_, v) => {
            setActiveTab(v);
            if (v === "MY") {
              setMyPage(1);
            } else {
              resetImport();
            }
          }}
        >
          <Tab label="My Mandis" value="MY" />
          <Tab label="Import Mandis" value="IMPORT" />
        </Tabs>

        {activeTab === "MY" ? renderMyMandis() : renderImportMandis()}
      </Stack>
    </PageContainer>
  );
};
