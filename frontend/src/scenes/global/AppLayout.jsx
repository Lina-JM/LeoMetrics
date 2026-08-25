import { Box, useMediaQuery, useTheme } from "@mui/material";
import { Outlet } from "react-router-dom";
import { useState } from "react";

import SidebarComponent from "./Sidebar";
import Topbar from "./Topbar";

export default function AppLayout() {
  const theme = useTheme();

  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <Box display="flex" minHeight="100vh"  alignItems="stretch"  bgcolor="background.default">
      <SidebarComponent
        isMobile={isMobile}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
      />

      <Box
        flex="1"
        display="flex"
        flexDirection="column"
        minWidth={0}
      >
        <Topbar
          isMobile={isMobile}
          mobileOpen={mobileOpen}
          setMobileOpen={setMobileOpen}
        />

        <Box
          flex="1"
          px={{ xs: 1.5, sm: 2, md: 3 }}
          py={{ xs: 2, md: 3 }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}