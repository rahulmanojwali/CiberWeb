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
        main: BRAND_COLORS.secondary,
      },
      background: {
        ...(RefineThemes.Blue.palette?.background || {}),
        default: BRAND_COLORS.bg,
        paper: BRAND_COLORS.surface,
      },
      text: {
        ...(RefineThemes.Blue.palette?.text || {}),
        primary: BRAND_COLORS.text,
        secondary: BRAND_COLORS.textMuted,
      },
      error: {
        ...(RefineThemes.Blue.palette?.error || {}),
        main: BRAND_COLORS.error,
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
          containedPrimary: {
            backgroundColor: BRAND_COLORS.primary,
            color: "#ffffff",
            "&:hover": {
              backgroundColor: BRAND_COLORS.primaryDark,
            },
          },
          outlinedPrimary: {
            borderColor: BRAND_COLORS.primary,
            color: BRAND_COLORS.primaryDark,
            "&:hover": {
              backgroundColor: BRAND_COLORS.bg,
              borderColor: BRAND_COLORS.primaryDark,
            },
          },
          textPrimary: {
            color: BRAND_COLORS.primaryDark,
          },
          containedSecondary: {
            backgroundColor: BRAND_COLORS.secondary,
            color: "#ffffff",
            "&:hover": {
              backgroundColor: BRAND_COLORS.secondary,
              opacity: 0.9,
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            color: BRAND_COLORS.textMuted,
            "&:hover": {
              backgroundColor: alpha(BRAND_COLORS.bg, 0.6),
              color: BRAND_COLORS.secondary,
            },
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
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha(BRAND_COLORS.textMuted, 0.45),
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: BRAND_COLORS.secondary,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: BRAND_COLORS.primary,
              borderWidth: 1.5,
            },
            "&.Mui-disabled .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha(BRAND_COLORS.textMuted, 0.35),
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          icon: {
            color: BRAND_COLORS.textMuted,
          },
        },
      },
      MuiFilledInput: {
        styleOverrides: {
          root: {
            backgroundColor: BRAND_COLORS.surface,
            borderRadius: 8,
            "&:before": {
              borderBottomColor: alpha(BRAND_COLORS.textMuted, 0.45),
            },
            "&:hover:before": {
              borderBottomColor: BRAND_COLORS.secondary,
            },
            "&.Mui-focused:after": {
              borderBottomColor: BRAND_COLORS.primary,
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: BRAND_COLORS.textMuted,
            "&.Mui-focused": {
              color: BRAND_COLORS.primaryDark,
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
        main: BRAND_COLORS.secondary,
      },
      background: {
        ...(RefineThemes.BlueDark.palette?.background || {}),
        default: BRAND_COLORS.bg,
        paper: BRAND_COLORS.surface,
      },
      text: {
        ...(RefineThemes.BlueDark.palette?.text || {}),
        primary: BRAND_COLORS.text,
        secondary: BRAND_COLORS.textMuted,
      },
      divider: alpha(BRAND_COLORS.textMuted, 0.2),
      error: {
        ...(RefineThemes.BlueDark.palette?.error || {}),
        main: BRAND_COLORS.error,
      },
    },
    components: {
      ...RefineThemes.BlueDark.components,
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 999,
            textTransform: "none",
          },
          containedPrimary: {
            backgroundColor: BRAND_COLORS.primary,
            color: "#ffffff",
            "&:hover": {
              backgroundColor: BRAND_COLORS.primaryDark,
            },
          },
          outlinedPrimary: {
            borderColor: BRAND_COLORS.primary,
            color: BRAND_COLORS.primaryDark,
            "&:hover": {
              backgroundColor: BRAND_COLORS.bg,
              borderColor: BRAND_COLORS.primaryDark,
            },
          },
          textPrimary: {
            color: BRAND_COLORS.primaryDark,
          },
          containedSecondary: {
            backgroundColor: BRAND_COLORS.secondary,
            color: "#ffffff",
            "&:hover": {
              backgroundColor: BRAND_COLORS.secondary,
              opacity: 0.9,
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            color: BRAND_COLORS.textMuted,
            "&:hover": {
              backgroundColor: alpha(BRAND_COLORS.bg, 0.6),
              color: BRAND_COLORS.secondary,
            },
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
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha(BRAND_COLORS.textMuted, 0.45),
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: BRAND_COLORS.secondary,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: BRAND_COLORS.primary,
              borderWidth: 1.5,
            },
            "&.Mui-disabled .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha(BRAND_COLORS.textMuted, 0.35),
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          icon: {
            color: BRAND_COLORS.textMuted,
          },
        },
      },
      MuiFilledInput: {
        styleOverrides: {
          root: {
            backgroundColor: BRAND_COLORS.surface,
            borderRadius: 8,
            "&:before": {
              borderBottomColor: alpha(BRAND_COLORS.textMuted, 0.45),
            },
            "&:hover:before": {
              borderBottomColor: BRAND_COLORS.secondary,
            },
            "&.Mui-focused:after": {
              borderBottomColor: BRAND_COLORS.primary,
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: BRAND_COLORS.textMuted,
            "&.Mui-focused": {
              color: BRAND_COLORS.primaryDark,
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
