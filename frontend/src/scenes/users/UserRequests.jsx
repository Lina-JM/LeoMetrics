import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import HighlightOffOutlinedIcon from "@mui/icons-material/HighlightOffOutlined";
import CloseIcon from "@mui/icons-material/Close";
import api from "../../api/axios";

function getStatusColor(status) {
  if (status === "approved") return "success";
  if (status === "rejected") return "error";
  return "warning";
}

function formatRoleLabel(roleName = "") {
  return roleName.replaceAll("_", " ");
}

function formatDate(dateString) {
  if (!dateString) return "-";

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString();
}

export default function UserRequests() {
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
  const currentEmail = storedUser?.email || "";
  const currentFullName = storedUser?.full_name || "";
  const isAdmin = role === "administrator";
  const hasPermission = (code) => {
    if (role === "administrator") return true;
    return storedUser?.app_permissions?.some((p) => p.code === code);
  };

  const canCreateRequest = hasPermission("create_request");

  const [requests, setRequests] = useState([]);
  const [roles, setRoles] = useState([]);
  const [permissions, setPermissions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("pending");

  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitMessage, setSubmitMessage] = useState("");

  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const [openApproveDialog, setOpenApproveDialog] = useState(false);
  const [approvalLoading, setApprovalLoading] = useState(false);
  const [approvalError, setApprovalError] = useState("");
  const [selectedApprovedPermissions, setSelectedApprovedPermissions] =
    useState([]);
  const [approvedRoleId, setApprovedRoleId] = useState("");
  const [approvalPermissions, setApprovalPermissions] = useState([]);
  const [openRejectDialog, setOpenRejectDialog] = useState(false);
  const [selectedRejectRequest, setSelectedRejectRequest] = useState(null);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [rejectError, setRejectError] = useState("");

  const [enterpriseOptions, setEnterpriseOptions] = useState([]);
  const [enterpriseSearchLoading, setEnterpriseSearchLoading] = useState(false);
  const [selectedEnterpriseUser, setSelectedEnterpriseUser] = useState(null);

  const [form, setForm] = useState({
    email: "",
    employee_id: "",
    full_name: "",
    enterprise_user: "",
    region: "",
    country: "",
    site: "",
    plant: "",
    department: "",
    requested_role: "",
    requested_permissions: [],
  });

  useEffect(() => {
    if (!pageError) return;

    const timer = setTimeout(() => {
      setPageError("");
    }, 5000);

    return () => clearTimeout(timer);
  }, [pageError]);

  useEffect(() => {
    if (!submitMessage) return;

    const timer = setTimeout(() => {
      setSubmitMessage("");
    }, 4000);

    return () => clearTimeout(timer);
  }, [submitMessage]);

  useEffect(() => {
    if (!approvalError) return;

    const timer = setTimeout(() => {
      setApprovalError("");
    }, 5000);

    return () => clearTimeout(timer);
  }, [approvalError]);

  useEffect(() => {
    if (!rejectError) return;

    const timer = setTimeout(() => {
      setRejectError("");
    }, 5000);

    return () => clearTimeout(timer);
  }, [rejectError]);

  const fetchRequests = async () => {
    setLoading(true);
    setPageError("");

    try {
      const res = await api.get("users/requests/");
      setRequests(res.data);
    } catch (err) {
      console.error("REQUEST LIST ERROR:", err.response?.data || err);
      setPageError("Failed to load requests.");
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get("users/roles/");
      setRoles(res.data);
    } catch (err) {
      console.error("ROLES ERROR:", err.response?.data || err);
      setPageError("Failed to load roles.");
    }
  };

  const fetchPermissionsForRole = async (roleId) => {
    if (!roleId) {
      setPermissions([]);
      return;
    }

    try {
      const res = await api.get(`users/roles/${roleId}/permissions/`);
      setPermissions(res.data.permissions || []);
    } catch (err) {
      console.error("ROLE PERMISSIONS ERROR:", err.response?.data || err);
      setPermissions([]);
      setPageError(
        err.response?.data?.error ||
          "Failed to load permissions for selected role."
      );
    }
  };

  const searchEnterpriseUsers = async (query) => {
    if (!query.trim()) {
      setEnterpriseOptions([]);
      return;
    }

    setEnterpriseSearchLoading(true);

    try {
      const res = await api.get(
        `users/enterprise-search/?q=${encodeURIComponent(query)}`
      );
      setEnterpriseOptions(res.data);
    } catch (err) {
      console.error(err);
      setEnterpriseOptions([]);
    } finally {
      setEnterpriseSearchLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
    fetchRequests();
  }, []);

  const allowedRoles = useMemo(() => {
    if (role === "contributor") {
      return roles.filter(
        (r) => r.name === "viewer" || r.name === "contributor"
      );
    }

    if (role === "administrator") {
      return roles.filter(
        (r) =>
          r.name === "viewer" ||
          r.name === "contributor" ||
          r.name === "administrator"
      );
    }

    return [];
  }, [roles, role]);

  useEffect(() => {
    if (!form.requested_role && allowedRoles.length > 0) {
      setForm((prev) => ({
        ...prev,
        requested_role: allowedRoles[0].id,
      }));
    }
  }, [allowedRoles, form.requested_role]);

  useEffect(() => {
    if (form.requested_role) {
      fetchPermissionsForRole(form.requested_role);
      setForm((prev) => ({
        ...prev,
        requested_permissions: [],
      }));
    }
  }, [form.requested_role]);

  const allPermissionDetailsMap = useMemo(() => {
    const map = {};

    permissions.forEach((perm) => {
      map[Number(perm.id)] = {
        id: Number(perm.id),
        codename: perm.codename,
        name: perm.name,
      };
    });

    requests.forEach((req) => {
      (req.requested_permissions || []).forEach((id) => {
        const key = Number(id);
        if (!map[key]) {
          map[key] = {
            id: key,
            codename: `permission_${key}`,
            name: `Permission #${key}`,
          };
        }
      });
    });

    return map;
  }, [permissions, requests]);

  const getPermissionLabels = (permissionIds = []) => {
    if (!Array.isArray(permissionIds) || permissionIds.length === 0) {
      return [];
    }

    return permissionIds.map((id) => {
      const key = Number(id);
      const found = allPermissionDetailsMap[key];

      return {
        id: key,
        label: found?.codename || `Permission #${key}`,
        secondary: found?.name || "",
      };
    });
  };

  const resetForm = () => {
    setForm({
      email: "",
      employee_id: "",
      full_name: "",
      enterprise_user: "",
      region: "",
      country: "",
      site: "",
      plant: "",
      department: "",
      requested_role: allowedRoles[0]?.id || "",
      requested_permissions: [],
    });
    setEnterpriseOptions([]);
    setSelectedEnterpriseUser(null);
    setSubmitMessage("");
  };

  const handleOpenCreate = () => {
    resetForm();
    setOpenCreateDialog(true);
  };

  const handleCloseCreate = () => {
    setOpenCreateDialog(false);
    resetForm();
  };

  const handleToggleRequestedPermission = (permissionId) => {
    const numericId = Number(permissionId);

    setForm((prev) => {
      const alreadySelected = prev.requested_permissions.includes(numericId);

      return {
        ...prev,
        requested_permissions: alreadySelected
          ? prev.requested_permissions.filter((id) => id !== numericId)
          : [...prev.requested_permissions, numericId],
      };
    });
  };

  const handleToggleApprovedPermission = (permissionId) => {
    const numericId = Number(permissionId);

    setSelectedApprovedPermissions((prev) => {
      const alreadySelected = prev.includes(numericId);

      return alreadySelected
        ? prev.filter((id) => id !== numericId)
        : [...prev, numericId];
    });
  };

  const handleSubmitRequest = async () => {
    if (!form.email || !form.full_name || !form.enterprise_user) {
      setSubmitMessage("Please select a valid enterprise user first.");
      return;
    }

    if (!form.requested_role) {
      setSubmitMessage("Please select a role.");
      return;
    }

    if (!form.requested_permissions || form.requested_permissions.length === 0) {
      setSubmitMessage("Please select at least one permission.");
      return;
    }

    setSubmitLoading(true);
    setSubmitMessage("");

    try {
      await api.post("users/requests/", {
        full_name: form.full_name,
        email: form.email,
        enterprise_user: form.enterprise_user,
        region: form.region,
        country: form.country,
        site: form.site,
        plant: form.plant,
        department: form.department,
        requested_role: form.requested_role,
        requested_permissions: form.requested_permissions,
      });

      handleCloseCreate();
      await fetchRequests();
    } catch (err) {
      console.error("CREATE REQUEST ERROR:", err.response?.data || err);
      setSubmitMessage(
        err.response?.data?.detail ||
          err.response?.data?.error ||
          "Failed to create request."
      );
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleOpenViewDialog = (request) => {
    setSelectedRequest(request);
    setOpenViewDialog(true);
  };

  const handleCloseViewDialog = () => {
    setOpenViewDialog(false);
    setSelectedRequest(null);
  };

  const handleOpenApproveDialog = async (request) => {
    setSelectedRequest(request);

    const roleObj = roles.find((r) => r.name === request.requested_role_name);
    const roleId = roleObj?.id || "";

    setApprovedRoleId(roleId);
    setSelectedApprovedPermissions(
      (request.requested_permissions || []).map((id) => Number(id))
    );

    setApprovalError("");
    setOpenApproveDialog(true);

    if (roleId) {
      const res = await api.get(`users/roles/${roleId}/permissions/`);
      setApprovalPermissions(res.data.permissions || []);
    }
  };

  const handleApprovedRoleChange = async (roleId) => {
    setApprovedRoleId(Number(roleId));
    setSelectedApprovedPermissions([]);

    const res = await api.get(`users/roles/${roleId}/permissions/`);
    setApprovalPermissions(res.data.permissions || []);
  };

  const handleCloseApproveDialog = () => {
    setOpenApproveDialog(false);
    setSelectedRequest(null);
    setSelectedApprovedPermissions([]);
    setApprovalPermissions([]);
    setApprovedRoleId("");
    setApprovalError("");
  };  

  const handleApprove = async () => {
    if (!selectedRequest) return;

    if (!selectedApprovedPermissions || selectedApprovedPermissions.length === 0) {
      setApprovalError("Please select at least one permission.");
      return;
    }

    setApprovalLoading(true);
    setApprovalError("");

    try {
      await api.post(`users/requests/${selectedRequest.id}/approve/`, {
        approved_role: approvedRoleId,
        approved_permissions: selectedApprovedPermissions,
      });

      handleCloseApproveDialog();
      await fetchRequests();
    } catch (err) {
      console.error("APPROVE ERROR:", err.response?.data || err);
      setApprovalError(
        err.response?.data?.error || "Failed to approve request."
      );
    } finally {
      setApprovalLoading(false);
    }
  };

  const handleOpenRejectDialog = (request) => {
    setSelectedRejectRequest(request);
    setRejectError("");
    setOpenRejectDialog(true);
  };

  const handleCloseRejectDialog = () => {
    setOpenRejectDialog(false);
    setSelectedRejectRequest(null);
    setRejectError("");
  };

  const handleConfirmReject = async () => {
    if (!selectedRejectRequest) return;

    setRejectLoading(true);
    setRejectError("");

    try {
      await api.post(`users/requests/${selectedRejectRequest.id}/reject/`);
      handleCloseRejectDialog();
      await fetchRequests();
    } catch (err) {
      console.error("REJECT ERROR:", err.response?.data || err);
      setRejectError(
        err.response?.data?.error || "Failed to reject request."
      );
    } finally {
      setRejectLoading(false);
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;
  const approvedCount = requests.filter((r) => r.status === "approved").length;
  const rejectedCount = requests.filter((r) => r.status === "rejected").length;

  const filteredRequests = useMemo(() => {
    let data = requests;

    if (activeTab === "pending") {
      data = data.filter((r) => r.status === "pending");
    } else if (activeTab === "approved") {
      data = data.filter((r) => r.status === "approved");
    } else if (activeTab === "rejected") {
      data = data.filter((r) => r.status === "rejected");
    }

    if (!searchTerm.trim()) return data;

    const q = searchTerm.toLowerCase();

    return data.filter((r) => {
      return (
        (r.full_name || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q) ||
        (r.employee_id || "").toLowerCase().includes(q) ||
        (r.department || "").toLowerCase().includes(q) ||
        (r.requested_role_name || "").toLowerCase().includes(q)
      );
    });
  }, [requests, activeTab, searchTerm]);

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Requests
        </Typography>
      </Box>

      {pageError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setPageError("")}>
          {pageError}
        </Alert>
      )}

      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Pending Requests
              </Typography>
              <Typography variant="h3" fontWeight="bold">
                {pendingCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Approved
              </Typography>
              <Typography variant="h3" fontWeight="bold">
                {approvedCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Rejected
              </Typography>
              <Typography variant="h3" fontWeight="bold">
                {rejectedCount}
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
            alignItems={{ xs: "stretch", sm: "center" }}
            flexDirection={{ xs: "column", sm: "row" }}
            gap={2}
          >
            <TextField
              placeholder="Search requests..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ width: { xs: "100%", sm: 280 } }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />

            {canCreateRequest && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenCreate}
                fullWidth={isMobile}
              >
                New Request
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent sx={{ p: 0 }}>
          <Tabs
            value={activeTab}
            onChange={(_, value) => setActiveTab(value)}
            sx={{ px: 2, pt: 1 }}
          >
            <Tab label={`Pending (${pendingCount})`} value="pending" />
            <Tab label={`Approved (${approvedCount})`} value="approved" />
            <Tab label={`Rejected (${rejectedCount})`} value="rejected" />
          </Tabs>

          <Divider />

          <Box sx={{ p: 2, overflowX: "auto" }}>
            {loading ? (
              <Typography>Loading requests...</Typography>
            ) : filteredRequests.length === 0 ? (
              <Typography color="text.secondary">No requests found.</Typography>
            ) : (
              <Table sx={{ minWidth: 950 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Request Date</TableCell>
                    <TableCell>Requested User</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Access Level</TableCell>
                    <TableCell>Requested By</TableCell>
                    <TableCell>Department</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredRequests.map((request) => {
                    const isOwnRequest =
                      request.requested_by_full_name === currentFullName ;

                    return (
                      <TableRow key={request.id}>
                        <TableCell>{formatDate(request.created_at)}</TableCell>
                        <TableCell>{request.full_name}</TableCell>
                        <TableCell>{request.email}</TableCell>
                        <TableCell>
                          <Chip
                            label={
                              request.requested_role_name
                                ? formatRoleLabel(request.requested_role_name)
                                : "-"
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell>
                          {request.requested_by_full_name || "-"}
                        </TableCell>
                        <TableCell>{request.department || "-"}</TableCell>
                        <TableCell>
                          <Chip
                            label={formatRoleLabel(request.status)}
                            color={getStatusColor(request.status)}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack
                            direction="row"
                            spacing={1}
                            justifyContent="flex-end"
                            alignItems="center"
                          >
                            <Button
                              size="small"
                              variant="outlined"
                              startIcon={<VisibilityOutlinedIcon />}
                              onClick={() => handleOpenViewDialog(request)}
                            >
                              View
                            </Button>

                            {request.status === "pending" &&
                              isAdmin &&
                              !isOwnRequest && (
                                <>
                                  <Button
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                    startIcon={<CheckCircleOutlineOutlinedIcon />}
                                    onClick={() =>
                                      handleOpenApproveDialog(request)
                                    }
                                  >
                                    Approve
                                  </Button>

                                  <Button
                                    size="small"
                                    color="error"
                                    variant="outlined"
                                    startIcon={<HighlightOffOutlinedIcon />}
                                    onClick={() =>
                                      handleOpenRejectDialog(request)
                                    }
                                  >
                                    Reject
                                  </Button>
                                </>
                              )}

                            {request.status === "pending" &&
                              isAdmin &&
                              isOwnRequest && (
                                <Chip
                                  label="Pending (created by you)"
                                  color="warning"
                                  size="small"
                                  variant="outlined"
                                />
                              )}
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </Box>
        </CardContent>
      </Card>

      <Dialog
        open={openCreateDialog}
        onClose={handleCloseCreate}
        fullWidth
        maxWidth="md"
        fullScreen={isMobile}
      >
        <DialogTitle>Create User Access Request</DialogTitle>

        <DialogContent>
          <Stack spacing={2} mt={1}>
            {submitMessage && (
              <Alert
                severity={
                  submitMessage.toLowerCase().includes("found")
                    ? "success"
                    : "info"
                }
                onClose={() => setSubmitMessage("")}
              >
                {submitMessage}
              </Alert>
            )}

            <Autocomplete
              options={enterpriseOptions}
              loading={enterpriseSearchLoading}
              value={selectedEnterpriseUser}
              onInputChange={(_, value) => {
                setForm((prev) => ({ ...prev, email: value }));
                searchEnterpriseUsers(value);
              }}
              onChange={(_, value) => {
                setSelectedEnterpriseUser(value);

                if (value) {
                  setForm((prev) => ({
                    ...prev,
                    enterprise_user: value.id,
                    employee_id: value.employee_id || "",
                    email: value.email || "",
                    full_name: value.full_name || "",
                    region: value.region || "",
                    country: value.country || "",
                    site: value.site || "",
                    plant: value.plant || "",
                    department: value.department || "",
                  }));
                  setSubmitMessage(
                    "Enterprise user found and fields auto-filled."
                  );
                } else {
                  setForm((prev) => ({
                    ...prev,
                    enterprise_user: "",
                    employee_id: "",
                    email: "",
                    full_name: "",
                    region: "",
                    country: "",
                    site: "",
                    plant: "",
                    department: "",
                  }));
                }
              }}
              getOptionLabel={(option) =>
                `${option.employee_id || "-"} - ${option.email || ""}`
              }
              isOptionEqualToValue={(option, value) => option.id === value.id}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Search by employee ID or email"
                  fullWidth
                  InputProps={{
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {enterpriseSearchLoading ? (
                          <CircularProgress size={18} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  }}
                />
              )}
            />

            <Divider />

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Employee ID"
                  value={form.employee_id}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Email"
                  value={form.email}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Name"
                  value={form.full_name}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  select
                  label="Requested Role"
                  value={form.requested_role}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      requested_role: Number(e.target.value),
                    }))
                  }
                  fullWidth
                >
                  {allowedRoles.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {formatRoleLabel(option.name)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" fontWeight="bold" mb={1}>
                  Requested Permissions
                </Typography>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 1,
                    maxHeight: 220,
                    overflowY: "auto",
                    borderRadius: 2,
                  }}
                >
                  {permissions.length > 0 ? (
                    permissions.map((perm) => (
                      <FormControlLabel
                        key={perm.id}
                        control={
                          <Checkbox
                            checked={form.requested_permissions.includes(
                              Number(perm.id)
                            )}
                            onChange={() =>
                              handleToggleRequestedPermission(perm.id)
                            }
                            size="small"
                          />
                        }
                        label={
                          <Box>
                            <Typography
                              variant="body2"
                              sx={{ lineHeight: 1.4 }}
                            >
                              {perm.name}
                            </Typography>
                          </Box>
                        }
                        sx={{
                          alignItems: "center",
                          display: "flex",
                          m: 0,
                          py: 0.5,
                          px: 1,
                          borderRadius: 1,
                          "&:hover": {
                            backgroundColor: (theme) =>
                              theme.palette.action.hover,
                          },
                        }}
                      />
                    ))
                  ) : (
                    <Typography color="text.secondary" p={1}>
                      No permissions available for this role.
                    </Typography>
                  )}
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Region"
                  value={form.region}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Country"
                  value={form.country}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Site"
                  value={form.site}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Plant"
                  value={form.plant}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Department"
                  value={form.department}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Grid>
            </Grid>
          </Stack>
        </DialogContent>

        <DialogActions 
          sx={{
            px: 3,
            pb: 2,
            flexDirection: { xs: "column-reverse", sm: "row" },
            alignItems: { xs: "stretch", sm: "center" },
          }}
        >
          <Button onClick={handleCloseCreate}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSubmitRequest}
            disabled={submitLoading}
          >
            {submitLoading ? "Submitting..." : "Submit Request"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openViewDialog}
        onClose={handleCloseViewDialog}
        fullWidth
        maxWidth="sm"
        fullScreen={isMobile}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" fontWeight="bold">
                Request Details
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Complete information about this user access request.
              </Typography>
            </Box>

            <IconButton onClick={handleCloseViewDialog}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {selectedRequest && (
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Requested User
                  </Typography>
                  <Typography fontWeight="bold">
                    {selectedRequest.full_name}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Email
                  </Typography>
                  <Typography fontWeight="bold">
                    {selectedRequest.email}
                  </Typography>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Access Level
                  </Typography>
                  <Box mt={0.5}>
                    <Chip
                      label={
                        selectedRequest.requested_role_name
                          ? formatRoleLabel(selectedRequest.requested_role_name)
                          : "-"
                      }
                      size="small"
                    />
                  </Box>
                </Grid>

                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="caption" color="text.secondary">
                    Status
                  </Typography>
                  <Box mt={0.5}>
                    <Chip
                      label={formatRoleLabel(selectedRequest.status)}
                      color={getStatusColor(selectedRequest.status)}
                      size="small"
                    />
                  </Box>
                </Grid>
              </Grid>

              <Divider />

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Requested By
                </Typography>
                <Typography fontWeight="bold">
                  {selectedRequest.requested_by_full_name || "-"}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedRequest.department || "-"}
                </Typography>
              </Box>

              <Divider />

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Request Date
                </Typography>
                <Typography>{formatDate(selectedRequest.created_at)}</Typography>
              </Box>

              <Divider />

              <Box>
                <Typography fontWeight="bold" mb={1}>
                  Requested Permissions
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {getPermissionLabels(selectedRequest.requested_permissions)
                    .length > 0 ? (
                    getPermissionLabels(selectedRequest.requested_permissions).map(
                      (perm) => (
                        <Chip
                          key={perm.id}
                          label={perm.secondary || perm.label}
                          size="small"
                        />
                      )
                    )
                  ) : (
                    <Typography color="text.secondary">
                      No requested permissions
                    </Typography>
                  )}
                </Stack>
              </Box>
            </Stack>
          )}
        </DialogContent>

        <DialogActions 
          sx={{
            px: 3,
            pb: 2,
            flexDirection: { xs: "column-reverse", sm: "row" },
            alignItems: { xs: "stretch", sm: "center" },
          }}
        >
          <Button onClick={handleCloseViewDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openApproveDialog}
        onClose={handleCloseApproveDialog}
        fullWidth
        maxWidth="md"
        fullScreen={isMobile}
      >
        <DialogTitle>Approve Request</DialogTitle>

        <DialogContent>
          {selectedRequest && (
            <Stack spacing={2} mt={1}>
              {approvalError && <Alert severity="error" onClose={() => setApprovalError("")}>{approvalError}</Alert>}

              <Typography>
                You can approve all requested permissions or only a few.
              </Typography>

              <TextField
                label="Employee ID"
                value={selectedRequest.employee_id || ""}
                fullWidth
                InputProps={{ readOnly: true }}
              />

              <TextField
                label="Requested User"
                value={selectedRequest.full_name}
                fullWidth
                InputProps={{ readOnly: true }}
              />

              <TextField
                label="Requested User Email"
                value={selectedRequest.email}
                fullWidth
                InputProps={{ readOnly: true }}
              />

              <TextField
                select
                label="Approved Role"
                value={approvedRoleId}
                onChange={(e) => handleApprovedRoleChange(e.target.value)}
                fullWidth
              >
                {roles.map((roleOption) => (
                  <MenuItem key={roleOption.id} value={roleOption.id}>
                    {formatRoleLabel(roleOption.name)}
                  </MenuItem>
                ))}
              </TextField>

              <Box>
                <Typography variant="body2" fontWeight="bold" mb={1}>
                  Approved Permissions
                </Typography>

                <Paper
                  variant="outlined"
                  sx={{
                    p: 1,
                    maxHeight: 220,
                    overflowY: "auto",
                    borderRadius: 2,
                  }}
                >
                  {approvalPermissions.length > 0 ? (
                    approvalPermissions.map(
                      (perm) => (
                        <FormControlLabel
                          key={perm.id}
                          control={
                            <Checkbox
                              checked={selectedApprovedPermissions.includes(
                                Number(perm.id)
                              )}
                              onChange={() =>
                                handleToggleApprovedPermission(perm.id)
                              }
                            />
                          }
                          label={
                            <Typography variant="body2">
                              {perm.name|| perm.label}
                            </Typography>
                          }
                          sx={{
                            alignItems: "center",
                            display: "flex",
                            m: 0,
                            py: 0.7,
                            px: 1,
                            borderRadius: 1,
                            "&:hover": {
                              backgroundColor: (theme) =>
                                theme.palette.action.hover,
                            },
                          }}
                        />
                      )
                    )
                  ) : (
                    <Typography color="text.secondary" p={1}>
                      No requested permissions to approve.
                    </Typography>
                  )}
                </Paper>
              </Box>
            </Stack>
          )}
        </DialogContent>

        <DialogActions
          sx={{
            px: 3,
            pb: 2,
            flexDirection: { xs: "column-reverse", sm: "row" },
            alignItems: { xs: "stretch", sm: "center" },
          }}
        >
          <Button onClick={handleCloseApproveDialog}>Cancel</Button>
          <Button
            variant="contained"
            color="success"
            onClick={handleApprove}
            disabled={approvalLoading}
          >
            {approvalLoading ? "Approving..." : "Confirm Approval"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={openRejectDialog}
        onClose={handleCloseRejectDialog}
        fullWidth
        maxWidth="xs"
        fullScreen={isMobile}
      >
        <DialogTitle>Confirm Rejection</DialogTitle>

        <DialogContent>
          <Stack spacing={2} mt={1}>
            {rejectError && <Alert severity="error" onClose={() => setRejectError("")}>
              {rejectError}
            </Alert>}

            <Typography>
              Are you sure you want to reject this request?
            </Typography>

            {selectedRejectRequest && (
              <Box>
                <Typography variant="body2" color="text.secondary">
                  Requested user
                </Typography>
                <Typography fontWeight="bold">
                  {selectedRejectRequest.full_name}
                </Typography>

                <Typography variant="body2" color="text.secondary" mt={1}>
                  Email
                </Typography>
                <Typography fontWeight="bold">
                  {selectedRejectRequest.email}
                </Typography>
              </Box>
            )}
          </Stack>
        </DialogContent>

        <DialogActions 
          sx={{
            px: 3,
            pb: 2,
            flexDirection: { xs: "column-reverse", sm: "row" },
            alignItems: { xs: "stretch", sm: "center" },
          }}
        >
          <Button onClick={handleCloseRejectDialog}>Cancel</Button>

          <Button
            variant="contained"
            color="error"
            onClick={handleConfirmReject}
            disabled={rejectLoading}
          >
            {rejectLoading ? "Rejecting..." : "Confirm Reject"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}