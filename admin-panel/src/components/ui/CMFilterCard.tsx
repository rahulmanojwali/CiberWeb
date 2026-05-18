import Box from "@mui/material/Box";
import FilterListIcon from "@mui/icons-material/FilterList";
import type { FC, ReactNode } from "react";

type CMFilterCardProps = {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

export const CMFilterCard: FC<CMFilterCardProps> = ({ title = "Filters", actions, children, className = "" }) => {
  return (
    <Box className={`cm-filter-shell cm-premium-filters ${className}`.trim()}>
      <Box className="cm-filter-title-row">
        <Box className="cm-filter-title">
          <FilterListIcon fontSize="small" />
          {title}
        </Box>
        <Box className="cm-filter-actions">{actions}</Box>
      </Box>
      {children}
    </Box>
  );
};
