import { useEffect, useMemo, useState } from "react";
import { Sidebar, Menu, MenuItem } from "react-pro-sidebar";
import { Box, IconButton, Typography, useTheme, Avatar } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { tokens } from "../../theme";
import { navSections } from "../../data/navigation";
import api from "../../api/axios";

import PsychologyIcon from "@mui/icons-material/Psychology";
import MenuOutlinedIcon from "@mui/icons-material/MenuOutlined";
import AssignmentIcon from "@mui/icons-material/Assignment";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import StorageOutlinedIcon from "@mui/icons-material/StorageOutlined";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";

const iconMap = {
  "kpi-results": <AssessmentIcon />,
  kpis: <TrendingUpIcon />,
  users: <PeopleOutlinedIcon />,
  requests: <AssignmentIcon />,
  modules: <StorageOutlinedIcon />,
  ai: <PsychologyIcon />,
};

function SidebarItem({
  label,
  to,
  icon,
  active,
  isMobile,
  setMobileOpen,
}) {
  return (
    <MenuItem
      active={active}
      icon={icon}
      component={
        <Link
          to={to}
          onClick={() => {
            if (isMobile) {
              setMobileOpen(false);
            }
          }}
        />
      }
      style={{
        borderRadius: "10px",
        margin: "4px 10px",
      }}
    >
      <Typography fontSize="14px" fontWeight={500}>
        {label}
      </Typography>
    </MenuItem>
  );
}

export default function SidebarComponent({
  isMobile,
  mobileOpen,
  setMobileOpen,
}) {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const location = useLocation();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [activeModules, setActiveModules] = useState([]);
  const storedUser = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("user")) || null;
    } catch {
      return null;
    }
  }, []);

  const role = storedUser?.role || null;
  const fullName = storedUser?.full_name || "User";
  const permissions = storedUser?.app_permissions || [];
  const [profilePhoto, setProfilePhoto] = useState(storedUser?.profile_photo || "");

  const hasPermission = (code) => {
    if (role === "administrator") return true;

    return permissions.some((permission) => permission.code === code);
  };

  const visibleSections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => {
        if (item.permissionAny) {
          return item.permissionAny.some((permission) =>
            hasPermission(permission)
          );
        }

        return item.permission ? hasPermission(item.permission) : true;
      }),
    }))
    .filter((section) => section.items.length > 0);

  useEffect(() => {
    const handleProfileUpdated = () => {
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      setProfilePhoto(user.profile_photo || "");
    };

    window.addEventListener("profile-updated", handleProfileUpdated);

    return () => {
      window.removeEventListener("profile-updated", handleProfileUpdated);
    };
  }, []);  

  useEffect(() => {
    const fetchModules = async () => {
      try {
        if (!hasPermission("view_dashboard")) {
          setActiveModules([]);
          return;
        }

        const res = await api.get("modules/");

        const onlyActiveModules = (res.data || []).filter(
          (module) => module.is_active
        );

        setActiveModules(onlyActiveModules);
      } catch (err) {
        if (err.response && err.response.status === 403) {
          setActiveModules([]);
          return;
        }

        console.error("Failed to load sidebar modules:", err);
        setActiveModules([]);
      }
    };

    fetchModules();
    const handleModulesUpdated = () => {
      fetchModules();
    };

    window.addEventListener("modules-updated", handleModulesUpdated);

    return () => {
      window.removeEventListener("modules-updated", handleModulesUpdated);
    };
  }, [role, permissions]);

  const getPhotoUrl = (url) => {
    if (!url) return "";
    if (url.startsWith("http")) return url;

    return `http://127.0.0.1:8001${url}`;
  };

  return (
    <Box
      sx={{
        position: isMobile ? "fixed" : "relative",
        zIndex: 1300,

        left: isMobile
          ? mobileOpen
            ? 0
            : "-260px"
          : 0,

        transition: "left 0.3s ease",

        width: isCollapsed ? "84px" : "260px",

        flexShrink: 0,

        backgroundColor: colors.sidebar[500],

        minHeight: "100vh",
        height: "auto",

        alignSelf: "stretch",

        borderRight:
          theme.palette.mode === "light"
            ? "1px solid #dbe5ef"
            : "1px solid rgba(255,255,255,0.08)",

        "& .ps-sidebar-root": {
          minHeight: "100vh",
          height: "100%",
        },

        "& .ps-sidebar-container": {
          background: `${colors.sidebar[500]} !important`,
          borderRight: "none",
          minHeight: "100vh",
          height: "100%",
        },

        "& .ps-menu-button": {
          padding: "12px 16px !important",
          color: "#dbe5ff !important",
          backgroundColor: "transparent !important",
          transition: "all 0.2s ease",
        },

        "& .ps-menu-button:hover": {
          color: "#ffffff !important",
          backgroundColor: "rgba(255,255,255,0.06) !important",
        },

        "& .ps-menu-button.ps-active": {
          color: "#ffffff !important",
          backgroundColor: "rgba(255,255,255,0.06) !important",
          borderLeft: "3px solid #3b82f6",
        },
      }}
    >
      <Sidebar
        collapsed={isCollapsed}
        backgroundColor={colors.sidebar[500]}
      >
        <Menu iconShape="square">
          <MenuItem
            onClick={() => {
              if (isMobile) {
                setMobileOpen(false);
              } else {
                setIsCollapsed((prev) => !prev);
              }
            }}
            icon={isCollapsed ? <MenuOutlinedIcon /> : undefined}
            style={{
              margin: "12px 0 12px 0",
              color: "#ffffff",
            }}
          >
            {!isCollapsed && (
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                px={1}
              >
                <Typography
                  variant="h5"
                  sx={{
                    color: "#ffffff",
                    fontWeight: 700,
                  }}
                >
                  LeoMetrics
                </Typography>

                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();

                    if (isMobile) {
                      setMobileOpen(false);
                    } else {
                      setIsCollapsed((prev) => !prev);
                    }
                  }}
                >
                  <MenuOutlinedIcon sx={{ color: "#ffffff" }} />
                </IconButton>
              </Box>
            )}
          </MenuItem>

          {!isCollapsed && (
            <Box px="20px" pt="8px" pb="18px">
              <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                gap={1}
              >
                <Avatar
                  src={getPhotoUrl(profilePhoto) || undefined}
                  sx={{
                    width: 54,
                    height: 54,
                    bgcolor: "rgba(255,255,255,0.18)",
                    color: "#ffffff",
                    fontWeight: 700,
                  }}
                >
                  {!profilePhoto && fullName.charAt(0).toUpperCase()}
                </Avatar>

                <Box textAlign="center">
                  <Typography
                    variant="h6"
                    sx={{
                      color: "#ffffff",
                      fontWeight: 700,
                    }}
                  >
                    {fullName}
                  </Typography>
                </Box>
              </Box>
            </Box>
          )}

          <Box px={isCollapsed ? 0 : 1}>
            {activeModules.length > 0 && (
              <Box mb={1}>
                {!isCollapsed && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: "rgba(219,229,255,0.55)",
                      px: "20px",
                      py: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    ITSM Modules
                  </Typography>
                )}

                {activeModules.map((module) => (
                  <SidebarItem
                    key={module.id}
                    label={module.name}
                    to={`/modules/${module.id}`}
                    icon={<AssessmentIcon />}
                    active={location.pathname === `/modules/${module.id}`}
                    isMobile={isMobile}
                    setMobileOpen={setMobileOpen}
                  />
                ))}
              </Box>
            )}

            {visibleSections.map((section) => (
              <Box key={section.key} mb={1}>
                {section.title && !isCollapsed && (
                  <Typography
                    variant="body2"
                    sx={{
                      color: "rgba(219,229,255,0.55)",
                      px: "20px",
                      py: "10px",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                      fontSize: "11px",
                      fontWeight: 700,
                    }}
                  >
                    {section.title}
                  </Typography>
                )}

                {section.items.map((item) => (
                  <SidebarItem
                    key={item.key}
                    label={item.label}
                    to={item.path}
                    icon={iconMap[item.iconKey]}
                    active={location.pathname === item.path}
                    isMobile={isMobile}
                    setMobileOpen={setMobileOpen}
                  />
                ))}
              </Box>
            ))}
          </Box>
        </Menu>
      </Sidebar>
    </Box>
  );
}