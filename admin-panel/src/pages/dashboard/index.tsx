import { Card, CardContent, Stack, Typography } from "@mui/material";
import { PageContainer } from "../../components/PageContainer";

export const Dashboard: React.FC = () => {
  const cards = [
    { title: "Organisations", hint: "Manage orgs", value: "—" },
    { title: "Mandis", hint: "Manage mandis", value: "—" },
    { title: "Admin Users", hint: "Super/Org/Mandi admins", value: "—" },
    { title: "Trader Approvals", hint: "Approve traders", value: "—" },
  ];

  return (
    <PageContainer>
      <Typography variant="h5" gutterBottom>
        Super Admin Dashboard
      </Typography>
      <Stack
        direction={{ xs: "column", md: "row" }}
        flexWrap="wrap"
        gap={2}
      >
        {cards.map((c) => (
          <Card key={c.title} sx={{ flex: "1 1 220px", minWidth: 220 }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary">
                {c.title}
              </Typography>
              <Typography variant="h4" sx={{ my: 1 }}>
                {c.value}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {c.hint}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>
    </PageContainer>
  );
};
