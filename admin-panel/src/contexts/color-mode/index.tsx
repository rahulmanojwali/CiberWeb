import { ThemeProvider, createTheme, alpha } from "@mui/material/styles";
import { RefineThemes } from "@refinedev/mui";
import { BRAND_COLORS } from "../../config/appConfig";
import React, {
  PropsWithChildren,
  createContext,
  useEffect,
  useState,
} from "react";

type ColorModeContextType = {
  mode: string;
  setMode: () => void;
};

export const ColorModeContext = createContext<ColorModeContextType>(
  {} as ColorModeContextType
);

export const ColorModeContextProvider: React.FC<PropsWithChildren> = ({
  children,
}) => {
  const colorModeFromLocalStorage = localStorage.getItem("colorMode");
  const isSystemPreferenceDark = window?.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches;

  const systemPreference = isSystemPreferenceDark ? "dark" : "light";
  const [mode, setMode] = useState(
    colorModeFromLocalStorage || systemPreference
  );

  useEffect(() => {
    window.localStorage.setItem("colorMode", mode);
  }, [mode]);

  const setColorMode = () => {
    if (mode === "light") {
      setMode("dark");
    } else {
      setMode("light");
    }
  };

  const lightTheme = createTheme(RefineThemes.Blue, {
    palette: {
      ...RefineThemes.Blue.palette,
      primary: {
        ...(RefineThemes.Blue.palette?.primary || {}),
        main: BRAND_COLORS.primary,
        contrastText: "#ffffff",
      },
      secondary: {
        ...(RefineThemes.Blue.palette?.secondary || {}),
        main: BRAND_COLORS.primaryDark,
      },
      background: {
        ...(RefineThemes.Blue.palette?.background || {}),
        default: "#f4fbf6",
        paper: "#ffffff",
      },
    },
    components: {
      ...RefineThemes.Blue.components,
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            textTransform: "none",
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            minHeight: 48,
            paddingTop: 6,
            paddingBottom: 6,
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            minWidth: 36,
            marginRight: 8,
            "& .MuiSvgIcon-root": {
              fontSize: 20,
            },
          },
        },
      },
    },
  });

  const darkTheme = createTheme(RefineThemes.BlueDark, {
    palette: {
      ...RefineThemes.BlueDark.palette,
      primary: {
        ...(RefineThemes.BlueDark.palette?.primary || {}),
        main: BRAND_COLORS.primary,
        contrastText: "#ffffff",
      },
      secondary: {
        ...(RefineThemes.BlueDark.palette?.secondary || {}),
        main: "#58d08b",
      },
      background: {
        ...(RefineThemes.BlueDark.palette?.background || {}),
        default: "#0f1a13",
        paper: "#17261d",
      },
      text: {
        ...(RefineThemes.BlueDark.palette?.text || {}),
        primary: "#effff3",
        secondary: alpha("#effff3", 0.72),
      },
      divider: alpha("#ffffff", 0.12),
    },
    components: {
      ...RefineThemes.BlueDark.components,
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            textTransform: "none",
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            minHeight: 48,
            paddingTop: 6,
            paddingBottom: 6,
          },
        },
      },
      MuiListItemIcon: {
        styleOverrides: {
          root: {
            minWidth: 36,
            marginRight: 8,
            "& .MuiSvgIcon-root": {
              fontSize: 20,
            },
          },
        },
      },
    },
  });

  return (
    <ColorModeContext.Provider
      value={{
        setMode: setColorMode,
        mode,
      }}
    >
      <ThemeProvider theme={mode === "light" ? lightTheme : darkTheme}>
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
};
