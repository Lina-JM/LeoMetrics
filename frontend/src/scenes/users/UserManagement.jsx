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
  Switch,
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
import SearchIcon from "@mui/icons-material/Search";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import CloseIcon from "@mui/icons-material/Close";
import api from "../../api/axios";

function formatRoleLabel(roleName = "") {
  return roleName.replaceAll("_", " ");
}

export default function UserManagement() {
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

  const hasPermission = (code) => {
    if (role === "administrator") return true;
    return storedUser?.app_permissions?.some((p) => p.code === code);
  };

  const canAddUsers = hasPermission("create_user");
  const canEditUsers = hasPermission("edit_user");
  const canActivateUsers = hasPermission("activate_deactivate_user");
  const canViewPermissions = canEditUsers;

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [error, setError] = useState("");

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedRoleFilter, setSelectedRoleFilter] = useState("all");
  const [selectedStatusFilter, setSelectedStatusFilter] = useState("all");

  const [openViewDialog, setOpenViewDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState("");
  const [editPermissions, setEditPermissions] = useState([]);
  const [editForm, setEditForm] = useState({
    role_id: "",
    is_active: true,
    permission_ids: [],
  });

  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");
  const [permissions, setPermissions] = useState([]);
  const [enterpriseOptions, setEnterpriseOptions] = useState([]);
  const [enterpriseSearchLoading, setEnterpriseSearchLoading] = useState(false);
  const [selectedEnterpriseUser, setSelectedEnterpriseUser] = useState(null);

  const [addForm, setAddForm] = useState({
    email: "",
    enterprise_user_id: "",
    employee_id: "",
    username: "",
    region: "",
    country: "",
    site: "",
    plant: "",
    department: "",
    role_id: "",
    permission_ids: [],
  });

  const selectedAddRole = roles.find(
    (role) => Number(role.id) === Number(addForm.role_id)
  );
  const isAddAdminRole = selectedAddRole?.name === "administrator";


  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!editError) return;
    const timer = setTimeout(() => setEditError(""), 5000);
    return () => clearTimeout(timer);
  }, [editError]);

  useEffect(() => {
    if (!addError) return;
    const timer = setTimeout(() => setAddError(""), 5000);
    return () => clearTimeout(timer);
  }, [addError]);


  const fetchUsers = async () => {
    try {
      const res = await api.get("users/manage/");
      setUsers(res.data);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to load users");
    }
  };

  const fetchRoles = async () => {
    try {
      const res = await api.get("users/roles/");
      setRoles(res.data);
    } catch (err) {
      console.error(err);
      setError("Failed to load roles");
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
      console.error(err);
      setPermissions([]);
    }
  };

  const fetchEditPermissionsForRole = async (roleId) => {
    if (!roleId) {
      setEditPermissions([]);
      return;
    }

    try {
      const res = await api.get(`users/roles/${roleId}/permissions/`);
      setEditPermissions(res.data.permissions || []);
    } catch (err) {
      console.error(err);
      setEditPermissions([]);
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
    fetchUsers();
    fetchRoles();
  }, []);

  const totalUsers = users.length;
  const activeUsers = users.filter((user) => user.is_active).length;
  const inactiveUsers = users.filter((user) => !user.is_active).length;

  const roleFilterOptions = useMemo(() => {
    return [
      ...new Set([
        ...roles.map((role) => role.name),
        ...users.map((user) => user.role).filter(Boolean),
      ]),
    ];
  }, [roles, users]);

  const creatableRoles = useMemo(() => {
    return roles.filter((role) =>
      ["viewer", "contributor", "administrator"].includes(role.name)
    );
  }, [roles]);

  useEffect(() => {
    if (!isAddAdminRole || permissions.length === 0) return;

    setAddForm((prev) => ({
      ...prev,
      permission_ids: permissions.map((perm) => Number(perm.id)),
    }));
  }, [isAddAdminRole, permissions]);

  const filteredUsers = useMemo(() => {
    let data = [...users];

    if (selectedRoleFilter !== "all") {
      data = data.filter((user) => user.role === selectedRoleFilter);
    }

    if (selectedStatusFilter === "active") {
      data = data.filter((user) => user.is_active);
    } else if (selectedStatusFilter === "inactive") {
      data = data.filter((user) => !user.is_active);
    }

    const q = searchTerm.trim().toLowerCase();

    if (!q) return data;

    return data.filter((user) => {
      return (
        (user.employee_id || "").toLowerCase().includes(q) ||
        (user.full_name || "").toLowerCase().includes(q) ||
        (user.email || "").toLowerCase().includes(q) ||
        (user.role || "").toLowerCase().includes(q) ||
        (user.department || "").toLowerCase().includes(q) ||
        (user.region || "").toLowerCase().includes(q) ||
        (user.country || "").toLowerCase().includes(q)
      );
    });
  }, [users, searchTerm, selectedRoleFilter, selectedStatusFilter]);

  const isEditingSelf = selectedUser?.email === currentEmail;

  const handleOpenView = (user) => {
    setSelectedUser(user);
    setOpenViewDialog(true);
  };

  const handleCloseView = () => {
    setOpenViewDialog(false);
    setSelectedUser(null);
  };

  const handleOpenEdit = async (user) => {
    const selectedRole = roles.find((r) => r.name === user.role);
    const roleId = selectedRole?.id || "";

    setSelectedUser(user);
    setEditForm({
      role_id: roleId,
      is_active: user.is_active,
      permission_ids: (user.app_permissions || []).map((p) => Number(p.id)),
    });

    setEditError("");
    setOpenEditDialog(true);

    if (roleId) {
      await fetchEditPermissionsForRole(roleId);
    }
  };

  const handleCloseEdit = () => {
    setOpenEditDialog(false);
    setSelectedUser(null);
    setEditError("");
    setEditPermissions([]);
    setEditForm({
      role_id: "",
      is_active: true,
      permission_ids: [],
    });
  };

  const handleEditRoleChange = async (roleId) => {
    setEditForm((prev) => ({
      ...prev,
      role_id: Number(roleId),
      permission_ids: [],
    }));

    await fetchEditPermissionsForRole(roleId);
  };

  const toggleEditPermission = (permissionId) => {
    const numericId = Number(permissionId);

    setEditForm((prev) => {
      const exists = prev.permission_ids.includes(numericId);

      return {
        ...prev,
        permission_ids: exists
          ? prev.permission_ids.filter((id) => id !== numericId)
          : [...prev.permission_ids, numericId],
      };
    });
  };

  const handleSaveEdit = async () => {
    if (!selectedUser) return;

    if (!isEditingSelf && editForm.permission_ids.length === 0) {
      setEditError("Please select at least one permission.");
      return;
    }

    setEditLoading(true);
    setEditError("");

    try {
      const currentSelectedRole = roles.find((r) => r.name === selectedUser.role);
      const currentRoleId = currentSelectedRole?.id || "";

      if (
        !isEditingSelf &&
        canEditUsers &&
        editForm.role_id &&
        Number(editForm.role_id) !== Number(currentRoleId)
      ) {
        await api.patch(`users/manage/${selectedUser.id}/role/`, {
          role_id: Number(editForm.role_id),
        });
      }

      if (!isEditingSelf && canEditUsers) {
        await api.patch(`users/manage/${selectedUser.id}/permissions/`, {
          permission_ids: editForm.permission_ids,
        });
      }

      if (!isEditingSelf && canActivateUsers && editForm.is_active !== selectedUser.is_active) {
        await api.patch(`users/manage/${selectedUser.id}/activation/`, {
          is_active: editForm.is_active,
        });
      }


      await fetchUsers();
      handleCloseEdit();
    } catch (err) {
      console.error(err);
      setEditError(
        err.response?.data?.error || "Failed to update user information."
      );
    } finally {
      setEditLoading(false);
    }
  };

  const resetAddForm = () => {
    setAddForm({
      email: "",
      enterprise_user_id: "",
      employee_id: "",
      username: "",
      region: "",
      country: "",
      site: "",
      plant: "",
      department: "",
      role_id: "",
      permission_ids: [],
    });
    setPermissions([]);
    setEnterpriseOptions([]);
    setSelectedEnterpriseUser(null);
    setAddError("");
  };

  const handleOpenAdd = () => {
    resetAddForm();
    setOpenAddDialog(true);
  };

  const handleCloseAdd = () => {
    setOpenAddDialog(false);
    resetAddForm();
  };

  const handleAddRoleChange = async (roleId) => {
    setAddForm((prev) => ({
      ...prev,
      role_id: Number(roleId),
      permission_ids: [],
    }));
    await fetchPermissionsForRole(roleId);
  };

  const toggleAddPermission = (permissionId) => {
    const numericId = Number(permissionId);

    setAddForm((prev) => {
      const exists = prev.permission_ids.includes(numericId);
      return {
        ...prev,
        permission_ids: exists
          ? prev.permission_ids.filter((id) => id !== numericId)
          : [...prev.permission_ids, numericId],
      };
    });
  };

  const handleCreateUser = async () => {
    if (!addForm.enterprise_user_id) {
      setAddError("Please select a valid enterprise user.");
      return;
    }

    if (!addForm.role_id) {
      setAddError("Please select a role.");
      return;
    }

    if (!addForm.permission_ids || addForm.permission_ids.length === 0) {
      setAddError("Please select at least one permission.");
      return;
    }

    setAddLoading(true);
    setAddError("");

    try {
      await api.post("users/manage/create/", {
        enterprise_user_id: addForm.enterprise_user_id,
        role_id: addForm.role_id,
        permission_ids: addForm.permission_ids,
      });

      await fetchUsers();
      handleCloseAdd();
    } catch (err) {
      console.error(err);
      setAddError(err.response?.data?.error || "Failed to add user.");
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <Box>
      <Box mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Users
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Total Users
              </Typography>
              <Typography variant="h3" fontWeight="bold">
                {totalUsers}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Active Users
              </Typography>
              <Typography variant="h3" fontWeight="bold">
                {activeUsers}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Inactive Users
              </Typography>
              <Typography variant="h3" fontWeight="bold">
                {inactiveUsers}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            display="flex"
            gap={2}
            flexDirection={{ xs: "column", md: "row" }}
            alignItems={{ xs: "stretch", md: "center" }}
            justifyContent="space-between"
          >
            <Box display="flex" gap={2} flexWrap="wrap" alignItems="center">
              <TextField
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                sx={{ width: { xs: "100%", md: 260 } }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />

              <TextField
                select
                label="All Roles"
                value={selectedRoleFilter}
                onChange={(e) => setSelectedRoleFilter(e.target.value)}
                sx={{ width: { xs: "100%", md: 260 } }}
              >
                <MenuItem value="all">All Roles</MenuItem>
                {roleFilterOptions.map((roleName) => (
                  <MenuItem key={roleName} value={roleName}>
                    {formatRoleLabel(roleName)}
                  </MenuItem>
                ))}
              </TextField>

              <TextField
                select
                label="All Statuses"
                value={selectedStatusFilter}
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                sx={{ width: { xs: "100%", md: 260} }}
              >
                <MenuItem value="all">All Statuses</MenuItem>
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="inactive">Inactive</MenuItem>
              </TextField>
            </Box>

            {canAddUsers && (
              <Button
                variant="contained"
                startIcon={<PersonAddAlt1OutlinedIcon />}
                onClick={handleOpenAdd}
                fullWidth={isMobile}
              >
                Add User
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          {filteredUsers.length === 0 ? (
            <Typography color="text.secondary">No users found.</Typography>
          ) : (
            <Box sx={{ overflowX: "auto" }}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Employee ID</TableCell>
                    <TableCell>Name</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell>Department</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.employee_id || "-"}</TableCell>
                      <TableCell>{user.full_name || "-"}</TableCell>
                      <TableCell>{user.email || "-"}</TableCell>
                      <TableCell>
                        <Chip
                          label={user.role ? formatRoleLabel(user.role) : "-"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell>{user.department || "-"}</TableCell>
                      <TableCell>
                        <Chip
                          label={user.is_active ? "Active" : "Inactive"}
                          color={user.is_active ? "success" : "error"}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={1} justifyContent="flex-end">
                          <Button
                            size="small"
                            variant="outlined"
                            startIcon={<VisibilityOutlinedIcon />}
                            onClick={() => handleOpenView(user)}
                          >
                            View
                          </Button>

                          {canEditUsers &&
                            user.email !== currentEmail &&
                            user.role !== "administrator" && (
                              <Button
                                size="small"
                                variant="outlined"
                                startIcon={<EditOutlinedIcon />}
                                onClick={() => handleOpenEdit(user)}
                              >
                                Edit
                              </Button>
                            )}
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </CardContent>
      </Card>

      <Dialog open={openViewDialog} onClose={handleCloseView} fullScreen={isMobile} maxWidth="sm">
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" fontWeight="bold">
                User Details
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Complete information about this user.
              </Typography>
            </Box>

            <IconButton onClick={handleCloseView}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {selectedUser && (
            <Stack spacing={2}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Employee ID
                  </Typography>
                  <Typography fontWeight="bold">
                    {selectedUser.employee_id || "-"}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Name
                  </Typography>
                  <Typography fontWeight="bold">
                    {selectedUser.full_name || "-"}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Email
                  </Typography>
                  <Typography fontWeight="bold">
                    {selectedUser.email || "-"}
                  </Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Role
                  </Typography>
                  <Box mt={0.5}>
                    <Chip
                      label={
                        selectedUser.role ? formatRoleLabel(selectedUser.role) : "-"
                      }
                      size="small"
                    />
                  </Box>
                </Grid>
              </Grid>

              <Divider />

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Region
                  </Typography>
                  <Typography>{selectedUser.region || "-"}</Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Country
                  </Typography>
                  <Typography>{selectedUser.country || "-"}</Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Site
                  </Typography>
                  <Typography>{selectedUser.site || "-"}</Typography>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="caption" color="text.secondary">
                    Plant
                  </Typography>
                  <Typography>{selectedUser.plant || "-"}</Typography>
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <Typography variant="caption" color="text.secondary">
                    Department
                  </Typography>
                  <Typography>{selectedUser.department || "-"}</Typography>
                </Grid>
              </Grid>

              <Divider />

              <Box>
                <Typography variant="caption" color="text.secondary">
                  Status
                </Typography>
                <Box mt={0.5}>
                  <Chip
                    label={selectedUser.is_active ? "Active" : "Inactive"}
                    color={selectedUser.is_active ? "success" : "error"}
                    size="small"
                  />
                </Box>
              </Box>

              {canViewPermissions && (
                <>
                  <Divider />

                  <Box>
                    <Typography fontWeight="bold" mb={1}>
                      Permissions
                    </Typography>

                    <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                      {(selectedUser.app_permissions || []).length > 0 ? (
                        selectedUser.app_permissions.map((permission) => (
                          <Chip
                            key={permission.id}
                            label={permission.name || permission.code}
                            size="small"
                          />
                        ))
                      ) : (
                        <Typography color="text.secondary">
                          No permissions assigned.
                        </Typography>
                      )}
                    </Stack>
                  </Box>
                </>
              )}
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
          <Button onClick={handleCloseView}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openEditDialog} onClose={handleCloseEdit} fullScreen={isMobile} maxWidth="md">
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" fontWeight="bold">
                Edit User
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Update role, permissions, and activation status.
              </Typography>
            </Box>

            <IconButton onClick={handleCloseEdit}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          {selectedUser && (
            <Stack spacing={2} mt={1}>
              {editError && <Alert severity="error" onClose={() => setEditError("")}>{editError}</Alert>}

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Employee ID"
                    value={selectedUser.employee_id || ""}
                    fullWidth
                    InputProps={{ readOnly: true }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <TextField
                    label="Name"
                    value={selectedUser.full_name || ""}
                    fullWidth
                    InputProps={{ readOnly: true }}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Email"
                    value={selectedUser.email || ""}
                    fullWidth
                    InputProps={{ readOnly: true }}
                  />
                </Grid>

                <Grid size={{ xs: 12 }}>
                  <TextField
                    select
                    label="Role"
                    value={editForm.role_id}
                    disabled={isEditingSelf}
                    onChange={(e) => handleEditRoleChange(e.target.value)}
                    fullWidth
                  >
                    {roles.map((roleOption) => (
                      <MenuItem key={roleOption.id} value={roleOption.id}>
                        {formatRoleLabel(roleOption.name)}
                      </MenuItem>
                    ))}
                  </TextField>
                </Grid>

                {canEditUsers && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="body2" fontWeight="bold" mb={1}>
                      Permissions
                    </Typography>

                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1,
                        maxHeight: 240,
                        overflowY: "auto",
                        borderRadius: 2,
                      }}
                    >
                      {editPermissions.length > 0 ? (
                        editPermissions.map((perm) => (
                          <FormControlLabel
                            key={perm.id}
                            control={
                              <Checkbox
                                checked={editForm.permission_ids.includes(
                                  Number(perm.id)
                                )}
                                onChange={() => toggleEditPermission(perm.id)}
                                disabled={isEditingSelf}
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
                          Select a role to load permissions.
                        </Typography>
                      )}
                    </Paper>
                  </Grid>
                )}

                <Grid size={{ xs: 12 }}>
                  <Box
                    display="flex"
                    justifyContent="space-between"
                    alignItems="center"
                    px={1}
                    py={1}
                    border="1px solid"
                    borderColor="divider"
                    borderRadius={2}
                  >
                    <Box>
                      <Typography fontWeight="bold">Active Status</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Activate or deactivate this user.
                      </Typography>
                    </Box>

                    <Switch
                      checked={editForm.is_active}
                      disabled={isEditingSelf || !canActivateUsers}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          is_active: e.target.checked,
                        }))
                      }
                    />
                  </Box>
                </Grid>
              </Grid>
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
          <Button onClick={handleCloseEdit}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={editLoading || isEditingSelf}
          >
            {editLoading ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={openAddDialog} onClose={handleCloseAdd} fullScreen={isMobile} maxWidth="md">
        <DialogTitle sx={{ pb: 1 }}>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Box>
              <Typography variant="h6" fontWeight="bold">
                Add User
              </Typography>
            </Box>

            <IconButton onClick={handleCloseAdd}>
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Stack spacing={2} mt={1}>
            {addError && <Alert severity="error" onClose={() => setAddError("")}>{addError}</Alert>}

            <Autocomplete
              options={enterpriseOptions}
              loading={enterpriseSearchLoading}
              value={selectedEnterpriseUser}
              onInputChange={(_, value) => {
                setAddForm((prev) => ({ ...prev, email: value }));
                searchEnterpriseUsers(value);
              }}
              onChange={(_, value) => {
                setSelectedEnterpriseUser(value);

                if (value) {
                  setAddForm((prev) => ({
                    ...prev,
                    enterprise_user_id: value.id,
                    employee_id: value.employee_id || "",
                    email: value.email || "",
                    full_name: `${value.first_name || ""} ${value.last_name || ""}`.trim(),
                    region: value.region || "",
                    country: value.country || "",
                    site: value.site || "",
                    plant: value.plant || "",
                    department: value.department || "",
                  }));
                } else {
                  setAddForm((prev) => ({
                    ...prev,
                    enterprise_user_id: "",
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
              <Grid item xs={12} md={6}>
                <TextField
                  label="Employee ID"
                  value={addForm.employee_id}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Email"
                  value={addForm.email}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Name"
                  value={addForm.full_name}
                  fullWidth
                  InputProps={{ readOnly: true }}
                  InputLabelProps={{
                    shrink: true,
                  }}

                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Region"
                  value={addForm.region}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Country"
                  value={addForm.country}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Site"
                  value={addForm.site}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Plant"
                  value={addForm.plant}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Department"
                  value={addForm.department}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
                <TextField
                  select
                  label="Role"
                  value={addForm.role_id}
                  onChange={(e) => handleAddRoleChange(e.target.value)}
                  fullWidth
                >
                  {creatableRoles.map((roleOption) => (
                    <MenuItem key={roleOption.id} value={roleOption.id}>
                      {formatRoleLabel(roleOption.name)}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Typography variant="body2" fontWeight="bold" mb={1}>
                  Permissions
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
                            checked={addForm.permission_ids.includes(Number(perm.id))}
                            onChange={() => toggleAddPermission(perm.id)}
                            disabled={isAddAdminRole}
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
                      Select a role to load permissions.
                    </Typography>
                  )}
                </Paper>
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
          <Button onClick={handleCloseAdd}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleCreateUser}
            disabled={addLoading}
          >
            {addLoading ? "Adding..." : "Add User"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}