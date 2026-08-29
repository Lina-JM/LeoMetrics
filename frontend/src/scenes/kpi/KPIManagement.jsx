import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import api from "../../api/axios";

const aggregationOptions = [
  { value: "count", label: "Count" },
  { value: "sum", label: "Sum" },
  { value: "avg", label: "Average" },
  { value: "min", label: "Min" },
  { value: "max", label: "Max" },
  { value: "percentage", label: "Percentage" },
];

const valueTypeOptions = [
  { value: "number", label: "Number" },
  { value: "percentage", label: "Percentage" },
  { value: "duration", label: "Duration" },
];

const chartTypeOptions = [
  { value: "column", label: "Column Chart" },
  { value: "bar", label: "Bar Chart" },
  { value: "line", label: "Line Chart" },
  { value: "pie", label: "Pie Chart" },
  { value: "donut", label: "Donut Chart" },
];

const targetOperatorOptions = [
  { value: "=", label: "Equal to" },
  { value: ">", label: "Greater than" },
  { value: "<", label: "Less than" },
  { value: ">=", label: "Greater than or equal to" },
  { value: "<=", label: "Less than or equal to" },
];

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

const logicOptions = [
  { value: "AND", label: "AND" },
  { value: "OR", label: "OR" },
];

const aggregationNeedsField = (aggregation) =>
  ["sum", "avg", "min", "max"].includes(aggregation);

const emptyFilter = () => ({
  field: "",
  operator: "=",
  value: "",
  logic: "AND",
});

const normalizeChartType = (chartType) => {
  if (Array.isArray(chartType)) {
    return chartType[0] || "column";
  }

  if (typeof chartType === "string") {
    try {
      const parsed = JSON.parse(chartType);
      if (Array.isArray(parsed)) {
        return parsed[0] || "column";
      }
    } catch {
      return chartType || "column";
    }
  }

  return chartType || "column";
};

const isDateLikeField = (field) => {
  const name = (field.field_name || "").toLowerCase();

  return (
    field.field_type === "date" ||
    name.includes("date") ||
    name.includes("created") ||
    name.includes("opened") ||
    name.includes("resolved") ||
    name.includes("closed") ||
    name.includes("updated") ||
    name.includes("time") ||
    name.endsWith("_at")
  );
};

const emptyForm = () => ({
  module: "",
  name: "",
  aggregation: "count",
  field: "",
  filters: [emptyFilter()],
  reporting_date_field: "",
  group_by: "",
  limit: "",
  description: "",
  business_meaning: "",
  target_operator: "=",
  target_value: "",
  value_type: "number",
  is_active: true,
});

export default function KPIManagement() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  }, []);

  const role = storedUser?.role || null;

  const hasPermission = (code) => {
    if (role === "administrator") return true;

    return storedUser?.app_permissions?.some((p) => p.code === code);
  };

  const canCreateKpi = hasPermission("create_kpi");
  const canEditKpi = hasPermission("edit_kpi");
  const canActivateKpis = hasPermission("activate_deactivate_kpi");

  const [kpis, setKpis] = useState([]);
  const [modules, setModules] = useState([]);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [createFields, setCreateFields] = useState([]);
  const [editFields, setEditFields] = useState([]);

  const [createFilterValues, setCreateFilterValues] = useState({});
  const [editFilterValues, setEditFilterValues] = useState({});
  const [createFilterSearch, setCreateFilterSearch] = useState({});
  const [editFilterSearch, setEditFilterSearch] = useState({});

  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState(emptyForm());

  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [selectedKpi, setSelectedKpi] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm());

  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [viewKpi, setViewKpi] = useState(null);

  useEffect(() => {
    if (!error) return;

    const timer = setTimeout(() => {
      setError("");
    }, 5000);

    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!createError) return;

    const timer = setTimeout(() => {
      setCreateError("");
    }, 5000);

    return () => clearTimeout(timer);
  }, [createError]);

  useEffect(() => {
    if (!editError) return;

    const timer = setTimeout(() => {
      setEditError("");
    }, 5000);

    return () => clearTimeout(timer);
  }, [editError]);

  const demoKpis = [
    {
      id: 1,
      module: 1,
      module_name: "Incident Management",
      name: "Incident Resolution Rate",
      aggregation: "percentage",
      target_operator: ">=",
      target_value: 95,
      value_type: "percentage",
      is_active: true,
      description: "Percentage of incidents resolved.",
      business_meaning:
        "Measures the percentage of incidents successfully resolved."
    },

    {
      id: 2,
      module: 1,
      module_name: "Incident Management",
      name: "Critical Incident Rate",
      aggregation: "percentage",
      target_operator: "<=",
      target_value: 5,
      value_type: "percentage",
      is_active: true,
      description: "Percentage of incidents classified as critical.",
      business_meaning:
        "Measures the proportion of critical incidents."
    },

    {
      id: 3,
      module: 2,
      module_name: "Service Requests",
      name: "Request Resolution Time",
      aggregation: "avg",
      target_operator: "<=",
      target_value: 24,
      value_type: "duration",
      is_active: true,
      description: "Average request resolution time.",
      business_meaning:
        "Measures how quickly service requests are fulfilled."
    },

    {
      id: 4,
      module: 2,
      module_name: "Service Requests",
      name: "Request Satisfaction",
      aggregation: "percentage",
      target_operator: ">=",
      target_value: 90,
      value_type: "percentage",
      is_active: true,
      description: "User satisfaction score.",
      business_meaning:
        "Measures end-user satisfaction with fulfilled requests."
    }
  ];

  const isGithubPages =
  window.location.hostname === "lina-jm.github.io";

  const fetchKpis = async () => {
    if (isGithubPages) {
      setKpis(demoKpis);
      return;
    }

    try {
      const res = await api.get("kpis/");
      setKpis(res.data || []);
    } catch (err) {
      console.error(err);
      setError("Failed to load KPIs.");
    }
  };

  const fetchModules = async () => {
    try {
      const res = await api.get("modules/");
      setModules((res.data || []).filter((module) => module.is_active));
    } catch (err) {
      console.error(err);
      setModules([]);
    }
  };

  const fetchModuleFields = async (moduleId, setter) => {
    if (!moduleId) {
      setter([]);
      return;
    }

    try {
      const res = await api.get(`modules/${moduleId}/fields/`);
      setter(res.data || []);
    } catch (err) {
      console.error(err);
      setter([]);
    }
  };

  const fetchFilterValues = async ({
    moduleId,
    fieldName,
    search,
    index,
    setter,
  }) => {
    if (!moduleId || !fieldName) {
      setter((prev) => ({ ...prev, [index]: [] }));
      return;
    }

    try {
      const res = await api.get("field-values/", {
        params: {
          module_id: moduleId,
          field: fieldName,
          search: search || "",
          limit: 50,
        },
      });

      setter((prev) => ({
        ...prev,
        [index]: res.data?.values || [],
      }));
    } catch (err) {
      console.error(err);
      setter((prev) => ({ ...prev, [index]: [] }));
    }
  };

  useEffect(() => {
    fetchKpis();
    fetchModules();
  }, []);

  useEffect(() => {
    const handleModulesUpdated = () => {
      fetchModules();
    };

    window.addEventListener("modules-updated", handleModulesUpdated);

    return () => {
      window.removeEventListener("modules-updated", handleModulesUpdated);
    };
  }, []);

  useEffect(() => {
    fetchModuleFields(createForm.module, setCreateFields);
  }, [createForm.module]);

  useEffect(() => {
    fetchModuleFields(editForm.module, setEditFields);
  }, [editForm.module]);

  useEffect(() => {
    createForm.filters.forEach((filter, index) => {
      fetchFilterValues({
        moduleId: createForm.module,
        fieldName: filter.field,
        search: createFilterSearch[index] || "",
        index,
        setter: setCreateFilterValues,
      });
    });
  }, [createForm.module, createForm.filters, createFilterSearch]);

  useEffect(() => {
    editForm.filters.forEach((filter, index) => {
      fetchFilterValues({
        moduleId: editForm.module,
        fieldName: filter.field,
        search: editFilterSearch[index] || "",
        index,
        setter: setEditFilterValues,
      });
    });
  }, [editForm.module, editForm.filters, editFilterSearch]);

  const filteredKpis = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return kpis;

    return kpis.filter((kpi) => {
      return (
        (kpi.name || "").toLowerCase().includes(q) ||
        (kpi.description || "").toLowerCase().includes(q) ||
        (kpi.business_meaning || "").toLowerCase().includes(q) ||
        (kpi.module_name || "").toLowerCase().includes(q) ||
        (kpi.aggregation || "").toLowerCase().includes(q) 
      );
    });
  }, [kpis, searchTerm]);

  const groupedKpis = useMemo(() => {
    const groups = {};

    filteredKpis.forEach((kpi) => {
      const moduleName = kpi.module_name || "Unassigned Module";
      if (!groups[moduleName]) groups[moduleName] = [];
      groups[moduleName].push(kpi);
    });

    return groups;
  }, [filteredKpis]);

  const numericCreateFields = useMemo(
    () => createFields.filter((f) => f.field_type === "number"),
    [createFields]
  );

  const numericEditFields = useMemo(
    () => editFields.filter((f) => f.field_type === "number"),
    [editFields]
  );

  const normalizeFiltersForApi = (filters) => {
    return (filters || [])
      .filter((filter) => filter.field && filter.operator && filter.value !== "")
      .map((filter, index) => ({
        field: filter.field,
        operator: filter.operator,
        value: filter.value,
        logic: index === 0 ? "" : filter.logic || "AND",
      }));
  };

  const handleOpenCreate = () => {
    setCreateForm(emptyForm());
    setCreateFields([]);
    setCreateFilterValues({});
    setCreateFilterSearch({});
    setCreateError("");
    setOpenCreateDialog(true);
  };

  const handleCloseCreate = () => {
    setOpenCreateDialog(false);
    setCreateError("");
  };

  const handleOpenEdit = (kpi) => {
    const initialFilters =
      Array.isArray(kpi.filters) && kpi.filters.length > 0
        ? kpi.filters.map((filter, index) => ({
            field: filter.field || "",
            operator: filter.operator || "=",
            value: filter.value || "",
            logic: index === 0 ? "AND" : filter.logic || "AND",
          }))
        : [emptyFilter()];

    setSelectedKpi(kpi);
    setEditForm({
      module: kpi.module || "",
      name: kpi.name || "",
      aggregation: kpi.aggregation || "count",
      field: kpi.field || "",
      filters: initialFilters,
      reporting_date_field: kpi.reporting_date_field || "",
      group_by: kpi.group_by || "",
      limit: kpi.limit ?? "",
      description: kpi.description || "",
      target_operator: kpi.target_operator || "=",
      target_value: kpi.target_value ?? "",
      value_type: kpi.value_type || "number",
      is_active: !!kpi.is_active,
      business_meaning: kpi.business_meaning || "",
    });

    setEditFilterValues({});
    setEditFilterSearch({});
    setEditError("");
    setOpenEditDialog(true);
  };

  const handleCloseEdit = () => {
    setOpenEditDialog(false);
    setSelectedKpi(null);
    setEditError("");
  };

  const handleOpenView = (kpi) => {
    setViewKpi(kpi);
    setOpenViewDialog(true);
  };

  const handleCloseView = () => {
    setOpenViewDialog(false);
    setViewKpi(null);
  };

  const handleCreateKpi = async () => {
    if (!canCreateKpi) {
      setCreateError("You do not have permission to create KPIs.");
      return;
    }
    if (
      !createForm.module ||
      !createForm.name.trim() ||
      !createForm.aggregation ||
      createForm.target_value === "" ||
      !createForm.reporting_date_field
    ) {
      setCreateError("Module, KPI name, aggregation, target, and reporting date field are required.");
      return;
    }

    if (aggregationNeedsField(createForm.aggregation) && !createForm.field) {
      setCreateError("This aggregation requires a numeric field.");
      return;
    }

    setCreateLoading(true);
    setCreateError("");

    try {
      await api.post("kpis/", {
        module: Number(createForm.module),
        name: createForm.name.trim(),
        aggregation: createForm.aggregation,
        field: createForm.field ? Number(createForm.field) : null,
        filters: normalizeFiltersForApi(createForm.filters),
        reporting_date_field: createForm.reporting_date_field
          ? Number(createForm.reporting_date_field)
          : null,
        group_by: createForm.group_by ? Number(createForm.group_by) : null,
        limit: createForm.limit === "" ? null : Number(createForm.limit),
        description: createForm.description.trim(),
        business_meaning: createForm.business_meaning.trim(),
        target_operator: createForm.target_operator,
        target_value: Number(createForm.target_value),
        value_type: createForm.value_type,
        is_active: createForm.is_active,
      });

      await fetchKpis();
      window.dispatchEvent(new Event("kpis-updated"));
      handleCloseCreate();
    } catch (err) {
      console.error(err);
      setCreateError(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          JSON.stringify(err.response?.data) ||
          "Failed to create KPI."
      );
    } finally {
      setCreateLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!selectedKpi) return;

    if (!canEditKpi) {
      setEditError("You do not have permission to edit KPIs.");
      return;
    }

    if (
      !editForm.module ||
      !editForm.name.trim() ||
      !editForm.aggregation ||
      editForm.target_value === "" ||
      !editForm.reporting_date_field
    ) {
      setEditError("Module, KPI name, aggregation, target, and reporting date field are required.");
      return;
    }

    if (aggregationNeedsField(editForm.aggregation) && !editForm.field) {
      setEditError("This aggregation requires a numeric field.");
      return;
    }

    setEditLoading(true);
    setEditError("");

    try {
      await api.patch(`kpis/${selectedKpi.id}/`, {
        module: Number(editForm.module),
        name: editForm.name.trim(),
        aggregation: editForm.aggregation,
        field: editForm.field ? Number(editForm.field) : null,
        filters: normalizeFiltersForApi(editForm.filters),
        reporting_date_field: editForm.reporting_date_field
          ? Number(editForm.reporting_date_field)
          : null,
        group_by: editForm.group_by ? Number(editForm.group_by) : null,
        limit: editForm.limit === "" ? null : Number(editForm.limit),
        description: editForm.description.trim(),
        business_meaning: editForm.business_meaning.trim(),
        target_operator: editForm.target_operator,
        target_value: Number(editForm.target_value),
        value_type: editForm.value_type,
        is_active: editForm.is_active,
      });

      await fetchKpis();
      window.dispatchEvent(new Event("kpis-updated"));
      handleCloseEdit();
    } catch (err) {
      console.error(err);
      setEditError(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          JSON.stringify(err.response?.data) ||
          "Failed to update KPI."
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleActive = async (kpi) => {
    if (!canActivateKpis) return;

    try {
      await api.patch(`kpis/${kpi.id}/`, {
        is_active: !kpi.is_active,
      });

      setKpis((prev) =>
        prev.map((item) =>
          item.id === kpi.id
            ? { ...item, is_active: !item.is_active }
            : item
        )
      );

      window.dispatchEvent(new Event("kpis-updated"));
    } catch (err) {
      console.error(err);

      setError(
        err.response?.data?.detail ||
        err.response?.data?.error ||
        "Failed to update KPI status."
      );
    }
  };

  const getChartLabel = (chartType) => {
    const normalized = normalizeChartType(chartType);
    const found = chartTypeOptions.find((item) => item.value === normalized);
    return found ? found.label : normalized;
  };

  const updateFilterRow = (form, setForm, index, key, value) => {
    const updated = [...form.filters];
    updated[index] = {
      ...updated[index],
      [key]: value,
      ...(key === "field" ? { value: "" } : {}),
    };

    setForm((prev) => ({
      ...prev,
      filters: updated,
    }));
  };

  const addFilterRow = (setForm) => {
    setForm((prev) => ({
      ...prev,
      filters: [...prev.filters, emptyFilter()],
    }));
  };

  const removeFilterRow = (form, setForm, index) => {
    const updated = form.filters.filter((_, i) => i !== index);

    setForm((prev) => ({
      ...prev,
      filters: updated.length > 0 ? updated : [emptyFilter()],
    }));
  };

  const renderFieldSelectors = ({
    form,
    setForm,
    fields,
    numericFields,
    filterValues,
    setFilterSearch,
  }) => (
    <>
      {aggregationNeedsField(form.aggregation) && (
        <Autocomplete
          options={numericFields}
          getOptionLabel={(option) => option.field_name || ""}
          value={
            numericFields.find((f) => f.id === Number(form.field)) || null
          }
          onChange={(event, newValue) =>
            setForm((prev) => ({
              ...prev,
              field: newValue ? newValue.id : "",
            }))
          }
          renderInput={(params) => (
            <TextField {...params} label="Measure Field" fullWidth />
          )}
        />
      )}

      <Box>
        <Typography fontWeight="bold" mb={1}>
          Filters
        </Typography>

        <Stack spacing={1.5}>
          {form.filters.map((filter, index) => (
            <Box
              key={index}
              display="flex"
              gap={1}
              alignItems={{ xs: "stretch", sm: "center" }}
              flexDirection={{ xs: "column", sm: "row" }}
            >
              {index > 0 && (
                <FormControl sx={{ minWidth: 90 }}>
                  <Select
                    size="small"
                    value={filter.logic || "AND"}
                    onChange={(e) =>
                      updateFilterRow(
                        form,
                        setForm,
                        index,
                        "logic",
                        e.target.value
                      )
                    }
                  >
                    {logicOptions.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}

              <Autocomplete
                options={fields}
                getOptionLabel={(option) => option.field_name || ""}
                value={
                  fields.find((f) => f.field_name === filter.field) || null
                }
                sx={{ width: { xs: "100%", sm: 180 } }}
                onChange={(event, newValue) =>
                  updateFilterRow(
                    form,
                    setForm,
                    index,
                    "field",
                    newValue ? newValue.field_name : ""
                  )
                }
                renderInput={(params) => (
                  <TextField {...params} size="small" label="Filter Field" />
                )}
              />

              <FormControl sx={{ width: { xs: "100%", sm: 140 } }}>
                <Select
                  size="small"
                  value={filter.operator}
                  onChange={(e) =>
                    updateFilterRow(
                      form,
                      setForm,
                      index,
                      "operator",
                      e.target.value
                    )
                  }
                >
                  {filterOperatorOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Autocomplete
                freeSolo
                disabled={!filter.field}
                options={filterValues[index] || []}
                value={filter.value || ""}
                sx={{ width: { xs: "100%", sm: 220 } }}
                onChange={(event, newValue) => {
                  updateFilterRow(form, setForm, index, "value", newValue || "");
                }}
                onInputChange={(event, newInputValue) => {
                  setFilterSearch((prev) => ({
                    ...prev,
                    [index]: newInputValue,
                  }));
                  updateFilterRow(
                    form,
                    setForm,
                    index,
                    "value",
                    newInputValue || ""
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    size="small"
                    label="Filter Value"
                    placeholder={
                      filter.field ? "Search/select value" : "Select field first"
                    }
                  />
                )}
              />

              <IconButton
                color="error"
                onClick={() => removeFilterRow(form, setForm, index)}
              >
                <DeleteOutlineIcon />
              </IconButton>
            </Box>
          ))}
        </Stack>

        <Button
          sx={{ mt: 1 }}
          size="small"
          startIcon={<AddIcon />}
          onClick={() => addFilterRow(setForm)}
        >
          Add Filter
        </Button>
      </Box>
      <Autocomplete
        options={fields.filter(isDateLikeField)}
        getOptionLabel={(option) => option.field_name || ""}
        value={
          fields.find((f) => f.id === Number(form.reporting_date_field)) || null
        }
        onChange={(event, newValue) =>
          setForm((prev) => ({
            ...prev,
            reporting_date_field: newValue ? newValue.id : "",
          }))
        }
        renderInput={(params) => (
          <TextField {...params} label="Reporting Date Field *" fullWidth />
        )}
      />
      <Autocomplete
        options={fields}
        getOptionLabel={(option) => option.field_name || ""}
        value={
          fields.find((f) => f.id === Number(form.group_by)) || null
        }
        onChange={(event, newValue) =>
          setForm((prev) => ({
            ...prev,
            group_by: newValue ? newValue.id : "",
          }))
        }
        renderInput={(params) => (
          <TextField {...params} label="Group By" fullWidth />
        )}
      />

      <TextField
        label="Limit"
        type="number"
        value={form.limit}
        onChange={(e) =>
          setForm((prev) => ({ ...prev, limit: e.target.value }))
        }
        fullWidth
      />
    </>
  );

  return (
    <Box>
      <Box
        mb={3}
        display="flex"
        justifyContent="space-between"
        alignItems="flex-start"
        flexWrap="wrap"
        gap={2}
      >
        <Box>
          <Typography variant="h4" fontWeight="bold">
            KPIs
          </Typography>
        </Box>

        {canCreateKpi && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenCreate}
            fullWidth={isMobile}
          >
            Create New KPI
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <TextField
            placeholder="Search KPIs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            sx={{ width: { xs: "100%", sm: 320 } }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </CardContent>
      </Card>

      {Object.keys(groupedKpis).length === 0 ? (
        <Card>
          <CardContent>
            <Typography color="text.secondary">No KPIs found.</Typography>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedKpis).map(([moduleName, moduleKpis]) => (
          <Card key={moduleName} sx={{ mb: 3, borderRadius: 3 }}>
            <CardContent>
              <Typography variant="h5" fontWeight="bold" mb={3}>
                {moduleName}
              </Typography>

              <Stack spacing={2}>
                {moduleKpis.map((kpi) => (
                  <Card key={kpi.id} variant="outlined" sx={{ borderRadius: 3 }}>
                    <CardContent>
                      <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        gap={2}
                        flexWrap="wrap"
                      >
                        <Box flex={1}>
                          <Box
                            display="flex"
                            alignItems="center"
                            gap={1}
                            flexWrap="wrap"
                            mb={1}
                          >
                            <Typography variant="h6" fontWeight="bold">
                              {kpi.name}
                            </Typography>

                            <Chip
                              label={kpi.is_active ? "Active" : "Inactive"}
                              size="small"
                              color={kpi.is_active ? "success" : "default"}
                            />
                          </Box>

                          <Typography
                            variant="body2"
                            color="text.secondary"
                            mb={1}
                          >
                            {kpi.description || "No description provided."}
                          </Typography>

                          <Typography variant="body2" color="text.secondary">
                            Aggregation: {kpi.aggregation} | Target:{" "}
                            {kpi.target_operator || "="}{" "}
                            {kpi.target_value ?? "-"} | Value Type:{" "}
                            {kpi.value_type}
                          </Typography>
                        </Box>

                        <Stack direction={{ xs: "column", sm: "row" }} spacing={1}  alignItems={{ xs: "stretch", sm: "center" }} sx={{ width: { xs: "100%", sm: "auto" } }}>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<VisibilityOutlinedIcon />}
                            onClick={() => handleOpenView(kpi)}
                            fullWidth={isMobile}
                          >
                            View
                          </Button>
                          {canEditKpi && (
                            <IconButton onClick={() => handleOpenEdit(kpi)}>
                              <EditOutlinedIcon />
                            </IconButton>
                          )}

                          {canActivateKpis && (
                            <Box display="flex" alignItems="center">
                              <Switch
                                checked={!!kpi.is_active}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  handleToggleActive(kpi);
                                }}
                              />
                            </Box>
                          )}
                        </Stack>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            </CardContent>
          </Card>
        ))
      )}

      <Dialog
        open={openViewDialog}
        onClose={handleCloseView}
        fullWidth={isMobile}
        maxWidth="sm"
      >
        <DialogTitle>KPI Details</DialogTitle>

        <DialogContent>
          {viewKpi && (
            <Stack spacing={2} mt={1}>
              <Typography>
                <strong>Name:</strong> {viewKpi.name}
              </Typography>

              <Typography>
                <strong>Module:</strong> {viewKpi.module_name || "-"}
              </Typography>

              <Typography>
                <strong>Aggregation:</strong> {viewKpi.aggregation || "-"}
              </Typography>

              <Typography>
                <strong>Measure Field:</strong> {viewKpi.field_name || viewKpi.field || "-"}
              </Typography>

              <Typography>
                <strong>Group By:</strong> {viewKpi.group_by_name || viewKpi.group_by || "-"}
              </Typography>

              <Typography>
                <strong>Target:</strong> {viewKpi.target_operator || "="}{" "}
                {viewKpi.target_value ?? "-"}
              </Typography>

              <Typography>
                <strong>Value Type:</strong> {viewKpi.value_type || "-"}
              </Typography>

              <Typography>
                <strong>Status:</strong> {viewKpi.is_active ? "Active" : "Inactive"}
              </Typography>

              <Box>
                <Typography fontWeight="bold" mb={0.5}>
                  Filters
                </Typography>

                {(viewKpi.filters || []).length > 0 ? (
                  <Stack spacing={0.5}>
                    {viewKpi.filters.map((filter, index) => (
                      <Typography key={index} variant="body2">
                        {index === 0 ? "" : filter.logic || "AND"} {filter.field}{" "}
                        {filter.operator} {filter.value}
                      </Typography>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No filters.
                  </Typography>
                )}
              </Box>

              <Typography>
                <strong>Description:</strong>{" "}
                {viewKpi.description || "No description"}
              </Typography>
              <Typography>
                <strong>Business Meaning:</strong>{" "}
                {viewKpi.business_meaning || "Auto-generated / not provided"}
              </Typography>
            </Stack>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            flexDirection: { xs: "column-reverse", sm: "row" },
            alignItems: { xs: "stretch", sm: "center" },
            px: 3,
            pb: 2,
          }}
        >
          <Button onClick={handleCloseView}>Close</Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={openCreateDialog}
        onClose={handleCloseCreate}
        fullWidth={isMobile}
        maxWidth="sm"
      >
        <DialogTitle>Create New KPI</DialogTitle>

        <DialogContent>
          <Stack spacing={2} mt={1}>
            {createError && <Alert severity="error" onClose={() => setCreateError("")}>
              {createError}
            </Alert>}

            <FormControl fullWidth>
              <InputLabel>Module</InputLabel>
              <Select
                value={createForm.module}
                label="Module"
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    module: e.target.value,
                    field: "",
                    filters: [emptyFilter()],
                    reporting_date_field: "",
                    group_by: "",
                    limit: "",
                  }))
                }
              >
                {modules.map((module) => (
                  <MenuItem key={module.id} value={module.id}>
                    {module.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="KPI Name"
              value={createForm.name}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, name: e.target.value }))
              }
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Aggregation</InputLabel>
              <Select
                value={createForm.aggregation}
                label="Aggregation"
                onChange={(e) => {
                  const aggregation = e.target.value;

                  setCreateForm((prev) => ({
                    ...prev,
                    aggregation,
                    field: "",
                    value_type: aggregation === "percentage" ? "percentage" : prev.value_type,
                  }));
                }}
              >
                {aggregationOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {renderFieldSelectors({
              form: createForm,
              setForm: setCreateForm,
              fields: createFields,
              numericFields: numericCreateFields,
              filterValues: createFilterValues,
              setFilterSearch: setCreateFilterSearch,
            })}

            <FormControl fullWidth>
              <InputLabel>Target Operator</InputLabel>
              <Select
                value={createForm.target_operator}
                label="Target Operator"
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    target_operator: e.target.value,
                  }))
                }
              >
                {targetOperatorOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Target Value"
              type="number"
              value={createForm.target_value}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  target_value: e.target.value,
                }))
              }
              fullWidth
            />
          

            <FormControl fullWidth>
              <InputLabel>Value Type</InputLabel>
              <Select
                value={createForm.value_type}
                label="Value Type"
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    value_type: e.target.value,
                  }))
                }
              >
                {valueTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Description"
              value={createForm.description}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              multiline
              minRows={3}
              fullWidth
            />
            <TextField
              label="Business Meaning"
              value={createForm.business_meaning}
              onChange={(e) =>
                setCreateForm((prev) => ({
                  ...prev,
                  business_meaning: e.target.value,
                }))
              }
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            flexDirection: { xs: "column-reverse", sm: "row" },
            alignItems: { xs: "stretch", sm: "center" },
            px: 3,
            pb: 2,
          }}
        > 
          <Button onClick={handleCloseCreate}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateKpi}
            disabled={createLoading}
          >
            {createLoading ? "Creating..." : "Create KPI"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openEditDialog}
        onClose={handleCloseEdit}
        fullWidth={isMobile}
        maxWidth="sm"
      >
        <DialogTitle>Edit KPI</DialogTitle>

        <DialogContent>
          <Stack spacing={2} mt={1}>
            {editError && <Alert severity="error" onClose={() => setEditError("")}>
              {editError}
            </Alert>}

            <FormControl fullWidth>
              <InputLabel>Module</InputLabel>
              <Select
                value={editForm.module}
                label="Module"
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    module: e.target.value,
                    field: "",
                    filters: [emptyFilter()],
                    reporting_date_field: "",
                    group_by: "",
                    limit: "",
                  }))
                }
              >
                {modules.map((module) => (
                  <MenuItem key={module.id} value={module.id}>
                    {module.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="KPI Name"
              value={editForm.name}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, name: e.target.value }))
              }
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Aggregation</InputLabel>
              <Select
                value={editForm.aggregation}
                label="Aggregation"
                onChange={(e) => {
                  const aggregation = e.target.value;

                  setEditForm((prev) => ({
                    ...prev,
                    aggregation,
                    field: "",
                    value_type: aggregation === "percentage" ? "percentage" : prev.value_type,
                  }));
                }}
              >
                {aggregationOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            {renderFieldSelectors({
              form: editForm,
              setForm: setEditForm,
              fields: editFields,
              numericFields: numericEditFields,
              filterValues: editFilterValues,
              setFilterSearch: setEditFilterSearch,
            })}

            <FormControl fullWidth>
              <InputLabel>Target Operator</InputLabel>
              <Select
                value={editForm.target_operator}
                label="Target Operator"
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    target_operator: e.target.value,
                  }))
                }
              >
                {targetOperatorOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Target Value"
              type="number"
              value={editForm.target_value}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  target_value: e.target.value,
                }))
              }
              fullWidth
            />

            <FormControl fullWidth>
              <InputLabel>Value Type</InputLabel>
              <Select
                value={editForm.value_type}
                label="Value Type"
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    value_type: e.target.value,
                  }))
                }
              >
                {valueTypeOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Description"
              value={editForm.description}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  description: e.target.value,
                }))
              }
              multiline
              minRows={3}
              fullWidth
            />
            <TextField
              label="Business Meaning"
              value={editForm.business_meaning}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  business_meaning: e.target.value,
                }))
              }
              multiline
              minRows={3}
              fullWidth
            />
          </Stack>
        </DialogContent>

        <DialogActions
          sx={{
            flexDirection: { xs: "column-reverse", sm: "row" },
            alignItems: { xs: "stretch", sm: "center" },
            px: 3,
            pb: 2,
          }}
        > 
          <Button onClick={handleCloseEdit}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={editLoading}
          >
            {editLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}