import type { SxProps, Theme } from "@mui/material";

const baseCard: SxProps<Theme> = {
  borderRadius: 2,
  boxShadow: 3,
};

export const securityUi = {
  container: {
    minHeight: "100vh",
    py: 4,
    px: { xs: 2, md: 4 },
    backgroundColor: "background.default",
  } as SxProps<Theme>,
  content: {
    maxWidth: 960,
    mx: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 24,
  } as SxProps<Theme>,
  headerRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 2,
    flexWrap: "wrap",
  } as SxProps<Theme>,
  title: {
    fontSize: { xs: "22px", sm: "24px" },
    fontWeight: 600,
  } as SxProps<Theme>,
  subtitle: {
    fontSize: 14,
    color: "text.secondary",
    mt: 0.5,
  } as SxProps<Theme>,
  card: baseCard,
  cardContent: {
    px: { xs: 2.5, md: 3 },
    py: { xs: 2.5, md: 3.5 },
  } as SxProps<Theme>,
  cardHeader: {
    mb: 2,
  } as SxProps<Theme>,
  label: {
    fontSize: 11,
    letterSpacing: 1,
    textTransform: "uppercase",
    color: "text.secondary",
  } as SxProps<Theme>,
  value: {
    fontSize: 15,
    fontWeight: 600,
  } as SxProps<Theme>,
  helper: {
    fontSize: 13,
    color: "text.secondary",
  } as SxProps<Theme>,
  actionBar: {
    flexWrap: "wrap",
    gap: 1,
    mt: 3,
  } as SxProps<Theme>,
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    mt: 2,
  } as SxProps<Theme>,
  codeBox: {
    fontFamily: '"IBM Plex Mono", "Roboto Mono", monospace',
    backgroundColor: "#f7f7fb",
    border: "1px solid",
    borderColor: "divider",
    borderRadius: 1,
    p: 1,
    fontSize: 14,
    wordBreak: "break-all",
  } as SxProps<Theme>,
};
