import Box from "@mui/material/Box";
import {
  DataGrid,
  type DataGridProps,
} from "@mui/x-data-grid";

type ResponsiveDataGridProps = DataGridProps & {
  minWidth?: number;
};

export const ResponsiveDataGrid: React.FC<ResponsiveDataGridProps> = ({
  minWidth = 720,
  sx,
  autoHeight = true,
  density = "standard",
  ...rest
}) => {
  return (
    <Box sx={{ width: "100%" }}>
      <DataGrid
        autoHeight={autoHeight}
        density={density}
        sx={{
          border: "1px solid var(--cm-border)",
          borderRadius: "var(--cm-radius-lg)",
          backgroundColor: "var(--cm-surface)",
          boxShadow: "var(--cm-shadow-sm)",
          overflow: "hidden",
          "& .MuiDataGrid-columnHeaders": {
            backgroundColor: "var(--cm-surface-muted)",
            color: "var(--cm-text-soft)",
            fontSize: 12,
            fontWeight: 800,
            borderBottom: "1px solid var(--cm-border)",
          },
          "& .MuiDataGrid-cell": {
            borderBottom: "1px solid #efe7dc",
            fontSize: 13,
            color: "var(--cm-text)",
          },
          "& .MuiDataGrid-row:hover": {
            backgroundColor: "#fbf7ef",
          },
          "& .MuiDataGrid-footerContainer": {
            borderTop: "1px solid var(--cm-border)",
            backgroundColor: "var(--cm-surface)",
          },
          "& .MuiDataGrid-toolbarContainer": {
            padding: "10px 12px",
          },
          "& .MuiDataGrid-virtualScroller": {
            minHeight: 240,
            backgroundColor: "var(--cm-surface)",
          },
          "& .MuiDataGrid-main": {
            overflowX: "auto",
          },
          minWidth,
          ...sx,
        }}
        {...rest}
      />
    </Box>
  );
};
