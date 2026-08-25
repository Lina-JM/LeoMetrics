import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";

import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import MailOutlineIcon from "@mui/icons-material/MailOutline";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import VisibilityOffOutlinedIcon from "@mui/icons-material/VisibilityOffOutlined";

import { useNavigate } from "react-router-dom";
import api from "../../api/axios";
import bgImage from "../../assets/Empowering Connections. - 1.png";

const BACKGROUND_IMAGE_URL = bgImage;

export default function Login() {
  const theme = useTheme();
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [error, setError] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [forgotMessage, setForgotMessage] = useState("");

  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);

  const [showResend, setShowResend] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  useEffect(() => {
    if (!resendMessage) return;
    const timer = setTimeout(() => setResendMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [resendMessage]);

  useEffect(() => {
    if (!forgotMessage) return;
    const timer = setTimeout(() => setForgotMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [forgotMessage]);

  const handleLogin = async () => {
    setError("");
    setResendMessage("");
    setForgotMessage("");
    setShowResend(false);

    if (!email.trim() || !password.trim()) {
      setError("Please enter your email and password.");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("users/login/", {
        email: email.trim(),
        password,
      });

      localStorage.setItem("access", res.data.access);
      localStorage.setItem("refresh", res.data.refresh);
      localStorage.setItem(
        "user",
        JSON.stringify({
          full_name: res.data.full_name,
          email: res.data.email || email.trim(),
          role: res.data.role,
          profile_photo: res.data.profile_photo || "",
          app_permissions: res.data.app_permissions || [],
        })
      );

      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error(err);

      if (err.response?.status === 403) {
        setError("You must set your password first. Check your email.");
        setShowResend(true);
      } else {
        setError(
          err.response?.data?.non_field_errors?.[0] ||
            err.response?.data?.error ||
            err.response?.data?.detail ||
            "Invalid email or password."
        );
        setShowResend(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendSetupEmail = async () => {
    setError("");
    setResendMessage("");
    setForgotMessage("");

    if (!email.trim()) {
      setError("Please enter your email first.");
      return;
    }

    setResendLoading(true);

    try {
      await api.post("users/resend-setup-email/", {
        email: email.trim(),
      });

      setResendMessage("Setup email sent again. Please check your inbox.");
      setShowResend(false);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          "Failed to resend setup email."
      );
    } finally {
      setResendLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    setError("");
    setResendMessage("");
    setForgotMessage("");
    setShowResend(false);

    if (!email.trim()) {
      setError("Please enter your email first to reset your password.");
      return;
    }

    setForgotLoading(true);

    try {
      await api.post("users/forgot-password/", {
        email: email.trim(),
      });

      setForgotMessage(
        "If this email exists, a password reset link has been sent."
      );
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.error ||
          err.response?.data?.detail ||
          "Failed to send password reset email."
      );
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundImage: `url(${BACKGROUND_IMAGE_URL})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
        p: { xs: 2, sm: 4 },
      }}
    >
      <Card
        sx={{
          width: "100%",
          maxWidth: { xs: 360, sm: 480 },
          borderRadius: { xs: 3, sm: 4 },
          mt: { xs: 0, sm: -8, md: -12 },
          boxShadow: "0 15px 40px rgba(0, 0, 0, 0.3)",
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
          <Box mb={3}>
            <Typography variant="h3" fontWeight={800} mb={1} sx={{ fontSize: { xs: "2rem", sm: "3rem" } }}>
              Sign in
            </Typography>

            <Typography color="text.secondary">
              Access your ITSM analytics workspace.
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
              {error}

              {showResend && (
                <Box mt={1}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<MailOutlineIcon />}
                    onClick={handleResendSetupEmail}
                    disabled={resendLoading}
                  >
                    {resendLoading ? "Sending..." : "Resend setup email"}
                  </Button>
                </Box>
              )}
            </Alert>
          )}

          {resendMessage && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setResendMessage("")}>
              {resendMessage}
            </Alert>
          )}

          {forgotMessage && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setForgotMessage("")}>
              {forgotMessage}
            </Alert>
          )}

          <Stack spacing={2.5}>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              fullWidth
              autoComplete="email"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
               sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "#fff",
                  },

                  "& input": {
                    backgroundColor: "#fff",
                  },

                  "& input:-webkit-autofill": {
                    WebkitBoxShadow: "0 0 0 1000px #fff inset",
                    WebkitTextFillColor: "#000",
                    caretColor: "#000",
                  },
                }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutlineOutlinedIcon />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              label="Password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              fullWidth
              autoComplete="current-password"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleLogin();
              }}
               sx={{
                  "& .MuiOutlinedInput-root": {
                    backgroundColor: "#fff",
                  },

                  "& input": {
                    backgroundColor: "#fff",
                  },

                  "& input:-webkit-autofill": {
                    WebkitBoxShadow: "0 0 0 1000px #fff inset",
                    WebkitTextFillColor: "#000",
                    caretColor: "#000",
                  },
                }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlinedIcon />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((prev) => !prev)}
                      edge="end"
                      aria-label="toggle password visibility"
                    >
                      {showPassword ? (
                        <VisibilityOffOutlinedIcon />
                      ) : (
                        <VisibilityOutlinedIcon />
                      )}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <Box display="flex" justifyContent={{ xs: "center", sm: "flex-end" }} mt={-1}>
              <Button
                variant="text"
                size="small"
                onClick={handleForgotPassword}
                disabled={forgotLoading}
                sx={{ textTransform: "none", fontWeight: 600 }}
              >
                {forgotLoading ? "Sending reset link..." : "Forgot password?"}
              </Button>
            </Box>

            <Button
              variant="contained"
              size="large"
              onClick={handleLogin}
              disabled={loading}
              endIcon={<ArrowForwardRoundedIcon />}
              sx={{
                py: { xs: 1.2, sm: 1.4 },
                fontSize: { xs: "0.9rem", sm: "0.95rem" },
                fontWeight: 700,
              }}
            >
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </Stack>

          <Divider sx={{ my: 3 }} />

          <Typography variant="body2" color="text.secondary" textAlign="center">
            Protected access for authorized users only
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}