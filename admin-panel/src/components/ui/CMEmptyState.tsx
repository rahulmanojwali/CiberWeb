import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import InboxOutlinedIcon from "@mui/icons-material/InboxOutlined";
import type { FC } from "react";

type CMEmptyStateProps = {
  title?: string;
  subtitle?: string;
};

export const CMEmptyState: FC<CMEmptyStateProps> = ({
  title = "No records found",
  subtitle = "Try changing filters or refresh to load latest data.",
}) => {
  return (
    <Box className="cm-empty-state">
      <InboxOutlinedIcon sx={{ fontSize: 28, color: "var(--cm-muted)", mb: 1 }} />
      <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
      <Typography variant="body2" className="cm-muted">{subtitle}</Typography>
    </Box>
  );
};
