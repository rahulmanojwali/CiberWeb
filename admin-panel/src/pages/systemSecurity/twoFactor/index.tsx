import React from "react";
import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { PageContainer } from "../../../components/PageContainer";
import { useSnackbar } from "notistack-compat";
import { getStepUpSetup } from "../../../services/adminUsersApi";

export const TwoFactorSettings: React.FC = () => {
  const { enqueueSnackbar } = useSnackbar();

  const handleSetup = async () => {
    try {
      const username = localStorage.getItem("cd_user");
      const parsed = username ? JSON.parse(username) : {};
      const currentUsername = parsed?.username || "";
      if (!currentUsername) {
        enqueueSnackbar("Unable to resolve current username.", { variant: "error" });
        return;
      }
      const resp = await getStepUpSetup({
        username: currentUsername,
        target_username: currentUsername,
      });
      if (resp?.response?.responsecode === "0") {
        enqueueSnackbar("Step-up setup initiated (backend response available).", { variant: "success" });
      } else {
        enqueueSnackbar(
          resp?.response?.description || "Backend getSetup not available yet",
          { variant: "warning" }
        );
      }
    } catch (err: any) {
      enqueueSnackbar(err?.message || "Backend getSetup not available yet", { variant: "warning" });
    }
  };

  return (
    <PageContainer>
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Typography variant="h5">Two-Factor Authentication (2FA)</Typography>
            <Typography>
              2FA is mandatory for your role. Setup will be enabled here.
            </Typography>
            <Box>
              <Button variant="contained" onClick={handleSetup}>
                Start Setup
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>
    </PageContainer>
  );
};
