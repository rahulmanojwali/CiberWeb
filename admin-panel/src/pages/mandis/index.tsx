import { Button, Stack, Typography } from "@mui/material";
import { PageContainer } from "../../components/PageContainer";
import { getUserScope, isReadOnlyRole, isSuperAdmin, isOrgAdmin, isMandiRole } from "../../utils/userScope";

export const Mandis: React.FC = () => {
  const scope = getUserScope("MandisPage");
  const role = scope.role;
  const canCreate =
    isSuperAdmin(role) ||
    (isOrgAdmin(role) && !!scope.orgCode) ||
    isMandiRole(role);
  const isReadOnly = isReadOnlyRole(role);

  return (
    <PageContainer>
      <Stack
        direction={{ xs: "column", md: "row" }}
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", md: "center" }}
        spacing={2}
      >
        <Typography variant="h5">Mandis</Typography>
        <Button variant="contained" size="small" disabled={!canCreate || isReadOnly}>
          Add Mandi
        </Button>
      </Stack>
      <Typography variant="body2" color="text.secondary">
        Mandi list + create/edit (linked to orgs) will be added here.
      </Typography>
    </PageContainer>
  );
};
