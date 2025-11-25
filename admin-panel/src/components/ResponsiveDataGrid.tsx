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
    <Box sx={{ width: "100%", overflowX: "auto" }}>
      <Box sx={{ minWidth }}>
        <DataGrid
          autoHeight={autoHeight}
          density={density}
          sx={{
            border: 0,
            "& .MuiDataGrid-columnHeaders": {
              backgroundColor: "rgba(47, 166, 82, 0.08)",
              borderRadius: 0,
            },
            "& .MuiDataGrid-cell": {
              borderBottom: "1px solid rgba(0,0,0,0.05)",
            },
            "& .MuiDataGrid-virtualScroller": {
              minHeight: 240,
            },
            ...sx,
          }}
          {...rest}
        />
      </Box>
    </Box>
  );
};
