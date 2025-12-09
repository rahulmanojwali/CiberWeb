import React, { useEffect, useState } from "react";
import { Box, Typography, Divider, Paper, CircularProgress, Stack } from "@mui/material";
import { fetchRolePoliciesDashboardData } from "../../services/rolePoliciesApi";
//helpafasfasdfasdfd
const RolesPermissionsPage: React.FC = () => {
  const rawUser = typeof window !== "undefined" ? localStorage.getItem("cd_user") : null;
  const parsedUser = rawUser ? JSON.parse(rawUser) : null;
  const username: string = parsedUser?.username || "";

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await fetchRolePoliciesDashboardData({ username: username || "" });
        setData(resp?.data || resp);
        setLoading(false);
        if (resp?.response?.responsecode !== "0") {
          setError(resp?.response?.description || "Failed to load role policies");
        }
      } catch (err: any) {
        setLoading(false);
        setError(err?.message || "Failed to load role policies");
      }
    };
    if (username) load();
  }, [username]);

  if (!username) {
    return React.createElement(Typography, null, "Please log in.");
  }

  if (loading) {
    return React.createElement(
      Box,
      { sx: { display: "flex", alignItems: "center", gap: 1 } },
      React.createElement(CircularProgress, { size: 20 }),
      React.createElement(Typography, null, "Loading...")
    );
  }

  return React.createElement(
    Stack,
    { spacing: 2 },
    React.createElement(Typography, { variant: "h5" }, "Roles & Permissions (Debug View)"),
    error
      ? React.createElement(
          Paper,
          { sx: { p: 2, bgcolor: "error.light" } },
          React.createElement(Typography, { color: "error" }, error)
        )
      : null,
    React.createElement(
      Paper,
      { sx: { p: 2 } },
      React.createElement(Typography, { variant: "subtitle1" }, "Roles"),
      React.createElement(Divider, { sx: { my: 1 } }),
      React.createElement(
        "pre",
        { style: { whiteSpace: "pre-wrap", margin: 0 } },
        JSON.stringify(data?.roles || [], null, 2)
      )
    ),
    React.createElement(
      Paper,
      { sx: { p: 2 } },
      React.createElement(Typography, { variant: "subtitle1" }, "Resources"),
      React.createElement(Divider, { sx: { my: 1 } }),
      React.createElement(
        "pre",
        { style: { whiteSpace: "pre-wrap", margin: 0 } },
        JSON.stringify(data?.resources || [], null, 2)
      )
    ),
    React.createElement(
      Paper,
      { sx: { p: 2 } },
      React.createElement(Typography, { variant: "subtitle1" }, "Policies By Role"),
      React.createElement(Divider, { sx: { my: 1 } }),
      React.createElement(
        "pre",
        { style: { whiteSpace: "pre-wrap", margin: 0 } },
        JSON.stringify(data?.policiesByRole || {}, null, 2)
      )
    )
  );
};

export default RolesPermissionsPage;
