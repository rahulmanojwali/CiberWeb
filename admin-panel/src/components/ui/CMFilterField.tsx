import TextField, { type TextFieldProps } from "@mui/material/TextField";
import type { ElementType, FC } from "react";
import { FilterInputAdornment } from "./FilterInputAdornment";

type CMFilterFieldProps = TextFieldProps & {
  icon?: ElementType;
};

export const CMFilterField: FC<CMFilterFieldProps> = ({ icon: Icon, InputProps, className = "", ...props }) => {
  return (
    <TextField
      size="small"
      className={`cm-filter-field ${className}`.trim()}
      InputProps={
        Icon
          ? {
              ...InputProps,
              startAdornment: <FilterInputAdornment icon={Icon} />,
            }
          : InputProps
      }
      {...props}
    />
  );
};
