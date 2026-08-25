import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useTheme,
  useMediaQuery,
  Tooltip as MuiTooltip,
} from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import { useEffect, useMemo, useRef, useState } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useParams } from "react-router-dom";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import api from "../../api/axios";

const filterOperatorOptions = [
  { value: "=", label: "Equals" },
  { value: "!=", label: "Not equals" },
  { value: "contains", label: "Contains" },
  { value: "starts_with", label: "Starts with" },
  { value: "ends_with", label: "Ends with" },
  { value: ">", label: ">" },
  { value: "<", label: "<" },
  { value: ">=", label: ">=" },
  { value: "<=", label: "<=" },
];

const emptyDashboardFilter = () => ({
  field: "",
  operator: "=",
  value: "",
  logic: "AND",
});

const getDefaultChartType = (kpi) => {
  if (!kpi?.group_by) return "line";
  return "column";
};

export default function ModuleDashboard() {
  const dashboardRef = useRef(null);
  const { id } = useParams();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const chartHeight = isMobile ? 300 : 430;
  const isDark = theme.palette.mode === "dark";

  const chartTextColor = isDark ? "#e2e8f0" : "#334155";

  const chartGridColor = isDark ? "#334155" : "#cbd5e1";

  const targetColor = isDark ? "#ff4d6d" : "#e11d48";

  const chartColors = isDark
    ? [
        "#1d4ed8", // deep blue
        "#2563eb", // royal blue
        "#3b82f6", // bright blue
        "#60a5fa", // sky blue
        "#38bdf8", // cyan blue
        "#0ea5e9", // azure
        "#6366f1", // indigo blue
        "#93c5fd", // soft light blue
      ]
    : [
        "#1e3a8a", // navy
        "#1d4ed8", // deep blue
        "#2563eb", // royal blue
        "#3b82f6", // bright blue
        "#0ea5e9", // cyan
        "#0284c7", // azure
        "#4f46e5", // indigo
        "#7dd3fc", // light sky
      ];
  const tooltipStyle = {
    backgroundColor: isDark ? "#0f172a" : "#ffffff",
    color: chartTextColor,
    border: `1px solid ${isDark ? "#334155" : "#e2e8f0"}`,
    borderRadius: 12,
    boxShadow: isDark
      ? "0 4px 20px rgba(0,0,0,0.45)"
      : "0 4px 20px rgba(15,23,42,0.08)",
  };

  const [module, setModule] = useState(null);
  const [kpis, setKpis] = useState([]);
  const [moduleFields, setModuleFields] = useState([]);
  const [filterValues, setFilterValues] = useState([]);
  const [filterValuesLoading, setFilterValuesLoading] = useState(false);
  const [visibleKpiIds, setVisibleKpiIds] = useState([]);
  const [kpiResults, setKpiResults] = useState({});
  const [kpiHistory, setKpiHistory] = useState({});
  const [dateLevels, setDateLevels] = useState({});
  const getDateLevel = (kpiId) => dateLevels[kpiId] || "month";
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");

  const dashboardStorageKey = `module_dashboard_filters_${currentUser.email || "guest"}_${id}`;
  const chartTypeStorageKey = `module_dashboard_chart_types_${currentUser.email || "guest"}_${id}`;

  const [chartTypes, setChartTypes] = useState(() => {
    const saved = localStorage.getItem(chartTypeStorageKey);

    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }

    return {};
  });

  const [loadingKpis, setLoadingKpis] = useState({});

  
  
  const [filterValuesByIndex, setFilterValuesByIndex] = useState({});
  const [filterValuesLoadingByIndex, setFilterValuesLoadingByIndex] = useState({});

  const [moduleLoading, setModuleLoading] = useState(true);
  const [kpiLoading, setKpiLoading] = useState(true);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [dashboardFilters, setDashboardFilters] = useState(() => {
    const saved = localStorage.getItem(dashboardStorageKey);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.dashboardFilters?.length
          ? parsed.dashboardFilters
          : [emptyDashboardFilter()];
      } catch {
        return [emptyDashboardFilter()];
      }
    }

    return [emptyDashboardFilter()];
  });

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(() => {
      setSuccess("");
    }, 3000);

    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!error) return;

    const timer = setTimeout(() => {
      setError("");
    }, 5000);

    return () => clearTimeout(timer);
  }, [error]);
  
  useEffect(() => {
    localStorage.setItem(chartTypeStorageKey, JSON.stringify(chartTypes));
  }, [chartTypes, chartTypeStorageKey]);

  useEffect(() => {
    const saved = localStorage.getItem(dashboardStorageKey);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);

        setDashboardFilters(
          parsed.dashboardFilters?.length
            ? parsed.dashboardFilters
            : [emptyDashboardFilter()]
        );

        setAppliedFilters(parsed.appliedFilters || []);
        return;
      } catch {
        // continue to reset below
      }
    }

    setDashboardFilters([emptyDashboardFilter()]);
    setAppliedFilters([]);
    setFilterValuesByIndex({});
  }, [dashboardStorageKey]);

  const [appliedFilters, setAppliedFilters] = useState(() => {
    const saved = localStorage.getItem(dashboardStorageKey);

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return parsed.appliedFilters || [];
      } catch {
        return [];
      }
    }

    return [];
  });


  useEffect(() => {
    localStorage.setItem(
      dashboardStorageKey,
      JSON.stringify({
        dashboardFilters,
        appliedFilters,
      })
    );
  }, [dashboardFilters, appliedFilters, dashboardStorageKey]);

  const fetchModuleFields = async () => {
    try {
      const res = await api.get(`modules/${id}/fields/`);
      setModuleFields(res.data || []);

      dashboardFilters.forEach((filter, index) => {
        if (filter.field) {
          fetchFilterValues(filter.field, index);
        }
      });
    } catch {
      setModuleFields([]);
    }
  };
  const fetchFilterValues = async (fieldName, index) => {
    if (!fieldName) {
      setFilterValuesByIndex((prev) => ({ ...prev, [index]: [] }));
      return;
    }

    setFilterValuesLoadingByIndex((prev) => ({ ...prev, [index]: true }));

    try {
      const res = await api.get(`modules/${id}/field-values/`, {
        params: { field: fieldName },
      });

      setFilterValuesByIndex((prev) => ({
        ...prev,
        [index]: res.data.values || [],
      }));
    } catch {
      setFilterValuesByIndex((prev) => ({ ...prev, [index]: [] }));
    } finally {
      setFilterValuesLoadingByIndex((prev) => ({
        ...prev,
        [index]: false,
      }));
    }
  };
  const updateDashboardFilter = (index, key, value) => {
    setDashboardFilters((prev) =>
      prev.map((filter, i) =>
        i === index ? { ...filter, [key]: value } : filter
      )
    );
  };

  const addDashboardFilter = () => {
    setDashboardFilters((prev) => [...prev, emptyDashboardFilter()]);
  };

  const removeDashboardFilter = (index) => {
    setDashboardFilters((prev) => prev.filter((_, i) => i !== index));
  };
  
  
  
  useEffect(() => {
    setModuleLoading(true);
    setKpiLoading(true);
    setKpis([]);
    setVisibleKpiIds([]);
    setKpiResults({});
    setLoadingKpis({});

    const fetchModule = async () => {
      try {
        const res = await api.get(`modules/${id}/`);
        setModule(res.data);
      } catch {
        setError("This module does not exist or could not be loaded.");
      } finally {
        setModuleLoading(false);
      }
    };

    const fetchKpis = async () => {
      try {
        const res = await api.get(`modules/${id}/kpis/`);
        const data = res.data || [];

        setKpis(data);
        setVisibleKpiIds(data.map((kpi) => kpi.id));

        setChartTypes((prev) => {
          const updated = { ...prev };

          data.forEach((kpi) => {
            if (!updated[kpi.id]) {
              updated[kpi.id] = getDefaultChartType(kpi);
            }
          });

          return updated;
        });

        if (data.length > 0) {
          await runAllKpis(appliedFilters, data);
        }
      } catch {
        setKpis([]);
      } finally {
        setKpiLoading(false);
      }
    };

    fetchModule();
    fetchKpis();
    fetchModuleFields();
  }, [id]);

  const fetchKpiHistory = async (
    kpiId,
    level = getDateLevel(kpiId),
    filters = appliedFilters
  ) => {
    try {
      const res = await api.post(`kpis/${kpiId}/history/`, {
        level,
        dashboard_filters: filters,
      });

      const payload = res.data;

      setKpiHistory((prev) => ({
        ...prev,
        [kpiId]: Array.isArray(payload) ? payload : payload.data || [],
        [`${kpiId}_series`]: payload.series || [],
        [`${kpiId}_is_grouped`]: payload.is_grouped || false,
      }));
    } catch (err) {
      console.error("KPI HISTORY ERROR:", err.response?.data || err.message);
    }
  };

  const runKpi = async (kpiId, filters = appliedFilters) => {
    setLoadingKpis((prev) => ({ ...prev, [kpiId]: true }));
    setError("");

    try {
      const res = await api.post(`kpis/${kpiId}/run/`, {
        dashboard_filters: filters,
        save_result: false,
      });

      console.log("KPI RUN RESULT:", res.data);

      setKpiResults((prev) => ({
        ...prev,
        [String(res.data.kpi_id)]: res.data,
      }));
      await fetchKpiHistory(kpiId, getDateLevel(kpiId), filters);

    } catch (err) {
      console.log("KPI RUN ERROR:", err.response?.data || err.message);

      setError(err.response?.data?.error || "Failed to run KPI.");

      // Do NOT erase the previous valid result
      setKpiResults((prev) => prev);
    } finally {
      setLoadingKpis((prev) => ({ ...prev, [kpiId]: false }));
    }
  };

    const runAllKpis = async (filters = appliedFilters, kpiList = kpis) => {
      await Promise.all(kpiList.map((kpi) => runKpi(kpi.id, filters)));
    };

  

  const visibleKpis = useMemo(() => {
    return kpis.filter((kpi) => visibleKpiIds.includes(kpi.id));
  }, [kpis, visibleKpiIds]);

  const toggleKpiVisibility = (kpiId) => {
    setVisibleKpiIds((prev) =>
      prev.includes(kpiId)
        ? prev.filter((item) => item !== kpiId)
        : [...prev, kpiId]
    );
  };

  const handleApplyDashboardFilter = async () => {
    const validFilters = dashboardFilters.filter(
      (filter) => filter.field && filter.value !== ""
    );

    if (validFilters.length === 0) {
      setError("Please add at least one complete dashboard filter.");
      return;
    }

    const filters = validFilters.map((filter, index) => ({
      field: filter.field,
      operator: filter.operator,
      value: filter.value,
      logic: index === 0 ? "AND" : filter.logic || "AND",
    }));

    setAppliedFilters(filters);
    setSuccess("Dashboard filters applied.");
    await runAllKpis(filters);
  };

  const handleClearDashboardFilter = async () => {
    setDashboardFilters([emptyDashboardFilter()]);
    setAppliedFilters([]);
    setFilterValuesByIndex({});
    setSuccess("Dashboard filters cleared.");
    await runAllKpis([]);
  };

  const updateChartType = (kpiId, chartType) => {
    setChartTypes((prev) => ({
      ...prev,
      [kpiId]: chartType,
    }));
  };

  const getTargetValue = (kpi, result) => {
    const value = Number(result?.target_value ?? kpi?.target_value ?? NaN);
    return Number.isNaN(value) ? null : value;
  };

  const getTargetLabel = (kpi, result) => {
    const target = getTargetValue(kpi, result);
    if (target === null) return "No target";

    return `Target ${
      result?.target_operator || kpi?.target_operator || "="
    } ${formatKpiValue(target, kpi.value_type)}`;
      };

  const getKpiResult = (kpi) => {
    return (
      kpiResults[String(kpi.id)] ||
      kpiResults[kpi.id] ||
      Object.values(kpiResults).find(
        (result) => Number(result?.kpi_id) === Number(kpi.id)
      ) ||
      null
    );
  };

  const shouldShowTargetLine = (data, targetValue) => {
    if (!data || data.length === 0 || targetValue === null) return false;

    const values = data.map((item) => Number(item.value || 0));
    const maxValue = Math.max(...values);

    if (maxValue === 0) return false;

    return targetValue <= maxValue * 1.5;
  };

  const formatKpiValue = (value, valueType) => {
  if (value === null || value === undefined || value === "") {
    return "-";
  }

  const numberValue = Number(value);

    if (Number.isNaN(numberValue)) {
      return value;
    }

    if (valueType === "percentage") {
      return `${(numberValue * 100).toFixed(2)}%`;
    }

    return Number.isInteger(numberValue)
      ? numberValue
      : numberValue.toFixed(2);
  };
  const renderChart = (kpi) => {
    const result = getKpiResult(kpi);
    const currentChartType =
      chartTypes[kpi.id] || getDefaultChartType(kpi);
    const targetValue = getTargetValue(kpi, result);
    const hasTarget = targetValue !== null;

    const rechartsTooltipFormatter = (value, name) => [
      formatKpiValue(value, kpi.value_type),
      name,
    ];

    if (loadingKpis[kpi.id]) {
      return <CircularProgress />;
    }

    if (!result) {
      return <Alert severity="info">No KPI result available.</Alert>;
    }

    

    const chartData = kpiHistory[kpi.id] || [];
    const series = kpiHistory[`${kpi.id}_series`] || [];
    const maxVisibleSeries = Number(kpi.limit) || series.length;;
    
    const pieData =
        result?.type === "grouped"
          ? result.data || []
          : chartData;  


    const visibleSeries = series.slice(0, maxVisibleSeries);
    const isGroupedHistory = kpiHistory[`${kpi.id}_is_grouped`] || false;

    
    
    const latestHistoryValue =
      chartData.length > 0
        ? chartData[chartData.length - 1].value
        : null;

    if (currentChartType === "card") {
      const totalValue = chartData.reduce(
        (sum, item) => sum + Number(item.value || 0),
        0
      );

      const details = (
        <Box sx={{ p: 1, minWidth: 220 }}>
          <Typography fontWeight="bold" mb={1}>
            Details
          </Typography>

          <Stack spacing={0.8}>
            {chartData.map((item, index) => (
              <Box key={index} display="flex" justifyContent="space-between" gap={2}>
                <Typography variant="body2">{item.label}</Typography>
                <Typography variant="body2" fontWeight="bold">
                  {formatKpiValue(item.value, kpi.value_type)}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      );

      

      return (
        <MuiTooltip arrow placement="top" title={details}>
          <Box
            mt={2}
            p={3}
            border="1px solid #e0e0e0"
            borderRadius={3}
            minHeight={140}
            display="flex"
            flexDirection="column"
            justifyContent="center"
            sx={{ cursor: "pointer" }}
          >
            <Typography color="text.secondary" mb={1}>
              Total
            </Typography>

            <Typography variant="h3" fontWeight="bold">
              {formatKpiValue(totalValue, kpi.value_type)}
            </Typography>

            <Typography variant="body2" color="text.secondary" mt={1}>
              Hover to view details
            </Typography>
          </Box>
        </MuiTooltip>
      );
    }    

    if (chartData.length === 0) {
      return <Alert severity="info">No chart data available for this KPI.</Alert>;
    }

    if (
      result.type !== "grouped" &&
      (currentChartType === "pie" || currentChartType === "donut")
    ) {
      return (
        <Alert severity="warning">
          Pie and donut charts require grouped data. Please select line, column,
          bar, or card.
        </Alert>
      );
    }

    const values = chartData.map((item) => Number(item.value || 0));
    const maxValue = Math.max(...values);
    const showTargetLine =
      hasTarget && maxValue > 0 && targetValue <= maxValue * 1.5;


    const shouldShowLegend = series.length > 0 && series.length <= 8;

    return (
      <>
        <ResponsiveContainer width="100%" height={chartHeight}>
          {currentChartType === "line" ? (
            <LineChart data={chartData}>
              <CartesianGrid stroke={chartGridColor} strokeDasharray="3 3" />

              <XAxis dataKey="label" tick={{ fill: chartTextColor }} stroke={chartTextColor} />
              <YAxis
                tickFormatter={(value) =>
                  formatKpiValue(value, kpi.value_type)
                }
                tick={{ fill: chartTextColor }}
                stroke={chartTextColor}
              />
              <Tooltip contentStyle={tooltipStyle} formatter={rechartsTooltipFormatter} />

              {showTargetLine && (
                <ReferenceLine
                  y={targetValue}
                  stroke={targetColor}
                  strokeDasharray="6 4"
                  strokeWidth={2.5}
                  label={{
                    value: `Target: ${formatKpiValue(targetValue, kpi.value_type)}`,
                    position: "top",
                    fill: targetColor,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                />
              )}

              {isGroupedHistory && series.length > 0 ? (
                <>
                  {shouldShowLegend && <Legend />}
                  {visibleSeries.map((key, index) => (
                    <Line
                      key={key}
                      type="monotone"
                      dataKey={key}
                      name={key}
                      stroke={chartColors[index % chartColors.length]}
                      strokeWidth={3}
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  ))}
                </>
              ) : (
                <Line
                  type="monotone"
                  dataKey="value"
                  name="Actual"
                  stroke={chartColors[3]}
                  strokeWidth={3}
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              )}
            </LineChart>
          ) : currentChartType === "pie" || currentChartType === "donut" ? (
            <PieChart>
              <Tooltip contentStyle={tooltipStyle} formatter={rechartsTooltipFormatter} />
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="label"
                cx="50%"
                cy="50%"
                outerRadius={130}
                innerRadius={currentChartType === "donut" ? 70 : 0}
                label={{ fill: chartTextColor }}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={chartColors[index % chartColors.length]} />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          ) : (
            <BarChart
              data={chartData}
              layout={currentChartType === "bar" ? "vertical" : "horizontal"}
              barCategoryGap="10%"
              margin={{ top: 20, right: 45, left: 20, bottom: 35 }}
            >
              <CartesianGrid stroke={chartGridColor} strokeDasharray="3 3" />

              <XAxis
                type={currentChartType === "bar" ? "number" : "category"}
                dataKey={currentChartType === "bar" ? undefined : "label"}
                tickFormatter={(value) =>
                  currentChartType === "bar"
                    ? formatKpiValue(value, kpi.value_type)
                    : value
                }
                tick={{ fill: chartTextColor }}
                stroke={chartTextColor}
              />

              <YAxis
                type={currentChartType === "bar" ? "category" : "number"}
                dataKey={currentChartType === "bar" ? "label" : undefined}
                allowDecimals={false}
                width={currentChartType === "bar" ? 180 : undefined}
                tickFormatter={(value) =>
                  currentChartType === "bar"
                    ? value
                    : formatKpiValue(value, kpi.value_type)
                }
                tick={{ fill: chartTextColor }}
                stroke={chartTextColor}
              />

              <Tooltip contentStyle={tooltipStyle} formatter={rechartsTooltipFormatter} />

              {showTargetLine && currentChartType === "bar" && (
                <ReferenceLine
                  x={targetValue}
                  stroke={targetColor}
                  strokeDasharray="6 4"
                  strokeWidth={2.5}
                  label={{
                    value: `Target: ${formatKpiValue(targetValue, kpi.value_type)}`,
                    position: "insideTopRight",
                    fill: targetColor,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                />
              )}

              {showTargetLine && currentChartType === "column" && (
                <ReferenceLine
                  y={targetValue}
                  stroke={targetColor}
                  strokeDasharray="6 4"
                  strokeWidth={2.5}
                  label={{
                    value: `Target: ${formatKpiValue(targetValue, kpi.value_type)}`,
                    position: "top",
                    fill: targetColor,
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                />
              )}

              {isGroupedHistory && series.length > 0 ? (
                <>
                  <Legend wrapperStyle={{ paddingTop: 20 }} />
                  {visibleSeries.map((key, index) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      name={key}
                      stackId="grouped"
                      fill={chartColors[index % chartColors.length]}
                      barSize={50}
                      radius={index === series.length - 1 ? [6, 6, 0, 0] : [0, 0, 0, 0]}
                    />
                  ))}
                </>
              ) : (
                <Bar dataKey="value" name="Actual" radius={[6, 6, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={chartColors[index % chartColors.length]} />
                  ))}
                  {kpi.value_type !== "percentage" && chartData.length <= 12 && (
                    <LabelList
                      dataKey="value"
                      position={currentChartType === "bar" ? "right" : "top"}
                      fill={chartTextColor}
                      fontWeight={600}
                      formatter={(value) => formatKpiValue(value, kpi.value_type)}
                    />
                  )}  
                </Bar>
              )}
            </BarChart>
          )}
        </ResponsiveContainer>
        
        {hasTarget && !showTargetLine && currentChartType !== "pie" && currentChartType !== "donut" && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Target value ({targetValue}) is outside the visible chart range.
          </Alert>
        )}
      </>
    );
  };

  if (moduleLoading || kpiLoading) {
    return (
      <Box display="flex" justifyContent="center" mt={5}>
        <CircularProgress />
      </Box>
    );
  }

  if (!module || !module.is_active) {
    return <Alert severity="warning">Module not active.</Alert>;
  }

  const handleExportDashboardPdf = async () => {
    if (!dashboardRef.current) return;

    const canvas = await html2canvas(dashboardRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: theme.palette.background.default,
    });

    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");

    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();

    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    while (heightLeft > 0) {
      position -= pageHeight;
      pdf.addPage();
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    pdf.save(`${module?.name || "dashboard"}-dashboard.pdf`);
  };

  return (
    <Box ref={dashboardRef}>
      <Box 
        mb={3} 
        display="flex" 
        justifyContent="space-between" 
        alignItems={{ xs: "stretch", md: "center" }}
        flexDirection={{ xs: "column", md: "row" }}
        gap={2}
      >
        <Box>
          <Typography variant="h4" fontWeight="bold">
            {module.name}
          </Typography>
          <Typography color="text.secondary">{module.description}</Typography>
        </Box>
        <Stack
          direction={{ xs: "column", sm: "row" }}
          spacing={1}
          width={{ xs: "100%", sm: "auto" }}
        >
          <Button
            variant="outlined"
            onClick={handleExportDashboardPdf}
            fullWidth={isMobile}
          >
            Export
          </Button>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" mb={2}>
            Dashboard Filters
          </Typography>

          <Stack spacing={2}>
            {dashboardFilters.map((filter, index) => (
              <Stack
                key={index}
                direction={{ xs: "column", md: "row" }}
                spacing={2}
                alignItems={{ xs: "stretch", md: "center" }}
              >
                {index > 0 && (
                  <FormControl size="small" sx={{ Width: { xs: "100%", md: 220 } }}>
                    <InputLabel>Logic</InputLabel>
                    <Select
                      value={filter.logic}
                      label="Logic"
                      onChange={(e) =>
                        updateDashboardFilter(index, "logic", e.target.value)
                      }
                    >
                      <MenuItem value="AND">AND</MenuItem>
                      <MenuItem value="OR">OR</MenuItem>
                    </Select>
                  </FormControl>
                )}

                <Autocomplete
                  size="small"
                  options={moduleFields}
                  getOptionLabel={(option) => option.field_name || ""}
                  value={
                    moduleFields.find((f) => f.field_name === filter.field) || null
                  }
                  onChange={(event, newValue) => {
                    const selectedField = newValue?.field_name || "";

                    updateDashboardFilter(index, "field", selectedField);
                    updateDashboardFilter(index, "value", "");

                    fetchFilterValues(selectedField, index);
                  }}
                  renderInput={(params) => (
                    <TextField {...params} label="Field" placeholder="Search field..." />
                  )}
                  sx={{ width: { xs: "100%", md: 220 } }}
                />

                <FormControl size="small" sx={{Width: { xs: "100%", md: 150 } }}>
                  <InputLabel>Operator</InputLabel>
                  <Select
                    value={filter.operator}
                    label="Operator"
                    onChange={(e) =>
                      updateDashboardFilter(index, "operator", e.target.value)
                    }
                  >
                    {filterOperatorOptions.map((option) => (
                      <MenuItem key={option.value} value={option.value}>
                        {option.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <Autocomplete
                  freeSolo
                  size="small"
                  loading={filterValuesLoadingByIndex[index] || false}
                  options={filterValuesByIndex[index] || []}
                  value={filter.value || ""}
                  onChange={(event, newValue) =>
                    updateDashboardFilter(index, "value", newValue || "")
                  }
                  onInputChange={(event, newInputValue) =>
                    updateDashboardFilter(index, "value", newInputValue || "")
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Value"
                      placeholder="Select or type value"
                    />
                  )}
                  sx={{ width:{ xs: "100%", md: 220 }  }}
                />

                {dashboardFilters.length > 1 && (
                  <Button
                    variant="outlined"
                    color="error"
                    onClick={() => removeDashboardFilter(index)}
                  >
                    Remove
                  </Button>
                )}
              </Stack>
            ))}

            <Box display="flex" gap={2} flexWrap="wrap">
              <Button variant="outlined" onClick={addDashboardFilter}>
                Add Filter
              </Button>

              <Button variant="contained" onClick={handleApplyDashboardFilter}>
                Apply
              </Button>

              <Button variant="outlined" onClick={handleClearDashboardFilter}>
                Clear
              </Button>
            </Box>
          </Stack>

          {appliedFilters.length > 0 && (
            <Box mt={2} display="flex" gap={1} flexWrap="wrap">
              {appliedFilters.map((filter, index) => (
                <Chip
                  key={index}
                  label={`${filter.field} ${filter.operator} ${filter.value}`}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" mb={2}>
            Select KPIs to Display
          </Typography>

          <Grid container spacing={2}>
            {kpis.map((kpi) => {
              const isVisible = visibleKpiIds.includes(kpi.id);

              return (
                <Grid item xs={12} sm={6} md={4} key={kpi.id}>
                  <Card
                    sx={{
                      cursor: "pointer",
                      border: isVisible
                        ? `2px solid ${theme.palette.primary.main}`
                        : `1px solid ${isDark ? "#263a6b" : "#ddd"}`,
                      opacity: isVisible ? 1 : 0.55,
                    }}
                  >
                    <CardContent>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        gap={1}
                      >
                        <Box onClick={() => toggleKpiVisibility(kpi.id)} flex={1}>
                          <Typography fontWeight="bold">{kpi.name}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {kpi.description || "No description provided."}
                          </Typography>
                        </Box>

                        <IconButton
                          size="small"
                          color={isVisible ? "primary" : "default"}
                          onClick={() => toggleKpiVisibility(kpi.id)}
                        >
                          {isVisible ? (
                            <VisibilityIcon fontSize="small" />
                          ) : (
                            <VisibilityOffIcon fontSize="small" />
                          )}
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </CardContent>
      </Card>

      {visibleKpis.length === 0 ? (
        <Alert severity="info">No KPI selected for display.</Alert>
      ) : (
        <Grid container spacing={3}>
          {visibleKpis.map((kpi) => {
            const result = getKpiResult(kpi);
            const currentChartType = chartTypes[kpi.id] || getDefaultChartType(kpi);

            return (
              <Grid item xs={12} key={kpi.id}>
                <Card>
                  <CardContent>
                    <Box
                      mb={2}
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      gap={2}
                      flexWrap="wrap"
                    >
                      <Box>
                        <Typography variant="h5">{kpi.name}</Typography>

                        <Box display="flex" gap={1} mt={1} flexWrap="wrap">
                          <Chip
                            label={getTargetLabel(kpi, result)}
                            size="small"
                            color="primary"
                            variant="outlined"
                          />

                          {result?.status && (
                            <Chip
                              label={result.status}
                              size="small"
                              color={
                                result.status === "on_target"
                                  ? "success"
                                  : "error"
                              }
                            />
                          )}
                        </Box>
                      </Box>

                      {result &&
                       (
                          <Select
                            size="small"
                            value={currentChartType}
                            onChange={(e) =>
                              updateChartType(kpi.id, e.target.value)
                            }
                          >
                            <MenuItem value="card">Card</MenuItem>
                            <MenuItem value="column">Column Chart</MenuItem>
                            <MenuItem value="bar">Bar Chart</MenuItem>
                            <MenuItem value="line">Line Chart</MenuItem>
                            {result?.type === "grouped" && (
                              <MenuItem value="pie">Pie Chart</MenuItem>
                            )}
                           {result?.type === "grouped" && (
                             <MenuItem value="donut">Donut Chart</MenuItem>
                           )}
                          </Select>
                          
                        )}
                        <Select
                          size="small"
                          value={getDateLevel(kpi.id)}
                          onChange={async (e) => {
                            const newLevel = e.target.value;

                            setDateLevels((prev) => ({
                              ...prev,
                              [kpi.id]: newLevel,
                            }));

                            await fetchKpiHistory(kpi.id, newLevel, appliedFilters);
                          }}
                        >
                          <MenuItem value="year">Year</MenuItem>
                          <MenuItem value="quarter">Quarter</MenuItem>
                          <MenuItem value="month">Month</MenuItem>
                          <MenuItem value="day">Day</MenuItem>
                        </Select>
                    </Box>

                    {renderChart(kpi)}
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}