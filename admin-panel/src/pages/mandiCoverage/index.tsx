import { Stack, Typography } from "@mui/material";
import { PageContainer } from "../../components/PageContainer";

export const MandiCoverage: React.FC = () => {
  return (
    <PageContainer>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
      >
        <Typography variant="h5">Mandi Coverage</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Coverage viewer (getMandiCoverage) will be shown here.
      </Typography>
    </PageContainer>
  );
};
