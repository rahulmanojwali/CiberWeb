import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
  MenuItem,
  Tooltip,
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
  removeOrgMandi,
} from "../../services/mandiApi";
import { useSnackbar } from "notistack";
import { DEFAULT_LANGUAGE } from "../../config/appConfig";
import { useTheme } from "@mui/material/styles";

// type MandiLite = {
//   _id?: string;
//   mandi_id: number;
//   mandi_slug?: string;
//   name_i18n?: { en?: string };
//   state_code?: string;
//   district_name?: string;
//   district_name_en?: string;
//   district_id?: string | number;
//   pincode?: string;
//   _rowId?: string;
// };
type MandiLite = {
  _id?: string;
  mandi_id: number;
  mandi_slug?: string;
  name_i18n?: { en?: string };
  state_code?: string;
  district_name?: string;
  district_name_en?: string;
  district_id?: string | number;
  pincode?: string;

  // ✅ NEW: normalized fields we will populate in prepareRows()
  address_line?: string;
  contact_number?: string;

  _rowId?: string;

  // allow unknown keys from API without TS complaining
  [key: string]: any;
};



const PAGE_SIZES = [10, 20, 50];
const STATE_NAME_MAP: Record<string, string> = {
  AP: "Andhra Pradesh",
  AR: "Arunachal Pradesh",
  AS: "Assam",
  BR: "Bihar",
  CH: "Chandigarh",
  CT: "Chhattisgarh",
  DL: "Delhi",
  GA: "Goa",
  GJ: "Gujarat",
  HR: "Haryana",
  HP: "Himachal Pradesh",
  JH: "Jharkhand",
  JK: "Jammu and Kashmir",
  KA: "Karnataka",
  KL: "Kerala",
  LA: "Ladakh",
  LD: "Lakshadweep",
  MH: "Maharashtra",
  ML: "Meghalaya",
  MN: "Manipur",
  MP: "Madhya Pradesh",
  MZ: "Mizoram",
  NL: "Nagaland",
  OR: "Odisha",
  PB: "Punjab",
  PY: "Puducherry",
  RJ: "Rajasthan",
  SK: "Sikkim",
  TN: "Tamil Nadu",
  TS: "Telangana",
  TR: "Tripura",
  UP: "Uttar Pradesh",
  UT: "Uttarakhand",
  WB: "West Bengal",
};
const STATE_OPTIONS = Object.keys(STATE_NAME_MAP);

export const Mandis: React.FC = () => {
  const { authContext, can } = usePermissions();
  const { enqueueSnackbar } = useSnackbar();
  const theme = useTheme();
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
  const [mySelectionModel, setMySelectionModel] = useState<(string | number)[]>([]);

  // Import tab state
  const [impState, setImpState] = useState<string>("");
  const [impSearch, setImpSearch] = useState("");
  const [impDebounced, setImpDebounced] = useState("");
  const [impPage, setImpPage] = useState(1);
  const [impPageSize, setImpPageSize] = useState(10);
  const [impRows, setImpRows] = useState<MandiLite[]>([]);
  const [impTotal, setImpTotal] = useState(0);
  const [impLoading, setImpLoading] = useState(false);

  // Import selection uses DataGrid built-in checkboxSelection.
  // We keep row ids in the selection model, and derive mandi_ids from impRows.
  const [impSelectionModel, setImpSelectionModel] = useState<(string | number)[]>([]);
  const importFilterRef = useRef<HTMLDivElement | null>(null);
  const [importFilterHeight, setImportFilterHeight] = useState(0);

  // Abort / dedupe
  const myReqRef = useRef<AbortController | null>(null);
  const impReqRef = useRef<AbortController | null>(null);

  // Selected mandi ids (derived from selected row ids)
  const selectedImportMandiIds = useMemo(() => {
    if (!impSelectionModel?.length) return [] as number[];
    const selected = new Set(impSelectionModel.map((v) => String(v)));
    return (impRows || [])
      .filter((r: any) => selected.has(String(r?._id || r?.mandi_id || r?._rowId)))
      .map((r: any) => r?.mandi_id)
      .filter((x: any) => x !== undefined && x !== null)
      .map((x: any) => Number(x))
      .filter((x: any) => Number.isFinite(x));
  }, [impSelectionModel, impRows]);

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
      field: "display_name",
      headerName: "Name",
      flex: 1,
    },
    {
      field: "state_code",
      headerName: "State",
      width: 110,
    },
    {
      field: "district_display",
      headerName: "District",
      flex: 1,
    },
    {
      field: "pincode",
      headerName: "Pincode",
      width: 120,
    },
    {
      field: "mandi_id",
      headerName: "ID",
      width: 110,
    },
  ],
  [],
);

  // Import grid: bind directly to real keys coming from backend
  // JSON keys: mandi_id, district_name_en, pincode
 

//   const impColumns: GridColDef[] = [
//   {
//     field: "mandi_id",
//     headerName: "ID",
//     width: 90,
//   },
//   {
//     field: "district_name_en",
//     headerName: "District",
//     flex: 1,
//     minWidth: 160,
//     valueGetter: (_value: any, row: any) =>
//       row?.district_name_en ||
//       row?.district_name ||
//       row?.district_id ||
//       "-",
//   },
//   {
//     field: "pincode",
//     headerName: "Pincode",
//     width: 110,
//   },
//   {
//     field: "address_line",
//     headerName: "Address",
//     flex: 2,
//     minWidth: 220,
//     valueGetter: (_value: any, row: any) =>
//       row?.address_line ||
//       row?.address ||
//       row?.address_i18n?.en ||
//       "-",
//   },
//   {
//     field: "contact_number",
//     headerName: "Contact",
//     width: 140,
//     valueGetter: (_value: any, row: any) =>
//       row?.contact_number ||
//       row?.contact ||
//       row?.mandi_contact ||
//       "-",
//   },
// ];

const impColumns: GridColDef[] = [
  { field: "display_name", headerName: "Name", flex: 1, minWidth: 180 },
  { field: "state_code", headerName: "State", width: 110 },
  { field: "district_display", headerName: "District", flex: 1, minWidth: 160 },
  { field: "pincode", headerName: "Pincode", width: 110 },
  { field: "mandi_id", headerName: "ID", width: 90 },
  { field: "address_line", headerName: "Address", flex: 2, minWidth: 220 },
  { field: "contact_number", headerName: "Contact", width: 150 },
];



  // Fetch helpers with abort/dedupe
  const normalizeList = (resp: any) => {
    // IMPORTANT:
    // Your backend returns: { response: {...}, data: { items: [...], meta: {...} } }
    // We must NOT treat axios-style resp.data as the "data object" automatically.
    const root = resp ?? {};
    const responseMeta = root?.response ?? root?.data?.response ?? resp?.response;

    const data = root?.data ?? {};
    const items = data?.items ?? data?.mandis ?? [];
    const meta = data?.meta ?? {};

    const totalRaw = meta?.totalCount ?? (Array.isArray(items) ? items.length : 0);
    const total = Number(totalRaw ?? 0);

    return { responseMeta, items: Array.isArray(items) ? items : [], total };
  };

  const normalizeImportResponse = (resp: any) => {
    const body = resp?.data ?? resp ?? {};
    return {
      imported: Number(body.imported ?? 0),
      skipped_existing: Number(body.skipped_existing ?? 0),
      skipped_invalid: Number(body.skipped_invalid ?? 0),
    };
  };

  // const prepareRows = (items: any[]) =>
  //   (items || []).map((m, idx) => {
  //     const district = m?.district_name_en || m?.district_name || m?.district || m?.district_id || "";
  //     return {
  //       ...m,
  //       // Stable, unique row id for DataGrid
  //       _rowId: m?._rowId || m?._id || (m?.mandi_id != null ? `mandi_${m.mandi_id}` : `row_${idx}`),
  //       district_name_en: district,
  //       pincode: m?.pincode ?? m?.pincode_no ?? "",
  //     };
  //   });

const prepareRows = (items: any[]) =>
  (items || []).map((m, idx) => {
    const district =
      m?.district_name_en ||
      m?.district_name ||
      m?.district ||
      m?.district_id ||
      "";

    const pincode =
      m?.pincode ??
      m?.pincode_no ??
      "";

    // ✅ Normalize address into ONE field used by UI
    const address_line =
      m?.address_line ||
      m?.address ||
      m?.address_line1 ||
      m?.address_line_en ||
      m?.mandi_address ||
      m?.location_address ||
      m?.address_i18n?.en ||
      "";

    // ✅ Normalize contact into ONE field used by UI
    const contact_number =
      m?.contact_number ||
      m?.contact ||
      m?.mandi_contact ||
      m?.phone ||
      m?.mobile ||
      m?.contact_no ||
      "";

    const display_name =
      m?.name_i18n?.en ||
      m?.label ||
      m?.mandi_slug ||
      (m?.mandi_id != null ? `Mandi ${m.mandi_id}` : "");

    const district_display =
      m?.district_name_en ||
      m?.district_name ||
      m?.district ||
      m?.district_id ||
      "";

    return {
      ...m,

      // Stable, unique row id for DataGrid
      _rowId:
        m?._rowId ||
        m?._id ||
        (m?.mandi_id != null ? `mandi_${m.mandi_id}` : `row_${idx}`),

      // ✅ Always set what UI reads
      district_name_en: district,
      pincode,
      address_line,
      contact_number,
      display_name,
      district_display,
    };
  });
// end here


  const fetchMyMandis = React.useCallback(async () => {
    if (!orgId) return;
    if (myReqRef.current) myReqRef.current.abort();
    const controller = new AbortController();
    myReqRef.current = controller;
    setMyLoading(true);
    console.log("[MyMandis] fetch", { page: myPage, pageSize: myPageSize, state: myState, q: myDebounced });
    try {
      const rawResp = await fetchOrgMandisLite({
        username,
        language: DEFAULT_LANGUAGE,
        org_id: orgId,
        filters: {
          state_code: myState || undefined,
          q: myDebounced || undefined,
          page: myPage,
          pageSize: myPageSize,
        },
      });
      if (controller.signal.aborted) return;
      const { responseMeta, items, total } = normalizeList(rawResp);
      if (responseMeta?.responsecode && responseMeta.responsecode !== "0") {
        enqueueSnackbar(responseMeta?.description || "Failed to load mandis", { variant: "error" });
        setMyRows([]);
        setMyTotal(0);
        return;
      }
      console.log("[MyMandis] resolved", { count: items.length, first: items[0] });
      const preparedRows = prepareRows(items) as MandiLite[];
      console.log("[MyMandis] rows sample", {
        first: items?.[0],
        preparedFirst: preparedRows?.[0],
      });
      setMyRows(preparedRows);
      setMyTotal(total);
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
      const rawResp = await fetchSystemMandisByState({
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

      // Debug: confirm contract
      console.log("[ImportMandis] RAW:", rawResp);

      const { responseMeta, items, total } = normalizeList(rawResp);
      if (responseMeta?.responsecode && responseMeta.responsecode !== "0") {
        enqueueSnackbar(responseMeta?.description || "Failed to load system mandis", { variant: "error" });
        setImpRows([]);
        setImpTotal(0);
        return;
      }
      console.log("[ImportMandis] resolved", { count: items.length, first: items[0] });
      const preparedRows = prepareRows(items) as MandiLite[];
      console.log("[Import] firstRow raw/prepared", {
        raw: items?.[0],
        prepared: preparedRows?.[0],
      });
      setImpRows(preparedRows);
      setImpTotal(total);
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
  useEffect(() => {
    if (activeTab === "MY") fetchMyMandis();
  }, [myDebounced, myState, myPage, myPageSize, fetchMyMandis, activeTab]);

  useEffect(() => {
    if (activeTab === "IMPORT" && impState) fetchSystemMandis();
  }, [impDebounced, impState, impPage, impPageSize, fetchSystemMandis, activeTab]);

  // Measure import filter height for sticky headers
  useEffect(() => {
    if (!importFilterRef.current) return;
    const el = importFilterRef.current;
    const measure = () => setImportFilterHeight(el.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [importFilterRef.current]);

  const resetMy = () => {
    setMyPage(1);
    fetchMyMandis();
    setMySelectionModel([]);
  };

  const resetImport = () => {
    setImpSelectionModel([]);
    setImpPage(1);
  };

  const handleImport = async () => {
    if (!orgId) {
      enqueueSnackbar("Organisation not found", { variant: "error" });
      return;
    }
    if (selectedImportMandiIds.length === 0) return;
    console.log("[ImportMandis] import", { count: selectedImportMandiIds.length });
    try {
      const resp = await importSystemMandisToOrg({
        username,
        language: DEFAULT_LANGUAGE,
        org_id: orgId,
        mandi_ids: selectedImportMandiIds.slice(0, 25),
      });
      const { imported, skipped_existing, skipped_invalid } = normalizeImportResponse(resp);
      enqueueSnackbar(
        `Imported ${imported}, skipped ${skipped_existing}, invalid ${skipped_invalid}`,
        {
          variant: "success",
        },
      );
      setActiveTab("MY");
      setImpSelectionModel([]);
      setMyPage(1);
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Import failed", { variant: "error" });
    }
  };

  const handleRemoveSelected = async () => {
    if (!canRemove || !mySelectionModel.length) return;
    if (!orgId) {
      enqueueSnackbar("Organisation not found", { variant: "error" });
      return;
    }
    const selectionSet = new Set(mySelectionModel.map((val) => String(val)));
    const mappingIds = (myRows || [])
      .filter((row) => selectionSet.has(String(row?._id || row?.mandi_id || row?._rowId)))
      .map((row) => row?._id)
      .filter((id): id is string => Boolean(id));
    if (!mappingIds.length) {
      enqueueSnackbar("Select a mandi to remove", { variant: "info" });
      return;
    }
    setMyLoading(true);
    try {
      for (const mapping_id of mappingIds) {
        await removeOrgMandi({
          username,
          language: DEFAULT_LANGUAGE,
          mapping_id,
        });
      }
      enqueueSnackbar("Removed selected mandi(s)", { variant: "success" });
      resetMy();
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Remove failed", { variant: "error" });
    } finally {
      setMyLoading(false);
    }
  };

  const canImport = can("mandis.org.import", "CREATE");
  const canRemove = can("mandis.org.remove", "DEACTIVATE");
  const canCreate = can("mandis.org.create", "CREATE");

  const renderMyMandis = () => {
    console.log("[MyMandisToolbar] canCreate", canCreate);
    const hasCreateFlow = false;
    const addDisabled = !canCreate || !hasCreateFlow;
    const addTooltip = !canCreate
      ? "No permission to add mandi"
      : !hasCreateFlow
      ? "Create flow not wired yet"
      : "";
    return (
    <Stack spacing={2}>
      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={1}
        alignItems={{ xs: "stretch", sm: "center" }}
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          bgcolor: "background.paper",
          borderBottom: 1,
          borderColor: "divider",
          py: 1,
        }}
      >
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
              {STATE_NAME_MAP[s] || s}
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

        <Tooltip
          title={
            !canRemove
              ? "No permission"
              : "This will deactivate the mandi for this organisation.\nThe mandi can be re-imported later."
          }
          arrow
        >
          <span>
            <Button
              variant="outlined"
              color="error"
              disabled={!canRemove || mySelectionModel.length === 0}
              onClick={handleRemoveSelected}
            >
              Remove from Organisation
            </Button>
          </span>
        </Tooltip>

        <Tooltip title={addTooltip} arrow>
          <span>
            <Button variant="contained" color="primary" disabled={addDisabled}>
              Add Custom Mandi
            </Button>
          </span>
        </Tooltip>
      </Stack>

      <Card>
        <CardContent>
          <ResponsiveDataGrid
            autoHeight
            getRowId={(row: any) => String(row?._id || row?.mandi_id || row?._rowId)}
            rows={myRows}
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
            checkboxSelection
            disableRowSelectionOnClick
            rowSelectionModel={mySelectionModel}
            onRowSelectionModelChange={(model) => {
              const next = Array.isArray(model) ? model : [];
              setMySelectionModel(next);
            }}
          />
        </CardContent>
      </Card>
    </Stack>
  );
  };

  // const renderImportMandis = () => (
  //   // NOTE: DataGrid needs a non-zero height ancestor to render reliably.
  //   <Box sx={{ height: "72vh", overflow: "auto", position: "relative" }}>
  //     <Stack
  //       direction={{ xs: "column", sm: "row" }}
  //       spacing={1}
  //       alignItems={{ xs: "stretch", sm: "center" }}
  //       ref={importFilterRef}
  //       sx={{
  //         position: "sticky",
  //         top: 0,
  //         zIndex: 30,
  //         bgcolor: "background.paper",
  //         borderBottom: 1,
  //         borderColor: "divider",
  //         py: 1,
  //         px: 1,
  //         boxShadow: 1,
  //       }}
  //     >
  //       <TextField
  //         select
  //         required
  //         label="State"
  //         size="small"
  //         value={impState}
  //         onChange={(e) => {
  //           setImpState(e.target.value);
  //           setImpPage(1);
  //           setImpSelectionModel([]);
  //         }}
  //         sx={{ minWidth: 180 }}
  //         helperText={!impState ? "Select state to load mandis" : ""}
  //       >
  //         <MenuItem value="">Select state</MenuItem>
  //         {STATE_OPTIONS.map((s) => (
  //           <MenuItem key={s} value={s}>
  //             {STATE_NAME_MAP[s] || s}
  //           </MenuItem>
  //         ))}
  //       </TextField>

  //       <TextField
  //         label="Search"
  //         size="small"
  //         value={impSearch}
  //         onChange={(e) => {
  //           setImpSearch(e.target.value);
  //           setImpPage(1);
  //         }}
  //         sx={{ minWidth: 200 }}
  //         disabled={!impState}
  //       />

  //       <TextField
  //         select
  //         label="Page Size"
  //         size="small"
  //         value={impPageSize}
  //         onChange={(e) => {
  //           setImpPageSize(Number(e.target.value));
  //           setImpPage(1);
  //         }}
  //         sx={{ width: 140 }}
  //         disabled={!impState}
  //       >
  //         {PAGE_SIZES.map((s) => (
  //           <MenuItem key={s} value={s}>
  //             {s}
  //           </MenuItem>
  //         ))}
  //       </TextField>

  //       <Button
  //         variant="outlined"
  //         startIcon={<RefreshIcon />}
  //         onClick={() => impState && fetchSystemMandis()}
  //         disabled={!impState}
  //       >
  //         Refresh
  //       </Button>
  //     </Stack>

  //     <Card sx={{ mt: 1 }}>
  //       <CardContent sx={{ p: 0 }}>
  //         {!impState ? (
  //           <Box sx={{ p: 2 }}>
  //             <Typography variant="body2" color="text.secondary">
  //               Select a state to load system mandis.
  //             </Typography>
  //           </Box>
  //         ) : (
  //           <ResponsiveDataGrid
  //             autoHeight
  //             getRowId={(row: any) => String(row?._id || row?.mandi_id || row?._rowId)}
  //             rows={impRows}
  //             columns={impColumns}
  //             loading={impLoading}
  //             checkboxSelection
  //             disableRowSelectionOnClick
  //             rowSelectionModel={impSelectionModel}
  //             onRowSelectionModelChange={(m) => {
  //               const next = Array.isArray(m) ? m : [];
  //               if (next.length > 25) {
  //                 enqueueSnackbar("You can import 25 mandis at a time.", { variant: "warning" });
  //                 return;
  //               }
  //               setImpSelectionModel(next);
  //             }}
  //             paginationMode="server"
  //             rowCount={impTotal}
  //             pageSizeOptions={PAGE_SIZES}
  //             paginationModel={{ page: impPage - 1, pageSize: impPageSize }}
  //             onPaginationModelChange={(m) => {
  //               setImpPage(m.page + 1);
  //               setImpPageSize(m.pageSize);
  //             }}
  //             sx={{
  //               "& .MuiDataGrid-columnHeaders": {
  //                 position: "sticky",
  //                 top: importFilterHeight || 0,
  //                 zIndex: 40,
  //                 backgroundColor: theme.palette.background.paper,
  //                 boxShadow: 1,
  //                 borderBottom: "1px solid",
  //                 borderColor: "divider",
  //               },
  //             }}
  //           />
  //         )}
  //       </CardContent>
  //     </Card>

  //     <Stack
  //       direction="row"
  //       spacing={2}
  //       alignItems="center"
  //       sx={{ p: 1, position: "sticky", bottom: 0, bgcolor: "background.paper" }}
  //     >
  //       <Typography variant="body2">Selected: {selectedImportMandiIds.length} (max 25)</Typography>
  //       <Button variant="contained" disabled={!selectedImportMandiIds.length || !impState} onClick={handleImport}>
  //         Import Selected
  //       </Button>
  //     </Stack>
  //   </Box>
  // );
  const renderImportMandis = () => {
  // Sticky filter bar height (in px). Adjust if your filter bar is taller.
  const IMPORT_FILTER_BAR_HEIGHT = 72;

  return (
    // ✅ Fixed-height container so scrollbar is inside grid area, not page
    <Box sx={{ height: "72vh", display: "flex", flexDirection: "column", width: "100%" }}>
      {/* ✅ Sticky Filter Bar (State dropdown etc.) */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 50,
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
          px: 1,
          py: 1,
        }}
      >
        <Box sx={{ display: "flex", gap: 1, alignItems: "center", flexWrap: "wrap" }}>
          {/* STATE Dropdown */}
          <TextField
            select
            label="State"
            size="small"
            value={impState}
            onChange={(e) => {
              setImpState(String(e.target.value || ""));
              setImpPage(1);
              setImpSelectionModel([]); // reset selection on state change
            }}
            sx={{ minWidth: 220 }}
          >
            <MenuItem value="">Select state</MenuItem>
            {STATE_OPTIONS.map((code) => (
              <MenuItem key={`imp_state_${code}`} value={code}>
                {STATE_NAME_MAP?.[code] || code}
              </MenuItem>
            ))}
          </TextField>

          {/* Search */}
          <TextField
            label="Search"
            size="small"
            value={impSearch}
            onChange={(e) => {
              setImpSearch(e.target.value);
              setImpPage(1);
            }}
            sx={{ minWidth: 220 }}
            disabled={!impState}
          />

          {/* Page size */}
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

          {/* Refresh */}
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => {
              if (impState) fetchSystemMandis();
            }}
            disabled={!impState}
          >
            Refresh
          </Button>

          {/* Import */}
          <Button
            variant="contained"
            disabled={!impState || selectedImportMandiIds.length === 0}
            onClick={handleImport}
          >
            Import Selected
          </Button>

          <Tooltip title={!canImport ? "No permission" : ""} arrow>
            <span>
              <Button
                variant="contained"
                disabled={!canImport || !impState || selectedImportMandiIds.length === 0}
                onClick={handleImport}
              >
                Import Selected
              </Button>
            </span>
          </Tooltip>

          <Typography variant="body2" sx={{ opacity: 0.7 }}>
            Selected: {selectedImportMandiIds.length} (max 25) • Total: {impTotal}
          </Typography>
        </Box>
      </Box>

      {/* ✅ Scroll area starts BELOW sticky bar */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {!impState ? (
          <Box sx={{ p: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Select a state to load system mandis.
            </Typography>
          </Box>
        ) : (
          <ResponsiveDataGrid
            // IMPORTANT: do NOT use autoHeight here if you want internal scrolling + sticky header.
            rows={impRows}
            columns={impColumns}
            loading={impLoading}
            checkboxSelection
            disableRowSelectionOnClick
            getRowId={(row: any) => String(row?._id || row?.mandi_id || row?._rowId)}
            rowSelectionModel={impSelectionModel}
            onRowSelectionModelChange={(m) => {
              const next = Array.isArray(m) ? m : [];
              if (next.length > 25) {
                enqueueSnackbar("You can import 25 mandis at a time.", { variant: "warning" });
                return;
              }
              setImpSelectionModel(next);
            }}
            paginationMode="server"
            rowCount={impTotal}
            pageSizeOptions={PAGE_SIZES}
            paginationModel={{ page: impPage - 1, pageSize: impPageSize }}
            onPaginationModelChange={(m) => {
              setImpPage(m.page + 1);
              setImpPageSize(m.pageSize);
            }}
            sx={{
              height: "100%",

              // ✅ Sticky grid column header within the grid scroller
              "& .MuiDataGrid-columnHeaders": {
                position: "sticky",
                top: 0,
                zIndex: 10,
                backgroundColor: "background.paper",
                borderBottom: "1px solid",
                borderColor: "divider",
                boxShadow: 1,
              },

              // Optional: nicer scroll
              "& .MuiDataGrid-virtualScroller": {
                overflowY: "auto",
              },
            }}
          />
        )}
      </Box>
    </Box>
  );
};


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


// import React, { useEffect, useMemo, useRef, useState } from "react";
// import {
//   Box,
//   Button,
//   Card,
//   CardContent,
//   CircularProgress,
//   FormControlLabel,
//   Pagination,
//   Stack,
//   Tab,
//   Tabs,
//   TextField,
//   Checkbox,
//   Typography,
//   MenuItem,
// } from "@mui/material";
// import { type GridColDef } from "@mui/x-data-grid";
// import RefreshIcon from "@mui/icons-material/Refresh";
// import { PageContainer } from "../../components/PageContainer";
// import { ResponsiveDataGrid } from "../../components/ResponsiveDataGrid";
// import { usePermissions } from "../../authz/usePermissions";
// import {
//   fetchOrgMandisLite,
//   fetchSystemMandisByState,
//   importSystemMandisToOrg,
// } from "../../services/mandiApi";
// import { useSnackbar } from "notistack";
// import { DEFAULT_LANGUAGE } from "../../config/appConfig";
// import { useTheme } from "@mui/material/styles";

// type MandiLite = {
//   _id?: string;
//   mandi_id: number;
//   mandi_slug?: string;
//   name_i18n?: { en?: string };
//   state_code?: string;
//   district_name?: string;
//   district_name_en?: string;
//   pincode?: string;
// };

// const PAGE_SIZES = [10, 20, 50];
// const STATE_NAME_MAP: Record<string, string> = {
//   AP: "Andhra Pradesh",
//   AR: "Arunachal Pradesh",
//   AS: "Assam",
//   BR: "Bihar",
//   CH: "Chandigarh",
//   CT: "Chhattisgarh",
//   DL: "Delhi",
//   GA: "Goa",
//   GJ: "Gujarat",
//   HR: "Haryana",
//   HP: "Himachal Pradesh",
//   JH: "Jharkhand",
//   JK: "Jammu and Kashmir",
//   KA: "Karnataka",
//   KL: "Kerala",
//   LA: "Ladakh",
//   LD: "Lakshadweep",
//   MH: "Maharashtra",
//   ML: "Meghalaya",
//   MN: "Manipur",
//   MP: "Madhya Pradesh",
//   MZ: "Mizoram",
//   NL: "Nagaland",
//   OR: "Odisha",
//   PB: "Punjab",
//   PY: "Puducherry",
//   RJ: "Rajasthan",
//   SK: "Sikkim",
//   TN: "Tamil Nadu",
//   TS: "Telangana",
//   TR: "Tripura",
//   UP: "Uttar Pradesh",
//   UT: "Uttarakhand",
//   WB: "West Bengal",
// };
// const STATE_OPTIONS = Object.keys(STATE_NAME_MAP);

// export const Mandis: React.FC = () => {
//   const { authContext } = usePermissions();
//   const { enqueueSnackbar } = useSnackbar();
//   const theme = useTheme();
//   const username =
//     (() => {
//       try {
//         const raw = localStorage.getItem("cd_user");
//         const parsed = raw ? JSON.parse(raw) : null;
//         return parsed?.username || null;
//       } catch {
//         return null;
//       }
//     })() || "";

//   const orgId = authContext.org_id || "";

//   const [activeTab, setActiveTab] = useState<"MY" | "IMPORT">("MY");

//   // My Mandis state
//   const [myState, setMyState] = useState<string>("");
//   const [mySearch, setMySearch] = useState("");
//   const [myDebounced, setMyDebounced] = useState("");
//   const [myPage, setMyPage] = useState(1);
//   const [myPageSize, setMyPageSize] = useState(10);
//   const [myRows, setMyRows] = useState<MandiLite[]>([]);
//   const [myTotal, setMyTotal] = useState(0);
//   const [myLoading, setMyLoading] = useState(false);

//   // Import tab state
//   const [impState, setImpState] = useState<string>("");
//   const [impSearch, setImpSearch] = useState("");
//   const [impDebounced, setImpDebounced] = useState("");
//   const [impPage, setImpPage] = useState(1);
//   const [impPageSize, setImpPageSize] = useState(10);
//   const [impRows, setImpRows] = useState<MandiLite[]>([]);
//   const [impTotal, setImpTotal] = useState(0);
//   const [impLoading, setImpLoading] = useState(false);
//   // Import selection uses DataGrid built-in checkboxSelection.
//   // We keep row ids in the selection model, and derive mandi_ids from impRows.
//   const [impSelectionModel, setImpSelectionModel] = useState<(string | number)[]>([]);
//   const importFilterRef = useRef<HTMLDivElement | null>(null);
//   const [importFilterHeight, setImportFilterHeight] = useState(0);

//   // Abort / dedupe
//   const myReqRef = useRef<AbortController | null>(null);
//   const impReqRef = useRef<AbortController | null>(null);

//   // Selected mandi ids (derived from selected row ids)
//   const selectedImportMandiIds = useMemo(() => {
//     if (!impSelectionModel?.length) return [] as number[];
//     const selected = new Set(impSelectionModel.map((v) => String(v)));
//     return (impRows || [])
//       .filter((r: any) => selected.has(String(r?._id || r?.mandi_id || r?._rowId)))
//       .map((r: any) => r?.mandi_id)
//       .filter((x: any) => x !== undefined && x !== null)
//       .map((x: any) => Number(x))
//       .filter((x: any) => Number.isFinite(x));
//   }, [impSelectionModel, impRows]);

//   // Debounce search
//   useEffect(() => {
//     const h = setTimeout(() => setMyDebounced(mySearch), 500);
//     return () => clearTimeout(h);
//   }, [mySearch]);

//   useEffect(() => {
//     const h = setTimeout(() => setImpDebounced(impSearch), 500);
//     return () => clearTimeout(h);
//   }, [impSearch]);

//   const myColumns: GridColDef<MandiLite>[] = useMemo(
//     () => [
//       {
//         field: "my_name",
//         headerName: "Name",
//         flex: 1,
//         valueGetter: (p: any) => p?.row?.name_i18n?.en || p?.row?.mandi_slug || p?.row?.mandi_id,
//       },
//       { field: "my_state", headerName: "State", width: 110, valueGetter: (p: any) => p?.row?.state_code || "" },
//       {
//         field: "my_district",
//         headerName: "District",
//         flex: 1,
//         valueGetter: (p: any) => p?.row?.district_name_en || p?.row?.district_name || "",
//       },
//       { field: "my_pincode", headerName: "Pincode", width: 120, valueGetter: (p: any) => p?.row?.pincode || "-" },
//       { field: "my_mandi_id", headerName: "ID", width: 110, valueGetter: (p: any) => p?.row?.mandi_id },
//     ],
//     [],
//   );

//   // Import grid: bind directly to real keys coming from backend
//   // JSON keys: mandi_id, district_name_en, pincode
//   const impColumns: GridColDef<MandiLite>[] = useMemo(
//     () => [
//       {
//         field: "mandi_id",
//         headerName: "ID",
//         width: 110,
//       },
//       {
//         field: "district_name_en",
//         headerName: "District",
//         flex: 1,
//         minWidth: 160,
//         valueGetter: (p: any) => p?.row?.district_name_en || p?.row?.district_name || (p as any)?.row?.district_id || "-",
//       },
//       {
//         field: "pincode",
//         headerName: "Pincode",
//         width: 140,
//         valueGetter: (p: any) => p?.row?.pincode || "-",
//       },
//     ],
//     [],
//   );

//   // Fetch helpers with abort/dedupe
//   const normalizeList = (resp: any) => {
//     const root = resp?.data ?? resp ?? {};
//     const responseMeta =
//       root?.response ??
//       root?.data?.response ??
//       root?.data?.data?.response ??
//       root?.data?.data?.data?.response ??
//       resp?.response ??
//       resp?.data?.response;

//     const data = root?.data ?? root;
//     const items =
//       data?.items ??
//       data?.data?.items ??
//       data?.data?.data?.items ??
//       data?.data?.data?.data?.items ??
//       data?.mandis ??
//       data?.data?.mandis ??
//       [];

//     const meta =
//       data?.meta ??
//       data?.data?.meta ??
//       data?.data?.data?.meta ??
//       data?.data?.data?.data?.meta ??
//       {};

//     const totalRaw =
//       meta?.totalCount ??
//       data?.totalCount ??
//       data?.data?.totalCount ??
//       data?.data?.data?.totalCount ??
//       data?.data?.data?.data?.totalCount ??
//       (Array.isArray(items) ? items.length : 0);

//     const total = Number(totalRaw ?? 0);
//     return { responseMeta, items: Array.isArray(items) ? items : [], total };
//   };

//   const prepareRows = (items: any[]) =>
//     (items || []).map((m, idx) => {
//       const district =
//         m?.district_name_en ||
//         m?.district_name ||
//         m?.district ||
//         m?.district_id ||
//         "";
//       return {
//         ...m,
//         // Stable, unique row id for DataGrid
//         _rowId: m?._rowId || m?._id || (m?.mandi_id != null ? `mandi_${m.mandi_id}` : `row_${idx}`),
//         district_name_en: district,
//         pincode: m?.pincode ?? m?.pincode_no ?? "",
//       };
//     });

//   const fetchMyMandis = React.useCallback(async () => {
//     if (!orgId) return;
//     if (myReqRef.current) myReqRef.current.abort();
//     const controller = new AbortController();
//     myReqRef.current = controller;
//     setMyLoading(true);
//     const payload = {
//       api: "getOrgMandis",
//       org_id: orgId,
//       state_code: myState || undefined,
//       q: myDebounced || undefined,
//       page: myPage,
//       pageSize: myPageSize,
//     };
//     console.log("[MyMandis] fetch", { page: myPage, pageSize: myPageSize, state: myState, q: myDebounced });
//     try {
//       const rawResp = await fetchOrgMandisLite({
//         username,
//         language: DEFAULT_LANGUAGE,
//         org_id: orgId,
//         filters: {
//           state_code: payload.state_code,
//           q: payload.q,
//           page: payload.page,
//           pageSize: payload.pageSize,
//         },
//       });
//       if (controller.signal.aborted) return;
//       const { responseMeta, items, total } = normalizeList(rawResp);
//       if (responseMeta?.responsecode && responseMeta.responsecode !== "0") {
//         enqueueSnackbar(responseMeta?.description || "Failed to load mandis", { variant: "error" });
//         setMyRows([]);
//         setMyTotal(0);
//         return;
//       }
//       console.log("[MyMandis] resolved", { count: items.length, first: items[0] });
//       setMyRows(prepareRows(items) as MandiLite[]);
//       setMyTotal(total);
//     } catch (err: any) {
//       if (controller.signal.aborted) return;
//       enqueueSnackbar(err?.message || "Failed to load mandis", { variant: "error" });
//       setMyRows([]);
//       setMyTotal(0);
//     } finally {
//       if (!controller.signal.aborted) setMyLoading(false);
//     }
//   }, [orgId, myState, myDebounced, myPage, myPageSize, username, enqueueSnackbar]);

//   const fetchSystemMandis = React.useCallback(async () => {
//     if (!impState) return;
//     if (impReqRef.current) impReqRef.current.abort();
//     const controller = new AbortController();
//     impReqRef.current = controller;
//     setImpLoading(true);
//     console.log("[ImportMandis] fetch", { state: impState, page: impPage, pageSize: impPageSize, q: impDebounced });
//     try {
//       const rawResp = await fetchSystemMandisByState({
//         username,
//         language: DEFAULT_LANGUAGE,
//         state_code: impState,
//         filters: {
//           q: impDebounced || undefined,
//           page: impPage,
//           pageSize: impPageSize,
//         },
//       });
//       if (controller.signal.aborted) return;
//       const { responseMeta, items, total } = normalizeList(rawResp);
//       if (responseMeta?.responsecode && responseMeta.responsecode !== "0") {
//         enqueueSnackbar(responseMeta?.description || "Failed to load system mandis", { variant: "error" });
//         setImpRows([]);
//         setImpTotal(0);
//         return;
//       }
//       console.log("[ImportMandis] resolved", { count: items.length, first: items[0] });
//       setImpRows(prepareRows(items) as MandiLite[]);
//       setImpTotal(total);
//     } catch (err: any) {
//       if (controller.signal.aborted) return;
//       enqueueSnackbar(err?.message || "Failed to load system mandis", { variant: "error" });
//       setImpRows([]);
//       setImpTotal(0);
//     } finally {
//       if (!controller.signal.aborted) setImpLoading(false);
//     }
//   }, [impState, impPage, impPageSize, impDebounced, username, enqueueSnackbar]);

//   // Effects
//   // Debounce triggers
//   useEffect(() => {
//     if (activeTab === "MY") fetchMyMandis();
//   }, [myDebounced, myState, myPage, myPageSize, fetchMyMandis, activeTab]);

//   useEffect(() => {
//     if (activeTab === "IMPORT" && impState) fetchSystemMandis();
//   }, [impDebounced, impState, impPage, impPageSize, fetchSystemMandis, activeTab]);

//   // Measure import filter height for sticky headers
//   useEffect(() => {
//     if (!importFilterRef.current) return;
//     const el = importFilterRef.current;
//     const measure = () => setImportFilterHeight(el.getBoundingClientRect().height);
//     measure();
//     const observer = new ResizeObserver(measure);
//     observer.observe(el);
//     return () => observer.disconnect();
//   }, [importFilterRef.current]);

//   const resetMy = () => {
//     setMyPage(1);
//     fetchMyMandis();
//   };

//   const resetImport = () => {
//     setImpSelectionModel([]);
//     setImpPage(1);
//   };

//   const handleImport = async () => {
//     if (!orgId) {
//       enqueueSnackbar("Organisation not found", { variant: "error" });
//       return;
//     }
//     if (selectedImportMandiIds.length === 0) return;
//     console.log("[ImportMandis] import", { count: selectedImportMandiIds.length });
//     try {
//       const resp = await importSystemMandisToOrg({
//         username,
//         language: DEFAULT_LANGUAGE,
//         org_id: orgId,
//         mandi_ids: selectedImportMandiIds.slice(0, 25),
//       });
//       const data = (resp as any)?.data?.data || (resp as any)?.data || (resp as any)?.response?.data || {};
//       enqueueSnackbar(
//         `Imported ${data.imported || 0}, skipped ${data.skipped_existing || 0}`,
//         { variant: "success" },
//       );
//       setActiveTab("MY");
//       setImpSelectionModel([]);
//       setMyPage(1);
//       fetchMyMandis();
//     } catch (err: any) {
//       enqueueSnackbar(err?.message || "Import failed", { variant: "error" });
//     }
//   };

//   const renderMyMandis = () => (
//     <Stack spacing={2}>
//       <Stack direction={{ xs: "column", sm: "row" }} spacing={1} alignItems={{ xs: "stretch", sm: "center" }} sx={{ position: "sticky", top: 0, zIndex: 20, bgcolor: "background.paper", borderBottom: 1, borderColor: "divider", py: 1 }}>
//         <TextField
//           select
//           label="State"
//           size="small"
//           value={myState}
//           onChange={(e) => {
//             setMyState(e.target.value);
//             setMyPage(1);
//           }}
//           sx={{ minWidth: 160 }}
//         >
//           <MenuItem value="">All States</MenuItem>
//           {STATE_OPTIONS.map((s) => (
//             <MenuItem key={s} value={s}>
//               {STATE_NAME_MAP[s] || s}
//             </MenuItem>
//           ))}
//         </TextField>
//           <TextField
//             label="Search"
//             size="small"
//             value={mySearch}
//             onChange={(e) => {
//               setMySearch(e.target.value);
//               setMyPage(1);
//             }}
//             sx={{ minWidth: 200 }}
//           />
//         <TextField
//           select
//           label="Page Size"
//           size="small"
//           value={myPageSize}
//           onChange={(e) => {
//             setMyPageSize(Number(e.target.value));
//             setMyPage(1);
//           }}
//           sx={{ width: 140 }}
//         >
//           {PAGE_SIZES.map((s) => (
//             <MenuItem key={s} value={s}>
//               {s}
//             </MenuItem>
//           ))}
//         </TextField>
//         <Button variant="outlined" startIcon={<RefreshIcon />} onClick={resetMy}>
//           Refresh
//         </Button>
//       </Stack>
//       <Card>
//         <CardContent>
//           <ResponsiveDataGrid
//             autoHeight
//             getRowId={(row: any) => String(row?._id || row?.mandi_id)}
//             rows={myRows}
//             columns={myColumns}
//             loading={myLoading}
//             paginationMode="server"
//             rowCount={myTotal}
//             pageSizeOptions={PAGE_SIZES}
//             paginationModel={{ page: myPage - 1, pageSize: myPageSize }}
//             onPaginationModelChange={(m) => {
//               setMyPage(m.page + 1);
//               setMyPageSize(m.pageSize);
//             }}
//           />
//         </CardContent>
//       </Card>
//     </Stack>
//   );

//   const renderImportMandis = () => (
//     // NOTE: DataGrid needs a non-zero height ancestor to render reliably.
//     <Box sx={{ height: "72vh", overflow: "auto", position: "relative" }}>
//       <Stack
//         direction={{ xs: "column", sm: "row" }}
//         spacing={1}
//         alignItems={{ xs: "stretch", sm: "center" }}
//         ref={importFilterRef}
//         sx={{
//           position: "sticky",
//           top: 0,
//           zIndex: 30,
//           bgcolor: "background.paper",
//           borderBottom: 1,
//           borderColor: "divider",
//           py: 1,
//           px: 1,
//           boxShadow: 1,
//         }}
//       >
//         <TextField
//           select
//           required
//           label="State"
//           size="small"
//           value={impState}
//           onChange={(e) => {
//             setImpState(e.target.value);
//             setImpPage(1);
//             setImpSelectionModel([]);
//           }}
//           sx={{ minWidth: 180 }}
//           helperText={!impState ? "Select state to load mandis" : ""}
//         >
//           <MenuItem value="">Select state</MenuItem>
//           {STATE_OPTIONS.map((s) => (
//             <MenuItem key={s} value={s}>
//               {STATE_NAME_MAP[s] || s}
//             </MenuItem>
//           ))}
//         </TextField>
//         <TextField
//           label="Search"
//           size="small"
//           value={impSearch}
//           onChange={(e) => {
//             setImpSearch(e.target.value);
//             setImpPage(1);
//           }}
//           sx={{ minWidth: 200 }}
//           disabled={!impState}
//         />
//         <TextField
//           select
//           label="Page Size"
//           size="small"
//           value={impPageSize}
//           onChange={(e) => {
//             setImpPageSize(Number(e.target.value));
//             setImpPage(1);
//           }}
//           sx={{ width: 140 }}
//           disabled={!impState}
//         >
//           {PAGE_SIZES.map((s) => (
//             <MenuItem key={s} value={s}>
//               {s}
//             </MenuItem>
//           ))}
//         </TextField>
//         <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => impState && fetchSystemMandis()} disabled={!impState}>
//           Refresh
//         </Button>
//       </Stack>

//       <Card sx={{ mt: 1 }}>
//         <CardContent sx={{ p: 0 }}>
//           {!impState ? (
//             <Box sx={{ p: 2 }}>
//               <Typography variant="body2" color="text.secondary">
//                 Select a state to load system mandis.
//               </Typography>
//             </Box>
//           ) : (
//             <ResponsiveDataGrid
//               autoHeight
//               getRowId={(row: any) => String(row?._id || row?.mandi_id)}
//               rows={impRows}
//               columns={impColumns}
//               loading={impLoading}
//               checkboxSelection
//               disableRowSelectionOnClick
//               rowSelectionModel={impSelectionModel}
//               onRowSelectionModelChange={(m) => {
//                 const next = Array.isArray(m) ? m : [];
//                 if (next.length > 25) {
//                   enqueueSnackbar("You can import 25 mandis at a time.", { variant: "warning" });
//                   return;
//                 }
//                 setImpSelectionModel(next);
//               }}
//               paginationMode="server"
//               rowCount={impTotal}
//               pageSizeOptions={PAGE_SIZES}
//               paginationModel={{ page: impPage - 1, pageSize: impPageSize }}
//               onPaginationModelChange={(m) => {
//                 setImpPage(m.page + 1);
//                 setImpPageSize(m.pageSize);
//               }}
//               sx={{
//                 "& .MuiDataGrid-columnHeaders": {
//                   position: "sticky",
//                   top: importFilterHeight || 0,
//                   zIndex: 40,
//                   backgroundColor: theme.palette.background.paper,
//                   boxShadow: 1,
//                   borderBottom: "1px solid",
//                   borderColor: "divider",
//                 },
//               }}
//             />
//           )}
//         </CardContent>
//       </Card>

//       <Stack direction="row" spacing={2} alignItems="center" sx={{ p: 1, position: "sticky", bottom: 0, bgcolor: "background.paper" }}>
//         <Typography variant="body2">Selected: {selectedImportMandiIds.length} (max 25)</Typography>
//         <Button variant="contained" disabled={!selectedImportMandiIds.length || !impState} onClick={handleImport}>
//           Import Selected
//         </Button>
//       </Stack>
//     </Box>
//   );

//   return (
//     <PageContainer>
//       <Stack spacing={2}>
//         <Typography variant="h5">Mandis</Typography>
//         <Tabs
//           value={activeTab}
//           onChange={(_, v) => {
//             setActiveTab(v);
//             if (v === "MY") {
//               setMyPage(1);
//             } else {
//               resetImport();
//             }
//           }}
//         >
//           <Tab label="My Mandis" value="MY" />
//           <Tab label="Import Mandis" value="IMPORT" />
//         </Tabs>

//         {activeTab === "MY" ? renderMyMandis() : renderImportMandis()}
//       </Stack>
//     </PageContainer>
//   );
// };
