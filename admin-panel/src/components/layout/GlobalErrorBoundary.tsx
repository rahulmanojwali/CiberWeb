import React from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";

interface GlobalErrorBoundaryState {
  hasError: boolean;
}

export class GlobalErrorBoundary extends React.Component<React.PropsWithChildren, GlobalErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): GlobalErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[GlobalErrorBoundary]", error);
  }

  private goLogin = () => {
    if (typeof window !== "undefined") {
      window.location.assign("/admin/login");
    }
  };

  private refreshPage = () => {
    if (typeof window !== "undefined") {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            px: 2,
            textAlign: "center",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <Typography variant="h6">Something went wrong while loading this page.</Typography>
          <Typography variant="body1">Please refresh or sign in again.</Typography>
          <Box sx={{ display: "flex", gap: 1.5 }}>
            <Button variant="outlined" onClick={this.refreshPage}>Refresh</Button>
            <Button variant="contained" onClick={this.goLogin}>Sign In</Button>
          </Box>
        </Box>
      );
    }

    return this.props.children;
  }
}

export default GlobalErrorBoundary;
