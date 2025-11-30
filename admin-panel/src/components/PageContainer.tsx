import Box, { BoxProps } from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import type { FC, ReactNode } from "react";

type PageContainerProps = BoxProps & {
  title?: ReactNode;
  actions?: ReactNode;
};

export const PageContainer: FC<PageContainerProps> = ({
  title,
  actions,
  children,
  sx,
  ...rest
}) => {
  return (
    <Box
      sx={{
        width: "100%",
        maxWidth: 1440,
        mx: "auto",
        px: { xs: 1.5, md: 3 },
        py: { xs: 2, md: 3 },
        display: "flex",
        flexDirection: "column",
        gap: 2,
        ...sx,
      }}
      {...rest}
    >
      {(title || actions) && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            width: "100%",
          }}
        >
          {title && (
            <Typography variant="h5" component="h1">
              {title}
            </Typography>
          )}
          {actions && <Box sx={{ ml: "auto" }}>{actions}</Box>}
        </Box>
      )}
      {children}
    </Box>
  );
};
