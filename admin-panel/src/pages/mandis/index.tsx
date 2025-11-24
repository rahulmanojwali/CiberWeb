import { Box, Button, Stack, Typography } from "@mui/material";

export const Mandis: React.FC = () => {
  return (
    <Box p={2}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h5">Mandis</Typography>
        <Button variant="contained" size="small">Add Mandi</Button>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Mandi list + create/edit (linked to orgs) will be added here.
      </Typography>
    </Box>
  );
};
