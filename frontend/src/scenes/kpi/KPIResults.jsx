import { use, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  MenuItem,
  Paper,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import api from "../../api/axios";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";
export default function KPIResults() {
  const isDemo = window.location.hostname.includes("github.io");
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  
  const currentUser = JSON.parse(localStorage.getItem("user") || "{}");
  const reportFilterKey = `report_filters_${currentUser.email || "guest"}`;
  const savedReportFilters = JSON.parse(localStorage.getItem(reportFilterKey) || "{}");


  const [kpis, setKpis] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedModule, setSelectedModule] = useState(savedReportFilters.selectedModule || null);

  const [periodType, setPeriodType] = useState(savedReportFilters.periodType || "last_12");
  const [customStartDate, setCustomStartDate] = useState(savedReportFilters.customStartDate || "");
  const [customEndDate, setCustomEndDate] = useState(savedReportFilters.customEndDate || "");
  
  useEffect(() => {
    if (!error) return;

    const timer = setTimeout(() => {
      setError("");
    }, 5000);

    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    localStorage.setItem(reportFilterKey, JSON.stringify({
      selectedModule,
      periodType,
      customStartDate,
      customEndDate,
    }));
  }, [reportFilterKey, selectedModule, periodType, customStartDate, customEndDate]);

  const isCustomDateInvalid =
    periodType === "custom" &&
    customStartDate &&
    customEndDate &&
    new Date(customEndDate) < new Date(customStartDate);

  const getDemoData = () => {
    const demoKpis = [
      {
        id: 1,
        module: 1,
        module_name: "Incident Management",
        name: "Incident Resolution Rate",
        description: "Percentage of incidents resolved within the defined target.",
        aggregation: "Average",
        target_operator: ">=",
        target_value: 0.9,
        value_type: "percentage",
        is_active: true,
      },
      {
        id: 2,
        module: 1,
        module_name: "Incident Management",
        name: "Critical Incident Rate",
        description: "Percentage of incidents classified as critical.",
        aggregation: "Average",
        target_operator: "<=",
        target_value: 0.1,
        value_type: "percentage",
        is_active: true,
      },
      {
        id: 3,
        module: 2,
        module_name: "Service Requests",
        name: "Request Resolution Time",
        description: "Average time required to resolve service requests.",
        aggregation: "Average",
        target_operator: "<=",
        target_value: 4,
        value_type: "number",
        is_active: true,
      },
      {
        id: 4,
        module: 2,
        module_name: "Service Requests",
        name: "Request Satisfaction",
        description: "Average satisfaction rate for completed service requests.",
        aggregation: "Average",
        target_operator: ">=",
        target_value: 0.85,
        value_type: "percentage",
        is_active: true,
      },
    ];

    const demoResults = [];

    monthColumns.forEach((month, index) => {
      const resolutionRate = 0.82 + (index % 5) * 0.025;
      const criticalRate = 0.12 - (index % 4) * 0.012;
      const resolutionTime = 4.8 - (index % 5) * 0.25;
      const satisfaction = 0.79 + (index % 5) * 0.025;

      demoResults.push(
        {
          kpi_definition_id: 1,
          date_value: `${month.key}-01`,
          actual_value: Math.min(resolutionRate, 0.95),
          grouped_data: [
            { label: "Priority 1", value: Math.round(resolutionRate * 100) },
            { label: "Priority 2", value: Math.round((resolutionRate + 0.03) * 100) },
          ],
        },
        {
          kpi_definition_id: 2,
          date_value: `${month.key}-01`,
          actual_value: Math.max(criticalRate, 0.06),
          grouped_data: [],
        },
        {
          kpi_definition_id: 3,
          date_value: `${month.key}-01`,
          actual_value: Math.max(resolutionTime, 3.5),
          grouped_data: [],
        },
        {
          kpi_definition_id: 4,
          date_value: `${month.key}-01`,
          actual_value: Math.min(satisfaction, 0.91),
          grouped_data: [],
        }
      );
    });

    return {
      kpis: demoKpis,
      results: demoResults,
    };
  };  
  const fetchData = async () => {
    try {
      // Use sample data on the public GitHub Pages demo
      if (isDemo) {
        const demoData = getDemoData();

        setKpis(demoData.kpis);
        setResults(demoData.results);
        setError("");
        setLoading(false);

        return;
      }

    const params = {};

      if (periodType === "last_6") {
        params.months = 6;
      } else if (periodType === "last_12") {
        params.months = 12;
      } else if (periodType === "last_24") {
        params.months = 24;
      } else if (periodType === "custom") {
        if (!customStartDate || !customEndDate || isCustomDateInvalid) {
          setLoading(false);
          return;
        }

        params.start_date = customStartDate;
        params.end_date = customEndDate;
      }

      const [kpiRes, resultRes] = await Promise.all([
        api.get("kpis/"),
        api.get("kpi-results/", { params }),
      ]);

      setKpis(kpiRes.data || []);
      setResults(resultRes.data || []);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to load KPI results.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchData();
  }, [periodType, customStartDate, customEndDate]);

  const monthColumns = useMemo(() => {
    const months = [];
    const today = new Date();

    let startDate;

    if (periodType === "last_6") {
      startDate = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    } else if (periodType === "last_24") {
      startDate = new Date(today.getFullYear(), today.getMonth() - 23, 1);
    } else if (periodType === "custom" && customStartDate && customEndDate) {
      startDate = new Date(customStartDate);
    } else {
      startDate = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    }

    const endDate =
      periodType === "custom" && customEndDate
        ? new Date(customEndDate)
        : today;

    const current = new Date(startDate.getFullYear(), startDate.getMonth(), 1);

    while (current <= endDate) {
      const key = `${current.getFullYear()}-${String(
        current.getMonth() + 1
      ).padStart(2, "0")}`;

      const label = current.toLocaleString("en-US", {
        month: "short",
        year: "numeric",
      });

      months.push({ key, label });

      current.setMonth(current.getMonth() + 1);
    }

    return months;
  }, [periodType, customStartDate, customEndDate]);

  const modules = useMemo(() => {
    const unique = new Map();

    kpis.forEach((kpi) => {
      unique.set(kpi.module, kpi.module_name);
    });

    return Array.from(unique.entries());
  }, [kpis]);

  const filteredKpis = useMemo(() => {
    return kpis.filter(
      (kpi) => kpi.is_active && (!selectedModule || kpi.module === selectedModule)
    );
  }, [kpis, selectedModule]);

  const resultsByKpiAndMonth = useMemo(() => {
    const map = {};

    results.forEach((result) => {
      if (!result.date_value || !result.kpi_definition_id) return;

      const kpiId = Number(result.kpi_definition_id);
      const monthKey = result.date_value.slice(0, 7);

      if (!map[kpiId]) map[kpiId] = {};

      map[kpiId][monthKey] = result;
    });

    return map;
  }, [results]);

  const getLatestResult = (kpi) => {
    for (let i = monthColumns.length - 1; i >= 0; i--) {
      const month = monthColumns[i];
      const monthlyResult = resultsByKpiAndMonth[kpi.id]?.[month.key];

      if (
        monthlyResult &&
        monthlyResult.actual_value !== null &&
        monthlyResult.actual_value !== undefined
      ) {
        return monthlyResult;
      }
    }

    return null;
  };

  const getStatusColor = (status) => {
    if (status === "on_target") return "success";
    if (status === "off_target") return "error";
    return "default";
  };

  const formatValue = (value) => {
    if (value === null || value === undefined || value === "") return "-";

    const numberValue = Number(value);

    if (Number.isNaN(numberValue)) return value;

    return Number.isInteger(numberValue)
      ? numberValue
      : numberValue.toFixed(2);
  };

  const formatKpiValue = (value, valueType) => {
    if (value === null || value === undefined || value === "") return "-";

    const numberValue = Number(value);
    if (Number.isNaN(numberValue)) return value;

    if (valueType === "percentage") {
      return `${(numberValue * 100).toFixed(2)}%`;
    }

    return Number.isInteger(numberValue)
      ? numberValue
      : numberValue.toFixed(2);
  };


  const renderGroupedTooltip = (monthlyResult) => {
    const groupedData = monthlyResult?.grouped_data || [];

    if (!monthlyResult || groupedData.length === 0) {
      return "No grouped details available";
    }

    return (
      <Box sx={{ p: 1, maxWidth: 340 }}>
        <Typography fontWeight="bold" mb={1}>
          Grouped details
        </Typography>

        <Stack spacing={0.8}>
          {groupedData.map((item, index) => (
            <Box
              key={index}
              display="flex"
              justifyContent="space-between"
              gap={2}
            >
              <Typography variant="body2">{item.label}</Typography>
              <Typography variant="body2" fontWeight="bold">
                {item.value}
              </Typography>
            </Box>
          ))}
        </Stack>
      </Box>
    );
  };

  const evaluateMonthlyStatus = (monthlyResult, kpi) => {
    if (!monthlyResult || monthlyResult.actual_value === null || monthlyResult.actual_value === undefined) {
      return "unknown";
    }

    const actual = Number(monthlyResult.actual_value);
    const target = Number(kpi.target_value);
    const operator = kpi.target_operator;

    if (Number.isNaN(actual) || Number.isNaN(target)) return "unknown";

    if (operator === "=") return actual === target ? "on_target" : "off_target";
    if (operator === ">") return actual > target ? "on_target" : "off_target";
    if (operator === ">=") return actual >= target ? "on_target" : "off_target";
    if (operator === "<") return actual < target ? "on_target" : "off_target";
    if (operator === "<=") return actual <= target ? "on_target" : "off_target";

    return "unknown";
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={5}>
        <CircularProgress />
      </Box>
    );
  }
  const getMonthlyStatusColor = (status) => {
    if (status === "on_target") return "#DCFCE7";
    if (status === "off_target") return "#FEE2E2";
    return "transparent";
  };

  const getMonthlyTextColor = (status) => {
    if (status === "on_target") return "#166534";
    if (status === "off_target") return "#991B1B";
    return "inherit";
  };

  const handleExportExcel = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("KPI Results");

    const headers = [
      "Module",
      "KPI Name",
      "Metric",
      ...monthColumns.map((m) => m.label),
      "Target",
    ];

    worksheet.addRow(headers);

    filteredKpis.forEach((kpi) => {
      const rowValues = [
        kpi.module_name,
        kpi.name,
        kpi.aggregation,
        ...monthColumns.map((month) => {
          const monthlyResult = resultsByKpiAndMonth[kpi.id]?.[month.key];
          return formatValue(monthlyResult?.actual_value);
        }),
        `${kpi.target_operator} ${formatValue(kpi.target_value)}`,
      ];

      const row = worksheet.addRow(rowValues);

      monthColumns.forEach((month, index) => {
        const monthlyResult = resultsByKpiAndMonth[kpi.id]?.[month.key];
        const monthlyStatus = evaluateMonthlyStatus(monthlyResult, kpi);
        const cell = row.getCell(index + 4);

        if (monthlyStatus === "on_target") {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFDCFCE7" },
          };
          cell.font = { color: { argb: "FF166534" }, bold: true };
        }

        if (monthlyStatus === "off_target") {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFEE2E2" },
          };
          cell.font = { color: { argb: "FF991B1B" }, bold: true };
        }
      });
    });

    worksheet.columns.forEach((column) => {
      column.width = 20;
    });

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer]), "kpi_report.xlsx");
  };

  return (
    <Box>
      <Box
        mb={3}
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        gap={2}
        flexWrap="wrap"
      >
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Report
          </Typography>
        </Box>

        <Stack direction={{ xs: "column", sm: "row" }} spacing={2} flexWrap="wrap" alignItems={{ xs: "stretch", sm: "center" }} sx={{ width: { xs: "100%", sm: "auto" } }} >
          <Button
              variant="contained"
              onClick={handleExportExcel}
              disabled={filteredKpis.length === 0 || isCustomDateInvalid}
              fullWidth={isMobile}
            >
              Export
          </Button>
          <FormControl size="small" sx={{ width: { xs: "100%", sm: 190 } }}>
            <Select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value)}
            >
              <MenuItem value="last_6">Last 6 months</MenuItem>
              <MenuItem value="last_12">Last 12 months</MenuItem>
              <MenuItem value="last_24">Last 24 months</MenuItem>
              <MenuItem value="custom">Custom date range</MenuItem>
            </Select>
          </FormControl>

          {periodType === "custom" && (
            <>
              <TextField
                size="small"
                label="Start date"
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />

              <TextField
                size="small"
                label="End date"
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                InputLabelProps={{ shrink: true }}
              />
            </>
          )}
        </Stack>
        {isCustomDateInvalid && (
          <Alert severity="error" sx={{ mt: 2 }}>
            End date must be after the start date.
          </Alert>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Box mb={2}>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Chip
            label="All"
            clickable
            color={!selectedModule ? "primary" : "default"}
            onClick={() => setSelectedModule(null)}
          />

          {modules.map(([id, name]) => (
            <Chip
              key={id}
              label={name}
              clickable
              color={selectedModule === id ? "primary" : "default"}
              onClick={() => setSelectedModule(id)}
            />
          ))}
        </Stack>
      </Box>

      {periodType === "custom" && (!customStartDate || !customEndDate) && (
        <Alert severity="info" sx={{ width: { xs: "100%", sm: 170 } }}>
          Please select both start date and end date to display a custom period.
        </Alert>
      )}
      <Stack direction="row" spacing={1} alignItems="center" mb={2}>
        <Chip label="On target" sx={{ backgroundColor: "#DCFCE7", color: "#166534" }} />
        <Chip label="Off target" sx={{ backgroundColor: "#FEE2E2", color: "#991B1B" }} />
      </Stack>
      <Paper sx={{ borderRadius: 3, overflowX: "auto", width: "100%" }}>
        <Table size="small" stickyHeader sx={{ minWidth: 900 }}>
          <TableHead>
            <TableRow>
              <TableCell>
                <strong>Module</strong>
              </TableCell>

              <TableCell sx={{ minWidth: 220 }}>
                <strong>KPI Name</strong>
              </TableCell>

              <TableCell>
                <strong>Metric</strong>
              </TableCell>

              {monthColumns.map((month) => (
                <TableCell key={month.key} align="center" sx={{ minWidth: 95 }}>
                  <strong>{month.label}</strong>
                </TableCell>
              ))}

              <TableCell align="center">
                <strong>Target</strong>
              </TableCell>

              <TableCell align="center">
                <strong>Status</strong>
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredKpis.map((kpi) => {
              const latestResult = getLatestResult(kpi);
              const latestStatus = evaluateMonthlyStatus(latestResult, kpi);

              return (
                <TableRow key={kpi.id} hover>
                  <TableCell>
                    <Chip label={kpi.module_name} size="small" />
                  </TableCell>

                  <TableCell>
                    <Typography fontWeight="bold">{kpi.name}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {kpi.description || "No description"}
                    </Typography>
                  </TableCell>

                  <TableCell>{kpi.aggregation}</TableCell>

                  {monthColumns.map((month) => {
                    const monthlyResult =
                      resultsByKpiAndMonth[kpi.id]?.[month.key];
                    const monthlyStatus = evaluateMonthlyStatus(monthlyResult, kpi);
                    return (
                      <TableCell key={month.key} align="center">
                        <Tooltip
                          arrow
                          placement="top"
                          title={renderGroupedTooltip(monthlyResult)}
                        >
                          <Typography
                            fontWeight={monthlyResult ? 600 : 400}
                            sx={{
                              cursor: monthlyResult ? "pointer" : "default",
                              textDecoration:
                                monthlyResult?.grouped_data?.length > 0
                                  ? "underline dotted"
                                  : "none",
                                backgroundColor: getMonthlyStatusColor(monthlyStatus),
                                color: getMonthlyTextColor(monthlyStatus),
                                borderRadius: 1,
                                px: 1,
                                py: 0.5,
                                minWidth: 40,  
                            }}
                          >
                            {formatKpiValue(monthlyResult?.actual_value, kpi.value_type)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                    );
                  })}

                  <TableCell align="center">
                    {kpi.target_operator} {formatKpiValue(kpi.target_value, kpi.value_type)}
                  </TableCell>

                  <TableCell align="center">
                    <Chip
                      label={latestStatus}
                      color={
                        latestStatus === "on_target"
                          ? "success"
                          : latestStatus === "off_target"
                          ? "error"
                          : "default"
                      }
                      size="small"
                    />
                  </TableCell>
                </TableRow>
              );
            })}

            {filteredKpis.length === 0 && (
              <TableRow>
                <TableCell colSpan={monthColumns.length + 5} align="center">
                  No KPIs found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
}