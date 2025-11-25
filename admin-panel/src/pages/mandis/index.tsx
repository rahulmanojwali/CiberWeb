import { Button, Stack, Typography } from "@mui/material";
import { PageContainer } from "../../components/PageContainer";

export const Mandis: React.FC = () => {
  return (
    <PageContainer>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
      >
        <Typography variant="h5">Mandis</Typography>
        <Button variant="contained" size="small">
          Add Mandi
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Mandi list + create/edit (linked to orgs) will be added here.
      </Typography>
    </PageContainer>
  );
};
