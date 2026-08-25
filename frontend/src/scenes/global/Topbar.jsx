import { Box, IconButton, Menu, MenuItem, Typography, useTheme } from "@mui/material";
import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ColorModeContext, tokens } from "../../theme";
import InputBase from "@mui/material/InputBase";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import SearchIcon from "@mui/icons-material/Search";
import LogoutIcon from '@mui/icons-material/Logout';
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
const Topbar = ({ isMobile, mobileOpen, setMobileOpen }) => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const colorMode = useContext(ColorModeContext);
  const navigate = useNavigate();

  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const storedUser = (() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  })();

  const handleProfileMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleProfileMenuClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");
    localStorage.removeItem("user");
    handleProfileMenuClose();
    navigate("/", { replace: true });
  };

  return (
    <Box display="flex" justifyContent="space-between" p={2}>
      {isMobile && (
        <IconButton onClick={() => setMobileOpen((prev) => !prev)}>
          <MenuOutlinedIcon />
        </IconButton>
      )}
      <Box
        display="flex"
        backgroundColor={colors.primary[400]}
        borderRadius="3px"
      >
        
      </Box>

      <Box display="flex">
        <IconButton onClick={colorMode.toggleColorMode}>
          {theme.palette.mode === "dark" ? (
            <DarkModeOutlinedIcon />
          ) : (
            <LightModeOutlinedIcon />
          )}
        </IconButton>

        <IconButton onClick={handleProfileMenuOpen}>
          <PersonOutlinedIcon />
        </IconButton>

        <Menu
          anchorEl={anchorEl}
          open={open}
          onClose={handleProfileMenuClose}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
          transformOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <MenuItem>
            <Box sx={{ px: 2, py: 1 }}>
              <Typography
                sx={{
                  fontWeight: 700,
                  color: theme.palette.text.primary,
                }}
              >
                {storedUser?.full_name || "User"}
              </Typography>

              <Typography
                variant="body2"
                sx={{
                  color: theme.palette.text.secondary,
                  textTransform: "capitalize",
                }}
              >
                {storedUser?.role
                  ? storedUser.role.replaceAll("_", " ")
                  : ""}
              </Typography>
            </Box>
          </MenuItem>

          <MenuItem onClick={() => navigate("/profile-settings")}>
            <SettingsOutlinedIcon sx={{ mr: 1 }} />
            Profile Settings
          </MenuItem>
          
          <MenuItem onClick={handleLogout}>
            <Box display="flex" alignItems="center">
              <LogoutIcon />
              <Typography ml={1}>Logout</Typography>
            </Box>
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
};

export default Topbar;