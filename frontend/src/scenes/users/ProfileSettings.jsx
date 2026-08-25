import { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import api from "../../api/axios";

export default function ProfileSettings() {
  const [profile, setProfile] = useState(null);
  const [photo, setPhoto] = useState(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(true);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchProfile = async () => {
    try {
      const res = await api.get("users/profile/");
      setProfile(res.data);
    } catch (err) {
      setError("Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (!success) return;
    const timer = setTimeout(() => setSuccess(""), 3000);
    return () => clearTimeout(timer);
  }, [success]);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  const handleUploadPhoto = async () => {
    if (!photo) {
      setError("Please select a photo first.");
      return;
    }

    setPhotoLoading(true);
    setError("");
    setSuccess("");

    try {
        const formData = new FormData();
        formData.append("profile_photo", photo);

        const res = await api.patch("users/profile/", formData, {
            headers: {
            "Content-Type": "multipart/form-data",
            },
        });

        const updatedProfile = res.data;
        const storedUser = JSON.parse(localStorage.getItem("user") || "{}");

        localStorage.setItem(
            "user",
            JSON.stringify({
            ...storedUser,
            profile_photo: updatedProfile.profile_photo || "",
            })
        );

        window.dispatchEvent(new Event("profile-updated"));

        setSuccess("Profile photo updated successfully.");
        setPhoto(null);
        await fetchProfile();
        } catch (err) {
      setError("Failed to update profile photo.");
    } finally {
      setPhotoLoading(false);
    }
  };
    

  const handleChangePassword = async () => {
    setError("");
    setSuccess("");

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError("Please fill in all password fields.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setPasswordLoading(true);

    try {
      await api.post("users/profile/change-password/", {
        current_password: currentPassword,
        new_password: newPassword,
      });

      setSuccess("Password changed successfully.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          "Failed to change password."
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" mt={5}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight="bold" mb={1}>
        Profile Settings
      </Typography>
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

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Card>
            <CardContent>
              <Stack spacing={2} alignItems="center">
                <Avatar
                  src={profile?.profile_photo || ""}
                  sx={{ width: 110, height: 110, fontSize: 36 }}
                >
                  {profile?.full_name?.charAt(0) || "U"}
                </Avatar>

                <Button variant="outlined" component="label">
                  Choose Photo
                  <input
                    hidden
                    type="file"
                    accept="image/*"
                    onChange={(e) => setPhoto(e.target.files[0] || null)}
                  />
                </Button>

                {photo && (
                  <Typography variant="body2" color="text.secondary">
                    Selected: {photo.name}
                  </Typography>
                )}

                <Button
                  variant="contained"
                  onClick={handleUploadPhoto}
                  disabled={photoLoading}
                >
                  {photoLoading ? "Uploading..." : "Upload Photo"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                Personal Information
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField label="Full Name" value={profile?.full_name || ""} fullWidth InputProps={{ readOnly: true }} />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField label="Email" value={profile?.email || ""} fullWidth InputProps={{ readOnly: true }} />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField label="Employee ID" value={profile?.employee_id || ""} fullWidth InputProps={{ readOnly: true }} />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField label="Department" value={profile?.department || ""} fullWidth InputProps={{ readOnly: true }} />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField label="Region" value={profile?.region || ""} fullWidth InputProps={{ readOnly: true }} />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField label="Country" value={profile?.country || ""} fullWidth InputProps={{ readOnly: true }} />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField label="Site" value={profile?.site || ""} fullWidth InputProps={{ readOnly: true }} />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField label="Plant" value={profile?.plant || ""} fullWidth InputProps={{ readOnly: true }} />
                </Grid>
              </Grid>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" fontWeight="bold" mb={2}>
                Access Information
              </Typography>

              <Stack spacing={2}>
                <TextField
                  label="Role"
                  value={profile?.role || ""}
                  fullWidth
                  InputProps={{ readOnly: true }}
                />

                <Box>
                  <Typography fontWeight="bold" mb={1}>
                    Permissions
                  </Typography>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {(profile?.app_permissions || []).map((permission) => (
                      <Chip
                        key={permission.id}
                        label={permission.name || permission.code}
                        size="small"
                      />
                    ))}
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" mb={2}>
                Change Password
              </Typography>

              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <TextField
                    label="Current Password"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    fullWidth
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    label="New Password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    fullWidth
                  />
                </Grid>

                <Grid item xs={12} md={4}>
                  <TextField
                    label="Confirm New Password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    fullWidth
                  />
                </Grid>
              </Grid>

              <Button
                variant="contained"
                sx={{ mt: 3 }}
                onClick={handleChangePassword}
                disabled={passwordLoading}
              >
                {passwordLoading ? "Changing..." : "Change Password"}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}