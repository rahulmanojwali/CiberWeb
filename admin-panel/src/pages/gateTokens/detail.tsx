import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import {
  Box,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TextField,
  Typography,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Avatar,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import { PageContainer } from "../../components/PageContainer";
import { normalizeLanguageCode } from "../../config/languages";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import { fetchGateEntryTokens, fetchGatePassTokens, fetchGateMovements } from "../../services/gateOpsApi";

type TokenDetail = {
  token_code: string;
  token_type?: "PASS" | "ENTRY" | string;
  vehicle_no?: string | null;
  reason_code?: string | null;
  gate_code?: string | null;
  device_code?: string | null;
  status?: string | null;
  org_id?: string | null;
  mandi_id?: number | string | null;
  created_on?: string | null;
  created_by?: string | null;
  updated_on?: string | null;
  updated_by?: string | null;
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

function formatDate(value?: string | Date | null) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString();
}

export const GateTokenDetail: React.FC = () => {
  const { t, i18n } = useTranslation();
  const language = normalizeLanguageCode(i18n.language);
  const uiConfig = useAdminUiConfig();
  const { tokenCode: tokenCodeParam } = useParams<{ tokenCode: string }>();
  const tokenCode = useMemo(() => (tokenCodeParam ? decodeURIComponent(tokenCodeParam) : ""), [tokenCodeParam]);

  const [detail, setDetail] = useState<TokenDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [movements, setMovements] = useState<any[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movementsError, setMovementsError] = useState<string | null>(null);
  const [movementsMeta, setMovementsMeta] = useState<{ code: string; desc: string }>({ code: "", desc: "" });

  const canViewEntry = useMemo(
    () => can(uiConfig.resources, "gate_entry_tokens.view", "VIEW"),
    [uiConfig.resources],
  );
  const canViewPass = useMemo(
    () => can(uiConfig.resources, "gate_pass_tokens.view", "VIEW"),
    [uiConfig.resources],
  );
  const canViewMovements = useMemo(
    () => can(uiConfig.resources, "gate_movements_log.view", "VIEW"),
    [uiConfig.resources],
  );

  const loadToken = async () => {
    if (!tokenCode) {
      setError("Token code missing");
      return;
    }
    const username = currentUsername();
    if (!username) {
      setError("Not authorized");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      // try entry first
      let found: TokenDetail | null = null;
      if (canViewEntry) {
        const respEntry = await fetchGateEntryTokens({
          username,
          language,
          filters: { token_code: tokenCode, page_size: 1 },
        });
        const listE = respEntry?.data?.items || respEntry?.response?.data?.items || [];
        if (listE.length) {
          found = { ...listE[0], token_type: "ENTRY" } as any;
        }
      }
      if (!found && canViewPass) {
        const respPass = await fetchGatePassTokens({
          username,
          language,
          filters: { token_code: tokenCode, page_size: 1 },
        });
        const listP = respPass?.data?.items || respPass?.response?.data?.items || [];
        if (listP.length) {
          found = { ...listP[0], token_type: "PASS" } as any;
        }
      }
      if (!found) {
        setError("Token not found or not authorized.");
      } else {
        setDetail(found);
      }
    } catch (e: any) {
      setError(e?.message || "Unable to load token");
    } finally {
      setLoading(false);
    }
  };

  const loadMovements = async () => {
    if (!tokenCode || !canViewMovements) return;
    const username = currentUsername();
    if (!username) return;
    setMovementsLoading(true);
    setMovementsError(null);
    setMovementsMeta({ code: "", desc: "" });
    try {
      const resp = await fetchGateMovements({
        username,
        language,
        filters: { token_code: tokenCode },
      });
      const code = resp?.response?.responsecode || resp?.responsecode || "1";
      const desc = resp?.response?.description || resp?.description || "";
      setMovementsMeta({ code, desc });
      if (code !== "0") {
        setMovements([]);
        setMovementsError(desc || "Unable to load movements");
      } else {
        const list = resp?.data?.movements || resp?.response?.data?.movements || [];
        setMovements(list || []);
      }
    } catch (e: any) {
      setMovements([]);
      setMovementsError(e?.message || "Unable to load movements");
    } finally {
      setMovementsLoading(false);
    }
  };

  useEffect(() => {
    loadToken();
  }, [tokenCode, language, canViewEntry, canViewPass]);

  useEffect(() => {
    loadMovements();
  }, [tokenCode, language, canViewMovements]);

  if (!canViewEntry && !canViewPass) {
    return (
      <PageContainer>
        <Typography variant="h6">Not authorized to view gate tokens.</Typography>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Stack spacing={2} mb={2}>
        <Typography variant="h5">Gate Token Details</Typography>
        {tokenCode && (
          <Typography variant="body2" color="text.secondary">
            Loaded token_code: {tokenCode}
          </Typography>
        )}
      </Stack>

      {loading ? (
        <CircularProgress />
      ) : error ? (
        <Typography color="error">{error}</Typography>
      ) : !detail ? (
        <Typography color="text.secondary">No data found.</Typography>
      ) : (
        <Stack spacing={3} divider={<Divider flexItem />}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Token Code" value={detail.token_code || ""} size="small" InputProps={{ readOnly: true }} fullWidth />
              <TextField label="Type" value={detail.token_type || ""} size="small" InputProps={{ readOnly: true }} fullWidth />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Status" value={detail.status || ""} size="small" InputProps={{ readOnly: true }} fullWidth />
              <TextField label="Reason" value={detail.reason_code || ""} size="small" InputProps={{ readOnly: true }} fullWidth />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Vehicle" value={detail.vehicle_no || ""} size="small" InputProps={{ readOnly: true }} fullWidth />
              <TextField label="Gate" value={detail.gate_code || ""} size="small" InputProps={{ readOnly: true }} fullWidth />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Device" value={detail.device_code || ""} size="small" InputProps={{ readOnly: true }} fullWidth />
              <TextField label="Mandi" value={detail.mandi_id ? String(detail.mandi_id) : ""} size="small" InputProps={{ readOnly: true }} fullWidth />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Created On" value={formatDate(detail.created_on)} size="small" InputProps={{ readOnly: true }} fullWidth />
              <TextField label="Created By" value={detail.created_by || ""} size="small" InputProps={{ readOnly: true }} fullWidth />
            </Stack>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
              <TextField label="Updated On" value={formatDate(detail.updated_on)} size="small" InputProps={{ readOnly: true }} fullWidth />
              <TextField label="Updated By" value={detail.updated_by || ""} size="small" InputProps={{ readOnly: true }} fullWidth />
            </Stack>
          </Stack>

          <Box id="movements">
            <Stack spacing={1} direction="row" alignItems="center" mb={1}>
              <Typography variant="h6">Movements Timeline</Typography>
              {movementsLoading && <CircularProgress size={18} />}
            </Stack>
            {tokenCode && (
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Movements for token_code: {tokenCode} {movementsMeta.code && `(last response: ${movementsMeta.code} ${movementsMeta.desc || ""})`}
              </Typography>
            )}
            {movementsError && (
              <Typography variant="body2" color="error">
                {movementsError}
              </Typography>
            )}
            {!movementsLoading && !movementsError && movements.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No movements recorded for this token yet.
              </Typography>
            )}
            {!movementsLoading && movements.length > 0 && (
              <List dense>
                {movements.map((mv, idx) => (
                  <ListItem key={idx} alignItems="flex-start" sx={{ pl: 0 }}>
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      <Avatar sx={{ bgcolor: "primary.light", width: 32, height: 32 }}>
                        {(mv.step || "?").charAt(0)}
                      </Avatar>
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Chip size="small" label={mv.step || "-"} color={mv.step === "ENTRY" || mv.step === "SCAN" ? "success" : "default"} />
                          <Typography variant="body2" color="text.secondary">
                            {formatDate(mv.ts)}
                          </Typography>
                        </Stack>
                      }
                      secondary={
                        <Stack spacing={0.5}>
                          <Typography variant="body2">Actor: {mv.actor || "-"}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            Device: {mv.details?.device_code || "-"} | Source: {mv.details?.source || "-"}
                          </Typography>
                          {mv.details?.remarks && (
                            <Typography variant="body2" color="text.secondary">
                              Remarks: {mv.details?.remarks}
                            </Typography>
                          )}
                        </Stack>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </Stack>
      )}
    </PageContainer>
  );
};

export default GateTokenDetail;
