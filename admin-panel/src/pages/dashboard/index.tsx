import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
} from "@mui/material";
import { useEffect, useMemo, useState } from "react";
import { PageContainer } from "../../components/PageContainer";
import { getDashboardSummary } from "../../services/dashboardApi";
import { getCurrentAdminUsername } from "../../utils/session";
import { useAdminUiConfig } from "../../contexts/admin-ui-config";
import { can } from "../../utils/adminUiConfig";
import { useTranslation } from "react-i18next";
import { Link as RouterLink } from "react-router-dom";

const defaultPayload = {
  scope: { org_id: null, mandi_ids: [] },
  date_range: {
    from_date: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    to_date: new Date().toISOString(),
  },
};

export const Dashboard: React.FC = () => {
  const { i18n } = useTranslation();
  const language = i18n.language || "en";
  const uiConfig = useAdminUiConfig();
  const canView = useMemo(() => can(uiConfig.resources, "dashboard.view", "VIEW"), [uiConfig.resources]);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchSummary = async () => {
    const username = getCurrentAdminUsername();
    if (!username || !canView) return;
    setLoading(true);
    try {
      const resp = await getDashboardSummary({
        username,
        language,
        payload: defaultPayload,
      });
      setSummary(resp?.data || null);
    } catch (error) {
      console.error("Dashboard load error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [language, canView]);

  const cards = summary?.cards ?? {};
  const charts = summary?.charts ?? {};
  const ticker = summary?.ticker ?? [];
  const alerts = summary?.alerts ?? [];
  const quickLinks = summary?.quickLinks ?? [];

  const renderCard = (title: string, content: any) => (
    <Card sx={{ flex: "1 1 230px", minWidth: 230, bgcolor: "#f4fbf6" }} key={title}>
      <CardContent>
        <Typography variant="subtitle2" color="text.secondary">
          {title}
        </Typography>
        <Typography variant="h6">{content.primary}</Typography>
        <Typography variant="body2" sx={{ mt: 1 }}>
          {content.secondary}
        </Typography>
      </CardContent>
    </Card>
  );

  return (
    <PageContainer>
      <Stack spacing={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Typography variant="h5">CiberMandi Command Center</Typography>
          <Button variant="contained" color="secondary" onClick={fetchSummary} disabled={!canView}>
            Refresh
          </Button>
        </Stack>

        {loading && (
          <Stack alignItems="center">
            <CircularProgress />
          </Stack>
        )}

        {!loading && (
          <>
            <Box
              sx={{
                display: "flex",
                overflowX: "auto",
                gap: 2,
                bgcolor: "#1b6b3d",
                color: "#fff",
                p: 1,
                borderRadius: 2,
              }}
            >
              {ticker.map((item: any) => (
                <Box key={`${item.commodity_id}-${item.mandi_id}`} sx={{ minWidth: 200 }}>
                  <Typography variant="subtitle2">
                    {item.commodity_name} ({item.mandi_name})
                  </Typography>
                  <Typography variant="h6">{item.last_price}</Typography>
                  <Chip
                    label={`${item.change_percent.toFixed(2)}%`}
                    size="small"
                    sx={{
                      bgcolor: item.change_percent >= 0 ? "#2fa652" : "#d32f2f",
                      color: "#fff",
                    }}
                  />
                </Box>
              ))}
            </Box>

            <Stack direction={{ xs: "column", md: "row" }} spacing={2}>
              {[
                {
                  title: "Today's Trade Value",
                  content: {
                    primary: `${cards.todayTradeValue?.total_amount?.toLocaleString("en-IN") || "—"} ${cards.todayTradeValue?.currency || "INR"}`,
                    secondary: `Lots: ${cards.todayTradeValue?.lots_count || 0} | Price vs MSP: ${cards.todayTradeValue?.price_vs_msp_percent?.toFixed(2)}%`
                  }
                },
                {
                  title: "Live Auctions",
                  content: {
                    primary: `${cards.liveAuctions?.count || 0} auctions`,
                    secondary: `Mandis: ${cards.liveAuctions?.mandis_count || 0}`
                  }
                },
                {
                  title: "Settlements",
                  content: {
                    primary: `Outstanding: ${cards.settlements?.total_outstanding?.toLocaleString("en-IN") || 0}`,
                    secondary: `Overdue: ${cards.settlements?.total_overdue?.toLocaleString("en-IN") || 0}`
                  }
                },
                {
                  title: "Subscriptions",
                  content: {
                    primary: `MRR ₹${cards.subscriptions?.mrr?.toLocaleString("en-IN") || 0}`,
                    secondary: `ARR ₹${cards.subscriptions?.arr?.toLocaleString("en-IN") || 0}`
                  }
                },
              ].map(renderCard)}
            </Stack>

            <Grid container spacing={2}>
              <Grid item xs={12} md={7}>
                <Card sx={{ minHeight: 320 }}>
                  <CardContent>
                    <Typography variant="subtitle1">Mandi Price Heatmap</Typography>
                    <Grid container spacing={1} sx={{ mt: 1 }}>
                      {charts.mandiPriceHeatmap?.cells?.slice(0, 12).map((cell: any, idx: number) => (
                        <Grid item xs={4} key={`${cell.commodity_id}-${cell.mandi_id}-${idx}`}>
                          <Box
                            sx={{
                              p: 1,
                              bgcolor: "#e8f5e9",
                              borderRadius: 1,
                              textAlign: "center",
                            }}
                          >
                            <Typography variant="caption">
                              {cell.commodity_id}/{cell.mandi_id}
                            </Typography>
                            <Typography variant="body2">{cell.price}</Typography>
                            <Typography
                              variant="caption"
                              sx={{ color: cell.diff_percent >= 0 ? "#2fa652" : "#d32f2f" }}
                            >
                              {cell.diff_percent}%
                            </Typography>
                          </Box>
                        </Grid>
                      ))}
                    </Grid>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={5}>
                <Card sx={{ minHeight: 320 }}>
                  <CardContent>
                    <Typography variant="subtitle1">Auctions by Commodity</Typography>
                    <Stack spacing={1} mt={1}>
                      {(charts.auctionByCommodity || []).slice(0, 5).map((item: any) => (
                        <Stack key={item.commodity_id} direction="row" justifyContent="space-between">
                          <Typography variant="body2">{item.commodity_name}</Typography>
                          <Typography variant="body2">{item.auctions} auctions</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1">Trade by Day</Typography>
                    <Stack spacing={1} mt={1}>
                      {(charts.tradeByDay || []).slice(-7).map((entry: any) => (
                        <Stack key={entry.date} direction="row" justifyContent="space-between">
                          <Typography variant="caption">{entry.date}</Typography>
                          <Typography variant="body2">{entry.amount?.toLocaleString("en-IN")}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1">Gate Traffic by Hour</Typography>
                    <Stack spacing={1} mt={1}>
                      {(charts.gateTrafficByHour || []).map((entry: any) => (
                        <Stack key={entry.hour} direction="row" justifyContent="space-between">
                          <Typography variant="caption">{entry.hour}:00</Typography>
                          <Typography variant="body2">{entry.vehicles} vehicles</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1">Alerts</Typography>
                    <Stack spacing={1} mt={1}>
                      {alerts.length
                        ? alerts.map((alert: any) => (
                            <Box key={alert.message} sx={{ p: 1, bgcolor: "#fff" }}>
                              <Chip
                                label={alert.severity}
                                size="small"
                                sx={{
                                  bgcolor: alert.severity === "HIGH" ? "#d32f2f" : "#ffc107",
                                  color: "#fff",
                                  mr: 1,
                                }}
                              />
                              <Typography variant="body2">{alert.message}</Typography>
                            </Box>
                          ))
                        : "No alerts."}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} md={6}>
                <Card>
                  <CardContent>
                    <Typography variant="subtitle1">Quick Actions</Typography>
                    <Stack spacing={1} mt={1}>
                      {quickLinks.map((link: any) => (
                        <Button
                          key={link.label}
                          variant="outlined"
                          component={RouterLink}
                          to={link.target_route}
                        >
                          {link.label}
                        </Button>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          </>
        )}
      </Stack>
    </PageContainer>
  );
};
