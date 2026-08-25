import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  Stack,
  Typography,
  Tabs,
  Tab,
  useMediaQuery,
  useTheme,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from "@mui/material";
import PsychologyIcon from "@mui/icons-material/Psychology";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  Legend,
} from "recharts";
import api from "../../api/axios";

export default function AISupport() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [mainTab, setMainTab] = useState("recommendations");

  const [recommendations, setRecommendations] = useState([]);
  const [forecastData, setForecastData] = useState([]);
  const [selectedGroupValue, setSelectedGroupValue] = useState("global");

  const [loading, setLoading] = useState(true);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [statusFilter, setStatusFilter] = useState("pending");
  const [selectedKpiId, setSelectedKpiId] = useState("");

  const [confirmDialog, setConfirmDialog] = useState({
    open: false,
    recommendationId: null,
    status: "",
  });

  const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

  const hasPermission = (code) => {
    if (storedUser?.role === "administrator") return true;

    return storedUser?.app_permissions?.some(
      (permission) => permission.code === code
    );
  };


  const canViewRecommendations = hasPermission("view_ai_recommendations");
  const canReviewRecommendations = hasPermission("review_ai_recommendations");
  const canViewForecasting = hasPermission("view_ai_forecasting");

  const openConfirmDialog = (id, status) => {
    setConfirmDialog({
      open: true,
      recommendationId: id,
      status,
    });
    setTimeout(() =>{
      setConfirmDialog({
        open: true,
        recommendationId: id,
        status,
      });
    }, 50);
  };

  const closeConfirmDialog = () => {
    setConfirmDialog((prev) => ({
      ...prev,
      open: false,
    }));

    setTimeout(() => {
      setConfirmDialog({
        open: false,
        recommendationId: null,
        status: null,
      });
    }, 200);
  };

  const confirmReviewRecommendation = async () => {
    await reviewRecommendation(
      confirmDialog.recommendationId,
      confirmDialog.status
    );

    closeConfirmDialog();
  };

  const fetchRecommendations = async () => {
    try {
      const res = await api.get("ai-support/recommendations/");
      setRecommendations(res.data || []);
    } catch {
      setError("Failed to load recommendations.");
    }
  };

  const fetchForecasting = async () => {
    setForecastLoading(true);
    try {
      const res = await api.get("ai-support/forecasting/");
      const data = res.data || [];
      setForecastData(data);

      if (data.length > 0 && !selectedKpiId) {
        setSelectedKpiId(data[0].kpi_id);
      }
    } catch {
      setError("Failed to load forecasting data.");
    } finally {
      setForecastLoading(false);
    }
  };

  const analyzeAllKpis = async () => {
    setAnalyzing(true);
    setError("");
    setSuccess("");

    try {
      await api.post("ai-support/analyze/");

      setStatusFilter("pending");

      setSuccess(
        "AI recommendation generation started in background."
      );

      // Wait a few seconds then refresh saved recommendations
      setTimeout(async () => {
        await fetchRecommendations();
      }, 4000);

    } catch (err) {
      setError(
        err.response?.data?.error || "AI analysis failed."
      );
    } finally {
      setAnalyzing(false);
    }
  };

  const reviewRecommendation = async (id, status) => {
    try {
      await api.patch(`ai-support/recommendations/${id}/review/`, { status });
      await fetchRecommendations();
      setStatusFilter(status);
    } catch {
      setError("Failed to update recommendation status.");
    }
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      if (canViewRecommendations) {
        await fetchRecommendations();
      }

      if (canViewForecasting) {
        await fetchForecasting();
      }

      setLoading(false);
    };

    load();
  }, [canViewRecommendations, canViewForecasting]);

  const pendingRecommendations = useMemo(
    () => recommendations.filter((rec) => rec.status === "pending"),
    [recommendations]
  );

  const summary = useMemo(() => {
    return {
      total: pendingRecommendations.length,
      low: pendingRecommendations.filter((r) => r.risk_level === "low").length,
      high: pendingRecommendations.filter((r) => r.risk_level === "high").length,
      medium: pendingRecommendations.filter((r) => r.risk_level === "medium").length,
    };
  }, [pendingRecommendations]);

  const filteredRecommendations = useMemo(() => {
    return recommendations.filter((rec) => rec.status === statusFilter);
  }, [recommendations, statusFilter]);

  const topRisks = useMemo(() => {
    const riskScore = { high: 3, medium: 2, low: 1 };

    return [...pendingRecommendations]
      .sort((a, b) => {
        const riskDiff =
          (riskScore[b.risk_level] || 0) - (riskScore[a.risk_level] || 0);

        if (riskDiff !== 0) return riskDiff;

        return (b.confidence || 0) - (a.confidence || 0);
      })
      .slice(0, 3);
  }, [pendingRecommendations]);

  const selectedForecast = useMemo(() => {
    return forecastData.find((item) => item.kpi_id === selectedKpiId);
  }, [forecastData, selectedKpiId]);

  useEffect(() => {
    console.log("Forecast data:", forecastData);
    console.log("Selected KPI ID:", selectedKpiId);
    console.log("Selected forecast:", selectedForecast);
  }, [forecastData, selectedKpiId, selectedForecast]);

  useEffect(() => {
    if (
      !canViewRecommendations &&
      canViewForecasting
    ) {
      setMainTab("forecasting");
    }
  }, [canViewRecommendations, canViewForecasting]);


  const selectedGroup = useMemo(() => {
    if (!selectedForecast || selectedGroupValue === "global") return null;

    return selectedForecast.groups?.find(
      (g) => g.group_by_value === selectedGroupValue
    );
  }, [selectedForecast, selectedGroupValue]);

  const chartData = useMemo(() => {
    if (!selectedForecast) return [];

    const source =
      selectedGroupValue === "global"
        ? selectedForecast
        : selectedGroup;

    if (!source) return [];

    const actual = (source.actual || []).map((item) => ({
      month: item.month,
      actual: item.value,
      forecast: null,
    }));

    const forecast = (source.forecast || []).map((item) => ({
      month: item.month,
      actual: null,
      forecast: item.value,
    }));

    return [...actual, ...forecast];
  }, [selectedForecast, selectedGroup, selectedGroupValue]);

  return (
    <Box>
      <Box
        mb={3}
        display="flex"
        justifyContent="space-between"
        alignItems={{ xs: "stretch", md: "flex-start" }}
        gap={2}
        flexDirection={{ xs: "column", md: "row" }}
      >
        <Box>
          <Typography variant="h4" fontWeight="bold">
            AI Insights
          </Typography>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Tabs
        value={mainTab}
        onChange={(event, newValue) => setMainTab(newValue)}
        sx={{ mb: 3 }}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
      >
        {canViewRecommendations && (
          <Tab
            label="Decision Recommendations"
            value="recommendations"
          />
        )}

        {canViewForecasting && (
          <Tab
            label="Forecasting"
            value="forecasting"
          />
        )}
      </Tabs>

      {canViewRecommendations &&
        mainTab === "recommendations" && (
        <>
          <Grid container spacing={3} mb={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary">Pending Recommendations</Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {summary.total}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary">Low Risk</Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {summary.low}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary">High Risk</Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {summary.high}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary">Medium Risk</Typography>
                  <Typography variant="h4" fontWeight="bold">
                    {summary.medium}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                Top Risks Summary
              </Typography>

              {topRisks.length === 0 ? (
                <Alert severity="info">
                  No pending top risks available. Run the AI analysis first.
                </Alert>
              ) : (
                <Stack spacing={2}>
                  {topRisks.map((risk, index) => (
                    <Box
                      key={risk.id}
                      p={2}
                      border="1px solid #e0e0e0"
                      borderRadius={2}
                    >
                      <Box display="flex" gap={1} alignItems="center" flexWrap="wrap">
                        <Chip label={`#${index + 1}`} color="primary" size="small" />

                        <Chip
                          label={risk.risk_level}
                          color={
                            risk.risk_level === "high"
                              ? "error"
                              : risk.risk_level === "medium"
                              ? "warning"
                              : "success"
                          }
                          size="small"
                        />

                        <Typography fontWeight="bold">{risk.kpi_name}</Typography>
                      </Box>

                      <Typography color="text.secondary" mt={1}>
                        {risk.insight}
                      </Typography>

                      <Typography mt={1}>
                        <strong>Recommended decision:</strong>{" "}
                        {risk.suggested_decision}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                Recommendations
              </Typography>

              <Tabs
                value={statusFilter}
                onChange={(event, newValue) => setStatusFilter(newValue)}
                sx={{ mb: 2 }}
                variant="scrollable"
                scrollButtons="auto"
                allowScrollButtonsMobile
              >
                <Tab label="Pending" value="pending" />
                <Tab label="Accepted Decisions" value="accepted" />
                <Tab label="Rejected" value="rejected" />
              </Tabs>

              {filteredRecommendations.length === 0 ? (
                <Alert severity="info">
                  No recommendations found for this status.
                </Alert>
              ) : (
                <Stack spacing={2}>
                  {filteredRecommendations.map((rec) => (
                    <Card key={rec.id} variant="outlined">
                      <CardContent>
                        <Typography variant="h6" fontWeight="bold">
                          {rec.kpi_name}
                        </Typography>

                        <Typography color="text.secondary" mb={1}>
                          {rec.module_name}
                        </Typography>

                        <Box display="flex" gap={1} flexWrap="wrap">
                          <Chip
                            label={`Risk: ${rec.risk_level}`}
                            color={
                              rec.risk_level === "low"
                                ? "success"
                                : rec.risk_level === "high"
                                ? "error"
                                : "warning"
                            }
                            size="small"
                          />

                          <Chip label={`Status: ${rec.status}`} size="small" />
                          <Chip
                            label={`Confidence: ${Math.round((rec.confidence || 0) * 100)}%`}
                            color="info"
                            size="small"
                          />  
                        </Box>

                        <Box mt={2}>
                          <Typography fontWeight="bold">Insight</Typography>
                          <Typography color="text.secondary">{rec.insight}</Typography>
                        </Box>

                        <Box mt={2}>
                          <Typography fontWeight="bold">Cause</Typography>
                          <Typography color="text.secondary">
                            {rec.probable_cause || "No cause provided."}
                          </Typography>
                        </Box>

                        <Box mt={2}>
                          <Typography fontWeight="bold">Suggested Decision</Typography>
                          <Typography color="text.secondary">
                            {rec.suggested_decision}
                          </Typography>
                        </Box>

                        {canReviewRecommendations &&
                          rec.status === "pending" && (
                          <Box
                            mt={2}
                            display="flex"
                            gap={1}
                            flexDirection={{ xs: "column", sm: "row" }}
                          >
                            <Button
                              variant="contained"
                              color="success"
                              onClick={() => openConfirmDialog(rec.id, "accepted")}
                              fullWidth={isMobile}
                            >
                              Accept
                            </Button>

                            <Button
                              variant="outlined"
                              color="error"
                              onClick={() => openConfirmDialog(rec.id, "rejected")}
                              fullWidth={isMobile}
                            >
                              Reject
                            </Button>
                            <Dialog
                              open={confirmDialog.open}
                              onClose={closeConfirmDialog}
                              keepMounted={false}
                              BackdropProps={{
                                sx: {
                                  backgroundColor: "transparent",
                                  backdropFilter: "blur(1px)",
                                },
                              }}
                              PaperProps={{
                                sx: {
                                  boxShadow: "none",
                                  border: "1px solid #e0e0e0",
                                  borderRadius: 2,
                                }
                              }}
                            >
                              <DialogTitle>
                                Confirm action
                              </DialogTitle>

                              <DialogContent>
                                <Typography>
                                  Are you sure you want to{" "}
                                  {confirmDialog.status === "accepted" 
                                    ? "accept" 
                                    : confirmDialog.status === "rejected"
                                    ? "reject"
                                    : ""
                                    } this recommendation?
                                </Typography>
                              </DialogContent>

                              <DialogActions>
                                <Button onClick={closeConfirmDialog}>
                                  Cancel
                                </Button>

                                <Button
                                  variant="contained"
                                  color={confirmDialog.status === "accepted" 
                                    ? "success" 
                                    : "error"
                                  }
                                  onClick={confirmReviewRecommendation}
                                  disabled={!confirmDialog.status}
                                >
                                  Yes, {confirmDialog.status === "accepted" ? "accept" : "reject"}
                                </Button>
                              </DialogActions>
                            </Dialog>
                                                      </Box>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {canViewForecasting &&
        mainTab === "forecasting" && (
        <Card>
          <CardContent>
            <Box
              display="flex"
              justifyContent="space-between"
              alignItems={{ xs: "stretch", md: "center" }}
              gap={2}
              flexDirection={{ xs: "column", md: "row" }}
              mb={3}
            >
              <Box>
                <Typography variant="h6" fontWeight="bold">
                  KPI Forecasting
                </Typography>
              </Box>
            </Box>

            {forecastLoading ? (
              <Box display="flex" justifyContent="center" mt={4}>
                <CircularProgress />
              </Box>
            ) : forecastData.length === 0 ? (
              <Alert severity="info">
                No forecasting data available yet.
              </Alert>
            ) : (
              <>
                <TextField
                  select
                  fullWidth
                  label="Select KPI"
                  value={selectedKpiId}
                  onChange={(e) => {
                    setSelectedKpiId(Number(e.target.value));
                    setSelectedGroupValue("global");
                  }}
                  sx={{ mb: 3 }}
                >
                  {forecastData.map((item) => (
                    <MenuItem key={item.kpi_id} value={item.kpi_id}>
                      {item.kpi_name}
                      {item.module_name ? ` — ${item.module_name}` : ""}
                    </MenuItem>
                  ))}
                </TextField>
                {selectedForecast?.groups?.length > 0 && (
                  <TextField
                    select
                    fullWidth
                    label="View Forecast"
                    value={selectedGroupValue}
                    onChange={(e) => {
                      setSelectedGroupValue(e.target.value);
                    }}
                    sx={{ mb: 3 }}
                  >
                    <MenuItem value="global">Global KPI Forecast</MenuItem>

                    {selectedForecast.groups.map((group) => (
                      <MenuItem
                        key={group.group_by_value}
                        value={group.group_by_value}
                      >
                        {group.group_by_field}: {group.group_by_value}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                {!selectedForecast ? (
                  <Alert severity="info">Select a KPI to display its forecast.</Alert>
                ) : (
                  <>
                    {selectedForecast.forecast.length === 0 && (
                      <Alert severity="info" sx={{ mb: 2 }}>
                        Forecast may be limited because this KPI has little historical data.
                      </Alert>
                    )}
                                    
                    <Box width="100%" height={360}>
                      <ResponsiveContainer>
                        <LineChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line
                            type="monotone"
                            dataKey="actual"
                            name="Actual"
                            strokeWidth={3}
                            connectNulls
                          />
                          <Line
                            type="monotone"
                            dataKey="forecast"
                            name="Forecast"
                            strokeWidth={3}
                            strokeDasharray="5 5"
                            connectNulls
                          />
                        </LineChart>
                      </ResponsiveContainer>
                    </Box>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}