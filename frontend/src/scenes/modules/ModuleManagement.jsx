import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  Switch,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import AddIcon from "@mui/icons-material/Add";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CloseIcon from "@mui/icons-material/Close";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import api from "../../api/axios";

export default function ModuleManagement() {
  const isDemo = window.location.hostname.includes("github.io");
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  }, []);

  const currentRole = storedUser?.role || null;
  const canManageModules = currentRole === "administrator";

  const [modules, setModules] = useState([]);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [selectedModule, setSelectedModule] = useState(null);

  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [createForm, setCreateForm] = useState({
    name: "",
    description: "",
    file: null,
  });

  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editSuccess, setEditSuccess] = useState("");
  const [editForm, setEditForm] = useState({
    name: "",
    description: "",
    file: null,
  });
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!warning) return;
    const timer = setTimeout(() => setWarning(""), 5000);
    return () => clearTimeout(timer);
  }, [warning]);

  useEffect(() => {
    if (!createError) return;
    const timer = setTimeout(() => setCreateError(""), 5000);
    return () => clearTimeout(timer);
  }, [createError]);

  useEffect(() => {
    if (!createSuccess) return;
    const timer = setTimeout(() => setCreateSuccess(""), 3000);
    return () => clearTimeout(timer);
  }, [createSuccess]);

  useEffect(() => {
    if (!editError) return;
    const timer = setTimeout(() => setEditError(""), 5000);
    return () => clearTimeout(timer);
  }, [editError]);

  useEffect(() => {
    if (!editSuccess) return;
    const timer = setTimeout(() => setEditSuccess(""), 3000);
    return () => clearTimeout(timer);
  }, [editSuccess]);

  const [activationLoadingId, setActivationLoadingId] = useState(null);

  const demoModules = [
    {
      id: 1,
      name: "Incident Management",
      description:
        "Monitor incident creation, resolution times, SLA compliance and critical incidents.",
      is_active: true,
      created_by_username: "admin",
      updated_by_username: "admin",
    },
    {
      id: 2,
      name: "Service Requests",
      description:
        "Track service request performance, satisfaction and resolution efficiency.",
      is_active: true,
      created_by_username: "admin",
      updated_by_username: "admin",
    },
    {
      id: 3,
      name: "Knowledge Management",
      description:
        "Measure article usage, self-service adoption and knowledge effectiveness.",
      is_active: true,
      created_by_username: "admin",
      updated_by_username: "admin",
    },
    {
      id: 4,
      name: "Change Management",
      description:
        "Track change success rate, failed changes and emergency changes.",
      is_active: true,
      created_by_username: "admin",
      updated_by_username: "admin",
    },
  ];

  const fetchModules = async () => {
    try {
      if (isDemo) {
        setModules(demoModules);
        return;
      }

      const res = await api.get("modules/");
      setModules(res.data);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to load modules.");
    }
  };

  useEffect(() => {
    fetchModules();
  }, []);

  const filteredModules = useMemo((

  ) => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return modules;

    return modules.filter((module) => {
      return (
        (module.name || "").toLowerCase().includes(q) ||
        (module.description || "").toLowerCase().includes(q)
      );
    });
  }, [modules, searchTerm]);

  const activeModules = filteredModules.filter((m) => m.is_active);
  const inactiveModules = filteredModules.filter((m) => !m.is_active);

  const totalModules = modules.length;
  const totalActiveModules = modules.filter((m) => m.is_active).length;
  const totalInactiveModules = modules.filter((m) => !m.is_active).length;

  const handleOpenView = (module) => {
    setSelectedModule(module);
    setOpenViewDialog(true);
  };

  const handleCloseView = () => {
    setSelectedModule(null);
    setOpenViewDialog(false);
  };

  const handleOpenCreate = () => {
    setCreateForm({
      name: "",
      description: "",
      file: null,
    });
    setCreateError("");
    setCreateSuccess("");
    setWarning("");
    setOpenCreateDialog(true);
  };

  const handleCloseCreate = () => {
    setOpenCreateDialog(false);
    setCreateError("");
    setCreateSuccess("");
    setCreateForm({
      name: "",
      description: "",
      file: null,
    });
  };

  const handleCreateModule = async () => {
    if (!createForm.name.trim()) {
      setCreateError("Module name is required.");
      return;
    }

    setCreateLoading(true);
    setCreateError("");
    setCreateSuccess("");
    setWarning("");
    setError("");

    try {
      const res = await api.post("modules/", {
        name: createForm.name.trim(),
        description: createForm.description.trim(),
      });

      if (createForm.file) {
        const formData = new FormData();
        formData.append("file", createForm.file);

        await api.post(`modules/${res.data.id}/upload-file/`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        setCreateSuccess("Module created and file uploaded successfully.");
      } else {
        setCreateSuccess("Module created successfully.");
      }

      await fetchModules();
      window.dispatchEvent(new Event("modules-updated"));

      if (res.data?.warning) {
        setWarning(res.data.warning);
      }

      setCreateForm({
        name: "",
        description: "",
        file: null,
      });
    } catch (err) {
      console.error(err);
      setCreateError(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          "Failed to create module."
      );
    } finally {
      setCreateLoading(false);
    }
  };

  const handleOpenEdit = (module) => {
    setSelectedModule(module);
    setEditForm({
      name: module.name || "",
      description: module.description || "",
      file: null,
    });
    setEditError("");
    setEditSuccess("");
    setWarning("");
    setOpenEditDialog(true);
  };

  const handleCloseEdit = () => {
    setOpenEditDialog(false);
    setSelectedModule(null);
    setEditError("");
    setEditSuccess("");
    setEditForm({
      name: "",
      description: "",
      file: null,
    });
  };

  const handleSaveEdit = async () => {
    if (!selectedModule) return;

    if (!editForm.name.trim()) {
      setEditError("Module name is required.");
      return;
    }

    setEditLoading(true);
    setEditError("");
    setEditSuccess("");
    setWarning("");
    setError("");

    try {
      const res = await api.put(`modules/${selectedModule.id}/update/`, {
        name: editForm.name.trim(),
        description: editForm.description.trim(),
        is_active: selectedModule.is_active,
      });

      if (editForm.file) {
        const formData = new FormData();
        formData.append("file", editForm.file);

        await api.post(`modules/${selectedModule.id}/upload-file/`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        });

        setEditSuccess("Module updated and file uploaded successfully.");
      } else {
        setEditSuccess("Module updated successfully.");
      }

      await fetchModules();
      window.dispatchEvent(new Event("modules-updated"));

      if (res.data?.warning) {
        setWarning(res.data.warning);
      }

      setEditForm((prev) => ({
        ...prev,
        file: null,
      }));
    } catch (err) {
      console.error(err);
      setEditError(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          "Failed to update module."
      );
    } finally {
      setEditLoading(false);
    }
  };

  const handleToggleActive = async (module) => {
    setActivationLoadingId(module.id);
    setError("");
    setWarning("");

    try {
      await api.patch(`modules/${module.id}/activation/`, {
        is_active: !module.is_active,
      });

      await fetchModules();
      window.dispatchEvent(new Event("modules-updated"));
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to update module status.");
    } finally {
      setActivationLoadingId(null);
    }
  };

  const renderModuleCard = (module) => (
    <Grid item xs={12} md={6} xl={4} key={module.id}>
      <Card sx={{ height: "100%", borderRadius: 3 }}>
        <CardContent sx={{ p: 3 }}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems={{ xs: "stretch", sm: "center" }}
            flexDirection={{xs: "column", sm: "row"}}
            gap={2}
          >
            <Box>
              <Typography variant="h6" fontWeight="bold">
                {module.name}
              </Typography>
            </Box>

            <Chip
              label={module.is_active ? "Active" : "Inactive"}
              color={module.is_active ? "success" : "default"}
              size="small"
            />
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {module.description || "No description provided."}
          </Typography>

          <Divider sx={{ my: 2 }} />

          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            gap={2}
            flexWrap="wrap"
          >
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              <Button
                size="small"
                variant="outlined"
                startIcon={<VisibilityOutlinedIcon />}
                onClick={() => handleOpenView(module)}
              >
                View
              </Button>

              {canManageModules && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<EditOutlinedIcon />}
                  onClick={() => handleOpenEdit(module)}
                >
                  Edit
                </Button>
              )}
            </Stack>

            {canManageModules && (
              <Box display="flex" alignItems="center" gap={1}>
                <Typography variant="body2" color="text.secondary">
                  {module.is_active ? "Deactivate" : "Activate"}
                </Typography>
                <Switch
                  checked={module.is_active}
                  disabled={activationLoadingId === module.id}
                  onChange={() => handleToggleActive(module)}
                />
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>
    </Grid>
  );

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Modules
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      {warning && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setWarning("")}>
          {warning}
        </Alert>
      )}

      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Total Modules
              </Typography>
              <Typography variant="h3" fontWeight="bold">
                {totalModules}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Active Modules
              </Typography>
              <Typography variant="h3" fontWeight="bold">
                {totalActiveModules}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Inactive Modules
              </Typography>
              <Typography variant="h3" fontWeight="bold">
                {totalInactiveModules}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={2}
          >
            <TextField
              placeholder="Search modules..."
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

            {canManageModules && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenCreate}
                fullWidth={isMobile}
              >
                Add Module
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      <Box mb={4}>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          Active Modules
        </Typography>

        {activeModules.length === 0 ? (
          <Card>
            <CardContent>
              <Typography color="text.secondary">
                No active modules found.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {activeModules.map(renderModuleCard)}
          </Grid>
        )}
      </Box>

      <Box>
        <Typography variant="h6" fontWeight="bold" mb={2}>
          Inactive Modules
        </Typography>

        {inactiveModules.length === 0 ? (
          <Card>
            <CardContent>
              <Typography color="text.secondary">
                No inactive modules found.
              </Typography>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {inactiveModules.map(renderModuleCard)}
          </Grid>
        )}
      </Box>

      <Dialog open={openViewDialog} onClose={handleCloseView} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" justifyContent="space-between" alignItems="center">
            <Box>
              <Typography variant="h6" fontWeight="bold">
                Module Details
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Complete information about this module.
              </Typography>
            </Box>

            <IconButton onClick={handleCloseView}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {selectedModule && (
            <Stack spacing={2} mt={1}>
              <TextField
                label="Module Name"
                value={selectedModule.name || ""}
                fullWidth
                InputProps={{ readOnly: true }}
              />

              <TextField
                label="Description"
                value={selectedModule.description || ""}
                multiline
                minRows={3}
                fullWidth
                InputProps={{ readOnly: true }}
              />

              {canManageModules && (
                <>
                  
                  <TextField
                    label="Created By"
                    value={selectedModule.created_by_username || "-"}
                    fullWidth
                    InputProps={{ readOnly: true }}
                  />

                  <TextField
                    label="Last Updated By"
                    value={selectedModule.updated_by_username || "-"}
                    fullWidth
                    InputProps={{ readOnly: true }}
                  />
                </>
              )}

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Box mt={0.5}>
                  <Chip
                    label={selectedModule.is_active ? "Active" : "Inactive"}
                    color={selectedModule.is_active ? "success" : "default"}
                    size="small"
                  />
                </Box>
              </Box>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseView}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openCreateDialog} onClose={handleCloseCreate} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle>Add Module</DialogTitle>

        <DialogContent>
          <Stack spacing={2} mt={1}>
            {createError && <Alert severity="error" onClose={() => setCreateError("")}>
              {createError}
            </Alert>}
            {createSuccess && <Alert severity="success" onClose={() => setCreateSuccess("")}>
              {createSuccess}
            </Alert>}

            <TextField
              label="Module Name"
              value={createForm.name}
              onChange={(e) =>
                setCreateForm((prev) => ({ ...prev, name: e.target.value }))
              }
              fullWidth
            />
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

            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadFileIcon />}
            >
              {createForm.file
                ? createForm.file.name
                : "Upload fallback extracted file"}
              <input
                hidden
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) =>
                  setCreateForm((prev) => ({
                    ...prev,
                    file: e.target.files[0] || null,
                  }))
                }
              />
            </Button>

            <Typography variant="caption" color="text.secondary">
              Optional: use this when RPA extraction is unavailable and the admin
              needs to upload an extracted Excel/CSV file manually.
            </Typography>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseCreate}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateModule}
            disabled={createLoading}
          >
            {createLoading ? "Adding..." : "Add Module"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openEditDialog} onClose={handleCloseEdit} fullWidth maxWidth="sm" fullScreen={isMobile}>
        <DialogTitle>Edit Module</DialogTitle>

        <DialogContent>
          <Stack spacing={2} mt={1}>
            {editError && <Alert severity="error" onClose={() => setEditError("")}>
              {editError}
            </Alert>}
            {editSuccess && <Alert severity="success" onClose={() => setEditSuccess("")}>
              {editSuccess}
            </Alert>}

            <TextField
              label="Module Name"
              value={editForm.name}
              onChange={(e) =>
                setEditForm((prev) => ({ ...prev, name: e.target.value }))
              }
              fullWidth
            />
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

            <Button
              variant="outlined"
              component="label"
              startIcon={<UploadFileIcon />}
            >
              {editForm.file
                ? editForm.file.name
                : "Upload fallback extracted file"}
              <input
                hidden
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) =>
                  setEditForm((prev) => ({
                    ...prev,
                    file: e.target.files[0] || null,
                  }))
                }
              />
            </Button>

            <Typography variant="caption" color="text.secondary">
              Optional: upload a fallback extracted file manually if RPA is not
              available.
            </Typography>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ px: 3, pb: 2 }}>
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