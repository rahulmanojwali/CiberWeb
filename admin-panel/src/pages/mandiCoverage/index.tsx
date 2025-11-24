import { Box, Stack, Typography } from "@mui/material";

export const MandiCoverage: React.FC = () => {
  return (
    <Box p={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Mandi Coverage</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Coverage viewer (getMandiCoverage) will be shown here.
      </Typography>
    </Box>
  );
};
