import React, { type ComponentType } from "react";
import { SnackbarContent, SnackbarProvider, useSnackbar } from "notistack";
import type {
  OptionsObject,
  ProviderContext,
  SnackbarKey,
  SnackbarMessage,
  SnackbarOrigin,
  SnackbarProviderProps,
} from "notistack";

export const withSnackbar = <P extends object>(Component: ComponentType<P>) => {
  const Wrapped: React.FC<P> = (props) => {
    const context = useSnackbar();
    return <Component {...props} {...context} />;
  };

  Wrapped.displayName = `WithSnackbar(${Component.displayName || Component.name || "Component"})`;

  return Wrapped;
};

export {
  SnackbarProvider,
  SnackbarContent,
  useSnackbar,
  type OptionsObject,
  type ProviderContext,
  type SnackbarKey,
  type SnackbarMessage,
  type SnackbarOrigin,
  type SnackbarProviderProps,
};

export type WithSnackbarProps = ProviderContext;
