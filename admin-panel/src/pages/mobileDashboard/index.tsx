import { Alert, Box, Paper, Typography } from "@mui/material";

const MobileDashboardAdminPage = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
        Mobile Dashboard
      </Typography>
      <Typography sx={{ color: "text.secondary", mb: 2 }}>
        Manage mobile dashboard widgets for role-based app home screens.
      </Typography>
      <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
        <Alert severity="info">
          Backend API for managing cm_mobile_dashboard_widgets is not configured yet.
          This route is available so the System menu does not open a 404.
        </Alert>
      </Paper>
    </Box>
  );
};

export default MobileDashboardAdminPage;
