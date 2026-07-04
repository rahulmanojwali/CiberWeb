import React, { useMemo } from "react";
import {
  Alert,
  Box,
  Card,
  CardContent,
  Chip,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import AssignmentTurnedInOutlinedIcon from "@mui/icons-material/AssignmentTurnedInOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import PublishedWithChangesOutlinedIcon from "@mui/icons-material/PublishedWithChangesOutlined";
import { PageContainer } from "../../components/PageContainer";

function getStoredUser() {
  try {
    const raw = localStorage.getItem("cd_user");
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function normalizeRole(role?: string | null) {
  return String(role || "").trim().toUpperCase().replace(/[\s-]+/g, "_");
}

const DirectTradeApprovalsPage: React.FC = () => {
  const user = getStoredUser();
  const role = normalizeRole(
    user?.default_role_code || user?.role_slug || user?.role_code || user?.role,
  );

  const roleCopy = useMemo(() => {
    if (role === "PLATFORM_APPROVER") {
      return {
        title: "Final Approval Queue",
        description:
          "Review Level-1 verified Direct Trade listings and publish or reject them after final validation.",
        stage: "Level 2 Approval",
      };
    }
    if (role === "PLATFORM_SUPERVISOR" || role === "PLATFORM_OPERATIONS_MANAGER") {
      return {
        title: "Operations Approval Queue",
        description:
          "Monitor Direct Trade approvals, escalations, pending reviews, final approvals and rejected listings.",
        stage: "Operations Control",
      };
    }
    return {
      title: "Pending Review Queue",
      description:
        "Review newly submitted Direct Trade listings, check product/media/location details and mark them ready for final approval.",
      stage: "Level 1 Review",
    };
  }, [role]);

  return (
    <PageContainer
      title="Direct Trade Approvals"
      subtitle="CiberMandi internal review and approval workspace for Direct Trade listings."
    >
      <Stack spacing={2}>
        <Alert severity="info">
          You are signed in as <strong>{user?.username || "platform user"}</strong>. Your current role is{" "}
          <strong>{role || "PLATFORM"}</strong>. This page is now wired into the platform-role menu; the live approval grid will be connected in the next Direct Trade approval phase.
        </Alert>

        <Card>
          <CardContent>
            <Stack direction={{ xs: "column", md: "row" }} spacing={2} alignItems={{ md: "center" }} justifyContent="space-between">
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                  <AssignmentTurnedInOutlinedIcon color="primary" />
                  <Typography variant="h5" fontWeight={700}>{roleCopy.title}</Typography>
                </Stack>
                <Typography color="text.secondary">{roleCopy.description}</Typography>
              </Box>
              <Chip color="primary" label={roleCopy.stage} />
            </Stack>
          </CardContent>
        </Card>

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <FactCheckOutlinedIcon color="warning" />
                  <Typography variant="h6">Pending</Typography>
                </Stack>
                <Typography variant="h4" sx={{ mt: 2 }}>0</Typography>
                <Typography color="text.secondary">Listings waiting for your action.</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <PublishedWithChangesOutlinedIcon color="success" />
                  <Typography variant="h6">Approved Today</Typography>
                </Stack>
                <Typography variant="h4" sx={{ mt: 2 }}>0</Typography>
                <Typography color="text.secondary">Approved or moved to next level today.</Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={4}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Stack direction="row" spacing={1} alignItems="center">
                  <AssignmentTurnedInOutlinedIcon color="error" />
                  <Typography variant="h6">Needs Attention</Typography>
                </Stack>
                <Typography variant="h4" sx={{ mt: 2 }}>0</Typography>
                <Typography color="text.secondary">Rejected, escalated or change-requested listings.</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Stack>
    </PageContainer>
  );
};

export default DirectTradeApprovalsPage;
