import React, { useMemo } from "react";
import { Alert, Box, Card, CardContent, Divider, Stack, Typography } from "@mui/material";
import { PageContainer } from "../../components/PageContainer";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";

const Section: React.FC<{ title: string; subtitle: string }> = ({ title, subtitle }) => (
  <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
    <CardContent>
      <Stack spacing={1}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
        <Typography variant="body2" color="text.secondary">{subtitle}</Typography>
      </Stack>
    </CardContent>
  </Card>
);

export const AuctionPolicySettingsPage: React.FC = () => {
  const uiConfig = useAdminUiConfig();
  const canMenu = useMemo(
    () => can(uiConfig.resources, "auction_policy_settings.menu", "VIEW"),
    [uiConfig.resources],
  );
  const canView = useMemo(
    () => can(uiConfig.resources, "auction_policy_settings.view", "VIEW"),
    [uiConfig.resources],
  );

  if (!canMenu || !canView) {
    return (
      <PageContainer title="Auction Policy Settings">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Platform default + organisation-level auction rule configuration.
        </Typography>
        <Alert severity="warning">You do not have permission to view Auction Policy Settings.</Alert>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Auction Policy Settings">
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Platform default + organisation-level auction rule configuration.
        </Typography>
        <Alert severity="info">
          Read-only preview. Update APIs can be wired later without changing this route/menu integration.
        </Alert>
        <Divider />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: 2 }}>
          <Section title="Platform Default Policy" subtitle="Baseline policy inherited by all organisations and mandis unless overridden." />
          <Section title="Org Policy Override" subtitle="Organisation-level override over platform defaults." />
          <Section title="Lane Creation Policy" subtitle="Lane reuse, overflow lane creation, and one-lane-per-commodity controls." />
          <Section title="Auction Start Policy" subtitle="Start mode, product/lane window checks, queue/start rules, and lane live slot cap." />
          <Section title="Result / Unsold Policy" subtitle="Source-lot release statuses for UNSOLD / CANCELLED / WITHDRAWN outcomes." />
          <Section title="Auto Close Policy" subtitle="Lot auto-close and empty lane close behavior controls." />
        </Box>
      </Stack>
    </PageContainer>
  );
};

export default AuctionPolicySettingsPage;
