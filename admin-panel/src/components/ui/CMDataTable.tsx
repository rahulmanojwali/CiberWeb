import Box from "@mui/material/Box";
import type { FC } from "react";
import { ResponsiveDataGrid } from "../ResponsiveDataGrid";
import { CMEmptyState } from "./CMEmptyState";

type CMDataTableProps = {
  rows: any[];
  columns: any[];
  loading?: boolean;
  getRowId?: (row: any) => string;
  minWidth?: number;
  emptyTitle?: string;
  emptySubtitle?: string;
  [key: string]: any;
};

export const CMDataTable: FC<CMDataTableProps> = ({
  rows,
  columns,
  loading = false,
  getRowId,
  minWidth = 960,
  emptyTitle,
  emptySubtitle,
  ...props
}) => {
  const hasRows = Array.isArray(rows) && rows.length > 0;
  return (
    <Box className="cm-card cm-table-card">
      <Box className="cm-table-wrap">
        <ResponsiveDataGrid
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={getRowId}
          minWidth={minWidth}
          disableRowSelectionOnClick
          slots={{ noRowsOverlay: () => null, noResultsOverlay: () => null }}
          sx={{
            "& .MuiDataGrid-virtualScroller": {
              minHeight: hasRows ? 160 : 56,
            },
            "& .MuiDataGrid-main": {
              minHeight: hasRows ? undefined : 96,
            },
          }}
          {...props}
        />
      </Box>
      {!loading && !hasRows ? <CMEmptyState title={emptyTitle} subtitle={emptySubtitle} /> : null}
    </Box>
  );
};
