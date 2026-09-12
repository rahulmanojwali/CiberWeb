import { ThemeProvider, createTheme, alpha } from "@mui/material/styles";
import { RefineThemes } from "@refinedev/mui";
import { CM_COLORS, applyCmThemeVariables } from "../../design-system/theme/tokens";
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

  useEffect(() => {
    applyCmThemeVariables();
  }, []);

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
        main: CM_COLORS.primary,
        contrastText: "#ffffff",
      },
      secondary: {
        ...(RefineThemes.Blue.palette?.secondary || {}),
        main: CM_COLORS.accent,
      },
      background: {
        ...(RefineThemes.Blue.palette?.background || {}),
        default: CM_COLORS.background,
        paper: CM_COLORS.surface,
      },
      text: {
        ...(RefineThemes.Blue.palette?.text || {}),
        primary: CM_COLORS.text,
        secondary: CM_COLORS.textMuted,
      },
      error: {
        ...(RefineThemes.Blue.palette?.error || {}),
        main: CM_COLORS.error,
      },
    },
    components: {
      ...RefineThemes.Blue.components,
      MuiButtonBase: {
        defaultProps: {
          disableRipple: true,
          disableTouchRipple: true,
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            textTransform: "none",
          },
          containedPrimary: {
            backgroundColor: CM_COLORS.primary,
            color: "#ffffff",
            "&:hover": {
              backgroundColor: CM_COLORS.primaryDeep,
            },
          },
          outlinedPrimary: {
            borderColor: CM_COLORS.primary,
            color: CM_COLORS.primary,
            "&:hover": {
              backgroundColor: CM_COLORS.background,
              borderColor: CM_COLORS.primary,
            },
          },
          textPrimary: {
            color: CM_COLORS.primary,
          },
          containedSecondary: {
            backgroundColor: CM_COLORS.accent,
            color: "#ffffff",
            "&:hover": {
              backgroundColor: CM_COLORS.accent,
              opacity: 0.9,
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            color: CM_COLORS.textMuted,
            "&:hover": {
              backgroundColor: alpha(CM_COLORS.background, 0.6),
              color: CM_COLORS.accent,
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
              borderColor: alpha(CM_COLORS.textMuted, 0.45),
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: CM_COLORS.accent,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: CM_COLORS.primary,
              borderWidth: 1.5,
            },
            "&.Mui-disabled .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha(CM_COLORS.textMuted, 0.35),
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          icon: {
            color: CM_COLORS.textMuted,
          },
        },
      },
      MuiMenu: {
        defaultProps: {
          transitionDuration: 0,
        },
      },
      MuiPopover: {
        defaultProps: {
          transitionDuration: 0,
        },
      },
      MuiFilledInput: {
        styleOverrides: {
          root: {
            backgroundColor: CM_COLORS.surface,
            borderRadius: 8,
            "&:before": {
              borderBottomColor: alpha(CM_COLORS.textMuted, 0.45),
            },
            "&:hover:before": {
              borderBottomColor: CM_COLORS.accent,
            },
            "&.Mui-focused:after": {
              borderBottomColor: CM_COLORS.primary,
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: CM_COLORS.textMuted,
            "&.Mui-focused": {
              color: CM_COLORS.primary,
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
        main: CM_COLORS.primary,
        contrastText: "#ffffff",
      },
      secondary: {
        ...(RefineThemes.BlueDark.palette?.secondary || {}),
        main: CM_COLORS.accent,
      },
      background: {
        ...(RefineThemes.BlueDark.palette?.background || {}),
        default: CM_COLORS.background,
        paper: CM_COLORS.surface,
      },
      text: {
        ...(RefineThemes.BlueDark.palette?.text || {}),
        primary: CM_COLORS.text,
        secondary: CM_COLORS.textMuted,
      },
      divider: alpha(CM_COLORS.textMuted, 0.2),
      error: {
        ...(RefineThemes.BlueDark.palette?.error || {}),
        main: CM_COLORS.error,
      },
    },
    components: {
      ...RefineThemes.BlueDark.components,
      MuiButtonBase: {
        defaultProps: {
          disableRipple: true,
          disableTouchRipple: true,
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            textTransform: "none",
          },
          containedPrimary: {
            backgroundColor: CM_COLORS.primary,
            color: "#ffffff",
            "&:hover": {
              backgroundColor: CM_COLORS.primaryDeep,
            },
          },
          outlinedPrimary: {
            borderColor: CM_COLORS.primary,
            color: CM_COLORS.primary,
            "&:hover": {
              backgroundColor: CM_COLORS.background,
              borderColor: CM_COLORS.primary,
            },
          },
          textPrimary: {
            color: CM_COLORS.primary,
          },
          containedSecondary: {
            backgroundColor: CM_COLORS.accent,
            color: "#ffffff",
            "&:hover": {
              backgroundColor: CM_COLORS.accent,
              opacity: 0.9,
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            color: CM_COLORS.textMuted,
            "&:hover": {
              backgroundColor: alpha(CM_COLORS.background, 0.6),
              color: CM_COLORS.accent,
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
              borderColor: alpha(CM_COLORS.textMuted, 0.45),
            },
            "&:hover .MuiOutlinedInput-notchedOutline": {
              borderColor: CM_COLORS.accent,
            },
            "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
              borderColor: CM_COLORS.primary,
              borderWidth: 1.5,
            },
            "&.Mui-disabled .MuiOutlinedInput-notchedOutline": {
              borderColor: alpha(CM_COLORS.textMuted, 0.35),
            },
          },
        },
      },
      MuiSelect: {
        styleOverrides: {
          icon: {
            color: CM_COLORS.textMuted,
          },
        },
      },
      MuiMenu: {
        defaultProps: {
          transitionDuration: 0,
        },
      },
      MuiPopover: {
        defaultProps: {
          transitionDuration: 0,
        },
      },
      MuiFilledInput: {
        styleOverrides: {
          root: {
            backgroundColor: CM_COLORS.surface,
            borderRadius: 8,
            "&:before": {
              borderBottomColor: alpha(CM_COLORS.textMuted, 0.45),
            },
            "&:hover:before": {
              borderBottomColor: CM_COLORS.accent,
            },
            "&.Mui-focused:after": {
              borderBottomColor: CM_COLORS.primary,
            },
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: CM_COLORS.textMuted,
            "&.Mui-focused": {
              color: CM_COLORS.primary,
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
