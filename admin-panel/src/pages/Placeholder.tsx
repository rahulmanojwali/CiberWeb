import * as React from "react";
import { List } from "@refinedev/mui";
import { Typography } from "@mui/material";

export const Placeholder: React.FC<{ title: string }> = ({ title }) => {
  return (
    <List title={title}>
      <Typography variant="body1" sx={{ mt: 1 }}>
        {title} — coming soon.
      </Typography>
    </List>
  );
};
