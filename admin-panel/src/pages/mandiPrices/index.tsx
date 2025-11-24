import { Box, Stack, Typography } from "@mui/material";

export const MandiPrices: React.FC = () => {
  return (
    <Box p={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Mandi Price Entry</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Minimal price entry for MANDI_ADMIN will be placed here.
      </Typography>
    </Box>
  );
};
