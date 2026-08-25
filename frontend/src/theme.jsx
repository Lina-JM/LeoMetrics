import { createContext, useState, useMemo } from "react";
import { createTheme } from "@mui/material/styles";

export const tokens = (mode) => ({
  ...(mode === "dark"
    ? {
        grey: {
          100: "#f5f7fb",
          200: "#dfe5ef",
          300: "#b8c2d3",
          400: "#8b97ad",
          500: "#667085",
          600: "#4b5565",
          700: "#344054",
          800: "#1f2937",
          900: "#111827",
        },
        primary: {
          100: "#dbe7ff",
          200: "#b8cdfa",
          300: "#8ba9f7",
          400: "#5f85f2",
          500: "#3b82f6",
          600: "#2f6ad3",
          700: "#1d4f9c",
          800: "#0b1739",
          900: "#081229",
        },
        sidebar: {
          100: "#c7d2fe",
          200: "#93a4d8",
          300: "#6c7aa8",
          400: "#31416d",
          500: "#0b1739",
          600: "#09122e",
          700: "#071026",
          800: "#050b1c",
          900: "#030611",
        },
        success: {
          500: "#22c55e",
          600: "#16a34a",
        },
        warning: {
          500: "#eab308",
          600: "#ca8a04",
        },
        error: {
          500: "#ef4444",
          600: "#dc2626",
        },
        background: {
          default: "#0b1739",
          paper: "#0b1739",
          card: "#0f1d45",
          muted: "#132653",
          border: "#263a6b",
        },
      }
    : {
        grey: {
          100: "#111827",
          200: "#1f2937",
          300: "#344054",
          400: "#667085",
          500: "#8b97ad",
          600: "#b8c2d3",
          700: "#dfe5ef",
          800: "#eef2f7",
          900: "#f8fafc",
        },
        primary: {
          100: "#eff6ff",
          200: "#dbeafe",
          300: "#bfdbfe",
          400: "#93c5fd",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          800: "#1e40af",
          900: "#172554",
        },
        sidebar: {
          100: "#c7d2fe",
          200: "#93a4d8",
          300: "#6c7aa8",
          400: "#31416d",
          500: "#0b1739",
          600: "#09122e",
          700: "#071026",
          800: "#050b1c",
          900: "#030611",
        },
        success: {
          500: "#22c55e",
          600: "#16a34a",
        },
        warning: {
          500: "#eab308",
          600: "#ca8a04",
        },
        error: {
          500: "#ef4444",
          600: "#dc2626",
        },
        background: {
          default: "#eef2f7",
          paper: "#ffffff",
          card: "#ffffff",
          muted: "#f3f4f6",
          border: "#e5e7eb",
        },
      }),
});

export const themeSettings = (mode) => {
  const colors = tokens(mode);

  return {
    palette: {
      mode,
      primary: {
        main: colors.primary[500],
        light: colors.primary[400],
        dark: colors.primary[700],
      },
      secondary: {
        main: colors.sidebar[500],
      },
      success: {
        main: colors.success[500],
      },
      warning: {
        main: colors.warning[500],
      },
      error: {
        main: colors.error[500],
      },
      neutral: {
        dark: colors.grey[300],
        main: colors.grey[400],
        light: colors.grey[700],
      },
      background: {
        default: colors.background.default,
        paper: colors.background.paper,
      },
      text: {
        primary: mode === "dark" ? colors.grey[100] : colors.grey[100],
        secondary: mode === "dark" ? colors.grey[300] : colors.grey[400],
      },
    },
    typography: {
      fontFamily: ["Inter", "Source Sans Pro", "sans-serif"].join(","),
      fontSize: 12,
      h1: { fontSize: 40, fontWeight: 700 },
      h2: { fontSize: 32, fontWeight: 700 },
      h3: { fontSize: 24, fontWeight: 700 },
      h4: { fontSize: 20, fontWeight: 600 },
      h5: { fontSize: 16, fontWeight: 600 },
      h6: { fontSize: 14, fontWeight: 600 },
      body1: { fontSize: 14 },
      body2: { fontSize: 13 },
    },
    shape: {
      borderRadius: 12,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: colors.background.default,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: colors.background.card,
            border: `1px solid ${colors.background.border}`,
            boxShadow:
              mode === "light"
                ? "0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06)"
                : "0 0 0 1px rgba(255,255,255,0.02)",
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none",
            backgroundColor: colors.background.card,
            borderColor: colors.background.border,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            textTransform: "none",
            fontWeight: 600,
          },
        },
      },
      MuiInputBase: {
        styleOverrides: {
          root: {
            borderRadius: 10,
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            borderRadius: 10,
          },
        },
      },
    },
  };
};

export const ColorModeContext = createContext({
  toggleColorMode: () => {},
});

export const useMode = () => {
  const [mode, setMode] = useState("light");

  const colorMode = useMemo(
    () => ({
      toggleColorMode: () =>
        setMode((prev) => (prev === "light" ? "dark" : "light")),
    }),
    []
  );

  const theme = useMemo(() => createTheme(themeSettings(mode)), [mode]);

  return [theme, colorMode];
};