import React from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import { Button } from "@mui/material";

const StepUpPoliciesPage: React.FC = () => {
  return (
    <Box sx={{ pb: 4 }}>
      <Stack spacing={2}>
        <Typography variant="h4" component="h1">
          Step-up Policies
        </Typography>
        <Typography variant="body1" color="text.secondary">
          This screen will show the system-wide step-up authentication policies that
          require two-factor verification before sensitive actions. The backend
          configuration is read-only for now, and a full editor will be available
          soon.
        </Typography>
        <Paper variant="outlined" sx={{ p: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Sample policy snapshot (read-only)
          </Typography>
          <Box component="pre" sx={{ bgcolor: "background.paper", p: 2, borderRadius: 1 }}>
{`rule_key: ADMIN_SENSITIVE_DEFAULTS
is_active: Y
priority: 1
subject_types: ['ADMIN']
match.type: RESOURCE_KEY_PREFIX
match.values: ['admin_users.', 'resource_registry.', 'organisations.']
require_stepup: Y`}
          </Box>
          <Typography variant="body2" sx={{ mt: 2 }}>
            Additional policies will be loaded from the server once the rules API is
            connected.
          </Typography>
        </Paper>
        <Box sx={{ mt: 2 }}>
          <Button variant="contained" disabled>
            Refresh policies
          </Button>
        </Box>
      </Stack>
    </Box>
  );
};

export default StepUpPoliciesPage;
