import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Typography,
  IconButton,
  InputAdornment,
} from "@mui/material";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";
import { useNavigate, useParams } from "react-router-dom";
import api from "../../api/axios";
import bgImage from "../../assets/Empowering Connections. - 1.png";

const BACKGROUND_IMAGE_URL = bgImage;
export default function SetPassword() {
  const { uid, token } = useParams();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [expiredEmail, setExpiredEmail] = useState("");
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    if (!error) return;

    const timer = setTimeout(() => {
      setError("");
    }, 5000);

    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!success) return;

    const timer = setTimeout(() => {
      setSuccess("");
    }, 4000);

    return () => clearTimeout(timer);
  }, [success]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    setError("");
    setSuccess("");
    setCanResend(false);
    setExpiredEmail("");

    if (!password || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (password.length < 8) {
      setError("Password must contain at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      await api.post("users/set-password/", {
        uid,
        token,
        password,
      });

      setSuccess("Password set successfully. Redirecting to login...");

      setTimeout(() => {
        navigate("/");
      }, 1500);
    } catch (err) {
      const data = err.response?.data;
      console.error("Set Password Error Data:", data);
      setError(
        data?.error ||
          data?.password?.[0] ||
          "Failed to set password. The link may be invalid or expired."
      );

      if (data?.action === "resend_email" && data?.email) {
        setExpiredEmail(data.email);
        setCanResend(true);
      }
      if (data?.action === "go_login") {
        setTimeout(() => {
          navigate("/");
        }, 2000);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    setError("");
    setSuccess("");

    if (!expiredEmail) {
      setError("Email address not found. Please contact your administrator.");
      return;
    }

    setResendLoading(true);

    try {
      await api.post("users/resend-setup-email/", {
        email: expiredEmail,
      });

      setSuccess("A new setup email has been sent. Please check your inbox.");
      setCanResend(false);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          "Failed to resend setup email. Please contact your administrator."
      );
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight:"100vh",
        display:"flex",
        alignItems:"center",
        justifyContent:"center",
        backgroundImage: `url(${BACKGROUND_IMAGE_URL})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        p: { xs: 2, sm: 4 },
      }}
    >
      <Card sx={{ width: "100%", maxWidth: { xs: 360, sm: 440 }, borderRadius: { xs: 3, sm: 4 } }}>
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Typography variant="h4" fontWeight="bold" mb={1} sx={{ fontSize: { xs: "1.8rem", sm: "2.125rem" } }}>
            Set Password
          </Typography>

          <Typography color="text.secondary" mb={3}>
            Create your LeoMetrics password to activate your account.
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

          {canResend && (
            <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setCanResend(false)}>
              This setup link has expired. Click below to receive a new setup
              email.
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              label="New Password"
              type={showPassword ? "text" : "password"}
              fullWidth
              margin="normal"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={canResend || loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((prev) => !prev)} edge="end"
                    >
                      {showPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Confirm Password"
              type={showConfirmPassword ? "text" : "password"}
              fullWidth
              margin="normal"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={canResend || loading}
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowConfirmPassword((prev) => !prev)} edge="end"
                    >
                      {showConfirmPassword ? <VisibilityOffOutlinedIcon /> : <VisibilityOutlinedIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {!canResend ? (
              <Button
                type="submit"
                variant="contained"
                fullWidth
                sx={{ mt: 3, py: 1.2 }}
                disabled={loading}
              >
                {loading ? <CircularProgress size={24} /> : "Set Password"}
              </Button>
            ) : (
              <Button
                type="button"
                variant="contained"
                fullWidth
                sx={{ mt: 3, py: 1.2 }}
                onClick={handleResendEmail}
                disabled={resendLoading}
              >
                {resendLoading ? (
                  <CircularProgress size={24} />
                ) : (
                  "Resend Setup Email"
                )}
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}