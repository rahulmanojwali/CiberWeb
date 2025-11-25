import { Stack, Typography } from "@mui/material";
import { PageContainer } from "../../components/PageContainer";

export const TraderApprovals: React.FC = () => {
  return (
    <PageContainer>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
      >
        <Typography variant="h5">Trader Approvals</Typography>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Approvals list from cm_users will appear here.
      </Typography>
    </PageContainer>
  );
};
