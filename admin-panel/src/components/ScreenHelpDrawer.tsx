import React, { useEffect, useMemo, useState } from "react";
import { Alert, Box, CircularProgress, Drawer, IconButton, Stack, Typography } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { getScreenHelp } from "../services/screenHelpApi";

type ScreenHelpDrawerProps = {
  open: boolean;
  onClose: () => void;
  route: string;
  language: string;
  title?: string;
};

export const ScreenHelpDrawer: React.FC<ScreenHelpDrawerProps> = ({
  open,
  onClose,
  route,
  language,
  title = "Help",
}) => {
  const [helpLoading, setHelpLoading] = useState(false);
  const [helpError, setHelpError] = useState(false);
  const [helpContent, setHelpContent] = useState("");
  const [loadedKey, setLoadedKey] = useState("");

  const fetchKey = useMemo(
    () => `${String(route || "").trim()}::${String(language || "").trim().toLowerCase()}`,
    [route, language],
  );

  useEffect(() => {
    if (!open || !route) return;
    if (loadedKey === fetchKey) return;
    let cancelled = false;

    const run = async () => {
      setHelpLoading(true);
      setHelpError(false);
      try {
        const payload = await getScreenHelp(route, language);
        if (cancelled) return;
        const responseCode = String(payload?.response?.responsecode ?? "0");
        const success = payload?.response ? responseCode === "0" : true;
        const html = String(
          payload?.data?.html ||
          payload?.data?.content ||
          payload?.html ||
          payload?.content ||
          payload?.content_html ||
          ""
        ).trim();

        if (import.meta.env.DEV) {
          // Dev-only diagnostics for screen help parsing compatibility.
          // eslint-disable-next-line no-console
          console.debug("[screenHelpDrawer]", {
            route,
            responsecode: payload?.response?.responsecode ?? null,
            htmlLength: String(payload?.data?.html || payload?.html || "").trim().length,
            contentLength: String(payload?.data?.content || payload?.content || "").trim().length,
          });
        }

        if (!success) {
          setHelpError(true);
          setHelpContent("");
          return;
        }
        setHelpContent(html);
      } catch {
        if (cancelled) return;
        setHelpError(true);
        setHelpContent("");
      } finally {
        if (!cancelled) {
          setHelpLoading(false);
          setLoadedKey(fetchKey);
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [open, route, language, fetchKey, loadedKey]);

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{ sx: { width: { xs: "100%", sm: 420 } } }}
    >
      <Box
        p={2}
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        borderBottom="1px solid"
        borderColor="divider"
      >
        <Typography variant="h6">{title}</Typography>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      <Box
        p={3}
        sx={{
          overflowY: "auto",
          "& h1, & h2, & h3, & h4, & h5, & h6": { mt: 0, mb: 1.5, color: "text.primary" },
          "& p": { mt: 0, mb: 2, color: "text.secondary", lineHeight: 1.6 },
          "& ul, & ol": { mt: 0, pl: 3, mb: 2, color: "text.secondary" },
          "& li": { mb: 0.75 },
          "& code": {
            backgroundColor: "action.hover",
            padding: "2px 4px",
            borderRadius: "4px",
            fontFamily: "monospace",
            fontSize: "0.9em",
            color: "error.main",
          },
          "& hr": {
            my: 2,
            border: 0,
            borderTop: "1px solid",
            borderColor: "divider",
          },
        }}
      >
        {helpLoading ? (
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="center" py={4}>
            <CircularProgress size={24} />
            <Typography color="text.secondary">Loading help content...</Typography>
          </Stack>
        ) : helpError ? (
          <Alert severity="error">Failed to load help content. Please try again later.</Alert>
        ) : helpContent ? (
          <div dangerouslySetInnerHTML={{ __html: helpContent }} />
        ) : (
          <Alert severity="info">Help content is not available for this screen yet.</Alert>
        )}
      </Box>
    </Drawer>
  );
};
