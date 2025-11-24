// src/pages/reports/index.tsx

import React from "react";
import { Box, Card, CardContent, Stack, Typography } from "@mui/material";

export const Reports: React.FC = () => {
  const cards = [
    {
      title: "Organisation Summary",
      hint: "Active orgs, mandis per org, admin counts",
    },
    {
      title: "Trader & Volume Reports",
      hint: "Trades, lots, turnover by mandi / org",
    },
    {
      title: "Price & Market Trends",
      hint: "Daily/weekly mandi price analytics",
    },
  ];

  return (
    <Box p={2}>
      <Typography variant="h5" gutterBottom>
        Reports & Analytics
      </Typography>
      <Typography variant="body2" color="text.secondary" mb={2}>
        This section will host MIS / Analytics built from CiberMandi data.
        For now, these cards are placeholders. Later, plug them into your report
        APIs and charts.
      </Typography>

      <Stack direction="row" flexWrap="wrap" gap={2}>
        {cards.map((c) => (
          <Card key={c.title} sx={{ minWidth: 260, flex: "1 1 260px" }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                {c.title}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1 }}>
                {c.hint}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </Box>
  );
};
