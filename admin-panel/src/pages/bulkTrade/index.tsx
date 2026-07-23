/**
 * ================================================================
 * Module      : Bulk Trade
 * Component   : Bulk Trade Monitoring
 * Author      : Rahul Wali
 * Created On  : 23-Jul-2026
 * Last Updated: 23-Jul-2026
 * Description : Independent Bulk Trade admin monitoring foundation.
 * It deliberately does not reuse Direct Trade approvals or orders.
 * ================================================================
 */
import React from "react";
import { Box, Card, CardContent, Chip, Grid, Stack, Typography } from "@mui/material";

const cards = [
  ["Open Requirements", "0", "PUBLISHED / OPEN"],
  ["Offers Under Review", "0", "UNDER_REVIEW"],
  ["Active Allocations", "0", "CONFIRMED"],
  ["Orders In Progress", "0", "IN_PROGRESS"],
];

export default function BulkTradePage() {
  return (
    <Box sx={{ p: { xs: 2, md: 3 } }}>
      <Stack spacing={0.5} sx={{ mb: 3 }}>
        <Typography variant="h4" fontWeight={700}>Bulk Trade</Typography>
        <Typography color="text.secondary">
          Requirement-driven, multi-supplier Bulk Trade monitoring. This module is independent from Direct Trade.
        </Typography>
      </Stack>
      <Grid container spacing={2}>
        {cards.map(([label, value, status]) => (
          <Grid item xs={12} sm={6} lg={3} key={label}>
            <Card variant="outlined"><CardContent>
              <Typography color="text.secondary" variant="body2">{label}</Typography>
              <Typography variant="h4" fontWeight={700} sx={{ my: 1 }}>{value}</Typography>
              <Chip size="small" label={status} color="success" variant="outlined" />
            </CardContent></Card>
          </Grid>
        ))}
      </Grid>
      <Card variant="outlined" sx={{ mt: 3 }}><CardContent>
        <Typography variant="h6" fontWeight={700}>Implementation boundary</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Requests, offers, negotiations, allocations and orders will be monitored here. Payments and settlements remain deferred until the unified financial phase.
        </Typography>
      </CardContent></Card>
    </Box>
  );
}
