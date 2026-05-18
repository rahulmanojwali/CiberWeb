import InputAdornment from "@mui/material/InputAdornment";
import type { ElementType } from "react";

type FilterInputAdornmentProps = {
  icon: ElementType;
};

export function FilterInputAdornment({ icon: Icon }: FilterInputAdornmentProps) {
  return (
    <InputAdornment position="start">
      <Icon sx={{ color: "var(--cm-primary)", fontSize: 18 }} />
    </InputAdornment>
  );
}
