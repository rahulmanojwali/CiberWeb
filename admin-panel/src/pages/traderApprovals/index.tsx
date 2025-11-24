import { Box, Stack, Typography } from "@mui/material";

export const TraderApprovals: React.FC = () => {
  return (
    <Box p={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Trader Approvals</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Approvals list from cm_users will appear here.
      </Typography>
    </Box>
  );
};
